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
exports.volumeCache = void 0;
exports.fetchPoolVolume = fetchPoolVolume;
var axios_1 = require("axios");
/**
 * Fetch volume data from Meteora API
 */
function fetchPoolVolume(poolAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var response, data, volume24h, volume7d, dailyAverage7d, volumeRatio, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, axios_1.default.get("https://dlmm-api.meteora.ag/pair/".concat(poolAddress), {
                            timeout: 5000,
                            headers: {
                                'Accept': 'application/json'
                            }
                        })];
                case 1:
                    response = _a.sent();
                    data = response.data;
                    volume24h = data.trade_volume_24h || 0;
                    volume7d = volume24h * 7;
                    dailyAverage7d = volume7d / 7;
                    volumeRatio = dailyAverage7d > 0 ? volume24h / dailyAverage7d : 1.0;
                    return [2 /*return*/, {
                            volume24h: volume24h,
                            volume7d: volume7d,
                            volumeRatio: volumeRatio
                        }];
                case 2:
                    error_1 = _a.sent();
                    console.warn("\u26A0\uFE0F  Failed to fetch volume for ".concat(poolAddress, ": ").concat(error_1.message));
                    // Return default neutral values on error
                    return [2 /*return*/, {
                            volume24h: 0,
                            volume7d: 0,
                            volumeRatio: 1.0
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Fetch volume data with caching to avoid excessive API calls
 */
var VolumeCache = /** @class */ (function () {
    function VolumeCache() {
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }
    VolumeCache.prototype.getVolume = function (poolAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var now, cached, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = Date.now();
                        cached = this.cache.get(poolAddress);
                        // Return cached data if still valid
                        if (cached && (now - cached.timestamp) < this.cacheDuration) {
                            return [2 /*return*/, cached.data];
                        }
                        return [4 /*yield*/, fetchPoolVolume(poolAddress)];
                    case 1:
                        data = _a.sent();
                        this.cache.set(poolAddress, { data: data, timestamp: now });
                        return [2 /*return*/, data];
                }
            });
        });
    };
    VolumeCache.prototype.clearCache = function () {
        this.cache.clear();
    };
    return VolumeCache;
}());
// Export singleton instance
exports.volumeCache = new VolumeCache();
