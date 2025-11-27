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
exports.transactionService = void 0;
var web3_js_1 = require("@solana/web3.js");
var config_manager_1 = require("../config/config.manager");
var constants_1 = require("../config/constants");
var connection_service_1 = require("./connection.service");
var TransactionService = /** @class */ (function () {
    function TransactionService() {
    }
    TransactionService.prototype.getTransactionConfig = function () {
        var config = config_manager_1.configManager.getConfig();
        return config.transaction;
    };
    TransactionService.prototype.updateTransactionConfig = function (partial) {
        var config = config_manager_1.configManager.getConfig();
        config_manager_1.configManager.updateConfig({
            transaction: __assign(__assign({}, config.transaction), partial),
        });
    };
    TransactionService.prototype.applyPriorityFee = function (transaction, override) {
        return __awaiter(this, void 0, void 0, function () {
            var microLamports;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.resolvePriorityFeeMicroLamports(override)];
                    case 1:
                        microLamports = _a.sent();
                        if (!microLamports || microLamports <= 0) {
                            return [2 /*return*/];
                        }
                        transaction.instructions.unshift(web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: microLamports }));
                        return [2 /*return*/];
                }
            });
        });
    };
    TransactionService.prototype.resolvePriorityFeeMicroLamports = function (override) {
        return __awaiter(this, void 0, void 0, function () {
            var transactionConfig, mode, microLamports, multiplier, connection, fees, sorted, median, computed, error_1;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        transactionConfig = this.getTransactionConfig();
                        mode = (_b = (_a = override === null || override === void 0 ? void 0 : override.mode) !== null && _a !== void 0 ? _a : transactionConfig.priorityFee) !== null && _b !== void 0 ? _b : 'dynamic';
                        if (mode === 'fixed') {
                            microLamports = (_c = override === null || override === void 0 ? void 0 : override.microLamports) !== null && _c !== void 0 ? _c : transactionConfig.priorityFeeAmount;
                            return [2 /*return*/, typeof microLamports === 'number' && microLamports > 0
                                    ? Math.floor(microLamports)
                                    : null];
                        }
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 3, , 4]);
                        multiplier = (_e = (_d = override === null || override === void 0 ? void 0 : override.multiplier) !== null && _d !== void 0 ? _d : transactionConfig.priorityFeeMultiplier) !== null && _e !== void 0 ? _e : constants_1.DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER;
                        connection = connection_service_1.connectionService.getConnection();
                        return [4 /*yield*/, connection.getRecentPrioritizationFees()];
                    case 2:
                        fees = _f.sent();
                        if (!fees || fees.length === 0) {
                            return [2 /*return*/, null];
                        }
                        sorted = __spreadArray([], fees, true).sort(function (a, b) { return a.prioritizationFee - b.prioritizationFee; });
                        median = sorted[Math.floor(sorted.length / 2)].prioritizationFee;
                        computed = Math.floor(median * Math.max(multiplier, 0));
                        return [2 /*return*/, computed > 0 ? computed : null];
                    case 3:
                        error_1 = _f.sent();
                        console.warn('Unable to fetch dynamic priority fees:', error_1);
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return TransactionService;
}());
exports.transactionService = new TransactionService();
