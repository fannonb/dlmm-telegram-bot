import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { oracleService } from './oracle.service';
import { poolService } from './pool.service';
import { volumeCache } from './meteoraVolume.service';

/**
 * Hourly snapshot for intraday analysis
 */
export interface HourlySnapshot {
    timestamp: number;
    poolAddress: string;
    price: number;
    volume24h: number;
    volumeRatio: number;
    activeBin: number;
    volatility6h: number;
}

/**
 * Intraday analysis context
 */
export interface IntraDayContext {
    snapshots: HourlySnapshot[];
    momentum: {
        price: number;          // Average hourly price change %
        volume: number;         // Volume acceleration %
        direction: 'bullish' | 'bearish' | 'neutral';
    };
    signals: {
        priceBreakout: boolean;
        volumeSpike: boolean;
        volatilityShift: boolean;
    };
}

class HourlySnapshotService {
    private dataDir: string;

    constructor(dataDir: string = join(process.cwd(), 'data', 'snapshots', 'hourly')) {
        this.dataDir = dataDir;
        this.ensureDataDir();
    }

    private ensureDataDir(): void {
        if (!existsSync(this.dataDir)) {
            mkdirSync(this.dataDir, { recursive: true });
        }
    }

    private getSnapshotFile(poolAddress: string): string {
        return join(this.dataDir, `${poolAddress}.json`);
    }

    /**
     * Record an hourly snapshot for a pool
     */
    async recordSnapshot(poolAddress: string): Promise<void> {
        try {
            // Get pool info
            const poolInfo = await poolService.getPoolInfo(poolAddress);
            const volumeData = await volumeCache.getVolume(poolAddress);

            // Calculate 6h volatility from existing snapshots
            const existing = this.loadSnapshots(poolAddress, 6);
            const volatility6h = this.calculateVolatility(existing);

            const snapshot: HourlySnapshot = {
                timestamp: Date.now(),
                poolAddress,
                price: poolInfo.price || 0,
                volume24h: volumeData.volume24h,
                volumeRatio: volumeData.volumeRatio,
                activeBin: poolInfo.activeBin,
                volatility6h
            };

            // Load existing snapshots
            const file = this.getSnapshotFile(poolAddress);
            let snapshots: HourlySnapshot[] = [];

            if (existsSync(file)) {
                const data = readFileSync(file, 'utf-8');
                snapshots = JSON.parse(data) || [];
            }

            // Add new snapshot
            snapshots.push(snapshot);

            // Keep only 7 days (168 hours)
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            snapshots = snapshots.filter(s => s.timestamp >= sevenDaysAgo);

            // Save
            writeFileSync(file, JSON.stringify(snapshots, null, 2));
        } catch (error) {
            console.error(`Error recording hourly snapshot for ${poolAddress}:`, error);
        }
    }

    /**
     * Load hourly snapshots for a pool
     */
    loadSnapshots(poolAddress: string, hours: number = 24): HourlySnapshot[] {
        try {
            const file = this.getSnapshotFile(poolAddress);
            if (!existsSync(file)) return [];

            const data = readFileSync(file, 'utf-8');
            const all = JSON.parse(data) || [];

            const cutoff = Date.now() - hours * 60 * 60 * 1000;
            return all.filter((s: HourlySnapshot) => s.timestamp >= cutoff);
        } catch {
            return [];
        }
    }

    /**
     * Get intraday context for LLM analysis
     */
    getIntraDayContext(poolAddress: string, hours: number = 24): IntraDayContext {
        const snapshots = this.loadSnapshots(poolAddress, hours);

        if (snapshots.length < 2) {
            return {
                snapshots,
                momentum: { price: 0, volume: 0, direction: 'neutral' },
                signals: { priceBreakout: false, volumeSpike: false, volatilityShift: false }
            };
        }

        const momentum = this.calculateMomentum(snapshots);
        const signals = this.detectSignals(snapshots);

        return { snapshots, momentum, signals };
    }

    /**
     * Calculate volatility from price snapshots
     */
    private calculateVolatility(snapshots: HourlySnapshot[]): number {
        if (snapshots.length < 2) return 0;

        const prices = snapshots.map(s => s.price);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

        const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);

        return avgPrice > 0 ? stdDev / avgPrice : 0;
    }

    /**
     * Calculate price and volume momentum
     */
    private calculateMomentum(snapshots: HourlySnapshot[]): IntraDayContext['momentum'] {
        if (snapshots.length < 2) {
            return { price: 0, volume: 0, direction: 'neutral' };
        }

        // Price momentum: average hourly change
        let totalPriceChange = 0;
        for (let i = 1; i < snapshots.length; i++) {
            const change = ((snapshots[i].price - snapshots[i - 1].price) / snapshots[i - 1].price) * 100;
            totalPriceChange += change;
        }
        const avgPriceChange = totalPriceChange / (snapshots.length - 1);

        // Volume momentum: acceleration
        const volumes = snapshots.map(s => s.volume24h);
        let volumeAcceleration = 0;
        if (volumes.length >= 3) {
            const recent = volumes.slice(-3);
            const older = volumes.slice(0, Math.min(3, volumes.length - 3));
            const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
            const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b) / older.length : recentAvg;
            volumeAcceleration = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
        }

        // Direction
        let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        if (avgPriceChange > 0.5 && volumeAcceleration > 0) {
            direction = 'bullish';
        } else if (avgPriceChange < -0.5 && volumeAcceleration > 0) {
            direction = 'bearish';
        }

        return {
            price: avgPriceChange,
            volume: volumeAcceleration,
            direction
        };
    }

    /**
     * Detect intraday signals
     */
    private detectSignals(snapshots: HourlySnapshot[]): IntraDayContext['signals'] {
        if (snapshots.length < 6) {
            return { priceBreakout: false, volumeSpike: false, volatilityShift: false };
        }

        const prices = snapshots.map(s => s.price);
        const volumes = snapshots.map(s => s.volume24h);
        const volatilities = snapshots.map(s => s.volatility6h);

        // Price breakout: recent price exceeds 95th percentile of period
        const recentPrice = prices[prices.length - 1];
        const sorted = [...prices].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(prices.length * 0.95)];
        const p5 = sorted[Math.floor(prices.length * 0.05)];
        const priceBreakout = recentPrice > p95 || recentPrice < p5;

        // Volume spike: recent volume > 1.5x average
        const recentVolume = volumes[volumes.length - 1];
        const avgVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
        const volumeSpike = recentVolume > avgVolume * 1.5;

        // Volatility shift: recent volatility 20% higher than average
        const recentVol = volatilities[volatilities.length - 1];
        const avgVol = volatilities.slice(0, -1).reduce((a, b) => a + b, 0) / (volatilities.length - 1);
        const volatilityShift = recentVol > avgVol * 1.2;

        return { priceBreakout, volumeSpike, volatilityShift };
    }
}

export const hourlySnapshotService = new HourlySnapshotService();
