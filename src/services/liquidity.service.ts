import { Connection, PublicKey, sendAndConfirmTransaction, Signer, Transaction } from '@solana/web3.js';
import DLMM, { StrategyType, autoFillYByStrategy } from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import { connectionService } from './connection.service';
import { poolService } from './pool.service';
import { walletService } from './wallet.service';
import { DlmmMath } from '../utils/dlmm-math';
import { oracleService } from './oracle.service';


export interface AddLiquidityParams {
  positionPubKey: PublicKey;
  poolAddress: string;
  amountX: BN;
  amountY: BN;
  strategyType: StrategyType;
  slippage: number; // percent
}

export interface RemoveLiquidityParams {
  positionPubKey: PublicKey;
  poolAddress: string;
  userPublicKey: PublicKey;
  bps: number; // Basis points (10000 = 100%)
  shouldClaimAndClose?: boolean;
}

export class LiquidityService {
  
  /**
   * Add liquidity to an existing position
   */
  public async addLiquidity(params: AddLiquidityParams): Promise<string> {
    try {
      const { positionPubKey, poolAddress, amountX, amountY, strategyType, slippage } = params;
      
      // Get active wallet/signer
      const keypair = walletService.getActiveKeypair();
      if (!keypair) throw new Error('No active wallet found');

      // Initialize DLMM
      const dlmm = await poolService.getDlmmInstance(poolAddress);

      // Fetch position to get current range
      const position = await dlmm.getPosition(positionPubKey);
      const minBinId = position.positionData.lowerBinId;
      const maxBinId = position.positionData.upperBinId;

      // Create transaction
      const tx = await dlmm.addLiquidityByStrategy({
        positionPubKey,
        user: keypair.publicKey,
        totalXAmount: amountX,
        totalYAmount: amountY,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: strategyType 
        },
        slippage
      });

      // Send transaction
      const connection = connectionService.getConnection();
      const signature = await sendAndConfirmTransaction(
        connection,
        tx,
        [keypair],
        { commitment: 'confirmed' }
      );

      return signature;
    } catch (error) {
      console.error('Error adding liquidity:', error);
      throw error;
    }
  }

  /**
   * Remove liquidity from a position
   */
  public async removeLiquidity(params: RemoveLiquidityParams): Promise<string[]> {
    try {
      const { positionPubKey, poolAddress, userPublicKey, bps, shouldClaimAndClose } = params;
      
      const keypair = walletService.getActiveKeypair();
      if (!keypair) throw new Error('No active wallet found');

      const dlmm = await poolService.getDlmmInstance(poolAddress);

      // Get position to find bin range
      const position = await dlmm.getPosition(positionPubKey);
      const lowerBinId = position.positionData.lowerBinId;
      const upperBinId = position.positionData.upperBinId;

      const txs = await dlmm.removeLiquidity({
        position: positionPubKey,
        user: userPublicKey,
        fromBinId: lowerBinId,
        toBinId: upperBinId,
        bps: new BN(bps),
        shouldClaimAndClose: shouldClaimAndClose || false
      });

      const connection = connectionService.getConnection();
      const signatures: string[] = [];

      for (const tx of txs) {
        const sig = await sendAndConfirmTransaction(
          connection,
          tx,
          [keypair],
          { commitment: 'confirmed' }
        );
        signatures.push(sig);
      }

      return signatures;
    } catch (error) {
      console.error('Error removing liquidity:', error);
      throw error;
    }
  }

  /**
   * Close a position
   */
  public async closePosition(poolAddress: string, positionPubKey: PublicKey): Promise<string> {
    try {
      const keypair = walletService.getActiveKeypair();
      if (!keypair) throw new Error('No active wallet found');

      const dlmm = await poolService.getDlmmInstance(poolAddress);
      const position = await dlmm.getPosition(positionPubKey);

      const tx = await dlmm.closePosition({
        owner: keypair.publicKey,
        position: position
      });

      const connection = connectionService.getConnection();
      const signature = await sendAndConfirmTransaction(
        connection,
        tx,
        [keypair],
        { commitment: 'confirmed' }
      );

      return signature;
    } catch (error) {
      console.error('Error closing position:', error);
      throw error;
    }
  }

  /**
   * Calculate optimal Y amount based on strategy and X amount
   * Handles price calculation from multiple sources for reliability
   */
  public async calculateOptimalYAmount(
    poolAddress: string,
    amountX: number,
    minBinId: number,
    maxBinId: number,
    strategyType: StrategyType
  ): Promise<number> {
    try {
      const dlmm = await poolService.getDlmmInstance(poolAddress);
      const activeBin = await dlmm.getActiveBin();

      // Get pool metadata for decimals
      const poolInfo = await poolService.getPoolInfo(poolAddress);
      const xDecimals = poolInfo.tokenX.decimals || 6;
      const yDecimals = poolInfo.tokenY.decimals || 6;

      // 1. Get Pool Price using SDK's proper method
      // The activeBin.price from SDK is already the correct "price per token"
      let poolPrice = poolService.calculateBinPrice(
        activeBin.binId,
        dlmm.lbPair.binStep,
        xDecimals,
        yDecimals
      );

      // 2. Fetch Oracle Price
      const oraclePrice = await oracleService.getPriceRatio(
        poolInfo.tokenX.mint,
        poolInfo.tokenY.mint
      );
      
      // 3. Determine which price to use
      let finalPrice = poolPrice;
      let isUsingOracle = false;
      
      if (oraclePrice) {
        // Calculate deviation
        const deviation = Math.abs((poolPrice - oraclePrice) / oraclePrice);
        
        // If deviation is > 50%, assume pool is imbalanced/broken and use Oracle
        if (deviation > 0.5) {
            console.warn(`Significant price deviation detected! Pool: ${poolPrice.toFixed(6)}, Oracle: ${oraclePrice.toFixed(6)}. Using Oracle price.`);
            finalPrice = oraclePrice;
            isUsingOracle = true;
        }
      }

      // Calculate robust Y amount using bin math
      // This is our "source of truth" for what the math says, ignoring SDK state quirks
      let robustYAmount = 0;
      try {
            const activeBinXAmount = activeBin.xAmount ? Number(activeBin.xAmount) / Math.pow(10, xDecimals) : undefined;
            const activeBinYAmount = activeBin.yAmount ? Number(activeBin.yAmount) / Math.pow(10, yDecimals) : undefined;
          
          robustYAmount = DlmmMath.calculateYAmountFromBinSpread(
              amountX,
              minBinId,
              maxBinId,
              activeBin.binId,
              dlmm.lbPair.binStep,
              strategyType,
              activeBinXAmount,
              activeBinYAmount,
              xDecimals,
              yDecimals
          );
      } catch (e) {
          console.warn('Error calculating robust Y amount:', e);
      }

      // If we are using Oracle (broken pool), trust the robust calculation over everything else
      // UNLESS the robust calculation failed (returned 0 when it shouldn't have)
      if (isUsingOracle && robustYAmount > 0) {
          console.warn('Using robust bin-based calculation due to Oracle deviation.');
          return robustYAmount;
      }

      // For Spot strategy: 50/50 distribution by VALUE
      if (strategyType === StrategyType.Spot) {
        // If robust calculation worked, use it. It's more accurate than amountX * price
        if (robustYAmount > 0) return robustYAmount;
        return amountX * finalPrice;
      }

      // For Curve and BidAsk strategies
      // If we are using Oracle price (meaning pool is broken), we CANNOT trust SDK's autoFillYByStrategy
      // because it relies on the broken pool state.
      if (!isUsingOracle) {
          try {
            const totalXAmount = new BN(amountX * Math.pow(10, xDecimals));
            const amountXInActiveBin = activeBin.xAmount || new BN(0);
            const amountYInActiveBin = activeBin.yAmount || new BN(0);

            const totalYAmount = autoFillYByStrategy(
              activeBin.binId,
              dlmm.lbPair.binStep,
              totalXAmount,
              amountXInActiveBin,
              amountYInActiveBin,
              minBinId,
              maxBinId,
              strategyType
            );

            let yAmountDecimal = totalYAmount.toNumber() / Math.pow(10, yDecimals);
            
            // SANITY CHECK: If SDK result deviates significantly from robust calculation
            // Only check strictly for Spot-like strategies or if deviation is extreme
            if (robustYAmount > 0) {
                const sdkDev = Math.abs((yAmountDecimal - robustYAmount) / robustYAmount);
                // Allow more deviation for Curve/BidAsk (0.5 instead of 0.25)
                if (sdkDev > 0.5) {
                    console.warn(`SDK calculation suspicious! SDK: ${yAmountDecimal.toFixed(6)}, Robust: ${robustYAmount.toFixed(6)}`);
                    console.warn(`Using robust bin-based calculation instead.`);
                    return robustYAmount;
                }
            }
            
            return yAmountDecimal;
          } catch (sdkError) {
            console.warn('SDK calculation failed for', strategyType, ', using price fallback');
          }
      } else {
          console.warn('Skipping SDK strategy calculation due to price deviation. Using Robust/Oracle-based estimate.');
          if (robustYAmount > 0) return robustYAmount;
      }

      // Fallback (used if SDK fails OR if we forced Oracle price and robust failed)
      return amountX * finalPrice;

    } catch (error) {
      console.error('Error calculating optimal Y amount:', error);
      throw new Error(`Failed to calculate optimal Y amount: ${error}`);
    }
  }

  /**
   * Check if the pool price is healthy compared to Oracle
   */
  public async checkPriceHealth(poolAddress: string): Promise<{
      isHealthy: boolean;
      poolPrice: number;
      oraclePrice: number | null;
      deviation: number;
  }> {
      try {
          const dlmm = await poolService.getDlmmInstance(poolAddress);
          const activeBin = await dlmm.getActiveBin();
          const poolInfo = await poolService.getPoolInfo(poolAddress);

          const xDecimals = poolInfo.tokenX.decimals || 6;
          const yDecimals = poolInfo.tokenY.decimals || 6;

          const poolPrice = poolService.calculateBinPrice(
            activeBin.binId,
            dlmm.lbPair.binStep,
            xDecimals,
            yDecimals
          );

          const oraclePrice = await oracleService.getPriceRatio(
            poolInfo.tokenX.mint,
            poolInfo.tokenY.mint
          );

          let deviation = 0;
          let isHealthy = true;

          if (oraclePrice) {
            deviation = Math.abs((poolPrice - oraclePrice) / oraclePrice);
            if (deviation > 0.5) {
              isHealthy = false;
            }
          }

          return {
            isHealthy,
            poolPrice,
            oraclePrice,
            deviation,
          };
        } catch (error) {
          console.warn('Error checking price health:', error);
          return { isHealthy: true, poolPrice: 0, oraclePrice: null, deviation: 0 };
        }
      }

}

export const liquidityService = new LiquidityService();
