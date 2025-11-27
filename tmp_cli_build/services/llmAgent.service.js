"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmAgent = exports.LLMAgentService = void 0;
var analyticsDataStore_service_1 = require("./analyticsDataStore.service");
var config_manager_1 = require("../config/config.manager");
var chalk_1 = require("chalk");
// ==================== SERVICE ====================
var LLMAgentService = /** @class */ (function () {
    function LLMAgentService() {
        this.providerConfig = null;
        this.client = null;
        try {
            this.providerConfig = this.loadProviderConfig();
            if (this.providerConfig.provider !== 'none') {
                this.client = this.initializeClient();
            }
        }
        catch (error) {
            console.log(chalk_1.default.yellow('⚠️  LLM Agent not configured. Decisions will be mock-only.'));
            this.providerConfig = { provider: 'none', apiKey: '', model: '' };
        }
    }
    LLMAgentService.prototype.reloadConfig = function () {
        try {
            this.providerConfig = this.loadProviderConfig();
            if (this.providerConfig.provider !== 'none') {
                this.client = this.initializeClient();
                console.log(chalk_1.default.gray("  \u2713 LLM Agent reloaded: ".concat(this.providerConfig.provider, " (").concat(this.providerConfig.model, ")")));
            }
            else {
                this.client = null;
            }
        }
        catch (error) {
            console.log(chalk_1.default.yellow('⚠️  LLM Agent not configured. Decisions will be mock-only.'));
            this.providerConfig = { provider: 'none', apiKey: '', model: '' };
            this.client = null;
        }
    };
    LLMAgentService.prototype.loadProviderConfig = function () {
        var config = config_manager_1.configManager.getConfig();
        var llmConfig = config.preferences.llm;
        // Debug log to see what is being loaded
        // console.log(chalk.gray(`  🔍 Loading LLM Config: ${JSON.stringify(llmConfig)}`));
        if (!llmConfig || llmConfig.provider === 'none') {
            return { provider: 'none', apiKey: '', model: '' };
        }
        var apiKey = llmConfig.apiKey ? config_manager_1.configManager.decryptPrivateKey(llmConfig.apiKey) : '';
        return {
            provider: llmConfig.provider,
            apiKey: apiKey,
            model: llmConfig.model || '',
            baseURL: llmConfig.baseURL
        };
    };
    LLMAgentService.prototype.initializeClient = function () {
        if (!this.providerConfig) {
            throw new Error('Provider config not loaded');
        }
        var _a = this.providerConfig, provider = _a.provider, apiKey = _a.apiKey, baseURL = _a.baseURL;
        console.log(chalk_1.default.gray("  \uD83D\uDD0C Initializing LLM Client for: ".concat(provider)));
        try {
            switch (provider) {
                case 'anthropic': {
                    var Anthropic = require('@anthropic-ai/sdk');
                    return new Anthropic({ apiKey: apiKey });
                }
                case 'openai':
                case 'deepseek':
                case 'grok':
                case 'kimi':
                case 'gemini': {
                    var OpenAI = require('openai');
                    return new OpenAI({
                        apiKey: apiKey,
                        baseURL: baseURL || (provider === 'openai' ? undefined : baseURL)
                    });
                }
                default:
                    throw new Error("Unsupported provider: ".concat(provider));
            }
        }
        catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                console.log(chalk_1.default.yellow("\n\u26A0\uFE0F  SDK not installed for ".concat(provider)));
                console.log(chalk_1.default.gray('Install with: npm install @anthropic-ai/sdk openai'));
                return null;
            }
            throw error;
        }
    };
    LLMAgentService.prototype.isAvailable = function () {
        var available = this.providerConfig !== null &&
            this.providerConfig.provider !== 'none' &&
            this.client !== null;
        if (!available) {
            // console.log(chalk.gray(`  Debug: LLM Unavailable - Config: ${!!this.providerConfig}, Provider: ${this.providerConfig?.provider}, Client: ${!!this.client}`));
        }
        return available;
    };
    LLMAgentService.prototype.analyzePosition = function (position) {
        return __awaiter(this, void 0, void 0, function () {
            var context, decision, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isAvailable()) {
                            return [2 /*return*/, this.getMockDecision(position)];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, this.buildContext(position)];
                    case 2:
                        context = _a.sent();
                        return [4 /*yield*/, this.getLLMDecision(context)];
                    case 3:
                        decision = _a.sent();
                        return [4 /*yield*/, this.logDecision(position.publicKey, context, decision)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/, decision];
                    case 5:
                        error_1 = _a.sent();
                        console.error(chalk_1.default.red("\n\u274C LLM Analysis failed: ".concat(error_1.message)));
                        return [2 /*return*/, this.getMockDecision(position)];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Analyze a pool for optimal position creation
     */
    LLMAgentService.prototype.analyzePoolForCreation = function (poolInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var context, recommendation, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isAvailable()) {
                            return [2 /*return*/, this.getMockCreationRecommendation(poolInfo)];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.buildCreationContext(poolInfo)];
                    case 2:
                        context = _a.sent();
                        return [4 /*yield*/, this.getCreationRecommendation(context)];
                    case 3:
                        recommendation = _a.sent();
                        return [2 /*return*/, recommendation];
                    case 4:
                        error_2 = _a.sent();
                        console.error(chalk_1.default.red("\n\u274C LLM Creation Analysis failed: ".concat(error_2.message)));
                        return [2 /*return*/, this.getMockCreationRecommendation(poolInfo)];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    LLMAgentService.prototype.buildContext = function (position) {
        return __awaiter(this, void 0, void 0, function () {
            var poolService, meteoraVolumeCache, marketContextService, oracleService, hourlySnapshotService, poolInfo, volumeData, marketContext, snapshots, latestSnapshot, distanceToEdge, rebalanceHistory, lastRebalance, ageHours, successful, successRate, volumeTrend, priceChange6h, priceHistory, firstPrice, lastPrice, error_3, intraDayAnalysis, intraDayContext;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        poolService = require('./pool.service').poolService;
                        meteoraVolumeCache = require('./meteoraVolume.service').meteoraVolumeCache;
                        marketContextService = require('./market-context.service').marketContextService;
                        oracleService = require('./oracle.service').oracleService;
                        hourlySnapshotService = require('./hourlySnapshot.service').hourlySnapshotService;
                        return [4 /*yield*/, poolService.getPoolInfo(position.poolAddress)];
                    case 1:
                        poolInfo = _e.sent();
                        return [4 /*yield*/, meteoraVolumeCache.getVolume(position.poolAddress)];
                    case 2:
                        volumeData = _e.sent();
                        return [4 /*yield*/, marketContextService.buildRangeContext(poolInfo)];
                    case 3:
                        marketContext = _e.sent();
                        snapshots = analyticsDataStore_service_1.analyticsDataStore.getPositionSnapshots(position.publicKey, 7);
                        latestSnapshot = snapshots[snapshots.length - 1];
                        distanceToEdge = Math.min(position.activeBinId - position.lowerBinId, position.upperBinId - position.activeBinId);
                        rebalanceHistory = analyticsDataStore_service_1.analyticsDataStore
                            .loadRebalanceHistory()
                            .filter(function (r) { return r.oldPositionAddress === position.publicKey; });
                        lastRebalance = rebalanceHistory[rebalanceHistory.length - 1];
                        ageHours = lastRebalance
                            ? (Date.now() - lastRebalance.timestamp) / (1000 * 60 * 60)
                            : Infinity;
                        successful = rebalanceHistory.filter(function (r) {
                            var roi = r.feesClaimedUsd / r.transactionCostUsd;
                            return roi >= 2.0;
                        });
                        successRate = rebalanceHistory.length > 0
                            ? (successful.length / rebalanceHistory.length) * 100
                            : 0;
                        volumeTrend = analyticsDataStore_service_1.analyticsDataStore.getVolumeTrend(position.poolAddress);
                        priceChange6h = 0;
                        _e.label = 4;
                    case 4:
                        _e.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, oracleService.getUsdPriceSeries(poolInfo.tokenX.mint, 6)];
                    case 5:
                        priceHistory = _e.sent();
                        if (priceHistory && priceHistory.length >= 2) {
                            firstPrice = priceHistory[0].price;
                            lastPrice = priceHistory[priceHistory.length - 1].price;
                            priceChange6h = ((lastPrice - firstPrice) / firstPrice) * 100;
                        }
                        return [3 /*break*/, 7];
                    case 6:
                        error_3 = _e.sent();
                        return [3 /*break*/, 7];
                    case 7:
                        try {
                            intraDayContext = hourlySnapshotService.getIntraDayContext(position.poolAddress, 24);
                            if (intraDayContext.snapshots.length > 0) {
                                intraDayAnalysis = {
                                    hourlySnapshots: intraDayContext.snapshots.length,
                                    momentum: intraDayContext.momentum,
                                    signals: intraDayContext.signals
                                };
                            }
                        }
                        catch (error) {
                            // Intraday data is optional, don't fail if unavailable
                        }
                        return [2 /*return*/, {
                                timestamp: Date.now(),
                                position: {
                                    address: position.publicKey,
                                    poolAddress: position.poolAddress,
                                    inRange: position.inRange,
                                    activeBin: position.activeBinId,
                                    rangeBins: [position.lowerBinId, position.upperBinId],
                                    distanceToEdge: distanceToEdge,
                                    ageHours: ageHours,
                                    unclaimedFeesUsd: position.unclaimedFees.usdValue || 0,
                                    binUtilization: ((_a = latestSnapshot === null || latestSnapshot === void 0 ? void 0 : latestSnapshot.binUtilization) === null || _a === void 0 ? void 0 : _a.utilizationPercent) || 0
                                },
                                market: {
                                    currentPrice: poolInfo.price || 0,
                                    priceChange6h: priceChange6h,
                                    volatilityScore: marketContext.volatilityScore || 0,
                                    volumeRatio: volumeData.volumeRatio,
                                    volumeTrend: volumeTrend
                                },
                                intraDayAnalysis: intraDayAnalysis,
                                fees: {
                                    actualDaily: ((_b = latestSnapshot === null || latestSnapshot === void 0 ? void 0 : latestSnapshot.feePerformance) === null || _b === void 0 ? void 0 : _b.actualDailyFeesUsd) || 0,
                                    expectedDaily: ((_c = latestSnapshot === null || latestSnapshot === void 0 ? void 0 : latestSnapshot.feePerformance) === null || _c === void 0 ? void 0 : _c.expectedDailyFeesUsd) || 0,
                                    efficiency: ((_d = latestSnapshot === null || latestSnapshot === void 0 ? void 0 : latestSnapshot.feePerformance) === null || _d === void 0 ? void 0 : _d.efficiency) || 0,
                                    claimableUsd: position.unclaimedFees.usdValue || 0
                                },
                                costs: {
                                    rebalanceCostUsd: 0.028,
                                    breakEvenHours: 0,
                                    minROI: 2.0
                                },
                                history: {
                                    totalRebalances: rebalanceHistory.length,
                                    successRate: successRate,
                                    avgBreakEvenHours: this.calculateAvgBreakEven(rebalanceHistory),
                                    lastRebalance: lastRebalance ? {
                                        timestamp: lastRebalance.timestamp,
                                        reason: lastRebalance.reason,
                                        roi: lastRebalance.feesClaimedUsd / lastRebalance.transactionCostUsd
                                    } : undefined,
                                    patterns: this.detectPatterns(rebalanceHistory)
                                }
                            }];
                }
            });
        });
    };
    LLMAgentService.prototype.getLLMDecision = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var systemPrompt, userMessage, _a, provider, model, response, content, response, content, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        systemPrompt = this.buildSystemPrompt();
                        userMessage = this.buildUserMessage(context);
                        if (!this.providerConfig || !this.client) {
                            throw new Error('LLM client not initialized');
                        }
                        _a = this.providerConfig, provider = _a.provider, model = _a.model;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, , 7]);
                        if (!(provider === 'anthropic')) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.client.messages.create({
                                model: model,
                                max_tokens: 2000,
                                temperature: 0.3,
                                system: systemPrompt,
                                messages: [{ role: 'user', content: userMessage }]
                            })];
                    case 2:
                        response = _b.sent();
                        content = response.content[0];
                        if (content.type !== 'text') {
                            throw new Error('Unexpected response type');
                        }
                        return [2 /*return*/, this.parseDecision(content.text)];
                    case 3: return [4 /*yield*/, this.client.chat.completions.create({
                            model: model,
                            max_tokens: 2000,
                            temperature: 0.3,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: userMessage }
                            ]
                        })];
                    case 4:
                        response = _b.sent();
                        content = response.choices[0].message.content;
                        return [2 /*return*/, this.parseDecision(content)];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_4 = _b.sent();
                        console.error(chalk_1.default.red("\n\u274C LLM API Error: ".concat(error_4.message)));
                        throw error_4;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    LLMAgentService.prototype.buildSystemPrompt = function () {
        return "You are an expert DeFi liquidity provider managing concentrated liquidity positions on Meteora DLMM (Solana).\n\nROLE:\n- Analyze position health, market conditions, and historical performance\n- Recommend WHEN to rebalance for maximum fee capture vs gas costs\n- Optimize for ROI (target >2x gas cost recovery)\n- Learn from historical patterns\n\nCONSTRAINTS:\n- NEVER recommend rebalancing unless expected ROI >= configured minimum (usually 2x)\n- Consider volume trends (avoid rebalancing during low volume < 0.7x avg)\n- Factor in volatility for range width decisions\n- Account for break-even time (<24h preferred)\n- Respect position age (avoid churning <4h since last rebalance)\n\nDECISION FRAMEWORK:\n1. **Out of Range?** \u2192 URGENT (not earning fees)\n2. **Distance to Edge** \u2192 <5 bins = proactive rebalance\n3. **Volume Analysis** \u2192 >1.5x = good timing, <0.7x = wait\n4. **Fee Efficiency** \u2192 <70% = underperforming\n5. **Break-even** \u2192 Calculate cost / expected daily gain\n6. **Historical Success** \u2192 Learn from past decisions\n\nOUTPUT: Respond ONLY with valid JSON matching this structure:\n{\n  \"action\": \"rebalance\" | \"hold\" | \"compound\" | \"widen_range\" | \"narrow_range\",\n  \"confidence\": 0-100,\n  \"urgency\": \"critical\" | \"high\" | \"medium\" | \"low\",\n  \"reasoning\": [\"bullet point 1\", \"bullet point 2\", ...],\n  \"expectedOutcome\": {\n    \"costUsd\": number,\n    \"expectedFeesNext24h\": number,\n    \"breakEvenHours\": number,\n    \"roi\": number\n  },\n  \"alternativeAction\": \"string (optional)\",\n  \"risks\": [\"risk 1\", \"risk 2\", ...],\n  \"learnings\": \"string (optional pattern recognition)\"\n}";
    };
    LLMAgentService.prototype.buildUserMessage = function (ctx) {
        var statusEmoji = ctx.position.inRange ? '✅' : '🚨';
        var volumeEmoji = ctx.market.volumeRatio > 1.5 ? '📈' : ctx.market.volumeRatio < 0.7 ? '📉' : '➡️';
        return "POSITION ANALYSIS REQUEST\n\n## Current State\n- Position: ".concat(ctx.position.address.slice(0, 8), "...\n- Status: ").concat(statusEmoji, " ").concat(ctx.position.inRange ? 'IN RANGE' : 'OUT OF RANGE (CRITICAL!)', "\n- Active Bin: ").concat(ctx.position.activeBin, "\n- Range: [").concat(ctx.position.rangeBins[0], ", ").concat(ctx.position.rangeBins[1], "]\n- Distance to Edge: **").concat(ctx.position.distanceToEdge, " bins** ").concat(ctx.position.distanceToEdge < 5 ? '⚠️ APPROACHING EDGE' : '', "\n- Age Since Rebalance: ").concat(ctx.position.ageHours.toFixed(1), "h\n- Bin Utilization: ").concat(ctx.position.binUtilization.toFixed(1), "%\n\n## Market Conditions\n- Price Change (6h): ").concat(ctx.market.priceChange6h > 0 ? '+' : '').concat(ctx.market.priceChange6h.toFixed(2), "%\n- Volatility Score: ").concat(ctx.market.volatilityScore.toFixed(3), " ").concat(ctx.market.volatilityScore > 0.15 ? '(HIGH)' : ctx.market.volatilityScore < 0.05 ? '(LOW)' : '(MEDIUM)', "\n- Volume Activity: ").concat(volumeEmoji, " **").concat(ctx.market.volumeRatio.toFixed(2), "x** vs 7d avg ").concat(ctx.market.volumeRatio > 1.5 ? '(EXCELLENT!)' : ctx.market.volumeRatio < 0.7 ? '(LOW - WAIT)' : '(NORMAL)', "\n- Volume Trend: ").concat(ctx.market.volumeTrend.toUpperCase(), "\n\n## Fee Performance\n- Fee Efficiency: **").concat(ctx.fees.efficiency.toFixed(1), "%** ").concat(ctx.fees.efficiency < 70 ? '⚠️ UNDERPERFORMING' : '✅ GOOD', "\n- Actual Daily Fees: $").concat(ctx.fees.actualDaily.toFixed(2), "\n- Expected Daily Fees: $").concat(ctx.fees.expectedDaily.toFixed(2), "\n- Unclaimed Fees: $").concat(ctx.fees.claimableUsd.toFixed(2), "\n\n## Cost Analysis\n- Rebalance Cost: $").concat(ctx.costs.rebalanceCostUsd.toFixed(2), "\n- Required ROI: ").concat(ctx.costs.minROI, "x\n- Min Daily Fees for ROI: $").concat(((ctx.costs.rebalanceCostUsd * ctx.costs.minROI) / 24).toFixed(3), "/hour\n\n## Historical Performance\n- Total Past Rebalances: ").concat(ctx.history.totalRebalances, "\n- Success Rate: ").concat(ctx.history.successRate.toFixed(1), "%\n").concat(ctx.history.lastRebalance ? "- Last Rebalance: ".concat(new Date(ctx.history.lastRebalance.timestamp).toLocaleString(), "\n  - Reason: ").concat(ctx.history.lastRebalance.reason, "\n  - ROI: ").concat(ctx.history.lastRebalance.roi.toFixed(2), "x") : '', "\n").concat(ctx.history.patterns.length > 0 ? "- Learned Patterns:\n".concat(ctx.history.patterns.map(function (p) { return "  \u2022 ".concat(p); }).join('\n')) : '', "\n\n---\n\n**QUESTION:** Should I take action on this position now? Provide detailed analysis with expected ROI.");
    };
    LLMAgentService.prototype.parseDecision = function (text) {
        var jsonMatch = text.match(/```json\n([\s\S]+?)\n```/) || text.match(/\{[\s\S]+\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON in LLM response');
        }
        var jsonText = jsonMatch[1] || jsonMatch[0];
        var parsed = JSON.parse(jsonText);
        if (!parsed.action || parsed.confidence === undefined || !parsed.reasoning) {
            throw new Error('Invalid decision structure');
        }
        return parsed;
    };
    LLMAgentService.prototype.logDecision = function (positionAddress, context, decision) {
        return __awaiter(this, void 0, void 0, function () {
            var log;
            return __generator(this, function (_a) {
                log = {
                    timestamp: Date.now(),
                    positionAddress: positionAddress,
                    context: context,
                    decision: decision,
                    approved: null,
                    approvedAt: null,
                    executedAt: null,
                    actualOutcome: null
                };
                analyticsDataStore_service_1.analyticsDataStore.recordLLMDecision(log);
                return [2 /*return*/];
            });
        });
    };
    LLMAgentService.prototype.getMockDecision = function (position) {
        var isOutOfRange = !position.inRange;
        var distanceToEdge = Math.min(position.activeBinId - position.lowerBinId, position.upperBinId - position.activeBinId);
        if (isOutOfRange) {
            return {
                action: 'rebalance',
                confidence: 95,
                urgency: 'critical',
                reasoning: ['Position is out of range and not earning fees'],
                expectedOutcome: {
                    costUsd: 0.028,
                    expectedFeesNext24h: 0.1,
                    breakEvenHours: 6.7,
                    roi: 3.6
                },
                risks: ['Mock decision - LLM notconfigured']
            };
        }
        if (distanceToEdge < 5) {
            return {
                action: 'rebalance',
                confidence: 75,
                urgency: 'high',
                reasoning: ["Position is ".concat(distanceToEdge, " bins from edge"), 'Proactive rebalance recommended'],
                expectedOutcome: {
                    costUsd: 0.028,
                    expectedFeesNext24h: 0.08,
                    breakEvenHours: 8.4,
                    roi: 2.9
                },
                risks: ['Mock decision - LLM not configured']
            };
        }
        return {
            action: 'hold',
            confidence: 60,
            urgency: 'low',
            reasoning: ['Position is healthy', 'No action needed at this time'],
            expectedOutcome: {
                costUsd: 0,
                expectedFeesNext24h: 0.05,
                breakEvenHours: 0,
                roi: 0
            },
            risks: ['Mock decision - LLM not configured']
        };
    };
    LLMAgentService.prototype.calculateAvgBreakEven = function (history) {
        if (history.length === 0)
            return 0;
        var breakEvens = history
            .filter(function (r) { return r.feesClaimedUsd > 0; })
            .map(function (r) {
            var hourlyFees = r.feesClaimedUsd / 24;
            return r.transactionCostUsd / hourlyFees;
        });
        if (breakEvens.length === 0)
            return 0;
        return breakEvens.reduce(function (sum, val) { return sum + val; }, 0) / breakEvens.length;
    };
    LLMAgentService.prototype.detectPatterns = function (history) {
        var patterns = [];
        if (history.length === 0)
            return patterns;
        var autoRebalances = history.filter(function (r) { return r.reasonCode === 'AUTO'; });
        if (autoRebalances.length > history.length * 0.7) {
            patterns.push('Automated rebalances have 70%+ success rate');
        }
        var outOfRange = history.filter(function (r) { return r.reasonCode === 'OUT_OF_RANGE'; });
        if (outOfRange.length > 0) {
            patterns.push('Out-of-range rebalances are always necessary');
        }
        var recent = history.slice(-5);
        var recentSuccessful = recent.filter(function (r) {
            var roi = r.feesClaimedUsd / r.transactionCostUsd;
            return roi >= 2.0;
        });
        if (recentSuccessful.length >= 4) {
            patterns.push('Recent rebalances show strong 80%+ success rate');
        }
        return patterns;
    };
    /**
     * Build context for position creation analysis
     */
    LLMAgentService.prototype.buildCreationContext = function (poolInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var priceService, fetchPoolVolume, poolAddress, tokenX, tokenY, tokenXMint, tokenYMint, currentPrice, binStep, priceHistory, coinGeckoId, error_5, axios, dexUrl, response, pair, currentPriceFromDex, change24h, i, variance, estimatedPrice, dexError_1, volatility, trend, min, max, prices, mean_1, squaredDiffs, variance, firstHalf, secondHalf, firstAvg, secondAvg, volumeData, error_6, volumeTrend, stableSymbols, isStablePair, hasStable;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        priceService = require('./price.service').priceService;
                        fetchPoolVolume = require('./meteoraVolume.service').fetchPoolVolume;
                        poolAddress = poolInfo.address || ((_a = poolInfo.pubkey) === null || _a === void 0 ? void 0 : _a.toString());
                        tokenX = ((_b = poolInfo.tokenX) === null || _b === void 0 ? void 0 : _b.symbol) || 'TokenX';
                        tokenY = ((_c = poolInfo.tokenY) === null || _c === void 0 ? void 0 : _c.symbol) || 'TokenY';
                        tokenXMint = ((_d = poolInfo.tokenX) === null || _d === void 0 ? void 0 : _d.mint) || poolInfo.mint_x;
                        tokenYMint = ((_e = poolInfo.tokenY) === null || _e === void 0 ? void 0 : _e.mint) || poolInfo.mint_y;
                        currentPrice = poolInfo.currentPrice || 0;
                        binStep = poolInfo.binStep || 0;
                        priceHistory = null;
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, priceService.getCoinGeckoId(tokenX)];
                    case 2:
                        coinGeckoId = _f.sent();
                        if (!coinGeckoId) return [3 /*break*/, 4];
                        return [4 /*yield*/, priceService.getPriceHistory(coinGeckoId, 30)];
                    case 3:
                        priceHistory = _f.sent();
                        console.log(chalk_1.default.gray('  ✓ Fetched 30-day history from CoinGecko'));
                        _f.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_5 = _f.sent();
                        return [3 /*break*/, 6];
                    case 6:
                        if (!(!priceHistory || priceHistory.length === 0)) return [3 /*break*/, 10];
                        _f.label = 7;
                    case 7:
                        _f.trys.push([7, 9, , 10]);
                        console.log(chalk_1.default.gray('  ⏳ Trying DexScreener API...'));
                        axios = require('axios');
                        dexUrl = "https://api.dexscreener.com/latest/dex/tokens/".concat(tokenXMint);
                        return [4 /*yield*/, axios.get(dexUrl, { timeout: 10000 })];
                    case 8:
                        response = _f.sent();
                        if (response.data && response.data.pairs && response.data.pairs.length > 0) {
                            pair = response.data.pairs[0];
                            // DexScreener doesn't provide historical OHLC easily, but we can use current data
                            // and estimate based on 24h change
                            if (pair.priceChange && pair.priceChange.h24) {
                                currentPriceFromDex = parseFloat(pair.priceUsd || currentPrice);
                                change24h = parseFloat(pair.priceChange.h24) / 100;
                                // Generate approximate 30-day history based on recent volatility
                                priceHistory = [];
                                for (i = 30; i >= 0; i--) {
                                    variance = (Math.random() - 0.5) * change24h * 2;
                                    estimatedPrice = currentPriceFromDex * (1 + (variance * i / 30));
                                    priceHistory.push({
                                        timestamp: Date.now() - (i * 24 * 60 * 60 * 1000),
                                        price: estimatedPrice
                                    });
                                }
                                console.log(chalk_1.default.yellow('  ℹ️  Using estimated price history from DexScreener'));
                            }
                        }
                        return [3 /*break*/, 10];
                    case 9:
                        dexError_1 = _f.sent();
                        console.log(chalk_1.default.yellow('  ℹ️  DexScreener also unavailable'));
                        return [3 /*break*/, 10];
                    case 10:
                        // Final fallback: If ALL APIs failed, use current price only
                        if (!priceHistory || priceHistory.length === 0) {
                            console.log(chalk_1.default.red('  ⚠️  No price history available - using current price only'));
                            priceHistory = [{
                                    timestamp: Date.now(),
                                    price: currentPrice
                                }];
                        }
                        volatility = 0;
                        trend = 'neutral';
                        min = currentPrice;
                        max = currentPrice;
                        if (priceHistory && priceHistory.length > 1) {
                            prices = priceHistory.map(function (p) { return p.price; });
                            min = Math.min.apply(Math, prices);
                            max = Math.max.apply(Math, prices);
                            mean_1 = prices.reduce(function (a, b) { return a + b; }, 0) / prices.length;
                            squaredDiffs = prices.map(function (p) { return Math.pow(p - mean_1, 2); });
                            variance = squaredDiffs.reduce(function (a, b) { return a + b; }, 0) / prices.length;
                            volatility = Math.sqrt(variance) / mean_1;
                            firstHalf = prices.slice(0, Math.floor(prices.length / 2));
                            secondHalf = prices.slice(Math.floor(prices.length / 2));
                            firstAvg = firstHalf.reduce(function (a, b) { return a + b; }, 0) / firstHalf.length;
                            secondAvg = secondHalf.reduce(function (a, b) { return a + b; }, 0) / secondHalf.length;
                            if (secondAvg > firstAvg * 1.05)
                                trend = 'bullish';
                            else if (secondAvg < firstAvg * 0.95)
                                trend = 'bearish';
                        }
                        volumeData = null;
                        _f.label = 11;
                    case 11:
                        _f.trys.push([11, 13, , 14]);
                        return [4 /*yield*/, fetchPoolVolume(poolAddress)];
                    case 12:
                        volumeData = _f.sent();
                        return [3 /*break*/, 14];
                    case 13:
                        error_6 = _f.sent();
                        volumeData = {
                            volume24h: 0,
                            volume7d: 0,
                            volumeRatio: 1.0
                        };
                        return [3 /*break*/, 14];
                    case 14:
                        volumeTrend = volumeData.volumeRatio > 1.2 ? 'increasing' :
                            volumeData.volumeRatio < 0.8 ? 'decreasing' : 'stable';
                        stableSymbols = ['USDC', 'USDT', 'DAI', 'USDC.E', 'USDT.E', 'USDH'];
                        isStablePair = stableSymbols.includes(tokenX) && stableSymbols.includes(tokenY);
                        hasStable = stableSymbols.includes(tokenX) || stableSymbols.includes(tokenY);
                        return [2 /*return*/, {
                                timestamp: Date.now(),
                                pool: {
                                    address: poolAddress,
                                    tokenX: tokenX,
                                    tokenY: tokenY,
                                    binStep: binStep,
                                    currentPrice: currentPrice,
                                    activeBinId: poolInfo.activeBinId || 0,
                                    tvl: poolInfo.tvl || 0,
                                    apr: poolInfo.apr || 0
                                },
                                market: {
                                    priceHistory30d: {
                                        min: min,
                                        max: max,
                                        current: currentPrice,
                                        volatility: volatility,
                                        trend: trend
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
                                    isStablePair: isStablePair,
                                    hasStable: hasStable,
                                    volatilityScore: volatility * 100,
                                    volumeSkew: 0 // Default, would need order book data
                                }
                            }];
                }
            });
        });
    };
    /**
     * Get LLM recommendation for position creation
     */
    LLMAgentService.prototype.getCreationRecommendation = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var systemPrompt, userMessage, provider, responseText, response, response, error_7;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        systemPrompt = this.buildCreationSystemPrompt();
                        userMessage = this.buildCreationUserMessage(context);
                        provider = (_a = this.providerConfig) === null || _a === void 0 ? void 0 : _a.provider;
                        responseText = '';
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 6, , 7]);
                        if (!(provider === 'anthropic')) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.client.messages.create({
                                model: this.providerConfig.model,
                                max_tokens: 2048,
                                messages: [{
                                        role: 'user',
                                        content: systemPrompt + '\n\n' + userMessage
                                    }]
                            })];
                    case 2:
                        response = _e.sent();
                        responseText = response.content[0].text;
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, this.client.chat.completions.create({
                            model: this.providerConfig.model,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: userMessage }
                            ],
                            temperature: 0.7,
                            max_tokens: 2048
                        })];
                    case 4:
                        response = _e.sent();
                        responseText = response.choices[0].message.content || '';
                        _e.label = 5;
                    case 5: return [2 /*return*/, this.parseCreationRecommendation(responseText, context)];
                    case 6:
                        error_7 = _e.sent();
                        // Enhanced error diagnostics
                        console.log(chalk_1.default.red("\n\u274C LLM API Error Details:"));
                        console.log(chalk_1.default.gray("   Provider: ".concat(provider)));
                        console.log(chalk_1.default.gray("   Model: ".concat((_b = this.providerConfig) === null || _b === void 0 ? void 0 : _b.model)));
                        if (error_7.response) {
                            console.log(chalk_1.default.gray("   Status: ".concat(error_7.response.status)));
                            console.log(chalk_1.default.gray("   Message: ".concat(((_d = (_c = error_7.response.data) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.message) || error_7.message)));
                        }
                        else if (error_7.message) {
                            console.log(chalk_1.default.gray("   Error: ".concat(error_7.message)));
                        }
                        console.log(chalk_1.default.yellow("\n\uD83D\uDCA1 Suggestions:"));
                        console.log(chalk_1.default.gray("   1. Check your LLM configuration: npm run cli \u2192 LLM AI Selection"));
                        console.log(chalk_1.default.gray("   2. Verify your API key is valid"));
                        console.log(chalk_1.default.gray("   3. Check your internet connection"));
                        console.log(chalk_1.default.gray("   4. For now, using algorithmic fallback\n"));
                        throw error_7; // Re-throw to be caught by analyzePoolForCreation
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Build system prompt for creation analysis
     */
    LLMAgentService.prototype.buildCreationSystemPrompt = function () {
        return "You are an expert DeFi liquidity provider strategist for Meteora DLMM pools.\n\nYour role is to analyze pools and recommend optimal position configurations for new liquidity providers.\n\nAVAILABLE STRATEGIES:\n1. **Spot**: Symmetric liquidity around current price. Best for normal volatility pairs.\n2. **Curve**: Tight concentrated range. Best for stablecoin pairs (USDC/USDT).\n3. **BidAsk**: Asymmetric liquidity (more on one side). Best for trending/directional pairs.\n\nDECISION FACTORS:\n- Volatility: High volatility \u2192 wider ranges or BidAsk\n- Pair Type: Stablecoins \u2192 Curve, Volatile \u2192 Spot or BidAsk\n- Market Trend: Bullish \u2192 more Ask side, Bearish \u2192 more Bid side\n- Volume: High volume \u2192 tighter ranges for more fee capture\n\nOUTPUT FORMAT (JSON):\n{\n  \"strategy\": \"Spot|Curve|BidAsk\",\n  \"confidence\": 85,\n  \"reasoning\": [\"Volume trending up...\", \"Volatility moderate...\"],\n  \"binConfiguration\": {\n    \"minBinId\": 350,\n    \"maxBinId\": 400,\n    \"bidBins\": 20,\n    \"askBins\": 30,\n    \"totalBins\": 50\n  },\n  \"liquidityDistribution\": {\n    \"tokenXPercentage\": 40,\n    \"tokenYPercentage\": 60,\n    \"isAsymmetric\": true\n  },\n  \"expectedPerformance\": {\n    \"estimatedAPR\": 22.5,\n    \"feeEfficiency\": 85,\n    \"rebalanceFrequency\": \"medium\"\n  },\n  \"risks\": [\"Price could trend down...\", \"High gas costs if...\"],\n  \"marketRegime\": \"Bullish Trending\"\n}";
    };
    /**
     * Build user message for creation analysis
     */
    LLMAgentService.prototype.buildCreationUserMessage = function (ctx) {
        return "Analyze this pool for optimal position creation:\n\nPOOL: ".concat(ctx.pool.tokenX, "/").concat(ctx.pool.tokenY, "\nCurrent Price: $").concat(ctx.pool.currentPrice.toFixed(4), "\nBin Step: ").concat(ctx.pool.binStep, " bps\nTVL: $").concat((ctx.pool.tvl / 1000000).toFixed(2), "M\nCurrent APR: ").concat(ctx.pool.apr.toFixed(2), "%\n\n30-DAY PRICE HISTORY:\n- Min: $").concat(ctx.market.priceHistory30d.min.toFixed(4), "\n- Max: $").concat(ctx.market.priceHistory30d.max.toFixed(4), "\n- Volatility: ").concat((ctx.market.priceHistory30d.volatility * 100).toFixed(2), "%\n- Trend: ").concat(ctx.market.priceHistory30d.trend, "\n\nVOLUME:\n- 24h Volume: $").concat((ctx.market.volume.current24h / 1000).toFixed(1), "K\n- 7d Avg: $").concat((ctx.market.volume.avg7d / 1000).toFixed(1), "K\n- Ratio: ").concat(ctx.market.volume.ratio.toFixed(2), "x\n- Trend: ").concat(ctx.market.volume.trend, "\n\nTECHNICALS:\n- ATR: ").concat(ctx.market.technicals.atr.toFixed(4), " (").concat(ctx.market.technicals.atrState, ")\n- Support: [").concat(ctx.market.technicals.supportLevels.map(function (l) { return '$' + l.toFixed(2); }).join(', '), "]\n- Resistance: [").concat(ctx.market.technicals.resistanceLevels.map(function (l) { return '$' + l.toFixed(2); }).join(', '), "]\n\nPAIR CHARACTERISTICS:\n- Stablecoin Pair: ").concat(ctx.pairCharacteristics.isStablePair ? 'YES' : 'NO', "\n- Has Stable: ").concat(ctx.pairCharacteristics.hasStable ? 'YES' : 'NO', "\n- Volatility Score: ").concat(ctx.pairCharacteristics.volatilityScore.toFixed(2), "%\n\nRecommend the optimal strategy, bin configuration, and explain your reasoning.");
    };
    /**
     * Parse LLM response for creation recommendation
     */
    LLMAgentService.prototype.parseCreationRecommendation = function (text, context) {
        try {
            // Extract JSON from response
            var jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                var parsed = JSON.parse(jsonMatch[0]);
                return parsed;
            }
        }
        catch (error) {
            // Fallback parsing
        }
        // Return default recommendation
        return this.getMockCreationRecommendation(context);
    };
    /**
     * Get mock creation recommendation when LLM unavailable
     */
    LLMAgentService.prototype.getMockCreationRecommendation = function (poolInfo) {
        var _a, _b, _c, _d, _e, _f;
        var currentPrice = poolInfo.currentPrice || ((_a = poolInfo.pool) === null || _a === void 0 ? void 0 : _a.currentPrice) || 0;
        var activeBinId = poolInfo.activeBinId || ((_b = poolInfo.pool) === null || _b === void 0 ? void 0 : _b.activeBinId) || 0;
        var tokenX = ((_c = poolInfo.tokenX) === null || _c === void 0 ? void 0 : _c.symbol) || ((_d = poolInfo.pool) === null || _d === void 0 ? void 0 : _d.tokenX) || 'TokenX';
        var tokenY = ((_e = poolInfo.tokenY) === null || _e === void 0 ? void 0 : _e.symbol) || ((_f = poolInfo.pool) === null || _f === void 0 ? void 0 : _f.tokenY) || 'TokenY';
        // Simple heuristic-based recommendation
        var stableSymbols = ['USDC', 'USDT', 'DAI'];
        var isStablePair = stableSymbols.includes(tokenX) && stableSymbols.includes(tokenY);
        var strategy = 'Spot';
        var bidBins = 29;
        var askBins = 29;
        if (isStablePair) {
            strategy = 'Curve';
            bidBins = 69;
            askBins = 69;
        }
        return {
            strategy: strategy,
            confidence: 70,
            reasoning: [
                "Algorithmic recommendation (LLM unavailable)",
                isStablePair ? 'Stablecoin pair detected → Curve strategy' : 'Normal pair → Spot strategy',
                "Symmetric range recommended"
            ],
            binConfiguration: {
                minBinId: activeBinId - bidBins,
                maxBinId: activeBinId + askBins,
                bidBins: bidBins,
                askBins: askBins,
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
                rebalanceFrequency: 'medium'
            },
            risks: [
                'Price volatility may cause frequent rebalancing',
                'Market conditions may change'
            ],
            marketRegime: 'Unknown (LLM not configured)'
        };
    };
    return LLMAgentService;
}());
exports.LLMAgentService = LLMAgentService;
exports.llmAgent = new LLMAgentService();
