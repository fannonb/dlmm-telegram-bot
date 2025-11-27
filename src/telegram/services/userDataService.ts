/**
 * User Data Service
 * 
 * Manages per-user data storage with complete isolation.
 * Each Telegram user has their own directory with:
 * - config.json: User preferences and settings
 * - positions.json: Position tracking history
 * - analytics/: Analytics snapshots
 */

import fs from 'fs';
import path from 'path';
import { UserConfig, DEFAULT_USER_CONFIG, AlertConfig, LLMConfig, AutoRebalanceConfig } from '../types';
import crypto from 'crypto';

// Base directory for all user data
const USERS_DATA_DIR = path.join(process.cwd(), 'data', 'users');

// Encryption key from environment
const ENCRYPTION_KEY = process.env.WALLET_MASTER_PASSWORD || 'default-key-change-me';

export interface PositionHistoryEntry {
    positionAddress: string;
    poolAddress: string;
    poolName: string;
    action: 'created' | 'rebalanced' | 'closed' | 'fees_claimed' | 'compounded';
    timestamp: number;
    details?: Record<string, any>;
}

export interface AnalyticsSnapshot {
    timestamp: number;
    positions: {
        address: string;
        poolAddress: string;
        valueUsd: number;
        unclaimedFeesUsd: number;
        inRange: boolean;
    }[];
    totalValueUsd: number;
    totalFeesUsd: number;
}

export class UserDataService {
    private configCache: Map<number, UserConfig> = new Map();

    constructor() {
        this.ensureBaseDirectory();
    }

    /**
     * Ensure the base users directory exists
     */
    private ensureBaseDirectory(): void {
        if (!fs.existsSync(USERS_DATA_DIR)) {
            fs.mkdirSync(USERS_DATA_DIR, { recursive: true });
        }
    }

    /**
     * Get the directory path for a specific user
     */
    getUserDirectory(telegramId: number): string {
        return path.join(USERS_DATA_DIR, telegramId.toString());
    }

    /**
     * Ensure user directory and subdirectories exist
     */
    ensureUserDirectory(telegramId: number): void {
        const userDir = this.getUserDirectory(telegramId);
        
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        
        // Create subdirectories
        const analyticsDir = path.join(userDir, 'analytics');
        if (!fs.existsSync(analyticsDir)) {
            fs.mkdirSync(analyticsDir, { recursive: true });
        }
    }

    /**
     * Check if a user exists (has been initialized)
     */
    userExists(telegramId: number): boolean {
        const configPath = path.join(this.getUserDirectory(telegramId), 'config.json');
        return fs.existsSync(configPath);
    }

    // ==================== CONFIG MANAGEMENT ====================

    /**
     * Get user configuration (with caching)
     */
    getConfig(telegramId: number): UserConfig {
        // Check cache first
        if (this.configCache.has(telegramId)) {
            return this.configCache.get(telegramId)!;
        }

        const configPath = path.join(this.getUserDirectory(telegramId), 'config.json');
        
        if (!fs.existsSync(configPath)) {
            // Create default config
            const config = this.createDefaultConfig(telegramId);
            this.saveConfig(telegramId, config);
            return config;
        }

        try {
            const data = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(data) as UserConfig;
            
            // Merge with defaults to ensure all fields exist
            const mergedConfig = this.mergeWithDefaults(config);
            
            // Update cache
            this.configCache.set(telegramId, mergedConfig);
            
            return mergedConfig;
        } catch (error) {
            console.error(`Error loading config for user ${telegramId}:`, error);
            return this.createDefaultConfig(telegramId);
        }
    }

    /**
     * Save user configuration
     */
    saveConfig(telegramId: number, config: UserConfig): void {
        this.ensureUserDirectory(telegramId);
        
        const configPath = path.join(this.getUserDirectory(telegramId), 'config.json');
        
        // Update timestamps
        config.updatedAt = Date.now();
        config.lastActiveAt = Date.now();
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        // Update cache
        this.configCache.set(telegramId, config);
    }

    /**
     * Update specific config fields
     */
    updateConfig(telegramId: number, updates: Partial<UserConfig>): UserConfig {
        const config = this.getConfig(telegramId);
        const updatedConfig = { ...config, ...updates };
        this.saveConfig(telegramId, updatedConfig);
        return updatedConfig;
    }

    /**
     * Create default config for new user
     */
    private createDefaultConfig(telegramId: number): UserConfig {
        const now = Date.now();
        return {
            telegramId,
            ...DEFAULT_USER_CONFIG,
            createdAt: now,
            updatedAt: now,
            lastActiveAt: now,
        };
    }

    /**
     * Merge loaded config with defaults (for backward compatibility)
     */
    private mergeWithDefaults(config: UserConfig): UserConfig {
        return {
            ...this.createDefaultConfig(config.telegramId),
            ...config,
            preferences: {
                ...DEFAULT_USER_CONFIG.preferences,
                ...config.preferences,
            },
            alerts: {
                ...DEFAULT_USER_CONFIG.alerts,
                ...config.alerts,
            },
        };
    }

    // ==================== PREFERENCES ====================

    /**
     * Update user preferences
     */
    updatePreferences(telegramId: number, preferences: Partial<UserConfig['preferences']>): void {
        const config = this.getConfig(telegramId);
        config.preferences = { ...config.preferences, ...preferences };
        this.saveConfig(telegramId, config);
    }

    /**
     * Get default slippage for user
     */
    getDefaultSlippage(telegramId: number): number {
        return this.getConfig(telegramId).preferences.defaultSlippage;
    }

    // ==================== FAVORITE POOLS ====================

    /**
     * Add a pool to favorites
     */
    addFavoritePool(telegramId: number, poolAddress: string): void {
        const config = this.getConfig(telegramId);
        if (!config.favoritePools.includes(poolAddress)) {
            config.favoritePools.push(poolAddress);
            this.saveConfig(telegramId, config);
        }
    }

    /**
     * Remove a pool from favorites
     */
    removeFavoritePool(telegramId: number, poolAddress: string): void {
        const config = this.getConfig(telegramId);
        config.favoritePools = config.favoritePools.filter(p => p !== poolAddress);
        this.saveConfig(telegramId, config);
    }

    /**
     * Get favorite pools
     */
    getFavoritePools(telegramId: number): string[] {
        return this.getConfig(telegramId).favoritePools;
    }

    // ==================== ALERTS ====================

    /**
     * Update alert configuration
     */
    updateAlerts(telegramId: number, alerts: Partial<AlertConfig>): void {
        const config = this.getConfig(telegramId);
        config.alerts = { ...config.alerts, ...alerts };
        this.saveConfig(telegramId, config);
    }

    /**
     * Add price alert
     */
    addPriceAlert(telegramId: number, alert: Omit<import('../types').PriceAlert, 'createdAt'>): void {
        const config = this.getConfig(telegramId);
        config.alerts.priceAlerts.push({
            ...alert,
            createdAt: Date.now(),
        });
        this.saveConfig(telegramId, config);
    }

    /**
     * Remove price alert
     */
    removePriceAlert(telegramId: number, poolAddress: string, targetPrice: number): void {
        const config = this.getConfig(telegramId);
        config.alerts.priceAlerts = config.alerts.priceAlerts.filter(
            a => !(a.poolAddress === poolAddress && a.targetPrice === targetPrice)
        );
        this.saveConfig(telegramId, config);
    }

    // ==================== LLM CONFIG ====================

    /**
     * Set LLM configuration
     */
    setLLMConfig(telegramId: number, llmConfig: LLMConfig): void {
        const config = this.getConfig(telegramId);
        // Encrypt the API key before storing
        config.llm = {
            ...llmConfig,
            apiKey: this.encrypt(llmConfig.apiKey),
        };
        this.saveConfig(telegramId, config);
    }

    /**
     * Get LLM configuration (decrypts API key)
     */
    getLLMConfig(telegramId: number): LLMConfig | undefined {
        const config = this.getConfig(telegramId);
        if (!config.llm) return undefined;
        
        return {
            ...config.llm,
            apiKey: this.decrypt(config.llm.apiKey),
        };
    }

    /**
     * Clear LLM configuration
     */
    clearLLMConfig(telegramId: number): void {
        const config = this.getConfig(telegramId);
        delete config.llm;
        this.saveConfig(telegramId, config);
    }

    // ==================== AUTO-REBALANCE ====================

    /**
     * Set auto-rebalance config for a position
     */
    setAutoRebalanceConfig(
        telegramId: number, 
        positionAddress: string, 
        rebalanceConfig: AutoRebalanceConfig
    ): void {
        const config = this.getConfig(telegramId);
        config.autoRebalance[positionAddress] = rebalanceConfig;
        this.saveConfig(telegramId, config);
    }

    /**
     * Get auto-rebalance config for a position
     */
    getAutoRebalanceConfig(telegramId: number, positionAddress: string): AutoRebalanceConfig | undefined {
        return this.getConfig(telegramId).autoRebalance[positionAddress];
    }

    /**
     * Remove auto-rebalance config for a position
     */
    removeAutoRebalanceConfig(telegramId: number, positionAddress: string): void {
        const config = this.getConfig(telegramId);
        delete config.autoRebalance[positionAddress];
        this.saveConfig(telegramId, config);
    }

    // ==================== POSITION HISTORY ====================

    /**
     * Get position history file path
     */
    private getPositionHistoryPath(telegramId: number): string {
        return path.join(this.getUserDirectory(telegramId), 'positions.json');
    }

    /**
     * Add position history entry
     */
    addPositionHistory(telegramId: number, entry: PositionHistoryEntry): void {
        this.ensureUserDirectory(telegramId);
        
        const historyPath = this.getPositionHistoryPath(telegramId);
        let history: PositionHistoryEntry[] = [];
        
        if (fs.existsSync(historyPath)) {
            try {
                history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
            } catch (error) {
                console.error(`Error loading position history for user ${telegramId}:`, error);
            }
        }
        
        history.push(entry);
        
        // Keep last 1000 entries
        if (history.length > 1000) {
            history = history.slice(-1000);
        }
        
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    }

    /**
     * Get position history
     */
    getPositionHistory(telegramId: number, limit: number = 100): PositionHistoryEntry[] {
        const historyPath = this.getPositionHistoryPath(telegramId);
        
        if (!fs.existsSync(historyPath)) {
            return [];
        }
        
        try {
            const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8')) as PositionHistoryEntry[];
            return history.slice(-limit).reverse();
        } catch (error) {
            console.error(`Error loading position history for user ${telegramId}:`, error);
            return [];
        }
    }

    // ==================== ANALYTICS SNAPSHOTS ====================

    /**
     * Save analytics snapshot
     */
    saveAnalyticsSnapshot(telegramId: number, snapshot: AnalyticsSnapshot): void {
        this.ensureUserDirectory(telegramId);
        
        const analyticsDir = path.join(this.getUserDirectory(telegramId), 'analytics');
        const date = new Date(snapshot.timestamp);
        const filename = `${date.toISOString().split('T')[0]}.json`;
        const filepath = path.join(analyticsDir, filename);
        
        // Append to daily file or create new
        let dailySnapshots: AnalyticsSnapshot[] = [];
        
        if (fs.existsSync(filepath)) {
            try {
                dailySnapshots = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
            } catch (error) {
                console.error(`Error loading analytics for user ${telegramId}:`, error);
            }
        }
        
        dailySnapshots.push(snapshot);
        fs.writeFileSync(filepath, JSON.stringify(dailySnapshots, null, 2));
    }

    /**
     * Get analytics snapshots for a date range
     */
    getAnalyticsSnapshots(telegramId: number, days: number = 7): AnalyticsSnapshot[] {
        const analyticsDir = path.join(this.getUserDirectory(telegramId), 'analytics');
        
        if (!fs.existsSync(analyticsDir)) {
            return [];
        }
        
        const snapshots: AnalyticsSnapshot[] = [];
        const now = Date.now();
        const msPerDay = 24 * 60 * 60 * 1000;
        
        for (let i = 0; i < days; i++) {
            const date = new Date(now - i * msPerDay);
            const filename = `${date.toISOString().split('T')[0]}.json`;
            const filepath = path.join(analyticsDir, filename);
            
            if (fs.existsSync(filepath)) {
                try {
                    const dailySnapshots = JSON.parse(fs.readFileSync(filepath, 'utf-8')) as AnalyticsSnapshot[];
                    snapshots.push(...dailySnapshots);
                } catch (error) {
                    console.error(`Error loading analytics file ${filename}:`, error);
                }
            }
        }
        
        return snapshots.sort((a, b) => b.timestamp - a.timestamp);
    }

    // ==================== ENCRYPTION HELPERS ====================

    private encrypt(text: string): string {
        if (!text) return '';
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    private decrypt(encrypted: string): string {
        if (!encrypted || !encrypted.includes(':')) return '';
        try {
            const parts = encrypted.split(':');
            const iv = Buffer.from(parts[0], 'hex');
            const encryptedText = parts[1];
            const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            return '';
        }
    }

    // ==================== NOTIFICATION HISTORY ====================

    /**
     * Get notification history file path
     */
    private getNotificationHistoryPath(telegramId: number): string {
        return path.join(this.getUserDirectory(telegramId), 'notifications.json');
    }

    /**
     * Add notification to history
     */
    addNotificationToHistory(telegramId: number, notification: {
        type: string;
        title: string;
        message: string;
        timestamp: number;
        positionAddress?: string;
    }): void {
        this.ensureUserDirectory(telegramId);
        
        const historyPath = this.getNotificationHistoryPath(telegramId);
        let history: any[] = [];
        
        if (fs.existsSync(historyPath)) {
            try {
                history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
            } catch (error) {
                console.error(`Error loading notification history for user ${telegramId}:`, error);
            }
        }
        
        history.push(notification);
        
        // Keep last 100 notifications
        if (history.length > 100) {
            history = history.slice(-100);
        }
        
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    }

    /**
     * Get notification history
     */
    getNotificationHistory(telegramId: number, limit: number = 50): Array<{
        type: string;
        title: string;
        message: string;
        timestamp: number;
        positionAddress?: string;
    }> {
        const historyPath = this.getNotificationHistoryPath(telegramId);
        
        if (!fs.existsSync(historyPath)) {
            return [];
        }
        
        try {
            const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
            return history.slice(-limit);
        } catch (error) {
            console.error(`Error loading notification history for user ${telegramId}:`, error);
            return [];
        }
    }

    /**
     * Clear notification history
     */
    clearNotificationHistory(telegramId: number): void {
        const historyPath = this.getNotificationHistoryPath(telegramId);
        
        if (fs.existsSync(historyPath)) {
            fs.writeFileSync(historyPath, JSON.stringify([], null, 2));
        }
    }

    // ==================== CLEANUP ====================

    /**
     * Clear cache for a user
     */
    clearCache(telegramId: number): void {
        this.configCache.delete(telegramId);
    }

    /**
     * Delete all user data (dangerous!)
     */
    deleteUserData(telegramId: number): boolean {
        try {
            const userDir = this.getUserDirectory(telegramId);
            if (fs.existsSync(userDir)) {
                fs.rmSync(userDir, { recursive: true, force: true });
            }
            this.configCache.delete(telegramId);
            return true;
        } catch (error) {
            console.error(`Error deleting user data for ${telegramId}:`, error);
            return false;
        }
    }

    /**
     * Get all registered user IDs
     */
    getAllUserIds(): number[] {
        if (!fs.existsSync(USERS_DATA_DIR)) {
            return [];
        }
        
        return fs.readdirSync(USERS_DATA_DIR)
            .filter(name => {
                const userPath = path.join(USERS_DATA_DIR, name);
                return fs.statSync(userPath).isDirectory() && !isNaN(parseInt(name));
            })
            .map(name => parseInt(name));
    }
}

// Export singleton instance
export const userDataService = new UserDataService();
