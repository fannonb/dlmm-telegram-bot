/**
 * Rebalance Management Handlers for Telegram Bot
 * 
 * Implements Phase 5 features:
 * - Auto-rebalance setup and configuration
 * - Rebalance history view
 * - Strategy selection
 * - Custom range configuration
 */

import { BotContext, AutoRebalanceConfig } from '../types';
import { multiWalletStorage, TelegramWallet } from '../services/walletStorageMulti';
import { positionService, UserPosition } from '../../services/position.service';
import { userDataService } from '../services/userDataService';
import { analyticsDataStore, RebalanceHistoryEntry } from '../../services/analyticsDataStore.service';
import { autoRebalanceKeyboard, rebalanceStrategyKeyboard } from '../keyboards';
import { formatUsd, shortenAddress } from '../utils/formatting';

// ==================== AUTO-REBALANCE HANDLERS ====================

/**
 * Handle auto-rebalance menu from position detail
 */
export async function handleAutoRebalanceMenu(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const shortAddr = callbackData.replace('pos_auto_', '');
        
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        // Find the position
        const position = await findPositionByShortAddress(userId, shortAddr);
        if (!position) {
            await ctx.answerCbQuery('❌ Position not found');
            return;
        }

        // Get current auto-rebalance config
        const config = userDataService.getAutoRebalanceConfig(userId, position.publicKey);
        const isEnabled = config?.enabled || false;

        const statusText = isEnabled 
            ? `🟢 **Auto-Rebalance: ENABLED**

**Current Settings:**
• Strategy: ${getStrategyLabel(config!.strategy)}
• Range Width: ±${config!.rangeWidth}%
• Check Interval: Every ${config!.checkIntervalHours}h
• Min Cost/Benefit: ${config!.minCostBenefit}:1
• Urgency Override: ${config!.urgencyOverride ? 'Yes' : 'No'}

${config!.lastCheck ? `📅 Last Check: ${formatTimestamp(config!.lastCheck)}` : ''}
${config!.lastRebalance ? `🔄 Last Rebalance: ${formatTimestamp(config!.lastRebalance)}` : ''}`
            : `🔴 **Auto-Rebalance: DISABLED**

Enable auto-rebalance to automatically rebalance your position when it goes out of range or efficiency drops.

**How it works:**
1. System monitors your position periodically
2. When rebalance is beneficial, it executes automatically
3. You can set thresholds and strategies

⚠️ Note: Auto-rebalance requires sufficient SOL for transaction fees.`;

        const message = `🔄 **Auto-Rebalance Settings**

**Position:** ${position.tokenX.symbol}/${position.tokenY.symbol}
\`${shortenAddress(position.publicKey, 8)}\`

${statusText}`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: autoRebalanceKeyboard(position.publicKey, isEnabled)
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleAutoRebalanceMenu:', error);
        await ctx.answerCbQuery('❌ Error loading auto-rebalance settings');
    }
}

/**
 * Toggle auto-rebalance on/off
 */
export async function handleAutoRebalanceToggle(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const shortAddr = callbackData.replace('auto_toggle_', '');
        
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const position = await findPositionByShortAddress(userId, shortAddr);
        if (!position) {
            await ctx.answerCbQuery('❌ Position not found');
            return;
        }

        const currentConfig = userDataService.getAutoRebalanceConfig(userId, position.publicKey);
        
        if (currentConfig?.enabled) {
            // Disable
            userDataService.removeAutoRebalanceConfig(userId, position.publicKey);
            await ctx.answerCbQuery('🔴 Auto-rebalance disabled');
        } else {
            // Enable with default config
            const defaultConfig: AutoRebalanceConfig = {
                enabled: true,
                strategy: 'balanced',
                rangeWidth: 12,
                checkIntervalHours: 4,
                minCostBenefit: 1.5,
                urgencyOverride: true,
                lastCheck: undefined,
                lastRebalance: undefined
            };
            userDataService.setAutoRebalanceConfig(userId, position.publicKey, defaultConfig);
            await ctx.answerCbQuery('🟢 Auto-rebalance enabled');
        }

        // Refresh the menu
        await handleAutoRebalanceMenu(ctx);
    } catch (error) {
        console.error('Error toggling auto-rebalance:', error);
        await ctx.answerCbQuery('❌ Error toggling auto-rebalance');
    }
}

/**
 * Show strategy selection menu
 */
export async function handleAutoRebalanceStrategy(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const shortAddr = callbackData.replace('auto_strategy_', '');
        
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const position = await findPositionByShortAddress(userId, shortAddr);
        if (!position) {
            await ctx.answerCbQuery('❌ Position not found');
            return;
        }

        const message = `⚙️ **Select Rebalance Strategy**

**Position:** ${position.tokenX.symbol}/${position.tokenY.symbol}
\`${shortenAddress(position.publicKey, 8)}\`

Choose your rebalancing strategy:

**⚡ Aggressive (±8%)**
• Tight range, higher fees when in range
• More frequent rebalances
• Higher risk of going out of range

**⚖️ Balanced (±12%)**
• Moderate range width
• Good balance of fees vs maintenance
• Recommended for most users

**🛡️ Conservative (±18%)**
• Wide range, stays in range longer
• Lower fees but less maintenance
• Best for volatile markets

**🎯 Custom Range**
• Set your own range width`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: rebalanceStrategyKeyboard(position.publicKey)
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error showing strategy menu:', error);
        await ctx.answerCbQuery('❌ Error loading strategies');
    }
}

/**
 * Handle strategy selection
 */
export async function handleStrategySelection(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        // reb_strat_agg_XXXXXXXX or reb_strat_bal_XXXXXXXX etc
        const parts = callbackData.split('_');
        const strategyCode = parts[2]; // agg, bal, con, cust
        const shortAddr = parts[3];

        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const position = await findPositionByShortAddress(userId, shortAddr);
        if (!position) {
            await ctx.answerCbQuery('❌ Position not found');
            return;
        }

        if (strategyCode === 'cust') {
            // Custom range - prompt for input using flowData
            ctx.session.currentFlow = 'rebalancing';
            ctx.session.flowData = {
                ...ctx.session.flowData,
                positionAddress: position.publicKey,
                step: 'awaiting_custom_range'
            };
            
            await ctx.editMessageText(
`🎯 **Custom Range Width**

Enter your desired range width as a percentage (e.g., "15" for ±15%):

Min: 3% | Max: 50%

Type your value or /cancel to go back.`,
                { parse_mode: 'Markdown' }
            );
            await ctx.answerCbQuery();
            return;
        }

        // Map strategy code to config
        const strategyMap: Record<string, { strategy: 'aggressive' | 'balanced' | 'conservative', rangeWidth: number }> = {
            'agg': { strategy: 'aggressive', rangeWidth: 8 },
            'bal': { strategy: 'balanced', rangeWidth: 12 },
            'con': { strategy: 'conservative', rangeWidth: 18 }
        };

        const selected = strategyMap[strategyCode];
        if (!selected) {
            await ctx.answerCbQuery('❌ Invalid strategy');
            return;
        }

        // Update config
        const currentConfig = userDataService.getAutoRebalanceConfig(userId, position.publicKey);
        const updatedConfig: AutoRebalanceConfig = {
            ...(currentConfig || getDefaultConfig()),
            strategy: selected.strategy,
            rangeWidth: selected.rangeWidth
        };
        userDataService.setAutoRebalanceConfig(userId, position.publicKey, updatedConfig);

        await ctx.answerCbQuery(`✅ Strategy set to ${getStrategyLabel(selected.strategy)}`);
        
        // Go back to auto-rebalance menu by simulating the callback
        const fakeCtx = {
            ...ctx,
            callbackQuery: { ...ctx.callbackQuery, data: `pos_auto_${shortAddr}` }
        } as BotContext;
        await handleAutoRebalanceMenu(fakeCtx);
    } catch (error) {
        console.error('Error selecting strategy:', error);
        await ctx.answerCbQuery('❌ Error updating strategy');
    }
}

/**
 * Handle custom range input from conversation
 */
export async function handleCustomRangeInput(ctx: BotContext, rangeWidth: number): Promise<void> {
    try {
        const userId = ctx.from?.id;
        const positionAddress = ctx.session.flowData?.positionAddress;
        
        if (!userId || !positionAddress) {
            await ctx.reply('❌ Session expired. Please try again.');
            return;
        }
        
        if (rangeWidth < 3 || rangeWidth > 50) {
            await ctx.reply('❌ Range width must be between 3% and 50%. Please try again:');
            return;
        }

        // Update config
        const currentConfig = userDataService.getAutoRebalanceConfig(userId, positionAddress);
        const updatedConfig: AutoRebalanceConfig = {
            ...(currentConfig || getDefaultConfig()),
            rangeWidth: rangeWidth
        };
        userDataService.setAutoRebalanceConfig(userId, positionAddress, updatedConfig);

        // Clear flow state
        ctx.session.currentFlow = 'idle';
        ctx.session.flowData = undefined;

        await ctx.reply(`✅ Custom range width set to ±${rangeWidth}%

Returning to position menu...`);

        // Return to position detail
        const shortAddr = positionAddress.slice(0, 8);
        await ctx.reply('Use the position menu to view updated settings.', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📊 View Position', callback_data: `pos_detail_${shortAddr}` }]
                ]
            }
        });
    } catch (error) {
        console.error('Error setting custom range:', error);
        await ctx.reply('❌ Error setting custom range. Please try again.');
    }
}

/**
 * Show auto-rebalance status
 */
export async function handleAutoRebalanceStatus(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const shortAddr = callbackData.replace('auto_status_', '');
        
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const position = await findPositionByShortAddress(userId, shortAddr);
        if (!position) {
            await ctx.answerCbQuery('❌ Position not found');
            return;
        }

        const config = userDataService.getAutoRebalanceConfig(userId, position.publicKey);
        if (!config?.enabled) {
            await ctx.answerCbQuery('Auto-rebalance is not enabled');
            return;
        }

        // Get rebalance history for this position
        const history = analyticsDataStore.getPositionRebalanceHistory(position.publicKey);
        const autoRebalances = history.filter(h => h.reasonCode === 'AUTO');

        const statsMessage = `📊 **Auto-Rebalance Statistics**

**Position:** ${position.tokenX.symbol}/${position.tokenY.symbol}
\`${shortenAddress(position.publicKey, 8)}\`

**Configuration:**
• Strategy: ${getStrategyLabel(config.strategy)}
• Range Width: ±${config.rangeWidth}%
• Check Interval: Every ${config.checkIntervalHours}h
• Min Cost/Benefit: ${config.minCostBenefit}:1

**Activity:**
• Total Auto-Rebalances: ${autoRebalances.length}
${config.lastCheck ? `• Last Check: ${formatTimestamp(config.lastCheck)}` : '• Last Check: Never'}
${config.lastRebalance ? `• Last Rebalance: ${formatTimestamp(config.lastRebalance)}` : '• Last Rebalance: Never'}

**Performance:**
${autoRebalances.length > 0 
    ? `• Total Fees Claimed: ${formatUsd(autoRebalances.reduce((sum, h) => sum + h.feesClaimedUsd, 0))}
• Total Costs: ${formatUsd(autoRebalances.reduce((sum, h) => sum + h.transactionCostUsd, 0))}
• Net Benefit: ${formatUsd(autoRebalances.reduce((sum, h) => sum + h.feesClaimedUsd - h.transactionCostUsd, 0))}`
    : '• No auto-rebalances recorded yet'}`;

        await ctx.editMessageText(statsMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📜 View History', callback_data: `reb_history_${shortAddr}` }],
                    [{ text: '⬅️ Back', callback_data: `pos_auto_${shortAddr}` }]
                ]
            }
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error showing auto-rebalance status:', error);
        await ctx.answerCbQuery('❌ Error loading status');
    }
}

// ==================== REBALANCE HISTORY HANDLERS ====================

/**
 * Show rebalance history for a position
 */
export async function handleRebalanceHistory(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const shortAddr = callbackData.replace('reb_history_', '');
        
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const position = await findPositionByShortAddress(userId, shortAddr);
        if (!position) {
            await ctx.answerCbQuery('❌ Position not found');
            return;
        }

        // Get rebalance history
        const history = analyticsDataStore.getPositionRebalanceHistory(position.publicKey);
        
        if (history.length === 0) {
            await ctx.editMessageText(
`📜 **Rebalance History**

**Position:** ${position.tokenX.symbol}/${position.tokenY.symbol}
\`${shortenAddress(position.publicKey, 8)}\`

No rebalance history found for this position.`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '⬅️ Back to Position', callback_data: `pos_detail_${shortAddr}` }]
                        ]
                    }
                }
            );
            await ctx.answerCbQuery();
            return;
        }

        // Show last 5 rebalances
        const recentHistory = history.slice(-5).reverse();
        
        let historyText = `📜 **Rebalance History**

**Position:** ${position.tokenX.symbol}/${position.tokenY.symbol}
\`${shortenAddress(position.publicKey, 8)}\`

📊 Total Rebalances: ${history.length}

**Recent Activity:**\n`;

        for (const entry of recentHistory) {
            const date = new Date(entry.timestamp).toLocaleDateString();
            const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const reasonEmoji = getReasonEmoji(entry.reasonCode);
            const netValue = entry.feesClaimedUsd - entry.transactionCostUsd;
            
            historyText += `
${reasonEmoji} **${date} ${time}**
• Reason: ${entry.reasonCode}
• Old Range: ${entry.oldRange.min.toFixed(4)} - ${entry.oldRange.max.toFixed(4)}
• New Range: ${entry.newRange.min.toFixed(4)} - ${entry.newRange.max.toFixed(4)}
• Fees: ${formatUsd(entry.feesClaimedUsd)} | Cost: ${formatUsd(entry.transactionCostUsd)}
• Net: ${netValue >= 0 ? '🟢' : '🔴'} ${formatUsd(netValue)}
`;
        }

        // Calculate totals
        const totalFees = history.reduce((sum, h) => sum + h.feesClaimedUsd, 0);
        const totalCosts = history.reduce((sum, h) => sum + h.transactionCostUsd, 0);
        const netTotal = totalFees - totalCosts;

        historyText += `
━━━━━━━━━━━━━━━━
**Lifetime Totals:**
• Fees Claimed: ${formatUsd(totalFees)}
• Transaction Costs: ${formatUsd(totalCosts)}
• Net Result: ${netTotal >= 0 ? '🟢' : '🔴'} ${formatUsd(netTotal)}`;

        await ctx.editMessageText(historyText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📥 Export CSV', callback_data: `reb_export_${shortAddr}` }],
                    [{ text: '⬅️ Back to Position', callback_data: `pos_detail_${shortAddr}` }]
                ]
            }
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error showing rebalance history:', error);
        await ctx.answerCbQuery('❌ Error loading history');
    }
}

/**
 * Export rebalance history to CSV
 */
export async function handleRebalanceExport(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const shortAddr = callbackData.replace('reb_export_', '');
        
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const position = await findPositionByShortAddress(userId, shortAddr);
        if (!position) {
            await ctx.answerCbQuery('❌ Position not found');
            return;
        }

        const history = analyticsDataStore.getPositionRebalanceHistory(position.publicKey);
        
        if (history.length === 0) {
            await ctx.answerCbQuery('No history to export');
            return;
        }

        // Generate CSV content
        const headers = 'Date,Time,Reason,Old Min,Old Max,New Min,New Max,Fees USD,Cost USD,Net USD,Signature\n';
        const rows = history.map(h => {
            const date = new Date(h.timestamp);
            return [
                date.toLocaleDateString(),
                date.toLocaleTimeString(),
                h.reasonCode,
                h.oldRange.min.toFixed(6),
                h.oldRange.max.toFixed(6),
                h.newRange.min.toFixed(6),
                h.newRange.max.toFixed(6),
                h.feesClaimedUsd.toFixed(2),
                h.transactionCostUsd.toFixed(4),
                (h.feesClaimedUsd - h.transactionCostUsd).toFixed(2),
                h.signature || 'N/A'
            ].join(',');
        }).join('\n');

        const csv = headers + rows;
        const buffer = Buffer.from(csv, 'utf-8');

        await ctx.replyWithDocument({
            source: buffer,
            filename: `rebalance-history-${shortAddr}.csv`
        }, {
            caption: `📥 Rebalance history for position ${shortenAddress(position.publicKey, 8)}`
        });
        
        await ctx.answerCbQuery('✅ CSV exported');
    } catch (error) {
        console.error('Error exporting history:', error);
        await ctx.answerCbQuery('❌ Error exporting history');
    }
}

// ==================== HELPER FUNCTIONS ====================

async function findPositionByShortAddress(userId: number, shortAddr: string): Promise<UserPosition | null> {
    try {
        const wallets = multiWalletStorage.listWallets(userId);
        if (!wallets || wallets.length === 0) return null;

        // Get active wallet
        const activeWallet = multiWalletStorage.getActiveWallet(userId);
        const walletKey = activeWallet?.publicKey || wallets[0].publicKey;
        const positions = await positionService.getAllPositions(walletKey);

        return positions.find(p => p.publicKey.startsWith(shortAddr)) || null;
    } catch (error) {
        console.error('Error finding position:', error);
        return null;
    }
}

function getStrategyLabel(strategy: 'aggressive' | 'balanced' | 'conservative'): string {
    const labels: Record<string, string> = {
        'aggressive': '⚡ Aggressive',
        'balanced': '⚖️ Balanced',
        'conservative': '🛡️ Conservative'
    };
    return labels[strategy] || strategy;
}

function getReasonEmoji(reason: string): string {
    const emojis: Record<string, string> = {
        'OUT_OF_RANGE': '⚠️',
        'EFFICIENCY': '📉',
        'MANUAL': '👤',
        'AUTO': '🤖',
        'OTHER': '❓'
    };
    return emojis[reason] || '❓';
}

function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // If less than 24 hours, show relative time
    if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        if (hours === 0) {
            const mins = Math.floor(diff / (60 * 1000));
            return `${mins}m ago`;
        }
        return `${hours}h ago`;
    }
    
    // Otherwise show date
    return date.toLocaleDateString();
}

function getDefaultConfig(): AutoRebalanceConfig {
    return {
        enabled: true,
        strategy: 'balanced',
        rangeWidth: 12,
        checkIntervalHours: 4,
        minCostBenefit: 1.5,
        urgencyOverride: true
    };
}

// Export all handlers
export const rebalanceHandlers = {
    handleAutoRebalanceMenu,
    handleAutoRebalanceToggle,
    handleAutoRebalanceStrategy,
    handleStrategySelection,
    handleCustomRangeInput,
    handleAutoRebalanceStatus,
    handleRebalanceHistory,
    handleRebalanceExport
};
