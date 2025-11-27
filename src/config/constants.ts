import { PublicKey } from '@solana/web3.js';

// DLMM Program ID (unchanged)
export const DLMM_PROGRAM_ID = new PublicKey(
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'
);

// API endpoints (verified during analysis)
export const API_ENDPOINTS = {
  METEORA_API: 'https://dlmm-api.meteora.ag',
  JUPITER_QUOTE: 'https://quote-api.jup.ag/v6',
};

// Common token mints for reference (expandable)
export const COMMON_TOKEN_MINTS = {
  USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  USDS: new PublicKey('USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA'),
  // Add more as discovered
};

// Pool validation helpers (NEW - from modified version)
export const POOL_VALIDATION = {
  MIN_TVL: 10000, // Minimum $10k TVL
  MIN_VOLUME_24H: 1000, // Minimum $1k daily volume
  MAX_SLIPPAGE: 5.0, // Maximum 5% slippage warning
};

// Example popular pools for reference (instead of hardcoded KNOWN_POOLS)
export const EXAMPLE_POOLS = {
  'USDC-USDT': {
    address: 'ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq',
    description: 'USDC/USDT Stablecoin Pool',
    category: 'stablecoin'
  },
  // More pools will be discovered dynamically via API
};

// Default configuration values (unchanged from original)
export const DEFAULT_CONFIG = {
  SLIPPAGE: 0.5, // 0.5%
  PRIORITY_FEE_MULTIPLIER: 1.0,
  COMMITMENT: 'confirmed' as const,
  
  // Rebalancing defaults
  REBALANCE_PRICE_DEVIATION: 15, // bins
  REBALANCE_PERFORMANCE_THRESHOLD: 60, // percentage
  REBALANCE_TIME_INTERVAL: 4, // hours
  REBALANCE_MIN_TIME_BETWEEN: 6, // hours
  REBALANCE_MAX_GAS_COST: 2, // USD
  REBALANCE_MIN_APR_IMPROVEMENT: 5, // percentage
  
  // Compounding defaults
  COMPOUND_THRESHOLD: 50, // USD
  COMPOUND_MAX_PER_WEEK: 2,
  COMPOUND_MIN_TIME_BETWEEN: 3, // days
  COMPOUND_IMBALANCE_THRESHOLD: 3, // percentage
  COMPOUND_MAX_GAS_COST: 0.20, // USD
  
  // Swap defaults
  SWAP_MAX_SLIPPAGE: 0.5, // percentage
  SWAP_BALANCE_TOLERANCE: 0.03, // 3% tolerance
  
  // Position defaults
  DEFAULT_STRATEGY: 'Curve' as const,
  DEFAULT_BIN_COUNT: 20,
};

// File paths
export const DATA_DIR = './data';
export const CONFIG_FILE = `${DATA_DIR}/config.json`;
export const WALLETS_FILE = `${DATA_DIR}/wallets.enc`;
export const POSITIONS_FILE = `${DATA_DIR}/positions.json`;
export const LOGS_DIR = `${DATA_DIR}/logs`;

// Encryption
export const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

// Pool discovery settings (NEW - for dynamic pool management)
export const POOL_DISCOVERY = {
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes in milliseconds
  MAX_SEARCH_RESULTS: 50,
  RECOMMENDED_POOL_LIMIT: 20,
  FAVORITES_LIMIT: 100,
  HISTORY_LIMIT: 50,
};

// Validation messages (NEW - for enhanced user experience)
export const VALIDATION_MESSAGES = {
  LOW_TVL: 'Pool has low Total Value Locked (TVL). Consider higher liquidity pools for better trading.',
  LOW_VOLUME: 'Pool has low 24h trading volume. May experience higher slippage.',
  HIGH_FEE: 'Pool has relatively high fees. Check if the APR justifies the cost.',
  INACTIVE_POOL: 'Pool appears to be inactive or deprecated.',
  NEW_POOL: 'This is a newly created pool. Exercise caution with unproven pools.',
};

// Network configurations (NEW - for multi-network support future)
export const NETWORK_CONFIGS = {
  mainnet: {
    name: 'Mainnet Beta',
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com',
  },
  devnet: {
    name: 'Devnet',
    rpcEndpoint: 'https://api.devnet.solana.com',
    explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
  },
};

// Rate limiting (NEW - for API management)
export const RATE_LIMITS = {
  METEORA_API_RPS: 30, // 30 requests per second as verified
  JUPITER_API_RPS: 20, // Conservative estimate
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};
