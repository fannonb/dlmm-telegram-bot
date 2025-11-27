/**
 * Simple bot starter with keep-alive
 */
import chalk from 'chalk';
import { Telegraf, session } from 'telegraf';
import { BotContext, DEFAULT_SESSION, SessionData } from './types';
import { BOT_CONFIG } from './config';
import { handleStart } from './handlers/start';
import { rateLimitMiddleware } from './middlewares/rateLimit';
import { userContextManager } from './services/userContext';
import { userDataService } from './services/userDataService';
import { mainMenuKeyboard } from './keyboards';
import { multiWalletStorage } from './services/walletStorageMulti';

// Import handlers
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
    handleRebalancePosition,
    handleExecuteRebalance,
    handleExecuteRebalanceConfirm,
    handleAIAnalysis,
} from './handlers/positions';

// Create bot
const bot = new Telegraf<BotContext>(BOT_CONFIG.token);

// Middleware: Session
bot.use(session({
    defaultSession: (): SessionData => ({
        ...DEFAULT_SESSION,
        telegramId: 0,
    })
}));

// Middleware: User Context
bot.use(async (ctx, next) => {
    const telegramId = ctx.from?.id;
    if (telegramId) {
        ctx.session.telegramId = telegramId;
        ctx.session.username = ctx.from?.username;
        userContextManager.getContext(telegramId);
        
        if (userDataService.userExists(telegramId)) {
            const config = userDataService.getConfig(telegramId);
            config.lastActiveAt = Date.now();
            userDataService.saveConfig(telegramId, config);
        }
        
        const activeWallet = multiWalletStorage.getActiveWallet(telegramId);
        if (activeWallet) {
            ctx.session.walletAddress = activeWallet.publicKey;
        }
    }
    await next();
});

// Rate limiting
bot.use(rateLimitMiddleware);

// Logging
bot.use(async (ctx, next) => {
    const start = Date.now();
    const userId = ctx.from?.id || 'unknown';
    const username = ctx.from?.username || 'anon';
    console.log(chalk.gray(`[${new Date().toISOString()}] User ${userId} (@${username})`));
    await next();
    console.log(chalk.gray(`  Response time: ${Date.now() - start}ms`));
});

// Commands
bot.command('start', handleStart);
bot.command('wallet', handleWalletMenu);
bot.command('wallets', handleWalletMenu);
bot.command('positions', handlePositionsList);
bot.command('menu', async (ctx) => {
    const hasWallet = multiWalletStorage.hasWallet(ctx.from!.id);
    await ctx.reply('🏠 *Main Menu*', {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard(hasWallet),
    });
});

// Main menu callback
bot.action('menu_main', async (ctx) => {
    await ctx.answerCbQuery();
    const hasWallet = multiWalletStorage.hasWallet(ctx.from!.id);
    await ctx.editMessageText('🏠 *Main Menu*', {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard(hasWallet),
    });
});

// Wallet actions
bot.action('wallet_setup', handleWalletMenu);
bot.action('mwallet_menu', handleWalletMenu);
bot.action('wallet_info', handleWalletMenu);
bot.action('mwallet_create', handleCreateWallet);
bot.action('mwallet_import_mnemonic', handleImportMnemonic);
bot.action('mwallet_import_key', handleImportPrivateKey);
bot.action('mwallet_list', handleListWallets);
bot.action('mwallet_set_active', handleSetActiveWallet);
bot.action(/^mwallet_activate_(.+)$/, async (ctx) => {
    await handleActivateWallet(ctx, ctx.match[1]);
});
bot.action('mwallet_export', handleExportPrivateKey);
bot.action(/^mwallet_export_(.+)$/, async (ctx) => {
    const match = ctx.match[1];
    if (match.startsWith('confirm_')) {
        await handleExportConfirm(ctx, match.replace('confirm_', ''));
    } else {
        await handleExportWallet(ctx, match);
    }
});
bot.action('mwallet_transfer', handleTransferFunds);
bot.action('mwallet_transfer_sol', handleTransferSOL);
bot.action('mwallet_transfer_usdc', handleTransferUSDC);
bot.action('mwallet_delete', handleDeleteWallet);
bot.action(/^mwallet_delete_(.+)$/, async (ctx) => {
    const match = ctx.match[1];
    if (match.startsWith('confirm_')) {
        await handleDeleteConfirm(ctx, match.replace('confirm_', ''));
    } else {
        await handleDeleteWalletSelect(ctx, match);
    }
});
bot.action('mwallet_copy', handleCopyAddress);

// Position actions
bot.action('positions_list', handlePositionsList);
bot.action('positions_refresh', handlePositionsRefresh);
bot.action(/^positions_page_(\d+)$/, async (ctx) => {
    await handlePositionPage(ctx, parseInt(ctx.match[1], 10));
});
bot.action(/^pos_detail_(.+)$/, async (ctx) => {
    await handlePositionDetail(ctx, ctx.match[1]);
});
bot.action(/^pos_refresh_(.+)$/, async (ctx) => {
    await handleRefreshPosition(ctx, ctx.match[1]);
});
// Claim all must come before regex patterns (exact match first)
bot.action('pos_claim_all', handleClaimAllFees);
bot.action('pos_claim_all_confirm', handleClaimAllFeesConfirm);
// Claim confirm must be before general claim (more specific pattern)
bot.action(/^pos_claim_confirm_(.+)$/, async (ctx) => {
    await handleClaimFeesConfirm(ctx, ctx.match[1]);
});
bot.action(/^pos_claim_(.+)$/, async (ctx) => {
    await handleClaimFees(ctx, ctx.match[1]);
});

// Compound position actions
bot.action(/^pos_compound_exec_(\d+)_(.+)$/, async (ctx) => {
    const ratio = parseInt(ctx.match[1], 10);
    const shortAddr = ctx.match[2];
    await handleCompoundExecute(ctx, ratio, shortAddr);
});
bot.action(/^pos_compound_(.+)$/, async (ctx) => {
    await handleCompoundPosition(ctx, ctx.match[1]);
});

// Remove liquidity actions
bot.action(/^pos_remove_exec_(\d+)_(.+)$/, async (ctx) => {
    const percent = parseInt(ctx.match[1], 10);
    const shortAddr = ctx.match[2];
    await handleRemoveLiquidityExecute(ctx, percent, shortAddr);
});
bot.action(/^pos_remove_pct_(\d+)_(.+)$/, async (ctx) => {
    const percent = parseInt(ctx.match[1], 10);
    const shortAddr = ctx.match[2];
    await handleRemoveLiquidityPercent(ctx, percent, shortAddr);
});
bot.action(/^pos_remove_(.+)$/, async (ctx) => {
    await handleRemoveLiquidity(ctx, ctx.match[1]);
});

// Close position actions
bot.action(/^pos_close_confirm_(.+)$/, async (ctx) => {
    await handleClosePositionConfirm(ctx, ctx.match[1]);
});
bot.action(/^pos_close_(.+)$/, async (ctx) => {
    await handleClosePosition(ctx, ctx.match[1]);
});

// Add liquidity and rebalance
bot.action(/^pos_add_(.+)$/, async (ctx) => {
    await handleAddLiquidity(ctx, ctx.match[1]);
});

// Rebalance actions
bot.action(/^pos_rebal_confirm_(.+)$/, async (ctx) => {
    await handleExecuteRebalanceConfirm(ctx, ctx.match[1]);
});
bot.action(/^pos_rebal_exec_(.+)$/, async (ctx) => {
    await handleExecuteRebalance(ctx, ctx.match[1]);
});
bot.action(/^pos_rebalance_(.+)$/, async (ctx) => {
    await handleRebalancePosition(ctx, ctx.match[1]);
});

// AI Analysis actions
bot.action(/^pos_ai_(.+)$/, async (ctx) => {
    await handleAIAnalysis(ctx, ctx.match[1]);
});

// Text handler
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const flow = ctx.session.currentFlow;
    
    if (flow === 'wallet_create_name') {
        await processCreateWalletName(ctx, text);
    } else if (flow === 'wallet_import_mnemonic') {
        await processImportMnemonic(ctx, text);
    } else if (flow === 'wallet_import_mnemonic_name') {
        await processImportMnemonicName(ctx, text);
    } else if (flow === 'wallet_import_key') {
        await processImportPrivateKey(ctx, text);
    } else if (flow === 'wallet_import_key_name') {
        await processImportPrivateKeyName(ctx, text);
    } else if (flow === 'wallet_transfer_sol') {
        await processTransferSOL(ctx, text);
    } else if (flow === 'wallet_transfer_usdc') {
        await processTransferUSDC(ctx, text);
    }
});

// Error handler
bot.catch((err: any, ctx) => {
    console.error(chalk.red(`❌ Bot error:`), err);
});

// Launch
console.log(chalk.green('🤖 Starting Telegram bot...'));
bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log(chalk.green('✅ Bot is running!'));
    console.log(chalk.cyan(`   Bot username: @${bot.botInfo?.username}`));
    console.log(chalk.gray('   Press Ctrl+C to stop\n'));
}).catch(err => {
    console.error(chalk.red('❌ Failed to start:'), err);
    process.exit(1);
});

// Keep the process alive - Telegraf should do this but doesn't always work with ts-node
process.stdin.resume();

process.once('SIGINT', () => {
    console.log('\nStopping bot...');
    bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => bot.stop('SIGTERM'));
