/**
 * Analytics Handlers for Telegram Bot
 * 
 * Phase 7 Implementation:
 * - Portfolio Overview (PnL & APR)
 * - Fee Earnings tracking
 * - PnL History
 * - Transaction History (rebalances, fee claims)
 * - Data Export (CSV)
 */

import { BotContext } from '../types';
import { multiWalletStorage } from '../services/walletStorageMulti';
import { analyticsService, PortfolioAnalytics } from '../../services/analytics.service';
import { analyticsDataStore, AnalyticsSnapshot, RebalanceHistoryEntry, FeeClaimRecord } from '../../services/analyticsDataStore.service';
import { positionService } from '../../services/position.service';
import { analyticsKeyboard, analyticsExportKeyboard, analyticsPeriodKeyboard } from '../keyboards';
import { formatUsd, shortenAddress } from '../utils/formatting';
import {
    exportSnapshotsToCSV,
    exportRebalanceHistoryToCSV,
    exportPositionsSummaryToCSV,
    generateTimestampedFilename
} from '../../utils/export-helpers';
import fs from 'fs';
import path from 'path';

// ==================== MAIN ANALYTICS MENU ====================

/**
 * Show main analytics menu
 */
export async function handleAnalyticsMenu(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const activeWallet = multiWalletStorage.getActiveWallet(userId);
        if (!activeWallet) {
            await ctx.answerCbQuery('❌ No wallet connected');
            await ctx.editMessageText(
                '📊 **Analytics**\n\n⚠️ Please connect a wallet first to view analytics.',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const message = `📊 **Analytics & Monitoring**

**Wallet:** \`${shortenAddress(activeWallet.publicKey, 8)}\`

Select an option to view detailed analytics:

• **Portfolio Overview** - Total value, PnL, APR
• **Fee Earnings** - Unclaimed fees & history
• **PnL History** - Historical performance
• **Transaction History** - Rebalances & claims
• **Export Data** - Download CSV reports`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: analyticsKeyboard()
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleAnalyticsMenu:', error);
        await ctx.answerCbQuery('❌ Error loading analytics');
    }
}

// ==================== PORTFOLIO OVERVIEW ====================

/**
 * Show portfolio overview with PnL and APR
 */
export async function handlePortfolioOverview(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const activeWallet = multiWalletStorage.getActiveWallet(userId);
        if (!activeWallet) {
            await ctx.answerCbQuery('❌ No wallet connected');
            return;
        }

        await ctx.answerCbQuery('📊 Loading portfolio...');

        // Get portfolio analytics
        const stats = await analyticsService.getPortfolioAnalytics(activeWallet.publicKey);

        if (stats.positions.length === 0) {
            await ctx.editMessageText(
                '📊 **Portfolio Overview**\n\n📭 No active positions found.\n\nCreate a position to start tracking analytics.',
                { 
                    parse_mode: 'Markdown',
                    reply_markup: analyticsKeyboard()
                }
            );
            return;
        }

        // Format PnL with color emoji
        const pnlEmoji = stats.totalPnLUSD >= 0 ? '🟢' : '🔴';
        const pnlSign = stats.totalPnLUSD >= 0 ? '+' : '';

        let message = `📊 **Portfolio Overview**

💰 **Total Value:** $${stats.totalValueUSD.toFixed(2)}
${pnlEmoji} **Total PnL:** ${pnlSign}$${stats.totalPnLUSD.toFixed(2)} (${pnlSign}${stats.totalPnLPercent.toFixed(2)}%)
📈 **Average APR:** ${stats.averageApr.toFixed(2)}%
💸 **Unclaimed Fees:** $${stats.totalUnclaimedFeesUSD.toFixed(2)}
📍 **Positions:** ${stats.positions.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Position Breakdown:**
`;

        // Add individual position stats
        for (const pos of stats.positions) {
            const posPnlEmoji = pos.pnlUSD >= 0 ? '📈' : '📉';
            const posPnlSign = pos.pnlUSD >= 0 ? '+' : '';
            
            message += `
• \`${shortenAddress(pos.publicKey, 6)}\`
  Value: $${pos.currentValueUSD.toFixed(2)} | APR: ${pos.apr.toFixed(1)}%
  PnL: ${posPnlEmoji} ${posPnlSign}$${pos.pnlUSD.toFixed(2)}`;
        }

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: analyticsKeyboard()
        });
    } catch (error: any) {
        console.error('Error in handlePortfolioOverview:', error);
        await ctx.editMessageText(
            `📊 **Portfolio Overview**\n\n❌ Error loading portfolio: ${error.message}`,
            { 
                parse_mode: 'Markdown',
                reply_markup: analyticsKeyboard()
            }
        );
    }
}

// ==================== FEE EARNINGS ====================

/**
 * Show fee earnings and history
 */
export async function handleFeeEarnings(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const activeWallet = multiWalletStorage.getActiveWallet(userId);
        if (!activeWallet) {
            await ctx.answerCbQuery('❌ No wallet connected');
            return;
        }

        await ctx.answerCbQuery('💸 Loading fee data...');

        // Get positions for current unclaimed fees
        const positions = await positionService.getAllPositions(activeWallet.publicKey);
        
        // Get fee claim history
        const feeClaims = analyticsDataStore.loadFeeClaims();
        
        // Calculate totals
        let totalUnclaimedUsd = 0;
        let totalClaimedUsd = 0;
        
        for (const pos of positions) {
            totalUnclaimedUsd += pos.unclaimedFees?.usdValue || 0;
        }
        
        for (const claim of feeClaims) {
            totalClaimedUsd += claim.claimedUsd;
        }

        // Get recent claims (last 10)
        const recentClaims = feeClaims.slice(-10).reverse();

        let message = `💸 **Fee Earnings**

**Current Unclaimed:** $${totalUnclaimedUsd.toFixed(4)}
**Total Claimed (All Time):** $${totalClaimedUsd.toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Unclaimed by Position:**
`;

        if (positions.length === 0) {
            message += '\n📭 No positions found.';
        } else {
            for (const pos of positions) {
                const fees = pos.unclaimedFees;
                message += `\n• \`${shortenAddress(pos.publicKey, 6)}\`: $${(fees?.usdValue || 0).toFixed(4)}`;
            }
        }

        message += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n**Recent Claims:**';

        if (recentClaims.length === 0) {
            message += '\n📭 No claims recorded yet.';
        } else {
            for (const claim of recentClaims.slice(0, 5)) {
                const date = new Date(claim.timestamp).toLocaleDateString();
                message += `\n• ${date}: $${claim.claimedUsd.toFixed(4)}`;
            }
        }

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: analyticsKeyboard()
        });
    } catch (error: any) {
        console.error('Error in handleFeeEarnings:', error);
        await ctx.editMessageText(
            `💸 **Fee Earnings**\n\n❌ Error: ${error.message}`,
            { 
                parse_mode: 'Markdown',
                reply_markup: analyticsKeyboard()
            }
        );
    }
}

// ==================== PNL HISTORY ====================

/**
 * Show PnL history with period selection
 */
export async function handlePnLHistory(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        await ctx.answerCbQuery();

        const message = `📈 **PnL History**

Select a time period to view historical performance:

• **7 Days** - Past week
• **14 Days** - Past two weeks  
• **30 Days** - Past month
• **All Time** - Complete history`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: analyticsPeriodKeyboard('pnl')
        });
    } catch (error) {
        console.error('Error in handlePnLHistory:', error);
        await ctx.answerCbQuery('❌ Error');
    }
}

/**
 * Show PnL for specific period
 */
export async function handlePnLPeriod(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const daysStr = callbackData.replace('analytics_pnl_', '');
        const days = daysStr === 'all' ? 365 : parseInt(daysStr, 10);

        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const activeWallet = multiWalletStorage.getActiveWallet(userId);
        if (!activeWallet) {
            await ctx.answerCbQuery('❌ No wallet connected');
            return;
        }

        await ctx.answerCbQuery('📈 Loading history...');

        // Get snapshots
        const allSnapshots = analyticsDataStore.loadSnapshots();
        
        // Filter by time period
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        const filteredSnapshots = allSnapshots.filter(s => s.timestamp >= cutoffTime);

        if (filteredSnapshots.length === 0) {
            await ctx.editMessageText(
                `📈 **PnL History (${days === 365 ? 'All Time' : days + ' Days'})**\n\n📭 No historical data available for this period.\n\nData is collected as you use the app.`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: analyticsKeyboard()
                }
            );
            return;
        }

        // Group by day and calculate totals
        const dailyData = groupSnapshotsByDay(filteredSnapshots, days);
        
        // Build ASCII chart
        const chart = buildAsciiChart(dailyData, 'value');

        const periodLabel = days === 365 ? 'All Time' : `${days} Days`;
        
        let message = `📈 **PnL History (${periodLabel})**

${chart}

**Summary:**
• Data Points: ${filteredSnapshots.length}
• Period: ${periodLabel}`;

        if (dailyData.length > 0) {
            const startValue = dailyData[0].totalValue;
            const endValue = dailyData[dailyData.length - 1].totalValue;
            const change = endValue - startValue;
            const changePercent = startValue > 0 ? (change / startValue) * 100 : 0;
            const changeEmoji = change >= 0 ? '📈' : '📉';
            const changeSign = change >= 0 ? '+' : '';
            
            message += `\n• Change: ${changeEmoji} ${changeSign}$${change.toFixed(2)} (${changeSign}${changePercent.toFixed(1)}%)`;
        }

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: analyticsKeyboard()
        });
    } catch (error: any) {
        console.error('Error in handlePnLPeriod:', error);
        await ctx.editMessageText(
            `📈 **PnL History**\n\n❌ Error: ${error.message}`,
            { 
                parse_mode: 'Markdown',
                reply_markup: analyticsKeyboard()
            }
        );
    }
}

// ==================== TRANSACTION HISTORY ====================

/**
 * Show transaction history (rebalances and claims)
 */
export async function handleTransactionHistory(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        await ctx.answerCbQuery('📋 Loading history...');

        // Get rebalance history
        const rebalanceHistory = analyticsDataStore.loadRebalanceHistory();
        const feeClaims = analyticsDataStore.loadFeeClaims();

        // Combine and sort by timestamp
        const allTransactions: Array<{
            type: 'rebalance' | 'claim';
            timestamp: number;
            details: string;
            signature?: string;
        }> = [];

        for (const reb of rebalanceHistory) {
            allTransactions.push({
                type: 'rebalance',
                timestamp: reb.timestamp,
                details: `Rebalance: $${reb.feesClaimedUsd.toFixed(2)} fees claimed`,
                signature: reb.signature
            });
        }

        for (const claim of feeClaims) {
            allTransactions.push({
                type: 'claim',
                timestamp: claim.timestamp,
                details: `Claimed: $${claim.claimedUsd.toFixed(4)}`,
                signature: claim.signature
            });
        }

        // Sort by timestamp descending
        allTransactions.sort((a, b) => b.timestamp - a.timestamp);

        let message = `📋 **Transaction History**

**Total Transactions:** ${allTransactions.length}
• Rebalances: ${rebalanceHistory.length}
• Fee Claims: ${feeClaims.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Recent Transactions:**
`;

        if (allTransactions.length === 0) {
            message += '\n📭 No transactions recorded yet.';
        } else {
            const recent = allTransactions.slice(0, 10);
            for (const tx of recent) {
                const date = new Date(tx.timestamp).toLocaleDateString();
                const time = new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const typeEmoji = tx.type === 'rebalance' ? '🔄' : '💰';
                
                message += `\n${typeEmoji} ${date} ${time}`;
                message += `\n   ${tx.details}`;
                if (tx.signature) {
                    message += `\n   [View on Solscan](https://solscan.io/tx/${tx.signature})`;
                }
            }
        }

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: analyticsKeyboard(),
            link_preview_options: { is_disabled: true }
        });
    } catch (error: any) {
        console.error('Error in handleTransactionHistory:', error);
        await ctx.editMessageText(
            `📋 **Transaction History**\n\n❌ Error: ${error.message}`,
            { 
                parse_mode: 'Markdown',
                reply_markup: analyticsKeyboard()
            }
        );
    }
}

// ==================== DATA EXPORT ====================

/**
 * Show export menu
 */
export async function handleExportMenu(ctx: BotContext): Promise<void> {
    try {
        await ctx.answerCbQuery();

        const message = `📤 **Export Data**

Select what you'd like to export:

• **Positions Summary** - Current positions with values
• **Historical Snapshots** - Time series data
• **Rebalance History** - All rebalance transactions

Files will be generated in CSV format.`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: analyticsExportKeyboard()
        });
    } catch (error) {
        console.error('Error in handleExportMenu:', error);
        await ctx.answerCbQuery('❌ Error');
    }
}

/**
 * Handle export action
 */
export async function handleExportAction(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const exportType = callbackData.replace('analytics_export_', '');

        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const activeWallet = multiWalletStorage.getActiveWallet(userId);
        if (!activeWallet) {
            await ctx.answerCbQuery('❌ No wallet connected');
            return;
        }

        await ctx.answerCbQuery('📤 Generating export...');

        let filepath: string;
        let fileDescription: string;

        const exportDir = path.join(process.cwd(), 'data', 'exports');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        if (exportType === 'positions') {
            const positions = await positionService.getAllPositions(activeWallet.publicKey);
            const filename = generateTimestampedFilename('positions');
            filepath = exportPositionsSummaryToCSV(positions, filename);
            fileDescription = 'Current Positions Summary';
        } else if (exportType === 'snapshots') {
            const snapshots = analyticsDataStore.loadSnapshots();
            const filename = generateTimestampedFilename('snapshots');
            filepath = exportSnapshotsToCSV(snapshots, filename);
            fileDescription = 'Historical Snapshots';
        } else if (exportType === 'rebalances') {
            const history = analyticsDataStore.loadRebalanceHistory();
            const filename = generateTimestampedFilename('rebalances');
            filepath = exportRebalanceHistoryToCSV(history, filename);
            fileDescription = 'Rebalance History';
        } else {
            await ctx.answerCbQuery('❌ Invalid export type');
            return;
        }

        // Get file size
        const stats = fs.statSync(filepath);
        const fileSize = formatFileSize(stats.size);

        const message = `📤 **Export Complete**

✅ **${fileDescription}**

📁 File: \`${path.basename(filepath)}\`
📊 Size: ${fileSize}
📍 Location: \`${filepath}\`

_Note: File is saved on the server. Download feature coming soon._`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: analyticsExportKeyboard()
        });
    } catch (error: any) {
        console.error('Error in handleExportAction:', error);
        await ctx.editMessageText(
            `📤 **Export**\n\n❌ Export failed: ${error.message}`,
            { 
                parse_mode: 'Markdown',
                reply_markup: analyticsKeyboard()
            }
        );
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Group snapshots by day
 */
function groupSnapshotsByDay(snapshots: AnalyticsSnapshot[], days: number): Array<{
    date: Date;
    totalValue: number;
    totalFees: number;
}> {
    const dailyMap = new Map<string, { value: number; fees: number }>();
    
    for (const snapshot of snapshots) {
        const date = new Date(snapshot.timestamp);
        const dateKey = date.toISOString().split('T')[0];
        
        if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, { value: 0, fees: 0 });
        }
        
        const day = dailyMap.get(dateKey)!;
        day.value = Math.max(day.value, snapshot.usdValue); // Use max value for the day
        day.fees += snapshot.feesUsdValue;
    }

    return Array.from(dailyMap.entries())
        .map(([dateStr, data]) => ({
            date: new Date(dateStr),
            totalValue: data.value,
            totalFees: data.fees
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(-days);
}

/**
 * Build ASCII chart for Telegram
 */
function buildAsciiChart(data: Array<{ date: Date; totalValue: number; totalFees: number }>, metric: 'value' | 'fees'): string {
    if (data.length === 0) {
        return '📭 No data available';
    }

    const values = data.map(d => metric === 'value' ? d.totalValue : d.totalFees);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;

    const chartWidth = 15;
    const chartHeight = 6;
    
    let chart = '```\n';
    
    // Build chart rows
    for (let row = chartHeight - 1; row >= 0; row--) {
        const threshold = minValue + (range * (row / (chartHeight - 1)));
        let line = '';
        
        // Sample data points
        const sampleSize = Math.min(data.length, chartWidth);
        const step = Math.max(1, Math.floor(data.length / sampleSize));
        
        for (let i = 0; i < data.length; i += step) {
            if (line.length >= chartWidth) break;
            const value = values[i];
            line += value >= threshold ? '█' : ' ';
        }
        
        chart += line.padEnd(chartWidth) + '\n';
    }
    
    chart += '─'.repeat(chartWidth) + '\n';
    chart += '```\n';
    
    // Add labels
    const startDate = data[0].date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const endDate = data[data.length - 1].date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    chart += `_${startDate} → ${endDate}_\n`;
    chart += `_Min: $${minValue.toFixed(2)} | Max: $${maxValue.toFixed(2)}_`;

    return chart;
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
