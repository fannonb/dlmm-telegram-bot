import { BN } from '@coral-xyz/anchor';

export class DlmmMath {
    private static BIN_CENTER_ID = 8388608;

    /**
     * Calculate price for a specific bin ID
     * Price = (1 + step/10000) ^ (id - center)
     */
    static getBinPrice(
        binId: number,
        binStep: number,
        tokenXDecimals: number = 6,
        tokenYDecimals: number = 6
    ): number {
        const rawPrice = Math.pow(1 + binStep / 10000, binId);
        const decimalAdjustment = Math.pow(10, tokenXDecimals - tokenYDecimals);
        return rawPrice * decimalAdjustment;
    }

    /**
     * Calculate optimal Y amount for a given X amount and strategy
     * purely based on bin math, ignoring current pool state (except active bin ID)
     * 
     * This provides a robust fallback when the SDK's autoFillYByStrategy 
     * returns incorrect values due to pool imbalance or manipulation.
     */
    static calculateYAmountFromBinSpread(
        amountX: number,
        minBinId: number,
        maxBinId: number,
        activeBinId: number,
        binStep: number,
        strategyType: number, // Using number to match StrategyType enum
        activeBinXAmount?: number, // Optional: actual X amount in active bin
        activeBinYAmount?: number,  // Optional: actual Y amount in active bin
        tokenXDecimals: number = 6,
        tokenYDecimals: number = 6
    ): number {
        // For now, we implement Spot (Uniform) distribution as the robust fallback
        // This assumes equal value distribution across all bins in the range.
        
        // 1. Calculate total capacity for X and Y across the range for a unit Value (V=1)
        let totalCapacityX = 0;
        let totalCapacityY = 0;

        for (let binId = minBinId; binId <= maxBinId; binId++) {
            const price = this.getBinPrice(binId, binStep, tokenXDecimals, tokenYDecimals);
            
            // Determine bin composition based on position relative to active bin
            let shareX = 0;
            let shareY = 0;

            if (binId > activeBinId) {
                // Bin is above active: Pure X
                shareX = 1; 
                shareY = 0;
            } else if (binId < activeBinId) {
                // Bin is below active: Pure Y
                shareX = 0;
                shareY = 1;
            } else {
                // Active Bin: Use actual ratio if available, otherwise assume 50/50
                if (activeBinXAmount && activeBinYAmount && activeBinXAmount > 0 && activeBinYAmount > 0) {
                    const totalValue = activeBinXAmount * price + activeBinYAmount;
                    shareX = (activeBinXAmount * price) / totalValue;
                    shareY = activeBinYAmount / totalValue;
                } else {
                    // Fallback to 50/50 split for robust calculation
                    shareX = 0.5;
                    shareY = 0.5;
                }
            }

            // Value = X * Price + Y
            // If V=1:
            // If Pure X: 1 = X * Price => X = 1/Price
            // If Pure Y: 1 = Y => Y = 1
            // If Mixed: 0.5 = X * Price => X = 0.5/Price; 0.5 = Y => Y = 0.5

            if (shareX > 0) {
                totalCapacityX += shareX / price;
            }
            if (shareY > 0) {
                totalCapacityY += shareY;
            }
        }

        // 2. Calculate required Value based on input Amount X
        // We know: AmountX_Input = V * totalCapacityX
        // So: V = AmountX_Input / totalCapacityX
        
        if (totalCapacityX === 0) {
            // If no bins accept X (all below active), we can't calculate Y from X
            // This happens if the user tries to add liquidity entirely below the active price
            // In this case, the user should only be providing Y.
            return 0;
        }

        const V = amountX / totalCapacityX;

        // 3. Calculate required Amount Y
        // AmountY_Required = V * totalCapacityY
        const amountY = V * totalCapacityY;

        return amountY;
    }
}
