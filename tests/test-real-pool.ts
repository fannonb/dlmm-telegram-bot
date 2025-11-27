// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import { poolService } from '../src/services/pool.service';

async function testRealPool() {
  const poolAddress = 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y'; // SOL-USDC

  console.log(chalk.cyan.bold('\n════════════════════════════════════════════\n'));
  console.log(chalk.cyan.bold('  🔍 TESTING REAL SOL-USDC POOL'));
  console.log(chalk.cyan.bold('\n════════════════════════════════════════════\n'));

  try {
    console.log(chalk.yellow(`Searching pool: ${poolAddress}\n`));
    
    const pool = await poolService.searchPoolByAddress(poolAddress);

    console.log(chalk.green('✅ POOL DATA:\n'));
    console.log(`Address: ${pool.address}`);
    console.log(`Pair: ${pool.tokenX.symbol}/${pool.tokenY.symbol}\n`);
    
    console.log(chalk.blue.bold('Token X:'));
    console.log(`  Mint: ${pool.tokenX.mint}`);
    console.log(`  Symbol: ${pool.tokenX.symbol}`);
    console.log(`  Decimals: ${pool.tokenX.decimals}\n`);
    
    console.log(chalk.blue.bold('Token Y:'));
    console.log(`  Mint: ${pool.tokenY.mint}`);
    console.log(`  Symbol: ${pool.tokenY.symbol}`);
    console.log(`  Decimals: ${pool.tokenY.decimals}\n`);
    
    console.log(chalk.blue.bold('Pool Details:'));
    console.log(`  Bin Step: ${pool.binStep} bps`);
    console.log(`  Fee: ${(pool.feeBps / 100).toFixed(2)}%`);
    console.log(`  Active Bin: ${pool.activeBin}`);
    console.log(`  TVL: $${pool.tvl && typeof pool.tvl === 'number' ? pool.tvl.toLocaleString('en-US', {maximumFractionDigits: 2}) : 'N/A'}`);
    console.log(`  24h Volume: $${pool.volume24h && typeof pool.volume24h === 'number' ? pool.volume24h.toLocaleString('en-US', {maximumFractionDigits: 2}) : 'N/A'}`);
    console.log(`  APR: ${pool.apr && typeof pool.apr === 'number' ? pool.apr.toFixed(2) : 'N/A'}%\n`);

    console.log(chalk.cyan.bold('════════════════════════════════════════════\n'));
    
    console.log(chalk.yellow.bold('COMPARISON WITH EXPECTED:\n'));
    console.log('Expected:');
    console.log('  Bin Step: 10.00 bps');
    console.log('  Fee: 0.10%');
    console.log('  TVL: $6.59M');
    console.log('  24h Volume: $31.31M');
    console.log('  APR: ~0.48%\n');
    
    console.log('Actual:');
    console.log(`  Bin Step: ${pool.binStep} bps`);
    console.log(`  Fee: ${(pool.feeBps / 100).toFixed(2)}%`);
    console.log(`  TVL: $${pool.tvl && typeof pool.tvl === 'number' ? (pool.tvl / 1_000_000).toFixed(2) : 'N/A'}M`);
    console.log(`  24h Volume: $${pool.volume24h && typeof pool.volume24h === 'number' ? (pool.volume24h / 1_000_000).toFixed(2) : 'N/A'}M`);
    console.log(`  APR: ${pool.apr && typeof pool.apr === 'number' ? pool.apr.toFixed(2) : 'N/A'}%\n`);

    const match = 
      pool.binStep === 10 &&
      Math.abs(pool.feeBps - 10) < 1 &&
      pool.tvl && pool.volume24h && pool.apr &&
      Math.abs(pool.tvl - 6583908.92) < 100000 &&
      Math.abs(pool.volume24h - 31328790.29) < 100000 &&
      Math.abs(pool.apr - 0.48) < 0.1;

    if (match) {
      console.log(chalk.green.bold('✅ DATA MATCHES EXPECTED VALUES!\n'));
    } else {
      console.log(chalk.yellow.bold('⚠️ SOME VALUES DIFFER\n'));
    }

  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error}\n`));
  }
}

testRealPool().catch(console.error);

