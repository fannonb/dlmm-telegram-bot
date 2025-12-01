/**
 * Position Management Handlers for Telegram Bot
 * 
 * Implements:
 * - List all positions
 * - Position detail view
 * - Claim fees
 * - Compound position
 * - Close position
 * - Add/Remove liquidity (placeholder)
 */

import { BotContext } from '../types';
import { multiWalletStorage } from '../services/walletStorageMulti';
import { positionService, UserPosition } from '../../services/position.service';
import {
    claimFeesWithKeypair,
    removeLiquidityWithKeypair,
    closePositionWithKeypair,
    compoundFeesWithKeypair,
    getRebalanceAnalysis,
    getAIAnalysis,
    executeRebalanceWithKeypair
} from '../services/telegramPositionService';
import { connectionService } from '../../services/connection.service';
import { formatUsd, shortenAddress, formatNumber, formatPercent } from '../utils/formatting';
import { swapService } from '../../services/swap.service';
import { poolService } from '../../services/pool.service';
import { BN } from '@coral-xyz/anchor';
import chalk from 'chalk';

// Constants
const POSITIONS_PER_PAGE = 3;

// ==================== HELPER FUNCTIONS ====================

function getInRangeEmoji(inRange: boolean): string {
    return inRange ? '✅' : '⚠️';
}

function formatPositionCard(pos: UserPosition, index: number): string {
    const tokenX = pos.tokenX;
    const tokenY = pos.tokenY;
    const rangeStatus = pos.inRange ? '✅ IN RANGE' : '⚠️ OUT OF RANGE';

    // Format helper
    const formatSmall = (val: number | undefined) => {
        if (val === undefined || val === 0) return '0';
        if (val < 0.000001) return val.toExponential(2);
        if (val < 0.001) return val.toFixed(6);
        if (val < 1) return val.toFixed(4);
        return val.toFixed(2);
    };

    // Format amounts
    const xAmount = formatSmall(tokenX.uiAmount);
    const yAmount = formatSmall(tokenY.uiAmount);
    const xUsd = tokenX.usdValue ? formatUsd(tokenX.usdValue) : '';
    const yUsd = tokenY.usdValue ? formatUsd(tokenY.usdValue) : '';

    // Format fees
    const feeX = formatSmall(pos.unclaimedFees.xUi);
    const feeY = formatSmall(pos.unclaimedFees.yUi);
    const feeUsd = pos.unclaimedFees.usdValue ? formatUsd(pos.unclaimedFees.usdValue) : '$0.00';

    // Total value
    const totalValue = pos.totalValueUSD ? formatUsd(pos.totalValueUSD) : 'N/A';

    // APR
    const apr = pos.poolApr ? `${pos.poolApr.toFixed(2)}%` : 'N/A';

    // Calculate Price Range and Current Price
    let priceRangeStr = `[${pos.lowerBinId} - ${pos.upperBinId}]`;
    let currentPriceStr = 'N/A';

    if (pos.binStep && tokenX.decimals !== undefined && tokenY.decimals !== undefined) {
        try {
            const formatPrice = (p: number) => p < 0.01 ? p.toFixed(6) : p < 1 ? p.toFixed(4) : p.toFixed(2);

            const minPrice = poolService.calculateBinPrice(pos.lowerBinId, pos.binStep, tokenX.decimals, tokenY.decimals);
            const maxPrice = poolService.calculateBinPrice(pos.upperBinId, pos.binStep, tokenX.decimals, tokenY.decimals);
            priceRangeStr = `$${formatPrice(minPrice)} - $${formatPrice(maxPrice)}`;

            const currentPrice = poolService.calculateBinPrice(pos.activeBinId, pos.binStep, tokenX.decimals, tokenY.decimals);
            currentPriceStr = `$${formatPrice(currentPrice)}`;
        } catch (e) {
            // Keep bin IDs if calculation fails
        }
    }

    return `
📍 **#${index + 1} ${tokenX.symbol || 'Token'}/${tokenY.symbol || 'Token'}**

\`${shortenAddress(pos.publicKey, 6)}\`
${rangeStatus}

💰 **Holdings:** ${totalValue}
• ${xAmount} ${tokenX.symbol} ${xUsd ? `(${xUsd})` : ''}
• ${yAmount} ${tokenY.symbol} ${yUsd ? `(${yUsd})` : ''}

📊 **Range:** ${priceRangeStr}
💲 **Price:** ${currentPriceStr}
🎯 **Active Bin:** ${pos.activeBinId}
📈 **APR:** ${apr}

💸 **Unclaimed Fees:** ${feeUsd}
• ${feeX} ${tokenX.symbol} / ${feeY} ${tokenY.symbol}
`.trim();
}

function formatPositionSummary(pos: UserPosition): string {
    const tokenX = pos.tokenX;
    const tokenY = pos.tokenY;
    const rangeIcon = pos.inRange ? '✅' : '⚠️';
    const totalValue = pos.totalValueUSD ? formatUsd(pos.totalValueUSD) : 'N/A';

    // Format amounts
    const formatSmall = (val: number | undefined) => {
        if (val === undefined || val === 0) return '0';
        if (val < 0.000001) return val.toExponential(2);
        if (val < 0.001) return val.toFixed(6);
        if (val < 1) return val.toFixed(4);
        return val.toFixed(2);
    };

    const xAmount = formatSmall(tokenX.uiAmount);
    const yAmount = formatSmall(tokenY.uiAmount);
    // Format fees
    const feeX = formatSmall(pos.unclaimedFees.xUi);
    const feeY = formatSmall(pos.unclaimedFees.yUi);
    const feeUsd = pos.unclaimedFees.usdValue ? formatUsd(pos.unclaimedFees.usdValue) : '$0';

    // Calculate Price Range and Current Price
    let priceRangeStr = `[${pos.lowerBinId} - ${pos.upperBinId}]`;
    let currentPriceStr = 'N/A';

    if (pos.binStep && tokenX.decimals !== undefined && tokenY.decimals !== undefined) {
        try {
            const formatPrice = (p: number) => p < 0.01 ? p.toFixed(6) : p < 1 ? p.toFixed(4) : p.toFixed(2);

            const minPrice = poolService.calculateBinPrice(pos.lowerBinId, pos.binStep, tokenX.decimals, tokenY.decimals);
            const maxPrice = poolService.calculateBinPrice(pos.upperBinId, pos.binStep, tokenX.decimals, tokenY.decimals);
            priceRangeStr = `$${formatPrice(minPrice)} - $${formatPrice(maxPrice)}`;

            const currentPrice = poolService.calculateBinPrice(pos.activeBinId, pos.binStep, tokenX.decimals, tokenY.decimals);
            currentPriceStr = `$${formatPrice(currentPrice)}`;
        } catch (e) {
            // Keep bin IDs if calculation fails
        }
    }

    return `${rangeIcon} **${tokenX.symbol}/${tokenY.symbol}**\n` +
        `💰 ${currentPriceStr} (${xAmount} ${tokenX.symbol} / ${yAmount} ${tokenY.symbol})\n` +
        `📏 ${priceRangeStr}\n` +
        `💸 Fees: ${feeUsd} (${feeX} ${tokenX.symbol} / ${feeY} ${tokenY.symbol})`;
}

// ==================== POSITION LIST ====================

export async function handlePositionsList(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const wallet = multiWalletStorage.getActiveWallet(telegramId);
    if (!wallet) {
        await ctx.reply(
            '❌ **No wallet connected**\n\n' +
            'Please set up a wallet first using /wallet',
            { parse_mode: 'Markdown' }
        );
        return;
    }

    // Show loading message
    const loadingMsg = await ctx.reply('🔄 Fetching your positions...');

    try {
        const positions = await positionService.getAllPositions(wallet.publicKey);

        // Delete loading message
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id).catch(() => { });

        if (positions.length === 0) {
            await ctx.reply(
                '📋 **No Positions Found**\n\n' +
                'You don\'t have any DLMM positions yet.\n\n' +
                '💡 To create a position:\n' +
                '1. Browse pools with /pools\n' +
                '2. Select a pool and create a position',
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🏊 Browse Pools', callback_data: 'pools_browse' }],
                            [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                        ]
                    }
                }
            );
            return;
        }

        // Calculate totals
        const totalValue = positions.reduce((sum, p) => sum + (p.totalValueUSD || 0), 0);
        const totalFees = positions.reduce((sum, p) => sum + (p.unclaimedFees.usdValue || 0), 0);
        const inRangeCount = positions.filter(p => p.inRange).length;

        // Store positions in session for pagination
        ctx.session.pagination = {
            currentPage: 0,
            totalPages: Math.ceil(positions.length / POSITIONS_PER_PAGE),
            itemsPerPage: POSITIONS_PER_PAGE,
            listType: 'positions',
            data: positions
        };

        // Build summary message
        let message = `📋 **YOUR POSITIONS** (${positions.length})\n\n`;
        message += `💰 **Total Value:** ${formatUsd(totalValue)}\n`;
        message += `💸 **Unclaimed Fees:** ${formatUsd(totalFees)}\n`;
        message += `📊 **In Range:** ${inRangeCount}/${positions.length}\n\n`;
        message += `─────────────────\n\n`;

        // Show first page of positions
        const pagePositions = positions.slice(0, POSITIONS_PER_PAGE);
        pagePositions.forEach((pos, idx) => {
            message += formatPositionSummary(pos) + '\n';
        });

        // Build keyboard
        const keyboard = buildPositionListKeyboard(positions, 0);

        await ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        console.log(chalk.blue(`✓ User ${telegramId} fetched ${positions.length} positions`));

    } catch (error: any) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id).catch(() => { });
        console.error('Error fetching positions:', error);
        await ctx.reply(
            '❌ **Error fetching positions**\n\n' +
            'Please try again later.',
            { parse_mode: 'Markdown' }
        );
    }
}

function buildPositionListKeyboard(positions: UserPosition[], page: number) {
    const buttons: any[][] = [];

    // Position buttons (up to 3 per page)
    const startIdx = page * POSITIONS_PER_PAGE;
    const pagePositions = positions.slice(startIdx, startIdx + POSITIONS_PER_PAGE);

    pagePositions.forEach((pos, idx) => {
        const globalIdx = startIdx + idx;
        const tokenX = pos.tokenX.symbol || 'X';
        const tokenY = pos.tokenY.symbol || 'Y';
        const rangeIcon = pos.inRange ? '✅' : '⚠️';
        const shortAddr = pos.publicKey.slice(0, 8);

        buttons.push([{
            text: `${rangeIcon} ${tokenX}/${tokenY} (${shortAddr}...)`,
            callback_data: `pos_detail_${shortAddr}`
        }]);
    });

    // Pagination buttons
    const totalPages = Math.ceil(positions.length / POSITIONS_PER_PAGE);
    if (totalPages > 1) {
        const paginationRow: any[] = [];
        if (page > 0) {
            paginationRow.push({ text: '⬅️ Prev', callback_data: `pos_page_${page - 1}` });
        }
        paginationRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'pos_page_info' });
        if (page < totalPages - 1) {
            paginationRow.push({ text: 'Next ➡️', callback_data: `pos_page_${page + 1}` });
        }
        buttons.push(paginationRow);
    }

    // Action buttons
    if (positions.some(p => (p.unclaimedFees.usdValue || 0) > 0)) {
        buttons.push([{ text: '💰 Claim All Fees', callback_data: 'pos_claim_all' }]);
    }

    buttons.push([
        { text: '🔄 Refresh', callback_data: 'positions_refresh' },
        { text: '⬅️ Menu', callback_data: 'menu_main' }
    ]);

    return { inline_keyboard: buttons };
}

// ==================== POSITION PAGINATION ====================

export async function handlePositionPage(ctx: BotContext, page: number) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const pagination = ctx.session.pagination;
    if (!pagination || pagination.listType !== 'positions' || !pagination.data) {
        await ctx.answerCbQuery('Session expired. Please refresh.');
        return;
    }

    const positions = pagination.data as UserPosition[];
    pagination.currentPage = page;

    // Calculate totals
    const totalValue = positions.reduce((sum, p) => sum + (p.totalValueUSD || 0), 0);
    const totalFees = positions.reduce((sum, p) => sum + (p.unclaimedFees.usdValue || 0), 0);
    const inRangeCount = positions.filter(p => p.inRange).length;

    // Build message
    let message = `📋 **YOUR POSITIONS** (${positions.length})\n\n`;
    message += `💰 **Total Value:** ${formatUsd(totalValue)}\n`;
    message += `💸 **Unclaimed Fees:** ${formatUsd(totalFees)}\n`;
    message += `📊 **In Range:** ${inRangeCount}/${positions.length}\n\n`;
    message += `─────────────────\n\n`;

    // Show current page of positions
    const startIdx = page * POSITIONS_PER_PAGE;
    const pagePositions = positions.slice(startIdx, startIdx + POSITIONS_PER_PAGE);
    pagePositions.forEach((pos) => {
        message += formatPositionSummary(pos) + '\n';
    });

    const keyboard = buildPositionListKeyboard(positions, page);

    await ctx.answerCbQuery();
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

// ==================== POSITION DETAIL ====================

export async function handlePositionDetail(ctx: BotContext, shortAddr: string) {
    console.log(chalk.cyan(`[Position Detail] Called with shortAddr: ${shortAddr}`));
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Answer callback query immediately to prevent timeout
    if (ctx.callbackQuery) {
        await ctx.answerCbQuery().catch(() => { });
    }

    // Find position from session or refetch
    let position: UserPosition | undefined;

    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        console.log(chalk.gray(`[Position Detail] Searching ${positions.length} positions for ${shortAddr}`));
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
        if (position) {
            console.log(chalk.green(`[Position Detail] Found position: ${position.publicKey}`));
        } else {
            console.log(chalk.yellow(`[Position Detail] Position not found in session`));
        }
    }

    if (!position) {
        // Refetch positions
        const wallet = multiWalletStorage.getActiveWallet(telegramId);
        if (!wallet) {
            await ctx.reply('❌ No wallet connected');
            return;
        }

        const loadingMsg = await ctx.reply('🔄 Loading position details...');

        try {
            const positions = await positionService.getAllPositions(wallet.publicKey);
            position = positions.find(p => p.publicKey.startsWith(shortAddr));
            await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id).catch(() => { });
        } catch (error) {
            await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id).catch(() => { });
            await ctx.reply('❌ Error loading position');
            return;
        }
    }

    if (!position) {
        await ctx.reply('❌ Position not found');
        return;
    }

    // Store selected position
    ctx.session.selectedPositionAddress = position.publicKey;

    // Format detailed view
    const message = formatPositionCard(position, 0);

    // Build action keyboard
    const keyboard = buildPositionDetailKeyboard(position);

    if (ctx.callbackQuery) {
        // Already answered callback query at start of function
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

function buildPositionDetailKeyboard(position: UserPosition) {
    const shortAddr = position.publicKey.slice(0, 8);
    const hasFees = (position.unclaimedFees.usdValue || 0) > 0;

    const buttons: any[][] = [];

    // Fee actions
    if (hasFees) {
        buttons.push([
            { text: '💰 Claim Fees', callback_data: `pos_claim_${shortAddr}` }
        ]);
    }

    // Position actions
    buttons.push([
        { text: '♻️ Rebalance', callback_data: `pos_rebalance_${shortAddr}` }
    ]);

    buttons.push([
        { text: '➕ Add Liquidity', callback_data: `pos_add_${shortAddr}` },
        { text: '➖ Remove', callback_data: `pos_remove_${shortAddr}` }
    ]);

    buttons.push([
        { text: '❌ Close Position', callback_data: `pos_close_${shortAddr}` }
    ]);

    // Navigation
    buttons.push([
        { text: '🔄 Refresh', callback_data: `pos_refresh_${shortAddr}` },
        { text: '⬅️ Back to List', callback_data: 'positions_list' }
    ]);

    return { inline_keyboard: buttons };
}

// ==================== CLAIM FEES ====================


export async function handleClaimFees(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found. Please refresh.');
        return;
    }

    const fees = position.unclaimedFees;
    if (!fees.usdValue || fees.usdValue <= 0) {
        await ctx.answerCbQuery('No fees to claim');
        return;
    }

    // Show confirmation
    const feeX = fees.xUi?.toFixed(4) || '0';
    const feeY = fees.yUi?.toFixed(2) || '0';
    const feeUsd = formatUsd(fees.usdValue);

    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `💰 **CLAIM FEES**\n\n` +
        `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n` +
        `**Pool:** ${position.tokenX.symbol}/${position.tokenY.symbol}\n\n` +
        `**Fees to Claim:**\n` +
        `• ${feeX} ${position.tokenX.symbol}\n` +
        `• ${feeY} ${position.tokenY.symbol}\n` +
        `• **Total:** ${feeUsd}\n\n` +
        `⚠️ This will send a transaction to claim your fees.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Confirm Claim', callback_data: `pos_claim_confirm_${shortAddr}` },
                        { text: '❌ Cancel', callback_data: `pos_detail_${shortAddr}` }
                    ]
                ]
            }
        }
    );
}

export async function handleClaimFeesConfirm(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found');
        return;
    }

    await ctx.answerCbQuery('Processing...');
    await ctx.editMessageText('🔄 **Claiming fees...**\n\nPlease wait...', { parse_mode: 'Markdown' });

    try {
        // Call fee service to claim with user's keypair
        const result = await claimFeesWithKeypair(
            position.poolAddress,
            position.publicKey,
            keypair
        );

        console.log(chalk.green(`✓ User ${telegramId} claimed fees for position ${shortAddr}`));

        await ctx.editMessageText(
            `✅ **FEES CLAIMED!**\n\n` +
            `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n\n` +
            `**Claimed:**\n` +
            `• ${result.claimedX.toFixed(4)} ${result.tokenXSymbol}\n` +
            `• ${result.claimedY.toFixed(2)} ${result.tokenYSymbol}\n` +
            `• **Total:** ${formatUsd(result.claimedUsd)}\n\n` +
            `🔗 **TX:** \`${result.signatures[0]?.slice(0, 20)}...\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ Back to Position', callback_data: `pos_detail_${shortAddr}` }],
                        [{ text: '📋 All Positions', callback_data: 'positions_list' }]
                    ]
                }
            }
        );

    } catch (error: any) {
        console.error('Error claiming fees:', error);
        await ctx.editMessageText(
            `❌ **Failed to claim fees**\n\n` +
            `Error: ${error.message || 'Unknown error'}\n\n` +
            `Please try again later.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Retry', callback_data: `pos_claim_${shortAddr}` }],
                        [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
    }
}

// ==================== CLAIM ALL FEES ====================

export async function handleClaimAllFees(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Get positions with fees
    const pagination = ctx.session.pagination;
    if (!pagination?.data) {
        await ctx.answerCbQuery('Please refresh positions first');
        return;
    }

    const positions = (pagination.data as UserPosition[]).filter(
        p => (p.unclaimedFees.usdValue || 0) > 0
    );

    if (positions.length === 0) {
        await ctx.answerCbQuery('No fees to claim');
        return;
    }

    // Calculate total fees
    const totalFees = positions.reduce((sum, p) => sum + (p.unclaimedFees.usdValue || 0), 0);

    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `💰 **CLAIM ALL FEES**\n\n` +
        `**Positions with fees:** ${positions.length}\n` +
        `**Total fees:** ${formatUsd(totalFees)}\n\n` +
        `⚠️ This will claim fees from all positions.\n` +
        `Multiple transactions may be required.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Claim All', callback_data: 'pos_claim_all_confirm' },
                        { text: '❌ Cancel', callback_data: 'positions_list' }
                    ]
                ]
            }
        }
    );
}

export async function handleClaimAllFeesConfirm(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    const pagination = ctx.session.pagination;
    if (!pagination?.data) {
        await ctx.answerCbQuery('Session expired');
        return;
    }

    const positions = (pagination.data as UserPosition[]).filter(
        p => (p.unclaimedFees.usdValue || 0) > 0
    );

    await ctx.answerCbQuery('Processing...');

    let message = '🔄 **Claiming fees...**\n\n';
    await ctx.editMessageText(message, { parse_mode: 'Markdown' });

    let successCount = 0;
    let failCount = 0;
    let totalClaimed = 0;

    for (const position of positions) {
        try {
            message += `Processing ${position.tokenX.symbol}/${position.tokenY.symbol}...\n`;
            await ctx.editMessageText(message, { parse_mode: 'Markdown' });

            const result = await claimFeesWithKeypair(
                position.poolAddress,
                position.publicKey,
                keypair
            );

            successCount++;
            totalClaimed += result.claimedUsd;
            message += `✅ Claimed ${formatUsd(result.claimedUsd)}\n`;

        } catch (error: any) {
            failCount++;
            message += `❌ Failed: ${error.message?.slice(0, 30) || 'Error'}\n`;
        }
    }

    console.log(chalk.green(`✓ User ${telegramId} claimed all fees: ${successCount} success, ${failCount} failed`));

    message += `\n**Summary:**\n`;
    message += `✅ Success: ${successCount}\n`;
    if (failCount > 0) message += `❌ Failed: ${failCount}\n`;
    message += `💰 Total Claimed: ${formatUsd(totalClaimed)}`;

    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📋 View Positions', callback_data: 'positions_refresh' }],
                [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
            ]
        }
    });
}

// ==================== REFRESH POSITIONS ====================

export async function handlePositionsRefresh(ctx: BotContext) {
    await ctx.answerCbQuery('Refreshing...');

    // Clear pagination cache
    ctx.session.pagination = undefined;

    // Delete current message and fetch fresh
    await ctx.deleteMessage().catch(() => { });
    await handlePositionsList(ctx);
}

// ==================== REBALANCE ANALYSIS ====================

export async function handleRebalancePosition(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position - first try session cache, then fetch fresh
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    // If not in session, fetch positions fresh (common when clicking from notifications)
    if (!position) {
        try {
            console.log(`[Rebalance] Position ${shortAddr} not in session, fetching fresh...`);
            const allPositions = await positionService.getAllPositions(
                keypair.publicKey.toBase58()
            );
            position = allPositions.find(p => p.publicKey.startsWith(shortAddr));

            // Cache for future use
            if (allPositions.length > 0) {
                ctx.session.pagination = {
                    type: 'positions',
                    data: allPositions,
                    page: 0,
                    currentPage: 0,
                    totalPages: Math.ceil(allPositions.length / POSITIONS_PER_PAGE),
                    itemsPerPage: POSITIONS_PER_PAGE,
                    listType: 'positions'
                };
            }
        } catch (fetchError: any) {
            console.error('[Rebalance] Failed to fetch positions:', fetchError.message);
        }
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found. Please refresh.');
        return;
    }

    await ctx.answerCbQuery('Analyzing...');
    await ctx.editMessageText('🔄 **Analyzing position...**\n\nPlease wait...', { parse_mode: 'Markdown' });

    try {
        const analysis = await getRebalanceAnalysis(
            position.poolAddress,
            position.publicKey,
            position
        );

        // Priority emoji mapping
        const priorityEmoji: Record<string, string> = {
            'CRITICAL': '🔴',
            'HIGH': '🟠',
            'MEDIUM': '🟡',
            'LOW': '🟢',
            'NONE': '✅'
        };

        const emoji = priorityEmoji[analysis.priority] || '❓';
        const rangeStatus = analysis.currentInRange ? '✅ IN RANGE' : '⚠️ OUT OF RANGE';

        // Helper to format price nicely
        const formatPrice = (price: number): string => {
            if (price >= 1000) return `$${price.toFixed(2)}`;
            if (price >= 1) return `$${price.toFixed(4)}`;
            return `$${price.toFixed(6)}`;
        };

        // Calculate range width percentage
        const rangeWidth = analysis.currentRange.minPrice && analysis.currentRange.maxPrice
            ? ((analysis.currentRange.maxPrice - analysis.currentRange.minPrice) / analysis.currentRange.minPrice * 100).toFixed(1)
            : 'N/A';

        // Build streamlined message
        let message = `♻️ **REBALANCE:** ${analysis.tokenXSymbol}/${analysis.tokenYSymbol}\n`;
        message += `Position: \`${shortenAddress(position.publicKey, 6)}\`\n\n`;

        // Status line - compact
        message += `━━━ **POSITION STATUS** ━━━\n`;
        message += `${rangeStatus} | ${analysis.distanceFromCenter} bins from center\n`;
        message += `Price: ${formatPrice(analysis.activePrice)} (Bin ${analysis.activeBinId})\n`;
        message += `Range: ${formatPrice(analysis.currentRange.minPrice)} → ${formatPrice(analysis.currentRange.maxPrice)} (${rangeWidth}%)\n\n`;

        // Economics - one line
        message += `━━━ **ECONOMICS** ━━━\n`;
        message += `Daily Fees: ${formatUsd(analysis.currentDailyFees)} | Rebalance Cost: ${formatUsd(analysis.rebalanceCostUsd)}\n\n`;

        // AI Recommendation - the main focus
        message += `━━━ **🤖 AI RECOMMENDATION** ━━━\n`;

        // Get the main recommendation
        let recommendationText = '';
        if (!analysis.currentInRange) {
            recommendationText = `🔴 **REBALANCE** - Position earning $0`;
        } else if (analysis.shouldRebalance) {
            recommendationText = `🟢 **REBALANCE** (${analysis.aiConfidence || 70}% confidence)`;
        } else {
            recommendationText = `🔵 **HOLD** (${analysis.aiConfidence || 70}% confidence)`;
        }
        message += `${recommendationText}\n\n`;

        // One-line reason (first AI reasoning or fallback)
        const mainReason = analysis.aiReasoning?.[0] || analysis.reason || 'Position is performing optimally.';
        // Clean up the reason - remove break-even mentions
        const cleanReason = mainReason.toLowerCase().includes('break-even')
            ? 'Consider rebalancing for better positioning.'
            : mainReason;
        message += `${cleanReason}\n`;

        // Strategy evaluation - NEW
        if (analysis.aiStrategyEvaluation) {
            const strat = analysis.aiStrategyEvaluation;
            const stratEmoji = strat.isOptimal ? '✅' : '⚠️';
            message += `\n📊 **Strategy Evaluation**\n`;
            message += `Current: **${strat.currentStrategy}** ${stratEmoji}\n`;
            if (!strat.isOptimal && strat.suggestedStrategy) {
                message += `Suggested: **${strat.suggestedStrategy}**\n`;
            }
            message += `${strat.reason}\n`;
        }

        // Risk Assessment - NEW
        if (analysis.aiRiskAssessment) {
            const risk = analysis.aiRiskAssessment;
            message += `\n📈 **Risk Assessment**\n`;
            
            if (risk.impermanentLoss) {
                message += `IL if +10%: ${risk.impermanentLoss.ifPriceUp10Percent.toFixed(2)}% | `;
                message += `IL if -10%: ${risk.impermanentLoss.ifPriceDown10Percent.toFixed(2)}%\n`;
            }
            
            const riskMetrics: string[] = [];
            if (typeof risk.supportDistance === 'number') {
                riskMetrics.push(`Support: ${risk.supportDistance.toFixed(1)}% below`);
            }
            if (typeof risk.resistanceDistance === 'number') {
                riskMetrics.push(`Resistance: ${risk.resistanceDistance.toFixed(1)}% above`);
            }
            if (riskMetrics.length > 0) {
                message += riskMetrics.join(' | ') + '\n';
            }
            
            if (typeof risk.rebalanceProbability7Days === 'number') {
                const probEmoji = risk.rebalanceProbability7Days > 70 ? '🔴' : 
                                  risk.rebalanceProbability7Days > 40 ? '🟡' : '🟢';
                message += `${probEmoji} Rebalance likelihood (7d): ${risk.rebalanceProbability7Days}%\n`;
            }
        }

        // Context: what the AI is monitoring
        const monitoringNotes: string[] = [];
        if (typeof analysis.distanceToEdge === 'number' && !Number.isNaN(analysis.distanceToEdge)) {
            monitoringNotes.push(`📏 Distance to edge: ${analysis.distanceToEdge} bins`);
        }
        if (analysis.aiMarketInsight) {
            monitoringNotes.push(`🌊 Market: ${analysis.aiMarketInsight}`);
        } else if (analysis.reason) {
            monitoringNotes.push(`🌊 Market: ${analysis.reason}`);
        }

        const feeDelta = analysis.netDailyGain ?? (analysis.projectedDailyFees - analysis.currentDailyFees);
        const feeDeltaStr = feeDelta >= 0
            ? `+${formatUsd(feeDelta)}`
            : formatUsd(feeDelta);
        monitoringNotes.push(`💸 Fees: ${formatUsd(analysis.currentDailyFees)} → ${formatUsd(analysis.projectedDailyFees)} (${feeDeltaStr}/day)`);

        if (monitoringNotes.length > 0) {
            message += `\n🧠 **What it's watching**\n`;
            message += monitoringNotes.map(note => `• ${note}`).join('\n') + '\n';
        }

        // Watch/Risk items - always surface when provided
        if (analysis.aiRisks && analysis.aiRisks.length > 0) {
            message += `\n⚠️ **Risks / Watchlist**\n`;
            message += analysis.aiRisks.slice(0, 3).map(risk => `• ${risk}`).join('\n') + '\n';
        }

        // Suggested range only if rebalance is recommended
        if ((analysis.shouldRebalance || !analysis.currentInRange) && analysis.suggestedRange) {
            const totalBins = analysis.suggestedRange.maxBin - analysis.suggestedRange.minBin;
            const binsPerSide = Math.floor(totalBins / 2);
            const suggestedWidth = analysis.suggestedRange.maxPrice && analysis.suggestedRange.minPrice
                ? ((analysis.suggestedRange.maxPrice - analysis.suggestedRange.minPrice) / analysis.suggestedRange.minPrice * 100).toFixed(1)
                : 'N/A';

            message += `\n━━━ **🎯 SUGGESTED RANGE** ━━━\n`;
            message += `${formatPrice(analysis.suggestedRange.minPrice)} → ${formatPrice(analysis.suggestedRange.maxPrice)}\n`;
            message += `Width: ${suggestedWidth}% (${totalBins} bins, ${binsPerSide}/side)\n`;
        }

        // Build action buttons
        const buttons: any[][] = [];

        if (analysis.shouldRebalance || !analysis.currentInRange) {
            buttons.push([{ text: '🚀 Execute Rebalance', callback_data: `pos_rebal_exec_${shortAddr}` }]);
        }

        buttons.push([
            { text: '🔄 Refresh', callback_data: `pos_rebalance_${shortAddr}` }
        ]);
        buttons.push([{ text: '⬅️ Back to Position', callback_data: `pos_detail_${shortAddr}` }]);

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });

    } catch (error: any) {
        console.error('Error getting rebalance analysis:', error);
        await ctx.editMessageText(
            `❌ **Analysis Failed**\n\n` +
            `Error: ${error.message || 'Unknown error'}\n\n` +
            `Please try again later.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Retry', callback_data: `pos_rebalance_${shortAddr}` }],
                        [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
    }
}

// ==================== EXECUTE REBALANCE ====================

export async function handleExecuteRebalance(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position - first try session cache, then fetch fresh
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    // If not in session, fetch positions fresh
    if (!position) {
        try {
            const allPositions = await positionService.getAllPositions(
                keypair.publicKey.toBase58()
            );
            position = allPositions.find(p => p.publicKey.startsWith(shortAddr));

            if (allPositions.length > 0) {
                ctx.session.pagination = {
                    type: 'positions',
                    data: allPositions,
                    page: 0,
                    currentPage: 0,
                    totalPages: Math.ceil(allPositions.length / POSITIONS_PER_PAGE),
                    itemsPerPage: POSITIONS_PER_PAGE,
                    listType: 'positions'
                };
            }
        } catch (fetchError: any) {
            console.error('[ExecuteRebalance] Failed to fetch positions:', fetchError.message);
        }
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found');
        return;
    }

    // Get rebalance analysis to show recommended range
    await ctx.answerCbQuery('Loading...');

    try {
        const analysis = await getRebalanceAnalysis(
            position.poolAddress,
            position.publicKey,
            position,
            false // Skip AI for speed
        );

        // Store suggested range in session for confirmation step
        ctx.session.flowData = {
            positionAddress: position.publicKey,
            newMinBinId: analysis.suggestedRange?.minBin,
            newMaxBinId: analysis.suggestedRange?.maxBin,
        };

        const rangeInfo = analysis.suggestedRange
            ? `\n**Recommended New Range:**\n` +
            `📊 Bins: ${analysis.suggestedRange.minBin} → ${analysis.suggestedRange.maxBin}\n` +
            `🎯 Center: ${analysis.suggestedRange.centerBin}\n` +
            (analysis.suggestedRange.minPrice && analysis.suggestedRange.maxPrice
                ? `💲 Price: ${analysis.suggestedRange.minPrice.toFixed(6)} - ${analysis.suggestedRange.maxPrice.toFixed(6)}\n`
                : '')
            : '';

        await ctx.editMessageText(
            `🚀 **EXECUTE REBALANCE**\n\n` +
            `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n` +
            `**Pool:** ${position.tokenX.symbol}/${position.tokenY.symbol}\n` +
            `**Current Range:** ${position.lowerBinId} → ${position.upperBinId}\n` +
            rangeInfo +
            `\n⚠️ **This will:**\n` +
            `1. Remove all liquidity from current position\n` +
            `2. Close the current position\n` +
            `3. Create a new position in the recommended range\n\n` +
            `💡 The new position will automatically use the recommended range.\n\n` +
            `Continue?`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Confirm Rebalance', callback_data: `pos_rebal_confirm_${shortAddr}` },
                            { text: '❌ Cancel', callback_data: `pos_rebalance_${shortAddr}` }
                        ]
                    ]
                }
            }
        );
    } catch (error: any) {
        await ctx.editMessageText(
            `❌ Failed to get rebalance recommendation: ${error.message}`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
    }
}

export async function handleExecuteRebalanceConfirm(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found');
        return;
    }

    // Get stored range from session or use default
    const flowData = ctx.session.flowData;
    const suggestedMinBin = flowData?.newMinBinId;
    const suggestedMaxBin = flowData?.newMaxBinId;
    const customBinsPerSide = (flowData as any)?.customBinsPerSide;

    // Calculate bins per side from suggested range, custom override, or use intelligent defaults
    let binsPerSide: number;
    if (customBinsPerSide !== undefined) {
        // Use custom bins (set when user opts for smaller range due to low SOL)
        binsPerSide = customBinsPerSide;
    } else if (suggestedMinBin !== undefined && suggestedMaxBin !== undefined) {
        const totalBins = suggestedMaxBin - suggestedMinBin;
        binsPerSide = Math.floor(totalBins / 2);
    } else {
        // Intelligent default based on pair type
        const poolInfo = await poolService.getPoolInfo(position.poolAddress).catch(() => null);
        const tokenXSymbol = poolInfo?.tokenX.symbol ?? '';
        const tokenYSymbol = poolInfo?.tokenY.symbol ?? '';

        const stableSymbols = ['USDC', 'USDT', 'DAI', 'PYUSD'];
        const memeTokens = ['BONK', 'WIF', 'POPCAT', 'BOME', 'MEW', 'MYRO', 'SLERF', 'TRUMP'];
        const isStablePair = stableSymbols.includes(tokenXSymbol) && stableSymbols.includes(tokenYSymbol);
        const isMemeToken = memeTokens.includes(tokenXSymbol) || memeTokens.includes(tokenYSymbol);
        const hasStable = stableSymbols.includes(tokenXSymbol) || stableSymbols.includes(tokenYSymbol);

        // Max 34 bins per side (69 total) due to Meteora DLMM single-transaction limit
        if (isStablePair) {
            binsPerSide = 20; // Stablecoins - tight range is fine
        } else if (isMemeToken) {
            binsPerSide = 34; // Meme tokens - use max allowed (69 total)
        } else if (hasStable) {
            binsPerSide = 34; // Major pairs like SOL/USDC - use max allowed
        } else {
            binsPerSide = 25; // Crypto/crypto pairs
        }
    }

    // Pre-flight SOL balance check for rent
    const { LAMPORTS_PER_SOL } = await import('@solana/web3.js');
    const connection = connectionService.getConnection();
    const walletBalance = await connection.getBalance(keypair.publicKey);
    const walletSol = walletBalance / LAMPORTS_PER_SOL;

    const totalBins = binsPerSide * 2;
    const estimatedRentPerBin = 0.00089;
    const basePositionRent = 0.003;
    const estimatedRentNeeded = basePositionRent + (totalBins * estimatedRentPerBin) + 0.01;

    if (walletSol < estimatedRentNeeded) {
        // Not enough SOL - suggest smaller range
        const maxAffordableBins = Math.floor((walletSol - basePositionRent - 0.01) / estimatedRentPerBin);
        const suggestedBins = Math.max(20, Math.floor(maxAffordableBins / 2)); // bins per side

        await ctx.answerCbQuery('⚠️ Low SOL balance');
        await ctx.editMessageText(
            `⚠️ **Insufficient SOL for Rent**\n\n` +
            `Creating a **${totalBins}-bin** position requires ~**${estimatedRentNeeded.toFixed(4)} SOL** for rent.\n` +
            `Your wallet only has **${walletSol.toFixed(4)} SOL**.\n\n` +
            `💡 **Options:**\n` +
            `• Add **${(estimatedRentNeeded - walletSol).toFixed(4)} SOL** to your wallet\n` +
            `• Use a smaller range: **${suggestedBins * 2} bins** needs ~${(basePositionRent + suggestedBins * 2 * estimatedRentPerBin + 0.01).toFixed(4)} SOL\n\n` +
            `Would you like to proceed with a smaller range?`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: `✅ Use ${suggestedBins * 2} bins instead`, callback_data: `pos_rebal_bins_${shortAddr}_${suggestedBins}` }],
                        [{ text: '❌ Cancel', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
        return;
    }
    await ctx.answerCbQuery('Processing...');
    await ctx.editMessageText(
        `🔄 **Executing rebalance...**\n\n` +
        `Target: ${binsPerSide} bins per side\n\n` +
        `Please wait...`,
        { parse_mode: 'Markdown' }
    );

    try {
        const result = await executeRebalanceWithKeypair(
            position.poolAddress,
            position.publicKey,
            keypair,
            binsPerSide
        );

        // Clear flow data
        ctx.session.flowData = undefined;

        console.log(chalk.green(`✓ User ${telegramId} executed rebalance for position ${shortAddr}`));

        await ctx.editMessageText(
            `✅ **REBALANCE COMPLETE!**\n\n` +
            `**Old Position:** \`${shortenAddress(result.oldPositionAddress, 6)}\`\n\n` +
            `**Withdrawn:**\n` +
            `• ${result.withdrawnX.toFixed(4)} ${result.tokenXSymbol}\n` +
            `• ${result.withdrawnY.toFixed(2)} ${result.tokenYSymbol}\n` +
            `• Value: ${formatUsd(result.withdrawnUsd)}\n\n` +
            `**New Range:**\n` +
            `• Bins: ${result.newRangeMin} → ${result.newRangeMax}\n` +
            `• Center: ${Math.floor((result.newRangeMin + result.newRangeMax) / 2)}\n\n` +
            `💡 Your liquidity has been repositioned to the optimal range.\n\n` +
            `🔗 **TX:** \`${result.transactions[0]?.slice(0, 20)}...\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📋 View Positions', callback_data: 'positions_refresh' }],
                        [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                    ]
                }
            }
        );

    } catch (error: any) {
        console.error('Error executing rebalance:', error);

        // Clear flow data on error too
        ctx.session.flowData = undefined;

        await ctx.editMessageText(
            `❌ **Rebalance Failed**\n\n` +
            `Error: ${error.message || 'Unknown error'}\n\n` +
            `Please try again later.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Retry', callback_data: `pos_rebal_exec_${shortAddr}` }],
                        [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
    }
}

export async function handleCompoundPosition(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found. Please refresh.');
        return;
    }

    const fees = position.unclaimedFees;
    if (!fees.usdValue || fees.usdValue <= 0) {
        await ctx.answerCbQuery('No fees to compound');
        return;
    }

    await ctx.answerCbQuery();

    // Show compound options menu
    const feeX = fees.xUi?.toFixed(4) || '0';
    const feeY = fees.yUi?.toFixed(2) || '0';
    const feeUsd = formatUsd(fees.usdValue);

    await ctx.editMessageText(
        `🔄 **CLAIM & COMPOUND FEES**\n\n` +
        `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n` +
        `**Pool:** ${position.tokenX.symbol}/${position.tokenY.symbol}\n\n` +
        `**Available Fees:**\n` +
        `• ${feeX} ${position.tokenX.symbol}\n` +
        `• ${feeY} ${position.tokenY.symbol}\n` +
        `• **Total:** ${feeUsd}\n\n` +
        `Choose an option:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💰 Claim Only (No Compound)', callback_data: `pos_compound_exec_0_${shortAddr}` }],
                    [{ text: '🔄 Compound 100%', callback_data: `pos_compound_exec_100_${shortAddr}` }],
                    [
                        { text: '50%', callback_data: `pos_compound_exec_50_${shortAddr}` },
                        { text: '75%', callback_data: `pos_compound_exec_75_${shortAddr}` }
                    ],
                    [{ text: '⬅️ Cancel', callback_data: `pos_detail_${shortAddr}` }]
                ]
            }
        }
    );
}

// ==================== EXECUTE COMPOUND ====================

export async function handleCompoundExecute(ctx: BotContext, ratio: number, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found');
        return;
    }

    await ctx.answerCbQuery('Processing...');

    const action = ratio === 0 ? 'Claiming fees' : `Compounding ${ratio}%`;
    await ctx.editMessageText(`🔄 **${action}...**\n\nPlease wait...`, { parse_mode: 'Markdown' });

    try {
        const result = await compoundFeesWithKeypair(
            position.poolAddress,
            position.publicKey,
            keypair,
            ratio
        );

        console.log(chalk.green(`✓ User ${telegramId} compounded ${ratio}% for position ${shortAddr}`));

        let successMsg = '';
        if (ratio === 0) {
            successMsg = `✅ **FEES CLAIMED!**\n\n` +
                `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n\n` +
                `**Claimed:**\n` +
                `• ${result.claimedX.toFixed(4)} ${result.tokenXSymbol}\n` +
                `• ${result.claimedY.toFixed(2)} ${result.tokenYSymbol}\n` +
                `• **Total:** ${formatUsd(result.claimedUsd)}`;
        } else {
            successMsg = `✅ **COMPOUND COMPLETE!**\n\n` +
                `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n\n` +
                `**Claimed:**\n` +
                `• ${result.claimedX.toFixed(4)} ${result.tokenXSymbol}\n` +
                `• ${result.claimedY.toFixed(2)} ${result.tokenYSymbol}\n` +
                `• Total: ${formatUsd(result.claimedUsd)}\n\n` +
                `**Compounded (${ratio}%):**\n` +
                `• ${result.compoundedX.toFixed(4)} ${result.tokenXSymbol}\n` +
                `• ${result.compoundedY.toFixed(2)} ${result.tokenYSymbol}\n` +
                `• Value: ${formatUsd(result.compoundedUsd)}`;
        }

        successMsg += `\n\n🔗 **TX:** \`${result.signatures[0]?.slice(0, 20)}...\``;

        await ctx.editMessageText(successMsg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ Back to Position', callback_data: `pos_detail_${shortAddr}` }],
                    [{ text: '📋 All Positions', callback_data: 'positions_list' }]
                ]
            }
        });

    } catch (error: any) {
        console.error('Error compounding:', error);
        await ctx.editMessageText(
            `❌ **Failed to ${ratio === 0 ? 'claim fees' : 'compound'}**\n\n` +
            `Error: ${error.message || 'Unknown error'}\n\n` +
            `Please try again later.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Retry', callback_data: `pos_compound_${shortAddr}` }],
                        [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
    }
}

export async function handleAddLiquidity(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position from pagination data
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found. Please refresh.');
        return;
    }

    await ctx.answerCbQuery();

    // Get current position info
    const currentValueX = position.tokenX.uiAmount?.toFixed(6) || '0';
    const currentValueY = position.tokenY.uiAmount?.toFixed(4) || '0';
    const totalValue = position.totalValueUSD ? formatUsd(position.totalValueUSD) : 'N/A';

    // Store position data for the flow
    ctx.session.flowData = {
        positionAddress: position.publicKey,
        poolAddress: position.poolAddress,
        tokenXSymbol: position.tokenX.symbol,
        tokenYSymbol: position.tokenY.symbol,
        tokenXDecimals: position.tokenX.decimals,
        tokenYDecimals: position.tokenY.decimals,
    };
    ctx.session.currentFlow = 'add_liquidity';

    await ctx.editMessageText(
        `➕ **ADD LIQUIDITY**\n\n` +
        `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n` +
        `**Pool:** ${position.tokenX.symbol}/${position.tokenY.symbol}\n` +
        `**Current Value:** ${totalValue}\n\n` +
        `**Current Amounts:**\n` +
        `• ${currentValueX} ${position.tokenX.symbol}\n` +
        `• ${currentValueY} ${position.tokenY.symbol}\n\n` +
        `**Range:** Bin ${position.lowerBinId} → ${position.upperBinId}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Select how you want to add liquidity:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💰 Enter Token Amounts', callback_data: `pos_addliq_amounts_${shortAddr}` }],
                    [{ text: '📊 Enter USD Value', callback_data: `pos_addliq_usd_${shortAddr}` }],
                    [{ text: '⬅️ Cancel', callback_data: `pos_detail_${shortAddr}` }]
                ]
            }
        }
    );
}

export async function handleAddLiquidityAmounts(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    await ctx.answerCbQuery();

    const flowData = ctx.session.flowData;
    if (!flowData?.tokenXSymbol) {
        await ctx.reply('Session expired. Please start over.');
        return;
    }

    ctx.session.currentFlow = 'add_liquidity_amounts';

    await ctx.editMessageText(
        `➕ **ADD LIQUIDITY - Enter Amounts**\n\n` +
        `**Pool:** ${flowData.tokenXSymbol}/${flowData.tokenYSymbol}\n\n` +
        `Please enter the amounts you want to add:\n\n` +
        `Reply in this format:\n` +
        `\`<${flowData.tokenXSymbol} amount> <${flowData.tokenYSymbol} amount>\`\n\n` +
        `Example: \`0.5 100\`\n\n` +
        `💡 You can enter 0 for one token if you only want to add one side.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ Back', callback_data: `pos_addliq_${shortAddr}` }],
                    [{ text: '❌ Cancel', callback_data: `pos_detail_${shortAddr}` }]
                ]
            }
        }
    );
}

export async function handleAddLiquidityUsd(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    await ctx.answerCbQuery();

    const flowData = ctx.session.flowData;
    if (!flowData?.tokenXSymbol) {
        await ctx.reply('Session expired. Please start over.');
        return;
    }

    ctx.session.currentFlow = 'add_liquidity_usd';

    await ctx.editMessageText(
        `➕ **ADD LIQUIDITY - Enter USD Value**\n\n` +
        `**Pool:** ${flowData.tokenXSymbol}/${flowData.tokenYSymbol}\n\n` +
        `Please enter the total USD value you want to add:\n\n` +
        `Reply with a number (e.g., \`100\` for $100)\n\n` +
        `💡 The system will calculate optimal token split based on current pool ratio.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ Back', callback_data: `pos_addliq_${shortAddr}` }],
                    [{ text: '❌ Cancel', callback_data: `pos_detail_${shortAddr}` }]
                ]
            }
        }
    );
}

export async function processAddLiquidityInput(ctx: BotContext, input: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const flowData = ctx.session.flowData;
    if (!flowData?.positionAddress) {
        await ctx.reply('Session expired. Please start over.');
        return;
    }

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.reply('No wallet connected. Please connect a wallet first.');
        return;
    }

    const currentFlow = ctx.session.currentFlow;
    let amountX = 0;
    let amountY = 0;

    try {
        if (currentFlow === 'add_liquidity_amounts') {
            // Parse "amountX amountY" format
            const parts = input.trim().split(/\s+/);
            if (parts.length !== 2) {
                await ctx.reply(
                    `❌ Invalid format. Please enter two numbers separated by space.\n\n` +
                    `Example: \`0.5 100\``,
                    { parse_mode: 'Markdown' }
                );
                return;
            }
            amountX = parseFloat(parts[0]);
            amountY = parseFloat(parts[1]);
        } else if (currentFlow === 'add_liquidity_usd') {
            // Parse USD value and calculate split
            const usdValue = parseFloat(input.trim());
            if (isNaN(usdValue) || usdValue <= 0) {
                await ctx.reply('❌ Invalid USD amount. Please enter a positive number.');
                return;
            }

            // Get current prices to calculate split (50/50 by default)
            const { oracleService } = await import('../../services/oracle.service');
            const solMint = 'So11111111111111111111111111111111111111112';
            const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
            const priceX = await oracleService.getUsdPrice(flowData.tokenXSymbol === 'SOL' ? solMint : solMint) || 0;
            const priceY = await oracleService.getUsdPrice(flowData.tokenYSymbol === 'USDC' ? usdcMint : usdcMint) || 1;

            // Simple 50/50 split calculation
            const halfUsd = usdValue / 2;
            amountX = priceX > 0 ? halfUsd / priceX : 0;
            amountY = priceY > 0 ? halfUsd / priceY : halfUsd;
        }

        if ((isNaN(amountX) && isNaN(amountY)) || (amountX <= 0 && amountY <= 0)) {
            await ctx.reply('❌ Please enter at least one positive amount.');
            return;
        }

        // Store amounts
        flowData.addLiqAmountX = amountX;
        flowData.addLiqAmountY = amountY;

        const shortAddr = flowData.positionAddress.slice(0, 8);

        // Check wallet balances
        const connection = connectionService.getConnection();
        let tokenXBalance = 0;
        let tokenYBalance = 0;

        // Check X balance (SOL or token)
        if (flowData.tokenXSymbol === 'SOL') {
            tokenXBalance = await connection.getBalance(keypair.publicKey) / 1e9;
            // Reserve some SOL for fees
            tokenXBalance = Math.max(0, tokenXBalance - 0.01);
        } else {
            try {
                const { getAssociatedTokenAddress } = await import('@solana/spl-token');
                const { PublicKey } = await import('@solana/web3.js');
                // For non-SOL tokens, we need to get the mint address
                const pool = await poolService.searchPoolByAddress(flowData.poolAddress!);
                if (pool) {
                    const tokenXMint = new PublicKey(pool.tokenX.mint);
                    const tokenXAta = await getAssociatedTokenAddress(tokenXMint, keypair.publicKey);
                    const tokenXAccount = await connection.getTokenAccountBalance(tokenXAta);
                    tokenXBalance = parseFloat(tokenXAccount.value.uiAmountString || '0');
                }
            } catch (e) {
                tokenXBalance = 0;
            }
        }

        // Check Y balance (USDC or token)
        if (flowData.tokenYSymbol === 'USDC') {
            try {
                const { getAssociatedTokenAddress } = await import('@solana/spl-token');
                const { PublicKey } = await import('@solana/web3.js');
                const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
                const usdcAta = await getAssociatedTokenAddress(usdcMint, keypair.publicKey);
                const usdcAccount = await connection.getTokenAccountBalance(usdcAta);
                tokenYBalance = parseFloat(usdcAccount.value.uiAmountString || '0');
            } catch (e) {
                tokenYBalance = 0;
            }
        } else {
            try {
                const { getAssociatedTokenAddress } = await import('@solana/spl-token');
                const { PublicKey } = await import('@solana/web3.js');
                const pool = await poolService.searchPoolByAddress(flowData.poolAddress!);
                if (pool) {
                    const tokenYMint = new PublicKey(pool.tokenY.mint);
                    const tokenYAta = await getAssociatedTokenAddress(tokenYMint, keypair.publicKey);
                    const tokenYAccount = await connection.getTokenAccountBalance(tokenYAta);
                    tokenYBalance = parseFloat(tokenYAccount.value.uiAmountString || '0');
                }
            } catch (e) {
                tokenYBalance = 0;
            }
        }

        const hasEnoughX = tokenXBalance >= amountX;
        const hasEnoughY = tokenYBalance >= amountY;

        // Calculate shortfalls
        const xShortfall = Math.max(0, amountX - tokenXBalance);
        const yShortfall = Math.max(0, amountY - tokenYBalance);

        // Determine if autoswap is possible
        // Can auto-swap X to Y (e.g., SOL to USDC) if we have excess X and need Y
        const canAutoSwapXtoY = !hasEnoughY && hasEnoughX && yShortfall > 0;
        // Can auto-swap Y to X (e.g., USDC to SOL) if we have excess Y and need X
        const canAutoSwapYtoX = !hasEnoughX && hasEnoughY && xShortfall > 0;

        // Build result message
        let resultMessage = `📋 **ADD LIQUIDITY - BALANCE CHECK**\n\n` +
            `**Position:** \`${shortenAddress(flowData.positionAddress, 6)}\`\n` +
            `**Pool:** ${flowData.tokenXSymbol}/${flowData.tokenYSymbol}\n\n` +
            `**You Want to Add:**\n` +
            `• ${amountX.toFixed(6)} ${flowData.tokenXSymbol}\n` +
            `• ${amountY.toFixed(4)} ${flowData.tokenYSymbol}\n\n` +
            `**Your Wallet Balance:**\n` +
            `• ${tokenXBalance.toFixed(6)} ${flowData.tokenXSymbol} ${hasEnoughX ? '✅' : '⚠️'}\n` +
            `• ${tokenYBalance.toFixed(4)} ${flowData.tokenYSymbol} ${hasEnoughY ? '✅' : '⚠️'}\n`;

        const buttons: any[] = [];

        if (!hasEnoughX && !hasEnoughY) {
            resultMessage += `\n❌ **Insufficient funds for both tokens!**`;
            buttons.push([{ text: '🔄 Try Different Amount', callback_data: `pos_addliq_amounts_${shortAddr}` }]);
        } else if (canAutoSwapXtoY) {
            // Can swap X (SOL) to get Y (USDC)
            resultMessage += `\n⚠️ **Insufficient ${flowData.tokenYSymbol}!**\n` +
                `Shortfall: ${yShortfall.toFixed(4)} ${flowData.tokenYSymbol}\n\n` +
                `🔄 **Auto-Swap Available!**\n` +
                `We can swap some ${flowData.tokenXSymbol} to get the needed ${flowData.tokenYSymbol}.`;

            // Store autoswap info
            flowData.autoSwapNeeded = true;
            flowData.autoSwapDirection = 'X_to_Y';
            flowData.swapShortfall = yShortfall;

            buttons.push([{ text: `🔄 Auto-Swap & Add Liquidity`, callback_data: `pos_addliq_autoswap_${shortAddr}` }]);
            buttons.push([{ text: '🔄 Try Different Amount', callback_data: `pos_addliq_amounts_${shortAddr}` }]);
        } else if (canAutoSwapYtoX) {
            // Can swap Y (USDC) to get X (SOL)
            resultMessage += `\n⚠️ **Insufficient ${flowData.tokenXSymbol}!**\n` +
                `Shortfall: ${xShortfall.toFixed(6)} ${flowData.tokenXSymbol}\n\n` +
                `🔄 **Auto-Swap Available!**\n` +
                `We can swap some ${flowData.tokenYSymbol} to get the needed ${flowData.tokenXSymbol}.`;

            // Store autoswap info
            flowData.autoSwapNeeded = true;
            flowData.autoSwapDirection = 'Y_to_X';
            flowData.swapShortfall = xShortfall;

            buttons.push([{ text: `🔄 Auto-Swap & Add Liquidity`, callback_data: `pos_addliq_autoswap_${shortAddr}` }]);
            buttons.push([{ text: '🔄 Try Different Amount', callback_data: `pos_addliq_amounts_${shortAddr}` }]);
        } else if (!hasEnoughX) {
            resultMessage += `\n⚠️ **Insufficient ${flowData.tokenXSymbol}!**`;
            buttons.push([{ text: '🔄 Try Different Amount', callback_data: `pos_addliq_amounts_${shortAddr}` }]);
        } else if (!hasEnoughY) {
            resultMessage += `\n⚠️ **Insufficient ${flowData.tokenYSymbol}!**`;
            buttons.push([{ text: '🔄 Try Different Amount', callback_data: `pos_addliq_amounts_${shortAddr}` }]);
        } else {
            // All good, can proceed directly
            resultMessage += `\n✅ **Sufficient balance!**\n\n⚠️ Transaction fees will apply.`;
            buttons.push([{ text: '✅ Confirm & Add', callback_data: `pos_addliq_exec_${shortAddr}` }]);
        }

        buttons.push([{ text: '⬅️ Back', callback_data: `pos_addliq_${shortAddr}` }]);
        buttons.push([{ text: '❌ Cancel', callback_data: `pos_detail_${shortAddr}` }]);

        await ctx.reply(resultMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: buttons
            }
        });

    } catch (error: any) {
        console.error('Error processing add liquidity input:', error);
        await ctx.reply(`❌ Error: ${error.message || 'Unknown error'}`);
    }
}

export async function handleExecuteAddLiquidity(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    const flowData = ctx.session.flowData;
    if (!flowData?.positionAddress || flowData.addLiqAmountX === undefined) {
        await ctx.answerCbQuery('Session expired');
        return;
    }

    await ctx.answerCbQuery('Adding liquidity...');

    await ctx.editMessageText(
        '🔄 **Adding liquidity...**\n\n' +
        'Please wait while we add liquidity to your position.\n' +
        'This may take 30-60 seconds.',
        { parse_mode: 'Markdown' }
    );

    try {
        const { StrategyType } = await import('@meteora-ag/dlmm');
        const { sendAndConfirmTransaction, PublicKey } = await import('@solana/web3.js');
        const { BN } = await import('@coral-xyz/anchor');
        const { connectionService } = await import('../../services/connection.service');
        const { poolService } = await import('../../services/pool.service');

        const connection = connectionService.getConnection();
        const dlmm = await poolService.getDlmmInstance(flowData.poolAddress!);

        // Get position to find bin range
        const positionPubKey = new PublicKey(flowData.positionAddress!);
        const position = await dlmm.getPosition(positionPubKey);

        const minBinId = position.positionData.lowerBinId;
        const maxBinId = position.positionData.upperBinId;

        // Convert amounts to BN (use 0 defaults if undefined)
        const tokenXDecimals = flowData.tokenXDecimals || 9;
        const tokenYDecimals = flowData.tokenYDecimals || 6;
        const addAmountX = flowData.addLiqAmountX || 0;
        const addAmountY = flowData.addLiqAmountY || 0;

        const amountX = new BN(Math.floor(addAmountX * (10 ** tokenXDecimals)));
        const amountY = new BN(Math.floor(addAmountY * (10 ** tokenYDecimals)));

        // Create transaction
        const tx = await dlmm.addLiquidityByStrategy({
            positionPubKey,
            user: keypair.publicKey,
            totalXAmount: amountX,
            totalYAmount: amountY,
            strategy: {
                maxBinId,
                minBinId,
                strategyType: StrategyType.Spot // Use same distribution as position
            },
            slippage: 100 // 1%
        });

        const signature = await sendAndConfirmTransaction(
            connection,
            tx,
            [keypair],
            { commitment: 'confirmed' }
        );

        // Clear flow data
        ctx.session.flowData = undefined;
        ctx.session.currentFlow = 'idle';

        console.log(chalk.green(`✓ User ${telegramId} added liquidity to ${shortAddr}, tx: ${signature}`));

        await ctx.editMessageText(
            `✅ **LIQUIDITY ADDED!**\n\n` +
            `**Position:** \`${shortenAddress(flowData.positionAddress || '', 6)}\`\n\n` +
            `**Added:**\n` +
            `• ${(flowData.addLiqAmountX || 0).toFixed(6)} ${flowData.tokenXSymbol || ''}\n` +
            `• ${(flowData.addLiqAmountY || 0).toFixed(4)} ${flowData.tokenYSymbol || ''}\n\n` +
            `🔗 **TX:** \`${signature.slice(0, 20)}...\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📋 View Position', callback_data: `pos_detail_${shortAddr}` }],
                        [{ text: '📋 All Positions', callback_data: 'positions_list' }],
                        [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                    ]
                }
            }
        );

    } catch (error: any) {
        console.error('Error adding liquidity:', error);

        await ctx.editMessageText(
            `❌ **Failed to add liquidity**\n\n` +
            `Error: ${error.message || 'Unknown error'}\n\n` +
            `Please check your wallet balance and try again.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: `pos_addliq_${shortAddr}` }],
                        [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
    }
}

// Handler for auto-swap and add liquidity - get quote
export async function handleAutoSwapAndAddLiquidity(ctx: BotContext, shortAddr: string) {
    await ctx.answerCbQuery('Preparing auto-swap...');

    const flowData = ctx.session.flowData;
    if (!flowData?.positionAddress || !flowData.poolAddress || !flowData.swapShortfall) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }

    const telegramId = ctx.from!.id;
    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.editMessageText('No wallet connected.');
        return;
    }

    try {
        // Get pool info for pricing
        const pool = await poolService.searchPoolByAddress(flowData.poolAddress);
        if (!pool) {
            await ctx.editMessageText('Pool not found. Please try again.');
            return;
        }

        const direction = flowData.autoSwapDirection || 'X_to_Y';
        const shortfall = flowData.swapShortfall;
        const price = pool.price || 1;

        await ctx.editMessageText(
            `🔄 **AUTO-SWAP PREPARATION**\n\n` +
            `Getting swap quote...\n` +
            `Please wait...`,
            { parse_mode: 'Markdown' }
        );

        let swapAmount: BN;
        let expectedOutput: number;
        let swapDescription: string;

        if (direction === 'X_to_Y') {
            // Swap X (e.g., SOL) to get Y (e.g., USDC)
            // shortfall is in Y units, need to calculate X amount to swap
            const xToSwap = (shortfall / price) * 1.02; // Add 2% buffer for slippage
            const xDecimals = flowData.tokenXDecimals || 9;
            swapAmount = new BN(Math.floor(xToSwap * (10 ** xDecimals)));
            expectedOutput = shortfall;
            swapDescription = `~${xToSwap.toFixed(6)} ${flowData.tokenXSymbol} → ~${shortfall.toFixed(4)} ${flowData.tokenYSymbol}`;
            flowData.solToSwap = xToSwap;
        } else {
            // Swap Y (e.g., USDC) to get X (e.g., SOL)
            // shortfall is in X units, need to calculate Y amount to swap
            const yToSwap = shortfall * price * 1.02; // Add 2% buffer for slippage
            const yDecimals = flowData.tokenYDecimals || 6;
            swapAmount = new BN(Math.floor(yToSwap * (10 ** yDecimals)));
            expectedOutput = shortfall;
            swapDescription = `~${yToSwap.toFixed(4)} ${flowData.tokenYSymbol} → ~${shortfall.toFixed(6)} ${flowData.tokenXSymbol}`;
            flowData.solToSwap = yToSwap;
        }

        // Get swap quote
        const quote = await swapService.getSwapQuote(
            flowData.poolAddress,
            swapAmount,
            direction === 'X_to_Y', // swapForY
            1 // 1% slippage
        );

        const outDecimals = direction === 'X_to_Y' ? (flowData.tokenYDecimals || 6) : (flowData.tokenXDecimals || 9);
        const actualOutput = Number(quote.outAmount) / (10 ** outDecimals);
        const priceImpact = quote.priceImpact * 100;

        // Store quote for execution
        flowData.swapQuote = quote;

        const message = `
🔄 **AUTO-SWAP CONFIRMATION**

**Swap:**
• ${swapDescription}
• Expected Output: ~${actualOutput.toFixed(6)}
• Price Impact: ${priceImpact.toFixed(2)}%

**Then Add Liquidity:**
• ${flowData.addLiqAmountX?.toFixed(6) || '0'} ${flowData.tokenXSymbol}
• ${flowData.addLiqAmountY?.toFixed(4) || '0'} ${flowData.tokenYSymbol}

⚠️ This will execute TWO transactions:
1. Swap tokens
2. Add liquidity to position
`.trim();

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Execute Swap & Add Liquidity', callback_data: `pos_addliq_autoswap_exec_${shortAddr}` }],
                    [{ text: '⬅️ Back', callback_data: `pos_addliq_amounts_${shortAddr}` }],
                    [{ text: '❌ Cancel', callback_data: `pos_detail_${shortAddr}` }]
                ]
            }
        });

    } catch (error: any) {
        console.error('Error getting swap quote for add liquidity:', error);
        await ctx.editMessageText(
            `❌ **Auto-swap failed**\n\nError: ${error.message}\n\nPlease try manual amounts or different values.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✏️ Try Different Amounts', callback_data: `pos_addliq_amounts_${shortAddr}` }],
                        [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
    }
}

// Execute auto-swap and then add liquidity
export async function handleAutoSwapAddLiquidityExecute(ctx: BotContext, shortAddr: string) {
    await ctx.answerCbQuery('Executing swap...');

    const flowData = ctx.session.flowData;
    if (!flowData?.poolAddress || !flowData.swapQuote || !flowData.positionAddress) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }

    const telegramId = ctx.from!.id;
    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.editMessageText('No wallet connected.');
        return;
    }

    try {
        await ctx.editMessageText(
            `⏳ **STEP 1/2: Executing Swap**\n\n` +
            `Swapping tokens...\n\n` +
            `_Please wait, this may take 30-60 seconds..._`,
            { parse_mode: 'Markdown' }
        );

        // Execute the swap
        const swapSignature = await swapService.executeSwap(flowData.poolAddress, flowData.swapQuote);

        await ctx.editMessageText(
            `✅ **Swap Successful!**\n\n` +
            `Transaction: \`${swapSignature.slice(0, 20)}...\`\n\n` +
            `⏳ **STEP 2/2: Adding Liquidity**\n\n` +
            `_Please wait..._`,
            { parse_mode: 'Markdown' }
        );

        // Wait a moment for the swap to settle
        await new Promise(r => setTimeout(r, 2000));

        // Clear swap data
        flowData.autoSwapNeeded = false;
        flowData.swapQuote = undefined;
        flowData.autoSwapDirection = undefined;
        flowData.swapShortfall = undefined;

        // Now add liquidity
        const { StrategyType } = await import('@meteora-ag/dlmm');
        const { sendAndConfirmTransaction, PublicKey } = await import('@solana/web3.js');

        const connection = connectionService.getConnection();
        const dlmm = await poolService.getDlmmInstance(flowData.poolAddress);

        // Get position to find bin range
        const positionPubKey = new PublicKey(flowData.positionAddress);
        const position = await dlmm.getPosition(positionPubKey);

        const minBinId = position.positionData.lowerBinId;
        const maxBinId = position.positionData.upperBinId;

        // Convert amounts to BN
        const tokenXDecimals = flowData.tokenXDecimals || 9;
        const tokenYDecimals = flowData.tokenYDecimals || 6;
        const addAmountX = flowData.addLiqAmountX || 0;
        const addAmountY = flowData.addLiqAmountY || 0;

        const amountX = new BN(Math.floor(addAmountX * (10 ** tokenXDecimals)));
        const amountY = new BN(Math.floor(addAmountY * (10 ** tokenYDecimals)));

        // Create and execute transaction
        const tx = await dlmm.addLiquidityByStrategy({
            positionPubKey,
            user: keypair.publicKey,
            totalXAmount: amountX,
            totalYAmount: amountY,
            strategy: {
                maxBinId,
                minBinId,
                strategyType: StrategyType.Spot
            },
            slippage: 100 // 1%
        });

        const liquiditySignature = await sendAndConfirmTransaction(
            connection,
            tx,
            [keypair],
            { commitment: 'confirmed' }
        );

        // Clear flow data
        ctx.session.flowData = undefined;
        ctx.session.currentFlow = 'idle';

        console.log(chalk.green(`✓ User ${telegramId} auto-swapped and added liquidity to ${shortAddr}, swap tx: ${swapSignature.slice(0, 8)}..., liq tx: ${liquiditySignature.slice(0, 8)}...`));

        await ctx.editMessageText(
            `✅ **AUTO-SWAP & ADD LIQUIDITY COMPLETE!**\n\n` +
            `**Position:** \`${shortenAddress(flowData.positionAddress, 6)}\`\n\n` +
            `**Step 1 - Swap:** ✅\n` +
            `🔗 \`${swapSignature.slice(0, 20)}...\`\n\n` +
            `**Step 2 - Add Liquidity:** ✅\n` +
            `• ${addAmountX.toFixed(6)} ${flowData.tokenXSymbol || ''}\n` +
            `• ${addAmountY.toFixed(4)} ${flowData.tokenYSymbol || ''}\n` +
            `🔗 \`${liquiditySignature.slice(0, 20)}...\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📋 View Position', callback_data: `pos_detail_${shortAddr}` }],
                        [{ text: '📋 All Positions', callback_data: 'positions_list' }],
                        [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                    ]
                }
            }
        );

    } catch (error: any) {
        console.error('Auto-swap add liquidity execution error:', error);
        await ctx.editMessageText(
            `❌ **Operation Failed**\n\nError: ${error.message}\n\nThe operation could not be completed.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: `pos_addliq_autoswap_${shortAddr}` }],
                        [{ text: '✏️ Try Different Amounts', callback_data: `pos_addliq_amounts_${shortAddr}` }],
                        [{ text: '❌ Cancel', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
    }
}

export async function handleRemoveLiquidity(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found. Please refresh.');
        return;
    }

    await ctx.answerCbQuery();

    // Show percentage selection menu
    const totalValue = position.totalValueUSD ? formatUsd(position.totalValueUSD) : 'N/A';
    const xAmount = position.tokenX.uiAmount?.toFixed(4) || '0';
    const yAmount = position.tokenY.uiAmount?.toFixed(2) || '0';

    await ctx.editMessageText(
        `➖ **REMOVE LIQUIDITY**\n\n` +
        `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n` +
        `**Pool:** ${position.tokenX.symbol}/${position.tokenY.symbol}\n` +
        `**Current Value:** ${totalValue}\n\n` +
        `**Current Amounts:**\n` +
        `• ${xAmount} ${position.tokenX.symbol}\n` +
        `• ${yAmount} ${position.tokenY.symbol}\n\n` +
        `Select percentage to remove:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '25%', callback_data: `pos_remove_pct_25_${shortAddr}` },
                        { text: '50%', callback_data: `pos_remove_pct_50_${shortAddr}` },
                        { text: '75%', callback_data: `pos_remove_pct_75_${shortAddr}` }
                    ],
                    [
                        { text: '100% (All)', callback_data: `pos_remove_pct_100_${shortAddr}` }
                    ],
                    [
                        { text: '⬅️ Cancel', callback_data: `pos_detail_${shortAddr}` }
                    ]
                ]
            }
        }
    );
}

export async function handleClosePosition(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found. Please refresh.');
        return;
    }

    await ctx.answerCbQuery();

    // Calculate what will be returned
    const totalValue = position.totalValueUSD ? formatUsd(position.totalValueUSD) : 'N/A';
    const xAmount = position.tokenX.uiAmount?.toFixed(4) || '0';
    const yAmount = position.tokenY.uiAmount?.toFixed(2) || '0';
    const feeX = position.unclaimedFees.xUi?.toFixed(4) || '0';
    const feeY = position.unclaimedFees.yUi?.toFixed(2) || '0';
    const feeUsd = position.unclaimedFees.usdValue ? formatUsd(position.unclaimedFees.usdValue) : '$0.00';

    await ctx.editMessageText(
        `❌ **CLOSE POSITION**\n\n` +
        `⚠️ **This will permanently close your position!**\n\n` +
        `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n` +
        `**Pool:** ${position.tokenX.symbol}/${position.tokenY.symbol}\n\n` +
        `**You will receive:**\n` +
        `💰 **Liquidity:**\n` +
        `• ${xAmount} ${position.tokenX.symbol}\n` +
        `• ${yAmount} ${position.tokenY.symbol}\n` +
        `• Value: ${totalValue}\n\n` +
        `💸 **Unclaimed Fees:**\n` +
        `• ${feeX} ${position.tokenX.symbol}\n` +
        `• ${feeY} ${position.tokenY.symbol}\n` +
        `• Value: ${feeUsd}\n\n` +
        `⚠️ This action cannot be undone.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Confirm Close', callback_data: `pos_close_confirm_${shortAddr}` },
                        { text: '❌ Cancel', callback_data: `pos_detail_${shortAddr}` }
                    ]
                ]
            }
        }
    );
}

// ==================== REMOVE LIQUIDITY PERCENTAGE HANDLER ====================

export async function handleRemoveLiquidityPercent(ctx: BotContext, percent: number, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found');
        return;
    }

    // Calculate what will be removed
    const xAmount = (position.tokenX.uiAmount || 0) * (percent / 100);
    const yAmount = (position.tokenY.uiAmount || 0) * (percent / 100);
    const valueUsd = (position.totalValueUSD || 0) * (percent / 100);

    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `➖ **CONFIRM REMOVAL**\n\n` +
        `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n` +
        `**Pool:** ${position.tokenX.symbol}/${position.tokenY.symbol}\n` +
        `**Removing:** ${percent}%\n\n` +
        `**You will receive:**\n` +
        `• ~${xAmount.toFixed(4)} ${position.tokenX.symbol}\n` +
        `• ~${yAmount.toFixed(2)} ${position.tokenY.symbol}\n` +
        `• Value: ~${formatUsd(valueUsd)}\n\n` +
        `⚠️ This will send a transaction to remove liquidity.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Confirm Remove', callback_data: `pos_remove_exec_${percent}_${shortAddr}` },
                        { text: '❌ Cancel', callback_data: `pos_detail_${shortAddr}` }
                    ]
                ]
            }
        }
    );
}

// ==================== EXECUTE REMOVE LIQUIDITY ====================

export async function handleRemoveLiquidityExecute(ctx: BotContext, percent: number, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found');
        return;
    }

    await ctx.answerCbQuery('Processing...');
    await ctx.editMessageText('🔄 **Removing liquidity...**\n\nPlease wait...', { parse_mode: 'Markdown' });

    try {
        const bps = percent * 100; // 100% = 10000 bps
        const shouldClaimAndClose = percent === 100;

        const result = await removeLiquidityWithKeypair(
            position.poolAddress,
            position.publicKey,
            keypair,
            bps,
            shouldClaimAndClose
        );

        console.log(chalk.green(`✓ User ${telegramId} removed ${percent}% liquidity from position ${shortAddr}`));

        await ctx.editMessageText(
            `✅ **LIQUIDITY REMOVED!**\n\n` +
            `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n` +
            `**Removed:** ${percent}%\n\n` +
            `**Withdrawn:**\n` +
            `• ${result.removedX.toFixed(4)} ${result.tokenXSymbol}\n` +
            `• ${result.removedY.toFixed(2)} ${result.tokenYSymbol}\n` +
            `• **Value:** ${formatUsd(result.removedUsd)}\n\n` +
            `🔗 **TX:** \`${result.signatures[0]?.slice(0, 20)}...\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📋 View Positions', callback_data: 'positions_refresh' }],
                        [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                    ]
                }
            }
        );

    } catch (error: any) {
        console.error('Error removing liquidity:', error);
        await ctx.editMessageText(
            `❌ **Failed to remove liquidity**\n\n` +
            `Error: ${error.message || 'Unknown error'}\n\n` +
            `Please try again later.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Retry', callback_data: `pos_remove_${shortAddr}` }],
                        [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
    }
}

// ==================== CLOSE POSITION CONFIRM ====================

export async function handleClosePositionConfirm(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found');
        return;
    }

    await ctx.answerCbQuery('Processing...');
    await ctx.editMessageText('🔄 **Closing position...**\n\nPlease wait...', { parse_mode: 'Markdown' });

    try {
        const result = await closePositionWithKeypair(
            position.poolAddress,
            position.publicKey,
            keypair
        );

        console.log(chalk.green(`✓ User ${telegramId} closed position ${shortAddr}`));

        await ctx.editMessageText(
            `✅ **POSITION CLOSED!**\n\n` +
            `**Position:** \`${shortenAddress(position.publicKey, 6)}\`\n` +
            `**Pool:** ${result.tokenXSymbol}/${result.tokenYSymbol}\n\n` +
            `**Withdrawn Liquidity:**\n` +
            `• ${result.withdrawnX.toFixed(4)} ${result.tokenXSymbol}\n` +
            `• ${result.withdrawnY.toFixed(2)} ${result.tokenYSymbol}\n` +
            `• Value: ${formatUsd(result.withdrawnUsd)}\n\n` +
            `**Claimed Fees:**\n` +
            `• ${result.claimedFeesX.toFixed(4)} ${result.tokenXSymbol}\n` +
            `• ${result.claimedFeesY.toFixed(2)} ${result.tokenYSymbol}\n` +
            `• Value: ${formatUsd(result.claimedFeesUsd)}\n\n` +
            `🔗 **TX:** \`${result.signature?.slice(0, 20)}...\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📋 View Positions', callback_data: 'positions_refresh' }],
                        [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                    ]
                }
            }
        );

    } catch (error: any) {
        console.error('Error closing position:', error);
        await ctx.editMessageText(
            `❌ **Failed to close position**\n\n` +
            `Error: ${error.message || 'Unknown error'}\n\n` +
            `Please try again later.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Retry', callback_data: `pos_close_${shortAddr}` }],
                        [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
    }
}

export async function handleAIAnalysis(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }

    // Find position - first try session cache, then fetch fresh
    let position: UserPosition | undefined;
    if (ctx.session.pagination?.data) {
        const positions = ctx.session.pagination.data as UserPosition[];
        position = positions.find(p => p.publicKey.startsWith(shortAddr));
    }

    // If not in session, fetch positions fresh (common when clicking from notifications)
    if (!position) {
        try {
            console.log(`[AIAnalysis] Position ${shortAddr} not in session, fetching fresh...`);
            const allPositions = await positionService.getAllPositions(
                keypair.publicKey.toBase58()
            );
            position = allPositions.find(p => p.publicKey.startsWith(shortAddr));

            if (allPositions.length > 0) {
                ctx.session.pagination = {
                    type: 'positions',
                    data: allPositions,
                    page: 0,
                    currentPage: 0,
                    totalPages: Math.ceil(allPositions.length / POSITIONS_PER_PAGE),
                    itemsPerPage: POSITIONS_PER_PAGE,
                    listType: 'positions'
                };
            }
        } catch (fetchError: any) {
            console.error('[AIAnalysis] Failed to fetch positions:', fetchError.message);
        }
    }

    if (!position) {
        await ctx.answerCbQuery('Position not found. Please refresh.');
        return;
    }

    await ctx.answerCbQuery('Consulting AI...');
    await ctx.editMessageText('🤖 **Analyzing position...**\n\nGathering market data and position metrics...', { parse_mode: 'Markdown' });

    try {
        const analysis = await getAIAnalysis(
            position.poolAddress,
            position.publicKey,
            position
        );

        if (!analysis.isAvailable) {
            await ctx.editMessageText(
                `🤖 **AI Analysis**\n\n` +
                `⚠️ AI Agent is not configured.\n\n` +
                `To enable AI-powered insights:\n` +
                `• Configure an LLM provider in settings\n` +
                `• Supported: OpenAI, Anthropic, DeepSeek`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '♻️ Manual Rebalance Analysis', callback_data: `pos_rebalance_${shortAddr}` }],
                            [{ text: '⬅️ Back to Position', callback_data: `pos_detail_${shortAddr}` }]
                        ]
                    }
                }
            );
            return;
        }

        // Action emoji and color mapping
        const actionConfig: Record<string, { emoji: string, label: string }> = {
            'rebalance': { emoji: '♻️', label: 'REBALANCE' },
            'hold': { emoji: '✋', label: 'HOLD' },
            'close': { emoji: '❌', label: 'CLOSE' },
            'compound': { emoji: '🔄', label: 'COMPOUND' }
        };

        // Urgency indicator
        const urgencyConfig: Record<string, { emoji: string, label: string }> = {
            'immediate': { emoji: '🔴', label: 'Act Now' },
            'soon': { emoji: '🟠', label: 'Soon' },
            'low': { emoji: '🟡', label: 'Low Priority' },
            'none': { emoji: '🟢', label: 'No Rush' }
        };

        // Position health indicator
        const healthConfig: Record<string, { emoji: string, label: string }> = {
            'healthy': { emoji: '💚', label: 'Healthy' },
            'at-risk': { emoji: '💛', label: 'At Risk' },
            'critical': { emoji: '❤️', label: 'Critical' },
            'inactive': { emoji: '🖤', label: 'Inactive' }
        };

        const action = actionConfig[analysis.action] || { emoji: '❓', label: analysis.action.toUpperCase() };
        const urgency = urgencyConfig[analysis.urgency] || { emoji: '❓', label: analysis.urgency };
        const health = healthConfig[(analysis as any).positionHealth] || { emoji: '💙', label: 'Unknown' };

        // Build clean message
        let message = `🤖 **AI Analysis**\n\n`;

        // Position identifier
        message += `📍 **${analysis.tokenXSymbol}/${analysis.tokenYSymbol}**\n`;
        message += `\`${shortenAddress(position.publicKey, 6)}\`\n\n`;

        // Main recommendation - prominent display
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `${action.emoji} **${action.label}**`;
        if (analysis.confidence >= 80) {
            message += ` (${analysis.confidence}% confident)\n`;
        } else {
            message += `\n`;
        }
        message += `${urgency.emoji} ${urgency.label} • ${health.emoji} ${health.label}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Helper to format price
        const formatPrice = (p: number) => {
            if (p === undefined || p === null || isNaN(p)) return 'N/A';
            if (p < 0.01) return p.toFixed(6);
            if (p < 1) return p.toFixed(4);
            return p.toFixed(2);
        };

        // Add Price & Range Info with actual prices
        const currentPrice = (analysis as any).currentPrice;
        const rangeMinPrice = (analysis as any).rangeMinPrice;
        const rangeMaxPrice = (analysis as any).rangeMaxPrice;
        const nearestEdgePrice = (analysis as any).nearestEdgePrice;
        const distanceToEdge = (analysis as any).distanceToEdge;

        if (currentPrice) {
            message += `💰 **Current Price:** $${formatPrice(currentPrice)}\n`;
        }
        if (rangeMinPrice && rangeMaxPrice) {
            message += `📏 **Your Range:** $${formatPrice(rangeMinPrice)} - $${formatPrice(rangeMaxPrice)}\n`;
        }
        if (nearestEdgePrice && distanceToEdge !== undefined) {
            const edgeLabel = (analysis as any).activeBin - (analysis as any).rangeMin < (analysis as any).rangeMax - (analysis as any).activeBin ? 'lower' : 'upper';
            message += `⚠️ **Nearest Edge:** $${formatPrice(nearestEdgePrice)} (${distanceToEdge} bins to ${edgeLabel})\n`;
        }
        message += `\n`;

        // Market insight if available
        if ((analysis as any).marketInsight) {
            message += `📈 **Market:** ${(analysis as any).marketInsight}\n\n`;
        }

        // Key reasoning (limit to 3 most important)
        message += `**Why:**\n`;
        const topReasons = analysis.reasoning.slice(0, 3);
        topReasons.forEach(reason => {
            message += `• ${reason}\n`;
        });

        // Strategy evaluation - NEW (matching rebalance display)
        const strategyEval = (analysis as any).strategyEvaluation;
        if (strategyEval) {
            const stratEmoji = strategyEval.isOptimal ? '✅' : '⚠️';
            message += `\n📊 **Strategy Evaluation**\n`;
            message += `Current: **${strategyEval.currentStrategy}** ${stratEmoji}\n`;
            if (!strategyEval.isOptimal && strategyEval.suggestedStrategy) {
                message += `Suggested: **${strategyEval.suggestedStrategy}**\n`;
            }
            message += `${strategyEval.reason}\n`;
        }

        // Risk Assessment - NEW (matching rebalance display)
        const riskAssess = (analysis as any).riskAssessment;
        if (riskAssess) {
            message += `\n📈 **Risk Assessment**\n`;
            
            if (riskAssess.impermanentLoss) {
                message += `IL if +10%: ${riskAssess.impermanentLoss.ifPriceUp10Percent.toFixed(2)}% | `;
                message += `IL if -10%: ${riskAssess.impermanentLoss.ifPriceDown10Percent.toFixed(2)}%\n`;
            }
            
            const riskMetrics: string[] = [];
            if (typeof riskAssess.supportDistance === 'number') {
                riskMetrics.push(`Support: ${riskAssess.supportDistance.toFixed(1)}% below`);
            }
            if (typeof riskAssess.resistanceDistance === 'number') {
                riskMetrics.push(`Resistance: ${riskAssess.resistanceDistance.toFixed(1)}% above`);
            }
            if (riskMetrics.length > 0) {
                message += riskMetrics.join(' | ') + '\n';
            }
            
            if (typeof riskAssess.rebalanceProbability7Days === 'number') {
                const probEmoji = riskAssess.rebalanceProbability7Days > 70 ? '🔴' : 
                                  riskAssess.rebalanceProbability7Days > 40 ? '🟡' : '🟢';
                message += `${probEmoji} Rebalance likelihood (7d): ${riskAssess.rebalanceProbability7Days}%\n`;
            }
        }

        // Expected outcome if taking action
        if ((analysis as any).expectedOutcome && analysis.action !== 'hold') {
            const outcome = (analysis as any).expectedOutcome;

            message += `\n💰 **Rebalance Economics**\n`;

            // Break-even time (most important for decision making)
            if (outcome.breakEvenHours !== undefined && outcome.breakEvenHours < 999) {
                const hours = Math.floor(outcome.breakEvenHours);
                const days = Math.floor(outcome.breakEvenHours / 24);

                let breakEvenStr = '';
                let quality = '';

                if (hours < 24) {
                    breakEvenStr = `${hours} hours`;
                    quality = '✅';
                } else if (days < 3) {
                    breakEvenStr = `${days} days`;
                    quality = '⚠️';
                } else {
                    breakEvenStr = `${days} days`;
                    quality = '❌';
                }

                message += `• Break-even: ${breakEvenStr} ${quality}\n`;
            }

            // ROI projection
            if (outcome.roi !== undefined && outcome.roi > 0) {
                message += `• 7-day ROI: ${outcome.roi.toFixed(1)}x\n`;
            }

            // Expected fees
            if (outcome.dailyFeesUsd) {
                message += `• Expected daily: $${outcome.dailyFeesUsd.toFixed(4)}\n`;
            }
            if (outcome.weeklyFeesUsd) {
                message += `• Expected weekly: $${outcome.weeklyFeesUsd.toFixed(2)}\n`;
            }

            // Position lifespan (how long before next rebalance)
            if (outcome.positionLifespanDays) {
                message += `• Position lifespan: ~${Math.round(outcome.positionLifespanDays)} days\n`;
            }
        }

        // Only show risks if action is recommended
        if (analysis.risks.length > 0 && analysis.action !== 'hold') {
            message += `\n⚠️ **Note:** ${analysis.risks[0]}\n`;
        }

        // Suggested actions (only if actionable)
        if (analysis.suggestedActions.length > 0 && analysis.action !== 'hold') {
            message += `\n💡 **Next Step:** ${analysis.suggestedActions[0]}\n`;
        }

        // Build action buttons based on recommendation
        const buttons: any[][] = [];

        if (analysis.action === 'rebalance') {
            buttons.push([{ text: '🚀 Execute Rebalance', callback_data: `pos_rebal_exec_${shortAddr}` }]);
        } else if (analysis.action === 'close') {
            buttons.push([{ text: '❌ Close Position', callback_data: `pos_close_${shortAddr}` }]);
        } else if (analysis.action === 'hold') {
            // Even for hold, offer rebalance option if position is at edge
            const distanceToEdge = (analysis as any).distanceToEdge;
            if (distanceToEdge !== undefined && distanceToEdge <= 5) {
                buttons.push([{ text: '🔄 Rebalance Anyway', callback_data: `pos_rebal_exec_${shortAddr}` }]);
            }
        }

        buttons.push([
            { text: '🔄 Refresh', callback_data: `pos_ai_${shortAddr}` },
            { text: '📊 Details', callback_data: `pos_rebalance_${shortAddr}` }
        ]);
        buttons.push([{ text: '⬅️ Back to Position', callback_data: `pos_detail_${shortAddr}` }]);

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });

    } catch (error: any) {
        console.error('Error getting AI analysis:', error);
        await ctx.editMessageText(
            `❌ **Analysis Failed**\n\n` +
            `${error.message || 'Unknown error'}\n\n` +
            `Try again or use manual rebalance analysis.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Retry', callback_data: `pos_ai_${shortAddr}` }],
                        [{ text: '📊 Manual Analysis', callback_data: `pos_rebalance_${shortAddr}` }],
                        [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }]
                    ]
                }
            }
        );
    }
}

export async function handleRefreshPosition(ctx: BotContext, shortAddr: string) {
    await ctx.answerCbQuery('Refreshing...');

    // Clear cache and reload
    ctx.session.pagination = undefined;

    await ctx.deleteMessage().catch(() => { });
    await handlePositionDetail(ctx, shortAddr);
}
