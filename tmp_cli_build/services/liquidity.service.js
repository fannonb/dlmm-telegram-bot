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
exports.liquidityService = exports.LiquidityService = void 0;
var web3_js_1 = require("@solana/web3.js");
var dlmm_1 = require("@meteora-ag/dlmm");
var anchor_1 = require("@coral-xyz/anchor");
var connection_service_1 = require("./connection.service");
var pool_service_1 = require("./pool.service");
var wallet_service_1 = require("./wallet.service");
var dlmm_math_1 = require("../utils/dlmm-math");
var oracle_service_1 = require("./oracle.service");
var LiquidityService = /** @class */ (function () {
    function LiquidityService() {
    }
    /**
     * Add liquidity to an existing position
     */
    LiquidityService.prototype.addLiquidity = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var positionPubKey, poolAddress, amountX, amountY, strategyType, slippage, keypair, dlmm, position, minBinId, maxBinId, tx, connection, signature, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        positionPubKey = params.positionPubKey, poolAddress = params.poolAddress, amountX = params.amountX, amountY = params.amountY, strategyType = params.strategyType, slippage = params.slippage;
                        keypair = wallet_service_1.walletService.getActiveKeypair();
                        if (!keypair)
                            throw new Error('No active wallet found');
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolAddress)];
                    case 1:
                        dlmm = _a.sent();
                        return [4 /*yield*/, dlmm.getPosition(positionPubKey)];
                    case 2:
                        position = _a.sent();
                        minBinId = position.positionData.lowerBinId;
                        maxBinId = position.positionData.upperBinId;
                        return [4 /*yield*/, dlmm.addLiquidityByStrategy({
                                positionPubKey: positionPubKey,
                                user: keypair.publicKey,
                                totalXAmount: amountX,
                                totalYAmount: amountY,
                                strategy: {
                                    maxBinId: maxBinId,
                                    minBinId: minBinId,
                                    strategyType: strategyType
                                },
                                slippage: slippage
                            })];
                    case 3:
                        tx = _a.sent();
                        connection = connection_service_1.connectionService.getConnection();
                        return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [keypair], { commitment: 'confirmed' })];
                    case 4:
                        signature = _a.sent();
                        return [2 /*return*/, signature];
                    case 5:
                        error_1 = _a.sent();
                        console.error('Error adding liquidity:', error_1);
                        throw error_1;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Remove liquidity from a position
     */
    LiquidityService.prototype.removeLiquidity = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var positionPubKey, poolAddress, userPublicKey, bps, shouldClaimAndClose, keypair, dlmm, position, lowerBinId, upperBinId, txs, connection, signatures, _i, txs_1, tx, sig, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 8, , 9]);
                        positionPubKey = params.positionPubKey, poolAddress = params.poolAddress, userPublicKey = params.userPublicKey, bps = params.bps, shouldClaimAndClose = params.shouldClaimAndClose;
                        keypair = wallet_service_1.walletService.getActiveKeypair();
                        if (!keypair)
                            throw new Error('No active wallet found');
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolAddress)];
                    case 1:
                        dlmm = _a.sent();
                        return [4 /*yield*/, dlmm.getPosition(positionPubKey)];
                    case 2:
                        position = _a.sent();
                        lowerBinId = position.positionData.lowerBinId;
                        upperBinId = position.positionData.upperBinId;
                        return [4 /*yield*/, dlmm.removeLiquidity({
                                position: positionPubKey,
                                user: userPublicKey,
                                fromBinId: lowerBinId,
                                toBinId: upperBinId,
                                bps: new anchor_1.BN(bps),
                                shouldClaimAndClose: shouldClaimAndClose || false
                            })];
                    case 3:
                        txs = _a.sent();
                        connection = connection_service_1.connectionService.getConnection();
                        signatures = [];
                        _i = 0, txs_1 = txs;
                        _a.label = 4;
                    case 4:
                        if (!(_i < txs_1.length)) return [3 /*break*/, 7];
                        tx = txs_1[_i];
                        return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [keypair], { commitment: 'confirmed' })];
                    case 5:
                        sig = _a.sent();
                        signatures.push(sig);
                        _a.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7: return [2 /*return*/, signatures];
                    case 8:
                        error_2 = _a.sent();
                        console.error('Error removing liquidity:', error_2);
                        throw error_2;
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Close a position
     */
    LiquidityService.prototype.closePosition = function (poolAddress, positionPubKey) {
        return __awaiter(this, void 0, void 0, function () {
            var keypair, dlmm, position, tx, connection, signature, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        keypair = wallet_service_1.walletService.getActiveKeypair();
                        if (!keypair)
                            throw new Error('No active wallet found');
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolAddress)];
                    case 1:
                        dlmm = _a.sent();
                        return [4 /*yield*/, dlmm.getPosition(positionPubKey)];
                    case 2:
                        position = _a.sent();
                        return [4 /*yield*/, dlmm.closePosition({
                                owner: keypair.publicKey,
                                position: position
                            })];
                    case 3:
                        tx = _a.sent();
                        connection = connection_service_1.connectionService.getConnection();
                        return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [keypair], { commitment: 'confirmed' })];
                    case 4:
                        signature = _a.sent();
                        return [2 /*return*/, signature];
                    case 5:
                        error_3 = _a.sent();
                        console.error('Error closing position:', error_3);
                        throw error_3;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate optimal Y amount based on strategy and X amount
     * Handles price calculation from multiple sources for reliability
     */
    LiquidityService.prototype.calculateOptimalYAmount = function (poolAddress, amountX, minBinId, maxBinId, strategyType) {
        return __awaiter(this, void 0, void 0, function () {
            var dlmm, activeBin, poolInfo, xDecimals, yDecimals, poolPrice, oraclePrice, finalPrice, isUsingOracle, deviation, robustYAmount, activeBinXAmount, activeBinYAmount, totalXAmount, amountXInActiveBin, amountYInActiveBin, totalYAmount, yAmountDecimal, sdkDev, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolAddress)];
                    case 1:
                        dlmm = _a.sent();
                        return [4 /*yield*/, dlmm.getActiveBin()];
                    case 2:
                        activeBin = _a.sent();
                        return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(poolAddress)];
                    case 3:
                        poolInfo = _a.sent();
                        xDecimals = poolInfo.tokenX.decimals || 6;
                        yDecimals = poolInfo.tokenY.decimals || 6;
                        poolPrice = pool_service_1.poolService.calculateBinPrice(activeBin.binId, dlmm.lbPair.binStep, xDecimals, yDecimals);
                        return [4 /*yield*/, oracle_service_1.oracleService.getPriceRatio(poolInfo.tokenX.mint, poolInfo.tokenY.mint)];
                    case 4:
                        oraclePrice = _a.sent();
                        finalPrice = poolPrice;
                        isUsingOracle = false;
                        if (oraclePrice) {
                            deviation = Math.abs((poolPrice - oraclePrice) / oraclePrice);
                            // If deviation is > 50%, assume pool is imbalanced/broken and use Oracle
                            if (deviation > 0.5) {
                                console.warn("Significant price deviation detected! Pool: ".concat(poolPrice.toFixed(6), ", Oracle: ").concat(oraclePrice.toFixed(6), ". Using Oracle price."));
                                finalPrice = oraclePrice;
                                isUsingOracle = true;
                            }
                        }
                        robustYAmount = 0;
                        try {
                            activeBinXAmount = activeBin.xAmount ? Number(activeBin.xAmount) / Math.pow(10, xDecimals) : undefined;
                            activeBinYAmount = activeBin.yAmount ? Number(activeBin.yAmount) / Math.pow(10, yDecimals) : undefined;
                            robustYAmount = dlmm_math_1.DlmmMath.calculateYAmountFromBinSpread(amountX, minBinId, maxBinId, activeBin.binId, dlmm.lbPair.binStep, strategyType, activeBinXAmount, activeBinYAmount, xDecimals, yDecimals);
                        }
                        catch (e) {
                            console.warn('Error calculating robust Y amount:', e);
                        }
                        // If we are using Oracle (broken pool), trust the robust calculation over everything else
                        // UNLESS the robust calculation failed (returned 0 when it shouldn't have)
                        if (isUsingOracle && robustYAmount > 0) {
                            console.warn('Using robust bin-based calculation due to Oracle deviation.');
                            return [2 /*return*/, robustYAmount];
                        }
                        // For Spot strategy: 50/50 distribution by VALUE
                        if (strategyType === dlmm_1.StrategyType.Spot) {
                            // If robust calculation worked, use it. It's more accurate than amountX * price
                            if (robustYAmount > 0)
                                return [2 /*return*/, robustYAmount];
                            return [2 /*return*/, amountX * finalPrice];
                        }
                        // For Curve and BidAsk strategies
                        // If we are using Oracle price (meaning pool is broken), we CANNOT trust SDK's autoFillYByStrategy
                        // because it relies on the broken pool state.
                        if (!isUsingOracle) {
                            try {
                                totalXAmount = new anchor_1.BN(amountX * Math.pow(10, xDecimals));
                                amountXInActiveBin = activeBin.xAmount || new anchor_1.BN(0);
                                amountYInActiveBin = activeBin.yAmount || new anchor_1.BN(0);
                                totalYAmount = (0, dlmm_1.autoFillYByStrategy)(activeBin.binId, dlmm.lbPair.binStep, totalXAmount, amountXInActiveBin, amountYInActiveBin, minBinId, maxBinId, strategyType);
                                yAmountDecimal = totalYAmount.toNumber() / Math.pow(10, yDecimals);
                                // SANITY CHECK: If SDK result deviates significantly from robust calculation
                                // Only check strictly for Spot-like strategies or if deviation is extreme
                                if (robustYAmount > 0) {
                                    sdkDev = Math.abs((yAmountDecimal - robustYAmount) / robustYAmount);
                                    // Allow more deviation for Curve/BidAsk (0.5 instead of 0.25)
                                    if (sdkDev > 0.5) {
                                        console.warn("SDK calculation suspicious! SDK: ".concat(yAmountDecimal.toFixed(6), ", Robust: ").concat(robustYAmount.toFixed(6)));
                                        console.warn("Using robust bin-based calculation instead.");
                                        return [2 /*return*/, robustYAmount];
                                    }
                                }
                                return [2 /*return*/, yAmountDecimal];
                            }
                            catch (sdkError) {
                                console.warn('SDK calculation failed for', strategyType, ', using price fallback');
                            }
                        }
                        else {
                            console.warn('Skipping SDK strategy calculation due to price deviation. Using Robust/Oracle-based estimate.');
                            if (robustYAmount > 0)
                                return [2 /*return*/, robustYAmount];
                        }
                        // Fallback (used if SDK fails OR if we forced Oracle price and robust failed)
                        return [2 /*return*/, amountX * finalPrice];
                    case 5:
                        error_4 = _a.sent();
                        console.error('Error calculating optimal Y amount:', error_4);
                        throw new Error("Failed to calculate optimal Y amount: ".concat(error_4));
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if the pool price is healthy compared to Oracle
     */
    LiquidityService.prototype.checkPriceHealth = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var dlmm, activeBin, poolInfo, xDecimals, yDecimals, poolPrice, oraclePrice, deviation, isHealthy, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolAddress)];
                    case 1:
                        dlmm = _a.sent();
                        return [4 /*yield*/, dlmm.getActiveBin()];
                    case 2:
                        activeBin = _a.sent();
                        return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(poolAddress)];
                    case 3:
                        poolInfo = _a.sent();
                        xDecimals = poolInfo.tokenX.decimals || 6;
                        yDecimals = poolInfo.tokenY.decimals || 6;
                        poolPrice = pool_service_1.poolService.calculateBinPrice(activeBin.binId, dlmm.lbPair.binStep, xDecimals, yDecimals);
                        return [4 /*yield*/, oracle_service_1.oracleService.getPriceRatio(poolInfo.tokenX.mint, poolInfo.tokenY.mint)];
                    case 4:
                        oraclePrice = _a.sent();
                        deviation = 0;
                        isHealthy = true;
                        if (oraclePrice) {
                            deviation = Math.abs((poolPrice - oraclePrice) / oraclePrice);
                            if (deviation > 0.5) {
                                isHealthy = false;
                            }
                        }
                        return [2 /*return*/, {
                                isHealthy: isHealthy,
                                poolPrice: poolPrice,
                                oraclePrice: oraclePrice,
                                deviation: deviation,
                            }];
                    case 5:
                        error_5 = _a.sent();
                        console.warn('Error checking price health:', error_5);
                        return [2 /*return*/, { isHealthy: true, poolPrice: 0, oraclePrice: null, deviation: 0 }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return LiquidityService;
}());
exports.LiquidityService = LiquidityService;
exports.liquidityService = new LiquidityService();
