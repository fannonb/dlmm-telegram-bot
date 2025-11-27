import { UserPosition } from './position.service';
import { AnalyticsSnapshot } from './analyticsDataStore.service';

/**
 * Calculate fee performance metrics for a position
 */
export function calculateFeePerformance(
    position: UserPosition,
    snapshot: AnalyticsSnapshot
): AnalyticsSnapshot['feePerformance'] {
    // Calculate expected daily fees based on APR
    const apr = (snapshot.poolApr || 0) / 100;
    const expectedDaily = (snapshot.usdValue * apr) / 365;

    // Actual daily fees from snapshot
    const actualDaily = snapshot.feesUsdValue;

    // Efficiency = actual / expected (%)
    const efficiency = expectedDaily > 0 ? (actualDaily / expectedDaily) * 100 : 0;

    // Distance to edge (bins until out of range)
    const distanceToEdge = Math.min(
        snapshot.activeBinId - position.lowerBinId,
        position.upperBinId - snapshot.activeBinId
    );

    return {
        expectedDailyFeesUsd: expectedDaily,
        actualDailyFeesUsd: actualDaily,
        efficiency,
        distanceToEdge
    };
}
