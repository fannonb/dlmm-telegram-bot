/**
 * Telegram Position Service
 * 
 * Wraps CLI position and fee services to work with Telegram user keypairs
 * instead of the global wallet service.
 */

import { Keypair, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import { poolService } from '../../services/pool.service';
import { connectionService } from '../../services/connection.service';
import { oracleService } from '../../services/oracle.service';
import { FeeClaimSummary } from '../../services/fee.service';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const DEFAULT_CLAIM_TX_COST_SOL = 0.00025;

type PriceSource = 'oracle' | 'pool-derived' | 'missing';

interface UsdBreakdown {
    tokenXPrice: number | null;
    tokenYPrice: number | null;
    tokenXSource: PriceSource;
    tokenYSource: PriceSource;
}

/**
 * Claim fees for a position using a specific keypair
 */
export async function claimFeesWithKeypair(
    poolAddress: string,
    positionPubKey: string,
    keypair: Keypair
): Promise<FeeClaimSummary> {
    try {
        const dlmm = await poolService.getDlmmInstance(poolAddress);
        const positionKey = new PublicKey(positionPubKey);
        const position = await dlmm.getPosition(positionKey);
        const poolInfo = await poolService.getPoolInfo(poolAddress).catch(() => null);

        // Extract token info
        const dlmmTokenX = dlmm.tokenX as any;
        const dlmmTokenY = dlmm.tokenY as any;
        
        const tokenXDecimals = poolInfo?.tokenX.decimals ?? dlmmTokenX?.mint?.decimals ?? dlmmTokenX?.decimal ?? 6;
        const tokenYDecimals = poolInfo?.tokenY.decimals ?? dlmmTokenY?.mint?.decimals ?? dlmmTokenY?.decimal ?? 6;
        const tokenXMint = poolInfo?.tokenX.mint ?? extractMint(dlmmTokenX);
        const tokenYMint = poolInfo?.tokenY.mint ?? extractMint(dlmmTokenY);
        const tokenXSymbol = poolInfo?.tokenX.symbol ?? extractSymbol(dlmmTokenX) ?? 'Token X';
        const tokenYSymbol = poolInfo?.tokenY.symbol ?? extractSymbol(dlmmTokenY) ?? 'Token Y';

        // Extract fee amounts
        const feeXAmount = extractFeeAmount(position, 'feeX');
        const feeYAmount = extractFeeAmount(position, 'feeY');
        const claimedX = feeXAmount / Math.pow(10, tokenXDecimals);
        const claimedY = feeYAmount / Math.pow(10, tokenYDecimals);

        // Get prices
        const priceMap = await oracleService.getUsdPrices(
            [tokenXMint, tokenYMint, SOL_MINT].filter((mint) => !!mint)
        );

        const poolPrice = poolInfo?.price && poolInfo.price > 0 ? poolInfo.price : null;
        const usdBreakdown = deriveUsdBreakdown({
            tokenXMint,
            tokenYMint,
            tokenXPrice: priceMap.get(tokenXMint) ?? null,
            tokenYPrice: priceMap.get(tokenYMint) ?? null,
            poolPrice,
        });

        const claimedUsd = (claimedX * (usdBreakdown.tokenXPrice ?? 0)) +
            (claimedY * (usdBreakdown.tokenYPrice ?? 0));

        // Execute claim SWAP FEE transaction (not rewards)
        // claimSwapFee claims accumulated trading fees while retaining the position
        const txs = await dlmm.claimSwapFee({
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
            positionAddress: positionPubKey,
            poolAddress,
            method: 'manual',
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

        return summary;

    } catch (error) {
        console.error('Error claiming fees for position:', error);
        throw error;
    }
}

// Helper functions
function extractMint(tokenMeta: any): string {
    if (!tokenMeta) return '';
    if (typeof tokenMeta.address === 'string') return tokenMeta.address;
    if (typeof tokenMeta?.mint?.toBase58 === 'function') return tokenMeta.mint.toBase58();
    if (typeof tokenMeta?.mint?.publicKey?.toBase58 === 'function') return tokenMeta.mint.publicKey.toBase58();
    if (typeof tokenMeta?.mint === 'string') return tokenMeta.mint;
    if (typeof tokenMeta?.publicKey?.toBase58 === 'function') return tokenMeta.publicKey.toBase58();
    return '';
}

function extractSymbol(tokenMeta: any): string | undefined {
    if (!tokenMeta) return undefined;
    if (typeof tokenMeta.symbol === 'string') return tokenMeta.symbol;
    if (typeof tokenMeta?.mint?.symbol === 'string') return tokenMeta.mint.symbol;
    return undefined;
}

function extractFeeAmount(position: any, field: 'feeX' | 'feeY'): number {
    const data = position?.positionData ?? position;
    if (!data) return 0;
    
    let raw: any = data[field];
    if (raw === undefined && data.unclaimedFeeX && field === 'feeX') {
        raw = data.unclaimedFeeX;
    }
    if (raw === undefined && data.unclaimedFeeY && field === 'feeY') {
        raw = data.unclaimedFeeY;
    }
    
    if (raw === undefined || raw === null) return 0;
    if (typeof raw === 'number') return raw;
    if (typeof raw?.toNumber === 'function') return raw.toNumber();
    if (typeof raw.toString === 'function') return parseInt(raw.toString(), 10) || 0;
    return 0;
}

function deriveUsdBreakdown(params: {
    tokenXMint: string;
    tokenYMint: string;
    tokenXPrice: number | null;
    tokenYPrice: number | null;
    poolPrice: number | null;
}): UsdBreakdown {
    const { tokenXMint, tokenYMint, tokenXPrice, tokenYPrice, poolPrice } = params;
    
    let finalXPrice: number | null = tokenXPrice;
    let finalYPrice: number | null = tokenYPrice;
    let xSource: PriceSource = tokenXPrice !== null ? 'oracle' : 'missing';
    let ySource: PriceSource = tokenYPrice !== null ? 'oracle' : 'missing';
    
    // Try to derive missing price from pool price
    if (poolPrice && poolPrice > 0) {
        if (finalXPrice !== null && finalYPrice === null) {
            finalYPrice = finalXPrice / poolPrice;
            ySource = 'pool-derived';
        } else if (finalYPrice !== null && finalXPrice === null) {
            finalXPrice = finalYPrice * poolPrice;
            xSource = 'pool-derived';
        }
    }
    
    return {
        tokenXPrice: finalXPrice,
        tokenYPrice: finalYPrice,
        tokenXSource: xSource,
        tokenYSource: ySource,
    };
}

// ==================== REMOVE LIQUIDITY ====================

export interface RemoveLiquidityResult {
    signatures: string[];
    removedX: number;
    removedY: number;
    removedUsd: number;
    tokenXSymbol: string;
    tokenYSymbol: string;
    bps: number;
    shouldClaimAndClose: boolean;
}

/**
 * Remove liquidity from a position using a specific keypair
 * @param poolAddress - Pool address
 * @param positionPubKey - Position public key
 * @param keypair - User's keypair
 * @param bps - Basis points (100 bps = 1%, 10000 bps = 100%)
 * @param shouldClaimAndClose - If true, claims fees and closes position if 100% removal
 */
export async function removeLiquidityWithKeypair(
    poolAddress: string,
    positionPubKey: string,
    keypair: Keypair,
    bps: number,
    shouldClaimAndClose: boolean = false
): Promise<RemoveLiquidityResult> {
    try {
        const { BN } = await import('@coral-xyz/anchor');
        const dlmm = await poolService.getDlmmInstance(poolAddress);
        const positionKey = new PublicKey(positionPubKey);
        const position = await dlmm.getPosition(positionKey);
        const poolInfo = await poolService.getPoolInfo(poolAddress).catch(() => null);

        // Extract token info
        const dlmmTokenX = dlmm.tokenX as any;
        const dlmmTokenY = dlmm.tokenY as any;
        
        const tokenXDecimals = poolInfo?.tokenX.decimals ?? dlmmTokenX?.mint?.decimals ?? dlmmTokenX?.decimal ?? 6;
        const tokenYDecimals = poolInfo?.tokenY.decimals ?? dlmmTokenY?.mint?.decimals ?? dlmmTokenY?.decimal ?? 6;
        const tokenXSymbol = poolInfo?.tokenX.symbol ?? extractSymbol(dlmmTokenX) ?? 'Token X';
        const tokenYSymbol = poolInfo?.tokenY.symbol ?? extractSymbol(dlmmTokenY) ?? 'Token Y';
        const tokenXMint = poolInfo?.tokenX.mint ?? extractMint(dlmmTokenX);
        const tokenYMint = poolInfo?.tokenY.mint ?? extractMint(dlmmTokenY);

        // Get current position amounts for estimation
        const positionData = position.positionData ?? position;
        const totalXAmountVal = (positionData as any).totalXAmount;
        const totalYAmountVal = (positionData as any).totalYAmount;
        const totalXAmount = totalXAmountVal ? 
            (typeof totalXAmountVal.toNumber === 'function' 
                ? totalXAmountVal.toNumber() 
                : Number(totalXAmountVal)) : 0;
        const totalYAmount = totalYAmountVal ? 
            (typeof totalYAmountVal.toNumber === 'function' 
                ? totalYAmountVal.toNumber() 
                : Number(totalYAmountVal)) : 0;

        // Calculate removed amounts
        const removedXRaw = Math.floor(totalXAmount * bps / 10000);
        const removedYRaw = Math.floor(totalYAmount * bps / 10000);
        const removedX = removedXRaw / Math.pow(10, tokenXDecimals);
        const removedY = removedYRaw / Math.pow(10, tokenYDecimals);

        // Get USD values
        const priceMap = await oracleService.getUsdPrices([tokenXMint, tokenYMint].filter(m => !!m));
        const tokenXPrice = priceMap.get(tokenXMint) ?? 0;
        const tokenYPrice = priceMap.get(tokenYMint) ?? 0;
        const removedUsd = (removedX * tokenXPrice) + (removedY * tokenYPrice);

        // Get bin range for removal
        const lowerBinId = positionData.lowerBinId;
        const upperBinId = positionData.upperBinId;

        // Execute removal
        const txs = await dlmm.removeLiquidity({
            position: positionKey,
            user: keypair.publicKey,
            fromBinId: lowerBinId,
            toBinId: upperBinId,
            bps: new BN(bps),
            shouldClaimAndClose
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

        return {
            signatures,
            removedX,
            removedY,
            removedUsd,
            tokenXSymbol,
            tokenYSymbol,
            bps,
            shouldClaimAndClose
        };

    } catch (error) {
        console.error('Error removing liquidity:', error);
        throw error;
    }
}

// ==================== CLOSE POSITION ====================

export interface ClosePositionResult {
    signature: string;
    tokenXSymbol: string;
    tokenYSymbol: string;
    withdrawnX: number;
    withdrawnY: number;
    withdrawnUsd: number;
    claimedFeesX: number;
    claimedFeesY: number;
    claimedFeesUsd: number;
}

/**
 * Close a position using a specific keypair
 * This will remove all liquidity and claim all fees
 */
export async function closePositionWithKeypair(
    poolAddress: string,
    positionPubKey: string,
    keypair: Keypair
): Promise<ClosePositionResult> {
    try {
        const { BN } = await import('@coral-xyz/anchor');
        const dlmm = await poolService.getDlmmInstance(poolAddress);
        const positionKey = new PublicKey(positionPubKey);
        const position = await dlmm.getPosition(positionKey);
        const poolInfo = await poolService.getPoolInfo(poolAddress).catch(() => null);

        // Extract token info
        const dlmmTokenX = dlmm.tokenX as any;
        const dlmmTokenY = dlmm.tokenY as any;
        
        const tokenXDecimals = poolInfo?.tokenX.decimals ?? dlmmTokenX?.mint?.decimals ?? dlmmTokenX?.decimal ?? 6;
        const tokenYDecimals = poolInfo?.tokenY.decimals ?? dlmmTokenY?.mint?.decimals ?? dlmmTokenY?.decimal ?? 6;
        const tokenXSymbol = poolInfo?.tokenX.symbol ?? extractSymbol(dlmmTokenX) ?? 'Token X';
        const tokenYSymbol = poolInfo?.tokenY.symbol ?? extractSymbol(dlmmTokenY) ?? 'Token Y';
        const tokenXMint = poolInfo?.tokenX.mint ?? extractMint(dlmmTokenX);
        const tokenYMint = poolInfo?.tokenY.mint ?? extractMint(dlmmTokenY);

        // Get current position data
        const positionData = position.positionData ?? position;
        
        // Current liquidity amounts
        const totalXAmountVal2 = (positionData as any).totalXAmount;
        const totalYAmountVal2 = (positionData as any).totalYAmount;
        const totalXAmount = totalXAmountVal2 ? 
            (typeof totalXAmountVal2.toNumber === 'function' 
                ? totalXAmountVal2.toNumber() 
                : Number(totalXAmountVal2)) : 0;
        const totalYAmount = totalYAmountVal2 ? 
            (typeof totalYAmountVal2.toNumber === 'function' 
                ? totalYAmountVal2.toNumber() 
                : Number(totalYAmountVal2)) : 0;

        // Fee amounts
        const feeXAmount = extractFeeAmount(position, 'feeX');
        const feeYAmount = extractFeeAmount(position, 'feeY');

        const withdrawnX = totalXAmount / Math.pow(10, tokenXDecimals);
        const withdrawnY = totalYAmount / Math.pow(10, tokenYDecimals);
        const claimedFeesX = feeXAmount / Math.pow(10, tokenXDecimals);
        const claimedFeesY = feeYAmount / Math.pow(10, tokenYDecimals);

        // Get USD values
        const priceMap = await oracleService.getUsdPrices([tokenXMint, tokenYMint].filter(m => !!m));
        const tokenXPrice = priceMap.get(tokenXMint) ?? 0;
        const tokenYPrice = priceMap.get(tokenYMint) ?? 0;
        
        const withdrawnUsd = (withdrawnX * tokenXPrice) + (withdrawnY * tokenYPrice);
        const claimedFeesUsd = (claimedFeesX * tokenXPrice) + (claimedFeesY * tokenYPrice);

        // Get bin range
        const lowerBinId = positionData.lowerBinId;
        const upperBinId = positionData.upperBinId;

        // Step 1: Remove all liquidity with shouldClaimAndClose = true
        const removeTxs = await dlmm.removeLiquidity({
            position: positionKey,
            user: keypair.publicKey,
            fromBinId: lowerBinId,
            toBinId: upperBinId,
            bps: new BN(10000), // 100%
            shouldClaimAndClose: true
        });

        const connection = connectionService.getConnection();
        let signature = '';

        for (const tx of removeTxs) {
            signature = await sendAndConfirmTransaction(
                connection,
                tx,
                [keypair],
                { commitment: 'confirmed' }
            );
        }

        return {
            signature,
            tokenXSymbol,
            tokenYSymbol,
            withdrawnX,
            withdrawnY,
            withdrawnUsd,
            claimedFeesX,
            claimedFeesY,
            claimedFeesUsd
        };

    } catch (error) {
        console.error('Error closing position:', error);
        throw error;
    }
}

// ==================== COMPOUND POSITION ====================

export interface CompoundResult {
    signatures: string[];
    claimedX: number;
    claimedY: number;
    claimedUsd: number;
    compoundedX: number;
    compoundedY: number;
    compoundedUsd: number;
    tokenXSymbol: string;
    tokenYSymbol: string;
    compoundRatio: number; // 0-100 percentage
}

/**
 * Claim and compound fees back into a position
 * @param compoundRatio - 0 = claim only, 100 = compound all, 50 = compound 50%
 */
export async function compoundFeesWithKeypair(
    poolAddress: string,
    positionPubKey: string,
    keypair: Keypair,
    compoundRatio: number = 100
): Promise<CompoundResult> {
    try {
        const dlmm = await poolService.getDlmmInstance(poolAddress);
        const positionKey = new PublicKey(positionPubKey);
        const position = await dlmm.getPosition(positionKey);
        const poolInfo = await poolService.getPoolInfo(poolAddress).catch(() => null);

        // Extract token info
        const dlmmTokenX = dlmm.tokenX as any;
        const dlmmTokenY = dlmm.tokenY as any;
        
        const tokenXDecimals = poolInfo?.tokenX.decimals ?? dlmmTokenX?.mint?.decimals ?? dlmmTokenX?.decimal ?? 6;
        const tokenYDecimals = poolInfo?.tokenY.decimals ?? dlmmTokenY?.mint?.decimals ?? dlmmTokenY?.decimal ?? 6;
        const tokenXSymbol = poolInfo?.tokenX.symbol ?? extractSymbol(dlmmTokenX) ?? 'Token X';
        const tokenYSymbol = poolInfo?.tokenY.symbol ?? extractSymbol(dlmmTokenY) ?? 'Token Y';
        const tokenXMint = poolInfo?.tokenX.mint ?? extractMint(dlmmTokenX);
        const tokenYMint = poolInfo?.tokenY.mint ?? extractMint(dlmmTokenY);

        // Get fee amounts
        const feeXAmount = extractFeeAmount(position, 'feeX');
        const feeYAmount = extractFeeAmount(position, 'feeY');
        const claimedX = feeXAmount / Math.pow(10, tokenXDecimals);
        const claimedY = feeYAmount / Math.pow(10, tokenYDecimals);

        // Get USD values
        const priceMap = await oracleService.getUsdPrices([tokenXMint, tokenYMint].filter(m => !!m));
        const tokenXPrice = priceMap.get(tokenXMint) ?? 0;
        const tokenYPrice = priceMap.get(tokenYMint) ?? 0;
        const claimedUsd = (claimedX * tokenXPrice) + (claimedY * tokenYPrice);

        const connection = connectionService.getConnection();
        const signatures: string[] = [];

        // Step 1: Claim fees first
        const claimTxs = await dlmm.claimAllRewardsByPosition({
            owner: keypair.publicKey,
            position,
        });

        for (const tx of claimTxs) {
            const sig = await sendAndConfirmTransaction(
                connection,
                tx,
                [keypair],
                { commitment: 'confirmed' }
            );
            signatures.push(sig);
        }

        // If ratio is 0, just claim without compounding
        if (compoundRatio === 0) {
            return {
                signatures,
                claimedX,
                claimedY,
                claimedUsd,
                compoundedX: 0,
                compoundedY: 0,
                compoundedUsd: 0,
                tokenXSymbol,
                tokenYSymbol,
                compoundRatio
            };
        }

        // Step 2: Add liquidity with claimed fees (compounding)
        const compoundedX = claimedX * (compoundRatio / 100);
        const compoundedY = claimedY * (compoundRatio / 100);
        const compoundedUsd = claimedUsd * (compoundRatio / 100);

        // For now, return the result indicating what would be compounded
        // Full compound implementation requires additional add liquidity logic
        // which depends on the position's bin range and strategy

        return {
            signatures,
            claimedX,
            claimedY,
            claimedUsd,
            compoundedX,
            compoundedY,
            compoundedUsd,
            tokenXSymbol,
            tokenYSymbol,
            compoundRatio
        };

    } catch (error) {
        console.error('Error compounding fees:', error);
        throw error;
    }
}

// ==================== REBALANCE ANALYSIS ====================

export interface TelegramRebalanceAnalysis {
    shouldRebalance: boolean;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    reason: string;
    currentInRange: boolean;
    distanceFromCenter: number;
    distanceToEdge: number;
    recommendation: string;
    currentDailyFees: number;
    projectedDailyFees: number;
    netDailyGain: number;
    rebalanceCostUsd: number;
    breakEvenHours: number;
    breakEvenLabel: string;
    // Active bin and price info
    activeBinId: number;
    activePrice: number;
    // Current position range
    currentRange: {
        minBin: number;
        maxBin: number;
        minPrice: number;
        maxPrice: number;
    };
    // Suggested range
    suggestedRange?: {
        minBin: number;
        maxBin: number;
        centerBin: number;
        minPrice: number;
        maxPrice: number;
    };
    tokenXSymbol: string;
    tokenYSymbol: string;
    // AI-enhanced fields
    aiEnhanced?: boolean;
    aiConfidence?: number;
    aiReasoning?: string[];
    aiRisks?: string[];
    aiMarketInsight?: string;
}

/**
 * Get rebalance analysis for a position (with optional AI enhancement)
 */
export async function getRebalanceAnalysis(
    poolAddress: string,
    positionPubKey: string,
    position: any,
    useAI: boolean = true
): Promise<TelegramRebalanceAnalysis> {
    try {
        const { initRebalancingService, RebalancingService } = await import('../../services/rebalancing.service');
        const connection = connectionService.getConnection();
        
        // Initialize the service if needed
        let service: InstanceType<typeof RebalancingService>;
        try {
            const { rebalancingService } = await import('../../services/rebalancing.service');
            if (rebalancingService) {
                service = rebalancingService;
            } else {
                service = initRebalancingService(connection);
            }
        } catch {
            service = initRebalancingService(connection);
        }

        const poolInfo = await poolService.getPoolInfo(poolAddress).catch(() => null);
        
        // Get analysis
        const analysis = await service.analyzeRebalanceNeeded(position, poolInfo ?? undefined);
        const costBenefit = await service.costBenefitAnalysis(position, poolInfo ?? undefined);

        // Build suggested range from position data
        const dlmm = await poolService.getDlmmInstance(poolAddress);
        const activeBin = await dlmm.getActiveBin();
        
        // Get token info
        const tokenXSymbol = poolInfo?.tokenX.symbol ?? 'Token X';
        const tokenYSymbol = poolInfo?.tokenY.symbol ?? 'Token Y';
        
        // Determine appropriate bins per side based on pair type
        const stableSymbols = ['USDC', 'USDT', 'DAI', 'PYUSD'];
        const memeTokens = ['BONK', 'WIF', 'POPCAT', 'BOME', 'MEW', 'MYRO', 'SLERF', 'TRUMP'];
        const isStablePair = stableSymbols.includes(tokenXSymbol) && stableSymbols.includes(tokenYSymbol);
        const hasStable = stableSymbols.includes(tokenXSymbol) || stableSymbols.includes(tokenYSymbol);
        const isMemeToken = memeTokens.includes(tokenXSymbol) || memeTokens.includes(tokenYSymbol);
        
        // Max 34 bins per side (69 total) due to Meteora DLMM single-transaction limit
        let binsPerSide: number;
        if (isStablePair) {
            // Stablecoin pairs - tight range is fine
            binsPerSide = 20;
        } else if (isMemeToken) {
            // Meme tokens - use max allowed (69 total)
            binsPerSide = 34;
        } else if (hasStable) {
            // Major pairs with stablecoin (SOL/USDC, ETH/USDC) - use max allowed
            binsPerSide = 34;
        } else {
            // Crypto/crypto pairs
            binsPerSide = 25;
        }
        
        const suggestedCenter = activeBin.binId;
        const suggestedMin = suggestedCenter - binsPerSide;
        const suggestedMax = suggestedCenter + binsPerSide;
        
        // Get bin step and decimals for price calculations
        const binStep = poolInfo?.binStep ?? 1;
        const tokenXDecimals = poolInfo?.tokenX.decimals ?? 6;
        const tokenYDecimals = poolInfo?.tokenY.decimals ?? 6;
        
        // Calculate active price
        const binRatioActive = poolService.calculateBinPrice(activeBin.binId, binStep, tokenXDecimals, tokenYDecimals);
        
        // Get actual USD price for tokenX
        let currentUsdPrice = 0;
        try {
            const { priceService } = await import('../../services/price.service');
            if (poolInfo?.tokenX?.mint) {
                currentUsdPrice = await priceService.getTokenPrice(poolInfo.tokenX.mint) || 0;
            }
        } catch (e) {
            // Leave as 0, will use bin ratios
        }
        
        // Get current position range from position data
        const currentMinBin = position.lowerBinId ?? position.positionData?.lowerBinId ?? 0;
        const currentMaxBin = position.upperBinId ?? position.positionData?.upperBinId ?? 0;
        const binRatioCurrentMin = poolService.calculateBinPrice(currentMinBin, binStep, tokenXDecimals, tokenYDecimals);
        const binRatioCurrentMax = poolService.calculateBinPrice(currentMaxBin, binStep, tokenXDecimals, tokenYDecimals);
        const distanceToLower = Math.max(0, activeBin.binId - currentMinBin);
        const distanceToUpper = Math.max(0, currentMaxBin - activeBin.binId);
        const distanceToEdge = Math.min(distanceToLower, distanceToUpper);
        
        // Calculate suggested bin ratios
        const binRatioSuggestedMin = poolService.calculateBinPrice(suggestedMin, binStep, tokenXDecimals, tokenYDecimals);
        const binRatioSuggestedMax = poolService.calculateBinPrice(suggestedMax, binStep, tokenXDecimals, tokenYDecimals);
        
        // Convert to USD prices if we have a current USD price
        let activePrice: number;
        let currentMinPrice: number;
        let currentMaxPrice: number;
        let suggestedMinPrice: number;
        let suggestedMaxPrice: number;
        
        if (currentUsdPrice > 0 && binRatioActive > 0) {
            // Convert bin ratios to USD prices
            activePrice = currentUsdPrice;
            currentMinPrice = currentUsdPrice * (binRatioCurrentMin / binRatioActive);
            currentMaxPrice = currentUsdPrice * (binRatioCurrentMax / binRatioActive);
            suggestedMinPrice = currentUsdPrice * (binRatioSuggestedMin / binRatioActive);
            suggestedMaxPrice = currentUsdPrice * (binRatioSuggestedMax / binRatioActive);
        } else {
            // Fall back to bin ratios
            activePrice = binRatioActive;
            currentMinPrice = binRatioCurrentMin;
            currentMaxPrice = binRatioCurrentMax;
            suggestedMinPrice = binRatioSuggestedMin;
            suggestedMaxPrice = binRatioSuggestedMax;
        }

        // Base result from rule-based analysis
        let result: TelegramRebalanceAnalysis = {
            shouldRebalance: analysis.shouldRebalance,
            priority: analysis.priority,
            reason: analysis.reason,
            currentInRange: analysis.currentInRange,
            distanceFromCenter: analysis.distanceFromCenter,
            recommendation: analysis.recommendation,
            currentDailyFees: analysis.currentDailyFees,
            projectedDailyFees: analysis.projectedDailyFees,
            netDailyGain: costBenefit.netDailyGain,
            rebalanceCostUsd: costBenefit.rebalanceCostUsd,
            breakEvenHours: costBenefit.breakEvenHours,
            breakEvenLabel: costBenefit.breakEvenLabel,
            activeBinId: activeBin.binId,
            distanceToEdge,
            activePrice,
            currentRange: {
                minBin: currentMinBin,
                maxBin: currentMaxBin,
                minPrice: currentMinPrice,
                maxPrice: currentMaxPrice,
            },
            suggestedRange: {
                minBin: suggestedMin,
                maxBin: suggestedMax,
                centerBin: suggestedCenter,
                minPrice: suggestedMinPrice,
                maxPrice: suggestedMaxPrice,
            },
            tokenXSymbol,
            tokenYSymbol,
            aiEnhanced: false
        };

        // Enhance with AI analysis if requested and available
        if (useAI) {
            try {
                const { llmAgent } = await import('../../services/llmAgent.service');
                
                if (llmAgent.isAvailable()) {
                    console.log('🤖 Enhancing rebalance analysis with AI...');
                    const aiDecision = await llmAgent.analyzePosition(position);
                    
                    // Enhance the result with AI insights
                    result.aiEnhanced = true;
                    result.aiConfidence = aiDecision.confidence;
                    result.aiReasoning = Array.isArray(aiDecision.reasoning) 
                        ? aiDecision.reasoning 
                        : [aiDecision.reasoning];
                    result.aiRisks = aiDecision.risks || [];
                    if (aiDecision.marketInsight) {
                        result.aiMarketInsight = aiDecision.marketInsight;
                    }

                    // If AI provides a suggested range, use it instead of the default
                    if (aiDecision.suggestedRange && aiDecision.action === 'rebalance') {
                        const aiBinsPerSide = aiDecision.suggestedRange.binsPerSide || binsPerSide;
                        const aiSuggestedMin = suggestedCenter - aiBinsPerSide;
                        const aiSuggestedMax = suggestedCenter + aiBinsPerSide;
                        
                        // Use AI's suggested USD prices if provided, otherwise calculate from bins
                        let suggestedMinPrice: number;
                        let suggestedMaxPrice: number;
                        
                        if (aiDecision.suggestedRange.priceMin && aiDecision.suggestedRange.priceMax) {
                            // AI provided explicit USD price range
                            suggestedMinPrice = aiDecision.suggestedRange.priceMin;
                            suggestedMaxPrice = aiDecision.suggestedRange.priceMax;
                            console.log(`🤖 AI suggested USD range: $${suggestedMinPrice.toFixed(2)} - $${suggestedMaxPrice.toFixed(2)}`);
                        } else {
                            // Calculate from bins and convert to USD
                            const binRatioMin = poolService.calculateBinPrice(aiSuggestedMin, binStep, tokenXDecimals, tokenYDecimals);
                            const binRatioMax = poolService.calculateBinPrice(aiSuggestedMax, binStep, tokenXDecimals, tokenYDecimals);
                            const binRatioActive = poolService.calculateBinPrice(position.activeBinId, binStep, tokenXDecimals, tokenYDecimals);
                            
                            // Get current USD price for conversion
                            const { priceService } = await import('../../services/price.service');
                            const currentUsd = poolInfo?.tokenX?.mint 
                                ? await priceService.getTokenPrice(poolInfo.tokenX.mint) || 0 
                                : 0;
                            
                            if (currentUsd > 0 && binRatioActive > 0) {
                                suggestedMinPrice = currentUsd * (binRatioMin / binRatioActive);
                                suggestedMaxPrice = currentUsd * (binRatioMax / binRatioActive);
                            } else {
                                suggestedMinPrice = binRatioMin;
                                suggestedMaxPrice = binRatioMax;
                            }
                        }
                        
                        result.suggestedRange = {
                            minBin: aiSuggestedMin,
                            maxBin: aiSuggestedMax,
                            centerBin: suggestedCenter,
                            minPrice: suggestedMinPrice,
                            maxPrice: suggestedMaxPrice,
                        };
                        
                        // Add range justification and width to reasoning
                        if (aiDecision.suggestedRange.rangeJustification) {
                            const rangeWidth = aiDecision.suggestedRange.rangeWidthPercent 
                                ? `(${aiDecision.suggestedRange.rangeWidthPercent.toFixed(1)}% width)` 
                                : '';
                            result.aiReasoning.push(`📏 Range ${rangeWidth}: ${aiDecision.suggestedRange.rangeJustification}`);
                        }
                        
                        console.log(`🤖 AI suggested range: ${aiBinsPerSide} bins per side (${aiDecision.suggestedRange.totalBins || aiBinsPerSide * 2} total)`);
                    }

                    // AI can override recommendation if confidence is high
                    if (aiDecision.confidence >= 80) {
                        if (aiDecision.action === 'rebalance' && aiDecision.urgency === 'immediate') {
                            result.shouldRebalance = true;
                            result.priority = 'CRITICAL';
                            result.recommendation = `AI (${aiDecision.confidence}% confidence): ${result.aiReasoning[0] || 'Immediate rebalance recommended'}`;
                        } else if (aiDecision.action === 'hold' && !analysis.shouldRebalance) {
                            result.recommendation = `AI (${aiDecision.confidence}% confidence): ${result.aiReasoning[0] || 'Hold position - no action needed'}`;
                        }
                    }
                }
            } catch (aiError) {
                console.warn('AI enhancement failed, using rule-based analysis only:', aiError);
            }
        }

        return result;

    } catch (error) {
        console.error('Error getting rebalance analysis:', error);
        throw error;
    }
}

// ==================== AI ANALYSIS ====================

export interface TelegramAIAnalysis {
    action: 'rebalance' | 'hold' | 'close' | 'compound';
    confidence: number;
    urgency: 'immediate' | 'soon' | 'low' | 'none';
    reasoning: string[];
    risks: string[];
    suggestedActions: string[];
    tokenXSymbol: string;
    tokenYSymbol: string;
    isAvailable: boolean;
}

/**
 * Get AI-powered analysis for a position
 */
export async function getAIAnalysis(
    poolAddress: string,
    positionPubKey: string,
    position: any
): Promise<TelegramAIAnalysis> {
    try {
        const { llmAgent } = await import('../../services/llmAgent.service');
        const poolInfo = await poolService.getPoolInfo(poolAddress).catch(() => null);
        
        const tokenXSymbol = poolInfo?.tokenX.symbol ?? 'Token X';
        const tokenYSymbol = poolInfo?.tokenY.symbol ?? 'Token Y';

        // Check if LLM is available
        if (!llmAgent.isAvailable()) {
            return {
                action: 'hold',
                confidence: 0,
                urgency: 'none',
                reasoning: ['AI analysis is not configured'],
                risks: [],
                suggestedActions: ['Configure LLM in settings to enable AI analysis'],
                tokenXSymbol,
                tokenYSymbol,
                isAvailable: false
            };
        }

        // Get AI decision
        const decision = await llmAgent.analyzePosition(position);

        // Extract additional context from decision or position
        const activeBin = position.activeBinId;
        const rangeMinBin = position.lowerBinId;
        const rangeMaxBin = position.upperBinId;

        // Calculate price range from bins (these are bin ratios, not USD)
        const binStep = poolInfo?.binStep || position.binStep || 1;
        const tokenXDecimals = poolInfo?.tokenX?.decimals || 9;
        const tokenYDecimals = poolInfo?.tokenY?.decimals || 6;
        
        // Get actual USD price for tokenX for current price display
        let currentPrice = (decision as any).currentPrice || 0;
        try {
            const { priceService } = await import('../../services/price.service');
            if (poolInfo?.tokenX?.mint) {
                currentPrice = await priceService.getTokenPrice(poolInfo.tokenX.mint) || currentPrice;
            }
        } catch (e) {
            // Keep decision's currentPrice or default
        }
        
        // Calculate bin ratio prices for range display
        // Note: For pairs like SOL/USDC, this represents how many USDC per SOL at each bin
        const binRatioMin = poolService.calculateBinPrice(rangeMinBin, binStep, tokenXDecimals, tokenYDecimals);
        const binRatioMax = poolService.calculateBinPrice(rangeMaxBin, binStep, tokenXDecimals, tokenYDecimals);
        const binRatioActive = poolService.calculateBinPrice(activeBin, binStep, tokenXDecimals, tokenYDecimals);
        
        // Convert bin ratios to USD prices
        // For SOL/USDC: binRatio = USDC per SOL, so rangePrice = currentUSD * (binRatio / activeBinRatio)
        const rangeMinPrice = binRatioActive > 0 ? currentPrice * (binRatioMin / binRatioActive) : binRatioMin;
        const rangeMaxPrice = binRatioActive > 0 ? currentPrice * (binRatioMax / binRatioActive) : binRatioMax;
        
        // Calculate nearest edge price
        const distanceToLower = activeBin - rangeMinBin;
        const distanceToUpper = rangeMaxBin - activeBin;
        const nearestEdgeBin = distanceToLower < distanceToUpper ? rangeMinBin : rangeMaxBin;
        const binRatioEdge = poolService.calculateBinPrice(nearestEdgeBin, binStep, tokenXDecimals, tokenYDecimals);
        const nearestEdgePrice = binRatioActive > 0 ? currentPrice * (binRatioEdge / binRatioActive) : binRatioEdge;
        const distanceToEdge = Math.min(distanceToLower, distanceToUpper);

        return {
            action: decision.action as 'rebalance' | 'hold' | 'close' | 'compound',
            confidence: decision.confidence,
            urgency: decision.urgency as 'immediate' | 'soon' | 'low' | 'none',
            reasoning: Array.isArray(decision.reasoning) ? decision.reasoning : [decision.reasoning],
            risks: decision.risks || [],
            suggestedActions: (decision as any).suggestedActions || [],
            tokenXSymbol,
            tokenYSymbol,
            isAvailable: true,
            // Pass through extra data for display
            ...decision as any,
            currentPrice,
            activeBin,
            rangeMin: rangeMinBin,
            rangeMax: rangeMaxBin,
            rangeMinPrice,
            rangeMaxPrice,
            nearestEdgePrice,
            distanceToEdge
        };

    } catch (error) {
        console.error('Error getting AI analysis:', error);
        throw error;
    }
}

// ==================== EXECUTE REBALANCE ====================

export interface ExecuteRebalanceResult {
    success: boolean;
    oldPositionAddress: string;
    newPositionAddress: string;
    withdrawnX: number;
    withdrawnY: number;
    withdrawnUsd: number;
    newRangeMin: number;
    newRangeMax: number;
    transactions: string[];
    tokenXSymbol: string;
    tokenYSymbol: string;
}

/**
 * Execute a rebalance for a position using user's keypair
 */
export async function executeRebalanceWithKeypair(
    poolAddress: string,
    positionPubKey: string,
    keypair: Keypair,
    binsPerSide: number = 10
): Promise<ExecuteRebalanceResult> {
    try {
        const { positionService } = await import('../../services/position.service');
        const { sendAndConfirmTransaction, Keypair: SolanaKeypair, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
        const { BN } = await import('@coral-xyz/anchor');
        const connection = connectionService.getConnection();
        
        // Get the position
        const positions = await positionService.getAllPositions(keypair.publicKey.toBase58());
        const position = positions.find(p => p.publicKey === positionPubKey);
        
        if (!position) {
            throw new Error('Position not found');
        }

        const poolInfo = await poolService.getPoolInfo(poolAddress).catch(() => null);
        const tokenXSymbol = poolInfo?.tokenX.symbol ?? 'Token X';
        const tokenYSymbol = poolInfo?.tokenY.symbol ?? 'Token Y';
        const tokenXDecimals = poolInfo?.tokenX.decimals ?? 6;
        const tokenYDecimals = poolInfo?.tokenY.decimals ?? 6;

        // Pre-flight check: Estimate rent needed for new position
        // DLMM positions require ~0.00089 SOL per bin for rent
        const totalBins = binsPerSide * 2;
        const estimatedRentPerBin = 0.00089; // SOL per bin (approximate)
        const basePositionRent = 0.003; // Base rent for position account
        const estimatedRentNeeded = basePositionRent + (totalBins * estimatedRentPerBin);
        const safetyBuffer = 0.015; // Extra buffer for transaction fees (increased)
        const totalSolNeeded = estimatedRentNeeded + safetyBuffer;
        
        // Check maximum bin limit
        // Meteora DLMM has DEFAULT_BIN_PER_POSITION = 70 as the base position size
        // Positions > 70 bins require resize instructions which can fail with realloc errors
        // Using 69 as safe maximum for single-transaction position creation
        const MAX_BINS_SINGLE_TX = 69;
        if (totalBins > MAX_BINS_SINGLE_TX) {
            throw new Error(
                `Position too large: ${totalBins} bins requested. ` +
                `Meteora DLMM supports up to ${MAX_BINS_SINGLE_TX} bins per position in a single transaction. ` +
                `Please use ${Math.floor(MAX_BINS_SINGLE_TX / 2)} bins per side (34) or fewer for reliable rebalancing.`
            );
        }
        
        // Check wallet SOL balance
        // Note: Closing the old position will return some rent, so we account for that
        const walletBalance = await connection.getBalance(keypair.publicKey);
        const walletSol = walletBalance / LAMPORTS_PER_SOL;
        
        // Estimate rent that will be returned from closing old position
        const oldPositionBins = (position.upperBinId || 0) - (position.lowerBinId || 0);
        const estimatedRentReturn = basePositionRent + (oldPositionBins * estimatedRentPerBin * 0.8); // 80% to be safe
        const effectiveSol = walletSol + estimatedRentReturn;
        
        console.log(`Pre-flight check: ${totalBins} bins require ~${estimatedRentNeeded.toFixed(4)} SOL rent`);
        console.log(`Wallet balance: ${walletSol.toFixed(4)} SOL + ~${estimatedRentReturn.toFixed(4)} SOL rent return = ~${effectiveSol.toFixed(4)} SOL`);
        console.log(`Total needed: ${totalSolNeeded.toFixed(4)} SOL`);
        
        if (effectiveSol < totalSolNeeded) {
            const shortfall = totalSolNeeded - effectiveSol;
            throw new Error(
                `Insufficient SOL for position rent. ` +
                `Creating a ${totalBins}-bin position requires ~${totalSolNeeded.toFixed(4)} SOL, ` +
                `but you'll only have ~${effectiveSol.toFixed(4)} SOL after closing the old position. ` +
                `Please add at least ${shortfall.toFixed(4)} SOL to your wallet, ` +
                `or use fewer bins (try 50 bins = ~${(basePositionRent + 50 * estimatedRentPerBin + safetyBuffer).toFixed(4)} SOL needed).`
            );
        }

        // Step 1: Remove all liquidity and close position
        console.log('Step 1/2: Removing liquidity from old position...');
        const removeResult = await removeLiquidityWithKeypair(
            poolAddress,
            positionPubKey,
            keypair,
            10000, // 100%
            true // close position
        );

        // Short delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Re-check SOL balance after removing liquidity (closing position returns some rent)
        const postRemoveBalance = await connection.getBalance(keypair.publicKey);
        const postRemoveSol = postRemoveBalance / LAMPORTS_PER_SOL;
        console.log(`Post-remove SOL balance: ${postRemoveSol.toFixed(4)} SOL`);
        
        if (postRemoveSol < totalSolNeeded) {
            // Not enough SOL even after reclaiming rent - need to abort
            // But liquidity is already removed, so we need to inform user
            const shortfall = totalSolNeeded - postRemoveSol;
            throw new Error(
                `⚠️ **Liquidity withdrawn but cannot create new position**\n\n` +
                `Your tokens have been returned to your wallet:\n` +
                `• ${removeResult.removedX.toFixed(4)} ${tokenXSymbol}\n` +
                `• ${removeResult.removedY.toFixed(2)} ${tokenYSymbol}\n\n` +
                `**Problem:** Creating a ${totalBins}-bin position needs ~${totalSolNeeded.toFixed(4)} SOL, ` +
                `but you only have ${postRemoveSol.toFixed(4)} SOL.\n\n` +
                `**To complete rebalancing:**\n` +
                `1. Add ${shortfall.toFixed(4)} SOL to your wallet, OR\n` +
                `2. Create a new position with fewer bins manually\n\n` +
                `Use /positions → Create Position to add liquidity back.`
            );
        }

        // Step 2: Get new active bin and create new position
        console.log('Step 2/2: Creating new position...');
        const dlmm = await poolService.getDlmmInstance(poolAddress);
        const activeBin = await dlmm.getActiveBin();
        const newCenterBin = activeBin.binId;
        const newMinBin = newCenterBin - binsPerSide;
        const newMaxBin = newCenterBin + binsPerSide;

        // Calculate amounts from removed liquidity
        const amountX = removeResult.removedX;
        const amountY = removeResult.removedY;
        
        // Skip position creation if amounts are zero
        if (amountX <= 0 && amountY <= 0) {
            throw new Error('No liquidity was removed from position. Cannot create new position.');
        }

        // Create new position with the same tokens
        const newPositionKeypair = SolanaKeypair.generate();
        
        const amountXBN = new BN(Math.floor(amountX * (10 ** tokenXDecimals)));
        const amountYBN = new BN(Math.floor(amountY * (10 ** tokenYDecimals)));

        const strategy = {
            maxBinId: newMaxBin,
            minBinId: newMinBin,
            strategyType: 0 // Spot strategy
        };

        const tx = await dlmm.initializePositionAndAddLiquidityByStrategy({
            positionPubKey: newPositionKeypair.publicKey,
            user: keypair.publicKey,
            totalXAmount: amountXBN,
            totalYAmount: amountYBN,
            strategy,
            slippage: 100 // 1% slippage
        });

        const createSignature = await sendAndConfirmTransaction(
            connection,
            tx,
            [keypair, newPositionKeypair],
            { commitment: 'confirmed' }
        );

        console.log(`✓ New position created: ${newPositionKeypair.publicKey.toBase58()}`);
        console.log(`  TX: ${createSignature}`);

        return {
            success: true,
            oldPositionAddress: positionPubKey,
            newPositionAddress: newPositionKeypair.publicKey.toBase58(),
            withdrawnX: amountX,
            withdrawnY: amountY,
            withdrawnUsd: removeResult.removedUsd,
            newRangeMin: newMinBin,
            newRangeMax: newMaxBin,
            transactions: [...removeResult.signatures, createSignature],
            tokenXSymbol,
            tokenYSymbol
        };

    } catch (error: any) {
        console.error('Error executing rebalance:', error);
        
        // Parse common errors into user-friendly messages
        const errorMessage = error?.message || String(error);
        const logs = error?.transactionLogs || [];
        const logsStr = logs.join('\n');
        
        // Check for insufficient lamports / rent error
        if (errorMessage.includes('insufficient lamports') || logsStr.includes('insufficient lamports')) {
            const match = logsStr.match(/insufficient lamports (\d+), need (\d+)/);
            if (match) {
                const have = parseInt(match[1]) / 1e9;
                const need = parseInt(match[2]) / 1e9;
                const shortfall = need - have;
                throw new Error(
                    `❌ **Insufficient SOL for position rent**\n\n` +
                    `Creating this position requires **${need.toFixed(4)} SOL** for rent, ` +
                    `but only **${have.toFixed(4)} SOL** is available.\n\n` +
                    `💡 **Solutions:**\n` +
                    `• Add at least **${shortfall.toFixed(4)} SOL** to your wallet\n` +
                    `• Or use fewer bins (smaller range = less rent)`
                );
            }
        }
        
        throw error;
    }
}
