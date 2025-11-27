import { BotContext } from '../types';
import { userContextManager } from '../services/userContext';
import { userDataService } from '../services/userDataService';
import { mainMenuKeyboard, walletSetupKeyboard } from '../keyboards';
import { formatUsd, shortenAddress } from '../utils/formatting';
import chalk from 'chalk';

export async function handleStart(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || 'User';

    if (!telegramId) {
        await ctx.reply('❌ Could not identify user. Please try again.');
        return;
    }

    console.log(chalk.blue(`User started bot: ${username} (${telegramId})`));

    // Initialize session
    ctx.session.telegramId = telegramId;
    ctx.session.username = username;
    ctx.session.language = 'en';
    ctx.session.messageCount = 0;
    ctx.session.currentFlow = 'idle';

    // Get or create user context
    const userCtx = userContextManager.getContext(telegramId);
    const hasWallet = userCtx.hasWallet();
    
    // Ensure user data directory exists
    userDataService.ensureUserDirectory(telegramId);

    // Build personalized welcome message
    let welcomeMessage: string;
    
    if (hasWallet) {
        const publicKey = userCtx.getPublicKey();
        let balanceText = '';
        
        try {
            const solBalance = await userCtx.getSolBalance();
            balanceText = `\n💰 Balance: ${solBalance.toFixed(4)} SOL`;
        } catch (e) {
            balanceText = '';
        }
        
        // Get positions count
        let positionsText = '';
        try {
            const positions = await userCtx.getPositions();
            if (positions.length > 0) {
                const totalValue = positions.reduce((sum, p) => sum + (p.totalValueUSD || 0), 0);
                const totalFees = positions.reduce((sum, p) => sum + (p.unclaimedFees.usdValue || 0), 0);
                positionsText = `\n📊 Positions: ${positions.length} (${formatUsd(totalValue)})`;
                if (totalFees > 0) {
                    positionsText += `\n💸 Unclaimed Fees: ${formatUsd(totalFees)}`;
                }
            }
        } catch (e) {
            // Ignore position fetch errors
        }

        welcomeMessage = `
🏠 *Welcome back, ${username}!*

💼 Wallet: \`${shortenAddress(publicKey || '', 6)}\`${balanceText}${positionsText}

*Quick Actions:*
• /positions - View your positions
• /pools - Browse liquidity pools
• /help - All commands

Select an option below:
        `.trim();
        
        await ctx.replyWithMarkdown(welcomeMessage, {
            reply_markup: mainMenuKeyboard(true),
        });
    } else {
        welcomeMessage = `
🏠 *Welcome to DLMM Liquidity Bot!*

Hi ${username}! 👋

I help you manage Meteora DLMM liquidity positions right from Telegram.

*What I can do:*
• 📊 View & manage positions
• 💰 Track analytics & fees  
• 🤖 Get AI recommendations
• ♻️ Auto-rebalancing
• 🔔 Real-time alerts

*Get Started:*
First, let's connect your wallet!

🔐 Your private keys are encrypted and stored securely.
        `.trim();
        
        await ctx.replyWithMarkdown(welcomeMessage, {
            reply_markup: walletSetupKeyboard(),
        });
    }
}
