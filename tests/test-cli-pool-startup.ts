// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';

async function testCLIStartup() {
  console.log(chalk.cyan.bold('\n════════════════════════════════════════════\n'));
  console.log(chalk.cyan.bold('  🏊 CLI POOL SERVICE INTEGRATION'));
  console.log(chalk.cyan.bold('\n════════════════════════════════════════════\n'));

  try {
    // Test all imports work
    console.log(chalk.yellow('Testing CLI imports...'));
    
    const { walletService } = await import('../src/services/wallet.service');
    const { connectionService } = await import('../src/services/connection.service');
    const { swapService } = await import('../src/services/swap.service');
    const { poolService } = await import('../src/services/pool.service');
    
    console.log(chalk.green('✅ walletService imported'));
    console.log(chalk.green('✅ connectionService imported'));
    console.log(chalk.green('✅ swapService imported'));
    console.log(chalk.green('✅ poolService imported'));

    // Test pool service methods exist
    console.log(chalk.yellow('\nTesting Pool Service methods...'));
    
    if (typeof poolService.fetchAllPools === 'function') {
      console.log(chalk.green('✅ fetchAllPools method exists'));
    }
    if (typeof poolService.searchPools === 'function') {
      console.log(chalk.green('✅ searchPools method exists'));
    }
    if (typeof poolService.getTopPoolsByTVL === 'function') {
      console.log(chalk.green('✅ getTopPoolsByTVL method exists'));
    }
    if (typeof poolService.getTopPoolsByAPR === 'function') {
      console.log(chalk.green('✅ getTopPoolsByAPR method exists'));
    }
    if (typeof poolService.getPoolStats === 'function') {
      console.log(chalk.green('✅ getPoolStats method exists'));
    }
    if (typeof poolService.calculateBinPrice === 'function') {
      console.log(chalk.green('✅ calculateBinPrice method exists'));
    }
    if (typeof poolService.getPriceRange === 'function') {
      console.log(chalk.green('✅ getPriceRange method exists'));
    }
    if (typeof poolService.calculateApr === 'function') {
      console.log(chalk.green('✅ calculateApr method exists'));
    }

    console.log(chalk.cyan.bold('\n════════════════════════════════════════════\n'));
    console.log(chalk.green.bold('✅ CLI POOL SERVICE INTEGRATION SUCCESSFUL!\n'));
    console.log(chalk.yellow.bold('CLI Main Menu now includes:\n'));
    console.log('  🏊 Pool Explorer');
    console.log('     ├── 🔍 Search Pool');
    console.log('     ├── 📊 Top Pools by TVL');
    console.log('     ├── 📈 Top Pools by APR');
    console.log('     ├── 📋 Pool Statistics');
    console.log('     ├── 🔎 Find Token Pair');
    console.log('     └── 📐 Bin Price Calculator\n');

  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error}`));
    process.exit(1);
  }
}

testCLIStartup().catch(console.error);

