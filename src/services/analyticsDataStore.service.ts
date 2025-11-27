import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { VolumeSnapshot, getVolumeTrend } from './volumeTracking.service';

export interface AnalyticsSnapshot {
    timestamp: number;
    positionAddress: string;
    poolAddress: string;
    tokenXAmount: number;
    tokenYAmount: number;
    usdValue: number;
    feesXAmount: number;
    feesYAmount: number;
    feesUsdValue: number;
    activeBinId: number;
    inRange: boolean;
    poolApr: number;
    gasCostUsd: number;
    timeInRangePercent: number;

    // NEW: Bin utilization metrics
    binUtilization?: {
        totalBins: number;
        activeBins: number;
        utilizationPercent: number;
        avgLiquidityPerBin: number;
        liquidityConcentration: number;
    };

    // NEW: Fee performance tracking
    feePerformance?: {
        expectedDailyFeesUsd: number;
        actualDailyFeesUsd: number;
        efficiency: number;
        distanceToEdge: number;
    };
}

export interface RebalanceHistoryEntry {
    timestamp: number;
    oldPositionAddress: string;
    newPositionAddress: string;
    poolAddress: string;
    reasonCode: 'OUT_OF_RANGE' | 'EFFICIENCY' | 'MANUAL' | 'AUTO' | 'OTHER';
    reason: string;
    feesClaimedX: number;
    feesClaimedY: number;
    feesClaimedUsd: number;
    transactionCostUsd: number;
    oldRange: { min: number; max: number };
    newRange: { min: number; max: number };
    signature?: string;
}

export interface FeeClaimRecord {
    timestamp: number;
    positionAddress: string;
    poolAddress: string;
    claimedX: number;
    claimedY: number;
    claimedUsd: number;
    transactionCostUsd: number;
    method: 'manual' | 'auto';
    signature?: string;
}

export class AnalyticsDataStore {
    private dataDir: string;
    private snapshotsFile: string;
    private rebalanceHistoryFile: string;
    private feeClaimsFile: string;

    constructor(dataDir: string = './data/analytics') {
        this.dataDir = dataDir;
        this.snapshotsFile = join(this.dataDir, 'snapshots.json');
        this.rebalanceHistoryFile = join(this.dataDir, 'rebalance-history.json');
        this.feeClaimsFile = join(this.dataDir, 'fee-claims.json');

        this.initializeDataDirectory();
    }

    /**
     * Initialize the data directory and files
     */
    private initializeDataDirectory(): void {
        try {
            // Create directory if it doesn't exist
            const fs = require('fs');
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
                console.log(chalk.green(`✓ Analytics data directory created: ${this.dataDir}`));
            }

            // Initialize JSON files if they don't exist
            if (!existsSync(this.snapshotsFile)) {
                writeFileSync(this.snapshotsFile, JSON.stringify([], null, 2));
            }
            if (!existsSync(this.rebalanceHistoryFile)) {
                writeFileSync(this.rebalanceHistoryFile, JSON.stringify([], null, 2));
            }
            if (!existsSync(this.feeClaimsFile)) {
                writeFileSync(this.feeClaimsFile, JSON.stringify([], null, 2));
            }
        } catch (error) {
            console.error(chalk.red('Error initializing analytics directory:'), error);
        }
    }

    /**
     * Record a position snapshot
     */
    recordSnapshot(snapshot: AnalyticsSnapshot): void {
        try {
            const snapshots: AnalyticsSnapshot[] = this.loadSnapshots();
            snapshots.push(snapshot);

            // Keep only last 90 days of data
            const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
            const filtered = snapshots.filter(s => s.timestamp >= ninetyDaysAgo);

            writeFileSync(this.snapshotsFile, JSON.stringify(filtered, null, 2));
        } catch (error) {
            console.error(chalk.red('Error recording snapshot:'), error);
        }
    }

    /**
     * Load all snapshots
     */
    loadSnapshots(): AnalyticsSnapshot[] {
        try {
            const data = readFileSync(this.snapshotsFile, 'utf-8');
            return JSON.parse(data) || [];
        } catch (error) {
            console.error(chalk.red('Error loading snapshots:'), error);
            return [];
        }
    }

    /**
     * Get snapshots for a specific position
     */
    getPositionSnapshots(positionAddress: string, days: number = 7): AnalyticsSnapshot[] {
        const snapshots = this.loadSnapshots();
        const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

        return snapshots.filter(
            s => s.positionAddress === positionAddress && s.timestamp >= cutoffTime
        );
    }

    /**
     * Get snapshot range (first/latest) for a position within optional time window
     */
    getPositionSnapshotRange(
        positionAddress: string,
        options?: { days?: number }
    ): { first?: AnalyticsSnapshot; latest?: AnalyticsSnapshot; snapshots: AnalyticsSnapshot[] } {
        const days = options?.days ?? 90;
        const snapshots = this.getPositionSnapshots(positionAddress, days)
            .sort((a, b) => a.timestamp - b.timestamp);

        return {
            first: snapshots[0],
            latest: snapshots[snapshots.length - 1],
            snapshots,
        };
    }

    /**
     * Record a rebalance event
     */
    recordRebalance(entry: RebalanceHistoryEntry): void {
        try {
            const history: RebalanceHistoryEntry[] = this.loadRebalanceHistory();
            history.push(entry);

            writeFileSync(this.rebalanceHistoryFile, JSON.stringify(history, null, 2));
            console.log(chalk.green('✓ Rebalance recorded to history'));
        } catch (error) {
            console.error(chalk.red('Error recording rebalance:'), error);
        }
    }

    /**
     * Load rebalance history
     */
    loadRebalanceHistory(): RebalanceHistoryEntry[] {
        try {
            const data = readFileSync(this.rebalanceHistoryFile, 'utf-8');
            return JSON.parse(data) || [];
        } catch (error) {
            console.error(chalk.red('Error loading rebalance history:'), error);
            return [];
        }
    }

    /**
     * Get rebalance history for a position
     */
    getPositionRebalanceHistory(positionAddress: string): RebalanceHistoryEntry[] {
        const history = this.loadRebalanceHistory();
        return history.filter(
            h => h.oldPositionAddress === positionAddress || h.newPositionAddress === positionAddress
        );
    }

    /**
     * Record a fee claim
     */
    recordFeeClaim(record: FeeClaimRecord): void {
        try {
            const claims: FeeClaimRecord[] = this.loadFeeClaims();
            claims.push(record);

            writeFileSync(this.feeClaimsFile, JSON.stringify(claims, null, 2));
            console.log(chalk.green('✓ Fee claim recorded to history'));
        } catch (error) {
            console.error(chalk.red('Error recording fee claim:'), error);
        }
    }

    /**
     * Load fee claims
     */
    loadFeeClaims(): FeeClaimRecord[] {
        try {
            const data = readFileSync(this.feeClaimsFile, 'utf-8');
            return JSON.parse(data) || [];
        } catch (error) {
            console.error(chalk.red('Error loading fee claims:'), error);
            return [];
        }
    }

    /**
     * Get fee claim history for a position
     */
    getPositionFeeClaims(positionAddress: string, days: number = 30): FeeClaimRecord[] {
        const claims = this.loadFeeClaims();
        const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

        return claims.filter(
            c => c.positionAddress === positionAddress && c.timestamp >= cutoffTime
        );
    }

    /**
     * Calculate portfolio statistics for a time period
     */
    calculatePortfolioStats(positionAddresses: string[], days: number = 30): {
        totalFeesEarned: number;
        totalGasCosts: number;
        averageDailyFees: number;
        positionCount: number;
        timeframe: string;
    } {
        try {
            const snapshots = this.loadSnapshots();
            const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

            const relevantSnapshots = snapshots.filter(
                s =>
                    positionAddresses.includes(s.positionAddress) &&
                    s.timestamp >= cutoffTime
            );

            let totalFees = 0;
            let totalGasCost = 0;

            relevantSnapshots.forEach(s => {
                totalFees += s.feesUsdValue;
                totalGasCost += s.gasCostUsd;
            });

            const averageDaily = relevantSnapshots.length > 0 ? totalFees / days : 0;

            return {
                totalFeesEarned: totalFees,
                totalGasCosts: totalGasCost,
                averageDailyFees: averageDaily,
                positionCount: positionAddresses.length,
                timeframe: `${days} days`,
            };
        } catch (error) {
            console.error(chalk.red('Error calculating portfolio stats:'), error);
            return {
                totalFeesEarned: 0,
                totalGasCosts: 0,
                averageDailyFees: 0,
                positionCount: 0,
                timeframe: `${days} days`,
            };
        }
    }

    /**
     * Export data to CSV
     */
    exportToCsv(type: 'snapshots' | 'rebalances' | 'feeClaims', filePath: string): void {
        try {
            let csvContent = '';
            let data: any[] = [];

            if (type === 'snapshots') {
                data = this.loadSnapshots();
                csvContent = this.snapshotsToCSV(data);
            } else if (type === 'rebalances') {
                data = this.loadRebalanceHistory();
                csvContent = this.rebalancesToCSV(data);
            } else if (type === 'feeClaims') {
                data = this.loadFeeClaims();
                csvContent = this.feeclaimsToCSV(data);
            }

            writeFileSync(filePath, csvContent, 'utf-8');
            console.log(chalk.green(`✓ Data exported to ${filePath}`));
        } catch (error) {
            console.error(chalk.red('Error exporting to CSV:'), error);
        }
    }

    /**
     * Convert snapshots to CSV format
     */
    private snapshotsToCSV(snapshots: AnalyticsSnapshot[]): string {
        const headers = [
            'Timestamp',
            'Position',
            'Pool',
            'Token X Amount',
            'Token Y Amount',
            'USD Value',
            'Fees X',
            'Fees Y',
            'Fees USD',
            'Active Bin',
            'In Range',
            'Pool APR',
            'Gas Cost USD',
            'Time In Range %',
        ];

        const rows = snapshots.map(s => [
            new Date(s.timestamp).toISOString(),
            s.positionAddress.slice(0, 8) + '...',
            s.poolAddress.slice(0, 8) + '...',
            s.tokenXAmount.toFixed(6),
            s.tokenYAmount.toFixed(2),
            s.usdValue.toFixed(2),
            s.feesXAmount.toFixed(8),
            s.feesYAmount.toFixed(2),
            s.feesUsdValue.toFixed(2),
            s.activeBinId,
            s.inRange ? 'Yes' : 'No',
            s.poolApr.toFixed(2),
            s.gasCostUsd.toFixed(4),
            s.timeInRangePercent.toFixed(1),
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    /**
     * Convert rebalances to CSV format
     */
    private rebalancesToCSV(entries: RebalanceHistoryEntry[]): string {
        const headers = [
            'Timestamp',
            'Old Position',
            'New Position',
            'Pool',
            'Reason',
            'Fees Claimed X',
            'Fees Claimed Y',
            'Fees Claimed USD',
            'TX Cost USD',
            'Old Range',
            'New Range',
        ];

        const rows = entries.map(e => [
            new Date(e.timestamp).toISOString(),
            e.oldPositionAddress.slice(0, 8) + '...',
            e.newPositionAddress.slice(0, 8) + '...',
            e.poolAddress.slice(0, 8) + '...',
            e.reason,
            e.feesClaimedX.toFixed(8),
            e.feesClaimedY.toFixed(2),
            e.feesClaimedUsd.toFixed(2),
            e.transactionCostUsd.toFixed(4),
            `${e.oldRange.min} to ${e.oldRange.max}`,
            `${e.newRange.min} to ${e.newRange.max}`,
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    /**
     * Convert fee claims to CSV format
     */
    private feeclaimsToCSV(records: FeeClaimRecord[]): string {
        const headers = [
            'Timestamp',
            'Position',
            'Pool',
            'Claimed X',
            'Claimed Y',
            'Claimed USD',
            'TX Cost USD',
            'Method',
        ];

        const rows = records.map(r => [
            new Date(r.timestamp).toISOString(),
            r.positionAddress.slice(0, 8) + '...',
            r.poolAddress.slice(0, 8) + '...',
            r.claimedX.toFixed(8),
            r.claimedY.toFixed(2),
            r.claimedUsd.toFixed(2),
            r.transactionCostUsd.toFixed(4),
            r.method,
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    /**
     * Clear old data (older than specified days)
     */
    clearOldData(days: number = 90): void {
        try {
            const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

            const snapshots = this.loadSnapshots();
            const filtered = snapshots.filter(s => s.timestamp >= cutoffTime);
            writeFileSync(this.snapshotsFile, JSON.stringify(filtered, null, 2));

            console.log(chalk.green(`✓ Cleared analytics data older than ${days} days`));
        } catch (error) {
            console.error(chalk.red('Error clearing old data:'), error);
        }
    }

    /**
     * Record volume snapshot for a pool
     */
    recordVolumeSnapshot(snapshot: VolumeSnapshot): void {
        try {
            const poolFile = join(this.dataDir, `volume-${snapshot.poolAddress}.json`);

            let snapshots: VolumeSnapshot[] = [];
            if (existsSync(poolFile)) {
                const data = readFileSync(poolFile, 'utf-8');
                snapshots = JSON.parse(data) || [];
            }

            snapshots.push(snapshot);

            // Keep 7 days
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const filtered = snapshots.filter(s => s.timestamp >= sevenDaysAgo);

            writeFileSync(poolFile, JSON.stringify(filtered, null, 2));
        } catch (error) {
            console.warn('Error recording volume snapshot:', error);
        }
    }

    /**
     * Load volume snapshots for a pool
     */
    loadVolumeSnapshots(poolAddress: string, days = 7): VolumeSnapshot[] {
        try {
            const poolFile = join(this.dataDir, `volume-${poolAddress}.json`);
            if (!existsSync(poolFile)) return [];

            const data = readFileSync(poolFile, 'utf-8');
            const all = JSON.parse(data) || [];

            const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
            return all.filter((s: VolumeSnapshot) => s.timestamp >= cutoff);
        } catch {
            return [];
        }
    }

    /**
     * Get volume trend for a pool
     */
    getVolumeTrend(poolAddress: string): 'increasing' | 'decreasing' | 'stable' {
        const snapshots = this.loadVolumeSnapshots(poolAddress, 7);
        return getVolumeTrend(snapshots);
    }

    /**
     * Record an LLM decision for learning
     */
    recordLLMDecision(log: any): void {
        try {
            const llmDecisionsFile = join(this.dataDir, 'llm-decisions.json');
            const decisions = this.loadLLMDecisions();
            decisions.push(log);

            // Keep 90 days
            const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
            const filtered = decisions.filter((d: any) => d.timestamp >= ninetyDaysAgo);

            writeFileSync(llmDecisionsFile, JSON.stringify(filtered, null, 2));
        } catch (error) {
            console.error(chalk.red('Error recording LLM decision:'), error);
        }
    }

    /**
     * Load all LLM decisions
     */
    loadLLMDecisions(): any[] {
        try {
            const llmDecisionsFile = join(this.dataDir, 'llm-decisions.json');
            if (!existsSync(llmDecisionsFile)) return [];
            const data = readFileSync(llmDecisionsFile, 'utf-8');
            return JSON.parse(data) || [];
        } catch {
            return [];
        }
    }
}

// Singleton helpers
let analyticsDataStoreInstance: AnalyticsDataStore | null = null;
let analyticsDataDir: string | undefined;

export function getAnalyticsDataStore(dataDir?: string): AnalyticsDataStore {
    if (!analyticsDataStoreInstance || (dataDir && dataDir !== analyticsDataDir)) {
        analyticsDataDir = dataDir;
        analyticsDataStoreInstance = new AnalyticsDataStore(dataDir);
    }

    return analyticsDataStoreInstance;
}

export const analyticsDataStore = getAnalyticsDataStore();
