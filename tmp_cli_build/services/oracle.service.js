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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.oracleService = void 0;
var axios_1 = require("axios");
var PRICE_CACHE_TTL = 60000; // 1 minute
var SOL_MINT = 'So11111111111111111111111111111111111111112';
var USDC_MINTS = [
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
    '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Devnet USDC
    'Es9vMFrzaCERFjfQ2J8b8zEfYFvuJMosuUo9A99G1S3', // Legacy SPL USDC
];
var MET_MINT = 'METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL';
var MINT_TO_COINGECKO_ID = __assign(__assign((_a = {}, _a[SOL_MINT] = 'solana', _a[MET_MINT] = 'meteora', _a), USDC_MINTS.reduce(function (acc, mint) {
    var _a;
    return (__assign(__assign({}, acc), (_a = {}, _a[mint] = 'usd-coin', _a)));
}, {})), { 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'marinade-staked-sol', 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jito-staked-sol', 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 'blazestake-staked-sol' });
var OracleService = /** @class */ (function () {
    function OracleService() {
        this.cache = new Map();
        this.seriesCache = new Map();
    }
    OracleService.prototype.getCoinGeckoId = function (mint) {
        return MINT_TO_COINGECKO_ID[mint] || null;
    };
    OracleService.prototype.buildCacheKey = function (id) {
        return "coingecko:".concat(id);
    };
    OracleService.prototype.buildSeriesCacheKey = function (id, hours) {
        return "coingecko:series:".concat(id, ":").concat(hours);
    };
    OracleService.prototype.fetchPrices = function (ids) {
        return __awaiter(this, void 0, void 0, function () {
            var uniqueIds, url, response, data;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (ids.length === 0)
                            return [2 /*return*/];
                        uniqueIds = Array.from(new Set(ids));
                        url = "https://api.coingecko.com/api/v3/simple/price?ids=".concat(uniqueIds.join(','), "&vs_currencies=usd");
                        return [4 /*yield*/, axios_1.default.get(url, { timeout: 5000 })];
                    case 1:
                        response = _a.sent();
                        data = response.data;
                        uniqueIds.forEach(function (id) {
                            var _a;
                            var usd = (_a = data === null || data === void 0 ? void 0 : data[id]) === null || _a === void 0 ? void 0 : _a.usd;
                            if (typeof usd === 'number') {
                                _this.cache.set(_this.buildCacheKey(id), { price: usd, timestamp: Date.now() });
                            }
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    OracleService.prototype.getUsdForIds = function (ids) {
        return __awaiter(this, void 0, void 0, function () {
            var results, idsNeedingFetch, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = new Map();
                        idsNeedingFetch = [];
                        ids.forEach(function (id) {
                            var cached = _this.cache.get(_this.buildCacheKey(id));
                            if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
                                results.set(id, cached.price);
                            }
                            else {
                                idsNeedingFetch.push(id);
                            }
                        });
                        if (!idsNeedingFetch.length) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.fetchPrices(idsNeedingFetch)];
                    case 2:
                        _a.sent();
                        idsNeedingFetch.forEach(function (id) {
                            var cached = _this.cache.get(_this.buildCacheKey(id));
                            if (cached) {
                                results.set(id, cached.price);
                            }
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.warn('Oracle fetch failed:', error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, results];
                }
            });
        });
    };
    OracleService.prototype.fetchPriceSeriesForId = function (id, hours) {
        return __awaiter(this, void 0, void 0, function () {
            var nowSeconds, fromSeconds, url, response, prices;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        nowSeconds = Math.floor(Date.now() / 1000);
                        fromSeconds = nowSeconds - Math.max(1, Math.round(hours * 3600));
                        url = "https://api.coingecko.com/api/v3/coins/".concat(id, "/market_chart/range?vs_currency=usd&from=").concat(fromSeconds, "&to=").concat(nowSeconds);
                        return [4 /*yield*/, axios_1.default.get(url, { timeout: 5000 })];
                    case 1:
                        response = _c.sent();
                        prices = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.prices) !== null && _b !== void 0 ? _b : [];
                        return [2 /*return*/, prices
                                .filter(function (entry) { return Array.isArray(entry) && entry.length >= 2; })
                                .map(function (_a) {
                                var timestamp = _a[0], price = _a[1];
                                return ({
                                    timestamp: timestamp,
                                    price: price,
                                });
                            })
                                .filter(function (point) { return typeof point.price === 'number' && Number.isFinite(point.price); })];
                }
            });
        });
    };
    OracleService.prototype.getUsdPrice = function (mint) {
        return __awaiter(this, void 0, void 0, function () {
            var coinGeckoId, prices;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        coinGeckoId = this.getCoinGeckoId(mint);
                        if (!coinGeckoId)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, this.getUsdForIds([coinGeckoId])];
                    case 1:
                        prices = _b.sent();
                        return [2 /*return*/, (_a = prices.get(coinGeckoId)) !== null && _a !== void 0 ? _a : null];
                }
            });
        });
    };
    OracleService.prototype.getUsdPrices = function (mints) {
        return __awaiter(this, void 0, void 0, function () {
            var ids, prices, map;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ids = mints
                            .map(function (mint) { return ({ mint: mint, id: _this.getCoinGeckoId(mint) }); })
                            .filter(function (entry) { return Boolean(entry.id); });
                        return [4 /*yield*/, this.getUsdForIds(ids.map(function (entry) { return entry.id; }))];
                    case 1:
                        prices = _a.sent();
                        map = new Map();
                        ids.forEach(function (_a) {
                            var mint = _a.mint, id = _a.id;
                            var price = prices.get(id);
                            if (typeof price === 'number') {
                                map.set(mint, price);
                            }
                        });
                        return [2 /*return*/, map];
                }
            });
        });
    };
    OracleService.prototype.getUsdPriceSeries = function (mint_1) {
        return __awaiter(this, arguments, void 0, function (mint, hours) {
            var coinGeckoId, cacheKey, cached, cacheTtlMs, points, error_2;
            var _a;
            if (hours === void 0) { hours = 6; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        coinGeckoId = this.getCoinGeckoId(mint);
                        if (!coinGeckoId) {
                            return [2 /*return*/, null];
                        }
                        cacheKey = this.buildSeriesCacheKey(coinGeckoId, hours);
                        cached = this.seriesCache.get(cacheKey);
                        cacheTtlMs = 2 * 60000;
                        if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
                            return [2 /*return*/, cached.points];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.fetchPriceSeriesForId(coinGeckoId, hours)];
                    case 2:
                        points = _b.sent();
                        this.seriesCache.set(cacheKey, { points: points, timestamp: Date.now() });
                        return [2 /*return*/, points];
                    case 3:
                        error_2 = _b.sent();
                        console.warn('Oracle series fetch failed:', error_2);
                        return [2 /*return*/, (_a = cached === null || cached === void 0 ? void 0 : cached.points) !== null && _a !== void 0 ? _a : null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    OracleService.prototype.getPriceRatio = function (tokenXMint, tokenYMint) {
        return __awaiter(this, void 0, void 0, function () {
            var prices, priceX, priceY;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (tokenXMint === tokenYMint)
                            return [2 /*return*/, 1];
                        return [4 /*yield*/, this.getUsdPrices([tokenXMint, tokenYMint])];
                    case 1:
                        prices = _a.sent();
                        priceX = prices.get(tokenXMint);
                        priceY = prices.get(tokenYMint);
                        if (typeof priceX !== 'number' || typeof priceY !== 'number') {
                            return [2 /*return*/, null];
                        }
                        if (priceY === 0) {
                            return [2 /*return*/, null];
                        }
                        if (typeof priceX === 'number' && typeof priceY === 'number' && priceY !== 0) {
                            return [2 /*return*/, priceX / priceY];
                        }
                        return [2 /*return*/, null];
                }
            });
        });
    };
    return OracleService;
}());
exports.oracleService = new OracleService();
