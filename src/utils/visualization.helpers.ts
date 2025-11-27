export interface DistributionMapOptions {
    lowerBinId: number;
    upperBinId: number;
    activeBinId: number;
    totalValueUsd?: number;
    sampleCount?: number;
    barWidth?: number;
    priceResolver?: (binId: number) => number | undefined;
}

interface DistributionPoint {
    binId: number;
    weight: number;
    price?: number;
    notionalUsd?: number;
}

const DEFAULT_SAMPLE_COUNT = 11;
const DEFAULT_BAR_WIDTH = 24;

/**
 * Build an ASCII-ready distribution map showing liquidity concentration per bin.
 */
export function buildAsciiBinDistribution(options: DistributionMapOptions): string[] {
    const points = generateDistributionPoints(options);
    if (points.length === 0) {
        return ['(no bins to visualize)'];
    }

    const width = options.barWidth ?? DEFAULT_BAR_WIDTH;
    const maxWeight = Math.max(...points.map(point => point.weight), 1);

    return points.map(point => {
        const fillLength = Math.max(1, Math.round((point.weight / maxWeight) * width));
        const isActive = point.binId === options.activeBinId;
        const barChar = isActive ? '#'.repeat(fillLength) : '='.repeat(fillLength);
        const paddedBar = barChar.padEnd(width, '.');
        const relative = point.binId - options.activeBinId;
        const binLabel = relative === 0 ? 'Bin   0' : `Bin ${relative > 0 ? '+' : ''}${relative}`;
        const priceLabel = point.price !== undefined ? `$${point.price.toFixed(6)}` : 'price n/a';
        const notionalLabel = point.notionalUsd !== undefined ? `$${point.notionalUsd.toFixed(2)}` : '';
        return `${binLabel.padEnd(10)} ${paddedBar}  ${priceLabel.padEnd(14)} ${notionalLabel}`.trimEnd();
    });
}

function generateDistributionPoints(options: DistributionMapOptions): DistributionPoint[] {
    const span = options.upperBinId - options.lowerBinId;
    if (span <= 0) {
        return [];
    }

    const sampleCount = Math.max(3, options.sampleCount ?? DEFAULT_SAMPLE_COUNT);
    const step = Math.max(1, Math.floor(span / (sampleCount - 1)));
    const sigma = Math.max(span / 4, 1);
    const weights: DistributionPoint[] = [];

    for (let bin = options.lowerBinId; bin <= options.upperBinId; bin += step) {
        const distance = bin - options.activeBinId;
        const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));
        const price = options.priceResolver ? options.priceResolver(bin) : undefined;
        weights.push({ binId: bin, weight, price });
    }

    const weightSum = weights.reduce((sum, point) => sum + point.weight, 0) || 1;
    const totalValue = options.totalValueUsd ?? 0;
    return weights.map(point => ({
        ...point,
        notionalUsd: totalValue > 0 ? (point.weight / weightSum) * totalValue : undefined,
    }));
}
