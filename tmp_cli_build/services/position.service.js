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
exports.positionService = exports.PositionService = void 0;
var web3_js_1 = require("@solana/web3.js");
var dlmm_1 = require("@meteora-ag/dlmm");
var connection_service_1 = require("./connection.service");
var pool_service_1 = require("./pool.service");
var wallet_service_1 = require("./wallet.service");
var price_service_1 = require("./price.service");
var anchor_1 = require("@coral-xyz/anchor");
var PositionService = /** @class */ (function () {
    function PositionService() {
    }
    /**
     * Get all positions for a specific user across all pools
     */
    PositionService.prototype.getAllPositions = function (userPublicKey) {
        return __awaiter(this, void 0, void 0, function () {
            var connection, user, positionsMap, userPositions, _i, _a, _b, lbPairAddr, positionInfo, lbPairPositions, activeId, tokenXSymbol, tokenYSymbol, tokenXDecimals, tokenYDecimals, tokenXPrice, tokenYPrice, tokenXReserve, tokenYReserve, poolMetadata, names, activeId_1, binStep_1, priceXInY, e_1, binStep, poolApr, _c, lbPairPositions_1, pos, error_1;
            var _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        _j.trys.push([0, 12, , 13]);
                        connection = connection_service_1.connectionService.getConnection();
                        user = new web3_js_1.PublicKey(userPublicKey);
                        return [4 /*yield*/, dlmm_1.default.getAllLbPairPositionsByUser(connection, user)];
                    case 1:
                        positionsMap = _j.sent();
                        userPositions = [];
                        _i = 0, _a = positionsMap.entries();
                        _j.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 11];
                        _b = _a[_i], lbPairAddr = _b[0], positionInfo = _b[1];
                        lbPairPositions = positionInfo.lbPairPositionsData;
                        activeId = positionInfo.lbPair.activeId;
                        tokenXSymbol = 'Unknown';
                        tokenYSymbol = 'Unknown';
                        tokenXDecimals = 6;
                        tokenYDecimals = 6;
                        tokenXPrice = 0;
                        tokenYPrice = 0;
                        tokenXReserve = positionInfo.tokenX;
                        tokenYReserve = positionInfo.tokenY;
                        if (typeof ((_d = tokenXReserve === null || tokenXReserve === void 0 ? void 0 : tokenXReserve.mint) === null || _d === void 0 ? void 0 : _d.decimals) === 'number') {
                            tokenXDecimals = tokenXReserve.mint.decimals;
                        }
                        else if (typeof (tokenXReserve === null || tokenXReserve === void 0 ? void 0 : tokenXReserve.decimal) === 'number') {
                            tokenXDecimals = tokenXReserve.decimal;
                        }
                        if (typeof ((_e = tokenYReserve === null || tokenYReserve === void 0 ? void 0 : tokenYReserve.mint) === null || _e === void 0 ? void 0 : _e.decimals) === 'number') {
                            tokenYDecimals = tokenYReserve.mint.decimals;
                        }
                        else if (typeof (tokenYReserve === null || tokenYReserve === void 0 ? void 0 : tokenYReserve.decimal) === 'number') {
                            tokenYDecimals = tokenYReserve.decimal;
                        }
                        poolMetadata = null;
                        _j.label = 3;
                    case 3:
                        _j.trys.push([3, 8, , 9]);
                        return [4 /*yield*/, pool_service_1.poolService.fetchPoolByAddress(lbPairAddr)];
                    case 4:
                        // Optimization: fetch basic info from our pool service (which caches API results)
                        poolMetadata = _j.sent();
                        if (!poolMetadata) return [3 /*break*/, 7];
                        names = poolMetadata.name.split('-');
                        tokenXSymbol = names[0];
                        tokenYSymbol = names[1];
                        return [4 /*yield*/, price_service_1.priceService.getTokenPrice(poolMetadata.mint_x)];
                    case 5:
                        tokenXPrice = _j.sent();
                        return [4 /*yield*/, price_service_1.priceService.getTokenPrice(poolMetadata.mint_y)];
                    case 6:
                        tokenYPrice = _j.sent();
                        // Fallback for Devnet: derive missing price from active bin
                        if ((tokenXPrice === 0 || tokenYPrice === 0) && (tokenXPrice > 0 || tokenYPrice > 0)) {
                            try {
                                activeId_1 = positionInfo.lbPair.activeId;
                                binStep_1 = positionInfo.lbPair.binStep;
                                priceXInY = pool_service_1.poolService.calculateBinPrice(activeId_1, binStep_1, tokenXDecimals, tokenYDecimals);
                                if (tokenXPrice > 0 && tokenYPrice === 0) {
                                    tokenYPrice = tokenXPrice / priceXInY;
                                }
                                else if (tokenYPrice > 0 && tokenXPrice === 0) {
                                    tokenXPrice = tokenYPrice * priceXInY;
                                }
                            }
                            catch (e) { /* ignore */ }
                        }
                        _j.label = 7;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        e_1 = _j.sent();
                        return [3 /*break*/, 9];
                    case 9:
                        binStep = (_g = (_f = positionInfo.lbPair) === null || _f === void 0 ? void 0 : _f.binStep) !== null && _g !== void 0 ? _g : 0;
                        poolApr = ((poolMetadata === null || poolMetadata === void 0 ? void 0 : poolMetadata.apr) && Number(poolMetadata.apr)) || 0;
                        for (_c = 0, lbPairPositions_1 = lbPairPositions; _c < lbPairPositions_1.length; _c++) {
                            pos = lbPairPositions_1[_c];
                            userPositions.push(this.mapToUserPosition(pos, lbPairAddr, activeId, positionInfo.tokenX.publicKey.toBase58(), positionInfo.tokenY.publicKey.toBase58(), tokenXSymbol, tokenYSymbol, tokenXDecimals, tokenYDecimals, tokenXPrice, tokenYPrice, binStep, poolApr));
                        }
                        _j.label = 10;
                    case 10:
                        _i++;
                        return [3 /*break*/, 2];
                    case 11: return [2 /*return*/, userPositions];
                    case 12:
                        error_1 = _j.sent();
                        // Handle known SDK issue: "Cannot read properties of undefined (reading 'feeAmountXPerTokenStored')"
                        // This occurs on certain positions in specific pools
                        if ((_h = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _h === void 0 ? void 0 : _h.includes('feeAmountXPerTokenStored')) {
                            console.warn('Known SDK issue detected with position data (feeAmountXPerTokenStored). ' +
                                'Skipping corrupted positions and continuing...');
                            return [2 /*return*/, []];
                        }
                        console.error('Error fetching all positions:', error_1);
                        // Return empty array instead of throwing to avoid crashing the UI if something fails
                        return [2 /*return*/, []];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get positions for a specific pool
     */
    PositionService.prototype.getPositionsByPool = function (poolAddress, userPublicKey) {
        return __awaiter(this, void 0, void 0, function () {
            var dlmm_2, user, _a, userPositions, activeBin_1, tokenXSymbol_1, tokenYSymbol_1, tokenXPrice_1, tokenYPrice_1, dlmmTokenX, dlmmTokenY, tokenXDecimals_1, tokenYDecimals_1, poolMetadata, names, priceXInY, e_2, binStep_2, poolApr_1, error_2;
            var _this = this;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k;
            return __generator(this, function (_l) {
                switch (_l.label) {
                    case 0:
                        _l.trys.push([0, 10, , 11]);
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolAddress)];
                    case 1:
                        dlmm_2 = _l.sent();
                        user = new web3_js_1.PublicKey(userPublicKey);
                        return [4 /*yield*/, dlmm_2.getPositionsByUserAndLbPair(user)];
                    case 2:
                        _a = _l.sent(), userPositions = _a.userPositions, activeBin_1 = _a.activeBin;
                        tokenXSymbol_1 = 'Unknown';
                        tokenYSymbol_1 = 'Unknown';
                        tokenXPrice_1 = 0;
                        tokenYPrice_1 = 0;
                        dlmmTokenX = dlmm_2.tokenX;
                        dlmmTokenY = dlmm_2.tokenY;
                        tokenXDecimals_1 = (_d = (_c = (_b = dlmmTokenX === null || dlmmTokenX === void 0 ? void 0 : dlmmTokenX.mint) === null || _b === void 0 ? void 0 : _b.decimals) !== null && _c !== void 0 ? _c : dlmmTokenX === null || dlmmTokenX === void 0 ? void 0 : dlmmTokenX.decimal) !== null && _d !== void 0 ? _d : 6;
                        tokenYDecimals_1 = (_g = (_f = (_e = dlmmTokenY === null || dlmmTokenY === void 0 ? void 0 : dlmmTokenY.mint) === null || _e === void 0 ? void 0 : _e.decimals) !== null && _f !== void 0 ? _f : dlmmTokenY === null || dlmmTokenY === void 0 ? void 0 : dlmmTokenY.decimal) !== null && _g !== void 0 ? _g : 6;
                        poolMetadata = null;
                        _l.label = 3;
                    case 3:
                        _l.trys.push([3, 8, , 9]);
                        return [4 /*yield*/, pool_service_1.poolService.fetchPoolByAddress(poolAddress)];
                    case 4:
                        poolMetadata = _l.sent();
                        if (!poolMetadata) return [3 /*break*/, 7];
                        names = poolMetadata.name.split('-');
                        tokenXSymbol_1 = names[0];
                        tokenYSymbol_1 = names[1];
                        return [4 /*yield*/, price_service_1.priceService.getTokenPrice(poolMetadata.mint_x)];
                    case 5:
                        tokenXPrice_1 = _l.sent();
                        return [4 /*yield*/, price_service_1.priceService.getTokenPrice(poolMetadata.mint_y)];
                    case 6:
                        tokenYPrice_1 = _l.sent();
                        // Fallback for Devnet
                        if ((tokenXPrice_1 === 0 || tokenYPrice_1 === 0) && (tokenXPrice_1 > 0 || tokenYPrice_1 > 0)) {
                            priceXInY = pool_service_1.poolService.calculateBinPrice(activeBin_1.binId, dlmm_2.lbPair.binStep, tokenXDecimals_1, tokenYDecimals_1);
                            if (tokenXPrice_1 > 0 && tokenYPrice_1 === 0)
                                tokenYPrice_1 = tokenXPrice_1 / priceXInY;
                            else if (tokenYPrice_1 > 0 && tokenXPrice_1 === 0)
                                tokenXPrice_1 = tokenYPrice_1 * priceXInY;
                        }
                        _l.label = 7;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        e_2 = _l.sent();
                        return [3 /*break*/, 9];
                    case 9:
                        binStep_2 = (_j = (_h = dlmm_2.lbPair) === null || _h === void 0 ? void 0 : _h.binStep) !== null && _j !== void 0 ? _j : 0;
                        poolApr_1 = ((poolMetadata === null || poolMetadata === void 0 ? void 0 : poolMetadata.apr) && Number(poolMetadata.apr)) || 0;
                        return [2 /*return*/, userPositions.map(function (pos) { return _this.mapToUserPosition(pos, poolAddress, activeBin_1.binId, dlmm_2.tokenX.publicKey.toBase58(), dlmm_2.tokenY.publicKey.toBase58(), tokenXSymbol_1, tokenYSymbol_1, tokenXDecimals_1, tokenYDecimals_1, tokenXPrice_1, tokenYPrice_1, binStep_2, poolApr_1); })];
                    case 10:
                        error_2 = _l.sent();
                        // Handle known SDK issue: "Cannot read properties of undefined (reading 'feeAmountXPerTokenStored')"
                        if ((_k = error_2 === null || error_2 === void 0 ? void 0 : error_2.message) === null || _k === void 0 ? void 0 : _k.includes('feeAmountXPerTokenStored')) {
                            console.warn('Known SDK issue detected with position data (feeAmountXPerTokenStored). ' +
                                'Returning empty positions for this pool.');
                            return [2 /*return*/, []];
                        }
                        throw new Error("Failed to get positions for pool ".concat(poolAddress, ": ").concat(error_2));
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Helper to map SDK LbPosition to UserPosition with PROPER bin aggregation
     */
    PositionService.prototype.mapToUserPosition = function (pos, poolAddress, activeBinId, tokenXMint, tokenYMint, tokenXSymbol, tokenYSymbol, tokenXDecimals, tokenYDecimals, tokenXPrice, tokenYPrice, binStep, poolApr) {
        if (tokenXDecimals === void 0) { tokenXDecimals = 6; }
        if (tokenYDecimals === void 0) { tokenYDecimals = 6; }
        if (tokenXPrice === void 0) { tokenXPrice = 0; }
        if (tokenYPrice === void 0) { tokenYPrice = 0; }
        if (binStep === void 0) { binStep = 0; }
        if (poolApr === void 0) { poolApr = 0; }
        var data = pos.positionData;
        var lowerBinId = data.lowerBinId;
        var upperBinId = data.upperBinId;
        var inRange = activeBinId >= lowerBinId && activeBinId <= upperBinId;
        var isDebugMode = process.env.DEBUG_POSITIONS === 'true';
        if (isDebugMode) {
            console.debug('Position data fields:', Object.keys(data));
        }
        var rawAmountX = '0';
        var rawAmountY = '0';
        var rawFeeX = '0';
        var rawFeeY = '0';
        // CRITICAL FIX: Meteora SDK stores amounts in positionBinData array
        // Must aggregate across all bins to get true totals
        if (data.positionBinData && Array.isArray(data.positionBinData)) {
            if (isDebugMode) {
                console.debug("Found positionBinData with ".concat(data.positionBinData.length, " bins"));
            }
            var totalX_1 = new anchor_1.BN(0);
            var totalY_1 = new anchor_1.BN(0);
            var feeX_1 = new anchor_1.BN(0);
            var feeY_1 = new anchor_1.BN(0);
            data.positionBinData.forEach(function (bin, idx) {
                if (bin.positionXAmount) {
                    var binXAmount = new anchor_1.BN(bin.positionXAmount);
                    totalX_1 = totalX_1.add(binXAmount);
                    if (isDebugMode && idx < 3) {
                        console.debug("  Bin ".concat(bin.binId, ": X=").concat(binXAmount.toString()));
                    }
                }
                if (bin.positionYAmount) {
                    var binYAmount = new anchor_1.BN(bin.positionYAmount);
                    totalY_1 = totalY_1.add(binYAmount);
                    if (isDebugMode && idx < 3) {
                        console.debug("  Bin ".concat(bin.binId, ": Y=").concat(binYAmount.toString()));
                    }
                }
                if (bin.positionFeeXAmount) {
                    feeX_1 = feeX_1.add(new anchor_1.BN(bin.positionFeeXAmount));
                }
                if (bin.positionFeeYAmount) {
                    feeY_1 = feeY_1.add(new anchor_1.BN(bin.positionFeeYAmount));
                }
            });
            rawAmountX = totalX_1.toString();
            rawAmountY = totalY_1.toString();
            // CRITICAL: Unclaimed fees are stored in BOTH positionData.feeX/feeY AND positionBinData
            // We must ADD the position-level fees to the bin-level fees!
            if (data.feeX) {
                var positionFeeX = new anchor_1.BN(data.feeX);
                feeX_1 = feeX_1.add(positionFeeX);
                if (isDebugMode) {
                    console.debug("  Added position-level feeX: ".concat(positionFeeX.toString()));
                }
            }
            if (data.feeY) {
                var positionFeeY = new anchor_1.BN(data.feeY);
                feeY_1 = feeY_1.add(positionFeeY);
                if (isDebugMode) {
                    console.debug("  Added position-level feeY: ".concat(positionFeeY.toString()));
                }
            }
            rawFeeX = feeX_1.toString();
            rawFeeY = feeY_1.toString();
            if (isDebugMode) {
                console.debug("Aggregated totals: X=".concat(rawAmountX, ", Y=").concat(rawAmountY));
                console.debug("Aggregated fees (INCLUDING position-level): FeeX=".concat(rawFeeX, ", FeeY=").concat(rawFeeY));
            }
        }
        else {
            // Fallback: Try SDK fields (might be outdated SDK version)
            console.warn("\u26A0\uFE0F  positionBinData not found, using fallback (data may be inaccurate)");
            if (data.totalXAmount) {
                rawAmountX = String(data.totalXAmount);
            }
            if (data.totalYAmount) {
                rawAmountY = String(data.totalYAmount);
            }
            if (data.feeX) {
                rawFeeX = String(data.feeX);
            }
            if (data.feeY) {
                rawFeeY = String(data.feeY);
            }
        }
        if (isDebugMode) {
            console.debug("Raw amounts: X=".concat(rawAmountX, ", Y=").concat(rawAmountY));
        }
        var amountX = Number(rawAmountX || 0) / Math.pow(10, tokenXDecimals);
        var amountY = Number(rawAmountY || 0) / Math.pow(10, tokenYDecimals);
        if (isDebugMode) {
            console.debug("UI amounts: X=".concat(amountX, " ").concat(tokenXSymbol, ", Y=").concat(amountY, " ").concat(tokenYSymbol));
            console.debug("Prices: X=$".concat(tokenXPrice, ", Y=$").concat(tokenYPrice));
        }
        var tokenXValueUsd = amountX * tokenXPrice;
        var tokenYValueUsd = amountY * tokenYPrice;
        var totalValueUSD = tokenXValueUsd + tokenYValueUsd;
        if (isDebugMode || totalValueUSD > 1000) {
            console.debug("USD values: X=$".concat(tokenXValueUsd.toFixed(2), ", Y=$").concat(tokenYValueUsd.toFixed(2), ", Total=$").concat(totalValueUSD.toFixed(2)));
        }
        var feeXAmount = Number(rawFeeX || 0) / Math.pow(10, tokenXDecimals);
        var feeYAmount = Number(rawFeeY || 0) / Math.pow(10, tokenYDecimals);
        var feeUsdValue = feeXAmount * tokenXPrice + feeYAmount * tokenYPrice;
        return {
            publicKey: pos.publicKey.toBase58(),
            poolAddress: poolAddress,
            tokenX: {
                mint: tokenXMint,
                amount: rawAmountX,
                symbol: tokenXSymbol,
                decimals: tokenXDecimals,
                uiAmount: amountX,
                priceUsd: tokenXPrice,
                usdValue: tokenXValueUsd
            },
            tokenY: {
                mint: tokenYMint,
                amount: rawAmountY,
                symbol: tokenYSymbol,
                decimals: tokenYDecimals,
                uiAmount: amountY,
                priceUsd: tokenYPrice,
                usdValue: tokenYValueUsd
            },
            lowerBinId: lowerBinId,
            upperBinId: upperBinId,
            activeBinId: activeBinId,
            inRange: inRange,
            unclaimedFees: {
                x: rawFeeX,
                y: rawFeeY,
                xUi: feeXAmount,
                yUi: feeYAmount,
                usdValue: feeUsdValue
            },
            totalValueUSD: totalValueUSD,
            poolApr: poolApr,
            binStep: binStep
        };
    };
    /**
     * Placeholder for listing positions to satisfy CLI imports temporarily
     */
    PositionService.prototype.listPositions = function () {
        return [];
    };
    /**
     * Placeholder for getting position details
     */
    PositionService.prototype.getPositionDetails = function (address) {
        return null;
    };
    PositionService.prototype.validatePositionParams = function (params, poolInfo) {
        var errors = [];
        if (params.amountX <= 0 && params.amountY <= 0) {
            errors.push('At least one token amount must be greater than 0');
        }
        if (!['Spot', 'Curve', 'BidAsk'].includes(params.strategy)) {
            errors.push('Invalid strategy type');
        }
        if (params.strategy === 'BidAsk') {
            if (!params.minBinId || !params.maxBinId) {
                errors.push('BidAsk strategy requires minBinId and maxBinId');
            }
            if (params.minBinId && params.maxBinId && params.minBinId >= params.maxBinId) {
                errors.push('minBinId must be less than maxBinId');
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors
        };
    };
    PositionService.prototype.preparePositionCreation = function (params, poolInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var dlmm, activeBin, feeInfo, strategyType, minBinId, maxBinId, binsPerSide, centerBinOverride, centerBin, span, xDecimals, yDecimals, centerPrice;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolInfo.address)];
                    case 1:
                        dlmm = _a.sent();
                        return [4 /*yield*/, dlmm.getActiveBin()];
                    case 2:
                        activeBin = _a.sent();
                        return [4 /*yield*/, dlmm.getFeeInfo()];
                    case 3:
                        feeInfo = _a.sent();
                        strategyType = params.strategy === 'Spot' ? dlmm_1.StrategyType.Spot :
                            params.strategy === 'Curve' ? dlmm_1.StrategyType.Curve : dlmm_1.StrategyType.BidAsk;
                        minBinId = params.minBinId;
                        maxBinId = params.maxBinId;
                        binsPerSide = params.binsPerSide || 20;
                        centerBinOverride = params.centerBinOverride;
                        if (strategyType !== dlmm_1.StrategyType.BidAsk) {
                            centerBin = centerBinOverride !== null && centerBinOverride !== void 0 ? centerBinOverride : activeBin.binId;
                            if (typeof minBinId !== 'number' || typeof maxBinId !== 'number') {
                                minBinId = centerBin - binsPerSide;
                                maxBinId = centerBin + binsPerSide;
                            }
                            // Ensure bins remain aligned with override when provided
                            if (centerBinOverride !== undefined) {
                                span = binsPerSide;
                                minBinId = centerBinOverride - span;
                                maxBinId = centerBinOverride + span;
                            }
                        }
                        xDecimals = poolInfo.tokenX.decimals || 6;
                        yDecimals = poolInfo.tokenY.decimals || 6;
                        centerPrice = pool_service_1.poolService.calculateBinPrice(activeBin.binId, poolInfo.binStep, xDecimals, yDecimals);
                        return [2 /*return*/, {
                                poolAddress: poolInfo.address,
                                strategy: params.strategy,
                                strategyType: strategyType,
                                activeBinId: activeBin.binId,
                                price: centerPrice,
                                minBinId: minBinId,
                                maxBinId: maxBinId,
                                rangeConfig: {
                                    strategy: params.strategy,
                                    minBinId: minBinId,
                                    maxBinId: maxBinId,
                                    centerBin: centerBinOverride !== null && centerBinOverride !== void 0 ? centerBinOverride : activeBin.binId,
                                    binPrice: {
                                        minPrice: pool_service_1.poolService.calculateBinPrice(minBinId, poolInfo.binStep, xDecimals, yDecimals),
                                        maxPrice: pool_service_1.poolService.calculateBinPrice(maxBinId, poolInfo.binStep, xDecimals, yDecimals),
                                        centerPrice: centerPrice
                                    },
                                    tokenDistribution: {
                                        tokenXPercent: 50,
                                        tokenYPercent: 50
                                    }
                                },
                                tokenXAmount: params.amountX,
                                tokenYAmount: params.amountY,
                                swapNeeded: false // Phase 3
                            }];
                }
            });
        });
    };
    PositionService.prototype.executePositionCreation = function (params, prepared) {
        return __awaiter(this, void 0, void 0, function () {
            var keypair, dlmm, newPositionKeypair, poolInfo, amountX, amountY, strategy, tx, connection, signature, error_3, detailedMessage, capturedLogs, connection, logError_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 10]);
                        keypair = wallet_service_1.walletService.getActiveKeypair();
                        if (!keypair)
                            throw new Error('No active wallet found');
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(params.poolAddress)];
                    case 1:
                        dlmm = _a.sent();
                        newPositionKeypair = new web3_js_1.Keypair();
                        return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(params.poolAddress)];
                    case 2:
                        poolInfo = _a.sent();
                        amountX = new anchor_1.BN(params.amountX * (Math.pow(10, poolInfo.tokenX.decimals)));
                        amountY = new anchor_1.BN(params.amountY * (Math.pow(10, poolInfo.tokenY.decimals)));
                        strategy = {
                            maxBinId: prepared.maxBinId,
                            minBinId: prepared.minBinId,
                            strategyType: prepared.strategyType
                        };
                        return [4 /*yield*/, dlmm.initializePositionAndAddLiquidityByStrategy({
                                positionPubKey: newPositionKeypair.publicKey,
                                user: keypair.publicKey,
                                totalXAmount: amountX,
                                totalYAmount: amountY,
                                strategy: strategy,
                                slippage: params.slippage || 1 // 1% default
                            })];
                    case 3:
                        tx = _a.sent();
                        connection = connection_service_1.connectionService.getConnection();
                        return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [keypair, newPositionKeypair], { commitment: 'confirmed' })];
                    case 4:
                        signature = _a.sent();
                        return [2 /*return*/, {
                                status: 'success',
                                positionAddress: newPositionKeypair.publicKey.toBase58(),
                                poolAddress: params.poolAddress,
                                strategy: params.strategy,
                                minBinId: strategy.minBinId,
                                maxBinId: strategy.maxBinId,
                                tokenXAmount: amountX.toNumber() / (Math.pow(10, poolInfo.tokenX.decimals)),
                                tokenYAmount: amountY.toNumber() / (Math.pow(10, poolInfo.tokenY.decimals)),
                                depositSignature: signature,
                                cost: 0, // Calculate later
                                timestamp: new Date().toISOString()
                            }];
                    case 5:
                        error_3 = _a.sent();
                        console.error('Position creation failed:', error_3);
                        detailedMessage = error_3 instanceof Error ? error_3.message : 'Unknown error';
                        capturedLogs = void 0;
                        if (!(error_3 instanceof web3_js_1.SendTransactionError)) return [3 /*break*/, 9];
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 9]);
                        connection = connection_service_1.connectionService.getConnection();
                        return [4 /*yield*/, error_3.getLogs(connection)];
                    case 7:
                        capturedLogs = _a.sent();
                        if (capturedLogs === null || capturedLogs === void 0 ? void 0 : capturedLogs.length) {
                            console.error('Transaction logs:', capturedLogs.join('\n'));
                            detailedMessage = "".concat(detailedMessage, "\nLogs:\n").concat(capturedLogs.join('\n'));
                        }
                        return [3 /*break*/, 9];
                    case 8:
                        logError_1 = _a.sent();
                        console.warn('Unable to fetch transaction logs:', logError_1);
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/, {
                            status: 'failed',
                            positionAddress: '',
                            poolAddress: params.poolAddress,
                            strategy: params.strategy,
                            minBinId: 0,
                            maxBinId: 0,
                            tokenXAmount: 0,
                            tokenYAmount: 0,
                            depositSignature: '',
                            cost: 0,
                            timestamp: new Date().toISOString(),
                            errorMessage: detailedMessage
                        }];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    return PositionService;
}());
exports.PositionService = PositionService;
exports.positionService = new PositionService();
