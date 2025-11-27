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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rangeRecommenderService = void 0;
var dlmm_1 = require("@meteora-ag/dlmm");
var oracle_service_1 = require("./oracle.service");
var RangeRecommenderService = /** @class */ (function () {
    function RangeRecommenderService() {
    }
    RangeRecommenderService.prototype.clamp = function (value, min, max) {
        return Math.min(max, Math.max(min, value));
    };
    RangeRecommenderService.prototype.computeVolatilityScore = function (poolInfo, ctx) {
        if (typeof (ctx === null || ctx === void 0 ? void 0 : ctx.volatilityScore) === 'number') {
            return this.clamp(ctx.volatilityScore, 0.02, 0.35);
        }
        if ((ctx === null || ctx === void 0 ? void 0 : ctx.recentHighPrice) && (ctx === null || ctx === void 0 ? void 0 : ctx.recentLowPrice) && ctx.recentLowPrice > 0) {
            var highLowSpread = (ctx.recentHighPrice - ctx.recentLowPrice) / ctx.recentLowPrice;
            if (highLowSpread > 0) {
                return this.clamp(highLowSpread, 0.03, 0.35);
            }
        }
        if (poolInfo.volume24h && poolInfo.tvl && poolInfo.tvl > 0) {
            var turnoverRatio = poolInfo.volume24h / poolInfo.tvl;
            return this.clamp(turnoverRatio * 0.15, 0.025, 0.3);
        }
        return 0.06; // default mild volatility when no data is present
    };
    RangeRecommenderService.prototype.computeVolumeBias = function (poolPrice, ctx) {
        var _a;
        if (typeof (ctx === null || ctx === void 0 ? void 0 : ctx.volumeBias) === 'number') {
            return ctx.volumeBias;
        }
        if ((_a = ctx === null || ctx === void 0 ? void 0 : ctx.volumeNodes) === null || _a === void 0 ? void 0 : _a.length) {
            var higherWeight = ctx.volumeNodes
                .filter(function (node) { return node.price > poolPrice; })
                .reduce(function (sum, node) { return sum + node.weight; }, 0);
            var lowerWeight = ctx.volumeNodes
                .filter(function (node) { return node.price < poolPrice; })
                .reduce(function (sum, node) { return sum + node.weight; }, 0);
            if (higherWeight > lowerWeight * 1.2)
                return 1;
            if (lowerWeight > higherWeight * 1.2)
                return -1;
        }
        return 0;
    };
    RangeRecommenderService.prototype.deriveCoverageSpan = function (nodes, activeBin, targetCoverage, fallbackBins, minBins, maxBins) {
        if (!nodes || nodes.length === 0) {
            return this.clamp(fallbackBins, minBins, maxBins);
        }
        var sorted = __spreadArray([], nodes, true).sort(function (a, b) { return Math.abs(a.binId - activeBin) - Math.abs(b.binId - activeBin); });
        var coverage = 0;
        var furthestDistance = 0;
        for (var _i = 0, sorted_1 = sorted; _i < sorted_1.length; _i++) {
            var node = sorted_1[_i];
            coverage += node.weight;
            furthestDistance = Math.max(furthestDistance, Math.abs(node.binId - activeBin));
            if (coverage >= targetCoverage) {
                break;
            }
        }
        if (furthestDistance === 0) {
            furthestDistance = fallbackBins;
        }
        return this.clamp(Math.max(1, furthestDistance), minBins, maxBins);
    };
    RangeRecommenderService.prototype.resolveOraclePrice = function (poolInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, oracle_service_1.oracleService.getPriceRatio(poolInfo.tokenX.mint, poolInfo.tokenY.mint)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_1 = _a.sent();
                        console.warn('Failed to fetch oracle price for recommendation:', error_1);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    RangeRecommenderService.prototype.suggestRange = function (strategy, poolInfo, context) {
        return __awaiter(this, void 0, void 0, function () {
            var strategyKey, activeBin, binStep, poolPrice, oraclePrice, _a, volatilityScore, priceDeviation, volumeBias;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        strategyKey = strategy === dlmm_1.StrategyType.Spot || strategy === 'Spot'
                            ? 'Spot'
                            : strategy === dlmm_1.StrategyType.Curve || strategy === 'Curve'
                                ? 'Curve'
                                : 'BidAsk';
                        activeBin = poolInfo.activeBin;
                        if (typeof activeBin !== 'number') {
                            throw new Error('Pool info is missing active bin data.');
                        }
                        binStep = poolInfo.binStep || 1;
                        poolPrice = (_c = (_b = context === null || context === void 0 ? void 0 : context.poolPrice) !== null && _b !== void 0 ? _b : poolInfo.price) !== null && _c !== void 0 ? _c : 1;
                        if (!((_d = context === null || context === void 0 ? void 0 : context.oraclePrice) !== null && _d !== void 0)) return [3 /*break*/, 1];
                        _a = _d;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.resolveOraclePrice(poolInfo)];
                    case 2:
                        _a = (_e.sent());
                        _e.label = 3;
                    case 3:
                        oraclePrice = _a;
                        volatilityScore = this.computeVolatilityScore(poolInfo, context);
                        priceDeviation = oraclePrice
                            ? Math.abs(poolPrice - oraclePrice) / Math.max(oraclePrice, 1e-9)
                            : 0;
                        volumeBias = this.computeVolumeBias(poolPrice, context);
                        switch (strategyKey) {
                            case 'Spot':
                                return [2 /*return*/, this.buildSpotRecommendation({
                                        activeBin: activeBin,
                                        binStep: binStep,
                                        volatilityScore: volatilityScore,
                                        priceDeviation: priceDeviation,
                                        volumeBias: volumeBias,
                                    })];
                            case 'Curve':
                                return [2 /*return*/, this.buildCurveRecommendation({
                                        activeBin: activeBin,
                                        binStep: binStep,
                                        volatilityScore: volatilityScore,
                                        priceDeviation: priceDeviation,
                                        volumeBias: volumeBias,
                                    })];
                            case 'BidAsk':
                            default:
                                return [2 /*return*/, this.buildBidAskRecommendation({
                                        activeBin: activeBin,
                                        binStep: binStep,
                                        volatilityScore: volatilityScore,
                                        priceDeviation: priceDeviation,
                                        volumeBias: volumeBias,
                                        bidCoverageNodes: context === null || context === void 0 ? void 0 : context.bidCoverageNodes,
                                        askCoverageNodes: context === null || context === void 0 ? void 0 : context.askCoverageNodes,
                                        atrPercent: context === null || context === void 0 ? void 0 : context.atrPercent,
                                    })];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    RangeRecommenderService.prototype.buildSpotRecommendation = function (args) {
        var binsPerSide = Math.round(2 + args.volatilityScore * 20);
        binsPerSide = this.clamp(binsPerSide, 2, 10);
        if (args.priceDeviation > 0.25)
            binsPerSide += 1;
        var minBinId = args.activeBin - binsPerSide;
        var maxBinId = args.activeBin + binsPerSide;
        var rationale = [
            "Base bins adjusted for volatility (".concat((args.volatilityScore * 100).toFixed(1), "%)"),
            args.priceDeviation > 0.25
                ? 'Expanded band because pool price deviates >25% from oracle'
                : 'Tight band keeps liquidity near active bin for fee capture',
        ];
        if (args.volumeBias !== 0) {
            rationale.push(args.volumeBias > 0
                ? 'Upper volume concentration detected → keep slightly more room above'
                : 'Lower volume concentration detected → keep slightly more room below');
        }
        return {
            strategy: 'Spot',
            recommendedBinsPerSide: binsPerSide,
            minBinId: minBinId,
            maxBinId: maxBinId,
            centerBin: args.activeBin,
            rationale: rationale,
            metrics: {
                volatilityScore: args.volatilityScore,
                priceDeviation: args.priceDeviation,
                volumeBias: args.volumeBias,
            },
        };
    };
    RangeRecommenderService.prototype.buildCurveRecommendation = function (args) {
        var binsPerSide = Math.round(6 + args.volatilityScore * 30);
        binsPerSide = this.clamp(binsPerSide, 4, 25);
        var centerShift = Math.round(args.volumeBias * Math.max(1, args.priceDeviation * 10));
        var minBinId = args.activeBin - binsPerSide + Math.min(centerShift, 0);
        var maxBinId = args.activeBin + binsPerSide + Math.max(centerShift, 0);
        var rationale = [
            "Wide Curve band sized to ".concat((binsPerSide * args.binStep * 2 / 100).toFixed(2), "% price span"),
            "Volatility score ".concat((args.volatilityScore * 100).toFixed(1), "% set the baseline width"),
        ];
        if (centerShift !== 0) {
            rationale.push(centerShift > 0
                ? 'Shifted upward due to heavier sell-side volume / bullish bias'
                : 'Shifted downward due to heavier buy-side volume / bearish bias');
        }
        if (args.priceDeviation > 0.5) {
            rationale.push('Oracle deviation >50% so coverage extends to mean-reversion zone');
        }
        return {
            strategy: 'Curve',
            recommendedBinsPerSide: binsPerSide,
            minBinId: minBinId,
            maxBinId: maxBinId,
            centerBin: args.activeBin + centerShift,
            rationale: rationale,
            metrics: {
                volatilityScore: args.volatilityScore,
                priceDeviation: args.priceDeviation,
                volumeBias: args.volumeBias,
            },
        };
    };
    RangeRecommenderService.prototype.buildBidAskRecommendation = function (args) {
        var fallbackBid = this.clamp(Math.round(4 + args.volatilityScore * 25), 3, 20);
        var fallbackAsk = this.clamp(Math.round(6 + args.volatilityScore * 35), 4, 30);
        var atrAdj = args.atrPercent !== undefined
            ? args.atrPercent > 0.02
                ? 0.15
                : args.atrPercent < 0.008
                    ? -0.15
                    : 0
            : 0;
        var bidTarget = this.clamp(0.55 + atrAdj - (args.volumeBias < 0 ? 0.1 : 0), 0.35, 0.9);
        var askTarget = this.clamp(0.65 + atrAdj + (args.volumeBias > 0 ? 0.1 : 0), 0.4, 0.95);
        var bidBins = this.deriveCoverageSpan(args.bidCoverageNodes, args.activeBin, bidTarget, fallbackBid, 2, 20);
        var askBins = this.deriveCoverageSpan(args.askCoverageNodes, args.activeBin, askTarget, fallbackAsk, 3, 30);
        var directionalShift = Math.round((args.priceDeviation * 10 + 1) * args.volumeBias);
        var minBinId = args.activeBin - bidBins - Math.min(directionalShift, 0);
        var maxBinId = args.activeBin + askBins + Math.max(directionalShift, 0);
        var rationale = [
            "Bid side spans ".concat(bidBins, " bins to cover ~").concat((bidTarget * 100).toFixed(0), "% of VPVR depth"),
            "Ask side spans ".concat(askBins, " bins to cover ~").concat((askTarget * 100).toFixed(0), "% of VPVR depth"),
            "Volatility score ".concat((args.volatilityScore * 100).toFixed(1), "% set directional spread"),
        ];
        if (directionalShift > 0) {
            rationale.push('Bias toward higher bins (expecting upward move) based on volume profile');
        }
        else if (directionalShift < 0) {
            rationale.push('Bias toward lower bins (expecting pullback) based on volume profile');
        }
        if (args.priceDeviation > 0.5) {
            rationale.push('Large oracle deviation → capture arbitrage window across range');
        }
        if (args.atrPercent !== undefined) {
            rationale.push(args.atrPercent > 0.02
                ? 'ATR expanding → widened coverage targets to capture swings'
                : args.atrPercent < 0.008
                    ? 'ATR contracting → trimmed coverage for tighter fills'
                    : 'ATR flat → using neutral coverage targets');
        }
        return {
            strategy: 'BidAsk',
            recommendedBidBins: bidBins,
            recommendedAskBins: askBins,
            minBinId: minBinId,
            maxBinId: maxBinId,
            centerBin: args.activeBin,
            rationale: rationale,
            metrics: {
                volatilityScore: args.volatilityScore,
                priceDeviation: args.priceDeviation,
                volumeBias: args.volumeBias,
            },
        };
    };
    return RangeRecommenderService;
}());
exports.rangeRecommenderService = new RangeRecommenderService();
