#!/usr/bin/env npx ts-node
/**
 * Position Monitor CLI
 * 
 * Monitors all positions every 30 minutes (configurable) and feeds data to AI for analysis.
 * 
 * Usage:
 *   npx ts-node start-monitor.ts                    # Monitor only (no auto-rebalance)
 *   npx ts-node start-monitor.ts --auto             # Enable auto-rebalancing
 *   npx ts-node start-monitor.ts --interval 15     # Check every 15 minutes
 *   npx ts-node start-monitor.ts --confidence 80   # Require 80% AI confidence to act
 */

import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import { positionMonitor } from './src/services/positionMonitor.service';
import { walletService } from './src/services/wallet.service';
import { llmAgent } from './src/services/llmAgent.service';

async function main() {
    console.log(chalk.blue.bold('\n🤖 DLMM Position Monitor'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    // Parse command line arguments
    const args = process.argv.slice(2);
    const enableAuto = args.includes('--auto') || args.includes('-a');
    
    let intervalMinutes = 30;
    const intervalIdx = args.indexOf('--interval');
    if (intervalIdx !== -1 && args[intervalIdx + 1]) {
        intervalMinutes = parseInt(args[intervalIdx + 1], 10);
    }

    let confidenceThreshold = 75;
    const confIdx = args.indexOf('--confidence');
    if (confIdx !== -1 && args[confIdx + 1]) {
        confidenceThreshold = parseInt(args[confIdx + 1], 10);
    }

    // Check AI availability
    console.log(chalk.gray('Checking AI availability...'));
    if (llmAgent.isAvailable()) {
        console.log(chalk.green('✅ AI is available and ready\n'));
    } else {
        console.log(chalk.yellow('⚠️  AI is not configured - will use basic analysis\n'));
        console.log(chalk.gray('   To enable AI, configure LLM settings in the CLI or Telegram bot.\n'));
    }

    // Check wallet
    const wallet = walletService.getActiveWallet();
    if (!wallet) {
        console.error(chalk.red('❌ No active wallet found!'));
        console.log(chalk.gray('\nPlease set up a wallet first:'));
        console.log(chalk.gray('  1. Run: npm run cli'));
        console.log(chalk.gray('  2. Select "Wallet Management" > "Create/Import Wallet"'));
        process.exit(1);
    }

    console.log(chalk.green(`✅ Using wallet: ${wallet.name || wallet.publicKey.slice(0, 8)}...`));

    // Display configuration
    console.log(chalk.cyan('\n📋 Configuration:'));
    console.log(`   • Interval: Every ${intervalMinutes} minutes`);
    console.log(`   • Auto-Rebalance: ${enableAuto ? chalk.green('ENABLED ⚡') : chalk.yellow('DISABLED (monitor only)')}`);
    console.log(`   • Confidence Threshold: ${confidenceThreshold}%`);
    console.log(`   • Logs: data/logs/monitor-YYYY-MM-DD.json`);

    if (enableAuto) {
        console.log(chalk.yellow('\n⚠️  AUTO-REBALANCE IS ENABLED'));
        console.log(chalk.yellow('   The bot will automatically rebalance positions when AI recommends it.'));
        console.log(chalk.yellow('   Press Ctrl+C within 5 seconds to cancel...\n'));
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Start monitoring
    try {
        await positionMonitor.startMonitoring(wallet.publicKey, {
            intervalMinutes,
            enableAutoRebalance: enableAuto,
            confidenceThreshold,
            logToFile: true,
            notifyOnAction: true,
            urgencyFilter: ['immediate', 'soon']
        });

        // Keep process running
        console.log(chalk.gray('\n💡 Tip: Press Ctrl+C to stop monitoring\n'));
        
        // Prevent process from exiting
        process.stdin.resume();
        
        process.on('SIGINT', () => {
            console.log(chalk.yellow('\n\n🛑 Stopping monitor...'));
            positionMonitor.stopMonitoring();
            process.exit(0);
        });

    } catch (error: any) {
        console.error(chalk.red(`\n❌ Failed to start monitoring: ${error.message}`));
        process.exit(1);
    }
}

main().catch(console.error);
