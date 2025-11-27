#!/usr/bin/env node

// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import { program } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { PublicKey } from '@solana/web3.js';
import { walletService } from '../services/wallet.service';
import { connectionService } from '../services/connection.service';
import { positionService } from '../services/position.service';

// Import command modules
import { walletMenu } from './commands/wallet.command';
import { settingsMenu } from './commands/config.command';
import { swapMenu } from './commands/swap.command';
import { analyticsMenu } from './commands/analytics.command';
import { myPositionsMenu, newPositionMenu } from './commands/position.command';
import { llmConfigMenu } from './commands/llm.command';
import { monitoringCommand } from './commands/monitoring.command';

// CLI Art Header
function displayHeader() {
  console.clear();
  console.log(chalk.cyan.bold(`
  ████████▄   ▄█          ▄▄▄▄███▄▄▄▄      ▄▄▄▄███▄▄▄▄   
  ███   ▀███ ███        ▄██▀▀▀███▀▀▀██▄  ▄██▀▀▀███▀▀▀██▄ 
  ███    ███ ███        ███   ███   ███  ███   ███   ███ 
  ███    ███ ███        ███   ███   ███  ███   ███   ███ 
  ███    ███ ███        ███   ███   ███  ███   ███   ███ 
  ███    ███ ███        ███   ███   ███  ███   ███   ███ 
  ███   ▄███ ███▌    ▄  ███   ███   ███  ███   ███   ███ 
  ████████▀  █████▄▄██   ▀█   ███   █▀    ▀█   ███   █▀  
             ▀                                            
  `));
  console.log(chalk.yellow.bold('            METEORA DLMM CLI - LIQUIDITY PROVIDER'));
  console.log(chalk.gray('            Interactive Testing & Management Interface'));
  console.log(chalk.gray('            =========================================\n'));
}

async function showMainMenu() {
  while (true) {
    displayHeader();

    // Show current status
    const wallets = walletService.listWallets();
    const activeWallet = walletService.getActiveWallet();

    // Fetch positions if wallet is active
    let positionsCount = 0;
    if (activeWallet) {
      try {
        const positions = await positionService.getAllPositions(activeWallet.publicKey);
        positionsCount = positions.length;
      } catch (e) {
        // Silent fail for status display
      }
    }

    console.log(chalk.blue.bold('📊 CURRENT STATUS:'));
    console.log(`   Wallets: ${wallets.length}`);

    if (activeWallet) {
      // Fetch and display active wallet balance
      try {
        const connection = await connectionService.getConnection();
        const balance = await connection.getBalance(new PublicKey(activeWallet.publicKey));
        const balanceSOL = balance / 1e9;

        console.log(`   Active: ${activeWallet.name} (${activeWallet.publicKey.slice(0, 8)}...)`);
        console.log(`   Balance: ${chalk.green(balanceSOL.toFixed(4) + ' SOL')}`);
      } catch (error) {
        console.log(`   Active: ${activeWallet.name} (${activeWallet.publicKey.slice(0, 8)}...)`);
        console.log(`   Balance: ${chalk.red('Error fetching')}`);
      }
    } else {
      console.log(`   Active: None`);
    }

    console.log(`   Positions: ${positionsCount}\n`);

    try {
      const answers = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          new inquirer.Separator('═══ MAIN MENU ═══'),
          '💼 My Positions',
          '📊 Analytics & Monitoring',
          '🤖 Automated Monitoring',
          '➕ New Position',
          '💱 Swap Tokens',
          '🤖 LLM AI Selection',
          new inquirer.Separator('═══ CONFIGURATION ═══'),
          '🔑 Wallets',
          '⚙️  Settings',
          '❌ Exit'
        ],
        pageSize: 10
      });

      const action = answers.action;

      if (action.includes('My Positions')) {
        await myPositionsMenu();
      } else if (action.includes('Analytics')) {
        await analyticsMenu();
      } else if (action.includes('Automated Monitoring')) {
        await monitoringCommand();
      } else if (action.includes('New Position')) {
        await newPositionMenu();
      } else if (action.includes('Swap Tokens')) {
        await swapMenu();
      } else if (action.includes('LLM AI Selection')) {
        await llmConfigMenu();
      } else if (action.includes('Wallets')) {
        await walletMenu();
      } else if (action.includes('Settings')) {
        await settingsMenu();
      } else if (action.includes('Exit')) {
        console.log(chalk.green('\n👋 Thank you for using DLMM CLI! Goodbye!'));
        process.exit(0);
      }
    } catch (error: any) {
      if (error.message?.includes('force closed') || error.name === 'ExitPromptError') {
        console.log(chalk.yellow('\n👋 CLI session ended. Goodbye!'));
        process.exit(0);
      }
      console.error(chalk.red('Error in main menu:', error.message || 'Unknown error'));
      // Wait before restarting loop
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Handle CLI arguments if any, otherwise show interactive menu
program
  .version('1.0.0')
  .description('Meteora DLMM Liquidity Provider CLI')
  .action(async () => {
    await showMainMenu();
  });

program.command('interactive')
  .description('Start interactive mode')
  .action(async () => {
    await showMainMenu();
  });

program.command('wallet')
  .description('Manage wallets')
  .action(async () => {
    await walletMenu();
  });

program.parse(process.argv);

// If no args, show help or start interactive?
// Commander handles this if we set up action on top level.
if (!process.argv.slice(2).length) {
  program.outputHelp();
  // Or just start interactive:
  // showMainMenu();
}
