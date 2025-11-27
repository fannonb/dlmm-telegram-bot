"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVolumeTrend = getVolumeTrend;
exports.addVolumeSnapshotMethods = addVolumeSnapshotMethods;
var fs_1 = require("fs");
var path_1 = require("path");
/**
 * Volume trend analysis
 */
function getVolumeTrend(snapshots) {
    if (snapshots.length < 3)
        return 'stable';
    // Get last 3 snapshots
    var recent = snapshots.slice(-3).map(function (s) { return s.volume24h; });
    var avg = recent.reduce(function (a, b) { return a + b; }, 0) / recent.length;
    // Simple linear regression
    var slope = (recent[2] - recent[0]) / 2;
    // Classify based on slope relative to average
    if (slope > avg * 0.1)
        return 'increasing';
    if (slope < -avg * 0.1)
        return 'decreasing';
    return 'stable';
}
function addVolumeSnapshotMethods(dataDir) {
    return {
        /**
         * Record a volume snapshot for a pool
         */
        recordVolumeSnapshot: function (snapshot) {
            try {
                var poolFile = (0, path_1.join)(dataDir, "volume-".concat(snapshot.poolAddress, ".json"));
                // Load existing snapshots
                var snapshots = [];
                if ((0, fs_1.existsSync)(poolFile)) {
                    var data = (0, fs_1.readFileSync)(poolFile, 'utf-8');
                    snapshots = JSON.parse(data) || [];
                }
                // Add new snapshot
                snapshots.push(snapshot);
                // Keep only 7 days
                var sevenDaysAgo_1 = Date.now() - 7 * 24 * 60 * 60 * 1000;
                var filtered = snapshots.filter(function (s) { return s.timestamp >= sevenDaysAgo_1; });
                // Save
                (0, fs_1.writeFileSync)(poolFile, JSON.stringify(filtered, null, 2));
            }
            catch (error) {
                console.warn('Error recording volume snapshot:', error);
            }
        },
        /**
         * Load volume snapshots for a pool
         */
        loadVolumeSnapshots: function (poolAddress, days) {
            if (days === void 0) { days = 7; }
            try {
                var poolFile = (0, path_1.join)(dataDir, "volume-".concat(poolAddress, ".json"));
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
        },
        /**
         * Get volume trend for a pool
         */
        getVolumeTrend: function (poolAddress) {
            var snapshots = this.loadVolumeSnapshots(poolAddress, 7);
            return getVolumeTrend(snapshots);
        }
    };
}
