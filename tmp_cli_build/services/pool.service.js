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
exports.poolService = exports.PoolService = void 0;
var web3_js_1 = require("@solana/web3.js");
var axios_1 = require("axios");
var dlmm_1 = require("@meteora-ag/dlmm");
var spl_token_1 = require("@solana/spl-token");
var connection_service_1 = require("./connection.service");
var constants_1 = require("../config/constants");
var PoolService = /** @class */ (function () {
    function PoolService() {
        this.tokenDecimalsCache = new Map();
    }
    /**
     * Get DLMM instance for a pool
     * This is the gateway to all SDK operations
     */
    PoolService.prototype.getDlmmInstance = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var connection, error_1, network, errorMsg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        connection = connection_service_1.connectionService.getConnection();
                        return [4 /*yield*/, dlmm_1.default.create(connection, new web3_js_1.PublicKey(poolAddress))];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_1 = _a.sent();
                        network = connection_service_1.connectionService.getConfig().endpoint;
                        errorMsg = (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || String(error_1);
                        if (errorMsg.includes('Invalid account discriminator') || errorMsg.includes('Account not found')) {
                            throw new Error("Failed to initialize DLMM pool ".concat(poolAddress, ". The address exists but is NOT a valid DLMM pool on ").concat(network, ". It might be a wallet address or a different program account."));
                        }
                        throw new Error("Failed to initialize DLMM instance for ".concat(poolAddress, " on ").concat(network, ". Error: ").concat(errorMsg));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get active bin details including X and Y amounts
     */
    PoolService.prototype.getActiveBinDetails = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var dlmm, activeBin, tokenXMint, tokenYMint, _a, xDecimals, yDecimals, adjustedXDecimals, adjustedYDecimals, xAmount, yAmount, price, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this.getDlmmInstance(poolAddress)];
                    case 1:
                        dlmm = _b.sent();
                        return [4 /*yield*/, dlmm.getActiveBin()];
                    case 2:
                        activeBin = _b.sent();
                        tokenXMint = dlmm.tokenX.publicKey.toBase58();
                        tokenYMint = dlmm.tokenY.publicKey.toBase58();
                        return [4 /*yield*/, Promise.all([
                                this.getTokenDecimals(tokenXMint),
                                this.getTokenDecimals(tokenYMint),
                            ])];
                    case 3:
                        _a = _b.sent(), xDecimals = _a[0], yDecimals = _a[1];
                        adjustedXDecimals = xDecimals || 6;
                        adjustedYDecimals = yDecimals || 6;
                        xAmount = activeBin.xAmount ? activeBin.xAmount.toNumber() / Math.pow(10, adjustedXDecimals) : 0;
                        yAmount = activeBin.yAmount ? activeBin.yAmount.toNumber() / Math.pow(10, adjustedYDecimals) : 0;
                        price = this.calculateBinPrice(activeBin.binId, dlmm.lbPair.binStep, adjustedXDecimals, adjustedYDecimals);
                        return [2 /*return*/, {
                                binId: activeBin.binId,
                                xAmount: xAmount,
                                yAmount: yAmount,
                                price: price,
                            }];
                    case 4:
                        error_2 = _b.sent();
                        // Silently throw - let caller handle error gracefully
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    PoolService.prototype.getTokenDecimals = function (mintAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var connection, mintInfo, decimals, error_3;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.tokenDecimalsCache.has(mintAddress)) {
                            return [2 /*return*/, this.tokenDecimalsCache.get(mintAddress)];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        connection = connection_service_1.connectionService.getConnection();
                        return [4 /*yield*/, (0, spl_token_1.getMint)(connection, new web3_js_1.PublicKey(mintAddress))];
                    case 2:
                        mintInfo = _b.sent();
                        decimals = (_a = mintInfo.decimals) !== null && _a !== void 0 ? _a : 6;
                        this.tokenDecimalsCache.set(mintAddress, decimals);
                        return [2 /*return*/, decimals];
                    case 3:
                        error_3 = _b.sent();
                        console.warn("\u26A0\uFE0F  Failed to fetch token decimals for ".concat(mintAddress, ", defaulting to 6."), error_3);
                        this.tokenDecimalsCache.set(mintAddress, 6);
                        return [2 /*return*/, 6];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Helper to transform API pool data to PoolInfo
     */
    PoolService.prototype.transformPoolData = function (pool) {
        // Extract token symbols from name (e.g., "SOL-USDC" -> "SOL", "USDC")
        var symbols = pool.name ? pool.name.split('-') : ['UNKNOWN', 'UNKNOWN'];
        // Convert base_fee_percentage to basis points (e.g., "0.1" -> 10 bps)
        var feeBps = pool.base_fee_percentage
            ? parseFloat(pool.base_fee_percentage) * 100
            : 0;
        // Get TVL from liquidity field
        var tvl = pool.liquidity ? parseFloat(pool.liquidity) : 0;
        // Get 24h volume from trade_volume_24h
        var volume24h = pool.trade_volume_24h || 0;
        // Get APR (already in percentage format)
        var apr = pool.apr || 0;
        return {
            address: pool.address || '',
            tokenX: {
                mint: pool.mint_x || '',
                symbol: symbols[0] || 'UNKNOWN',
                decimals: 6, // Solana tokens typically use 6 decimals
            },
            tokenY: {
                mint: pool.mint_y || '',
                symbol: symbols[1] || 'UNKNOWN',
                decimals: 6, // Solana tokens typically use 6 decimals
            },
            binStep: pool.bin_step || 0,
            feeBps: Math.round(feeBps), // Convert to basis points
            activeBin: pool.active_id || 0,
            tvl: tvl,
            volume24h: volume24h,
            apr: apr,
            isActive: !pool.hide && !pool.is_blacklisted,
            lastUpdated: new Date().toISOString(),
            validationStatus: pool.is_verified ? 'valid' : 'warning',
        };
    };
    /**
     * Fetch all pools from Meteora API
     */
    PoolService.prototype.fetchAllPools = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios_1.default.get("".concat(constants_1.API_ENDPOINTS.METEORA_API, "/pair/all"))];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data || []];
                    case 2:
                        error_4 = _a.sent();
                        throw new Error("Failed to fetch pools: ".concat(error_4));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch a specific pool from Meteora API by address
     */
    PoolService.prototype.fetchPoolByAddress = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios_1.default.get("".concat(constants_1.API_ENDPOINTS.METEORA_API, "/pair/").concat(poolAddress))];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_5 = _a.sent();
                        throw new Error("Failed to fetch pool ".concat(poolAddress, ": ").concat(error_5));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Search for a pool by its address and return as PoolInfo
     * Enhanced: Fetches on-chain data to verify active bin
     */
    PoolService.prototype.searchPoolByAddress = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var poolInfo, dlmmInstance, poolData, apiError_1, activeBin, getSymbol, onChainError_1, dlmm, _a, activeBin, tokenXMint, tokenYMint, _b, tokenXDecimals, tokenYDecimals, err_1, error_6;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 17, , 18]);
                        if (!poolAddress || poolAddress.trim().length === 0) {
                            throw new Error('Pool address cannot be empty');
                        }
                        poolInfo = void 0;
                        dlmmInstance = null;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 9]);
                        return [4 /*yield*/, this.fetchPoolByAddress(poolAddress)];
                    case 2:
                        poolData = _c.sent();
                        poolInfo = this.transformPoolData(poolData);
                        return [3 /*break*/, 9];
                    case 3:
                        apiError_1 = _c.sent();
                        console.warn("\u26A0\uFE0F API fetch failed for ".concat(poolAddress, ", trying on-chain fallback..."));
                        _c.label = 4;
                    case 4:
                        _c.trys.push([4, 7, , 8]);
                        return [4 /*yield*/, this.getDlmmInstance(poolAddress)];
                    case 5:
                        dlmmInstance = _c.sent();
                        return [4 /*yield*/, dlmmInstance.getActiveBin()];
                    case 6:
                        activeBin = _c.sent();
                        getSymbol = function (mint, defaultSym) {
                            if (mint === 'So11111111111111111111111111111111111111112')
                                return 'SOL';
                            if (mint === '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
                                return 'USDC';
                            return defaultSym;
                        };
                        poolInfo = {
                            address: poolAddress,
                            tokenX: {
                                mint: dlmmInstance.tokenX.publicKey.toBase58(),
                                symbol: getSymbol(dlmmInstance.tokenX.publicKey.toBase58(), 'TOKEN_X'),
                                decimals: 6,
                            },
                            tokenY: {
                                mint: dlmmInstance.tokenY.publicKey.toBase58(),
                                symbol: getSymbol(dlmmInstance.tokenY.publicKey.toBase58(), 'TOKEN_Y'),
                                decimals: 6,
                            },
                            binStep: dlmmInstance.lbPair.binStep,
                            feeBps: 0,
                            activeBin: activeBin.binId,
                            price: Number(activeBin.price),
                            tvl: 0,
                            volume24h: 0,
                            apr: 0,
                            isActive: true,
                            lastUpdated: new Date().toISOString(),
                            validationStatus: 'warning',
                        };
                        return [3 /*break*/, 8];
                    case 7:
                        onChainError_1 = _c.sent();
                        throw new Error("Failed to fetch pool ".concat(poolAddress, ". API Error: ").concat(apiError_1 === null || apiError_1 === void 0 ? void 0 : apiError_1.message, ". On-chain Error: ").concat(onChainError_1));
                    case 8: return [3 /*break*/, 9];
                    case 9:
                        _c.trys.push([9, 15, , 16]);
                        if (!(dlmmInstance !== null && dlmmInstance !== void 0)) return [3 /*break*/, 10];
                        _a = dlmmInstance;
                        return [3 /*break*/, 12];
                    case 10: return [4 /*yield*/, this.getDlmmInstance(poolAddress)];
                    case 11:
                        _a = _c.sent();
                        _c.label = 12;
                    case 12:
                        dlmm = _a;
                        dlmmInstance = dlmm;
                        return [4 /*yield*/, dlmm.getActiveBin()];
                    case 13:
                        activeBin = _c.sent();
                        tokenXMint = dlmm.tokenX.publicKey.toBase58();
                        tokenYMint = dlmm.tokenY.publicKey.toBase58();
                        return [4 /*yield*/, Promise.all([
                                this.getTokenDecimals(tokenXMint),
                                this.getTokenDecimals(tokenYMint),
                            ])];
                    case 14:
                        _b = _c.sent(), tokenXDecimals = _b[0], tokenYDecimals = _b[1];
                        poolInfo.tokenX = {
                            mint: tokenXMint,
                            symbol: poolInfo.tokenX.symbol,
                            decimals: tokenXDecimals,
                        };
                        poolInfo.tokenY = {
                            mint: tokenYMint,
                            symbol: poolInfo.tokenY.symbol,
                            decimals: tokenYDecimals,
                        };
                        poolInfo.activeBin = activeBin.binId;
                        poolInfo.price = this.calculateBinPrice(activeBin.binId, dlmm.lbPair.binStep, tokenXDecimals, tokenYDecimals);
                        return [3 /*break*/, 16];
                    case 15:
                        err_1 = _c.sent();
                        console.warn("\u26A0\uFE0F Failed to refresh on-chain data for ".concat(poolAddress, ": ").concat(err_1));
                        if ((!poolInfo.price || poolInfo.price === 0) && poolInfo.activeBin !== undefined && poolInfo.binStep) {
                            poolInfo.price = this.calculateBinPrice(poolInfo.activeBin, poolInfo.binStep, poolInfo.tokenX.decimals, poolInfo.tokenY.decimals);
                        }
                        return [3 /*break*/, 16];
                    case 16: return [2 /*return*/, poolInfo];
                    case 17:
                        error_6 = _c.sent();
                        throw new Error("Failed to search pool by address: ".concat(error_6));
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get pool information (Alias for searchPoolByAddress)
     */
    PoolService.prototype.getPoolInfo = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.searchPoolByAddress(poolAddress)];
            });
        });
    };
    /**
     * Search pools by token symbols or names
     */
    PoolService.prototype.searchPools = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var allPools, filtered, error_7;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.fetchAllPools()];
                    case 1:
                        allPools = _a.sent();
                        filtered = allPools.filter(function (pool) {
                            var _a;
                            var name = ((_a = pool.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                            var queryLower = query.toLowerCase();
                            return name.includes(queryLower);
                        });
                        return [2 /*return*/, filtered.map(function (pool) { return _this.transformPoolData(pool); })];
                    case 2:
                        error_7 = _a.sent();
                        throw new Error("Failed to search pools: ".concat(error_7));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get top pools by TVL
     */
    PoolService.prototype.getTopPoolsByTVL = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var allPools, sorted, top_1, error_8;
            var _this = this;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.fetchAllPools()];
                    case 1:
                        allPools = _a.sent();
                        sorted = allPools.sort(function (a, b) { return (b.tvl || 0) - (a.tvl || 0); });
                        top_1 = sorted.slice(0, limit);
                        return [2 /*return*/, top_1.map(function (pool) { return _this.transformPoolData(pool); })];
                    case 2:
                        error_8 = _a.sent();
                        throw new Error("Failed to get top pools: ".concat(error_8));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get top pools by APR
     */
    PoolService.prototype.getTopPoolsByAPR = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var allPools, sorted, top_2, error_9;
            var _this = this;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.fetchAllPools()];
                    case 1:
                        allPools = _a.sent();
                        sorted = allPools.sort(function (a, b) { return (b.apr || 0) - (a.apr || 0); });
                        top_2 = sorted.slice(0, limit);
                        return [2 /*return*/, top_2.map(function (pool) { return _this.transformPoolData(pool); })];
                    case 2:
                        error_9 = _a.sent();
                        throw new Error("Failed to get top pools by APR: ".concat(error_9));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate bin price from bin ID
     */
    PoolService.prototype.calculateBinPrice = function (binId, binStep, tokenXDecimals, tokenYDecimals) {
        if (tokenXDecimals === void 0) { tokenXDecimals = 6; }
        if (tokenYDecimals === void 0) { tokenYDecimals = 6; }
        var rawPrice = Math.pow(1 + binStep / 10000, binId);
        var decimalAdjustment = Math.pow(10, tokenXDecimals - tokenYDecimals);
        return rawPrice * decimalAdjustment;
    };
    /**
     * Get price range for bins
     */
    PoolService.prototype.getPriceRange = function (minBinId, maxBinId, binStep, tokenXDecimals, tokenYDecimals) {
        if (tokenXDecimals === void 0) { tokenXDecimals = 6; }
        if (tokenYDecimals === void 0) { tokenYDecimals = 6; }
        return {
            minPrice: this.calculateBinPrice(minBinId, binStep, tokenXDecimals, tokenYDecimals),
            maxPrice: this.calculateBinPrice(maxBinId, binStep, tokenXDecimals, tokenYDecimals),
            centerPrice: this.calculateBinPrice(Math.floor((minBinId + maxBinId) / 2), binStep, tokenXDecimals, tokenYDecimals),
        };
    };
    /**
     * Calculate APR from pool data
     */
    PoolService.prototype.calculateApr = function (fees24h, tvl) {
        if (tvl === 0)
            return 0;
        return (fees24h * 365) / tvl * 100;
    };
    /**
     * Validate pool address
     */
    PoolService.prototype.validatePool = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var pubkey, error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        pubkey = new web3_js_1.PublicKey(poolAddress);
                        return [4 /*yield*/, this.fetchPoolByAddress(poolAddress)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_10 = _a.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get pools by token pair
     */
    PoolService.prototype.getPoolsByTokenPair = function (token1, token2) {
        return __awaiter(this, void 0, void 0, function () {
            var allPools, filtered, error_11;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.fetchAllPools()];
                    case 1:
                        allPools = _a.sent();
                        filtered = allPools.filter(function (pool) {
                            var _a;
                            var name = ((_a = pool.name) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || '';
                            var pair = "".concat(token1.toUpperCase(), "-").concat(token2.toUpperCase());
                            var reversePair = "".concat(token2.toUpperCase(), "-").concat(token1.toUpperCase());
                            return name === pair || name === reversePair;
                        });
                        return [2 /*return*/, filtered.map(function (pool) { return _this.transformPoolData(pool); })];
                    case 2:
                        error_11 = _a.sent();
                        throw new Error("Failed to get pools by token pair: ".concat(error_11));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get pool statistics
     */
    PoolService.prototype.getPoolStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var allPools, totalPools, totalTVL, averageAPR, topByTVL, topByAPR, topPoolByTVL, topPoolByAPR, error_12;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.fetchAllPools()];
                    case 1:
                        allPools = _a.sent();
                        totalPools = allPools.length;
                        totalTVL = allPools.reduce(function (sum, pool) { return sum + (pool.tvl || 0); }, 0);
                        averageAPR = allPools.length > 0
                            ? allPools.reduce(function (sum, pool) { return sum + (pool.apr || 0); }, 0) / allPools.length
                            : 0;
                        topByTVL = allPools.reduce(function (max, pool) {
                            return (pool.tvl || 0) > (max.tvl || 0) ? pool : max;
                        }, allPools[0] || null);
                        topByAPR = allPools.reduce(function (max, pool) {
                            return (pool.apr || 0) > (max.apr || 0) ? pool : max;
                        }, allPools[0] || null);
                        topPoolByTVL = topByTVL ? this.transformPoolData(topByTVL) : null;
                        topPoolByAPR = topByAPR ? this.transformPoolData(topByAPR) : null;
                        return [2 /*return*/, {
                                totalPools: totalPools,
                                totalTVL: totalTVL,
                                averageAPR: averageAPR,
                                topPoolByTVL: topPoolByTVL,
                                topPoolByAPR: topPoolByAPR,
                            }];
                    case 2:
                        error_12 = _a.sent();
                        throw new Error("Failed to get pool statistics: ".concat(error_12));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return PoolService;
}());
exports.PoolService = PoolService;
// Export singleton instance
exports.poolService = new PoolService();
