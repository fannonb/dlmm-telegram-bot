import { CronJob } from 'cron';
import { hourlySnapshotService } from './hourlySnapshot.service';
import { llmAgent } from './llmAgent.service';
import { positionService } from './position.service';
import chalk from 'chalk';
import { walletService } from './wallet.service';
import { fetchPoolVolume } from './meteoraVolume.service';

/**
 * Automated monitoring scheduler for LP positions
 * 
 * Monitoring Strategy (based on research):
 * - Hourly: Price/volume snapshots (intra day trends)
 * - 30-minute: Quick position checks (edge detection + real-time volume)
 * - 12-hourly: Full LLM analysis if triggered
 * - Daily: Deep strategic review
 */

interface MonitoringConfig {
    enableHourlySnapshots: boolean;
    enable30MinuteMonitoring: boolean;
    enable12HourAnalysis: boolean;
    enableDailyReview: boolean;
    activePositions: string[];  // Pool addresses to monitor
}

class PositionMonitoringScheduler {
    private jobs: CronJob[] = [];
    private config: MonitoringConfig;

    constructor(config: MonitoringConfig) {
        this.config = config;
    }

    /**
     * Start all monitoring jobs
     */
    start(): void {
        console.log(chalk.cyan('\n🤖 Starting Automated Position Monitoring\n'));

        if (this.config.enableHourlySnapshots) {
            this.startHourlySnapshots();
        }

        if (this.config.enable30MinuteMonitoring) {
            this.start30MinuteMonitoring();
        }

        if (this.config.enable12HourAnalysis) {
            this.start12HourAnalysis();
        }

        if (this.config.enableDailyReview) {
            this.startDailyReview();
        }

        console.log(chalk.green('✅ All monitoring jobs started\n'));
    }

    /**
     * Stop all monitoring jobs
     */
    stop(): void {
        console.log(chalk.yellow('\n⏸️  Stopping all monitoring jobs...'));
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
        console.log(chalk.green('✅ All jobs stopped\n'));
    }

    /**
     * Hourly snapshots - Every hour at :00
     */
    private startHourlySnapshots(): void {
        const job = new CronJob(
            '0 * * * *',  // Every hour
            async () => {
                console.log(chalk.blue(`[${new Date().toISOString()}] 📸 Recording hourly snapshots...`));

                for (const poolAddress of this.config.activePositions) {
                    try {
                        await hourlySnapshotService.recordSnapshot(poolAddress);
                        console.log(chalk.gray(`  ✓ Snapshot recorded: ${poolAddress.slice(0, 8)}...`));
                    } catch (error: any) {
                        console.error(chalk.red(`  ✗ Failed: ${error.message}`));
                    }
                }

                console.log(chalk.green('✅ Hourly snapshots complete\n'));
            },
            null,
            true,  // Start immediately
            'UTC'
        );

        this.jobs.push(job);
        console.log(chalk.gray('  • Hourly snapshots: Every hour at :00'));
    }

    /**
     * 30-minute monitoring - Quick position checks & Real-time Volume
     */
    private start30MinuteMonitoring(): void {
        const job = new CronJob(
            '*/30 * * * *',  // Every 30 minutes
            async () => {
                console.log(chalk.blue(`[${new Date().toISOString()}] 🔍 30-minute position check...`));

                const wallet = walletService.getActiveWallet();
                if (!wallet) return;

                const positions = await positionService.getAllPositions(wallet.publicKey);

                for (const position of positions) {
                    try {
                        const urgent = await this.checkPositionUrgency(position);

                        if (urgent.isUrgent) {
                            console.log(chalk.yellow(`  ⚠️  ${position.publicKey.slice(0, 8)}... - ${urgent.reason}`));

                            if (urgent.triggerLLM) {
                                console.log(chalk.cyan('     → Triggering LLM analysis...'));
                                await this.performLLMAnalysis(position, 'urgent');
                            }
                        } else {
                            console.log(chalk.gray(`  ✓ ${position.publicKey.slice(0, 8)}... - OK`));
                        }
                    } catch (error: any) {
                        console.error(chalk.red(`  ✗ Error: ${error.message}`));
                    }
                }

                console.log(chalk.green('✅ 30-minute check complete\n'));
            },
            null,
            true,
            'UTC'
        );

        this.jobs.push(job);
        console.log(chalk.gray('  • 30-minute monitoring: Every 30 minutes'));
    }

    /**
     * 12-hour analysis - Full LLM analysis if triggered
     */
    private start12HourAnalysis(): void {
        const job = new CronJob(
            '0 8,20 * * *',  // 08:00 and 20:00 UTC
            async () => {
                const hour = new Date().getUTCHours();
                const market = hour === 8 ? 'US Market Open' : 'Asia Market';

                console.log(chalk.blue(`[${new Date().toISOString()}] 📊 12-hour analysis (${market})...`));

                const wallet = walletService.getActiveWallet();
                if (!wallet) return;

                const positions = await positionService.getAllPositions(wallet.publicKey);

                for (const position of positions) {
                    try {
                        const shouldAnalyze = await this.should12HourAnalyze(position);

                        if (shouldAnalyze.analyze) {
                            console.log(chalk.cyan(`  🤖 Analyzing: ${position.publicKey.slice(0, 8)}...`));
                            console.log(chalk.gray(`     Reason: ${shouldAnalyze.reason}`));

                            await this.performLLMAnalysis(position, 'scheduled');
                        } else {
                            console.log(chalk.gray(`  ○ ${position.publicKey.slice(0, 8)}... - No analysis needed`));
                        }
                    } catch (error: any) {
                        console.error(chalk.red(`  ✗ Error: ${error.message}`));
                    }
                }

                console.log(chalk.green('✅ 12-hour analysis complete\n'));
            },
            null,
            true,
            'UTC'
        );

        this.jobs.push(job);
        console.log(chalk.gray('  • 12-hour analysis: 08:00 & 20:00 UTC'));
    }

    /**
     * Daily review - Strategic analysis and learning
     */
    private startDailyReview(): void {
        const job = new CronJob(
            '0 0 * * *',  // Midnight UTC
            async () => {
                console.log(chalk.blue(`[${new Date().toISOString()}] 🌙 Daily strategic review...`));

                const wallet = walletService.getActiveWallet();
                if (!wallet) return;

                const positions = await positionService.getAllPositions(wallet.publicKey);

                for (const position of positions) {
                    try {
                        console.log(chalk.cyan(`  🤖 Deep analysis: ${position.publicKey.slice(0, 8)}...`));
                        await this.performLLMAnalysis(position, 'daily');
                    } catch (error: any) {
                        console.error(chalk.red(`  ✗ Error: ${error.message}`));
                    }
                }

                console.log(chalk.green('✅ Daily review complete\n'));
            },
            null,
            true,
            'UTC'
        );

        this.jobs.push(job);
        console.log(chalk.gray('  • Daily review: 00:00 UTC'));
    }

    /**
     * Check if position needs urgent attention
     */
    private async checkPositionUrgency(position: any): Promise<{ isUrgent: boolean; triggerLLM: boolean; reason: string }> {
        // Out of range = CRITICAL
        if (!position.inRange) {
            return {
                isUrgent: true,
                triggerLLM: true,
                reason: 'OUT OF RANGE - Not earning fees!'
            };
        }

        // Calculate distance to edge
        const distanceToEdge = Math.min(
            position.activeBinId - position.lowerBinId,
            position.upperBinId - position.activeBinId
        );

        // Close to edge = URGENT
        if (distanceToEdge < 3) {
            return {
                isUrgent: true,
                triggerLLM: true,
                reason: `Only ${distanceToEdge} bins from edge`
            };
        }

        // Approaching edge = WARNING
        if (distanceToEdge < 10) {
            return {
                isUrgent: true,
                triggerLLM: false,  // Will analyze at next 12h cycle
                reason: `Approaching edge (${distanceToEdge} bins)`
            };
        }

        // Check volume spike via REAL-TIME API
        try {
            const volumeData = await fetchPoolVolume(position.poolAddress);
            // Trigger if current 24h volume is > 1.5x the 7d average (ratio > 1.5)
            if (volumeData.volumeRatio > 1.5) {
                return {
                    isUrgent: true,
                    triggerLLM: true, // Immediate trigger for volume spikes
                    reason: `Volume spike detected (${volumeData.volumeRatio.toFixed(2)}x avg)`
                };
            }
        } catch {
            // Volume check failed, ignore
        }

        return {
            isUrgent: false,
            triggerLLM: false,
            reason: 'Position healthy'
        };
    }

    /**
     * Check if 12-hour analysis should run
     */
    private async should12HourAnalyze(position: any): Promise<{ analyze: boolean; reason: string }> {
        const distanceToEdge = Math.min(
            position.activeBinId - position.lowerBinId,
            position.upperBinId - position.activeBinId
        );

        // Close to edge
        if (distanceToEdge < 10) {
            return { analyze: true, reason: 'Approaching edge' };
        }

        // Position age > 12 hours
        const ageHours = position.lastRebalanceTimestamp
            ? (Date.now() - position.lastRebalanceTimestamp) / (1000 * 60 * 60)
            : Infinity;

        if (ageHours > 12) {
            // Check volume
            try {
                const intraDayContext = hourlySnapshotService.getIntraDayContext(position.poolAddress, 12);
                if (intraDayContext.momentum?.volume > 50) {
                    return { analyze: true, reason: 'High volume + position age > 12h' };
                }
            } catch {
                // Fallback
            }
        }

        return { analyze: false, reason: 'No triggers met' };
    }

    /**
     * Perform LLM analysis on position
     */
    private async performLLMAnalysis(position: any, type: 'urgent' | 'scheduled' | 'daily'): Promise<void> {
        if (!llmAgent.isAvailable()) {
            console.log(chalk.yellow('     ⚠️  LLM not configured, skipping analysis'));
            return;
        }

        try {
            const decision = await llmAgent.analyzePosition(position);

            console.log(chalk.green(`     ✅ Decision: ${decision.action}`));
            console.log(chalk.gray(`        Confidence: ${decision.confidence}%`));
            console.log(chalk.gray(`        Urgency: ${decision.urgency}`));

            // Send Telegram notification if urgency is immediate or soon
            if (decision.urgency === 'immediate' || decision.urgency === 'soon') {
                console.log(chalk.yellow(`     📱 [Phase 3] Would send Telegram notification`));
            }
        } catch (error: any) {
            console.error(chalk.red(`     ✗ LLM analysis failed: ${error.message}`));
        }
    }

    /**
     * Get scheduler status
     */
    getStatus(): { jobCount: number; running: boolean; activePositions: number } {
        return {
            jobCount: this.jobs.length,
            running: this.jobs.length > 0,  // If we have jobs, they're running
            activePositions: this.config.activePositions.length
        };
    }
}

// Singleton instance (will be configured via CLI)
let scheduler: PositionMonitoringScheduler | null = null;

export function startMonitoring(config: MonitoringConfig): void {
    if (scheduler) {
        scheduler.stop();
    }

    scheduler = new PositionMonitoringScheduler(config);
    scheduler.start();
}

export function stopMonitoring(): void {
    if (scheduler) {
        scheduler.stop();
        scheduler = null;
    }
}

export function getMonitoringStatus() {
    return scheduler ? scheduler.getStatus() : null;
}

export { PositionMonitoringScheduler, MonitoringConfig };
