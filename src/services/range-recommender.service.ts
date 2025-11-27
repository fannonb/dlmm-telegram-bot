import { StrategyType } from '@meteora-ag/dlmm';
import { PoolInfo } from '../config/types';
import { oracleService } from './oracle.service';

export type SupportedStrategy = 'Spot' | 'Curve' | 'BidAsk';

export interface VolumeNode {
  price: number;
  weight: number; // relative weight (0-1)
}

export interface SideDepthNode extends VolumeNode {
  binId: number;
}

export interface RangeRecommendationContext {
  poolPrice?: number;
  oraclePrice?: number | null;
  volatilityScore?: number; // 0-0.5 range
  volumeBias?: -1 | 0 | 1;
  volumeNodes?: VolumeNode[];
  recentHighPrice?: number;
  recentLowPrice?: number;
  atrPercent?: number;
  bidCoverageNodes?: SideDepthNode[];
  askCoverageNodes?: SideDepthNode[];
}

export interface RangeRecommendation {
  strategy: SupportedStrategy;
  recommendedBinsPerSide?: number;
  recommendedBidBins?: number;
  recommendedAskBins?: number;
  minBinId: number;
  maxBinId: number;
  centerBin: number;
  rationale: string[];
  metrics: {
    volatilityScore: number;
    priceDeviation: number;
    volumeBias: -1 | 0 | 1;
  };
}

class RangeRecommenderService {
  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private computeVolatilityScore(
    poolInfo: PoolInfo,
    ctx?: RangeRecommendationContext
  ): number {
    if (typeof ctx?.volatilityScore === 'number') {
      return this.clamp(ctx.volatilityScore, 0.02, 0.35);
    }

    if (ctx?.recentHighPrice && ctx?.recentLowPrice && ctx.recentLowPrice > 0) {
      const highLowSpread = (ctx.recentHighPrice - ctx.recentLowPrice) / ctx.recentLowPrice;
      if (highLowSpread > 0) {
        return this.clamp(highLowSpread, 0.03, 0.35);
      }
    }

    if (poolInfo.volume24h && poolInfo.tvl && poolInfo.tvl > 0) {
      const turnoverRatio = poolInfo.volume24h / poolInfo.tvl;
      return this.clamp(turnoverRatio * 0.15, 0.025, 0.3);
    }

    return 0.06; // default mild volatility when no data is present
  }

  private computeVolumeBias(
    poolPrice: number,
    ctx?: RangeRecommendationContext
  ): -1 | 0 | 1 {
    if (typeof ctx?.volumeBias === 'number') {
      return ctx.volumeBias;
    }

    if (ctx?.volumeNodes?.length) {
      const higherWeight = ctx.volumeNodes
        .filter((node) => node.price > poolPrice)
        .reduce((sum, node) => sum + node.weight, 0);
      const lowerWeight = ctx.volumeNodes
        .filter((node) => node.price < poolPrice)
        .reduce((sum, node) => sum + node.weight, 0);

      if (higherWeight > lowerWeight * 1.2) return 1;
      if (lowerWeight > higherWeight * 1.2) return -1;
    }

    return 0;
  }

  private deriveCoverageSpan(
    nodes: SideDepthNode[] | undefined,
    activeBin: number,
    targetCoverage: number,
    fallbackBins: number,
    minBins: number,
    maxBins: number
  ): number {
    if (!nodes || nodes.length === 0) {
      return this.clamp(fallbackBins, minBins, maxBins);
    }

    const sorted = [...nodes].sort(
      (a, b) => Math.abs(a.binId - activeBin) - Math.abs(b.binId - activeBin)
    );

    let coverage = 0;
    let furthestDistance = 0;
    for (const node of sorted) {
      coverage += node.weight;
      furthestDistance = Math.max(furthestDistance, Math.abs(node.binId - activeBin));
      if (coverage >= targetCoverage) {
        break;
      }
    }

    if (furthestDistance === 0) {
      furthestDistance = fallbackBins;
    }

    return this.clamp(Math.max(1, furthestDistance), minBins, maxBins);
  }

  private async resolveOraclePrice(poolInfo: PoolInfo): Promise<number | null> {
    try {
      return await oracleService.getPriceRatio(
        poolInfo.tokenX.mint,
        poolInfo.tokenY.mint
      );
    } catch (error) {
      console.warn('Failed to fetch oracle price for recommendation:', error);
      return null;
    }
  }

  public async suggestRange(
    strategy: SupportedStrategy | StrategyType,
    poolInfo: PoolInfo,
    context?: RangeRecommendationContext
  ): Promise<RangeRecommendation> {
    const strategyKey: SupportedStrategy =
      strategy === StrategyType.Spot || strategy === 'Spot'
        ? 'Spot'
        : strategy === StrategyType.Curve || strategy === 'Curve'
          ? 'Curve'
          : 'BidAsk';

    const activeBin = poolInfo.activeBin;
    if (typeof activeBin !== 'number') {
      throw new Error('Pool info is missing active bin data.');
    }

    const binStep = poolInfo.binStep || 1;
    const poolPrice = context?.poolPrice ?? poolInfo.price ?? 1;
    const oraclePrice =
      context?.oraclePrice ?? (await this.resolveOraclePrice(poolInfo));

    const volatilityScore = this.computeVolatilityScore(poolInfo, context);
    const priceDeviation = oraclePrice
      ? Math.abs(poolPrice - oraclePrice) / Math.max(oraclePrice, 1e-9)
      : 0;
    const volumeBias = this.computeVolumeBias(poolPrice, context);
    
    // Determine pair type for appropriate range sizing
    const tokenXSymbol = poolInfo.tokenX?.symbol || '';
    const tokenYSymbol = poolInfo.tokenY?.symbol || '';
    const stableSymbols = ['USDC', 'USDT', 'DAI', 'PYUSD'];
    const memeTokens = ['BONK', 'WIF', 'POPCAT', 'BOME', 'MEW', 'MYRO', 'SLERF', 'TRUMP'];
    const isStablePair = stableSymbols.includes(tokenXSymbol) && stableSymbols.includes(tokenYSymbol);
    const isMemeToken = memeTokens.includes(tokenXSymbol) || memeTokens.includes(tokenYSymbol);
    const hasStable = stableSymbols.includes(tokenXSymbol) || stableSymbols.includes(tokenYSymbol);
    
    // Set minimum bins based on pair type
    const pairMinBins = isStablePair ? 10 : isMemeToken ? 80 : hasStable ? 50 : 30;

    switch (strategyKey) {
      case 'Spot':
        return this.buildSpotRecommendation({
          activeBin,
          binStep,
          volatilityScore,
          priceDeviation,
          volumeBias,
          pairMinBins,
        });
      case 'Curve':
        return this.buildCurveRecommendation({
          activeBin,
          binStep,
          volatilityScore,
          priceDeviation,
          volumeBias,
          pairMinBins,
        });
      case 'BidAsk':
      default:
        return this.buildBidAskRecommendation({
          activeBin,
          binStep,
          volatilityScore,
          priceDeviation,
          volumeBias,
          bidCoverageNodes: context?.bidCoverageNodes,
          askCoverageNodes: context?.askCoverageNodes,
          atrPercent: context?.atrPercent,
          pairMinBins,
        });
    }
  }

  private buildSpotRecommendation(args: {
    activeBin: number;
    binStep: number;
    volatilityScore: number;
    priceDeviation: number;
    volumeBias: -1 | 0 | 1;
    pairMinBins: number;
  }): RangeRecommendation {
    // Base calculation plus volatility adjustment
    // Max 34 bins per side (69 total) due to Meteora DLMM single-transaction limit
    const MAX_BINS_PER_SIDE = 34;
    let binsPerSide = Math.round(args.pairMinBins + args.volatilityScore * 20);
    binsPerSide = this.clamp(binsPerSide, args.pairMinBins, MAX_BINS_PER_SIDE);
    if (args.priceDeviation > 0.25) binsPerSide = Math.min(binsPerSide + 3, MAX_BINS_PER_SIDE);

    const minBinId = args.activeBin - binsPerSide;
    const maxBinId = args.activeBin + binsPerSide;

    const rationale = [
      `Base bins adjusted for volatility (${(args.volatilityScore * 100).toFixed(1)}%)`,
      args.priceDeviation > 0.25
        ? 'Expanded band because pool price deviates >25% from oracle'
        : 'Tight band keeps liquidity near active bin for fee capture',
    ];

    if (args.volumeBias !== 0) {
      rationale.push(
        args.volumeBias > 0
          ? 'Upper volume concentration detected → keep slightly more room above'
          : 'Lower volume concentration detected → keep slightly more room below'
      );
    }

    return {
      strategy: 'Spot',
      recommendedBinsPerSide: binsPerSide,
      minBinId,
      maxBinId,
      centerBin: args.activeBin,
      rationale,
      metrics: {
        volatilityScore: args.volatilityScore,
        priceDeviation: args.priceDeviation,
        volumeBias: args.volumeBias,
      },
    };
  }

  private buildCurveRecommendation(args: {
    activeBin: number;
    binStep: number;
    volatilityScore: number;
    priceDeviation: number;
    volumeBias: -1 | 0 | 1;
    pairMinBins: number;
  }): RangeRecommendation {
    // For stablecoins, Curve strategy can use tighter ranges
    // For volatile pairs, still need reasonable width
    // Max 34 bins per side (69 total) due to Meteora DLMM single-transaction limit
    const MAX_BINS_PER_SIDE = 34;
    const baseMin = Math.max(args.pairMinBins, 20);
    let binsPerSide = Math.round(baseMin + args.volatilityScore * 25);
    binsPerSide = this.clamp(binsPerSide, baseMin, MAX_BINS_PER_SIDE);

    const centerShift = Math.round(args.volumeBias * Math.max(1, args.priceDeviation * 10));
    const minBinId = args.activeBin - binsPerSide + Math.min(centerShift, 0);
    const maxBinId = args.activeBin + binsPerSide + Math.max(centerShift, 0);

    const rationale = [
      `Wide Curve band sized to ${(binsPerSide * args.binStep * 2 / 100).toFixed(2)}% price span`,
      `Volatility score ${(args.volatilityScore * 100).toFixed(1)}% set the baseline width`,
    ];

    if (centerShift !== 0) {
      rationale.push(
        centerShift > 0
          ? 'Shifted upward due to heavier sell-side volume / bullish bias'
          : 'Shifted downward due to heavier buy-side volume / bearish bias'
      );
    }

    if (args.priceDeviation > 0.5) {
      rationale.push('Oracle deviation >50% so coverage extends to mean-reversion zone');
    }

    return {
      strategy: 'Curve',
      recommendedBinsPerSide: binsPerSide,
      minBinId,
      maxBinId,
      centerBin: args.activeBin + centerShift,
      rationale,
      metrics: {
        volatilityScore: args.volatilityScore,
        priceDeviation: args.priceDeviation,
        volumeBias: args.volumeBias,
      },
    };
  }

  private buildBidAskRecommendation(args: {
    activeBin: number;
    binStep: number;
    volatilityScore: number;
    priceDeviation: number;
    volumeBias: -1 | 0 | 1;
    bidCoverageNodes?: SideDepthNode[];
    askCoverageNodes?: SideDepthNode[];
    atrPercent?: number;
    pairMinBins: number;
  }): RangeRecommendation {
    // Use pair-aware minimums
    // Max 34 bins per side (69 total) due to Meteora DLMM single-transaction limit
    const MAX_BINS_PER_SIDE = 34;
    const minBidBins = Math.max(args.pairMinBins, 15);
    const minAskBins = Math.max(args.pairMinBins, 15);
    
    const fallbackBid = this.clamp(Math.round(minBidBins + args.volatilityScore * 15), minBidBins, MAX_BINS_PER_SIDE);
    const fallbackAsk = this.clamp(Math.round(minAskBins + args.volatilityScore * 15), minAskBins, MAX_BINS_PER_SIDE);
    const atrAdj = args.atrPercent !== undefined
      ? args.atrPercent > 0.02
        ? 0.15
        : args.atrPercent < 0.008
          ? -0.15
          : 0
      : 0;

    const bidTarget = this.clamp(0.55 + atrAdj - (args.volumeBias < 0 ? 0.1 : 0), 0.35, 0.9);
    const askTarget = this.clamp(0.65 + atrAdj + (args.volumeBias > 0 ? 0.1 : 0), 0.4, 0.95);

    const bidBins = this.deriveCoverageSpan(
      args.bidCoverageNodes,
      args.activeBin,
      bidTarget,
      fallbackBid,
      minBidBins,
      MAX_BINS_PER_SIDE
    );

    const askBins = this.deriveCoverageSpan(
      args.askCoverageNodes,
      args.activeBin,
      askTarget,
      fallbackAsk,
      minAskBins,
      MAX_BINS_PER_SIDE
    );
    const directionalShift = Math.round((args.priceDeviation * 10 + 1) * args.volumeBias);

    const minBinId = args.activeBin - bidBins - Math.min(directionalShift, 0);
    const maxBinId = args.activeBin + askBins + Math.max(directionalShift, 0);

    const rationale = [
      `Bid side spans ${bidBins} bins to cover ~${(bidTarget * 100).toFixed(0)}% of VPVR depth`,
      `Ask side spans ${askBins} bins to cover ~${(askTarget * 100).toFixed(0)}% of VPVR depth`,
      `Volatility score ${(args.volatilityScore * 100).toFixed(1)}% set directional spread`,
    ];

    if (directionalShift > 0) {
      rationale.push('Bias toward higher bins (expecting upward move) based on volume profile');
    } else if (directionalShift < 0) {
      rationale.push('Bias toward lower bins (expecting pullback) based on volume profile');
    }

    if (args.priceDeviation > 0.5) {
      rationale.push('Large oracle deviation → capture arbitrage window across range');
    }

      if (args.atrPercent !== undefined) {
        rationale.push(
          args.atrPercent > 0.02
            ? 'ATR expanding → widened coverage targets to capture swings'
            : args.atrPercent < 0.008
              ? 'ATR contracting → trimmed coverage for tighter fills'
              : 'ATR flat → using neutral coverage targets'
        );
      }

    return {
      strategy: 'BidAsk',
      recommendedBidBins: bidBins,
      recommendedAskBins: askBins,
      minBinId,
      maxBinId,
      centerBin: args.activeBin,
      rationale,
      metrics: {
        volatilityScore: args.volatilityScore,
        priceDeviation: args.priceDeviation,
        volumeBias: args.volumeBias,
      },
    };
  }
}

export const rangeRecommenderService = new RangeRecommenderService();
