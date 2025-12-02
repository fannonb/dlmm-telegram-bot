import { Context } from 'telegraf';

// ==================== SESSION DATA ====================

export interface SessionData {
    // User identification
    telegramId: number;
    username?: string;
    
    // Wallet info (cached for quick access)
    walletAddress?: string;
    
    // Language & UI
    language: 'en' | 'es' | 'zh' | 'ru';
    
    // Rate limiting
    messageCount: number;
    lastCommandTime: number;
    
    // Conversation flow states
    currentFlow: ConversationFlow;
    flowData?: FlowData;
    
    // Pagination state
    pagination?: PaginationState;
    
    // Temporary selections
    selectedPoolAddress?: string;
    selectedPositionAddress?: string;
    selectedPool?: string; // Pool address for current flow
    
    // Input waiting states
    waitingForInput?: WaitingInputType;
    inputContext?: Record<string, any>;
    
    // Temporary storage for multi-step flows
    tempMnemonic?: string;
    tempPrivateKey?: string;
    
    // Legacy compatibility
    waitingForWalletImport?: boolean;
}

export type ConversationFlow = 
    | 'idle'
    | 'wallet_import'
    | 'wallet_create_name'
    | 'wallet_import_mnemonic'
    | 'wallet_import_mnemonic_name'
    | 'wallet_import_key'
    | 'wallet_import_key_name'
    | 'wallet_transfer_sol'
    | 'wallet_transfer_usdc'
    | 'creating_position'
    | 'rebalancing'
    | 'swapping'
    | 'claiming_fees'
    | 'compounding'
    | 'setting_alerts'
    | 'configuring_llm'
    | 'searching_pool'
    | 'add_liquidity'
    | 'add_liquidity_amounts'
    | 'add_liquidity_usd'
    | 'new_position_search'
    | 'new_position_amounts'
    | 'pool_search_address'
    | 'pool_search_pair'
    | 'newpos_custom_range'
    | 'newpos_amounts'
    | 'newpos_amount_auto'
    | 'llm_apikey_input'
    | 'llm_model_custom'
    | 'price_alert_direction'
    | 'price_alert_input'
    | 'fee_threshold_input'
    | 'rpc_add_preset'
    | 'rpc_add_custom'
    | 'swap'
    | 'swap_amount'
    | 'swap_custom_from'
    | 'swap_custom_to';

export type WaitingInputType =
    | 'private_key'
    | 'seed_phrase'
    | 'pool_search'
    | 'amount_x'
    | 'amount_y'
    | 'bin_range'
    | 'slippage'
    | 'swap_amount'
    | 'llm_api_key'
    | 'custom_input';

export interface FlowData {
    // Position creation flow
    poolAddress?: string;
    poolInfo?: any; // PoolInfo object for display
    strategy?: 'Spot' | 'Curve' | 'BidAsk';
    minBinId?: number;
    maxBinId?: number;
    activeBinId?: number; // Current active bin for the pool
    amountX?: number;
    amountY?: number;
    slippage?: number;
    binsPerSide?: number;
    defaultBins?: number;
    
    // AI recommendation data
    aiRecommendation?: any; // PoolCreationRecommendation from LLM
    tokenXPercentage?: number;
    tokenYPercentage?: number;
    
    // Auto-swap data
    autoSwapNeeded?: boolean;
    autoSwapDirection?: 'X_to_Y' | 'Y_to_X' | 'toX' | 'toY';
    swapShortfall?: number;
    swapAmountX?: number;  // Amount of tokenX needed via swap
    swapAmountY?: number;  // Amount of tokenY needed via swap
    swapQuote?: any;
    solToSwap?: number;
    swapSource?: string;  // Token symbol to swap from (e.g., 'SOL', 'USDC')
    swapAmountFrom?: number; // Amount to swap from the source token
    availableSol?: number; // User's SOL balance for swap options
    availableTokenY?: number; // User's tokenY balance for swap options
    
    // Rebalancing flow
    positionAddress?: string;
    newMinBinId?: number;
    newMaxBinId?: number;
    customBinsPerSide?: number; // Override for smaller range when low on SOL
    
    // Swap flow
    inputToken?: string;
    outputToken?: string;
    inputAmount?: number;
    
    // Add liquidity flow
    tokenXSymbol?: string;
    tokenYSymbol?: string;
    tokenXDecimals?: number;
    tokenYDecimals?: number;
    addLiqAmountX?: number;
    addLiqAmountY?: number;
    
    // Generic step tracking
    step?: number | string;
    data?: Record<string, any>;
    
    // LLM configuration flow
    provider?: string;
    model?: string;
    baseURL?: string;
    
    // Alert configuration flow
    alertPoolAddress?: string;
    alertTokenSymbol?: string;
    alertDirection?: 'above' | 'below';
    
    // RPC configuration flow
    preset?: string;
}

export interface PaginationState {
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    listType: 'positions' | 'pools' | 'transactions' | 'alerts';
    type?: string; // pool_tvl, pool_apr, pool_volume, etc.
    page?: number;
    data?: any[];
}

// ==================== USER CONFIG ====================

export interface UserConfig {
    telegramId: number;
    username?: string;
    
    // Transaction settings
    preferences: UserPreferences;
    
    // Favorites
    favoritePools: string[];
    
    // Alert settings
    alerts: AlertConfig;
    
    // LLM settings
    llm?: LLMConfig;
    
    // Auto-rebalancing settings per position
    autoRebalance: Record<string, AutoRebalanceConfig>;
    
    // Timestamps
    createdAt: number;
    updatedAt: number;
    lastActiveAt: number;
}

export interface UserPreferences {
    // Notifications
    notificationsEnabled: boolean;
    alertsEnabled: boolean;
    dailySummaryEnabled: boolean;
    
    // Background monitoring
    monitorEnabled: boolean;
    monitorIntervalMinutes: number;
    autoRebalanceEnabled: boolean;
    lastMonitorCheck?: number;
    lastDailySummary?: number;
    
    // Transaction defaults
    defaultSlippage: number;          // percentage (e.g., 0.5)
    priorityFee: 'dynamic' | 'fixed';
    priorityFeeAmount?: number;       // lamports if fixed
    
    // Display
    showUsdValues: boolean;
    compactMode: boolean;
    
    // Security
    confirmTransactions: boolean;     // Always require confirmation
    autoDeleteSensitive: boolean;     // Auto-delete seed phrases
    sensitiveDeleteDelay: number;     // Seconds before deletion
}

export interface AlertConfig {
    // Position alerts
    outOfRangeEnabled: boolean;
    nearEdgeEnabled: boolean;
    nearEdgeThreshold: number;        // bins from edge
    
    // Fee alerts
    feeThresholdEnabled: boolean;
    feeThresholdUsd: number;
    
    // Price alerts
    priceAlerts: PriceAlert[];
    
    // Rebalance suggestions
    rebalanceSuggestionsEnabled: boolean;
}

export interface PriceAlert {
    poolAddress: string;
    tokenSymbol: string;
    targetPrice: number;
    direction: 'above' | 'below';
    enabled: boolean;
    createdAt: number;
}

export interface LLMConfig {
    provider: 'anthropic' | 'openai' | 'deepseek' | 'grok' | 'kimi' | 'gemini' | 'none';
    apiKey: string;                   // Encrypted
    model: string;
    baseURL?: string;
}

export interface AutoRebalanceConfig {
    enabled: boolean;
    strategy: 'aggressive' | 'balanced' | 'conservative';
    rangeWidth: number;               // percentage
    checkIntervalHours: number;
    minCostBenefit: number;
    urgencyOverride: boolean;
    lastCheck?: number;
    lastRebalance?: number;
}

// ==================== BOT CONTEXT ====================

export interface BotContext extends Context {
    session: SessionData;
}

// ==================== CALLBACK DATA ====================

export interface CallbackData {
    action: string;
    data?: Record<string, any>;
}

// Helper to encode/decode callback data (max 64 bytes)
export function encodeCallback(action: string, data?: Record<string, any>): string {
    if (!data) return action;
    // Use short keys to save space
    const encoded = `${action}:${JSON.stringify(data)}`;
    if (encoded.length > 64) {
        // Fallback to action only if too long
        return action;
    }
    return encoded;
}

export function decodeCallback(callback: string): CallbackData {
    const colonIndex = callback.indexOf(':');
    if (colonIndex === -1) {
        return { action: callback };
    }
    try {
        const action = callback.substring(0, colonIndex);
        const data = JSON.parse(callback.substring(colonIndex + 1));
        return { action, data };
    } catch {
        return { action: callback };
    }
}

// ==================== DEFAULT VALUES ====================

export const DEFAULT_SESSION: Omit<SessionData, 'telegramId'> = {
    language: 'en',
    messageCount: 0,
    lastCommandTime: 0,
    currentFlow: 'idle',
};

export const DEFAULT_USER_CONFIG: Omit<UserConfig, 'telegramId' | 'createdAt' | 'updatedAt' | 'lastActiveAt'> = {
    preferences: {
        notificationsEnabled: true,
        alertsEnabled: true,
        dailySummaryEnabled: false,
        monitorEnabled: false,
        monitorIntervalMinutes: 30,
        autoRebalanceEnabled: false,
        defaultSlippage: 0.5,
        priorityFee: 'dynamic',
        showUsdValues: true,
        compactMode: false,
        confirmTransactions: true,
        autoDeleteSensitive: true,
        sensitiveDeleteDelay: 60,
    },
    favoritePools: [],
    alerts: {
        outOfRangeEnabled: true,
        nearEdgeEnabled: true,
        nearEdgeThreshold: 5,
        feeThresholdEnabled: false,
        feeThresholdUsd: 10,
        priceAlerts: [],
        rebalanceSuggestionsEnabled: true,
    },
    autoRebalance: {},
};

// ==================== MESSAGE TEMPLATES ====================

export const MESSAGES = {
    ERRORS: {
        NO_WALLET: '❌ No wallet connected. Use /wallet to set up your wallet first.',
        WALLET_NOT_FOUND: '❌ Wallet not found. Please reconnect using /wallet.',
        INVALID_INPUT: '❌ Invalid input. Please try again.',
        TRANSACTION_FAILED: '❌ Transaction failed. Please try again.',
        RATE_LIMITED: '⚠️ Too many requests. Please wait a moment.',
        UNKNOWN_ERROR: '⚠️ An error occurred. Please try again.',
        SESSION_EXPIRED: '⚠️ Session expired. Please start again with /start.',
    },
    SUCCESS: {
        WALLET_CONNECTED: '✅ Wallet connected successfully!',
        WALLET_CREATED: '✅ New wallet created!',
        TRANSACTION_SENT: '✅ Transaction sent!',
        SETTINGS_SAVED: '✅ Settings saved!',
    },
    INFO: {
        LOADING: '⏳ Loading...',
        FETCHING_DATA: '🔄 Fetching data from blockchain...',
        PROCESSING: '⚙️ Processing...',
        CONFIRMING: '⏳ Waiting for confirmation...',
    },
};
