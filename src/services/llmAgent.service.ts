import dotenv from 'dotenv';
dotenv.config();

import { UserPosition } from './position.service';
import { analyticsDataStore } from './analyticsDataStore.service';
import { configManager } from '../config/config.manager';
import chalk from 'chalk';
import { z } from 'zod';

// ==================== ZOD SCHEMAS FOR VALIDATION ====================

// Schema for LLM Decision output validation
export const LLMDecisionSchema = z.object({
    action: z.enum(['rebalance', 'hold', 'compound', 'close', 'widen_range', 'narrow_range']),
    confidence: z.number().min(0).max(100),
    urgency: z.enum(['immediate', 'soon', 'low', 'none']),
    reasoning: z.array(z.string()).min(1).max(10),
    expectedOutcome: z.object({
        costUsd: z.number(),
        expectedFeesNext24h: z.number().optional(),
        dailyFeesUsd: z.number().optional(),
        weeklyFeesUsd: z.number().optional(),
        breakEvenHours: z.number(),
        roi: z.number(),
        positionLifespanDays: z.number().optional()
    }),
    suggestedRange: z.object({
        binsPerSide: z.number().min(1).max(34),
        totalBins: z.number().min(1).max(69),
        rangeWidthPercent: z.number().optional(),
        priceMin: z.number().optional(),
        priceMax: z.number().optional(),
        rangeJustification: z.string()
    }).optional(),
    marketInsight: z.string().optional(),
    positionHealth: z.enum(['healthy', 'at-risk', 'critical', 'inactive']).optional(),
    alternativeAction: z.string().optional(),
    risks: z.array(z.string()),
    suggestedActions: z.array(z.string()).optional(),
    learnings: z.string().optional(),
    // NEW: Enhanced risk assessment with quantified metrics
    riskAssessment: z.object({
        impermanentLoss: z.object({
            ifPriceUp10Percent: z.number(),
            ifPriceDown10Percent: z.number()
        }).optional(),
        supportDistance: z.number().optional(),      // % distance to nearest support
        resistanceDistance: z.number().optional(),   // % distance to nearest resistance
        rebalanceProbability7Days: z.number().optional()  // 0-100% chance of needing rebalance
    }).optional(),
    // NEW: Strategy evaluation for rebalancing decisions
    strategyEvaluation: z.object({
        currentStrategy: z.enum(['Spot', 'Curve', 'BidAsk']),
        isOptimal: z.boolean(),
        reason: z.string(),
        suggestedStrategy: z.enum(['Spot', 'Curve', 'BidAsk']).optional()
    }).optional()
});

// Schema for Pool Creation Recommendation validation
export const PoolCreationRecommendationSchema = z.object({
    strategy: z.enum(['Spot', 'Curve', 'BidAsk']),
    confidence: z.number().min(0).max(100),
    reasoning: z.array(z.string()).min(1).max(10),
    binConfiguration: z.object({
        minBinId: z.number(),
        maxBinId: z.number(),
        bidBins: z.number().min(1).max(34),
        askBins: z.number().min(1).max(34),
        totalBins: z.number().min(1).max(69)
    }),
    liquidityDistribution: z.object({
        tokenXPercentage: z.number().min(0).max(100),
        tokenYPercentage: z.number().min(0).max(100),
        isAsymmetric: z.boolean()
    }),
    expectedPerformance: z.object({
        estimatedAPR: z.number(),
        feeEfficiency: z.number(),
        rebalanceFrequency: z.enum(['high', 'medium', 'low'])
    }),
    risks: z.array(z.string()),
    marketRegime: z.string(),
    // Optional enhanced fields for improved AI output
    riskAssessment: z.object({
        impermanentLoss: z.object({
            priceUp10Percent: z.object({ il: z.number(), severity: z.string() }).optional(),
            priceDown10Percent: z.object({ il: z.number(), severity: z.string() }).optional()
        }).optional(),
        rebalancing: z.object({
            expectedDaysUntilRebalance: z.number(),
            probabilityWithin7Days: z.number(),
            costPerRebalance: z.number().optional(),
            breakEvenHours: z.number().optional()
        }).optional(),
        marketStructure: z.object({
            nearestSupport: z.object({ price: z.number(), distance: z.string(), breakProbability: z.number() }).optional(),
            nearestResistance: z.object({ price: z.number(), distance: z.string(), breakProbability: z.number() }).optional()
        }).optional()
    }).optional(),
    strategyComparison: z.array(z.object({
        strategy: z.string(),
        recommended: z.boolean(),
        expectedAPR: z.number().optional(),
        feeEfficiency: z.number().optional(),
        rebalanceFrequency: z.string().optional(),
        rebalanceDays: z.number().optional(),
        riskScore: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
        confidence: z.number().optional(),
        issue: z.string().optional(),
        whyRejected: z.string().optional(),
        aprDifferencePercent: z.number().optional(),  // e.g., -23 means 23% lower than recommended
        bestFor: z.string().optional()
    })).optional(),
    mitigationStrategies: z.array(z.string()).optional()
});

// ==================== TYPES ====================

export interface LLMDecisionContext {
    timestamp: number;

    position: {
        address: string;
        poolAddress: string;
        inRange: boolean;
        activeBin: number;
        rangeBins: [number, number];
        distanceToEdge: number;
        ageHours: number;
        unclaimedFeesUsd: number;
        binUtilization: number;
        // Price-based range info
        priceRange?: {
            minPrice: number;
            maxPrice: number;
            edgePrice: number;  // Price at nearest edge
            binStep: number;
        };
        tokenSymbols?: {
            x: string;
            y: string;
        };
    };

    market: {
        currentPrice: number;
        priceChange6h: number;
        volatilityScore: number;
        volumeRatio: number;
        volumeTrend: 'increasing' | 'decreasing' | 'stable';
        // NEW: Rich market context for better decisions
        trend30d?: 'bullish' | 'bearish' | 'neutral';
        priceHistory30d?: {
            min: number;
            max: number;
            volatility: number;
        };
        technicals?: {
            atr: number;
            supportLevels: number[];
            resistanceLevels: number[];
        };
    };

    // NEW: Intraday analysis from hourly snapshots
    intraDayAnalysis?: {
        hourlySnapshots: number;  // Count of snapshots available
        momentum: {
            price: number;           // Average hourly price change %
            volume: number;          // Volume acceleration %
            direction: 'bullish' | 'bearish' | 'neutral';
        };
        signals: {
            priceBreakout: boolean;  // Price at extremes
            volumeSpike: boolean;    // Volume > 1.5x average
            volatilityShift: boolean; // Volatility increased
        };
    };

    fees: {
        actualDaily: number;
        expectedDaily: number;
        efficiency: number;
        claimableUsd: number;
    };

    costs: {
        rebalanceCostUsd: number;
        breakEvenHours: number;
        minROI: number;
    };

    history: {
        totalRebalances: number;
        successRate: number;
        avgBreakEvenHours: number;
        lastRebalance?: {
            timestamp: number;
            reason: string;
            roi: number;
        };
        patterns: string[];
    };
}

export interface LLMDecision {
    action: 'rebalance' | 'hold' | 'compound' | 'close' | 'widen_range' | 'narrow_range';
    confidence: number;
    urgency: 'immediate' | 'soon' | 'low' | 'none';
    reasoning: string[];
    expectedOutcome: {
        costUsd: number;
        expectedFeesNext24h: number;
        breakEvenHours: number;
        roi: number;
    };
    // New: Suggested range for rebalancing
    suggestedRange?: {
        binsPerSide: number;
        totalBins: number;
        rangeWidthPercent?: number;  // % width of the range
        priceMin?: number;           // Suggested min price in USD
        priceMax?: number;           // Suggested max price in USD
        rangeJustification: string;  // Why this range was chosen
    };
    marketInsight?: string;
    positionHealth?: 'healthy' | 'at-risk' | 'critical' | 'inactive';
    alternativeAction?: string;
    risks: string[];
    suggestedActions?: string[];
    learnings?: string;
    // NEW: Enhanced risk assessment with quantified metrics
    riskAssessment?: {
        impermanentLoss?: {
            ifPriceUp10Percent: number;
            ifPriceDown10Percent: number;
        };
        supportDistance?: number;      // % distance to nearest support
        resistanceDistance?: number;   // % distance to nearest resistance
        rebalanceProbability7Days?: number;  // 0-100% chance of needing rebalance
    };
    // NEW: Strategy evaluation for rebalancing decisions
    strategyEvaluation?: {
        currentStrategy: 'Spot' | 'Curve' | 'BidAsk';
        isOptimal: boolean;
        reason: string;
        suggestedStrategy?: 'Spot' | 'Curve' | 'BidAsk';
    };
}

export interface LLMDecisionLog {
    timestamp: number;
    positionAddress: string;
    context: LLMDecisionContext;
    decision: LLMDecision;
    approved: boolean | null;
    approvedAt: number | null;
    executedAt: number | null;
    actualOutcome: {
        feesEarned24h: number;
        actualROI: number;
        success: boolean;
    } | null;
}

export type LLMProvider = 'anthropic' | 'openai' | 'deepseek' | 'grok' | 'kimi' | 'gemini' | 'none';

export interface LLMProviderConfig {
    provider: LLMProvider;
    apiKey: string;
    model: string;
    baseURL?: string;
}

// ==================== POSITION CREATION TYPES ====================

export interface PoolCreationContext {
    timestamp: number;

    pool: {
        address: string;
        tokenX: string;
        tokenY: string;
        binStep: number;
        currentPrice: number;
        activeBinId: number;
        tvl: number;
        apr: number;
    };

    market: {
        priceHistory30d: {
            min: number;
            max: number;
            current: number;
            volatility: number;
            trend: 'bullish' | 'bearish' | 'neutral';
        };
        volume: {
            current24h: number;
            avg7d: number;
            ratio: number;
            trend: 'increasing' | 'decreasing' | 'stable';
        };
        technicals: {
            atr: number;
            atrState: 'expanding' | 'flat' | 'contracting';
            supportLevels: number[];
            resistanceLevels: number[];
        };
    };

    pairCharacteristics: {
        isStablePair: boolean;
        hasStable: boolean;
        volatilityScore: number;
        volumeSkew: number;  // Bid vs Ask volume
    };
}

export interface PoolCreationRecommendation {
    strategy: 'Spot' | 'Curve' | 'BidAsk';
    confidence: number;
    reasoning: string[];

    binConfiguration: {
        minBinId: number;
        maxBinId: number;
        bidBins: number;
        askBins: number;
        totalBins: number;
    };

    liquidityDistribution: {
        tokenXPercentage: number;  // 0-100
        tokenYPercentage: number;  // 0-100
        isAsymmetric: boolean;
    };

    expectedPerformance: {
        estimatedAPR: number;
        feeEfficiency: number;
        rebalanceFrequency: 'high' | 'medium' | 'low';
    };

    risks: string[];
    marketRegime: string;
}

// ==================== SERVICE ====================

export class LLMAgentService {
    private providerConfig: LLMProviderConfig | null = null;
    private client: any = null;

    constructor() {
        try {
            this.providerConfig = this.loadProviderConfig();
            if (this.providerConfig.provider !== 'none') {
                this.client = this.initializeClient();
            }
        } catch (error) {
            console.log(chalk.yellow('⚠️  LLM Agent not configured. Decisions will be mock-only.'));
            this.providerConfig = { provider: 'none', apiKey: '', model: '' };
        }
    }

    reloadConfig(): void {
        try {
            this.providerConfig = this.loadProviderConfig();
            if (this.providerConfig.provider !== 'none') {
                this.client = this.initializeClient();
                console.log(chalk.gray(`  ✓ LLM Agent reloaded: ${this.providerConfig.provider} (${this.providerConfig.model})`));
            } else {
                this.client = null;
            }
        } catch (error: any) {
            console.log(chalk.yellow(`⚠️  LLM Agent configuration failed: ${error.message}`));
            this.providerConfig = { provider: 'none', apiKey: '', model: '' };
            this.client = null;
        }
    }

    private loadProviderConfig(): LLMProviderConfig {
        const config = configManager.getConfig();
        const llmConfig = config.preferences.llm;

        // Debug log to see what is being loaded
        console.log(chalk.gray(`  🔍 Loading LLM Config: ${JSON.stringify(llmConfig)}`));

        if (!llmConfig || llmConfig.provider === 'none') {
            return { provider: 'none', apiKey: '', model: '' };
        }

        const apiKey = llmConfig.apiKey ? configManager.decryptPrivateKey(llmConfig.apiKey) : '';

        return {
            provider: llmConfig.provider as LLMProvider,
            apiKey,
            model: llmConfig.model || '',
            baseURL: llmConfig.baseURL
        };
    }

    /**
     * Get appropriate max_tokens limit based on model
     */
    private getMaxTokensForModel(model: string): number {
        // GPT-4o-mini and GPT-3.5 have 16K max output tokens
        if (model.includes('gpt-4o-mini') || model.includes('gpt-3.5')) {
            return 16384;
        }

        // GPT-4o and GPT-4-turbo have higher limits
        if (model.includes('gpt-4o') || model.includes('gpt-4-turbo')) {
            return 16384; // GPT-4o also has 16K max
        }

        // DeepSeek R1 supports up to 32K
        if (model.includes('deepseek')) {
            return 32768;
        }

        // Claude models support up to 4K typically
        if (model.includes('claude')) {
            return 4096;
        }

        // Safe default for other models
        return 8192;
    }

    private initializeClient(): any {
        if (!this.providerConfig) {
            throw new Error('Provider config not loaded');
        }

        const { provider, apiKey, baseURL } = this.providerConfig;
        console.log(chalk.gray(`  🔌 Initializing LLM Client for: ${provider}`));

        try {
            switch (provider) {
                case 'anthropic': {
                    const Anthropic = require('@anthropic-ai/sdk');
                    return new Anthropic({ apiKey });
                }
                case 'openai':
                case 'deepseek':
                case 'grok':
                case 'kimi':
                case 'gemini': {
                    const OpenAI = require('openai');
                    return new OpenAI({
                        apiKey,
                        baseURL: baseURL || (provider === 'openai' ? undefined : baseURL)
                    });
                }
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
        } catch (error: any) {
            if (error.code === 'MODULE_NOT_FOUND') {
                console.log(chalk.yellow(`\n⚠️  SDK not installed for ${provider}`));
                console.log(chalk.gray('Install with: npm install @anthropic-ai/sdk openai'));
                return null;
            }
            throw error;
        }
    }

    isAvailable(): boolean {
        const available = this.providerConfig !== null &&
            this.providerConfig.provider !== 'none' &&
            this.client !== null;

        if (!available) {
            console.log(chalk.gray(`  Debug: LLM Unavailable - ConfigLoaded: ${!!this.providerConfig}, Provider: ${this.providerConfig?.provider}, ClientInitialized: ${!!this.client}`));
        }
        return available;
    }

    async analyzePosition(position: UserPosition): Promise<LLMDecision> {
        if (!this.isAvailable()) {
            console.log(chalk.yellow('[LLM] Not configured - using mock decision'));
            return this.getMockDecision(position);
        }

        try {
            console.log(chalk.cyan(`[LLM] Building context for position ${position.publicKey.slice(0, 8)}...`));
            const context = await this.buildContext(position);
            const decision = await this.getLLMDecision(context);
            await this.logDecision(position.publicKey, context, decision);
            return decision;
        } catch (error: any) {
            console.error(chalk.red(`\n❌ LLM Analysis failed: ${error.message}`));
            return this.getMockDecision(position);
        }
    }

    /**
     * Analyze a pool for optimal position creation
     */
    async analyzePoolForCreation(poolInfo: any): Promise<PoolCreationRecommendation> {
        if (!this.isAvailable()) {
            console.log(chalk.yellow('[LLM] Not configured - using mock creation recommendation'));
            return this.getMockCreationRecommendation(poolInfo);
        }

        try {
            console.log(chalk.cyan(`[LLM] Building creation context for pool ${poolInfo.address?.slice(0, 8) || 'unknown'}...`));
            const context = await this.buildCreationContext(poolInfo);
            const recommendation = await this.getCreationRecommendation(context);
            return recommendation;
        } catch (error: any) {
            console.error(chalk.red(`\n❌ LLM Creation Analysis failed: ${error.message}`));
            return this.getMockCreationRecommendation(poolInfo);
        }
    }

    private async buildContext(position: UserPosition): Promise<LLMDecisionContext> {
        const { poolService } = require('./pool.service');
        const { volumeCache } = require('./meteoraVolume.service');
        const { marketContextService } = require('./market-context.service');
        const { oracleService } = require('./oracle.service');
        const { hourlySnapshotService } = require('./hourlySnapshot.service');

        const poolInfo = await poolService.getPoolInfo(position.poolAddress);
        const volumeData = await volumeCache.getVolume(position.poolAddress);
        const marketContext = await marketContextService.buildRangeContext(poolInfo);

        const snapshots = analyticsDataStore.getPositionSnapshots(position.publicKey, 7);
        const latestSnapshot = snapshots[snapshots.length - 1];

        const distanceToEdge = Math.min(
            position.activeBinId - position.lowerBinId,
            position.upperBinId - position.activeBinId
        );

        const rebalanceHistory = analyticsDataStore
            .loadRebalanceHistory()
            .filter((r: any) => r.oldPositionAddress === position.publicKey);

        const lastRebalance = rebalanceHistory[rebalanceHistory.length - 1];
        const ageHours = lastRebalance
            ? (Date.now() - lastRebalance.timestamp) / (1000 * 60 * 60)
            : Infinity;

        const successful = rebalanceHistory.filter((r: any) => {
            const roi = r.feesClaimedUsd / r.transactionCostUsd;
            return roi >= 2.0;
        });
        const successRate = rebalanceHistory.length > 0
            ? (successful.length / rebalanceHistory.length) * 100
            : 0;

        const volumeTrend = analyticsDataStore.getVolumeTrend(position.poolAddress);

        let priceChange6h = 0;
        try {
            const priceHistory = await oracleService.getUsdPriceSeries(poolInfo.tokenX.mint, 6);
            if (priceHistory && priceHistory.length >= 2) {
                const firstPrice = priceHistory[0].price;
                const lastPrice = priceHistory[priceHistory.length - 1].price;
                priceChange6h = ((lastPrice - firstPrice) / firstPrice) * 100;
            }
        } catch (error) {
            // Ignore
        }

        // Get intraday context from hourly snapshots
        let intraDayAnalysis: LLMDecisionContext['intraDayAnalysis'];
        try {
            const intraDayContext = hourlySnapshotService.getIntraDayContext(position.poolAddress, 24);
            if (intraDayContext.snapshots.length > 0) {
                intraDayAnalysis = {
                    hourlySnapshots: intraDayContext.snapshots.length,
                    momentum: intraDayContext.momentum,
                    signals: intraDayContext.signals
                };
            }
        } catch (error) {
            // Intraday data is optional, don't fail if unavailable
        }

        // NEW: Fetch rich market data (30-day history, technicals) for "Creation-like" intelligence
        const { priceService } = require('./price.service');
        let trend30d: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        let priceHistory30d = undefined;
        let technicals = undefined;

        try {
            const tokenXMint = poolInfo.tokenX.mint;
            const tokenXSymbol = poolInfo.tokenX.symbol;

            // 1. Fetch History (Birdeye -> CoinGecko)
            let history = await priceService.getHistoricalPrices(tokenXMint, 30);

            if (!history || history.length === 0) {
                const cgId = await priceService.getCoinGeckoId(tokenXSymbol);
                if (cgId) history = await priceService.getPriceHistory(cgId, 30);
            }

            if (history && history.length > 1) {
                const prices = history.map((p: any) => p.price);
                const min = Math.min(...prices);
                const max = Math.max(...prices);

                // Calculate Volatility
                const mean = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
                const variance = prices.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / prices.length;
                const volatility = Math.sqrt(variance) / mean;

                // Calculate Trend
                const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
                const secondHalf = prices.slice(Math.floor(prices.length / 2));
                const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
                const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;
                trend30d = secondAvg > firstAvg * 1.05 ? 'bullish' : secondAvg < firstAvg * 0.95 ? 'bearish' : 'neutral';

                priceHistory30d = { min, max, volatility };

                // Calculate Technicals
                const sortedPrices = [...prices].sort((a, b) => a - b);
                const supportLevels = [
                    sortedPrices[0],
                    sortedPrices[Math.floor(prices.length * 0.1)],
                    sortedPrices[Math.floor(prices.length * 0.25)]
                ];
                const resistanceLevels = [
                    sortedPrices[prices.length - 1],
                    sortedPrices[Math.floor(prices.length * 0.9)],
                    sortedPrices[Math.floor(prices.length * 0.75)]
                ];
                const atr = volatility * prices[prices.length - 1];

                technicals = { atr, supportLevels, resistanceLevels };
            }
        } catch (error) {
            // Silently fail for rich data, core data is enough for basic analysis
        }

        // Get unclaimed fees (accurate on-chain data)
        const unclaimedFeesUsd = position.unclaimedFees?.usdValue || 0;

        // Calculate bin utilization from position data
        const totalBins = position.upperBinId - position.lowerBinId + 1;
        let binUtilization = latestSnapshot?.binUtilization?.utilizationPercent || 0;
        if (binUtilization === 0 && position.inRange) {
            // Estimate: if in range, some bins are active
            const activeBinPosition = position.activeBinId - position.lowerBinId;
            const distanceFromLower = activeBinPosition;
            const distanceFromUpper = totalBins - activeBinPosition;
            // Rough estimate of utilization based on position within range
            binUtilization = Math.min(100, Math.max(20, (1 - Math.abs(activeBinPosition - totalBins / 2) / (totalBins / 2)) * 100));
        }

        // Calculate price range from bins
        const binStep = poolInfo?.binStep || position.binStep || 1;
        const tokenXDecimals = poolInfo?.tokenX?.decimals || 9;
        const tokenYDecimals = poolInfo?.tokenY?.decimals || 6;
        const tokenXSymbol = poolInfo?.tokenX?.symbol || 'Token X';
        const tokenYSymbol = poolInfo?.tokenY?.symbol || 'Token Y';

        // Get actual USD price for tokenX
        let currentUsdPrice = 0;
        try {
            currentUsdPrice = await priceService.getTokenPrice(poolInfo.tokenX.mint) || 0;
        } catch (e) {
            // Fallback handled below
        }

        // Calculate bin ratio prices
        const binRatioMin = poolService.calculateBinPrice(position.lowerBinId, binStep, tokenXDecimals, tokenYDecimals);
        const binRatioMax = poolService.calculateBinPrice(position.upperBinId, binStep, tokenXDecimals, tokenYDecimals);
        const binRatioActive = poolService.calculateBinPrice(position.activeBinId, binStep, tokenXDecimals, tokenYDecimals);

        // Convert bin ratios to USD prices for AI context
        // For pairs like SOL/USDC: rangePrice = currentUSD * (binRatio / activeBinRatio)
        const minPrice = binRatioActive > 0 && currentUsdPrice > 0
            ? currentUsdPrice * (binRatioMin / binRatioActive)
            : binRatioMin;
        const maxPrice = binRatioActive > 0 && currentUsdPrice > 0
            ? currentUsdPrice * (binRatioMax / binRatioActive)
            : binRatioMax;

        // Calculate edge price (nearest edge to active bin)
        const nearerEdgeBin = position.activeBinId - position.lowerBinId < position.upperBinId - position.activeBinId
            ? position.lowerBinId
            : position.upperBinId;
        const binRatioEdge = poolService.calculateBinPrice(nearerEdgeBin, binStep, tokenXDecimals, tokenYDecimals);
        const edgePrice = binRatioActive > 0 && currentUsdPrice > 0
            ? currentUsdPrice * (binRatioEdge / binRatioActive)
            : binRatioEdge;

        return {
            timestamp: Date.now(),
            position: {
                address: position.publicKey,
                poolAddress: position.poolAddress,
                inRange: position.inRange,
                activeBin: position.activeBinId,
                rangeBins: [position.lowerBinId, position.upperBinId],
                distanceToEdge,
                ageHours,
                unclaimedFeesUsd,
                binUtilization,
                priceRange: {
                    minPrice,
                    maxPrice,
                    edgePrice,
                    binStep
                },
                tokenSymbols: {
                    x: tokenXSymbol,
                    y: tokenYSymbol
                }
            },
            market: {
                currentPrice: currentUsdPrice || poolInfo.price || 0,
                priceChange6h,
                volatilityScore: marketContext.volatilityScore || 0,
                volumeRatio: volumeData.volumeRatio,
                volumeTrend,
                trend30d,
                priceHistory30d,
                technicals
            },
            intraDayAnalysis,
            fees: (() => {
                // Calculate actual daily fees based on pool fees and position share
                const poolFees24h = volumeData.fees24h || 0;
                const poolLiquidity = volumeData.totalLiquidity || 1;
                const positionValue = position.totalValueUSD || 0;
                const positionShare = poolLiquidity > 0 ? positionValue / poolLiquidity : 0;
                const estimatedDailyFees = poolFees24h * positionShare;

                // Expected fees only if in range
                const expectedDaily = estimatedDailyFees * (position.inRange ? 1 : 0);

                // Efficiency based on bin utilization and in-range status
                const efficiency = position.inRange ? (binUtilization / 100) : 0;

                return {
                    actualDaily: estimatedDailyFees,
                    expectedDaily,
                    efficiency,
                    claimableUsd: unclaimedFeesUsd
                };
            })(),
            costs: (() => {
                // Dynamic cost calculation
                const rebalanceCostUsd = 0.03; // Base Solana tx cost
                const poolFees24h = volumeData.fees24h || 0;
                const poolLiquidity = volumeData.totalLiquidity || 1;
                const positionValue = position.totalValueUSD || 0;
                const positionShare = poolLiquidity > 0 ? positionValue / poolLiquidity : 0;
                const estimatedDailyFees = poolFees24h * positionShare;

                // Break-even hours: how long to recover rebalance cost
                const breakEvenHours = estimatedDailyFees > 0
                    ? (rebalanceCostUsd / estimatedDailyFees) * 24
                    : Infinity;

                return {
                    rebalanceCostUsd,
                    breakEvenHours: Number.isFinite(breakEvenHours) ? breakEvenHours : 999,
                    minROI: 2.0
                };
            })(),
            history: {
                totalRebalances: rebalanceHistory.length,
                successRate,
                avgBreakEvenHours: this.calculateAvgBreakEven(rebalanceHistory),
                lastRebalance: lastRebalance ? {
                    timestamp: lastRebalance.timestamp,
                    reason: lastRebalance.reason,
                    roi: lastRebalance.feesClaimedUsd / lastRebalance.transactionCostUsd
                } : undefined,
                patterns: this.detectPatterns(rebalanceHistory)
            }
        };
    }

    private async getLLMDecision(context: LLMDecisionContext): Promise<LLMDecision> {
        const systemPrompt = this.buildSystemPrompt();
        const userMessage = this.buildUserMessage(context);

        if (!this.providerConfig || !this.client) {
            throw new Error('LLM client not initialized');
        }

        const { provider, model } = this.providerConfig;

        // Retry configuration (Week 1 Quick Win: Retry logic with backoff)
        const maxRetries = 3;
        const baseDelayMs = 1000;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const startTime = Date.now();
            console.log(chalk.cyan(`[LLM] Calling ${provider}/${model} for position analysis... (attempt ${attempt}/${maxRetries})`));

            try {
                let decision: LLMDecision;

                // Temperature 0.1 for deterministic financial decisions (Week 1 Quick Win)
                const temperature = 0.1;

                if (provider === 'anthropic') {
                    const response = await this.client.messages.create({
                        model,
                        max_tokens: 2000,
                        temperature,
                        system: systemPrompt,
                        messages: [{ role: 'user', content: userMessage }]
                    });

                    const content = response.content[0];
                    if (content.type !== 'text') {
                        throw new Error('Unexpected response type');
                    }

                    decision = this.parseDecision(content.text);
                } else {
                    const response = await this.client.chat.completions.create({
                        model,
                        max_tokens: this.getMaxTokensForModel(model),
                        temperature,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userMessage }
                        ]
                    });

                    const content = response.choices[0].message.content;
                    decision = this.parseDecision(content);
                }

                const elapsed = Date.now() - startTime;
                const actionEmoji = decision.action === 'hold' ? '✋' : decision.action === 'rebalance' ? '♻️' : decision.action === 'close' ? '❌' : '🔄';
                console.log(chalk.green(`[LLM] ✓ Response received in ${elapsed}ms: ${actionEmoji} ${decision.action.toUpperCase()} (${decision.confidence}% confidence)`));

                return decision;
            } catch (error: any) {
                lastError = error;
                console.error(chalk.yellow(`[LLM] ⚠️ Attempt ${attempt} failed: ${error.message}`));

                // If not the last attempt, wait with exponential backoff
                if (attempt < maxRetries) {
                    const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
                    console.log(chalk.gray(`[LLM] Retrying in ${delayMs}ms...`));
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }

        // All retries failed
        console.error(chalk.red(`\n❌ LLM API Error after ${maxRetries} attempts: ${lastError?.message}`));
        throw lastError;
    }

    private buildSystemPrompt(): string {
        return `You are an expert DeFi liquidity provider advisor for Meteora DLMM (Dynamic Liquidity Market Maker) on Solana.

## YOUR ROLE
Provide clear, actionable advice about LP positions. Focus on:
1. Current position health and fee generation efficiency
2. Market conditions and technical signals affecting the position
3. Specific, practical recommendations with ROI justification
4. **REALISTIC RANGE RECOMMENDATIONS** that prevent frequent rebalancing
5. **QUANTIFIED RISK ASSESSMENT** with specific percentages and USD values

## METEORA DLMM BASICS
- Concentrated liquidity in discrete "bins" (price ranges)
- Only the active bin earns trading fees
- When price moves outside your range, you earn $0
- Rebalancing: close old position → create new position centered on current price
- Transaction costs are low (~$0.02-0.05 on Solana)
- **Strategies**: Spot (uniform), Curve (concentrated center), BidAsk (asymmetric)

## ⚠️ CRITICAL: MAXIMUM BIN LIMIT

**HARD LIMIT: 69 BINS TOTAL (34 bins per side maximum)**

Meteora DLMM has a technical constraint:
- Positions are limited to 69 bins in a single transaction
- This equals ~34 bins per side (bid + ask)
- Larger positions require multiple transactions which can fail

**NEVER recommend more than:**
- 34 binsPerSide
- 69 totalBins

## ENHANCED ANALYSIS PROCESS (6-Step Chain-of-Thought)

Before providing your final JSON response, work through this comprehensive analysis:

<thinking>
1. **Position Health Check**
   - Is position in range? [YES/NO]
   - Distance from edge: [X bins]
   - Health status: [healthy/at-risk/critical/inactive]
   - Current fee efficiency: [X%]

2. **Market Context Analysis**
   - 30-day trend: [bullish/bearish/neutral]
   - Current volatility: [HIGH >15% | MEDIUM 5-15% | LOW <5%]
   - Volume trend: [increasing/stable/decreasing]
   - Support level: $[X] ([Y%] below current)
   - Resistance level: $[X] ([Y%] above current)

3. **Risk Quantification**
   - Impermanent Loss if price +10%: [X%]
   - Impermanent Loss if price -10%: [X%]
   - Distance to support: [X%]
   - Distance to resistance: [X%]
   - Rebalance probability (7 days): [X%]
   
   IMPERMANENT LOSS FORMULA:
   IL = |2 * sqrt(price_ratio) / (1 + price_ratio) - 1| * 100
   - For +10% move (ratio=1.1): IL ≈ 0.47%
   - For -10% move (ratio=0.9): IL ≈ 0.56%
   - For +25% move (ratio=1.25): IL ≈ 2.8%
   - For -25% move (ratio=0.75): IL ≈ 3.3%

4. **Strategy Evaluation** (Should current strategy change?)
   - Current strategy: [Spot/Curve/BidAsk or inferred from distribution]
   - Is this optimal for current market? [YES/NO]
   - Alternative consideration: [if market changed significantly]
   
   STRATEGY SELECTION GUIDELINES:
   - Trending market → BidAsk (tilt toward trend direction)
   - High volatility → Spot (wider distribution handles swings)
   - Ranging/stable → Curve (concentrated = higher fees)

5. **Economic Viability**
   - Break-even time: [X hours]
   - Expected daily fees: $[X USD]
   - Rebalance cost: ~$0.03
   - ROI quality: [excellent <24h | marginal 24-72h | poor >72h]
   - Fee efficiency current vs optimal: [X% vs Y%]

6. **Confidence Breakdown**
   - Position data quality: [0-100]
   - Market signal clarity: [0-100]  
   - Historical pattern match: [0-100]
   - Economic viability: [0-100]
   - FINAL CONFIDENCE: average of above

7. **Final Decision**
   - Action: [rebalance/hold/compound/close]
   - Confidence: [0-100 based on breakdown above]
   - Urgency: [immediate/soon/low/none]
   - Key reasoning: [3-5 points from above analysis]
</thinking>

After your thinking, provide the final JSON response.

## DECISION FRAMEWORK

### 1. OUT OF RANGE (Critical)
→ ALWAYS recommend rebalance - earning $0 is unacceptable
→ urgency: "immediate"
→ Suggest maximum 34 bins per side (69 total) for volatile pairs

### 2. VERY NEAR EDGE (<10 bins from edge)
→ Evaluate trend direction
→ IF trend pushing toward edge → urgency: "immediate"
→ IF trend neutral/favorable → urgency: "soon"
→ Consider early rebalance to avoid going out-of-range

### 3. NEAR EDGE (10-30 bins from edge)
→ Check break-even time
→ IF break-even <24h → urgency: "soon" (worthwhile rebalance)
→ IF break-even 24-72h → urgency: "low" (optional rebalance)
→ IF break-even >72h → urgency: "none" (wait and monitor)

### 4. IN RANGE & HEALTHY (>30 bins from edge)
→ Hold unless range is too narrow (<5% width)
→ urgency: "low" or "none"

## FEW-SHOT EXAMPLES

<example id="1">
<scenario>
Position: 8 bins from lower edge, Spot strategy
Current price: $145, Support: $137 (5.5% below)
Trend: Bullish (pushing price UP, away from edge)
Volatility: 8% (MEDIUM)
Break-even: 6 hours
</scenario>
<correct_decision>
{
  "action": "hold",
  "confidence": 75,
  "urgency": "low",
  "reasoning": [
    "Only 8 bins from edge, but bullish trend is moving price AWAY from lower edge",
    "Support at $137 (5.5% below) provides downside buffer",
    "Monitor for next 24h - only rebalance if trend reverses"
  ],
  "positionHealth": "at-risk",
  "marketInsight": "Bullish momentum with support at $137 provides cushion",
  "riskAssessment": {
    "impermanentLoss": {
      "ifPriceUp10Percent": 0.47,
      "ifPriceDown10Percent": 0.56
    },
    "supportDistance": 5.5,
    "resistanceDistance": 8.2,
    "rebalanceProbability7Days": 25
  },
  "strategyEvaluation": {
    "currentStrategy": "Spot",
    "isOptimal": true,
    "reason": "Spot handles medium volatility well, no change needed"
  },
  "expectedOutcome": {
    "costUsd": 0.03,
    "dailyFeesUsd": 2.45,
    "breakEvenHours": 6,
    "roi": 12
  },
  "risks": ["Trend reversal could push position out of range within 24h"]
}
</correct_decision>
</example>

<example id="2">
<scenario>
Position: Out of range (below lower bin), Curve strategy
Current price: $142, was $155 when created
Break-even: 96 hours (very poor ROI)
Pool APR: 2% (very low fees)
Volatility: 22% (HIGH)
</scenario>
<correct_decision>
{
  "action": "close",
  "confidence": 90,
  "urgency": "immediate",
  "reasoning": [
    "Out of range earning $0 - CRITICAL",
    "Break-even time 96h (4 days) is unacceptable for rebalancing",
    "Low APR pool (2%) - better to close and redeploy capital elsewhere"
  ],
  "positionHealth": "inactive",
  "marketInsight": "High volatility (22%) in low-fee pool makes this position unviable",
  "riskAssessment": {
    "impermanentLoss": {
      "ifPriceUp10Percent": 0.47,
      "ifPriceDown10Percent": 0.56
    },
    "supportDistance": 12.0,
    "resistanceDistance": 3.5,
    "rebalanceProbability7Days": 85
  },
  "strategyEvaluation": {
    "currentStrategy": "Curve",
    "isOptimal": false,
    "reason": "Curve is wrong for high volatility - would need Spot for stability",
    "suggestedStrategy": "Spot"
  },
  "expectedOutcome": {
    "costUsd": 0.03,
    "dailyFeesUsd": 0.15,
    "breakEvenHours": 96,
    "roi": 0.25
  },
  "risks": ["Continued downtrend likely", "Pool APR too low to justify rebalance cost"]
}
</correct_decision>
</example>

<example id="3">
<scenario>
Position: 5 bins from upper edge, BidAsk strategy
Current price: $148, Resistance: $152 (2.7% above)
Trend: Bearish (pushing price DOWN, toward edge)
Volatility: 18% (HIGH)
Break-even: 4 hours
</scenario>
<correct_decision>
{
  "action": "rebalance",
  "confidence": 88,
  "urgency": "immediate",
  "reasoning": [
    "Only 5 bins from edge with bearish momentum - high risk of going out of range",
    "High volatility (18%) means rapid price movements expected",
    "Proactive rebalance now to avoid earning $0"
  ],
  "positionHealth": "critical",
  "marketInsight": "Bearish pressure with resistance at $152 suggests downward continuation",
  "riskAssessment": {
    "impermanentLoss": {
      "ifPriceUp10Percent": 0.47,
      "ifPriceDown10Percent": 0.56
    },
    "supportDistance": 7.5,
    "resistanceDistance": 2.7,
    "rebalanceProbability7Days": 90
  },
  "strategyEvaluation": {
    "currentStrategy": "BidAsk",
    "isOptimal": true,
    "reason": "BidAsk good for trending market, maintain after rebalance"
  },
  "expectedOutcome": {
    "costUsd": 0.03,
    "dailyFeesUsd": 8.50,
    "breakEvenHours": 4,
    "roi": 28
  },
  "suggestedRange": {
    "binsPerSide": 34,
    "totalBins": 69,
    "rangeWidthPercent": 5.0,
    "priceMin": 140.50,
    "priceMax": 155.50,
    "rangeJustification": "Maximum 69 bins centered on current price for volatile conditions"
  },
  "risks": ["High volatility may require another rebalance within 7 days"]
}
</correct_decision>
</example>

## OUTPUT FORMAT (REQUIRED FIELDS)
Respond with your <thinking> analysis first, then provide valid JSON.

The following fields are **REQUIRED** in your response:
- action, confidence, urgency, reasoning, positionHealth
- riskAssessment (with IL calculations and distances)
- strategyEvaluation (current strategy assessment)
- expectedOutcome (with breakEvenHours)
- risks array

\`\`\`json
{
  "action": "rebalance" | "hold" | "compound" | "close",
  "confidence": 0-100,
  "urgency": "immediate" | "soon" | "low" | "none",
  "reasoning": ["clear reason 1", "clear reason 2", "clear reason 3"],
  "marketInsight": "One sentence about current market conditions",
  "positionHealth": "healthy" | "at-risk" | "critical" | "inactive",
  "riskAssessment": {
    "impermanentLoss": {
      "ifPriceUp10Percent": number,
      "ifPriceDown10Percent": number
    },
    "supportDistance": number,
    "resistanceDistance": number,
    "rebalanceProbability7Days": number
  },
  "strategyEvaluation": {
    "currentStrategy": "Spot" | "Curve" | "BidAsk",
    "isOptimal": boolean,
    "reason": "Why current strategy is/isn't optimal",
    "suggestedStrategy": "Spot" | "Curve" | "BidAsk" (if change recommended)
  },
  "expectedOutcome": {
    "costUsd": 0.03,
    "dailyFeesUsd": number,
    "weeklyFeesUsd": number,
    "breakEvenHours": number,
    "roi": number,
    "positionLifespanDays": number
  },
  "suggestedRange": {
    "binsPerSide": 34,
    "totalBins": 69,
    "rangeWidthPercent": 5.0,
    "priceMin": 137.00,
    "priceMax": 151.00,
    "rangeJustification": "Maximum 69 bins for widest possible range"
  },
  "risks": ["specific risk if any"],
  "suggestedActions": ["actionable step 1", "actionable step 2"]
}
\`\`\`

## CRITICAL CONSTRAINTS
- NEVER recommend >34 binsPerSide or >69 totalBins
- ALWAYS include priceMin, priceMax, rangeWidthPercent in suggestedRange
- ALWAYS include riskAssessment with IL calculations
- ALWAYS include strategyEvaluation with current strategy analysis
- VALIDATE break-even time is realistic (<1000 hours)

## TONE
- Be confident and data-driven
- Reference specific USD prices and percentages
- Always stay within the 69-bin limit
- Quantify all risk assessments with specific numbers
- Acknowledge when the limit constrains ideal range width`;
    }

    /**
     * Build user message with XML structure for better LLM parsing
     * Implements Week 2 improvement: Hierarchical XML context
     */
    private buildUserMessage(ctx: LLMDecisionContext): string {
        // Format price helper
        const formatPrice = (p: number) => p < 0.01 ? p.toFixed(6) : p < 1 ? p.toFixed(4) : p.toFixed(2);

        // Calculate key metrics
        const totalBins = ctx.position.rangeBins[1] - ctx.position.rangeBins[0];
        const priceRange = ctx.position.priceRange;

        // Calculate range width percentage
        let rangeWidthPercent = 0;
        if (priceRange && priceRange.minPrice > 0 && ctx.market.currentPrice > 0) {
            rangeWidthPercent = ((priceRange.maxPrice - priceRange.minPrice) / ctx.market.currentPrice) * 100;
        }

        // Determine volatility state
        const volatilityState = ctx.market.volatilityScore > 0.15 ? 'HIGH' : ctx.market.volatilityScore < 0.05 ? 'LOW' : 'MEDIUM';

        // Calculate urgency assessment
        const urgencyContext = this.calculateUrgencyLevel(ctx);

        // Determine ROI quality
        const roiQuality = ctx.costs.breakEvenHours < 24 ? 'excellent' :
            ctx.costs.breakEvenHours < 72 ? 'marginal' : 'poor';

        // Build XML-structured message
        return `<position_data>
  <critical_metrics>
    <in_range>${ctx.position.inRange}</in_range>
    <distance_to_edge>${ctx.position.distanceToEdge}</distance_to_edge>
    <position_age_hours>${ctx.position.ageHours.toFixed(1)}</position_age_hours>
    <bin_utilization_percent>${ctx.position.binUtilization.toFixed(1)}</bin_utilization_percent>
    <total_bins>${totalBins}</total_bins>
  </critical_metrics>
  
  <price_range>
    <current_price>${formatPrice(ctx.market.currentPrice)}</current_price>
    <range_min>${priceRange ? formatPrice(priceRange.minPrice) : 'unknown'}</range_min>
    <range_max>${priceRange ? formatPrice(priceRange.maxPrice) : 'unknown'}</range_max>
    <edge_price>${priceRange ? formatPrice(priceRange.edgePrice) : 'unknown'}</edge_price>
    <range_width_percent>${rangeWidthPercent.toFixed(1)}</range_width_percent>
    <bin_step_bps>${priceRange?.binStep || 15}</bin_step_bps>
  </price_range>
  
  <fees>
    <daily_fees_usd>${ctx.fees.actualDaily.toFixed(4)}</daily_fees_usd>
    <expected_daily_usd>${ctx.fees.expectedDaily.toFixed(4)}</expected_daily_usd>
    <claimable_usd>${ctx.fees.claimableUsd.toFixed(4)}</claimable_usd>
    <efficiency_percent>${(ctx.fees.efficiency * 100).toFixed(1)}</efficiency_percent>
  </fees>
  
  <rebalance_economics>
    <cost_usd>${ctx.costs.rebalanceCostUsd.toFixed(3)}</cost_usd>
    <break_even_hours>${ctx.costs.breakEvenHours < 999 ? ctx.costs.breakEvenHours.toFixed(1) : 'unknown'}</break_even_hours>
    <roi_assessment>${roiQuality}</roi_assessment>
  </rebalance_economics>
</position_data>

<market_context>
  <trend_30d>${ctx.market.trend30d || 'neutral'}</trend_30d>
  <volatility_state>${volatilityState}</volatility_state>
  <volatility_percent>${(ctx.market.volatilityScore * 100).toFixed(1)}</volatility_percent>
  <volume_ratio>${ctx.market.volumeRatio.toFixed(2)}</volume_ratio>
  <volume_trend>${ctx.market.volumeTrend}</volume_trend>
  <price_change_6h_percent>${ctx.market.priceChange6h.toFixed(2)}</price_change_6h_percent>
  
  ${ctx.market.priceHistory30d ? `<price_history_30d>
    <min>${formatPrice(ctx.market.priceHistory30d.min)}</min>
    <max>${formatPrice(ctx.market.priceHistory30d.max)}</max>
    <volatility>${(ctx.market.priceHistory30d.volatility * 100).toFixed(1)}%</volatility>
  </price_history_30d>` : ''}
  
  ${ctx.market.technicals ? `<technical_levels>
    <support>${ctx.market.technicals.supportLevels[0] ? formatPrice(ctx.market.technicals.supportLevels[0]) : 'none'}</support>
    <resistance>${ctx.market.technicals.resistanceLevels[0] ? formatPrice(ctx.market.technicals.resistanceLevels[0]) : 'none'}</resistance>
  </technical_levels>` : ''}
</market_context>

${ctx.intraDayAnalysis ? `<intraday_signals>
  <hourly_snapshots>${ctx.intraDayAnalysis.hourlySnapshots}</hourly_snapshots>
  <momentum_direction>${ctx.intraDayAnalysis.momentum.direction}</momentum_direction>
  <momentum_price_percent>${ctx.intraDayAnalysis.momentum.price.toFixed(2)}</momentum_price_percent>
  <volume_spike>${ctx.intraDayAnalysis.signals.volumeSpike}</volume_spike>
  <price_breakout>${ctx.intraDayAnalysis.signals.priceBreakout}</price_breakout>
  <volatility_shift>${ctx.intraDayAnalysis.signals.volatilityShift}</volatility_shift>
</intraday_signals>` : ''}

<urgency_assessment>
  <calculated_urgency>${urgencyContext.urgency}</calculated_urgency>
  <reason>${urgencyContext.reason}</reason>
</urgency_assessment>

<history>
  <total_rebalances>${ctx.history.totalRebalances}</total_rebalances>
  <success_rate>${ctx.history.successRate.toFixed(0)}%</success_rate>
  ${ctx.history.lastRebalance ? `<last_rebalance>
    <timestamp>${new Date(ctx.history.lastRebalance.timestamp).toISOString()}</timestamp>
    <roi>${ctx.history.lastRebalance.roi.toFixed(1)}x</roi>
    <reason>${ctx.history.lastRebalance.reason}</reason>
  </last_rebalance>` : ''}
</history>

<constraints>
  <max_bins_per_side>34</max_bins_per_side>
  <max_total_bins>69</max_total_bins>
  <max_range_percent>~5% for SOL/USDC at 15bps bin step</max_range_percent>
</constraints>

Analyze this position using the <thinking> framework and provide your JSON recommendation.
Remember: NEVER suggest more than 34 binsPerSide or 69 totalBins.`;
    }

    /**
     * Calculate urgency level based on position metrics and market conditions
     * This ensures consistency with the decision framework described in the system prompt
     */
    private calculateUrgencyLevel(ctx: LLMDecisionContext): {
        urgency: 'immediate' | 'soon' | 'low' | 'none';
        reason: string;
    } {
        const { position, costs, market } = ctx;

        // CRITICAL: Out of range = earning $0
        if (!position.inRange) {
            return {
                urgency: 'immediate',
                reason: 'Position is out of range and earning no fees'
            };
        }

        // CRITICAL: Very close to edge (<10 bins)
        if (position.distanceToEdge < 10) {
            // Check if trend is pushing toward edge
            const nearLowerEdge = (position.activeBin - position.rangeBins[0]) < 10;
            const nearUpperEdge = (position.rangeBins[1] - position.activeBin) < 10;
            const trendAgainstPosition = (
                (market.trend30d === 'bearish' && nearLowerEdge) ||
                (market.trend30d === 'bullish' && nearUpperEdge)
            );

            if (trendAgainstPosition) {
                return {
                    urgency: 'immediate',
                    reason: `Only ${position.distanceToEdge} bins from edge with ${market.trend30d} trend pushing price out of range`
                };
            }

            return {
                urgency: 'soon',
                reason: `Only ${position.distanceToEdge} bins from edge - rebalance recommended within 24h`
            };
        }

        // WARNING: 10-30 bins from edge
        if (position.distanceToEdge < 30) {
            // Consider break-even time
            if (costs.breakEvenHours < 24) {
                return {
                    urgency: 'soon',
                    reason: `${position.distanceToEdge} bins from edge with quick break-even (${costs.breakEvenHours.toFixed(0)}h) - worthwhile rebalance`
                };
            }

            if (costs.breakEvenHours < 72) {
                return {
                    urgency: 'low',
                    reason: `${position.distanceToEdge} bins from edge, but break-even is ${costs.breakEvenHours.toFixed(0)} hours - marginal benefit`
                };
            }

            return {
                urgency: 'none',
                reason: `${position.distanceToEdge} bins from edge, but poor ROI (break-even ${costs.breakEvenHours.toFixed(0)}h) - wait and monitor`
            };
        }

        // HEALTHY: >30 bins from edge
        // Check if range is too narrow (will go out soon)
        const priceRange = position.priceRange;
        if (priceRange) {
            const rangeWidthPercent = ((priceRange.maxPrice - priceRange.minPrice) / market.currentPrice) * 100;

            if (rangeWidthPercent < 5 && costs.breakEvenHours < 48) {
                return {
                    urgency: 'low',
                    reason: `Range is narrow (${rangeWidthPercent.toFixed(1)}%) and will need rebalancing within 3-5 days - consider widening soon`
                };
            }
        }

        return {
            urgency: 'none',
            reason: 'Position is healthy - no action needed'
        };
    }

    /**
     * Parse and validate LLM decision response using Zod schema
     * Implements Week 1 Quick Win: JSON schema validation
     */
    private parseDecision(text: string): LLMDecision {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/```json\n([\s\S]+?)\n```/) || text.match(/\{[\s\S]+\}/);

        if (!jsonMatch) {
            console.log(chalk.red('[LLM] ❌ No valid JSON found in response'));
            console.log(chalk.gray(`  Response snippet: ${text.slice(0, 200)}...`));
            throw new Error('No valid JSON in LLM response');
        }

        const jsonText = jsonMatch[1] || jsonMatch[0];

        try {
            const parsed = JSON.parse(jsonText);

            // Validate with Zod schema
            const validationResult = LLMDecisionSchema.safeParse(parsed);

            if (validationResult.success) {
                console.log(chalk.gray('[LLM] ✓ Decision validated successfully'));
                return validationResult.data as LLMDecision;
            } else {
                // Log validation errors but try to fix common issues
                console.log(chalk.yellow('[LLM] ⚠️ Validation issues detected, attempting to fix...'));

                const fixedDecision = this.fixDecisionValidationErrors(parsed, validationResult.error);

                // Re-validate after fixes
                const revalidation = LLMDecisionSchema.safeParse(fixedDecision);
                if (revalidation.success) {
                    console.log(chalk.gray('[LLM] ✓ Decision fixed and validated'));
                    return revalidation.data as LLMDecision;
                }

                // If still failing, log details and use partial data
                console.log(chalk.yellow('[LLM] ⚠️ Some validation errors remain:'));
                validationResult.error.issues.forEach(issue => {
                    console.log(chalk.gray(`    - ${issue.path.join('.')}: ${issue.message}`));
                });

                // Return the fixed version anyway with type assertion
                return fixedDecision as LLMDecision;
            }
        } catch (parseError: any) {
            console.log(chalk.red(`[LLM] ❌ JSON parse error: ${parseError.message}`));
            console.log(chalk.gray(`  JSON snippet: ${jsonText.slice(0, 200)}...`));
            throw new Error(`Invalid JSON in LLM response: ${parseError.message}`);
        }
    }

    /**
     * Fix common validation errors in LLM decisions
     * Implements output validation from Week 1 Quick Wins
     */
    private fixDecisionValidationErrors(decision: any, error: z.ZodError): any {
        const fixed = { ...decision };

        // Fix confidence: clamp to 0-100
        if (typeof fixed.confidence === 'number') {
            if (fixed.confidence < 0 || fixed.confidence > 100) {
                console.log(chalk.gray(`    Fixing confidence: ${fixed.confidence} → ${Math.max(0, Math.min(100, fixed.confidence))}`));
                fixed.confidence = Math.max(0, Math.min(100, fixed.confidence));
            }
        }

        // Fix binsPerSide: cap at 34
        if (fixed.suggestedRange?.binsPerSide) {
            if (fixed.suggestedRange.binsPerSide > 34) {
                console.log(chalk.gray(`    Fixing binsPerSide: ${fixed.suggestedRange.binsPerSide} → 34`));
                fixed.suggestedRange.binsPerSide = 34;
            }
        }

        // Fix totalBins: cap at 69
        if (fixed.suggestedRange?.totalBins) {
            if (fixed.suggestedRange.totalBins > 69) {
                console.log(chalk.gray(`    Fixing totalBins: ${fixed.suggestedRange.totalBins} → 69`));
                fixed.suggestedRange.totalBins = 69;
            }
        }

        // Fix conflicting action/urgency (hold + immediate = invalid)
        if (fixed.action === 'hold' && fixed.urgency === 'immediate') {
            console.log(chalk.gray(`    Fixing conflicting urgency: 'immediate' → 'none' (for hold action)`));
            fixed.urgency = 'none';
        }

        // Ensure reasoning is an array
        if (!Array.isArray(fixed.reasoning)) {
            if (typeof fixed.reasoning === 'string') {
                fixed.reasoning = [fixed.reasoning];
            } else {
                fixed.reasoning = ['No reasoning provided'];
            }
        }

        // Ensure risks is an array
        if (!Array.isArray(fixed.risks)) {
            if (typeof fixed.risks === 'string') {
                fixed.risks = [fixed.risks];
            } else {
                fixed.risks = [];
            }
        }

        // Ensure expectedOutcome exists with defaults
        if (!fixed.expectedOutcome) {
            fixed.expectedOutcome = {
                costUsd: 0.03,
                breakEvenHours: 0,
                roi: 0
            };
        }

        return fixed;
    }

    private async logDecision(
        positionAddress: string,
        context: LLMDecisionContext,
        decision: LLMDecision
    ): Promise<void> {
        const log: Partial<LLMDecisionLog> = {
            timestamp: Date.now(),
            positionAddress,
            context,
            decision,
            approved: null,
            approvedAt: null,
            executedAt: null,
            actualOutcome: null
        };

        analyticsDataStore.recordLLMDecision(log);
    }

    private getMockDecision(position: UserPosition): LLMDecision {
        const isOutOfRange = !position.inRange;
        const distanceToEdge = Math.min(
            position.activeBinId - position.lowerBinId,
            position.upperBinId - position.activeBinId
        );

        if (isOutOfRange) {
            return {
                action: 'rebalance',
                confidence: 95,
                urgency: 'immediate',
                reasoning: ['Position is out of range and not earning fees - CRITICAL'],
                expectedOutcome: {
                    costUsd: 0.028,
                    expectedFeesNext24h: 0.1,
                    breakEvenHours: 6.7,
                    roi: 3.6
                },
                risks: ['Mock decision - LLM not configured'],
                suggestedActions: ['Configure LLM provider in settings to enable AI analysis']
            };
        }

        if (distanceToEdge < 5) {
            return {
                action: 'rebalance',
                confidence: 75,
                urgency: 'soon',
                reasoning: [`Position is ${distanceToEdge} bins from edge`, 'Proactive rebalance recommended'],
                expectedOutcome: {
                    costUsd: 0.028,
                    expectedFeesNext24h: 0.08,
                    breakEvenHours: 8.4,
                    roi: 2.9
                },
                risks: ['Mock decision - LLM not configured'],
                suggestedActions: ['Configure LLM provider for smarter analysis']
            };
        }

        return {
            action: 'hold',
            confidence: 60,
            urgency: 'none',
            reasoning: ['Position is healthy', 'No action needed at this time'],
            expectedOutcome: {
                costUsd: 0,
                expectedFeesNext24h: 0.05,
                breakEvenHours: 0,
                roi: 0
            },
            risks: ['Mock decision - LLM not configured'],
            suggestedActions: ['Continue monitoring position']
        };
    }

    private calculateAvgBreakEven(history: any[]): number {
        if (history.length === 0) return 0;

        const breakEvens = history
            .filter(r => r.feesClaimedUsd > 0)
            .map(r => {
                const hourlyFees = r.feesClaimedUsd / 24;
                return r.transactionCostUsd / hourlyFees;
            });

        if (breakEvens.length === 0) return 0;

        return breakEvens.reduce((sum, val) => sum + val, 0) / breakEvens.length;
    }

    private detectPatterns(history: any[]): string[] {
        const patterns: string[] = [];

        if (history.length === 0) return patterns;

        const autoRebalances = history.filter(r => r.reasonCode === 'AUTO');
        if (autoRebalances.length > history.length * 0.7) {
            patterns.push('Automated rebalances have 70%+ success rate');
        }

        const outOfRange = history.filter(r => r.reasonCode === 'OUT_OF_RANGE');
        if (outOfRange.length > 0) {
            patterns.push('Out-of-range rebalances are always necessary');
        }

        const recent = history.slice(-5);
        const recentSuccessful = recent.filter(r => {
            const roi = r.feesClaimedUsd / r.transactionCostUsd;
            return roi >= 2.0;
        });
        if (recentSuccessful.length >= 4) {
            patterns.push('Recent rebalances show strong 80%+ success rate');
        }

        return patterns;
    }

    /**
     * Calculate support levels using Fibonacci-style retracements
     * Fixes Issue #1: Broken support calculation for low-price tokens
     */
    private calculateSupportLevels(currentPrice: number, min: number, max: number): number[] {
        if (currentPrice <= 0) return [0];
        
        const priceRange = max - min;
        const rangeRatio = priceRange / currentPrice;
        
        // Check if historical range is valid (not more than 200% of current price)
        const rangeValid = priceRange > 0 && rangeRatio < 2.0;
        
        let supportLevels: number[];
        
        if (rangeValid && min > 0) {
            // Use Fibonacci-style retracements from historical range
            supportLevels = [
                currentPrice * 0.95,                    // -5% (immediate support)
                min + (priceRange * 0.618),             // 61.8% retracement level
                min + (priceRange * 0.382),             // 38.2% retracement level
                min                                      // Historical low
            ].filter(s => s > 0 && s < currentPrice);
        } else {
            // Fallback: percentage-based levels (safe for any price, including sub-$1 tokens)
            supportLevels = [
                currentPrice * 0.95,  // -5%
                currentPrice * 0.90,  // -10%
                currentPrice * 0.85   // -15%
            ];
        }
        
        // Validate: reject any level more than 100% away from current price
        return supportLevels
            .filter(s => {
                const distance = Math.abs((s - currentPrice) / currentPrice);
                return distance < 1.0; // Max 100% distance
            })
            .sort((a, b) => b - a); // Sort descending (closest to current first)
    }

    /**
     * Calculate resistance levels using Fibonacci-style retracements
     * Fixes Issue #1: Broken resistance calculation for low-price tokens
     */
    private calculateResistanceLevels(currentPrice: number, min: number, max: number): number[] {
        if (currentPrice <= 0) return [currentPrice * 1.1];
        
        const priceRange = max - min;
        const rangeRatio = priceRange / currentPrice;
        
        // Check if historical range is valid (not more than 200% of current price)
        const rangeValid = priceRange > 0 && rangeRatio < 2.0;
        
        let resistanceLevels: number[];
        
        if (rangeValid && max > currentPrice) {
            // Use Fibonacci-style levels from historical range
            resistanceLevels = [
                currentPrice * 1.05,                    // +5% (immediate resistance)
                max - (priceRange * 0.618),             // 61.8% from top
                max - (priceRange * 0.382),             // 38.2% from top
                max                                      // Historical high
            ].filter(r => r > currentPrice);
        } else {
            // Fallback: percentage-based levels (safe for any price)
            resistanceLevels = [
                currentPrice * 1.05,  // +5%
                currentPrice * 1.10,  // +10%
                currentPrice * 1.15   // +15%
            ];
        }
        
        // Validate: reject any level more than 100% away from current price
        return resistanceLevels
            .filter(r => {
                const distance = Math.abs((r - currentPrice) / currentPrice);
                return distance < 1.0; // Max 100% distance
            })
            .sort((a, b) => a - b); // Sort ascending (closest to current first)
    }

    /**
     * Calculate impermanent loss for a given price change
     * Uses standard AMM formula: IL = 2*sqrt(price_ratio)/(1+price_ratio) - 1
     */
    private calculateImpermanentLoss(priceChangePercent: number): number {
        const priceRatio = 1 + (priceChangePercent / 100);
        if (priceRatio <= 0) return 0;
        
        const il = 2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1;
        return Math.abs(il * 100); // Return as positive percentage
    }

    /**
     * Validate position economics - check if position size makes economic sense
     * Fixes Issue #4: No Position Size Warning
     */
    private validatePositionEconomics(
        apr: number,
        positionValueUsd: number,
        rebalanceFrequencyDays: number
    ): {
        viable: boolean;
        warnings: Array<{ severity: string; message: string; impact: string }>;
        recommendations: string[];
        breakEvenAnalysis: {
            feesBeforeRebalance: number;
            rebalanceCost: number;
            netProfit: number;
            isProfitable: boolean;
        };
    } {
        const warnings: Array<{ severity: string; message: string; impact: string }> = [];
        const recommendations: string[] = [];
        
        // Calculate economics
        const annualFees = positionValueUsd * (apr / 100);
        const dailyFees = annualFees / 365;
        const feesBeforeRebalance = dailyFees * rebalanceFrequencyDays;
        const rebalanceCost = 0.03; // Average SOL transaction cost in USD
        const netProfit = feesBeforeRebalance - rebalanceCost;
        
        // Check if position is viable
        const viable = netProfit > 0;
        
        if (!viable) {
            warnings.push({
                severity: 'CRITICAL',
                message: `Position will LOSE money: Earn $${feesBeforeRebalance.toFixed(4)} but rebalance costs $${rebalanceCost.toFixed(2)}`,
                impact: `Net loss: -$${Math.abs(netProfit).toFixed(4)} per rebalance cycle`
            });
        }
        
        // Check if position is too small for this APR
        if (apr < 5 && positionValueUsd < 100) {
            warnings.push({
                severity: 'HIGH',
                message: `Low APR (${apr.toFixed(1)}%) + small position ($${positionValueUsd.toFixed(0)}) = poor economics`,
                impact: 'Rebalance costs will consume most/all fees'
            });
            
            // Calculate minimum viable position size
            // Formula: minSize = (rebalanceCost * 365) / (apr/100) / rebalanceDays * 2 (safety margin)
            const minViableSize = rebalanceFrequencyDays > 0 
                ? (rebalanceCost * 365) / (apr / 100) / rebalanceFrequencyDays * 2
                : 100;
            recommendations.push(`Increase position to at least $${Math.ceil(minViableSize)} for this APR`);
        }
        
        // Check if APR is too low
        if (apr < 3) {
            warnings.push({
                severity: 'MEDIUM',
                message: `Very low APR (${apr.toFixed(1)}%) - consider higher-yield pools`,
                impact: 'Better opportunities likely exist elsewhere'
            });
            recommendations.push('Look for pools with APR > 5% for better returns');
        }
        
        return {
            viable,
            warnings,
            recommendations,
            breakEvenAnalysis: {
                feesBeforeRebalance,
                rebalanceCost,
                netProfit,
                isProfitable: viable
            }
        };
    }

    /**
     * Build context for position creation analysis
     */
    private async buildCreationContext(poolInfo: any): Promise<PoolCreationContext> {
        const { priceService } = require('./price.service');
        const { fetchPoolVolume } = require('./meteoraVolume.service');

        // Get pool basic info
        const poolAddress = poolInfo.address || poolInfo.pubkey?.toString();
        const tokenX = poolInfo.tokenX?.symbol || 'TokenX';
        const tokenY = poolInfo.tokenY?.symbol || 'TokenY';
        const tokenXMint = poolInfo.tokenX?.mint || poolInfo.mint_x;
        const tokenYMint = poolInfo.tokenY?.mint || poolInfo.mint_y;
        const currentPrice = poolInfo.price || 0;
        const binStep = poolInfo.binStep || 0;
        const activeBinId = poolInfo.activeBin || 0;

        // Fetch price history (30 days) - Try Birdeye first, then CoinGecko, then DexScreener
        let priceHistory = null;

        // Strategy 1: Try Birdeye (Best source for Solana tokens)
        try {
            priceHistory = await priceService.getHistoricalPrices(tokenXMint, 30);
            if (priceHistory && priceHistory.length > 0) {
                console.log(chalk.gray(`  ✓ Fetched 30-day history from Birdeye (${priceHistory.length} points)`));
            }
        } catch (error) {
            // Birdeye failed, continue to next strategy
        }

        // Strategy 2: Try CoinGecko (works for major tokens) if Birdeye failed
        if (!priceHistory || priceHistory.length === 0) {
            try {
                const coinGeckoId = await priceService.getCoinGeckoId(tokenX);
                if (coinGeckoId) {
                    priceHistory = await priceService.getPriceHistory(coinGeckoId, 30);
                    console.log(chalk.gray('  ✓ Fetched 30-day history from CoinGecko'));
                }
            } catch (error) {
                // CoinGecko failed, will try DexScreener
            }
        }

        // Strategy 3: Try DexScreener if others failed
        if (!priceHistory || priceHistory.length === 0) {
            try {
                console.log(chalk.gray('  ⏳ Trying DexScreener API...'));
                const axios = require('axios');

                // DexScreener pair info includes chart data
                const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenXMint}`;
                const response = await axios.get(dexUrl, { timeout: 10000 });

                if (response.data && response.data.pairs && response.data.pairs.length > 0) {
                    const pair = response.data.pairs[0];

                    // DexScreener doesn't provide historical OHLC easily, but we can use current data
                    // and estimate based on 24h change
                    if (pair.priceChange && pair.priceChange.h24) {
                        const currentPriceFromDex = parseFloat(pair.priceUsd || currentPrice);
                        const change24h = parseFloat(pair.priceChange.h24) / 100;

                        // Generate approximate 30-day history based on recent volatility
                        priceHistory = [];
                        for (let i = 30; i >= 0; i--) {
                            const variance = (Math.random() - 0.5) * change24h * 2; // Random walk
                            const estimatedPrice = currentPriceFromDex * (1 + (variance * i / 30));
                            priceHistory.push({
                                timestamp: Date.now() - (i * 24 * 60 * 60 * 1000),
                                price: estimatedPrice
                            });
                        }
                        console.log(chalk.yellow('  ℹ️  Using estimated price history from DexScreener'));
                    }
                }
            } catch (dexError) {
                console.log(chalk.yellow('  ℹ️  DexScreener also unavailable'));
            }
        }

        // Final fallback: If ALL APIs failed, use current price only
        if (!priceHistory || priceHistory.length === 0) {
            console.log(chalk.red('  ⚠️  No price history available - using current price only'));
            priceHistory = [{
                timestamp: Date.now(),
                price: currentPrice
            }];
        }

        // Calculate volatility and trend
        let volatility = 0;
        let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        let min = currentPrice;
        let max = currentPrice;

        if (priceHistory && priceHistory.length > 1) {
            const prices = priceHistory.map((p: any) => p.price);
            min = Math.min(...prices);
            max = Math.max(...prices);
            const mean = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
            const squaredDiffs = prices.map((p: number) => Math.pow(p - mean, 2));
            const variance = squaredDiffs.reduce((a: number, b: number) => a + b, 0) / prices.length;
            volatility = Math.sqrt(variance) / mean;

            // Determine trend
            const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
            const secondHalf = prices.slice(Math.floor(prices.length / 2));
            const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;

            if (secondAvg > firstAvg * 1.05) trend = 'bullish';
            else if (secondAvg < firstAvg * 0.95) trend = 'bearish';
        }

        // Fetch volume data
        let volumeData = null;
        try {
            volumeData = await fetchPoolVolume(poolAddress);
        } catch (error) {
            volumeData = {
                volume24h: 0,
                volume7d: 0,
                volumeRatio: 1.0
            };
        }

        const volumeTrend = volumeData.volumeRatio > 1.2 ? 'increasing' :
            volumeData.volumeRatio < 0.8 ? 'decreasing' : 'stable';

        // Check if stablecoin pair
        const stableSymbols = ['USDC', 'USDT', 'DAI', 'USDC.E', 'USDT.E', 'USDH'];
        const isStablePair = stableSymbols.includes(tokenX) && stableSymbols.includes(tokenY);
        const hasStable = stableSymbols.includes(tokenX) || stableSymbols.includes(tokenY);

        return {
            timestamp: Date.now(),
            pool: {
                address: poolAddress,
                tokenX,
                tokenY,
                binStep,
                currentPrice,
                activeBinId: activeBinId,
                tvl: poolInfo.tvl || 0,
                apr: poolInfo.apr || 0
            },
            market: {
                priceHistory30d: {
                    min,
                    max,
                    current: currentPrice,
                    volatility,
                    trend
                },
                volume: {
                    current24h: volumeData.volume24h,
                    avg7d: volumeData.volume7d / 7,
                    ratio: volumeData.volumeRatio,
                    trend: volumeTrend
                },
                technicals: {
                    atr: volatility * currentPrice,
                    atrState: trend === 'neutral' ? 'flat' : 'expanding',
                    supportLevels: this.calculateSupportLevels(currentPrice, min, max),
                    resistanceLevels: this.calculateResistanceLevels(currentPrice, min, max)
                }
            },
            pairCharacteristics: {
                isStablePair,
                hasStable,
                volatilityScore: volatility * 100,
                volumeSkew: 0  // Default, would need order book data
            }
        };
    }

    /**
     * Get LLM recommendation for position creation
     */
    private async getCreationRecommendation(context: PoolCreationContext): Promise<PoolCreationRecommendation> {
        const systemPrompt = this.buildCreationSystemPrompt();
        const userMessage = this.buildCreationUserMessage(context);

        const provider = this.providerConfig?.provider;
        console.log(chalk.cyan(`[LLM] 🧠 Calling LLM for pool creation analysis...`));
        const startTime = Date.now();

        let responseText = '';

        // Temperature 0.3 for creation analysis (allows some strategic creativity)
        const temperature = 0.3;

        try {
            if (provider === 'anthropic') {
                const response = await this.client.messages.create({
                    model: this.providerConfig!.model,
                    max_tokens: 2048,
                    temperature,
                    messages: [{
                        role: 'user',
                        content: systemPrompt + '\n\n' + userMessage
                    }]
                });
                responseText = response.content[0].text;
            } else {
                // OpenAI-compatible
                const response = await this.client.chat.completions.create({
                    model: this.providerConfig!.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    temperature,
                    max_tokens: this.getMaxTokensForModel(this.providerConfig!.model)
                });

                // Debug: Log full response structure
                console.log(chalk.gray(`  🔍 Full Response: ${JSON.stringify(response, null, 2)}`));

                if (response.choices && response.choices.length > 0) {
                    const choice = response.choices[0];
                    const message = choice.message;
                    responseText = message.content || '';

                    if (choice.finish_reason === 'length') {
                        console.log(chalk.yellow('  ⚠️  LLM response truncated (max_tokens reached)'));
                    }

                    // Check for deepseek reasoning content if main content is empty
                    if (!responseText && (message as any).reasoning_content) {
                        console.log(chalk.yellow('  ℹ️  Using reasoning_content as fallback'));
                        responseText = (message as any).reasoning_content;
                    }
                } else {
                    console.log(chalk.red('  ❌ No choices in LLM response'));
                }
            }

            const elapsed = Date.now() - startTime;
            console.log(chalk.green(`[LLM] ✓ Creation recommendation received in ${elapsed}ms`));
            return this.parseCreationRecommendation(responseText, context);
        } catch (error: any) {
            // Enhanced error diagnostics
            console.log(chalk.red(`\n❌ LLM API Error Details:`));
            console.log(chalk.gray(`   Provider: ${provider}`));
            console.log(chalk.gray(`   Model: ${this.providerConfig?.model}`));

            if (error.response) {
                console.log(chalk.gray(`   Status: ${error.response.status}`));
                console.log(chalk.gray(`   Message: ${error.response.data?.error?.message || error.message}`));
            } else if (error.message) {
                console.log(chalk.gray(`   Error: ${error.message}`));
            }

            console.log(chalk.yellow(`\n💡 Suggestions:`));
            console.log(chalk.gray(`   1. Check your LLM configuration: npm run cli → LLM AI Selection`));
            console.log(chalk.gray(`   2. Verify your API key is valid`));
            console.log(chalk.gray(`   3. Check your internet connection`));
            console.log(chalk.gray(`   4. For now, using algorithmic fallback\n`));

            throw error; // Re-throw to be caught by analyzePoolForCreation
        }
    }

    /**
     * Build system prompt for creation analysis
     * Enhanced with chain-of-thought, strategy comparison, and risk quantification
     */
    private buildCreationSystemPrompt(): string {
        return `You are an expert DeFi liquidity provider strategist for Meteora DLMM pools.

Your role is to analyze pools and recommend optimal position configurations for new liquidity providers.

## ⚠️ CRITICAL: MAXIMUM BIN LIMIT

**HARD LIMIT: 69 BINS TOTAL (34 bins per side maximum)**

Meteora DLMM has a technical constraint:
- Positions are limited to 69 bins in a single transaction
- bidBins (below active) + askBins (above active) + 1 (active bin) = totalBins
- Example: 34 bid + 34 ask + 1 active = 69 total ✅
- Larger positions require multiple transactions which fail with "InvalidRealloc" error

**NEVER recommend more than:**
- bidBins: 34 maximum
- askBins: 34 maximum  
- totalBins: 69 maximum (calculated as bidBins + askBins + 1)

## AVAILABLE STRATEGIES
1. **Spot**: Symmetric liquidity around current price. Best for neutral/sideways markets.
2. **Curve**: Tight concentrated range. Best for stablecoin pairs (USDC/USDT).
3. **BidAsk**: Asymmetric liquidity (more on one side). Best for trending/directional pairs.

## ANALYSIS PROCESS (Chain-of-Thought)

Before providing your final JSON, work through this step-by-step:

<thinking>
1. **Market Regime Classification**
   - Trend: [bullish/bearish/neutral] based on 30d data
   - Volatility: [HIGH >15% | MEDIUM 5-15% | LOW <5%]
   - Volume state: [increasing/stable/decreasing]
   - Combined regime: [e.g., "Bearish Trending + Medium Volatility"]

2. **Strategy Selection Logic**
   - Why the chosen strategy is optimal for this regime
   - Alternative strategies considered and why rejected
   - Confidence in strategy choice: [0-100]

3. **Range Calculation**
   - Ideal range width: [X%] based on 30d volatility
   - Constrained by 69-bin limit: [YES/NO]
   - Final bins per side: [X] (max 34)
   - Justification: [reasoning]

4. **Risk Analysis**
   - Support level: $[X] | Distance from current: [X%]
   - Resistance level: $[X] | Distance from current: [X%]
   - Probability of hitting range edge in 7 days: [X%]
   - Expected rebalance frequency: [X days]

5. **Confidence Breakdown** (REQUIRED - show your math)
   Score each factor 0-100, then calculate weighted average:
   - Market clarity: [X]/100 (is trend direction obvious?)
   - Data quality: [X]/100 (do we have full 30d price history?)
   - Strategy-regime fit: [X]/100 (how well does strategy match market?)
   - Risk acceptability: [X]/100 (are the risks manageable?)
   
   Calculation: ([market] + [data] + [strategy] + [risk]) / 4 = [X]%
   Round to nearest 5%: FINAL CONFIDENCE = [X]%

6. **Sanity Check**
   Before outputting, verify:
   - [ ] bidBins ≤ 34? 
   - [ ] askBins ≤ 34?
   - [ ] totalBins ≤ 69?
   - [ ] Support/resistance distances < 100%?
   - [ ] APR estimate is positive?
   If any fail, adjust and explain.
</thinking>

After your thinking, provide the final JSON response.

## STRATEGY COMPARISON (Required in output)

For EVERY recommendation, compare all 3 strategies with QUANTIFIED metrics:

### APR Estimation Guidelines:
- **Spot**: pool_base_apr × 0.75 (wide range = lower concentration bonus)
- **Curve**: pool_base_apr × 1.2 (tight concentration = higher efficiency, but only for low-vol pairs)
- **BidAsk**: pool_base_apr × 0.85 (asymmetric, good for trending markets)

### Fee Efficiency Guidelines:
- **Spot**: 65-75% (liquidity spread across wide range)
- **Curve**: 85-95% (concentrated = captures more trades, but risky if volatile)
- **BidAsk**: 70-85% (directional efficiency when trend aligns)

### Rebalance Frequency Calculation:
- Formula: range_width_percent / daily_volatility = days_until_rebalance
- Example: 5% range / 1% daily vol = 5 days

📊 STRATEGY COMPARISON FORMAT (with metrics):

1. [Chosen Strategy] ✅ RECOMMENDED
   - Est. APR: [X]% 
   - Fee Efficiency: [X]%
   - Rebalance: Every [X] days
   - Risk Score: [LOW/MEDIUM/HIGH]
   - Best for: [market condition]

2. [Alternative 1] ❌ NOT RECOMMENDED  
   - Est. APR: [X]% ([Y]% lower than recommended)
   - Fee Efficiency: [X]%
   - Rebalance: Every [X] days
   - Risk Score: [LOW/MEDIUM/HIGH]
   - Issue: [specific problem]
   - Why rejected: [clear reason with numbers]

3. [Alternative 2] ❌ NOT RECOMMENDED
   - Est. APR: [X]% ([Y]% lower than recommended)
   - Fee Efficiency: [X]%
   - Rebalance: Every [X] days
   - Risk Score: [LOW/MEDIUM/HIGH]
   - Issue: [specific problem]
   - Why rejected: [clear reason with numbers]

💡 VERDICT: [Chosen] earns [X-Y]% more APR than alternatives because [reason]

## RISK QUANTIFICATION FRAMEWORK

For every recommendation, calculate these specific risks:

1. **Impermanent Loss Risk**
   - Use formula: IL = |2 * sqrt(price_ratio) / (1 + price_ratio) - 1| * 100
   - Where price_ratio = new_price / old_price
   - Example: +10% price move → price_ratio=1.1 → IL ≈ 0.47%
   - Example: +50% price move → price_ratio=1.5 → IL ≈ 2.02%
   - Example: +100% price move (2x) → price_ratio=2.0 → IL ≈ 5.72%
   - Severity: LOW <1% | MEDIUM 1-3% | HIGH >3%

2. **Rebalancing Frequency Risk**
   - Based on range width vs 30d volatility
   - Expected days until out-of-range: [X]
   - Probability of rebalance within 7 days: [X%]

3. **Support/Resistance Break Risk**
   - Distance to nearest support: [X%]
   - Probability of breaking in 7 days: [X%]
   - Impact if broken: [description]

## FEW-SHOT EXAMPLES

<example id="1">
  <scenario>
    Pool: SOL/USDC
    Current Price: $127.20
    30d Trend: Bearish (-8%)
    Support: $127.21 (0.01% away - AT SUPPORT)
    Resistance: $135.00
    Volatility: 12% (MEDIUM)
    Volume: Declining (0.8x)
  </scenario>
  
  <thinking>
    1. **Market Regime**: Bearish trending (-8%) + Medium volatility (12%)
       Combined: "Bearish Trending + Medium Volatility"
    
    2. **Strategy Selection**: BidAsk
       - Bearish trend → price likely moves down → need more bid-side liquidity
       - 60/40 split: 60% SOL (bid) / 40% USDC (ask)
       - Why NOT Spot: Symmetric 50/50 wastes capital on ask side
       - Why NOT Curve: 12% volatility too high for tight concentration
    
    3. **Range Calculation**:
       - Ideal range: 2x volatility = 24% 
       - Bins needed: ~80 bins (too many)
       - Constrained to 69 bins: YES
       - Final: 34 bid + 34 ask = 69 total
    
    4. **Risk Analysis**:
       - Support: $127.21 (0.01% below - AT SUPPORT!)
       - Resistance: $135.00 (6.1% above)
       - Support break probability: 45% in 7 days
       - Expected rebalance: 5 days
    
    5. **Confidence Breakdown**:
       - Market clarity: 90/100 (clear bearish trend)
       - Data quality: 95/100 (full 30d history)
       - Strategy fit: 85/100 (BidAsk matches bearish)
       - Risk acceptability: 70/100 (at support is risky)
       Calculation: (90+95+85+70)/4 = 85% → Round to 85%
       But strong trend clarity bumps to FINAL: 90%
    
    6. **Sanity Check**:
       - [✓] bidBins=34 ≤ 34
       - [✓] askBins=34 ≤ 34
       - [✓] totalBins=69 ≤ 69
       - [✓] Support distance 0.01% < 100%
       - [✓] APR 18.5% > 0
  </thinking>
  
  <correct_output>
    {
      "strategy": "BidAsk",
      "confidence": 90,
      "reasoning": [
        "Bearish trend requires asymmetric liquidity (BidAsk)",
        "Price AT critical support $127.21 - breakout imminent",
        "60/40 split favors SOL (bid) to capture downside if support breaks",
        "Max 69 bins for widest range given volatility constraint"
      ],
      "binConfiguration": { "bidBins": 34, "askBins": 34, "totalBins": 69 },
      "liquidityDistribution": { "tokenXPercentage": 60, "tokenYPercentage": 40, "isAsymmetric": true },
      "strategyComparison": [
        { 
          "strategy": "BidAsk (60/40)", 
          "recommended": true, 
          "expectedAPR": 18.5, 
          "feeEfficiency": 82,
          "rebalanceDays": 5,
          "riskScore": "MEDIUM",
          "bestFor": "Bearish trending markets"
        },
        { 
          "strategy": "Spot (50/50)", 
          "recommended": false, 
          "expectedAPR": 14.2,
          "feeEfficiency": 68,
          "rebalanceDays": 6,
          "riskScore": "MEDIUM",
          "issue": "Symmetric liquidity wastes 40% capital on ask side", 
          "whyRejected": "Bearish trend means price moves down, not up - ask side earns nothing"
        },
        { 
          "strategy": "Curve (Tight)", 
          "recommended": false, 
          "expectedAPR": 8.5,
          "feeEfficiency": 45,
          "rebalanceDays": 2,
          "riskScore": "HIGH",
          "issue": "12% volatility incompatible with tight ±1% range", 
          "whyRejected": "Would go out-of-range 3x more often than BidAsk"
        }
      ],
      "riskAssessment": {
        "impermanentLoss": { "priceUp10Percent": { "il": 0.47, "severity": "LOW" }, "priceDown10Percent": { "il": 0.47, "severity": "LOW" } },
        "rebalancing": { "expectedDaysUntilRebalance": 5, "probabilityWithin7Days": 65, "costPerRebalance": 0.03, "breakEvenHours": 8 },
        "marketStructure": { "nearestSupport": { "price": 127.21, "distance": "0.01%", "breakProbability": 45 }, "nearestResistance": { "price": 135.00, "distance": "6.1%", "breakProbability": 15 } }
      },
      "mitigationStrategies": [
        "Set price alert at $125.50 (2% below support)",
        "Monitor position every 6 hours after day 4",
        "If support breaks, immediate rebalance to $120-$128 range"
      ]
    }
  </correct_output>
</example>

<example id="2">
  <scenario>
    Pool: USDC/USDT (stablecoin pair)
    Current Price: $1.0002
    30d Trend: Neutral (0.02% change)
    Volatility: 0.5% (VERY LOW)
    Volume: High (2.5x average)
  </scenario>
  
  <thinking>
    1. **Market Regime**: Neutral (0.02%) + Very low volatility (0.5%)
       Combined: "Stablecoin Range-Bound"
    
    2. **Strategy Selection**: Curve
       - Stablecoin → price stays ±0.5% → tight concentration ideal
       - High volume (2.5x) → more fees from concentrated liquidity
       - Why NOT Spot: Spreads liquidity over unnecessary range
       - Why NOT BidAsk: No directional trend to exploit
    
    3. **Range Calculation**:
       - Ideal range: 2x volatility = 1%
       - Bins needed: ~20 bins (well under limit)
       - Constrained to 69 bins: NO
       - Final: 10 bid + 10 ask = 21 total
    
    4. **Risk Analysis**:
       - Support: $0.9985 (0.17% below)
       - Resistance: $1.0020 (0.18% above)
       - Edge probability: <5% in 7 days
       - Expected rebalance: 30+ days
    
    5. **Confidence Breakdown**:
       - Market clarity: 100/100 (textbook stablecoin)
       - Data quality: 95/100 (full history)
       - Strategy fit: 100/100 (Curve perfect for stables)
       - Risk acceptability: 95/100 (very low risk)
       Calculation: (100+95+100+95)/4 = 97.5% → Round to 95%
       FINAL: 95%
    
    6. **Sanity Check**:
       - [✓] bidBins=10 ≤ 34
       - [✓] askBins=10 ≤ 34
       - [✓] totalBins=21 ≤ 69
       - [✓] Support distance 0.17% < 100%
       - [✓] APR 8.5% > 0
  </thinking>
  
  <correct_output>
    {
      "strategy": "Curve",
      "confidence": 95,
      "reasoning": [
        "Stablecoin pair with 0.5% volatility - ideal for Curve",
        "High volume (2.5x) means concentrated liquidity earns more fees",
        "Tight 20-bin range sufficient for ±0.5% price movement",
        "Low rebalance risk - position should last 30+ days"
      ],
      "binConfiguration": { "bidBins": 10, "askBins": 10, "totalBins": 21 },
      "liquidityDistribution": { "tokenXPercentage": 50, "tokenYPercentage": 50, "isAsymmetric": false },
      "strategyComparison": [
        { 
          "strategy": "Curve (Tight)", 
          "recommended": true, 
          "expectedAPR": 8.5, 
          "feeEfficiency": 95,
          "rebalanceDays": 30,
          "riskScore": "LOW",
          "bestFor": "Stablecoin pairs with low volatility"
        },
        { 
          "strategy": "Spot (50/50)", 
          "recommended": false, 
          "expectedAPR": 4.2,
          "feeEfficiency": 55,
          "rebalanceDays": 60,
          "riskScore": "LOW",
          "issue": "Spreads liquidity over unnecessary wide range", 
          "whyRejected": "Stablecoins don't need wide ranges - wastes 50% fee efficiency"
        },
        { 
          "strategy": "BidAsk", 
          "recommended": false, 
          "expectedAPR": 3.8,
          "feeEfficiency": 45,
          "rebalanceDays": 45,
          "riskScore": "LOW",
          "issue": "No directional trend to exploit", 
          "whyRejected": "Stablecoin pair has no trend - asymmetric distribution provides no benefit"
        }
      ],
      "expectedPerformance": { "estimatedAPR": 8.5, "feeEfficiency": 95, "rebalanceFrequency": "low" }
    }
  </correct_output>
</example>

## BIN RANGE GUIDELINES (Within 69-bin limit!)

### For SOL/USDC and similar volatile pairs:
| Recommendation | Bins Per Side | Total Bins | Approx. Range |
|----------------|---------------|------------|---------------|
| MAXIMUM (use this) | 34 | 69 | ±5% |
| Moderate | 25 | 51 | ±3.5% |
| Tight | 15 | 31 | ±2% |

### For Stablecoin pairs (USDC/USDT):
- Use 10-20 bins per side (20-40 total)
- Price stays within ±0.5% typically

### For Meme/High-volatility tokens:
- Use the MAXIMUM 34 bins per side (69 total)
- Even this may require frequent rebalancing

## OUTPUT FORMAT (JSON):

After your <thinking> section, output valid JSON with these fields.
**IMPORTANT: ALL fields below are REQUIRED. You MUST include strategyComparison with ALL metrics, riskAssessment, and mitigationStrategies in EVERY response.**

{
  "strategy": "Spot|Curve|BidAsk",
  "confidence": 85,
  "reasoning": ["reason1", "reason2", "reason3"],
  "binConfiguration": {
    "minBinId": number,
    "maxBinId": number,
    "bidBins": number (max 34),
    "askBins": number (max 34),
    "totalBins": number (max 69)
  },
  "liquidityDistribution": {
    "tokenXPercentage": number,
    "tokenYPercentage": number,
    "isAsymmetric": boolean
  },
  "expectedPerformance": {
    "estimatedAPR": number,
    "feeEfficiency": number,
    "rebalanceFrequency": "high|medium|low"
  },
  "risks": ["risk1", "risk2"],
  "marketRegime": "description",
  "strategyComparison": [
    { 
      "strategy": "name", 
      "recommended": true/false, 
      "expectedAPR": number,
      "feeEfficiency": number,
      "rebalanceDays": number,
      "riskScore": "LOW|MEDIUM|HIGH",
      "bestFor": "market condition (for recommended only)",
      "issue": "problem (for rejected only)", 
      "whyRejected": "reason (for rejected only)" 
    }
  ],
  "riskAssessment": {
    "impermanentLoss": { "priceUp10Percent": { "il": number, "severity": "LOW|MEDIUM|HIGH" } },
    "rebalancing": { "expectedDaysUntilRebalance": number, "probabilityWithin7Days": number },
    "marketStructure": { "nearestSupport": { "price": number, "distance": "X%", "breakProbability": number } }
  },
  "mitigationStrategies": ["strategy1", "strategy2"]
}`;
    }

    /**
     * Build user message for creation analysis
     */
    private buildCreationUserMessage(ctx: PoolCreationContext): string {
        return `Analyze this pool for optimal position creation:

    POOL: ${ctx.pool.tokenX}/${ctx.pool.tokenY}
Current Price: $${ctx.pool.currentPrice.toFixed(4)}
Bin Step: ${ctx.pool.binStep} bps
TVL: $${(ctx.pool.tvl / 1000000).toFixed(2)} M
Current APR: ${ctx.pool.apr.toFixed(2)}%

    30 - DAY PRICE HISTORY:
- Min: $${ctx.market.priceHistory30d.min.toFixed(4)}
- Max: $${ctx.market.priceHistory30d.max.toFixed(4)}
- Volatility: ${(ctx.market.priceHistory30d.volatility * 100).toFixed(2)}%
    - Trend: ${ctx.market.priceHistory30d.trend}

VOLUME:
- 24h Volume: $${(ctx.market.volume.current24h / 1000).toFixed(1)} K
    - 7d Avg: $${(ctx.market.volume.avg7d / 1000).toFixed(1)} K
        - Ratio: ${ctx.market.volume.ratio.toFixed(2)} x
            - Trend: ${ctx.market.volume.trend}

TECHNICALS:
- ATR: ${ctx.market.technicals.atr.toFixed(4)} (${ctx.market.technicals.atrState})
- Support: [${ctx.market.technicals.supportLevels.map(l => '$' + l.toFixed(2)).join(', ')}]
    - Resistance: [${ctx.market.technicals.resistanceLevels.map(l => '$' + l.toFixed(2)).join(', ')}]

PAIR CHARACTERISTICS:
- Stablecoin Pair: ${ctx.pairCharacteristics.isStablePair ? 'YES' : 'NO'}
- Has Stable: ${ctx.pairCharacteristics.hasStable ? 'YES' : 'NO'}
- Volatility Score: ${ctx.pairCharacteristics.volatilityScore.toFixed(2)}%

Recommend the optimal strategy, bin configuration, and explain your reasoning.

REMINDER: Your JSON response MUST include:
- strategyComparison (array of 3 strategies: Spot, Curve, BidAsk with recommended/rejected status)
- riskAssessment (impermanentLoss, rebalancing, marketStructure sections)
- mitigationStrategies (array of 2-3 actionable strategies)`;
    }

    /**
     * Parse and validate LLM response for creation recommendation using Zod schema
     * Implements Week 1 Quick Win: JSON schema validation for pool creation
     */
    private parseCreationRecommendation(text: string, context: PoolCreationContext): PoolCreationRecommendation {
        try {
            // Debug: Log raw response length
            console.log(chalk.gray(`  🔍 Raw LLM Response Length: ${text.length}`));

            // Extract JSON from response (handle markdown blocks)
            const jsonMatch = text.match(/```json\n([\s\S]+?)\n```/) || text.match(/\{[\s\S]+\}/);

            if (jsonMatch) {
                const jsonText = jsonMatch[1] || jsonMatch[0];
                const parsed = JSON.parse(jsonText);

                // Validate with Zod schema
                const validationResult = PoolCreationRecommendationSchema.safeParse(parsed);

                if (validationResult.success) {
                    console.log(chalk.gray('[LLM] ✓ Creation recommendation validated successfully'));

                    // Debug: Log presence of enhanced fields
                    const data = validationResult.data;
                    console.log(chalk.cyan('[LLM] Enhanced fields check:'));
                    console.log(chalk.cyan(`  • strategyComparison: ${data.strategyComparison ? `✓ (${data.strategyComparison.length} strategies)` : '✗ not present'}`));
                    console.log(chalk.cyan(`  • riskAssessment: ${data.riskAssessment ? '✓ present' : '✗ not present'}`));
                    console.log(chalk.cyan(`  • mitigationStrategies: ${data.mitigationStrategies ? `✓ (${data.mitigationStrategies.length} items)` : '✗ not present'}`));

                    return data;
                } else {
                    // Log validation errors but try to fix common issues
                    console.log(chalk.yellow('[LLM] ⚠️ Validation issues detected, attempting to fix...'));

                    const fixedRecommendation = this.fixCreationValidationErrors(parsed, context);

                    // Re-validate after fixes
                    const revalidation = PoolCreationRecommendationSchema.safeParse(fixedRecommendation);
                    if (revalidation.success) {
                        console.log(chalk.gray('[LLM] ✓ Recommendation fixed and validated'));
                        return revalidation.data;
                    }

                    // If still failing, log details
                    console.log(chalk.yellow('[LLM] ⚠️ Some validation errors remain:'));
                    validationResult.error.issues.forEach(issue => {
                        console.log(chalk.gray(`    - ${issue.path.join('.')}: ${issue.message}`));
                    });

                    // Return the fixed version with type assertion
                    return fixedRecommendation as PoolCreationRecommendation;
                }
            } else {
                console.log(chalk.yellow(`  ⚠️  Could not extract JSON from LLM response`));
                console.log(chalk.gray(`  Response snippet: ${text.slice(0, 100)}...`));
            }
        } catch (error: any) {
            console.log(chalk.yellow(`  ⚠️  Failed to parse LLM JSON: ${error.message}`));
        }

        // Return default recommendation
        console.log(chalk.yellow('  ⚠️  Falling back to algorithmic recommendation'));
        return this.getMockCreationRecommendation(context);
    }

    /**
     * Fix common validation errors in creation recommendations
     * Implements output validation from Week 1 Quick Wins
     */
    private fixCreationValidationErrors(recommendation: any, context: PoolCreationContext): any {
        const fixed = { ...recommendation };

        // Fix confidence: clamp to 0-100
        if (typeof fixed.confidence === 'number') {
            if (fixed.confidence < 0 || fixed.confidence > 100) {
                console.log(chalk.gray(`    Fixing confidence: ${fixed.confidence} → ${Math.max(0, Math.min(100, fixed.confidence))}`));
                fixed.confidence = Math.max(0, Math.min(100, fixed.confidence));
            }
        }

        // Fix binConfiguration
        if (fixed.binConfiguration) {
            // Cap bidBins at 34
            if (fixed.binConfiguration.bidBins > 34) {
                console.log(chalk.gray(`    Fixing bidBins: ${fixed.binConfiguration.bidBins} → 34`));
                fixed.binConfiguration.bidBins = 34;
            }

            // Cap askBins at 34
            if (fixed.binConfiguration.askBins > 34) {
                console.log(chalk.gray(`    Fixing askBins: ${fixed.binConfiguration.askBins} → 34`));
                fixed.binConfiguration.askBins = 34;
            }

            // Recalculate totalBins (bid + ask + 1 for active bin)
            // If LLM outputs 68 (34+34), correct it to 69
            const calculatedTotal = fixed.binConfiguration.bidBins + fixed.binConfiguration.askBins;
            if (calculatedTotal === 68) {
                // LLM forgot the active bin - correct to 69
                fixed.binConfiguration.totalBins = 69;
            } else {
                fixed.binConfiguration.totalBins = Math.min(calculatedTotal + 1, 69);
            }

            // Ensure totalBins doesn't exceed 69
            if (fixed.binConfiguration.totalBins > 69) {
                fixed.binConfiguration.totalBins = 69;
            }

            // Fix minBinId and maxBinId if needed
            if (!fixed.binConfiguration.minBinId || !fixed.binConfiguration.maxBinId) {
                const activeBinId = context.pool.activeBinId;
                fixed.binConfiguration.minBinId = activeBinId - fixed.binConfiguration.bidBins;
                fixed.binConfiguration.maxBinId = activeBinId + fixed.binConfiguration.askBins;
            }
        }

        // Ensure reasoning is an array
        if (!Array.isArray(fixed.reasoning)) {
            if (typeof fixed.reasoning === 'string') {
                fixed.reasoning = [fixed.reasoning];
            } else {
                fixed.reasoning = ['AI-generated recommendation'];
            }
        }

        // Ensure risks is an array
        if (!Array.isArray(fixed.risks)) {
            if (typeof fixed.risks === 'string') {
                fixed.risks = [fixed.risks];
            } else {
                fixed.risks = ['Price volatility may cause rebalancing needs'];
            }
        }

        // Ensure expectedPerformance exists
        if (!fixed.expectedPerformance) {
            fixed.expectedPerformance = {
                estimatedAPR: context.pool.apr || 0,
                feeEfficiency: 75,
                rebalanceFrequency: 'medium'
            };
        }

        // Ensure liquidityDistribution exists
        if (!fixed.liquidityDistribution) {
            fixed.liquidityDistribution = {
                tokenXPercentage: 50,
                tokenYPercentage: 50,
                isAsymmetric: false
            };
        }

        // Ensure marketRegime exists
        if (!fixed.marketRegime) {
            fixed.marketRegime = context.market.priceHistory30d.trend || 'Unknown';
        }

        return fixed;
    }

    /**
     * Get mock creation recommendation when LLM unavailable
     */
    private getMockCreationRecommendation(poolInfo: any): PoolCreationRecommendation {
        const currentPrice = poolInfo.currentPrice || poolInfo.pool?.currentPrice || 0;
        const activeBinId = poolInfo.activeBinId || poolInfo.pool?.activeBinId || 0;
        const tokenX = poolInfo.tokenX?.symbol || poolInfo.pool?.tokenX || 'TokenX';
        const tokenY = poolInfo.tokenY?.symbol || poolInfo.pool?.tokenY || 'TokenY';

        // Detect pair type for bin recommendations
        const stableSymbols = ['USDC', 'USDT', 'DAI', 'PYUSD'];
        const isStablePair = stableSymbols.includes(tokenX) && stableSymbols.includes(tokenY);
        const hasStable = stableSymbols.includes(tokenX) || stableSymbols.includes(tokenY);

        // Meme tokens need wider ranges
        const memeTokens = ['BONK', 'WIF', 'POPCAT', 'BOME', 'MEW', 'MYRO'];
        const isMemeToken = memeTokens.includes(tokenX) || memeTokens.includes(tokenY);

        let strategy: 'Spot' | 'Curve' | 'BidAsk' = 'Spot';
        let bidBins: number;
        let askBins: number;
        let reasoning: string[];

        if (isStablePair) {
            // Stablecoin pairs - tight range
            strategy = 'Curve';
            bidBins = 20;
            askBins = 20;
            reasoning = [
                'Algorithmic recommendation (LLM unavailable)',
                'Stablecoin pair detected → Curve strategy with 40 bins',
                'Price typically stays within ±0.5%'
            ];
        } else if (isMemeToken) {
            // Meme tokens - maximum range (limited by 69-bin constraint)
            strategy = 'Spot';
            bidBins = 34;
            askBins = 34;
            reasoning = [
                'Algorithmic recommendation (LLM unavailable)',
                'Meme token detected → Maximum 69 bins (Meteora limit)',
                'High volatility - using widest possible range'
            ];
        } else if (hasStable) {
            // Major pair with stablecoin (SOL/USDC, ETH/USDC, etc.)
            strategy = 'Spot';
            bidBins = 34;
            askBins = 34;
            reasoning = [
                'Algorithmic recommendation (LLM unavailable)',
                'Major pair with stablecoin → Maximum 69 bins (Meteora limit)',
                'Covers approximately ±5% price movement'
            ];
        } else {
            // Crypto/Crypto pairs
            strategy = 'Spot';
            bidBins = 25;
            askBins = 25;
            reasoning = [
                'Algorithmic recommendation (LLM unavailable)',
                'Crypto pair → Spot strategy with 50 bins',
                'Moderate range for correlated assets'
            ];
        }

        return {
            strategy,
            confidence: 70,
            reasoning,
            binConfiguration: {
                minBinId: activeBinId - bidBins,
                maxBinId: activeBinId + askBins,
                bidBins,
                askBins,
                totalBins: bidBins + askBins
            },
            liquidityDistribution: {
                tokenXPercentage: 50,
                tokenYPercentage: 50,
                isAsymmetric: false
            },
            expectedPerformance: {
                estimatedAPR: poolInfo.apr || 0,
                feeEfficiency: 75,
                rebalanceFrequency: isMemeToken ? 'high' : 'medium'
            },
            risks: [
                'Price volatility may cause rebalancing needs',
                'Market conditions may change suddenly'
            ],
            marketRegime: 'Unknown (LLM not configured)'
        };
    }
}

export const llmAgent = new LLMAgentService();
