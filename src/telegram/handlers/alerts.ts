/**
 * Alerts Handler for Telegram Bot
 * 
 * Manages user alert configurations:
 * - Out of range alerts
 * - Near edge alerts
 * - Fee threshold alerts
 * - Custom price alerts
 */

import { BotContext } from '../types';
import { alertsKeyboard, priceAlertPoolKeyboard, feeThresholdKeyboard } from '../keyboards';
import { userDataService } from '../services/userDataService';
import { multiWalletStorage } from '../services/walletStorageMulti';
import { positionService } from '../../services/position.service';

// ==================== ALERTS MENU ====================

/**
 * Show alerts configuration menu
 */
export async function handleAlertsMenu(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        // Get user's alert config
        const config = userDataService.getConfig(userId);
        const alerts = config.alerts;

        // Count active price alerts
        const activePriceAlerts = alerts.priceAlerts?.filter(a => a.enabled).length || 0;

        const message = `⚠️ **Alert Settings**

**Position Alerts:**
${alerts.outOfRangeEnabled ? '✅' : '❌'} Out of Range - Notify when position leaves range
${alerts.nearEdgeEnabled ? '✅' : '❌'} Near Edge (${alerts.nearEdgeThreshold} bins) - Notify when approaching edge

**Fee Alerts:**
${alerts.feeThresholdEnabled ? '✅' : '❌'} Fee Threshold ($${alerts.feeThresholdUsd}) - Notify when fees accumulate

**Rebalance Suggestions:**
${alerts.rebalanceSuggestionsEnabled ? '✅' : '❌'} AI Suggestions - Get LLM-powered rebalance recommendations

**Price Alerts:** ${activePriceAlerts} active

Configure your alerts below:`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: alertsKeyboard({
                outOfRange: alerts.outOfRangeEnabled,
                nearEdge: alerts.nearEdgeEnabled,
                fees: alerts.feeThresholdEnabled,
                rebalanceSuggestions: alerts.rebalanceSuggestionsEnabled
            })
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleAlertsMenu:', error);
        await ctx.answerCbQuery('❌ Error loading alerts');
    }
}

/**
 * Toggle out-of-range alerts
 */
export async function handleToggleOutOfRange(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        config.alerts.outOfRangeEnabled = !config.alerts.outOfRangeEnabled;
        userDataService.saveConfig(userId, config);

        const status = config.alerts.outOfRangeEnabled ? '✅ Enabled' : '❌ Disabled';
        await ctx.answerCbQuery(`Out of Range alerts: ${status}`);

        // Refresh menu
        await handleAlertsMenu(ctx);
    } catch (error) {
        console.error('Error toggling out of range:', error);
        await ctx.answerCbQuery('❌ Error updating setting');
    }
}

/**
 * Toggle near-edge alerts
 */
export async function handleToggleNearEdge(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        config.alerts.nearEdgeEnabled = !config.alerts.nearEdgeEnabled;
        userDataService.saveConfig(userId, config);

        const status = config.alerts.nearEdgeEnabled ? '✅ Enabled' : '❌ Disabled';
        await ctx.answerCbQuery(`Near Edge alerts: ${status}`);

        // Refresh menu
        await handleAlertsMenu(ctx);
    } catch (error) {
        console.error('Error toggling near edge:', error);
        await ctx.answerCbQuery('❌ Error updating setting');
    }
}

/**
 * Toggle fee threshold alerts
 */
export async function handleToggleFeeThreshold(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        config.alerts.feeThresholdEnabled = !config.alerts.feeThresholdEnabled;
        userDataService.saveConfig(userId, config);

        const status = config.alerts.feeThresholdEnabled ? '✅ Enabled' : '❌ Disabled';
        await ctx.answerCbQuery(`Fee Threshold alerts: ${status}`);

        // Refresh menu
        await handleAlertsMenu(ctx);
    } catch (error) {
        console.error('Error toggling fee threshold:', error);
        await ctx.answerCbQuery('❌ Error updating setting');
    }
}

/**
 * Toggle rebalance suggestions
 */
export async function handleToggleRebalanceSuggestions(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        config.alerts.rebalanceSuggestionsEnabled = !config.alerts.rebalanceSuggestionsEnabled;
        userDataService.saveConfig(userId, config);

        const status = config.alerts.rebalanceSuggestionsEnabled ? '✅ Enabled' : '❌ Disabled';
        await ctx.answerCbQuery(`Rebalance suggestions: ${status}`);

        // Refresh menu
        await handleAlertsMenu(ctx);
    } catch (error) {
        console.error('Error toggling rebalance suggestions:', error);
        await ctx.answerCbQuery('❌ Error updating setting');
    }
}

/**
 * Show fee threshold configuration
 */
export async function handleFeeThresholdConfig(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        const currentThreshold = config.alerts.feeThresholdUsd;

        const message = `💰 **Fee Threshold Configuration**

Current threshold: **$${currentThreshold}**

You'll be notified when unclaimed fees exceed this amount.

Select a threshold:`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: feeThresholdKeyboard(currentThreshold)
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error showing fee threshold config:', error);
        await ctx.answerCbQuery('❌ Error loading config');
    }
}

/**
 * Set fee threshold value
 */
export async function handleSetFeeThreshold(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const thresholdStr = callbackData.replace('alert_fee_', '');
        
        // Handle custom input
        if (thresholdStr === 'custom') {
            ctx.session.currentFlow = 'fee_threshold_input';
            await ctx.editMessageText(
                '💰 **Custom Fee Threshold**\n\nEnter your desired fee threshold in USD (e.g., `25` for $25):',
                { parse_mode: 'Markdown' }
            );
            await ctx.answerCbQuery();
            return;
        }

        const threshold = parseFloat(thresholdStr);
        if (isNaN(threshold) || threshold < 0) {
            await ctx.answerCbQuery('❌ Invalid threshold');
            return;
        }

        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        config.alerts.feeThresholdUsd = threshold;
        config.alerts.feeThresholdEnabled = true;
        userDataService.saveConfig(userId, config);

        await ctx.answerCbQuery(`✅ Fee threshold set to $${threshold}`);

        // Go back to alerts menu
        await handleAlertsMenu(ctx);
    } catch (error) {
        console.error('Error setting fee threshold:', error);
        await ctx.answerCbQuery('❌ Error updating threshold');
    }
}

/**
 * Process custom fee threshold input
 */
export async function processFeeThresholdInput(ctx: BotContext, input: string): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.reply('❌ User not found');
            ctx.session.currentFlow = 'idle';
            return;
        }

        const threshold = parseFloat(input.replace('$', '').trim());
        if (isNaN(threshold) || threshold < 0) {
            await ctx.reply('❌ Invalid amount. Please enter a positive number (e.g., `25` for $25):', {
                parse_mode: 'Markdown'
            });
            return;
        }

        const config = userDataService.getConfig(userId);
        config.alerts.feeThresholdUsd = threshold;
        config.alerts.feeThresholdEnabled = true;
        userDataService.saveConfig(userId, config);

        ctx.session.currentFlow = 'idle';

        await ctx.reply(`✅ Fee threshold set to **$${threshold}**`, {
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error processing fee threshold:', error);
        await ctx.reply('❌ Error setting threshold');
        ctx.session.currentFlow = 'idle';
    }
}

/**
 * Configure near edge threshold (bins)
 */
export async function handleNearEdgeConfig(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        const current = config.alerts.nearEdgeThreshold;

        const message = `📏 **Near Edge Threshold**

Current: **${current} bins**

You'll be notified when price is within this many bins of your range edge.

Select threshold:`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: current === 3 ? '✅ 3 bins' : '3 bins', callback_data: 'alert_edge_3' },
                    { text: current === 5 ? '✅ 5 bins' : '5 bins', callback_data: 'alert_edge_5' },
                ],
                [
                    { text: current === 10 ? '✅ 10 bins' : '10 bins', callback_data: 'alert_edge_10' },
                    { text: current === 15 ? '✅ 15 bins' : '15 bins', callback_data: 'alert_edge_15' },
                ],
                [{ text: '⬅️ Back', callback_data: 'settings_alerts' }],
            ],
        };

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error showing near edge config:', error);
        await ctx.answerCbQuery('❌ Error loading config');
    }
}

/**
 * Set near edge threshold
 */
export async function handleSetNearEdgeThreshold(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const threshold = parseInt(callbackData.replace('alert_edge_', ''), 10);

        if (isNaN(threshold) || threshold < 1) {
            await ctx.answerCbQuery('❌ Invalid threshold');
            return;
        }

        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        config.alerts.nearEdgeThreshold = threshold;
        userDataService.saveConfig(userId, config);

        await ctx.answerCbQuery(`✅ Near edge threshold set to ${threshold} bins`);

        // Go back to alerts menu
        await handleAlertsMenu(ctx);
    } catch (error) {
        console.error('Error setting near edge threshold:', error);
        await ctx.answerCbQuery('❌ Error updating threshold');
    }
}

// ==================== PRICE ALERTS ====================

/**
 * Start price alert creation flow
 */
export async function handleAddPriceAlert(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        // Get user's positions to suggest pools
        const activeWallet = multiWalletStorage.getActiveWallet(userId);
        if (!activeWallet) {
            await ctx.answerCbQuery('❌ No wallet connected');
            return;
        }

        const positions = await positionService.getAllPositions(activeWallet.publicKey);

        if (positions.length === 0) {
            await ctx.editMessageText(
                '📭 **No Positions Found**\n\nYou need active positions to create price alerts.\n\nCreate a position first, then set up price alerts.',
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'settings_alerts' }]]
                    }
                }
            );
            await ctx.answerCbQuery();
            return;
        }

        // Build pool selection keyboard
        const poolButtons = positions.slice(0, 5).map(pos => [{
            text: `${pos.tokenX.symbol}/${pos.tokenY.symbol}`,
            callback_data: `alert_pool_${pos.poolAddress.slice(0, 20)}`
        }]);

        poolButtons.push([{ text: '⬅️ Back', callback_data: 'settings_alerts' }]);

        const message = `➕ **Add Price Alert**

Select a pool to set a price alert:`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: poolButtons }
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleAddPriceAlert:', error);
        await ctx.answerCbQuery('❌ Error loading pools');
    }
}

/**
 * Handle pool selection for price alert
 */
export async function handlePriceAlertPoolSelect(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const poolPrefix = callbackData.replace('alert_pool_', '');

        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        // Find full pool address
        const activeWallet = multiWalletStorage.getActiveWallet(userId);
        if (!activeWallet) {
            await ctx.answerCbQuery('❌ No wallet');
            return;
        }

        const positions = await positionService.getAllPositions(activeWallet.publicKey);
        const position = positions.find(p => p.poolAddress.startsWith(poolPrefix));

        if (!position) {
            await ctx.answerCbQuery('❌ Pool not found');
            return;
        }

        // Store in flow data
        ctx.session.currentFlow = 'price_alert_direction';
        ctx.session.flowData = {
            alertPoolAddress: position.poolAddress,
            alertTokenSymbol: `${position.tokenX.symbol}/${position.tokenY.symbol}`
        };

        const message = `📊 **Price Alert for ${position.tokenX.symbol}/${position.tokenY.symbol}**

Select alert direction:

• **Above** - Alert when price goes above target
• **Below** - Alert when price drops below target`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📈 Price Above', callback_data: 'alert_dir_above' },
                        { text: '📉 Price Below', callback_data: 'alert_dir_below' },
                    ],
                    [{ text: '⬅️ Back', callback_data: 'alert_add_price' }],
                ]
            }
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error selecting pool:', error);
        await ctx.answerCbQuery('❌ Error selecting pool');
    }
}

/**
 * Handle price alert direction selection
 */
export async function handlePriceAlertDirection(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const direction = callbackData.replace('alert_dir_', '') as 'above' | 'below';

        if (!ctx.session.flowData?.alertPoolAddress) {
            await ctx.answerCbQuery('❌ Session expired');
            ctx.session.currentFlow = 'idle';
            return;
        }

        ctx.session.flowData.alertDirection = direction;
        ctx.session.currentFlow = 'price_alert_input';

        const dirText = direction === 'above' ? 'goes above' : 'drops below';

        await ctx.editMessageText(
            `💵 **Set Target Price**\n\nEnter the price at which you want to be alerted when ${ctx.session.flowData.alertTokenSymbol} ${dirText}:\n\n_Example: 150.50_`,
            { parse_mode: 'Markdown' }
        );
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error setting direction:', error);
        await ctx.answerCbQuery('❌ Error');
        ctx.session.currentFlow = 'idle';
    }
}

/**
 * Process price alert target price input
 */
export async function processPriceAlertInput(ctx: BotContext, input: string): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.reply('❌ User not found');
            ctx.session.currentFlow = 'idle';
            return;
        }

        const flowData = ctx.session.flowData;
        if (!flowData?.alertPoolAddress || !flowData?.alertDirection) {
            await ctx.reply('❌ Session expired. Please start over.');
            ctx.session.currentFlow = 'idle';
            return;
        }

        const targetPrice = parseFloat(input.replace('$', '').trim());
        if (isNaN(targetPrice) || targetPrice <= 0) {
            await ctx.reply('❌ Invalid price. Please enter a positive number (e.g., `150.50`):',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Save the price alert
        const config = userDataService.getConfig(userId);
        
        const newAlert = {
            poolAddress: flowData.alertPoolAddress,
            tokenSymbol: flowData.alertTokenSymbol || 'Unknown',
            targetPrice: targetPrice,
            direction: flowData.alertDirection as 'above' | 'below',
            enabled: true,
            createdAt: Date.now()
        };

        if (!config.alerts.priceAlerts) {
            config.alerts.priceAlerts = [];
        }
        config.alerts.priceAlerts.push(newAlert);
        userDataService.saveConfig(userId, config);

        ctx.session.currentFlow = 'idle';
        ctx.session.flowData = undefined;

        const dirText = flowData.alertDirection === 'above' ? 'goes above' : 'drops below';

        await ctx.reply(
            `✅ **Price Alert Created!**\n\nYou'll be notified when **${flowData.alertTokenSymbol}** ${dirText} **$${targetPrice}**`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error creating price alert:', error);
        await ctx.reply('❌ Error creating alert');
        ctx.session.currentFlow = 'idle';
    }
}

/**
 * List user's price alerts
 */
export async function handleListPriceAlerts(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        const alerts = config.alerts.priceAlerts || [];

        if (alerts.length === 0) {
            await ctx.editMessageText(
                '📭 **No Price Alerts**\n\nYou haven\'t set up any price alerts yet.\n\nUse "Add Price Alert" to create one.',
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '➕ Add Price Alert', callback_data: 'alert_add_price' }],
                            [{ text: '⬅️ Back', callback_data: 'settings_alerts' }],
                        ]
                    }
                }
            );
            await ctx.answerCbQuery();
            return;
        }

        let message = `📋 **Your Price Alerts** (${alerts.length})\n\n`;

        alerts.forEach((alert, index) => {
            const status = alert.enabled ? '✅' : '❌';
            const direction = alert.direction === 'above' ? '📈 >' : '📉 <';
            message += `${status} **${alert.tokenSymbol}** ${direction} $${alert.targetPrice}\n`;
        });

        // Build delete buttons (max 5)
        const deleteButtons = alerts.slice(0, 5).map((alert, index) => [{
            text: `🗑️ Delete: ${alert.tokenSymbol} ${alert.direction === 'above' ? '>' : '<'} $${alert.targetPrice}`,
            callback_data: `alert_delete_${index}`
        }]);

        deleteButtons.push([{ text: '🗑️ Clear All', callback_data: 'alert_clear_all' }]);
        deleteButtons.push([{ text: '⬅️ Back', callback_data: 'settings_alerts' }]);

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: deleteButtons }
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error listing price alerts:', error);
        await ctx.answerCbQuery('❌ Error loading alerts');
    }
}

/**
 * Delete a specific price alert
 */
export async function handleDeletePriceAlert(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const indexStr = callbackData.replace('alert_delete_', '');
        const index = parseInt(indexStr, 10);

        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        
        if (!config.alerts.priceAlerts || index >= config.alerts.priceAlerts.length) {
            await ctx.answerCbQuery('❌ Alert not found');
            return;
        }

        const deleted = config.alerts.priceAlerts.splice(index, 1)[0];
        userDataService.saveConfig(userId, config);

        await ctx.answerCbQuery(`✅ Deleted alert for ${deleted.tokenSymbol}`);

        // Refresh list
        await handleListPriceAlerts(ctx);
    } catch (error) {
        console.error('Error deleting alert:', error);
        await ctx.answerCbQuery('❌ Error deleting alert');
    }
}

/**
 * Clear all price alerts
 */
export async function handleClearAllAlerts(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        const count = config.alerts.priceAlerts?.length || 0;
        config.alerts.priceAlerts = [];
        userDataService.saveConfig(userId, config);

        await ctx.answerCbQuery(`✅ Cleared ${count} price alerts`);

        // Go back to alerts menu
        await handleAlertsMenu(ctx);
    } catch (error) {
        console.error('Error clearing alerts:', error);
        await ctx.answerCbQuery('❌ Error clearing alerts');
    }
}
