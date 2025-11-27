import { BotContext } from '../types';
import { walletStorage } from '../services/walletStorage';
import { Keypair, PublicKey } from '@solana/web3.js';
import { connectionService } from '../../services/connection.service';
import { getAccount, getAssociatedTokenAddress, TokenAccountNotFoundError } from '@solana/spl-token';
import chalk from 'chalk';
import * as bip39 from 'bip39';
import bs58 from 'bs58';

// Simple balance fetcher for SOL and USDC
async function getSimpleBalances(publicKey: PublicKey) {
    const connection = connectionService.getConnection();

    // Get SOL balance
    const solBalance = await connection.getBalance(publicKey);
    const sol = solBalance / 1e9;

    // Get USDC balance
    const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    let usdc = 0;

    try {
        const usdcAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);
        const usdcAccount = await getAccount(connection, usdcAta);
        usdc = Number(usdcAccount.amount) / 1e6; // USDC has 6 decimals
    } catch (error) {
        if (!(error instanceof TokenAccountNotFoundError)) {
            console.error('Error fetching USDC balance:', error);
        }
    }

    return { sol, usdc };
}

export async function handleWallet(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const hasWallet = walletStorage.hasWallet(telegramId);

    if (hasWallet) {
        // Show wallet info
        await showWalletInfo(ctx, telegramId);
    } else {
        // Guide to import/create
        await showWalletSetup(ctx);
    }
}

async function showWalletSetup(ctx: BotContext) {
    const message = `
💼 **Wallet Setup**

You don't have a wallet connected yet.

Choose an option:
    `.trim();

    await ctx.replyWithMarkdown(message, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📥 Import Existing Wallet', callback_data: 'wallet_import' }],
                [{ text: '🆕 Create New Wallet', callback_data: 'wallet_create' }],
                [{ text: '❓ What is a Wallet?', callback_data: 'wallet_info' }]
            ]
        }
    });
}

async function showWalletInfo(ctx: BotContext, telegramId: number) {
    const keypair = walletStorage.getWallet(telegramId);
    if (!keypair) {
        await ctx.reply('❌ Wallet not found. Please reconnect.');
        return;
    }

    const publicKey = keypair.publicKey.toBase58();

    // Get balances
    const loadingMsg = await ctx.reply('⏳ Fetching balances...');

    try {
        const balances = await getSimpleBalances(keypair.publicKey);

        const message = `
💼 **Your Wallet**

Address: \`${publicKey}\`

**Balances:**
• SOL: ${balances.sol.toFixed(4)}
• USDC: ${balances.usdc.toFixed(2)}

**Actions:**
        `.trim();

        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
        await ctx.replyWithMarkdown(message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Refresh', callback_data: 'wallet_refresh' }],
                    [{ text: '📋 Copy Address', callback_data: 'wallet_copy' }],
                    [{ text: '🗑️ Disconnect Wallet', callback_data: 'wallet_disconnect' }]
                ]
            }
        });
    } catch (error) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
        await ctx.reply('❌ Failed to fetch balances. Please try again.');
        console.error('Balance fetch error:', error);
    }
}

// Handle wallet import flow
export async function handleWalletImport(ctx: BotContext) {
    await ctx.editMessageText(
        '📥 **Import Wallet**\n\n' +
        'Please send your **seed phrase** (12 or 24 words) or **private key**.\n\n' +
        '🔒 Your message will be automatically deleted for security.\n\n' +
        'Send /cancel to abort.',
        { parse_mode: 'Markdown' }
    );

    // Set session state
    ctx.session.waitingForWalletImport = true;
}

// Handle wallet creation
export async function handleWalletCreate(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Generate new wallet
    const keypair = Keypair.generate();
    const mnemonic = bip39.entropyToMnemonic(Buffer.from(keypair.secretKey.slice(0, 16)).toString('hex'));

    // Store wallet
    walletStorage.storeWallet(telegramId, keypair);

    console.log(chalk.green(`✓ Created wallet for user ${telegramId}: ${keypair.publicKey.toBase58()}`));

    const message = `
✅ **Wallet Created!**

Your new wallet address:
\`${keypair.publicKey.toBase58()}\`

**⚠️ IMPORTANT - Save Your Seed Phrase:**

\`${mnemonic}\`

**This message will be deleted in 60 seconds.**

Write down these words in order. You'll need them to recover your wallet.
    `.trim();

    const result = await ctx.editMessageText(message, { parse_mode: 'Markdown' });
    const messageId = typeof result === 'boolean' ? ctx.callbackQuery?.message?.message_id : result.message_id;

    // Auto-delete after 60 seconds
    if (messageId) {
        setTimeout(async () => {
            try {
                await ctx.telegram.deleteMessage(ctx.chat!.id, messageId);
                console.log(chalk.gray('Auto-deleted wallet creation message'));
            } catch (error) {
                console.error('Failed to delete message:', error);
            }
        }, 60000);
    }
}

// Process seed phrase/private key
export async function processWalletImport(ctx: BotContext, input: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Delete user's message immediately
    try {
        await ctx.deleteMessage();
        console.log(chalk.gray('Deleted user seed phrase message'));
    } catch (error) {
        console.error('Failed to delete user message:', error);
    }

    try {
        let keypair: Keypair;

        if (input.includes(' ')) {
            // Seed phrase
            const seed = await bip39.mnemonicToSeed(input.trim());
            keypair = Keypair.fromSeed(seed.slice(0, 32));
        } else {
            // Private key (base58)
            keypair = Keypair.fromSecretKey(bs58.decode(input.trim()));
        }

        // Store wallet
        walletStorage.storeWallet(telegramId, keypair);

        console.log(chalk.green(`✓ Imported wallet for user ${telegramId}: ${keypair.publicKey.toBase58()}`));

        const successMsg = await ctx.reply(
            `✅ **Wallet Imported!**\n\n` +
            `Address: \`${keypair.publicKey.toBase58()}\`\n\n` +
            `This message will be deleted in 10 seconds.`,
            { parse_mode: 'Markdown' }
        );

        // Auto-delete success message
        setTimeout(async () => {
            try {
                await ctx.telegram.deleteMessage(ctx.chat!.id, successMsg.message_id);
            } catch (error) {
                console.error('Failed to delete success message:', error);
            }
        }, 10000);

        // Clear session state
        ctx.session.waitingForWalletImport = false;

        // Show wallet info
        setTimeout(() => showWalletInfo(ctx, telegramId), 11000);
    } catch (error: any) {
        await ctx.reply(`❌ Invalid seed phrase or private key. Please try again.`);
        console.error('Wallet import error:', error);
    }
}

// Handle wallet info request
export async function handleWalletInfoRequest(ctx: BotContext) {
    const message = `
❓ **What is a Wallet?**

A wallet is your account on the Solana blockchain. It consists of:

**Public Key (Address):** 
Like your bank account number. You can share this to receive funds.

**Private Key (Seed Phrase):**
Like your PIN/password. NEVER share this with anyone!

**Why do I need one?**
To manage DLMM liquidity positions, you need a wallet to hold your SOL and tokens.

**Is it safe?**
Yes! Your private key is encrypted and stored securely. All sensitive messages are auto-deleted.
    `.trim();

    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '⬅️ Back to Setup', callback_data: 'wallet_setup' }]
            ]
        }
    });
}

// Handle wallet disconnect
export async function handleWalletDisconnect(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const deleted = walletStorage.deleteWallet(telegramId);

    if (deleted) {
        await ctx.editMessageText(
            '✅ Wallet disconnected successfully.\n\n' +
            'Your wallet has been removed from the bot.',
            { parse_mode: 'Markdown' }
        );
        console.log(chalk.yellow(`Wallet disconnected for user ${telegramId}`));
    } else {
        await ctx.editMessageText('❌ Failed to disconnect wallet.');
    }
}

// Handle copy address
export async function handleCopyAddress(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = walletStorage.getWallet(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('❌ Wallet not found');
        return;
    }

    const address = keypair.publicKey.toBase58();
    await ctx.answerCbQuery('✅ Address copied!');
    await ctx.reply(`\`${address}\``, { parse_mode: 'Markdown' });
}
