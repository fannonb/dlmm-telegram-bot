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
exports.feeService = exports.FeeService = void 0;
var web3_js_1 = require("@solana/web3.js");
var anchor_1 = require("@coral-xyz/anchor");
var wallet_service_1 = require("./wallet.service");
var pool_service_1 = require("./pool.service");
var connection_service_1 = require("./connection.service");
var oracle_service_1 = require("./oracle.service");
var analyticsDataStore_service_1 = require("./analyticsDataStore.service");
var SOL_MINT = 'So11111111111111111111111111111111111111112';
var DEFAULT_CLAIM_TX_COST_SOL = 0.00025;
var DEFAULT_MAX_RETRIES = 2;
var RETRY_BACKOFF_MS = 750;
var FeeService = /** @class */ (function () {
    function FeeService() {
    }
    FeeService.prototype.safeGetPoolInfo = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(poolAddress)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_1 = _a.sent();
                        console.warn("Pool metadata unavailable for ".concat(poolAddress, ":"), error_1);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    FeeService.prototype.extractDecimals = function (tokenMeta) {
        var _a;
        if (!tokenMeta) {
            return undefined;
        }
        if (typeof tokenMeta.decimals === 'number') {
            return tokenMeta.decimals;
        }
        if (typeof ((_a = tokenMeta === null || tokenMeta === void 0 ? void 0 : tokenMeta.mint) === null || _a === void 0 ? void 0 : _a.decimals) === 'number') {
            return tokenMeta.mint.decimals;
        }
        if (typeof (tokenMeta === null || tokenMeta === void 0 ? void 0 : tokenMeta.decimal) === 'number') {
            return tokenMeta.decimal;
        }
        return undefined;
    };
    FeeService.prototype.extractMint = function (tokenMeta) {
        var _a, _b, _c, _d;
        if (!tokenMeta) {
            return '';
        }
        if (typeof tokenMeta.address === 'string') {
            return tokenMeta.address;
        }
        if (typeof ((_a = tokenMeta === null || tokenMeta === void 0 ? void 0 : tokenMeta.mint) === null || _a === void 0 ? void 0 : _a.toBase58) === 'function') {
            return tokenMeta.mint.toBase58();
        }
        if (typeof ((_c = (_b = tokenMeta === null || tokenMeta === void 0 ? void 0 : tokenMeta.mint) === null || _b === void 0 ? void 0 : _b.publicKey) === null || _c === void 0 ? void 0 : _c.toBase58) === 'function') {
            return tokenMeta.mint.publicKey.toBase58();
        }
        if (typeof (tokenMeta === null || tokenMeta === void 0 ? void 0 : tokenMeta.mint) === 'string') {
            return tokenMeta.mint;
        }
        if (typeof ((_d = tokenMeta === null || tokenMeta === void 0 ? void 0 : tokenMeta.publicKey) === null || _d === void 0 ? void 0 : _d.toBase58) === 'function') {
            return tokenMeta.publicKey.toBase58();
        }
        return '';
    };
    FeeService.prototype.extractSymbol = function (tokenMeta) {
        var _a;
        if (!tokenMeta) {
            return undefined;
        }
        if (typeof tokenMeta.symbol === 'string') {
            return tokenMeta.symbol;
        }
        if (typeof ((_a = tokenMeta === null || tokenMeta === void 0 ? void 0 : tokenMeta.mint) === null || _a === void 0 ? void 0 : _a.symbol) === 'string') {
            return tokenMeta.mint.symbol;
        }
        return undefined;
    };
    FeeService.prototype.extractFeeAmount = function (position, field) {
        var _a, _b;
        var data = (_a = position === null || position === void 0 ? void 0 : position.positionData) !== null && _a !== void 0 ? _a : position;
        if (!data) {
            return 0;
        }
        var raw = data[field];
        if (raw === undefined && data.unclaimedFeeX && field === 'feeX') {
            raw = data.unclaimedFeeX;
        }
        if (raw === undefined && data.unclaimedFeeY && field === 'feeY') {
            raw = data.unclaimedFeeY;
        }
        if (raw === undefined && ((_b = data === null || data === void 0 ? void 0 : data.positionData) === null || _b === void 0 ? void 0 : _b[field])) {
            raw = data.positionData[field];
        }
        if (!raw) {
            return 0;
        }
        if (anchor_1.BN.isBN(raw)) {
            return raw.toNumber();
        }
        if (typeof raw === 'string') {
            return Number(raw);
        }
        if (typeof raw === 'number') {
            return raw;
        }
        if (typeof raw.toNumber === 'function') {
            return raw.toNumber();
        }
        return 0;
    };
    FeeService.prototype.deriveUsdBreakdown = function (params) {
        var tokenXPrice = params.tokenXPrice, tokenYPrice = params.tokenYPrice;
        var sources = {
            tokenX: tokenXPrice ? 'oracle' : 'missing',
            tokenY: tokenYPrice ? 'oracle' : 'missing',
        };
        if (!tokenXPrice && tokenYPrice && params.poolPrice) {
            tokenXPrice = params.poolPrice * tokenYPrice;
            sources.tokenX = 'pool-derived';
        }
        if (!tokenYPrice && tokenXPrice && params.poolPrice) {
            tokenYPrice = params.poolPrice !== 0 ? tokenXPrice / params.poolPrice : null;
            if (tokenYPrice !== null) {
                sources.tokenY = 'pool-derived';
            }
        }
        return {
            tokenXPrice: tokenXPrice !== null && tokenXPrice !== void 0 ? tokenXPrice : null,
            tokenYPrice: tokenYPrice !== null && tokenYPrice !== void 0 ? tokenYPrice : null,
            tokenXSource: sources.tokenX,
            tokenYSource: sources.tokenY,
        };
    };
    FeeService.prototype.recordFeeClaim = function (summary) {
        var _a;
        try {
            analyticsDataStore_service_1.analyticsDataStore.recordFeeClaim({
                timestamp: summary.recordedAt,
                positionAddress: summary.positionAddress,
                poolAddress: summary.poolAddress,
                claimedX: summary.claimedX,
                claimedY: summary.claimedY,
                claimedUsd: summary.claimedUsd,
                transactionCostUsd: (_a = summary.estimatedTxCostUsd) !== null && _a !== void 0 ? _a : 0,
                method: summary.method,
                signature: summary.signatures[summary.signatures.length - 1],
            });
        }
        catch (error) {
            console.warn('Failed to record fee claim analytics:', error);
        }
    };
    FeeService.prototype.delay = function (ms) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (ms <= 0) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, ms); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Claim all fees and rewards for all positions in a specific pool
     */
    FeeService.prototype.claimAllFees = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var keypair, dlmm, userPositions, requests, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        keypair = wallet_service_1.walletService.getActiveKeypair();
                        if (!keypair)
                            throw new Error('No active wallet found');
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolAddress)];
                    case 1:
                        dlmm = _a.sent();
                        return [4 /*yield*/, dlmm.getPositionsByUserAndLbPair(keypair.publicKey)];
                    case 2:
                        userPositions = (_a.sent()).userPositions;
                        if (userPositions.length === 0) {
                            return [2 /*return*/, []];
                        }
                        requests = userPositions.map(function (pos) { return ({
                            poolAddress: poolAddress,
                            positionAddress: pos.publicKey.toBase58(),
                        }); });
                        return [2 /*return*/, this.claimFeesBatch(requests)];
                    case 3:
                        error_2 = _a.sent();
                        console.error('Error claiming all fees:', error_2);
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Claim fees for a specific position
     */
    FeeService.prototype.claimFeesForPosition = function (poolAddress, positionPubKey, options) {
        return __awaiter(this, void 0, void 0, function () {
            var keypair, method, dlmm, position, poolInfo, tokenXDecimals, tokenYDecimals, tokenXMint, tokenYMint, tokenXSymbol, tokenYSymbol, feeXAmount, feeYAmount, claimedX, claimedY, priceMap, poolPrice, usdBreakdown, claimedUsd, txs, connection, signatures, _i, txs_1, tx, sig, estimatedTxCostSol, solUsd, estimatedTxCostUsd, summary, error_3;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            return __generator(this, function (_s) {
                switch (_s.label) {
                    case 0:
                        _s.trys.push([0, 10, , 11]);
                        keypair = wallet_service_1.walletService.getActiveKeypair();
                        if (!keypair)
                            throw new Error('No active wallet found');
                        method = (_a = options === null || options === void 0 ? void 0 : options.method) !== null && _a !== void 0 ? _a : 'manual';
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolAddress)];
                    case 1:
                        dlmm = _s.sent();
                        return [4 /*yield*/, dlmm.getPosition(positionPubKey)];
                    case 2:
                        position = _s.sent();
                        return [4 /*yield*/, this.safeGetPoolInfo(poolAddress)];
                    case 3:
                        poolInfo = _s.sent();
                        tokenXDecimals = (_c = (_b = poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.tokenX.decimals) !== null && _b !== void 0 ? _b : this.extractDecimals(dlmm.tokenX)) !== null && _c !== void 0 ? _c : 6;
                        tokenYDecimals = (_e = (_d = poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.tokenY.decimals) !== null && _d !== void 0 ? _d : this.extractDecimals(dlmm.tokenY)) !== null && _e !== void 0 ? _e : 6;
                        tokenXMint = (_f = poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.tokenX.mint) !== null && _f !== void 0 ? _f : this.extractMint(dlmm.tokenX);
                        tokenYMint = (_g = poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.tokenY.mint) !== null && _g !== void 0 ? _g : this.extractMint(dlmm.tokenY);
                        tokenXSymbol = (_j = (_h = poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.tokenX.symbol) !== null && _h !== void 0 ? _h : this.extractSymbol(dlmm.tokenX)) !== null && _j !== void 0 ? _j : 'Token X';
                        tokenYSymbol = (_l = (_k = poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.tokenY.symbol) !== null && _k !== void 0 ? _k : this.extractSymbol(dlmm.tokenY)) !== null && _l !== void 0 ? _l : 'Token Y';
                        feeXAmount = this.extractFeeAmount(position, 'feeX');
                        feeYAmount = this.extractFeeAmount(position, 'feeY');
                        claimedX = feeXAmount / Math.pow(10, tokenXDecimals);
                        claimedY = feeYAmount / Math.pow(10, tokenYDecimals);
                        return [4 /*yield*/, oracle_service_1.oracleService.getUsdPrices([tokenXMint, tokenYMint, SOL_MINT].filter(function (mint) { return !!mint; }))];
                    case 4:
                        priceMap = _s.sent();
                        poolPrice = (poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.price) && poolInfo.price > 0 ? poolInfo.price : null;
                        usdBreakdown = this.deriveUsdBreakdown({
                            tokenXMint: tokenXMint,
                            tokenYMint: tokenYMint,
                            tokenXPrice: (_m = priceMap.get(tokenXMint)) !== null && _m !== void 0 ? _m : null,
                            tokenYPrice: (_o = priceMap.get(tokenYMint)) !== null && _o !== void 0 ? _o : null,
                            poolPrice: poolPrice,
                        });
                        claimedUsd = (claimedX * ((_p = usdBreakdown.tokenXPrice) !== null && _p !== void 0 ? _p : 0)) +
                            (claimedY * ((_q = usdBreakdown.tokenYPrice) !== null && _q !== void 0 ? _q : 0));
                        return [4 /*yield*/, dlmm.claimAllRewardsByPosition({
                                owner: keypair.publicKey,
                                position: position,
                            })];
                    case 5:
                        txs = _s.sent();
                        connection = connection_service_1.connectionService.getConnection();
                        signatures = [];
                        _i = 0, txs_1 = txs;
                        _s.label = 6;
                    case 6:
                        if (!(_i < txs_1.length)) return [3 /*break*/, 9];
                        tx = txs_1[_i];
                        return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [keypair], { commitment: 'confirmed' })];
                    case 7:
                        sig = _s.sent();
                        signatures.push(sig);
                        _s.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 6];
                    case 9:
                        estimatedTxCostSol = txs.length * DEFAULT_CLAIM_TX_COST_SOL;
                        solUsd = (_r = priceMap.get(SOL_MINT)) !== null && _r !== void 0 ? _r : null;
                        estimatedTxCostUsd = solUsd ? estimatedTxCostSol * solUsd : null;
                        summary = {
                            positionAddress: positionPubKey.toBase58(),
                            poolAddress: poolAddress,
                            method: method,
                            claimedX: claimedX,
                            claimedY: claimedY,
                            claimedUsd: claimedUsd,
                            tokenXSymbol: tokenXSymbol,
                            tokenYSymbol: tokenYSymbol,
                            tokenXDecimals: tokenXDecimals,
                            tokenYDecimals: tokenYDecimals,
                            tokenXMint: tokenXMint,
                            tokenYMint: tokenYMint,
                            usdPriceSources: {
                                tokenX: usdBreakdown.tokenXSource,
                                tokenY: usdBreakdown.tokenYSource,
                            },
                            usdPrices: {
                                tokenX: usdBreakdown.tokenXPrice,
                                tokenY: usdBreakdown.tokenYPrice,
                            },
                            estimatedTxCostSol: estimatedTxCostSol,
                            estimatedTxCostUsd: estimatedTxCostUsd,
                            signatures: signatures,
                            recordedAt: Date.now(),
                        };
                        this.recordFeeClaim(summary);
                        return [2 /*return*/, summary];
                    case 10:
                        error_3 = _s.sent();
                        console.error('Error claiming fees for position:', error_3);
                        throw error_3;
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    FeeService.prototype.claimFeesBatch = function (requests) {
        return __awaiter(this, void 0, void 0, function () {
            var outcomes, _i, requests_1, request, positionAddress, poolAddress, maxRetries, attempts, summary, lastError, error_4;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        outcomes = [];
                        _i = 0, requests_1 = requests;
                        _b.label = 1;
                    case 1:
                        if (!(_i < requests_1.length)) return [3 /*break*/, 10];
                        request = requests_1[_i];
                        positionAddress = request.positionAddress;
                        poolAddress = request.poolAddress;
                        maxRetries = (_a = request.maxRetries) !== null && _a !== void 0 ? _a : DEFAULT_MAX_RETRIES;
                        attempts = 0;
                        summary = void 0;
                        lastError = null;
                        _b.label = 2;
                    case 2:
                        if (!(attempts <= maxRetries)) return [3 /*break*/, 8];
                        attempts += 1;
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 7]);
                        return [4 /*yield*/, this.claimFeesForPosition(poolAddress, new web3_js_1.PublicKey(positionAddress), { method: request.method })];
                    case 4:
                        summary = _b.sent();
                        return [3 /*break*/, 8];
                    case 5:
                        error_4 = _b.sent();
                        lastError = error_4;
                        if (attempts > maxRetries) {
                            return [3 /*break*/, 8];
                        }
                        return [4 /*yield*/, this.delay(RETRY_BACKOFF_MS * attempts)];
                    case 6:
                        _b.sent();
                        return [3 /*break*/, 7];
                    case 7: return [3 /*break*/, 2];
                    case 8:
                        if (summary) {
                            outcomes.push({
                                poolAddress: poolAddress,
                                positionAddress: positionAddress,
                                success: true,
                                attempts: attempts,
                                summary: summary,
                            });
                        }
                        else {
                            outcomes.push({
                                poolAddress: poolAddress,
                                positionAddress: positionAddress,
                                success: false,
                                attempts: attempts,
                                error: lastError instanceof Error ? lastError.message : String(lastError),
                            });
                        }
                        _b.label = 9;
                    case 9:
                        _i++;
                        return [3 /*break*/, 1];
                    case 10: return [2 /*return*/, outcomes];
                }
            });
        });
    };
    FeeService.prototype.estimateClaimCost = function (positionCount) {
        return __awaiter(this, void 0, void 0, function () {
            var totalSol, priceMap, solUsd;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        totalSol = Math.max(positionCount, 0) * DEFAULT_CLAIM_TX_COST_SOL;
                        return [4 /*yield*/, oracle_service_1.oracleService.getUsdPrices([SOL_MINT])];
                    case 1:
                        priceMap = _b.sent();
                        solUsd = (_a = priceMap.get(SOL_MINT)) !== null && _a !== void 0 ? _a : null;
                        return [2 /*return*/, {
                                totalSol: totalSol,
                                totalUsd: solUsd ? totalSol * solUsd : null,
                            }];
                }
            });
        });
    };
    /**
     * Calculate estimated costs and APR for a new position
     */
    FeeService.prototype.analyzePositionCosts = function (poolInfo, tokenXAmount, tokenYAmount) {
        return __awaiter(this, void 0, void 0, function () {
            var rentCostSOL, transactionFeesSOL, totalInitialCostSOL, tokenXMint, tokenYMint, usdPrices, tokenXUsdPrice, tokenYUsdPrice, priceSources, valuationWarnings, poolPrice, hasFullOracleCoverage, isUsdEstimate, tokenXValueUSD, tokenYValueUSD, totalValueUSD, baseAPR, estimatedDailyAPY, estimatedWeeklyAPY, estimatedMonthlyAPY, estimatedAnnualAPY, error_5;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        rentCostSOL = 0.06;
                        transactionFeesSOL = 0.00025;
                        totalInitialCostSOL = rentCostSOL + transactionFeesSOL;
                        tokenXMint = poolInfo.tokenX.mint;
                        tokenYMint = poolInfo.tokenY.mint;
                        return [4 /*yield*/, oracle_service_1.oracleService.getUsdPrices([tokenXMint, tokenYMint])];
                    case 1:
                        usdPrices = _c.sent();
                        tokenXUsdPrice = (_a = usdPrices.get(tokenXMint)) !== null && _a !== void 0 ? _a : null;
                        tokenYUsdPrice = (_b = usdPrices.get(tokenYMint)) !== null && _b !== void 0 ? _b : null;
                        priceSources = {
                            tokenX: tokenXUsdPrice !== null ? 'oracle' : 'missing',
                            tokenY: tokenYUsdPrice !== null ? 'oracle' : 'missing',
                        };
                        valuationWarnings = [];
                        poolPrice = poolInfo.price && poolInfo.price > 0 ? poolInfo.price : null;
                        if (!tokenXUsdPrice && tokenYUsdPrice && poolPrice) {
                            tokenXUsdPrice = poolPrice * tokenYUsdPrice;
                            priceSources.tokenX = 'pool-derived';
                        }
                        if (!tokenYUsdPrice && tokenXUsdPrice && poolPrice) {
                            tokenYUsdPrice = poolPrice !== 0 ? tokenXUsdPrice / poolPrice : null;
                            priceSources.tokenY = tokenYUsdPrice ? 'pool-derived' : 'missing';
                        }
                        if (!tokenXUsdPrice) {
                            valuationWarnings.push("Missing USD quote for ".concat(poolInfo.tokenX.symbol, ". Value may be understated."));
                        }
                        else if (priceSources.tokenX !== 'oracle') {
                            valuationWarnings.push("Using derived price for ".concat(poolInfo.tokenX.symbol, "; oracle unavailable."));
                        }
                        if (!tokenYUsdPrice) {
                            valuationWarnings.push("Missing USD quote for ".concat(poolInfo.tokenY.symbol, ". Value may be understated."));
                        }
                        else if (priceSources.tokenY !== 'oracle') {
                            valuationWarnings.push("Using derived price for ".concat(poolInfo.tokenY.symbol, "; oracle unavailable."));
                        }
                        hasFullOracleCoverage = priceSources.tokenX === 'oracle' && priceSources.tokenY === 'oracle';
                        isUsdEstimate = !hasFullOracleCoverage;
                        tokenXValueUSD = tokenXUsdPrice ? tokenXAmount * tokenXUsdPrice : 0;
                        tokenYValueUSD = tokenYUsdPrice ? tokenYAmount * tokenYUsdPrice : 0;
                        totalValueUSD = tokenXValueUSD + tokenYValueUSD;
                        baseAPR = poolInfo.apr || 12;
                        estimatedDailyAPY = baseAPR / 365;
                        estimatedWeeklyAPY = baseAPR / 52;
                        estimatedMonthlyAPY = baseAPR / 12;
                        estimatedAnnualAPY = baseAPR;
                        return [2 /*return*/, {
                                rentCostSOL: rentCostSOL,
                                transactionFeesSOL: transactionFeesSOL,
                                totalInitialCostSOL: totalInitialCostSOL,
                                tokenXAmount: tokenXAmount,
                                tokenYAmount: tokenYAmount,
                                tokenXValueUSD: tokenXValueUSD,
                                tokenYValueUSD: tokenYValueUSD,
                                totalValueUSD: totalValueUSD,
                                tokenXUsdPrice: tokenXUsdPrice,
                                tokenYUsdPrice: tokenYUsdPrice,
                                usdPriceSources: priceSources,
                                hasFullOracleCoverage: hasFullOracleCoverage,
                                isUsdEstimate: isUsdEstimate,
                                usdValuationWarnings: valuationWarnings,
                                estimatedDailyAPY: estimatedDailyAPY,
                                estimatedWeeklyAPY: estimatedWeeklyAPY,
                                estimatedMonthlyAPY: estimatedMonthlyAPY,
                                estimatedAnnualAPY: estimatedAnnualAPY,
                            }];
                    case 2:
                        error_5 = _c.sent();
                        console.error('Error analyzing position costs:', error_5);
                        throw new Error("Failed to analyze costs: ".concat(error_5));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return FeeService;
}());
exports.FeeService = FeeService;
exports.feeService = new FeeService();
