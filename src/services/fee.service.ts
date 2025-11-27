import { PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { walletService } from './wallet.service';
import { poolService } from './pool.service';
import { connectionService } from './connection.service';
import { PoolInfo } from '../config/types';
import { oracleService } from './oracle.service';
import { analyticsDataStore } from './analyticsDataStore.service';

type PriceSource = 'oracle' | 'pool-derived' | 'missing';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const DEFAULT_CLAIM_TX_COST_SOL = 0.00025;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = 750;

export interface FeeClaimSummary {
    positionAddress: string;
    poolAddress: string;
    method: 'manual' | 'auto';
    claimedX: number;
    claimedY: number;
    claimedUsd: number;
    tokenXSymbol: string;
    tokenYSymbol: string;
    tokenXDecimals: number;
    tokenYDecimals: number;
    tokenXMint: string;
    tokenYMint: string;
    usdPriceSources: Record<'tokenX' | 'tokenY', PriceSource>;
    usdPrices: Record<'tokenX' | 'tokenY', number | null>;
    estimatedTxCostSol: number;
    estimatedTxCostUsd: number | null;
    signatures: string[];
    recordedAt: number;
}

export interface ClaimFeesOptions {
    method?: 'manual' | 'auto';
}

export interface BatchClaimRequest {
    poolAddress: string;
    positionAddress: string;
    method?: 'manual' | 'auto';
    maxRetries?: number;
}

export interface BatchClaimOutcome {
    poolAddress: string;
    positionAddress: string;
    success: boolean;
    attempts: number;
    summary?: FeeClaimSummary;
    error?: string;
}

export interface PositionCostAnalysis {
  rentCostSOL: number;
  transactionFeesSOL: number;
  totalInitialCostSOL: number;
  tokenXAmount: number;
  tokenYAmount: number;
  tokenXValueUSD: number;
  tokenYValueUSD: number;
  totalValueUSD: number;
    tokenXUsdPrice: number | null;
    tokenYUsdPrice: number | null;
    usdPriceSources: Record<'tokenX' | 'tokenY', PriceSource>;
    hasFullOracleCoverage: boolean;
    isUsdEstimate: boolean;
    usdValuationWarnings: string[];
  estimatedDailyAPY: number;
  estimatedWeeklyAPY: number;
  estimatedMonthlyAPY: number;
  estimatedAnnualAPY: number;
}

export class FeeService {
    private async safeGetPoolInfo(poolAddress: string): Promise<PoolInfo | null> {
        try {
            return await poolService.getPoolInfo(poolAddress);
        } catch (error) {
            console.warn(`Pool metadata unavailable for ${poolAddress}:`, error);
            return null;
        }
    }

    private extractDecimals(tokenMeta: any): number | undefined {
        if (!tokenMeta) {
            return undefined;
        }
        if (typeof tokenMeta.decimals === 'number') {
            return tokenMeta.decimals;
        }
        if (typeof tokenMeta?.mint?.decimals === 'number') {
            return tokenMeta.mint.decimals;
        }
        if (typeof tokenMeta?.decimal === 'number') {
            return tokenMeta.decimal;
        }
        return undefined;
    }

    private extractMint(tokenMeta: any): string {
        if (!tokenMeta) {
            return '';
        }
        if (typeof tokenMeta.address === 'string') {
            return tokenMeta.address;
        }
        if (typeof tokenMeta?.mint?.toBase58 === 'function') {
            return tokenMeta.mint.toBase58();
        }
        if (typeof tokenMeta?.mint?.publicKey?.toBase58 === 'function') {
            return tokenMeta.mint.publicKey.toBase58();
        }
        if (typeof tokenMeta?.mint === 'string') {
            return tokenMeta.mint;
        }
        if (typeof tokenMeta?.publicKey?.toBase58 === 'function') {
            return tokenMeta.publicKey.toBase58();
        }
        return '';
    }

    private extractSymbol(tokenMeta: any): string | undefined {
        if (!tokenMeta) {
            return undefined;
        }
        if (typeof tokenMeta.symbol === 'string') {
            return tokenMeta.symbol;
        }
        if (typeof tokenMeta?.mint?.symbol === 'string') {
            return tokenMeta.mint.symbol;
        }
        return undefined;
    }

    private extractFeeAmount(position: any, field: 'feeX' | 'feeY'): number {
        const data = position?.positionData ?? position;
        if (!data) {
            return 0;
        }
        let raw: any = data[field];
        if (raw === undefined && data.unclaimedFeeX && field === 'feeX') {
            raw = data.unclaimedFeeX;
        }
        if (raw === undefined && data.unclaimedFeeY && field === 'feeY') {
            raw = data.unclaimedFeeY;
        }
        if (raw === undefined && data?.positionData?.[field]) {
            raw = data.positionData[field];
        }
        if (!raw) {
            return 0;
        }
        if (BN.isBN(raw)) {
            return raw.toNumber();
        }
        if (typeof raw === 'string') {
            return Number(raw);
        }
        if (typeof raw === 'number') {
            return raw;
        }
        if (typeof raw.toNumber === 'function') {
            return raw.toNumber();
        }
        return 0;
    }

    private deriveUsdBreakdown(params: {
        tokenXMint: string;
        tokenYMint: string;
        tokenXPrice: number | null;
        tokenYPrice: number | null;
        poolPrice: number | null;
    }): {
        tokenXPrice: number | null;
        tokenYPrice: number | null;
        tokenXSource: PriceSource;
        tokenYSource: PriceSource;
    } {
        let { tokenXPrice, tokenYPrice } = params;
        const sources: Record<'tokenX' | 'tokenY', PriceSource> = {
            tokenX: tokenXPrice ? 'oracle' : 'missing',
            tokenY: tokenYPrice ? 'oracle' : 'missing',
        };

        if (!tokenXPrice && tokenYPrice && params.poolPrice) {
            tokenXPrice = params.poolPrice * tokenYPrice;
            sources.tokenX = 'pool-derived';
        }
        if (!tokenYPrice && tokenXPrice && params.poolPrice) {
            tokenYPrice = params.poolPrice !== 0 ? tokenXPrice / params.poolPrice : null;
            if (tokenYPrice !== null) {
                sources.tokenY = 'pool-derived';
            }
        }

        return {
            tokenXPrice: tokenXPrice ?? null,
            tokenYPrice: tokenYPrice ?? null,
            tokenXSource: sources.tokenX,
            tokenYSource: sources.tokenY,
        };
    }

    private recordFeeClaim(summary: FeeClaimSummary): void {
        try {
            analyticsDataStore.recordFeeClaim({
                timestamp: summary.recordedAt,
                positionAddress: summary.positionAddress,
                poolAddress: summary.poolAddress,
                claimedX: summary.claimedX,
                claimedY: summary.claimedY,
                claimedUsd: summary.claimedUsd,
                transactionCostUsd: summary.estimatedTxCostUsd ?? 0,
                method: summary.method,
                signature: summary.signatures[summary.signatures.length - 1],
            });
        } catch (error) {
            console.warn('Failed to record fee claim analytics:', error);
        }
    }

    private async delay(ms: number): Promise<void> {
        if (ms <= 0) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
    
    /**
     * Claim all fees and rewards for all positions in a specific pool
     */
    public async claimAllFees(poolAddress: string): Promise<BatchClaimOutcome[]> {
        try {
            const keypair = walletService.getActiveKeypair();
            if (!keypair) throw new Error('No active wallet found');

            const dlmm = await poolService.getDlmmInstance(poolAddress);
            const { userPositions } = await dlmm.getPositionsByUserAndLbPair(keypair.publicKey);

            if (userPositions.length === 0) {
                return [];
            }

            const requests: BatchClaimRequest[] = userPositions.map((pos) => ({
                poolAddress,
                positionAddress: pos.publicKey.toBase58(),
            }));

            return this.claimFeesBatch(requests);

        } catch (error) {
            console.error('Error claiming all fees:', error);
            throw error;
        }
    }

    /**
     * Claim fees for a specific position
     */
    public async claimFeesForPosition(
        poolAddress: string,
        positionPubKey: PublicKey,
        options?: ClaimFeesOptions
    ): Promise<FeeClaimSummary> {
        try {
            const keypair = walletService.getActiveKeypair();
            if (!keypair) throw new Error('No active wallet found');

            const method = options?.method ?? 'manual';
            const dlmm = await poolService.getDlmmInstance(poolAddress);
            const position = await dlmm.getPosition(positionPubKey);
            const poolInfo = await this.safeGetPoolInfo(poolAddress);

            const tokenXDecimals = poolInfo?.tokenX.decimals ?? this.extractDecimals(dlmm.tokenX) ?? 6;
            const tokenYDecimals = poolInfo?.tokenY.decimals ?? this.extractDecimals(dlmm.tokenY) ?? 6;
            const tokenXMint = poolInfo?.tokenX.mint ?? this.extractMint(dlmm.tokenX);
            const tokenYMint = poolInfo?.tokenY.mint ?? this.extractMint(dlmm.tokenY);
            const tokenXSymbol = poolInfo?.tokenX.symbol ?? this.extractSymbol(dlmm.tokenX) ?? 'Token X';
            const tokenYSymbol = poolInfo?.tokenY.symbol ?? this.extractSymbol(dlmm.tokenY) ?? 'Token Y';

            const feeXAmount = this.extractFeeAmount(position, 'feeX');
            const feeYAmount = this.extractFeeAmount(position, 'feeY');
            const claimedX = feeXAmount / Math.pow(10, tokenXDecimals);
            const claimedY = feeYAmount / Math.pow(10, tokenYDecimals);

            const priceMap = await oracleService.getUsdPrices(
                [tokenXMint, tokenYMint, SOL_MINT].filter((mint) => !!mint)
            );

            const poolPrice = poolInfo?.price && poolInfo.price > 0 ? poolInfo.price : null;
            const usdBreakdown = this.deriveUsdBreakdown({
                tokenXMint,
                tokenYMint,
                tokenXPrice: priceMap.get(tokenXMint) ?? null,
                tokenYPrice: priceMap.get(tokenYMint) ?? null,
                poolPrice,
            });

            const claimedUsd = (claimedX * (usdBreakdown.tokenXPrice ?? 0)) +
                (claimedY * (usdBreakdown.tokenYPrice ?? 0));

            const txs = await dlmm.claimAllRewardsByPosition({
                owner: keypair.publicKey,
                position,
            });

            const connection = connectionService.getConnection();
            const signatures: string[] = [];
            for (const tx of txs) {
                const sig = await sendAndConfirmTransaction(
                    connection,
                    tx,
                    [keypair],
                    { commitment: 'confirmed' }
                );
                signatures.push(sig);
            }

            const estimatedTxCostSol = txs.length * DEFAULT_CLAIM_TX_COST_SOL;
            const solUsd = priceMap.get(SOL_MINT) ?? null;
            const estimatedTxCostUsd = solUsd ? estimatedTxCostSol * solUsd : null;

            const summary: FeeClaimSummary = {
                positionAddress: positionPubKey.toBase58(),
                poolAddress,
                method,
                claimedX,
                claimedY,
                claimedUsd,
                tokenXSymbol,
                tokenYSymbol,
                tokenXDecimals,
                tokenYDecimals,
                tokenXMint,
                tokenYMint,
                usdPriceSources: {
                    tokenX: usdBreakdown.tokenXSource,
                    tokenY: usdBreakdown.tokenYSource,
                },
                usdPrices: {
                    tokenX: usdBreakdown.tokenXPrice,
                    tokenY: usdBreakdown.tokenYPrice,
                },
                estimatedTxCostSol,
                estimatedTxCostUsd,
                signatures,
                recordedAt: Date.now(),
            };

            this.recordFeeClaim(summary);
            return summary;

        } catch (error) {
            console.error('Error claiming fees for position:', error);
            throw error;
        }
    }

    public async claimFeesBatch(requests: BatchClaimRequest[]): Promise<BatchClaimOutcome[]> {
        const outcomes: BatchClaimOutcome[] = [];

        for (const request of requests) {
            const positionAddress = request.positionAddress;
            const poolAddress = request.poolAddress;
            const maxRetries = request.maxRetries ?? DEFAULT_MAX_RETRIES;
            let attempts = 0;
            let summary: FeeClaimSummary | undefined;
            let lastError: any = null;

            while (attempts <= maxRetries) {
                attempts += 1;
                try {
                    summary = await this.claimFeesForPosition(
                        poolAddress,
                        new PublicKey(positionAddress),
                        { method: request.method }
                    );
                    break;
                } catch (error) {
                    lastError = error;
                    if (attempts > maxRetries) {
                        break;
                    }
                    await this.delay(RETRY_BACKOFF_MS * attempts);
                }
            }

            if (summary) {
                outcomes.push({
                    poolAddress,
                    positionAddress,
                    success: true,
                    attempts,
                    summary,
                });
            } else {
                outcomes.push({
                    poolAddress,
                    positionAddress,
                    success: false,
                    attempts,
                    error: lastError instanceof Error ? lastError.message : String(lastError),
                });
            }
        }

        return outcomes;
    }

    public async estimateClaimCost(positionCount: number): Promise<{ totalSol: number; totalUsd: number | null }> {
        const totalSol = Math.max(positionCount, 0) * DEFAULT_CLAIM_TX_COST_SOL;
        const priceMap = await oracleService.getUsdPrices([SOL_MINT]);
        const solUsd = priceMap.get(SOL_MINT) ?? null;
        return {
            totalSol,
            totalUsd: solUsd ? totalSol * solUsd : null,
        };
    }

    /**
     * Calculate estimated costs and APR for a new position
     */
    public async analyzePositionCosts(
        poolInfo: PoolInfo,
        tokenXAmount: number,
        tokenYAmount: number
    ): Promise<PositionCostAnalysis> {
        try {
            // Rent cost for position account (0.06 SOL typical)
            const rentCostSOL = 0.06;
            
            // Transaction fees (0.0001 SOL per transaction, with room for 2-3 txs)
            const transactionFeesSOL = 0.00025;
            
            const totalInitialCostSOL = rentCostSOL + transactionFeesSOL;

            const tokenXMint = poolInfo.tokenX.mint;
            const tokenYMint = poolInfo.tokenY.mint;
            const usdPrices = await oracleService.getUsdPrices([tokenXMint, tokenYMint]);

            let tokenXUsdPrice = usdPrices.get(tokenXMint) ?? null;
            let tokenYUsdPrice = usdPrices.get(tokenYMint) ?? null;
            const priceSources: Record<'tokenX' | 'tokenY', PriceSource> = {
                tokenX: tokenXUsdPrice !== null ? 'oracle' : 'missing',
                tokenY: tokenYUsdPrice !== null ? 'oracle' : 'missing',
            };
            const valuationWarnings: string[] = [];
            const poolPrice = poolInfo.price && poolInfo.price > 0 ? poolInfo.price : null;

            if (!tokenXUsdPrice && tokenYUsdPrice && poolPrice) {
                tokenXUsdPrice = poolPrice * tokenYUsdPrice;
                priceSources.tokenX = 'pool-derived';
            }

            if (!tokenYUsdPrice && tokenXUsdPrice && poolPrice) {
                tokenYUsdPrice = poolPrice !== 0 ? tokenXUsdPrice / poolPrice : null;
                priceSources.tokenY = tokenYUsdPrice ? 'pool-derived' : 'missing';
            }

            if (!tokenXUsdPrice) {
                valuationWarnings.push(`Missing USD quote for ${poolInfo.tokenX.symbol}. Value may be understated.`);
            } else if (priceSources.tokenX !== 'oracle') {
                valuationWarnings.push(`Using derived price for ${poolInfo.tokenX.symbol}; oracle unavailable.`);
            }

            if (!tokenYUsdPrice) {
                valuationWarnings.push(`Missing USD quote for ${poolInfo.tokenY.symbol}. Value may be understated.`);
            } else if (priceSources.tokenY !== 'oracle') {
                valuationWarnings.push(`Using derived price for ${poolInfo.tokenY.symbol}; oracle unavailable.`);
            }

            const hasFullOracleCoverage = priceSources.tokenX === 'oracle' && priceSources.tokenY === 'oracle';
            const isUsdEstimate = !hasFullOracleCoverage;

            const tokenXValueUSD = tokenXUsdPrice ? tokenXAmount * tokenXUsdPrice : 0;
            const tokenYValueUSD = tokenYUsdPrice ? tokenYAmount * tokenYUsdPrice : 0;
            const totalValueUSD = tokenXValueUSD + tokenYValueUSD;

            // Use pool APR if available, otherwise estimate based on pool metrics
            const baseAPR = poolInfo.apr || 12; // Default 12% annual if not provided
            
            // Calculate different time-based APR breakdowns
            const estimatedDailyAPY = baseAPR / 365;
            const estimatedWeeklyAPY = baseAPR / 52;
            const estimatedMonthlyAPY = baseAPR / 12;
            const estimatedAnnualAPY = baseAPR;

            return {
                rentCostSOL,
                transactionFeesSOL,
                totalInitialCostSOL,
                tokenXAmount,
                tokenYAmount,
                tokenXValueUSD,
                tokenYValueUSD,
                totalValueUSD,
                tokenXUsdPrice,
                tokenYUsdPrice,
                usdPriceSources: priceSources,
                hasFullOracleCoverage,
                isUsdEstimate,
                usdValuationWarnings: valuationWarnings,
                estimatedDailyAPY,
                estimatedWeeklyAPY,
                estimatedMonthlyAPY,
                estimatedAnnualAPY,
            };
        } catch (error) {
            console.error('Error analyzing position costs:', error);
            throw new Error(`Failed to analyze costs: ${error}`);
        }
    }
}

export const feeService = new FeeService();

