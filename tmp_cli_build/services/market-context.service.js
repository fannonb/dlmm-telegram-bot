"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.marketContextService = void 0;
var pool_service_1 = require("./pool.service");
var oracle_service_1 = require("./oracle.service");
var MarketContextService = /** @class */ (function () {
    function MarketContextService() {
    }
    MarketContextService.prototype.clamp = function (value, min, max) {
        return Math.min(max, Math.max(min, value));
    };
    MarketContextService.prototype.computeAtrPercent = function (series) {
        if (series.length < 2) {
            return undefined;
        }
        var trSum = 0;
        for (var i = 1; i < series.length; i++) {
            trSum += Math.abs(series[i].price - series[i - 1].price);
        }
        var atr = trSum / (series.length - 1);
        var referencePrice = series[series.length - 1].price;
        if (!referencePrice || referencePrice <= 0) {
            return undefined;
        }
        return atr / referencePrice;
    };
    MarketContextService.prototype.computeSeriesVolatility = function (series) {
        if (!series.length) {
            return undefined;
        }
        var prices = series.map(function (point) { return point.price; }).filter(function (price) { return price > 0; });
        if (!prices.length) {
            return undefined;
        }
        var high = Math.max.apply(Math, prices);
        var low = Math.min.apply(Math, prices);
        if (!Number.isFinite(high) || !Number.isFinite(low) || low <= 0) {
            return undefined;
        }
        var spread = (high - low) / Math.max(low, 1e-9);
        return this.clamp(spread, 0.02, 0.5);
    };
    MarketContextService.prototype.getPriceRatioSeries = function (poolInfo_1) {
        return __awaiter(this, arguments, void 0, function (poolInfo, hours) {
            var _a, tokenXSeries, tokenYSeries, length, ratioSeries, i, priceX, priceY;
            if (hours === void 0) { hours = 6; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.all([
                            oracle_service_1.oracleService.getUsdPriceSeries(poolInfo.tokenX.mint, hours),
                            oracle_service_1.oracleService.getUsdPriceSeries(poolInfo.tokenY.mint, hours),
                        ])];
                    case 1:
                        _a = _b.sent(), tokenXSeries = _a[0], tokenYSeries = _a[1];
                        if (!tokenXSeries || !tokenYSeries || tokenXSeries.length < 2 || tokenYSeries.length < 2) {
                            return [2 /*return*/, null];
                        }
                        length = Math.min(tokenXSeries.length, tokenYSeries.length);
                        ratioSeries = [];
                        for (i = 0; i < length; i++) {
                            priceX = tokenXSeries[i].price;
                            priceY = tokenYSeries[i].price;
                            if (!priceX || !priceY || priceY <= 0) {
                                continue;
                            }
                            ratioSeries.push({
                                timestamp: Math.min(tokenXSeries[i].timestamp, tokenYSeries[i].timestamp),
                                price: priceX / priceY,
                            });
                        }
                        return [2 /*return*/, ratioSeries.length >= 2 ? ratioSeries : null];
                }
            });
        });
    };
    MarketContextService.prototype.buildRangeContext = function (poolInfo, options) {
        return __awaiter(this, void 0, void 0, function () {
            var binsToSample, dlmm, bins, tokenXDecimals_1, tokenYDecimals_1, usdPrices, tokenXUsd_1, tokenYUsd_1, recentHighPrice_1, recentLowPrice_1, nodes_1, priceSamples_1, bidDepthNodes_1, askDepthNodes_1, topNodes, totalWeight_1, normalizedNodes, context, ratioSeries, volatilityFromSeries, atrPercent, seriesPrices, seriesHigh, seriesLow, seriesError_1, spread, trueRangeSum, i, atr, fallbackBinId, referencePrice, normalizeDepth, error_1;
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        binsToSample = (_a = options === null || options === void 0 ? void 0 : options.binsToSample) !== null && _a !== void 0 ? _a : 24;
                        _j.label = 1;
                    case 1:
                        _j.trys.push([1, 9, , 10]);
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolInfo.address)];
                    case 2:
                        dlmm = _j.sent();
                        return [4 /*yield*/, dlmm.getBinsAroundActiveBin(binsToSample, binsToSample)];
                    case 3:
                        bins = (_j.sent()).bins;
                        tokenXDecimals_1 = poolInfo.tokenX.decimals || 6;
                        tokenYDecimals_1 = poolInfo.tokenY.decimals || 6;
                        return [4 /*yield*/, oracle_service_1.oracleService.getUsdPrices([
                                poolInfo.tokenX.mint,
                                poolInfo.tokenY.mint,
                            ])];
                    case 4:
                        usdPrices = _j.sent();
                        tokenXUsd_1 = (_b = usdPrices.get(poolInfo.tokenX.mint)) !== null && _b !== void 0 ? _b : null;
                        tokenYUsd_1 = (_c = usdPrices.get(poolInfo.tokenY.mint)) !== null && _c !== void 0 ? _c : null;
                        recentHighPrice_1 = 0;
                        recentLowPrice_1 = Number.POSITIVE_INFINITY;
                        nodes_1 = [];
                        priceSamples_1 = [];
                        bidDepthNodes_1 = [];
                        askDepthNodes_1 = [];
                        bins.forEach(function (bin) {
                            var price = pool_service_1.poolService.calculateBinPrice(bin.binId, poolInfo.binStep, tokenXDecimals_1, tokenYDecimals_1);
                            if (!Number.isFinite(price) || price <= 0) {
                                return;
                            }
                            priceSamples_1.push(price);
                            recentHighPrice_1 = Math.max(recentHighPrice_1, price);
                            recentLowPrice_1 = Math.min(recentLowPrice_1, price);
                            var xAmount = Number(bin.xAmount.toString()) / Math.pow(10, tokenXDecimals_1);
                            var yAmount = Number(bin.yAmount.toString()) / Math.pow(10, tokenYDecimals_1);
                            var usdWeight = 0;
                            if (tokenXUsd_1) {
                                usdWeight += xAmount * tokenXUsd_1;
                            }
                            if (tokenYUsd_1) {
                                usdWeight += yAmount * tokenYUsd_1;
                            }
                            // If one side missing USD quote, derive using pool price ratio
                            if (!tokenXUsd_1 && tokenYUsd_1) {
                                usdWeight += xAmount * price * tokenYUsd_1;
                            }
                            if (!tokenYUsd_1 && tokenXUsd_1 && price !== 0) {
                                usdWeight += yAmount * (tokenXUsd_1 / price);
                            }
                            if (usdWeight > 0) {
                                nodes_1.push({ price: price, weight: usdWeight });
                                var depthNode = { price: price, weight: usdWeight, binId: bin.binId };
                                if (poolInfo.activeBin !== undefined && bin.binId <= poolInfo.activeBin) {
                                    bidDepthNodes_1.push(depthNode);
                                }
                                else {
                                    askDepthNodes_1.push(depthNode);
                                }
                            }
                        });
                        nodes_1.sort(function (a, b) { return b.weight - a.weight; });
                        topNodes = nodes_1.slice(0, 5);
                        totalWeight_1 = topNodes.reduce(function (sum, node) { return sum + node.weight; }, 0) || 1;
                        normalizedNodes = topNodes.map(function (node) { return ({
                            price: node.price,
                            weight: node.weight / totalWeight_1,
                        }); });
                        context = {
                            volumeNodes: normalizedNodes,
                        };
                        _j.label = 5;
                    case 5:
                        _j.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, this.getPriceRatioSeries(poolInfo, 6)];
                    case 6:
                        ratioSeries = _j.sent();
                        if (ratioSeries === null || ratioSeries === void 0 ? void 0 : ratioSeries.length) {
                            volatilityFromSeries = this.computeSeriesVolatility(ratioSeries);
                            if (typeof volatilityFromSeries === 'number') {
                                context.volatilityScore = volatilityFromSeries;
                            }
                            atrPercent = this.computeAtrPercent(ratioSeries);
                            if (typeof atrPercent === 'number') {
                                context.atrPercent = atrPercent;
                            }
                            seriesPrices = ratioSeries.map(function (point) { return point.price; });
                            seriesHigh = Math.max.apply(Math, seriesPrices);
                            seriesLow = Math.min.apply(Math, seriesPrices);
                            if (Number.isFinite(seriesHigh) && Number.isFinite(seriesLow)) {
                                context.recentHighPrice = seriesHigh;
                                context.recentLowPrice = seriesLow;
                            }
                        }
                        return [3 /*break*/, 8];
                    case 7:
                        seriesError_1 = _j.sent();
                        console.warn('Failed to fetch historical price series:', seriesError_1);
                        return [3 /*break*/, 8];
                    case 8:
                        if ((context.recentHighPrice === undefined || context.recentLowPrice === undefined) &&
                            recentHighPrice_1 > 0 &&
                            recentLowPrice_1 !== Number.POSITIVE_INFINITY) {
                            context.recentHighPrice = recentHighPrice_1;
                            context.recentLowPrice = recentLowPrice_1;
                        }
                        if (context.volatilityScore === undefined && recentHighPrice_1 > 0 && recentLowPrice_1 !== Number.POSITIVE_INFINITY) {
                            spread = (recentHighPrice_1 - recentLowPrice_1) / Math.max(recentLowPrice_1, 1e-9);
                            context.volatilityScore = Math.min(Math.max(spread, 0.02), 0.5);
                        }
                        if (context.atrPercent === undefined && priceSamples_1.length > 1) {
                            trueRangeSum = 0;
                            for (i = 1; i < priceSamples_1.length; i++) {
                                trueRangeSum += Math.abs(priceSamples_1[i] - priceSamples_1[i - 1]);
                            }
                            atr = trueRangeSum / (priceSamples_1.length - 1);
                            fallbackBinId = (_f = (_d = poolInfo.activeBin) !== null && _d !== void 0 ? _d : (_e = bins[Math.floor(bins.length / 2)]) === null || _e === void 0 ? void 0 : _e.binId) !== null && _f !== void 0 ? _f : 0;
                            referencePrice = (_h = (_g = poolInfo.price) !== null && _g !== void 0 ? _g : (fallbackBinId
                                ? pool_service_1.poolService.calculateBinPrice(fallbackBinId, poolInfo.binStep, poolInfo.tokenX.decimals || 6, poolInfo.tokenY.decimals || 6)
                                : undefined)) !== null && _h !== void 0 ? _h : priceSamples_1[Math.floor(priceSamples_1.length / 2)];
                            if (referencePrice && referencePrice > 0) {
                                context.atrPercent = atr / referencePrice;
                            }
                        }
                        normalizeDepth = function (collection) {
                            var _a;
                            if (!collection.length)
                                return [];
                            var total = collection.reduce(function (sum, node) { return sum + node.weight; }, 0) || 1;
                            var activeBin = (_a = poolInfo.activeBin) !== null && _a !== void 0 ? _a : collection[0].binId;
                            return collection
                                .map(function (node) { return (__assign(__assign({}, node), { weight: node.weight / total })); })
                                .sort(function (a, b) { return Math.abs(a.binId - activeBin) - Math.abs(b.binId - activeBin); });
                        };
                        context.bidCoverageNodes = normalizeDepth(bidDepthNodes_1);
                        context.askCoverageNodes = normalizeDepth(askDepthNodes_1);
                        return [2 /*return*/, context];
                    case 9:
                        error_1 = _j.sent();
                        console.warn('Failed to build market context:', error_1);
                        return [2 /*return*/, {}];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    return MarketContextService;
}());
exports.marketContextService = new MarketContextService();
