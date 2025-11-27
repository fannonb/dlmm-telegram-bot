/**
 * Pool Discovery & Management Handlers for Telegram Bot
 * 
 * Implements:
 * - Search pool by address
 * - Search pools by token pair
 * - Top pools by TVL
 * - Top pools by APR
 * - Pool detail view
 * - Create position from pool
 */

import { BotContext } from '../types';
import { multiWalletStorage } from '../services/walletStorageMulti';
import { poolService } from '../../services/pool.service';
import { liquidityService } from '../../services/liquidity.service';
import { swapService } from '../../services/swap.service';
import { PoolInfo } from '../../config/types';
import { formatUsd, shortenAddress, formatNumber, formatPercent } from '../utils/formatting';
import { BN } from '@coral-xyz/anchor';
import chalk from 'chalk';
import { PublicKey, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { connectionService } from '../../services/connection.service';

// Constants
const POOLS_PER_PAGE = 5;
const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

// ==================== HELPER FUNCTIONS ====================

/**
 * Get token balance for a wallet
 * Handles both native SOL and SPL tokens
 */
async function getTokenBalance(keypair: Keypair, tokenMint: string, decimals: number): Promise<number> {
    try {
        const connection = connectionService.getConnection();
        
        // Check if this is native SOL
        if (tokenMint === NATIVE_SOL_MINT) {
            const balance = await connection.getBalance(keypair.publicKey);
            return balance / Math.pow(10, 9); // SOL always has 9 decimals
        }
        
        // SPL Token
        const mintPubkey = new PublicKey(tokenMint);
        const ata = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
        const accountInfo = await connection.getTokenAccountBalance(ata);
        return parseFloat(accountInfo.value.uiAmountString || '0');
    } catch (e) {
        // Token account doesn't exist or other error
        return 0;
    }
}

/**
 * Get balances for both tokens in a pool
 */
async function getPoolTokenBalances(
    keypair: Keypair, 
    pool: PoolInfo
): Promise<{ tokenXBalance: number; tokenYBalance: number }> {
    const [tokenXBalance, tokenYBalance] = await Promise.all([
        getTokenBalance(keypair, pool.tokenX.mint, pool.tokenX.decimals),
        getTokenBalance(keypair, pool.tokenY.mint, pool.tokenY.decimals)
    ]);
    return { tokenXBalance, tokenYBalance };
}

function formatPoolCard(pool: PoolInfo, index: number): string {
    const tvl = pool.tvl ? formatUsd(pool.tvl) : 'N/A';
    const volume = pool.volume24h ? formatUsd(pool.volume24h) : 'N/A';
    const apr = pool.apr ? `${pool.apr.toFixed(2)}%` : 'N/A';
    const fee = pool.feeBps ? `${(pool.feeBps / 100).toFixed(2)}%` : 'N/A';

    return `
**${index + 1}. ${pool.tokenX.symbol}/${pool.tokenY.symbol}**
\`${shortenAddress(pool.address, 8)}\`

💰 TVL: ${tvl}
📊 24h Vol: ${volume}
📈 APR: ${apr}
💸 Fee: ${fee}
📏 Bin Step: ${pool.binStep} bps
`.trim();
}

function formatPoolDetail(pool: PoolInfo): string {
    const tvl = pool.tvl ? formatUsd(pool.tvl) : 'N/A';
    const volume = pool.volume24h ? formatUsd(pool.volume24h) : 'N/A';
    const apr = pool.apr ? `${pool.apr.toFixed(2)}%` : 'N/A';
    const fee = pool.feeBps ? `${(pool.feeBps / 100).toFixed(2)}%` : 'N/A';

    return `
🏊 **${pool.tokenX.symbol}/${pool.tokenY.symbol} Pool**

📍 **Address:**
\`${pool.address}\`

**Token X:** ${pool.tokenX.symbol}
• Mint: \`${shortenAddress(pool.tokenX.mint, 8)}\`
• Decimals: ${pool.tokenX.decimals}

**Token Y:** ${pool.tokenY.symbol}
• Mint: \`${shortenAddress(pool.tokenY.mint, 8)}\`
• Decimals: ${pool.tokenY.decimals}

📊 **Pool Metrics:**
• TVL: ${tvl}
• 24h Volume: ${volume}
• APR: ${apr}
• Fee: ${fee}
• Bin Step: ${pool.binStep} bps
• Active Bin: ${pool.activeBin}
`.trim();
}

// ==================== MAIN POOL MENU ====================

export async function handlePoolsMenu(ctx: BotContext) {
    await ctx.editMessageText(
        `🏊 **POOL DISCOVERY**\n\n` +
        `Search Meteora DLMM pools by address to create new positions.\n\n` +
        `Enter a pool address to get started:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔍 Search by Address', callback_data: 'pool_search_address' }],
                    [{ text: '⬅️ Back to Main', callback_data: 'menu_main' }]
                ]
            }
        }
    );
}

// ==================== SEARCH BY ADDRESS ====================

export async function handlePoolSearchAddress(ctx: BotContext) {
    // Set conversation state to expect pool address
    ctx.session.currentFlow = 'pool_search_address';
    
    await ctx.editMessageText(
        `🔍 **Search Pool by Address**\n\n` +
        `Please send the pool address you want to look up.\n\n` +
        `Example: \`BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y\``,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
                ]
            }
        }
    );
}

export async function handlePoolAddressInput(ctx: BotContext, address: string) {
    // Clear flow state
    ctx.session.currentFlow = 'idle';
    
    const loadingMsg = await ctx.reply('🔄 Searching for pool...');
    
    try {
        const pool = await poolService.searchPoolByAddress(address.trim());
        
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id).catch(() => {});
        
        // Store pool in session for actions
        ctx.session.selectedPool = pool.address;
        
        await ctx.reply(
            formatPoolDetail(pool),
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '➕ Create Position', callback_data: `pool_create_pos_${shortenAddress(pool.address, 8)}` }],
                        [{ text: '⭐ Add to Favorites', callback_data: `pool_fav_add_${shortenAddress(pool.address, 8)}` }],
                        [{ text: '🔄 Refresh', callback_data: `pool_detail_${shortenAddress(pool.address, 8)}` }],
                        [{ text: '⬅️ Back to Pools', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
        
        console.log(chalk.green(`✓ Pool found: ${pool.tokenX.symbol}/${pool.tokenY.symbol}`));
        
    } catch (error: any) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id).catch(() => {});
        
        await ctx.reply(
            `❌ **Pool not found**\n\n` +
            `Could not find pool with address:\n\`${address}\`\n\n` +
            `Error: ${error.message || 'Unknown error'}\n\n` +
            `Please check the address and try again.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔍 Try Again', callback_data: 'pool_search_address' }],
                        [{ text: '⬅️ Back', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
    }
}

// ==================== SEARCH BY TOKEN PAIR ====================

export async function handlePoolSearchPair(ctx: BotContext) {
    // Set conversation state
    ctx.session.currentFlow = 'pool_search_pair';
    
    await ctx.editMessageText(
        `🔎 **Search by Token Pair**\n\n` +
        `Send the token pair you want to search for.\n\n` +
        `Format: \`TOKEN1 TOKEN2\` or \`TOKEN1-TOKEN2\`\n\n` +
        `Examples:\n` +
        `• \`SOL USDC\`\n` +
        `• \`SOL-USDC\`\n` +
        `• \`JTO SOL\``,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
                ]
            }
        }
    );
}

export async function handlePoolPairInput(ctx: BotContext, input: string) {
    // Clear flow state
    ctx.session.currentFlow = 'idle';
    
    // Parse input - handle both "SOL USDC" and "SOL-USDC"
    const parts = input.trim().toUpperCase().split(/[\s\-]+/);
    if (parts.length < 2) {
        await ctx.reply(
            `❌ Invalid format. Please use: \`TOKEN1 TOKEN2\` or \`TOKEN1-TOKEN2\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔍 Try Again', callback_data: 'pool_search_pair' }],
                        [{ text: '⬅️ Back', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
        return;
    }
    
    const [token1, token2] = parts;
    const loadingMsg = await ctx.reply(`🔄 Searching for ${token1}/${token2} pools...`);
    
    try {
        const pools = await poolService.getPoolsByTokenPair(token1, token2);
        
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id).catch(() => {});
        
        if (pools.length === 0) {
            await ctx.reply(
                `❌ **No pools found**\n\n` +
                `No pools found for ${token1}/${token2} pair.\n\n` +
                `Try a different pair or check token symbols.`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔍 Try Again', callback_data: 'pool_search_pair' }],
                            [{ text: '⬅️ Back', callback_data: 'pools_menu' }]
                        ]
                    }
                }
            );
            return;
        }
        
        // Sort by TVL
        pools.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
        
        // Store in session for pagination
        ctx.session.pagination = {
            data: pools,
            currentPage: 0,
            totalPages: Math.ceil(pools.length / POOLS_PER_PAGE),
            itemsPerPage: POOLS_PER_PAGE,
            listType: 'pools',
            type: 'pool_search'
        };
        
        await sendPoolList(ctx, pools, 0, `${token1}/${token2}`);
        
    } catch (error: any) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id).catch(() => {});
        
        await ctx.reply(
            `❌ **Search failed**\n\n` +
            `Error: ${error.message || 'Unknown error'}`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔍 Try Again', callback_data: 'pool_search_pair' }],
                        [{ text: '⬅️ Back', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
    }
}

// ==================== TOP POOLS ====================

export async function handleTopPoolsByTVL(ctx: BotContext) {
    await ctx.answerCbQuery('Loading...');
    
    const loadingMsg = await ctx.editMessageText(
        '🔄 Fetching top pools by TVL...',
        { parse_mode: 'Markdown' }
    );
    
    try {
        const pools = await poolService.getTopPoolsByTVL(15);
        
        ctx.session.pagination = {
            data: pools,
            currentPage: 0,
            totalPages: Math.ceil(pools.length / POOLS_PER_PAGE),
            itemsPerPage: POOLS_PER_PAGE,
            listType: 'pools',
            type: 'pool_tvl'
        };
        
        await sendPoolList(ctx, pools, 0, 'Top by TVL', true);
        
    } catch (error: any) {
        await ctx.editMessageText(
            `❌ **Failed to fetch pools**\n\n` +
            `Error: ${error.message || 'Unknown error'}`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Retry', callback_data: 'pool_top_tvl' }],
                        [{ text: '⬅️ Back', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
    }
}

export async function handleTopPoolsByAPR(ctx: BotContext) {
    await ctx.answerCbQuery('Loading...');
    
    await ctx.editMessageText(
        '🔄 Fetching top pools by APR...',
        { parse_mode: 'Markdown' }
    );
    
    try {
        const pools = await poolService.getTopPoolsByAPR(15);
        
        ctx.session.pagination = {
            data: pools,
            currentPage: 0,
            totalPages: Math.ceil(pools.length / POOLS_PER_PAGE),
            itemsPerPage: POOLS_PER_PAGE,
            listType: 'pools',
            type: 'pool_apr'
        };
        
        await sendPoolList(ctx, pools, 0, 'Top by APR', true);
        
    } catch (error: any) {
        await ctx.editMessageText(
            `❌ **Failed to fetch pools**\n\n` +
            `Error: ${error.message || 'Unknown error'}`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Retry', callback_data: 'pool_top_apr' }],
                        [{ text: '⬅️ Back', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
    }
}

// ==================== POOL LIST PAGINATION ====================

async function sendPoolList(
    ctx: BotContext, 
    pools: PoolInfo[], 
    page: number, 
    title: string,
    isEdit: boolean = false
) {
    const startIdx = page * POOLS_PER_PAGE;
    const endIdx = Math.min(startIdx + POOLS_PER_PAGE, pools.length);
    const pagePools = pools.slice(startIdx, endIdx);
    const totalPages = Math.ceil(pools.length / POOLS_PER_PAGE);
    
    let message = `🏊 **${title}**\n`;
    message += `📄 Page ${page + 1}/${totalPages} (${pools.length} pools)\n\n`;
    
    pagePools.forEach((pool, idx) => {
        message += formatPoolCard(pool, startIdx + idx) + '\n\n';
    });
    
    // Build navigation buttons
    const navButtons: any[] = [];
    if (page > 0) {
        navButtons.push({ text: '⬅️ Prev', callback_data: `pools_page_${page - 1}` });
    }
    if (endIdx < pools.length) {
        navButtons.push({ text: 'Next ➡️', callback_data: `pools_page_${page + 1}` });
    }
    
    // Pool selection buttons
    const poolButtons = pagePools.map((pool, idx) => ({
        text: `${startIdx + idx + 1}. ${pool.tokenX.symbol}/${pool.tokenY.symbol}`,
        callback_data: `pool_select_${shortenAddress(pool.address, 8)}`
    }));
    
    // Arrange pool buttons in rows of 2
    const poolButtonRows: any[][] = [];
    for (let i = 0; i < poolButtons.length; i += 2) {
        poolButtonRows.push(poolButtons.slice(i, i + 2));
    }
    
    const keyboard = [
        ...poolButtonRows,
        navButtons.length > 0 ? navButtons : [],
        [{ text: '⬅️ Back to Pools', callback_data: 'pools_menu' }]
    ].filter(row => row.length > 0);
    
    const options = {
        parse_mode: 'Markdown' as const,
        reply_markup: { inline_keyboard: keyboard }
    };
    
    if (isEdit) {
        await ctx.editMessageText(message, options);
    } else {
        await ctx.reply(message, options);
    }
}

export async function handlePoolPage(ctx: BotContext, page: number) {
    await ctx.answerCbQuery();
    
    const pagination = ctx.session.pagination;
    if (!pagination?.data) {
        await ctx.editMessageText('Session expired. Please search again.');
        return;
    }
    
    const pools = pagination.data as PoolInfo[];
    const title = pagination.type === 'pool_tvl' ? 'Top by TVL' :
                  pagination.type === 'pool_apr' ? 'Top by APR' : 'Search Results';
    
    await sendPoolList(ctx, pools, page, title, true);
}

// ==================== POOL DETAIL ====================

export async function handlePoolDetail(ctx: BotContext, shortAddr: string) {
    await ctx.answerCbQuery('Loading...');
    
    // Find pool from pagination data or session
    let pool: PoolInfo | undefined;
    
    if (ctx.session.pagination?.data) {
        const pools = ctx.session.pagination.data as PoolInfo[];
        pool = pools.find(p => p.address.startsWith(shortAddr) || p.address.includes(shortAddr));
    }
    
    if (!pool && ctx.session.selectedPool) {
        try {
            pool = await poolService.searchPoolByAddress(ctx.session.selectedPool);
        } catch (e) {}
    }
    
    if (!pool) {
        // Try to fetch by partial address
        try {
            const allPools = await poolService.fetchAllPools();
            const found = allPools.find((p: any) => 
                p.address.startsWith(shortAddr) || p.address.includes(shortAddr)
            );
            if (found) {
                pool = await poolService.searchPoolByAddress(found.address);
            }
        } catch (e) {}
    }
    
    if (!pool) {
        await ctx.editMessageText(
            '❌ Pool not found. Please search again.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔍 Search', callback_data: 'pool_search_address' }],
                        [{ text: '⬅️ Back', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
        return;
    }
    
    ctx.session.selectedPool = pool.address;
    
    await ctx.editMessageText(
        formatPoolDetail(pool),
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➕ Create Position', callback_data: `pool_create_pos_${shortenAddress(pool.address, 8)}` }],
                    [{ text: '⭐ Add to Favorites', callback_data: `pool_fav_add_${shortenAddress(pool.address, 8)}` }],
                    [{ text: '🔄 Refresh', callback_data: `pool_detail_${shortenAddress(pool.address, 8)}` }],
                    [{ text: '⬅️ Back to Pools', callback_data: 'pools_menu' }]
                ]
            }
        }
    );
}

export async function handlePoolSelect(ctx: BotContext, shortAddr: string) {
    await handlePoolDetail(ctx, shortAddr);
}

// ==================== FAVORITES ====================

export async function handleAddToFavorites(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    // TODO: Implement favorites storage in userDataService
    await ctx.answerCbQuery('⭐ Added to favorites!');
    
    // For now, just acknowledge
    console.log(chalk.green(`✓ User ${telegramId} added pool ${shortAddr} to favorites`));
}

// ==================== CREATE POSITION FROM POOL ====================

export async function handleCreatePositionFromPool(ctx: BotContext, shortAddr: string) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    // Check wallet
    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        await ctx.editMessageText(
            '❌ **No wallet connected**\n\n' +
            'Please connect a wallet first to create positions.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔑 Connect Wallet', callback_data: 'mwallet_menu' }],
                        [{ text: '⬅️ Back', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
        return;
    }
    
    await ctx.answerCbQuery('Loading pool details...');
    
    // Find pool
    let pool: PoolInfo | undefined;
    if (ctx.session.selectedPool) {
        try {
            pool = await poolService.searchPoolByAddress(ctx.session.selectedPool);
        } catch (e) {}
    }
    
    if (!pool) {
        await ctx.editMessageText(
            '❌ Pool not found. Please select a pool again.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔍 Search Pool', callback_data: 'pool_search_address' }],
                        [{ text: '⬅️ Back', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
        return;
    }
    
    // Store pool in flow data
    ctx.session.flowData = {
        poolAddress: pool.address,
        poolInfo: pool,
        step: 'pool_info'
    };
    
    // STEP 1: Show Pool Active Bin & Price Information (like CLI)
    await showPoolInfoStep(ctx, pool);
}

// ==================== POSITION WIZARD: STEP 1 - POOL INFO ====================

async function showPoolInfoStep(ctx: BotContext, pool: PoolInfo) {
    // Try to get active bin details
    let activeBinInfo = '';
    try {
        const activeBinDetails = await poolService.getActiveBinDetails(pool.address);
        activeBinInfo = `• Bin Liquidity: ${activeBinDetails.xAmount.toFixed(4)} ${pool.tokenX.symbol}\n` +
                        `                 ${activeBinDetails.yAmount.toFixed(4)} ${pool.tokenY.symbol}\n`;
    } catch (e) {
        // Skip if unavailable
    }

    const message = `
📊 **STEP 1: POOL ACTIVE BIN & PRICE**

━━━━━━━━━━━━━━━━━━━━━━

✅ **Pool Found:** ${pool.tokenX.symbol}/${pool.tokenY.symbol}
📍 Address: \`${shortenAddress(pool.address, 8)}\`

📊 **Active Bin Information:**
• Active Bin ID: ${pool.activeBin}
• Current Price: $${pool.price?.toFixed(6) || 'N/A'}
${activeBinInfo}• Bin Step: ${pool.binStep} bps (${(pool.binStep / 100).toFixed(2)}%/bin)
• TVL: $${pool.tvl?.toLocaleString() || 'N/A'}
• APR: ${pool.apr?.toFixed(2) || 'N/A'}%

━━━━━━━━━━━━━━━━━━━━━━

ℹ️ _The active bin is where trading currently happens. It's the ONLY bin earning fees right now._

Press **Continue** to get AI strategy analysis.
`.trim();

    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🤖 Continue to AI Analysis', callback_data: 'newpos_ai_analyze' }],
                [{ text: '⏭️ Skip AI (Manual Setup)', callback_data: 'newpos_skip_ai' }],
                [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
            ]
        }
    });
}

// ==================== POSITION WIZARD: STEP 2 - AI ANALYSIS ====================

export async function handleNewPositionAIAnalysis(ctx: BotContext) {
    await ctx.answerCbQuery('Analyzing with AI...');
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolInfo) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    const pool = flowData.poolInfo as PoolInfo;
    
    // Show loading message
    await ctx.editMessageText(
        `🤖 **AI STRATEGY ANALYSIS**\n\n` +
        `Analyzing pool characteristics, market data, and optimal strategy...\n\n` +
        `⏳ _This may take 30-60 seconds..._`,
        { parse_mode: 'Markdown' }
    );
    
    try {
        // Import LLM agent
        const { llmAgent } = await import('../../services/llmAgent.service');
        
        if (!llmAgent.isAvailable()) {
            // LLM not configured, use algorithmic recommendation
            await showAlgorithmicRecommendation(ctx, pool);
            return;
        }
        
        // Get AI recommendation
        const aiRecommendation = await llmAgent.analyzePoolForCreation(pool);
        
        // Store AI recommendation in flow data
        flowData.aiRecommendation = aiRecommendation;
        
        // Show AI recommendation
        await showAIRecommendation(ctx, pool, aiRecommendation);
        
    } catch (error: any) {
        console.error('AI analysis error:', error);
        
        // Fallback to algorithmic
        await ctx.editMessageText(
            `⚠️ **AI Analysis Failed**\n\n` +
            `Error: ${error.message}\n\n` +
            `Falling back to algorithmic guidance...`,
            { parse_mode: 'Markdown' }
        );
        
        await new Promise(r => setTimeout(r, 2000));
        await showAlgorithmicRecommendation(ctx, pool);
    }
}

async function showAIRecommendation(ctx: BotContext, pool: PoolInfo, recommendation: any) {
    const flowData = ctx.session.flowData!;
    
    const confidenceLevel = recommendation.confidence >= 85 ? '🟢 HIGH' :
                           recommendation.confidence >= 70 ? '🟡 MEDIUM' : '🔴 LOW';
    
    // Calculate bin range based on AI recommendation
    const bidBins = recommendation.binConfiguration?.bidBins || 15;
    const askBins = recommendation.binConfiguration?.askBins || 15;
    const minBinId = pool.activeBin - bidBins;
    const maxBinId = pool.activeBin + askBins;
    
    // Calculate price range
    const minPrice = poolService.calculateBinPrice(minBinId, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    const maxPrice = poolService.calculateBinPrice(maxBinId, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    const currentPrice = pool.price || poolService.calculateBinPrice(pool.activeBin, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    
    const message = `
🤖 **AI RECOMMENDATION**

━━━━━━━━━━━━━━━━━━━━━━

📊 **Strategy:** ${recommendation.strategy}
📈 **Confidence:** ${recommendation.confidence}% ${confidenceLevel}
🌡️ **Market Regime:** ${recommendation.marketRegime || 'N/A'}

**Why This Strategy?**
${recommendation.reasoning.slice(0, 3).map((r: string) => `✓ ${r}`).join('\n')}

**Recommended Configuration:**
• Bid Bins: ${bidBins}
• Ask Bins: ${askBins}
• Total Range: ${bidBins + askBins} bins
• Split: ${recommendation.liquidityDistribution?.tokenXPercentage || 50}% ${pool.tokenX.symbol} / ${recommendation.liquidityDistribution?.tokenYPercentage || 50}% ${pool.tokenY.symbol}

**Range Details:**
• Bin Range: ${minBinId} → ${maxBinId}
• Price Range: $${minPrice.toFixed(4)} - $${maxPrice.toFixed(4)}
• Current Price: $${currentPrice.toFixed(4)}

**Expected Performance:**
• Est. APR: ~${recommendation.expectedPerformance?.estimatedAPR?.toFixed(1) || 'N/A'}%
• Fee Efficiency: ${recommendation.expectedPerformance?.feeEfficiency || 'N/A'}%
• Rebalance: ${recommendation.expectedPerformance?.rebalanceFrequency || 'N/A'}

${recommendation.risks?.length > 0 ? '**Risks:**\n' + recommendation.risks.slice(0, 2).map((r: string) => `⚠️ ${r}`).join('\n') : ''}
`.trim();

    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '✅ Apply AI Recommendation', callback_data: 'newpos_apply_ai' }],
                [{ text: '✏️ Customize Settings', callback_data: 'newpos_skip_ai' }],
                [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
            ]
        }
    });
}

async function showAlgorithmicRecommendation(ctx: BotContext, pool: PoolInfo) {
    const flowData = ctx.session.flowData!;
    
    // Simple algorithmic recommendation
    const isStablePair = ['USDC', 'USDT', 'DAI'].includes(pool.tokenX.symbol || '') && 
                         ['USDC', 'USDT', 'DAI'].includes(pool.tokenY.symbol || '');
    
    const strategy = isStablePair ? 'Curve' : 'Spot';
    const binsPerSide = isStablePair ? 5 : 15;
    
    // Calculate bin range
    const minBinId = pool.activeBin - binsPerSide;
    const maxBinId = pool.activeBin + binsPerSide;
    
    // Calculate price range
    const minPrice = poolService.calculateBinPrice(minBinId, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    const maxPrice = poolService.calculateBinPrice(maxBinId, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    const currentPrice = pool.price || poolService.calculateBinPrice(pool.activeBin, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    
    // Create mock recommendation
    const algoRecommendation = {
        strategy,
        confidence: 70,
        marketRegime: 'Neutral',
        reasoning: [
            isStablePair ? 'Both tokens are stablecoins - concentrated liquidity recommended' : 'Mixed volatility market',
            'Balanced distribution suitable for general market making'
        ],
        binConfiguration: {
            bidBins: binsPerSide,
            askBins: binsPerSide,
            totalBins: binsPerSide * 2
        },
        liquidityDistribution: {
            tokenXPercentage: 50,
            tokenYPercentage: 50,
            isAsymmetric: false
        },
        expectedPerformance: {
            estimatedAPR: pool.apr || 10,
            feeEfficiency: 75,
            rebalanceFrequency: 'weekly'
        },
        risks: []
    };
    
    flowData.aiRecommendation = algoRecommendation;
    
    const message = `
📊 **ALGORITHMIC RECOMMENDATION**

_(AI not configured - using rule-based analysis)_

━━━━━━━━━━━━━━━━━━━━━━

📊 **Strategy:** ${strategy}
📈 **Confidence:** 70% 🟡 MEDIUM

**Analysis:**
${algoRecommendation.reasoning.map((r: string) => `• ${r}`).join('\n')}

**Suggested Configuration:**
• Bins per side: ${binsPerSide}
• Total Range: ${binsPerSide * 2} bins
• Split: 50% ${pool.tokenX.symbol} / 50% ${pool.tokenY.symbol}

**Range Details:**
• Bin Range: ${minBinId} → ${maxBinId}
• Price Range: $${minPrice.toFixed(4)} - $${maxPrice.toFixed(4)}
• Current Price: $${currentPrice.toFixed(4)}
`.trim();

    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '✅ Apply Recommendation', callback_data: 'newpos_apply_ai' }],
                [{ text: '✏️ Customize Settings', callback_data: 'newpos_skip_ai' }],
                [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
            ]
        }
    });
}

// Handler for applying AI recommendation
export async function handleApplyAIRecommendation(ctx: BotContext) {
    await ctx.answerCbQuery('Applying AI settings...');
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolInfo || !flowData.aiRecommendation) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    const pool = flowData.poolInfo as PoolInfo;
    const recommendation = flowData.aiRecommendation;
    
    // Apply AI recommended settings
    flowData.strategy = recommendation.strategy as 'Spot' | 'Curve' | 'BidAsk';
    flowData.binsPerSide = recommendation.binConfiguration?.bidBins || 15;
    flowData.activeBinId = pool.activeBin;
    flowData.minBinId = pool.activeBin - (recommendation.binConfiguration?.bidBins || 15);
    flowData.maxBinId = pool.activeBin + (recommendation.binConfiguration?.askBins || 15);
    flowData.tokenXPercentage = recommendation.liquidityDistribution?.tokenXPercentage || 50;
    flowData.tokenYPercentage = recommendation.liquidityDistribution?.tokenYPercentage || 50;
    flowData.step = 'amounts';
    
    // Skip to amounts entry
    await showAmountInput(ctx, pool);
}

// Handler for manual/skip AI
export async function handleSkipAI(ctx: BotContext) {
    await ctx.answerCbQuery();
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolInfo) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    const pool = flowData.poolInfo as PoolInfo;
    
    // Show manual strategy selection
    await showStrategySelection(ctx, pool);
}

// ==================== POSITION WIZARD: MANUAL STRATEGY SELECTION ====================

async function showStrategySelection(ctx: BotContext, pool: PoolInfo) {
    const message = `
➕ **CREATE POSITION - Manual Setup**

**Pool:** ${pool.tokenX.symbol}/${pool.tokenY.symbol}
**Address:** \`${shortenAddress(pool.address, 8)}\`
**Active Bin:** ${pool.activeBin}
**Bin Step:** ${pool.binStep} bps

━━━━━━━━━━━━━━━━━━━━━━

**Choose Strategy:**

🎯 **Spot** - Balanced 50/50 distribution
_Best for general market making_

📈 **Curve** - Concentrated around peg
_Best for stablecoin pairs_

📍 **Bid-Ask** - Custom asymmetric ranges
_Best for directional views_
`.trim();

    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎯 Spot (Balanced)', callback_data: 'newpos_strategy_Spot' }],
                [{ text: '📈 Curve (Concentrated)', callback_data: 'newpos_strategy_Curve' }],
                [{ text: '📍 Bid-Ask (Custom)', callback_data: 'newpos_strategy_BidAsk' }],
                [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
            ]
        }
    });
}

export async function handleStrategySelection(ctx: BotContext, strategy: 'Spot' | 'Curve' | 'BidAsk') {
    await ctx.answerCbQuery();
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolAddress) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    flowData.strategy = strategy;
    flowData.step = 'range';
    
    const pool = flowData.poolInfo as PoolInfo;
    
    // Show range selection
    await showRangeSelection(ctx, pool, strategy);
}

// ==================== POSITION WIZARD: STEP 2 - RANGE ====================

async function showRangeSelection(ctx: BotContext, pool: PoolInfo, strategy: string) {
    const activeBin = pool.activeBin;
    
    // Default bins per side based on strategy
    const defaultBins = strategy === 'Curve' ? 5 : 
                        strategy === 'BidAsk' ? 25 : 15;
    
    const minBin = activeBin - defaultBins;
    const maxBin = activeBin + defaultBins;
    
    // Calculate price range
    const minPrice = poolService.calculateBinPrice(minBin, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    const maxPrice = poolService.calculateBinPrice(maxBin, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    
    const message = `
➕ **CREATE POSITION**

**Pool:** ${pool.tokenX.symbol}/${pool.tokenY.symbol}
**Strategy:** ${strategy}

━━━━━━━━━━━━━━━━━━━━━━

**Step 2/4: Set Range**

📊 **Current Active Bin:** ${activeBin}

**Default Range (${defaultBins} bins/side):**
• Min Bin: ${minBin}
• Max Bin: ${maxBin}
• Price Range: ${minPrice.toFixed(6)} - ${maxPrice.toFixed(6)}

Choose range width:
`.trim();

    // Store default values
    ctx.session.flowData!.defaultBins = defaultBins;
    ctx.session.flowData!.minBinId = minBin;
    ctx.session.flowData!.maxBinId = maxBin;

    // Determine recommended bins based on pair type
    const tokenXSymbol = pool.tokenX?.symbol || '';
    const tokenYSymbol = pool.tokenY?.symbol || '';
    const stableSymbols = ['USDC', 'USDT', 'DAI', 'PYUSD'];
    const memeTokens = ['BONK', 'WIF', 'POPCAT', 'BOME', 'MEW', 'MYRO', 'SLERF', 'TRUMP'];
    const isMemeToken = memeTokens.includes(tokenXSymbol) || memeTokens.includes(tokenYSymbol);
    const hasStable = stableSymbols.includes(tokenXSymbol) || stableSymbols.includes(tokenYSymbol);
    const isStablePair = stableSymbols.includes(tokenXSymbol) && stableSymbols.includes(tokenYSymbol);
    
    // Set recommended bins based on pair type
    const recommendedBins = isStablePair ? 69 : isMemeToken ? 100 : hasStable ? 69 : 50;
    const recommendedLabel = `✅ ${recommendedBins} bins (recommended)`;
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: recommendedLabel, callback_data: `newpos_range_${recommendedBins}` }
                ],
                [
                    { text: '34 bins (~5%)', callback_data: 'newpos_range_34' },
                    { text: '50 bins (~7%)', callback_data: 'newpos_range_50' },
                    { text: '69 bins (max)', callback_data: 'newpos_range_69' }
                ],
                [
                    { text: '25 bins (narrow)', callback_data: 'newpos_range_25' },
                ],
                [{ text: '✏️ Custom Range', callback_data: 'newpos_range_custom' }],
                [
                    { text: '⬅️ Back', callback_data: `pool_create_pos_${shortenAddress(pool.address, 8)}` },
                    { text: '❌ Cancel', callback_data: 'pools_menu' }
                ]
            ]
        }
    });
}

export async function handleRangeSelection(ctx: BotContext, binsPerSide: number | 'custom') {
    await ctx.answerCbQuery();
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolAddress) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    const pool = flowData.poolInfo as PoolInfo;
    
    if (binsPerSide === 'custom') {
        // Enter custom range input mode
        ctx.session.currentFlow = 'newpos_custom_range';
        await ctx.editMessageText(
            `✏️ **Custom Range**\n\n` +
            `Enter your desired range as:\n` +
            `\`MIN_BIN MAX_BIN\`\n\n` +
            `Current Active Bin: ${pool.activeBin}\n\n` +
            `Example: \`${pool.activeBin - 20} ${pool.activeBin + 20}\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '❌ Cancel', callback_data: `pool_create_pos_${shortenAddress(pool.address, 8)}` }]
                    ]
                }
            }
        );
        return;
    }
    
    // Calculate range
    const minBin = pool.activeBin - binsPerSide;
    const maxBin = pool.activeBin + binsPerSide;
    
    flowData.binsPerSide = binsPerSide;
    flowData.activeBinId = pool.activeBin;
    flowData.minBinId = minBin;
    flowData.maxBinId = maxBin;
    flowData.step = 'amounts';
    
    // Show amount input
    await showAmountInput(ctx, pool);
}

export async function handleCustomRangeInput(ctx: BotContext, input: string) {
    ctx.session.currentFlow = 'idle';
    
    const parts = input.trim().split(/\s+/);
    if (parts.length !== 2) {
        await ctx.reply(
            '❌ Invalid format. Please use: `MIN_BIN MAX_BIN`',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'newpos_range_custom' }]
                    ]
                }
            }
        );
        return;
    }
    
    const minBin = parseInt(parts[0]);
    const maxBin = parseInt(parts[1]);
    
    if (isNaN(minBin) || isNaN(maxBin) || minBin >= maxBin) {
        await ctx.reply(
            '❌ Invalid bin IDs. Min must be less than Max.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'newpos_range_custom' }]
                    ]
                }
            }
        );
        return;
    }
    
    const flowData = ctx.session.flowData!;
    const pool = flowData.poolInfo as PoolInfo;
    
    flowData.activeBinId = pool.activeBin;
    flowData.minBinId = minBin;
    flowData.maxBinId = maxBin;
    flowData.binsPerSide = Math.floor((maxBin - minBin) / 2);
    flowData.step = 'amounts';
    
    await showAmountInput(ctx, pool);
}

// Handler for retrying amount input
export async function handleAmountsRetry(ctx: BotContext) {
    await ctx.answerCbQuery();
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolInfo) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    await showAmountInput(ctx, flowData.poolInfo as PoolInfo);
}

// ==================== POSITION WIZARD: STEP 3 - AMOUNTS ====================

async function showAmountInput(ctx: BotContext, pool: PoolInfo) {
    const flowData = ctx.session.flowData!;
    const telegramId = ctx.from!.id;
    
    // Get wallet balances for the actual pool tokens
    let tokenXBalance = 0;
    let tokenYBalance = 0;
    let balanceInfo = '';
    try {
        const keypair = multiWalletStorage.getActiveKeypair(telegramId);
        if (keypair) {
            const balances = await getPoolTokenBalances(keypair, pool);
            tokenXBalance = balances.tokenXBalance;
            tokenYBalance = balances.tokenYBalance;
            balanceInfo = `\n**Your ${pool.tokenX.symbol}:** ${tokenXBalance.toFixed(4)}\n`;
            balanceInfo += `**Your ${pool.tokenY.symbol}:** ${tokenYBalance.toFixed(4)}\n`;
        }
    } catch (e) {}
    
    const minBinId = flowData.minBinId || 0;
    const maxBinId = flowData.maxBinId || 0;
    const minPrice = poolService.calculateBinPrice(minBinId, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    const maxPrice = poolService.calculateBinPrice(maxBinId, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    
    // Show AI split recommendation if available
    let splitInfo = '';
    if (flowData.tokenXPercentage && flowData.tokenYPercentage) {
        splitInfo = `\n🤖 **AI Split:** ${flowData.tokenXPercentage}% ${pool.tokenX.symbol} / ${flowData.tokenYPercentage}% ${pool.tokenY.symbol}\n`;
    }
    
    const message = `
➕ **CREATE POSITION - Amount Entry**

**Pool:** ${pool.tokenX.symbol}/${pool.tokenY.symbol}
**Strategy:** ${flowData.strategy}
**Range:** ${flowData.minBinId} → ${flowData.maxBinId}
**Price Range:** ${minPrice.toFixed(6)} - ${maxPrice.toFixed(6)}
${balanceInfo}${splitInfo}
━━━━━━━━━━━━━━━━━━━━━━

**Choose Input Method:**

🤖 **Auto-Calculate** - Enter ${pool.tokenX.symbol} amount, AI calculates ${pool.tokenY.symbol}
✏️ **Manual** - Enter both amounts yourself
`.trim();

    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: `🤖 Auto-Calculate (Enter ${pool.tokenX.symbol} only)`, callback_data: 'newpos_amount_auto' }],
                [{ text: '✏️ Manual Entry (Both amounts)', callback_data: 'newpos_amount_manual' }],
                [{ text: '⬅️ Back to Range', callback_data: `newpos_strategy_${flowData.strategy}` }],
                [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
            ]
        }
    });
}

// Handler for auto-calculate amount option
export async function handleAutoAmountEntry(ctx: BotContext) {
    await ctx.answerCbQuery();
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolInfo) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    const pool = flowData.poolInfo as PoolInfo;
    
    // Get wallet balance for the actual tokenX
    let balanceInfo = '';
    try {
        const telegramId = ctx.from!.id;
        const keypair = multiWalletStorage.getActiveKeypair(telegramId);
        if (keypair) {
            const tokenXBalance = await getTokenBalance(keypair, pool.tokenX.mint, pool.tokenX.decimals);
            balanceInfo = `\n**Available:** ${tokenXBalance.toFixed(4)} ${pool.tokenX.symbol}\n`;
        }
    } catch (e) {}
    
    const splitInfo = flowData.tokenXPercentage && flowData.tokenYPercentage
        ? `\n🤖 AI will auto-calculate ${pool.tokenY.symbol} based on ${flowData.tokenXPercentage}%/${flowData.tokenYPercentage}% split\n`
        : `\n🧮 ${pool.tokenY.symbol} will be auto-calculated based on strategy\n`;
    
    const message = `
🤖 **AUTO-CALCULATE MODE**

**Pool:** ${pool.tokenX.symbol}/${pool.tokenY.symbol}
${balanceInfo}${splitInfo}
━━━━━━━━━━━━━━━━━━━━━━

Enter the amount of **${pool.tokenX.symbol}** you want to deposit:

Example: \`0.1\`
`.trim();

    ctx.session.currentFlow = 'newpos_amount_auto';
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '⬅️ Back', callback_data: 'newpos_amounts_retry' }],
                [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
            ]
        }
    });
}

// Handler for manual amount entry
export async function handleManualAmountEntry(ctx: BotContext) {
    await ctx.answerCbQuery();
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolInfo) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    const pool = flowData.poolInfo as PoolInfo;
    
    const message = `
✏️ **MANUAL ENTRY MODE**

**Pool:** ${pool.tokenX.symbol}/${pool.tokenY.symbol}

━━━━━━━━━━━━━━━━━━━━━━

Enter both amounts as:
\`AMOUNT_X AMOUNT_Y\`

Example: \`0.5 100\`
(0.5 ${pool.tokenX.symbol} and 100 ${pool.tokenY.symbol})
`.trim();

    ctx.session.currentFlow = 'newpos_amounts';
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '⬅️ Back', callback_data: 'newpos_amounts_retry' }],
                [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
            ]
        }
    });
}

// Process auto-calculate input (single amount X)
export async function handleAutoAmountInput(ctx: BotContext, input: string) {
    ctx.session.currentFlow = 'idle';
    
    const amountX = parseFloat(input.trim());
    
    if (isNaN(amountX) || amountX <= 0) {
        await ctx.reply(
            '❌ Invalid amount. Please enter a positive number.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'newpos_amount_auto' }]
                    ]
                }
            }
        );
        return;
    }
    
    const flowData = ctx.session.flowData!;
    const pool = flowData.poolInfo as PoolInfo;
    
    // Show calculating message
    await ctx.reply('🧮 Calculating optimal Y amount based on strategy...');
    
    try {
        let amountY = 0;
        let calculationMethod = '';
        
        // If AI recommendation exists with liquidity distribution, use it
        if (flowData.tokenXPercentage && flowData.tokenYPercentage) {
            const tokenXPercentage = flowData.tokenXPercentage / 100;
            const tokenYPercentage = flowData.tokenYPercentage / 100;
            const currentPrice = pool.price || 1;
            
            // Calculate Y amount based on AI's recommended split
            // Value of X in USD: amountX * priceX
            // We want: (valueX / (valueX + valueY)) = tokenXPercentage
            // So: valueY = (valueX * tokenYPercentage) / tokenXPercentage
            const valueX = amountX * currentPrice;
            const valueY = (valueX * tokenYPercentage) / tokenXPercentage;
            amountY = valueY; // USDC is already in USD terms
            
            calculationMethod = `AI's ${flowData.tokenXPercentage}%/${flowData.tokenYPercentage}% split`;
        } else {
            // Fallback to SDK calculation
            const minBin = flowData.minBinId || pool.activeBin - 15;
            const maxBin = flowData.maxBinId || pool.activeBin + 15;
            
            amountY = await liquidityService.calculateOptimalYAmount(
                pool.address,
                amountX,
                minBin,
                maxBin,
                0 // Spot strategy
            );
            
            calculationMethod = `${flowData.strategy || 'Spot'} strategy`;
        }
        
        // Store in flow data
        flowData.amountX = amountX;
        flowData.amountY = amountY;
        
        // Check if user has enough of both tokens
        const telegramId = ctx.from!.id;
        const keypair = multiWalletStorage.getActiveKeypair(telegramId);
        let hasEnoughX = true;
        let hasEnoughY = true;
        let tokenXBalance = 0;
        let tokenYBalance = 0;
        let solBalance = 0;
        
        if (keypair) {
            // Get actual token balances for the pool tokens
            const balances = await getPoolTokenBalances(keypair, pool);
            tokenXBalance = balances.tokenXBalance;
            tokenYBalance = balances.tokenYBalance;
            hasEnoughX = tokenXBalance >= amountX;
            hasEnoughY = tokenYBalance >= amountY;
            
            // Also get SOL balance for potential swaps
            const connection = connectionService.getConnection();
            solBalance = await connection.getBalance(keypair.publicKey) / 1e9;
        }
        
        // Calculate shortfalls for auto-swap
        const tokenXShortfall = Math.max(0, amountX - tokenXBalance);
        const tokenYShortfall = Math.max(0, amountY - tokenYBalance);
        
        // Determine auto-swap options
        // Option 1: Short on tokenX - can swap from tokenY or SOL
        // Option 2: Short on tokenY - can swap from tokenX or SOL
        const canAutoSwapForX = !hasEnoughX && tokenXShortfall > 0 && (tokenYBalance > 0 || solBalance > 0.01);
        const canAutoSwapForY = hasEnoughX && !hasEnoughY && tokenYShortfall > 0;
        
        // Build result message
        let resultMessage = `
✅ **Y Amount Calculated!**

**Auto-calculated ${pool.tokenY.symbol}:** ${amountY.toFixed(6)}
_(Based on ${calculationMethod})_

**Your Deposit:**
• ${amountX} ${pool.tokenX.symbol}
• ${amountY.toFixed(6)} ${pool.tokenY.symbol}
`;

        const buttons: any[] = [];
        
        if (!hasEnoughX && canAutoSwapForX) {
            // Offer auto-swap to get tokenX
            resultMessage += `
⚠️ **Insufficient ${pool.tokenX.symbol}!**
You have: ${tokenXBalance.toFixed(4)} ${pool.tokenX.symbol}
Need: ${amountX.toFixed(4)} ${pool.tokenX.symbol}
Shortfall: ${tokenXShortfall.toFixed(4)} ${pool.tokenX.symbol}

🔄 **Auto-Swap Available!**`;
            
            // Determine what we can swap from
            if (solBalance > 0.01) {
                resultMessage += `\nYou have ${solBalance.toFixed(4)} SOL available for swap.`;
            }
            if (tokenYBalance > 0) {
                resultMessage += `\nYou have ${tokenYBalance.toFixed(4)} ${pool.tokenY.symbol} available for swap.`;
            }
            
            // Store shortfall for auto-swap - swap for tokenX
            flowData.autoSwapNeeded = true;
            flowData.autoSwapDirection = 'toX'; // Swap TO tokenX
            flowData.swapAmountX = tokenXShortfall;
            flowData.availableSol = solBalance;
            flowData.availableTokenY = tokenYBalance;
            
            buttons.push([{ text: `🔄 Auto-Swap & Create Position`, callback_data: 'newpos_autoswap_x' }]);
            buttons.push([{ text: '🔄 Try Different Amount', callback_data: 'newpos_amount_auto' }]);
        } else if (!hasEnoughX) {
            resultMessage += `\n⚠️ **Insufficient ${pool.tokenX.symbol}!** You have ${tokenXBalance.toFixed(4)}`;
            resultMessage += `\n\n💡 You need ${pool.tokenX.symbol} tokens to create this position. Buy some first or try a different pool.`;
            buttons.push([{ text: '🔄 Try Different Amount', callback_data: 'newpos_amount_auto' }]);
        } else if (!hasEnoughY && canAutoSwapForY) {
            // Offer auto-swap option for tokenY
            resultMessage += `
⚠️ **Insufficient ${pool.tokenY.symbol}!**
You have: ${tokenYBalance.toFixed(4)} ${pool.tokenY.symbol}
Need: ${amountY.toFixed(4)} ${pool.tokenY.symbol}
Shortfall: ${tokenYShortfall.toFixed(4)} ${pool.tokenY.symbol}

🔄 **Auto-Swap Available!**
We can swap some ${pool.tokenX.symbol} to get the needed ${pool.tokenY.symbol}.
`;
            // Store shortfall for auto-swap
            flowData.autoSwapNeeded = true;
            flowData.autoSwapDirection = 'toY'; // Swap TO tokenY
            flowData.swapAmountY = tokenYShortfall;
            
            buttons.push([{ text: `🔄 Auto-Swap & Create Position`, callback_data: 'newpos_autoswap' }]);
            buttons.push([{ text: '🔄 Try Different Amount', callback_data: 'newpos_amount_auto' }]);
        } else if (!hasEnoughY) {
            resultMessage += `\n⚠️ **Insufficient ${pool.tokenY.symbol}!** You have ${tokenYBalance.toFixed(4)}`;
            buttons.push([{ text: '🔄 Try Different Amount', callback_data: 'newpos_amount_auto' }]);
        } else {
            // All good, can proceed
            flowData.step = 'confirm';
            buttons.push([{ text: '✅ Confirm & Create Position', callback_data: 'newpos_execute' }]);
        }
        
        buttons.push([{ text: '⬅️ Back', callback_data: 'newpos_amounts_retry' }]);
        buttons.push([{ text: '❌ Cancel', callback_data: 'pools_menu' }]);
        
        await ctx.reply(resultMessage.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: buttons
            }
        });
        
    } catch (error: any) {
        console.error('Error calculating Y amount:', error);
        await ctx.reply(
            `❌ Error calculating amount: ${error.message}`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'newpos_amount_auto' }],
                        [{ text: '✏️ Use Manual Entry', callback_data: 'newpos_amount_manual' }]
                    ]
                }
            }
        );
    }
}

// Handler for auto-swap TO tokenX (e.g., swap SOL/USDC to get TRUMP)
export async function handleAutoSwapToX(ctx: BotContext) {
    await ctx.answerCbQuery('Preparing auto-swap...');
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolInfo || !flowData.swapAmountX) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    const pool = flowData.poolInfo as PoolInfo;
    const tokenXNeeded = flowData.swapAmountX;
    
    try {
        await ctx.editMessageText(
            `🔄 **AUTO-SWAP PREPARATION**\n\n` +
            `Getting swap quote to acquire ${tokenXNeeded.toFixed(4)} ${pool.tokenX.symbol}...`,
            { parse_mode: 'Markdown' }
        );
        
        // Determine what to swap from - prefer using USDC/tokenY first, then SOL
        // For this we need to check which route is available
        // Most common case: Use Jupiter or similar aggregator for best route
        
        // Get price estimate for tokenX
        const { priceService } = await import('../../services/price.service');
        let tokenXPriceUsd = 0;
        try {
            tokenXPriceUsd = await priceService.getTokenPrice(pool.tokenX.mint) || 0;
        } catch (e) {}
        
        // Estimate value needed in USD/USDC
        const valueNeededUsd = tokenXNeeded * tokenXPriceUsd;
        
        // Check what we have available
        const availableSol = flowData.availableSol || 0;
        const availableTokenY = flowData.availableTokenY || 0;
        
        // For now, show options to user
        let swapSource = 'SOL';
        let swapAmount = 0;
        
        // Prefer swapping from tokenY (e.g., USDC) if pool supports it
        if (availableTokenY > valueNeededUsd * 1.05) { // Need enough with buffer
            swapSource = pool.tokenY.symbol;
            swapAmount = valueNeededUsd * 1.05; // Add 5% buffer
        } else if (availableSol > 0.01) {
            // Use SOL - need to find route through Jupiter or similar
            swapSource = 'SOL';
            // Estimate SOL needed (rough estimate)
            const solPriceUsd = await priceService.getTokenPrice(NATIVE_SOL_MINT) || 140;
            swapAmount = (valueNeededUsd / solPriceUsd) * 1.05; // Add 5% buffer
        }
        
        // Store swap details
        flowData.swapSource = swapSource;
        flowData.swapAmountFrom = swapAmount;
        
        const message = `
🔄 **AUTO-SWAP TO ${pool.tokenX.symbol}**

**You Need:** ${tokenXNeeded.toFixed(4)} ${pool.tokenX.symbol}
**Estimated Value:** ~$${valueNeededUsd.toFixed(2)}

**Swap From:** ${swapSource}
**Estimated Amount:** ~${swapAmount.toFixed(4)} ${swapSource}

⚠️ This will execute TWO transactions:
1. Swap ${swapSource} → ${pool.tokenX.symbol}
2. Create LP position

_Note: Actual amounts may vary based on market price._
`.trim();

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: `✅ Swap ${swapSource} → ${pool.tokenX.symbol} & Create`, callback_data: 'newpos_autoswap_x_execute' }],
                    [{ text: '⬅️ Back', callback_data: 'newpos_amount_auto' }],
                    [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
                ]
            }
        });
        
    } catch (error: any) {
        console.error('Error preparing swap to X:', error);
        await ctx.editMessageText(
            `❌ **Auto-swap preparation failed**\n\nError: ${error.message}\n\n` +
            `💡 **Alternative:** You can buy ${pool.tokenX.symbol} on a DEX like Jupiter first, then return to create the position.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Different Amount', callback_data: 'newpos_amount_auto' }],
                        [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
    }
}

// Execute auto-swap to tokenX and create position
export async function handleAutoSwapToXExecute(ctx: BotContext) {
    await ctx.answerCbQuery('Executing swap...');
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolInfo || !flowData.swapAmountX) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    const pool = flowData.poolInfo as PoolInfo;
    const telegramId = ctx.from!.id;
    
    try {
        await ctx.editMessageText(
            `⏳ **STEP 1/2: Acquiring ${pool.tokenX.symbol}**\n\n` +
            `Swapping ${flowData.swapSource} → ${pool.tokenX.symbol}...\n\n` +
            `_This may take 30-60 seconds..._`,
            { parse_mode: 'Markdown' }
        );
        
        // Get keypair
        const keypair = multiWalletStorage.getActiveKeypair(telegramId);
        if (!keypair) {
            throw new Error('Wallet not found');
        }
        
        // For swapping to tokenX, we need to:
        // 1. If pool is tokenX/USDC type, we can swap tokenY (USDC) -> tokenX directly in this pool
        // 2. If we need SOL -> tokenX and pool isn't SOL/tokenX, we need external DEX
        
        // Check if we can use this pool for the swap (e.g., TRUMP/USDC - swap USDC -> TRUMP)
        const isTokenYSource = flowData.swapSource === pool.tokenY.symbol;
        
        if (isTokenYSource) {
            // We can swap within this pool! tokenY -> tokenX
            const amountToSwap = flowData.swapAmountFrom || 0;
            const amountInBaseUnits = new BN(Math.floor(amountToSwap * Math.pow(10, pool.tokenY.decimals)));
            
            // Get quote for swapping Y -> X (swapForY = false means we're selling Y for X)
            const quote = await swapService.getSwapQuote(
                pool.address,
                amountInBaseUnits,
                false, // swapForY = false (we want tokenX out)
                1 // 1% slippage
            );
            
            // Execute the swap
            const swapSignature = await swapService.executeSwap(pool.address, quote);
            
            await ctx.editMessageText(
                `✅ **Swap Successful!**\n\n` +
                `Acquired ~${(Number(quote.outAmount) / Math.pow(10, pool.tokenX.decimals)).toFixed(4)} ${pool.tokenX.symbol}\n` +
                `Transaction: \`${swapSignature.slice(0, 20)}...\`\n\n` +
                `⏳ **STEP 2/2: Creating Position**\n\n` +
                `_Please wait..._`,
                { parse_mode: 'Markdown' }
            );
            
        } else {
            // For SOL or other tokens, we need to guide user to external DEX
            throw new Error(`Direct swap from ${flowData.swapSource} to ${pool.tokenX.symbol} requires Jupiter. Please swap manually on jup.ag first.`);
        }
        
        // Wait for swap to settle
        await new Promise(r => setTimeout(r, 3000));
        
        // Clear swap flags and proceed to position creation
        flowData.autoSwapNeeded = false;
        flowData.swapAmountX = undefined;
        flowData.step = 'confirm';
        
        // Create the position
        await handleExecuteNewPosition(ctx);
        
    } catch (error: any) {
        console.error('Auto-swap to X execution error:', error);
        await ctx.editMessageText(
            `❌ **Swap Failed**\n\nError: ${error.message}\n\n` +
            `💡 **Try manually:**\n` +
            `1. Go to [jup.ag](https://jup.ag) and swap for ${pool.tokenX.symbol}\n` +
            `2. Return here to create position`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'newpos_autoswap_x' }],
                        [{ text: '🔄 Try Different Amount', callback_data: 'newpos_amount_auto' }],
                        [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
    }
}

// Handler for auto-swap and create position (swap TO tokenY)
export async function handleAutoSwapAndCreate(ctx: BotContext) {
    await ctx.answerCbQuery('Preparing auto-swap...');
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolInfo || !flowData.swapAmountY) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    const pool = flowData.poolInfo as PoolInfo;
    const usdcNeeded = flowData.swapAmountY;
    
    try {
        // Get swap quote - swap X (SOL) for Y (USDC)
        // Need to calculate how much SOL to swap to get the required USDC
        const solPriceInUsdc = pool.price || 140; // fallback
        const solToSwap = (usdcNeeded / solPriceInUsdc) * 1.02; // Add 2% buffer for slippage
        
        // Convert to lamports (9 decimals for SOL)
        const solToSwapLamports = new BN(Math.floor(solToSwap * 1e9));
        
        await ctx.editMessageText(
            `🔄 **AUTO-SWAP PREPARATION**\n\n` +
            `Getting swap quote...\n` +
            `Swapping ~${solToSwap.toFixed(6)} ${pool.tokenX.symbol} for ~${usdcNeeded.toFixed(2)} ${pool.tokenY.symbol}`,
            { parse_mode: 'Markdown' }
        );
        
        // Get swap quote
        const quote = await swapService.getSwapQuote(
            pool.address,
            solToSwapLamports,
            true, // swapForY = true (SOL -> USDC)
            1 // 1% slippage
        );
        
        const expectedUsdc = Number(quote.outAmount) / 1e6; // USDC has 6 decimals
        const priceImpact = quote.priceImpact * 100;
        
        // Update flow data
        flowData.swapQuote = quote;
        flowData.solToSwap = solToSwap;
        
        const message = `
🔄 **AUTO-SWAP CONFIRMATION**

**Swap:**
• Sell: ~${solToSwap.toFixed(6)} ${pool.tokenX.symbol}
• Get: ~${expectedUsdc.toFixed(2)} ${pool.tokenY.symbol}
• Price Impact: ${priceImpact.toFixed(2)}%

**Then Create Position:**
• ${flowData.amountX} ${pool.tokenX.symbol}
• ${flowData.amountY?.toFixed(6)} ${pool.tokenY.symbol}

⚠️ This will execute TWO transactions:
1. Swap ${pool.tokenX.symbol} → ${pool.tokenY.symbol}
2. Create LP position
`.trim();

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Execute Swap & Create Position', callback_data: 'newpos_autoswap_execute' }],
                    [{ text: '⬅️ Back', callback_data: 'newpos_amount_auto' }],
                    [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
                ]
            }
        });
        
    } catch (error: any) {
        console.error('Error getting swap quote:', error);
        await ctx.editMessageText(
            `❌ **Auto-swap failed**\n\nError: ${error.message}\n\nPlease try manual entry or use a different amount.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✏️ Use Manual Entry', callback_data: 'newpos_amount_manual' }],
                        [{ text: '⬅️ Back', callback_data: 'newpos_amounts_retry' }]
                    ]
                }
            }
        );
    }
}

// Execute auto-swap and then create position
export async function handleAutoSwapExecute(ctx: BotContext) {
    await ctx.answerCbQuery('Executing swap...');
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolInfo || !flowData.swapQuote) {
        await ctx.editMessageText('Session expired. Please start again.');
        return;
    }
    
    const pool = flowData.poolInfo as PoolInfo;
    const telegramId = ctx.from!.id;
    
    try {
        await ctx.editMessageText(
            `⏳ **STEP 1/2: Executing Swap**\n\n` +
            `Swapping ${pool.tokenX.symbol} → ${pool.tokenY.symbol}...\n\n` +
            `_Please wait, this may take 30-60 seconds..._`,
            { parse_mode: 'Markdown' }
        );
        
        // Execute the swap
        const swapSignature = await swapService.executeSwap(pool.address, flowData.swapQuote);
        
        await ctx.editMessageText(
            `✅ **Swap Successful!**\n\n` +
            `Transaction: \`${swapSignature.slice(0, 20)}...\`\n\n` +
            `⏳ **STEP 2/2: Creating Position**\n\n` +
            `_Please wait..._`,
            { parse_mode: 'Markdown' }
        );
        
        // Wait a moment for the swap to settle
        await new Promise(r => setTimeout(r, 2000));
        
        // Clear the swap flag and proceed to position creation
        flowData.autoSwapNeeded = false;
        flowData.swapQuote = undefined;
        flowData.step = 'confirm';
        
        // Now create the position (call the execute handler directly)
        await handleExecuteNewPosition(ctx);
        
    } catch (error: any) {
        console.error('Auto-swap execution error:', error);
        await ctx.editMessageText(
            `❌ **Swap Failed**\n\nError: ${error.message}\n\nThe swap could not be completed.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'newpos_autoswap' }],
                        [{ text: '✏️ Use Manual Entry', callback_data: 'newpos_amount_manual' }],
                        [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
    }
}

export async function handleAmountInput(ctx: BotContext, input: string) {
    ctx.session.currentFlow = 'idle';
    
    const parts = input.trim().split(/\s+/);
    if (parts.length !== 2) {
        await ctx.reply(
            '❌ Invalid format. Please use: `AMOUNT_X AMOUNT_Y`',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'newpos_amounts_retry' }]
                    ]
                }
            }
        );
        return;
    }
    
    const amountX = parseFloat(parts[0]);
    const amountY = parseFloat(parts[1]);
    
    if (isNaN(amountX) || isNaN(amountY) || (amountX <= 0 && amountY <= 0)) {
        await ctx.reply(
            '❌ Invalid amounts. At least one amount must be > 0.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'newpos_amounts_retry' }]
                    ]
                }
            }
        );
        return;
    }
    
    const flowData = ctx.session.flowData!;
    flowData.amountX = amountX;
    flowData.amountY = amountY;
    flowData.step = 'confirm';
    
    // Show confirmation
    await showConfirmation(ctx);
}

// ==================== POSITION WIZARD: STEP 4 - CONFIRM ====================

async function showConfirmation(ctx: BotContext) {
    const flowData = ctx.session.flowData!;
    const pool = flowData.poolInfo as PoolInfo;
    
    const minBinId = flowData.minBinId || 0;
    const maxBinId = flowData.maxBinId || 0;
    const minPrice = poolService.calculateBinPrice(minBinId, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    const maxPrice = poolService.calculateBinPrice(maxBinId, pool.binStep, pool.tokenX.decimals, pool.tokenY.decimals);
    
    const message = `
✅ **CONFIRM POSITION**

**Pool:** ${pool.tokenX.symbol}/${pool.tokenY.symbol}
**Address:** \`${shortenAddress(pool.address, 8)}\`

**Configuration:**
• Strategy: ${flowData.strategy}
• Range: ${flowData.minBinId} → ${flowData.maxBinId}
• Price: ${minPrice.toFixed(6)} - ${maxPrice.toFixed(6)}

**Deposit:**
• ${flowData.amountX} ${pool.tokenX.symbol}
• ${flowData.amountY} ${pool.tokenY.symbol}

━━━━━━━━━━━━━━━━━━━━━━

⚠️ Please verify all details before confirming.
Transaction fees will apply.
`.trim();

    await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '✅ Confirm & Create', callback_data: 'newpos_execute' }],
                [{ text: '⬅️ Back', callback_data: 'newpos_amounts_retry' }],
                [{ text: '❌ Cancel', callback_data: 'pools_menu' }]
            ]
        }
    });
}

// ==================== POSITION WIZARD: EXECUTE ====================

export async function handleExecuteNewPosition(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    const keypair = multiWalletStorage.getActiveKeypair(telegramId);
    if (!keypair) {
        await ctx.answerCbQuery('No wallet connected');
        return;
    }
    
    const flowData = ctx.session.flowData;
    if (!flowData?.poolAddress || !flowData.amountX === undefined) {
        await ctx.answerCbQuery('Session expired');
        return;
    }
    
    await ctx.answerCbQuery('Creating position...');
    await ctx.editMessageText(
        '🔄 **Creating position...**\n\n' +
        'Please wait while we create your position on-chain.\n' +
        'This may take 30-60 seconds.',
        { parse_mode: 'Markdown' }
    );
    
    try {
        const { positionService } = await import('../../services/position.service');
        const { StrategyType } = await import('@meteora-ag/dlmm');
        const { Keypair: SolanaKeypair, sendAndConfirmTransaction } = await import('@solana/web3.js');
        const { BN } = await import('@coral-xyz/anchor');
        const { connectionService } = await import('../../services/connection.service');
        
        const pool = flowData.poolInfo as PoolInfo;
        const connection = connectionService.getConnection();
        const dlmm = await poolService.getDlmmInstance(pool.address);
        
        // Calculate bin count and estimate rent requirement
        const totalBins = (flowData.maxBinId || 0) - (flowData.minBinId || 0) + 1;
        const RENT_PER_BIN_LAMPORTS = 890; // ~0.00089 SOL per bin
        const BASE_POSITION_RENT_LAMPORTS = 3_000_000; // ~0.003 SOL base rent
        const TX_FEE_BUFFER_LAMPORTS = 10_000_000; // ~0.01 SOL buffer for tx fees
        
        const estimatedRentLamports = BASE_POSITION_RENT_LAMPORTS + 
            (totalBins * RENT_PER_BIN_LAMPORTS) + 
            TX_FEE_BUFFER_LAMPORTS;
        
        // Check SOL balance before proceeding
        const walletBalance = await connection.getBalance(keypair.publicKey);
        
        if (walletBalance < estimatedRentLamports) {
            const requiredSOL = estimatedRentLamports / 1_000_000_000;
            const currentSOL = walletBalance / 1_000_000_000;
            const shortfallSOL = requiredSOL - currentSOL;
            
            // Calculate bins that could be afforded with current balance
            const availableForRent = Math.max(0, walletBalance - TX_FEE_BUFFER_LAMPORTS - BASE_POSITION_RENT_LAMPORTS);
            const affordableBins = Math.floor(availableForRent / RENT_PER_BIN_LAMPORTS);
            
            let suggestionText = '';
            if (affordableBins >= 10) {
                suggestionText = `\n\n💡 **Alternative:** You could create a smaller ${affordableBins}-bin position with your current balance.`;
            } else {
                suggestionText = `\n\n💡 **Suggestion:** Add at least ${shortfallSOL.toFixed(4)} SOL to your wallet before creating this position.`;
            }
            
            await ctx.editMessageText(
                `❌ **Insufficient SOL for Position Rent**\n\n` +
                `**Position Requirements:**\n` +
                `• Total bins: ${totalBins}\n` +
                `• Base rent: ~0.003 SOL\n` +
                `• Bin rent: ~${((totalBins * RENT_PER_BIN_LAMPORTS) / 1_000_000_000).toFixed(4)} SOL\n` +
                `• TX buffer: ~0.01 SOL\n` +
                `• **Total needed: ~${requiredSOL.toFixed(4)} SOL**\n\n` +
                `**Your wallet:** ${currentSOL.toFixed(4)} SOL\n` +
                `**Shortfall:** ${shortfallSOL.toFixed(4)} SOL` +
                suggestionText,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            ...(affordableBins >= 10 ? [[{ text: `📉 Use ${affordableBins} bins instead`, callback_data: `newpos_fewer_bins_${affordableBins}` }]] : []),
                            [{ text: '🔄 Check Balance & Retry', callback_data: 'newpos_execute' }],
                            [{ text: '⬅️ Back to Pool', callback_data: `pool_${pool.address}` }]
                        ]
                    }
                }
            );
            return;
        }
        
        // Check maximum bin limit 
        // Meteora DLMM has DEFAULT_BIN_PER_POSITION = 70 as the base position size
        // Positions > 70 bins require resize instructions which can fail with realloc errors
        // Using 69 as safe maximum for single-transaction position creation
        const MAX_BINS_SINGLE_TX = 69;
        if (totalBins > MAX_BINS_SINGLE_TX) {
            const activeBin = flowData.activeBinId || pool.activeBin;
            const suggestedBinsPerSide = Math.floor(MAX_BINS_SINGLE_TX / 2);
            
            await ctx.editMessageText(
                `⚠️ **Position Size Limit**\n\n` +
                `You're trying to create a **${totalBins}-bin** position.\n\n` +
                `**Limit:** Meteora DLMM supports up to **${MAX_BINS_SINGLE_TX} bins** per position in a single transaction. Larger positions require multiple transactions and can fail due to Solana's 10KB reallocation limit.\n\n` +
                `**Current range:** ${flowData.minBinId} → ${flowData.maxBinId}\n\n` +
                `💡 We recommend using ${MAX_BINS_SINGLE_TX} bins (~10% range for most pools) for reliable position creation.`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: `✅ Use ${MAX_BINS_SINGLE_TX} bins (recommended)`, callback_data: `newpos_fewer_bins_${MAX_BINS_SINGLE_TX}` }],
                            [{ text: '📐 Choose Different Range', callback_data: 'newpos_skip_ai' }],
                            [{ text: '⬅️ Back to Pool', callback_data: `pool_${pool.address}` }]
                        ]
                    }
                }
            );
            return;
        }
        
        // Create new position keypair
        const newPositionKeypair = SolanaKeypair.generate();
        
        // Convert amounts to BN (use defaults if undefined)
        const amountXValue = flowData.amountX || 0;
        const amountYValue = flowData.amountY || 0;
        const amountX = new BN(Math.floor(amountXValue * (10 ** pool.tokenX.decimals)));
        const amountY = new BN(Math.floor(amountYValue * (10 ** pool.tokenY.decimals)));
        
        // Map strategy
        const strategyType = flowData.strategy === 'Spot' ? StrategyType.Spot :
                            flowData.strategy === 'Curve' ? StrategyType.Curve : 
                            StrategyType.BidAsk;
        
        const strategy = {
            maxBinId: flowData.maxBinId || 0,
            minBinId: flowData.minBinId || 0,
            strategyType
        };
        
        // Create position
        const tx = await dlmm.initializePositionAndAddLiquidityByStrategy({
            positionPubKey: newPositionKeypair.publicKey,
            user: keypair.publicKey,
            totalXAmount: amountX,
            totalYAmount: amountY,
            strategy,
            slippage: 100 // 1%
        });
        
        const signature = await sendAndConfirmTransaction(
            connection,
            tx,
            [keypair, newPositionKeypair],
            { commitment: 'confirmed' }
        );
        
        // Clear flow data
        ctx.session.flowData = undefined;
        ctx.session.currentFlow = 'idle';
        
        console.log(chalk.green(`✓ User ${telegramId} created position ${newPositionKeypair.publicKey.toBase58()}`));
        
        await ctx.editMessageText(
            `✅ **POSITION CREATED!**\n\n` +
            `**Pool:** ${pool.tokenX.symbol}/${pool.tokenY.symbol}\n` +
            `**Position:** \`${shortenAddress(newPositionKeypair.publicKey.toBase58(), 8)}\`\n\n` +
            `**Deposited:**\n` +
            `• ${flowData.amountX} ${pool.tokenX.symbol}\n` +
            `• ${flowData.amountY} ${pool.tokenY.symbol}\n\n` +
            `**Range:** ${flowData.minBinId} → ${flowData.maxBinId}\n\n` +
            `🔗 **TX:** \`${signature.slice(0, 20)}...\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📋 View Positions', callback_data: 'positions_list' }],
                        [{ text: '➕ Create Another', callback_data: 'pools_menu' }],
                        [{ text: '⬅️ Main Menu', callback_data: 'menu_main' }]
                    ]
                }
            }
        );
        
    } catch (error: any) {
        console.error('Position creation error:', error);
        
        const errorMessage = error.message || 'Unknown error';
        let userFriendlyMessage = `Error: ${errorMessage}`;
        let suggestions = '';
        
        // Parse insufficient lamports error
        const lamportsMatch = errorMessage.match(/insufficient lamports (\d+), need (\d+)/);
        if (lamportsMatch) {
            const available = parseInt(lamportsMatch[1]) / 1_000_000_000;
            const needed = parseInt(lamportsMatch[2]) / 1_000_000_000;
            const shortfall = needed - available;
            
            userFriendlyMessage = 
                `**Insufficient SOL for Transaction**\n\n` +
                `• Available: ${available.toFixed(4)} SOL\n` +
                `• Required: ${needed.toFixed(4)} SOL\n` +
                `• Shortfall: ${shortfall.toFixed(4)} SOL`;
            
            suggestions = `\n\n💡 **Fix:** Add at least ${shortfall.toFixed(4)} SOL to your wallet, or try a smaller bin range to reduce rent costs.`;
        } else if (errorMessage.includes('realloc') || errorMessage.includes('InvalidRealloc') || errorMessage.includes('10240')) {
            // Account reallocation limit error - too many bins
            userFriendlyMessage = 
                `**Too Many Bins for Single Transaction**\n\n` +
                `Solana has a 10KB limit per transaction, and your position exceeds this.`;
            
            suggestions = `\n\n💡 **Fix:** Use 120 bins or fewer. Go back and select a smaller range.`;
        } else if (errorMessage.includes('insufficient funds')) {
            suggestions = `\n\n💡 Check that you have enough SOL for transaction fees and position rent (~0.01-0.1 SOL depending on bin count).`;
        } else if (errorMessage.includes('slippage')) {
            suggestions = `\n\n💡 Price moved during execution. Try again with a higher slippage tolerance.`;
        } else if (errorMessage.includes('timeout') || errorMessage.includes('block height')) {
            suggestions = `\n\n💡 Network congestion. Please try again in a few moments.`;
        }
        
        await ctx.editMessageText(
            `❌ **Position creation failed**\n\n` +
            userFriendlyMessage +
            suggestions +
            `\n\nPlease try again.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'newpos_execute' }],
                        [{ text: '⬅️ Back', callback_data: 'pools_menu' }]
                    ]
                }
            }
        );
    }
}
