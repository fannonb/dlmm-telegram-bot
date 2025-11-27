import { PoolInfo } from '../config/types';
import { poolService } from './pool.service';
import { oracleService, PricePoint } from './oracle.service';
import { RangeRecommendationContext, VolumeNode, SideDepthNode } from './range-recommender.service';

interface BuildContextOptions {
  binsToSample?: number;
}

class MarketContextService {
  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private computeAtrPercent(series: PricePoint[]): number | undefined {
    if (series.length < 2) {
      return undefined;
    }
    let trSum = 0;
    for (let i = 1; i < series.length; i++) {
      trSum += Math.abs(series[i].price - series[i - 1].price);
    }
    const atr = trSum / (series.length - 1);
    const referencePrice = series[series.length - 1].price;
    if (!referencePrice || referencePrice <= 0) {
      return undefined;
    }
    return atr / referencePrice;
  }

  private computeSeriesVolatility(series: PricePoint[]): number | undefined {
    if (!series.length) {
      return undefined;
    }
    const prices = series.map((point) => point.price).filter((price) => price > 0);
    if (!prices.length) {
      return undefined;
    }
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    if (!Number.isFinite(high) || !Number.isFinite(low) || low <= 0) {
      return undefined;
    }
    const spread = (high - low) / Math.max(low, 1e-9);
    return this.clamp(spread, 0.02, 0.5);
  }

  private async getPriceRatioSeries(poolInfo: PoolInfo, hours = 6): Promise<PricePoint[] | null> {
    const [tokenXSeries, tokenYSeries] = await Promise.all([
      oracleService.getUsdPriceSeries(poolInfo.tokenX.mint, hours),
      oracleService.getUsdPriceSeries(poolInfo.tokenY.mint, hours),
    ]);

    if (!tokenXSeries || !tokenYSeries || tokenXSeries.length < 2 || tokenYSeries.length < 2) {
      return null;
    }

    const length = Math.min(tokenXSeries.length, tokenYSeries.length);
    const ratioSeries: PricePoint[] = [];

    for (let i = 0; i < length; i++) {
      const priceX = tokenXSeries[i].price;
      const priceY = tokenYSeries[i].price;
      if (!priceX || !priceY || priceY <= 0) {
        continue;
      }
      ratioSeries.push({
        timestamp: Math.min(tokenXSeries[i].timestamp, tokenYSeries[i].timestamp),
        price: priceX / priceY,
      });
    }

    return ratioSeries.length >= 2 ? ratioSeries : null;
  }

  public async buildRangeContext(
    poolInfo: PoolInfo,
    options?: BuildContextOptions
  ): Promise<RangeRecommendationContext> {
    const binsToSample = options?.binsToSample ?? 24;
    try {
      const dlmm = await poolService.getDlmmInstance(poolInfo.address);
      const { bins } = await dlmm.getBinsAroundActiveBin(binsToSample, binsToSample);

      const tokenXDecimals = poolInfo.tokenX.decimals || 6;
      const tokenYDecimals = poolInfo.tokenY.decimals || 6;

      const usdPrices = await oracleService.getUsdPrices([
        poolInfo.tokenX.mint,
        poolInfo.tokenY.mint,
      ]);
      const tokenXUsd = usdPrices.get(poolInfo.tokenX.mint) ?? null;
      const tokenYUsd = usdPrices.get(poolInfo.tokenY.mint) ?? null;

      let recentHighPrice = 0;
      let recentLowPrice = Number.POSITIVE_INFINITY;

      const nodes: VolumeNode[] = [];
      const priceSamples: number[] = [];
      const bidDepthNodes: SideDepthNode[] = [];
      const askDepthNodes: SideDepthNode[] = [];

      bins.forEach((bin) => {
        const price = poolService.calculateBinPrice(
          bin.binId,
          poolInfo.binStep,
          tokenXDecimals,
          tokenYDecimals
        );
        if (!Number.isFinite(price) || price <= 0) {
          return;
        }

        priceSamples.push(price);

        recentHighPrice = Math.max(recentHighPrice, price);
        recentLowPrice = Math.min(recentLowPrice, price);

        const xAmount = Number(bin.xAmount.toString()) / Math.pow(10, tokenXDecimals);
        const yAmount = Number(bin.yAmount.toString()) / Math.pow(10, tokenYDecimals);

        let usdWeight = 0;
        if (tokenXUsd) {
          usdWeight += xAmount * tokenXUsd;
        }
        if (tokenYUsd) {
          usdWeight += yAmount * tokenYUsd;
        }

        // If one side missing USD quote, derive using pool price ratio
        if (!tokenXUsd && tokenYUsd) {
          usdWeight += xAmount * price * tokenYUsd;
        }
        if (!tokenYUsd && tokenXUsd && price !== 0) {
          usdWeight += yAmount * (tokenXUsd / price);
        }

        if (usdWeight > 0) {
          nodes.push({ price, weight: usdWeight });
          const depthNode: SideDepthNode = { price, weight: usdWeight, binId: bin.binId };
          if (poolInfo.activeBin !== undefined && bin.binId <= poolInfo.activeBin) {
            bidDepthNodes.push(depthNode);
          } else {
            askDepthNodes.push(depthNode);
          }
        }
      });

      nodes.sort((a, b) => b.weight - a.weight);
      const topNodes = nodes.slice(0, 5);
      const totalWeight = topNodes.reduce((sum, node) => sum + node.weight, 0) || 1;
      const normalizedNodes: VolumeNode[] = topNodes.map((node) => ({
        price: node.price,
        weight: node.weight / totalWeight,
      }));

      const context: RangeRecommendationContext = {
        volumeNodes: normalizedNodes,
      };

      try {
        const ratioSeries = await this.getPriceRatioSeries(poolInfo, 6);
        if (ratioSeries?.length) {
          const volatilityFromSeries = this.computeSeriesVolatility(ratioSeries);
          if (typeof volatilityFromSeries === 'number') {
            context.volatilityScore = volatilityFromSeries;
          }

          const atrPercent = this.computeAtrPercent(ratioSeries);
          if (typeof atrPercent === 'number') {
            context.atrPercent = atrPercent;
          }

          const seriesPrices = ratioSeries.map((point) => point.price);
          const seriesHigh = Math.max(...seriesPrices);
          const seriesLow = Math.min(...seriesPrices);
          if (Number.isFinite(seriesHigh) && Number.isFinite(seriesLow)) {
            context.recentHighPrice = seriesHigh;
            context.recentLowPrice = seriesLow;
          }
        }
      } catch (seriesError) {
        console.warn('Failed to fetch historical price series:', seriesError);
      }

      if (
        (context.recentHighPrice === undefined || context.recentLowPrice === undefined) &&
        recentHighPrice > 0 &&
        recentLowPrice !== Number.POSITIVE_INFINITY
      ) {
        context.recentHighPrice = recentHighPrice;
        context.recentLowPrice = recentLowPrice;
      }

      if (context.volatilityScore === undefined && recentHighPrice > 0 && recentLowPrice !== Number.POSITIVE_INFINITY) {
        const spread = (recentHighPrice - recentLowPrice) / Math.max(recentLowPrice, 1e-9);
        context.volatilityScore = Math.min(Math.max(spread, 0.02), 0.5);
      }

      if (context.atrPercent === undefined && priceSamples.length > 1) {
        let trueRangeSum = 0;
        for (let i = 1; i < priceSamples.length; i++) {
          trueRangeSum += Math.abs(priceSamples[i] - priceSamples[i - 1]);
        }
        const atr = trueRangeSum / (priceSamples.length - 1);
        const fallbackBinId = poolInfo.activeBin ?? bins[Math.floor(bins.length / 2)]?.binId ?? 0;
        const referencePrice = poolInfo.price
          ?? (fallbackBinId
            ? poolService.calculateBinPrice(
                fallbackBinId,
                poolInfo.binStep,
                poolInfo.tokenX.decimals || 6,
                poolInfo.tokenY.decimals || 6
              )
            : undefined)
          ?? priceSamples[Math.floor(priceSamples.length / 2)];
        if (referencePrice && referencePrice > 0) {
          context.atrPercent = atr / referencePrice;
        }
      }

      const normalizeDepth = (collection: SideDepthNode[]): SideDepthNode[] => {
        if (!collection.length) return [];
        const total = collection.reduce((sum, node) => sum + node.weight, 0) || 1;
        const activeBin = poolInfo.activeBin ?? collection[0].binId;
        return collection
          .map((node) => ({ ...node, weight: node.weight / total }))
          .sort((a, b) => Math.abs(a.binId - activeBin) - Math.abs(b.binId - activeBin));
      };

      context.bidCoverageNodes = normalizeDepth(bidDepthNodes);
      context.askCoverageNodes = normalizeDepth(askDepthNodes);

      return context;
    } catch (error) {
      console.warn('Failed to build market context:', error);
      return {};
    }
  }
}

export const marketContextService = new MarketContextService();
