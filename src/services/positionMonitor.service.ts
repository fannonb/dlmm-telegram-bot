import { CronJob } from 'cron';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { positionService, UserPosition } from './position.service';
import { poolService } from './pool.service';
import { walletService } from './wallet.service';
import { llmAgent, LLMDecision } from './llmAgent.service';
import { analyticsDataStore } from './analyticsDataStore.service';
import { Keypair } from '@solana/web3.js';

// ==================== TYPES ====================

export interface MonitorConfig {
    intervalMinutes: number;         // How often to check (default: 30)
    enableAutoRebalance: boolean;    // Actually execute rebalances or just log
    confidenceThreshold: number;     // Min AI confidence to act (0-100)
    urgencyFilter: ('immediate' | 'soon' | 'low' | 'none')[];  // Which urgencies to act on
    logToFile: boolean;              // Save logs to file
    notifyOnAction: boolean;         // Send notification (future: Telegram)
}

export interface MonitoredPosition {
    positionAddress: string;
    poolAddress: string;
    walletPublicKey: string;
    config: MonitorConfig;
    lastCheck?: Date;
    lastDecision?: LLMDecision;
}

export interface MonitorLogEntry {
    timestamp: string;
    positionAddress: string;
    poolPair: string;
    inRange: boolean;
    currentPrice: number;
    rangeMin: number;
    rangeMax: number;
    distanceToEdge: number;
    unclaimedFeesUsd: number;
    aiDecision: {
        action: string;
        confidence: number;
        urgency: string;
        reasoning: string[];
    };
    actionTaken: 'none' | 'logged' | 'rebalanced' | 'error';
    errorMessage?: string;
}

// Default configuration
const DEFAULT_CONFIG: MonitorConfig = {
    intervalMinutes: 30,
    enableAutoRebalance: false,  // Safe default: just log, don't auto-execute
    confidenceThreshold: 75,
    urgencyFilter: ['immediate', 'soon'],
    logToFile: true,
    notifyOnAction: true
};

// ==================== POSITION MONITOR SERVICE ====================

class PositionMonitorService {
    private cronJob: CronJob | null = null;
    private monitoredPositions: Map<string, MonitoredPosition> = new Map();
    private isRunning: boolean = false;
    private logDir: string;

    constructor() {
        this.logDir = path.join(process.cwd(), 'data', 'logs');
        this.ensureLogDirectory();
    }

    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    // ==================== PUBLIC API ====================

    /**
     * Start monitoring all positions for a wallet
     */
    public async startMonitoring(
        walletPublicKey: string,
        config: Partial<MonitorConfig> = {}
    ): Promise<void> {
        const finalConfig = { ...DEFAULT_CONFIG, ...config };
        
        console.log(chalk.blue.bold('\n🔄 Starting Position Monitor'));
        console.log(chalk.gray(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
        console.log(`📍 Wallet: ${walletPublicKey.slice(0, 8)}...`);
        console.log(`⏱️  Interval: Every ${finalConfig.intervalMinutes} minutes`);
        console.log(`🤖 Auto-Rebalance: ${finalConfig.enableAutoRebalance ? chalk.green('ENABLED') : chalk.yellow('DISABLED (log only)')}`);
        console.log(`📊 Confidence Threshold: ${finalConfig.confidenceThreshold}%`);
        console.log(`📝 Log to File: ${finalConfig.logToFile ? 'Yes' : 'No'}`);
        console.log(chalk.gray(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`));

        // Fetch all positions for this wallet
        const positions = await positionService.getAllPositions(walletPublicKey);
        
        if (positions.length === 0) {
            console.log(chalk.yellow('⚠️  No active positions found for this wallet'));
            return;
        }

        console.log(chalk.green(`✅ Found ${positions.length} position(s) to monitor:\n`));

        // Register all positions
        for (const pos of positions) {
            const poolInfo = await poolService.getPoolInfo(pos.poolAddress).catch(() => null);
            const pairName = poolInfo 
                ? `${poolInfo.tokenX.symbol}/${poolInfo.tokenY.symbol}`
                : pos.poolAddress.slice(0, 8);
            
            console.log(`   • ${pairName} - ${pos.publicKey.slice(0, 8)}...`);
            console.log(chalk.gray(`     In Range: ${pos.inRange ? '✅' : '❌'} | Value: $${(pos.totalValueUSD || 0).toFixed(2)}`));
            
            this.monitoredPositions.set(pos.publicKey, {
                positionAddress: pos.publicKey,
                poolAddress: pos.poolAddress,
                walletPublicKey,
                config: finalConfig
            });
        }

        // Create cron job
        const cronExpression = `*/${finalConfig.intervalMinutes} * * * *`;  // Every N minutes
        
        this.cronJob = new CronJob(cronExpression, async () => {
            await this.runMonitoringCycle();
        });

        this.cronJob.start();
        this.isRunning = true;

        console.log(chalk.green(`\n✅ Monitoring started!`));
        console.log(chalk.gray(`   Next check: ${this.cronJob.nextDate().toLocaleString()}`));
        console.log(chalk.gray(`   Press Ctrl+C to stop\n`));

        // Run initial check immediately
        await this.runMonitoringCycle();
    }

    /**
     * Stop all monitoring
     */
    public stopMonitoring(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        this.monitoredPositions.clear();
        this.isRunning = false;
        console.log(chalk.yellow('\n⏹️  Position monitoring stopped'));
    }

    /**
     * Add a specific position to monitor
     */
    public addPosition(
        positionAddress: string,
        poolAddress: string,
        walletPublicKey: string,
        config: Partial<MonitorConfig> = {}
    ): void {
        const finalConfig = { ...DEFAULT_CONFIG, ...config };
        
        this.monitoredPositions.set(positionAddress, {
            positionAddress,
            poolAddress,
            walletPublicKey,
            config: finalConfig
        });

        console.log(chalk.green(`✅ Added position ${positionAddress.slice(0, 8)}... to monitoring`));
    }

    /**
     * Remove a position from monitoring
     */
    public removePosition(positionAddress: string): void {
        this.monitoredPositions.delete(positionAddress);
        console.log(chalk.yellow(`🗑️  Removed position ${positionAddress.slice(0, 8)}... from monitoring`));
    }

    /**
     * Get monitoring status
     */
    public getStatus(): {
        isRunning: boolean;
        positionCount: number;
        positions: MonitoredPosition[];
        nextCheck: Date | null;
    } {
        return {
            isRunning: this.isRunning,
            positionCount: this.monitoredPositions.size,
            positions: Array.from(this.monitoredPositions.values()),
            nextCheck: this.cronJob?.nextDate()?.toJSDate() || null
        };
    }

    // ==================== CORE MONITORING LOGIC ====================

    /**
     * Run a full monitoring cycle for all positions
     */
    private async runMonitoringCycle(): Promise<void> {
        const cycleStart = new Date();
        console.log(chalk.cyan(`\n[${cycleStart.toISOString()}] 🔄 Running monitoring cycle...`));
        console.log(chalk.gray(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));

        const logs: MonitorLogEntry[] = [];

        for (const [address, monitored] of this.monitoredPositions) {
            try {
                const logEntry = await this.checkPosition(monitored);
                logs.push(logEntry);
            } catch (error: any) {
                console.error(chalk.red(`❌ Error checking ${address.slice(0, 8)}...: ${error.message}`));
                logs.push({
                    timestamp: new Date().toISOString(),
                    positionAddress: address,
                    poolPair: 'Unknown',
                    inRange: false,
                    currentPrice: 0,
                    rangeMin: 0,
                    rangeMax: 0,
                    distanceToEdge: 0,
                    unclaimedFeesUsd: 0,
                    aiDecision: {
                        action: 'error',
                        confidence: 0,
                        urgency: 'none',
                        reasoning: [error.message]
                    },
                    actionTaken: 'error',
                    errorMessage: error.message
                });
            }
        }

        // Save logs to file
        const config = this.monitoredPositions.values().next().value?.config;
        if (config?.logToFile) {
            await this.saveLogToFile(logs);
        }

        console.log(chalk.gray(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
        console.log(chalk.cyan(`✅ Cycle complete. Checked ${logs.length} position(s)`));
        if (this.cronJob) {
            console.log(chalk.gray(`   Next check: ${this.cronJob.nextDate().toLocaleString()}\n`));
        }
    }

    /**
     * Check a single position and get AI analysis
     */
    private async checkPosition(monitored: MonitoredPosition): Promise<MonitorLogEntry> {
        const { positionAddress, poolAddress, config } = monitored;
        
        // Fetch fresh position data
        const positions = await positionService.getAllPositions(monitored.walletPublicKey);
        const position = positions.find(p => p.publicKey === positionAddress);

        if (!position) {
            throw new Error('Position no longer exists');
        }

        // Get pool info
        const poolInfo = await poolService.getPoolInfo(poolAddress).catch(() => null);
        const pairName = poolInfo 
            ? `${poolInfo.tokenX.symbol}/${poolInfo.tokenY.symbol}`
            : poolAddress.slice(0, 8);

        // Calculate price range
        const binStep = poolInfo?.binStep || 1;
        const tokenXDecimals = poolInfo?.tokenX?.decimals || 9;
        const tokenYDecimals = poolInfo?.tokenY?.decimals || 6;
        
        const rangeMinPrice = poolService.calculateBinPrice(position.lowerBinId, binStep, tokenXDecimals, tokenYDecimals);
        const rangeMaxPrice = poolService.calculateBinPrice(position.upperBinId, binStep, tokenXDecimals, tokenYDecimals);
        const currentPrice = poolInfo?.price || 0;

        // Calculate distance to edge
        const distanceToLower = position.activeBinId - position.lowerBinId;
        const distanceToUpper = position.upperBinId - position.activeBinId;
        const distanceToEdge = Math.min(distanceToLower, distanceToUpper);

        // Log position status
        console.log(`\n📍 ${chalk.bold(pairName)} (${positionAddress.slice(0, 8)}...)`);
        console.log(`   Status: ${position.inRange ? chalk.green('IN RANGE ✅') : chalk.red('OUT OF RANGE ❌')}`);
        console.log(`   Price: $${currentPrice.toFixed(4)} | Range: $${rangeMinPrice.toFixed(4)} - $${rangeMaxPrice.toFixed(4)}`);
        console.log(`   Edge Distance: ${distanceToEdge} bins`);
        console.log(`   Unclaimed Fees: $${(position.unclaimedFees?.usdValue || 0).toFixed(4)}`);

        // Get AI analysis
        let aiDecision: LLMDecision;
        let actionTaken: 'none' | 'logged' | 'rebalanced' | 'error' = 'logged';

        if (llmAgent.isAvailable()) {
            console.log(chalk.gray(`   🤖 Consulting AI...`));
            aiDecision = await llmAgent.analyzePosition(position);
            
            console.log(`   AI Says: ${chalk.bold(aiDecision.action.toUpperCase())} (${aiDecision.confidence}% confidence)`);
            console.log(`   Urgency: ${aiDecision.urgency}`);
            aiDecision.reasoning.slice(0, 2).forEach(r => {
                console.log(chalk.gray(`   • ${r}`));
            });

            // Check if we should act
            const shouldAct = 
                aiDecision.action === 'rebalance' &&
                aiDecision.confidence >= config.confidenceThreshold &&
                config.urgencyFilter.includes(aiDecision.urgency);

            if (shouldAct && config.enableAutoRebalance) {
                console.log(chalk.yellow(`\n   ⚡ AUTO-REBALANCE TRIGGERED`));
                try {
                    await this.executeRebalance(position, poolInfo);
                    actionTaken = 'rebalanced';
                    console.log(chalk.green(`   ✅ Rebalance completed successfully`));
                } catch (error: any) {
                    console.error(chalk.red(`   ❌ Rebalance failed: ${error.message}`));
                    actionTaken = 'error';
                }
            } else if (shouldAct) {
                console.log(chalk.yellow(`   ⚠️  Rebalance recommended but auto-execute is disabled`));
            }
        } else {
            console.log(chalk.yellow(`   ⚠️  AI not available - using basic analysis`));
            aiDecision = {
                action: position.inRange ? 'hold' : 'rebalance',
                confidence: position.inRange ? 50 : 90,
                urgency: position.inRange ? 'none' : 'immediate',
                reasoning: [position.inRange ? 'Position is in range' : 'Position is out of range - not earning fees'],
                expectedOutcome: { costUsd: 0, expectedFeesNext24h: 0, breakEvenHours: 0, roi: 0 },
                risks: []
            };
        }

        // Update last check
        monitored.lastCheck = new Date();
        monitored.lastDecision = aiDecision;

        return {
            timestamp: new Date().toISOString(),
            positionAddress,
            poolPair: pairName,
            inRange: position.inRange,
            currentPrice,
            rangeMin: rangeMinPrice,
            rangeMax: rangeMaxPrice,
            distanceToEdge,
            unclaimedFeesUsd: position.unclaimedFees?.usdValue || 0,
            aiDecision: {
                action: aiDecision.action,
                confidence: aiDecision.confidence,
                urgency: aiDecision.urgency,
                reasoning: aiDecision.reasoning
            },
            actionTaken
        };
    }

    /**
     * Execute a rebalance operation
     */
    private async executeRebalance(position: UserPosition, poolInfo: any): Promise<void> {
        const { rebalancingService } = require('./rebalancing.service');
        
        // Get the keypair for the wallet
        const keypair = walletService.getActiveKeypair();
        if (!keypair) {
            throw new Error('No active wallet keypair');
        }

        // Use intelligent bin defaults based on token pair
        const activeBin = position.activeBinId;
        const tokenXSymbol = poolInfo?.tokenX?.symbol || position.tokenX?.symbol || '';
        const tokenYSymbol = poolInfo?.tokenY?.symbol || position.tokenY?.symbol || '';
        
        // Determine appropriate bins per side based on pair type
        const stableSymbols = ['USDC', 'USDT', 'DAI', 'PYUSD'];
        const memeTokens = ['BONK', 'WIF', 'POPCAT', 'BOME', 'MEW', 'MYRO', 'SLERF', 'TRUMP'];
        const isStablePair = stableSymbols.includes(tokenXSymbol) && stableSymbols.includes(tokenYSymbol);
        const isMemeToken = memeTokens.includes(tokenXSymbol) || memeTokens.includes(tokenYSymbol);
        const hasStable = stableSymbols.includes(tokenXSymbol) || stableSymbols.includes(tokenYSymbol);
        
        // Max 34 bins per side (69 total) due to Meteora DLMM single-transaction limit
        let binsPerSide: number;
        if (isStablePair) {
            binsPerSide = 34; // Stablecoins - curve strategy (max allowed)
        } else if (isMemeToken) {
            binsPerSide = 34; // Meme tokens - use max allowed for volatility
        } else if (hasStable) {
            binsPerSide = 34; // Major pairs like SOL/USDC - use max allowed
        } else {
            binsPerSide = 25; // Crypto/crypto pairs - moderate range
        }
        
        const newMinBin = activeBin - binsPerSide;
        const newMaxBin = activeBin + binsPerSide;

        console.log(chalk.gray(`   New range: [${newMinBin} - ${newMaxBin}] centered on ${activeBin} (${binsPerSide} bins/side for ${tokenXSymbol}/${tokenYSymbol})`));

        // Execute rebalance
        const result = await rebalancingService.rebalancePosition(
            position.poolAddress,
            position.publicKey,
            newMinBin,
            newMaxBin,
            keypair
        );

        // Log the rebalance
        analyticsDataStore.recordRebalance({
            timestamp: Date.now(),
            oldPositionAddress: position.publicKey,
            newPositionAddress: result.newPositionAddress,
            poolAddress: position.poolAddress,
            reasonCode: 'AUTO',
            reason: 'AI-triggered auto-rebalance',
            oldRange: { min: position.lowerBinId, max: position.upperBinId },
            newRange: { min: newMinBin, max: newMaxBin },
            feesClaimedX: 0,
            feesClaimedY: 0,
            feesClaimedUsd: result.withdrawnUsd || 0,
            transactionCostUsd: 0.03  // Estimated
        });
    }

    /**
     * Save monitoring logs to file
     */
    private async saveLogToFile(logs: MonitorLogEntry[]): Promise<void> {
        const date = new Date().toISOString().split('T')[0];
        const filename = `monitor-${date}.json`;
        const filepath = path.join(this.logDir, filename);

        let existingLogs: MonitorLogEntry[] = [];
        if (fs.existsSync(filepath)) {
            try {
                const content = fs.readFileSync(filepath, 'utf-8');
                existingLogs = JSON.parse(content);
            } catch {
                existingLogs = [];
            }
        }

        existingLogs.push(...logs);

        fs.writeFileSync(filepath, JSON.stringify(existingLogs, null, 2));
        console.log(chalk.gray(`   📝 Logged to ${filename}`));
    }
}

// Export singleton
export const positionMonitor = new PositionMonitorService();

// ==================== CLI HELPER ====================

/**
 * Start monitoring from command line
 */
export async function startMonitoringCLI(options: {
    intervalMinutes?: number;
    enableAutoRebalance?: boolean;
    confidenceThreshold?: number;
}): Promise<void> {
    const wallet = walletService.getActiveWallet();
    if (!wallet) {
        console.error(chalk.red('❌ No active wallet. Please select a wallet first.'));
        return;
    }

    await positionMonitor.startMonitoring(wallet.publicKey, {
        intervalMinutes: options.intervalMinutes || 30,
        enableAutoRebalance: options.enableAutoRebalance || false,
        confidenceThreshold: options.confidenceThreshold || 75,
        logToFile: true,
        notifyOnAction: true,
        urgencyFilter: ['immediate', 'soon']
    });

    // Keep process alive
    process.on('SIGINT', () => {
        positionMonitor.stopMonitoring();
        process.exit(0);
    });
}
