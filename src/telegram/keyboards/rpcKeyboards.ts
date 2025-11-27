/**
 * RPC Settings Keyboards
 * 
 * Telegram inline keyboards for RPC configuration
 */

import { InlineKeyboardMarkup } from 'telegraf/types';
import { RpcEndpoint } from '../../services/rpcManager.service';

/**
 * Main RPC settings keyboard
 */
export function rpcSettingsKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '📡 View Endpoints', callback_data: 'rpc_endpoints' }],
            [{ text: '➕ Add Endpoint', callback_data: 'rpc_add' }],
            [
                { text: '🧪 Test All', callback_data: 'rpc_test_all' },
                { text: '🏁 Benchmark', callback_data: 'rpc_benchmark' },
            ],
            [{ text: '🔄 Reset Stats', callback_data: 'rpc_reset_stats' }],
            [{ text: '⬅️ Back to Settings', callback_data: 'settings_main' }],
        ],
    };
}

/**
 * Endpoint list keyboard with management options
 */
export function rpcEndpointListKeyboard(endpoints: RpcEndpoint[]): InlineKeyboardMarkup {
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    
    // Show endpoints with management buttons
    endpoints.forEach((ep, index) => {
        const statusIcon = ep.isHealthy ? '🟢' : '🔴';
        const primaryIcon = ep.weight >= 10 ? '⭐' : '';
        const isUserAdded = ep.name.includes('(User)');
        
        // Endpoint name row
        buttons.push([
            { text: `${statusIcon}${primaryIcon} ${ep.name}`, callback_data: 'noop' },
        ]);
        
        // Action buttons row
        const actionButtons = [
            { text: '🧪 Test', callback_data: `rpc_test_${index}` },
        ];
        
        if (ep.weight < 10) { // Not already primary
            actionButtons.push({ text: '⭐ Set Primary', callback_data: `rpc_switch_${index}` });
        }
        
        if (isUserAdded) {
            actionButtons.push({ text: '🗑️ Remove', callback_data: `rpc_remove_${index}` });
        }
        
        buttons.push(actionButtons);
        
        // Spacer
        if (index < endpoints.length - 1) {
            buttons.push([{ text: '─────', callback_data: 'noop' }]);
        }
    });

    // Add navigation buttons
    buttons.push([]);
    buttons.push([{ text: '➕ Add Endpoint', callback_data: 'rpc_add' }]);
    buttons.push([{ text: '⬅️ Back', callback_data: 'rpc_settings' }]);

    return { inline_keyboard: buttons };
}

/**
 * Add endpoint keyboard with presets
 */
export function rpcAddEndpointKeyboard(): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                { text: '🔥 Helius', callback_data: 'rpc_preset_helius' },
                { text: '⚡ QuickNode', callback_data: 'rpc_preset_quicknode' },
            ],
            [
                { text: '🚀 Triton', callback_data: 'rpc_preset_triton' },
                { text: '🔮 Alchemy', callback_data: 'rpc_preset_alchemy' },
            ],
            [{ text: '✏️ Custom URL', callback_data: 'rpc_add_custom' }],
            [{ text: '⬅️ Back', callback_data: 'rpc_endpoints' }],
        ],
    };
}

/**
 * Commitment level selection keyboard
 */
export function rpcCommitmentKeyboard(current: string): InlineKeyboardMarkup {
    const commitments = ['processed', 'confirmed', 'finalized'];
    
    const buttons = commitments.map(c => ({
        text: c === current ? `✅ ${c}` : c,
        callback_data: `rpc_commit_${c}`,
    }));

    return {
        inline_keyboard: [
            buttons,
            [{ text: '⬅️ Back', callback_data: 'rpc_settings' }],
        ],
    };
}
