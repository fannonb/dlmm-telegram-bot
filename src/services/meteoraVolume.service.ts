import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Volume data for a pool
 */
export interface PoolVolumeData {
    volume24h: number;
    volume7d: number;
    volumeRatio: number; // 24h / (7d average)
    fees24h: number; // Pool's total fees in last 24h (USD)
    totalLiquidity: number; // Pool's total liquidity (USD)
    baseFeePercentage: number; // Base fee percentage
}

/**
 * Historical volume entry
 */
interface VolumeHistoryEntry {
    date: string; // YYYY-MM-DD
    volume: number;
}

/**
 * Pool volume history storage
 */
interface VolumeHistory {
    [poolAddress: string]: VolumeHistoryEntry[];
}

// Path to volume history file
const VOLUME_HISTORY_PATH = path.join(process.cwd(), 'data', 'volume_history.json');

/**
 * Meteora DLMM API response for pair info
 */
interface MeteoraPairResponse {
    address: string;
    name: string;
    mint_x: string;
    mint_y: string;
    reserve_x: string;
    reserve_y: string;
    reserve_x_amount: number;
    reserve_y_amount: number;
    bin_step: number;
    base_fee_percentage: string;
    max_fee_percentage: string;
    protocol_fee_percentage: string;
    liquidity: string;
    reward_mint_x: string;
    reward_mint_y: string;
    fees_24h: number;
    today_fees: number;
    trade_volume_24h: number;
    cumulative_trade_volume: string;
    cumulative_fee_volume: string;
    current_price: number;
    apr: number;
    apy: number;
    farm_apr: number;
    farm_apy: number;
    hide: boolean;
}

/**
 * Load volume history from file
 */
function loadVolumeHistory(): VolumeHistory {
    try {
        if (fs.existsSync(VOLUME_HISTORY_PATH)) {
            const data = fs.readFileSync(VOLUME_HISTORY_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.warn('⚠️ Failed to load volume history, starting fresh');
    }
    return {};
}

/**
 * Save volume history to file
 */
function saveVolumeHistory(history: VolumeHistory): void {
    try {
        const dir = path.dirname(VOLUME_HISTORY_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(VOLUME_HISTORY_PATH, JSON.stringify(history, null, 2));
    } catch (error) {
        console.warn('⚠️ Failed to save volume history');
    }
}

/**
 * Get today's date string (YYYY-MM-DD)
 */
function getTodayString(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Calculate 7-day volume and ratio from history
 */
function calculateVolumeMetrics(
    poolAddress: string,
    currentVolume24h: number,
    history: VolumeHistory
): { volume7d: number; volumeRatio: number } {
    const poolHistory = history[poolAddress] || [];
    const today = getTodayString();
    
    // Get dates for last 7 days (excluding today since we're using current 24h)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Filter to get last 7 days of historical data
    const recentHistory = poolHistory.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= sevenDaysAgo && entry.date !== today;
    });
    
    if (recentHistory.length === 0) {
        // No historical data - cannot calculate meaningful ratio
        // Return 1.0 as neutral (average day)
        return {
            volume7d: currentVolume24h * 7, // Estimate
            volumeRatio: 1.0
        };
    }
    
    // Calculate total 7-day volume (historical + today)
    const historicalVolume = recentHistory.reduce((sum, e) => sum + e.volume, 0);
    const daysOfData = recentHistory.length + 1; // Include today
    
    // Extrapolate to 7 days if we have partial data
    const estimatedVolume7d = daysOfData >= 7 
        ? historicalVolume + currentVolume24h
        : (historicalVolume + currentVolume24h) * (7 / daysOfData);
    
    // Calculate daily average from historical data
    const historicalDailyAvg = historicalVolume / recentHistory.length;
    
    // Volume ratio: today's volume compared to historical average
    // > 1.0 = above average day, < 1.0 = below average day
    const volumeRatio = historicalDailyAvg > 0 
        ? currentVolume24h / historicalDailyAvg 
        : 1.0;
    
    return {
        volume7d: Math.round(estimatedVolume7d),
        volumeRatio: Math.round(volumeRatio * 100) / 100 // Round to 2 decimal places
    };
}

/**
 * Update volume history with today's data
 */
function updateVolumeHistory(poolAddress: string, volume24h: number, history: VolumeHistory): void {
    const today = getTodayString();
    
    if (!history[poolAddress]) {
        history[poolAddress] = [];
    }
    
    // Remove any existing entry for today and update
    history[poolAddress] = history[poolAddress].filter(e => e.date !== today);
    history[poolAddress].push({ date: today, volume: volume24h });
    
    // Keep only last 14 days to prevent unbounded growth
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const cutoffDate = fourteenDaysAgo.toISOString().split('T')[0];
    
    history[poolAddress] = history[poolAddress].filter(e => e.date >= cutoffDate);
    
    // Save updated history
    saveVolumeHistory(history);
}

/**
 * Fetch volume data from Meteora API
 */
export async function fetchPoolVolume(poolAddress: string): Promise<PoolVolumeData> {
    try {
        const response = await axios.get<MeteoraPairResponse>(
            `https://dlmm-api.meteora.ag/pair/${poolAddress}`,
            {
                timeout: 15000,
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        const data = response.data;

        // Extract current 24h volume
        const volume24h = data.trade_volume_24h || 0;
        
        // Extract fee data
        const fees24h = data.fees_24h || 0;
        const totalLiquidity = parseFloat(data.liquidity) || 0;
        const baseFeePercentage = parseFloat(data.base_fee_percentage) || 0;

        // Load volume history and calculate metrics
        const history = loadVolumeHistory();
        const { volume7d, volumeRatio } = calculateVolumeMetrics(poolAddress, volume24h, history);
        
        // Update history with today's volume
        updateVolumeHistory(poolAddress, volume24h, history);

        return {
            volume24h,
            volume7d,
            volumeRatio,
            fees24h,
            totalLiquidity,
            baseFeePercentage
        };
    } catch (error: any) {
        console.warn(`⚠️  Failed to fetch volume for ${poolAddress}: ${error.message}`);

        // Return default neutral values on error
        return {
            volume24h: 0,
            volume7d: 0,
            volumeRatio: 1.0,
            fees24h: 0,
            totalLiquidity: 0,
            baseFeePercentage: 0
        };
    }
}

/**
 * Fetch volume data with caching to avoid excessive API calls
 */
class VolumeCache {
    private cache: Map<string, { data: PoolVolumeData; timestamp: number }> = new Map();
    private cacheDuration = 5 * 60 * 1000; // 5 minutes

    async getVolume(poolAddress: string): Promise<PoolVolumeData> {
        const now = Date.now();
        const cached = this.cache.get(poolAddress);

        // Return cached data if still valid
        if (cached && (now - cached.timestamp) < this.cacheDuration) {
            return cached.data;
        }

        // Fetch fresh data
        const data = await fetchPoolVolume(poolAddress);
        this.cache.set(poolAddress, { data, timestamp: now });

        return data;
    }

    clearCache(): void {
        this.cache.clear();
    }
}

// Export singleton instance
export const volumeCache = new VolumeCache();
