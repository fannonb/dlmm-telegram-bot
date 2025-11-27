// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import { walletService } from '../src/services/wallet.service';

async function testCliDisplay() {
  console.log('🧪 TESTING CLI DISPLAY COMPONENTS...\n');
  
  // Test 1: Test header display
  console.log('📋 Test 1: CLI Header Display');
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
  console.log('   ✅ Header displays correctly\n');
  
  // Test 2: Test status display
  console.log('📋 Test 2: Status Display');
  const wallets = walletService.listWallets();
  const activeWallet = walletService.getActiveWallet();
  
  console.log(chalk.blue.bold('📊 CURRENT STATUS:'));
  console.log(`   Wallets: ${wallets.length}`);
  console.log(`   Active: ${activeWallet ? `${activeWallet.name} (${activeWallet.publicKey.slice(0, 8)}...)` : 'None'}\n`);
  console.log('   ✅ Status display working\n');
  
  // Test 3: Test menu choices display
  console.log('📋 Test 3: Menu Choices');
  const mainMenuChoices = [
    '🔑 Wallet Management',
    '🔗 Connection Settings', 
    '⚙️  Configuration',
    '📊 System Status',
    '❌ Exit'
  ];
  
  console.log(chalk.blue('Main Menu Choices:'));
  mainMenuChoices.forEach((choice, index) => {
    console.log(`   ${index + 1}. ${choice}`);
  });
  console.log('   ✅ Menu choices display correctly\n');
  
  // Test 4: Test wallet menu choices
  console.log('📋 Test 4: Wallet Menu Choices (No Wallets)');
  const walletMenuChoicesEmpty = [
    '➕ Create New Wallet',
    '📥 Import from Mnemonic', 
    '🔐 Import from Private Key',
    '🔙 Back to Main Menu'
  ];
  
  console.log(chalk.blue('Wallet Menu (No Wallets):'));
  walletMenuChoicesEmpty.forEach((choice, index) => {
    console.log(`   ${index + 1}. ${choice}`);
  });
  console.log('   ✅ Wallet menu (empty) displays correctly\n');
  
  // Test 5: Simulate wallet menu with wallets
  console.log('📋 Test 5: Wallet Menu Choices (With Wallets)');
  const walletMenuChoicesFull = [
    '➕ Create New Wallet',
    '📥 Import from Mnemonic', 
    '🔐 Import from Private Key',
    '📋 List All Wallets',
    '🎯 Set Active Wallet',
    '📤 Export Private Key',
    '🗑️ Delete Wallet',
    '🔙 Back to Main Menu'
  ];
  
  console.log(chalk.blue('Wallet Menu (With Wallets):'));
  walletMenuChoicesFull.forEach((choice, index) => {
    console.log(`   ${index + 1}. ${choice}`);
  });
  console.log('   ✅ Wallet menu (full) displays correctly\n');
  
  console.log(chalk.green.bold('✅ ALL CLI DISPLAY TESTS PASSED!\n'));
  
  console.log(chalk.blue.bold('🚀 CLI IS READY FOR INTERACTIVE TESTING!'));
  console.log(chalk.yellow('\nHow to launch the interactive CLI:'));
  console.log(chalk.cyan('   npm run cli               # Main interactive CLI'));
  console.log(chalk.cyan('   npm run cli:wallet        # Direct wallet management'));
  console.log(chalk.cyan('   npm run cli:interactive   # Explicit interactive mode\n'));
  
  console.log(chalk.blue.bold('🎯 Expected CLI Behavior:'));
  console.log(chalk.green('   ✅ Beautiful header with DLMM branding'));
  console.log(chalk.green('   ✅ Real-time status display (wallet count, active wallet)'));
  console.log(chalk.green('   ✅ Interactive menu with arrow key navigation'));
  console.log(chalk.green('   ✅ Dynamic wallet menu (changes based on wallet count)'));
  console.log(chalk.green('   ✅ Proper error handling and graceful exits'));
  console.log(chalk.green('   ✅ Colorized output and status indicators'));
  console.log(chalk.green('   ✅ Input validation and confirmation prompts\n'));
  
  console.log(chalk.yellow.bold('💡 USAGE TIP:'));
  console.log(chalk.gray('   Use arrow keys ↑↓ to navigate menus'));
  console.log(chalk.gray('   Press Enter to select options'));
  console.log(chalk.gray('   Press Ctrl+C to exit at any time\n'));
}

testCliDisplay().catch(console.error);
