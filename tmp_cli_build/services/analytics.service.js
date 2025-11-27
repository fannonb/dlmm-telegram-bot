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
exports.analyticsService = exports.AnalyticsService = void 0;
var position_service_1 = require("./position.service");
var pool_service_1 = require("./pool.service");
var config_manager_1 = require("../config/config.manager");
var AnalyticsService = /** @class */ (function () {
    function AnalyticsService() {
    }
    /**
     * Calculate comprehensive analytics for a specific position
     */
    AnalyticsService.prototype.analyzePosition = function (position) {
        return __awaiter(this, void 0, void 0, function () {
            var currentValueUSD, storedPosition, initialValueUSD, pnlUSD, pnlPercent, unclaimedFeesUSD, apr, poolInfo, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentValueUSD = position.totalValueUSD || 0;
                        storedPosition = config_manager_1.configManager.getPosition(position.publicKey);
                        initialValueUSD = (storedPosition === null || storedPosition === void 0 ? void 0 : storedPosition.initialValue) || 0;
                        pnlUSD = 0;
                        pnlPercent = 0;
                        if (initialValueUSD > 0) {
                            pnlUSD = currentValueUSD - initialValueUSD;
                            pnlPercent = (pnlUSD / initialValueUSD) * 100;
                        }
                        unclaimedFeesUSD = 0;
                        try {
                            // Quick fetch prices (cached)
                            // Note: In a real high-perf app we'd pass prices in.
                            // For now, we'll skip exact fee USD calc or do a rough estimate if prices are 0.
                        }
                        catch (e) { }
                        apr = 0;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(position.poolAddress)];
                    case 2:
                        poolInfo = _a.sent();
                        apr = poolInfo.apr || 0;
                        return [3 /*break*/, 4];
                    case 3:
                        e_1 = _a.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, {
                            publicKey: position.publicKey,
                            currentValueUSD: currentValueUSD,
                            initialValueUSD: initialValueUSD,
                            pnlUSD: pnlUSD,
                            pnlPercent: pnlPercent,
                            unclaimedFeesUSD: unclaimedFeesUSD,
                            apr: apr
                        }];
                }
            });
        });
    };
    /**
     * Analyze entire portfolio
     */
    AnalyticsService.prototype.getPortfolioAnalytics = function (userPublicKey) {
        return __awaiter(this, void 0, void 0, function () {
            var positions, analyzedPositions, _i, positions_1, pos, _a, _b, totalValueUSD, totalPnLUSD, totalUnclaimedFeesUSD, weightedAprSum, averageApr, totalInitialValue, totalPnLPercent;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, position_service_1.positionService.getAllPositions(userPublicKey)];
                    case 1:
                        positions = _c.sent();
                        analyzedPositions = [];
                        _i = 0, positions_1 = positions;
                        _c.label = 2;
                    case 2:
                        if (!(_i < positions_1.length)) return [3 /*break*/, 5];
                        pos = positions_1[_i];
                        _b = (_a = analyzedPositions).push;
                        return [4 /*yield*/, this.analyzePosition(pos)];
                    case 3:
                        _b.apply(_a, [_c.sent()]);
                        _c.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        totalValueUSD = analyzedPositions.reduce(function (sum, p) { return sum + p.currentValueUSD; }, 0);
                        totalPnLUSD = analyzedPositions.reduce(function (sum, p) { return sum + p.pnlUSD; }, 0);
                        totalUnclaimedFeesUSD = analyzedPositions.reduce(function (sum, p) { return sum + p.unclaimedFeesUSD; }, 0);
                        weightedAprSum = 0;
                        if (totalValueUSD > 0) {
                            analyzedPositions.forEach(function (p) {
                                weightedAprSum += p.apr * p.currentValueUSD;
                            });
                        }
                        averageApr = totalValueUSD > 0 ? weightedAprSum / totalValueUSD : 0;
                        totalInitialValue = analyzedPositions.reduce(function (sum, p) { return sum + p.initialValueUSD; }, 0);
                        totalPnLPercent = totalInitialValue > 0 ? (totalPnLUSD / totalInitialValue) * 100 : 0;
                        return [2 /*return*/, {
                                totalValueUSD: totalValueUSD,
                                totalPnLUSD: totalPnLUSD,
                                totalPnLPercent: totalPnLPercent,
                                totalUnclaimedFeesUSD: totalUnclaimedFeesUSD,
                                averageApr: averageApr,
                                positions: analyzedPositions
                            }];
                }
            });
        });
    };
    return AnalyticsService;
}());
exports.AnalyticsService = AnalyticsService;
exports.analyticsService = new AnalyticsService();
