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
exports.monitoringCommand = monitoringCommand;
var inquirer_1 = require("inquirer");
var chalk_1 = require("chalk");
var monitoring_scheduler_1 = require("../../services/monitoring.scheduler");
var position_service_1 = require("../../services/position.service");
var hourlySnapshot_service_1 = require("../../services/hourlySnapshot.service");
var wallet_service_1 = require("../../services/wallet.service");
function monitoringCommand() {
    return __awaiter(this, void 0, void 0, function () {
        var status_1, action, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!true) return [3 /*break*/, 16];
                    console.clear();
                    console.log(chalk_1.default.cyan.bold('\n🤖 AUTOMATED MONITORING\n'));
                    status_1 = (0, monitoring_scheduler_1.getMonitoringStatus)();
                    if (status_1) {
                        console.log(chalk_1.default.green('Status: ✅ ACTIVE'));
                        console.log(chalk_1.default.gray("Jobs Running: ".concat(status_1.jobCount)));
                        console.log(chalk_1.default.gray("Monitoring: ".concat(status_1.activePositions, " position(s)\n")));
                    }
                    else {
                        console.log(chalk_1.default.yellow('Status: ⏸️  INACTIVE\n'));
                    }
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'list',
                                name: 'action',
                                message: 'What would you like to do?',
                                choices: [
                                    { name: '▶️  Start Monitoring', value: 'start', disabled: status_1 ? 'Already running' : false },
                                    { name: '⏹️  Stop Monitoring', value: 'stop', disabled: !status_1 },
                                    { name: '📊 View Monitoring Schedule', value: 'schedule' },
                                    { name: '🧪 Test Hourly Snapshot (Manual)', value: 'test_snapshot' },
                                    { name: '📈 View Recent Snapshots', value: 'view_snapshots' },
                                    { name: '⚙️  Configure Settings', value: 'configure' },
                                    { name: '◀️  Back', value: 'back' }
                                ]
                            }])];
                case 1:
                    action = (_b.sent()).action;
                    _a = action;
                    switch (_a) {
                        case 'start': return [3 /*break*/, 2];
                        case 'stop': return [3 /*break*/, 4];
                        case 'schedule': return [3 /*break*/, 6];
                        case 'test_snapshot': return [3 /*break*/, 8];
                        case 'view_snapshots': return [3 /*break*/, 10];
                        case 'configure': return [3 /*break*/, 12];
                        case 'back': return [3 /*break*/, 14];
                    }
                    return [3 /*break*/, 15];
                case 2: return [4 /*yield*/, startMonitoringFlow()];
                case 3:
                    _b.sent();
                    return [3 /*break*/, 15];
                case 4:
                    (0, monitoring_scheduler_1.stopMonitoring)();
                    console.log(chalk_1.default.green('\n✅ Monitoring stopped\n'));
                    return [4 /*yield*/, pause()];
                case 5:
                    _b.sent();
                    return [3 /*break*/, 15];
                case 6:
                    showMonitoringSchedule();
                    return [4 /*yield*/, pause()];
                case 7:
                    _b.sent();
                    return [3 /*break*/, 15];
                case 8: return [4 /*yield*/, testHourlySnapshot()];
                case 9:
                    _b.sent();
                    return [3 /*break*/, 15];
                case 10: return [4 /*yield*/, viewRecentSnapshots()];
                case 11:
                    _b.sent();
                    return [3 /*break*/, 15];
                case 12: return [4 /*yield*/, configureMonitoring()];
                case 13:
                    _b.sent();
                    return [3 /*break*/, 15];
                case 14: return [2 /*return*/];
                case 15: return [3 /*break*/, 0];
                case 16: return [2 /*return*/];
            }
        });
    });
}
function startMonitoringFlow() {
    return __awaiter(this, void 0, void 0, function () {
        var wallet, positions, enabledJobs, config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.cyan('\n📋 Monitoring Configuration\n'));
                    wallet = wallet_service_1.walletService.getActiveWallet();
                    if (!!wallet) return [3 /*break*/, 2];
                    console.log(chalk_1.default.yellow('⚠️  No active wallet'));
                    console.log(chalk_1.default.gray('Set an active wallet first\n'));
                    return [4 /*yield*/, pause()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2: return [4 /*yield*/, position_service_1.positionService.getAllPositions(wallet.publicKey)];
                case 3:
                    positions = _a.sent();
                    if (!(positions.length === 0)) return [3 /*break*/, 5];
                    console.log(chalk_1.default.yellow('⚠️  No active positions found'));
                    console.log(chalk_1.default.gray('Create a position first before starting monitoring\n'));
                    return [4 /*yield*/, pause()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
                case 5:
                    console.log(chalk_1.default.green("Found ".concat(positions.length, " active position(s):\n")));
                    positions.forEach(function (pos, i) {
                        console.log(chalk_1.default.gray("  ".concat(i + 1, ". ").concat(pos.publicKey.slice(0, 8), "... (").concat(pos.inRange ? '🟢 IN-RANGE' : '🔴 OUT-OF-RANGE', ")")));
                    });
                    console.log();
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'checkbox',
                                name: 'enabledJobs',
                                message: 'Select monitoring jobs to enable:',
                                choices: [
                                    { name: '📸 Hourly Snapshots (price/volume tracking)', value: 'hourly', checked: true },
                                    { name: '🔍 30-Minute Position Checks (edge/volume)', value: '30min', checked: true },
                                    { name: '📊 12-Hour LLM Analysis (08:00 & 20:00 UTC)', value: '12hour', checked: true },
                                    { name: '🌙 Daily Strategic Review (00:00 UTC)', value: 'daily', checked: true }
                                ]
                            }])];
                case 6:
                    enabledJobs = (_a.sent()).enabledJobs;
                    config = {
                        enableHourlySnapshots: enabledJobs.includes('hourly'),
                        enable30MinuteMonitoring: enabledJobs.includes('30min'),
                        enable12HourAnalysis: enabledJobs.includes('12hour'),
                        enableDailyReview: enabledJobs.includes('daily'),
                        activePositions: positions.map(function (p) { return p.poolAddress; })
                    };
                    (0, monitoring_scheduler_1.startMonitoring)(config);
                    console.log(chalk_1.default.green('\n✅ Monitoring started successfully!\n'));
                    console.log(chalk_1.default.yellow('💡 Tip: Leave CLI running in background for continuous monitoring'));
                    console.log(chalk_1.default.gray('   Press Ctrl+C at any time to stop\n'));
                    return [4 /*yield*/, pause()];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function showMonitoringSchedule() {
    console.log(chalk_1.default.cyan('\n📅 Monitoring Schedule (UTC)\n'));
    console.log(chalk_1.default.bold('Hourly Snapshots:'));
    console.log(chalk_1.default.gray('  ├─ Frequency: Every hour at :00'));
    console.log(chalk_1.default.gray('  ├─ Purpose: Track price/volume for intraday trends'));
    console.log(chalk_1.default.gray('  └─ Data retained: 7 days (168 snapshots)\n'));
    console.log(chalk_1.default.bold('30-Minute Position Checks:'));
    console.log(chalk_1.default.gray('  ├─ Frequency: Every 30 minutes (00:00, 00:30, ...)'));
    console.log(chalk_1.default.gray('  ├─ Purpose: Detect edge approaches, real-time volume spikes'));
    console.log(chalk_1.default.gray('  └─ Action: Trigger urgent LLM if <3 bins from edge OR volume >1.5x avg\n'));
    console.log(chalk_1.default.bold('12-Hour LLM Analysis:'));
    console.log(chalk_1.default.gray('  ├─ Frequency: 08:00 (US market) & 20:00 (Asia market)'));
    console.log(chalk_1.default.gray('  ├─ Purpose: Full analysis if position needs attention'));
    console.log(chalk_1.default.gray('  └─ Triggers: Approaching edge, high volume, position age >12h\n'));
    console.log(chalk_1.default.bold('Daily Strategic Review:'));
    console.log(chalk_1.default.gray('  ├─ Frequency: 00:00 (midnight UTC)'));
    console.log(chalk_1.default.gray('  ├─ Purpose: Deep analysis, learning, pattern detection'));
    console.log(chalk_1.default.gray('  └─ Action: Always runs for all positions\n'));
}
function testHourlySnapshot() {
    return __awaiter(this, void 0, void 0, function () {
        var wallet, positions, poolAddress, snapshots, latest, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.cyan('\n🧪 Test Hourly Snapshot\n'));
                    wallet = wallet_service_1.walletService.getActiveWallet();
                    if (!!wallet) return [3 /*break*/, 2];
                    console.log(chalk_1.default.yellow('No active wallet\n'));
                    return [4 /*yield*/, pause()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2: return [4 /*yield*/, position_service_1.positionService.getAllPositions(wallet.publicKey)];
                case 3:
                    positions = _a.sent();
                    if (!(positions.length === 0)) return [3 /*break*/, 5];
                    console.log(chalk_1.default.yellow('No active positions to test\n'));
                    return [4 /*yield*/, pause()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
                case 5: return [4 /*yield*/, inquirer_1.default.prompt([{
                            type: 'list',
                            name: 'poolAddress',
                            message: 'Select position to snapshot:',
                            choices: positions.map(function (p) { return ({
                                name: "".concat(p.publicKey.slice(0, 12), "... (").concat(p.poolAddress.slice(0, 12), "...)"),
                                value: p.poolAddress
                            }); })
                        }])];
                case 6:
                    poolAddress = (_a.sent()).poolAddress;
                    console.log(chalk_1.default.blue('\n⏳ Recording snapshot...\n'));
                    _a.label = 7;
                case 7:
                    _a.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, hourlySnapshot_service_1.hourlySnapshotService.recordSnapshot(poolAddress)];
                case 8:
                    _a.sent();
                    console.log(chalk_1.default.green('✅ Snapshot recorded successfully\n'));
                    snapshots = hourlySnapshot_service_1.hourlySnapshotService.loadSnapshots(poolAddress, 1);
                    if (snapshots.length > 0) {
                        latest = snapshots[snapshots.length - 1];
                        console.log(chalk_1.default.gray('Latest Snapshot:'));
                        console.log(chalk_1.default.gray("  Time: ".concat(new Date(latest.timestamp).toLocaleString())));
                        console.log(chalk_1.default.gray("  Price: $".concat(latest.price.toFixed(2))));
                        console.log(chalk_1.default.gray("  Volume 24h: $".concat((latest.volume24h / 1000).toFixed(1), "K")));
                        console.log(chalk_1.default.gray("  Volume Ratio: ".concat(latest.volumeRatio.toFixed(2), "x")));
                        console.log(chalk_1.default.gray("  Active Bin: ".concat(latest.activeBin)));
                        console.log(chalk_1.default.gray("  Volatility 6h: ".concat((latest.volatility6h * 100).toFixed(2), "%\n")));
                    }
                    return [3 /*break*/, 10];
                case 9:
                    error_1 = _a.sent();
                    console.error(chalk_1.default.red("\u274C Error: ".concat(error_1.message, "\n")));
                    return [3 /*break*/, 10];
                case 10: return [4 /*yield*/, pause()];
                case 11:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function viewRecentSnapshots() {
    return __awaiter(this, void 0, void 0, function () {
        var wallet, positions, poolAddress, hours, intraDayContext;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.cyan('\n📈 Recent Snapshots\n'));
                    wallet = wallet_service_1.walletService.getActiveWallet();
                    if (!!wallet) return [3 /*break*/, 2];
                    console.log(chalk_1.default.yellow('No active wallet\n'));
                    return [4 /*yield*/, pause()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2: return [4 /*yield*/, position_service_1.positionService.getAllPositions(wallet.publicKey)];
                case 3:
                    positions = _a.sent();
                    if (!(positions.length === 0)) return [3 /*break*/, 5];
                    console.log(chalk_1.default.yellow('No active positions\n'));
                    return [4 /*yield*/, pause()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
                case 5: return [4 /*yield*/, inquirer_1.default.prompt([{
                            type: 'list',
                            name: 'poolAddress',
                            message: 'Select position:',
                            choices: positions.map(function (p) { return ({
                                name: "".concat(p.publicKey.slice(0, 12), "... (").concat(p.poolAddress.slice(0, 12), "...)"),
                                value: p.poolAddress
                            }); })
                        }])];
                case 6:
                    poolAddress = (_a.sent()).poolAddress;
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'list',
                                name: 'hours',
                                message: 'Timeframe:',
                                choices: [
                                    { name: 'Last 6 hours', value: 6 },
                                    { name: 'Last 24 hours', value: 24 },
                                    { name: 'Last 3 days', value: 72 },
                                    { name: 'Last 7 days', value: 168 }
                                ]
                            }])];
                case 7:
                    hours = (_a.sent()).hours;
                    intraDayContext = hourlySnapshot_service_1.hourlySnapshotService.getIntraDayContext(poolAddress, hours);
                    if (!(intraDayContext.snapshots.length === 0)) return [3 /*break*/, 9];
                    console.log(chalk_1.default.yellow('\nNo snapshots found for this timeframe'));
                    console.log(chalk_1.default.gray('Run "Test Hourly Snapshot" first or wait for automated collection\n'));
                    return [4 /*yield*/, pause()];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
                case 9:
                    console.log(chalk_1.default.green("\n\uD83D\uDCCA ".concat(intraDayContext.snapshots.length, " snapshots found\n")));
                    // Show momentum
                    console.log(chalk_1.default.bold('Momentum Analysis:'));
                    console.log(chalk_1.default.gray("  Price: ".concat(intraDayContext.momentum.price > 0 ? '+' : '').concat(intraDayContext.momentum.price.toFixed(2), "% /hour")));
                    console.log(chalk_1.default.gray("  Volume: ".concat(intraDayContext.momentum.volume > 0 ? '+' : '').concat(intraDayContext.momentum.volume.toFixed(1), "% acceleration")));
                    console.log(chalk_1.default.gray("  Direction: ".concat(intraDayContext.momentum.direction, "\n")));
                    // Show signals
                    console.log(chalk_1.default.bold('Detected Signals:'));
                    console.log(intraDayContext.signals.priceBreakout ? chalk_1.default.yellow('  ⚠️  Price breakout detected') : chalk_1.default.gray('  ○ No price breakout'));
                    console.log(intraDayContext.signals.volumeSpike ? chalk_1.default.yellow('  ⚠️  Volume spike detected') : chalk_1.default.gray('  ○ Normal volume'));
                    console.log(intraDayContext.signals.volatilityShift ? chalk_1.default.yellow('  ⚠️  Volatility increased') : chalk_1.default.gray('  ○ Normal volatility'));
                    console.log();
                    return [4 /*yield*/, pause()];
                case 10:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function configureMonitoring() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.cyan('\n⚙️  Monitoring Configuration\n'));
                    console.log(chalk_1.default.yellow('Coming in Phase 3: Telegram notifications'));
                    console.log(chalk_1.default.gray('  • Notification preferences'));
                    console.log(chalk_1.default.gray('  • Auto-execute thresholds'));
                    console.log(chalk_1.default.gray('  • Custom monitoring intervals\n'));
                    return [4 /*yield*/, pause()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function pause() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, inquirer_1.default.prompt([{
                            type: 'input',
                            name: 'continue',
                            message: chalk_1.default.gray('Press Enter to continue...')
                        }])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
