/**
 * User Context Manager
 * 
 * Provides a unified context for each Telegram user that wraps
 * the CLI services with user-specific data (wallet, config, etc.)
 * 
 * This is the bridge between Telegram handlers and CLI services.
 */

import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import { multiWalletStorage } from './walletStorageMulti';
import { userDataService, PositionHistoryEntry, AnalyticsSnapshot } from './userDataService';
import { UserConfig, LLMConfig, AutoRebalanceConfig } from '../types';

// Import CLI services
import { connectionService } from '../../services/connection.service';
import { positionService, UserPosition } from '../../services/position.service';
import { poolService } from '../../services/pool.service';
import { feeService } from '../../services/fee.service';
import { analyticsService } from '../../services/analytics.service';
import { priceService } from '../../services/price.service';
import { PoolInfo } from '../../config/types';

/**
 * Context object for a single user
 * Provides access to user-specific data and CLI services
 */
export class UserContext {
    public readonly telegramId: number;
    private _keypair: Keypair | null = null;
    private _config: UserConfig | null = null;

    constructor(telegramId: number) {
        this.telegramId = telegramId;
    }

    // ==================== WALLET ====================

    /**
     * Check if user has a connected wallet
     */
    hasWallet(): boolean {
        return multiWalletStorage.hasWallet(this.telegramId);
    }

    /**
     * Get user's keypair (cached)
     */
    getKeypair(): Keypair | null {
        if (this._keypair) {
            return this._keypair;
        }
        this._keypair = multiWalletStorage.getActiveKeypair(this.telegramId);
        return this._keypair;
    }

    /**
     * Get user's public key as string
     */
    getPublicKey(): string | null {
        const keypair = this.getKeypair();
        return keypair ? keypair.publicKey.toBase58() : null;
    }

    /**
     * Get user's public key as PublicKey object
     */
    getPublicKeyObj(): PublicKey | null {
        const keypair = this.getKeypair();
        return keypair ? keypair.publicKey : null;
    }

    /**
     * Store a new wallet for the user
     */
    setWallet(keypair: Keypair): void {
        multiWalletStorage.storeWallet(this.telegramId, keypair);
        this._keypair = keypair;
    }

    /**
     * Remove user's wallet
     */
    removeWallet(): void {
        const activeWallet = multiWalletStorage.getActiveWallet(this.telegramId);
        if (activeWallet) {
            multiWalletStorage.deleteWallet(this.telegramId, activeWallet.publicKey);
        }
        this._keypair = null;
    }

    /**
     * Clear cached keypair (force refresh on next access)
     */
    clearWalletCache(): void {
        this._keypair = null;
    }

    // ==================== CONFIG ====================

    /**
     * Get user configuration (cached)
     */
    getConfig(): UserConfig {
        if (this._config) {
            return this._config;
        }
        this._config = userDataService.getConfig(this.telegramId);
        return this._config;
    }

    /**
     * Update user configuration
     */
    updateConfig(updates: Partial<UserConfig>): UserConfig {
        this._config = userDataService.updateConfig(this.telegramId, updates);
        return this._config;
    }

    /**
     * Clear cached config (force refresh on next access)
     */
    clearConfigCache(): void {
        this._config = null;
        userDataService.clearCache(this.telegramId);
    }

    /**
     * Get default slippage
     */
    getDefaultSlippage(): number {
        return this.getConfig().preferences.defaultSlippage;
    }

    // ==================== POSITIONS ====================

    /**
     * Get all positions for this user
     */
    async getPositions(): Promise<UserPosition[]> {
        const publicKey = this.getPublicKey();
        if (!publicKey) {
            return [];
        }
        return positionService.getAllPositions(publicKey);
    }

    /**
     * Get positions for a specific pool
     */
    async getPositionsByPool(poolAddress: string): Promise<UserPosition[]> {
        const publicKey = this.getPublicKey();
        if (!publicKey) {
            return [];
        }
        return positionService.getPositionsByPool(poolAddress, publicKey);
    }

    /**
     * Get a specific position by address
     */
    async getPosition(positionAddress: string): Promise<UserPosition | null> {
        const positions = await this.getPositions();
        return positions.find(p => p.publicKey === positionAddress) || null;
    }

    /**
     * Add entry to position history
     */
    addPositionHistory(entry: Omit<PositionHistoryEntry, 'timestamp'>): void {
        userDataService.addPositionHistory(this.telegramId, {
            ...entry,
            timestamp: Date.now(),
        });
    }

    /**
     * Get position history
     */
    getPositionHistory(limit: number = 100): PositionHistoryEntry[] {
        return userDataService.getPositionHistory(this.telegramId, limit);
    }

    // ==================== POOLS ====================

    /**
     * Search for a pool by address
     */
    async searchPool(poolAddress: string): Promise<PoolInfo> {
        return poolService.searchPoolByAddress(poolAddress);
    }

    /**
     * Get pool info
     */
    async getPoolInfo(poolAddress: string): Promise<PoolInfo> {
        return poolService.getPoolInfo(poolAddress);
    }

    /**
     * Get all pools
     */
    async getAllPools(): Promise<any[]> {
        return poolService.fetchAllPools();
    }

    /**
     * Get favorite pools with info
     */
    async getFavoritePools(): Promise<PoolInfo[]> {
        const addresses = userDataService.getFavoritePools(this.telegramId);
        const pools: PoolInfo[] = [];
        
        for (const address of addresses) {
            try {
                const pool = await poolService.getPoolInfo(address);
                pools.push(pool);
            } catch (error) {
                console.error(`Error fetching favorite pool ${address}:`, error);
            }
        }
        
        return pools;
    }

    /**
     * Add pool to favorites
     */
    addFavoritePool(poolAddress: string): void {
        userDataService.addFavoritePool(this.telegramId, poolAddress);
        this.clearConfigCache();
    }

    /**
     * Remove pool from favorites
     */
    removeFavoritePool(poolAddress: string): void {
        userDataService.removeFavoritePool(this.telegramId, poolAddress);
        this.clearConfigCache();
    }

    /**
     * Check if pool is favorite
     */
    isPoolFavorite(poolAddress: string): boolean {
        return this.getConfig().favoritePools.includes(poolAddress);
    }

    // ==================== ANALYTICS ====================

    /**
     * Get portfolio analytics
     */
    async getPortfolioAnalytics() {
        const publicKey = this.getPublicKey();
        if (!publicKey) {
            return null;
        }
        return analyticsService.getPortfolioAnalytics(publicKey);
    }

    /**
     * Save analytics snapshot
     */
    saveAnalyticsSnapshot(snapshot: AnalyticsSnapshot): void {
        userDataService.saveAnalyticsSnapshot(this.telegramId, snapshot);
    }

    /**
     * Get analytics snapshots
     */
    getAnalyticsSnapshots(days: number = 7): AnalyticsSnapshot[] {
        return userDataService.getAnalyticsSnapshots(this.telegramId, days);
    }

    /**
     * Capture current state as analytics snapshot
     */
    async captureAnalyticsSnapshot(): Promise<AnalyticsSnapshot | null> {
        const positions = await this.getPositions();
        
        if (positions.length === 0) {
            return null;
        }

        const snapshot: AnalyticsSnapshot = {
            timestamp: Date.now(),
            positions: positions.map(p => ({
                address: p.publicKey,
                poolAddress: p.poolAddress,
                valueUsd: p.totalValueUSD || 0,
                unclaimedFeesUsd: p.unclaimedFees.usdValue || 0,
                inRange: p.inRange,
            })),
            totalValueUsd: positions.reduce((sum, p) => sum + (p.totalValueUSD || 0), 0),
            totalFeesUsd: positions.reduce((sum, p) => sum + (p.unclaimedFees.usdValue || 0), 0),
        };

        this.saveAnalyticsSnapshot(snapshot);
        return snapshot;
    }

    // ==================== LLM ====================

    /**
     * Get LLM configuration
     */
    getLLMConfig(): LLMConfig | undefined {
        return userDataService.getLLMConfig(this.telegramId);
    }

    /**
     * Set LLM configuration
     */
    setLLMConfig(config: LLMConfig): void {
        userDataService.setLLMConfig(this.telegramId, config);
        this.clearConfigCache();
    }

    /**
     * Check if LLM is configured
     */
    hasLLMConfigured(): boolean {
        const config = this.getLLMConfig();
        return !!config && config.provider !== 'none' && !!config.apiKey;
    }

    // ==================== AUTO-REBALANCE ====================

    /**
     * Get auto-rebalance config for a position
     */
    getAutoRebalanceConfig(positionAddress: string): AutoRebalanceConfig | undefined {
        return userDataService.getAutoRebalanceConfig(this.telegramId, positionAddress);
    }

    /**
     * Set auto-rebalance config for a position
     */
    setAutoRebalanceConfig(positionAddress: string, config: AutoRebalanceConfig): void {
        userDataService.setAutoRebalanceConfig(this.telegramId, positionAddress, config);
        this.clearConfigCache();
    }

    /**
     * Remove auto-rebalance config for a position
     */
    removeAutoRebalanceConfig(positionAddress: string): void {
        userDataService.removeAutoRebalanceConfig(this.telegramId, positionAddress);
        this.clearConfigCache();
    }

    /**
     * Get all positions with auto-rebalance enabled
     */
    getAutoRebalancePositions(): Record<string, AutoRebalanceConfig> {
        return this.getConfig().autoRebalance;
    }

    // ==================== ALERTS ====================

    /**
     * Get alert configuration
     */
    getAlertConfig() {
        return this.getConfig().alerts;
    }

    /**
     * Update alert configuration
     */
    updateAlertConfig(updates: Partial<UserConfig['alerts']>): void {
        userDataService.updateAlerts(this.telegramId, updates);
        this.clearConfigCache();
    }

    // ==================== CONNECTION ====================

    /**
     * Get Solana connection
     */
    getConnection(): Connection {
        return connectionService.getConnection();
    }

    /**
     * Get SOL balance
     */
    async getSolBalance(): Promise<number> {
        const publicKey = this.getPublicKeyObj();
        if (!publicKey) {
            return 0;
        }
        const balance = await this.getConnection().getBalance(publicKey);
        return balance / 1e9;
    }

    // ==================== CLEANUP ====================

    /**
     * Clear all caches
     */
    clearAllCaches(): void {
        this._keypair = null;
        this._config = null;
        userDataService.clearCache(this.telegramId);
    }

    /**
     * Delete all user data
     */
    deleteAllData(): boolean {
        this.removeWallet();
        return userDataService.deleteUserData(this.telegramId);
    }
}

/**
 * User Context Manager
 * Manages UserContext instances for all users (singleton pattern)
 */
class UserContextManager {
    private contexts: Map<number, UserContext> = new Map();

    /**
     * Get or create context for a user
     */
    getContext(telegramId: number): UserContext {
        if (!this.contexts.has(telegramId)) {
            this.contexts.set(telegramId, new UserContext(telegramId));
        }
        return this.contexts.get(telegramId)!;
    }

    /**
     * Check if user has a context
     */
    hasContext(telegramId: number): boolean {
        return this.contexts.has(telegramId);
    }

    /**
     * Remove context (e.g., on logout)
     */
    removeContext(telegramId: number): void {
        const context = this.contexts.get(telegramId);
        if (context) {
            context.clearAllCaches();
            this.contexts.delete(telegramId);
        }
    }

    /**
     * Get all active contexts
     */
    getAllContexts(): UserContext[] {
        return Array.from(this.contexts.values());
    }

    /**
     * Get all user IDs with wallets
     */
    getAllUsersWithWallets(): number[] {
        return userDataService.getAllUserIds().filter(id => {
            const ctx = this.getContext(id);
            return ctx.hasWallet();
        });
    }

    /**
     * Clear all contexts
     */
    clearAll(): void {
        for (const context of this.contexts.values()) {
            context.clearAllCaches();
        }
        this.contexts.clear();
    }
}

// Export singleton instance
export const userContextManager = new UserContextManager();

// Convenience function to get context from Telegram context
export function getUserContext(telegramId: number | undefined): UserContext | null {
    if (!telegramId) {
        return null;
    }
    return userContextManager.getContext(telegramId);
}
