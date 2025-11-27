import { Connection, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { walletService } from './wallet.service';
import { poolService } from './pool.service';
import { connectionService } from './connection.service';

export interface SwapQuoteResult {
  inAmount: BN;
  outAmount: BN;
  fee: BN;
  priceImpact: number;
  minOutAmount: BN;
  binArraysPubkey: PublicKey[];
  swapForY: boolean;
}

export class SwapService {
  
  /**
   * Get a swap quote
   */
  public async getSwapQuote(
    poolAddress: string, 
    amountIn: BN, 
    swapForY: boolean, 
    slippagePercent: number
  ): Promise<SwapQuoteResult> {
    try {
      const dlmm = await poolService.getDlmmInstance(poolAddress);
      
      // Fetch bin arrays required for the swap
      const binArrays = await dlmm.getBinArrayForSwap(swapForY);
      
      // Calculate allowed slippage in basis points (e.g., 1% = 100 bps)
      const allowedSlippage = new BN(slippagePercent * 100);

      const quote = dlmm.swapQuote(
        amountIn,
        swapForY,
        allowedSlippage,
        binArrays
      );

      return {
        inAmount: amountIn,
        outAmount: quote.outAmount,
        fee: quote.fee,
        priceImpact: Number(quote.priceImpact),
        minOutAmount: quote.minOutAmount,
        binArraysPubkey: quote.binArraysPubkey.map(pk => new PublicKey(pk)), // Ensure PublicKey type
        swapForY
      };

    } catch (error) {
      console.error('Error getting swap quote:', error);
      throw error;
    }
  }

  /**
   * Execute a swap based on a quote
   */
  public async executeSwap(
    poolAddress: string,
    quote: SwapQuoteResult
  ): Promise<string> {
    try {
      const keypair = walletService.getActiveKeypair();
      if (!keypair) throw new Error('No active wallet found');

      const dlmm = await poolService.getDlmmInstance(poolAddress);

      const tx = await dlmm.swap({
        inToken: quote.swapForY ? dlmm.tokenX.publicKey : dlmm.tokenY.publicKey,
        outToken: quote.swapForY ? dlmm.tokenY.publicKey : dlmm.tokenX.publicKey,
        inAmount: quote.inAmount,
        minOutAmount: quote.minOutAmount,
        lbPair: new PublicKey(poolAddress),
        user: keypair.publicKey,
        binArraysPubkey: quote.binArraysPubkey
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
      console.error('Error executing swap:', error);
      throw error;
    }
  }
}

export const swapService = new SwapService();

