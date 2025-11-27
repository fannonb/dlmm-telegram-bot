import { CronJob } from 'cron';
import chalk from 'chalk';
import { positionService, UserPosition } from './position.service';
import { rebalancingService } from './rebalancing.service';
import { poolService } from './pool.service';
import { analyticsDataStore } from './analyticsDataStore.service';
import { walletService } from './wallet.service';
import { volumeCache } from './meteoraVolume.service';

/**
 * Rebalancing frequency options
 */
export enum RebalanceFrequency {
    AGGRESSIVE = 'aggressive',      // Every 4 hours, ±8% range
    BALANCED = 'balanced',           // Every 8 hours, ±12% range
    CONSERVATIVE = 'conservative'    // Daily, ±18% range
}

/**
 * Configuration for automated rebalancing
 */
export interface AutoRebalanceConfig {
    frequency: RebalanceFrequency;
    rangeWidth: number;              // Percentage (e.g., 8 = ±8%)
    minCostBenefit: number;          // Minimum ROI ratio (e.g., 1.5 = must earn 1.5x gas cost)
    urgencyOverride: boolean;        // Always rebalance if out of range
    enableVolumeCheck: boolean;      // Use volume analysis
    checkInterval: number;           // Milliseconds between checks
}

/**
 * Preset configurations for different strategies
 */
export const REBALANCE_PRESETS: Record<RebalanceFrequency, AutoRebalanceConfig> = {
    [RebalanceFrequency.AGGRESSIVE]: {
        frequency: RebalanceFrequency.AGGRESSIVE,
        rangeWidth: 8,                    // ±8% for maximum fee capture
        minCostBenefit: 1.2,              // Rebalance if 1.2x ROI
        urgencyOverride: true,            // ALWAYS rebalance when out of range
        enableVolumeCheck: true,          // Enable smart volume filtering
        checkInterval: 4 * 60 * 60 * 1000 // 4 hours
    },
    [RebalanceFrequency.BALANCED]: {
        frequency: RebalanceFrequency.BALANCED,
        rangeWidth: 12,                   // ±12% for balanced approach
        minCostBenefit: 2.0,              // Rebalance if 2x ROI
        urgencyOverride: true,
        enableVolumeCheck: true,
        checkInterval: 8 * 60 * 60 * 1000 // 8 hours
    },
    [RebalanceFrequency.CONSERVATIVE]: {
        frequency: RebalanceFrequency.CONSERVATIVE,
        rangeWidth: 18,                   // ±18% for stability
        minCostBenefit: 3.0,              // Rebalance if 3x ROI
        urgencyOverride: false,           // Wait for optimal timing
        enableVolumeCheck: true,
        checkInterval: 24 * 60 * 60 * 1000 // Daily
    }
};

interface RebalanceDecision {
    shouldRebalance: boolean;
    urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    confidence: number;
    estimatedGain: number;
    breakEvenHours: number;
    reason: string;
    volumeRatio?: number;
}

/**
 * Universal Automated Rebalancing Service
 * Works with all pool types - volatile/stable, stable/stable, volatile/volatile
 */
export class AutoRebalancer {
    private jobs: Map<string, CronJob> = new Map();
    private activePositions: Map<string, AutoRebalanceConfig> = new Map();

    /**
     * Start automated rebalancing for any position
     */
    public startAutomation(
        positionAddress: string,
        config: AutoRebalanceConfig = REBALANCE_PRESETS[RebalanceFrequency.AGGRESSIVE]
    ): void {
        console.log(chalk.blue.bold(`🤖 Starting Automated Rebalancing`));
        console.log(`Position: ${positionAddress}`);
        console.log(`Strategy: ${config.frequency}`);
        console.log(`Range Width: ±${config.rangeWidth}%`);
        console.log(`Check Interval: ${this.formatInterval(config.checkInterval)}`);
        console.log(chalk.gray(`Urgency Override: ${config.urgencyOverride ? 'ON' : 'OFF'}`));
        console.log();

        // Store configuration
        this.activePositions.set(positionAddress, config);

        // Create cron expression based on frequency
        const cronExpression = this.getCronExpression(config.frequency);

        const job = new CronJob(cronExpression, async () => {
            await this.checkAndRebalance(positionAddress, config);
        });

        job.start();
        this.jobs.set(positionAddress, job);

        console.log(chalk.green(`✅ Automation started! Next check: ${job.nextDate().toLocaleString()}`));
        console.log(chalk.gray(`Tip: Position will rebalance automatically when conditions are met.\n`));

        // Run initial check immediately
        this.checkAndRebalance(positionAddress, config).catch(err => {
            console.error(chalk.red(`Initial check failed: ${err.message}`));
        });
    }

    /**
     * Check position and rebalance if needed
     */
    private async checkAndRebalance(
        positionAddress: string,
        config: AutoRebalanceConfig
    ): Promise<void> {
        const timestamp = new Date().toISOString();
        console.log(chalk.cyan(`\n[${timestamp}] 🔍 Checking position ${positionAddress.slice(0, 8)}...`));

        try {
            // Fetch current position data - FIX: Added connectionService parameter
            const activeWallet = walletService.getActiveWallet();
            if (!activeWallet) {
                console.log(chalk.yellow(`⚠️  No active wallet found`));
                return;
            }
            const positions = await positionService.getAllPositions(activeWallet.publicKey);
            const position = positions.find(p => p.publicKey === positionAddress);

            if (!position) {
                console.log(chalk.yellow(`⚠️  Position not found`));
                return;
            }

            // Analyze rebalancing decision
            const decision = await this.analyzeRebalancing(position, config);

            // Log analysis results
            this.logDecision(decision, position);

            // Execute rebalance if needed
            if (decision.shouldRebalance) {
                await this.executeRebalance(position, config, decision);
            } else {
                console.log(chalk.gray(`⏸️  No action needed - position is optimal\n`));
            }

        } catch (error: any) {
            console.error(chalk.red(`❌ Error during rebalance check:`), error.message);
            // TODO: Add notification service when implemented
        }
    }

    /**
     * Analyze whether position should be rebalanced
     */
    private async analyzeRebalancing(
        position: UserPosition,
        config: AutoRebalanceConfig
    ): Promise<RebalanceDecision> {
        // Check if out of range
        const outOfRange = !position.inRange;

        // If urgencyOverride and out of range, rebalance immediately
        if (config.urgencyOverride && outOfRange) {
            return {
                shouldRebalance: true,
                urgency: 'CRITICAL',
                confidence: 100,
                estimatedGain: 0,
                breakEvenHours: 0,
                reason: 'Position OUT OF RANGE - No fees being earned! Immediate rebalancing required.'
            };
        }

        // Calculate position metrics
        const edgeDistance = this.calculateEdgeDistance(position);
        const binsActivePercent = this.calculateActiveBins(position);

        // Volume analysis (if enabled) - NOW WITH REAL API DATA!
        let volumeRatio = 1.0;
        if (config.enableVolumeCheck) {
            try {
                const volumeData = await volumeCache.getVolume(position.poolAddress);
                volumeRatio = volumeData.volumeRatio;

                console.log(chalk.gray(`   Volume 24h: $${volumeData.volume24h.toLocaleString()}`));
                console.log(chalk.gray(`   Volume Ratio: ${volumeRatio.toFixed(2)}x (${volumeRatio > 1.5 ? chalk.green('HIGH') : volumeRatio < 0.7 ? chalk.red('LOW') : chalk.yellow('NORMAL')})`));
            } catch (error) {
                console.warn(chalk.yellow(`⚠️  Volume check failed, proceeding without: ${error}`));
            }
        }

        // Cost-benefit analysis
        const currentDailyFees = (position.totalValueUSD || 0) * 0.001; // Estimate 0.1% daily
        const projectedDailyFees = currentDailyFees * 1.5; // Estimate 50% increase after rebalance
        const rebalanceCost = 0.04; // ~$0.04 per rebalance (0.0003 SOL at $130)

        const dailyGain = projectedDailyFees - currentDailyFees;
        const breakEvenHours = dailyGain > 0 ? (rebalanceCost / dailyGain) * 24 : Infinity;
        const opportunityRatio = (dailyGain * 7) / rebalanceCost; // 1-week gain/cost

        // Decision scoring
        let score = 0;

        // Position status (40 points max)
        if (outOfRange) {
            score += 40;
        } else if (edgeDistance < 3) {
            score += 30;
        } else if (binsActivePercent < 50) {
            score += 20;
        } else if (edgeDistance < 5) {
            score += 10;
        }

        // Volume factor (20 points max) - ENHANCED WITH REAL DATA
        if (volumeRatio > 1.5) {
            score += 20; // High volume = sustained movement
        } else if (volumeRatio > 1.2) {
            score += 12;
        } else if (volumeRatio < 0.7) {
            score -= 15; // Low volume = likely noise
        } else {
            score += 5;
        }

        // Cost-benefit factor (20 points max)
        if (opportunityRatio > 5.0) {
            score += 20;
        } else if (opportunityRatio > 3.0) {
            score += 15;
        } else if (opportunityRatio > config.minCostBenefit) {
            score += 10;
        } else if (opportunityRatio < 0.5) {
            score -= 20; // Would lose money
        }

        // Determine urgency and decision
        let urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
        let shouldRebalance = false;
        let reason = '';

        const meetsMinROI = opportunityRatio >= config.minCostBenefit;

        if (score >= 60 && meetsMinROI) {
            urgency = 'HIGH';
            shouldRebalance = true;
            reason = `Strong rebalancing signal (score: ${score}). Expected break-even: ${breakEvenHours.toFixed(1)}h`;
        } else if (score >= 40 && meetsMinROI && breakEvenHours < 48) {
            urgency = 'MEDIUM';
            shouldRebalance = true;
            reason = `Moderate rebalancing opportunity (score: ${score}). Break-even in ${breakEvenHours.toFixed(1)}h`;
        } else if (outOfRange) {
            urgency = 'CRITICAL';
            shouldRebalance = false; // Don't rebalance if ROI is poor even when out of range
            reason = `Out of range but poor ROI (${opportunityRatio.toFixed(2)}x). Waiting for better conditions.`;
        } else {
            urgency = 'NONE';
            shouldRebalance = false;
            reason = `Position optimal (score: ${score}). Active: ${binsActivePercent.toFixed(0)}%, Edge distance: ${edgeDistance} bins`;
        }

        const confidence = Math.min(100, Math.max(0,
            50 + (volumeRatio > 1.3 ? 20 : 0) + (score > 50 ? 15 : 0) + (meetsMinROI ? 15 : 0)
        ));

        return {
            shouldRebalance,
            urgency,
            confidence,
            estimatedGain: dailyGain * 7, // 1-week projection
            breakEvenHours,
            reason,
            volumeRatio
        };
    }

    /**
     * Execute the rebalancing
     */
    private async executeRebalance(
        position: UserPosition,
        config: AutoRebalanceConfig,
        decision: RebalanceDecision
    ): Promise<void> {
        console.log(chalk.yellow.bold(`\n🔄 EXECUTING REBALANCE`));
        console.log(`Urgency: ${decision.urgency}`);
        console.log(`Confidence: ${decision.confidence}%`);
        console.log(`Reason: ${decision.reason}\n`);

        try {
            const binsPerSide = Math.floor(config.rangeWidth / 0.5); // ~0.5% per bin

            const result = await rebalancingService.executeRebalance(position, {
                binsPerSide,
                slippageBps: 100, // 1% slippage tolerance
                strategy: 'Spot', // Uniform distribution
                reasonCode: 'AUTO',
                reason: `Automated SOL-USDC rebalancing (${config.frequency})`
            });

            if (result.success) {
                console.log(chalk.green.bold(`\n✅ REBALANCE SUCCESSFUL!\n`));
                console.log(`Old Position: ${result.oldPositionAddress}`);
                console.log(`New Position: ${result.newPositionAddress}`);
                console.log(`Fees Claimed: $${result.feesClaimed.usdValue.toFixed(2)}`);
                console.log(`TX Cost: $${result.transactionCost.toFixed(2)}`);
                console.log(`Net Gain: $${(result.feesClaimed.usdValue - result.transactionCost).toFixed(2)}\n`);

                if (result.transactions?.length) {
                    console.log(chalk.gray(`Transactions:`));
                    result.transactions.forEach(sig => console.log(chalk.gray(`  ${sig}`)));
                    console.log();
                }

                // Update active positions map with new address
                const oldConfig = this.activePositions.get(position.publicKey);
                if (oldConfig) {
                    this.activePositions.delete(position.publicKey);
                    this.activePositions.set(result.newPositionAddress, oldConfig);
                }

                // TODO: Add success notification when service is implemented
            }
        } catch (error: any) {
            console.log(chalk.red.bold(`\n❌ REBALANCE FAILED\n`));
            console.error(chalk.red(error.message));

            // TODO: Add failure notification when service is implemented
        }
    }

    /**
     * Stop automated rebalancing for a position
     */
    public stopAutomation(positionAddress: string): void {
        const job = this.jobs.get(positionAddress);
        if (job) {
            job.stop();
            this.jobs.delete(positionAddress);
            this.activePositions.delete(positionAddress);
            console.log(chalk.yellow(`🛑 Automation stopped for ${positionAddress.slice(0, 8)}...\n`));
        } else {
            console.log(chalk.gray(`No active automation found for this position.\n`));
        }
    }

    /**
     * List all active automated positions
     */
    public listActiveAutomations(): void {
        console.log(chalk.blue.bold(`\n🤖 ACTIVE AUTOMATED REBALANCING\n`));

        if (this.activePositions.size === 0) {
            console.log(chalk.gray(`No positions currently automated.\n`));
            return;
        }

        this.activePositions.forEach((config, address) => {
            const job = this.jobs.get(address);
            const nextRun = job?.nextDate().toLocaleString() || 'Unknown';

            console.log(`Position: ${address.slice(0, 8)}...`);
            console.log(`  Strategy: ${config.frequency}`);
            console.log(`  Range: ±${config.rangeWidth}%`);
            console.log(`  Next Check: ${nextRun}`);
            console.log();
        });
    }

    // ===== HELPER METHODS =====

    private getCronExpression(frequency: RebalanceFrequency): string {
        switch (frequency) {
            case RebalanceFrequency.AGGRESSIVE:
                return '0 */4 * * *';      // Every 4 hours
            case RebalanceFrequency.BALANCED:
                return '0 0,8,16 * * *';   // 00:00, 08:00, 16:00 UTC
            case RebalanceFrequency.CONSERVATIVE:
                return '0 0 * * *';        // Daily at midnight UTC
            default:
                return '0 */4 * * *';
        }
    }

    private formatInterval(ms: number): string {
        const hours = ms / (1000 * 60 * 60);
        if (hours >= 24) return `${hours / 24} day(s)`;
        return `${hours} hour(s)`;
    }

    private calculateEdgeDistance(position: UserPosition): number {
        const distanceFromMin = position.activeBinId - position.lowerBinId;
        const distanceFromMax = position.upperBinId - position.activeBinId;
        return Math.min(distanceFromMin, distanceFromMax);
    }

    private calculateActiveBins(position: UserPosition): number {
        const totalBins = position.upperBinId - position.lowerBinId + 1;
        if (!position.inRange) return 0;

        // Simplified: assume uniform distribution
        // In reality, would need to check actual liquidity distribution
        return (totalBins / totalBins) * 100;
    }

    private logDecision(decision: RebalanceDecision, position: UserPosition): void {
        console.log(chalk.white(`Position: ${position.tokenX.symbol}/${position.tokenY.symbol}`));
        console.log(`Range: ${position.lowerBinId} → ${position.upperBinId}`);
        console.log(`Active Bin: ${position.activeBinId} ${position.inRange ? chalk.green('(IN-RANGE)') : chalk.red('(OUT-OF-RANGE)')}`);
        console.log(`\nDecision: ${this.formatUrgency(decision.urgency)}`);
        console.log(`Confidence: ${decision.confidence}%`);
        if (decision.volumeRatio) {
            console.log(`Volume Ratio: ${decision.volumeRatio.toFixed(2)}x`);
        }
        console.log(`Break-even: ${decision.breakEvenHours === Infinity ? 'N/A' : decision.breakEvenHours.toFixed(1) + 'h'}`);
        console.log(`Reason: ${decision.reason}`);
        console.log();
    }

    private formatUrgency(urgency: string): string {
        switch (urgency) {
            case 'CRITICAL': return chalk.red.bold('🔴 CRITICAL');
            case 'HIGH': return chalk.yellow.bold('🟡 HIGH');
            case 'MEDIUM': return chalk.blue('🟦 MEDIUM');
            case 'LOW': return chalk.gray('⬜ LOW');
            default: return chalk.green('✅ NONE');
        }
    }
}

// Singleton export
export const autoRebalancer = new AutoRebalancer();

// Keep legacy export for backwards compatibility
export const solUsdcRebalancer = autoRebalancer;
