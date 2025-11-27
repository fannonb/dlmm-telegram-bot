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
exports.rebalancingService = exports.RebalancingService = void 0;
exports.initRebalancingService = initRebalancingService;
var anchor_1 = require("@coral-xyz/anchor");
var web3_js_1 = require("@solana/web3.js");
var dlmm_1 = require("@meteora-ag/dlmm");
var chalk_1 = require("chalk");
var position_service_1 = require("./position.service");
var pool_service_1 = require("./pool.service");
var liquidity_service_1 = require("./liquidity.service");
var wallet_service_1 = require("./wallet.service");
var analyticsDataStore_service_1 = require("./analyticsDataStore.service");
var analyticsStore = (0, analyticsDataStore_service_1.getAnalyticsDataStore)();
var RebalancingService = /** @class */ (function () {
    function RebalancingService(connection) {
        this.connection = connection;
    }
    /**
     * Analyze if a position needs rebalancing
     */
    RebalancingService.prototype.analyzeRebalanceNeeded = function (position, poolInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var resolvedPoolInfo, _a, dlmmPool, activeBin, minBinId, maxBinId, activeBinId, inRange, centerBin, distanceFromCenter, totalBins, binsActive, percentActive, priority, reason, currentDailyFees, projectedDailyFees, dailyIncrease, costUsd, breakEvenHours, recommendation, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 9, , 10]);
                        if (!position) {
                            throw new Error('Position data is required for analysis');
                        }
                        if (!(poolInfo !== null && poolInfo !== void 0)) return [3 /*break*/, 1];
                        _a = poolInfo;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(position.poolAddress)];
                    case 2:
                        _a = (_b.sent());
                        _b.label = 3;
                    case 3:
                        resolvedPoolInfo = _a;
                        return [4 /*yield*/, dlmm_1.default.create(this.connection, new web3_js_1.PublicKey(position.poolAddress))];
                    case 4:
                        dlmmPool = _b.sent();
                        return [4 /*yield*/, dlmmPool.getActiveBin()];
                    case 5:
                        activeBin = _b.sent();
                        minBinId = position.lowerBinId;
                        maxBinId = position.upperBinId;
                        activeBinId = activeBin.binId;
                        inRange = activeBinId >= minBinId && activeBinId <= maxBinId;
                        centerBin = Math.floor((minBinId + maxBinId) / 2);
                        distanceFromCenter = Math.abs(activeBinId - centerBin);
                        totalBins = maxBinId - minBinId + 1;
                        binsActive = inRange ? totalBins : 0;
                        percentActive = inRange ? (binsActive / totalBins) * 100 : 0;
                        priority = 'NONE';
                        reason = '';
                        if (!inRange) {
                            priority = 'CRITICAL';
                            reason = 'Position completely out of range - not earning fees';
                        }
                        else if (binsActive < totalBins * 0.4) {
                            priority = 'HIGH';
                            reason = 'Less than 40% of bins active - earning suboptimal fees';
                        }
                        else if (distanceFromCenter > 10) {
                            priority = 'MEDIUM';
                            reason = 'Price moved >10 bins from center - consider rebalancing';
                        }
                        else if (distanceFromCenter > 5) {
                            priority = 'LOW';
                            reason = 'Price drifting (5-10 bins from center) - monitor';
                        }
                        return [4 /*yield*/, this.estimateDailyFees(position, resolvedPoolInfo)];
                    case 6:
                        currentDailyFees = _b.sent();
                        return [4 /*yield*/, this.estimateProjectedDailyFees(currentDailyFees)];
                    case 7:
                        projectedDailyFees = _b.sent();
                        dailyIncrease = projectedDailyFees - currentDailyFees;
                        return [4 /*yield*/, this.estimateRebalanceCost(position.publicKey)];
                    case 8:
                        costUsd = _b.sent();
                        breakEvenHours = Infinity;
                        if (dailyIncrease > 0) {
                            breakEvenHours = (costUsd / dailyIncrease) * 24;
                        }
                        recommendation = '';
                        if (priority === 'CRITICAL') {
                            recommendation = 'REBALANCE IMMEDIATELY - position not earning';
                        }
                        else if (priority === 'HIGH') {
                            recommendation = 'Rebalance within 24 hours - significant fee loss';
                        }
                        else if (priority === 'MEDIUM') {
                            recommendation = "Rebalance recommended if you continue for >24h";
                        }
                        else if (priority === 'LOW') {
                            recommendation = 'Monitor - rebalance if trend continues';
                        }
                        else {
                            recommendation = 'Position optimal - no action needed';
                        }
                        return [2 /*return*/, {
                                shouldRebalance: priority === 'CRITICAL' || priority === 'HIGH',
                                priority: priority,
                                reason: reason,
                                currentBinsActive: Math.max(0, binsActive),
                                currentInRange: inRange,
                                distanceFromCenter: distanceFromCenter,
                                projectedDailyFeeIncrease: dailyIncrease,
                                rebalanceCost: costUsd,
                                breakEvenHours: breakEvenHours,
                                recommendation: recommendation,
                                currentDailyFees: currentDailyFees,
                                projectedDailyFees: projectedDailyFees,
                            }];
                    case 9:
                        error_1 = _b.sent();
                        console.error("Error analyzing rebalance for position ".concat(position.publicKey, ":"), error_1);
                        throw error_1;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    RebalancingService.prototype.costBenefitAnalysis = function (position, poolInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var analysis, breakEvenLabel;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.analyzeRebalanceNeeded(position, poolInfo)];
                    case 1:
                        analysis = _a.sent();
                        breakEvenLabel = analysis.breakEvenHours === Infinity
                            ? 'N/A'
                            : this.formatHours(analysis.breakEvenHours);
                        return [2 /*return*/, {
                                currentDailyFees: analysis.currentDailyFees,
                                projectedDailyFees: analysis.projectedDailyFees,
                                netDailyGain: analysis.projectedDailyFeeIncrease,
                                rebalanceCostUsd: analysis.rebalanceCost,
                                breakEvenHours: analysis.breakEvenHours,
                                breakEvenLabel: breakEvenLabel,
                            }];
                }
            });
        });
    };
    /**
     * Calculate priority level for rebalancing
     */
    RebalancingService.prototype.calculateRebalancePriority = function (position, activeBinId) {
        var minBinId = position.minBinId;
        var maxBinId = position.maxBinId;
        var inRange = activeBinId >= minBinId && activeBinId <= maxBinId;
        if (!inRange)
            return 'CRITICAL';
        var distanceFromMin = activeBinId - minBinId;
        var distanceFromMax = maxBinId - activeBinId;
        var minDistance = Math.min(distanceFromMin, distanceFromMax);
        if (minDistance <= 5)
            return 'HIGH';
        if (minDistance <= 10)
            return 'MEDIUM';
        if (minDistance <= 15)
            return 'LOW';
        return 'NONE';
    };
    /**
     * Estimate current daily fees for a position
     */
    RebalancingService.prototype.estimateDailyFees = function (position, poolInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var resolvedPool, _a, apr, dailyRate, xAmount, yAmount, totalUsd, timeInRange, estimatedDailyFees, error_2;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        if (!(poolInfo !== null && poolInfo !== void 0)) return [3 /*break*/, 1];
                        _a = poolInfo;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(position.poolAddress)];
                    case 2:
                        _a = (_c.sent());
                        _c.label = 3;
                    case 3:
                        resolvedPool = _a;
                        if (!resolvedPool)
                            return [2 /*return*/, 0];
                        apr = parseFloat(String(resolvedPool.apr || position.poolApr || '0')) / 100;
                        dailyRate = apr / 365;
                        xAmount = this.getTokenAmount(position.tokenX);
                        yAmount = this.getTokenAmount(position.tokenY);
                        totalUsd = xAmount * 140 + yAmount;
                        timeInRange = (_b = position.timeInRangePercent) !== null && _b !== void 0 ? _b : (position.inRange ? 95 : 65);
                        estimatedDailyFees = (totalUsd * dailyRate * timeInRange) / 100;
                        return [2 /*return*/, estimatedDailyFees];
                    case 4:
                        error_2 = _c.sent();
                        console.warn('Could not estimate daily fees:', error_2);
                        return [2 /*return*/, 0];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Estimate projected daily fees after rebalance
     */
    RebalancingService.prototype.estimateProjectedDailyFees = function (currentDailyFees) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    // After rebalance, assume 95% time in range and 100% of bins active
                    return [2 /*return*/, currentDailyFees * 1.1]; // Conservative 10% increase estimate
                }
                catch (error) {
                    console.warn('Could not estimate projected fees:', error);
                    return [2 /*return*/, 0];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Execute a rebalance: remove old position and create new centered position
     */
    RebalancingService.prototype.executeRebalance = function (position, options) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, dlmmPool, poolInfo, activeBin, binsPerSide, newMinBinId, newMaxBinId, strategy, slippageBps, keypair, removalSignatures, amountX, amountY, createParams, prepared, creation, costUsd, claimedX, claimedY, result, error_3;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            return __generator(this, function (_q) {
                switch (_q.label) {
                    case 0:
                        _q.trys.push([0, 8, , 9]);
                        console.log(chalk_1.default.yellow('\n⏳ Starting rebalance process...\n'));
                        startTime = Date.now();
                        return [4 /*yield*/, dlmm_1.default.create(this.connection, new web3_js_1.PublicKey(position.poolAddress))];
                    case 1:
                        dlmmPool = _q.sent();
                        return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(position.poolAddress)];
                    case 2:
                        poolInfo = _q.sent();
                        if (!poolInfo) {
                            throw new Error('Unable to load pool metadata for rebalance');
                        }
                        return [4 /*yield*/, dlmmPool.getActiveBin()];
                    case 3:
                        activeBin = _q.sent();
                        binsPerSide = Math.min((_a = options === null || options === void 0 ? void 0 : options.binsPerSide) !== null && _a !== void 0 ? _a : 12, 34);
                        newMinBinId = activeBin.binId - binsPerSide;
                        newMaxBinId = activeBin.binId + binsPerSide;
                        strategy = (_b = options === null || options === void 0 ? void 0 : options.strategy) !== null && _b !== void 0 ? _b : 'Spot';
                        slippageBps = (_c = options === null || options === void 0 ? void 0 : options.slippageBps) !== null && _c !== void 0 ? _c : 100;
                        keypair = wallet_service_1.walletService.getActiveKeypair();
                        if (!keypair) {
                            throw new Error('No active wallet selected for rebalance');
                        }
                        // Step 1: Remove liquidity and claim fees
                        console.log(chalk_1.default.blue('Step 1/2: Removing liquidity and claiming fees...'));
                        return [4 /*yield*/, liquidity_service_1.liquidityService.removeLiquidity({
                                positionPubKey: new web3_js_1.PublicKey(position.publicKey),
                                poolAddress: position.poolAddress,
                                userPublicKey: keypair.publicKey,
                                bps: 10000,
                                shouldClaimAndClose: true,
                            })];
                    case 4:
                        removalSignatures = _q.sent();
                        removalSignatures.forEach(function (sig) {
                            return console.log(chalk_1.default.gray("   \u2022 Removal tx: ".concat(sig)));
                        });
                        // Step 2: Prepare new position inputs
                        console.log(chalk_1.default.blue('Step 2/2: Calculating new position parameters...'));
                        amountX = this.getTokenAmount(position.tokenX);
                        amountY = this.getTokenAmount(position.tokenY);
                        createParams = {
                            poolAddress: position.poolAddress,
                            strategy: strategy,
                            amountX: amountX,
                            amountY: amountY,
                            binsPerSide: binsPerSide,
                            minBinId: newMinBinId,
                            maxBinId: newMaxBinId,
                            slippage: slippageBps,
                            centerBinOverride: activeBin.binId,
                        };
                        return [4 /*yield*/, position_service_1.positionService.preparePositionCreation(createParams, poolInfo)];
                    case 5:
                        prepared = _q.sent();
                        return [4 /*yield*/, position_service_1.positionService.executePositionCreation(createParams, prepared)];
                    case 6:
                        creation = _q.sent();
                        if (creation.status !== 'success') {
                            throw new Error(creation.errorMessage || 'Failed to create new position');
                        }
                        return [4 /*yield*/, this.estimateRebalanceCost(position.publicKey)];
                    case 7:
                        costUsd = _q.sent();
                        claimedX = this.getFeeAmount((_d = position.unclaimedFees) === null || _d === void 0 ? void 0 : _d.x, (_e = position.unclaimedFees) === null || _e === void 0 ? void 0 : _e.xUi, (_f = position.tokenX) === null || _f === void 0 ? void 0 : _f.decimals);
                        claimedY = this.getFeeAmount((_g = position.unclaimedFees) === null || _g === void 0 ? void 0 : _g.y, (_h = position.unclaimedFees) === null || _h === void 0 ? void 0 : _h.yUi, (_j = position.tokenY) === null || _j === void 0 ? void 0 : _j.decimals);
                        analyticsStore === null || analyticsStore === void 0 ? void 0 : analyticsStore.recordRebalance({
                            timestamp: Date.now(),
                            oldPositionAddress: position.publicKey,
                            newPositionAddress: creation.positionAddress,
                            poolAddress: position.poolAddress,
                            reasonCode: (_k = options === null || options === void 0 ? void 0 : options.reasonCode) !== null && _k !== void 0 ? _k : 'MANUAL',
                            reason: (_l = options === null || options === void 0 ? void 0 : options.reason) !== null && _l !== void 0 ? _l : 'Manual rebalance via CLI',
                            feesClaimedX: claimedX,
                            feesClaimedY: claimedY,
                            feesClaimedUsd: (_o = (_m = position.unclaimedFees) === null || _m === void 0 ? void 0 : _m.usdValue) !== null && _o !== void 0 ? _o : 0,
                            transactionCostUsd: costUsd,
                            oldRange: { min: position.lowerBinId, max: position.upperBinId },
                            newRange: { min: newMinBinId, max: newMaxBinId },
                            signature: creation.depositSignature,
                        });
                        result = {
                            success: true,
                            oldPositionAddress: position.publicKey,
                            newPositionAddress: creation.positionAddress,
                            feesClaimed: {
                                x: new anchor_1.BN(position.unclaimedFees.x || '0'),
                                y: new anchor_1.BN(position.unclaimedFees.y || '0'),
                                usdValue: (_p = position.unclaimedFees.usdValue) !== null && _p !== void 0 ? _p : 0,
                            },
                            transactionCost: costUsd,
                            timestamp: Date.now(),
                            signature: creation.depositSignature,
                            transactions: __spreadArray(__spreadArray([], removalSignatures, true), [creation.depositSignature], false).filter(Boolean),
                            oldRange: { minBinId: position.lowerBinId, maxBinId: position.upperBinId },
                            newRange: { minBinId: newMinBinId, maxBinId: newMaxBinId },
                        };
                        console.log(chalk_1.default.green('Rebalance completed successfully'));
                        return [2 /*return*/, result];
                    case 8:
                        error_3 = _q.sent();
                        console.error(chalk_1.default.red('Error executing rebalance:'), error_3);
                        throw error_3;
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Estimate the cost of rebalancing
     */
    RebalancingService.prototype.estimateRebalanceCost = function (positionAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var costSOL, solPrice;
            return __generator(this, function (_a) {
                costSOL = 0.0002;
                solPrice = 140;
                return [2 /*return*/, costSOL * solPrice];
            });
        });
    };
    /**
     * Calculate fee projection based on bins active
     */
    RebalancingService.prototype.calculateFeeProjection = function (currentDailyFeeUsd, binsActivePercent) {
        var optimizedRate = 1.0; // 100% of bins active
        var projectedDaily = currentDailyFeeUsd * (optimizedRate / (binsActivePercent / 100));
        return {
            current: currentDailyFeeUsd,
            projected: projectedDaily,
            increase: projectedDaily - currentDailyFeeUsd,
        };
    };
    RebalancingService.prototype.getFeeAmount = function (rawAmount, uiAmount, decimals) {
        if (decimals === void 0) { decimals = 6; }
        if (typeof uiAmount === 'number') {
            return uiAmount;
        }
        if (!rawAmount) {
            return 0;
        }
        return Number(rawAmount) / Math.pow(10, decimals);
    };
    RebalancingService.prototype.getTokenAmount = function (token) {
        var _a;
        if (!token) {
            return 0;
        }
        if ('uiAmount' in token && typeof token.uiAmount === 'number') {
            return token.uiAmount;
        }
        if ('xUi' in token && typeof token.xUi === 'number') {
            return token.xUi;
        }
        var decimals = (_a = token.decimals) !== null && _a !== void 0 ? _a : 6;
        var rawAmount = token.amount || token.x || '0';
        return Number(rawAmount || 0) / Math.pow(10, decimals);
    };
    RebalancingService.prototype.formatHours = function (hours) {
        if (!Number.isFinite(hours)) {
            return 'N/A';
        }
        if (hours < 1) {
            return "".concat(Math.round(hours * 60), "m");
        }
        if (hours > 48) {
            return "".concat((hours / 24).toFixed(1), "d");
        }
        return "".concat(hours.toFixed(1), "h");
    };
    return RebalancingService;
}());
exports.RebalancingService = RebalancingService;
// Singleton export
var rebalancingService;
function initRebalancingService(connection) {
    exports.rebalancingService = rebalancingService = new RebalancingService(connection);
    return rebalancingService;
}
