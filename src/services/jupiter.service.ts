/**
 * Jupiter Aggregator Service
 * Provides best-route swaps across all Solana DEXs when DLMM pool doesn't support direct swap
 */

import { Connection, PublicKey, VersionedTransaction, TransactionMessage, TransactionInstruction } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import { connectionService } from './connection.service';

// Jupiter Public API - free endpoint (no auth required)
const JUPITER_API_BASE = 'https://public.jupiterapi.com';

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface JupiterSwapResult {
  signature: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  route: string[];
}

export class JupiterService {
  private defaultSlippageBps: number = 100; // 1% default

  /**
   * Set default slippage for all swaps
   */
  public setDefaultSlippage(slippagePercent: number): void {
    this.defaultSlippageBps = Math.floor(slippagePercent * 100);
  }

  /**
   * Get a swap quote from Jupiter with retry logic
   */
  public async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string, // in base units (lamports for SOL)
    slippageBps?: number
  ): Promise<JupiterQuote> {
    const slippage = slippageBps ?? this.defaultSlippageBps;
    
    const url = new URL(`${JUPITER_API_BASE}/quote`);
    url.searchParams.append('inputMint', inputMint);
    url.searchParams.append('outputMint', outputMint);
    url.searchParams.append('amount', amount);
    url.searchParams.append('slippageBps', slippage.toString());
    url.searchParams.append('onlyDirectRoutes', 'false');
    url.searchParams.append('asLegacyTransaction', 'false');

    // Retry logic for network issues
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        
        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Jupiter quote failed: ${response.status} - ${errorText}`);
        }

        const quote = await response.json() as JupiterQuote & { error?: string };
        
        if (quote.error) {
          throw new Error(`Jupiter quote error: ${quote.error}`);
        }

        return quote;
      } catch (error: any) {
        lastError = error;
        const isNetworkError = error.code === 'ENOTFOUND' || 
                               error.code === 'ECONNREFUSED' ||
                               error.name === 'AbortError' ||
                               error.message?.includes('fetch failed');
        
        if (isNetworkError && attempt < 3) {
          console.warn(`[Jupiter] Network error on attempt ${attempt}, retrying in ${attempt}s...`);
          await new Promise(r => setTimeout(r, attempt * 1000));
          continue;
        }
        
        // If it's a network error, provide helpful message
        if (isNetworkError) {
          throw new Error(`Network error connecting to Jupiter API. Please check your internet connection and try again.`);
        }
        throw error;
      }
    }
    
    throw lastError || new Error('Failed to get Jupiter quote after retries');
  }

  /**
   * Get swap transaction from Jupiter
   */
  public async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: PublicKey,
    options?: {
      wrapUnwrapSOL?: boolean;
      dynamicComputeUnitLimit?: boolean;
      prioritizationFeeLamports?: number | 'auto';
    }
  ): Promise<VersionedTransaction> {
    const response = await fetch(`${JUPITER_API_BASE}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: userPublicKey.toString(),
        wrapAndUnwrapSol: options?.wrapUnwrapSOL ?? true,
        dynamicComputeUnitLimit: options?.dynamicComputeUnitLimit ?? true,
        prioritizationFeeLamports: options?.prioritizationFeeLamports ?? 'auto',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jupiter swap transaction failed: ${response.status} - ${errorText}`);
    }

    const swapData = await response.json() as { swapTransaction: string; error?: string };

    if (swapData.error) {
      throw new Error(`Jupiter swap error: ${swapData.error}`);
    }

    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
    return VersionedTransaction.deserialize(swapTransactionBuf);
  }

  /**
   * Execute a swap through Jupiter
   */
  public async executeSwap(
    inputMint: string,
    outputMint: string,
    amount: string,
    keypair: Keypair,
    slippageBps?: number
  ): Promise<JupiterSwapResult> {
    const connection = connectionService.getConnection();

    // Get quote
    console.log(`[Jupiter] Getting quote: ${inputMint.slice(0, 8)}... → ${outputMint.slice(0, 8)}...`);
    const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);

    const priceImpact = parseFloat(quote.priceImpactPct);
    if (priceImpact > 5) {
      console.warn(`[Jupiter] ⚠️ High price impact: ${priceImpact.toFixed(2)}%`);
    }

    // Get swap transaction
    console.log(`[Jupiter] Building swap transaction...`);
    const transaction = await this.getSwapTransaction(quote, keypair.publicKey);

    // Sign transaction
    transaction.sign([keypair]);

    // Send and confirm
    console.log(`[Jupiter] Sending transaction...`);
    const rawTransaction = transaction.serialize();
    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });

    console.log(`[Jupiter] Confirming: ${signature.slice(0, 12)}...`);
    await connection.confirmTransaction(signature, 'confirmed');

    // Extract route labels
    const routeLabels = quote.routePlan.map(step => step.swapInfo.label);

    return {
      signature,
      inputAmount: parseInt(quote.inAmount),
      outputAmount: parseInt(quote.outAmount),
      priceImpact,
      route: routeLabels,
    };
  }

  /**
   * Check if a direct route exists between two tokens
   */
  public async hasDirectRoute(inputMint: string, outputMint: string): Promise<boolean> {
    try {
      const url = new URL(`${JUPITER_API_BASE}/quote`);
      url.searchParams.append('inputMint', inputMint);
      url.searchParams.append('outputMint', outputMint);
      url.searchParams.append('amount', '1000000'); // 1 USDC worth for check
      url.searchParams.append('onlyDirectRoutes', 'true');

      const response = await fetch(url.toString());
      if (!response.ok) return false;

      const quote = await response.json() as { error?: string; routePlan?: unknown[] };
      return !quote.error && (quote.routePlan?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get price estimate using Jupiter (more accurate than pool price for exotic tokens)
   */
  public async getPrice(
    tokenMint: string,
    vsTokenMint: string = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
  ): Promise<number | null> {
    try {
      // Get quote for 1 unit of token
      const decimals = await this.getTokenDecimals(tokenMint);
      const amount = Math.pow(10, decimals).toString();

      const quote = await this.getQuote(tokenMint, vsTokenMint, amount);
      
      // USDC has 6 decimals
      const usdcAmount = parseInt(quote.outAmount) / 1e6;
      return usdcAmount;
    } catch {
      return null;
    }
  }

  /**
   * Get token decimals (helper)
   */
  private async getTokenDecimals(mint: string): Promise<number> {
    try {
      const connection = connectionService.getConnection();
      const mintPubkey = new PublicKey(mint);
      const info = await connection.getParsedAccountInfo(mintPubkey);
      
      if (info.value?.data && 'parsed' in info.value.data) {
        return info.value.data.parsed.info.decimals;
      }
      return 9; // Default to 9 (SOL)
    } catch {
      return 9;
    }
  }
}

export const jupiterService = new JupiterService();
