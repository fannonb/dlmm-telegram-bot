/**
 * Multi-Wallet Handlers for Telegram Bot
 * 
 * Implements all wallet management functionality:
 * - Create New Wallet
 * - Import from Mnemonic
 * - Import from Private Key
 * - List All Wallets
 * - Set Active Wallet
 * - Export Private Key
 * - Transfer Fees to Wallet
 * - Delete Wallet
 */

import { Context } from 'telegraf';
import { BotContext } from '../types';
import { multiWalletStorage, TelegramWallet } from '../services/walletStorageMulti';
import { connectionService } from '../../services/connection.service';
import { PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, TokenAccountNotFoundError, createTransferInstruction, TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import { InputValidator } from '../../utils/inputValidation';
import { SecurityUtils } from '../../config/security';
import chalk from 'chalk';

// Constants
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const AUTO_DELETE_SENSITIVE = 60000; // 60 seconds
const AUTO_DELETE_SUCCESS = 10000;   // 10 seconds

// ==================== HELPER FUNCTIONS ====================

async function getBalances(publicKey: PublicKey) {
    const connection = connectionService.getConnection();
    
    // Get SOL balance
    const solBalance = await connection.getBalance(publicKey);
    const sol = solBalance / LAMPORTS_PER_SOL;

    // Get USDC balance
    let usdc = 0;
    try {
        const usdcAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);
        const usdcAccount = await getAccount(connection, usdcAta);
        usdc = Number(usdcAccount.amount) / 1e6;
    } catch (error) {
        if (!(error instanceof TokenAccountNotFoundError)) {
            console.error('Error fetching USDC balance:', error);
        }
    }

    return { sol, usdc };
}

function shortenAddress(address: string, chars: number = 4): string {
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

async function autoDeleteMessage(ctx: BotContext, messageId: number, delay: number): Promise<void> {
    setTimeout(async () => {
        try {
            await ctx.telegram.deleteMessage(ctx.chat!.id, messageId);
        } catch (error) {
            // Message may already be deleted
        }
    }, delay);
}

// ==================== WALLET MENU ====================

export async function handleWalletMenu(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallets = multiWalletStorage.listWallets(telegramId);
    const activeWallet = multiWalletStorage.getActiveWallet(telegramId);

    let message = '🔑 **WALLET MANAGEMENT**\n\n';

    if (wallets.length > 0) {
        message += '📋 **Your Wallets:**\n';
        wallets.forEach((wallet, index) => {
            const activeIcon = wallet.isActive ? '⭐' : '  ';
            message += `${activeIcon} ${index + 1}. ${wallet.name}\n`;
            message += `    \`${shortenAddress(wallet.publicKey, 6)}\`\n`;
        });
        message += '\n';
    } else {
        message += '📋 No wallets found. Create or import one to get started.\n\n';
    }

    const keyboard = wallets.length > 0 
        ? getFullWalletMenuKeyboard()
        : getEmptyWalletMenuKeyboard();

    if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    } else {
        await ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
}

function getEmptyWalletMenuKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '➕ Create New Wallet', callback_data: 'mwallet_create' }],
            [{ text: '📥 Import from Mnemonic', callback_data: 'mwallet_import_mnemonic' }],
            [{ text: '🔐 Import from Private Key', callback_data: 'mwallet_import_key' }],
            [{ text: '🔙 Back to Main Menu', callback_data: 'menu_main' }]
        ]
    };
}

function getFullWalletMenuKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '➕ Create New Wallet', callback_data: 'mwallet_create' }],
            [
                { text: '📥 Import Mnemonic', callback_data: 'mwallet_import_mnemonic' },
                { text: '🔐 Import Key', callback_data: 'mwallet_import_key' }
            ],
            [{ text: '📋 List All Wallets', callback_data: 'mwallet_list' }],
            [{ text: '🎯 Set Active Wallet', callback_data: 'mwallet_set_active' }],
            [{ text: '📤 Export Private Key', callback_data: 'mwallet_export' }],
            [{ text: '💸 Transfer Funds', callback_data: 'mwallet_transfer' }],
            [{ text: '🗑️ Delete Wallet', callback_data: 'mwallet_delete' }],
            [{ text: '🔙 Back to Main Menu', callback_data: 'menu_main' }]
        ]
    };
}

// ==================== CREATE NEW WALLET ====================

export async function handleCreateWallet(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Prompt for wallet name
    await ctx.editMessageText(
        '➕ **CREATE NEW WALLET**\n\n' +
        'Please send a name for your new wallet.\n\n' +
        'Example: `Trading Wallet`, `Main`, `LP Wallet`\n\n' +
        'Send /cancel to abort.',
        { parse_mode: 'Markdown' }
    );

    ctx.session.currentFlow = 'wallet_create_name';
}

export async function processCreateWalletName(ctx: BotContext, name: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    if (!name || name.trim().length === 0) {
        await ctx.reply('❌ Invalid name. Please try again.');
        return;
    }

    try {
        const result = await multiWalletStorage.createWallet(telegramId, name.trim());
        
        console.log(chalk.green(`✓ Created wallet "${name}" for user ${telegramId}: ${result.wallet.publicKey}`));

        const message = 
            '✅ **WALLET CREATED!**\n\n' +
            `📋 **Name:** ${result.wallet.name}\n` +
            `🔑 **Address:**\n\`${result.wallet.publicKey}\`\n\n` +
            '⚠️ **SAVE YOUR RECOVERY PHRASE:**\n' +
            `\`${result.mnemonic}\`\n\n` +
            '🔒 **This message will be deleted in 60 seconds.**\n\n' +
            'Write down these words in order. You need them to recover your wallet!';

        const sentMsg = await ctx.reply(message, { parse_mode: 'Markdown' });
        autoDeleteMessage(ctx, sentMsg.message_id, AUTO_DELETE_SENSITIVE);

        ctx.session.currentFlow = 'idle';

    } catch (error: any) {
        await ctx.reply(`❌ Error creating wallet: ${error.message}`);
    }
}

// ==================== IMPORT FROM MNEMONIC ====================

export async function handleImportMnemonic(ctx: BotContext) {
    await ctx.editMessageText(
        '📥 **IMPORT FROM MNEMONIC**\n\n' +
        'Please send your 12 or 24 word seed phrase.\n\n' +
        '🔒 Your message will be automatically deleted for security.\n\n' +
        'Send /cancel to abort.',
        { parse_mode: 'Markdown' }
    );

    ctx.session.currentFlow = 'wallet_import_mnemonic';
}

export async function processImportMnemonic(ctx: BotContext, input: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Delete the user's message immediately
    try {
        await ctx.deleteMessage();
    } catch (error) {
        console.error('Failed to delete user message:', error);
    }

    const words = input.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
        await ctx.reply('❌ Invalid mnemonic. Please enter 12 or 24 words.\n\nSend /cancel to abort.');
        return;
    }

    // Now ask for wallet name
    ctx.session.tempMnemonic = input.trim();
    ctx.session.currentFlow = 'wallet_import_mnemonic_name';

    await ctx.reply(
        '✅ Mnemonic received!\n\n' +
        'Now send a name for this wallet.',
        { parse_mode: 'Markdown' }
    );
}

export async function processImportMnemonicName(ctx: BotContext, name: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const mnemonic = ctx.session.tempMnemonic;
    if (!mnemonic) {
        await ctx.reply('❌ Session expired. Please start over.');
        ctx.session.currentFlow = 'idle';
        return;
    }

    try {
        const result = await multiWalletStorage.importFromMnemonic(telegramId, name.trim(), mnemonic);
        
        console.log(chalk.green(`✓ Imported wallet "${name}" for user ${telegramId}: ${result.wallet.publicKey}`));

        const message = 
            '✅ **WALLET IMPORTED!**\n\n' +
            `📋 **Name:** ${result.wallet.name}\n` +
            `🔑 **Address:**\n\`${result.wallet.publicKey}\`\n\n` +
            '🔒 This message will be deleted in 10 seconds.';

        const sentMsg = await ctx.reply(message, { parse_mode: 'Markdown' });
        autoDeleteMessage(ctx, sentMsg.message_id, AUTO_DELETE_SUCCESS);

        ctx.session.currentFlow = 'idle';
        ctx.session.tempMnemonic = undefined;

    } catch (error: any) {
        await ctx.reply(`❌ Error importing wallet: ${error.message}`);
        ctx.session.currentFlow = 'idle';
        ctx.session.tempMnemonic = undefined;
    }
}

// ==================== IMPORT FROM PRIVATE KEY ====================

export async function handleImportPrivateKey(ctx: BotContext) {
    await ctx.editMessageText(
        '🔐 **IMPORT FROM PRIVATE KEY**\n\n' +
        'Please send your private key (base58 encoded).\n\n' +
        '🔒 Your message will be automatically deleted for security.\n\n' +
        'Send /cancel to abort.',
        { parse_mode: 'Markdown' }
    );

    ctx.session.currentFlow = 'wallet_import_key';
}

export async function processImportPrivateKey(ctx: BotContext, input: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Delete the user's message immediately
    try {
        await ctx.deleteMessage();
    } catch (error) {
        console.error('Failed to delete user message:', error);
    }

    // Validate private key format (basic check)
    if (input.trim().length < 40 || input.includes(' ')) {
        await ctx.reply('❌ Invalid private key format.\n\nSend /cancel to abort.');
        return;
    }

    // Save and ask for name
    ctx.session.tempPrivateKey = input.trim();
    ctx.session.currentFlow = 'wallet_import_key_name';

    await ctx.reply(
        '✅ Private key received!\n\n' +
        'Now send a name for this wallet.',
        { parse_mode: 'Markdown' }
    );
}

export async function processImportPrivateKeyName(ctx: BotContext, name: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const privateKey = ctx.session.tempPrivateKey;
    if (!privateKey) {
        await ctx.reply('❌ Session expired. Please start over.');
        ctx.session.currentFlow = 'idle';
        return;
    }

    try {
        const result = multiWalletStorage.importFromPrivateKey(telegramId, name.trim(), privateKey);
        
        console.log(chalk.green(`✓ Imported wallet "${name}" for user ${telegramId}: ${result.wallet.publicKey}`));

        const message = 
            '✅ **WALLET IMPORTED!**\n\n' +
            `📋 **Name:** ${result.wallet.name}\n` +
            `🔑 **Address:**\n\`${result.wallet.publicKey}\`\n\n` +
            '🔒 This message will be deleted in 10 seconds.';

        const sentMsg = await ctx.reply(message, { parse_mode: 'Markdown' });
        autoDeleteMessage(ctx, sentMsg.message_id, AUTO_DELETE_SUCCESS);

        ctx.session.currentFlow = 'idle';
        ctx.session.tempPrivateKey = undefined;

    } catch (error: any) {
        await ctx.reply(`❌ Error importing wallet: ${error.message}`);
        ctx.session.currentFlow = 'idle';
        ctx.session.tempPrivateKey = undefined;
    }
}

// ==================== LIST ALL WALLETS ====================

export async function handleListWallets(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallets = multiWalletStorage.listWallets(telegramId);

    if (wallets.length === 0) {
        await ctx.editMessageText(
            '📋 **NO WALLETS**\n\n' +
            'You have no wallets yet. Create or import one.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'mwallet_menu' }]]
                }
            }
        );
        return;
    }

    const loadingMsg = await ctx.editMessageText('🔄 Fetching balances...', { parse_mode: 'Markdown' });

    let message = '📋 **ALL WALLETS**\n\n';

    for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        const activeIcon = wallet.isActive ? '⭐ ' : '';
        
        try {
            const balances = await getBalances(new PublicKey(wallet.publicKey));
            
            message += `${activeIcon}**${i + 1}. ${wallet.name}**\n`;
            message += `\`${wallet.publicKey}\`\n`;
            message += `💰 ${balances.sol.toFixed(4)} SOL | ${balances.usdc.toFixed(2)} USDC\n`;
            message += `📅 ${new Date(wallet.createdAt).toLocaleDateString()}\n\n`;
        } catch (error) {
            message += `${activeIcon}**${i + 1}. ${wallet.name}**\n`;
            message += `\`${wallet.publicKey}\`\n`;
            message += `💰 Error fetching balance\n\n`;
        }
    }

    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔄 Refresh', callback_data: 'mwallet_list' }],
                [{ text: '⬅️ Back', callback_data: 'mwallet_menu' }]
            ]
        }
    });
}

// ==================== SET ACTIVE WALLET ====================

export async function handleSetActiveWallet(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallets = multiWalletStorage.listWallets(telegramId);

    if (wallets.length === 0) {
        await ctx.answerCbQuery('No wallets available');
        return;
    }

    if (wallets.length === 1) {
        await ctx.answerCbQuery('Only one wallet available');
        return;
    }

    const buttons = wallets.map((wallet, index) => [{
        text: `${wallet.isActive ? '⭐ ' : ''}${wallet.name} (${shortenAddress(wallet.publicKey, 4)})`,
        callback_data: `mwallet_activate_${wallet.publicKey.slice(0, 8)}`
    }]);

    buttons.push([{ text: '⬅️ Back', callback_data: 'mwallet_menu' }]);

    await ctx.editMessageText(
        '🎯 **SET ACTIVE WALLET**\n\n' +
        'Select which wallet to use:',
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        }
    );
}

export async function handleActivateWallet(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallet = multiWalletStorage.getWalletByShortAddress(telegramId, shortAddr);
    if (!wallet) {
        await ctx.answerCbQuery('Wallet not found');
        return;
    }

    multiWalletStorage.setActiveWallet(telegramId, wallet.publicKey);
    
    console.log(chalk.blue(`✓ User ${telegramId} activated wallet: ${wallet.name}`));
    
    await ctx.answerCbQuery(`✅ ${wallet.name} is now active`);
    await handleWalletMenu(ctx);
}

// ==================== EXPORT PRIVATE KEY ====================

export async function handleExportPrivateKey(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallets = multiWalletStorage.listWallets(telegramId);

    if (wallets.length === 0) {
        await ctx.answerCbQuery('No wallets available');
        return;
    }

    const buttons = wallets.map((wallet) => [{
        text: `${wallet.name} (${shortenAddress(wallet.publicKey, 4)})`,
        callback_data: `mwallet_export_${wallet.publicKey.slice(0, 8)}`
    }]);

    buttons.push([{ text: '⬅️ Back', callback_data: 'mwallet_menu' }]);

    await ctx.editMessageText(
        '📤 **EXPORT PRIVATE KEY**\n\n' +
        '⚠️ **WARNING:** Never share your private key!\n\n' +
        'Select wallet to export:',
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        }
    );
}

export async function handleExportWallet(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallet = multiWalletStorage.getWalletByShortAddress(telegramId, shortAddr);
    if (!wallet) {
        await ctx.answerCbQuery('Wallet not found');
        return;
    }

    // Show confirmation
    await ctx.editMessageText(
        '⚠️ **CONFIRM EXPORT**\n\n' +
        `Wallet: **${wallet.name}**\n` +
        `Address: \`${shortenAddress(wallet.publicKey, 8)}\`\n\n` +
        'Are you sure you want to export the private key?',
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Yes, Export', callback_data: `mwallet_export_confirm_${shortAddr}` },
                        { text: '❌ Cancel', callback_data: 'mwallet_menu' }
                    ]
                ]
            }
        }
    );
}

export async function handleExportConfirm(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallet = multiWalletStorage.getWalletByShortAddress(telegramId, shortAddr);
    if (!wallet) {
        await ctx.answerCbQuery('Wallet not found');
        return;
    }

    const privateKey = multiWalletStorage.exportPrivateKey(telegramId, wallet.publicKey);
    if (!privateKey) {
        await ctx.answerCbQuery('Failed to export private key');
        return;
    }

    console.log(chalk.yellow(`⚠️ User ${telegramId} exported private key for ${wallet.name}`));

    const message = 
        '📤 **PRIVATE KEY EXPORTED**\n\n' +
        `📋 **Wallet:** ${wallet.name}\n` +
        `🔑 **Address:**\n\`${wallet.publicKey}\`\n\n` +
        `🔐 **Private Key:**\n\`${privateKey}\`\n\n` +
        '⚠️ **NEVER SHARE THIS!**\n\n' +
        '🔒 This message will be deleted in 60 seconds.';

    // Delete old message
    try {
        await ctx.deleteMessage();
    } catch (error) {}

    const sentMsg = await ctx.reply(message, { parse_mode: 'Markdown' });
    autoDeleteMessage(ctx, sentMsg.message_id, AUTO_DELETE_SENSITIVE);
}

// ==================== DELETE WALLET ====================

export async function handleDeleteWallet(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallets = multiWalletStorage.listWallets(telegramId);

    if (wallets.length === 0) {
        await ctx.answerCbQuery('No wallets available');
        return;
    }

    const buttons = wallets.map((wallet) => [{
        text: `${wallet.isActive ? '⭐ ' : ''}${wallet.name} (${shortenAddress(wallet.publicKey, 4)})`,
        callback_data: `mwallet_delete_${wallet.publicKey.slice(0, 8)}`
    }]);

    buttons.push([{ text: '⬅️ Back', callback_data: 'mwallet_menu' }]);

    await ctx.editMessageText(
        '🗑️ **DELETE WALLET**\n\n' +
        '⚠️ **WARNING:** This action cannot be undone!\n\n' +
        'Select wallet to delete:',
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        }
    );
}

export async function handleDeleteWalletSelect(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallet = multiWalletStorage.getWalletByShortAddress(telegramId, shortAddr);
    if (!wallet) {
        await ctx.answerCbQuery('Wallet not found');
        return;
    }

    await ctx.editMessageText(
        '⚠️ **CONFIRM DELETE**\n\n' +
        `Wallet: **${wallet.name}**\n` +
        `Address: \`${wallet.publicKey}\`\n` +
        `${wallet.isActive ? '🌟 This is your ACTIVE wallet!\n' : ''}\n` +
        'Are you absolutely sure?',
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🗑️ Yes, Delete', callback_data: `mwallet_delete_confirm_${shortAddr}` },
                        { text: '❌ Cancel', callback_data: 'mwallet_menu' }
                    ]
                ]
            }
        }
    );
}

export async function handleDeleteConfirm(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallet = multiWalletStorage.getWalletByShortAddress(telegramId, shortAddr);
    if (!wallet) {
        await ctx.answerCbQuery('Wallet not found');
        return;
    }

    const walletName = wallet.name;
    const success = multiWalletStorage.deleteWallet(telegramId, wallet.publicKey);

    if (success) {
        console.log(chalk.red(`✓ User ${telegramId} deleted wallet: ${walletName}`));
        
        await ctx.answerCbQuery(`✅ Deleted ${walletName}`);
        
        const remaining = multiWalletStorage.getWalletCount(telegramId);
        const activeWallet = multiWalletStorage.getActiveWallet(telegramId);

        let message = `✅ **Wallet "${walletName}" deleted!**\n\n`;
        message += `📊 Remaining wallets: ${remaining}\n`;
        
        if (activeWallet) {
            message += `🎯 Active wallet: ${activeWallet.name}`;
        } else if (remaining === 0) {
            message += '💡 Create or import a wallet to continue.';
        }

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '⬅️ Back to Wallets', callback_data: 'mwallet_menu' }]]
            }
        });
    } else {
        await ctx.answerCbQuery('❌ Failed to delete wallet');
    }
}

// ==================== TRANSFER FUNDS ====================

export async function handleTransferFunds(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const activeWallet = multiWalletStorage.getActiveWallet(telegramId);
    if (!activeWallet) {
        await ctx.answerCbQuery('No active wallet');
        return;
    }

    await ctx.editMessageText(
        '💸 **TRANSFER FUNDS**\n\n' +
        `📤 **From:** ${activeWallet.name}\n` +
        `\`${shortenAddress(activeWallet.publicKey, 8)}\`\n\n` +
        'What would you like to transfer?',
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '◎ Transfer SOL', callback_data: 'mwallet_transfer_sol' }],
                    [{ text: '💵 Transfer USDC', callback_data: 'mwallet_transfer_usdc' }],
                    [{ text: '⬅️ Back', callback_data: 'mwallet_menu' }]
                ]
            }
        }
    );
}

export async function handleTransferSOL(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const activeWallet = multiWalletStorage.getActiveWallet(telegramId);
    if (!activeWallet) return;

    try {
        const balances = await getBalances(new PublicKey(activeWallet.publicKey));
        
        await ctx.editMessageText(
            '◎ **TRANSFER SOL**\n\n' +
            `📤 **From:** ${activeWallet.name}\n` +
            `💰 **Available:** ${balances.sol.toFixed(4)} SOL\n\n` +
            'Send the destination address and amount in this format:\n' +
            '`ADDRESS AMOUNT`\n\n' +
            'Example:\n' +
            '`7xKXtg...abc 0.5`\n\n' +
            'Send /cancel to abort.',
            { parse_mode: 'Markdown' }
        );

        ctx.session.currentFlow = 'wallet_transfer_sol';
    } catch (error) {
        await ctx.answerCbQuery('Error fetching balance');
    }
}

export async function handleTransferUSDC(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const activeWallet = multiWalletStorage.getActiveWallet(telegramId);
    if (!activeWallet) return;

    try {
        const balances = await getBalances(new PublicKey(activeWallet.publicKey));
        
        await ctx.editMessageText(
            '💵 **TRANSFER USDC**\n\n' +
            `📤 **From:** ${activeWallet.name}\n` +
            `💰 **Available:** ${balances.usdc.toFixed(2)} USDC\n\n` +
            'Send the destination address and amount in this format:\n' +
            '`ADDRESS AMOUNT`\n\n' +
            'Example:\n' +
            '`7xKXtg...abc 100`\n\n' +
            'Send /cancel to abort.',
            { parse_mode: 'Markdown' }
        );

        ctx.session.currentFlow = 'wallet_transfer_usdc';
    } catch (error) {
        await ctx.answerCbQuery('Error fetching balance');
    }
}

export async function processTransferSOL(ctx: BotContext, input: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const parts = input.trim().split(/\s+/);
    if (parts.length !== 2) {
        await ctx.reply('❌ Invalid format. Use: `ADDRESS AMOUNT`\n\nSend /cancel to abort.', { parse_mode: 'Markdown' });
        return;
    }

    const [destAddress, amountStr] = parts;

    // Validate amount with security checks
    const amountResult = InputValidator.validateAmount(amountStr, {
        min: 0.000001,
        max: 1000000,
        decimals: 9,
        allowZero: false
    });

    if (!amountResult.isValid) {
        SecurityUtils.logSecurityEvent('INVALID_TRANSFER_AMOUNT', telegramId, { input: amountStr, error: amountResult.error });
        await ctx.reply(`❌ **Invalid amount**: ${amountResult.error}\n\nSend /cancel to abort.`);
        return;
    }

    const amount = amountResult.value!;

    // Validate destination address
    const addressResult = InputValidator.validateSolanaAddress(destAddress);
    if (!addressResult.isValid) {
        SecurityUtils.logSecurityEvent('INVALID_TRANSFER_ADDRESS', telegramId, { input: destAddress, error: addressResult.error });
        await ctx.reply(`❌ **Invalid address**: ${addressResult.error}\n\nSend /cancel to abort.`);
        return;
    }

    const destPublicKey = new PublicKey(addressResult.value!);

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.reply('❌ Failed to access wallet.');
        ctx.session.currentFlow = 'idle';
        return;
    }

    const loadingMsg = await ctx.reply('🔄 Processing transfer...');

    try {
        const connection = connectionService.getConnection();
        const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: destPublicKey,
                lamports
            })
        );

        const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);

        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);

        console.log(chalk.green(`✓ User ${telegramId} transferred ${amount} SOL to ${destAddress}`));

        await ctx.reply(
            '✅ **TRANSFER SUCCESSFUL!**\n\n' +
            `💰 **Amount:** ${amount} SOL\n` +
            `📤 **To:** \`${shortenAddress(destAddress, 8)}\`\n` +
            `🔗 **Signature:**\n\`${signature}\``,
            { parse_mode: 'Markdown' }
        );

        ctx.session.currentFlow = 'idle';
    } catch (error: any) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
        await ctx.reply(`❌ Transfer failed: ${error.message}`);
        ctx.session.currentFlow = 'idle';
    }
}

export async function processTransferUSDC(ctx: BotContext, input: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const parts = input.trim().split(/\s+/);
    if (parts.length !== 2) {
        await ctx.reply('❌ Invalid format. Use: `ADDRESS AMOUNT`\n\nSend /cancel to abort.', { parse_mode: 'Markdown' });
        return;
    }

    const [destAddress, amountStr] = parts;

    // Validate amount with security checks
    const amountResult = InputValidator.validateAmount(amountStr, {
        min: 0.000001,
        max: 1000000000,
        decimals: 6,
        allowZero: false
    });

    if (!amountResult.isValid) {
        SecurityUtils.logSecurityEvent('INVALID_TRANSFER_AMOUNT', telegramId, { input: amountStr, error: amountResult.error });
        await ctx.reply(`❌ **Invalid amount**: ${amountResult.error}\n\nSend /cancel to abort.`);
        return;
    }

    const amount = amountResult.value!;

    // Validate destination address
    const addressResult = InputValidator.validateSolanaAddress(destAddress);
    if (!addressResult.isValid) {
        SecurityUtils.logSecurityEvent('INVALID_TRANSFER_ADDRESS', telegramId, { input: destAddress, error: addressResult.error });
        await ctx.reply(`❌ **Invalid address**: ${addressResult.error}\n\nSend /cancel to abort.`);
        return;
    }

    const destPublicKey = new PublicKey(addressResult.value!);

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.reply('❌ Failed to access wallet.');
        ctx.session.currentFlow = 'idle';
        return;
    }

    const loadingMsg = await ctx.reply('🔄 Processing transfer...');

    try {
        const connection = connectionService.getConnection();
        const usdcAmount = Math.floor(amount * 1e6); // USDC has 6 decimals

        // Get source ATA
        const sourceAta = await getAssociatedTokenAddress(USDC_MINT, keypair.publicKey);
        
        // Get or create destination ATA
        const destAta = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            USDC_MINT,
            destPublicKey
        );

        const transaction = new Transaction().add(
            createTransferInstruction(
                sourceAta,
                destAta.address,
                keypair.publicKey,
                usdcAmount
            )
        );

        const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);

        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);

        console.log(chalk.green(`✓ User ${telegramId} transferred ${amount} USDC to ${destAddress}`));

        await ctx.reply(
            '✅ **TRANSFER SUCCESSFUL!**\n\n' +
            `💰 **Amount:** ${amount} USDC\n` +
            `📤 **To:** \`${shortenAddress(destAddress, 8)}\`\n` +
            `🔗 **Signature:**\n\`${signature}\``,
            { parse_mode: 'Markdown' }
        );

        ctx.session.currentFlow = 'idle';
    } catch (error: any) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
        await ctx.reply(`❌ Transfer failed: ${error.message}`);
        ctx.session.currentFlow = 'idle';
    }
}

// ==================== WALLET INFO (Quick View) ====================

export async function handleQuickWalletInfo(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallet = multiWalletStorage.getActiveWallet(telegramId);
    if (!wallet) {
        await handleWalletMenu(ctx);
        return;
    }

    const loadingMsg = await ctx.reply('⏳ Loading wallet...');

    try {
        const balances = await getBalances(new PublicKey(wallet.publicKey));
        const walletCount = multiWalletStorage.getWalletCount(telegramId);

        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);

        const message = 
            '💼 **WALLET INFO**\n\n' +
            `📋 **Name:** ${wallet.name}\n` +
            `🔑 **Address:**\n\`${wallet.publicKey}\`\n\n` +
            '**Balances:**\n' +
            `• ◎ SOL: ${balances.sol.toFixed(4)}\n` +
            `• 💵 USDC: ${balances.usdc.toFixed(2)}\n\n` +
            `📊 Total wallets: ${walletCount}`;

        await ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Refresh', callback_data: 'wallet_info' }],
                    [{ text: '📋 Copy Address', callback_data: 'mwallet_copy' }],
                    [{ text: '🔑 Manage Wallets', callback_data: 'mwallet_menu' }],
                    [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                ]
            }
        });
    } catch (error) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
        await ctx.reply('❌ Failed to fetch wallet info.');
    }
}

export async function handleCopyAddress(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallet = multiWalletStorage.getActiveWallet(telegramId);
    if (!wallet) {
        await ctx.answerCbQuery('No active wallet');
        return;
    }

    await ctx.answerCbQuery('✅ Address copied to clipboard!');
    await ctx.reply(`\`${wallet.publicKey}\``, { parse_mode: 'Markdown' });
}
