/**
 * Telegram Monitoring Scheduler Service
 * 
 * Runs background monitoring for all users who have enabled position monitoring.
 * Checks positions at user-defined intervals and sends notifications when alerts trigger.
 * 
 * Features:
 * - Per-user monitoring intervals
 * - Position out-of-range detection
 * - Near-edge warnings
 * - Fee threshold alerts
 * - Price alerts
 * - Daily portfolio summaries
 * - AI-powered rebalance suggestions
 */

import { Telegraf, Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { userDataService } from './userDataService';
import { multiWalletStorage } from './walletStorageMulti';
import { telegramNotificationsService, PortfolioSummary } from './telegramNotifications.service';
import { positionService } from '../../services/position.service';
import { poolService } from '../../services/pool.service';
import { llmAgent } from '../../services/llmAgent.service';

// ==================== TYPES ====================

export interface UserMonitorState {
    enabled: boolean;
    intervalMinutes: number;
    autoRebalance: boolean;
    lastCheckTime?: number;
    lastDailySummaryTime?: number;
    checkCount: number;
    alertsSentToday: number;
}

interface MonitoringJob {
    telegramId: number;
    intervalId: NodeJS.Timeout;
    state: UserMonitorState;
    isChecking: boolean;
    backoffMs: number;
    cooldownUntil?: number;
}

// ==================== SCHEDULER CLASS ====================

class MonitoringSchedulerService {
    private bot: Telegraf<any> | null = null;
    private jobs: Map<number, MonitoringJob> = new Map();
    private dailySummaryIntervalId: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    
    // Rate limiting
    private readonly MAX_ALERTS_PER_DAY = 50;
    private readonly MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes minimum
    private readonly INITIAL_RPC_BACKOFF_MS = 30 * 1000; // 30 seconds
    private readonly MAX_RPC_BACKOFF_MS = 10 * 60 * 1000; // 10 minutes
    
    private isRateLimitError(error: any): boolean {
        if (!error) return false;
        if (error.code === 429 || error.status === 429 || error.response?.status === 429) {
            return true;
        }
        const message = typeof error === 'string'
            ? error
            : (error.message || error.toString?.() || '');
        return message.toLowerCase().includes('too many requests') || message.includes('429');
    }

    /**
     * Initialize the scheduler with bot instance
     */
    initialize(bot: Telegraf<any>): void {
        this.bot = bot;
        console.log('[MonitoringScheduler] Service initialized');
    }

    /**
     * Start the scheduler - loads all users with monitoring enabled
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('[MonitoringScheduler] Already running');
            return;
        }

        this.isRunning = true;
        console.log('[MonitoringScheduler] Starting background monitoring...');

        // Load all users and start monitoring for those with it enabled
        await this.loadActiveMonitors();

        // Start daily summary scheduler (runs at 9 AM UTC)
        this.startDailySummaryScheduler();

        console.log(`[MonitoringScheduler] Started with ${this.jobs.size} active monitors`);
    }

    /**
     * Stop all monitoring
     */
    stop(): void {
        console.log('[MonitoringScheduler] Stopping all monitoring...');
        
        // Clear all user monitoring jobs
        for (const [telegramId, job] of this.jobs) {
            clearInterval(job.intervalId);
            console.log(`[MonitoringScheduler] Stopped monitoring for user ${telegramId}`);
        }
        this.jobs.clear();

        // Clear daily summary scheduler
        if (this.dailySummaryIntervalId) {
            clearInterval(this.dailySummaryIntervalId);
            this.dailySummaryIntervalId = null;
        }

        this.isRunning = false;
        console.log('[MonitoringScheduler] Stopped');
    }

    /**
     * Load all users with monitoring enabled from stored configs
     */
    private async loadActiveMonitors(): Promise<void> {
        try {
            // Get all user IDs from the users data directory
            const fs = await import('fs');
            const path = await import('path');
            const usersDir = path.join(process.cwd(), 'data', 'users');
            
            if (!fs.existsSync(usersDir)) {
                return;
            }

            const userDirs = fs.readdirSync(usersDir);
            
            for (const userDir of userDirs) {
                const telegramId = parseInt(userDir, 10);
                if (isNaN(telegramId)) continue;

                const monitorState = this.getMonitorState(telegramId);
                if (monitorState.enabled) {
                    this.startUserMonitoring(telegramId, monitorState);
                }
            }
        } catch (error) {
            console.error('[MonitoringScheduler] Error loading active monitors:', error);
        }
    }

    // ==================== USER MONITORING ====================

    /**
     * Get monitor state for a user (persisted in config)
     */
    getMonitorState(telegramId: number): UserMonitorState {
        try {
            const config = userDataService.getConfig(telegramId);
            return {
                enabled: config.preferences?.monitorEnabled ?? false,
                intervalMinutes: config.preferences?.monitorIntervalMinutes ?? 30,
                autoRebalance: config.preferences?.autoRebalanceEnabled ?? false,
                lastCheckTime: config.preferences?.lastMonitorCheck,
                lastDailySummaryTime: config.preferences?.lastDailySummary,
                checkCount: 0,
                alertsSentToday: 0
            };
        } catch {
            return {
                enabled: false,
                intervalMinutes: 30,
                autoRebalance: false,
                checkCount: 0,
                alertsSentToday: 0
            };
        }
    }

    /**
     * Save monitor state for a user
     */
    saveMonitorState(telegramId: number, state: Partial<UserMonitorState>): void {
        try {
            const config = userDataService.getConfig(telegramId);
            
            if (state.enabled !== undefined) {
                config.preferences.monitorEnabled = state.enabled;
            }
            if (state.intervalMinutes !== undefined) {
                config.preferences.monitorIntervalMinutes = state.intervalMinutes;
            }
            if (state.autoRebalance !== undefined) {
                config.preferences.autoRebalanceEnabled = state.autoRebalance;
            }
            if (state.lastCheckTime !== undefined) {
                config.preferences.lastMonitorCheck = state.lastCheckTime;
            }
            if (state.lastDailySummaryTime !== undefined) {
                config.preferences.lastDailySummary = state.lastDailySummaryTime;
            }
            
            userDataService.saveConfig(telegramId, config);
        } catch (error) {
            console.error(`[MonitoringScheduler] Error saving state for ${telegramId}:`, error);
        }
    }

    /**
     * Enable monitoring for a user
     */
    enableMonitoring(telegramId: number, intervalMinutes: number = 30): void {
        // Save state
        this.saveMonitorState(telegramId, { enabled: true, intervalMinutes });

        // Start the monitoring job
        const state = this.getMonitorState(telegramId);
        state.enabled = true;
        state.intervalMinutes = intervalMinutes;
        this.startUserMonitoring(telegramId, state);

        console.log(`[MonitoringScheduler] Enabled monitoring for user ${telegramId} (${intervalMinutes}min interval)`);
    }

    /**
     * Disable monitoring for a user
     */
    disableMonitoring(telegramId: number): void {
        // Save state
        this.saveMonitorState(telegramId, { enabled: false });

        // Stop the job
        this.stopUserMonitoring(telegramId);

        console.log(`[MonitoringScheduler] Disabled monitoring for user ${telegramId}`);
    }

    /**
     * Update monitoring interval for a user
     */
    updateInterval(telegramId: number, intervalMinutes: number): void {
        const existingJob = this.jobs.get(telegramId);
        if (existingJob) {
            // Stop current job
            clearInterval(existingJob.intervalId);
            
            // Update state
            existingJob.state.intervalMinutes = intervalMinutes;
            this.saveMonitorState(telegramId, { intervalMinutes });

            // Restart with new interval
            const intervalMs = Math.max(intervalMinutes * 60 * 1000, this.MIN_CHECK_INTERVAL_MS);
            existingJob.intervalId = setInterval(
                () => this.runUserCheck(telegramId),
                intervalMs
            );

            console.log(`[MonitoringScheduler] Updated interval for user ${telegramId} to ${intervalMinutes}min`);
        } else {
            this.saveMonitorState(telegramId, { intervalMinutes });
        }
    }

    /**
     * Toggle auto-rebalance for a user
     */
    setAutoRebalance(telegramId: number, enabled: boolean): void {
        this.saveMonitorState(telegramId, { autoRebalance: enabled });
        
        const job = this.jobs.get(telegramId);
        if (job) {
            job.state.autoRebalance = enabled;
        }

        console.log(`[MonitoringScheduler] Auto-rebalance ${enabled ? 'enabled' : 'disabled'} for user ${telegramId}`);
    }

    /**
     * Start monitoring job for a user
     */
    private startUserMonitoring(telegramId: number, state: UserMonitorState): void {
        // Don't start if already running
        if (this.jobs.has(telegramId)) {
            return;
        }

        const intervalMs = Math.max(state.intervalMinutes * 60 * 1000, this.MIN_CHECK_INTERVAL_MS);
        
        const intervalId = setInterval(
            () => this.runUserCheck(telegramId),
            intervalMs
        );

        this.jobs.set(telegramId, {
            telegramId,
            intervalId,
            state,
            isChecking: false,
            backoffMs: this.INITIAL_RPC_BACKOFF_MS
        });

        // Run first check after a short delay (10 seconds)
        setTimeout(() => this.runUserCheck(telegramId), 10000);
    }

    /**
     * Stop monitoring job for a user
     */
    private stopUserMonitoring(telegramId: number): void {
        const job = this.jobs.get(telegramId);
        if (job) {
            clearInterval(job.intervalId);
            this.jobs.delete(telegramId);
        }
    }

    // ==================== POSITION CHECKING ====================

    /**
     * Run position check for a user
     */
    private async runUserCheck(telegramId: number): Promise<void> {
        const job = this.jobs.get(telegramId);
        if (!job) return;

        const now = Date.now();
        if (job.cooldownUntil && now < job.cooldownUntil) {
            const remainingSec = Math.ceil((job.cooldownUntil - now) / 1000);
            console.log(`[MonitoringScheduler] Skipping user ${telegramId} (cooldown ${remainingSec}s remaining)`);
            return;
        }

        if (job.isChecking) {
            console.log(`[MonitoringScheduler] Skipping user ${telegramId} (previous check still running)`);
            return;
        }

        job.isChecking = true;

        try {
            console.log(`[MonitoringScheduler] Running check for user ${telegramId}`);
            
            // Get user's wallet
            const walletInfo = multiWalletStorage.getActiveWallet(telegramId);
            if (!walletInfo) {
                console.log(`[MonitoringScheduler] No wallet for user ${telegramId}, skipping`);
                return;
            }

            // Get user's alert config
            const config = userDataService.getConfig(telegramId);
            const alertConfig = config.alerts;

            // Fetch positions
            const positions = await positionService.getAllPositions(walletInfo.publicKey);
            
            if (positions.length === 0) {
                return;
            }

            // Check each position
            for (const position of positions) {
                await this.checkPosition(telegramId, position, alertConfig, job.state);
            }

            // Check price alerts
            if (alertConfig.priceAlerts && alertConfig.priceAlerts.length > 0) {
                await this.checkPriceAlerts(telegramId, alertConfig.priceAlerts);
            }

            // Update last check time
            job.state.lastCheckTime = Date.now();
            job.state.checkCount++;
            this.saveMonitorState(telegramId, { lastCheckTime: Date.now() });

            // Reset backoff on success
            job.backoffMs = this.INITIAL_RPC_BACKOFF_MS;
            job.cooldownUntil = undefined;

        } catch (error) {
            if (this.isRateLimitError(error)) {
                const delay = job.backoffMs || this.INITIAL_RPC_BACKOFF_MS;
                job.cooldownUntil = Date.now() + delay;
                job.backoffMs = Math.min(delay * 2, this.MAX_RPC_BACKOFF_MS);
                console.warn(`[MonitoringScheduler] RPC rate limit for ${telegramId}. Pausing checks for ${(delay / 1000).toFixed(0)}s`);
            } else {
                console.error(`[MonitoringScheduler] Error checking positions for ${telegramId}:`, error);
            }
        } finally {
            job.isChecking = false;
        }
    }

    /**
     * Check a single position for alert conditions
     */
    private async checkPosition(
        telegramId: number,
        position: any,
        alertConfig: any,
        state: UserMonitorState
    ): Promise<void> {
        // Rate limiting
        if (state.alertsSentToday >= this.MAX_ALERTS_PER_DAY) {
            return;
        }

        try {
            // Get pool info for context
            const poolInfo = await poolService.getPoolInfo(position.poolAddress).catch(() => null);
            const pairName = poolInfo ? `${poolInfo.tokenX.symbol}-${poolInfo.tokenY.symbol}` : 'Unknown';
            
            // Get actual USD price for tokenX (e.g., SOL) instead of bin ratio
            // The bin ratio can be inverted or confusing for users
            let currentPrice = 0;
            try {
                const { priceService } = await import('../../services/price.service');
                if (poolInfo?.tokenX?.mint) {
                    currentPrice = await priceService.getTokenPrice(poolInfo.tokenX.mint) || 0;
                }
            } catch (priceError) {
                console.warn(`[MonitoringScheduler] Failed to get USD price for tokenX:`, priceError);
            }

            // 1. Check out of range
            if (alertConfig.outOfRangeEnabled && !position.inRange) {
                const sent = await telegramNotificationsService.sendOutOfRangeAlert(
                    telegramId,
                    position.publicKey,
                    pairName,
                    position.activeBinId || 0,
                    position.lowerBinId || 0,
                    position.upperBinId || 0,
                    currentPrice
                );
                if (sent) {
                    state.alertsSentToday++;
                    
                    // Check for AI rebalance suggestion
                    if (alertConfig.rebalanceSuggestionsEnabled && llmAgent.isAvailable()) {
                        await this.sendRebalanceSuggestion(telegramId, position, pairName);
                    }
                }
            }

            // 2. Check near edge
            if (alertConfig.nearEdgeEnabled && position.inRange) {
                const threshold = alertConfig.nearEdgeThreshold || 5;
                const activeBin = position.activeBinId || position.lowerBinId;
                const lowerDistance = activeBin - position.lowerBinId;
                const upperDistance = position.upperBinId - activeBin;
                
                if (lowerDistance <= threshold) {
                    const sent = await telegramNotificationsService.sendNearEdgeAlert(
                        telegramId,
                        position.publicKey,
                        pairName,
                        lowerDistance,
                        'lower',
                        currentPrice
                    );
                    if (sent) state.alertsSentToday++;
                } else if (upperDistance <= threshold) {
                    const sent = await telegramNotificationsService.sendNearEdgeAlert(
                        telegramId,
                        position.publicKey,
                        pairName,
                        upperDistance,
                        'upper',
                        currentPrice
                    );
                    if (sent) state.alertsSentToday++;
                }
            }

            // 3. Check fee threshold
            if (alertConfig.feeThresholdEnabled) {
                const threshold = alertConfig.feeThresholdUsd || 10;
                const totalFees = position.unclaimedFees?.usdValue || 0;
                
                if (totalFees >= threshold) {
                    const sent = await telegramNotificationsService.sendFeeThresholdAlert(
                        telegramId,
                        position.publicKey,
                        pairName,
                        totalFees,
                        threshold
                    );
                    if (sent) state.alertsSentToday++;
                }
            }

        } catch (error) {
            console.error(`[MonitoringScheduler] Error checking position:`, error);
        }
    }

    /**
     * Check price alerts for a user
     */
    private async checkPriceAlerts(telegramId: number, priceAlerts: any[]): Promise<void> {
        for (const alert of priceAlerts) {
            if (!alert.enabled) continue;

            try {
                const poolInfo = await poolService.getPoolInfo(alert.poolAddress).catch(() => null);
                if (!poolInfo) continue;

                const currentPrice = poolInfo.price || 0;
                const triggered = alert.direction === 'above'
                    ? currentPrice >= alert.targetPrice
                    : currentPrice <= alert.targetPrice;

                if (triggered) {
                    const pairName = `${poolInfo.tokenX.symbol}-${poolInfo.tokenY.symbol}`;
                    await telegramNotificationsService.sendPriceAlert(
                        telegramId,
                        pairName,
                        currentPrice,
                        alert.targetPrice,
                        alert.direction,
                        alert.poolAddress
                    );

                    // Disable the alert after triggering (one-time)
                    alert.enabled = false;
                    const config = userDataService.getConfig(telegramId);
                    userDataService.saveConfig(telegramId, config);
                }
            } catch (error) {
                console.error(`[MonitoringScheduler] Error checking price alert:`, error);
            }
        }
    }

    /**
     * Send AI rebalance suggestion with range info
     */
    private async sendRebalanceSuggestion(
        telegramId: number,
        position: any,
        pairName: string
    ): Promise<void> {
        try {
            if (!llmAgent.isAvailable()) return;

            const analysis = await llmAgent.analyzePosition(position);
            
            if (analysis.action === 'rebalance' && analysis.confidence >= 60) {
                // Get pool info for range calculations
                let rangeInfo: {
                    currentPrice: number;
                    currentRange: { minPrice: number; maxPrice: number };
                    suggestedRange: { minPrice: number; maxPrice: number };
                } | undefined;
                
                try {
                    const poolInfo = await poolService.getPoolInfo(position.poolAddress);
                    if (poolInfo) {
                        const binStep = poolInfo.binStep || 1;
                        const tokenXDecimals = poolInfo.tokenX?.decimals || 9;
                        const tokenYDecimals = poolInfo.tokenY?.decimals || 6;
                        
                        // Get actual USD price for tokenX (e.g., SOL) for display
                        let currentPrice = 0;
                        try {
                            const { priceService } = await import('../../services/price.service');
                            if (poolInfo.tokenX?.mint) {
                                currentPrice = await priceService.getTokenPrice(poolInfo.tokenX.mint) || 0;
                            }
                        } catch (e) {
                            console.warn(`[MonitoringScheduler] Failed to get USD price for rebalance suggestion:`, e);
                        }
                        
                        // For range display, we still need to show the price range in terms users understand
                        // If we have a USD price, calculate ranges as percentages from current
                        const currentMinPrice = poolService.calculateBinPrice(
                            position.lowerBinId, binStep, tokenXDecimals, tokenYDecimals
                        );
                        const currentMaxPrice = poolService.calculateBinPrice(
                            position.upperBinId, binStep, tokenXDecimals, tokenYDecimals
                        );
                        
                        // Calculate suggested range with intelligent bin sizing
                        const activeBin = poolInfo.activeBin;
                        const tokenXSymbol = poolInfo.tokenX?.symbol || '';
                        const tokenYSymbol = poolInfo.tokenY?.symbol || '';
                        
                        // Determine appropriate bins per side based on pair type
                        const stableSymbols = ['USDC', 'USDT', 'DAI', 'PYUSD'];
                        const memeTokens = ['BONK', 'WIF', 'POPCAT', 'BOME', 'MEW', 'MYRO', 'SLERF', 'TRUMP'];
                        const isStablePair = stableSymbols.includes(tokenXSymbol) && stableSymbols.includes(tokenYSymbol);
                        const isMemeToken = memeTokens.includes(tokenXSymbol) || memeTokens.includes(tokenYSymbol);
                        const hasStable = stableSymbols.includes(tokenXSymbol) || stableSymbols.includes(tokenYSymbol);
                        
                        // Max 34 bins per side (69 total) due to Meteora DLMM single-transaction limit
                        let binsPerSide: number;
                        if (isStablePair) {
                            binsPerSide = 20; // Stablecoins - tight range is fine
                        } else if (isMemeToken) {
                            binsPerSide = 34; // Meme tokens - use max allowed (69 total)
                        } else if (hasStable) {
                            binsPerSide = 34; // Major pairs like SOL/USDC - use max allowed
                        } else {
                            binsPerSide = 25; // Crypto/crypto pairs
                        }
                        
                        // Calculate suggested range in USD if we have a USD price
                        let suggestedMinPrice: number;
                        let suggestedMaxPrice: number;
                        
                        if (currentPrice > 1 && hasStable) {
                            // For pairs like SOL/USDC, calculate range as percentage of current USD price
                            const rangePercent = binsPerSide * (binStep / 10000); // Approximate percentage
                            suggestedMinPrice = currentPrice * (1 - rangePercent);
                            suggestedMaxPrice = currentPrice * (1 + rangePercent);
                        } else {
                            // Fallback to bin-based calculation
                            suggestedMinPrice = poolService.calculateBinPrice(
                                activeBin - binsPerSide, binStep, tokenXDecimals, tokenYDecimals
                            );
                            suggestedMaxPrice = poolService.calculateBinPrice(
                                activeBin + binsPerSide, binStep, tokenXDecimals, tokenYDecimals
                            );
                        }
                        
                        rangeInfo = {
                            currentPrice,
                            currentRange: { minPrice: currentMinPrice, maxPrice: currentMaxPrice },
                            suggestedRange: { minPrice: suggestedMinPrice, maxPrice: suggestedMaxPrice }
                        };
                    }
                } catch (poolError) {
                    console.error(`[MonitoringScheduler] Error getting pool info for range:`, poolError);
                    // Continue without range info
                }
                
                await telegramNotificationsService.sendRebalanceSuggestion(
                    telegramId,
                    position.publicKey,
                    pairName,
                    analysis.reasoning[0] || 'Position analysis suggests rebalancing',
                    analysis.confidence,
                    analysis.suggestedActions?.[0],
                    rangeInfo
                );
            }
        } catch (error) {
            console.error(`[MonitoringScheduler] Error getting AI suggestion:`, error);
        }
    }

    // ==================== DAILY SUMMARY ====================

    /**
     * Start daily summary scheduler
     */
    private startDailySummaryScheduler(): void {
        // Check every hour if it's time to send daily summaries
        this.dailySummaryIntervalId = setInterval(
            () => this.checkDailySummaries(),
            60 * 60 * 1000 // 1 hour
        );

        // Also run immediately to catch up
        this.checkDailySummaries();
    }

    /**
     * Check if daily summaries need to be sent
     */
    private async checkDailySummaries(): Promise<void> {
        const now = new Date();
        const currentHour = now.getUTCHours();
        
        // Send daily summaries between 8-10 AM UTC
        if (currentHour < 8 || currentHour >= 10) {
            return;
        }

        const today = new Date().toDateString();

        for (const [telegramId, job] of this.jobs) {
            try {
                // Check if already sent today
                const lastSummary = job.state.lastDailySummaryTime;
                if (lastSummary) {
                    const lastSummaryDate = new Date(lastSummary).toDateString();
                    if (lastSummaryDate === today) {
                        continue; // Already sent today
                    }
                }

                // Check if user has daily summary enabled
                const config = userDataService.getConfig(telegramId);
                if (!config.preferences.dailySummaryEnabled) {
                    continue;
                }

                // Send daily summary
                await this.sendDailySummary(telegramId);

                // Update last summary time
                job.state.lastDailySummaryTime = Date.now();
                job.state.alertsSentToday = 0; // Reset daily counter
                this.saveMonitorState(telegramId, { lastDailySummaryTime: Date.now() });

            } catch (error) {
                console.error(`[MonitoringScheduler] Error sending daily summary to ${telegramId}:`, error);
            }
        }
    }

    /**
     * Send daily portfolio summary to a user
     */
    private async sendDailySummary(telegramId: number): Promise<void> {
        try {
            const walletInfo = multiWalletStorage.getActiveWallet(telegramId);
            if (!walletInfo) return;

            const positions = await positionService.getAllPositions(walletInfo.publicKey);
            
            let totalValueUsd = 0;
            let totalFeesUsd = 0;
            let inRangeCount = 0;
            let outOfRangeCount = 0;
            let topPerformer: { pair: string; feesUsd: number } | undefined;

            for (const position of positions) {
                // Use totalValueUSD if available, or calculate from token values
                const positionValue = position.totalValueUSD || 
                    ((position.tokenX?.usdValue || 0) + (position.tokenY?.usdValue || 0));
                const positionFees = position.unclaimedFees?.usdValue || 0;
                
                totalValueUsd += positionValue;
                totalFeesUsd += positionFees;
                
                if (position.inRange) {
                    inRangeCount++;
                } else {
                    outOfRangeCount++;
                }

                // Track top performer
                if (!topPerformer || positionFees > topPerformer.feesUsd) {
                    const poolInfo = await poolService.getPoolInfo(position.poolAddress).catch(() => null);
                    const pairName = poolInfo ? `${poolInfo.tokenX.symbol}-${poolInfo.tokenY.symbol}` : 'Unknown';
                    topPerformer = { pair: pairName, feesUsd: positionFees };
                }
            }

            const summary: PortfolioSummary = {
                totalValueUsd,
                positionsCount: positions.length,
                inRangeCount,
                outOfRangeCount,
                totalUnclaimedFeesUsd: totalFeesUsd,
                topPerformer: (topPerformer && topPerformer.feesUsd > 0) ? topPerformer : undefined,
                alertsTriggered: this.jobs.get(telegramId)?.state.alertsSentToday || 0
            };

            await telegramNotificationsService.sendDailySummary(telegramId, summary);

        } catch (error) {
            console.error(`[MonitoringScheduler] Error building daily summary:`, error);
        }
    }

    // ==================== STATUS & DEBUGGING ====================

    /**
     * Get scheduler status
     */
    getStatus(): {
        isRunning: boolean;
        activeMonitors: number;
        jobs: Array<{ telegramId: number; intervalMinutes: number; lastCheck?: number }>;
    } {
        return {
            isRunning: this.isRunning,
            activeMonitors: this.jobs.size,
            jobs: Array.from(this.jobs.values()).map(job => ({
                telegramId: job.telegramId,
                intervalMinutes: job.state.intervalMinutes,
                lastCheck: job.state.lastCheckTime
            }))
        };
    }

    /**
     * Check if monitoring is enabled for a user
     */
    isMonitoringEnabled(telegramId: number): boolean {
        return this.jobs.has(telegramId);
    }

    /**
     * Get monitoring stats for a user
     */
    getUserStats(telegramId: number): UserMonitorState | null {
        const job = this.jobs.get(telegramId);
        return job?.state || null;
    }

    /**
     * Force run a check for a user (manual trigger)
     */
    async forceCheck(telegramId: number): Promise<void> {
        await this.runUserCheck(telegramId);
    }
}

// Export singleton instance
export const monitoringScheduler = new MonitoringSchedulerService();
