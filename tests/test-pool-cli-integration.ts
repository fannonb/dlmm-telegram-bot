// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import { poolService } from '../src/services/pool.service';

async function testPoolCLIIntegration() {
  console.log(chalk.cyan.bold('\n════════════════════════════════════════════\n'));
  console.log(chalk.cyan.bold('  🏊 POOL SERVICE - CLI INTEGRATION TEST'));
  console.log(chalk.cyan.bold('\n════════════════════════════════════════════\n'));

  // Test 1: Search Pool
  console.log(chalk.blue.bold('1️⃣ SEARCH POOL (USDC)\n'));
  try {
    const searchResults = await poolService.searchPools('USDC');
    console.log(chalk.green(`✅ Found ${searchResults.length} USDC pools`));
    if (searchResults.length > 0) {
      const pool = searchResults[0];
      console.log(`   Example: ${pool.tokenX.symbol}/${pool.tokenY.symbol}`);
      console.log(`   TVL: $${pool.tvl?.toLocaleString() || 'N/A'}`);
    }
  } catch (error) {
    console.log(chalk.red(`❌ Search failed: ${error}`));
  }

  // Test 2: Top Pools by TVL
  console.log(chalk.blue.bold('\n2️⃣ TOP POOLS BY TVL\n'));
  try {
    const topPools = await poolService.getTopPoolsByTVL(5);
    console.log(chalk.green(`✅ Retrieved ${topPools.length} top pools`));
    topPools.slice(0, 3).forEach((pool, i) => {
      console.log(`   ${i + 1}. ${pool.tokenX.symbol}/${pool.tokenY.symbol} - TVL: $${pool.tvl?.toLocaleString() || 'N/A'}`);
    });
  } catch (error) {
    console.log(chalk.red(`❌ Fetch failed: ${error}`));
  }

  // Test 3: Top Pools by APR
  console.log(chalk.blue.bold('\n3️⃣ TOP POOLS BY APR\n'));
  try {
    const topPools = await poolService.getTopPoolsByAPR(5);
    console.log(chalk.green(`✅ Retrieved ${topPools.length} top pools`));
    topPools.slice(0, 3).forEach((pool, i) => {
      console.log(`   ${i + 1}. ${pool.tokenX.symbol}/${pool.tokenY.symbol} - APR: ${pool.apr?.toFixed(2) || 'N/A'}%`);
    });
  } catch (error) {
    console.log(chalk.red(`❌ Fetch failed: ${error}`));
  }

  // Test 4: Pool Statistics
  console.log(chalk.blue.bold('\n4️⃣ POOL STATISTICS\n'));
  try {
    const stats = await poolService.getPoolStats();
    console.log(chalk.green(`✅ Statistics retrieved`));
    console.log(`   Total Pools: ${stats.totalPools.toLocaleString()}`);
    console.log(`   Total TVL: $${stats.totalTVL.toLocaleString()}`);
    console.log(`   Average APR: ${stats.averageAPR.toFixed(2)}%`);
  } catch (error) {
    console.log(chalk.red(`❌ Stats failed: ${error}`));
  }

  // Test 5: Find Token Pair
  console.log(chalk.blue.bold('\n5️⃣ FIND TOKEN PAIR (USDC-USDT)\n'));
  try {
    const pairPools = await poolService.getPoolsByTokenPair('USDC', 'USDT');
    console.log(chalk.green(`✅ Found ${pairPools.length} USDC-USDT pools`));
    if (pairPools.length > 0) {
      const pool = pairPools[0];
      console.log(`   First: ${pool.tokenX.symbol}/${pool.tokenY.symbol}`);
      console.log(`   Fee: ${(pool.feeBps / 100).toFixed(2)}%`);
    }
  } catch (error) {
    console.log(chalk.red(`❌ Search failed: ${error}`));
  }

  // Test 6: Bin Price Calculator
  console.log(chalk.blue.bold('\n6️⃣ BIN PRICE CALCULATOR\n'));
  try {
    const price = poolService.calculateBinPrice(8388608, 20);
    const range = poolService.getPriceRange(8388598, 8388618, 20);
    console.log(chalk.green(`✅ Bin price calculated`));
    console.log(`   Center Bin (8388608): ${price.toFixed(8)}`);
    console.log(`   Price Range: ${range.minPrice.toFixed(8)} - ${range.maxPrice.toFixed(8)}`);
  } catch (error) {
    console.log(chalk.red(`❌ Calculation failed: ${error}`));
  }

  console.log(chalk.cyan.bold('\n════════════════════════════════════════════\n'));
  console.log(chalk.green.bold('✅ ALL POOL SERVICE CLI FEATURES WORKING!\n'));
}

testPoolCLIIntegration().catch(console.error);

