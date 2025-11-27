import { EventEmitter } from 'events';

/**
 * Pyth Network WebSocket Service
 * 
 * Provides real-time price streaming from Pyth Network's Hermes service.
 * This is FREE with no API key required.
 * 
 * Endpoints:
 * - SSE Streaming: https://hermes.pyth.network/v2/updates/price/stream
 * - REST Fallback: https://hermes.pyth.network/v2/updates/price/latest
 */

// Pyth Price Feed IDs (hex format)
// Full list: https://pyth.network/developers/price-feed-ids
export const PYTH_PRICE_FEEDS = {
  // Crypto
  'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'USDT/USD': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  'JUP/USD': '0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
  'BONK/USD': '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  'RAY/USD': '0x91568baa8beb53db23eb3fb7f22c6e8bd303d103919e19733f2bb642d3e7987a',
  'ORCA/USD': '0x37505261e557e251290b8c8899453064e8d760e6f6a39c6c2d12e9a3a5ee4e85',
  'MNGO/USD': '0x60c466bfe50fd5bbea4c628c9f4b9f539d3c89c41f70c5f87d25fb63d2b6c9b1',
} as const;

// Token mint to Pyth feed ID mapping
export const MINT_TO_PYTH_FEED: Record<string, string> = {
  // SOL (wrapped)
  'So11111111111111111111111111111111111111112': PYTH_PRICE_FEEDS['SOL/USD'],
  // USDC
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': PYTH_PRICE_FEEDS['USDC/USD'],
  // USDT
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': PYTH_PRICE_FEEDS['USDT/USD'],
  // JUP
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': PYTH_PRICE_FEEDS['JUP/USD'],
  // BONK
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': PYTH_PRICE_FEEDS['BONK/USD'],
};

export interface PythPriceUpdate {
  id: string;           // Feed ID (hex)
  price: number;        // USD price
  conf: number;         // Confidence interval
  expo: number;         // Exponent
  publishTime: number;  // Unix timestamp (seconds)
  emaPrice: number;     // Exponential moving average price
  emaConf: number;      // EMA confidence
}

export interface PythStreamMessage {
  binary: {
    encoding: string;
    data: string[];
  };
  parsed: Array<{
    id: string;
    price: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    };
    ema_price: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    };
  }>;
}

class PythWebSocketService extends EventEmitter {
  private readonly HERMES_SSE_URL = 'https://hermes.pyth.network/v2/updates/price/stream';
  private readonly HERMES_REST_URL = 'https://hermes.pyth.network/v2/updates/price/latest';
  
  private eventSource: any = null;
  private subscribedFeeds: Set<string> = new Set();
  private prices: Map<string, PythPriceUpdate> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY_MS = 3000;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setMaxListeners(50); // Allow many listeners for price updates
    
    // Add default error handler to prevent unhandled error crashes
    this.on('error', (error) => {
      // Error already logged in onerror handler, just prevent crash
    });
  }

  /**
   * Get current price for a feed
   */
  public getPrice(feedId: string): PythPriceUpdate | undefined {
    return this.prices.get(feedId.toLowerCase());
  }

  /**
   * Get price by token mint address
   */
  public getPriceByMint(mint: string): number | undefined {
    const feedId = MINT_TO_PYTH_FEED[mint];
    if (!feedId) return undefined;
    
    const priceUpdate = this.prices.get(feedId.toLowerCase());
    return priceUpdate?.price;
  }

  /**
   * Check if a mint has a Pyth price feed
   */
  public hasPythFeed(mint: string): boolean {
    return mint in MINT_TO_PYTH_FEED;
  }

  /**
   * Subscribe to price feeds using Server-Sent Events (SSE)
   * This provides real-time streaming updates
   */
  public async subscribe(feedIds: string[]): Promise<void> {
    // Add to subscribed feeds
    feedIds.forEach(id => this.subscribedFeeds.add(id.toLowerCase()));

    // If already connected, we'd need to reconnect with new feeds
    // For simplicity, reconnect if we're adding new feeds
    if (this.isConnected && feedIds.some(id => !this.subscribedFeeds.has(id.toLowerCase()))) {
      await this.disconnect();
    }

    if (!this.isConnected) {
      await this.connect();
    }
  }

  /**
   * Subscribe to all known Solana token feeds
   */
  public async subscribeToSolanaTokens(): Promise<void> {
    const feedIds = Object.values(MINT_TO_PYTH_FEED);
    await this.subscribe(feedIds);
  }

  /**
   * Connect to Pyth Hermes SSE stream
   */
  private async connect(): Promise<void> {
    if (this.subscribedFeeds.size === 0) {
      console.warn('[PythWS] No feeds to subscribe to');
      return;
    }

    try {
      // Build URL with feed IDs
      const feedArray = Array.from(this.subscribedFeeds);
      const idsParams = feedArray.map(id => `ids[]=${id}`).join('&');
      const url = `${this.HERMES_SSE_URL}?${idsParams}`;

      console.log(`[PythWS] Connecting to Pyth Hermes SSE stream...`);
      console.log(`[PythWS] Subscribing to ${feedArray.length} price feeds`);

      // Use dynamic import for EventSource (works in Node.js with eventsource package)
      const EventSourceModule = await import('eventsource');
      const EventSourceClass = EventSourceModule.EventSource;
      
      this.eventSource = new EventSourceClass(url);

      this.eventSource.onopen = () => {
        console.log('[PythWS] ✓ Connected to Pyth Hermes SSE stream');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.eventSource.onmessage = (event: any) => {
        try {
          this.handleMessage(event.data);
        } catch (error) {
          console.error('[PythWS] Error parsing message:', error);
        }
      };

      this.eventSource.onerror = (error: any) => {
        // Only log if it's not a routine disconnect
        const errorMessage = error?.message || 'Unknown error';
        if (!errorMessage.includes('terminated') && !errorMessage.includes('closed')) {
          console.error('[PythWS] SSE connection error:', errorMessage);
        } else {
          console.log('[PythWS] SSE connection closed, will reconnect...');
        }
        this.isConnected = false;
        this.scheduleReconnect();
      };

    } catch (error) {
      console.error('[PythWS] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming SSE message
   */
  private handleMessage(data: string): void {
    try {
      const message: PythStreamMessage = JSON.parse(data);
      
      if (message.parsed && Array.isArray(message.parsed)) {
        for (const feed of message.parsed) {
          const feedId = feed.id.toLowerCase();
          const expo = feed.price.expo;
          
          // Convert price string to number with exponent
          const rawPrice = BigInt(feed.price.price);
          const rawConf = BigInt(feed.price.conf);
          const rawEmaPrice = BigInt(feed.ema_price.price);
          const rawEmaConf = BigInt(feed.ema_price.conf);
          
          // Apply exponent (usually negative, e.g., -8)
          const multiplier = Math.pow(10, expo);
          
          const priceUpdate: PythPriceUpdate = {
            id: feedId,
            price: Number(rawPrice) * multiplier,
            conf: Number(rawConf) * multiplier,
            expo: expo,
            publishTime: feed.price.publish_time,
            emaPrice: Number(rawEmaPrice) * multiplier,
            emaConf: Number(rawEmaConf) * multiplier,
          };

          this.prices.set(feedId, priceUpdate);
          
          // Emit price update event
          this.emit('priceUpdate', priceUpdate);
          this.emit(`price:${feedId}`, priceUpdate);
        }
      }
    } catch (error) {
      console.error('[PythWS] Failed to parse message:', error);
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[PythWS] Max reconnection attempts reached. Giving up.');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[PythWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from the SSE stream
   */
  public async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnected = false;
    console.log('[PythWS] Disconnected from Pyth Hermes');
    this.emit('disconnected');
  }

  /**
   * Fetch latest prices via REST API (fallback/one-time fetch)
   */
  public async fetchLatestPrices(feedIds: string[]): Promise<Map<string, PythPriceUpdate>> {
    try {
      const idsParams = feedIds.map(id => `ids[]=${id}`).join('&');
      const url = `${this.HERMES_REST_URL}?${idsParams}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as PythStreamMessage;
      const results = new Map<string, PythPriceUpdate>();

      if (data.parsed && Array.isArray(data.parsed)) {
        for (const feed of data.parsed) {
          const feedId = feed.id.toLowerCase();
          const expo = feed.price.expo;
          
          const rawPrice = BigInt(feed.price.price);
          const rawConf = BigInt(feed.price.conf);
          const rawEmaPrice = BigInt(feed.ema_price.price);
          const rawEmaConf = BigInt(feed.ema_price.conf);
          
          const multiplier = Math.pow(10, expo);
          
          const priceUpdate: PythPriceUpdate = {
            id: feedId,
            price: Number(rawPrice) * multiplier,
            conf: Number(rawConf) * multiplier,
            expo: expo,
            publishTime: feed.price.publish_time,
            emaPrice: Number(rawEmaPrice) * multiplier,
            emaConf: Number(rawEmaConf) * multiplier,
          };

          results.set(feedId, priceUpdate);
          this.prices.set(feedId, priceUpdate); // Also update local cache
        }
      }

      return results;
    } catch (error) {
      console.error('[PythWS] Failed to fetch latest prices:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  public get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get all current prices
   */
  public getAllPrices(): Map<string, PythPriceUpdate> {
    return new Map(this.prices);
  }
}

// Export singleton instance
export const pythWebSocketService = new PythWebSocketService();
