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
exports.compoundingService = void 0;
var web3_js_1 = require("@solana/web3.js");
var anchor_1 = require("@coral-xyz/anchor");
var dlmm_1 = require("@meteora-ag/dlmm");
var fee_service_1 = require("./fee.service");
var liquidity_service_1 = require("./liquidity.service");
var pool_service_1 = require("./pool.service");
var config_manager_1 = require("../config/config.manager");
var constants_1 = require("../config/constants");
var CompoundingService = /** @class */ (function () {
    function CompoundingService() {
    }
    CompoundingService.prototype.claimAndCompound = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var positionPubKey, claimed, basePercent, xPercent, yPercent, reinvestedX, reinvestedY, compoundPercentUsed, amountX, amountY, strategyType, slippage, signature;
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        positionPubKey = new web3_js_1.PublicKey(params.positionAddress);
                        return [4 /*yield*/, fee_service_1.feeService.claimFeesForPosition(params.poolAddress, positionPubKey, { method: params.method })];
                    case 1:
                        claimed = _j.sent();
                        basePercent = this.normalizePercent((_a = params.compoundPercent) !== null && _a !== void 0 ? _a : 100);
                        xPercent = this.normalizePercent((_c = (_b = params.tokenPercentOverrides) === null || _b === void 0 ? void 0 : _b.tokenXPercent) !== null && _c !== void 0 ? _c : basePercent * 100);
                        yPercent = this.normalizePercent((_e = (_d = params.tokenPercentOverrides) === null || _d === void 0 ? void 0 : _d.tokenYPercent) !== null && _e !== void 0 ? _e : basePercent * 100);
                        reinvestedX = claimed.claimedX * xPercent;
                        reinvestedY = claimed.claimedY * yPercent;
                        compoundPercentUsed = Math.max(xPercent, yPercent) * 100;
                        if (reinvestedX <= 0 && reinvestedY <= 0) {
                            return [2 /*return*/, {
                                    claimed: claimed,
                                    compounded: false,
                                    reinvestedX: reinvestedX,
                                    reinvestedY: reinvestedY,
                                    compoundPercentUsed: compoundPercentUsed,
                                    skippedReason: 'No fees available to compound.',
                                }];
                        }
                        if (reinvestedX <= 0 || reinvestedY <= 0) {
                            return [2 /*return*/, {
                                    claimed: claimed,
                                    compounded: false,
                                    reinvestedX: reinvestedX,
                                    reinvestedY: reinvestedY,
                                    compoundPercentUsed: compoundPercentUsed,
                                    skippedReason: 'Compounding requires both tokens; run a swap or adjust ratio.',
                                }];
                        }
                        amountX = this.amountToBN(reinvestedX, claimed.tokenXDecimals);
                        amountY = this.amountToBN(reinvestedY, claimed.tokenYDecimals);
                        if (amountX.isZero() || amountY.isZero()) {
                            return [2 /*return*/, {
                                    claimed: claimed,
                                    compounded: false,
                                    reinvestedX: reinvestedX,
                                    reinvestedY: reinvestedY,
                                    compoundPercentUsed: compoundPercentUsed,
                                    skippedReason: 'Claimed amounts are below the minimum precision to redeposit.',
                                }];
                        }
                        return [4 /*yield*/, this.resolveStrategyType(params.poolAddress, positionPubKey, params.strategyOverride)];
                    case 2:
                        strategyType = _j.sent();
                        slippage = (_h = (_f = params.slippage) !== null && _f !== void 0 ? _f : (_g = config_manager_1.configManager.getConfig().transaction) === null || _g === void 0 ? void 0 : _g.slippage) !== null && _h !== void 0 ? _h : constants_1.DEFAULT_CONFIG.SLIPPAGE;
                        return [4 /*yield*/, liquidity_service_1.liquidityService.addLiquidity({
                                positionPubKey: positionPubKey,
                                poolAddress: params.poolAddress,
                                amountX: amountX,
                                amountY: amountY,
                                strategyType: strategyType,
                                slippage: slippage,
                            })];
                    case 3:
                        signature = _j.sent();
                        return [2 /*return*/, {
                                claimed: claimed,
                                compounded: true,
                                reinvestedX: reinvestedX,
                                reinvestedY: reinvestedY,
                                compoundPercentUsed: compoundPercentUsed,
                                addLiquiditySignature: signature,
                            }];
                }
            });
        });
    };
    CompoundingService.prototype.resolveStrategyType = function (poolAddress, positionPubKey, override) {
        return __awaiter(this, void 0, void 0, function () {
            var dlmm, position, rawStrategy, mapped, error_1;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (override !== undefined) {
                            return [2 /*return*/, override];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolAddress)];
                    case 2:
                        dlmm = _c.sent();
                        return [4 /*yield*/, dlmm.getPosition(positionPubKey)];
                    case 3:
                        position = _c.sent();
                        rawStrategy = (_b = (_a = position === null || position === void 0 ? void 0 : position.positionData) === null || _a === void 0 ? void 0 : _a.strategyType) !== null && _b !== void 0 ? _b : position === null || position === void 0 ? void 0 : position.strategyType;
                        if (typeof rawStrategy === 'number' && dlmm_1.StrategyType[rawStrategy] !== undefined) {
                            return [2 /*return*/, rawStrategy];
                        }
                        if (typeof rawStrategy === 'string') {
                            mapped = dlmm_1.StrategyType[rawStrategy];
                            if (typeof mapped === 'number') {
                                return [2 /*return*/, mapped];
                            }
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _c.sent();
                        console.warn('Unable to determine strategy type for compounding:', error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/, dlmm_1.StrategyType.Spot];
                }
            });
        });
    };
    CompoundingService.prototype.normalizePercent = function (value, fallback) {
        var resolved = Number.isFinite(value) ? value : fallback !== null && fallback !== void 0 ? fallback : 100;
        return Math.min(1, Math.max(0, resolved / 100));
    };
    CompoundingService.prototype.amountToBN = function (amount, decimals) {
        var scale = Math.pow(10, decimals);
        var scaled = Math.floor(amount * scale);
        return new anchor_1.BN(Math.max(scaled, 0));
    };
    return CompoundingService;
}());
exports.compoundingService = new CompoundingService();
