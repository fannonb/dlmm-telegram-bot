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
exports.PositionMonitoringScheduler = void 0;
exports.startMonitoring = startMonitoring;
exports.stopMonitoring = stopMonitoring;
exports.getMonitoringStatus = getMonitoringStatus;
var cron_1 = require("cron");
var hourlySnapshot_service_1 = require("./hourlySnapshot.service");
var llmAgent_service_1 = require("./llmAgent.service");
var position_service_1 = require("./position.service");
var chalk_1 = require("chalk");
var wallet_service_1 = require("./wallet.service");
var meteoraVolume_service_1 = require("./meteoraVolume.service");
var PositionMonitoringScheduler = /** @class */ (function () {
    function PositionMonitoringScheduler(config) {
        this.jobs = [];
        this.config = config;
    }
    /**
     * Start all monitoring jobs
     */
    PositionMonitoringScheduler.prototype.start = function () {
        console.log(chalk_1.default.cyan('\n🤖 Starting Automated Position Monitoring\n'));
        if (this.config.enableHourlySnapshots) {
            this.startHourlySnapshots();
        }
        if (this.config.enable30MinuteMonitoring) {
            this.start30MinuteMonitoring();
        }
        if (this.config.enable12HourAnalysis) {
            this.start12HourAnalysis();
        }
        if (this.config.enableDailyReview) {
            this.startDailyReview();
        }
        console.log(chalk_1.default.green('✅ All monitoring jobs started\n'));
    };
    /**
     * Stop all monitoring jobs
     */
    PositionMonitoringScheduler.prototype.stop = function () {
        console.log(chalk_1.default.yellow('\n⏸️  Stopping all monitoring jobs...'));
        this.jobs.forEach(function (job) { return job.stop(); });
        this.jobs = [];
        console.log(chalk_1.default.green('✅ All jobs stopped\n'));
    };
    /**
     * Hourly snapshots - Every hour at :00
     */
    PositionMonitoringScheduler.prototype.startHourlySnapshots = function () {
        var _this = this;
        var job = new cron_1.CronJob('0 * * * *', // Every hour
        function () { return __awaiter(_this, void 0, void 0, function () {
            var _i, _a, poolAddress, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log(chalk_1.default.blue("[".concat(new Date().toISOString(), "] \uD83D\uDCF8 Recording hourly snapshots...")));
                        _i = 0, _a = this.config.activePositions;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        poolAddress = _a[_i];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, hourlySnapshot_service_1.hourlySnapshotService.recordSnapshot(poolAddress)];
                    case 3:
                        _b.sent();
                        console.log(chalk_1.default.gray("  \u2713 Snapshot recorded: ".concat(poolAddress.slice(0, 8), "...")));
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _b.sent();
                        console.error(chalk_1.default.red("  \u2717 Failed: ".concat(error_1.message)));
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        console.log(chalk_1.default.green('✅ Hourly snapshots complete\n'));
                        return [2 /*return*/];
                }
            });
        }); }, null, true, // Start immediately
        'UTC');
        this.jobs.push(job);
        console.log(chalk_1.default.gray('  • Hourly snapshots: Every hour at :00'));
    };
    /**
     * 30-minute monitoring - Quick position checks & Real-time Volume
     */
    PositionMonitoringScheduler.prototype.start30MinuteMonitoring = function () {
        var _this = this;
        var job = new cron_1.CronJob('*/30 * * * *', // Every 30 minutes
        function () { return __awaiter(_this, void 0, void 0, function () {
            var wallet, positions, _i, positions_1, position, urgent, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log(chalk_1.default.blue("[".concat(new Date().toISOString(), "] \uD83D\uDD0D 30-minute position check...")));
                        wallet = wallet_service_1.walletService.getActiveWallet();
                        if (!wallet)
                            return [2 /*return*/];
                        return [4 /*yield*/, position_service_1.positionService.getAllPositions(wallet.publicKey)];
                    case 1:
                        positions = _a.sent();
                        _i = 0, positions_1 = positions;
                        _a.label = 2;
                    case 2:
                        if (!(_i < positions_1.length)) return [3 /*break*/, 11];
                        position = positions_1[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 9, , 10]);
                        return [4 /*yield*/, this.checkPositionUrgency(position)];
                    case 4:
                        urgent = _a.sent();
                        if (!urgent.isUrgent) return [3 /*break*/, 7];
                        console.log(chalk_1.default.yellow("  \u26A0\uFE0F  ".concat(position.publicKey.slice(0, 8), "... - ").concat(urgent.reason)));
                        if (!urgent.triggerLLM) return [3 /*break*/, 6];
                        console.log(chalk_1.default.cyan('     → Triggering LLM analysis...'));
                        return [4 /*yield*/, this.performLLMAnalysis(position, 'urgent')];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        console.log(chalk_1.default.gray("  \u2713 ".concat(position.publicKey.slice(0, 8), "... - OK")));
                        _a.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_2 = _a.sent();
                        console.error(chalk_1.default.red("  \u2717 Error: ".concat(error_2.message)));
                        return [3 /*break*/, 10];
                    case 10:
                        _i++;
                        return [3 /*break*/, 2];
                    case 11:
                        console.log(chalk_1.default.green('✅ 30-minute check complete\n'));
                        return [2 /*return*/];
                }
            });
        }); }, null, true, 'UTC');
        this.jobs.push(job);
        console.log(chalk_1.default.gray('  • 30-minute monitoring: Every 30 minutes'));
    };
    /**
     * 12-hour analysis - Full LLM analysis if triggered
     */
    PositionMonitoringScheduler.prototype.start12HourAnalysis = function () {
        var _this = this;
        var job = new cron_1.CronJob('0 8,20 * * *', // 08:00 and 20:00 UTC
        function () { return __awaiter(_this, void 0, void 0, function () {
            var hour, market, wallet, positions, _i, positions_2, position, shouldAnalyze, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        hour = new Date().getUTCHours();
                        market = hour === 8 ? 'US Market Open' : 'Asia Market';
                        console.log(chalk_1.default.blue("[".concat(new Date().toISOString(), "] \uD83D\uDCCA 12-hour analysis (").concat(market, ")...")));
                        wallet = wallet_service_1.walletService.getActiveWallet();
                        if (!wallet)
                            return [2 /*return*/];
                        return [4 /*yield*/, position_service_1.positionService.getAllPositions(wallet.publicKey)];
                    case 1:
                        positions = _a.sent();
                        _i = 0, positions_2 = positions;
                        _a.label = 2;
                    case 2:
                        if (!(_i < positions_2.length)) return [3 /*break*/, 10];
                        position = positions_2[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 8, , 9]);
                        return [4 /*yield*/, this.should12HourAnalyze(position)];
                    case 4:
                        shouldAnalyze = _a.sent();
                        if (!shouldAnalyze.analyze) return [3 /*break*/, 6];
                        console.log(chalk_1.default.cyan("  \uD83E\uDD16 Analyzing: ".concat(position.publicKey.slice(0, 8), "...")));
                        console.log(chalk_1.default.gray("     Reason: ".concat(shouldAnalyze.reason)));
                        return [4 /*yield*/, this.performLLMAnalysis(position, 'scheduled')];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        console.log(chalk_1.default.gray("  \u25CB ".concat(position.publicKey.slice(0, 8), "... - No analysis needed")));
                        _a.label = 7;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        error_3 = _a.sent();
                        console.error(chalk_1.default.red("  \u2717 Error: ".concat(error_3.message)));
                        return [3 /*break*/, 9];
                    case 9:
                        _i++;
                        return [3 /*break*/, 2];
                    case 10:
                        console.log(chalk_1.default.green('✅ 12-hour analysis complete\n'));
                        return [2 /*return*/];
                }
            });
        }); }, null, true, 'UTC');
        this.jobs.push(job);
        console.log(chalk_1.default.gray('  • 12-hour analysis: 08:00 & 20:00 UTC'));
    };
    /**
     * Daily review - Strategic analysis and learning
     */
    PositionMonitoringScheduler.prototype.startDailyReview = function () {
        var _this = this;
        var job = new cron_1.CronJob('0 0 * * *', // Midnight UTC
        function () { return __awaiter(_this, void 0, void 0, function () {
            var wallet, positions, _i, positions_3, position, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log(chalk_1.default.blue("[".concat(new Date().toISOString(), "] \uD83C\uDF19 Daily strategic review...")));
                        wallet = wallet_service_1.walletService.getActiveWallet();
                        if (!wallet)
                            return [2 /*return*/];
                        return [4 /*yield*/, position_service_1.positionService.getAllPositions(wallet.publicKey)];
                    case 1:
                        positions = _a.sent();
                        _i = 0, positions_3 = positions;
                        _a.label = 2;
                    case 2:
                        if (!(_i < positions_3.length)) return [3 /*break*/, 7];
                        position = positions_3[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        console.log(chalk_1.default.cyan("  \uD83E\uDD16 Deep analysis: ".concat(position.publicKey.slice(0, 8), "...")));
                        return [4 /*yield*/, this.performLLMAnalysis(position, 'daily')];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_4 = _a.sent();
                        console.error(chalk_1.default.red("  \u2717 Error: ".concat(error_4.message)));
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7:
                        console.log(chalk_1.default.green('✅ Daily review complete\n'));
                        return [2 /*return*/];
                }
            });
        }); }, null, true, 'UTC');
        this.jobs.push(job);
        console.log(chalk_1.default.gray('  • Daily review: 00:00 UTC'));
    };
    /**
     * Check if position needs urgent attention
     */
    PositionMonitoringScheduler.prototype.checkPositionUrgency = function (position) {
        return __awaiter(this, void 0, void 0, function () {
            var distanceToEdge, volumeData, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        // Out of range = CRITICAL
                        if (!position.inRange) {
                            return [2 /*return*/, {
                                    isUrgent: true,
                                    triggerLLM: true,
                                    reason: 'OUT OF RANGE - Not earning fees!'
                                }];
                        }
                        distanceToEdge = Math.min(position.activeBinId - position.lowerBinId, position.upperBinId - position.activeBinId);
                        // Close to edge = URGENT
                        if (distanceToEdge < 3) {
                            return [2 /*return*/, {
                                    isUrgent: true,
                                    triggerLLM: true,
                                    reason: "Only ".concat(distanceToEdge, " bins from edge")
                                }];
                        }
                        // Approaching edge = WARNING
                        if (distanceToEdge < 10) {
                            return [2 /*return*/, {
                                    isUrgent: true,
                                    triggerLLM: false, // Will analyze at next 12h cycle
                                    reason: "Approaching edge (".concat(distanceToEdge, " bins)")
                                }];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, meteoraVolume_service_1.fetchPoolVolume)(position.poolAddress)];
                    case 2:
                        volumeData = _b.sent();
                        // Trigger if current 24h volume is > 1.5x the 7d average (ratio > 1.5)
                        if (volumeData.volumeRatio > 1.5) {
                            return [2 /*return*/, {
                                    isUrgent: true,
                                    triggerLLM: true, // Immediate trigger for volume spikes
                                    reason: "Volume spike detected (".concat(volumeData.volumeRatio.toFixed(2), "x avg)")
                                }];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, {
                            isUrgent: false,
                            triggerLLM: false,
                            reason: 'Position healthy'
                        }];
                }
            });
        });
    };
    /**
     * Check if 12-hour analysis should run
     */
    PositionMonitoringScheduler.prototype.should12HourAnalyze = function (position) {
        return __awaiter(this, void 0, void 0, function () {
            var distanceToEdge, ageHours, intraDayContext;
            var _a;
            return __generator(this, function (_b) {
                distanceToEdge = Math.min(position.activeBinId - position.lowerBinId, position.upperBinId - position.activeBinId);
                // Close to edge
                if (distanceToEdge < 10) {
                    return [2 /*return*/, { analyze: true, reason: 'Approaching edge' }];
                }
                ageHours = position.lastRebalanceTimestamp
                    ? (Date.now() - position.lastRebalanceTimestamp) / (1000 * 60 * 60)
                    : Infinity;
                if (ageHours > 12) {
                    // Check volume
                    try {
                        intraDayContext = hourlySnapshot_service_1.hourlySnapshotService.getIntraDayContext(position.poolAddress, 12);
                        if (((_a = intraDayContext.momentum) === null || _a === void 0 ? void 0 : _a.volume) > 50) {
                            return [2 /*return*/, { analyze: true, reason: 'High volume + position age > 12h' }];
                        }
                    }
                    catch (_c) {
                        // Fallback
                    }
                }
                return [2 /*return*/, { analyze: false, reason: 'No triggers met' }];
            });
        });
    };
    /**
     * Perform LLM analysis on position
     */
    PositionMonitoringScheduler.prototype.performLLMAnalysis = function (position, type) {
        return __awaiter(this, void 0, void 0, function () {
            var decision, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!llmAgent_service_1.llmAgent.isAvailable()) {
                            console.log(chalk_1.default.yellow('     ⚠️  LLM not configured, skipping analysis'));
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, llmAgent_service_1.llmAgent.analyzePosition(position)];
                    case 2:
                        decision = _a.sent();
                        console.log(chalk_1.default.green("     \u2705 Decision: ".concat(decision.action)));
                        console.log(chalk_1.default.gray("        Confidence: ".concat(decision.confidence, "%")));
                        console.log(chalk_1.default.gray("        Urgency: ".concat(decision.urgency)));
                        // In Phase 3, this will send Telegram notification if urgency high/critical
                        if (decision.urgency === 'critical' || decision.urgency === 'high') {
                            console.log(chalk_1.default.yellow("     \uD83D\uDCF1 [Phase 3] Would send Telegram notification"));
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_5 = _a.sent();
                        console.error(chalk_1.default.red("     \u2717 LLM analysis failed: ".concat(error_5.message)));
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get scheduler status
     */
    PositionMonitoringScheduler.prototype.getStatus = function () {
        return {
            jobCount: this.jobs.length,
            running: this.jobs.length > 0, // If we have jobs, they're running
            activePositions: this.config.activePositions.length
        };
    };
    return PositionMonitoringScheduler;
}());
exports.PositionMonitoringScheduler = PositionMonitoringScheduler;
// Singleton instance (will be configured via CLI)
var scheduler = null;
function startMonitoring(config) {
    if (scheduler) {
        scheduler.stop();
    }
    scheduler = new PositionMonitoringScheduler(config);
    scheduler.start();
}
function stopMonitoring() {
    if (scheduler) {
        scheduler.stop();
        scheduler = null;
    }
}
function getMonitoringStatus() {
    return scheduler ? scheduler.getStatus() : null;
}
