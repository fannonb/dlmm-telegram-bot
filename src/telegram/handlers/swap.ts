/**
 * Standalone Swap Handler
 * 
 * Provides a dedicated swap interface that can be used:
 * - As a standalone feature from the main menu
 * - During position creation when tokens are insufficient
 * - During rebalancing when tokens are insufficient
 */

import { BotContext } from '../types';
import { swapService, UniversalSwapQuote } from '../../services/swap.service';
import { jupiterService } from '../../services/jupiter.service';
import { connectionService } from '../../services/connection.service';
import { multiWalletStorage } from '../services/walletStorageMulti';
import { userDataService } from '../services/userDataService';
import { shortenAddress, formatUsd } from '../utils/formatting';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import chalk from 'chalk';

// Common token mints
const COMMON_TOKENS: Record<string, { mint: string; symbol: string; decimals: number }> = {
    'SOL': { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', decimals: 9 },
    'USDC': { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', decimals: 6 },
    'USDT': { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', decimals: 6 },
    'BONK': { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', decimals: 5 },
    'JUP': { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', decimals: 6 },
};

interface SwapFlowData {
    inputToken?: { mint: string; symbol: string; decimals: number };
    outputToken?: { mint: string; symbol: string; decimals: number };
    inputAmount?: number;
    quote?: UniversalSwapQuote;
    returnTo?: string; // Callback to return to after swap (e.g., 'newpos_amount_auto')
    poolAddress?: string; // For context-aware swaps
}

/**
 * Main swap menu - choose what to swap
 */
export async function handleSwapMenu(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.editMessageText('❌ No wallet connected. Please set up a wallet first.', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔑 Setup Wallet', callback_data: 'wallet_setup' }],
                    [{ text: '⬅️ Back', callback_data: 'menu_main' }]
                ]
            }
        });
        return;
    }

    // Initialize swap flow
    ctx.session.flowData = { step: 'select_input' } as any;
    ctx.session.currentFlow = 'swap';

    // Get SOL balance
    const connection = connectionService.getConnection();
    const solBalance = await connection.getBalance(keypair.publicKey) / LAMPORTS_PER_SOL;

    // Try to get USDC balance
    let usdcBalance = 0;
    try {
        const usdcMint = new PublicKey(COMMON_TOKENS['USDC'].mint);
        const usdcAta = await getAssociatedTokenAddress(usdcMint, keypair.publicKey);
        const usdcAccount = await getAccount(connection, usdcAta);
        usdcBalance = Number(usdcAccount.amount) / 1e6;
    } catch { }

    const message = `
🔄 **SWAP TOKENS**

Swap any token using Jupiter aggregator for best rates.

**Your Balances:**
• SOL: ${solBalance.toFixed(4)}
• USDC: ${usdcBalance.toFixed(2)}

**Select token to swap FROM:**
`.trim();

    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: `SOL (${solBalance.toFixed(2)})`, callback_data: 'swap_from_SOL' },
                    { text: `USDC (${usdcBalance.toFixed(2)})`, callback_data: 'swap_from_USDC' },
                ],
                [
                    { text: '🔍 Custom Token', callback_data: 'swap_from_custom' },
                ],
                [{ text: '⬅️ Back', callback_data: 'menu_main' }]
            ]
        }
    });
}

/**
 * Handle token selection (from)
 */
export async function handleSwapFromToken(ctx: BotContext, tokenSymbol: string) {
    await ctx.answerCbQuery();

    const token = COMMON_TOKENS[tokenSymbol];
    if (!token) {
        await ctx.editMessageText('❌ Unknown token. Please try again.');
        return;
    }

    // Store in flow data
    const flowData = ctx.session.flowData as SwapFlowData || {};
    flowData.inputToken = token;
    ctx.session.flowData = flowData as any;

    // Show output token selection
    const outputOptions = Object.entries(COMMON_TOKENS)
        .filter(([sym]) => sym !== tokenSymbol)
        .map(([sym, info]) => ({ text: sym, callback_data: `swap_to_${sym}` }));

    // Create rows of 2-3 buttons
    const buttons: any[][] = [];
    for (let i = 0; i < outputOptions.length; i += 3) {
        buttons.push(outputOptions.slice(i, i + 3));
    }
    buttons.push([{ text: '🔍 Custom Token', callback_data: 'swap_to_custom' }]);
    buttons.push([{ text: '⬅️ Back', callback_data: 'swap_menu' }]);

    await ctx.editMessageText(
        `🔄 **SWAP FROM ${tokenSymbol}**\n\n**Select token to swap TO:**`,
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        }
    );
}

/**
 * Handle output token selection
 */
export async function handleSwapToToken(ctx: BotContext, tokenSymbol: string) {
    await ctx.answerCbQuery();

    const token = COMMON_TOKENS[tokenSymbol];
    if (!token) {
        await ctx.editMessageText('❌ Unknown token. Please try again.');
        return;
    }

    const flowData = ctx.session.flowData as SwapFlowData || {};
    flowData.outputToken = token;
    ctx.session.flowData = flowData as any;

    // Ask for amount
    await ctx.editMessageText(
        `🔄 **SWAP ${flowData.inputToken?.symbol} → ${tokenSymbol}**\n\n` +
        `Enter the amount of **${flowData.inputToken?.symbol}** you want to swap:\n\n` +
        `_(Or type "max" for maximum available)_`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '25%', callback_data: 'swap_amount_25' },
                        { text: '50%', callback_data: 'swap_amount_50' },
                        { text: '75%', callback_data: 'swap_amount_75' },
                        { text: 'MAX', callback_data: 'swap_amount_100' },
                    ],
                    [{ text: '⬅️ Back', callback_data: 'swap_menu' }]
                ]
            }
        }
    );

    ctx.session.currentFlow = 'swap_amount';
}

/**
 * Handle percentage amount selection
 */
export async function handleSwapAmountPercent(ctx: BotContext, percent: number) {
    await ctx.answerCbQuery();

    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) return;

    const flowData = ctx.session.flowData as SwapFlowData;
    if (!flowData?.inputToken) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }

    const connection = connectionService.getConnection();
    let balance = 0;

    // Get balance for input token
    if (flowData.inputToken.symbol === 'SOL') {
        balance = await connection.getBalance(keypair.publicKey) / LAMPORTS_PER_SOL;
        // Reserve 0.01 SOL for transaction fees
        balance = Math.max(0, balance - 0.01);
    } else {
        try {
            const mint = new PublicKey(flowData.inputToken.mint);
            const ata = await getAssociatedTokenAddress(mint, keypair.publicKey);
            const account = await getAccount(connection, ata);
            balance = Number(account.amount) / Math.pow(10, flowData.inputToken.decimals);
        } catch { }
    }

    const amount = (balance * percent) / 100;
    flowData.inputAmount = amount;
    ctx.session.flowData = flowData as any;

    // Get quote
    await getSwapQuoteAndShow(ctx, flowData);
}

/**
 * Handle text input for swap amount
 */
export async function handleSwapAmountText(ctx: BotContext, text: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) return;

    const flowData = ctx.session.flowData as SwapFlowData;
    if (!flowData?.inputToken || !flowData?.outputToken) {
        await ctx.reply('Session expired. Please use /swap to start again.');
        return;
    }

    const connection = connectionService.getConnection();
    let balance = 0;

    // Get balance for input token
    if (flowData.inputToken.symbol === 'SOL') {
        balance = await connection.getBalance(keypair.publicKey) / LAMPORTS_PER_SOL;
        balance = Math.max(0, balance - 0.01); // Reserve for fees
    } else {
        try {
            const mint = new PublicKey(flowData.inputToken.mint);
            const ata = await getAssociatedTokenAddress(mint, keypair.publicKey);
            const account = await getAccount(connection, ata);
            balance = Number(account.amount) / Math.pow(10, flowData.inputToken.decimals);
        } catch { }
    }

    let amount: number;
    if (text.toLowerCase() === 'max') {
        amount = balance;
    } else {
        amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
            await ctx.reply('❌ Invalid amount. Please enter a valid number.');
            return;
        }
    }

    if (amount > balance) {
        await ctx.reply(`❌ Insufficient balance. You have ${balance.toFixed(6)} ${flowData.inputToken.symbol}.`);
        return;
    }

    flowData.inputAmount = amount;
    ctx.session.flowData = flowData as any;

    // Get quote
    await ctx.reply('🔍 Getting swap quote...');
    await getSwapQuoteAndShow(ctx, flowData);
}

/**
 * Get quote and show confirmation
 */
async function getSwapQuoteAndShow(ctx: BotContext, flowData: SwapFlowData) {
    const telegramId = ctx.from?.id;
    if (!telegramId || !flowData.inputToken || !flowData.outputToken || !flowData.inputAmount) return;

    try {
        const slippage = userDataService.getDefaultSlippage(telegramId);
        const amountInBaseUnits = Math.floor(
            flowData.inputAmount * Math.pow(10, flowData.inputToken.decimals)
        ).toString();

        const quote = await swapService.getUniversalSwapQuote(
            flowData.inputToken.mint,
            flowData.outputToken.mint,
            amountInBaseUnits,
            slippage,
            flowData.poolAddress
        );

        flowData.quote = quote;
        ctx.session.flowData = flowData as any;

        const outputAmount = parseInt(quote.outAmount) / Math.pow(10, flowData.outputToken.decimals);
        const priceImpact = quote.priceImpact;
        const rate = outputAmount / flowData.inputAmount;

        const routeText = quote.route?.join(' → ') || quote.source.toUpperCase();
        const priceImpactWarning = priceImpact > 1 ? '\n⚠️ **High price impact!**' : '';

        const message = `
🔄 **SWAP QUOTE**

**From:** ${flowData.inputAmount.toFixed(6)} ${flowData.inputToken.symbol}
**To:** ~${outputAmount.toFixed(6)} ${flowData.outputToken.symbol}

**Rate:** 1 ${flowData.inputToken.symbol} = ${rate.toFixed(6)} ${flowData.outputToken.symbol}
**Price Impact:** ${priceImpact.toFixed(2)}%${priceImpactWarning}
**Slippage:** ${slippage}%
**Route:** ${routeText}

⚡ _Quote valid for ~30 seconds_
`.trim();

        const editOrReply = ctx.callbackQuery ? ctx.editMessageText.bind(ctx) : ctx.reply.bind(ctx);

        await editOrReply(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Confirm Swap', callback_data: 'swap_execute' }],
                    [{ text: '🔄 Refresh Quote', callback_data: 'swap_refresh_quote' }],
                    [{ text: '⬅️ Back', callback_data: 'swap_menu' }]
                ]
            }
        });

    } catch (error: any) {
        console.error('Error getting swap quote:', error);
        const editOrReply = ctx.callbackQuery ? ctx.editMessageText.bind(ctx) : ctx.reply.bind(ctx);
        
        // Provide more specific error messages
        let errorMessage = error.message || 'Unknown error';
        let suggestions = '';
        
        if (errorMessage.includes('Network error') || errorMessage.includes('fetch failed') || errorMessage.includes('ENOTFOUND')) {
            errorMessage = 'Network error connecting to swap service';
            suggestions = '\n• Check your internet connection\n• Try again in a moment\n• The swap service may be temporarily unavailable';
        } else if (errorMessage.includes('No swap route')) {
            suggestions = '\n• Token pair may not be supported\n• Insufficient liquidity for this amount\n• Try a smaller amount';
        } else {
            suggestions = '\n• Token pair not supported\n• Insufficient liquidity\n• Network issues';
        }
        
        await editOrReply(
            `❌ **Failed to get quote**\n\n${errorMessage}\n\n**Possible causes:**${suggestions}`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'swap_menu' }],
                        [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                    ]
                }
            }
        );
    }
}

/**
 * Execute the swap
 */
export async function handleSwapExecute(ctx: BotContext) {
    await ctx.answerCbQuery('Executing swap...');

    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.editMessageText('❌ Wallet not found.');
        return;
    }

    const flowData = ctx.session.flowData as SwapFlowData;
    if (!flowData?.quote || !flowData.inputToken || !flowData.outputToken) {
        await ctx.editMessageText('❌ Session expired. Please start again.');
        return;
    }

    try {
        await ctx.editMessageText(
            `⏳ **EXECUTING SWAP**\n\n` +
            `Swapping ${flowData.inputAmount?.toFixed(6)} ${flowData.inputToken.symbol} → ${flowData.outputToken.symbol}\n\n` +
            `_Please wait, this may take 30-60 seconds..._`,
            { parse_mode: 'Markdown' }
        );

        const signature = await swapService.executeUniversalSwap(flowData.quote, keypair);

        const outputAmount = parseInt(flowData.quote.outAmount) / Math.pow(10, flowData.outputToken.decimals);

        console.log(chalk.green(`✓ User ${telegramId} swapped ${flowData.inputAmount} ${flowData.inputToken.symbol} → ${outputAmount.toFixed(6)} ${flowData.outputToken.symbol}, tx: ${signature.slice(0, 12)}...`));

        // Clear flow
        ctx.session.flowData = undefined;
        ctx.session.currentFlow = 'idle';

        const returnButtons: any[] = [];
        if (flowData.returnTo) {
            returnButtons.push([{ text: '⬅️ Continue', callback_data: flowData.returnTo }]);
        }

        await ctx.editMessageText(
            `✅ **SWAP SUCCESSFUL!**\n\n` +
            `**Swapped:** ${flowData.inputAmount?.toFixed(6)} ${flowData.inputToken.symbol}\n` +
            `**Received:** ~${outputAmount.toFixed(6)} ${flowData.outputToken.symbol}\n\n` +
            `🔗 [View on Solscan](https://solscan.io/tx/${signature})`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        ...returnButtons,
                        [{ text: '🔄 Swap More', callback_data: 'swap_menu' }],
                        [{ text: '🏠 Main Menu', callback_data: 'menu_main' }]
                    ]
                }
            }
        );

    } catch (error: any) {
        console.error('Swap execution error:', error);

        let suggestion = '';
        if (error.message?.includes('insufficient')) {
            suggestion = '\n💡 Check your balance and try a smaller amount.';
        } else if (error.message?.includes('slippage')) {
            suggestion = '\n💡 Try increasing slippage in Settings.';
        }

        await ctx.editMessageText(
            `❌ **SWAP FAILED**\n\n` +
            `Error: ${error.message}${suggestion}`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'swap_refresh_quote' }],
                        [{ text: '⬅️ Back', callback_data: 'swap_menu' }]
                    ]
                }
            }
        );
    }
}

/**
 * Refresh the quote
 */
export async function handleSwapRefreshQuote(ctx: BotContext) {
    await ctx.answerCbQuery('Refreshing quote...');

    const flowData = ctx.session.flowData as SwapFlowData;
    if (!flowData?.inputToken || !flowData?.outputToken || !flowData?.inputAmount) {
        await ctx.editMessageText('Session expired. Please start again.', {
            reply_markup: {
                inline_keyboard: [[{ text: '🔄 Start Over', callback_data: 'swap_menu' }]]
            }
        });
        return;
    }

    await getSwapQuoteAndShow(ctx, flowData);
}

/**
 * Handle custom token input (from)
 */
export async function handleSwapFromCustom(ctx: BotContext) {
    await ctx.answerCbQuery();

    await ctx.editMessageText(
        `🔍 **CUSTOM TOKEN**\n\n` +
        `Enter the **mint address** of the token you want to swap FROM:\n\n` +
        `Example: \`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\``,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ Back', callback_data: 'swap_menu' }]
                ]
            }
        }
    );

    ctx.session.currentFlow = 'swap_custom_from';
}

/**
 * Handle custom token input (to)
 */
export async function handleSwapToCustom(ctx: BotContext) {
    await ctx.answerCbQuery();

    await ctx.editMessageText(
        `🔍 **CUSTOM OUTPUT TOKEN**\n\n` +
        `Enter the **mint address** of the token you want to swap TO:\n\n` +
        `Example: \`DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263\``,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ Back', callback_data: 'swap_menu' }]
                ]
            }
        }
    );

    ctx.session.currentFlow = 'swap_custom_to';
}

/**
 * Process custom token mint address
 */
export async function handleSwapCustomMint(ctx: BotContext, mintAddress: string, isFrom: boolean) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    try {
        // Validate mint address
        const mint = new PublicKey(mintAddress);
        const connection = connectionService.getConnection();

        // Get token info
        const mintInfo = await connection.getParsedAccountInfo(mint);
        if (!mintInfo.value || !('parsed' in mintInfo.value.data)) {
            throw new Error('Invalid token mint address');
        }

        const decimals = mintInfo.value.data.parsed.info.decimals;
        const symbol = mintAddress.slice(0, 6) + '...'; // Abbreviated

        const tokenInfo = { mint: mintAddress, symbol, decimals };
        const flowData = (ctx.session.flowData || {}) as SwapFlowData;

        if (isFrom) {
            flowData.inputToken = tokenInfo;
            ctx.session.flowData = flowData as any;

            // Now ask for output token
            await ctx.reply(
                `✅ Token validated!\n\n**Select token to swap TO:**`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'SOL', callback_data: 'swap_to_SOL' },
                                { text: 'USDC', callback_data: 'swap_to_USDC' },
                                { text: 'USDT', callback_data: 'swap_to_USDT' },
                            ],
                            [{ text: '🔍 Custom Token', callback_data: 'swap_to_custom' }],
                            [{ text: '⬅️ Back', callback_data: 'swap_menu' }]
                        ]
                    }
                }
            );
        } else {
            flowData.outputToken = tokenInfo;
            ctx.session.flowData = flowData as any;

            // Ask for amount
            await ctx.reply(
                `✅ Output token validated!\n\n` +
                `🔄 **SWAP ${flowData.inputToken?.symbol} → ${symbol}**\n\n` +
                `Enter the amount of **${flowData.inputToken?.symbol}** to swap:`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '25%', callback_data: 'swap_amount_25' },
                                { text: '50%', callback_data: 'swap_amount_50' },
                                { text: '75%', callback_data: 'swap_amount_75' },
                                { text: 'MAX', callback_data: 'swap_amount_100' },
                            ],
                            [{ text: '⬅️ Back', callback_data: 'swap_menu' }]
                        ]
                    }
                }
            );
            ctx.session.currentFlow = 'swap_amount';
        }

    } catch (error: any) {
        await ctx.reply(
            `❌ Invalid token mint address.\n\nPlease enter a valid Solana token mint address.`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: isFrom ? 'swap_from_custom' : 'swap_to_custom' }],
                        [{ text: '⬅️ Back', callback_data: 'swap_menu' }]
                    ]
                }
            }
        );
    }
}

// ==================== CONTEXT-AWARE SWAP ====================

/**
 * Smart swap helper - used when user doesn't have enough of a token
 * Called from position creation or rebalancing flows
 */
export async function handleSmartSwap(
    ctx: BotContext,
    neededToken: { mint: string; symbol: string; decimals: number },
    neededAmount: number,
    availableToken: { mint: string; symbol: string; decimals: number },
    availableAmount: number,
    returnCallback: string,
    poolAddress?: string
) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Calculate how much to swap (add 2% buffer for slippage)
    const swapAmount = Math.min(availableAmount * 0.98, availableAmount); // Keep some for fees if SOL

    // Store in flow data
    const flowData: SwapFlowData = {
        inputToken: availableToken,
        outputToken: neededToken,
        inputAmount: swapAmount,
        returnTo: returnCallback,
        poolAddress: poolAddress
    };
    ctx.session.flowData = flowData as any;

    const message = `
🔄 **SWAP NEEDED**

You need **${neededAmount.toFixed(6)} ${neededToken.symbol}** but don't have enough.

**Available to swap:**
• ${availableAmount.toFixed(6)} ${availableToken.symbol}

**Suggested swap:**
• Swap ~${swapAmount.toFixed(6)} ${availableToken.symbol}
• To get ~${neededAmount.toFixed(6)} ${neededToken.symbol}

Would you like to proceed?
`.trim();

    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔄 Get Quote & Swap', callback_data: 'swap_smart_quote' }],
                [{ text: '✏️ Enter Custom Amount', callback_data: 'swap_smart_custom' }],
                [{ text: '⬅️ Back', callback_data: returnCallback }]
            ]
        }
    });
}

/**
 * Get quote for smart swap
 */
export async function handleSmartSwapQuote(ctx: BotContext) {
    await ctx.answerCbQuery('Getting quote...');

    const flowData = ctx.session.flowData as SwapFlowData;
    if (!flowData?.inputToken || !flowData?.outputToken || !flowData?.inputAmount) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }

    await getSwapQuoteAndShow(ctx, flowData);
}

/**
 * Custom amount for smart swap
 */
export async function handleSmartSwapCustom(ctx: BotContext) {
    await ctx.answerCbQuery();

    const flowData = ctx.session.flowData as SwapFlowData;
    if (!flowData?.inputToken || !flowData?.outputToken) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }

    await ctx.editMessageText(
        `Enter the amount of **${flowData.inputToken.symbol}** you want to swap:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ Back', callback_data: 'swap_menu' }]
                ]
            }
        }
    );

    ctx.session.currentFlow = 'swap_amount';
}
