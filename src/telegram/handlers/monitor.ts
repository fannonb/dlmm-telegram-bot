/**
 * Position Monitor Handlers for Telegram Bot
 * 
 * Handles global position monitoring settings:
 * - Enable/disable background monitor
 * - Set check interval
 * - Enable/disable auto-rebalance
 * - View last report
 * - Run manual check
 * 
 * Uses the monitoringScheduler service for background position checking.
 */

import { BotContext } from '../types';
import { monitorSettingsKeyboard, monitorIntervalKeyboard } from '../keyboards';
import { multiWalletStorage } from '../services/walletStorageMulti';
import { monitoringScheduler } from '../services/monitoringScheduler.service';
import { positionService } from '../../services/position.service';
import { poolService } from '../../services/pool.service';
import { llmAgent } from '../../services/llmAgent.service';

// In-memory storage for last report (per-user)
const userLastReports = new Map<number, string>();

// ==================== MONITOR MENU ====================

/**
 * Show position monitor settings menu
 */
export async function handleMonitorSettings(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        // Get state from scheduler
        const state = monitoringScheduler.getMonitorState(userId);
        
        const statusEmoji = state.enabled ? '🟢' : '🔴';
        const statusText = state.enabled ? 'ACTIVE' : 'INACTIVE';
        
        let lastCheckInfo = '';
        if (state.lastCheckTime) {
            const ago = Math.floor((Date.now() - state.lastCheckTime) / 60000);
            if (ago < 1) {
                lastCheckInfo = '\n📅 Last check: Just now';
            } else if (ago < 60) {
                lastCheckInfo = `\n📅 Last check: ${ago} minute${ago === 1 ? '' : 's'} ago`;
            } else {
                const hours = Math.floor(ago / 60);
                lastCheckInfo = `\n📅 Last check: ${hours} hour${hours === 1 ? '' : 's'} ago`;
            }
        }

        // Get scheduler stats
        const schedulerStatus = monitoringScheduler.getStatus();
        const isSchedulerRunning = schedulerStatus.isRunning ? '🟢 Running' : '🔴 Stopped';

        const message = `📡 **Position Monitor**

**Status:** ${statusEmoji} ${statusText}
**Check Interval:** Every ${state.intervalMinutes} minutes
**Auto-Rebalance:** ${state.autoRebalance ? '✅ Enabled' : '❌ Disabled'}
${lastCheckInfo}

**Background Scheduler:** ${isSchedulerRunning}
**Active Monitors:** ${schedulerStatus.activeMonitors}

**How it works:**
1. Monitor checks your positions at set intervals
2. AI analyzes each position's status
3. Alerts are sent when conditions trigger
4. If auto-rebalance is ON, urgent rebalances execute automatically

⚠️ Background monitoring runs continuously when enabled.`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: monitorSettingsKeyboard(state.enabled, state.intervalMinutes, state.autoRebalance)
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleMonitorSettings:', error);
        await ctx.answerCbQuery('❌ Error loading monitor settings');
    }
}

/**
 * Toggle monitor on/off
 */
export async function handleMonitorToggle(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        // Check if user has a wallet
        const activeWallet = multiWalletStorage.getActiveWallet(userId);
        if (!activeWallet) {
            await ctx.answerCbQuery('❌ Connect a wallet first');
            return;
        }

        const state = monitoringScheduler.getMonitorState(userId);
        
        if (state.enabled) {
            // Disable monitoring via scheduler
            monitoringScheduler.disableMonitoring(userId);
            await ctx.answerCbQuery('🔴 Position monitor disabled');
            console.log(`[Monitor] User ${userId} disabled position monitor`);
        } else {
            // Enable monitoring via scheduler
            monitoringScheduler.enableMonitoring(userId, state.intervalMinutes);
            await ctx.answerCbQuery('🟢 Position monitor enabled');
            console.log(`[Monitor] User ${userId} enabled position monitor (${state.intervalMinutes}min)`);
        }

        // Refresh the menu
        await handleMonitorSettings(ctx);
    } catch (error) {
        console.error('Error toggling monitor:', error);
        await ctx.answerCbQuery('❌ Error toggling monitor');
    }
}

/**
 * Show interval selection menu
 */
export async function handleMonitorIntervalMenu(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const state = monitoringScheduler.getMonitorState(userId);

        const message = `⏱️ **Select Check Interval**

Current interval: **${state.intervalMinutes} minutes**

Choose how often to check your positions:

• **15 min** - Most responsive, higher resource usage
• **30 min** - Recommended balance
• **60 min** - Good for stable positions
• **2-4 hours** - Low frequency, for long-term holds

⚠️ Minimum effective interval is 5 minutes.`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: monitorIntervalKeyboard()
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error showing interval menu:', error);
        await ctx.answerCbQuery('❌ Error loading interval options');
    }
}

/**
 * Handle interval selection
 */
export async function handleMonitorIntervalSelect(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const intervalStr = callbackData.replace('monitor_int_', '');
        const interval = parseInt(intervalStr, 10);

        if (isNaN(interval) || interval < 1) {
            await ctx.answerCbQuery('❌ Invalid interval');
            return;
        }

        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        // Update via scheduler
        monitoringScheduler.updateInterval(userId, interval);

        await ctx.answerCbQuery(`✅ Interval set to ${interval} minutes`);
        
        // Go back to monitor settings
        await handleMonitorSettings(ctx);
    } catch (error) {
        console.error('Error setting interval:', error);
        await ctx.answerCbQuery('❌ Error setting interval');
    }
}

/**
 * Toggle auto-rebalance on/off
 */
export async function handleMonitorAutoToggle(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const state = monitoringScheduler.getMonitorState(userId);
        const newValue = !state.autoRebalance;
        
        // Update via scheduler
        monitoringScheduler.setAutoRebalance(userId, newValue);

        if (newValue) {
            await ctx.answerCbQuery('✅ Auto-rebalance enabled');
        } else {
            await ctx.answerCbQuery('❌ Auto-rebalance disabled');
        }

        // Refresh the menu
        await handleMonitorSettings(ctx);
    } catch (error) {
        console.error('Error toggling auto-rebalance:', error);
        await ctx.answerCbQuery('❌ Error toggling auto-rebalance');
    }
}

/**
 * Run a manual position check
 */
export async function handleMonitorRunNow(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        // Get user's active wallet
        const activeWallet = multiWalletStorage.getActiveWallet(userId);
        if (!activeWallet) {
            await ctx.answerCbQuery('❌ No wallet connected');
            return;
        }

        await ctx.answerCbQuery('🔄 Running position check...');

        const state = monitoringScheduler.getMonitorState(userId);
        
        // Fetch all positions
        const positions = await positionService.getAllPositions(activeWallet.publicKey);
        
        // Format results
        let reportText = '📡 **Position Check Results**\n\n';
        
        if (positions.length === 0) {
            reportText += '📭 No positions found to monitor.';
            userLastReports.set(userId, reportText);
            
            await ctx.editMessageText(reportText, {
                parse_mode: 'Markdown',
                reply_markup: monitorSettingsKeyboard(state.enabled, state.intervalMinutes, state.autoRebalance)
            });
            return;
        }

        // Analyze each position
        for (const position of positions) {
            const pairName = `${position.tokenX.symbol}/${position.tokenY.symbol}`;
            
            // Get pool info for price data
            const poolInfo = await poolService.getPoolInfo(position.poolAddress).catch(() => null);
            
            // Get actual USD price for tokenX
            let currentPrice = 0;
            try {
                const { priceService } = await import('../../services/price.service');
                if (poolInfo?.tokenX?.mint) {
                    currentPrice = await priceService.getTokenPrice(poolInfo.tokenX.mint) || 0;
                }
            } catch (e) {
                // Leave as 0
            }
            
            // Calculate bin ratios and convert to USD prices
            const binStep = poolInfo?.binStep || 1;
            const tokenXDecimals = position.tokenX.decimals;
            const tokenYDecimals = position.tokenY.decimals;
            
            const binRatioMin = poolService.calculateBinPrice(position.lowerBinId, binStep, tokenXDecimals, tokenYDecimals);
            const binRatioMax = poolService.calculateBinPrice(position.upperBinId, binStep, tokenXDecimals, tokenYDecimals);
            const binRatioActive = poolService.calculateBinPrice(position.activeBinId, binStep, tokenXDecimals, tokenYDecimals);
            
            // Convert to USD prices relative to current price
            const rangeMinPrice = binRatioActive > 0 && currentPrice > 0 ? currentPrice * (binRatioMin / binRatioActive) : binRatioMin;
            const rangeMaxPrice = binRatioActive > 0 && currentPrice > 0 ? currentPrice * (binRatioMax / binRatioActive) : binRatioMax;
            
            // Get AI analysis if available
            let recommendation = position.inRange ? 'HOLD' : 'REBALANCE';
            let confidence = position.inRange ? 70 : 90;
            let reason = position.inRange ? 'Position is in range' : 'Position is out of range';
            
            if (llmAgent.isAvailable()) {
                try {
                    const aiDecision = await llmAgent.analyzePosition(position);
                    recommendation = aiDecision.action.toUpperCase();
                    confidence = aiDecision.confidence;
                    reason = aiDecision.reasoning[0] || reason;
                } catch (e) {
                    // Use fallback analysis
                }
            }
            
            const statusEmoji = recommendation === 'REBALANCE' ? '🔴' :
                               recommendation === 'HOLD' ? '🟢' : '🟡';
            
            reportText += `${statusEmoji} **${pairName}**\n`;
            reportText += `   💵 Price: $${currentPrice.toFixed(4)}\n`;
            reportText += `   📊 Range: $${rangeMinPrice.toFixed(4)} - $${rangeMaxPrice.toFixed(4)}\n`;
            reportText += `   ${position.inRange ? '✅ In Range' : '❌ Out of Range'}\n`;
            reportText += `   📋 ${recommendation} (${confidence}%)\n`;
            reportText += `   _${reason}_\n\n`;
        }

        // Store report locally for viewing later
        userLastReports.set(userId, reportText);
        
        // Also trigger scheduler's background check for notifications
        monitoringScheduler.forceCheck(userId).catch(err => {
            console.error('Error in force check:', err);
        });

        await ctx.editMessageText(reportText, {
            parse_mode: 'Markdown',
            reply_markup: monitorSettingsKeyboard(state.enabled, state.intervalMinutes, state.autoRebalance)
        });
    } catch (error) {
        console.error('Error running manual check:', error);
        
        const userId = ctx.from?.id || 0;
        const state = monitoringScheduler.getMonitorState(userId);
        
        await ctx.editMessageText(
            '❌ **Error Running Check**\n\nCould not complete position check. Please try again later.',
            { 
                parse_mode: 'Markdown',
                reply_markup: monitorSettingsKeyboard(state.enabled, state.intervalMinutes, state.autoRebalance)
            }
        );
    }
}

/**
 * View last report
 */
export async function handleMonitorLastReport(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const state = monitoringScheduler.getMonitorState(userId);
        const lastReport = userLastReports.get(userId);

        if (!lastReport) {
            await ctx.answerCbQuery('No previous report available');
            
            await ctx.editMessageText(
                '📭 **No Previous Report**\n\nRun a position check first to generate a report.',
                { 
                    parse_mode: 'Markdown',
                    reply_markup: monitorSettingsKeyboard(state.enabled, state.intervalMinutes, state.autoRebalance)
                }
            );
            return;
        }

        await ctx.answerCbQuery();
        await ctx.editMessageText(lastReport, {
            parse_mode: 'Markdown',
            reply_markup: monitorSettingsKeyboard(state.enabled, state.intervalMinutes, state.autoRebalance)
        });
    } catch (error) {
        console.error('Error showing last report:', error);
        await ctx.answerCbQuery('❌ Error loading report');
    }
}
