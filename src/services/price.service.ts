import axios from 'axios';
import { pythWebSocketService, MINT_TO_PYTH_FEED } from './pythWebSocket.service';

export interface TokenPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

export class PriceService {
  // DexScreener is secondary fallback - fast, free, reliable, no auth required
  private readonly DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
  private readonly COINGECKO_ENDPOINT = 'https://api.coingecko.com/api/v3/simple/token_price/solana';

  private cache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 300 * 1000; // 5 minute cache for fallback APIs
  private readonly PYTH_CACHE_TTL = 5 * 1000; // 5 second cache for Pyth (it streams real-time)
  private readonly REQUEST_TIMEOUT = 3000; // 3 second timeout
  private pendingRequests = new Map<string, Promise<number>>(); // Deduplicate concurrent requests
  private pythInitialized = false;

  // Well-known token prices as fallbacks (updated: 2025-11-26)
  private readonly FALLBACK_PRICES = new Map([
    ['So11111111111111111111111111111111111111112', 240], // SOL ~$240 (as of Nov 2025)
    ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 1], // USDC $1
    ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 1], // USDT $1
  ]);

  /**
   * Initialize Pyth WebSocket connection for real-time prices
   * Call this once at app startup
   */
  public async initializePythStream(): Promise<void> {
    if (this.pythInitialized) return;
    
    try {
      console.log('[PriceService] Initializing Pyth WebSocket stream...');
      await pythWebSocketService.subscribeToSolanaTokens();
      this.pythInitialized = true;
      console.log('[PriceService] ✓ Pyth real-time price stream active');
    } catch (error) {
      console.warn('[PriceService] Failed to initialize Pyth stream, will use REST fallbacks:', error);
    }
  }

  /**
   * Get USD price for a single token
   * Priority: 1) Pyth WebSocket (real-time) 2) DexScreener 3) CoinGecko 4) Fallback
   */
  public async getTokenPrice(mint: string): Promise<number> {
    try {
      // 1. Try Pyth WebSocket first (real-time, ~100ms latency)
      const pythPrice = pythWebSocketService.getPriceByMint(mint);
      if (pythPrice !== undefined && pythPrice > 0) {
        // Update cache with Pyth price
        this.cache.set(mint, { price: pythPrice, timestamp: Date.now() });
        return pythPrice;
      }

      // 2. Check cache (for non-Pyth tokens)
      const cached = this.cache.get(mint);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.price;
      }

      // Check if there's already a pending request for this token
      const pendingRequest = this.pendingRequests.get(mint);
      if (pendingRequest) {
        return pendingRequest;
      }

      // Create a new request and track it
      const fetchPromise = this.fetchTokenPrice(mint);
      this.pendingRequests.set(mint, fetchPromise);

      try {
        const price = await fetchPromise;
        return price;
      } finally {
        this.pendingRequests.delete(mint);
      }
    } catch (error) {
      // Return fallback price on error
      const fallback = this.FALLBACK_PRICES.get(mint);
      return fallback || 0;
    }
  }

  /**
   * Get USD prices for multiple tokens (optimized batch fetch)
   * Uses Pyth WebSocket for known tokens, DexScreener for others
   */
  public async getTokenPrices(mints: string[]): Promise<Map<string, number>> {
    const resultMap = new Map<string, number>();
    const mintsToFetch: string[] = [];

    // First, check Pyth WebSocket for real-time prices
    for (const mint of mints) {
      const pythPrice = pythWebSocketService.getPriceByMint(mint);
      if (pythPrice !== undefined && pythPrice > 0) {
        resultMap.set(mint, pythPrice);
        this.cache.set(mint, { price: pythPrice, timestamp: Date.now() });
        continue;
      }

      // Check cache for non-Pyth tokens
      const cached = this.cache.get(mint);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        resultMap.set(mint, cached.price);
      } else {
        mintsToFetch.push(mint);
      }
    }

    // If all cached, return immediately
    if (mintsToFetch.length === 0) {
      return resultMap;
    }

    // Fetch all uncached prices in parallel using DexScreener
    const pricePromises = mintsToFetch.map(async (mint) => {
      try {
        const price = await this.getTokenPrice(mint);
        return { mint, price };
      } catch (e) {
        return { mint, price: 0 };
      }
    });

    const results = await Promise.allSettled(pricePromises);
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { mint, price } = result.value;
        if (price > 0) {
          resultMap.set(mint, price);
        }
      }
    });

    // Fill in fallback prices for any still missing
    for (const mint of mintsToFetch) {
      if (!resultMap.has(mint)) {
        const fallback = this.FALLBACK_PRICES.get(mint);
        if (fallback) resultMap.set(mint, fallback);
      }
    }

    return resultMap;
  }

  /**
   * Internal method to fetch token price
   */
  private async fetchTokenPrice(mint: string): Promise<number> {
    try {
      // Try DexScreener first (fast, free, reliable)
      let price = await this.fetchPriceFromDexScreener(mint);
      let apiSource = 'dexscreener';

      // Try CoinGecko if DexScreener fails
      if (price === 0) {
        console.warn(`⚠️  DexScreener failed for ${mint.slice(0, 8)}..., trying CoinGecko`);
        try {
          price = await this.fetchPriceFromCoingecko(mint);
          if (price > 0) {
            apiSource = 'coingecko';
            console.log(`✓ Fetched price from CoinGecko for ${mint.slice(0, 8)}...: $${price.toFixed(4)}`);
          }
        } catch (error) {
          console.warn(`⚠️  CoinGecko price fetch failed for ${mint.slice(0, 8)}...: ${error instanceof Error ? error.message : error}`);
        }
      }

      // Use fallback price if all APIs fail
      if (price === 0) {
        const fallback = this.FALLBACK_PRICES.get(mint);
        if (fallback) {
          console.warn(`⚠️  All price APIs failed for ${mint.slice(0, 8)}... Using fallback price: $${fallback}`);
          price = fallback;
          apiSource = 'fallback';
        } else {
          console.warn(`⚠️  No price available for ${mint.slice(0, 8)}... (not in fallback list)`);
        }
      }

      if (price > 0) {
        this.cache.set(mint, { price, timestamp: Date.now() });
      }

      return price;
    } catch (error) {
      console.error(`Failed to fetch price for ${mint}:`, error);

      // Return fallback price
      const fallback = this.FALLBACK_PRICES.get(mint);
      if (fallback) {
        console.warn(`Using fallback price after error: $${fallback}`);
      }
      return fallback || 0;
    }
  }

  /**
   * Fetch price from DexScreener API (primary - fast and free)
   */
  private async fetchPriceFromDexScreener(mint: string): Promise<number> {
    try {
      const url = `${this.DEXSCREENER_API}/${mint}`;
      const response = await axios.get(url, {
        timeout: this.REQUEST_TIMEOUT,
        headers: { 'User-Agent': 'DLMM-CLI/1.0.0' }
      });

      // DexScreener returns pairs sorted by volume/liquidity
      // Pick the first pair with a valid priceUsd
      if (response.data && response.data.pairs && response.data.pairs.length > 0) {
        const topPair = response.data.pairs[0];
        const priceUsd = parseFloat(topPair.priceUsd);
        if (!isNaN(priceUsd) && priceUsd > 0) {
          return priceUsd;
        }
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  private async fetchPriceFromCoingecko(mint: string): Promise<number> {
    try {
      const normalizedMint = mint.toLowerCase();
      const url = `${this.COINGECKO_ENDPOINT}?contract_addresses=${mint}&vs_currencies=usd`;
      const response = await axios.get(url, {
        timeout: this.REQUEST_TIMEOUT,
        headers: {
          'User-Agent': 'DLMM-CLI/1.0.0'
        }
      });

      const candidates = [mint, normalizedMint];
      for (const key of candidates) {
        const entry = response.data?.[key];
        if (entry && typeof entry.usd === 'number') {
          return entry.usd;
        }
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get historical prices for a token (using Birdeye)
   * @param mint Token mint address
   * @param days Number of days of history
   */
  public async getHistoricalPrices(mint: string, days: number): Promise<{ timestamp: number; price: number }[]> {
    try {
      // Check cache first
      const cacheKey = `${mint}_${days}d`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log(`  ✓ Using cached price history for ${mint.slice(0, 8)}...`);
        return cached.price as any; // Reuse cache structure
      }

      // Lazy load config to avoid circular dependencies
      const { configManager } = require('../config/config.manager');
      const config = configManager.getConfig();
      const apiKey = config.preferences.birdeyeApiKey;

      if (!apiKey) {
        console.warn('⚠️  Birdeye API key not configured. Skipping historical price fetch.');
        return [];
      }

      const from = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
      const to = Math.floor(Date.now() / 1000);

      // Optimize interval - use 1D for anything >= 7 days to reduce data points
      // This reduces 30-day fetch from 180 points (4H) to 30 points (1D)
      let type = '1H';
      if (days >= 7) {
        type = '1D';  // Daily for 7+ days (much faster, sufficient for volatility analysis)
      } else if (days >= 2) {
        type = '4H';  // 4-hourly for 2-6 days
      }

      const url = `https://public-api.birdeye.so/defi/history_price?address=${mint}&address_type=token&type=${type}&time_from=${from}&time_to=${to}`;

      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': apiKey,
          'x-chain': 'solana',
          'User-Agent': 'DLMM-CLI/1.0.0'
        },
        timeout: 15000 // Increased timeout for reliability
      });

      if (response.data && response.data.success && response.data.data && response.data.data.items) {
        const priceHistory = response.data.data.items.map((item: any) => ({
          timestamp: item.unixTime * 1000,
          price: item.value
        }));

        // Cache the result for 1 minute
        this.cache.set(cacheKey, { price: priceHistory as any, timestamp: Date.now() });

        return priceHistory;
      }

      return [];
    } catch (error: any) {
      console.warn(`⚠️  Failed to fetch historical prices from Birdeye: ${error.message}`);
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.warn('   Please check your Birdeye API key in settings.');
      }
      return [];
    }
  }
}

export const priceService = new PriceService();
