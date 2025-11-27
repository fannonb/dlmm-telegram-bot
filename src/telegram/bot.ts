import { Telegraf, session } from 'telegraf';
import { createServer } from 'http';
import { BotContext, DEFAULT_SESSION, SessionData } from './types';
import { BOT_CONFIG } from './config';
import { handleStart } from './handlers/start';
import { rateLimitMiddleware } from './middlewares/rateLimit';
import { requireAuthorization } from './middlewares/auth';
import { userContextManager } from './services/userContext';
import { userDataService } from './services/userDataService';
import { mainMenuKeyboard, settingsKeyboard, llmProviderKeyboard } from './keyboards';
import { multiWalletStorage } from './services/walletStorageMulti';
import { networkResilienceService } from '../services/networkResilience.service';
import { priceService } from '../services/price.service';
import { solanaWebSocketService } from '../services/solanaWebSocket.service';
import chalk from 'chalk';

// Import multi-wallet handlers
import {
    handleWalletMenu,
    handleCreateWallet,
    processCreateWalletName,
    handleImportMnemonic,
    processImportMnemonic,
    processImportMnemonicName,
    handleImportPrivateKey,
    processImportPrivateKey,
    processImportPrivateKeyName,
    handleListWallets,
    handleSetActiveWallet,
    handleActivateWallet,
    handleExportPrivateKey,
    handleExportWallet,
    handleExportConfirm,
    handleDeleteWallet,
    handleDeleteWalletSelect,
    handleDeleteConfirm,
    handleTransferFunds,
    handleTransferSOL,
    handleTransferUSDC,
    processTransferSOL,
    processTransferUSDC,
    handleQuickWalletInfo,
    handleCopyAddress
} from './handlers/walletMulti';

// Import position handlers
import {
    handlePositionsList,
    handlePositionPage,
    handlePositionDetail,
    handlePositionsRefresh,
    handleClaimFees,
    handleClaimFeesConfirm,
    handleClaimAllFees,
    handleClaimAllFeesConfirm,
    handleCompoundPosition,
    handleCompoundExecute,
    handleClosePosition,
    handleClosePositionConfirm,
    handleRefreshPosition,
    handleRemoveLiquidity,
    handleRemoveLiquidityPercent,
    handleRemoveLiquidityExecute,
    handleAddLiquidity,
    handleAddLiquidityAmounts,
    handleAddLiquidityUsd,
    processAddLiquidityInput,
    handleExecuteAddLiquidity,
    handleAutoSwapAndAddLiquidity,
    handleAutoSwapAddLiquidityExecute,
    handleRebalancePosition,
    handleExecuteRebalance,
    handleExecuteRebalanceConfirm,
    handleAIAnalysis,
} from './handlers/positions';

// Fee management handlers
import {
    handleFeesMenu,
    handleCompoundAll,
    handleCompoundAllExecute,
    handleFeeHistory,
} from './handlers/fees';

// Rebalance management handlers
import {
    handleAutoRebalanceMenu,
    handleAutoRebalanceToggle,
    handleAutoRebalanceStrategy,
    handleStrategySelection as handleRebalanceStrategySelection,
    handleAutoRebalanceStatus,
    handleRebalanceHistory,
    handleRebalanceExport,
    handleCustomRangeInput as handleRebalanceCustomRangeInput,
} from './handlers/rebalance';

// Position Monitor handlers
import {
    handleMonitorSettings,
    handleMonitorToggle,
    handleMonitorIntervalMenu,
    handleMonitorIntervalSelect,
    handleMonitorAutoToggle,
    handleMonitorRunNow,
    handleMonitorLastReport,
} from './handlers/monitor';

// Analytics handlers
import {
    handleAnalyticsMenu,
    handlePortfolioOverview,
    handleFeeEarnings,
    handlePnLHistory,
    handlePnLPeriod,
    handleTransactionHistory,
    handleExportMenu,
    handleExportAction,
} from './handlers/analytics';

// LLM Settings handlers
import {
    handleLLMSettings,
    handleLLMProviderSelect,
    processLLMApiKey,
    handleLLMModelSelect,
    handleLLMModelDefault,
    processLLMCustomModel,
    handleLLMDisable,
    handleLLMTestConnection,
} from './handlers/llmSettings';

// Alerts handlers
import {
    handleAlertsMenu,
    handleToggleOutOfRange,
    handleToggleNearEdge,
    handleToggleFeeThreshold,
    handleToggleRebalanceSuggestions,
    handleFeeThresholdConfig,
    handleSetFeeThreshold,
    processFeeThresholdInput,
    handleNearEdgeConfig,
    handleSetNearEdgeThreshold,
    handleAddPriceAlert,
    handlePriceAlertPoolSelect,
    handlePriceAlertDirection,
    processPriceAlertInput,
    handleListPriceAlerts,
    handleDeletePriceAlert,
    handleClearAllAlerts,
} from './handlers/alerts';

// Notifications handlers
import {
    handleNotificationsMenu,
    handleToggleNotifications,
    handleToggleAlertsNotifications,
    handleToggleDailySummary,
    handleNotificationHistory,
    handleClearNotificationHistory,
} from './handlers/notifications';

// RPC Settings handlers
import {
    handleRpcSettings,
    handleRpcEndpointList,
    handleRpcAddEndpoint,
    handleRpcPreset,
    handleRpcAddCustom,
    processRpcUrlInput,
    handleRpcRemoveEndpoint,
    handleRpcRemoveConfirm,
    handleRpcSwitchPrimary,
    handleRpcTestSingle,
    handleRpcTestAll,
    handleRpcBenchmark,
    handleRpcResetStats,
    loadUserRpcEndpoints,
} from './handlers/rpcSettings';

// Services
import { telegramNotificationsService } from './services/telegramNotifications.service';
import { monitoringScheduler } from './services/monitoringScheduler.service';

// Pool handlers
import {
    handlePoolsMenu,
    handlePoolSearchAddress,
    handlePoolAddressInput,
    handlePoolSearchPair,
    handlePoolPairInput,
    handleTopPoolsByTVL,
    handleTopPoolsByAPR,
    handlePoolPage,
    handlePoolDetail,
    handleAddToFavorites,
    handleCreatePositionFromPool,
    handleNewPositionAIAnalysis,
    handleApplyAIRecommendation,
    handleSkipAI,
    handleStrategySelection,
    handleRangeSelection,
    handleCustomRangeInput,
    handleAmountInput,
    handleAutoAmountEntry,
    handleManualAmountEntry,
    handleAutoAmountInput,
    handleAutoSwapAndCreate,
    handleAutoSwapExecute,
    handleAmountsRetry,
    handleExecuteNewPosition,
} from './handlers/pools';

// Initialize bot
const bot = new Telegraf<BotContext>(BOT_CONFIG.token);

// Middleware: Session management with enhanced defaults
bot.use(session({
    defaultSession: (): SessionData => ({
        ...DEFAULT_SESSION,
        telegramId: 0, // Will be set in user context middleware
    })
}));

// Middleware: User Context Initialization
bot.use(async (ctx, next) => {
    const telegramId = ctx.from?.id;

    if (telegramId) {
        // Initialize session with telegram ID
        ctx.session.telegramId = telegramId;
        ctx.session.username = ctx.from?.username;

        // Ensure user context exists
        const userCtx = userContextManager.getContext(telegramId);

        // Update last active timestamp
        if (userDataService.userExists(telegramId)) {
            const config = userDataService.getConfig(telegramId);
            config.lastActiveAt = Date.now();
            userDataService.saveConfig(telegramId, config);
        }

        // Cache wallet address in session for quick access
        const activeWallet = multiWalletStorage.getActiveWallet(telegramId);
        if (activeWallet) {
            ctx.session.walletAddress = activeWallet.publicKey;
        }
    }

    await next();
});

// Middleware: User Authorization (SECURITY: Must be first)
bot.use(requireAuthorization());

// Middleware: Rate limiting
bot.use(rateLimitMiddleware);

// Middleware: Logging
bot.use(async (ctx, next) => {
    const start = Date.now();
    const userId = ctx.from?.id || 'unknown';
    const username = ctx.from?.username || 'anon';
    const text = 'message' in ctx.update ? (ctx.update.message as any)?.text : 'callback';

    console.log(chalk.gray(`[${new Date().toISOString()}] User ${userId} (@${username}): ${text}`));

    await next();

    const ms = Date.now() - start;
    console.log(chalk.gray(`  Response time: ${ms}ms`));
});

// Command: /start
bot.command('start', handleStart);

// Command: /wallet - Full wallet management (same as /wallets)
bot.command('wallet', handleWalletMenu);

// Command: /wallets - Full wallet management (alias)
bot.command('wallets', handleWalletMenu);

// Command: /positions - View all positions
bot.command('positions', handlePositionsList);

// Command: /pools - Browse pools
bot.command('pools', handlePoolsMenu);

// Command: /analytics - Portfolio analytics
bot.command('analytics', handleAnalyticsMenu);

// Command: /menu - Show main menu
bot.command('menu', async (ctx) => {
    const hasWallet = multiWalletStorage.hasWallet(ctx.from!.id);

    await ctx.reply('🏠 *Main Menu*', {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard(hasWallet),
    });
});

// Command: /cancel - Cancel current flow
bot.command('cancel', async (ctx) => {
    if (ctx.session.currentFlow && ctx.session.currentFlow !== 'idle') {
        ctx.session.currentFlow = 'idle';
        ctx.session.tempMnemonic = undefined;
        ctx.session.tempPrivateKey = undefined;
        await ctx.reply('❌ Operation cancelled.');
    } else {
        await ctx.reply('Nothing to cancel.');
    }
});

// Command: /help
bot.command('help', async (ctx) => {
    const helpText = `
📚 *DLMM Bot Commands*

*Wallet Management*
/wallet - Quick wallet view
/wallets - Full wallet management
  • Create new wallet
  • Import from mnemonic
  • Import from private key
  • List all wallets
  • Set active wallet
  • Export private key
  • Transfer funds
  • Delete wallet

*Positions*
/positions - View your positions
/newposition - Create new position

*Pools*
/pools - Browse pools

*Other*
/menu - Main menu
/cancel - Cancel current operation
/help - This help message
    `.trim();

    await ctx.replyWithMarkdown(helpText);
});

// Callback: Main menu
bot.action('menu_main', async (ctx) => {
    await ctx.answerCbQuery();
    const hasWallet = multiWalletStorage.hasWallet(ctx.from!.id);

    await ctx.editMessageText('🏠 *Main Menu*', {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard(hasWallet),
    });
});

// ==================== CALLBACKS: WALLET MANAGEMENT ====================

// Main wallet menu - all these should open the full wallet management
bot.action('wallet_setup', handleWalletMenu);
bot.action('mwallet_menu', handleWalletMenu);
bot.action('wallet_info', handleWalletMenu);  // Changed: now opens full menu instead of quick view

bot.action('wallet_refresh', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => { });
    await handleWalletMenu(ctx);
});

// Create new wallet
bot.action('mwallet_create', handleCreateWallet);

// Import from mnemonic
bot.action('mwallet_import_mnemonic', handleImportMnemonic);

// Import from private key
bot.action('mwallet_import_key', handleImportPrivateKey);

// List all wallets
bot.action('mwallet_list', handleListWallets);

// Set active wallet
bot.action('mwallet_set_active', handleSetActiveWallet);
bot.action(/^mwallet_activate_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleActivateWallet(ctx, shortAddr);
});

// Export private key
bot.action('mwallet_export', handleExportPrivateKey);
bot.action(/^mwallet_export_(.+)$/, async (ctx) => {
    const match = ctx.match[1];
    if (match.startsWith('confirm_')) {
        await handleExportConfirm(ctx, match.replace('confirm_', ''));
    } else {
        await handleExportWallet(ctx, match);
    }
});

// Transfer funds
bot.action('mwallet_transfer', handleTransferFunds);
bot.action('mwallet_transfer_sol', handleTransferSOL);
bot.action('mwallet_transfer_usdc', handleTransferUSDC);

// Delete wallet
bot.action('mwallet_delete', handleDeleteWallet);
bot.action(/^mwallet_delete_(.+)$/, async (ctx) => {
    const match = ctx.match[1];
    if (match.startsWith('confirm_')) {
        await handleDeleteConfirm(ctx, match.replace('confirm_', ''));
    } else {
        await handleDeleteWalletSelect(ctx, match);
    }
});

// Copy address
bot.action('mwallet_copy', handleCopyAddress);

// Legacy wallet actions (redirect to new system)
bot.action('wallet_import', handleImportMnemonic);
bot.action('wallet_create', handleCreateWallet);
bot.action('wallet_disconnect', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        '🗑️ To disconnect/delete a wallet, use the full wallet management menu.',
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🔑 Wallet Management', callback_data: 'mwallet_menu' }]]
            }
        }
    );
});
bot.action('wallet_copy', handleCopyAddress);

// ==================== CALLBACKS: POSITION MANAGEMENT ====================

// List all positions
bot.action('positions_list', handlePositionsList);
bot.action('positions_refresh', handlePositionsRefresh);

// Position pagination
bot.action(/^positions_page_(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await handlePositionPage(ctx, page);
});

// View single position detail
bot.action(/^pos_detail_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    console.log(chalk.magenta(`[Bot Callback] pos_detail_ triggered with: ${shortAddr}`));
    await handlePositionDetail(ctx, shortAddr);
});

// Refresh single position
bot.action(/^pos_refresh_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleRefreshPosition(ctx, shortAddr);
});

// Claim all fees from all positions (must come before regex patterns)
bot.action('pos_claim_all', handleClaimAllFees);
bot.action('pos_claim_all_confirm', handleClaimAllFeesConfirm);

// Claim fees from a position - confirm first (more specific regex)
bot.action(/^pos_claim_confirm_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleClaimFeesConfirm(ctx, shortAddr);
});

// Claim fees from a position (general regex - must come after exact matches)
bot.action(/^pos_claim_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleClaimFees(ctx, shortAddr);
});

// ==================== FEE MANAGEMENT ====================

// Fees menu
bot.action('fees_menu', handleFeesMenu);

// Compound all fees
bot.action('compound_all', handleCompoundAll);

// Execute compound all with ratio
bot.action(/^compound_all_exec_(\d+)$/, async (ctx) => {
    const ratio = parseInt(ctx.match[1], 10);
    await handleCompoundAllExecute(ctx, ratio);
});

// Fee history
bot.action('fees_history', handleFeeHistory);

// Compound fees back into position
bot.action(/^pos_compound_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleCompoundPosition(ctx, shortAddr);
});

// Close position confirm - must be before pos_close_ (more specific pattern)
bot.action(/^pos_close_confirm_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleClosePositionConfirm(ctx, shortAddr);
});

// Close position
bot.action(/^pos_close_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleClosePosition(ctx, shortAddr);
});

// Compound execute with ratio
bot.action(/^pos_compound_exec_(\d+)_(.+)$/, async (ctx) => {
    const ratio = parseInt(ctx.match[1], 10);
    const shortAddr = ctx.match[2];
    await handleCompoundExecute(ctx, ratio, shortAddr);
});

// Remove liquidity percent - must be before pos_remove_ (more specific pattern)
bot.action(/^pos_remove_pct_(\d+)_(.+)$/, async (ctx) => {
    const percent = parseInt(ctx.match[1], 10);
    const shortAddr = ctx.match[2];
    await handleRemoveLiquidityPercent(ctx, percent, shortAddr);
});

// Remove liquidity execute - must be before pos_remove_ (more specific pattern)
bot.action(/^pos_remove_exec_(\d+)_(.+)$/, async (ctx) => {
    const percent = parseInt(ctx.match[1], 10);
    const shortAddr = ctx.match[2];
    await handleRemoveLiquidityExecute(ctx, percent, shortAddr);
});

// Remove liquidity - main menu (less specific, must be last)
bot.action(/^pos_remove_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleRemoveLiquidity(ctx, shortAddr);
});

// Add liquidity - main menu
bot.action(/^pos_add_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleAddLiquidity(ctx, shortAddr);
});

// Add liquidity - enter amounts (more specific, must be before pos_addliq_)
bot.action(/^pos_addliq_amounts_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleAddLiquidityAmounts(ctx, shortAddr);
});

// Add liquidity - enter USD value (more specific, must be before pos_addliq_)
bot.action(/^pos_addliq_usd_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleAddLiquidityUsd(ctx, shortAddr);
});

// Add liquidity - execute (more specific, must be before pos_addliq_)
bot.action(/^pos_addliq_exec_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleExecuteAddLiquidity(ctx, shortAddr);
});

// Add liquidity - autoswap execute (must be before autoswap and pos_addliq_)
bot.action(/^pos_addliq_autoswap_exec_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleAutoSwapAddLiquidityExecute(ctx, shortAddr);
});

// Add liquidity - autoswap quote (must be before pos_addliq_)
bot.action(/^pos_addliq_autoswap_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleAutoSwapAndAddLiquidity(ctx, shortAddr);
});

// Add liquidity - back to main add liq menu (less specific, must be last of addliq patterns)
bot.action(/^pos_addliq_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleAddLiquidity(ctx, shortAddr);
});

// Rebalance analysis
bot.action(/^pos_rebalance_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleRebalancePosition(ctx, shortAddr);
});

// Execute rebalance confirmation
bot.action(/^pos_rebal_exec_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleExecuteRebalance(ctx, shortAddr);
});

// Execute rebalance with specific bins (for low SOL situations)
bot.action(/^pos_rebal_bins_(.+)_(\d+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    const binsPerSide = parseInt(ctx.match[2]);
    // Store the custom bins in session and proceed to confirm
    ctx.session.flowData = {
        ...ctx.session.flowData,
        customBinsPerSide: binsPerSide
    };
    await handleExecuteRebalanceConfirm(ctx, shortAddr);
});

// Execute rebalance confirm
bot.action(/^pos_rebal_confirm_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleExecuteRebalanceConfirm(ctx, shortAddr);
});

// AI Analysis
bot.action(/^pos_ai_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleAIAnalysis(ctx, shortAddr);
});

// ==================== CALLBACKS: AUTO-REBALANCE ====================

// Auto-rebalance menu
bot.action(/^pos_auto_(.+)$/, async (ctx) => {
    await handleAutoRebalanceMenu(ctx);
});

// Toggle auto-rebalance
bot.action(/^auto_toggle_(.+)$/, async (ctx) => {
    await handleAutoRebalanceToggle(ctx);
});

// Auto-rebalance strategy selection menu
bot.action(/^auto_strategy_(.+)$/, async (ctx) => {
    await handleAutoRebalanceStrategy(ctx);
});

// Strategy selection callbacks (aggressive, balanced, conservative, custom)
bot.action(/^reb_strat_(agg|bal|con|cust)_(.+)$/, async (ctx) => {
    await handleRebalanceStrategySelection(ctx);
});

// Auto-rebalance status
bot.action(/^auto_status_(.+)$/, async (ctx) => {
    await handleAutoRebalanceStatus(ctx);
});

// Rebalance history
bot.action(/^reb_history_(.+)$/, async (ctx) => {
    await handleRebalanceHistory(ctx);
});

// Export rebalance history
bot.action(/^reb_export_(.+)$/, async (ctx) => {
    await handleRebalanceExport(ctx);
});

// New position - redirect to pool discovery
bot.action('position_new', async (ctx) => {
    await handlePoolsMenu(ctx);
});

// ==================== CALLBACKS: POOL DISCOVERY ====================

// Pool discovery main menu
bot.action('pools_browse', async (ctx) => {
    await handlePoolsMenu(ctx);
});

bot.action('pools_menu', async (ctx) => {
    await handlePoolsMenu(ctx);
});

// Pool search by address
bot.action('pool_search_address', async (ctx) => {
    await handlePoolSearchAddress(ctx);
});

// Pool search by token pair
bot.action('pool_search_pair', async (ctx) => {
    await handlePoolSearchPair(ctx);
});

// Top pools by TVL
bot.action('pool_top_tvl', async (ctx) => {
    await handleTopPoolsByTVL(ctx);
});

// Top pools by APR
bot.action('pool_top_apr', async (ctx) => {
    await handleTopPoolsByAPR(ctx);
});

// Pool list pagination
bot.action(/^pool_page_(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await handlePoolPage(ctx, page);
});

// Pool detail view (short address)
bot.action(/^pool_detail_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handlePoolDetail(ctx, shortAddr);
});

// Add pool to favorites
bot.action(/^pool_fav_add_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleAddToFavorites(ctx, shortAddr);
});

// ==================== CALLBACKS: NEW POSITION WIZARD ====================

// Start creating position from pool
bot.action(/^pool_create_pos_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleCreatePositionFromPool(ctx, shortAddr);
});

// Alternative alias for creating position from alerts
bot.action(/^pool_newpos_(.+)$/, async (ctx) => {
    const shortAddr = ctx.match[1];
    await handleCreatePositionFromPool(ctx, shortAddr);
});

// AI recommendation actions
bot.action('newpos_ai_analyze', async (ctx) => {
    await handleNewPositionAIAnalysis(ctx);
});

bot.action('newpos_apply_ai', async (ctx) => {
    await handleApplyAIRecommendation(ctx);
});

bot.action('newpos_skip_ai', async (ctx) => {
    await handleSkipAI(ctx);
});

// Select strategy
bot.action(/^newpos_strategy_(Spot|Curve|BidAsk)$/, async (ctx) => {
    const strategy = ctx.match[1] as 'Spot' | 'Curve' | 'BidAsk';
    await handleStrategySelection(ctx, strategy);
});

// Configure range - preset bins
bot.action(/^newpos_range_(\d+)$/, async (ctx) => {
    const binsPerSide = parseInt(ctx.match[1], 10);
    await handleRangeSelection(ctx, binsPerSide);
});

// Configure range - custom
bot.action('newpos_range_custom', async (ctx) => {
    await handleRangeSelection(ctx, 'custom');
});

// Amount entry options
bot.action('newpos_amount_auto', async (ctx) => {
    await handleAutoAmountEntry(ctx);
});

bot.action('newpos_amount_manual', async (ctx) => {
    await handleManualAmountEntry(ctx);
});

// Auto-swap actions
bot.action('newpos_autoswap', async (ctx) => {
    await handleAutoSwapAndCreate(ctx);
});

bot.action('newpos_autoswap_execute', async (ctx) => {
    await handleAutoSwapExecute(ctx);
});

// Auto-swap to tokenX (e.g., swap SOL to get TRUMP)
bot.action('newpos_autoswap_x', async (ctx) => {
    const { handleAutoSwapToX } = await import('./handlers/pools');
    await handleAutoSwapToX(ctx);
});

bot.action('newpos_autoswap_x_execute', async (ctx) => {
    const { handleAutoSwapToXExecute } = await import('./handlers/pools');
    await handleAutoSwapToXExecute(ctx);
});

// Retry amounts entry
bot.action('newpos_amounts_retry', async (ctx) => {
    await handleAmountsRetry(ctx);
});

// Execute position creation
bot.action('newpos_execute', async (ctx) => {
    await handleExecuteNewPosition(ctx);
});

// Handle fewer bins option (for insufficient SOL)
bot.action(/^newpos_fewer_bins_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const newBins = parseInt(ctx.match[1], 10);

    // Update the flow data with the new bin range
    const flowData = ctx.session.flowData;
    if (!flowData || !flowData.activeBinId) {
        await ctx.reply('❌ Session expired. Please start over.');
        return;
    }

    const binsPerSide = Math.floor(newBins / 2);
    flowData.minBinId = flowData.activeBinId - binsPerSide;
    flowData.maxBinId = flowData.activeBinId + binsPerSide;

    // Execute with the new bin range
    await handleExecuteNewPosition(ctx);
});

bot.action('swap_start', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('💱 *Swap* - Coming in Phase 3!', { parse_mode: 'Markdown' });
});

// ==================== ANALYTICS ACTIONS ====================
bot.action('analytics_menu', handleAnalyticsMenu);
bot.action('analytics_portfolio', handlePortfolioOverview);
bot.action('analytics_fees', handleFeeEarnings);
bot.action('analytics_pnl', handlePnLHistory);
bot.action(/^analytics_pnl_/, handlePnLPeriod);
bot.action('analytics_history', handleTransactionHistory);
bot.action('analytics_export', handleExportMenu);
bot.action(/^analytics_export_/, handleExportAction);

// ==================== LLM SETTINGS ACTIONS ====================
bot.action('settings_llm', handleLLMSettings);
bot.action('llm_providers', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('🤖 **Select LLM Provider**\n\nChoose your preferred AI provider:', {
        parse_mode: 'Markdown',
        reply_markup: llmProviderKeyboard()
    });
});
bot.action(/^llm_set_/, handleLLMProviderSelect);
bot.action(/^llm_model_default_/, handleLLMModelDefault);
bot.action(/^llm_model_/, handleLLMModelSelect);
bot.action('llm_disable', handleLLMDisable);
bot.action('llm_test', handleLLMTestConnection);

bot.action('llm_analyze', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('🤖 *AI Insights* - Use AI Analysis from position detail!', { parse_mode: 'Markdown' });
});

bot.action('settings_main', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('⚙️ *Settings*\n\nConfigure your DLMM Bot preferences:', {
        parse_mode: 'Markdown',
        reply_markup: settingsKeyboard()
    });
});

// ==================== POSITION MONITOR ACTIONS ====================
bot.action('settings_monitor', handleMonitorSettings);
bot.action('monitor_toggle', handleMonitorToggle);
bot.action('monitor_interval', handleMonitorIntervalMenu);
bot.action(/^monitor_int_\d+$/, handleMonitorIntervalSelect);
bot.action('monitor_auto_toggle', handleMonitorAutoToggle);
bot.action('monitor_run_now', handleMonitorRunNow);
bot.action('monitor_last_report', handleMonitorLastReport);

// ==================== ALERTS ACTIONS ====================
bot.action('settings_alerts', handleAlertsMenu);
bot.action('alert_toggle_oor', handleToggleOutOfRange);
bot.action('alert_toggle_edge', handleToggleNearEdge);
bot.action('alert_toggle_fees', handleToggleFeeThreshold);
bot.action('alert_toggle_suggestions', handleToggleRebalanceSuggestions);
bot.action('alert_fee_config', handleFeeThresholdConfig);
bot.action(/^alert_fee_\d+$/, handleSetFeeThreshold);
bot.action('alert_fee_custom', handleSetFeeThreshold);
bot.action('alert_edge_config', handleNearEdgeConfig);
bot.action(/^alert_edge_\d+$/, handleSetNearEdgeThreshold);
bot.action('alert_add_price', handleAddPriceAlert);
bot.action(/^alert_pool_/, handlePriceAlertPoolSelect);
bot.action(/^alert_dir_/, handlePriceAlertDirection);
bot.action('alert_list_price', handleListPriceAlerts);
bot.action(/^alert_delete_\d+$/, handleDeletePriceAlert);
bot.action('alert_clear_all', handleClearAllAlerts);

// ==================== NOTIFICATIONS ACTIONS ====================
bot.action('settings_notifications', handleNotificationsMenu);
bot.action('notif_toggle_all', handleToggleNotifications);
bot.action('notif_toggle_alerts', handleToggleAlertsNotifications);
bot.action('notif_toggle_daily', handleToggleDailySummary);
bot.action('notif_history', handleNotificationHistory);
bot.action('notif_clear_history', handleClearNotificationHistory);

// ==================== RPC SETTINGS ACTIONS ====================
bot.action('rpc_settings', handleRpcSettings);
bot.action('rpc_endpoints', handleRpcEndpointList);
bot.action('rpc_add', handleRpcAddEndpoint);
bot.action(/^rpc_preset_/, handleRpcPreset);
bot.action('rpc_add_custom', handleRpcAddCustom);
bot.action(/^rpc_remove_\d+$/, handleRpcRemoveEndpoint);
bot.action(/^rpc_remove_confirm_\d+$/, handleRpcRemoveConfirm);
bot.action(/^rpc_switch_\d+$/, handleRpcSwitchPrimary);
bot.action(/^rpc_test_\d+$/, handleRpcTestSingle);
bot.action('rpc_test_all', handleRpcTestAll);
bot.action('rpc_benchmark', handleRpcBenchmark);
bot.action('rpc_reset_stats', handleRpcResetStats);

// ==================== ALERT ACTION HANDLERS ====================
// These handle quick actions from alert notifications

bot.action('alert_dismiss', async (ctx) => {
    try {
        await ctx.deleteMessage();
    } catch {
        await ctx.answerCbQuery('✓ Dismissed');
    }
});

// View out-of-range positions (from daily summary)
bot.action('positions_oor', async (ctx) => {
    await ctx.answerCbQuery();
    // Redirect to positions list (will show OOR positions)
    await handlePositionsList(ctx);
});

// Claim all fees (from daily summary)
bot.action('fees_claim_all', async (ctx) => {
    await ctx.answerCbQuery();
    await handleClaimAllFees(ctx);
});

bot.action('help_main', async (ctx) => {
    await ctx.answerCbQuery();
    const helpText = `
📚 *DLMM Bot Help*

*Available Commands:*
/start - Welcome & status
/wallet - Quick wallet view
/wallets - Wallet management
/menu - Main menu
/cancel - Cancel operation
/help - This help

*Wallet Features:*
• Create new wallets
• Import from mnemonic/key
• Manage multiple wallets
• Transfer SOL/USDC
• Export/Delete wallets

*Coming Soon:*
• Position management
• Pool browsing
• Swaps & fee claiming
• Analytics & AI

Need help? Contact support.
    `.trim();
    await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// ==================== TEXT MESSAGE HANDLER ====================

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const flow = ctx.session.currentFlow;

    // Handle /cancel command in flows
    if (text === '/cancel') {
        return; // Handled by command handler
    }

    // Handle wallet creation name input
    if (flow === 'wallet_create_name') {
        await processCreateWalletName(ctx, text);
        return;
    }

    // Handle mnemonic import
    if (flow === 'wallet_import_mnemonic') {
        await processImportMnemonic(ctx, text);
        return;
    }

    // Handle mnemonic import name
    if (flow === 'wallet_import_mnemonic_name') {
        await processImportMnemonicName(ctx, text);
        return;
    }

    // Handle private key import
    if (flow === 'wallet_import_key') {
        await processImportPrivateKey(ctx, text);
        return;
    }

    // Handle private key import name
    if (flow === 'wallet_import_key_name') {
        await processImportPrivateKeyName(ctx, text);
        return;
    }

    // Handle SOL transfer
    if (flow === 'wallet_transfer_sol') {
        await processTransferSOL(ctx, text);
        return;
    }

    // Handle USDC transfer
    if (flow === 'wallet_transfer_usdc') {
        await processTransferUSDC(ctx, text);
        return;
    }

    // Legacy wallet import flow
    if (ctx.session.waitingForWalletImport || flow === 'wallet_import') {
        await processImportMnemonic(ctx, text);
        return;
    }

    // Handle add liquidity input flows
    if (flow === 'add_liquidity_amounts' || flow === 'add_liquidity_usd') {
        await processAddLiquidityInput(ctx, text);
        return;
    }

    // Handle new position amounts input
    if (flow === 'newpos_amounts') {
        await handleAmountInput(ctx, text);
        return;
    }

    // Handle auto-calculate amount input (single amount X)
    if (flow === 'newpos_amount_auto') {
        await handleAutoAmountInput(ctx, text);
        return;
    }

    // Handle pool search by address
    if (flow === 'pool_search_address') {
        await handlePoolAddressInput(ctx, text);
        return;
    }

    // Handle pool search by token pair
    if (flow === 'pool_search_pair') {
        await handlePoolPairInput(ctx, text);
        return;
    }

    // Handle custom range input
    if (flow === 'newpos_custom_range') {
        await handleCustomRangeInput(ctx, text);
        return;
    }

    // Handle rebalance custom range input
    if (flow === 'rebalancing' && ctx.session.flowData?.step === 'awaiting_custom_range') {
        const rangeWidth = parseFloat(text);
        if (isNaN(rangeWidth)) {
            await ctx.reply('❌ Please enter a valid number (e.g., "15" for ±15%)');
            return;
        }
        await handleRebalanceCustomRangeInput(ctx, rangeWidth);
        return;
    }

    // Handle LLM API key input
    if (flow === 'llm_apikey_input') {
        await processLLMApiKey(ctx, text);
        return;
    }

    // Handle LLM custom model input
    if (flow === 'llm_model_custom') {
        await processLLMCustomModel(ctx, text);
        return;
    }

    // Handle price alert input
    if (flow === 'price_alert_input') {
        await processPriceAlertInput(ctx, text);
        return;
    }

    // Handle fee threshold input
    if (flow === 'fee_threshold_input') {
        await processFeeThresholdInput(ctx, text);
        return;
    }

    // Handle RPC URL input (add endpoint flows)
    if (flow === 'rpc_add_preset' || flow === 'rpc_add_custom') {
        await processRpcUrlInput(ctx);
        return;
    }

    // Handle other flows based on session state
    switch (flow) {
        case 'searching_pool':
            await handlePoolAddressInput(ctx, text);
            break;
        case 'creating_position':
            await ctx.reply('Use the menu buttons to continue creating a position.');
            break;
        default:
            // Unknown text, show help hint for commands
            if (text.startsWith('/')) {
                await ctx.reply('❓ Unknown command. Use /help to see available commands.');
            }
            // Don't respond to regular messages
            break;
    }
});

// Error handling with improved error handler
bot.catch((err: any, ctx) => {
    console.error(chalk.red(`❌ Bot error for ${ctx.updateType}:`), err);

    // Handle specific Telegram errors gracefully
    if (err.message?.includes('message is not modified')) {
        return; // Ignore
    }
    if (err.message?.includes('message to edit not found')) {
        return; // Ignore
    }
    if (err.message?.includes('query is too old')) {
        ctx.answerCbQuery('⏳ Action expired. Please try again.').catch(() => { });
        return;
    }

    ctx.reply('⚠️ An error occurred. Please try again.').catch(() => { });
});

// Start bot
export async function startBot() {
    console.log(chalk.green('🤖 Starting Telegram bot...'));

    try {
        // Load user RPC endpoints first (fast, synchronous)
        console.log(chalk.gray('   Loading user RPC configurations...'));
        try {
            const userDataDir = 'd:/App Projects/DLMM App/data/users';
            const fs = await import('fs');
            if (fs.existsSync(userDataDir)) {
                const userDirs = fs.readdirSync(userDataDir);
                for (const userId of userDirs) {
                    const numericUserId = parseInt(userId, 10);
                    if (!isNaN(numericUserId)) {
                        // Load user's RPC endpoints into the RPC manager
                        loadUserRpcEndpoints(numericUserId);

                        // Also load into network resilience service
                        const config = userDataService.getConfig(numericUserId);
                        if ((config as any).rpcEndpoints) {
                            const endpoints = (config as any).rpcEndpoints;
                            for (const ep of endpoints) {
                                if (ep.url) {
                                    networkResilienceService.addUserEndpoint(ep.url);
                                    console.log(chalk.gray(`   Added user endpoint: ${ep.name || ep.url}`));
                                }
                            }
                        }
                    }
                }
            }
        } catch (loadError: any) {
            console.log(chalk.yellow('   ⚠️  Failed to load user RPC endpoints:'), loadError.message);
        }

        // Network diagnostics run in background - don't block startup
        console.log(chalk.gray('   Starting background network diagnostics...'));
        setImmediate(async () => {
            try {
                const healthyEndpoint = await networkResilienceService.getHealthyEndpoint();
                if (healthyEndpoint) {
                    console.log(chalk.green(`   ✅ Network: ${healthyEndpoint.includes('helius') ? 'Helius' : 'Default'} endpoint active`));
                }
            } catch (diagError) {
                console.log(chalk.yellow('   ⚠️  Network diagnostics failed'));
            }
        });
        console.log(chalk.gray('   Connecting to Telegram API...'));

        // Check bot token first
        const me = await bot.telegram.getMe();
        console.log(chalk.gray(`   Bot verified: @${me.username}`));

        // Initialize services with bot instance
        console.log(chalk.gray('   Initializing services...'));
        telegramNotificationsService.initialize(bot);
        monitoringScheduler.initialize(bot);

        // Initialize WebSocket connections for real-time data
        console.log(chalk.gray('   Initializing WebSocket connections...'));
        setImmediate(async () => {
            try {
                // Initialize Pyth price streaming (FREE)
                await priceService.initializePythStream();
                console.log(chalk.green('   ✅ Pyth real-time price streaming active'));
            } catch (wsError: any) {
                console.log(chalk.yellow('   ⚠️  Pyth WebSocket init failed:'), wsError.message);
            }

            try {
                // Initialize Solana WebSocket for position monitoring
                const healthyEndpoint = await networkResilienceService.getHealthyEndpoint();
                if (healthyEndpoint) {
                    await solanaWebSocketService.initialize(healthyEndpoint);
                    console.log(chalk.green('   ✅ Solana position WebSocket active'));
                }
            } catch (wsError: any) {
                console.log(chalk.yellow('   ⚠️  Solana WebSocket init failed:'), wsError.message);
            }
        });

        // Set menu commands
        console.log(chalk.gray('   Setting bot commands...'));
        await bot.telegram.setMyCommands([
            { command: 'menu', description: '🏠 Main Menu' },
            { command: 'positions', description: '📋 My Positions' },
            { command: 'pools', description: '🏊 Browse Pools' },
            { command: 'wallet', description: '💼 Wallet' },
            { command: 'help', description: '❓ Help' },
        ]);

        // Start HTTP health check server for Render.com
        const PORT = process.env.PORT || 10000;
        const healthServer = createServer((req, res) => {
            if (req.url === '/health' || req.url === '/') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    service: 'dlmm-telegram-bot',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime()
                }));
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });
        
        healthServer.listen(PORT, () => {
            console.log(chalk.green(`✅ Health check server running on port ${PORT}`));
            
            // Self-ping to keep Render free tier alive (every 10 minutes)
            // Only enable if RENDER_EXTERNAL_URL is set (means we're on Render)
            const renderUrl = process.env.RENDER_EXTERNAL_URL;
            if (renderUrl) {
                console.log(chalk.cyan('   🔄 Render keep-alive enabled'));
                setInterval(async () => {
                    try {
                        const response = await fetch(`${renderUrl}/health`);
                        if (response.ok) {
                            console.log(chalk.gray(`   [Keep-alive] Pinged ${new Date().toISOString()}`));
                        }
                    } catch (err) {
                        // Ignore errors - just a keep-alive ping
                    }
                }, 10 * 60 * 1000); // Every 10 minutes
            }
        });

        // Start polling with explicit logging
        console.log(chalk.gray('   Calling bot.launch()...'));

        // Launch without await - use callback style
        bot.launch({
            dropPendingUpdates: true
        }).then(() => {
            console.log(chalk.green('✅ Bot is running! (promise resolved)'));
            console.log(chalk.cyan(`   Bot username: @${bot.botInfo?.username}`));

            // Start background monitoring after bot is running
            console.log(chalk.gray('   Starting background monitoring...'));
            monitoringScheduler.start().then(() => {
                const status = monitoringScheduler.getStatus();
                console.log(chalk.green(`✅ Background monitoring started (${status.activeMonitors} active monitors)`));
            }).catch(err => {
                console.error(chalk.yellow('⚠️ Background monitoring failed to start:'), err.message);
            });
        }).catch(err => {
            console.error(chalk.red('❌ Launch promise rejected:'), err);
        });

        // Don't await - bot.launch doesn't always resolve immediately
        // But the polling keeps the process alive
        console.log(chalk.green('✅ Bot polling started!'));
        console.log(chalk.gray('   Press Ctrl+C to stop\n'));

        // Enable graceful stop
        process.once('SIGINT', () => {
            monitoringScheduler.stop();
            bot.stop('SIGINT');
        });
        process.once('SIGTERM', () => {
            monitoringScheduler.stop();
            bot.stop('SIGTERM');
        });

    } catch (error: any) {
        console.error(chalk.red('❌ Failed to start bot:'), error.message);
        console.error(chalk.red('   Full error:'), error);
        process.exit(1);
    }
}

// Auto-start if run directly
if (require.main === module) {
    startBot().catch(err => {
        console.error(chalk.red('Fatal error:'), err);
        process.exit(1);
    });
}
