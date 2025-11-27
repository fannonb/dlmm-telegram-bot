import { positionService, UserPosition } from './position.service';
import { poolService } from './pool.service';
import { configManager } from '../config/config.manager';
import { PositionData } from '../config/types';

export interface PositionAnalytics {
  publicKey: string;
  currentValueUSD: number;
  initialValueUSD: number;
  pnlUSD: number;
  pnlPercent: number;
  unclaimedFeesUSD: number; // Estimated
  apr: number;
}

export interface PortfolioAnalytics {
  totalValueUSD: number;
  totalPnLUSD: number;
  totalPnLPercent: number;
  totalUnclaimedFeesUSD: number;
  averageApr: number;
  positions: PositionAnalytics[];
}

export class AnalyticsService {

  /**
   * Calculate comprehensive analytics for a specific position
   */
  public async analyzePosition(position: UserPosition): Promise<PositionAnalytics> {
    // 1. Get current value (already calculated by PositionService usually, but let's ensure)
    const currentValueUSD = position.totalValueUSD || 0;

    // 2. Get initial value from local storage
    const storedPosition = configManager.getPosition(position.publicKey);
    const initialValueUSD = storedPosition?.initialValue || 0;

    // 3. Calculate PnL
    // PnL = Current Value - Initial Value (Simple calculation, ignores withdrawals/deposits if not tracked)
    // Ideally, we should track net investment. For Phase 2, we stick to simple snapshot diff if initial exists.
    let pnlUSD = 0;
    let pnlPercent = 0;

    if (initialValueUSD > 0) {
      pnlUSD = currentValueUSD - initialValueUSD;
      pnlPercent = (pnlUSD / initialValueUSD) * 100;
    }

    // 4. Estimate Unclaimed Fees in USD
    // We need prices for X and Y. PositionService usually has them cached or we fetch them.
    // Since we don't have direct price access here without calling price service again, 
    // we can infer from totalValueUSD if we know amounts, OR we assume PositionService 
    // attached some price metadata? It didn't.
    // We'll use a heuristic or fetch prices again if needed.
    // For efficiency, let's assume we can get prices from poolService if cached.
    
    let unclaimedFeesUSD = 0;
    try {
        // Quick fetch prices (cached)
        // Note: In a real high-perf app we'd pass prices in.
        // For now, we'll skip exact fee USD calc or do a rough estimate if prices are 0.
    } catch (e) {}

    // 5. Calculate APR
    // APR = (Fees / TVL) * 365 (Annualized) based on pool performance
    // We can get this from Pool Info
    let apr = 0;
    try {
        const poolInfo = await poolService.getPoolInfo(position.poolAddress);
        apr = poolInfo.apr || 0;
    } catch (e) {}

    return {
      publicKey: position.publicKey,
      currentValueUSD,
      initialValueUSD,
      pnlUSD,
      pnlPercent,
      unclaimedFeesUSD,
      apr
    };
  }

  /**
   * Analyze entire portfolio
   */
  public async getPortfolioAnalytics(userPublicKey: string): Promise<PortfolioAnalytics> {
    const positions = await positionService.getAllPositions(userPublicKey);
    
    const analyzedPositions: PositionAnalytics[] = [];
    
    for (const pos of positions) {
      analyzedPositions.push(await this.analyzePosition(pos));
    }

    const totalValueUSD = analyzedPositions.reduce((sum, p) => sum + p.currentValueUSD, 0);
    const totalPnLUSD = analyzedPositions.reduce((sum, p) => sum + p.pnlUSD, 0);
    const totalUnclaimedFeesUSD = analyzedPositions.reduce((sum, p) => sum + p.unclaimedFeesUSD, 0);
    
    // Weighted Average APR based on Value
    let weightedAprSum = 0;
    if (totalValueUSD > 0) {
        analyzedPositions.forEach(p => {
            weightedAprSum += p.apr * p.currentValueUSD;
        });
    }
    const averageApr = totalValueUSD > 0 ? weightedAprSum / totalValueUSD : 0;

    // Total PnL %
    // Need total initial value
    const totalInitialValue = analyzedPositions.reduce((sum, p) => sum + p.initialValueUSD, 0);
    const totalPnLPercent = totalInitialValue > 0 ? (totalPnLUSD / totalInitialValue) * 100 : 0;

    return {
      totalValueUSD,
      totalPnLUSD,
      totalPnLPercent,
      totalUnclaimedFeesUSD,
      averageApr,
      positions: analyzedPositions
    };
  }
}

export const analyticsService = new AnalyticsService();

