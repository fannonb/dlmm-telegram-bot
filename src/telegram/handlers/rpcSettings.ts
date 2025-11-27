/**
 * RPC Settings Handler for Telegram Bot
 * 
 * Allows users to:
 * - View current RPC endpoints and their status
 * - Add custom RPC endpoints
 * - Remove RPC endpoints
 * - View RPC stats and health
 * - Test RPC connections
 */

import { BotContext } from '../types';
import { rpcManager, RpcEndpointConfig } from '../../services/rpcManager.service';
import { userDataService } from '../services/userDataService';
import { rpcSettingsKeyboard, rpcEndpointListKeyboard, rpcAddEndpointKeyboard } from '../keyboards/rpcKeyboards';

// ==================== RPC MENU ====================

/**
 * Show RPC settings menu
 */
export async function handleRpcSettings(ctx: BotContext): Promise<void> {
    try {
        const stats = rpcManager.getStats();
        const endpoints = stats.endpoints;
        
        const healthyCount = endpoints.filter(ep => ep.isHealthy).length;
        const avgLatency = stats.averageLatency > 0 ? `${Math.round(stats.averageLatency)}ms` : 'N/A';
        
        const message = `🔗 **RPC Connection Settings**

**Status Overview:**
📡 Endpoints: ${healthyCount}/${endpoints.length} healthy
📊 Avg Latency: ${avgLatency}
📈 Success Rate: ${stats.totalRequests > 0 
    ? `${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%` 
    : 'N/A'}

**Request Stats:**
• Total Requests: ${stats.totalRequests.toLocaleString()}
• Successful: ${stats.successfulRequests.toLocaleString()}
• Failed: ${stats.failedRequests.toLocaleString()}
• Retries: ${stats.totalRetries.toLocaleString()}

Configure your RPC endpoints for optimal performance:`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: rpcSettingsKeyboard()
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleRpcSettings:', error);
        await ctx.answerCbQuery('❌ Error loading RPC settings');
    }
}

// ==================== ENDPOINT LIST ====================

/**
 * Show list of all RPC endpoints
 */
export async function handleRpcEndpointList(ctx: BotContext): Promise<void> {
    try {
        const endpoints = rpcManager.getEndpoints();
        
        let message = `📡 **RPC Endpoints**\n\n`;
        
        if (endpoints.length === 0) {
            message += '⚠️ No endpoints configured\n';
        } else {
            endpoints.forEach((ep, index) => {
                const statusIcon = ep.isHealthy ? '🟢' : '🔴';
                const primaryIcon = ep.weight >= 10 ? '⭐' : '';
                const latency = ep.averageLatency > 0 ? `${Math.round(ep.averageLatency)}ms` : 'N/A';
                
                message += `${index + 1}. ${statusIcon}${primaryIcon} **${ep.name}**\n`;
                message += `   └ Latency: ${latency} | Weight: ${ep.weight}\n`;
                
                if (!ep.isHealthy && ep.lastError) {
                    message += `   └ ⚠️ ${ep.lastError.slice(0, 40)}...\n`;
                }
                message += '\n';
            });
            
            message += '\n⭐ = Primary endpoint\n';
        }

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: rpcEndpointListKeyboard(endpoints)
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleRpcEndpointList:', error);
        await ctx.answerCbQuery('❌ Error loading endpoints');
    }
}

// ==================== ADD ENDPOINT ====================

/**
 * Show add endpoint options
 */
export async function handleRpcAddEndpoint(ctx: BotContext): Promise<void> {
    try {
        const message = `➕ **Add RPC Endpoint**

Choose a preset or add a custom endpoint:

**Popular RPC Providers:**
• Helius - Fast & reliable
• QuickNode - Low latency  
• Triton - High performance
• Alchemy - Developer friendly

Or enter a custom URL for your own RPC.`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: rpcAddEndpointKeyboard()
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleRpcAddEndpoint:', error);
        await ctx.answerCbQuery('❌ Error');
    }
}

/**
 * Handle preset RPC selection
 */
export async function handleRpcPreset(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const preset = callbackData.replace('rpc_preset_', '');
        
        // Set flow to await API key input
        ctx.session.currentFlow = 'rpc_add_preset';
        ctx.session.flowData = { preset };

        let providerName = '';
        let instructions = '';
        
        switch (preset) {
            case 'helius':
                providerName = 'Helius';
                instructions = 'Get your API key at: https://helius.dev';
                break;
            case 'quicknode':
                providerName = 'QuickNode';
                instructions = 'Get your endpoint at: https://quicknode.com';
                break;
            case 'triton':
                providerName = 'Triton';
                instructions = 'Get your endpoint at: https://triton.one';
                break;
            case 'alchemy':
                providerName = 'Alchemy';
                instructions = 'Get your API key at: https://alchemy.com';
                break;
        }

        await ctx.editMessageText(
            `🔧 *Add ${providerName} RPC*\n\n` +
            `${instructions}\n\n` +
            `Please enter your full RPC URL:\n\n` +
            `Example:\n\`https://mainnet.helius-rpc.com/?api-key=YOUR_KEY\``,
            { parse_mode: 'Markdown' }
        );
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleRpcPreset:', error);
        await ctx.answerCbQuery('❌ Error');
    }
}

/**
 * Handle custom RPC input prompt
 */
export async function handleRpcAddCustom(ctx: BotContext): Promise<void> {
    try {
        ctx.session.currentFlow = 'rpc_add_custom';
        ctx.session.flowData = {};

        await ctx.editMessageText(
            `🔧 *Add Custom RPC Endpoint*\n\n` +
            `Please enter your RPC URL:\n` +
            `(Must be a valid HTTPS URL)\n\n` +
            `Example:\n` +
            `\`https://my-rpc-provider.com/api/v1\``,
            { parse_mode: 'Markdown' }
        );
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleRpcAddCustom:', error);
        await ctx.answerCbQuery('❌ Error');
    }
}

/**
 * Process RPC URL input
 */
export async function processRpcUrlInput(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) return;

        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        
        if (!text || !text.startsWith('https://')) {
            await ctx.reply(
                '❌ Invalid URL. Please enter a valid HTTPS URL.\n\n' +
                'Example: `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Validate URL format
        try {
            new URL(text);
        } catch {
            await ctx.reply('❌ Invalid URL format. Please try again.');
            return;
        }

        // Get name from flow or generate
        const preset = ctx.session.flowData?.preset;
        let name = preset ? capitalize(preset) : 'Custom';
        
        // Check if URL contains known providers
        if (text.includes('helius')) name = 'Helius';
        else if (text.includes('quicknode')) name = 'QuickNode';
        else if (text.includes('triton')) name = 'Triton';
        else if (text.includes('alchemy')) name = 'Alchemy';
        else if (text.includes('ankr')) name = 'Ankr';
        else if (text.includes('rpcpool')) name = 'RPCPool';

        // Test the endpoint before adding
        await ctx.reply('🔄 Testing RPC endpoint...');
        
        const testResult = await testRpcEndpoint(text);
        
        if (!testResult.success) {
            await ctx.reply(
                `❌ RPC endpoint test failed:\n${testResult.error}\n\n` +
                `Please check your URL and try again.`
            );
            return;
        }

        // Add the endpoint
        const endpointConfig: RpcEndpointConfig = {
            url: text,
            name: `${name} (User)`,
            weight: 8, // High weight for user-added endpoints
            rateLimit: 40,
        };

        rpcManager.addEndpoint(endpointConfig);

        // Save to user config
        await saveUserRpcEndpoint(userId, endpointConfig);

        // Reset flow
        ctx.session.currentFlow = 'idle';
        ctx.session.flowData = {};

        await ctx.reply(
            `✅ **RPC Endpoint Added!**\n\n` +
            `**Name:** ${endpointConfig.name}\n` +
            `**Latency:** ${testResult.latency}ms\n` +
            `**Block Height:** ${testResult.blockHeight?.toLocaleString()}\n\n` +
            `The endpoint is now active and will be used for requests.`,
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📡 View Endpoints', callback_data: 'rpc_endpoints' }],
                        [{ text: '⬅️ Back to Settings', callback_data: 'settings_main' }],
                    ]
                }
            }
        );

    } catch (error) {
        console.error('Error in processRpcUrlInput:', error);
        await ctx.reply('❌ Error adding endpoint. Please try again.');
    }
}

// ==================== REMOVE ENDPOINT ====================

/**
 * Handle endpoint removal selection
 */
export async function handleRpcRemoveEndpoint(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const urlIndex = parseInt(callbackData.replace('rpc_remove_', ''));
        
        const endpoints = rpcManager.getEndpoints();
        
        if (isNaN(urlIndex) || urlIndex < 0 || urlIndex >= endpoints.length) {
            await ctx.answerCbQuery('❌ Invalid endpoint');
            return;
        }

        const endpoint = endpoints[urlIndex];
        
        // Don't allow removing the last endpoint
        if (endpoints.length <= 1) {
            await ctx.answerCbQuery('⚠️ Cannot remove last endpoint');
            return;
        }

        await ctx.editMessageText(
            `🗑️ **Remove Endpoint**\n\n` +
            `Are you sure you want to remove:\n` +
            `**${endpoint.name}**\n\n` +
            `URL: \`${endpoint.url.slice(0, 50)}...\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Yes, Remove', callback_data: `rpc_remove_confirm_${urlIndex}` },
                            { text: '❌ Cancel', callback_data: 'rpc_endpoints' },
                        ],
                    ]
                }
            }
        );
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleRpcRemoveEndpoint:', error);
        await ctx.answerCbQuery('❌ Error');
    }
}

/**
 * Confirm endpoint removal
 */
export async function handleRpcRemoveConfirm(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) return;

        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const urlIndex = parseInt(callbackData.replace('rpc_remove_confirm_', ''));
        
        const endpoints = rpcManager.getEndpoints();
        
        if (isNaN(urlIndex) || urlIndex < 0 || urlIndex >= endpoints.length) {
            await ctx.answerCbQuery('❌ Invalid endpoint');
            return;
        }

        const endpoint = endpoints[urlIndex];
        
        // Remove from RPC manager
        const removed = rpcManager.removeEndpoint(endpoint.url);
        
        if (removed) {
            // Remove from user config
            await removeUserRpcEndpoint(userId, endpoint.url);
            
            await ctx.answerCbQuery('✅ Endpoint removed');
        } else {
            await ctx.answerCbQuery('❌ Failed to remove');
        }

        // Refresh list
        await handleRpcEndpointList(ctx);
    } catch (error) {
        console.error('Error in handleRpcRemoveConfirm:', error);
        await ctx.answerCbQuery('❌ Error removing endpoint');
    }
}

// ==================== TEST & HEALTH ====================

/**
 * Switch primary RPC endpoint
 */
export async function handleRpcSwitchPrimary(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const urlIndex = parseInt(callbackData.replace('rpc_switch_', ''));
        
        const endpoints = rpcManager.getEndpoints();
        
        if (isNaN(urlIndex) || urlIndex < 0 || urlIndex >= endpoints.length) {
            await ctx.answerCbQuery('❌ Invalid endpoint');
            return;
        }

        const selectedEndpoint = endpoints[urlIndex];
        
        // Reset all weights to normal
        endpoints.forEach(ep => {
            if (ep.weight >= 10) {
                rpcManager.updateEndpoint(ep.url, { weight: 5 });
            }
        });
        
        // Set selected as primary
        rpcManager.updateEndpoint(selectedEndpoint.url, { weight: 10 });
        
        // Save to user config
        const userId = ctx.from?.id;
        if (userId) {
            await savePrimaryRpcEndpoint(userId, selectedEndpoint.url);
        }
        
        await ctx.answerCbQuery(`✅ ${selectedEndpoint.name} set as primary`);
        
        // Refresh list
        await handleRpcEndpointList(ctx);
    } catch (error) {
        console.error('Error in handleRpcSwitchPrimary:', error);
        await ctx.answerCbQuery('❌ Error switching primary');
    }
}

/**
 * Test a specific RPC endpoint
 */
export async function handleRpcTestSingle(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const urlIndex = parseInt(callbackData.replace('rpc_test_', ''));
        
        const endpoints = rpcManager.getEndpoints();
        
        if (isNaN(urlIndex) || urlIndex < 0 || urlIndex >= endpoints.length) {
            await ctx.answerCbQuery('❌ Invalid endpoint');
            return;
        }

        const endpoint = endpoints[urlIndex];
        
        await ctx.answerCbQuery('🔄 Testing endpoint...');
        
        const result = await testRpcEndpoint(endpoint.url);
        
        const icon = result.success ? '✅' : '❌';
        let message = `${icon} **${endpoint.name} Test Result**\n\n`;
        
        if (result.success) {
            message += `🚀 **Status:** Healthy\n`;
            message += `⚡ **Latency:** ${result.latency}ms\n`;
            message += `📊 **Block Height:** ${result.blockHeight?.toLocaleString()}\n`;
            message += `🔗 **Version:** ${result.version?.['solana-core'] || 'Unknown'}\n`;
        } else {
            message += `❌ **Status:** Failed\n`;
            message += `⚠️ **Error:** ${result.error}\n`;
        }
        
        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Test Again', callback_data: `rpc_test_${urlIndex}` }],
                    [{ text: '⬅️ Back to Endpoints', callback_data: 'rpc_endpoints' }],
                ]
            }
        });
    } catch (error) {
        console.error('Error in handleRpcTestSingle:', error);
        await ctx.reply('❌ Error testing endpoint');
    }
}

/**
 * Test all RPC endpoints
 */
export async function handleRpcTestAll(ctx: BotContext): Promise<void> {
    try {
        await ctx.answerCbQuery('🔄 Testing endpoints...');
        
        const endpoints = rpcManager.getEndpoints();
        let results = `🧪 **RPC Health Check Results**\n\n`;
        
        const testResults = [];
        
        for (const ep of endpoints) {
            const result = await testRpcEndpoint(ep.url);
            testResults.push({ endpoint: ep, result });
            
            const icon = result.success ? '✅' : '❌';
            const primaryIcon = ep.weight >= 10 ? '⭐' : '';
            
            results += `${icon}${primaryIcon} **${ep.name}**\n`;
            if (result.success) {
                results += `   └ Latency: ${result.latency}ms\n`;
                results += `   └ Block: ${result.blockHeight?.toLocaleString()}\n`;
                results += `   └ Version: ${result.version?.['solana-core']?.slice(0, 10) || 'N/A'}\n`;
            } else {
                results += `   └ Error: ${result.error?.slice(0, 40)}...\n`;
            }
            results += '\n';
        }
        
        // Add performance ranking
        const healthyResults = testResults.filter(tr => tr.result.success);
        if (healthyResults.length > 1) {
            healthyResults.sort((a, b) => (a.result.latency || 999) - (b.result.latency || 999));
            results += `\n🏆 **Performance Ranking:**\n`;
            healthyResults.slice(0, 3).forEach((tr, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                results += `${medals[index] || '🏅'} ${tr.endpoint.name} - ${tr.result.latency}ms\n`;
            });
        }

        await ctx.editMessageText(results, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Test Again', callback_data: 'rpc_test_all' }],
                    [{ text: '⬅️ Back', callback_data: 'rpc_settings' }],
                ]
            }
        });
    } catch (error) {
        console.error('Error in handleRpcTestAll:', error);
        await ctx.reply('❌ Error testing endpoints');
    }
}

/**
 * Reset RPC stats
 */
export async function handleRpcResetStats(ctx: BotContext): Promise<void> {
    try {
        rpcManager.resetStats();
        await ctx.answerCbQuery('✅ Stats reset');
        await handleRpcSettings(ctx);
    } catch (error) {
        console.error('Error in handleRpcResetStats:', error);
        await ctx.answerCbQuery('❌ Error');
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Test a single RPC endpoint with comprehensive checks
 */
async function testRpcEndpoint(url: string): Promise<{
    success: boolean;
    latency?: number;
    blockHeight?: number;
    version?: any;
    tps?: number;
    error?: string;
}> {
    const { Connection } = await import('@solana/web3.js');
    
    const startTime = Date.now();
    
    try {
        const connection = new Connection(url, 'confirmed');
        
        // Run multiple tests in parallel
        const [blockHeight, version, recentPerformance] = await Promise.race([
            Promise.all([
                connection.getBlockHeight(),
                connection.getVersion(),
                connection.getRecentPerformanceSamples(1).catch(() => null)
            ]),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
            )
        ]);
        
        const latency = Date.now() - startTime;
        
        // Calculate TPS if available
        let tps = undefined;
        if (recentPerformance && recentPerformance.length > 0) {
            const sample = recentPerformance[0];
            tps = Math.round(sample.numTransactions / sample.samplePeriodSecs);
        }
        
        return {
            success: true,
            latency,
            blockHeight,
            version,
            tps,
        };
    } catch (error) {
        const latency = Date.now() - startTime;
        return {
            success: false,
            latency: latency > 100 ? latency : undefined, // Only include if meaningful
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Save user RPC endpoint to their config
 */
async function saveUserRpcEndpoint(userId: number, endpoint: RpcEndpointConfig): Promise<void> {
    const config = userDataService.getConfig(userId);
    
    // Initialize rpcEndpoints array if not exists
    if (!(config as any).rpcEndpoints) {
        (config as any).rpcEndpoints = [];
    }
    
    // Add endpoint if not already present
    const endpoints = (config as any).rpcEndpoints as RpcEndpointConfig[];
    if (!endpoints.some(ep => ep.url === endpoint.url)) {
        endpoints.push(endpoint);
        userDataService.saveConfig(userId, config);
    }
}

/**
 * Remove user RPC endpoint from their config
 */
async function removeUserRpcEndpoint(userId: number, url: string): Promise<void> {
    const config = userDataService.getConfig(userId);
    
    if ((config as any).rpcEndpoints) {
        const endpoints = (config as any).rpcEndpoints as RpcEndpointConfig[];
        const index = endpoints.findIndex(ep => ep.url === url);
        if (index !== -1) {
            endpoints.splice(index, 1);
            userDataService.saveConfig(userId, config);
        }
    }
}

/**
 * Save user's primary RPC endpoint preference
 */
async function savePrimaryRpcEndpoint(userId: number, url: string): Promise<void> {
    const config = userDataService.getConfig(userId);
    (config as any).primaryRpcEndpoint = url;
    userDataService.saveConfig(userId, config);
}

/**
 * Load user's primary RPC endpoint preference
 */
function loadPrimaryRpcEndpoint(userId: number): string | null {
    const config = userDataService.getConfig(userId);
    return (config as any).primaryRpcEndpoint || null;
}

/**
 * Load user RPC endpoints on startup
 */
export function loadUserRpcEndpoints(userId: number): void {
    const config = userDataService.getConfig(userId);
    
    if ((config as any).rpcEndpoints) {
        const endpoints = (config as any).rpcEndpoints as RpcEndpointConfig[];
        for (const endpoint of endpoints) {
            if (!rpcManager.getEndpoints().some(ep => ep.url === endpoint.url)) {
                rpcManager.addEndpoint(endpoint);
            }
        }
    }
}

/**
 * Run comprehensive RPC benchmark
 */
export async function handleRpcBenchmark(ctx: BotContext): Promise<void> {
    try {
        await ctx.answerCbQuery('🏁 Running benchmark...');
        
        const endpoints = rpcManager.getEndpoints();
        
        if (endpoints.length === 0) {
            await ctx.reply('❌ No endpoints to benchmark');
            return;
        }
        
        let message = `🏁 **RPC Benchmark Results**\n\n`;
        message += `Testing ${endpoints.length} endpoint(s) with multiple requests...\n\n`;
        
        const benchmarkResults = [];
        const testCount = 5; // Run 5 tests per endpoint
        
        for (const ep of endpoints) {
            message += `🔄 Testing ${ep.name}...\n`;
            
            // Run multiple tests for better accuracy
            const results = [];
            
            for (let i = 0; i < testCount; i++) {
                const result = await testRpcEndpoint(ep.url);
                if (result.success && result.latency) {
                    results.push(result.latency);
                }
            }
            
            if (results.length > 0) {
                const avgLatency = Math.round(results.reduce((a, b) => a + b) / results.length);
                const minLatency = Math.min(...results);
                const maxLatency = Math.max(...results);
                const successRate = (results.length / testCount) * 100;
                
                benchmarkResults.push({
                    endpoint: ep,
                    avgLatency,
                    minLatency,
                    maxLatency,
                    successRate,
                    results
                });
            } else {
                benchmarkResults.push({
                    endpoint: ep,
                    avgLatency: 999999,
                    successRate: 0,
                    results: []
                });
            }
        }
        
        // Sort by average latency
        benchmarkResults.sort((a, b) => a.avgLatency - b.avgLatency);
        
        message = `🏁 **RPC Benchmark Results**\n\n`;
        message += `Tested each endpoint ${testCount} times:\n\n`;
        
        benchmarkResults.forEach((result, index) => {
            const ep = result.endpoint;
            const rank = index + 1;
            const medals = ['🥇', '🥈', '🥉'];
            const medal = medals[index] || `${rank}.`;
            const primaryIcon = ep.weight >= 10 ? '⭐' : '';
            
            message += `${medal}${primaryIcon} **${ep.name}**\n`;
            
            if (result.successRate > 0) {
                message += `   └ Avg: ${result.avgLatency}ms\n`;
                message += `   └ Range: ${result.minLatency}-${result.maxLatency}ms\n`;
                message += `   └ Success: ${result.successRate}%\n`;
            } else {
                message += `   └ ❌ All tests failed\n`;
            }
            message += '\n';
        });
        
        // Recommendations
        const bestEndpoint = benchmarkResults.find(r => r.successRate > 0);
        if (bestEndpoint && bestEndpoint.endpoint.weight < 10) {
            message += `\n💡 **Recommendation:**\n`;
            message += `Consider switching to **${bestEndpoint.endpoint.name}** as primary for best performance.\n`;
        }
        
        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Run Again', callback_data: 'rpc_benchmark' }],
                    [{ text: '⬅️ Back', callback_data: 'rpc_settings' }],
                ]
            }
        });
    } catch (error) {
        console.error('Error in handleRpcBenchmark:', error);
        await ctx.reply('❌ Error running benchmark');
    }
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
