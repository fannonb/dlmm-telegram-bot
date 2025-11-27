import { positionService, UserPosition } from './position.service';
import { poolService } from './pool.service';
import { configManager } from '../config/config.manager';

export interface Alert {
  type: 'OUT_OF_RANGE' | 'NEAR_RANGE_LIMIT' | 'HIGH_FEES' | 'PRICE_VOLATILITY';
  severity: 'low' | 'medium' | 'high';
  message: string;
  positionAddress: string;
}

export class MonitoringService {
  private readonly NEAR_RANGE_THRESHOLD_BINS = 5; // Alert if within 5 bins of edge
  private readonly FEE_CLAIM_THRESHOLD_USD = 10; // Alert if fees > $10

  /**
   * Check a single position for alerts
   */
  public async checkPosition(position: UserPosition): Promise<Alert[]> {
    const alerts: Alert[] = [];

    // 1. Check Range Status
    if (!position.inRange) {
      alerts.push({
        type: 'OUT_OF_RANGE',
        severity: 'high',
        message: `Position is Out of Range! Active Bin: ${position.activeBinId}. Range: [${position.lowerBinId} - ${position.upperBinId}]`,
        positionAddress: position.publicKey
      });
    } else {
      // Check if near edge
      const distToLower = position.activeBinId - position.lowerBinId;
      const distToUpper = position.upperBinId - position.activeBinId;
      
      if (distToLower <= this.NEAR_RANGE_THRESHOLD_BINS || distToUpper <= this.NEAR_RANGE_THRESHOLD_BINS) {
        alerts.push({
          type: 'NEAR_RANGE_LIMIT',
          severity: 'medium',
          message: `Position is near range limit (${Math.min(distToLower, distToUpper)} bins left)`,
          positionAddress: position.publicKey
        });
      }
    }

    // 2. Check Fees (Estimation)
    // Note: fee value USD calculation would be here if we had exact prices
    // For now, we assume if fee accumulation > 0 it's good, but maybe alert on large build up?
    // We'll skip precise USD threshold for now without price context.

    return alerts;
  }

  /**
   * Check all positions
   */
  public async monitorAll(userPublicKey: string): Promise<Alert[]> {
    const positions = await positionService.getAllPositions(userPublicKey);
    let allAlerts: Alert[] = [];

    for (const pos of positions) {
      const posAlerts = await this.checkPosition(pos);
      allAlerts = allAlerts.concat(posAlerts);
    }

    return allAlerts;
  }
}

export const monitoringService = new MonitoringService();

