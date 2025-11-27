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
exports.priceService = exports.PriceService = void 0;
var axios_1 = require("axios");
var PriceService = /** @class */ (function () {
    function PriceService() {
        this.PRIMARY_API = 'https://price.jup.ag/v4/price';
        this.BACKUP_APIS = [
            'https://api.jup.ag/price/v2?ids=',
            'https://quote-api.jup.ag/v6/price?ids='
        ];
        this.COINGECKO_ENDPOINT = 'https://api.coingecko.com/api/v3/simple/token_price/solana';
        this.cache = new Map();
        this.CACHE_TTL = 60 * 1000; // 1 minute cache
        this.REQUEST_TIMEOUT = 5000; // 5 second timeout
        // Well-known token prices as fallbacks (updated: 2025-11-21)
        this.FALLBACK_PRICES = new Map([
            ['So11111111111111111111111111111111111111112', 130], // SOL ~$130 (as of Nov 2025)
            ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 1], // USDC $1
            ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 1], // USDT $1
        ]);
    }
    /**
     * Get USD price for a single token
     */
    PriceService.prototype.getTokenPrice = function (mint) {
        return __awaiter(this, void 0, void 0, function () {
            var cached, price, apiSource, _i, _a, backupAPI, e_1, error_1, fallback, error_2, fallback;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 12, , 13]);
                        cached = this.cache.get(mint);
                        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                            return [2 /*return*/, cached.price];
                        }
                        return [4 /*yield*/, this.fetchPriceFromAPI(this.PRIMARY_API, mint)];
                    case 1:
                        price = _b.sent();
                        apiSource = 'primary';
                        if (!(price === 0)) return [3 /*break*/, 7];
                        console.warn("\u26A0\uFE0F  Primary price API failed for ".concat(mint.slice(0, 8), "..., trying backups"));
                        _i = 0, _a = this.BACKUP_APIS;
                        _b.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        backupAPI = _a[_i];
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.fetchPriceFromAPI(backupAPI, mint)];
                    case 4:
                        price = _b.sent();
                        if (price > 0) {
                            apiSource = 'backup';
                            return [3 /*break*/, 7];
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        e_1 = _b.sent();
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7:
                        if (!(price === 0)) return [3 /*break*/, 11];
                        _b.label = 8;
                    case 8:
                        _b.trys.push([8, 10, , 11]);
                        return [4 /*yield*/, this.fetchPriceFromCoingecko(mint)];
                    case 9:
                        price = _b.sent();
                        if (price > 0) {
                            apiSource = 'coingecko';
                            console.log("\u2713 Fetched price from CoinGecko for ".concat(mint.slice(0, 8), "...: $").concat(price.toFixed(4)));
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        error_1 = _b.sent();
                        console.warn("\u26A0\uFE0F  CoinGecko price fetch failed for ".concat(mint.slice(0, 8), "...: ").concat(error_1 instanceof Error ? error_1.message : error_1));
                        return [3 /*break*/, 11];
                    case 11:
                        // Use fallback price if all APIs fail
                        if (price === 0) {
                            fallback = this.FALLBACK_PRICES.get(mint);
                            if (fallback) {
                                console.warn("\u26A0\uFE0F  All price APIs failed for ".concat(mint.slice(0, 8), "... Using fallback price: $").concat(fallback));
                                price = fallback;
                                apiSource = 'fallback';
                            }
                            else {
                                console.warn("\u26A0\uFE0F  No price available for ".concat(mint.slice(0, 8), "... (not in fallback list)"));
                            }
                        }
                        else if (apiSource === 'backup') {
                            console.log("\u2713 Fetched price from backup API for ".concat(mint.slice(0, 8), "...: $").concat(price.toFixed(2)));
                        }
                        if (price > 0) {
                            this.cache.set(mint, { price: price, timestamp: Date.now() });
                        }
                        return [2 /*return*/, price];
                    case 12:
                        error_2 = _b.sent();
                        console.error("Failed to fetch price for ".concat(mint, ":"), error_2);
                        fallback = this.FALLBACK_PRICES.get(mint);
                        if (fallback) {
                            console.warn("Using fallback price after error: $".concat(fallback));
                        }
                        return [2 /*return*/, fallback || 0];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    PriceService.prototype.fetchPriceFromAPI = function (apiUrl, mint) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, data, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        url = apiUrl.includes('?ids=') ? "".concat(apiUrl).concat(mint) : "".concat(apiUrl, "?ids=").concat(mint);
                        return [4 /*yield*/, axios_1.default.get(url, {
                                timeout: this.REQUEST_TIMEOUT,
                                headers: {
                                    'User-Agent': 'DLMM-CLI/1.0.0'
                                }
                            })];
                    case 1:
                        response = _a.sent();
                        data = void 0;
                        if (response.data.data && response.data.data[mint]) {
                            data = response.data.data[mint];
                        }
                        else if (response.data[mint]) {
                            data = response.data[mint];
                        }
                        else {
                            return [2 /*return*/, 0];
                        }
                        return [2 /*return*/, typeof data.price === 'number' ? data.price : 0];
                    case 2:
                        error_3 = _a.sent();
                        // Don't log individual API failures to reduce noise
                        return [2 /*return*/, 0];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    PriceService.prototype.fetchPriceFromCoingecko = function (mint) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedMint, url, response, candidates, _i, candidates_1, key, entry, error_4;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        normalizedMint = mint.toLowerCase();
                        url = "".concat(this.COINGECKO_ENDPOINT, "?contract_addresses=").concat(mint, "&vs_currencies=usd");
                        return [4 /*yield*/, axios_1.default.get(url, {
                                timeout: this.REQUEST_TIMEOUT,
                                headers: {
                                    'User-Agent': 'DLMM-CLI/1.0.0'
                                }
                            })];
                    case 1:
                        response = _b.sent();
                        candidates = [mint, normalizedMint];
                        for (_i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
                            key = candidates_1[_i];
                            entry = (_a = response.data) === null || _a === void 0 ? void 0 : _a[key];
                            if (entry && typeof entry.usd === 'number') {
                                return [2 /*return*/, entry.usd];
                            }
                        }
                        return [2 /*return*/, 0];
                    case 2:
                        error_4 = _b.sent();
                        return [2 /*return*/, 0];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get USD prices for multiple tokens
     */
    PriceService.prototype.getTokenPrices = function (mints) {
        return __awaiter(this, void 0, void 0, function () {
            var result, pricePromises, prices, error_5;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = new Map();
                        pricePromises = mints.map(function (mint) { return __awaiter(_this, void 0, void 0, function () {
                            var price;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.getTokenPrice(mint)];
                                    case 1:
                                        price = _a.sent();
                                        return [2 /*return*/, { mint: mint, price: price }];
                                }
                            });
                        }); });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Promise.all(pricePromises)];
                    case 2:
                        prices = _a.sent();
                        prices.forEach(function (_a) {
                            var mint = _a.mint, price = _a.price;
                            result.set(mint, price);
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_5 = _a.sent();
                        console.error('Failed to fetch batch prices:', error_5);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, result];
                }
            });
        });
    };
    return PriceService;
}());
exports.PriceService = PriceService;
exports.priceService = new PriceService();
