/**
 * Notifications Handler for Telegram Bot
 * 
 * Manages user notification preferences:
 * - Master notification toggle
 * - Daily summary reports
 * - Notification history
 */

import { BotContext } from '../types';
import { notificationsKeyboard } from '../keyboards';
import { userDataService } from '../services/userDataService';

// ==================== NOTIFICATIONS MENU ====================

/**
 * Show notification preferences menu
 */
export async function handleNotificationsMenu(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        const prefs = config.preferences;

        const masterStatus = prefs.notificationsEnabled ? '🟢 ON' : '🔴 OFF';
        const dailyStatus = prefs.dailySummaryEnabled ? '✅ Enabled' : '❌ Disabled';
        const alertsStatus = prefs.alertsEnabled ? '✅ Enabled' : '❌ Disabled';

        const message = `🔔 **Notification Settings**

**Master Toggle:** ${masterStatus}
${!prefs.notificationsEnabled ? '_All notifications are disabled_\n' : ''}
**Position Alerts:** ${alertsStatus}
**Daily Summary:** ${dailyStatus}

**When enabled, you'll receive:**
• 🔴 Out of range alerts
• ⚠️ Near edge warnings
• 💰 Fee threshold notifications
• 💡 Rebalance suggestions
• 📊 Daily portfolio summary (08:00 UTC)

Configure your preferences below:`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: notificationsKeyboard({
                notificationsEnabled: prefs.notificationsEnabled,
                alertsEnabled: prefs.alertsEnabled,
                dailySummaryEnabled: prefs.dailySummaryEnabled
            })
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleNotificationsMenu:', error);
        await ctx.answerCbQuery('❌ Error loading notifications');
    }
}

/**
 * Toggle master notifications
 */
export async function handleToggleNotifications(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        config.preferences.notificationsEnabled = !config.preferences.notificationsEnabled;
        userDataService.saveConfig(userId, config);

        const status = config.preferences.notificationsEnabled ? '🟢 ON' : '🔴 OFF';
        await ctx.answerCbQuery(`Notifications: ${status}`);

        // Refresh menu
        await handleNotificationsMenu(ctx);
    } catch (error) {
        console.error('Error toggling notifications:', error);
        await ctx.answerCbQuery('❌ Error updating setting');
    }
}

/**
 * Toggle alerts notifications
 */
export async function handleToggleAlertsNotifications(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        config.preferences.alertsEnabled = !config.preferences.alertsEnabled;
        userDataService.saveConfig(userId, config);

        const status = config.preferences.alertsEnabled ? '✅ Enabled' : '❌ Disabled';
        await ctx.answerCbQuery(`Position alerts: ${status}`);

        // Refresh menu
        await handleNotificationsMenu(ctx);
    } catch (error) {
        console.error('Error toggling alerts:', error);
        await ctx.answerCbQuery('❌ Error updating setting');
    }
}

/**
 * Toggle daily summary
 */
export async function handleToggleDailySummary(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const config = userDataService.getConfig(userId);
        config.preferences.dailySummaryEnabled = !config.preferences.dailySummaryEnabled;
        userDataService.saveConfig(userId, config);

        const status = config.preferences.dailySummaryEnabled ? '✅ Enabled' : '❌ Disabled';
        await ctx.answerCbQuery(`Daily summary: ${status}`);

        // Refresh menu
        await handleNotificationsMenu(ctx);
    } catch (error) {
        console.error('Error toggling daily summary:', error);
        await ctx.answerCbQuery('❌ Error updating setting');
    }
}

/**
 * Show notification history (recent alerts sent)
 */
export async function handleNotificationHistory(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        // Get notification history from user data
        const history = userDataService.getNotificationHistory(userId);

        if (!history || history.length === 0) {
            await ctx.editMessageText(
                '📭 **No Notification History**\n\nYou haven\'t received any notifications yet.\n\nEnable notifications and set up alerts to start receiving them.',
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'settings_notifications' }]]
                    }
                }
            );
            await ctx.answerCbQuery();
            return;
        }

        let message = `📜 **Recent Notifications** (${Math.min(history.length, 10)})\n\n`;

        // Show last 10 notifications
        const recent = history.slice(-10).reverse();
        for (const notif of recent) {
            const time = new Date(notif.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const icon = getNotificationIcon(notif.type);
            message += `${icon} ${time}\n_${notif.message.slice(0, 50)}${notif.message.length > 50 ? '...' : ''}_\n\n`;
        }

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🗑️ Clear History', callback_data: 'notif_clear_history' }],
                    [{ text: '⬅️ Back', callback_data: 'settings_notifications' }]
                ]
            }
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error showing notification history:', error);
        await ctx.answerCbQuery('❌ Error loading history');
    }
}

/**
 * Clear notification history
 */
export async function handleClearNotificationHistory(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        userDataService.clearNotificationHistory(userId);
        await ctx.answerCbQuery('✅ Notification history cleared');

        // Go back to notifications menu
        await handleNotificationsMenu(ctx);
    } catch (error) {
        console.error('Error clearing history:', error);
        await ctx.answerCbQuery('❌ Error clearing history');
    }
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
        'OUT_OF_RANGE': '🔴',
        'NEAR_EDGE': '⚠️',
        'FEE_THRESHOLD': '💰',
        'PRICE_ALERT': '📊',
        'REBALANCE_SUGGESTION': '💡',
        'DAILY_SUMMARY': '📈',
        'REBALANCE_EXECUTED': '✅',
        'ERROR': '❌',
        'INFO': 'ℹ️'
    };
    return icons[type] || '📌';
}
