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
exports.hourlySnapshotService = void 0;
var fs_1 = require("fs");
var path_1 = require("path");
var pool_service_1 = require("./pool.service");
var meteoraVolume_service_1 = require("./meteoraVolume.service");
var HourlySnapshotService = /** @class */ (function () {
    function HourlySnapshotService(dataDir) {
        if (dataDir === void 0) { dataDir = (0, path_1.join)(process.cwd(), 'data', 'snapshots', 'hourly'); }
        this.dataDir = dataDir;
        this.ensureDataDir();
    }
    HourlySnapshotService.prototype.ensureDataDir = function () {
        if (!(0, fs_1.existsSync)(this.dataDir)) {
            (0, fs_1.mkdirSync)(this.dataDir, { recursive: true });
        }
    };
    HourlySnapshotService.prototype.getSnapshotFile = function (poolAddress) {
        return (0, path_1.join)(this.dataDir, "".concat(poolAddress, ".json"));
    };
    /**
     * Record an hourly snapshot for a pool
     */
    HourlySnapshotService.prototype.recordSnapshot = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var poolInfo, volumeData, existing, volatility6h, snapshot, file, snapshots, data, sevenDaysAgo_1, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(poolAddress)];
                    case 1:
                        poolInfo = _a.sent();
                        return [4 /*yield*/, meteoraVolume_service_1.volumeCache.getVolume(poolAddress)];
                    case 2:
                        volumeData = _a.sent();
                        existing = this.loadSnapshots(poolAddress, 6);
                        volatility6h = this.calculateVolatility(existing);
                        snapshot = {
                            timestamp: Date.now(),
                            poolAddress: poolAddress,
                            price: poolInfo.price || 0,
                            volume24h: volumeData.volume24h,
                            volumeRatio: volumeData.volumeRatio,
                            activeBin: poolInfo.activeBin,
                            volatility6h: volatility6h
                        };
                        file = this.getSnapshotFile(poolAddress);
                        snapshots = [];
                        if ((0, fs_1.existsSync)(file)) {
                            data = (0, fs_1.readFileSync)(file, 'utf-8');
                            snapshots = JSON.parse(data) || [];
                        }
                        // Add new snapshot
                        snapshots.push(snapshot);
                        sevenDaysAgo_1 = Date.now() - 7 * 24 * 60 * 60 * 1000;
                        snapshots = snapshots.filter(function (s) { return s.timestamp >= sevenDaysAgo_1; });
                        // Save
                        (0, fs_1.writeFileSync)(file, JSON.stringify(snapshots, null, 2));
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error("Error recording hourly snapshot for ".concat(poolAddress, ":"), error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load hourly snapshots for a pool
     */
    HourlySnapshotService.prototype.loadSnapshots = function (poolAddress, hours) {
        if (hours === void 0) { hours = 24; }
        try {
            var file = this.getSnapshotFile(poolAddress);
            if (!(0, fs_1.existsSync)(file))
                return [];
            var data = (0, fs_1.readFileSync)(file, 'utf-8');
            var all = JSON.parse(data) || [];
            var cutoff_1 = Date.now() - hours * 60 * 60 * 1000;
            return all.filter(function (s) { return s.timestamp >= cutoff_1; });
        }
        catch (_a) {
            return [];
        }
    };
    /**
     * Get intraday context for LLM analysis
     */
    HourlySnapshotService.prototype.getIntraDayContext = function (poolAddress, hours) {
        if (hours === void 0) { hours = 24; }
        var snapshots = this.loadSnapshots(poolAddress, hours);
        if (snapshots.length < 2) {
            return {
                snapshots: snapshots,
                momentum: { price: 0, volume: 0, direction: 'neutral' },
                signals: { priceBreakout: false, volumeSpike: false, volatilityShift: false }
            };
        }
        var momentum = this.calculateMomentum(snapshots);
        var signals = this.detectSignals(snapshots);
        return { snapshots: snapshots, momentum: momentum, signals: signals };
    };
    /**
     * Calculate volatility from price snapshots
     */
    HourlySnapshotService.prototype.calculateVolatility = function (snapshots) {
        if (snapshots.length < 2)
            return 0;
        var prices = snapshots.map(function (s) { return s.price; });
        var avgPrice = prices.reduce(function (a, b) { return a + b; }, 0) / prices.length;
        var variance = prices.reduce(function (sum, p) { return sum + Math.pow(p - avgPrice, 2); }, 0) / prices.length;
        var stdDev = Math.sqrt(variance);
        return avgPrice > 0 ? stdDev / avgPrice : 0;
    };
    /**
     * Calculate price and volume momentum
     */
    HourlySnapshotService.prototype.calculateMomentum = function (snapshots) {
        if (snapshots.length < 2) {
            return { price: 0, volume: 0, direction: 'neutral' };
        }
        // Price momentum: average hourly change
        var totalPriceChange = 0;
        for (var i = 1; i < snapshots.length; i++) {
            var change = ((snapshots[i].price - snapshots[i - 1].price) / snapshots[i - 1].price) * 100;
            totalPriceChange += change;
        }
        var avgPriceChange = totalPriceChange / (snapshots.length - 1);
        // Volume momentum: acceleration
        var volumes = snapshots.map(function (s) { return s.volume24h; });
        var volumeAcceleration = 0;
        if (volumes.length >= 3) {
            var recent = volumes.slice(-3);
            var older = volumes.slice(0, Math.min(3, volumes.length - 3));
            var recentAvg = recent.reduce(function (a, b) { return a + b; }) / recent.length;
            var olderAvg = older.length > 0 ? older.reduce(function (a, b) { return a + b; }) / older.length : recentAvg;
            volumeAcceleration = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
        }
        // Direction
        var direction = 'neutral';
        if (avgPriceChange > 0.5 && volumeAcceleration > 0) {
            direction = 'bullish';
        }
        else if (avgPriceChange < -0.5 && volumeAcceleration > 0) {
            direction = 'bearish';
        }
        return {
            price: avgPriceChange,
            volume: volumeAcceleration,
            direction: direction
        };
    };
    /**
     * Detect intraday signals
     */
    HourlySnapshotService.prototype.detectSignals = function (snapshots) {
        if (snapshots.length < 6) {
            return { priceBreakout: false, volumeSpike: false, volatilityShift: false };
        }
        var prices = snapshots.map(function (s) { return s.price; });
        var volumes = snapshots.map(function (s) { return s.volume24h; });
        var volatilities = snapshots.map(function (s) { return s.volatility6h; });
        // Price breakout: recent price exceeds 95th percentile of period
        var recentPrice = prices[prices.length - 1];
        var sorted = __spreadArray([], prices, true).sort(function (a, b) { return a - b; });
        var p95 = sorted[Math.floor(prices.length * 0.95)];
        var p5 = sorted[Math.floor(prices.length * 0.05)];
        var priceBreakout = recentPrice > p95 || recentPrice < p5;
        // Volume spike: recent volume > 1.5x average
        var recentVolume = volumes[volumes.length - 1];
        var avgVolume = volumes.slice(0, -1).reduce(function (a, b) { return a + b; }, 0) / (volumes.length - 1);
        var volumeSpike = recentVolume > avgVolume * 1.5;
        // Volatility shift: recent volatility 20% higher than average
        var recentVol = volatilities[volatilities.length - 1];
        var avgVol = volatilities.slice(0, -1).reduce(function (a, b) { return a + b; }, 0) / (volatilities.length - 1);
        var volatilityShift = recentVol > avgVol * 1.2;
        return { priceBreakout: priceBreakout, volumeSpike: volumeSpike, volatilityShift: volatilityShift };
    };
    return HourlySnapshotService;
}());
exports.hourlySnapshotService = new HourlySnapshotService();
