"use strict";
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
exports.renderFeeChart = renderFeeChart;
exports.renderBinDistributionChart = renderBinDistributionChart;
exports.renderPerformanceComparison = renderPerformanceComparison;
exports.renderSparkline = renderSparkline;
exports.renderSeparator = renderSeparator;
exports.renderProgressBar = renderProgressBar;
var chalk_1 = require("chalk");
/**
 * Renders an ASCII bar chart for fee trends
 */
function renderFeeChart(snapshots, days) {
    if (days === void 0) { days = 7; }
    if (!snapshots || snapshots.length === 0) {
        return chalk_1.default.gray('No data available for chart');
    }
    // Group snapshots by day
    var dailyFees = groupSnapshotsByDay(snapshots, days);
    if (dailyFees.length === 0) {
        return chalk_1.default.gray("No data available for the last ".concat(days, " days"));
    }
    // Find max value for scaling
    var maxFees = Math.max.apply(Math, dailyFees.map(function (d) { return d.totalFees; }));
    var maxBarLength = 20;
    // Build chart
    var chart = chalk_1.default.cyan.bold("\n\uD83D\uDCB0 ".concat(days, "-DAY FEE TREND\n\n"));
    dailyFees.forEach(function (day) {
        var barLength = Math.round((day.totalFees / maxFees) * maxBarLength);
        var filledBar = '█'.repeat(barLength);
        var emptyBar = '░'.repeat(maxBarLength - barLength);
        var dateStr = formatDate(day.date);
        var feesStr = "$".concat(day.totalFees.toFixed(2)).padStart(8);
        chart += "".concat(dateStr, ": ").concat(chalk_1.default.green(filledBar)).concat(chalk_1.default.gray(emptyBar), " ").concat(feesStr, "\n");
    });
    // Add summary
    var totalFees = dailyFees.reduce(function (sum, d) { return sum + d.totalFees; }, 0);
    var avgFees = totalFees / dailyFees.length;
    chart += chalk_1.default.gray("\nTotal: $".concat(totalFees.toFixed(2), " | Daily Avg: $").concat(avgFees.toFixed(2), "\n"));
    return chart;
}
/**
 * Renders a bin distribution chart
 */
function renderBinDistributionChart(binData, maxBars) {
    if (maxBars === void 0) { maxBars = 15; }
    if (!binData || binData.length === 0) {
        return chalk_1.default.gray('No bin data available');
    }
    // Sort by bin ID
    var sorted = __spreadArray([], binData, true).sort(function (a, b) { return a.binId - b.binId; });
    // Find max amount for scaling
    var maxAmount = Math.max.apply(Math, sorted.map(function (b) { return b.amount; }));
    var maxBarLength = 20;
    var chart = chalk_1.default.cyan.bold('\n📊 BIN DISTRIBUTION\n\n');
    // Show only sample if too many bins
    var binsToShow = sorted.length > maxBars
        ? __spreadArray(__spreadArray([], sorted.slice(0, maxBars / 2), true), sorted.slice(-maxBars / 2), true) : sorted;
    binsToShow.forEach(function (bin, index) {
        // Add ellipsis indicator if skipping bins in the middle
        if (index === Math.floor(maxBars / 2) && sorted.length > maxBars) {
            chart += chalk_1.default.gray('    ...\n');
        }
        var barLength = Math.round((bin.amount / maxAmount) * maxBarLength);
        var filledBar = '█'.repeat(barLength);
        var emptyBar = '░'.repeat(maxBarLength - barLength);
        var binStr = "Bin ".concat(bin.binId.toString().padStart(4));
        var priceStr = "$".concat(bin.price.toFixed(4));
        var amountStr = bin.amount.toFixed(3);
        chart += "".concat(binStr, " ").concat(chalk_1.default.green(filledBar)).concat(chalk_1.default.gray(emptyBar), " ").concat(priceStr, " | ").concat(amountStr, "\n");
    });
    return chart;
}
/**
 * Renders a performance comparison chart
 */
function renderPerformanceComparison(positions) {
    if (!positions || positions.length === 0) {
        return chalk_1.default.gray('No positions to compare');
    }
    var maxApr = Math.max.apply(Math, positions.map(function (p) { return p.apr; }));
    var maxBarLength = 20;
    var chart = chalk_1.default.cyan.bold('\n📈 POSITION PERFORMANCE COMPARISON\n\n');
    positions.forEach(function (position) {
        var barLength = Math.round((position.apr / maxApr) * maxBarLength);
        var filledBar = '█'.repeat(barLength);
        var emptyBar = '░'.repeat(maxBarLength - barLength);
        var nameStr = position.name.padEnd(20);
        var aprStr = "".concat(position.apr.toFixed(1), "%").padStart(7);
        var valueStr = "$".concat(position.value.toFixed(2));
        var color = position.apr >= 50 ? chalk_1.default.green : position.apr >= 30 ? chalk_1.default.yellow : chalk_1.default.red;
        chart += "".concat(nameStr, " ").concat(color(filledBar)).concat(chalk_1.default.gray(emptyBar), " ").concat(aprStr, " | ").concat(valueStr, "\n");
    });
    return chart;
}
/**
 * Group snapshots by day and sum fees
 */
function groupSnapshotsByDay(snapshots, days) {
    var now = Date.now();
    var cutoffTime = now - (days * 24 * 60 * 60 * 1000);
    // Filter to last N days
    var recentSnapshots = snapshots.filter(function (s) { return s.timestamp >= cutoffTime; });
    // Group by day
    var dailyMap = new Map();
    recentSnapshots.forEach(function (snapshot) {
        var date = new Date(snapshot.timestamp);
        var dayKey = "".concat(date.getFullYear(), "-").concat(String(date.getMonth() + 1).padStart(2, '0'), "-").concat(String(date.getDate()).padStart(2, '0'));
        var currentFees = dailyMap.get(dayKey) || 0;
        dailyMap.set(dayKey, currentFees + (snapshot.feesUsdValue || 0));
    });
    // Convert to array and sort
    var dailyFees = Array.from(dailyMap.entries()).map(function (_a) {
        var dateStr = _a[0], totalFees = _a[1];
        return ({
            date: new Date(dateStr),
            totalFees: totalFees
        });
    });
    dailyFees.sort(function (a, b) { return a.date.getTime() - b.date.getTime(); });
    return dailyFees;
}
/**
 * Format date for chart display
 */
function formatDate(date) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return "".concat(months[date.getMonth()], " ").concat(String(date.getDate()).padStart(2, '0'));
}
/**
 * Renders a simple sparkline for inline display
 */
function renderSparkline(values, width) {
    if (width === void 0) { width = 10; }
    if (!values || values.length === 0)
        return '';
    var chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    var max = Math.max.apply(Math, values);
    var min = Math.min.apply(Math, values);
    var range = max - min;
    if (range === 0)
        return chars[0].repeat(width);
    return values
        .slice(-width)
        .map(function (v) {
        var normalized = (v - min) / range;
        var charIndex = Math.floor(normalized * (chars.length - 1));
        return chars[charIndex];
    })
        .join('');
}
/**
 * Create a horizontal line separator
 */
function renderSeparator(width, char) {
    if (width === void 0) { width = 60; }
    if (char === void 0) { char = '─'; }
    return chalk_1.default.gray(char.repeat(width));
}
/**
 * Render a progress bar
 */
function renderProgressBar(current, total, width) {
    if (width === void 0) { width = 20; }
    var percentage = Math.min(100, Math.max(0, (current / total) * 100));
    var filledLength = Math.round((percentage / 100) * width);
    var filled = '█'.repeat(filledLength);
    var empty = '░'.repeat(width - filledLength);
    var color = percentage >= 75 ? chalk_1.default.green : percentage >= 50 ? chalk_1.default.yellow : chalk_1.default.red;
    return "".concat(color(filled)).concat(chalk_1.default.gray(empty), " ").concat(percentage.toFixed(1), "%");
}
