import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { StrategyType } from '@meteora-ag/dlmm';
import { feeService, FeeClaimSummary } from './fee.service';
import { liquidityService } from './liquidity.service';
import { poolService } from './pool.service';
import { configManager } from '../config/config.manager';
import { DEFAULT_CONFIG } from '../config/constants';

export interface CompoundFeesParams {
    poolAddress: string;
    positionAddress: string;
    compoundPercent?: number;
    tokenPercentOverrides?: {
        tokenXPercent: number;
        tokenYPercent: number;
    };
    method?: 'manual' | 'auto';
    slippage?: number;
    strategyOverride?: StrategyType;
}

export interface CompoundFeesResult {
    claimed: FeeClaimSummary;
    compounded: boolean;
    reinvestedX: number;
    reinvestedY: number;
    compoundPercentUsed: number;
    addLiquiditySignature?: string;
    skippedReason?: string;
}

class CompoundingService {
    public async claimAndCompound(params: CompoundFeesParams): Promise<CompoundFeesResult> {
        const positionPubKey = new PublicKey(params.positionAddress);
        const claimed = await feeService.claimFeesForPosition(
            params.poolAddress,
            positionPubKey,
            { method: params.method }
        );

        const basePercent = this.normalizePercent(params.compoundPercent ?? 100);
        const xPercent = this.normalizePercent(
            params.tokenPercentOverrides?.tokenXPercent ?? basePercent * 100
        );
        const yPercent = this.normalizePercent(
            params.tokenPercentOverrides?.tokenYPercent ?? basePercent * 100
        );

        const reinvestedX = claimed.claimedX * xPercent;
        const reinvestedY = claimed.claimedY * yPercent;

        const compoundPercentUsed = Math.max(xPercent, yPercent) * 100;

        if (reinvestedX <= 0 && reinvestedY <= 0) {
            return {
                claimed,
                compounded: false,
                reinvestedX,
                reinvestedY,
                compoundPercentUsed,
                skippedReason: 'No fees available to compound.',
            };
        }

        if (reinvestedX <= 0 || reinvestedY <= 0) {
            return {
                claimed,
                compounded: false,
                reinvestedX,
                reinvestedY,
                compoundPercentUsed,
                skippedReason: 'Compounding requires both tokens; run a swap or adjust ratio.',
            };
        }

        const amountX = this.amountToBN(reinvestedX, claimed.tokenXDecimals);
        const amountY = this.amountToBN(reinvestedY, claimed.tokenYDecimals);

        if (amountX.isZero() || amountY.isZero()) {
            return {
                claimed,
                compounded: false,
                reinvestedX,
                reinvestedY,
                compoundPercentUsed,
                skippedReason: 'Claimed amounts are below the minimum precision to redeposit.',
            };
        }

        const strategyType = await this.resolveStrategyType(
            params.poolAddress,
            positionPubKey,
            params.strategyOverride
        );

        const slippage = params.slippage ??
            configManager.getConfig().transaction?.slippage ??
            DEFAULT_CONFIG.SLIPPAGE;

        const signature = await liquidityService.addLiquidity({
            positionPubKey,
            poolAddress: params.poolAddress,
            amountX,
            amountY,
            strategyType,
            slippage,
        });

        return {
            claimed,
            compounded: true,
            reinvestedX,
            reinvestedY,
            compoundPercentUsed,
            addLiquiditySignature: signature,
        };
    }

    private async resolveStrategyType(
        poolAddress: string,
        positionPubKey: PublicKey,
        override?: StrategyType
    ): Promise<StrategyType> {
        if (override !== undefined) {
            return override;
        }
        try {
            const dlmm = await poolService.getDlmmInstance(poolAddress);
            const position = await dlmm.getPosition(positionPubKey);
            const rawStrategy = (position as any)?.positionData?.strategyType ?? (position as any)?.strategyType;

            if (typeof rawStrategy === 'number' && StrategyType[rawStrategy] !== undefined) {
                return rawStrategy as StrategyType;
            }
            if (typeof rawStrategy === 'string') {
                const mapped = (StrategyType as any)[rawStrategy];
                if (typeof mapped === 'number') {
                    return mapped as StrategyType;
                }
            }
        } catch (error) {
            console.warn('Unable to determine strategy type for compounding:', error);
        }
        return StrategyType.Spot;
    }

    private normalizePercent(value: number, fallback?: number): number {
        const resolved = Number.isFinite(value) ? value : fallback ?? 100;
        return Math.min(1, Math.max(0, resolved / 100));
    }

    private amountToBN(amount: number, decimals: number): BN {
        const scale = Math.pow(10, decimals);
        const scaled = Math.floor(amount * scale);
        return new BN(Math.max(scaled, 0));
    }
}

export const compoundingService = new CompoundingService();
