"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DlmmMath = void 0;
var DlmmMath = /** @class */ (function () {
    function DlmmMath() {
    }
    /**
     * Calculate price for a specific bin ID
     * Price = (1 + step/10000) ^ (id - center)
     */
    DlmmMath.getBinPrice = function (binId, binStep, tokenXDecimals, tokenYDecimals) {
        if (tokenXDecimals === void 0) { tokenXDecimals = 6; }
        if (tokenYDecimals === void 0) { tokenYDecimals = 6; }
        var rawPrice = Math.pow(1 + binStep / 10000, binId);
        var decimalAdjustment = Math.pow(10, tokenXDecimals - tokenYDecimals);
        return rawPrice * decimalAdjustment;
    };
    /**
     * Calculate optimal Y amount for a given X amount and strategy
     * purely based on bin math, ignoring current pool state (except active bin ID)
     *
     * This provides a robust fallback when the SDK's autoFillYByStrategy
     * returns incorrect values due to pool imbalance or manipulation.
     */
    DlmmMath.calculateYAmountFromBinSpread = function (amountX, minBinId, maxBinId, activeBinId, binStep, strategyType, // Using number to match StrategyType enum
    activeBinXAmount, // Optional: actual X amount in active bin
    activeBinYAmount, // Optional: actual Y amount in active bin
    tokenXDecimals, tokenYDecimals) {
        // For now, we implement Spot (Uniform) distribution as the robust fallback
        // This assumes equal value distribution across all bins in the range.
        if (tokenXDecimals === void 0) { tokenXDecimals = 6; }
        if (tokenYDecimals === void 0) { tokenYDecimals = 6; }
        // 1. Calculate total capacity for X and Y across the range for a unit Value (V=1)
        var totalCapacityX = 0;
        var totalCapacityY = 0;
        for (var binId = minBinId; binId <= maxBinId; binId++) {
            var price = this.getBinPrice(binId, binStep, tokenXDecimals, tokenYDecimals);
            // Determine bin composition based on position relative to active bin
            var shareX = 0;
            var shareY = 0;
            if (binId > activeBinId) {
                // Bin is above active: Pure X
                shareX = 1;
                shareY = 0;
            }
            else if (binId < activeBinId) {
                // Bin is below active: Pure Y
                shareX = 0;
                shareY = 1;
            }
            else {
                // Active Bin: Use actual ratio if available, otherwise assume 50/50
                if (activeBinXAmount && activeBinYAmount && activeBinXAmount > 0 && activeBinYAmount > 0) {
                    var totalValue = activeBinXAmount * price + activeBinYAmount;
                    shareX = (activeBinXAmount * price) / totalValue;
                    shareY = activeBinYAmount / totalValue;
                }
                else {
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
        var V = amountX / totalCapacityX;
        // 3. Calculate required Amount Y
        // AmountY_Required = V * totalCapacityY
        var amountY = V * totalCapacityY;
        return amountY;
    };
    DlmmMath.BIN_CENTER_ID = 8388608;
    return DlmmMath;
}());
exports.DlmmMath = DlmmMath;
