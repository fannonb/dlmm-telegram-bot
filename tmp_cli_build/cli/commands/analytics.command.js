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
exports.analyticsMenu = analyticsMenu;
var inquirer_1 = require("inquirer");
var chalk_1 = require("chalk");
var wallet_service_1 = require("../../services/wallet.service");
var analytics_service_1 = require("../../services/analytics.service");
var analyticsDataStore_service_1 = require("../../services/analyticsDataStore.service");
var position_service_1 = require("../../services/position.service");
var charting_helpers_1 = require("../../utils/charting.helpers");
var export_helpers_1 = require("../../utils/export-helpers");
var fs_1 = require("fs");
// Helper for wait
function waitForUser() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, inquirer_1.default.prompt([{
                            type: 'input',
                            name: 'continue',
                            message: 'Press ENTER to continue...',
                        }])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function displayHeader() {
    // console.clear();
    // console.log(chalk.blue.bold('📊 ANALYTICS & MONITORING\n'));
}
function analyticsMenu() {
    return __awaiter(this, void 0, void 0, function () {
        var choices, action;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!true) return [3 /*break*/, 13];
                    displayHeader();
                    console.log(chalk_1.default.blue.bold('📊 ANALYTICS & MONITORING\n'));
                    choices = [
                        '📈 Portfolio Overview (PnL & APR)',
                        '💰 Fee Trend Chart (7-day)',
                        '🏆 Pool Performance Comparison',
                        '📊 Export Data to CSV',
                        '🚨 Check Alerts (Monitoring)',
                        '🔙 Back to Main Menu'
                    ];
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'action',
                            message: 'Select an option:',
                            choices: choices
                        })];
                case 1:
                    action = (_a.sent()).action;
                    if (!action.includes('Portfolio Overview')) return [3 /*break*/, 3];
                    return [4 /*yield*/, showPortfolioAnalytics()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 12];
                case 3:
                    if (!action.includes('Fee Trend Chart')) return [3 /*break*/, 5];
                    return [4 /*yield*/, showFeeTrendChart()];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 12];
                case 5:
                    if (!action.includes('Performance Comparison')) return [3 /*break*/, 7];
                    return [4 /*yield*/, showPoolComparison()];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 12];
                case 7:
                    if (!action.includes('Export Data')) return [3 /*break*/, 9];
                    return [4 /*yield*/, showExportMenu()];
                case 8:
                    _a.sent();
                    return [3 /*break*/, 12];
                case 9:
                    if (!action.includes('Check Alerts')) return [3 /*break*/, 11];
                    return [4 /*yield*/, showMonitoringAlerts()];
                case 10:
                    _a.sent();
                    return [3 /*break*/, 12];
                case 11:
                    if (action.includes('Back')) {
                        return [2 /*return*/];
                    }
                    _a.label = 12;
                case 12: return [3 /*break*/, 0];
                case 13: return [2 /*return*/];
            }
        });
    });
}
function showPortfolioAnalytics() {
    return __awaiter(this, void 0, void 0, function () {
        var activeWallet, stats, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n📈 PORTFOLIO ANALYTICS\n'));
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!!activeWallet) return [3 /*break*/, 2];
                    console.log(chalk_1.default.red('No active wallet.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    console.log(chalk_1.default.yellow('Calculating analytics...'));
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, analytics_service_1.analyticsService.getPortfolioAnalytics(activeWallet.publicKey)];
                case 4:
                    stats = _a.sent();
                    console.log(chalk_1.default.green('\n✅ PORTFOLIO SUMMARY:\n'));
                    console.log("Total Value: $".concat(stats.totalValueUSD.toFixed(2)));
                    console.log("Total PnL: ".concat(stats.totalPnLUSD >= 0 ? chalk_1.default.green('+$' + stats.totalPnLUSD.toFixed(2)) : chalk_1.default.red('-$' + Math.abs(stats.totalPnLUSD).toFixed(2)), " (").concat(stats.totalPnLPercent.toFixed(2), "%)"));
                    console.log("Avg APR: ".concat(stats.averageApr.toFixed(2), "%"));
                    console.log("Positions: ".concat(stats.positions.length, "\n"));
                    if (stats.positions.length > 0) {
                        console.log(chalk_1.default.yellow('📋 Position Details:'));
                        stats.positions.forEach(function (p, i) {
                            console.log("".concat(i + 1, ". ").concat(p.publicKey.slice(0, 8), "..."));
                            console.log("   Value: $".concat(p.currentValueUSD.toFixed(2)));
                            console.log("   PnL: ".concat(p.pnlUSD >= 0 ? chalk_1.default.green('+$' + p.pnlUSD.toFixed(2)) : chalk_1.default.red('-$' + Math.abs(p.pnlUSD).toFixed(2))));
                            console.log("   APR: ".concat(p.apr.toFixed(2), "%\n"));
                        });
                    }
                    return [3 /*break*/, 6];
                case 5:
                    e_1 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Error: ".concat(e_1.message)));
                    return [3 /*break*/, 6];
                case 6: return [4 /*yield*/, waitForUser()];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function showFeeTrendChart() {
    return __awaiter(this, void 0, void 0, function () {
        var activeWallet, positions, allSnapshots, days, numDays, chart, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n💰 FEE TREND ANALYSIS\n'));
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!!activeWallet) return [3 /*break*/, 2];
                    console.log(chalk_1.default.red('No active wallet.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    _a.trys.push([2, 9, , 10]);
                    return [4 /*yield*/, position_service_1.positionService.getAllPositions(activeWallet.publicKey)];
                case 3:
                    positions = _a.sent();
                    if (!(positions.length === 0)) return [3 /*break*/, 5];
                    console.log(chalk_1.default.gray('No positions found.'));
                    return [4 /*yield*/, waitForUser()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
                case 5:
                    allSnapshots = analyticsDataStore_service_1.analyticsDataStore.loadSnapshots();
                    if (!(allSnapshots.length === 0)) return [3 /*break*/, 7];
                    console.log(chalk_1.default.gray('No historical data available yet.\nData will be collected as you use the app.'));
                    return [4 /*yield*/, waitForUser()];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
                case 7: return [4 /*yield*/, inquirer_1.default.prompt({
                        type: 'list',
                        name: 'days',
                        message: 'Select time period:',
                        choices: ['7 days', '14 days', '30 days', new inquirer_1.default.Separator(), '🔙 Back'],
                        default: '7 days'
                    })];
                case 8:
                    days = (_a.sent()).days;
                    if (days === '🔙 Back') {
                        return [2 /*return*/];
                    }
                    numDays = parseInt(days);
                    chart = (0, charting_helpers_1.renderFeeChart)(allSnapshots, numDays);
                    console.log(chart);
                    return [3 /*break*/, 10];
                case 9:
                    e_2 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Error: ".concat(e_2.message)));
                    return [3 /*break*/, 10];
                case 10: return [4 /*yield*/, waitForUser()];
                case 11:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function showPoolComparison() {
    return __awaiter(this, void 0, void 0, function () {
        var activeWallet, stats, comparisonData, chart, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n🏆 POOL PERFORMANCE COMPARISON\n'));
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!!activeWallet) return [3 /*break*/, 2];
                    console.log(chalk_1.default.red('No active wallet.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    _a.trys.push([2, 6, , 7]);
                    return [4 /*yield*/, analytics_service_1.analyticsService.getPortfolioAnalytics(activeWallet.publicKey)];
                case 3:
                    stats = _a.sent();
                    if (!(stats.positions.length === 0)) return [3 /*break*/, 5];
                    console.log(chalk_1.default.gray('No positions found.'));
                    return [4 /*yield*/, waitForUser()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
                case 5:
                    comparisonData = stats.positions.map(function (p) { return ({
                        name: "".concat(p.publicKey.slice(0, 6), "..."),
                        apr: p.apr,
                        value: p.currentValueUSD
                    }); });
                    chart = (0, charting_helpers_1.renderPerformanceComparison)(comparisonData);
                    console.log(chart);
                    // Show additional stats
                    console.log(chalk_1.default.cyan('\n📊 KEY METRICS:\n'));
                    console.log("Best Performer: ".concat(comparisonData.reduce(function (max, p) { return p.apr > max.apr ? p : max; }).name, " (").concat(Math.max.apply(Math, comparisonData.map(function (p) { return p.apr; })).toFixed(1), "% APR)"));
                    console.log("Portfolio Avg: ".concat(stats.averageApr.toFixed(1), "% APR"));
                    console.log("Total Value: $".concat(stats.totalValueUSD.toFixed(2), "\n"));
                    return [3 /*break*/, 7];
                case 6:
                    e_3 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Error: ".concat(e_3.message)));
                    return [3 /*break*/, 7];
                case 7: return [4 /*yield*/, waitForUser()];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function showExportMenu() {
    return __awaiter(this, void 0, void 0, function () {
        var activeWallet, exportType, filepath, filesize, positions, filename, snapshots, filename, history_1, filename, stats, e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n📊 EXPORT DATA TO CSV\n'));
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!!activeWallet) return [3 /*break*/, 2];
                    console.log(chalk_1.default.red('No active wallet.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2: return [4 /*yield*/, inquirer_1.default.prompt({
                        type: 'list',
                        name: 'exportType',
                        message: 'What would you like to export?',
                        choices: [
                            'Current Positions Summary',
                            'Historical Snapshots',
                            'Rebalance History',
                            '🔙 Back'
                        ]
                    })];
                case 3:
                    exportType = (_a.sent()).exportType;
                    if (exportType.includes('Back')) {
                        return [2 /*return*/];
                    }
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 8, , 9]);
                    filepath = void 0;
                    filesize = void 0;
                    if (!exportType.includes('Current Positions')) return [3 /*break*/, 6];
                    return [4 /*yield*/, position_service_1.positionService.getAllPositions(activeWallet.publicKey)];
                case 5:
                    positions = _a.sent();
                    filename = (0, export_helpers_1.generateTimestampedFilename)('positions');
                    filepath = (0, export_helpers_1.exportPositionsSummaryToCSV)(positions, filename);
                    return [3 /*break*/, 7];
                case 6:
                    if (exportType.includes('Historical Snapshots')) {
                        snapshots = analyticsDataStore_service_1.analyticsDataStore.loadSnapshots();
                        filename = (0, export_helpers_1.generateTimestampedFilename)('snapshots');
                        filepath = (0, export_helpers_1.exportSnapshotsToCSV)(snapshots, filename);
                    }
                    else if (exportType.includes('Rebalance History')) {
                        history_1 = analyticsDataStore_service_1.analyticsDataStore.loadRebalanceHistory();
                        filename = (0, export_helpers_1.generateTimestampedFilename)('rebalances');
                        filepath = (0, export_helpers_1.exportRebalanceHistoryToCSV)(history_1, filename);
                    }
                    else {
                        return [2 /*return*/];
                    }
                    _a.label = 7;
                case 7:
                    stats = fs_1.default.statSync(filepath);
                    filesize = stats.size;
                    console.log(chalk_1.default.green("\n\u2705 Export successful!"));
                    console.log("File: ".concat(filepath));
                    console.log("Size: ".concat((0, export_helpers_1.formatFileSize)(filesize), "\n"));
                    return [3 /*break*/, 9];
                case 8:
                    e_4 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Export failed: ".concat(e_4.message)));
                    return [3 /*break*/, 9];
                case 9: return [4 /*yield*/, waitForUser()];
                case 10:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function showMonitoringAlerts() {
    return __awaiter(this, void 0, void 0, function () {
        var activeWallet;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n🚨 MONITORING ALERTS\n'));
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!!activeWallet) return [3 /*break*/, 2];
                    console.log(chalk_1.default.red('No active wallet.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    // Placeholder for monitoring service integration
                    console.log(chalk_1.default.gray('Monitoring alerts feature is coming soon.'));
                    return [4 /*yield*/, waitForUser()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
