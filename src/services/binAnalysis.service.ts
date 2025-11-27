import { PublicKey } from '@solana/web3.js';
import { poolService } from './pool.service';
import { UserPosition } from './position.service';

export interface BinUtilizationMetrics {
    totalBins: number;
    activeBins: number;
    utilizationPercent: number;
    avgLiquidityPerBin: number;
    liquidityConcentration: number;
}

/**
 * Analyze bin-level liquidity distribution for a position
 */
export async function calculateBinUtilization(
    position: UserPosition
): Promise<BinUtilizationMetrics> {
    try {
        const dlmm = await poolService.getDlmmInstance(position.poolAddress);
        const range = position.upperBinId - position.lowerBinId + 1;

        // Calculate how many bins to fetch on each side
        const binsBelow = Math.min(position.activeBinId - position.lowerBinId, 50);
        const binsAbove = Math.min(position.upperBinId - position.activeBinId, 50);

        // Fetch bins around active bin
        const { bins } = await dlmm.getBinsAroundActiveBin(binsBelow, binsAbove);

        // Filter to exact position range
        const binsInRange = bins.filter(b =>
            b.binId >= position.lowerBinId &&
            b.binId <= position.upperBinId
        );

        // Count bins with liquidity (either X or Y amount > 0)
        const activeBinsData = binsInRange.filter(b =>
            !b.xAmount.isZero() || !b.yAmount.isZero()
        );

        // Calculate total liquidity (rough estimate in native units)
        let totalLiquidity = 0;
        const liquidityByBin: number[] = [];

        binsInRange.forEach(b => {
            const xLiq = b.xAmount.toNumber();
            const yLiq = b.yAmount.toNumber();
            const binLiq = xLiq + yLiq;

            totalLiquidity += binLiq;
            if (binLiq > 0) {
                liquidityByBin.push(binLiq);
            }
        });

        // Calculate average liquidity per active bin
        const avgLiquidityPerBin = activeBinsData.length > 0
            ? totalLiquidity / activeBinsData.length
            : 0;

        // Calculate concentration (Gini coefficient)
        const liquidityConcentration = calculateGiniCoefficient(liquidityByBin);

        return {
            totalBins: range,
            activeBins: activeBinsData.length,
            utilizationPercent: (activeBinsData.length / range) * 100,
            avgLiquidityPerBin,
            liquidityConcentration
        };
    } catch (error) {
        console.warn('Error calculating bin utilization:', error);

        // Return default values on error
        return {
            totalBins: position.upperBinId - position.lowerBinId + 1,
            activeBins: 0,
            utilizationPercent: 0,
            avgLiquidityPerBin: 0,
            liquidityConcentration: 0
        };
    }
}

/**
 * Calculate Gini coefficient for liquidity concentration
 * 0 = perfectly distributed, 1 = all liquidity in one bin
 */
function calculateGiniCoefficient(values: number[]): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return 0;

    // Sort values
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const total = sorted.reduce((sum, val) => sum + val, 0);

    if (total === 0) return 0;

    // Calculate Gini
    let sumOfDifferences = 0;
    for (let i = 0; i < n; i++) {
        sumOfDifferences += (2 * (i + 1) - n - 1) * sorted[i];
    }

    const gini = sumOfDifferences / (n * total);
    return Math.abs(gini);
}
