import { BN } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';
import chalk from 'chalk';

import { positionService, UserPosition } from './position.service';
import { poolService } from './pool.service';
import { liquidityService } from './liquidity.service';
import { walletService } from './wallet.service';
import { getAnalyticsDataStore, RebalanceHistoryEntry } from './analyticsDataStore.service';
import { volumeCache } from './meteoraVolume.service';
import { PoolInfo, CreatePositionParams } from '../config/types';

const analyticsStore = getAnalyticsDataStore();

export interface RebalanceAnalysis {
    shouldRebalance: boolean;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    reason: string;
    currentBinsActive: number;
    currentInRange: boolean;
    distanceFromCenter: number;
    projectedDailyFeeIncrease: number;
    rebalanceCost: number;
    breakEvenHours: number;
    recommendation: string;
    currentDailyFees: number;
    projectedDailyFees: number;
}

export interface CostBenefitAnalysis {
    currentDailyFees: number;
    projectedDailyFees: number;
    netDailyGain: number;
    rebalanceCostUsd: number;
    breakEvenHours: number;
    breakEvenLabel: string;
}

export interface RebalanceResult {
    success: boolean;
    oldPositionAddress: string;
    newPositionAddress: string;
    feesClaimed: {
        x: BN;
        y: BN;
        usdValue: number;
    };
    transactionCost: number;
    timestamp: number;
    signature?: string;
    transactions?: string[];
    oldRange?: { minBinId: number; maxBinId: number };
    newRange?: { minBinId: number; maxBinId: number };
}

export interface RebalanceExecutionOptions {
    binsPerSide?: number;
    slippageBps?: number;
    strategy?: 'Spot' | 'Curve' | 'BidAsk';
    reasonCode?: RebalanceHistoryEntry['reasonCode'];
    reason?: string;
}

export class RebalancingService {
    constructor(private connection: Connection) {}

    /**
     * Analyze if a position needs rebalancing
     */
    async analyzeRebalanceNeeded(
        position: UserPosition,
        poolInfo?: PoolInfo
    ): Promise<RebalanceAnalysis> {
        try {
            if (!position) {
                throw new Error('Position data is required for analysis');
            }

            const resolvedPoolInfo = poolInfo ?? (await poolService.getPoolInfo(position.poolAddress));
            const dlmmPool = await DLMM.create(this.connection, new PublicKey(position.poolAddress));
            const activeBin = await dlmmPool.getActiveBin();

            const minBinId = position.lowerBinId;
            const maxBinId = position.upperBinId;
            const activeBinId = activeBin.binId;

            // Check if in range
            const inRange = activeBinId >= minBinId && activeBinId <= maxBinId;
            const centerBin = Math.floor((minBinId + maxBinId) / 2);
            const distanceFromCenter = Math.abs(activeBinId - centerBin);

            // Calculate bins active (simplified: assume uniform distribution)
            const totalBins = maxBinId - minBinId + 1;
            const binsActive = inRange ? totalBins : 0;
            const percentActive = inRange ? (binsActive / totalBins) * 100 : 0;

            // Determine priority
            let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' = 'NONE';
            let reason = '';

            if (!inRange) {
                priority = 'CRITICAL';
                reason = 'Position completely out of range - not earning fees';
            } else if (binsActive < totalBins * 0.4) {
                priority = 'HIGH';
                reason = 'Less than 40% of bins active - earning suboptimal fees';
            } else if (distanceFromCenter > 10) {
                priority = 'MEDIUM';
                reason = 'Price moved >10 bins from center - consider rebalancing';
            } else if (distanceFromCenter > 5) {
                priority = 'LOW';
                reason = 'Price drifting (5-10 bins from center) - monitor';
            }

            // Estimate fees
            const currentDailyFees = await this.estimateDailyFees(position, resolvedPoolInfo);
            const projectedDailyFees = await this.estimateProjectedDailyFees(currentDailyFees, position, resolvedPoolInfo);
            const dailyIncrease = projectedDailyFees - currentDailyFees;

            // Cost analysis
            const costUsd = await this.estimateRebalanceCost(position.publicKey);

            // Break-even calculation
            let breakEvenHours = Infinity;
            if (dailyIncrease > 0) {
                breakEvenHours = (costUsd / dailyIncrease) * 24;
            }

            // CRITICAL: Factor break-even time into the recommendation
            // Even if position is "MEDIUM" priority, if break-even is years, don't recommend rebalancing
            const breakEvenDays = breakEvenHours / 24;
            
            // Generate recommendation based on BOTH position status AND economic viability
            let recommendation = '';
            let shouldRebalance = false;
            
            if (priority === 'CRITICAL') {
                // Out of range - always recommend rebalancing (earning $0)
                recommendation = 'REBALANCE IMMEDIATELY - position not earning any fees';
                shouldRebalance = true;
            } else if (breakEvenDays > 365) {
                // Break-even over a year - not worth rebalancing regardless of position
                recommendation = `HOLD - Break-even time is ${Math.round(breakEvenDays)} days. The fee improvement doesn't justify the rebalance cost.`;
                shouldRebalance = false;
                // Downgrade priority since rebalancing isn't economically viable
                if (priority !== 'NONE') {
                    priority = 'LOW';
                }
            } else if (breakEvenDays > 30) {
                // Break-even over a month - cautious approach
                recommendation = `HOLD recommended - Break-even is ${Math.round(breakEvenDays)} days. Only rebalance if you plan to hold long-term.`;
                shouldRebalance = false;
            } else if (priority === 'HIGH') {
                if (breakEvenDays <= 7) {
                    recommendation = `REBALANCE recommended - Position at risk, break-even in ${Math.round(breakEvenDays)} days`;
                    shouldRebalance = true;
                } else {
                    recommendation = `Consider rebalancing - Position approaching edge but break-even is ${Math.round(breakEvenDays)} days`;
                    shouldRebalance = false;
                }
            } else if (priority === 'MEDIUM') {
                if (breakEvenDays <= 3) {
                    recommendation = `REBALANCE - Quick break-even (${Math.round(breakEvenHours)} hours) makes this worthwhile`;
                    shouldRebalance = true;
                } else if (breakEvenDays <= 14) {
                    recommendation = `Optional rebalance - Break-even in ${Math.round(breakEvenDays)} days. Worth it if you're actively managing.`;
                    shouldRebalance = false;
                } else {
                    recommendation = `HOLD - Position shifted but break-even (${Math.round(breakEvenDays)} days) doesn't justify action`;
                    shouldRebalance = false;
                }
            } else if (priority === 'LOW') {
                recommendation = 'HOLD - Position is healthy. Monitor for changes.';
                shouldRebalance = false;
            } else {
                recommendation = 'HOLD - Position is optimal. No action needed.';
                shouldRebalance = false;
            }

            return {
                shouldRebalance,
                priority,
                reason,
                currentBinsActive: Math.max(0, binsActive),
                currentInRange: inRange,
                distanceFromCenter,
                projectedDailyFeeIncrease: dailyIncrease,
                rebalanceCost: costUsd,
                breakEvenHours,
                recommendation,
                currentDailyFees,
                projectedDailyFees,
            };
        } catch (error) {
            console.error(`Error analyzing rebalance for position ${position.publicKey}:`, error);
            throw error;
        }
    }

    async costBenefitAnalysis(position: UserPosition, poolInfo?: PoolInfo): Promise<CostBenefitAnalysis> {
        const analysis = await this.analyzeRebalanceNeeded(position, poolInfo);

        const breakEvenLabel = analysis.breakEvenHours === Infinity
            ? 'N/A'
            : this.formatHours(analysis.breakEvenHours);

        return {
            currentDailyFees: analysis.currentDailyFees,
            projectedDailyFees: analysis.projectedDailyFees,
            netDailyGain: analysis.projectedDailyFeeIncrease,
            rebalanceCostUsd: analysis.rebalanceCost,
            breakEvenHours: analysis.breakEvenHours,
            breakEvenLabel,
        };
    }

    /**
     * Calculate priority level for rebalancing
     */
    calculateRebalancePriority(
        position: any,
        activeBinId: number
    ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
        const minBinId = position.minBinId;
        const maxBinId = position.maxBinId;
        const inRange = activeBinId >= minBinId && activeBinId <= maxBinId;

        if (!inRange) return 'CRITICAL';

        const distanceFromMin = activeBinId - minBinId;
        const distanceFromMax = maxBinId - activeBinId;
        const minDistance = Math.min(distanceFromMin, distanceFromMax);

        if (minDistance <= 5) return 'HIGH';
        if (minDistance <= 10) return 'MEDIUM';
        if (minDistance <= 15) return 'LOW';
        return 'NONE';
    }

    /**
     * Estimate current daily fees for a position based on actual pool data
     * Formula: (position_liquidity_share / total_pool_liquidity) * pool_fees_24h
     */
    private async estimateDailyFees(position: UserPosition, poolInfo?: PoolInfo): Promise<number> {
        try {
            // If position is out of range, it's earning $0
            if (!position.inRange) {
                return 0;
            }

            // Get pool volume data including fees_24h and total liquidity
            const volumeData = await volumeCache.getVolume(position.poolAddress);
            
            // Pool's actual 24-hour fees in USD
            const poolFees24h = volumeData.fees24h;
            const totalPoolLiquidity = volumeData.totalLiquidity;
            
            // If we have no fee data, fall back to APR-based estimate
            if (poolFees24h <= 0 || totalPoolLiquidity <= 0) {
                console.warn('No fee/liquidity data from API, falling back to APR estimate');
                return this.estimateDailyFeesFromApr(position, poolInfo);
            }
            
            // Get position's USD value as a proxy for its liquidity share
            const positionValueUsd = position.totalValueUSD || 0;
            
            if (positionValueUsd <= 0) {
                console.warn('Position has no USD value calculated');
                return 0;
            }
            
            // Calculate position's share of pool liquidity
            // positionShare = positionValue / totalPoolLiquidity
            const positionShare = positionValueUsd / totalPoolLiquidity;
            
            // Estimated daily fees = pool's 24h fees * position's share
            const estimatedDailyFees = poolFees24h * positionShare;
            
            return estimatedDailyFees;
        } catch (error) {
            console.warn('Could not estimate daily fees:', error);
            return 0;
        }
    }
    
    /**
     * Fallback: Estimate daily fees from APR when pool fee data is unavailable
     */
    private async estimateDailyFeesFromApr(position: UserPosition, poolInfo?: PoolInfo): Promise<number> {
        try {
            const resolvedPool = poolInfo ?? (await poolService.getPoolInfo(position.poolAddress));
            if (!resolvedPool) return 0;

            const apr = parseFloat(String(resolvedPool.apr || position.poolApr || '0')) / 100;
            const dailyRate = apr / 365;

            const totalUsd = position.totalValueUSD || 0;
            if (totalUsd <= 0) return 0;

            return totalUsd * dailyRate;
        } catch (error) {
            console.warn('APR fallback failed:', error);
            return 0;
        }
    }

    /**
     * Estimate projected daily fees after rebalance (centered position)
     * For out-of-range positions, estimate what they WOULD earn if in-range
     */
    private async estimateProjectedDailyFees(
        currentDailyFees: number, 
        position: UserPosition,
        poolInfo?: PoolInfo
    ): Promise<number> {
        try {
            // If position is already earning fees, a rebalance should improve by ~10-15%
            if (currentDailyFees > 0) {
                return currentDailyFees * 1.15; // 15% improvement from centering
            }
            
            // Position is out of range (earning $0) - estimate what it COULD earn
            // Calculate based on pool data as if position were in range
            const volumeData = await volumeCache.getVolume(position.poolAddress);
            const poolFees24h = volumeData.fees24h;
            const totalPoolLiquidity = volumeData.totalLiquidity;
            
            if (poolFees24h > 0 && totalPoolLiquidity > 0) {
                const positionValueUsd = position.totalValueUSD || 0;
                if (positionValueUsd > 0) {
                    const positionShare = positionValueUsd / totalPoolLiquidity;
                    return poolFees24h * positionShare;
                }
            }
            
            // Final fallback: use APR-based estimate
            const resolvedPool = poolInfo ?? (await poolService.getPoolInfo(position.poolAddress));
            if (resolvedPool) {
                const apr = parseFloat(String(resolvedPool.apr || position.poolApr || '0')) / 100;
                const dailyRate = apr / 365;
                const totalUsd = position.totalValueUSD || 0;
                if (totalUsd > 0) {
                    return totalUsd * dailyRate;
                }
            }
            
            return 0; // No data available
        } catch (error) {
            console.warn('Could not estimate projected fees:', error);
            return 0;
        }
    }

    /**
     * Execute a rebalance: remove old position and create new centered position
     */
    async executeRebalance(
        position: UserPosition,
        options?: RebalanceExecutionOptions
    ): Promise<RebalanceResult> {
        try {
            console.log(chalk.yellow('\n⏳ Starting rebalance process...\n'));

            const startTime = Date.now();
            const dlmmPool = await DLMM.create(this.connection, new PublicKey(position.poolAddress));
            const poolInfo = await poolService.getPoolInfo(position.poolAddress);
            if (!poolInfo) {
                throw new Error('Unable to load pool metadata for rebalance');
            }
            const activeBin = await dlmmPool.getActiveBin();

            const binsPerSide = Math.min(options?.binsPerSide ?? 12, 34);
            const newMinBinId = activeBin.binId - binsPerSide;
            const newMaxBinId = activeBin.binId + binsPerSide;
            const strategy = options?.strategy ?? 'Spot';
            const slippageBps = options?.slippageBps ?? 100;

            const keypair = walletService.getActiveKeypair();
            if (!keypair) {
                throw new Error('No active wallet selected for rebalance');
            }

            // Step 1: Remove liquidity and claim fees
            console.log(chalk.blue('Step 1/2: Removing liquidity and claiming fees...'));
            const removalSignatures = await liquidityService.removeLiquidity({
                positionPubKey: new PublicKey(position.publicKey),
                poolAddress: position.poolAddress,
                userPublicKey: keypair.publicKey,
                bps: 10000,
                shouldClaimAndClose: true,
            });

            removalSignatures.forEach(sig =>
                console.log(chalk.gray(`   • Removal tx: ${sig}`))
            );

            // Step 2: Prepare new position inputs
            console.log(chalk.blue('Step 2/2: Calculating new position parameters...'));

            const amountX = this.getTokenAmount(position.tokenX);
            const amountY = this.getTokenAmount(position.tokenY);

            const createParams: CreatePositionParams = {
                poolAddress: position.poolAddress,
                strategy,
                amountX,
                amountY,
                binsPerSide,
                minBinId: newMinBinId,
                maxBinId: newMaxBinId,
                slippage: slippageBps,
                centerBinOverride: activeBin.binId,
            };

            const prepared = await positionService.preparePositionCreation(createParams, poolInfo);
            const creation = await positionService.executePositionCreation(createParams, prepared);

            if (creation.status !== 'success') {
                throw new Error(creation.errorMessage || 'Failed to create new position');
            }

            const costUsd = await this.estimateRebalanceCost(position.publicKey);

            const claimedX = this.getFeeAmount(position.unclaimedFees?.x, position.unclaimedFees?.xUi, position.tokenX?.decimals);
            const claimedY = this.getFeeAmount(position.unclaimedFees?.y, position.unclaimedFees?.yUi, position.tokenY?.decimals);

            analyticsStore?.recordRebalance({
                timestamp: Date.now(),
                oldPositionAddress: position.publicKey,
                newPositionAddress: creation.positionAddress,
                poolAddress: position.poolAddress,
                reasonCode: options?.reasonCode ?? 'MANUAL',
                reason: options?.reason ?? 'Manual rebalance via CLI',
                feesClaimedX: claimedX,
                feesClaimedY: claimedY,
                feesClaimedUsd: position.unclaimedFees?.usdValue ?? 0,
                transactionCostUsd: costUsd,
                oldRange: { min: position.lowerBinId, max: position.upperBinId },
                newRange: { min: newMinBinId, max: newMaxBinId },
                signature: creation.depositSignature,
            });

            const result: RebalanceResult = {
                success: true,
                oldPositionAddress: position.publicKey,
                newPositionAddress: creation.positionAddress,
                feesClaimed: {
                    x: new BN(position.unclaimedFees.x || '0'),
                    y: new BN(position.unclaimedFees.y || '0'),
                    usdValue: position.unclaimedFees.usdValue ?? 0,
                },
                transactionCost: costUsd,
                timestamp: Date.now(),
                signature: creation.depositSignature,
                transactions: [...removalSignatures, creation.depositSignature].filter(Boolean),
                oldRange: { minBinId: position.lowerBinId, maxBinId: position.upperBinId },
                newRange: { minBinId: newMinBinId, maxBinId: newMaxBinId },
            };

            console.log(chalk.green('Rebalance completed successfully'));
            return result;
        } catch (error) {
            console.error(chalk.red('Error executing rebalance:'), error);
            throw error;
        }
    }

    /**
     * Estimate the cost of rebalancing
     */
    async estimateRebalanceCost(positionAddress: string): Promise<number> {
        // Transaction costs on Solana: ~0.0001-0.0002 SOL per tx
        // Two transactions: remove + create new position
        const costSOL = 0.0002;
        const solPrice = 140; // Approximate current SOL price
        return costSOL * solPrice;
    }

    /**
     * Calculate fee projection based on bins active
     */
    calculateFeeProjection(currentDailyFeeUsd: number, binsActivePercent: number): {
        current: number;
        projected: number;
        increase: number;
    } {
        const optimizedRate = 1.0; // 100% of bins active
        const projectedDaily = currentDailyFeeUsd * (optimizedRate / (binsActivePercent / 100));

        return {
            current: currentDailyFeeUsd,
            projected: projectedDaily,
            increase: projectedDaily - currentDailyFeeUsd,
        };
    }

    private getFeeAmount(rawAmount?: string, uiAmount?: number, decimals: number = 6): number {
        if (typeof uiAmount === 'number') {
            return uiAmount;
        }

        if (!rawAmount) {
            return 0;
        }

        return Number(rawAmount) / Math.pow(10, decimals);
    }

    private getTokenAmount(token: UserPosition['tokenX'] | { x?: string; amount?: string; xUi?: number; uiAmount?: number; decimals?: number }): number {
        if (!token) {
            return 0;
        }

        if ('uiAmount' in token && typeof token.uiAmount === 'number') {
            return token.uiAmount;
        }

        if ('xUi' in token && typeof token.xUi === 'number') {
            return token.xUi;
        }

        const decimals = (token as any).decimals ?? 6;
        const rawAmount = (token as any).amount || (token as any).x || '0';
        return Number(rawAmount || 0) / Math.pow(10, decimals);
    }

    private formatHours(hours: number): string {
        if (!Number.isFinite(hours)) {
            return 'N/A';
        }
        if (hours < 1) {
            return `${Math.round(hours * 60)}m`;
        }
        if (hours > 48) {
            return `${(hours / 24).toFixed(1)}d`;
        }
        return `${hours.toFixed(1)}h`;
    }
}

// Singleton export
let rebalancingService: RebalancingService;

export function initRebalancingService(connection: Connection) {
    rebalancingService = new RebalancingService(connection);
    return rebalancingService;
}

export { rebalancingService };
