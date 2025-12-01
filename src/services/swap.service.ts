import { Connection, PublicKey, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { walletService } from './wallet.service';
import { poolService } from './pool.service';
import { connectionService } from './connection.service';
import { jupiterService, JupiterQuote } from './jupiter.service';

export interface SwapQuoteResult {
  inAmount: BN;
  outAmount: BN;
  fee: BN;
  priceImpact: number;
  minOutAmount: BN;
  binArraysPubkey: PublicKey[];
  swapForY: boolean;
  source?: 'dlmm' | 'jupiter';
}

export interface UniversalSwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpact: number;
  slippageBps: number;
  source: 'dlmm' | 'jupiter';
  route?: string[];
  // For DLMM execution
  dlmmQuote?: SwapQuoteResult;
  poolAddress?: string;
  // For Jupiter execution
  jupiterQuote?: JupiterQuote;
}

export class SwapService {
  private defaultSlippagePercent: number = 1; // 1% default

  /**
   * Set default slippage for all swaps
   */
  public setDefaultSlippage(slippagePercent: number): void {
    this.defaultSlippagePercent = slippagePercent;
    jupiterService.setDefaultSlippage(slippagePercent);
  }

  /**
   * Get a swap quote from DLMM pool (original method)
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
        binArraysPubkey: quote.binArraysPubkey.map(pk => new PublicKey(pk)),
        swapForY,
        source: 'dlmm'
      };

    } catch (error) {
      console.error('Error getting DLMM swap quote:', error);
      throw error;
    }
  }

  /**
   * Get best swap quote - tries DLMM first, falls back to Jupiter
   * Use this for any-to-any token swaps
   */
  public async getUniversalSwapQuote(
    inputMint: string,
    outputMint: string,
    amountIn: string, // in base units
    slippagePercent?: number,
    preferredPoolAddress?: string // Optional: try this DLMM pool first
  ): Promise<UniversalSwapQuote> {
    const slippage = slippagePercent ?? this.defaultSlippagePercent;
    const slippageBps = Math.floor(slippage * 100);

    // Try DLMM pool first if provided
    if (preferredPoolAddress) {
      try {
        const dlmm = await poolService.getDlmmInstance(preferredPoolAddress);
        const tokenXMint = dlmm.tokenX.publicKey.toBase58();
        const tokenYMint = dlmm.tokenY.publicKey.toBase58();

        // Check if this pool can handle the swap
        const swapForY = inputMint === tokenXMint && outputMint === tokenYMint;
        const swapForX = inputMint === tokenYMint && outputMint === tokenXMint;

        if (swapForY || swapForX) {
          const amountBN = new BN(amountIn);
          const quote = await this.getSwapQuote(preferredPoolAddress, amountBN, swapForY, slippage);

          console.log(`[Swap] Using DLMM pool for ${inputMint.slice(0, 6)}... → ${outputMint.slice(0, 6)}...`);

          return {
            inputMint,
            outputMint,
            inAmount: amountIn,
            outAmount: quote.outAmount.toString(),
            priceImpact: quote.priceImpact,
            slippageBps,
            source: 'dlmm',
            route: ['Meteora DLMM'],
            dlmmQuote: quote,
            poolAddress: preferredPoolAddress,
          };
        }
      } catch (error) {
        console.log(`[Swap] DLMM pool not suitable, trying Jupiter...`);
      }
    }

    // Fall back to Jupiter for best route
    try {
      console.log(`[Swap] Using Jupiter aggregator for ${inputMint.slice(0, 6)}... → ${outputMint.slice(0, 6)}...`);
      const jupQuote = await jupiterService.getQuote(inputMint, outputMint, amountIn, slippageBps);

      return {
        inputMint,
        outputMint,
        inAmount: jupQuote.inAmount,
        outAmount: jupQuote.outAmount,
        priceImpact: parseFloat(jupQuote.priceImpactPct),
        slippageBps,
        source: 'jupiter',
        route: jupQuote.routePlan.map(step => step.swapInfo.label),
        jupiterQuote: jupQuote,
      };
    } catch (error: any) {
      console.error('Error getting Jupiter quote:', error);
      throw new Error(`No swap route found: ${error.message}`);
    }
  }

  /**
   * Execute a swap based on a quote (original DLMM method)
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
      console.error('Error executing DLMM swap:', error);
      throw error;
    }
  }

  /**
   * Execute a universal swap (DLMM or Jupiter based on quote source)
   */
  public async executeUniversalSwap(
    quote: UniversalSwapQuote,
    keypair: Keypair
  ): Promise<string> {
    if (quote.source === 'dlmm' && quote.dlmmQuote && quote.poolAddress) {
      // Execute via DLMM
      const dlmm = await poolService.getDlmmInstance(quote.poolAddress);

      const tx = await dlmm.swap({
        inToken: quote.dlmmQuote.swapForY ? dlmm.tokenX.publicKey : dlmm.tokenY.publicKey,
        outToken: quote.dlmmQuote.swapForY ? dlmm.tokenY.publicKey : dlmm.tokenX.publicKey,
        inAmount: quote.dlmmQuote.inAmount,
        minOutAmount: quote.dlmmQuote.minOutAmount,
        lbPair: new PublicKey(quote.poolAddress),
        user: keypair.publicKey,
        binArraysPubkey: quote.dlmmQuote.binArraysPubkey
      });

      const connection = connectionService.getConnection();
      return await sendAndConfirmTransaction(connection, tx, [keypair], { commitment: 'confirmed' });

    } else if (quote.source === 'jupiter' && quote.jupiterQuote) {
      // Execute via Jupiter
      const transaction = await jupiterService.getSwapTransaction(quote.jupiterQuote, keypair.publicKey);
      transaction.sign([keypair]);

      const connection = connectionService.getConnection();
      const rawTransaction = transaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      await connection.confirmTransaction(signature, 'confirmed');
      return signature;

    } else {
      throw new Error('Invalid quote: missing execution data');
    }
  }

  /**
   * Simple any-to-any swap - combines quote and execute
   */
  public async swapTokens(
    inputMint: string,
    outputMint: string,
    amountIn: string,
    keypair: Keypair,
    slippagePercent?: number,
    preferredPoolAddress?: string
  ): Promise<{ signature: string; outputAmount: string; priceImpact: number; source: string }> {
    const quote = await this.getUniversalSwapQuote(
      inputMint,
      outputMint,
      amountIn,
      slippagePercent,
      preferredPoolAddress
    );

    const signature = await this.executeUniversalSwap(quote, keypair);

    return {
      signature,
      outputAmount: quote.outAmount,
      priceImpact: quote.priceImpact,
      source: quote.source,
    };
  }
}

export const swapService = new SwapService();

