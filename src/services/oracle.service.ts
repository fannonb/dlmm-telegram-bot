import axios from 'axios';

interface CachedPrice {
  price: number;
  timestamp: number;
}

interface CachedSeries {
  points: PricePoint[];
  timestamp: number;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

const PRICE_CACHE_TTL = 60_000; // 1 minute

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINTS = [
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Devnet USDC
  'Es9vMFrzaCERFjfQ2J8b8zEfYFvuJMosuUo9A99G1S3', // Legacy SPL USDC
];
const MET_MINT = 'METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL';

const MINT_TO_COINGECKO_ID: Record<string, string> = {
  [SOL_MINT]: 'solana',
  [MET_MINT]: 'meteora',
  ...USDC_MINTS.reduce((acc, mint) => ({ ...acc, [mint]: 'usd-coin' }), {}),
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'marinade-staked-sol',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jito-staked-sol',
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 'blazestake-staked-sol',
};

class OracleService {
  private cache = new Map<string, CachedPrice>();
  private seriesCache = new Map<string, CachedSeries>();
  private requestCache = new Map<string, { data: any, timestamp: number }>();
  private lastRequestTime = 0;
  private requestDelay = 1000; // Minimum 1 second between requests

  private getCoinGeckoId(mint: string): string | null {
    return MINT_TO_COINGECKO_ID[mint] || null;
  }

  private buildCacheKey(id: string): string {
    return `coingecko:${id}`;
  }

  private buildSeriesCacheKey(id: string, hours: number): string {
    return `coingecko:series:${id}:${hours}`;
  }

  private async fetchPrices(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const uniqueIds = Array.from(new Set(ids));
    const cacheKey = `prices:${uniqueIds.join(',')}`;
    
    // Check cache first (5 minute cache)
    const cached = this.requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300_000) {
      console.log(`[Oracle] Using cached prices for ${uniqueIds.length} tokens`);
      const data = cached.data;
      for (const [id, info] of Object.entries(data)) {
        if (typeof info === 'object' && info !== null && 'usd' in info) {
          this.cache.set(this.buildCacheKey(id), {
            price: (info as any).usd,
            timestamp: Date.now(),
          });
        }
      }
      return;
    }

    // Rate limiting - ensure minimum delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelay) {
      const waitTime = this.requestDelay - timeSinceLastRequest;
      console.log(`[Oracle] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds.join(',')}&vs_currencies=usd`;
    
    let lastError: any;
    let retryDelay = 2000; // Start with 2 seconds
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Oracle] Fetching prices for ${uniqueIds.length} tokens (attempt ${attempt})`);
        this.lastRequestTime = Date.now();
        
        const response = await axios.get(url, { 
          timeout: 10_000,
          headers: {
            'User-Agent': 'DLMM-Bot/1.0 (Telegram Bot)',
          }
        });
        
        const data = response.data;
        
        // Cache the successful response
        this.requestCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
        
        console.log(`[Oracle] Successfully fetched prices for ${Object.keys(data).length} tokens`);

        for (const [id, info] of Object.entries(data)) {
          if (typeof info === 'object' && info !== null && 'usd' in info) {
            this.cache.set(this.buildCacheKey(id), {
              price: (info as any).usd,
              timestamp: Date.now(),
            });
          }
        }
        return; // Success, exit retry loop
        
      } catch (error: any) {
        lastError = error;
        
        if (error.response?.status === 429) {
          // Rate limited - respect retry-after header or use exponential backoff
          const retryAfter = error.response.headers['retry-after'];
          const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(retryDelay * 2, 120_000);
          
          console.warn(`[Oracle] Rate limited, waiting ${delayMs/1000}s before retry ${attempt}/3`);
          
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            retryDelay = Math.min(retryDelay * 2, 120_000);
            this.requestDelay = Math.max(this.requestDelay * 1.5, 3000); // Increase future delays
            continue;
          }
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'TIMEOUT') {
          console.warn(`[Oracle] Network error (attempt ${attempt}): ${error.message}`);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2;
            continue;
          }
        }
        
        console.error(`[Oracle] Error fetching prices (attempt ${attempt}):`, error.message);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 2;
        }
      }
    }
    
    console.error(`[Oracle] Failed to fetch prices after 3 attempts:`, lastError?.message);
    throw lastError;
  }

  private async getUsdForIds(ids: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    const idsNeedingFetch: string[] = [];

    ids.forEach((id) => {
      const cached = this.cache.get(this.buildCacheKey(id));
      if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
        results.set(id, cached.price);
      } else {
        idsNeedingFetch.push(id);
      }
    });

    if (idsNeedingFetch.length) {
      try {
        await this.fetchPrices(idsNeedingFetch);
        idsNeedingFetch.forEach((id) => {
          const cached = this.cache.get(this.buildCacheKey(id));
          if (cached) {
            results.set(id, cached.price);
          }
        });
      } catch (error) {
        console.warn('Oracle fetch failed:', error);
      }
    }

    return results;
  }

  private async fetchPriceSeriesForId(id: string, hours: number): Promise<PricePoint[]> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const fromSeconds = nowSeconds - Math.max(1, Math.round(hours * 3600));
    const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${fromSeconds}&to=${nowSeconds}`;

    // Check cache first
    const cacheKey = `series:${id}_${fromSeconds}_${nowSeconds}`;
    const cached = this.requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300_000) { // 5 minute cache
      console.log(`[Oracle] Using cached series data for ${id}`);
      return cached.data;
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelay) {
      const waitTime = this.requestDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    let lastError: any;
    let retryDelay = 1000; // Start with 1 second
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Oracle] Fetching series ${id} (attempt ${attempt})`);
        this.lastRequestTime = Date.now();
        
        const response = await axios.get(url, { 
          timeout: 10_000,
          headers: {
            'User-Agent': 'DLMM-Bot/1.0',
          }
        });
        
        const prices: Array<[number, number]> = response.data?.prices ?? [];
        const result = prices
          .filter((entry) => Array.isArray(entry) && entry.length >= 2)
          .map(([timestamp, price]) => ({
            timestamp,
            price,
          }))
          .filter((point) => typeof point.price === 'number' && Number.isFinite(point.price));

        // Cache successful result
        this.requestCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });

        console.log(`[Oracle] Successfully fetched ${result.length} price points for ${id}`);
        return result;
        
      } catch (error: any) {
        lastError = error;
        
        if (error.response?.status === 429) {
          // Rate limited - respect retry-after header
          const retryAfter = error.response.headers['retry-after'];
          const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(retryDelay * 2, 60000);
          
          console.warn(`[Oracle] Rate limited for ${id}, waiting ${delayMs/1000}s before retry ${attempt}/${3}`);
          
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            retryDelay = Math.min(retryDelay * 2, 60000);
            this.requestDelay = Math.max(this.requestDelay * 1.5, 3000);
            continue;
          }
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          console.warn(`[Oracle] Network error for ${id} (attempt ${attempt}): ${error.message}`);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2;
            continue;
          }
        }
        
        console.error(`[Oracle] Error fetching ${id} (attempt ${attempt}):`, error.message);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 2;
        }
      }
    }
    
    console.error(`[Oracle] Failed to fetch ${id} after 3 attempts:`, lastError?.message);
    throw lastError;
  }

  public async getUsdPriceSeries(mint: string, hours: number): Promise<PricePoint[]> {
    const coinGeckoId = this.getCoinGeckoId(mint);
    if (!coinGeckoId) return [];

    const cacheKey = this.buildSeriesCacheKey(coinGeckoId, hours);
    const cached = this.seriesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
      return cached.points;
    }

    try {
      const points = await this.fetchPriceSeriesForId(coinGeckoId, hours);
      this.seriesCache.set(cacheKey, { points, timestamp: Date.now() });
      return points;
    } catch (error) {
      console.error(`[Oracle] Failed to fetch price series for ${mint}:`, error);
      return [];
    }
  }

  public async getUsdPrice(mint: string): Promise<number | null> {
    const coinGeckoId = this.getCoinGeckoId(mint);
    if (!coinGeckoId) return null;

    const prices = await this.getUsdForIds([coinGeckoId]);
    return prices.get(coinGeckoId) ?? null;
  }

  public async getUsdPrices(mints: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    const coinGeckoIds: string[] = [];
    const mintToCoinGeckoId = new Map<string, string>();

    for (const mint of mints) {
      const coinGeckoId = this.getCoinGeckoId(mint);
      if (coinGeckoId) {
        coinGeckoIds.push(coinGeckoId);
        mintToCoinGeckoId.set(mint, coinGeckoId);
      }
    }

    if (coinGeckoIds.length === 0) return results;

    try {
      const prices = await this.getUsdForIds(coinGeckoIds);
      for (const [mint, coinGeckoId] of mintToCoinGeckoId.entries()) {
        const price = prices.get(coinGeckoId);
        if (price !== undefined) {
          results.set(mint, price);
        }
      }
    } catch (error) {
      console.error('[Oracle] Failed to fetch USD prices:', error);
    }

    return results;
  }

  public async getPriceRatio(tokenA: string, tokenB: string): Promise<number | null> {
    try {
      const [priceA, priceB] = await Promise.all([
        this.getUsdPrice(tokenA),
        this.getUsdPrice(tokenB),
      ]);

      if (priceA === null || priceB === null || priceB === 0) {
        return null;
      }

      return priceA / priceB;
    } catch (error) {
      console.error(`[Oracle] Failed to get price ratio for ${tokenA}/${tokenB}:`, error);
      return null;
    }
  }

  public async buildPriceRatioSeries(tokenA: string, tokenB: string, hours: number): Promise<PricePoint[]> {
    try {
      const [seriesA, seriesB] = await Promise.all([
        this.getUsdPriceSeries(tokenA, hours),
        this.getUsdPriceSeries(tokenB, hours),
      ]);

      if (seriesA.length === 0 || seriesB.length === 0) return [];

      // Create time-aligned ratio series
      const ratioSeries: PricePoint[] = [];
      const bMap = new Map(seriesB.map((point) => [point.timestamp, point.price]));

      for (const pointA of seriesA) {
        const priceB = bMap.get(pointA.timestamp);
        if (priceB && priceB > 0) {
          ratioSeries.push({
            timestamp: pointA.timestamp,
            price: pointA.price / priceB,
          });
        }
      }

      return ratioSeries;
    } catch (error) {
      console.error('[Oracle] Failed to build price ratio series:', error);
      return [];
    }
  }
}

export const oracleService = new OracleService();