/**
 * Reusable Keyboard Builders
 * 
 * Common inline keyboard patterns used across handlers.
 */

import { InlineKeyboardMarkup, InlineKeyboardButton } from 'telegraf/types';

// ==================== MAIN MENU ====================

export function mainMenuKeyboard(hasWallet: boolean): InlineKeyboardMarkup {
    if (!hasWallet) {
        return {
            inline_keyboard: [
                [{ text: '🔑 Setup Wallet', callback_data: 'wallet_setup' }],
            ],
        };
    }

    return {
        inline_keyboard: [
            [
                { text: '📋 My Positions', callback_data: 'positions_list' },
                { text: '➕ New Position', callback_data: 'position_new' },
            ],
            [
                { text: '💸 Claim Fees', callback_data: 'fees_menu' },
                { text: '🏊 Browse Pools', callback_data: 'pools_browse' },
            ],
            [
                { text: '💼 Wallet', callback_data: 'wallet_info' },
                { text: '⚙️ Settings', callback_data: 'settings_main' },
            ],
            [{ text: '🏠 Menu', callback_data: 'menu_main' }],
        ],
    };
}

// ==================== WALLET ====================

export function walletSetupKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '📥 Import Existing Wallet', callback_data: 'wallet_import' }],
            [{ text: '🆕 Create New Wallet', callback_data: 'wallet_create' }],
            [{ text: '❓ What is a Wallet?', callback_data: 'wallet_info_help' }],
            [{ text: '⬅️ Back', callback_data: 'menu_main' }],
        ],
    };
}

export function walletInfoKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '🔄 Refresh Balance', callback_data: 'wallet_refresh' }],
            [{ text: '📋 Copy Address', callback_data: 'wallet_copy' }],
            [
                { text: '📤 Export Key', callback_data: 'wallet_export' },
                { text: '🗑️ Disconnect', callback_data: 'wallet_disconnect' },
            ],
            [{ text: '⬅️ Back', callback_data: 'menu_main' }],
        ],
    };
}

// ==================== POSITIONS ====================

export function positionListKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: 'positions_refresh' }],
            [{ text: '➕ New Position', callback_data: 'position_new' }],
            [{ text: '⬅️ Back', callback_data: 'menu_main' }],
        ],
    };
}

export function positionDetailKeyboard(positionAddress: string): InlineKeyboardMarkup {
    // Shorten address for callback data (max 64 bytes)
    const shortAddr = positionAddress.slice(0, 8);

    return {
        inline_keyboard: [
            [
                { text: '💰 Claim Fees', callback_data: `pos_claim_${shortAddr}` },
            ],
            [
                { text: '♻️ Rebalance', callback_data: `pos_rebalance_${shortAddr}` },
            ],
            [
                { text: '➕ Add Liquidity', callback_data: `pos_add_${shortAddr}` },
                { text: '➖ Remove', callback_data: `pos_remove_${shortAddr}` },
            ],
            [
                { text: '⚙️ Auto-Rebalance', callback_data: `pos_auto_${shortAddr}` },
                { text: '❌ Close', callback_data: `pos_close_${shortAddr}` },
            ],
            [{ text: '⬅️ Back to Positions', callback_data: 'positions_list' }],
        ],
    };
}

export function positionActionConfirmKeyboard(action: string, positionAddress: string): InlineKeyboardMarkup {
    const shortAddr = positionAddress.slice(0, 8);

    return {
        inline_keyboard: [
            [
                { text: '✅ Confirm', callback_data: `pos_confirm_${action}_${shortAddr}` },
                { text: '❌ Cancel', callback_data: `pos_detail_${shortAddr}` },
            ],
        ],
    };
}

// ==================== POOLS ====================

export function poolBrowseKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '🔍 Search Pool', callback_data: 'pools_search' }],
            [{ text: '⭐ My Favorites', callback_data: 'pools_favorites' }],
            [{ text: '🔥 Top by Volume', callback_data: 'pools_top_volume' }],
            [{ text: '💰 Top by TVL', callback_data: 'pools_top_tvl' }],
            [{ text: '📈 Top by APR', callback_data: 'pools_top_apr' }],
            [{ text: '⬅️ Back', callback_data: 'menu_main' }],
        ],
    };
}

export function poolDetailKeyboard(poolAddress: string, isFavorite: boolean): InlineKeyboardMarkup {
    const shortAddr = poolAddress.slice(0, 8);
    const favButton = isFavorite
        ? { text: '⭐ Remove from Favorites', callback_data: `pool_unfav_${shortAddr}` }
        : { text: '☆ Add to Favorites', callback_data: `pool_fav_${shortAddr}` };

    return {
        inline_keyboard: [
            [{ text: '➕ Create Position', callback_data: `pool_create_${shortAddr}` }],
            [favButton],
            [{ text: '🔄 Refresh', callback_data: `pool_refresh_${shortAddr}` }],
            [{ text: '⬅️ Back to Pools', callback_data: 'pools_browse' }],
        ],
    };
}

// ==================== SWAP ====================

export function swapKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '🔄 Swap SOL → USDC', callback_data: 'swap_sol_usdc' }],
            [{ text: '🔄 Swap USDC → SOL', callback_data: 'swap_usdc_sol' }],
            [{ text: '🔍 Custom Swap', callback_data: 'swap_custom' }],
            [{ text: '⬅️ Back', callback_data: 'menu_main' }],
        ],
    };
}

export function swapConfirmKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                { text: '✅ Confirm Swap', callback_data: 'swap_confirm' },
                { text: '❌ Cancel', callback_data: 'swap_cancel' },
            ],
        ],
    };
}

// ==================== ANALYTICS ====================

export function analyticsKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '📊 Portfolio Overview', callback_data: 'analytics_portfolio' }],
            [{ text: '💸 Fee Earnings', callback_data: 'analytics_fees' }],
            [{ text: '📈 PnL History', callback_data: 'analytics_pnl' }],
            [{ text: '📋 Transaction History', callback_data: 'analytics_history' }],
            [{ text: '📤 Export Data', callback_data: 'analytics_export' }],
            [{ text: '⬅️ Back', callback_data: 'menu_main' }],
        ],
    };
}

export function analyticsPeriodKeyboard(type: 'pnl' | 'fees'): InlineKeyboardMarkup {
    const prefix = type === 'pnl' ? 'analytics_pnl_' : 'analytics_fees_';
    return {
        inline_keyboard: [
            [
                { text: '7 Days', callback_data: `${prefix}7` },
                { text: '14 Days', callback_data: `${prefix}14` },
            ],
            [
                { text: '30 Days', callback_data: `${prefix}30` },
                { text: 'All Time', callback_data: `${prefix}all` },
            ],
            [{ text: '⬅️ Back', callback_data: 'analytics_menu' }],
        ],
    };
}

export function analyticsExportKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '📋 Positions Summary', callback_data: 'analytics_export_positions' }],
            [{ text: '📊 Historical Snapshots', callback_data: 'analytics_export_snapshots' }],
            [{ text: '🔄 Rebalance History', callback_data: 'analytics_export_rebalances' }],
            [{ text: '⬅️ Back', callback_data: 'analytics_menu' }],
        ],
    };
}

// ==================== SETTINGS ====================

export function settingsKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '📡 Position Monitor', callback_data: 'settings_monitor' }],
            [{ text: '🔗 RPC Connections', callback_data: 'rpc_settings' }],
            [{ text: '💰 Transaction Settings', callback_data: 'settings_tx' }],
            [{ text: '🔔 Notifications', callback_data: 'settings_notifications' }],
            [{ text: '🤖 LLM Configuration', callback_data: 'settings_llm' }],
            [{ text: '⚠️ Alerts', callback_data: 'settings_alerts' }],
            [{ text: '🗑️ Delete All Data', callback_data: 'settings_delete' }],
            [{ text: '⬅️ Back', callback_data: 'menu_main' }],
        ],
    };
}

export function monitorSettingsKeyboard(isEnabled: boolean, interval: number, autoRebalance: boolean): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: isEnabled ? '🟢 Monitor: ON' : '🔴 Monitor: OFF', callback_data: 'monitor_toggle' }],
            [{ text: `⏱️ Interval: ${interval} min`, callback_data: 'monitor_interval' }],
            [{ text: autoRebalance ? '✅ Auto-Rebalance: ON' : '❌ Auto-Rebalance: OFF', callback_data: 'monitor_auto_toggle' }],
            [{ text: '▶️ Run Check Now', callback_data: 'monitor_run_now' }],
            [{ text: '📋 View Last Report', callback_data: 'monitor_last_report' }],
            [{ text: '⬅️ Back to Settings', callback_data: 'settings_main' }],
        ],
    };
}

export function monitorIntervalKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                { text: '15 min', callback_data: 'monitor_int_15' },
                { text: '30 min', callback_data: 'monitor_int_30' },
                { text: '60 min', callback_data: 'monitor_int_60' },
            ],
            [
                { text: '2 hours', callback_data: 'monitor_int_120' },
                { text: '4 hours', callback_data: 'monitor_int_240' },
            ],
            [{ text: '⬅️ Back', callback_data: 'settings_monitor' }],
        ],
    };
}

export function settingsTxKeyboard(currentSlippage: number): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                { text: '0.3%', callback_data: 'settings_slip_0.3' },
                { text: '0.5%', callback_data: 'settings_slip_0.5' },
                { text: '1%', callback_data: 'settings_slip_1' },
            ],
            [{ text: `Current: ${currentSlippage}%`, callback_data: 'noop' }],
            [{ text: '⬅️ Back to Settings', callback_data: 'settings_main' }],
        ],
    };
}

export function llmProviderKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '🤖 Anthropic (Claude)', callback_data: 'llm_set_anthropic' }],
            [{ text: '🧠 OpenAI (GPT)', callback_data: 'llm_set_openai' }],
            [{ text: '💎 DeepSeek', callback_data: 'llm_set_deepseek' }],
            [{ text: '🚀 Grok', callback_data: 'llm_set_grok' }],
            [{ text: '🌙 Kimi', callback_data: 'llm_set_kimi' }],
            [{ text: '✨ Gemini', callback_data: 'llm_set_gemini' }],
            [{ text: '❌ Disable LLM', callback_data: 'llm_disable' }],
            [{ text: '⬅️ Back to Settings', callback_data: 'settings_main' }],
        ],
    };
}

export function llmSettingsKeyboard(currentProvider: string): InlineKeyboardMarkup {
    const isConfigured = currentProvider !== 'none' && currentProvider !== '';
    return {
        inline_keyboard: [
            [{ text: '🔧 Select Provider', callback_data: 'llm_providers' }],
            ...(isConfigured ? [
                [{ text: '🧪 Test Connection', callback_data: 'llm_test' }],
                [{ text: '🔄 Change Model', callback_data: `llm_model_${currentProvider}` }],
            ] : []),
            [{ text: '❌ Disable LLM', callback_data: 'llm_disable' }],
            [{ text: '⬅️ Back to Settings', callback_data: 'settings_main' }],
        ],
    };
}

export function llmModelKeyboard(provider: string, hasApiKey: boolean): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            ...(hasApiKey ? [
                [{ text: '🔄 Change Model', callback_data: `llm_model_${provider}` }],
                [{ text: '🧪 Test Connection', callback_data: 'llm_test' }],
            ] : []),
            [{ text: '⬅️ Back to LLM Settings', callback_data: 'settings_llm' }],
        ],
    };
}

// ==================== ALERTS ====================

export function alertsKeyboard(config: { outOfRange: boolean; nearEdge: boolean; fees: boolean; rebalanceSuggestions?: boolean }): InlineKeyboardMarkup {
    const toggle = (enabled: boolean) => enabled ? '✅' : '❌';

    return {
        inline_keyboard: [
            [{ text: `${toggle(config.outOfRange)} Out of Range Alerts`, callback_data: 'alert_toggle_oor' }],
            [{ text: `${toggle(config.nearEdge)} Near Edge Alerts`, callback_data: 'alert_toggle_edge' }],
            [{ text: '📏 Configure Edge Threshold', callback_data: 'alert_edge_config' }],
            [{ text: `${toggle(config.fees)} Fee Threshold Alerts`, callback_data: 'alert_toggle_fees' }],
            [{ text: '💰 Configure Fee Threshold', callback_data: 'alert_fee_config' }],
            [{ text: `${toggle(config.rebalanceSuggestions || false)} AI Suggestions`, callback_data: 'alert_toggle_suggestions' }],
            [{ text: '➕ Add Price Alert', callback_data: 'alert_add_price' }],
            [{ text: '📋 My Price Alerts', callback_data: 'alert_list_price' }],
            [{ text: '⬅️ Back to Settings', callback_data: 'settings_main' }],
        ],
    };
}

export function feeThresholdKeyboard(currentThreshold: number): InlineKeyboardMarkup {
    const check = (val: number) => currentThreshold === val ? '✅ ' : '';

    return {
        inline_keyboard: [
            [
                { text: `${check(5)}$5`, callback_data: 'alert_fee_5' },
                { text: `${check(10)}$10`, callback_data: 'alert_fee_10' },
                { text: `${check(25)}$25`, callback_data: 'alert_fee_25' },
            ],
            [
                { text: `${check(50)}$50`, callback_data: 'alert_fee_50' },
                { text: `${check(100)}$100`, callback_data: 'alert_fee_100' },
            ],
            [{ text: '✏️ Custom Amount', callback_data: 'alert_fee_custom' }],
            [{ text: '⬅️ Back', callback_data: 'settings_alerts' }],
        ],
    };
}

export function priceAlertPoolKeyboard(pools: Array<{ address: string; pair: string }>): InlineKeyboardMarkup {
    const poolButtons = pools.slice(0, 5).map(pool => [{
        text: pool.pair,
        callback_data: `alert_pool_${pool.address.slice(0, 20)}`
    }]);

    return {
        inline_keyboard: [
            ...poolButtons,
            [{ text: '⬅️ Back', callback_data: 'settings_alerts' }],
        ],
    };
}

// ==================== NOTIFICATIONS ====================

export function notificationsKeyboard(config: { notificationsEnabled: boolean; alertsEnabled: boolean; dailySummaryEnabled: boolean }): InlineKeyboardMarkup {
    const toggle = (enabled: boolean, onText: string, offText: string) => enabled ? `✅ ${onText}` : `❌ ${offText}`;

    return {
        inline_keyboard: [
            [{ text: config.notificationsEnabled ? '🔔 Notifications: ON' : '🔕 Notifications: OFF', callback_data: 'notif_toggle_all' }],
            [{ text: toggle(config.alertsEnabled, 'Position Alerts', 'Position Alerts'), callback_data: 'notif_toggle_alerts' }],
            [{ text: toggle(config.dailySummaryEnabled, 'Daily Summary', 'Daily Summary'), callback_data: 'notif_toggle_daily' }],
            [{ text: '📜 Notification History', callback_data: 'notif_history' }],
            [{ text: '⬅️ Back to Settings', callback_data: 'settings_main' }],
        ],
    };
}

// ==================== HELP ====================

export function helpKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '📋 Commands List', callback_data: 'help_commands' }],
            [{ text: '💼 Wallet Help', callback_data: 'help_wallet' }],
            [{ text: '📍 Positions Help', callback_data: 'help_positions' }],
            [{ text: '♻️ Rebalancing Help', callback_data: 'help_rebalancing' }],
            [{ text: '🤖 LLM Help', callback_data: 'help_llm' }],
            [{ text: '⬅️ Back', callback_data: 'menu_main' }],
        ],
    };
}

// ==================== CONFIRMATION ====================

export function confirmActionKeyboard(confirmCallback: string, cancelCallback: string): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                { text: '✅ Yes, Proceed', callback_data: confirmCallback },
                { text: '❌ No, Cancel', callback_data: cancelCallback },
            ],
        ],
    };
}

// ==================== GENERIC ====================

export function backButton(callback: string, text: string = '⬅️ Back'): InlineKeyboardButton {
    return { text, callback_data: callback };
}

export function refreshButton(callback: string): InlineKeyboardButton {
    return { text: '🔄 Refresh', callback_data: callback };
}

export function cancelButton(callback: string): InlineKeyboardButton {
    return { text: '❌ Cancel', callback_data: callback };
}

// ==================== REBALANCE ====================

export function rebalanceStrategyKeyboard(positionAddress: string): InlineKeyboardMarkup {
    const shortAddr = positionAddress.slice(0, 8);

    return {
        inline_keyboard: [
            [{ text: '⚡ Aggressive (±8%)', callback_data: `reb_strat_agg_${shortAddr}` }],
            [{ text: '⚖️ Balanced (±12%)', callback_data: `reb_strat_bal_${shortAddr}` }],
            [{ text: '🛡️ Conservative (±18%)', callback_data: `reb_strat_con_${shortAddr}` }],
            [{ text: '🎯 Custom Range', callback_data: `reb_strat_cust_${shortAddr}` }],
            [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }],
        ],
    };
}

export function autoRebalanceKeyboard(positionAddress: string, isEnabled: boolean): InlineKeyboardMarkup {
    const shortAddr = positionAddress.slice(0, 8);
    const toggleText = isEnabled ? '🔴 Disable Auto-Rebalance' : '🟢 Enable Auto-Rebalance';

    return {
        inline_keyboard: [
            [{ text: toggleText, callback_data: `auto_toggle_${shortAddr}` }],
            ...(isEnabled ? [
                [{ text: '⚙️ Change Strategy', callback_data: `auto_strategy_${shortAddr}` }],
                [{ text: '📊 View Status', callback_data: `auto_status_${shortAddr}` }],
            ] : []),
            [{ text: '⬅️ Back', callback_data: `pos_detail_${shortAddr}` }],
        ],
    };
}

