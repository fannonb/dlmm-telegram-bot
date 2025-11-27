import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface VolumeSnapshot {
    timestamp: number;
    poolAddress: string;
    volume24h: number;
    fees24h: number;
    volumeRatio: number;
}

/**
 * Volume trend analysis
 */
export function getVolumeTrend(snapshots: VolumeSnapshot[]): 'increasing' | 'decreasing' | 'stable' {
    if (snapshots.length < 3) return 'stable';

    // Get last 3 snapshots
    const recent = snapshots.slice(-3).map(s => s.volume24h);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;

    // Simple linear regression
    const slope = (recent[2] - recent[0]) / 2;

    // Classify based on slope relative to average
    if (slope > avg * 0.1) return 'increasing';
    if (slope < -avg * 0.1) return 'decreasing';
    return 'stable';
}

/**
 * Add volume snapshot methods to AnalyticsDataStore
 */
export interface VolumeSnapshotMethods {
    recordVolumeSnapshot(snapshot: VolumeSnapshot): void;
    loadVolumeSnapshots(poolAddress: string, days?: number): VolumeSnapshot[];
    getVolumeTrend(poolAddress: string): 'increasing' | 'decreasing' | 'stable';
}

export function addVolumeSnapshotMethods(dataDir: string) {
    return {
        /**
         * Record a volume snapshot for a pool
         */
        recordVolumeSnapshot(snapshot: VolumeSnapshot): void {
            try {
                const poolFile = join(dataDir, `volume-${snapshot.poolAddress}.json`);

                // Load existing snapshots
                let snapshots: VolumeSnapshot[] = [];
                if (existsSync(poolFile)) {
                    const data = readFileSync(poolFile, 'utf-8');
                    snapshots = JSON.parse(data) || [];
                }

                // Add new snapshot
                snapshots.push(snapshot);

                // Keep only 7 days
                const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const filtered = snapshots.filter(s => s.timestamp >= sevenDaysAgo);

                // Save
                writeFileSync(poolFile, JSON.stringify(filtered, null, 2));
            } catch (error) {
                console.warn('Error recording volume snapshot:', error);
            }
        },

        /**
         * Load volume snapshots for a pool
         */
        loadVolumeSnapshots(poolAddress: string, days = 7): VolumeSnapshot[] {
            try {
                const poolFile = join(dataDir, `volume-${poolAddress}.json`);
                if (!existsSync(poolFile)) return [];

                const data = readFileSync(poolFile, 'utf-8');
                const all = JSON.parse(data) || [];

                const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
                return all.filter((s: VolumeSnapshot) => s.timestamp >= cutoff);
            } catch {
                return [];
            }
        },

        /**
         * Get volume trend for a pool
         */
        getVolumeTrend(poolAddress: string): 'increasing' | 'decreasing' | 'stable' {
            const snapshots = this.loadVolumeSnapshots(poolAddress, 7);
            return getVolumeTrend(snapshots);
        }
    };
}
