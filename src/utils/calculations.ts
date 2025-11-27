import { BN } from '@coral-xyz/anchor';

/**
 * Check if swap is needed based on current and target ratios
 */
export function needsSwap(
  tokenX: number,
  tokenY: number,
  targetRatio: number,
  tolerance: number = 0.03 // 3% tolerance
): boolean {
  if (tokenX === 0 || tokenY === 0) return true;
  
  const currentRatio = tokenX / tokenY;
  const deviation = Math.abs(currentRatio - targetRatio) / targetRatio;
  return deviation > tolerance;
}

/**
 * Calculate swap amount needed to achieve target ratio
 */
export function calculateSwapAmount(
  tokenX: number,
  tokenY: number,
  targetRatio: number
): {
  amount: number;
  direction: 'XtoY' | 'YtoX';
  targetX: number;
  targetY: number;
} {
  const totalValue = tokenX + tokenY; // Assuming 1:1 price for stablecoins
  
  // For target ratio X:Y = targetRatio:1
  // X = totalValue * (targetRatio / (targetRatio + 1))
  // Y = totalValue * (1 / (targetRatio + 1))
  
  const targetX = totalValue * (targetRatio / (targetRatio + 1));
  const targetY = totalValue / (targetRatio + 1);
  
  if (tokenX > targetX) {
    // Need to swap X → Y
    return {
      amount: tokenX - targetX,
      direction: 'XtoY',
      targetX,
      targetY,
    };
  } else {
    // Need to swap Y → X
    return {
      amount: targetY - tokenY,
      direction: 'YtoX',
      targetX,
      targetY,
    };
  }
}

/**
 * Calculate target ratio for Curve strategy at given bin
 * For stablecoins at peg, this is typically 1:1 (50/50)
 */
export function calculateTargetRatio(
  strategy: 'Spot' | 'Curve' | 'BidAsk',
  activeBinId: number,
  centerBinId: number
): number {
  switch (strategy) {
    case 'Curve':
      // For Curve at center bin, target is 50/50
      return 1.0;
    case 'Spot':
      // For Spot, also 50/50
      return 1.0;
    case 'BidAsk':
      // For BidAsk, depends on position relative to active bin
      // If above active, more Y; if below, more X
      if (centerBinId > activeBinId) {
        return 0.3; // More Y (30% X, 70% Y)
      } else if (centerBinId < activeBinId) {
        return 3.0; // More X (75% X, 25% Y)
      } else {
        return 1.0; // Centered
      }
    default:
      return 1.0;
  }
}

/**
 * Estimate swap cost
 */
export function estimateSwapCost(
  swapAmount: number,
  poolFeeBps: number, // e.g., 20 for 0.2%
  gasCost: number = 0.02 // USD estimate
): {
  poolFee: number;
  gasCost: number;
  total: number;
} {
  const poolFee = swapAmount * (poolFeeBps / 10000);
  return {
    poolFee,
    gasCost,
    total: poolFee + gasCost,
  };
}

/**
 * Check if swap is economical
 */
export function isSwapEconomical(
  swapAmount: number,
  expectedBenefit: number,
  poolFeeBps: number = 20
): boolean {
  const cost = estimateSwapCost(swapAmount, poolFeeBps);
  return expectedBenefit > cost.total;
}

/**
 * Calculate minimum output amount with slippage
 */
export function calculateMinOutAmount(
  expectedOut: BN,
  slippageBps: number // e.g., 50 for 0.5%
): BN {
  const slippageMultiplier = 10000 - slippageBps;
  return expectedOut.mul(new BN(slippageMultiplier)).div(new BN(10000));
}

/**
 * Convert between token amounts considering decimals
 */
export function convertAmount(
  amount: number,
  fromDecimals: number,
  toDecimals: number
): number {
  const base = amount / Math.pow(10, fromDecimals);
  return base * Math.pow(10, toDecimals);
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(
  amount: BN | number,
  decimals: number
): string {
  const num = typeof amount === 'number' ? amount : amount.toNumber();
  const value = num / Math.pow(10, decimals);
  return value.toFixed(decimals > 6 ? 6 : decimals);
}

