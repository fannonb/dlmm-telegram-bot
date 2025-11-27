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
exports.analyticsDataStore = exports.AnalyticsDataStore = void 0;
exports.getAnalyticsDataStore = getAnalyticsDataStore;
var fs_1 = require("fs");
var path_1 = require("path");
var chalk_1 = require("chalk");
var volumeTracking_service_1 = require("./volumeTracking.service");
var AnalyticsDataStore = /** @class */ (function () {
    function AnalyticsDataStore(dataDir) {
        if (dataDir === void 0) { dataDir = './data/analytics'; }
        this.dataDir = dataDir;
        this.snapshotsFile = (0, path_1.join)(this.dataDir, 'snapshots.json');
        this.rebalanceHistoryFile = (0, path_1.join)(this.dataDir, 'rebalance-history.json');
        this.feeClaimsFile = (0, path_1.join)(this.dataDir, 'fee-claims.json');
        this.initializeDataDirectory();
    }
    /**
     * Initialize the data directory and files
     */
    AnalyticsDataStore.prototype.initializeDataDirectory = function () {
        try {
            // Create directory if it doesn't exist
            var fs = require('fs');
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
                console.log(chalk_1.default.green("\u2713 Analytics data directory created: ".concat(this.dataDir)));
            }
            // Initialize JSON files if they don't exist
            if (!(0, fs_1.existsSync)(this.snapshotsFile)) {
                (0, fs_1.writeFileSync)(this.snapshotsFile, JSON.stringify([], null, 2));
            }
            if (!(0, fs_1.existsSync)(this.rebalanceHistoryFile)) {
                (0, fs_1.writeFileSync)(this.rebalanceHistoryFile, JSON.stringify([], null, 2));
            }
            if (!(0, fs_1.existsSync)(this.feeClaimsFile)) {
                (0, fs_1.writeFileSync)(this.feeClaimsFile, JSON.stringify([], null, 2));
            }
        }
        catch (error) {
            console.error(chalk_1.default.red('Error initializing analytics directory:'), error);
        }
    };
    /**
     * Record a position snapshot
     */
    AnalyticsDataStore.prototype.recordSnapshot = function (snapshot) {
        try {
            var snapshots = this.loadSnapshots();
            snapshots.push(snapshot);
            // Keep only last 90 days of data
            var ninetyDaysAgo_1 = Date.now() - 90 * 24 * 60 * 60 * 1000;
            var filtered = snapshots.filter(function (s) { return s.timestamp >= ninetyDaysAgo_1; });
            (0, fs_1.writeFileSync)(this.snapshotsFile, JSON.stringify(filtered, null, 2));
        }
        catch (error) {
            console.error(chalk_1.default.red('Error recording snapshot:'), error);
        }
    };
    /**
     * Load all snapshots
     */
    AnalyticsDataStore.prototype.loadSnapshots = function () {
        try {
            var data = (0, fs_1.readFileSync)(this.snapshotsFile, 'utf-8');
            return JSON.parse(data) || [];
        }
        catch (error) {
            console.error(chalk_1.default.red('Error loading snapshots:'), error);
            return [];
        }
    };
    /**
     * Get snapshots for a specific position
     */
    AnalyticsDataStore.prototype.getPositionSnapshots = function (positionAddress, days) {
        if (days === void 0) { days = 7; }
        var snapshots = this.loadSnapshots();
        var cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
        return snapshots.filter(function (s) { return s.positionAddress === positionAddress && s.timestamp >= cutoffTime; });
    };
    /**
     * Get snapshot range (first/latest) for a position within optional time window
     */
    AnalyticsDataStore.prototype.getPositionSnapshotRange = function (positionAddress, options) {
        var _a;
        var days = (_a = options === null || options === void 0 ? void 0 : options.days) !== null && _a !== void 0 ? _a : 90;
        var snapshots = this.getPositionSnapshots(positionAddress, days)
            .sort(function (a, b) { return a.timestamp - b.timestamp; });
        return {
            first: snapshots[0],
            latest: snapshots[snapshots.length - 1],
            snapshots: snapshots,
        };
    };
    /**
     * Record a rebalance event
     */
    AnalyticsDataStore.prototype.recordRebalance = function (entry) {
        try {
            var history_1 = this.loadRebalanceHistory();
            history_1.push(entry);
            (0, fs_1.writeFileSync)(this.rebalanceHistoryFile, JSON.stringify(history_1, null, 2));
            console.log(chalk_1.default.green('✓ Rebalance recorded to history'));
        }
        catch (error) {
            console.error(chalk_1.default.red('Error recording rebalance:'), error);
        }
    };
    /**
     * Load rebalance history
     */
    AnalyticsDataStore.prototype.loadRebalanceHistory = function () {
        try {
            var data = (0, fs_1.readFileSync)(this.rebalanceHistoryFile, 'utf-8');
            return JSON.parse(data) || [];
        }
        catch (error) {
            console.error(chalk_1.default.red('Error loading rebalance history:'), error);
            return [];
        }
    };
    /**
     * Get rebalance history for a position
     */
    AnalyticsDataStore.prototype.getPositionRebalanceHistory = function (positionAddress) {
        var history = this.loadRebalanceHistory();
        return history.filter(function (h) { return h.oldPositionAddress === positionAddress || h.newPositionAddress === positionAddress; });
    };
    /**
     * Record a fee claim
     */
    AnalyticsDataStore.prototype.recordFeeClaim = function (record) {
        try {
            var claims = this.loadFeeClaims();
            claims.push(record);
            (0, fs_1.writeFileSync)(this.feeClaimsFile, JSON.stringify(claims, null, 2));
            console.log(chalk_1.default.green('✓ Fee claim recorded to history'));
        }
        catch (error) {
            console.error(chalk_1.default.red('Error recording fee claim:'), error);
        }
    };
    /**
     * Load fee claims
     */
    AnalyticsDataStore.prototype.loadFeeClaims = function () {
        try {
            var data = (0, fs_1.readFileSync)(this.feeClaimsFile, 'utf-8');
            return JSON.parse(data) || [];
        }
        catch (error) {
            console.error(chalk_1.default.red('Error loading fee claims:'), error);
            return [];
        }
    };
    /**
     * Get fee claim history for a position
     */
    AnalyticsDataStore.prototype.getPositionFeeClaims = function (positionAddress, days) {
        if (days === void 0) { days = 30; }
        var claims = this.loadFeeClaims();
        var cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
        return claims.filter(function (c) { return c.positionAddress === positionAddress && c.timestamp >= cutoffTime; });
    };
    /**
     * Calculate portfolio statistics for a time period
     */
    AnalyticsDataStore.prototype.calculatePortfolioStats = function (positionAddresses, days) {
        if (days === void 0) { days = 30; }
        try {
            var snapshots = this.loadSnapshots();
            var cutoffTime_1 = Date.now() - days * 24 * 60 * 60 * 1000;
            var relevantSnapshots = snapshots.filter(function (s) {
                return positionAddresses.includes(s.positionAddress) &&
                    s.timestamp >= cutoffTime_1;
            });
            var totalFees_1 = 0;
            var totalGasCost_1 = 0;
            relevantSnapshots.forEach(function (s) {
                totalFees_1 += s.feesUsdValue;
                totalGasCost_1 += s.gasCostUsd;
            });
            var averageDaily = relevantSnapshots.length > 0 ? totalFees_1 / days : 0;
            return {
                totalFeesEarned: totalFees_1,
                totalGasCosts: totalGasCost_1,
                averageDailyFees: averageDaily,
                positionCount: positionAddresses.length,
                timeframe: "".concat(days, " days"),
            };
        }
        catch (error) {
            console.error(chalk_1.default.red('Error calculating portfolio stats:'), error);
            return {
                totalFeesEarned: 0,
                totalGasCosts: 0,
                averageDailyFees: 0,
                positionCount: 0,
                timeframe: "".concat(days, " days"),
            };
        }
    };
    /**
     * Export data to CSV
     */
    AnalyticsDataStore.prototype.exportToCsv = function (type, filePath) {
        try {
            var csvContent = '';
            var data = [];
            if (type === 'snapshots') {
                data = this.loadSnapshots();
                csvContent = this.snapshotsToCSV(data);
            }
            else if (type === 'rebalances') {
                data = this.loadRebalanceHistory();
                csvContent = this.rebalancesToCSV(data);
            }
            else if (type === 'feeClaims') {
                data = this.loadFeeClaims();
                csvContent = this.feeclaimsToCSV(data);
            }
            (0, fs_1.writeFileSync)(filePath, csvContent, 'utf-8');
            console.log(chalk_1.default.green("\u2713 Data exported to ".concat(filePath)));
        }
        catch (error) {
            console.error(chalk_1.default.red('Error exporting to CSV:'), error);
        }
    };
    /**
     * Convert snapshots to CSV format
     */
    AnalyticsDataStore.prototype.snapshotsToCSV = function (snapshots) {
        var headers = [
            'Timestamp',
            'Position',
            'Pool',
            'Token X Amount',
            'Token Y Amount',
            'USD Value',
            'Fees X',
            'Fees Y',
            'Fees USD',
            'Active Bin',
            'In Range',
            'Pool APR',
            'Gas Cost USD',
            'Time In Range %',
        ];
        var rows = snapshots.map(function (s) { return [
            new Date(s.timestamp).toISOString(),
            s.positionAddress.slice(0, 8) + '...',
            s.poolAddress.slice(0, 8) + '...',
            s.tokenXAmount.toFixed(6),
            s.tokenYAmount.toFixed(2),
            s.usdValue.toFixed(2),
            s.feesXAmount.toFixed(8),
            s.feesYAmount.toFixed(2),
            s.feesUsdValue.toFixed(2),
            s.activeBinId,
            s.inRange ? 'Yes' : 'No',
            s.poolApr.toFixed(2),
            s.gasCostUsd.toFixed(4),
            s.timeInRangePercent.toFixed(1),
        ]; });
        return __spreadArray([headers], rows, true).map(function (row) { return row.join(','); }).join('\n');
    };
    /**
     * Convert rebalances to CSV format
     */
    AnalyticsDataStore.prototype.rebalancesToCSV = function (entries) {
        var headers = [
            'Timestamp',
            'Old Position',
            'New Position',
            'Pool',
            'Reason',
            'Fees Claimed X',
            'Fees Claimed Y',
            'Fees Claimed USD',
            'TX Cost USD',
            'Old Range',
            'New Range',
        ];
        var rows = entries.map(function (e) { return [
            new Date(e.timestamp).toISOString(),
            e.oldPositionAddress.slice(0, 8) + '...',
            e.newPositionAddress.slice(0, 8) + '...',
            e.poolAddress.slice(0, 8) + '...',
            e.reason,
            e.feesClaimedX.toFixed(8),
            e.feesClaimedY.toFixed(2),
            e.feesClaimedUsd.toFixed(2),
            e.transactionCostUsd.toFixed(4),
            "".concat(e.oldRange.min, " to ").concat(e.oldRange.max),
            "".concat(e.newRange.min, " to ").concat(e.newRange.max),
        ]; });
        return __spreadArray([headers], rows, true).map(function (row) { return row.join(','); }).join('\n');
    };
    /**
     * Convert fee claims to CSV format
     */
    AnalyticsDataStore.prototype.feeclaimsToCSV = function (records) {
        var headers = [
            'Timestamp',
            'Position',
            'Pool',
            'Claimed X',
            'Claimed Y',
            'Claimed USD',
            'TX Cost USD',
            'Method',
        ];
        var rows = records.map(function (r) { return [
            new Date(r.timestamp).toISOString(),
            r.positionAddress.slice(0, 8) + '...',
            r.poolAddress.slice(0, 8) + '...',
            r.claimedX.toFixed(8),
            r.claimedY.toFixed(2),
            r.claimedUsd.toFixed(2),
            r.transactionCostUsd.toFixed(4),
            r.method,
        ]; });
        return __spreadArray([headers], rows, true).map(function (row) { return row.join(','); }).join('\n');
    };
    /**
     * Clear old data (older than specified days)
     */
    AnalyticsDataStore.prototype.clearOldData = function (days) {
        if (days === void 0) { days = 90; }
        try {
            var cutoffTime_2 = Date.now() - days * 24 * 60 * 60 * 1000;
            var snapshots = this.loadSnapshots();
            var filtered = snapshots.filter(function (s) { return s.timestamp >= cutoffTime_2; });
            (0, fs_1.writeFileSync)(this.snapshotsFile, JSON.stringify(filtered, null, 2));
            console.log(chalk_1.default.green("\u2713 Cleared analytics data older than ".concat(days, " days")));
        }
        catch (error) {
            console.error(chalk_1.default.red('Error clearing old data:'), error);
        }
    };
    /**
     * Record volume snapshot for a pool
     */
    AnalyticsDataStore.prototype.recordVolumeSnapshot = function (snapshot) {
        try {
            var poolFile = (0, path_1.join)(this.dataDir, "volume-".concat(snapshot.poolAddress, ".json"));
            var snapshots = [];
            if ((0, fs_1.existsSync)(poolFile)) {
                var data = (0, fs_1.readFileSync)(poolFile, 'utf-8');
                snapshots = JSON.parse(data) || [];
            }
            snapshots.push(snapshot);
            // Keep 7 days
            var sevenDaysAgo_1 = Date.now() - 7 * 24 * 60 * 60 * 1000;
            var filtered = snapshots.filter(function (s) { return s.timestamp >= sevenDaysAgo_1; });
            (0, fs_1.writeFileSync)(poolFile, JSON.stringify(filtered, null, 2));
        }
        catch (error) {
            console.warn('Error recording volume snapshot:', error);
        }
    };
    /**
     * Load volume snapshots for a pool
     */
    AnalyticsDataStore.prototype.loadVolumeSnapshots = function (poolAddress, days) {
        if (days === void 0) { days = 7; }
        try {
            var poolFile = (0, path_1.join)(this.dataDir, "volume-".concat(poolAddress, ".json"));
            if (!(0, fs_1.existsSync)(poolFile))
                return [];
            var data = (0, fs_1.readFileSync)(poolFile, 'utf-8');
            var all = JSON.parse(data) || [];
            var cutoff_1 = Date.now() - days * 24 * 60 * 60 * 1000;
            return all.filter(function (s) { return s.timestamp >= cutoff_1; });
        }
        catch (_a) {
            return [];
        }
    };
    /**
     * Get volume trend for a pool
     */
    AnalyticsDataStore.prototype.getVolumeTrend = function (poolAddress) {
        var snapshots = this.loadVolumeSnapshots(poolAddress, 7);
        return (0, volumeTracking_service_1.getVolumeTrend)(snapshots);
    };
    /**
     * Record an LLM decision for learning
     */
    AnalyticsDataStore.prototype.recordLLMDecision = function (log) {
        try {
            var llmDecisionsFile = (0, path_1.join)(this.dataDir, 'llm-decisions.json');
            var decisions = this.loadLLMDecisions();
            decisions.push(log);
            // Keep 90 days
            var ninetyDaysAgo_2 = Date.now() - 90 * 24 * 60 * 60 * 1000;
            var filtered = decisions.filter(function (d) { return d.timestamp >= ninetyDaysAgo_2; });
            (0, fs_1.writeFileSync)(llmDecisionsFile, JSON.stringify(filtered, null, 2));
        }
        catch (error) {
            console.error(chalk_1.default.red('Error recording LLM decision:'), error);
        }
    };
    /**
     * Load all LLM decisions
     */
    AnalyticsDataStore.prototype.loadLLMDecisions = function () {
        try {
            var llmDecisionsFile = (0, path_1.join)(this.dataDir, 'llm-decisions.json');
            if (!(0, fs_1.existsSync)(llmDecisionsFile))
                return [];
            var data = (0, fs_1.readFileSync)(llmDecisionsFile, 'utf-8');
            return JSON.parse(data) || [];
        }
        catch (_a) {
            return [];
        }
    };
    return AnalyticsDataStore;
}());
exports.AnalyticsDataStore = AnalyticsDataStore;
// Singleton helpers
var analyticsDataStoreInstance = null;
var analyticsDataDir;
function getAnalyticsDataStore(dataDir) {
    if (!analyticsDataStoreInstance || (dataDir && dataDir !== analyticsDataDir)) {
        analyticsDataDir = dataDir;
        analyticsDataStoreInstance = new AnalyticsDataStore(dataDir);
    }
    return analyticsDataStoreInstance;
}
exports.analyticsDataStore = getAnalyticsDataStore();
