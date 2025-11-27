/**
 * Fee Management Handlers for Telegram Bot
 * 
 * Phase 4 Implementation:
 * - Fee overview menu
 * - Claim fees (single/all)
 * - Compounding
 * - Fee history summary
 */

import { BotContext } from '../types';
import { multiWalletStorage } from '../services/walletStorageMulti';
import { positionService, UserPosition } from '../../services/position.service';
import { claimFeesWithKeypair, compoundFeesWithKeypair } from '../services/telegramPositionService';
import { formatUsd, shortenAddress } from '../utils/formatting';
import chalk from 'chalk';

// ==================== FEE MENU ====================

export async function handleFeesMenu(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery?.();
        await ctx.editMessageText(
            '❌ **No wallet connected**\n\n' +
            'Please connect a wallet first to manage fees.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔑 Connect Wallet', callback_data: 'mwallet_menu' }],
                        [{ text: '⬅️ Back', callback_data: 'menu_main' }]
                    ]
                }
            }
        );
        return;
    }

    await ctx.answerCbQuery?.('Loading fees...');
    
    try {
        // Show loading
        await ctx.editMessageText('🔄 **Loading fee information...**', { parse_mode: 'Markdown' });

        // Fetch positions
        const positions = await positionService.getAllPositions(keypair.publicKey.toBase58());

        // Store for later use
        ctx.session.pagination = {
            data: positions,
            currentPage: 0,
            totalPages: 1,
            itemsPerPage: 10,
            listType: 'positions'  // Use existing type
        };

        // Calculate totals
        const positionsWithFees = positions.filter((p: UserPosition) => (p.unclaimedFees.usdValue || 0) > 0);
        const totalUnclaimedUsd = positions.reduce((sum: number, p: UserPosition) => sum + (p.unclaimedFees.usdValue || 0), 0);

        let message = `💸 **FEE MANAGEMENT**\n\n`;
        message += `**Wallet:** \`${shortenAddress(keypair.publicKey.toBase58(), 6)}\`\n\n`;

        if (positionsWithFees.length === 0) {
            message += `📭 **No unclaimed fees**\n\n`;
            message += `All your positions have been claimed or have no accrued fees yet.`;

            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📋 View Positions', callback_data: 'positions_list' }],
                        [{ text: '🔄 Refresh', callback_data: 'fees_menu' }],
                        [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                    ]
                }
            });
            return;
        }

        message += `━━━ **UNCLAIMED FEES** ━━━\n`;
        message += `💰 **Total:** ${formatUsd(totalUnclaimedUsd)}\n`;
        message += `📊 **Positions with fees:** ${positionsWithFees.length}/${positions.length}\n\n`;

        // List top positions with fees
        const sortedByFees = [...positionsWithFees]
            .sort((a, b) => (b.unclaimedFees.usdValue || 0) - (a.unclaimedFees.usdValue || 0))
            .slice(0, 5);

        message += `━━━ **TOP POSITIONS** ━━━\n`;
        sortedByFees.forEach((p, idx) => {
            const feeUsd = formatUsd(p.unclaimedFees.usdValue || 0);
            message += `${idx + 1}. **${p.tokenX.symbol}/${p.tokenY.symbol}** - ${feeUsd}\n`;
        });

        if (positionsWithFees.length > 5) {
            message += `_...and ${positionsWithFees.length - 5} more_\n`;
        }

        // Build buttons
        const buttons: any[][] = [];

        // Claim all button (if multiple positions have fees)
        if (positionsWithFees.length > 1) {
            buttons.push([{ text: `💰 Claim All (${formatUsd(totalUnclaimedUsd)})`, callback_data: 'pos_claim_all' }]);
        }

        // Individual position buttons
        sortedByFees.slice(0, 3).forEach(p => {
            const shortAddr = shortenAddress(p.publicKey, 8);
            const feeUsd = formatUsd(p.unclaimedFees.usdValue || 0);
            buttons.push([
                { text: `💰 ${p.tokenX.symbol}/${p.tokenY.symbol} (${feeUsd})`, callback_data: `pos_claim_${shortAddr}` },
                { text: '🔄', callback_data: `pos_compound_${shortAddr}` }
            ]);
        });

        buttons.push([{ text: '🔄 Refresh', callback_data: 'fees_menu' }]);
        buttons.push([{ text: '📋 All Positions', callback_data: 'positions_list' }]);
        buttons.push([{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]);

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });

    } catch (error: any) {
        console.error('Error loading fees menu:', error);
        await ctx.editMessageText(
            `❌ **Failed to load fees**\n\n` +
            `Error: ${error.message || 'Unknown error'}\n\n` +
            `Please try again.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Retry', callback_data: 'fees_menu' }],
                        [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                    ]
                }
            }
        );
    }
}

// ==================== COMPOUND ALL ====================

export async function handleCompoundAll(ctx: BotContext) {
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
        await ctx.answerCbQuery('Please refresh fees first');
        return;
    }

    const positions = (pagination.data as UserPosition[]).filter(
        p => (p.unclaimedFees.usdValue || 0) > 0
    );

    if (positions.length === 0) {
        await ctx.answerCbQuery('No fees to compound');
        return;
    }

    const totalFees = positions.reduce((sum, p) => sum + (p.unclaimedFees.usdValue || 0), 0);

    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `🔄 **COMPOUND ALL FEES**\n\n` +
        `**Positions:** ${positions.length}\n` +
        `**Total fees:** ${formatUsd(totalFees)}\n\n` +
        `Choose compound ratio:\n` +
        `• **100%** - Reinvest all fees into positions\n` +
        `• **50%** - Reinvest half, claim half to wallet\n` +
        `• **Claim Only** - Just claim fees to wallet`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Compound 100%', callback_data: 'compound_all_exec_100' }],
                    [{ text: '🔄 Compound 50%', callback_data: 'compound_all_exec_50' }],
                    [{ text: '💰 Claim Only', callback_data: 'pos_claim_all' }],
                    [{ text: '❌ Cancel', callback_data: 'fees_menu' }]
                ]
            }
        }
    );
}

export async function handleCompoundAllExecute(ctx: BotContext, ratio: number) {
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

    let message = `🔄 **Compounding ${ratio}% of fees...**\n\n`;
    await ctx.editMessageText(message, { parse_mode: 'Markdown' });

    let successCount = 0;
    let failCount = 0;
    let totalCompounded = 0;
    let totalClaimed = 0;

    for (const position of positions) {
        try {
            message += `Processing ${position.tokenX.symbol}/${position.tokenY.symbol}...\n`;
            await ctx.editMessageText(message, { parse_mode: 'Markdown' });

            const result = await compoundFeesWithKeypair(
                position.poolAddress,
                position.publicKey,
                keypair,
                ratio
            );

            successCount++;
            totalClaimed += result.claimedUsd;
            totalCompounded += result.compoundedUsd;
            message += `✅ Compounded ${formatUsd(result.compoundedUsd)}\n`;

        } catch (error: any) {
            failCount++;
            message += `❌ Failed: ${error.message?.slice(0, 30) || 'Error'}\n`;
        }
    }

    console.log(chalk.green(`✓ User ${telegramId} compound all ${ratio}%: ${successCount} success, ${failCount} failed`));

    message += `\n**Summary:**\n`;
    message += `✅ Success: ${successCount}\n`;
    if (failCount > 0) message += `❌ Failed: ${failCount}\n`;
    message += `💰 Total Claimed: ${formatUsd(totalClaimed)}\n`;
    message += `🔄 Total Compounded: ${formatUsd(totalCompounded)}`;

    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '💸 Fees Menu', callback_data: 'fees_menu' }],
                [{ text: '📋 View Positions', callback_data: 'positions_refresh' }],
                [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
            ]
        }
    });
}

// ==================== FEE HISTORY SUMMARY ====================

export async function handleFeeHistory(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    await ctx.answerCbQuery();

    // This would need analytics service integration
    // For now, show a placeholder
    await ctx.editMessageText(
        `📊 **FEE HISTORY**\n\n` +
        `_Fee history tracking is coming soon!_\n\n` +
        `This feature will show:\n` +
        `• Total fees earned all-time\n` +
        `• Fee earnings by position\n` +
        `• Daily/weekly/monthly breakdowns\n` +
        `• Compound vs claimed ratio`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💸 Back to Fees', callback_data: 'fees_menu' }],
                    [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                ]
            }
        }
    );
}
