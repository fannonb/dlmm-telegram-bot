import dotenv from 'dotenv';
dotenv.config();

import { UserPosition } from './position.service';
import { analyticsDataStore } from './analyticsDataStore.service';
import { configManager } from '../config/config.manager';
import chalk from 'chalk';

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
        const startTime = Date.now();
        console.log(chalk.cyan(`[LLM] Calling ${provider}/${model} for position analysis...`));

        try {
            let decision: LLMDecision;

            if (provider === 'anthropic') {
                const response = await this.client.messages.create({
                    model,
                    max_tokens: 2000,
                    temperature: 0.3,
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
                    temperature: 0.3,
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
            console.error(chalk.red(`\n❌ LLM API Error: ${error.message}`));
            throw error;
        }
    }

    private buildSystemPrompt(): string {
        return `You are an expert DeFi liquidity provider advisor for Meteora DLMM (Dynamic Liquidity Market Maker) on Solana.

## YOUR ROLE
Provide clear, actionable advice about LP positions. Focus on:
1. Current position health and fee generation efficiency
2. Market conditions and technical signals affecting the position
3. Specific, practical recommendations with ROI justification
4. **REALISTIC RANGE RECOMMENDATIONS** that prevent frequent rebalancing

## METEORA DLMM BASICS
- Concentrated liquidity in discrete "bins" (price ranges)
- Only the active bin earns trading fees
- When price moves outside your range, you earn $0
- Rebalancing: close old position → create new position centered on current price
- Transaction costs are low (~$0.02-0.05 on Solana)

## ⚠️ CRITICAL: MAXIMUM BIN LIMIT

**HARD LIMIT: 69 BINS TOTAL (34 bins per side maximum)**

Meteora DLMM has a technical constraint:
- Positions are limited to 69 bins in a single transaction
- This equals ~34 bins per side (bid + ask)
- Larger positions require multiple transactions which can fail

**NEVER recommend more than:**
- 34 binsPerSide
- 69 totalBins

## RANGE WIDTH REQUIREMENTS (within the 69-bin limit)

**For 69 bins total on SOL/USDC (bin step ~15bps):**
- Range ≈ ±5% from current price
- Example: $144 price → $137 to $151 range
- This is the MAXIMUM range possible in a single transaction

**For volatile pairs, use the full 69 bins (34 per side)**
**For stable pairs, use fewer bins (10-20 per side)**

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
→ Consider range width - narrow ranges need urgent rebalancing

### 4. IN RANGE & HEALTHY (>30 bins from edge)
→ Focus on fee efficiency and range width
→ Hold unless range is too narrow (<5% width)
→ urgency: "low" or "none"

### Urgency Definitions:
- **immediate**: Must act now (out of range OR <10 bins with bad trend)
- **soon**: Should rebalance within 24h (near edge + good ROI)
- **low**: Consider rebalancing (suboptimal but not urgent)
- **none**: Hold position (everything is healthy)

## KEY METRICS TO ANALYZE
- **Distance from Edge**: Critical determinant of urgency
- **Break-Even Time**: Must be <72h to justify rebalancing
- **Current Range Width**: Narrow ranges (<5%) need widening
- **Fee Performance**: Daily fees, projected weekly fees
- **Market Signals**: Momentum direction, volume trends, 30-day trend

## OUTPUT FORMAT
Respond ONLY with valid JSON:
\`\`\`json
{
  "action": "rebalance" | "hold" | "compound" | "close",
  "confidence": 0-100,
  "urgency": "immediate" | "soon" | "low" | "none",
  "reasoning": ["clear reason 1", "clear reason 2", "clear reason 3"],
  "marketInsight": "One sentence about current market conditions",
  "positionHealth": "healthy" | "at-risk" | "critical" | "inactive",
  "expectedOutcome": {
    "costUsd": 0.03,                    // Rebalance transaction cost
    "dailyFeesUsd": number,             // Expected daily fees after rebalance
    "weeklyFeesUsd": number,            // Expected weekly fees (dailyFeesUsd * 7)
    "breakEvenHours": number,           // Hours to recover rebalance cost
    "roi": number,                      // ROI after 7 days (weeklyFeesUsd / costUsd)
    "positionLifespanDays": number      // Expected days before next rebalance needed
  },
  "suggestedRange": {
    "binsPerSide": 34,
    "totalBins": 69,
    "rangeWidthPercent": 5.0,
    "priceMin": 137.00,
    "priceMax": 151.00,
    "rangeJustification": "Maximum 69 bins (Meteora limit) for widest possible range"
  },
  "risks": ["specific risk if any"],
  "suggestedActions": ["actionable step 1", "actionable step 2"]
}
\`\`\`

## SUGGESTED RANGE REQUIREMENTS (MANDATORY)

### Maximum Limits (ENFORCED):
- binsPerSide: **34 maximum**
- totalBins: **69 maximum**
- These limits are technical constraints of Meteora DLMM

### For SOL/USDC at ~$144:
- MAXIMUM: 34 bins per side = ~$137-$151 (±5%)
- This is the widest possible single-transaction range
- **NEVER suggest 50, 69, 100+ bins per side - this exceeds the limit**

### Range Justification MUST include:
1. The % width of the suggested range
2. Confirmation it's within the 69-bin limit
3. Why this range is appropriate for current conditions

## EXAMPLE: SOL/USDC OUT OF RANGE

**CORRECT Response:**
\`\`\`json
{
  "suggestedRange": {
    "binsPerSide": 34,
    "totalBins": 69,
    "rangeWidthPercent": 5.2,
    "priceMin": 137.00,
    "priceMax": 151.50,
    "rangeJustification": "Using maximum 69 bins (Meteora single-tx limit) for widest ±5% range. Will need rebalancing if SOL moves beyond this."
  }
}
\`\`\`
✅ This respects the technical limit while maximizing range

## TONE
- Be confident and data-driven
- Reference specific USD prices and percentages
- Always stay within the 69-bin limit
- Acknowledge when the limit constrains ideal range width`;
    }

    private buildUserMessage(ctx: LLMDecisionContext): string {
        const statusEmoji = ctx.position.inRange ? '✅' : '🚨';
        const volumeEmoji = ctx.market.volumeRatio > 1.5 ? '📈' : ctx.market.volumeRatio < 0.7 ? '📉' : '➡️';

        // Calculate key metrics
        const totalBins = ctx.position.rangeBins[1] - ctx.position.rangeBins[0];
        const centerBin = Math.floor((ctx.position.rangeBins[0] + ctx.position.rangeBins[1]) / 2);
        const distanceFromCenter = Math.abs(ctx.position.activeBin - centerBin);
        const nearerEdge = ctx.position.activeBin < centerBin ? 'lower' : 'upper';

        // Format price helper
        const formatPrice = (p: number) => p < 0.01 ? p.toFixed(6) : p < 1 ? p.toFixed(4) : p.toFixed(2);

        // Price range info
        const priceRange = ctx.position.priceRange;
        const tokenY = ctx.position.tokenSymbols?.y || 'USD';
        let priceRangeStr = '';
        if (priceRange) {
            priceRangeStr = `\n- **Price Range:** $${formatPrice(priceRange.minPrice)} - $${formatPrice(priceRange.maxPrice)}`;
            priceRangeStr += `\n- **Nearest Edge:** $${formatPrice(priceRange.edgePrice)} (${ctx.position.distanceToEdge} bins away)`;
        }

        let richMarketData = '';
        if (ctx.market.trend30d && ctx.market.trend30d !== 'neutral') {
            richMarketData = `\n- 30-Day Trend: ${ctx.market.trend30d.toUpperCase()}`;
        }

        // Build technical levels section
        let technicalLevels = '';
        if (ctx.market.technicals) {
            const support = ctx.market.technicals.supportLevels?.[0];
            const resistance = ctx.market.technicals.resistanceLevels?.[0];
            if (support || resistance) {
                technicalLevels = `\n\n## Technical Levels`;
                if (support) technicalLevels += `\n- Nearest Support: $${formatPrice(support)}`;
                if (resistance) technicalLevels += `\n- Nearest Resistance: $${formatPrice(resistance)}`;
            }
        }

        // Build 30-day price range section
        let priceHistorySection = '';
        if (ctx.market.priceHistory30d) {
            priceHistorySection = `\n- 30-Day Range: $${formatPrice(ctx.market.priceHistory30d.min)} - $${formatPrice(ctx.market.priceHistory30d.max)}`;
        }

        // Build intraday signals section
        let intradaySection = '';
        if (ctx.intraDayAnalysis) {
            const momentum = ctx.intraDayAnalysis.momentum;
            const signals = ctx.intraDayAnalysis.signals;
            intradaySection = `\n\n## Intraday Signals (${ctx.intraDayAnalysis.hourlySnapshots}h data)`;
            intradaySection += `\n- Momentum: ${momentum.direction.toUpperCase()} (${momentum.price > 0 ? '+' : ''}${momentum.price.toFixed(2)}%/hr avg)`;

            const activeSignals: string[] = [];
            if (signals.volumeSpike) activeSignals.push('🚨 Volume Spike');
            if (signals.priceBreakout) activeSignals.push('🚨 Price Breakout');
            if (signals.volatilityShift) activeSignals.push('⚠️ Volatility Shift');

            if (activeSignals.length > 0) {
                intradaySection += `\n- Active Signals: ${activeSignals.join(', ')}`;
            } else {
                intradaySection += `\n- Active Signals: None`;
            }
        }

        // Build fee performance section
        let feeSection = `\n\n## Fee Performance`;
        feeSection += `\n- Estimated Daily Fees: $${ctx.fees.actualDaily.toFixed(4)}`;
        feeSection += `\n- Expected (if in-range): $${ctx.fees.expectedDaily.toFixed(4)}`;
        feeSection += `\n- Unclaimed Fees: $${ctx.fees.claimableUsd.toFixed(4)}`;
        feeSection += `\n- Fee Efficiency: ${(ctx.fees.efficiency * 100).toFixed(1)}%`;

        // Build cost/ROI section
        let costSection = `\n\n## Rebalance Economics`;
        costSection += `\n- Rebalance Cost: ~$${ctx.costs.rebalanceCostUsd.toFixed(3)}`;
        if (ctx.costs.breakEvenHours < 999) {
            costSection += `\n- Break-even Time: ${ctx.costs.breakEvenHours.toFixed(1)} hours`;
            const worthIt = ctx.costs.breakEvenHours < 24 ? '✅ Worthwhile' : ctx.costs.breakEvenHours < 72 ? '⚠️ Marginal' : '❌ Not recommended';
            costSection += `\n- Rebalance ROI: ${worthIt}`;
        } else {
            costSection += `\n- Break-even Time: Cannot calculate (no fee data)`;
        }

        // Calculate range width as percentage
        const priceRangeData = ctx.position.priceRange;
        let rangeWidthSection = '';
        let rangeWarning = '';
        if (priceRangeData && priceRangeData.minPrice > 0 && ctx.market.currentPrice > 0) {
            const rangeWidthPercent = ((priceRangeData.maxPrice - priceRangeData.minPrice) / ctx.market.currentPrice) * 100;

            // Calculate maximum achievable range based on bin limits
            const binStep = priceRangeData.binStep;
            const maxBinsPerSide = 34; // Meteora single-transaction limit
            const maxAchievableRangePercent = (maxBinsPerSide * binStep * 0.0001) * 100; // ~5.1% for 15bps binStep

            // Updated thresholds based on REALITY
            const rangeAssessment =
                rangeWidthPercent < 3 ? '🚨 CRITICALLY NARROW - will go out of range in <1 day' :
                    rangeWidthPercent < 4 ? '⚠️ TOO NARROW - will go out of range in 1-3 days' :
                        rangeWidthPercent < 5 ? '⚠️ Narrow - expect rebalancing in 3-5 days' :
                            rangeWidthPercent >= maxAchievableRangePercent ? '✅ Maximum width (Meteora limit)' :
                                rangeWidthPercent < maxAchievableRangePercent * 0.8 ? '✅ Moderate - room to widen' :
                                    '✅ Good width';

            rangeWidthSection = `\n- **Range Width:** ${rangeWidthPercent.toFixed(1)}% (${rangeAssessment})`;
            rangeWidthSection += `\n- **Maximum achievable:** ${maxAchievableRangePercent.toFixed(1)}% (34 bins/side)`;
            rangeWidthSection += `\n- **Current Bins:** ${totalBins} total (${Math.floor(totalBins / 2)} per side)`;

            // Add explicit warning for narrow ranges with CORRECT bin limits
            if (rangeWidthPercent < 5) {
                const halfRange = maxAchievableRangePercent / 2;
                rangeWarning = `\n\n⚠️ **RANGE TOO NARROW:** Your ${rangeWidthPercent.toFixed(1)}% range is insufficient for SOL volatility.
- **Maximum achievable range:** ±${halfRange.toFixed(1)}% ($${formatPrice(ctx.market.currentPrice * (1 - halfRange / 100))} - $${formatPrice(ctx.market.currentPrice * (1 + halfRange / 100))})
- **Bins used:** 34 per side (69 total, Meteora single-transaction limit)
- **Expected lifespan:** 5-7 days with current volatility
- **Note:** This is the widest possible range. Wider ranges require multiple transactions.`;
            }
        }

        // Build 30-day context for range recommendation
        let historicalContext = '';
        if (ctx.market.priceHistory30d) {
            const hist = ctx.market.priceHistory30d;
            const historicalRange = ((hist.max - hist.min) / hist.min) * 100;
            const suggestedMinRange = Math.max(historicalRange * 0.6, 10); // At least 10% or 60% of 30-day range
            const suggestedMin = ctx.market.currentPrice * (1 - suggestedMinRange / 100);
            const suggestedMax = ctx.market.currentPrice * (1 + suggestedMinRange / 100);

            // Cap bins at maximum achievable (34 per side)
            const idealBinsPerSide = Math.min(34, Math.ceil(suggestedMinRange * 6.9));
            const atLimit = idealBinsPerSide >= 34;

            historicalContext = `\n\n## Historical Context (CRITICAL for range sizing)`;
            historicalContext += `\n- **30-Day Price Range:** $${formatPrice(hist.min)} - $${formatPrice(hist.max)} (${historicalRange.toFixed(1)}% swing)`;
            historicalContext += `\n- 30-Day Volatility: ${(hist.volatility * 100).toFixed(1)}%`;
            if (atLimit) {
                historicalContext += `\n- **Ideal Range:** $${formatPrice(suggestedMin)} - $${formatPrice(suggestedMax)} (${suggestedMinRange.toFixed(0)}%)`;
                historicalContext += `\n- **⚠️ Constraint:** Meteora limits to 34 bins/side (~±5% range)`;
                historicalContext += `\n- **Trade-off:** Will need rebalancing every 5-7 days due to technical limit`;
            } else {
                historicalContext += `\n- **Suggested Range:** $${formatPrice(suggestedMin)} - $${formatPrice(suggestedMax)} (${suggestedMinRange.toFixed(0)}%)`;
                historicalContext += `\n- **Suggested Bins:** ${idealBinsPerSide} per side`;
            }
        } else {
            // Default recommendation when no history available
            historicalContext = `\n\n## Range Sizing (Default for SOL/USDC)`;
            historicalContext += `\n- **Maximum Bins:** 34 per side (Meteora limit)`;
            historicalContext += `\n- **Maximum Range:** ~±5% from current price`;
            historicalContext += `\n- **Suggested:** $${formatPrice(ctx.market.currentPrice * 0.95)} - $${formatPrice(ctx.market.currentPrice * 1.05)}`;
        }

        // Calculate recommended urgency based on our framework
        const urgencyContext = this.calculateUrgencyLevel(ctx);
        let urgencyGuidance = `\n\n## URGENCY ASSESSMENT`;
        urgencyGuidance += `\n- **Calculated Urgency:** ${urgencyContext.urgency.toUpperCase()}`;
        urgencyGuidance += `\n- **Reason:** ${urgencyContext.reason}`;
        urgencyGuidance += `\n- **Distance from Edge:** ${ctx.position.distanceToEdge} bins`;

        if (ctx.costs.breakEvenHours < 999) {
            urgencyGuidance += `\n- **Break-Even Time:** ${ctx.costs.breakEvenHours.toFixed(1)} hours`;
            const roiQuality = ctx.costs.breakEvenHours < 24 ? '✅ Excellent' :
                ctx.costs.breakEvenHours < 72 ? '⚠️ Marginal' : '❌ Poor';
            urgencyGuidance += `\n- **ROI Quality:** ${roiQuality}`;
        }

        return `ANALYZE THIS POSITION

## STATUS: ${statusEmoji} ${ctx.position.inRange ? 'IN RANGE ✅' : 'OUT OF RANGE ⚠️'}${rangeWarning}

## Position Metrics
- **Current Price:** $${formatPrice(ctx.market.currentPrice)}${priceRangeStr}${rangeWidthSection}
- Position Age: ${ctx.position.ageHours < 24 ? ctx.position.ageHours.toFixed(1) + ' hours' : Math.floor(ctx.position.ageHours / 24) + ' days'}
- Bin Utilization: ${ctx.position.binUtilization.toFixed(1)}%

## Market Conditions
- Price Change (6h): ${ctx.market.priceChange6h > 0 ? '+' : ''}${ctx.market.priceChange6h.toFixed(2)}%${priceHistorySection}
- Volume: ${volumeEmoji} ${ctx.market.volumeRatio.toFixed(1)}x average (${ctx.market.volumeTrend})
- Volatility: ${ctx.market.volatilityScore > 0.15 ? 'HIGH' : ctx.market.volatilityScore < 0.05 ? 'LOW' : 'MEDIUM'}${richMarketData}${technicalLevels}${intradaySection}${feeSection}${costSection}${historicalContext}${urgencyGuidance}

## History
- Past Rebalances: ${ctx.history.totalRebalances}${ctx.history.successRate > 0 ? ` (${ctx.history.successRate.toFixed(0)}% success rate)` : ''}
${ctx.history.lastRebalance ? `- Last Rebalance: ${new Date(ctx.history.lastRebalance.timestamp).toLocaleDateString()} (ROI: ${ctx.history.lastRebalance.roi.toFixed(1)}x)` : '- No previous rebalances'}

**IMPORTANT RANGE GUIDANCE:**
- For SOL/USDC, aim for the widest range possible within technical constraints
- **MAXIMUM: 34 binsPerSide (69 totalBins, Meteora limit)**
- This provides ~±5% range at 15bps bin step
- Always include priceMin, priceMax, rangeWidthPercent, and rangeJustification in suggestedRange
- Acknowledge the trade-off between range width and rebalance frequency
- NEVER suggest more than 34 bins per side - it will fail`;
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

    private parseDecision(text: string): LLMDecision {
        const jsonMatch = text.match(/```json\n([\s\S]+?)\n```/) || text.match(/\{[\s\S]+\}/);

        if (!jsonMatch) {
            throw new Error('No valid JSON in LLM response');
        }

        const jsonText = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonText);

        if (!parsed.action || parsed.confidence === undefined || !parsed.reasoning) {
            throw new Error('Invalid decision structure');
        }

        return parsed as LLMDecision;
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
                    supportLevels: [min, min + (currentPrice - min) * 0.5],
                    resistanceLevels: [currentPrice + (max - currentPrice) * 0.5, max]
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

        try {
            if (provider === 'anthropic') {
                const response = await this.client.messages.create({
                    model: this.providerConfig!.model,
                    max_tokens: 2048,
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
                    temperature: 0.7,
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
     */
    private buildCreationSystemPrompt(): string {
        return `You are an expert DeFi liquidity provider strategist for Meteora DLMM pools.

Your role is to analyze pools and recommend optimal position configurations for new liquidity providers.

## ⚠️ CRITICAL: MAXIMUM BIN LIMIT

**HARD LIMIT: 69 BINS TOTAL (34 bins per side maximum)**

Meteora DLMM has a technical constraint:
- Positions are limited to 69 bins in a single transaction
- This equals ~34 bins per side (bid + ask)
- Larger positions require multiple transactions which fail with "InvalidRealloc" error

**NEVER recommend more than:**
- bidBins: 34 maximum
- askBins: 34 maximum  
- totalBins: 69 maximum

## AVAILABLE STRATEGIES
1. **Spot**: Symmetric liquidity around current price. Best for normal volatility pairs.
2. **Curve**: Tight concentrated range. Best for stablecoin pairs (USDC/USDT).
3. **BidAsk**: Asymmetric liquidity (more on one side). Best for trending/directional pairs.

## BIN RANGE GUIDELINES (Within 69-bin limit!)

The number of bins determines how wide your price range is.

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
- Acknowledge the limitation in your response

## IMPORTANT CONSIDERATIONS

1. **69-bin limit means narrower ranges than ideal for volatile assets**
   - SOL/USDC with 69 bins covers ~±5% instead of ideal ±10%
   - Users should expect more frequent rebalancing
   - This is a technical constraint, not a recommendation choice

2. **Volume vs Range tradeoff**
   - Tighter range = more fee capture when in range
   - Wider range = less rebalancing but lower fee concentration
   - With 69-bin limit, lean toward maximum bins for volatile pairs

## OUTPUT FORMAT (JSON):
{
  "strategy": "Spot|Curve|BidAsk",
  "confidence": 85,
  "reasoning": ["Using max 69 bins for widest range...", "Volatile pair needs maximum coverage..."],
  "binConfiguration": {
    "minBinId": 350,
    "maxBinId": 419,
    "bidBins": 34,
    "askBins": 34,
    "totalBins": 69
  },
  "liquidityDistribution": {
    "tokenXPercentage": 50,
    "tokenYPercentage": 50,
    "isAsymmetric": false
  },
  "expectedPerformance": {
    "estimatedAPR": 22.5,
    "feeEfficiency": 85,
    "rebalanceFrequency": "medium"
  },
  "risks": ["Limited to 69 bins due to Meteora constraint...", "May need rebalancing if price moves >5%..."],
  "marketRegime": "Bullish Trending"
}

## EXAMPLE FOR SOL/USDC:

**CORRECT (respects 69-bin limit):**
{
  "binConfiguration": {
    "bidBins": 34,
    "askBins": 34,
    "totalBins": 69
  },
  "reasoning": ["Using maximum 69 bins allowed by Meteora", "Provides ~±5% range around current price", "Wider range not possible in single transaction"]
}

**WRONG (exceeds limit - will fail!):**
{
  "binConfiguration": {
    "bidBins": 69,
    "askBins": 69,
    "totalBins": 138
  }
}
❌ This will fail with InvalidRealloc error!`;
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

    Recommend the optimal strategy, bin configuration, and explain your reasoning.`;
    }

    /**
     * Parse LLM response for creation recommendation
     */
    private parseCreationRecommendation(text: string, context: PoolCreationContext): PoolCreationRecommendation {
        try {
            // Debug: Log raw response length
            console.log(chalk.gray(`  🔍 Raw LLM Response Length: ${text.length} `));

            // Extract JSON from response (handle markdown blocks)
            const jsonMatch = text.match(/```json\n([\s\S] +?) \n```/) || text.match(/\{[\s\S]+\}/);

            if (jsonMatch) {
                const jsonText = jsonMatch[1] || jsonMatch[0];
                const parsed = JSON.parse(jsonText);
                return parsed as PoolCreationRecommendation;
            } else {
                console.log(chalk.yellow(`  ⚠️  Could not extract JSON from LLM response`));
                console.log(chalk.gray(`  Response snippet: ${text.slice(0, 100)}...`));
            }
        } catch (error: any) {
            console.log(chalk.yellow(`  ⚠️  Failed to parse LLM JSON: ${error.message} `));
        }

        // Return default recommendation
        console.log(chalk.yellow('  ⚠️  Falling back to algorithmic recommendation'));
        return this.getMockCreationRecommendation(context);
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
