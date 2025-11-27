import { PublicKey, Keypair, SendTransactionError, sendAndConfirmTransaction } from '@solana/web3.js';
import DLMM, { LbPosition, PositionInfo, StrategyType } from '@meteora-ag/dlmm';
import { connectionService } from './connection.service';
import { poolService } from './pool.service';
import { walletService } from './wallet.service';
import { priceService } from './price.service';
import { BN } from '@coral-xyz/anchor';
import { CreatePositionParams, CreatePositionResult, PoolInfo } from '../config/types';

export interface UserPosition {
  publicKey: string;
  poolAddress: string;
  tokenX: {
    mint: string;
    amount: string;
    symbol?: string;
    decimals?: number;
    uiAmount?: number;
    priceUsd?: number;
    usdValue?: number;
  };
  tokenY: {
    mint: string;
    amount: string;
    symbol?: string;
    decimals?: number;
    uiAmount?: number;
    priceUsd?: number;
    usdValue?: number;
  };
  lowerBinId: number;
  upperBinId: number;
  activeBinId: number;
  inRange: boolean;
  unclaimedFees: {
    x: string;
    y: string;
    xUi?: number;
    yUi?: number;
    usdValue?: number;
  };
  totalValueUSD?: number;
  poolApr?: number;
  binStep?: number;
}

export class PositionService {

  /**
   * Get all positions for a specific user across all pools
   * Optimized with parallel price fetching
   */
  public async getAllPositions(userPublicKey: string): Promise<UserPosition[]> {
    try {
      const connection = connectionService.getConnection();
      const user = new PublicKey(userPublicKey);

      // Fetch all positions using SDK static method
      const positionsMap: Map<string, PositionInfo> = await DLMM.getAllLbPairPositionsByUser(
        connection,
        user
      );

      const userPositions: UserPosition[] = [];
      
      // First pass: collect all unique mints for batch price fetching
      const allMints = new Set<string>();
      const poolDataMap = new Map<string, { poolMetadata: any; tokenXDecimals: number; tokenYDecimals: number }>();

      // Collect pool metadata in parallel
      const poolAddresses = Array.from(positionsMap.keys());
      const poolMetadataPromises = poolAddresses.map(async (lbPairAddr) => {
        try {
          const poolMetadata = await poolService.fetchPoolByAddress(lbPairAddr);
          if (poolMetadata) {
            allMints.add(poolMetadata.mint_x);
            allMints.add(poolMetadata.mint_y);
          }
          return { lbPairAddr, poolMetadata };
        } catch (e) {
          return { lbPairAddr, poolMetadata: null };
        }
      });

      const poolMetadataResults = await Promise.all(poolMetadataPromises);
      poolMetadataResults.forEach(({ lbPairAddr, poolMetadata }) => {
        const positionInfo = positionsMap.get(lbPairAddr);
        if (!positionInfo) return;
        
        const tokenXReserve = positionInfo.tokenX as any;
        const tokenYReserve = positionInfo.tokenY as any;
        
        let tokenXDecimals = 6;
        let tokenYDecimals = 6;
        
        if (typeof tokenXReserve?.mint?.decimals === 'number') {
          tokenXDecimals = tokenXReserve.mint.decimals;
        } else if (typeof tokenXReserve?.decimal === 'number') {
          tokenXDecimals = tokenXReserve.decimal;
        }

        if (typeof tokenYReserve?.mint?.decimals === 'number') {
          tokenYDecimals = tokenYReserve.mint.decimals;
        } else if (typeof tokenYReserve?.decimal === 'number') {
          tokenYDecimals = tokenYReserve.decimal;
        }
        
        poolDataMap.set(lbPairAddr, { poolMetadata, tokenXDecimals, tokenYDecimals });
      });

      // Batch fetch all prices at once
      const prices = await priceService.getTokenPrices(Array.from(allMints));

      // Second pass: build positions with cached prices
      for (const [lbPairAddr, positionInfo] of positionsMap.entries()) {
        const lbPairPositions = positionInfo.lbPairPositionsData;
        const activeId = positionInfo.lbPair.activeId;
        const poolData = poolDataMap.get(lbPairAddr);
        
        let tokenXSymbol = 'Unknown';
        let tokenYSymbol = 'Unknown';
        let tokenXPrice = 0;
        let tokenYPrice = 0;
        const tokenXDecimals = poolData?.tokenXDecimals ?? 6;
        const tokenYDecimals = poolData?.tokenYDecimals ?? 6;
        
        const poolMetadata = poolData?.poolMetadata;
        if (poolMetadata) {
          const names = poolMetadata.name.split('-');
          tokenXSymbol = names[0];
          tokenYSymbol = names[1];
          tokenXPrice = prices.get(poolMetadata.mint_x) || 0;
          tokenYPrice = prices.get(poolMetadata.mint_y) || 0;

          // Fallback: derive missing price from active bin
          if ((tokenXPrice === 0 || tokenYPrice === 0) && (tokenXPrice > 0 || tokenYPrice > 0)) {
            try {
              const binStep = positionInfo.lbPair.binStep;
              const priceXInY = poolService.calculateBinPrice(activeId, binStep, tokenXDecimals, tokenYDecimals);
              if (tokenXPrice > 0 && tokenYPrice === 0) tokenYPrice = tokenXPrice / priceXInY;
              else if (tokenYPrice > 0 && tokenXPrice === 0) tokenXPrice = tokenYPrice * priceXInY;
            } catch (e) { /* ignore */ }
          }
        }

        const binStep = positionInfo.lbPair?.binStep ?? 0;
        const poolApr = (poolMetadata?.apr && Number(poolMetadata.apr)) || 0;

        for (const pos of lbPairPositions) {
          userPositions.push(this.mapToUserPosition(
            pos,
            lbPairAddr,
            activeId,
            positionInfo.tokenX.publicKey.toBase58(),
            positionInfo.tokenY.publicKey.toBase58(),
            tokenXSymbol,
            tokenYSymbol,
            tokenXDecimals,
            tokenYDecimals,
            tokenXPrice,
            tokenYPrice,
            binStep,
            poolApr
          ));
        }
      }

      return userPositions;
    } catch (error: any) {
      if (error?.message?.includes('feeAmountXPerTokenStored')) {
        console.warn('Known SDK issue detected with position data. Returning empty positions.');
        return [];
      }
      console.error('Error fetching all positions:', error);
      return [];
    }
  }

  /**
   * Get positions for a specific pool
   */
  public async getPositionsByPool(poolAddress: string, userPublicKey: string): Promise<UserPosition[]> {
    try {
      const dlmm = await poolService.getDlmmInstance(poolAddress);
      const user = new PublicKey(userPublicKey);

      const { userPositions, activeBin } = await dlmm.getPositionsByUserAndLbPair(user);

      // Get symbols and prices
      let tokenXSymbol = 'Unknown';
      let tokenYSymbol = 'Unknown';
      let tokenXPrice = 0;
      let tokenYPrice = 0;
      const dlmmTokenX = dlmm.tokenX as any;
      const dlmmTokenY = dlmm.tokenY as any;
      const tokenXDecimals = dlmmTokenX?.mint?.decimals ?? dlmmTokenX?.decimal ?? 6;
      const tokenYDecimals = dlmmTokenY?.mint?.decimals ?? dlmmTokenY?.decimal ?? 6;

      let poolMetadata: any = null;
      try {
        poolMetadata = await poolService.fetchPoolByAddress(poolAddress);
        if (poolMetadata) {
          const names = poolMetadata.name.split('-');
          tokenXSymbol = names[0];
          tokenYSymbol = names[1];
          tokenXPrice = await priceService.getTokenPrice(poolMetadata.mint_x);
          tokenYPrice = await priceService.getTokenPrice(poolMetadata.mint_y);

          // Fallback for Devnet
          if ((tokenXPrice === 0 || tokenYPrice === 0) && (tokenXPrice > 0 || tokenYPrice > 0)) {
            const priceXInY = poolService.calculateBinPrice(
              activeBin.binId,
              dlmm.lbPair.binStep,
              tokenXDecimals,
              tokenYDecimals
            );
            if (tokenXPrice > 0 && tokenYPrice === 0) tokenYPrice = tokenXPrice / priceXInY;
            else if (tokenYPrice > 0 && tokenXPrice === 0) tokenXPrice = tokenYPrice * priceXInY;
          }
        }
      } catch (e) { }

      const binStep = dlmm.lbPair?.binStep ?? 0;
      const poolApr = (poolMetadata?.apr && Number(poolMetadata.apr)) || 0;

      return userPositions.map(pos => this.mapToUserPosition(
        pos,
        poolAddress,
        activeBin.binId,
        dlmm.tokenX.publicKey.toBase58(),
        dlmm.tokenY.publicKey.toBase58(),
        tokenXSymbol,
        tokenYSymbol,
        tokenXDecimals,
        tokenYDecimals,
        tokenXPrice,
        tokenYPrice,
        binStep,
        poolApr
      ));

    } catch (error: any) {
      // Handle known SDK issue: "Cannot read properties of undefined (reading 'feeAmountXPerTokenStored')"
      if (error?.message?.includes('feeAmountXPerTokenStored')) {
        console.warn(
          'Known SDK issue detected with position data (feeAmountXPerTokenStored). ' +
          'Returning empty positions for this pool.'
        );
        return [];
      }
      throw new Error(`Failed to get positions for pool ${poolAddress}: ${error}`);
    }
  }

  /**
   * Helper to map SDK LbPosition to UserPosition with PROPER bin aggregation
   */
  private mapToUserPosition(
    pos: LbPosition,
    poolAddress: string,
    activeBinId: number,
    tokenXMint: string,
    tokenYMint: string,
    tokenXSymbol?: string,
    tokenYSymbol?: string,
    tokenXDecimals: number = 6,
    tokenYDecimals: number = 6,
    tokenXPrice: number = 0,
    tokenYPrice: number = 0,
    binStep: number = 0,
    poolApr: number = 0
  ): UserPosition {
    const data = pos.positionData;

    const lowerBinId = data.lowerBinId;
    const upperBinId = data.upperBinId;
    const inRange = activeBinId >= lowerBinId && activeBinId <= upperBinId;

    const isDebugMode = process.env.DEBUG_POSITIONS === 'true';

    if (isDebugMode) {
      console.debug('Position data fields:', Object.keys(data));
    }

    let rawAmountX = '0';
    let rawAmountY = '0';
    let rawFeeX = '0';
    let rawFeeY = '0';

    // CRITICAL FIX: Meteora SDK stores amounts in positionBinData array
    // Must aggregate across all bins to get true totals
    if ((data as any).positionBinData && Array.isArray((data as any).positionBinData)) {
      if (isDebugMode) {
        console.debug(`Found positionBinData with ${(data as any).positionBinData.length} bins`);
      }

      let totalX = new BN(0);
      let totalY = new BN(0);
      let feeX = new BN(0);
      let feeY = new BN(0);

      (data as any).positionBinData.forEach((bin: any, idx: number) => {
        if (bin.positionXAmount) {
          const binXAmount = new BN(bin.positionXAmount);
          totalX = totalX.add(binXAmount);
          if (isDebugMode && idx < 3) {
            console.debug(`  Bin ${bin.binId}: X=${binXAmount.toString()}`);
          }
        }
        if (bin.positionYAmount) {
          const binYAmount = new BN(bin.positionYAmount);
          totalY = totalY.add(binYAmount);
          if (isDebugMode && idx < 3) {
            console.debug(`  Bin ${bin.binId}: Y=${binYAmount.toString()}`);
          }
        }
        if (bin.positionFeeXAmount) {
          feeX = feeX.add(new BN(bin.positionFeeXAmount));
        }
        if (bin.positionFeeYAmount) {
          feeY = feeY.add(new BN(bin.positionFeeYAmount));
        }
      });

      rawAmountX = totalX.toString();
      rawAmountY = totalY.toString();

      // FIX: Use position-level fees (feeX/feeY) as the authoritative source
      // The bin-level fees (positionFeeXAmount/positionFeeYAmount) are breakdowns that SUM to the position fees
      // We should NOT add them together - that causes double-counting!
      // 
      // Priority: Use position-level fees if available, otherwise fall back to bin aggregation
      if ((data as any).feeX !== undefined && (data as any).feeX !== null) {
        rawFeeX = String((data as any).feeX);
        if (isDebugMode) {
          console.debug(`  Using position-level feeX: ${rawFeeX}`);
        }
      } else {
        // Fallback: use bin aggregation if position-level not available
        rawFeeX = feeX.toString();
        if (isDebugMode) {
          console.debug(`  Using aggregated bin feeX: ${rawFeeX}`);
        }
      }
      
      if ((data as any).feeY !== undefined && (data as any).feeY !== null) {
        rawFeeY = String((data as any).feeY);
        if (isDebugMode) {
          console.debug(`  Using position-level feeY: ${rawFeeY}`);
        }
      } else {
        // Fallback: use bin aggregation if position-level not available
        rawFeeY = feeY.toString();
        if (isDebugMode) {
          console.debug(`  Using aggregated bin feeY: ${rawFeeY}`);
        }
      }

      if (isDebugMode) {
        console.debug(`Aggregated totals: X=${rawAmountX}, Y=${rawAmountY}`);
        console.debug(`Fees (position-level preferred): FeeX=${rawFeeX}, FeeY=${rawFeeY}`);
      }
    } else {
      // Fallback: Try SDK fields (might be outdated SDK version)
      console.warn(`⚠️  positionBinData not found, using fallback (data may be inaccurate)`);

      if ((data as any).totalXAmount) {
        rawAmountX = String((data as any).totalXAmount);
      }
      if ((data as any).totalYAmount) {
        rawAmountY = String((data as any).totalYAmount);
      }
      if ((data as any).feeX) {
        rawFeeX = String((data as any).feeX);
      }
      if ((data as any).feeY) {
        rawFeeY = String((data as any).feeY);
      }
    }

    if (isDebugMode) {
      console.debug(`Raw amounts: X=${rawAmountX}, Y=${rawAmountY}`);
    }

    const amountX = Number(rawAmountX || 0) / Math.pow(10, tokenXDecimals);
    const amountY = Number(rawAmountY || 0) / Math.pow(10, tokenYDecimals);

    if (isDebugMode) {
      console.debug(`UI amounts: X=${amountX} ${tokenXSymbol}, Y=${amountY} ${tokenYSymbol}`);
      console.debug(`Prices: X=$${tokenXPrice}, Y=$${tokenYPrice}`);
    }

    const tokenXValueUsd = amountX * tokenXPrice;
    const tokenYValueUsd = amountY * tokenYPrice;
    const totalValueUSD = tokenXValueUsd + tokenYValueUsd;

    if (isDebugMode || totalValueUSD > 1000) {
      console.debug(`USD values: X=$${tokenXValueUsd.toFixed(2)}, Y=$${tokenYValueUsd.toFixed(2)}, Total=$${totalValueUSD.toFixed(2)}`);
    }

    const feeXAmount = Number(rawFeeX || 0) / Math.pow(10, tokenXDecimals);
    const feeYAmount = Number(rawFeeY || 0) / Math.pow(10, tokenYDecimals);
    const feeUsdValue = feeXAmount * tokenXPrice + feeYAmount * tokenYPrice;

    return {
      publicKey: pos.publicKey.toBase58(),
      poolAddress: poolAddress,
      tokenX: {
        mint: tokenXMint,
        amount: rawAmountX,
        symbol: tokenXSymbol,
        decimals: tokenXDecimals,
        uiAmount: amountX,
        priceUsd: tokenXPrice,
        usdValue: tokenXValueUsd
      },
      tokenY: {
        mint: tokenYMint,
        amount: rawAmountY,
        symbol: tokenYSymbol,
        decimals: tokenYDecimals,
        uiAmount: amountY,
        priceUsd: tokenYPrice,
        usdValue: tokenYValueUsd
      },
      lowerBinId,
      upperBinId,
      activeBinId,
      inRange,
      unclaimedFees: {
        x: rawFeeX,
        y: rawFeeY,
        xUi: feeXAmount,
        yUi: feeYAmount,
        usdValue: feeUsdValue
      },
      totalValueUSD,
      poolApr,
      binStep
    };
  }

  /**
   * Placeholder for listing positions to satisfy CLI imports temporarily
   */
  public listPositions(): any[] {
    return [];
  }

  /**
   * Placeholder for getting position details
   */
  public getPositionDetails(address: string): any {
    return null;
  }

  public validatePositionParams(params: CreatePositionParams, poolInfo: PoolInfo): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (params.amountX <= 0 && params.amountY <= 0) {
      errors.push('At least one token amount must be greater than 0');
    }

    if (!['Spot', 'Curve', 'BidAsk'].includes(params.strategy)) {
      errors.push('Invalid strategy type');
    }

    if (params.strategy === 'BidAsk') {
      if (!params.minBinId || !params.maxBinId) {
        errors.push('BidAsk strategy requires minBinId and maxBinId');
      }
      if (params.minBinId && params.maxBinId && params.minBinId >= params.maxBinId) {
        errors.push('minBinId must be less than maxBinId');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public async preparePositionCreation(params: CreatePositionParams, poolInfo: PoolInfo): Promise<any> {
    const dlmm = await poolService.getDlmmInstance(poolInfo.address);
    const activeBin = await dlmm.getActiveBin();
    const feeInfo = await dlmm.getFeeInfo();

    const strategyType = params.strategy === 'Spot' ? StrategyType.Spot :
      params.strategy === 'Curve' ? StrategyType.Curve : StrategyType.BidAsk;

    // Calculate token amounts (Simplified 50/50 split for now)
    // In a real app, we would use price feeds or ask user for specific X and Y amounts.
    // Here we assume the user wants to split their "depositAmount" (USD) 50/50.
    // Since we don't have USD prices, we'll interpret 'depositAmount' as "Units of Token" for simplicity in this Phase.
    // Or better, just return the params and let execute handle the precise logic.

    // We need to determine the range
    let minBinId = params.minBinId;
    let maxBinId = params.maxBinId;
    const binsPerSide = params.binsPerSide || 20;
    const centerBinOverride = params.centerBinOverride;

    if (strategyType !== StrategyType.BidAsk) {
      const centerBin = centerBinOverride ?? activeBin.binId;

      if (typeof minBinId !== 'number' || typeof maxBinId !== 'number') {
        minBinId = centerBin - binsPerSide;
        maxBinId = centerBin + binsPerSide;
      }

      // Ensure bins remain aligned with override when provided
      if (centerBinOverride !== undefined) {
        const span = binsPerSide;
        minBinId = centerBinOverride - span;
        maxBinId = centerBinOverride + span;
      }
    }

    const xDecimals = poolInfo.tokenX.decimals || 6;
    const yDecimals = poolInfo.tokenY.decimals || 6;
    const centerPrice = poolService.calculateBinPrice(
      activeBin.binId,
      poolInfo.binStep,
      xDecimals,
      yDecimals
    );

    return {
      poolAddress: poolInfo.address,
      strategy: params.strategy,
      strategyType,
      activeBinId: activeBin.binId,
      price: centerPrice,
      minBinId,
      maxBinId,
      rangeConfig: {
        strategy: params.strategy,
        minBinId,
        maxBinId,
        centerBin: centerBinOverride ?? activeBin.binId,
        binPrice: {
          minPrice: poolService.calculateBinPrice(minBinId!, poolInfo.binStep, xDecimals, yDecimals),
          maxPrice: poolService.calculateBinPrice(maxBinId!, poolInfo.binStep, xDecimals, yDecimals),
          centerPrice
        },
        tokenDistribution: {
          tokenXPercent: 50,
          tokenYPercent: 50
        }
      },
      tokenXAmount: params.amountX,
      tokenYAmount: params.amountY,
      swapNeeded: false // Phase 3
    };
  }

  public async executePositionCreation(params: CreatePositionParams, prepared: any): Promise<CreatePositionResult> {
    try {
      const keypair = walletService.getActiveKeypair();
      if (!keypair) throw new Error('No active wallet found');

      const dlmm = await poolService.getDlmmInstance(params.poolAddress);
      const newPositionKeypair = new Keypair();

      // Fetch fresh pool info for decimals
      const poolInfo = await poolService.getPoolInfo(params.poolAddress);

      // Convert explicit token amounts to BN with decimals
      const amountX = new BN(params.amountX * (10 ** poolInfo.tokenX.decimals));
      const amountY = new BN(params.amountY * (10 ** poolInfo.tokenY.decimals));

      const strategy = {
        maxBinId: prepared.maxBinId,
        minBinId: prepared.minBinId,
        strategyType: prepared.strategyType
      };

      const tx = await dlmm.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newPositionKeypair.publicKey,
        user: keypair.publicKey,
        totalXAmount: amountX,
        totalYAmount: amountY,
        strategy,
        slippage: params.slippage || 1 // 1% default
      });

      const connection = connectionService.getConnection();
      const signature = await sendAndConfirmTransaction(
        connection,
        tx,
        [keypair, newPositionKeypair],
        { commitment: 'confirmed' }
      );

      return {
        status: 'success',
        positionAddress: newPositionKeypair.publicKey.toBase58(),
        poolAddress: params.poolAddress,
        strategy: params.strategy,
        minBinId: strategy.minBinId,
        maxBinId: strategy.maxBinId,
        tokenXAmount: amountX.toNumber() / (10 ** poolInfo.tokenX.decimals),
        tokenYAmount: amountY.toNumber() / (10 ** poolInfo.tokenY.decimals),
        depositSignature: signature,
        cost: 0, // Calculate later
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Position creation failed:', error);
      let detailedMessage = error instanceof Error ? error.message : 'Unknown error';
      let capturedLogs: string[] | undefined;

      if (error instanceof SendTransactionError) {
        try {
          const connection = connectionService.getConnection();
          capturedLogs = await error.getLogs(connection);
          if (capturedLogs?.length) {
            console.error('Transaction logs:', capturedLogs.join('\n'));
            detailedMessage = `${detailedMessage}\nLogs:\n${capturedLogs.join('\n')}`;
          }
        } catch (logError) {
          console.warn('Unable to fetch transaction logs:', logError);
        }
      }

      return {
        status: 'failed',
        positionAddress: '',
        poolAddress: params.poolAddress,
        strategy: params.strategy,
        minBinId: 0,
        maxBinId: 0,
        tokenXAmount: 0,
        tokenYAmount: 0,
        depositSignature: '',
        cost: 0,
        timestamp: new Date().toISOString(),
        errorMessage: detailedMessage
      };
    }
  }
}

export const positionService = new PositionService();

