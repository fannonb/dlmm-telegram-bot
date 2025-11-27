/**
 * Telegram Notifications Service
 * 
 * Sends push notifications to Telegram users based on their alert configuration.
 * Integrates with the monitoring system to deliver real-time alerts.
 * 
 * Each alert includes actionable buttons for immediate user response.
 */

import { Telegraf, Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { userDataService } from './userDataService';
import { multiWalletStorage } from './walletStorageMulti';
import { positionService } from '../../services/position.service';
import { poolService } from '../../services/pool.service';
import { monitoringService, Alert } from '../../services/monitoring.service';

export interface TelegramAlert {
    type: 'OUT_OF_RANGE' | 'NEAR_EDGE' | 'FEE_THRESHOLD' | 'PRICE_ALERT' | 'REBALANCE_SUGGESTION' | 'DAILY_SUMMARY' | 'INFO' | 'ERROR';
    title: string;
    message: string;
    positionAddress?: string;
    poolAddress?: string;
    metadata?: Record<string, any>;
    timestamp: number;
    keyboard?: InlineKeyboardMarkup;
}

export interface PortfolioSummary {
    totalValueUsd: number;
    positionsCount: number;
    inRangeCount: number;
    outOfRangeCount: number;
    totalUnclaimedFeesUsd: number;
    topPerformer?: {
        pair: string;
        feesUsd: number;
    };
    alertsTriggered: number;
}

class TelegramNotificationsService {
    private bot: Telegraf<any> | null = null;

    /**
     * Initialize with bot instance
     */
    initialize(bot: Telegraf<any>): void {
        this.bot = bot;
        console.log('[TelegramNotifications] Service initialized');
    }

    /**
     * Check if user should receive notifications
     */
    shouldNotify(telegramId: number, type?: string): boolean {
        try {
            const config = userDataService.getConfig(telegramId);
            
            // Master toggle must be on
            if (!config.preferences.notificationsEnabled) {
                return false;
            }

            // Check specific alert type
            if (type === 'DAILY_SUMMARY') {
                return config.preferences.dailySummaryEnabled;
            }

            // All other alerts require alertsEnabled
            return config.preferences.alertsEnabled;
        } catch (error) {
            return false;
        }
    }

    /**
     * Build action keyboard for position-related alerts
     */
    private buildPositionActionKeyboard(positionAddress: string, actions: ('rebalance' | 'claim' | 'analyze' | 'view' | 'close')[]): InlineKeyboardMarkup {
        const shortAddr = positionAddress.slice(0, 8);
        const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
        
        const actionMap: Record<string, { text: string; callback: string }> = {
            rebalance: { text: '🔄 Rebalance Now', callback: `pos_rebalance_${shortAddr}` },
            claim: { text: '💰 Claim Fees', callback: `pos_claim_${shortAddr}` },
            analyze: { text: '🤖 AI Analysis', callback: `pos_ai_${shortAddr}` },
            view: { text: '📊 View Details', callback: `pos_detail_${shortAddr}` },
            close: { text: '❌ Close Position', callback: `pos_close_${shortAddr}` }
        };

        // Add primary actions (2 per row)
        const primaryActions = actions.slice(0, 2);
        if (primaryActions.length > 0) {
            buttons.push(primaryActions.map(action => ({
                text: actionMap[action].text,
                callback_data: actionMap[action].callback
            })));
        }

        // Add secondary actions
        const secondaryActions = actions.slice(2);
        if (secondaryActions.length > 0) {
            buttons.push(secondaryActions.map(action => ({
                text: actionMap[action].text,
                callback_data: actionMap[action].callback
            })));
        }

        // Add dismiss button
        buttons.push([{ text: '✓ Dismiss', callback_data: 'alert_dismiss' }]);

        return { inline_keyboard: buttons };
    }

    /**
     * Send a generic alert notification with optional keyboard
     */
    async sendAlert(telegramId: number, alert: TelegramAlert): Promise<boolean> {
        if (!this.bot) {
            console.error('[TelegramNotifications] Bot not initialized');
            return false;
        }

        if (!this.shouldNotify(telegramId, alert.type)) {
            return false;
        }

        try {
            const icon = this.getAlertIcon(alert.type);
            let message = `${icon} **${alert.title}**\n\n${alert.message}`;

            if (alert.positionAddress) {
                message += `\n\n📍 Position: \`${alert.positionAddress.slice(0, 8)}...\``;
            }

            const options: any = {
                parse_mode: 'Markdown'
            };

            if (alert.keyboard) {
                options.reply_markup = alert.keyboard;
            }

            await this.bot.telegram.sendMessage(telegramId, message, options);

            // Log notification to user history
            this.logNotification(telegramId, alert);

            return true;
        } catch (error: any) {
            console.error(`[TelegramNotifications] Failed to send to ${telegramId}:`, error.message);
            return false;
        }
    }

    /**
     * Send position out of range alert with rebalance action
     */
    async sendOutOfRangeAlert(
        telegramId: number,
        positionAddress: string,
        pair: string,
        activeBin: number,
        rangeMin: number,
        rangeMax: number,
        currentPrice?: number
    ): Promise<boolean> {
        const priceInfo = currentPrice ? `$${currentPrice.toFixed(4)}` : 'N/A';
        const shortAddr = positionAddress.slice(0, 6) + '...' + positionAddress.slice(-4);
        
        const alert: TelegramAlert = {
            type: 'OUT_OF_RANGE',
            title: '🚨 OUT OF RANGE',
            message: `**${pair}** | \`${shortAddr}\`

⚠️ **Earning $0** - Price moved outside your range
💵 Current: ${priceInfo}

Tap Rebalance to get AI-optimized range suggestion.`,
            positionAddress,
            timestamp: Date.now(),
            keyboard: this.buildPositionActionKeyboard(positionAddress, ['rebalance', 'analyze', 'view'])
        };

        return this.sendAlert(telegramId, alert);
    }

    /**
     * Send near edge warning with proactive options
     */
    async sendNearEdgeAlert(
        telegramId: number,
        positionAddress: string,
        pair: string,
        binsFromEdge: number,
        direction: 'lower' | 'upper',
        currentPrice?: number
    ): Promise<boolean> {
        const edgeText = direction === 'lower' ? 'lower edge' : 'upper edge';
        const priceInfo = currentPrice ? `$${currentPrice.toFixed(4)}` : 'N/A';
        const shortAddr = positionAddress.slice(0, 6) + '...' + positionAddress.slice(-4);
        
        const urgency = binsFromEdge <= 2 ? '🔴' : binsFromEdge <= 5 ? '🟠' : '🟡';
        const urgencyText = binsFromEdge <= 2 ? 'CRITICAL' : binsFromEdge <= 5 ? 'WARNING' : 'NOTICE';
        
        const alert: TelegramAlert = {
            type: 'NEAR_EDGE',
            title: `${urgency} ${urgencyText}: Near Edge`,
            message: `**${pair}** | \`${shortAddr}\`

📍 **${binsFromEdge} bins** from ${edgeText}
💵 Price: ${priceInfo}

${binsFromEdge <= 2 ? 'May go out of range soon.' : 'Monitor or rebalance proactively.'}`,
            positionAddress,
            timestamp: Date.now(),
            keyboard: this.buildPositionActionKeyboard(positionAddress, ['analyze', 'rebalance', 'view'])
        };

        return this.sendAlert(telegramId, alert);
    }

    /**
     * Send fee threshold alert with claim action
     */
    async sendFeeThresholdAlert(
        telegramId: number,
        positionAddress: string,
        pair: string,
        feesUsd: number,
        threshold: number
    ): Promise<boolean> {
        const alert: TelegramAlert = {
            type: 'FEE_THRESHOLD',
            title: '💰 Fee Threshold Reached!',
            message: `Your **${pair}** position has accumulated:

💵 **$${feesUsd.toFixed(2)}** in unclaimed fees
🎯 Your threshold: $${threshold}

**Options:**
• **Claim fees** to realize your earnings
• **Compound** to add fees back to position
• **Wait** to accumulate more (if gas costs are high)`,
            positionAddress,
            timestamp: Date.now(),
            keyboard: {
                inline_keyboard: [
                    [
                        { text: '💰 Claim Fees', callback_data: `pos_claim_${positionAddress.slice(0, 8)}` },
                        { text: '🔄 Compound', callback_data: `pos_compound_${positionAddress.slice(0, 8)}` }
                    ],
                    [
                        { text: '📊 View Position', callback_data: `pos_detail_${positionAddress.slice(0, 8)}` }
                    ],
                    [{ text: '✓ Dismiss', callback_data: 'alert_dismiss' }]
                ]
            }
        };

        return this.sendAlert(telegramId, alert);
    }

    /**
     * Send price alert notification with trading options
     */
    async sendPriceAlert(
        telegramId: number,
        pair: string,
        currentPrice: number,
        targetPrice: number,
        direction: 'above' | 'below',
        poolAddress?: string
    ): Promise<boolean> {
        const dirText = direction === 'above' ? 'risen above' : 'dropped below';
        const emoji = direction === 'above' ? '📈' : '📉';
        
        const keyboard: InlineKeyboardMarkup = poolAddress ? {
            inline_keyboard: [
                [
                    { text: '➕ Create Position', callback_data: `pool_newpos_${poolAddress.slice(0, 16)}` },
                    { text: '📊 View Pool', callback_data: `pool_detail_${poolAddress.slice(0, 16)}` }
                ],
                [{ text: '✓ Dismiss', callback_data: 'alert_dismiss' }]
            ]
        } : {
            inline_keyboard: [
                [{ text: '🔍 Browse Pools', callback_data: 'pools_menu' }],
                [{ text: '✓ Dismiss', callback_data: 'alert_dismiss' }]
            ]
        };

        const alert: TelegramAlert = {
            type: 'PRICE_ALERT',
            title: `${emoji} Price Alert Triggered!`,
            message: `**${pair}** has ${dirText} your target!

💵 Current Price: **$${currentPrice.toFixed(4)}**
🎯 Your Target: $${targetPrice.toFixed(4)}

**What you can do:**
• Create a new position at this price level
• Check your existing positions
• Set a new price alert`,
            timestamp: Date.now(),
            poolAddress,
            keyboard
        };

        return this.sendAlert(telegramId, alert);
    }

    /**
     * Send rebalance suggestion with one-click action
     */
    async sendRebalanceSuggestion(
        telegramId: number,
        positionAddress: string,
        pair: string,
        reason: string,
        confidence: number,
        suggestedAction?: string,
        rangeInfo?: {
            currentPrice: number;
            currentRange: { minPrice: number; maxPrice: number };
            suggestedRange: { minPrice: number; maxPrice: number };
        }
    ): Promise<boolean> {
        const confidenceEmoji = confidence >= 80 ? '🟢' : confidence >= 60 ? '🟡' : '🔴';
        const shortAddr = positionAddress.slice(0, 6) + '...' + positionAddress.slice(-4);
        
        // Helper to format price
        const formatPrice = (price: number): string => {
            if (price >= 1000) return `$${price.toFixed(2)}`;
            if (price >= 1) return `$${price.toFixed(4)}`;
            return `$${price.toFixed(6)}`;
        };
        
        let message = `🤖 **${pair}** | \`${shortAddr}\`

${confidenceEmoji} **${suggestedAction || 'REBALANCE'}** (${confidence}%)
${reason}`;

        // Add suggested range only
        if (rangeInfo?.suggestedRange) {
            message += `

🎯 **Suggested:** ${formatPrice(rangeInfo.suggestedRange.minPrice)} → ${formatPrice(rangeInfo.suggestedRange.maxPrice)}`;
        }
        
        const alert: TelegramAlert = {
            type: 'REBALANCE_SUGGESTION',
            title: '🤖 AI Recommendation',
            message,
            positionAddress,
            timestamp: Date.now(),
            keyboard: {
                inline_keyboard: [
                    [
                        { text: '🔄 Rebalance', callback_data: `pos_rebalance_${positionAddress.slice(0, 8)}` },
                        { text: '🤖 Full AI', callback_data: `pos_ai_${positionAddress.slice(0, 8)}` }
                    ],
                    [
                        { text: '📊 Details', callback_data: `pos_detail_${positionAddress.slice(0, 8)}` },
                        { text: '❌ Dismiss', callback_data: 'alert_dismiss' }
                    ]
                ]
            }
        };

        return this.sendAlert(telegramId, alert);
    }

    /**
     * Send daily portfolio summary with quick actions
     */
    async sendDailySummary(telegramId: number, summary: PortfolioSummary): Promise<boolean> {
        if (!this.bot) {
            return false;
        }

        if (!this.shouldNotify(telegramId, 'DAILY_SUMMARY')) {
            return false;
        }

        try {
            let message = `📊 **Daily Portfolio Summary**\n\n`;
            message += `💰 Total Value: **$${summary.totalValueUsd.toFixed(2)}**\n`;
            message += `📍 Positions: ${summary.positionsCount}\n`;
            message += `  ✅ In Range: ${summary.inRangeCount}\n`;
            message += `  ❌ Out of Range: ${summary.outOfRangeCount}\n\n`;
            message += `💸 Unclaimed Fees: **$${summary.totalUnclaimedFeesUsd.toFixed(2)}**\n`;
            
            if (summary.topPerformer) {
                message += `\n🏆 Top Performer: **${summary.topPerformer.pair}**\n`;
                message += `   Fees: $${summary.topPerformer.feesUsd.toFixed(2)}\n`;
            }

            // Add actionable recommendations
            const recommendations: string[] = [];
            if (summary.outOfRangeCount > 0) {
                recommendations.push(`⚠️ **${summary.outOfRangeCount} position(s) out of range** - consider rebalancing`);
            }
            if (summary.totalUnclaimedFeesUsd >= 10) {
                recommendations.push(`💰 **$${summary.totalUnclaimedFeesUsd.toFixed(2)} in fees** ready to claim`);
            }

            if (recommendations.length > 0) {
                message += `\n**Recommendations:**\n${recommendations.join('\n')}\n`;
            }

            if (summary.alertsTriggered > 0) {
                message += `\n📬 ${summary.alertsTriggered} alerts triggered today`;
            }

            message += `\n\n_${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}_`;

            // Build action keyboard based on what needs attention
            const keyboardButtons: Array<Array<{ text: string; callback_data: string }>> = [];
            
            if (summary.outOfRangeCount > 0) {
                keyboardButtons.push([{ text: '🔄 View Out of Range', callback_data: 'positions_oor' }]);
            }
            if (summary.totalUnclaimedFeesUsd >= 5) {
                keyboardButtons.push([{ text: '💰 Claim All Fees', callback_data: 'fees_claim_all' }]);
            }
            keyboardButtons.push([
                { text: '📋 My Positions', callback_data: 'positions_list' },
                { text: '📈 Analytics', callback_data: 'analytics_menu' }
            ]);

            await this.bot.telegram.sendMessage(telegramId, message, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboardButtons }
            });

            // Log notification
            this.logNotification(telegramId, {
                type: 'DAILY_SUMMARY',
                title: 'Daily Summary',
                message: `Portfolio: $${summary.totalValueUsd.toFixed(2)}, ${summary.positionsCount} positions`,
                timestamp: Date.now()
            });

            return true;
        } catch (error: any) {
            console.error(`[TelegramNotifications] Failed to send daily summary to ${telegramId}:`, error.message);
            return false;
        }
    }

    /**
     * Check all alerts for a user and send notifications
     */
    async checkAndNotifyUser(telegramId: number): Promise<number> {
        let alertsSent = 0;

        try {
            const config = userDataService.getConfig(telegramId);
            const activeWallet = multiWalletStorage.getActiveWallet(telegramId);
            
            if (!activeWallet) {
                return 0;
            }

            const positions = await positionService.getAllPositions(activeWallet.publicKey);

            for (const position of positions) {
                const pair = `${position.tokenX.symbol}/${position.tokenY.symbol}`;

                // Check out of range
                if (config.alerts.outOfRangeEnabled && !position.inRange) {
                    const sent = await this.sendOutOfRangeAlert(
                        telegramId,
                        position.publicKey,
                        pair,
                        position.activeBinId,
                        position.lowerBinId,
                        position.upperBinId
                    );
                    if (sent) alertsSent++;
                }

                // Check near edge
                if (config.alerts.nearEdgeEnabled && position.inRange) {
                    const distToLower = position.activeBinId - position.lowerBinId;
                    const distToUpper = position.upperBinId - position.activeBinId;
                    const threshold = config.alerts.nearEdgeThreshold;

                    if (distToLower <= threshold) {
                        const sent = await this.sendNearEdgeAlert(
                            telegramId,
                            position.publicKey,
                            pair,
                            distToLower,
                            'lower'
                        );
                        if (sent) alertsSent++;
                    } else if (distToUpper <= threshold) {
                        const sent = await this.sendNearEdgeAlert(
                            telegramId,
                            position.publicKey,
                            pair,
                            distToUpper,
                            'upper'
                        );
                        if (sent) alertsSent++;
                    }
                }

                // Note: Fee threshold checking would require calculating USD value
                // which needs price data - simplified for now
            }

            // Check price alerts
            if (config.alerts.priceAlerts) {
                for (const priceAlert of config.alerts.priceAlerts) {
                    if (!priceAlert.enabled) continue;

                    try {
                        const poolInfo = await poolService.getPoolInfo(priceAlert.poolAddress);
                        const currentPrice = poolInfo?.price || 0;

                        const triggered = priceAlert.direction === 'above'
                            ? currentPrice > priceAlert.targetPrice
                            : currentPrice < priceAlert.targetPrice;

                        if (triggered) {
                            const sent = await this.sendPriceAlert(
                                telegramId,
                                priceAlert.tokenSymbol,
                                currentPrice,
                                priceAlert.targetPrice,
                                priceAlert.direction
                            );
                            if (sent) {
                                alertsSent++;
                                // Disable the alert after triggering (one-time)
                                priceAlert.enabled = false;
                                userDataService.saveConfig(telegramId, config);
                            }
                        }
                    } catch (error) {
                        // Skip this price alert on error
                    }
                }
            }

        } catch (error) {
            console.error(`[TelegramNotifications] Error checking alerts for ${telegramId}:`, error);
        }

        return alertsSent;
    }

    /**
     * Log notification to user history
     */
    private logNotification(telegramId: number, alert: TelegramAlert): void {
        try {
            userDataService.addNotificationToHistory(telegramId, {
                type: alert.type,
                title: alert.title,
                message: alert.message,
                timestamp: alert.timestamp,
                positionAddress: alert.positionAddress
            });
        } catch (error) {
            // Non-critical, just log
            console.error('[TelegramNotifications] Failed to log notification:', error);
        }
    }

    /**
     * Get icon for alert type
     */
    private getAlertIcon(type: TelegramAlert['type']): string {
        const icons: Record<TelegramAlert['type'], string> = {
            'OUT_OF_RANGE': '🔴',
            'NEAR_EDGE': '⚠️',
            'FEE_THRESHOLD': '💰',
            'PRICE_ALERT': '📊',
            'REBALANCE_SUGGESTION': '💡',
            'DAILY_SUMMARY': '📈',
            'INFO': 'ℹ️',
            'ERROR': '❌'
        };
        return icons[type] || '📌';
    }
}

// Export singleton
export const telegramNotificationsService = new TelegramNotificationsService();
