import { PublicKey, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// Wallet types
export interface WalletConfig {
  name: string;
  publicKey: string;
  encryptedPrivateKey: string;
  createdAt: string;
  isActive: boolean;
}

// Connection settings
export interface ConnectionConfig {
  rpcEndpoint: string;
  commitment: 'processed' | 'confirmed' | 'finalized';
  wsEndpoint?: string;
}

// Transaction settings
export interface TransactionConfig {
  priorityFee: 'dynamic' | 'fixed';
  priorityFeeAmount?: number; // lamports, if fixed
  priorityFeeMultiplier?: number;
  slippage: number; // percentage (e.g., 0.5 for 0.5%)
  enableSimulation: boolean;
}

export interface PriorityFeeOptions {
  mode: 'dynamic' | 'fixed';
  microLamports?: number;
  multiplier?: number;
}

// Enhanced pool information (from modified version)
export interface PoolInfo {
  address: string;
  tokenX: {
    mint: string;
    symbol: string;
    decimals: number;
  };
  tokenY: {
    mint: string;
    symbol: string;
    decimals: number;
  };
  binStep: number;
  feeBps: number;
  activeBin: number;
  price?: number; // Current price of active bin
  tvl?: number;
  volume24h?: number;
  apr?: number;
  // NEW: Dynamic validation
  isActive: boolean;
  lastUpdated: string;
  validationStatus: 'valid' | 'warning' | 'error';
  validationMessages?: string[];
}

// Pool selection preferences (from modified version)
export interface PoolSelectionPreferences {
  favoritePoolAddresses: string[];
  defaultPoolFilters: {
    minTvl?: number;
    minVolume24h?: number;
    maxFeeBps?: number;
    tokenTypes?: 'stablecoin' | 'volatile' | 'all';
  };
  poolHistory: Array<{
    address: string;
    name: string;
    lastUsed: string;
  }>;
}

// Dynamic pool configuration (from modified version)
export interface DynamicPoolConfig {
  address: PublicKey;
  tokenX: {
    mint: PublicKey;
    symbol: string;
    decimals: number;
  };
  tokenY: {
    mint: PublicKey;
    symbol: string;
    decimals: number;
  };
  binStep: number;
  feeBps: number;
  activeBin: number;
  tvl?: number;
  volume24h?: number;
  apr?: number;
  isValid: boolean;
  validationErrors?: string[];
}

// Enhanced position data (from modified version)
export interface PositionData {
  address: string;
  poolAddress: string;
  // NEW: Dynamic pool metadata
  poolInfo: PoolInfo;
  tokenX: string;
  tokenY: string;
  minBinId: number;
  maxBinId: number;
  strategy: 'Spot' | 'Curve' | 'BidAsk';
  createdAt: string;
  initialValue: number;
  lastRebalanced?: string;
  lastCompounded?: string;
  // NEW: Multi-pool support
  poolGroup?: string; // For grouping related positions
  notes?: string; // User notes about this position
}

// Automation settings
export interface AutomationConfig {
  rebalancing: {
    enabled: boolean;
    triggers: {
      priceDeviation: number; // bins
      performance: number; // percentage in range
      timeInterval: number; // hours
    };
    strategy: {
      maintainStrategy: boolean;
      maintainBinCount: boolean;
      centerAtActiveBin: boolean;
    };
    swap: {
      enabled: boolean;
      maxSlippage: number;
      method: 'pool' | 'jupiter' | 'auto';
    };
    constraints: {
      minTimeBetween: number; // hours
      maxGasCost: number; // USD
      minAprImprovement: number; // percentage
    };
  };
  compounding: {
    enabled: boolean;
    threshold: number; // USD
    strategy: 'balanced' | 'single' | 'maintain';
    swapSettings: {
      enabled: boolean;
      maxSlippage: number;
      imbalanceThreshold: number; // percentage
    };
    limits: {
      maxPerWeek: number;
      minTimeBetween: number; // days
      maxGasCost: number; // USD
    };
  };
}

// Enhanced app config (from modified version)
export interface AppConfig {
  version: string;
  wallets: WalletConfig[];
  activeWallet: string | null;
  connection: ConnectionConfig;
  transaction: TransactionConfig;
  positions: PositionData[];
  automation: AutomationConfig;
  preferences: {
    // MODIFIED: Remove default pool, add pool selection
    poolSelection: PoolSelectionPreferences;
    defaultStrategy: 'Spot' | 'Curve' | 'BidAsk';
    defaultBinCount: number;
    displayCurrency: 'USD' | 'SOL';
    notifications: {
      rebalanceAlerts: boolean;
      compoundAlerts: boolean;
      priceAlerts: boolean;
    };
    // NEW: LLM provider configuration
    llm?: {
      provider: 'anthropic' | 'openai' | 'deepseek' | 'grok' | 'kimi' | 'gemini' | 'none';
      model?: string;
      apiKey?: string; // Encrypted
      baseURL?: string;
    };
    birdeyeApiKey?: string; // Encrypted
  };
}

// Swap quote result
export interface SwapQuote {
  inAmount: BN;
  outAmount: BN;
  fee: BN;
  priceImpact: number;
  minOutAmount: BN;
}

// Rebalance action
export interface RebalanceAction {
  timestamp: string;
  positionAddress: string;
  trigger: string;
  oldRange: { min: number; max: number };
  newRange: { min: number; max: number };
  swapRequired: boolean;
  swapAmount?: number;
  swapDirection?: 'XtoY' | 'YtoX';
  cost: number;
  aprBefore: number;
  aprAfter: number;
  transactions: string[];
  status: 'success' | 'failed';
}

// Compound action
export interface CompoundAction {
  timestamp: string;
  positionAddress: string;
  feeX: number;
  feeY: number;
  swapRequired: boolean;
  swapAmount?: number;
  swapDirection?: 'XtoY' | 'YtoX';
  cost: number;
  positionValueBefore: number;
  positionValueAfter: number;
  transactions: string[];
  status: 'success' | 'failed';
}

// Position creation configuration
export interface CreatePositionParams {
  poolAddress: string;
  strategy: 'Spot' | 'Curve' | 'BidAsk';
  amountX: number; // Amount of Token X (in UI units)
  amountY: number; // Amount of Token Y (in UI units)
  binsPerSide?: number; // Number of bins to each side of center (for Curve)
  minBinId?: number; // For BidAsk strategy
  maxBinId?: number; // For BidAsk strategy
  slippage?: number; // In basis points (e.g., 50 = 0.5%)
  centerBinOverride?: number;
  priorityFeeOptions?: PriorityFeeOptions;
}

// Position creation result
export interface CreatePositionResult {
  positionAddress: string;
  poolAddress: string;
  strategy: 'Spot' | 'Curve' | 'BidAsk';
  minBinId: number;
  maxBinId: number;
  tokenXAmount: number;
  tokenYAmount: number;
  depositSignature: string;
  swapSignature?: string; // If zap was used
  cost: number; // Total gas cost in USD
  status: 'success' | 'failed';
  errorMessage?: string;
  timestamp: string;
}

// Position range configuration
export interface PositionRangeConfig {
  strategy: 'Spot' | 'Curve' | 'BidAsk';
  activeBin: number;
  centerBin: number;
  minBinId: number;
  maxBinId: number;
  binPrice: {
    minPrice: number;
    centerPrice: number;
    maxPrice: number;
  };
  binsPerSide: number;
  tokenDistribution: {
    tokenXPercent: number;
    tokenYPercent: number;
  };
}
