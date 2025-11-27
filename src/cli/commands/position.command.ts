import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { PublicKey } from '@solana/web3.js';
import { StrategyType } from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import { walletService } from '../../services/wallet.service';
import { positionService, UserPosition } from '../../services/position.service';
import { feeService, BatchClaimOutcome, FeeClaimSummary, BatchClaimRequest } from '../../services/fee.service';
import { poolService } from '../../services/pool.service';
import { liquidityService } from '../../services/liquidity.service';
import { connectionService } from '../../services/connection.service';
import { validateWalletBalance, getWalletBalances, WalletBalances } from '../../utils/balance.utils';
import { rangeRecommenderService, RangeRecommendation, RangeRecommendationContext, SupportedStrategy } from '../../services/range-recommender.service';
import { marketContextService } from '../../services/market-context.service';
import { getAnalyticsDataStore, AnalyticsSnapshot } from '../../services/analyticsDataStore.service';
import { buildAsciiBinDistribution } from '../../utils/visualization.helpers';
import { PoolInfo, PriorityFeeOptions, TransactionConfig } from '../../config/types';
import { swapService, SwapQuoteResult } from '../../services/swap.service';
import { configManager } from '../../config/config.manager';
import { DEFAULT_CONFIG } from '../../config/constants';
import { rebalancingService, initRebalancingService, RebalanceAnalysis, CostBenefitAnalysis } from '../../services/rebalancing.service';
import { compoundingService, CompoundFeesResult } from '../../services/compounding.service';
import { llmAgent } from '../../services/llmAgent.service';

const analyticsStore = getAnalyticsDataStore();
const EDGE_BUFFER_BINS = 2;
const SNAPSHOT_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
let analyticsSnapshotTimer: NodeJS.Timeout | null = null;

ensureSnapshotScheduler();

const STABLE_TOKEN_SYMBOLS = new Set([
    'USDC',
    'USDT',
    'USDC.E',
    'USDT.E',
    'USDL',
    'USDH',
    'DAI',
    'PYUSD',
    'USDP',
    'FRAX',
    'UXD',
    'EURC',
]);

type StrategyConfidence = 'high' | 'medium' | 'low';

interface StrategyRecommendationResult {
    strategy: SupportedStrategy;
    confidence: StrategyConfidence;
    reasons: string[];
    metrics: {
        volatilityScore: number;
        volumeSkew: number;
        stablePair: boolean;
        includesStable: boolean;
        atrPercent: number;
        atrState: 'expanding' | 'flat' | 'contracting';
    };
}

function isStableToken(token?: { symbol?: string | null }): boolean {
    if (!token?.symbol) {
        return false;
    }
    return STABLE_TOKEN_SYMBOLS.has(token.symbol.toUpperCase());
}

function calculateVolumeSkew(
    context?: RangeRecommendationContext,
    poolPrice?: number
): number {
    if (!context?.volumeNodes?.length || !poolPrice || poolPrice <= 0) {
        return 0;
    }
    const above = context.volumeNodes
        .filter((node) => node.price > poolPrice)
        .reduce((sum, node) => sum + node.weight, 0);
    const below = context.volumeNodes
        .filter((node) => node.price < poolPrice)
        .reduce((sum, node) => sum + node.weight, 0);

    const total = above + below;
    if (total === 0) {
        return 0;
    }
    return (above - below) / total;
}

function recommendStrategyForPool(
    poolInfo: PoolInfo,
    context?: RangeRecommendationContext
): StrategyRecommendationResult {
    const stableX = isStableToken(poolInfo.tokenX);
    const stableY = isStableToken(poolInfo.tokenY);
    const stablePair = stableX && stableY;
    const includesStable = stableX || stableY;
    const volatilityScore = context?.volatilityScore ?? 0.08;
    const poolPrice = context?.poolPrice ?? poolInfo.price ?? 1;
    const volumeSkew = calculateVolumeSkew(context, poolPrice);
    const atrPercent = context?.atrPercent ?? volatilityScore;

    let atrState: 'expanding' | 'flat' | 'contracting' = 'flat';
    if (atrPercent > 0.02) {
        atrState = 'expanding';
    } else if (atrPercent < 0.008) {
        atrState = 'contracting';
    }

    let strategy: SupportedStrategy = 'Spot';
    let confidence: StrategyConfidence = 'medium';
    const reasons: string[] = [];

    const lowVol = volatilityScore < 0.08 && atrState !== 'expanding';
    const highVol = volatilityScore > 0.18 || atrState === 'expanding';
    const deepSkew = Math.abs(volumeSkew) > 0.25;

    if (stablePair || (includesStable && lowVol)) {
        strategy = 'Curve';
        confidence = stablePair ? 'high' : 'medium';
        reasons.push('Meteora docs describe Curve as ideal for tightly-pegged markets where liquidity can stay concentrated.');
        if (stablePair) {
            reasons.push('Both tokens are stable-pegged, so concentrating liquidity maximizes fee capture per bin.');
        } else {
            reasons.push(`Volatility score ${(volatilityScore * 100).toFixed(1)}% is low, so a narrower Curve band is efficient.`);
        }
        if (atrState === 'contracting') {
            reasons.push(`ATR contracting (${(atrPercent * 100).toFixed(2)}%) confirms price compression suitable for Curve.`);
        } else if (atrState === 'expanding') {
            reasons.push('ATR is expanding, so monitor for breakout before going overly tight.');
        }
    } else if (highVol || deepSkew) {
        strategy = 'BidAsk';
        confidence = deepSkew ? 'high' : 'medium';
        reasons.push('Bid-Ask is suited for directional or DCA-style provision per Meteora guidance.');
        if (highVol) {
            reasons.push(`ATR ${(atrPercent * 100).toFixed(2)}% / volatility ${(volatilityScore * 100).toFixed(1)}% suggest leaning single-sided to harvest swings.`);
        }
        if (deepSkew) {
            reasons.push(`Volume profile is ${(volumeSkew > 0 ? 'ask-heavy' : 'bid-heavy')} (${(volumeSkew * 100).toFixed(1)}% skew), so asymmetric liquidity can capture flow.`);
        }
    } else {
        strategy = 'Spot';
        confidence = 'medium';
        reasons.push('Spot keeps a balanced 50/50 distribution, which Meteora highlights as the versatile default for mixed markets.');
        reasons.push(`Volatility score ${(volatilityScore * 100).toFixed(1)}% and neutral order flow favor a symmetric approach.`);
        if (atrState !== 'expanding') {
            reasons.push(`ATR ${(atrPercent * 100).toFixed(2)}% indicates muted drift, reinforcing balanced placement.`);
        }
    }

    return {
        strategy,
        confidence,
        reasons,
        metrics: {
            volatilityScore,
            volumeSkew,
            stablePair,
            includesStable,
            atrPercent,
            atrState,
        },
    };
}

// Helper for wait
async function waitForUser() {
    await inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: 'Press ENTER to continue...',
    }]);
}

// Helper for header (optional, or imported if we make a shared UI module)
function displayHeader() {
    // console.clear(); // Optional
    // console.log(chalk.yellow.bold('METEORA DLMM CLI - POSITIONS'));
}

const MIN_SWAP_AMOUNT = 0.000001;
const BALANCE_TOLERANCE = 0.000001;
const PRICE_BUFFER = 1.02;
const FEE_AMOUNT_EPSILON = 0.0000001;

interface AutoSwapContext {
    poolInfo: PoolInfo;
    poolAddress: string;
    amountX: number;
    amountY: number;
    balances: WalletBalances;
}

interface SwapPlan {
    deficitToken: 'tokenX' | 'tokenY';
    deficitAmount: number;
    inputToken: 'tokenX' | 'tokenY';
    availableInput: number;
    swapForY: boolean;
}

interface SwapQuotePlan {
    quote: SwapQuoteResult;
    inputAmount: number;
    expectedOutput: number;
}

function toBaseUnits(amount: number, decimals: number): BN {
    const factor = Math.pow(10, decimals);
    const scaled = Math.floor(amount * factor);
    return new BN(Math.max(scaled, 1));
}

function fromBaseUnits(value: BN, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return parseFloat(value.toString()) / factor;
}

async function maybeHandleAutoSwapShortfalls(context: AutoSwapContext): Promise<boolean> {
    const { poolInfo, amountX, amountY, balances } = context;
    const deficitX = Math.max(0, amountX - balances.tokenXBalance);
    const deficitY = Math.max(0, amountY - balances.tokenYBalance);

    const plans: SwapPlan[] = [];
    if (deficitX > BALANCE_TOLERANCE) {
        plans.push({
            deficitToken: 'tokenX',
            deficitAmount: deficitX,
            inputToken: 'tokenY',
            availableInput: Math.max(0, balances.tokenYBalance - amountY),
            swapForY: false,
        });
    }
    if (deficitY > BALANCE_TOLERANCE) {
        plans.push({
            deficitToken: 'tokenY',
            deficitAmount: deficitY,
            inputToken: 'tokenX',
            availableInput: Math.max(0, balances.tokenXBalance - amountX),
            swapForY: true,
        });
    }

    const feasiblePlans = plans.filter(plan => plan.availableInput > BALANCE_TOLERANCE);
    if (!feasiblePlans.length) {
        return false;
    }

    const config = configManager.getConfig();
    const slippagePercent = config.transaction?.slippage ?? DEFAULT_CONFIG.SLIPPAGE;
    const inferredPrice = amountX > 0 ? amountY / Math.max(amountX, 1e-9) : undefined;
    const priceHint = Math.max(poolInfo.price ?? inferredPrice ?? 1, 1e-9);

    for (const plan of feasiblePlans) {
        const tokenInMeta = plan.inputToken === 'tokenX' ? poolInfo.tokenX : poolInfo.tokenY;
        const tokenOutMeta = plan.deficitToken === 'tokenX' ? poolInfo.tokenX : poolInfo.tokenY;
        const tokenInSymbol = tokenInMeta.symbol || (plan.inputToken === 'tokenX' ? 'Token X' : 'Token Y');
        const tokenOutSymbol = tokenOutMeta.symbol || (plan.deficitToken === 'tokenX' ? 'Token X' : 'Token Y');

        console.log(chalk.cyan(`\n🔁 Attempting to swap ${tokenInSymbol} → ${tokenOutSymbol} to cover shortfall.`));
        console.log(`   Missing ${tokenOutSymbol}: ${chalk.yellow(plan.deficitAmount.toFixed(6))}`);
        console.log(`   Available ${tokenInSymbol} to swap: ${chalk.yellow(plan.availableInput.toFixed(6))}`);

        const quotePlan = await buildSwapQuoteForDeficit({
            poolAddress: context.poolAddress,
            targetOutAmount: plan.deficitAmount,
            maxInputAmount: plan.availableInput,
            slippagePercent,
            swapForY: plan.swapForY,
            tokenInDecimals: tokenInMeta.decimals ?? 6,
            tokenOutDecimals: tokenOutMeta.decimals ?? 6,
            priceHint,
        });

        if (!quotePlan) {
            console.log(chalk.gray('   Unable to source a swap quote that meets the shortfall.'));
            continue;
        }

        console.log(chalk.cyan(`\n   Quote: swap ${chalk.yellow(quotePlan.inputAmount.toFixed(6))} ${tokenInSymbol} for ≈ ${chalk.yellow(quotePlan.expectedOutput.toFixed(6))} ${tokenOutSymbol}`));
        console.log(chalk.gray(`   Price impact: ${(quotePlan.quote.priceImpact * 100).toFixed(3)}% (slippage cap ${slippagePercent.toFixed(2)}%)`));

        const { confirmSwap } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirmSwap',
            message: `Execute swap to acquire missing ${tokenOutSymbol}?`,
            default: true,
        }]);

        if (!confirmSwap) {
            console.log(chalk.gray('   Swap cancelled by user.'));
            continue;
        }

        try {
            const signature = await swapService.executeSwap(context.poolAddress, quotePlan.quote);
            console.log(chalk.green(`   ✅ Swap executed! Signature: ${signature}`));
            return true;
        } catch (error) {
            console.log(chalk.red(`   Swap failed: ${error}`));
            return false;
        }
    }

    return false;
}

interface SwapQuoteBuildParams {
    poolAddress: string;
    targetOutAmount: number;
    maxInputAmount: number;
    slippagePercent: number;
    swapForY: boolean;
    tokenInDecimals: number;
    tokenOutDecimals: number;
    priceHint: number;
}

async function buildSwapQuoteForDeficit(params: SwapQuoteBuildParams): Promise<SwapQuotePlan | null> {
    if (params.maxInputAmount < MIN_SWAP_AMOUNT) {
        return null;
    }

    const attempts = 3;
    let estimateInput = Math.min(
        params.maxInputAmount,
        Math.max(
            MIN_SWAP_AMOUNT,
            (params.swapForY
                ? params.targetOutAmount / Math.max(params.priceHint, 1e-9)
                : params.targetOutAmount * params.priceHint) * PRICE_BUFFER
        )
    );

    for (let attempt = 0; attempt < attempts; attempt++) {
        if (estimateInput > params.maxInputAmount) {
            estimateInput = params.maxInputAmount;
        }
        if (estimateInput < MIN_SWAP_AMOUNT) {
            return null;
        }

        let quote: SwapQuoteResult | null = null;
        try {
            quote = await swapService.getSwapQuote(
                params.poolAddress,
                toBaseUnits(estimateInput, params.tokenInDecimals),
                params.swapForY,
                params.slippagePercent
            );
        } catch (error) {
            console.log(chalk.gray(`   Quote attempt ${attempt + 1} failed: ${error}`));
            if (attempt === attempts - 1) {
                return null;
            }
            continue;
        }

        const expectedOut = fromBaseUnits(quote.outAmount, params.tokenOutDecimals);
        if (expectedOut >= params.targetOutAmount * 0.995) {
            return {
                quote,
                inputAmount: estimateInput,
                expectedOutput: expectedOut,
            };
        }

        const ratio = params.targetOutAmount / Math.max(expectedOut, MIN_SWAP_AMOUNT);
        const nextEstimate = Math.min(params.maxInputAmount, estimateInput * ratio * 1.05);
        if (nextEstimate <= estimateInput * 1.01) {
            return null;
        }
        estimateInput = nextEstimate;
    }

    return null;
}

export async function myPositionsMenu() {
    while (true) {
        try {
            displayHeader();

            const activeWallet = walletService.getActiveWallet();
            if (!activeWallet) {
                console.log(chalk.red('❌ No active wallet found. Please select a wallet first.'));
                await waitForUser();
                return;
            }

            console.log(chalk.yellow('🔄 Fetching positions from blockchain...'));
            const positions = await positionService.getAllPositions(activeWallet.publicKey);

            console.log(chalk.blue.bold('💼 MY POSITIONS\n'));

            if (positions.length === 0) {
                console.log(chalk.gray('📋 No positions found for this wallet.\n'));
            } else {
                console.log(chalk.yellow('📋 Your Positions:\n'));
                positions.forEach((pos, index) => {
                    const status = determineRangeStatus(pos);
                    const statusLabel = formatRangeStatus(status);
                    const tokenXAmount = getUiAmount(pos.tokenX);
                    const tokenYAmount = getUiAmount(pos.tokenY);
                    const feesUsd = pos.unclaimedFees.usdValue ?? 0;

                    console.log(`${index + 1}. ${pos.tokenX.symbol || 'Unknown'}/${pos.tokenY.symbol || 'Unknown'}`);
                    console.log(`   Address: ${pos.publicKey.slice(0, 8)}...`);
                    console.log(`   Pool: ${pos.poolAddress.slice(0, 8)}...`);
                    console.log(`   Range: [${pos.lowerBinId} - ${pos.upperBinId}] ${statusLabel}`);
                    console.log(`   Active Bin: ${pos.activeBinId}`);
                    console.log(`   Tokens: ${tokenXAmount.toFixed(6)} ${pos.tokenX.symbol || 'X'} / ${tokenYAmount.toFixed(6)} ${pos.tokenY.symbol || 'Y'}`);
                    if (pos.totalValueUSD !== undefined) {
                        console.log(`   Total Value: ${formatUsd(pos.totalValueUSD)}`);
                    }
                    console.log(`   Unclaimed Fees: ${formatUsd(feesUsd)} (${formatFeeBreakdownForPosition(pos)})\n`);
                });

                const totals = summarizePortfolioTotals(positions);
                console.log(chalk.cyan(`📈 Portfolio Value: ${formatUsd(totals.valueUsd)}`));
                console.log(chalk.cyan(`💸 Unclaimed Fees: ${formatUsd(totals.feesUsd)} (${formatFeeBreakdown(totals.feesByToken)})`));
                console.log();
            }

            const choices = [
                new inquirer.Separator('═══ POSITION ACTIONS ═══'),
                '🔧 Manage Position (Add/Remove/Close)',
                '📊 View Position Details',
                '♻️ Rebalance Tools',
                '💰 Claim / Compound Fees',
                new inquirer.Separator('═══ DATA & ANALYTICS ═══'),
                '🔄 Refresh Position Data',
                '📈 Refresh Analytics Snapshots',
                new inquirer.Separator('═══ NAVIGATION ═══'),
                '⬅️ Back to Main Menu'
            ];

            const { action } = await inquirer.prompt({
                type: 'list',
                name: 'action',
                message: 'Select an action:',
                choices: choices,
                pageSize: 15
            });

            if (action.includes('Manage Position')) {
                if (positions.length === 0) {
                    console.log(chalk.yellow('\n⚠️  No positions to manage.'));
                    await waitForUser();
                    continue;
                }

                const selectedPosition = await promptForPositionSelection(positions, 'Select a position to manage:');
                if (selectedPosition) {
                    await managePositionMenu(selectedPosition);
                }
                continue;

            } else if (action.includes('View Position Details')) {
                if (positions.length === 0) {
                    console.log(chalk.yellow('\n⚠️  No positions to inspect.'));
                    await waitForUser();
                    continue;
                }

                const selectedPosition = await promptForPositionSelection(positions, 'Select a position to inspect:');
                if (selectedPosition) {
                    await positionDetailMenu(selectedPosition);
                }
                continue;

            } else if (action.includes('Claim / Compound')) {
                await feeClaimingMenu(positions);
                continue;
            } else if (action.includes('Refresh Position Data')) {
                await refreshPositionData();
                continue; // Loop back to show updated data
            } else if (action.includes('Refresh Analytics')) {
                await captureAnalyticsSnapshots(positions, { source: 'manual' });
            } else if (action.includes('Rebalance Tools')) {
                if (positions.length === 0) {
                    console.log(chalk.yellow('\n⚠️  No positions to analyze.'));
                    await waitForUser();
                    continue;
                }

                const selectedPosition = await promptForPositionSelection(positions, 'Select a position to rebalance:');
                if (selectedPosition) {
                    await rebalanceAnalysisMenu(selectedPosition);
                }
                continue;
            } else if (action.includes('Back to Main Menu')) {
                return;
            }
        } catch (error: any) {
            if (error.message?.includes('force closed') || error.name === 'ExitPromptError') {
                throw error;
            }
            console.error(chalk.red('Error in positions menu:', error.message || 'Unknown error'));
            await waitForUser();
        }
    }
}

export async function newPositionMenu() {
    displayHeader();

    console.log(chalk.blue.bold('➕ CREATE NEW POSITION\n'));
    console.log(chalk.yellow('Step 1: Find a pool to provide liquidity\n'));

    try {
        const { poolOption } = await inquirer.prompt({
            type: 'list',
            name: 'poolOption',
            message: 'How would you like to find a pool?',
            choices: [
                new inquirer.Separator('═══ POOL DISCOVERY ═══'),
                '🔍 Search by Pool Address',
                '🏆 Browse Top Pools by TVL',
                '📈 Browse Top Pools by APR',
                '🔎 Find Token Pair',
                new inquirer.Separator('═══ NAVIGATION ═══'),
                '⬅️ Back to Main Menu'
            ],
            pageSize: 10
        });

        // Dynamic imports to avoid circular dependency
        const poolCommand = await import('./pool.command');

        if (poolOption.includes('Search by Pool Address')) {
            await poolCommand.searchPoolByAddress();
            // searchPoolByAddress handles the "Create Position" flow internally now via callback or direct call?
            // Wait, in pool.command.ts I made it call createPositionWorkflow.
            // So here we just call searchPoolByAddress and it might trigger the workflow.
            // But if searchPoolByAddress returns without triggering, we are back here.
            // The original code had:
            // await searchPoolByAddress();
            // const { proceed } = ...
            // if (proceed) await createPositionWorkflow();

            // In my new pool.command.ts, searchPoolByAddress DOES prompt for action.
            // So we don't need to do anything here.

        } else if (poolOption.includes('Browse Top Pools by TVL')) {
            await poolCommand.getTopPoolsByTVL();
            await createPositionWorkflow();
        } else if (poolOption.includes('Browse Top Pools by APR')) {
            await poolCommand.getTopPoolsByAPR();
            await createPositionWorkflow();
        } else if (poolOption.includes('Find Token Pair')) {
            await poolCommand.findTokenPair();
            await createPositionWorkflow();
        } else if (poolOption.includes('Back to Main Menu')) {
            return;
        }
    } catch (error: any) {
        if (error.message?.includes('force closed') || error.name === 'ExitPromptError') {
            throw error;
        }
        console.error(chalk.red('Error in new position menu:', error.message || 'Unknown error'));
        await waitForUser();
    }
}

export async function createPositionWorkflow(preselectedPoolAddress?: string) {
    console.log(chalk.blue.bold('\n📊 CREATE NEW POSITION\n'));

    try {
        // Step 1: Get pool address
        let poolAddress = preselectedPoolAddress;

        if (!poolAddress) {
            const poolAnswers = await inquirer.prompt({
                type: 'input',
                name: 'poolAddress',
                message: 'Enter pool address (Solana public key):',
            });
            poolAddress = poolAnswers.poolAddress;
        }

        if (!poolAddress || poolAddress.trim().length === 0) {
            console.log(chalk.yellow('\n❌ Pool address cannot be empty\n'));
            await waitForUser();
            return;
        }

        console.log(chalk.yellow('🔄 Fetching pool information...\n'));
        const poolInfo = await poolService.searchPoolByAddress(poolAddress);

        let rangeMarketContext: RangeRecommendationContext | undefined;
        try {
            rangeMarketContext = await marketContextService.buildRangeContext(poolInfo);
        } catch (contextError) {
            console.log(chalk.yellow(`⚠️  Could not build market context: ${contextError}`));
        }

        // STEP 1: FETCH POOL ACTIVE BIN & PRICE (Enhanced Display)
        console.log(chalk.green.bold('═'.repeat(65)));
        console.log(chalk.green.bold('│ STEP 1: POOL ACTIVE BIN & PRICE                              │'));
        console.log(chalk.green.bold('═'.repeat(65)));
        console.log();

        console.log(chalk.cyan.bold(`✅ Pool Found: ${poolInfo.tokenX.symbol}/${poolInfo.tokenY.symbol}`));
        console.log(chalk.gray(`   Address: ${poolAddress.slice(0, 8)}...${poolAddress.slice(-6)}`));
        console.log();

        console.log(chalk.blue.bold('📊 Active Bin Information:'));

        // Fetch and display active bin X/Y amounts (graceful fallback if unavailable)
        try {
            const activeBinDetails = await poolService.getActiveBinDetails(poolAddress);
            console.log(`   • Active Bin ID: ${chalk.yellow(poolInfo.activeBin.toString())}`);
            console.log(`   • Current Price: ${chalk.green(`$${poolInfo.price?.toFixed(6) || 'N/A'}`)} (${poolInfo.tokenX.symbol}/${poolInfo.tokenY.symbol})`);
            console.log(`   • Bin Liquidity: ${chalk.cyan(`${activeBinDetails.xAmount.toFixed(4)} ${poolInfo.tokenX.symbol}`)}`);
            console.log(`   •               ${chalk.cyan(`${activeBinDetails.yAmount.toFixed(4)} ${poolInfo.tokenY.symbol}`)}`);
            console.log(`   • Bin Step: ${poolInfo.binStep} bps (${(poolInfo.binStep / 100).toFixed(2)}% per bin)`);
            console.log(`   • TVL: ${chalk.cyan(`$${poolInfo.tvl?.toLocaleString() || 'N/A'}`)}`);
            console.log(`   • APR: ${chalk.magenta(`${poolInfo.apr?.toFixed(2) || 'N/A'}%`)}`);
        } catch (error) {
            // Gracefully fall back to basic pool info if active bin details unavailable
            console.log(`   • Active Bin ID: ${chalk.yellow(poolInfo.activeBin.toString())}`);
            console.log(`   • Current Price: ${chalk.green(`$${poolInfo.price?.toFixed(6) || 'N/A'}`)} (${poolInfo.tokenX.symbol}/${poolInfo.tokenY.symbol})`);
            console.log(`   • Bin Step: ${poolInfo.binStep} bps (${(poolInfo.binStep / 100).toFixed(2)}% per bin)`);
            console.log(`   • TVL: ${chalk.cyan(`$${poolInfo.tvl?.toLocaleString() || 'N/A'}`)}`);
            console.log(`   • APR: ${chalk.magenta(`${poolInfo.apr?.toFixed(2) || 'N/A'}%`)}`);
            console.log();
            console.log(chalk.gray.italic('ℹ️  Note: Real-time bin liquidity data unavailable for this pool.\n   Please verify the pool is an active DLMM pool on this network.'));
        }
        console.log();

        // Educational sidenote about active bin
        console.log(chalk.gray.italic('ℹ️  SIDENOTE - Active Bin Understanding:'));
        console.log(chalk.gray.italic('   The active bin is where trading currently happens. It\'s the ONLY bin'));
        console.log(chalk.gray.italic('   earning fees right now. Bin IDs are integers: negative bins (more'));
        console.log(chalk.gray.italic(`   ${poolInfo.tokenY.symbol}), positive bins (more ${poolInfo.tokenX.symbol}).`));
        console.log(chalk.gray.italic(`   With ${poolInfo.binStep} bps bin step, each bin = ${(poolInfo.binStep / 100).toFixed(2)}% price difference.`));
        console.log();

        if (rangeMarketContext?.volumeNodes?.length) {
            console.log(chalk.gray('On-chain liquidity shelves (top 3 by notional):'));
            rangeMarketContext.volumeNodes.slice(0, 3).forEach((node, idx) => {
                console.log(
                    chalk.gray(
                        `   ${idx + 1}. Price ~ ${node.price.toFixed(6)} (${(node.weight * 100).toFixed(1)}% of sampled depth)`
                    )
                );
            });
            console.log();
        }

        await waitForUser();

        const recommendationContext: RangeRecommendationContext = rangeMarketContext
            ? { ...rangeMarketContext, poolPrice: poolInfo.price }
            : { poolPrice: poolInfo.price };


        // ========== AI-POWERED STRATEGY ANALYSIS ==========
        console.log(chalk.cyan.bold('\n🤖 AI STRATEGY ANALYSIS\n'));
        console.log(chalk.gray('Analyzing pool characteristics, market data, and optimal strategy...'));

        let aiRecommendation = null;
        let useAI = false;

        try {
            console.log(chalk.gray(`\n  🔍 Checking LLM availability...`));
            const llmAvailable = llmAgent.isAvailable();
            console.log(chalk.gray(`  🔍 LLM Available: ${llmAvailable}`));

            if (llmAvailable) {
                // Create spinner for LLM analysis
                const spinner = ora({
                    text: chalk.cyan('Analyzing pool with AI (this may take 30-60 seconds)...'),
                    color: 'cyan',
                    spinner: 'dots12'
                }).start();

                try {
                    aiRecommendation = await llmAgent.analyzePoolForCreation(poolInfo);
                    spinner.succeed(chalk.green('AI analysis complete!'));
                } catch (error) {
                    spinner.fail(chalk.red('AI analysis failed'));
                    throw error;
                }

                // Display AI analysis
                console.log(chalk.green.bold('\n═══════════════════════════════════════════════════════════════'));
                console.log(chalk.green.bold('│ AI RECOMMENDATION                                           │'));
                console.log(chalk.green.bold('═══════════════════════════════════════════════════════════════\n'));

                console.log(chalk.cyan(`Strategy: ${chalk.bold(aiRecommendation.strategy)}`));
                console.log(chalk.cyan(`Confidence: ${chalk.bold(aiRecommendation.confidence + '%')} ${aiRecommendation.confidence >= 85 ? '(HIGH)' : aiRecommendation.confidence >= 70 ? '(MEDIUM)' : '(LOW)'}`));
                console.log(chalk.cyan(`Market Regime: ${aiRecommendation.marketRegime}\n`));

                console.log(chalk.yellow('Why This Strategy?'));
                aiRecommendation.reasoning.forEach((reason: string) => {
                    console.log(chalk.gray(`  ✓ ${reason}`));
                });
                console.log();

                console.log(chalk.blue('Recommended Configuration:'));
                console.log(chalk.gray(`  • Bid Bins: ${aiRecommendation.binConfiguration.bidBins}`));
                console.log(chalk.gray(`  • Ask Bins: ${aiRecommendation.binConfiguration.askBins}`));
                console.log(chalk.gray(`  • Total Range: ${aiRecommendation.binConfiguration.totalBins} bins`));
                console.log(chalk.gray(`  • Liquidity Split: ${aiRecommendation.liquidityDistribution.tokenXPercentage}% ${poolInfo.tokenX.symbol} / ${aiRecommendation.liquidityDistribution.tokenYPercentage}% ${poolInfo.tokenY.symbol}`));
                console.log();

                console.log(chalk.magenta('Expected Performance:'));
                console.log(chalk.gray(`  • Estimated APR: ~${aiRecommendation.expectedPerformance.estimatedAPR.toFixed(1)}%`));
                console.log(chalk.gray(`  • Fee Efficiency: ${aiRecommendation.expectedPerformance.feeEfficiency}%`));
                console.log(chalk.gray(`  • Rebalance Frequency: ${aiRecommendation.expectedPerformance.rebalanceFrequency}`));
                console.log();

                if (aiRecommendation.risks.length > 0) {
                    console.log(chalk.red('Risks:'));
                    aiRecommendation.risks.forEach((risk: string) => {
                        console.log(chalk.gray(`  ⚠️  ${risk}`));
                    });
                    console.log();
                }

                // Ask if user wants to apply AI recommendation
                const { useAiConfig } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'useAiConfig',
                    message: chalk.cyan('Apply AI recommendation automatically?'),
                    default: aiRecommendation.confidence >= 80
                });

                useAI = useAiConfig;

            } else {
                console.log(chalk.yellow('ℹ️  LLM not configured. Using algorithmic analysis.\n'));
                console.log(chalk.gray(`  🔍 Debug: llmAgent.isAvailable() returned false`));
            }
        } catch (error: any) {
            console.log(chalk.red(`\n❌ AI analysis error: ${error.message}`));
            console.log(chalk.gray(`  Error type: ${error.constructor.name}`));
            console.log(chalk.gray(`  Stack: ${error.stack?.split('\n')[0] || 'N/A'}`));
            console.log(chalk.yellow(`ℹ️  Falling back to algorithmic guidance.\n`));
        }

        // Algorithmic fallback (always show for comparison or if AI unavailable)
        if (!useAI) {
            const strategyRecommendation = recommendStrategyForPool(poolInfo, recommendationContext);
            console.log(chalk.cyan('\n📊 Algorithmic Strategy Guidance'));
            console.log(
                `   Suggested: ${chalk.bold(strategyRecommendation.strategy)} (${strategyRecommendation.confidence} confidence)`
            );
            strategyRecommendation.reasons.forEach((reason) => {
                console.log(`   • ${reason}`);
            });
            console.log(
                `   ATR Drift: ${(strategyRecommendation.metrics.atrPercent * 100).toFixed(2)}% (${strategyRecommendation.metrics.atrState})`
            );
            console.log();
        }

        // Step 2: Choose strategy (use AI if accepted, otherwise ask user)
        let strategyAnswers;

        if (useAI && aiRecommendation) {
            // Auto-apply AI recommendation
            console.log(chalk.green(`✅ Using AI-recommended strategy: ${aiRecommendation.strategy}\n`));
            strategyAnswers = { strategy: aiRecommendation.strategy };
        } else {
            // Manual selection with algorithmic fallback default
            const strategyRecommendation = recommendStrategyForPool(poolInfo, recommendationContext);
            strategyAnswers = await inquirer.prompt({
                type: 'list',
                name: 'strategy',
                message: 'Choose liquidity provision strategy:',
                choices: [
                    new inquirer.Separator('=== STRATEGIES ==='),
                    {
                        name: '🎯 Spot (Balanced) - 50/50 distribution around current price',
                        value: 'Spot',
                    },
                    {
                        name: '📈 Curve (Concentrated) - Concentrated around peg with wider range',
                        value: 'Curve',
                    },
                    {
                        name: '📍 Bid-Ask (Custom) - Specify exact bin ranges',
                        value: 'BidAsk',
                    },
                ],
                default: strategyRecommendation.strategy,
            });
        }

        let rangeRecommendation: RangeRecommendation | null = null;
        let useVpvrRecommendation = true;

        // Only use VPVR recommendation if AI is not being used
        if (!useAI) {
            try {
                rangeRecommendation = await rangeRecommenderService.suggestRange(
                    strategyAnswers.strategy as 'Spot' | 'Curve' | 'BidAsk',
                    poolInfo,
                    recommendationContext
                );
            } catch (error) {
                console.log(chalk.yellow(`⚠️  Could not build range recommendation: ${error}`));
            }

            if (rangeRecommendation) {
                if (useVpvrRecommendation) {
                    console.log(chalk.cyan('\n🧠 Suggested Range Configuration:'));
                    const volPct = (rangeRecommendation.metrics.volatilityScore * 100).toFixed(1);
                    const devPct = (rangeRecommendation.metrics.priceDeviation * 100).toFixed(1);
                    console.log(`  • Strategy: ${rangeRecommendation.strategy}`);
                    if (strategyAnswers.strategy === 'BidAsk') {
                        console.log(`  • Bid bins: ${rangeRecommendation.recommendedBidBins ?? '-'} | Ask bins: ${rangeRecommendation.recommendedAskBins ?? '-'}`);
                    } else {
                        console.log(`  • Recommended bins per side: ${rangeRecommendation.recommendedBinsPerSide ?? '-'}`);
                    }
                    console.log(`  • Range: ${rangeRecommendation.minBinId} → ${rangeRecommendation.maxBinId}`);
                    console.log(`  • Volatility score: ${volPct}% | Oracle deviation: ${devPct}%`);
                    rangeRecommendation.rationale.forEach((note) => {
                        console.log(`     - ${note}`);
                    });
                    console.log();
                }

                const toggleAnswer = await inquirer.prompt({
                    type: 'confirm',
                    name: 'useVpvrRecommendation',
                    message: 'Use VPVR-guided range (recommended) instead of symmetric range?',
                    default: true,
                });
                useVpvrRecommendation = toggleAnswer.useVpvrRecommendation;
            }
        } else {
            // When using AI, skip VPVR and let AI recommendations drive the configuration
            useVpvrRecommendation = false;
        }

        // Determine strategy-specific bin defaults based on Meteora recommendations
        const getDefaultBinsPerSide = (strategy: string): number => {
            switch (strategy) {
                case 'Curve':
                    return 2; // Concentrated liquidity for stablecoins (1-3 bins recommended)
                case 'BidAsk':
                    return 25; // Spread distribution for volatile pairs (20-30 bins recommended)
                case 'Spot':
                default:
                    return 20; // Balanced distribution (standard default)
            }
        };

        // Step 3: Configure range first (if BidAsk) so we know the bin range for Y calculation
        let minBinId: number | undefined;
        let maxBinId: number | undefined;
        let binsPerSide: number | undefined;
        let centerBinOverride: number | undefined;

        if (strategyAnswers.strategy === 'BidAsk') {
            console.log(chalk.blue(`\nCurrent Active Bin: ${poolInfo.activeBin}`));

            // Determine default values based on AI or VPVR recommendations
            let defaultMinBinId: number;
            let defaultMaxBinId: number;

            if (useAI && aiRecommendation?.binConfiguration) {
                // Use AI recommendations for defaults
                const bidBins = aiRecommendation.binConfiguration.bidBins || 0;
                const askBins = aiRecommendation.binConfiguration.askBins || 0;
                defaultMinBinId = poolInfo.activeBin - bidBins;
                defaultMaxBinId = poolInfo.activeBin + askBins;

                // Show AI recommendation context
                console.log(chalk.cyan(`\n💡 AI Recommendation:`));
                console.log(chalk.gray(`   Bid Bins: ${bidBins} → Min Bin ID: ${defaultMinBinId}`));
                console.log(chalk.gray(`   Ask Bins: ${askBins} → Max Bin ID: ${defaultMaxBinId}`));
                console.log(chalk.gray(`   (Press Enter to accept AI defaults, or type custom values)\n`));
            } else if (useVpvrRecommendation && rangeRecommendation?.minBinId !== undefined) {
                // Use VPVR recommendations
                defaultMinBinId = rangeRecommendation.minBinId;
                defaultMaxBinId = rangeRecommendation.maxBinId!;
            } else {
                // Default fallback
                defaultMinBinId = poolInfo.activeBin - 20;
                defaultMaxBinId = poolInfo.activeBin + 20;
            }

            const rangeAnswers = await inquirer.prompt([
                {
                    type: 'number',
                    name: 'minBinId',
                    message: 'Enter minimum bin ID:',
                    default: defaultMinBinId,
                },
                {
                    type: 'number',
                    name: 'maxBinId',
                    message: 'Enter maximum bin ID:',
                    default: defaultMaxBinId,
                },
            ]);
            minBinId = rangeAnswers.minBinId;
            maxBinId = rangeAnswers.maxBinId;
            centerBinOverride = useVpvrRecommendation
                ? rangeRecommendation?.centerBin ?? poolInfo.activeBin
                : poolInfo.activeBin;
        } else {
            const defaultBinsPerSide = rangeRecommendation?.recommendedBinsPerSide ?? getDefaultBinsPerSide(strategyAnswers.strategy);
            const binsAnswers = await inquirer.prompt({
                type: 'number',
                name: 'binsPerSide',
                message: 'Number of bins to each side of center:',
                default: defaultBinsPerSide,
                validate: (value) => {
                    if (value < 1) return 'Must be at least 1 bin';
                    if (value > 34) return 'Maximum 34 bins per side (69 total limit per DLMM protocol)';
                    return true;
                },
            });
            binsPerSide = binsAnswers.binsPerSide;
            const binsValue = binsPerSide ?? defaultBinsPerSide;

            const suggestedCenter = useVpvrRecommendation
                ? rangeRecommendation?.centerBin ?? poolInfo.activeBin
                : poolInfo.activeBin;
            centerBinOverride = suggestedCenter;
            minBinId = suggestedCenter - binsValue;
            maxBinId = suggestedCenter + binsValue;
        }

        // Step 4: Enter X Token Amount (ENHANCED with auto Y calculation)
        console.log(chalk.yellow(`\n💰 Enter deposit amount:`));

        // Show AI liquidity split recommendation if available (display only, no auto-fill)
        if (useAI && aiRecommendation?.liquidityDistribution) {
            const tokenXPercentage = aiRecommendation.liquidityDistribution.tokenXPercentage;
            const tokenYPercentage = aiRecommendation.liquidityDistribution.tokenYPercentage;

            console.log(chalk.cyan(`\n💡 AI Liquidity Split Recommendation:`));
            console.log(chalk.gray(`   ${tokenXPercentage}% ${poolInfo.tokenX.symbol} / ${tokenYPercentage}% ${poolInfo.tokenY.symbol}`));
            console.log(chalk.gray(`   (Adjust your deposit amounts to match this ratio)\n`));
        }

        const amountXAnswer = await inquirer.prompt([
            {
                type: 'number',
                name: 'amountX',
                message: `Amount of ${poolInfo.tokenX.symbol} to deposit:`,
                validate: (value) => value > 0 ? true : 'Amount must be greater than 0',
            }
        ]);

        const amountX = amountXAnswer.amountX;

        // Step 5: AUTO-CALCULATE Y AMOUNT (CRITICAL ENHANCEMENT)
        console.log(chalk.blue.bold('\n🧮 Calculating optimal Y amount based on strategy...\n'));

        let amountY = 0;
        try {
            // If using AI and it has a liquidity distribution recommendation, use that ratio
            if (useAI && aiRecommendation?.liquidityDistribution) {
                const tokenXPercentage = aiRecommendation.liquidityDistribution.tokenXPercentage / 100;
                const tokenYPercentage = aiRecommendation.liquidityDistribution.tokenYPercentage / 100;
                const currentPrice = poolInfo.price || 1;

                // Calculate Y amount based on AI's recommended split
                // Value of X in USD: amountX * priceX
                // We want: (valueX / (valueX + valueY)) = tokenXPercentage
                // So: valueY = (valueX * tokenYPercentage) / tokenXPercentage
                const valueX = amountX * currentPrice;
                const valueY = (valueX * tokenYPercentage) / tokenXPercentage;
                amountY = valueY; // USDC is already in USD terms

                console.log(chalk.green.bold('✅ Y Amount Calculated!'));
                console.log(chalk.cyan(`Auto-calculated ${poolInfo.tokenY.symbol}: ${chalk.yellow(amountY.toFixed(6))}`));
                console.log(chalk.gray(`(Based on AI's ${aiRecommendation.liquidityDistribution.tokenXPercentage}%/${aiRecommendation.liquidityDistribution.tokenYPercentage}% split recommendation)\n`));
            } else {
                // Standard calculation based on bin range and strategy
                // Map string strategy to StrategyType enum
                const strategyTypeEnum = strategyAnswers.strategy === 'Spot' ? StrategyType.Spot :
                    strategyAnswers.strategy === 'Curve' ? StrategyType.Curve : StrategyType.BidAsk;

                // Calculate bin range for Y calculation
                let calcMinBinId = minBinId;
                let calcMaxBinId = maxBinId;

                if (typeof calcMinBinId !== 'number' || typeof calcMaxBinId !== 'number') {
                    // For Spot/Curve strategies, calculate from binsPerSide
                    calcMinBinId = poolInfo.activeBin - (binsPerSide || 20);
                    calcMaxBinId = poolInfo.activeBin + (binsPerSide || 20);
                }

                amountY = await liquidityService.calculateOptimalYAmount(
                    poolAddress,
                    amountX,
                    calcMinBinId,
                    calcMaxBinId,
                    strategyTypeEnum
                );

                console.log(chalk.green.bold('✅ Y Amount Calculated!\n'));
                console.log(chalk.cyan(`Auto-calculated ${poolInfo.tokenY.symbol}: ${chalk.yellow(amountY.toFixed(6))}`));
                console.log(chalk.gray(`(Based on ${strategyAnswers.strategy} strategy distribution)\n`));
            }

            // Check Price Health
            const health = await liquidityService.checkPriceHealth(poolAddress);
            if (!health.isHealthy && health.oraclePrice) {
                console.log(chalk.red.bold('\n⚠️  CRITICAL PRICE WARNING ⚠️'));
                console.log(chalk.yellow(`The pool price is significantly different from the Oracle price.`));
                console.log(chalk.yellow(`Pool Price:   ${health.poolPrice.toFixed(6)}`));
                console.log(chalk.yellow(`Oracle Price: ${health.oraclePrice.toFixed(6)}`));
                console.log(chalk.yellow(`Deviation:    ${(health.deviation * 100).toFixed(0)}%`));
                console.log(chalk.red(`Providing liquidity at this price may result in immediate loss.`));

                const { confirmContinue } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirmContinue',
                    message: 'Do you want to continue despite this warning?',
                    default: false
                });

                if (!confirmContinue) {
                    console.log(chalk.yellow('Operation cancelled by user.'));
                    return;
                }
            }

            // Calculate the implied price from the calculation
            const impliedPrice = amountY / amountX;
            const activePrice = poolInfo.price || 1;
            const priceDev = Math.abs((impliedPrice - activePrice) / activePrice);

            // If there's significant price deviation detected by Oracle, inform user
            if (priceDev > 0.5) {
                console.log(chalk.yellow.bold('⚠️  PRICE MISMATCH DETECTED!\n'));
                console.log(chalk.yellow(`   Pool Price: 1 ${poolInfo.tokenX.symbol} = ${activePrice.toFixed(6)} ${poolInfo.tokenY.symbol}`));
                console.log(chalk.yellow(`   Oracle Price: 1 ${poolInfo.tokenX.symbol} = ${impliedPrice.toFixed(6)} ${poolInfo.tokenY.symbol}`));
                console.log(chalk.yellow(`   Deviation: ${(priceDev * 100).toFixed(1)}%\n`));
                console.log(chalk.gray('The Oracle integration has detected that the pool price differs'));
                console.log(chalk.gray('significantly from the market price. The calculation above uses the'));
                console.log(chalk.gray('Oracle price to ensure you deposit amounts that match market rates.\n'));
            }

            // ENHANCED: Sanity check for calculated Y amount
            // If Y is suspiciously small relative to X, offer manual override
            const isSuspicious = amountY < 0.0001 || impliedPrice < 0.001;

            if (isSuspicious) {
                console.log(chalk.yellow('⚠️  Warning: Calculated Y amount seems unusually small relative to X amount'));
                console.log(chalk.yellow(`   Implied price: 1 ${poolInfo.tokenX.symbol} = ${impliedPrice.toFixed(8)} ${poolInfo.tokenY.symbol}`));
                console.log(chalk.yellow(`   This might indicate the pool data is inverted or in an extreme state.\n`));

                // Offer user choice to override with manual entry
                const { useManualEntry } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'useManualEntry',
                        message: `Would you like to enter a different ${poolInfo.tokenY.symbol} amount manually?`,
                        default: true
                    }
                ]);

                if (useManualEntry) {
                    const manualAnswer = await inquirer.prompt([
                        {
                            type: 'number',
                            name: 'amountY',
                            message: `Amount of ${poolInfo.tokenY.symbol} to deposit:`,
                            validate: (value) => value > 0 ? true : 'Amount must be greater than 0',
                        }
                    ]);
                    amountY = manualAnswer.amountY;
                    console.log(chalk.cyan(`\n✅ Using manual entry: ${amountY.toFixed(6)} ${poolInfo.tokenY.symbol}\n`));
                }
            }

            await waitForUser();
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not auto-calculate Y amount: ${error}`));
            console.log(chalk.yellow(`Please enter ${poolInfo.tokenY.symbol} amount manually.\n`));

            const amountYAnswer = await inquirer.prompt([
                {
                    type: 'number',
                    name: 'amountY',
                    message: `Amount of ${poolInfo.tokenY.symbol} to deposit:`,
                    validate: (value) => value > 0 ? true : 'Amount must be greater than 0',
                }
            ]);
            amountY = amountYAnswer.amountY;
        }

        // Step 5.5: ENHANCED - Validate Wallet Balance
        console.log(chalk.blue.bold('\n🔍 Validating wallet balance...'));
        try {
            const keypair = walletService.getActiveKeypair();
            if (!keypair) {
                throw new Error('No active wallet found');
            }

            const connection = connectionService.getConnection();
            const tokenXMint = new PublicKey(poolInfo.tokenX.mint);
            const tokenYMint = new PublicKey(poolInfo.tokenY.mint);

            // Get current balances for display
            let currentBalances = await getWalletBalances(
                connection,
                keypair.publicKey,
                tokenXMint,
                tokenYMint
            );

            const printBalances = (title: string, balances: WalletBalances) => {
                console.log(chalk.cyan(`\n${title}`));
                console.log(`   • SOL: ${chalk.yellow(balances.solBalance.toFixed(4))}`);
                console.log(`   • ${poolInfo.tokenX.symbol}: ${chalk.yellow(balances.tokenXBalance.toFixed(4))}`);
                console.log(`   • ${poolInfo.tokenY.symbol}: ${chalk.yellow(balances.tokenYBalance.toFixed(4))}`);
                console.log();
            };

            printBalances('📊 Current Wallet Balances:', currentBalances);

            console.log(chalk.cyan('📋 Required Amounts:'));
            console.log(`   • ${poolInfo.tokenX.symbol}: ${chalk.yellow(amountX.toFixed(6))}`);
            console.log(`   • ${poolInfo.tokenY.symbol}: ${chalk.yellow(amountY.toFixed(6))}`);
            console.log();

            // Validate sufficient balance
            let validationResult = await validateWalletBalance(
                connection,
                keypair.publicKey,
                tokenXMint,
                tokenYMint,
                amountX,
                amountY
            );

            const showErrors = () => {
                console.log(chalk.red.bold('❌ Insufficient Balance:'));
                validationResult.errors.forEach(error => {
                    console.log(chalk.red(`   • ${error}`));
                });
                console.log();
            };

            if (!validationResult.isValid) {
                showErrors();
            }

            let autoSwapPerformed = false;
            while (!validationResult.isValid) {
                const swapFixed = await maybeHandleAutoSwapShortfalls({
                    poolInfo,
                    poolAddress,
                    amountX,
                    amountY,
                    balances: currentBalances,
                });

                if (!swapFixed) {
                    break;
                }

                autoSwapPerformed = true;
                console.log(chalk.cyan('\n🔁 Swap executed. Re-checking wallet balances...'));
                currentBalances = await getWalletBalances(
                    connection,
                    keypair.publicKey,
                    tokenXMint,
                    tokenYMint
                );
                printBalances('📊 Updated Wallet Balances:', currentBalances);

                validationResult = await validateWalletBalance(
                    connection,
                    keypair.publicKey,
                    tokenXMint,
                    tokenYMint,
                    amountX,
                    amountY
                );

                if (!validationResult.isValid) {
                    console.log(chalk.red.bold('❌ Remaining shortfall detected:'));
                    validationResult.errors.forEach(error => {
                        console.log(chalk.red(`   • ${error}`));
                    });
                    console.log();
                }
            }

            if (!validationResult.isValid) {
                // Ask user if they want to continue anyway
                const continueAnswer = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'continue',
                    message: 'Continue despite insufficient balance?',
                    default: false,
                }]);

                if (!continueAnswer.continue) {
                    console.log(chalk.yellow('📍 Position creation cancelled.'));
                    return;
                }
            } else if (validationResult.warnings.length > 0) {
                console.log(chalk.yellow('⚠️  Warnings:'));
                validationResult.warnings.forEach(warning => {
                    console.log(chalk.yellow(`   ${warning}`));
                });
                if (autoSwapPerformed) {
                    console.log(chalk.yellow('   • Auto swap completed to balance tokens.'));
                }
                console.log();
            } else {
                const successMsg = autoSwapPerformed
                    ? '✅ Wallet balance validated after auto swap!'
                    : '✅ Wallet balance validated successfully!';
                console.log(chalk.green(successMsg));
                console.log();
            }

            await waitForUser();
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not validate wallet balance: ${error}`));
            console.log(chalk.yellow('   Proceeding with position creation...'));
            console.log();
            await waitForUser();
        }

        const transactionConfig = configManager.getConfig().transaction;
        const { slippage: sessionSlippage, priorityFeeOptions } = await promptTransactionOverrides(transactionConfig);

        // Prepare position creation
        console.log(chalk.yellow('\nCalculating position details...\n'));

        const positionParams = {
            poolAddress: poolAddress,
            strategy: strategyAnswers.strategy as 'Spot' | 'Curve' | 'BidAsk',
            amountX: amountX,
            amountY: amountY,
            binsPerSide,
            minBinId,
            maxBinId,
            centerBinOverride,
            slippage: sessionSlippage,
            priorityFeeOptions,
        };

        // Validate parameters
        const validation = positionService.validatePositionParams(positionParams, poolInfo);
        if (!validation.valid) {
            console.log(chalk.red('❌ Validation errors:\n'));
            validation.errors.forEach((err) => console.log(`  • ${err}`));
            console.log();
            await waitForUser();
            return;
        }

        // Prepare the position
        const prepared = await positionService.preparePositionCreation(positionParams, poolInfo);

        // ENHANCED Step 6: Preview Distribution with Cost & APR Analysis
        console.log(chalk.green('\n✅ POSITION PREVIEW:\n'));
        console.log(chalk.blue.bold('Strategy Configuration:'));
        console.log(`  Strategy: ${prepared.rangeConfig.strategy}`);
        console.log(`  Bin Range: ${prepared.rangeConfig.minBinId} → ${prepared.rangeConfig.maxBinId}`);
        console.log(`  Center Bin: ${prepared.rangeConfig.centerBin}`);
        if (rangeRecommendation) {
            console.log(chalk.gray('  Range Rationale:'));
            rangeRecommendation.rationale.forEach((note, idx) => {
                console.log(chalk.gray(`    ${idx + 1}. ${note}`));
            });
            if (centerBinOverride && centerBinOverride !== poolInfo.activeBin) {
                console.log(chalk.gray(`    Shifted ${centerBinOverride - poolInfo.activeBin} bins from active center based on recommendation`));
            }
        }
        // Handle extremely small or large prices properly
        const formatPrice = (price: number) => {
            if (price === 0) return '0.000000';
            if (price < 1e-6) return price.toExponential(3);
            if (price > 1e6) return price.toExponential(3);
            return price.toFixed(6);
        };

        console.log(`  Price Range: ${formatPrice(prepared.rangeConfig.binPrice.minPrice)} - ${formatPrice(prepared.rangeConfig.binPrice.maxPrice)}\n`);

        console.log(chalk.blue.bold('Estimated Token Deposit:'));
        console.log(`  ${poolInfo.tokenX.symbol}: ${prepared.tokenXAmount}`);
        console.log(`  ${poolInfo.tokenY.symbol}: ${prepared.tokenYAmount}\n`);

        // Calculate and display cost breakdown & APR
        try {
            const costAnalysis = await feeService.analyzePositionCosts(poolInfo, amountX, amountY);

            console.log(chalk.blue.bold('💰 Cost Breakdown:'));
            console.log(`  Rent (position account): ${chalk.yellow(`${costAnalysis.rentCostSOL.toFixed(4)} SOL`)}`);
            console.log(`  Transaction Fees: ${chalk.yellow(`${costAnalysis.transactionFeesSOL.toFixed(6)} SOL`)}`);
            console.log(`  Total Initial Cost: ${chalk.cyan(`${costAnalysis.totalInitialCostSOL.toFixed(5)} SOL`)}`);
            console.log();

            console.log(chalk.blue.bold('📊 Liquidity Value & Returns:'));
            const usdValuePrefix = costAnalysis.isUsdEstimate ? '≈' : '';
            console.log(`  Position Value: ${chalk.cyan(`${usdValuePrefix}$${costAnalysis.totalValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)} USD`);
            console.log(`  (${poolInfo.tokenX.symbol}: $${costAnalysis.tokenXValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })} | ${poolInfo.tokenY.symbol}: $${costAnalysis.tokenYValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })})`);

            const describeSource: Record<'oracle' | 'pool-derived' | 'missing', string> = {
                oracle: 'oracle quote',
                'pool-derived': 'derived via pool price',
                missing: 'unavailable',
            };
            const formatUsdInput = (value: number | null) =>
                value === null ? 'N/A' : `$${value.toLocaleString(undefined, { maximumFractionDigits: value > 1 ? 4 : 6 })}`;

            console.log(chalk.gray('  USD Inputs:'));
            console.log(chalk.gray(`    • ${poolInfo.tokenX.symbol}: ${formatUsdInput(costAnalysis.tokenXUsdPrice)} (${describeSource[costAnalysis.usdPriceSources.tokenX]})`));
            console.log(chalk.gray(`    • ${poolInfo.tokenY.symbol}: ${formatUsdInput(costAnalysis.tokenYUsdPrice)} (${describeSource[costAnalysis.usdPriceSources.tokenY]})`));

            if (costAnalysis.usdValuationWarnings.length) {
                console.log(chalk.yellow('  ⚠️  USD Valuation Notes:'));
                costAnalysis.usdValuationWarnings.forEach((warning) =>
                    console.log(chalk.yellow(`    • ${warning}`))
                );
            }
            console.log();

            console.log(chalk.blue.bold('📈 Estimated Annual APY:'));
            console.log(`  Annual: ${chalk.magenta(`${costAnalysis.estimatedAnnualAPY.toFixed(2)}%`)}`);
            console.log(`  Monthly: ${chalk.cyan(`${costAnalysis.estimatedMonthlyAPY.toFixed(2)}%`)}`);
            console.log(`  Weekly: ${chalk.cyan(`${costAnalysis.estimatedWeeklyAPY.toFixed(2)}%`)}`);
            console.log(`  Daily: ${chalk.cyan(`${costAnalysis.estimatedDailyAPY.toFixed(3)}%`)}\n`);

            // Validation checklist
            console.log(chalk.blue.bold('✓ Validation Checklist:'));
            const checks = [
                { pass: costAnalysis.totalInitialCostSOL <= 0.25, msg: '✓ Position cost below 0.25 SOL' },
                { pass: costAnalysis.totalValueUSD >= 25, msg: '✓ Position size at least $25' },
                { pass: costAnalysis.hasFullOracleCoverage, msg: '✓ Oracle USD coverage confirmed' },
                { pass: costAnalysis.estimatedAnnualAPY >= 5, msg: '✓ APY meets 5% minimum target' },
                { pass: prepared.rangeConfig.maxBinId - prepared.rangeConfig.minBinId <= 69, msg: '✓ Within 69-bin protocol limit' },
                { pass: poolInfo.isActive, msg: '✓ Pool is active' },
            ];

            checks.forEach((check, idx) => {
                if (check.pass) {
                    console.log(chalk.green(`  ${idx + 1}. ${check.msg}`));
                } else {
                    console.log(chalk.yellow(`  ${idx + 1}. ⚠️  ${check.msg}`));
                }
            });
            console.log();

        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not calculate cost analysis: ${error}\n`));
        }

        // Step 7: Confirm & Execute
        const confirmAnswers = await inquirer.prompt({
            type: 'confirm',
            name: 'confirm',
            message: 'Create position with these settings?',
            default: false,
        });

        if (!confirmAnswers.confirm) {
            console.log(chalk.yellow('\n❌ Position creation cancelled\n'));
            await waitForUser();
            return;
        }

        // ENHANCED Step 7: Execute with Progress Indicators & Error Handling
        console.log(chalk.yellow('\n🔄 Creating position... (This requires signing a transaction)\n'));

        // Show progress steps
        const progressSteps = [
            { msg: 'Preparing transaction', symbol: '⏳' },
            { msg: 'Signing transaction', symbol: '🔑' },
            { msg: 'Sending to network', symbol: '📡' },
            { msg: 'Confirming transaction', symbol: '✅' }
        ];

        let currentStep = 0;
        const showProgress = () => {
            if (currentStep < progressSteps.length) {
                const step = progressSteps[currentStep];
                console.log(chalk.cyan(`  ${step.symbol} ${step.msg}...`));
            }
        };

        // Start showing progress
        showProgress();

        try {
            // Increment step
            currentStep = 1;
            showProgress();

            const result = await positionService.executePositionCreation(positionParams, prepared);

            if (result.status === 'success') {
                // Show success
                console.log(chalk.green(`\n✅ Transaction Confirmed!\n`));
                console.log(chalk.green.bold('✅ POSITION CREATED SUCCESSFULLY!\n'));
                console.log(chalk.cyan('📍 Position Details:'));
                console.log(`   Address: ${chalk.yellow(result.positionAddress)}`);
                console.log(`   Signature: ${chalk.yellow(result.depositSignature.slice(0, 20))}...`);
                console.log(`   Token X: ${result.tokenXAmount.toFixed(6)} ${poolInfo.tokenX.symbol}`);
                console.log(`   Token Y: ${result.tokenYAmount.toFixed(6)} ${poolInfo.tokenY.symbol}`);
                console.log(`   Range: ${result.minBinId} → ${result.maxBinId}`);
                console.log(`   Strategy: ${result.strategy}\n`);
                console.log(chalk.gray('💡 Use "My Positions" to view and manage this position.'));
                console.log(chalk.gray('💡 Use "Monitor Positions" to track performance.\n'));

                // Optionally save to local storage (Phase 3 feature)
                try {
                    // This could be extended to save position data locally
                    // await analyticsDataStore.recordPositionCreated({ ... });
                } catch (e) {
                    // Silent fail if storage not available
                }

            } else {
                console.log(chalk.red.bold('\n❌ POSITION CREATION FAILED\n'));
                console.log(chalk.red('Error Details:'));

                // Parse and display specific error messages
                const errorMsg = result.errorMessage || 'Unknown error';
                if (errorMsg.includes('insufficient funds')) {
                    console.log(chalk.red('   • Insufficient funds to complete the transaction'));
                    console.log(chalk.yellow('   💡 Tip: Add more SOL or reduce deposit amounts'));
                } else if (errorMsg.includes('slippage')) {
                    console.log(chalk.red('   • Price slippage exceeded tolerance'));
                    console.log(chalk.yellow('   💡 Tip: Try again or increase slippage tolerance'));
                } else if (errorMsg.includes('timeout')) {
                    console.log(chalk.red('   • Transaction confirmation timed out'));
                    console.log(chalk.yellow('   💡 Tip: Network may be congested. Try again in a moment.'));
                } else if (errorMsg.includes('invalid')) {
                    console.log(chalk.red('   • Invalid transaction parameters'));
                    console.log(chalk.yellow('   💡 Tip: Check your inputs and pool configuration'));
                } else {
                    console.log(chalk.red(`   • ${errorMsg}`));
                }
                console.log();
            }

        } catch (error) {
            // Handle unexpected errors
            console.log(chalk.red.bold('\n❌ UNEXPECTED ERROR\n'));
            console.log(chalk.red('Error Details:'));

            const errorMsg = error instanceof Error ? error.message : String(error);

            if (errorMsg.includes('User rejected')) {
                console.log(chalk.red('   • Transaction signing cancelled by user'));
            } else if (errorMsg.includes('network')) {
                console.log(chalk.red('   • Network connection error'));
                console.log(chalk.yellow('   💡 Tip: Check your internet connection'));
            } else if (errorMsg.includes('wallet')) {
                console.log(chalk.red('   • Wallet configuration error'));
                console.log(chalk.yellow('   💡 Tip: Verify your wallet is properly configured'));
            } else {
                console.log(chalk.red(`   • ${errorMsg}`));
            }

            console.log(chalk.gray('\n📋 For support, check the docs or retry the operation.\n'));
        }
    } catch (error) {
        console.log(chalk.red(`\n❌ Outer error: ${error}\n`));
    }

    await waitForUser();
}

async function managePositionMenu(position: any) {
    console.clear();
    console.log(chalk.blue.bold(`🔧 MANAGING POSITION: ${position.publicKey.slice(0, 8)}...`));
    console.log(`Pool: ${position.tokenX.symbol}/${position.tokenY.symbol}`);
    console.log(`Range: ${position.lowerBinId} - ${position.upperBinId}`);
    console.log(`Liquidity: ${position.tokenX.uiAmount?.toFixed(6) || 0} ${position.tokenX.symbol} / ${position.tokenY.uiAmount?.toFixed(6) || 0} ${position.tokenY.symbol}`);
    console.log(`Unclaimed Fees: ${position.unclaimedFees.xUi?.toFixed(6) || 0} ${position.tokenX.symbol} / ${position.unclaimedFees.yUi?.toFixed(6) || 0} ${position.tokenY.symbol}\n`);

    const { action } = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: 'Choose action:',
        choices: [
            // '➕ Add Liquidity (Not implemented in CLI yet)',
            '➖ Remove Liquidity',
            '🚫 Close Position',
            '🔙 Back'
        ]
    });

    if (action.includes('Remove Liquidity')) {
        await removeLiquidityWorkflow(position);
    } else if (action.includes('Close Position')) {
        await closePositionWorkflow(position);
    }
}

async function removeLiquidityWorkflow(position: any) {
    console.log(chalk.blue.bold('\n➖ REMOVE LIQUIDITY\n'));

    const { percent } = await inquirer.prompt({
        type: 'number',
        name: 'percent',
        message: 'Enter percentage to remove (1-100):',
        validate: (val) => val > 0 && val <= 100 ? true : 'Enter 1-100'
    });

    const bps = Math.floor(percent * 100); // 100% = 10000 bps

    const { confirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `Remove ${percent}% liquidity from this position?`,
        default: false
    });

    if (!confirm) return;

    try {
        console.log(chalk.yellow('Removing liquidity...'));
        const activeWallet = walletService.getActiveWallet();
        if (!activeWallet) throw new Error("No active wallet");

        // If 100%, asking if we should close? 
        // removeLiquidity param 'shouldClaimAndClose' is handy.
        const shouldClose = percent === 100;

        const sigs = await liquidityService.removeLiquidity({
            positionPubKey: new PublicKey(position.publicKey),
            poolAddress: position.poolAddress,
            userPublicKey: new PublicKey(activeWallet.publicKey),
            bps: bps,
            shouldClaimAndClose: shouldClose
        });

        console.log(chalk.green.bold('\n✅ LIQUIDITY REMOVED!'));
        sigs.forEach(s => console.log(`Sig: ${s}`));

        if (shouldClose) {
            console.log(chalk.green('Position closed and rent reclaimed.'));
        }

        await waitForUser();

    } catch (e: any) {
        console.log(chalk.red(`\n❌ Failed: ${e.message || e}`));
        await waitForUser();
    }
}

async function feeClaimingMenu(positions: UserPosition[]): Promise<void> {
    console.clear();
    console.log(chalk.blue.bold('💰 FEE CLAIMING CENTER'));

    const claimable = getClaimablePositions(positions);
    if (claimable.length === 0) {
        console.log(chalk.yellow('\nNo claimable fees detected. Earn some fees first or refresh analytics.'));
        await waitForUser();
        return;
    }

    const totalUsd = claimable.reduce((sum, pos) => sum + (pos.unclaimedFees.usdValue ?? 0), 0);
    console.log(chalk.cyan(`\nPending Positions: ${claimable.length}`));
    console.log(chalk.cyan(`Claimable USD: ${formatUsd(totalUsd)}`));

    claimable.forEach((pos, idx) => {
        const ageLabel = describeFeeAge(pos);
        console.log(`\n${idx + 1}. ${buildPositionLabel(pos)}`);
        console.log(`   Fees: ${formatUsd(pos.unclaimedFees.usdValue ?? 0)} (${formatFeeBreakdownForPosition(pos)})`);
        console.log(`   Age: ${ageLabel}`);
    });

    try {
        const estimate = await feeService.estimateClaimCost(claimable.length);
        const solCost = `${estimate.totalSol.toFixed(6)} SOL`;
        const usdCost = estimate.totalUsd ? ` (${formatUsd(estimate.totalUsd)})` : '';
        console.log(chalk.gray(`\n⚙️  Estimated Transaction Fees: ${solCost}${usdCost}`));
    } catch (error) {
        console.log(chalk.gray(`\n⚙️  Unable to estimate transaction fees: ${error instanceof Error ? error.message : error}`));
    }

    const { action } = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: '\nChoose a fee action:',
        choices: [
            'Claim all pending fees',
            'Claim fees for a specific position',
            'Claim & compound a position',
            '⬅️ Back'
        ],
    });

    if (action.includes('Claim all')) {
        const { confirm } = await inquirer.prompt({
            type: 'confirm',
            name: 'confirm',
            message: `Claim fees from ${claimable.length} positions now?`,
            default: true,
        });

        if (!confirm) {
            console.log(chalk.gray('\nBatch claim cancelled.'));
            await waitForUser();
            return;
        }

        await claimFeesForPositions(claimable);
        return;
    }

    if (action.includes('specific')) {
        const selected = await promptForPositionSelection(claimable, 'Select a position to claim fees from:');
        if (!selected) {
            return;
        }
        await claimFeesForSinglePosition(selected);
        return;
    }

    if (action.includes('compound')) {
        const selected = await promptForPositionSelection(claimable, 'Select a position to claim & compound:');
        if (!selected) {
            return;
        }
        await claimAndCompoundPositionMenu(selected);
        return;
    }
}

function getClaimablePositions(positions: UserPosition[]): UserPosition[] {
    return positions.filter((pos) => {
        const usd = pos.unclaimedFees.usdValue ?? 0;
        const feeX = pos.unclaimedFees.xUi ?? 0;
        const feeY = pos.unclaimedFees.yUi ?? 0;
        return usd > 0 || feeX > FEE_AMOUNT_EPSILON || feeY > FEE_AMOUNT_EPSILON;
    });
}

function buildPositionLabel(position: UserPosition): string {
    const pair = `${position.tokenX.symbol || 'TokenX'}/${position.tokenY.symbol || 'TokenY'}`;
    return `${pair} (${position.publicKey.slice(0, 8)}...)`;
}

async function claimFeesForPositions(positions: UserPosition[]): Promise<void> {
    console.log(chalk.yellow('\n🔄 Claiming fees...'));
    try {
        const requests: BatchClaimRequest[] = positions.map((pos) => ({
            poolAddress: pos.poolAddress,
            positionAddress: pos.publicKey,
            method: 'manual',
        }));

        const outcomes = await feeService.claimFeesBatch(requests);
        renderBatchClaimOutcomes(outcomes);
    } catch (error) {
        console.log(chalk.red(`\n❌ Batch claim failed: ${error instanceof Error ? error.message : error}`));
    }
    await waitForUser();
}

async function claimFeesForSinglePosition(position: UserPosition): Promise<FeeClaimSummary | null> {
    console.log(chalk.yellow(`\n🔄 Claiming fees for ${buildPositionLabel(position)}...`));
    try {
        const summary = await feeService.claimFeesForPosition(
            position.poolAddress,
            new PublicKey(position.publicKey),
            { method: 'manual' }
        );
        renderFeeClaimSummary(summary);
        await waitForUser();
        return summary;
    } catch (error) {
        console.log(chalk.red(`\n❌ Claim failed: ${error instanceof Error ? error.message : error}`));
        await waitForUser();
        return null;
    }
}

function renderFeeClaimSummary(summary: FeeClaimSummary): void {
    console.log(chalk.green('\n✅ Fees claimed!'));
    const breakdown = [
        formatTokenAmount(summary.claimedX, summary.tokenXSymbol),
        formatTokenAmount(summary.claimedY, summary.tokenYSymbol),
    ].filter(Boolean).join(' + ');

    console.log(`   Claimed: ${breakdown}`);
    console.log(`   USD Value: ${formatUsd(summary.claimedUsd)}`);
    console.log(`   Tx Cost: ${summary.estimatedTxCostSol.toFixed(6)} SOL${summary.estimatedTxCostUsd ? ` (${formatUsd(summary.estimatedTxCostUsd)})` : ''}`);
    if (summary.signatures.length) {
        console.log('   Signatures:');
        summary.signatures.forEach((sig) => console.log(`      • ${sig}`));
    }
}

function renderBatchClaimOutcomes(outcomes: BatchClaimOutcome[]): void {
    if (!outcomes.length) {
        console.log(chalk.gray('\nNo claim attempts were made.'));
        return;
    }

    const successTotals: {
        usd: number;
        solCost: number;
        positions: number;
        tokenTotals: Record<string, number>;
    } = { usd: 0, solCost: 0, positions: 0, tokenTotals: {} };

    outcomes.forEach((outcome, idx) => {
        const prefix = outcome.success ? chalk.green('✓') : chalk.red('✗');
        const label = `${prefix} [${idx + 1}] ${outcome.positionAddress.slice(0, 8)}...`;
        if (outcome.success && outcome.summary) {
            const summary = outcome.summary;
            console.log(`${label} — ${formatUsd(summary.claimedUsd)} (${formatTokenAmount(summary.claimedX, summary.tokenXSymbol)} / ${formatTokenAmount(summary.claimedY, summary.tokenYSymbol)})`);
            if (summary.signatures.length) {
                console.log(`      Sig: ${summary.signatures[summary.signatures.length - 1]}`);
            }
            successTotals.usd += summary.claimedUsd;
            successTotals.solCost += summary.estimatedTxCostSol;
            successTotals.positions += 1;
            if (summary.claimedX > 0) {
                successTotals.tokenTotals[summary.tokenXSymbol] = (successTotals.tokenTotals[summary.tokenXSymbol] || 0) + summary.claimedX;
            }
            if (summary.claimedY > 0) {
                successTotals.tokenTotals[summary.tokenYSymbol] = (successTotals.tokenTotals[summary.tokenYSymbol] || 0) + summary.claimedY;
            }
        } else {
            console.log(`${label} — Failed after ${outcome.attempts} attempt(s): ${outcome.error || 'Unknown error'}`);
        }
    });

    console.log(chalk.cyan('\nBatch Summary'));
    console.log(`   Successful Positions: ${successTotals.positions}/${outcomes.length}`);
    if (successTotals.positions > 0) {
        const tokenBreakdown = formatTokenTotals(successTotals.tokenTotals);
        console.log(`   Total Fees: ${formatUsd(successTotals.usd)}${tokenBreakdown ? ` (${tokenBreakdown})` : ''}`);
        console.log(`   Gas Cost: ${successTotals.solCost.toFixed(6)} SOL`);
    }
}

function formatTokenTotals(tokenTotals: Record<string, number>): string {
    const entries = Object.entries(tokenTotals).filter(([, amt]) => amt > 0);
    if (!entries.length) {
        return '';
    }
    return entries.map(([symbol, amt]) => `${formatTokenAmount(amt, symbol)}`).join(', ');
}

async function claimAndCompoundPositionMenu(position: UserPosition): Promise<void> {
    console.clear();
    console.log(chalk.blue.bold('🔁 CLAIM & COMPOUND'));
    console.log(chalk.gray(`Position: ${buildPositionLabel(position)}`));
    console.log(`Unclaimed Fees: ${formatUsd(position.unclaimedFees.usdValue ?? 0)} (${formatFeeBreakdownForPosition(position)})`);

    const { selection } = await inquirer.prompt({
        type: 'list',
        name: 'selection',
        message: 'Choose compounding action:',
        choices: [
            'Claim fees only',
            'Claim & compound (100%)',
            'Claim & compound (custom ratio)',
            '⬅️ Back'
        ],
    });

    if (selection.includes('Back')) {
        return;
    }

    if (selection.includes('fees only')) {
        await claimFeesForSinglePosition(position);
        return;
    }

    if (selection.includes('custom')) {
        const overrides = await promptCompoundOverrides();
        if (!overrides) {
            console.log(chalk.gray('Custom compounding cancelled.'));
            await waitForUser();
            return;
        }
        await executeCompoundFlow(position, {
            tokenPercentOverrides: overrides,
        });
        return;
    }

    await executeCompoundFlow(position, { compoundPercent: 100 });
}

async function executeCompoundFlow(
    position: UserPosition,
    params: { compoundPercent?: number; tokenPercentOverrides?: { tokenXPercent: number; tokenYPercent: number } }
): Promise<void> {
    console.log(chalk.yellow('\n🔄 Claiming fees and redepositing...'));
    try {
        const result = await compoundingService.claimAndCompound({
            poolAddress: position.poolAddress,
            positionAddress: position.publicKey,
            compoundPercent: params.compoundPercent,
            tokenPercentOverrides: params.tokenPercentOverrides,
            method: 'manual',
        });
        renderCompoundResult(result);
    } catch (error) {
        console.log(chalk.red(`\n❌ Compound failed: ${error instanceof Error ? error.message : error}`));
    }
    await waitForUser();
}

async function promptCompoundOverrides(): Promise<{ tokenXPercent: number; tokenYPercent: number } | null> {
    const answers = await inquirer.prompt([
        {
            type: 'number',
            name: 'tokenXPercent',
            message: 'Percent of token X fees to reinvest (0-100):',
            default: 100,
            validate: (value) => (value >= 0 && value <= 100) ? true : 'Enter a value between 0 and 100',
        },
        {
            type: 'number',
            name: 'tokenYPercent',
            message: 'Percent of token Y fees to reinvest (0-100):',
            default: 100,
            validate: (value) => (value >= 0 && value <= 100) ? true : 'Enter a value between 0 and 100',
        },
    ]);

    return {
        tokenXPercent: answers.tokenXPercent,
        tokenYPercent: answers.tokenYPercent,
    };
}

function renderCompoundResult(result: CompoundFeesResult): void {
    renderFeeClaimSummary(result.claimed);
    if (!result.compounded) {
        console.log(chalk.yellow(`\n⚠️  Fees were claimed but not compounded: ${result.skippedReason || 'No reason provided.'}`));
        return;
    }

    console.log(chalk.green('\n✅ Compounding complete!'));
    console.log(`   Reinvested: ${formatTokenAmount(result.reinvestedX, result.claimed.tokenXSymbol)} / ${formatTokenAmount(result.reinvestedY, result.claimed.tokenYSymbol)}`);
    if (result.addLiquiditySignature) {
        console.log(`   Liquidity tx: ${result.addLiquiditySignature}`);
    }
}

function describeFeeAge(position: UserPosition): string {
    const lastTimestamp = getLastFeeClaimTimestamp(position.publicKey);
    if (!lastTimestamp) {
        return 'Never claimed';
    }
    const delta = Date.now() - lastTimestamp;
    return `${formatRelativeDuration(delta)} since last claim`;
}

function getLastFeeClaimTimestamp(positionAddress: string): number | null {
    try {
        const claims = analyticsStore?.getPositionFeeClaims(positionAddress, 120) ?? [];
        if (!claims.length) {
            return null;
        }
        return claims[claims.length - 1].timestamp;
    } catch {
        return null;
    }
}

function formatRelativeDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) {
        return 'recently';
    }
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        const remMinutes = minutes % 60;
        return `${hours}h ${remMinutes}m`;
    }
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
}

function formatTokenAmount(amount: number, symbol: string): string {
    const finalSymbol = symbol || 'Token';
    if (amount === 0) {
        return `0 ${finalSymbol}`;
    }
    const decimals = amount >= 1 ? 4 : 6;
    return `${amount.toFixed(decimals)} ${finalSymbol}`;
}

async function closePositionWorkflow(position: any) {
    console.log(chalk.blue.bold('\n🚫 CLOSE POSITION\n'));
    console.log(chalk.yellow('This will remove 100% liquidity, claim fees, and close the account to reclaim rent.'));

    const { confirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to close this position?',
        default: false
    });

    if (!confirm) return;

    try {
        console.log(chalk.yellow('Closing position...'));
        const activeWallet = walletService.getActiveWallet();
        if (!activeWallet) throw new Error("No active wallet");

        // We use removeLiquidity with 100% and close flag
        const sigs = await liquidityService.removeLiquidity({
            positionPubKey: new PublicKey(position.publicKey),
            poolAddress: position.poolAddress,
            userPublicKey: new PublicKey(activeWallet.publicKey),
            bps: 10000, // 100%
            shouldClaimAndClose: true
        });

        console.log(chalk.green.bold('\n✅ POSITION CLOSED!'));
        sigs.forEach(s => console.log(`Sig: ${s}`));
        await waitForUser();

    } catch (e: any) {
        console.log(chalk.red(`\n❌ Failed: ${e.message || e}`));
        await waitForUser();
    }
}

async function positionDetailMenu(position: UserPosition) {
    console.clear();
    console.log(chalk.blue.bold('📊 POSITION DETAIL'));
    console.log(chalk.gray(`Address: ${position.publicKey}`));

    let poolInfo: PoolInfo | null = null;
    try {
        poolInfo = await poolService.getPoolInfo(position.poolAddress);
    } catch (error: any) {
        console.log(chalk.yellow(`\n⚠️  Unable to refresh pool metadata: ${error?.message || error}`));
    }

    const status = determineRangeStatus(position);
    const tokenXAmount = getUiAmount(position.tokenX);
    const tokenYAmount = getUiAmount(position.tokenY);
    const feesUsd = position.unclaimedFees.usdValue ?? 0;

    // Ensure we have up-to-date analytics snapshots to power performance metrics
    let snapshotRange = analyticsStore?.getPositionSnapshotRange(position.publicKey, { days: 30 });
    if (snapshotRange && snapshotRange.snapshots.length === 0) {
        await captureAnalyticsSnapshots([position], { silent: true, source: 'manual' });
        snapshotRange = analyticsStore?.getPositionSnapshotRange(position.publicKey, { days: 30 });
    }
    const rangeSnapshots = snapshotRange?.snapshots ?? [];
    const firstSnapshot = snapshotRange?.first;
    const latestSnapshot = snapshotRange?.latest;

    const sevenDaySnapshots = (analyticsStore?.getPositionSnapshots(position.publicKey, 7) ?? [])
        .sort((a, b) => a.timestamp - b.timestamp);
    const sevenDayDelta = sevenDaySnapshots.length >= 2
        ? sevenDaySnapshots[sevenDaySnapshots.length - 1].usdValue - sevenDaySnapshots[0].usdValue
        : undefined;

    const feeClaims30d = analyticsStore?.getPositionFeeClaims(position.publicKey, 30) ?? [];
    const lastFeeClaimEntry = feeClaims30d.length ? feeClaims30d[feeClaims30d.length - 1] : undefined;
    const totalFeeClaimsUsd30d = feeClaims30d.reduce((sum, entry) => sum + (entry.claimedUsd ?? 0), 0);

    const currentValueUsd = position.totalValueUSD
        ?? (position.tokenX.usdValue ?? 0) + (position.tokenY.usdValue ?? 0);
    const priceX = deriveTokenPrice(position.tokenX);
    const priceY = deriveTokenPrice(position.tokenY);
    const holdValueUsd = firstSnapshot && priceX !== undefined && priceY !== undefined
        ? firstSnapshot.tokenXAmount * priceX + firstSnapshot.tokenYAmount * priceY
        : undefined;
    const ilUsd = holdValueUsd !== undefined ? currentValueUsd - holdValueUsd : undefined;
    const ilPercent = holdValueUsd && holdValueUsd !== 0 ? (ilUsd! / holdValueUsd) * 100 : undefined;
    const pnlUsd = firstSnapshot ? currentValueUsd + feesUsd - firstSnapshot.usdValue : undefined;
    const pnlPercent = firstSnapshot && firstSnapshot.usdValue !== 0
        ? (pnlUsd! / firstSnapshot.usdValue) * 100
        : undefined;
    const timeInRangePercent = rangeSnapshots.length
        ? (rangeSnapshots.filter(s => s.inRange).length / rangeSnapshots.length) * 100
        : undefined;

    console.log(chalk.yellow('\nOVERVIEW'));
    console.log(`   Pool: ${position.tokenX.symbol || 'TokenX'}/${position.tokenY.symbol || 'TokenY'}`);
    console.log(`   Pool Address: ${position.poolAddress}`);
    if (typeof poolInfo?.apr === 'number') {
        console.log(`   Pool APR: ${poolInfo.apr.toFixed(2)}%`);
    } else if (position.poolApr !== undefined) {
        console.log(`   Pool APR: ${position.poolApr.toFixed(2)}%`);
    }
    if (poolInfo?.price) {
        console.log(`   Spot Price: $${poolInfo.price.toFixed(6)}`);
    }

    console.log(chalk.cyan('\nCURRENT STATUS'));
    console.log(`   Status: ${formatRangeStatus(status)}`);
    console.log(`   Active Bin: ${position.activeBinId}`);
    console.log(`   Range: ${position.lowerBinId} → ${position.upperBinId}`);
    console.log(`   Pool Bin Step: ${poolInfo?.binStep ?? position.binStep ?? 'n/a'}`);

    console.log(chalk.green('\nLIQUIDITY BREAKDOWN'));
    const tokenXSymbol = position.tokenX.symbol || 'X';
    const tokenYSymbol = position.tokenY.symbol || 'Y';
    console.log(`   ${tokenXSymbol}: ${tokenXAmount.toFixed(6)} ${tokenXSymbol} (${formatUsd(position.tokenX.usdValue)})`);
    if (firstSnapshot) {
        const deltaX = tokenXAmount - firstSnapshot.tokenXAmount;
        console.log(`      Start ${tokenXSymbol}: ${firstSnapshot.tokenXAmount.toFixed(6)} | Δ ${formatSignedNumber(deltaX)}`);
    }
    console.log(`   ${tokenYSymbol}: ${tokenYAmount.toFixed(6)} ${tokenYSymbol} (${formatUsd(position.tokenY.usdValue)})`);
    if (firstSnapshot) {
        const deltaY = tokenYAmount - firstSnapshot.tokenYAmount;
        console.log(`      Start ${tokenYSymbol}: ${firstSnapshot.tokenYAmount.toFixed(6)} | Δ ${formatSignedNumber(deltaY)}`);
    }
    console.log(`   Total Value: ${formatUsd(currentValueUsd)}`);
    if (firstSnapshot) {
        console.log(`      Initial Deposit: ${formatUsd(firstSnapshot.usdValue)}`);
    }

    console.log(chalk.magenta('\nPERFORMANCE'));
    console.log(`   Unclaimed Fees: ${formatUsd(feesUsd)} (${formatFeeBreakdownForPosition(position)})`);
    if (position.poolApr !== undefined) {
        console.log(`   Position APR (pool): ${position.poolApr.toFixed(2)}%`);
    }
    if (pnlUsd !== undefined) {
        console.log(`   30d P&L: ${formatUsdWithSign(pnlUsd)} (${formatPercent(pnlPercent)})`);
    } else {
        console.log('   30d P&L: Capture analytics snapshots to enable this metric.');
    }
    if (ilUsd !== undefined) {
        console.log(`   Impermanent Loss: ${formatUsdWithSign(ilUsd)} (${formatPercent(ilPercent)})`);
    } else {
        console.log('   Impermanent Loss: N/A (requires price data + snapshots)');
    }
    if (timeInRangePercent !== undefined) {
        console.log(`   Time In Range (30d): ${timeInRangePercent.toFixed(1)}%`);
    } else {
        console.log('   Time In Range (30d): Capture analytics snapshots to enable this metric.');
    }

    if (rangeSnapshots.length > 0 && latestSnapshot) {
        console.log(`   Snapshots (30d): ${rangeSnapshots.length}`);
        console.log(`   Last Capture: ${new Date(latestSnapshot.timestamp).toLocaleString()}`);
    } else {
        console.log('   Snapshots: none captured yet (use "Refresh Analytics")');
    }

    if (sevenDayDelta !== undefined) {
        console.log(`   7d Value Δ: ${formatUsdWithSign(sevenDayDelta)}`);
    }

    if (lastFeeClaimEntry) {
        const ago = formatRelativeDuration(Date.now() - lastFeeClaimEntry.timestamp);
        console.log(`   Last Fee Claim: ${formatUsd(lastFeeClaimEntry.claimedUsd)} (${ago} ago)`);
    } else {
        console.log('   Last Fee Claim: No recorded claims yet.');
    }

    if (feeClaims30d.length) {
        console.log(`   30d Fee Claims: ${formatUsd(totalFeeClaimsUsd30d)} across ${feeClaims30d.length} claim(s)`);
    }

    console.log(chalk.blue('\nBIN DISTRIBUTION MAP'));
    if (poolInfo) {
        const decimalsX = poolInfo.tokenX.decimals ?? position.tokenX.decimals ?? 6;
        const decimalsY = poolInfo.tokenY.decimals ?? position.tokenY.decimals ?? 6;
        const lines = buildAsciiBinDistribution({
            lowerBinId: position.lowerBinId,
            upperBinId: position.upperBinId,
            activeBinId: position.activeBinId,
            totalValueUsd: position.totalValueUSD,
            priceResolver: (binId) => poolService.calculateBinPrice(binId, poolInfo.binStep, decimalsX, decimalsY),
        });
        lines.forEach(line => console.log(`   ${line}`));
    } else {
        console.log('   Unable to render map without pool metadata.');
    }

    const { detailAction } = await inquirer.prompt({
        type: 'list',
        name: 'detailAction',
        message: 'Next action:',
        choices: [
            '⬅️ Back to Positions',
            '💹 Claim / Compound Fees',
            '♻️ Open Rebalance Tools',
            '📈 Refresh Analytics Snapshots',
        ],
    });

    if (detailAction.includes('Claim')) {
        await claimAndCompoundPositionMenu(position);
        return;
    }

    if (detailAction.includes('Rebalance')) {
        await rebalanceAnalysisMenu(position);
        return;
    }

    if (detailAction.includes('Refresh')) {
        await captureAnalyticsSnapshots([position], { source: 'manual' });
        await positionDetailMenu(position);
        return;
    }

    return;
}

interface RebalanceRangePreview {
    centerBin: number;
    activeBin: number;
    binsPerSide: number;
    minBin: number;
    maxBin: number;
    minPrice?: number;
    maxPrice?: number;
}

function ensureRebalancingServiceInstance() {
    if (!rebalancingService) {
        return initRebalancingService(connectionService.getConnection());
    }
    return rebalancingService;
}

function buildRebalancePreview(position: UserPosition, poolInfo: PoolInfo, binsOverride?: number): RebalanceRangePreview {
    const activeBin = poolInfo.activeBin ?? position.activeBinId;
    const currentWidth = Math.max(6, Math.floor((position.upperBinId - position.lowerBinId) / 2));
    const binsPerSide = Math.min(binsOverride ?? Math.min(20, currentWidth), 34);
    const minBin = activeBin - binsPerSide;
    const maxBin = activeBin + binsPerSide;

    let minPrice: number | undefined;
    let maxPrice: number | undefined;
    try {
        const decimalsX = poolInfo.tokenX.decimals ?? position.tokenX.decimals ?? 6;
        const decimalsY = poolInfo.tokenY.decimals ?? position.tokenY.decimals ?? 6;
        minPrice = poolService.calculateBinPrice(minBin, poolInfo.binStep, decimalsX, decimalsY);
        maxPrice = poolService.calculateBinPrice(maxBin, poolInfo.binStep, decimalsX, decimalsY);
    } catch {
        // Silent fallback if price math fails
    }

    return {
        centerBin: activeBin,
        activeBin,
        binsPerSide,
        minBin,
        maxBin,
        minPrice,
        maxPrice,
    };
}

function mapReasonCodeFromStatus(status: RangeStatus): 'OUT_OF_RANGE' | 'EFFICIENCY' | 'MANUAL' {
    if (status === 'OUT_OF_RANGE') return 'OUT_OF_RANGE';
    if (status === 'EDGE_RANGE') return 'EFFICIENCY';
    return 'MANUAL';
}

async function rebalanceAnalysisMenu(position: UserPosition) {
    while (true) {
        console.clear();
        console.log(chalk.blue.bold('♻️ REBALANCE ANALYSIS'));
        console.log(chalk.gray(`Position: ${position.publicKey}`));

        let poolInfo: PoolInfo | null = null;
        try {
            poolInfo = await poolService.getPoolInfo(position.poolAddress);
        } catch (error: any) {
            console.log(chalk.yellow(`⚠️  Pool metadata unavailable: ${error?.message || error}`));
        }

        const service = ensureRebalancingServiceInstance();
        let analysis: RebalanceAnalysis | null = null;
        let costBenefit: CostBenefitAnalysis | null = null;
        let preview: RebalanceRangePreview | null = null;

        try {
            analysis = await service.analyzeRebalanceNeeded(position, poolInfo ?? undefined);
            costBenefit = await service.costBenefitAnalysis(position, poolInfo ?? undefined);
            if (poolInfo) {
                preview = buildRebalancePreview(position, poolInfo);
            }
        } catch (error: any) {
            console.log(chalk.red(`⚠️  Failed to compute analysis: ${error?.message || error}`));
        }

        // LLM Analysis
        let llmDecision: any = null;
        if (llmAgent.isAvailable()) {
            const spinner = ora('🤖 Consulting AI Agent...').start();
            try {
                llmDecision = await llmAgent.analyzePosition(position);
                spinner.succeed('AI Analysis Complete');
            } catch (err) {
                spinner.fail('AI Analysis Failed');
            }
        }

        if (analysis && costBenefit) {
            console.log(chalk.cyan('\nCURRENT STATE'));
            console.log(`   Priority: ${analysis.priority} — ${analysis.reason}`);
            console.log(`   In Range: ${analysis.currentInRange ? 'Yes' : 'No'} (distance ${analysis.distanceFromCenter} bins)`);
            console.log(`   Recommendation: ${analysis.recommendation}`);

            console.log(chalk.magenta('\nCOST / BENEFIT'));
            console.log(`   Current Daily Fees: ${formatUsd(costBenefit.currentDailyFees)}`);
            console.log(`   Projected Daily Fees: ${formatUsd(costBenefit.projectedDailyFees)}`);
            console.log(`   Net Daily Gain: ${formatUsd(costBenefit.netDailyGain)}`);
            console.log(`   Estimated Cost: ${formatUsd(costBenefit.rebalanceCostUsd)}`);
            console.log(`   Break-even: ${costBenefit.breakEvenLabel}`);

            if (preview) {
                console.log(chalk.green('\nSUGGESTED RANGE'));
                console.log(`   Range: ${preview.minBin} → ${preview.maxBin} (center ${preview.centerBin}, ${preview.binsPerSide} bins/side)`);
                if (preview.minPrice && preview.maxPrice && poolInfo) {
                    const quotePair = `${poolInfo.tokenX.symbol || 'TokenX'}/${poolInfo.tokenY.symbol || 'TokenY'}`;
                    console.log(`   Price Band (${quotePair}): ${preview.minPrice.toFixed(6)} - ${preview.maxPrice.toFixed(6)}`);
                }
            }

            if (llmDecision) {
                console.log(chalk.cyan.bold('\n🤖 AI RECOMMENDATION'));
                const actionColor = llmDecision.action === 'rebalance' ? chalk.green :
                    llmDecision.action === 'hold' ? chalk.yellow : chalk.blue;
                console.log(`   Action: ${actionColor(llmDecision.action.toUpperCase())}`);
                console.log(`   Confidence: ${llmDecision.confidence}%`);
                console.log(`   Urgency: ${llmDecision.urgency.toUpperCase()}`);

                console.log(chalk.gray('   Reasoning:'));
                if (Array.isArray(llmDecision.reasoning)) {
                    llmDecision.reasoning.forEach((r: string) => console.log(chalk.gray(`    • ${r}`)));
                } else {
                    console.log(chalk.gray(`    • ${llmDecision.reasoning}`));
                }

                if (llmDecision.risks && llmDecision.risks.length > 0) {
                    console.log(chalk.yellow('   Risks:'));
                    llmDecision.risks.forEach((r: string) => console.log(chalk.yellow(`    ⚠️ ${r}`)));
                }
            }
        } else {
            console.log(chalk.yellow('\nAnalysis unavailable. Capture analytics snapshots and try again.'));
        }

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: 'Choose next step:',
            choices: [
                '🚀 Execute Suggested Rebalance',
                '📜 View Rebalance History',
                '🔁 Refresh Analysis',
                '⬅️ Back to Positions',
            ],
        });

        if (action.includes('Execute')) {
            if (!preview) {
                console.log(chalk.yellow('\nPool metadata required before executing a rebalance.'));
                await waitForUser();
                continue;
            }
            await executeRebalanceFlow(position, preview);
            return;
        } else if (action.includes('History')) {
            await showRebalanceHistory(position);
        } else if (action.includes('Refresh')) {
            continue;
        } else {
            return;
        }
    }
}

async function executeRebalanceFlow(position: UserPosition, preview: RebalanceRangePreview) {
    const service = ensureRebalancingServiceInstance();
    const config = configManager.getConfig();
    const slippage = config.transaction?.slippage ?? DEFAULT_CONFIG.SLIPPAGE;

    console.clear();
    console.log(chalk.blue.bold('🚀 EXECUTE REBALANCE'));
    console.log(`Position: ${position.publicKey}`);
    console.log(`Target Range: ${preview.minBin} → ${preview.maxBin} (center ${preview.centerBin})`);

    const { confirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: 'Remove liquidity and recreate the position in this range?',
        default: true,
    });

    if (!confirm) {
        console.log(chalk.gray('\nOperation cancelled.'));
        await waitForUser();
        return;
    }

    try {
        const result = await service.executeRebalance(position, {
            binsPerSide: preview.binsPerSide,
            slippageBps: slippage,
            reasonCode: mapReasonCodeFromStatus(determineRangeStatus(position)),
            reason: `CLI-targeted range ${preview.minBin}→${preview.maxBin}`,
        });

        console.log(chalk.green('\n✅ Rebalance complete!'));
        console.log(`   Old Position: ${result.oldPositionAddress}`);
        console.log(`   New Position: ${result.newPositionAddress}`);
        if (result.transactions?.length) {
            console.log('   Transactions:');
            result.transactions.forEach(sig => console.log(`      • ${sig}`));
        }
        console.log(chalk.gray('\nTip: Re-open "My Positions" to refresh the list and load the new address.'));
    } catch (error: any) {
        console.log(chalk.red(`\n❌ Rebalance failed: ${error?.message || error}`));
    }

    await waitForUser();
}

async function showRebalanceHistory(position: UserPosition) {
    console.clear();
    console.log(chalk.blue.bold('📜 REBALANCE HISTORY'));
    console.log(chalk.gray(`Position: ${position.publicKey}`));

    const history = analyticsStore?.getPositionRebalanceHistory(position.publicKey) ?? [];
    if (!history.length) {
        console.log(chalk.gray('\nNo recorded rebalances for this position yet.'));
        await waitForUser();
        return;
    }

    const recent = history.slice(-5).reverse();
    recent.forEach((entry, idx) => {
        console.log(`\n${idx + 1}. ${new Date(entry.timestamp).toLocaleString()} (${entry.reasonCode})`);
        console.log(`   Old Range: ${entry.oldRange.min} → ${entry.oldRange.max}`);
        console.log(`   New Range: ${entry.newRange.min} → ${entry.newRange.max}`);
        console.log(`   Fees Claimed: ${entry.feesClaimedUsd.toFixed(2)} USD`);
        if (entry.signature) {
            console.log(`   Signature: ${entry.signature}`);
        }
    });

    await waitForUser();
}

async function promptForPositionSelection(positions: UserPosition[], message: string): Promise<UserPosition | null> {
    if (positions.length === 0) {
        return null;
    }

    const { selectedPosition } = await inquirer.prompt({
        type: 'list',
        name: 'selectedPosition',
        message,
        choices: positions.map((p, idx) => ({
            name: `${idx + 1}. ${p.tokenX.symbol || 'TokenX'}/${p.tokenY.symbol || 'TokenY'} (${p.publicKey.slice(0, 8)}...)`,
            value: p,
        })),
    });

    return selectedPosition;
}

type RangeStatus = 'IN_RANGE' | 'EDGE_RANGE' | 'OUT_OF_RANGE';

function determineRangeStatus(position: UserPosition): RangeStatus {
    if (position.activeBinId < position.lowerBinId || position.activeBinId > position.upperBinId) {
        return 'OUT_OF_RANGE';
    }

    if (
        position.activeBinId - position.lowerBinId <= EDGE_BUFFER_BINS ||
        position.upperBinId - position.activeBinId <= EDGE_BUFFER_BINS
    ) {
        return 'EDGE_RANGE';
    }

    return 'IN_RANGE';
}

function formatRangeStatus(status: RangeStatus): string {
    switch (status) {
        case 'IN_RANGE':
            return chalk.green('🟢 IN-RANGE');
        case 'EDGE_RANGE':
            return chalk.yellow('⚠️  EDGE-RANGE');
        default:
            return chalk.red('🔴 OUT-OF-RANGE');
    }
}

function getUiAmount(token: UserPosition['tokenX']): number {
    if (!token) {
        return 0;
    }

    if (typeof token.uiAmount === 'number') {
        return token.uiAmount;
    }

    const decimals = token.decimals ?? 6;
    const raw = token.amount ? Number(token.amount) : 0;
    return raw / Math.pow(10, decimals);
}

function formatUsd(value?: number): string {
    if (value === undefined || Number.isNaN(value)) {
        return '$0.00';
    }
    const formatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `$${formatter.format(value)}`;
}

function formatFeeBreakdownForPosition(position: UserPosition): string {
    const parts: string[] = [];
    if (position.unclaimedFees.xUi && position.unclaimedFees.xUi > 0) {
        parts.push(`${position.unclaimedFees.xUi.toFixed(6)} ${position.tokenX.symbol || 'X'}`);
    }
    if (position.unclaimedFees.yUi && position.unclaimedFees.yUi > 0) {
        parts.push(`${position.unclaimedFees.yUi.toFixed(6)} ${position.tokenY.symbol || 'Y'}`);
    }
    return parts.length ? parts.join(' / ') : '0';
}

function formatFeeBreakdown(feesByToken: Record<string, number>): string {
    const entries = Object.entries(feesByToken).filter(([, value]) => value > 0);
    if (entries.length === 0) {
        return '0';
    }
    return entries.map(([symbol, amount]) => `${amount.toFixed(4)} ${symbol}`).join(', ');
}

function deriveTokenPrice(token: UserPosition['tokenX']): number | undefined {
    if (!token) {
        return undefined;
    }
    if (typeof token.priceUsd === 'number' && token.priceUsd > 0) {
        return token.priceUsd;
    }
    if (typeof token.usdValue === 'number' && token.uiAmount && token.uiAmount > 0) {
        return token.usdValue / token.uiAmount;
    }
    return undefined;
}

function formatSignedNumber(value?: number, decimals: number = 6): string {
    if (value === undefined || Number.isNaN(value)) {
        return 'N/A';
    }
    const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${prefix}${Math.abs(value).toFixed(decimals)}`;
}

function formatUsdWithSign(value?: number): string {
    if (value === undefined || Number.isNaN(value)) {
        return 'N/A';
    }
    if (value === 0) {
        return formatUsd(0);
    }
    const prefix = value > 0 ? '+' : '-';
    return `${prefix}${formatUsd(Math.abs(value))}`;
}

function formatPercent(value?: number, decimals: number = 2): string {
    if (value === undefined || Number.isNaN(value)) {
        return 'N/A';
    }
    const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${prefix}${Math.abs(value).toFixed(decimals)}%`;
}

interface PortfolioTotals {
    valueUsd: number;
    feesUsd: number;
    feesByToken: Record<string, number>;
}

function summarizePortfolioTotals(positions: UserPosition[]): PortfolioTotals {
    return positions.reduce<PortfolioTotals>((acc, pos) => {
        acc.valueUsd += pos.totalValueUSD ?? 0;
        const feeUsd = pos.unclaimedFees.usdValue ?? 0;
        acc.feesUsd += feeUsd;

        if (pos.unclaimedFees.xUi && pos.unclaimedFees.xUi > 0) {
            const symbol = pos.tokenX.symbol || 'TokenX';
            acc.feesByToken[symbol] = (acc.feesByToken[symbol] || 0) + pos.unclaimedFees.xUi;
        }
        if (pos.unclaimedFees.yUi && pos.unclaimedFees.yUi > 0) {
            const symbol = pos.tokenY.symbol || 'TokenY';
            acc.feesByToken[symbol] = (acc.feesByToken[symbol] || 0) + pos.unclaimedFees.yUi;
        }

        return acc;
    }, { valueUsd: 0, feesUsd: 0, feesByToken: {} });
}

async function promptTransactionOverrides(
    transactionConfig: TransactionConfig
): Promise<{ slippage: number; priorityFeeOptions?: PriorityFeeOptions }> {
    const defaultSlippage = transactionConfig?.slippage ?? DEFAULT_CONFIG.SLIPPAGE;
    const defaultPriorityMode = transactionConfig?.priorityFee ?? 'dynamic';

    console.log(chalk.cyan('\nTRANSACTION SETTINGS'));
    console.log(`   Default slippage: ${defaultSlippage.toFixed(2)}%`);
    if (defaultPriorityMode === 'fixed') {
        const amount = transactionConfig?.priorityFeeAmount ?? 0;
        console.log(`   Priority fee: Fixed (${amount} µ-lamports per CU)`);
    } else {
        const multiplier = transactionConfig?.priorityFeeMultiplier ?? DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER;
        console.log(`   Priority fee: Dynamic (x${multiplier.toFixed(2)} of median)`);
    }

    const { customize } = await inquirer.prompt({
        type: 'confirm',
        name: 'customize',
        message: 'Adjust slippage/priority fee for this position?',
        default: false,
    });

    if (!customize) {
        return { slippage: defaultSlippage };
    }

    const { slippage } = await inquirer.prompt({
        type: 'number',
        name: 'slippage',
        message: 'Set slippage (%) for this transaction:',
        default: defaultSlippage,
        validate: (value) => (value > 0 && value <= 5 ? true : 'Enter a value between 0 and 5'),
    });

    const { priorityMode } = await inquirer.prompt({
        type: 'list',
        name: 'priorityMode',
        message: 'Select priority fee mode for this transaction:',
        default: defaultPriorityMode,
        choices: [
            { name: 'Dynamic (median-based)', value: 'dynamic' },
            { name: 'Fixed (manual microLamports)', value: 'fixed' },
        ],
    });

    let priorityFeeOptions: PriorityFeeOptions | undefined;

    if (priorityMode === 'fixed') {
        const { fee } = await inquirer.prompt({
            type: 'number',
            name: 'fee',
            message: 'MicroLamports per compute unit:',
            default: transactionConfig?.priorityFeeAmount ?? 1000,
            validate: (value) => (value > 0 ? true : 'Enter a positive number'),
        });
        priorityFeeOptions = { mode: 'fixed', microLamports: fee };
    } else {
        const { multiplier } = await inquirer.prompt({
            type: 'number',
            name: 'multiplier',
            message: 'Dynamic multiplier (applied to median priority fee):',
            default: transactionConfig?.priorityFeeMultiplier ?? DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER,
            validate: (value) => (value > 0 ? true : 'Enter a positive number'),
        });
        priorityFeeOptions = { mode: 'dynamic', multiplier };
    }

    return { slippage, priorityFeeOptions };
}

async function captureAnalyticsSnapshots(
    positions: UserPosition[],
    options?: { silent?: boolean; source?: 'manual' | 'auto' }
): Promise<void> {
    const silent = options?.silent ?? false;
    if (positions.length === 0) {
        if (!silent) {
            console.log(chalk.yellow('\n⚠️  No positions found for analytics capture.'));
            await waitForUser();
        }
        return;
    }

    if (!silent) {
        console.log(chalk.yellow('\n📈 Capturing analytics snapshots...'));
    }

    const poolCache = new Map<string, PoolInfo>();

    for (const position of positions) {
        try {
            const poolInfo = await getCachedPoolInfo(position.poolAddress, poolCache);
            const snapshot = buildSnapshotFromPosition(position, poolInfo);
            analyticsStore.recordSnapshot(snapshot);
            if (!silent) {
                console.log(chalk.gray(`   • Snapshot recorded for ${position.publicKey.slice(0, 8)}...`));
            }
        } catch (error: any) {
            if (!silent) {
                console.log(chalk.red(`   • Failed snapshot for ${position.publicKey.slice(0, 8)}...: ${error?.message || error}`));
            }
        }
    }

    if (!silent) {
        console.log(chalk.green('\n✓ Analytics snapshots updated.'));
        await waitForUser();
    }
}

async function autoCaptureSnapshots(): Promise<void> {
    const activeWallet = walletService.getActiveWallet();
    if (!activeWallet) {
        return;
    }

    try {
        const positions = await positionService.getAllPositions(activeWallet.publicKey);
        if (positions.length === 0) {
            return;
        }
        await captureAnalyticsSnapshots(positions, { silent: true, source: 'auto' });
    } catch (error) {
        // Silent fail for background task
    }
}

function ensureSnapshotScheduler(): void {
    if (analyticsSnapshotTimer) {
        return;
    }

    analyticsSnapshotTimer = setInterval(() => {
        autoCaptureSnapshots().catch(() => undefined);
    }, SNAPSHOT_INTERVAL_MS);
}

async function getCachedPoolInfo(poolAddress: string, cache: Map<string, PoolInfo>): Promise<PoolInfo> {
    if (cache.has(poolAddress)) {
        return cache.get(poolAddress)!;
    }

    const info = await poolService.getPoolInfo(poolAddress);
    cache.set(poolAddress, info);
    return info;
}

function buildSnapshotFromPosition(position: UserPosition, poolInfo?: PoolInfo): AnalyticsSnapshot {
    const tokenXAmount = getUiAmount(position.tokenX);
    const tokenYAmount = getUiAmount(position.tokenY);
    const tokenXPrice = position.tokenX.priceUsd ?? 0;
    const tokenYPrice = position.tokenY.priceUsd ?? 0;
    const feeXAmount = position.unclaimedFees.xUi ?? 0;
    const feeYAmount = position.unclaimedFees.yUi ?? 0;
    const feesUsdValue = position.unclaimedFees.usdValue ?? (feeXAmount * tokenXPrice + feeYAmount * tokenYPrice);

    return {
        timestamp: Date.now(),
        positionAddress: position.publicKey,
        poolAddress: position.poolAddress,
        tokenXAmount,
        tokenYAmount,
        usdValue: position.totalValueUSD ?? tokenXAmount * tokenXPrice + tokenYAmount * tokenYPrice,
        feesXAmount: feeXAmount,
        feesYAmount: feeYAmount,
        feesUsdValue,
        activeBinId: position.activeBinId,
        inRange: position.inRange,
        poolApr: poolInfo?.apr ?? position.poolApr ?? 0,
        gasCostUsd: 0.0005,
        timeInRangePercent: position.inRange ? 100 : 0,
    };
}

/**
 * Refresh position data by clearing any cached data and refetching from blockchain
 */
async function refreshPositionData(): Promise<void> {
    console.clear();
    console.log(chalk.blue.bold('🔄 REFRESHING POSITION DATA\n'));

    try {
        const activeWallet = walletService.getActiveWallet();
        if (!activeWallet) {
            console.log(chalk.red('❌ No active wallet found'));
            await waitForUser();
            return;
        }

        console.log(chalk.yellow('🔄 Refetching position data from blockchain...'));
        console.log(`   Wallet: ${activeWallet.name} (${activeWallet.publicKey.slice(0, 8)}...)\n`);

        // Add a small delay to show the refresh is happening
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get fresh position data (the service should fetch fresh data each time)
        const positions = await positionService.getAllPositions(activeWallet.publicKey);

        console.log(chalk.green(`✅ Successfully refreshed ${positions.length} position(s)`));

        // Show summary of refreshed data
        if (positions.length > 0) {
            console.log('\n' + chalk.cyan('📊 Updated Position Summary:'));

            positions.forEach((pos, idx) => {
                const status = pos.inRange ? '🟢 IN-RANGE' : '🔴 OUT-OF-RANGE';
                console.log(`   ${idx + 1}. ${pos.tokenX.symbol}/${pos.tokenY.symbol} ${status}`);
                console.log(`      Liquidity: ${pos.tokenX.uiAmount?.toFixed(6)} ${pos.tokenX.symbol} / ${pos.tokenY.uiAmount?.toFixed(6)} ${pos.tokenY.symbol}`);
                console.log(`      Fees: ${formatUsd(pos.unclaimedFees.usdValue || 0)}`);
            });

            const totals = summarizePortfolioTotals(positions);
            console.log(chalk.cyan(`\n   Portfolio Total: ${formatUsd(totals.valueUsd)}`));
            console.log(chalk.cyan(`   Unclaimed Fees: ${formatUsd(totals.feesUsd)}`));
        } else {
            console.log(chalk.gray('\n   No positions found'));
        }

        console.log(chalk.blue('\n💡 Tips:'));
        console.log('   • Position data is fetched directly from the Solana blockchain');
        console.log('   • Discrepancies with other UIs may occur due to different calculation methods');
        console.log('   • Refresh periodically to get the latest fee accumulations and bin updates');

        console.log(chalk.green('\n✅ Position data refresh complete!'));

    } catch (error: any) {
        console.log(chalk.red(`❌ Error refreshing position data: ${error.message}`));
        if (error.stack) {
            console.log(chalk.gray(`\nDebug: ${error.stack.split('\n')[0]}`));
        }
    }

    await waitForUser();
}
