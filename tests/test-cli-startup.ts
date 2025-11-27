// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';

async function testCliStartup() {
  console.log('🧪 TESTING CLI STARTUP...\n');
  
  // Test 1: Check environment setup
  console.log('📋 Test 1: Environment Setup');
  console.log(`   ENCRYPTION_KEY: ${process.env.ENCRYPTION_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`   ENCRYPTION_KEY Length: ${process.env.ENCRYPTION_KEY?.length || 0} chars`);
  console.log(`   Environment Valid: ${process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32 ? '✅ YES' : '❌ NO'}\n`);
  
  // Test 2: Check imports
  console.log('📋 Test 2: Module Imports');
  try {
    const { walletService } = await import('../src/services/wallet.service');
    console.log('   ✅ Wallet Service imported');
    
    const { configManager } = await import('../src/config/config.manager');
    console.log('   ✅ Config Manager imported');
    
    // Test chalk
    console.log(chalk.green('   ✅ Chalk working'));
    
    // Test inquirer (just import, don't use)
    await import('inquirer');
    console.log('   ✅ Inquirer imported');
    
    // Test commander
    await import('commander');
    console.log('   ✅ Commander imported\n');
    
  } catch (error) {
    console.log(chalk.red(`   ❌ Import error: ${error}\n`));
    return;
  }
  
  // Test 3: Check basic functionality
  console.log('📋 Test 3: Basic Functionality');
  try {
    const { walletService } = await import('../src/services/wallet.service');
    const wallets = walletService.listWallets();
    console.log(`   ✅ Wallet listing works (${wallets.length} wallets)`);
    
    const { configManager } = await import('../src/config/config.manager');
    const config = configManager.getConfig();
    console.log(`   ✅ Config loading works (version ${config.version})\n`);
    
  } catch (error) {
    console.log(chalk.red(`   ❌ Functionality error: ${error}\n`));
    return;
  }
  
  console.log(chalk.green.bold('✅ CLI STARTUP TEST PASSED!\n'));
  console.log(chalk.blue.bold('🚀 CLI READY TO USE!'));
  console.log(chalk.yellow('Run the following commands to start the CLI:'));
  console.log(chalk.cyan('   npm run cli'));
  console.log(chalk.cyan('   npm run cli:interactive'));
  console.log(chalk.cyan('   npm run cli:wallet\n'));
  
  console.log(chalk.blue.bold('📋 CLI FEATURES AVAILABLE:'));
  console.log(chalk.green('   🔑 Wallet Management'));
  console.log('      - Create new wallets with mnemonic');
  console.log('      - Import from mnemonic or private key');
  console.log('      - List and manage wallets');
  console.log('      - Set active wallet');
  console.log('      - Export private keys');
  console.log('      - Delete wallets');
  console.log(chalk.green('   📊 System Status'));
  console.log('      - View configuration');
  console.log('      - Check system health');
  console.log('      - Feature implementation status');
  console.log(chalk.yellow('   🔗 Connection Settings (Phase 2.2)'));
  console.log(chalk.gray('   ⚙️ Advanced Configuration (Future phases)\n'));
}

testCliStartup().catch(console.error);
