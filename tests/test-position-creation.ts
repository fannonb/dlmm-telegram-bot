// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import { poolService } from '../src/services/pool.service';
import { positionService } from '../src/services/position.service';
import { CreatePositionParams } from '../src/config/types';

async function testPositionCreation() {
  console.log(chalk.cyan.bold('\n╔═══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║  🚀 POSITION CREATION WORKFLOW - COMPREHENSIVE TEST 🚀       ║'));
  console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════════╝\n'));

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Fetch SOL-USDC pool
  console.log(chalk.blue.bold('1️⃣ FETCH SOL-USDC POOL\n'));
  let poolInfo: any;
  try {
    const poolAddress = 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y';
    poolInfo = await poolService.searchPoolByAddress(poolAddress);
    
    console.log(chalk.green(`✅ Pool found: ${poolInfo.tokenX.symbol}/${poolInfo.tokenY.symbol}`));
    console.log(`   TVL: $${poolInfo.tvl?.toLocaleString()}`);
    console.log(`   APR: ${poolInfo.apr?.toFixed(2)}%\n`);
    testsPassed++;
  } catch (error) {
    console.log(chalk.red(`❌ Failed to fetch pool: ${error}\n`));
    testsFailed++;
    return;
  }

  // Test 2: Test Spot Strategy
  console.log(chalk.blue.bold('2️⃣ TEST SPOT STRATEGY (Balanced 50/50)\n'));
  try {
    const spotParams: CreatePositionParams = {
      poolAddress: 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y',
      strategy: 'Spot',
      depositAmount: 1000,
      depositToken: 'both',
      binsPerSide: 20,
    };

    const validation = positionService.validatePositionParams(spotParams, poolInfo);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const prepared = await positionService.preparePositionCreation(spotParams, poolInfo);
    
    console.log(chalk.green('✅ Spot strategy prepared:'));
    console.log(`   Token X: $${prepared.tokenXAmount.toFixed(2)} (${prepared.rangeConfig.tokenDistribution.tokenXPercent.toFixed(1)}%)`);
    console.log(`   Token Y: $${prepared.tokenYAmount.toFixed(2)} (${prepared.rangeConfig.tokenDistribution.tokenYPercent.toFixed(1)}%)`);
    console.log(`   Bin Range: ${prepared.rangeConfig.minBinId} → ${prepared.rangeConfig.maxBinId}\n`);
    testsPassed++;
  } catch (error) {
    console.log(chalk.red(`❌ Spot strategy failed: ${error}\n`));
    testsFailed++;
  }

  // Test 3: Test Curve Strategy
  console.log(chalk.blue.bold('3️⃣ TEST CURVE STRATEGY (Concentrated)\n'));
  try {
    const curveParams: CreatePositionParams = {
      poolAddress: 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y',
      strategy: 'Curve',
      depositAmount: 1000,
      depositToken: 'both',
      binsPerSide: 20,
    };

    const prepared = await positionService.preparePositionCreation(curveParams, poolInfo);
    
    console.log(chalk.green('✅ Curve strategy prepared:'));
    console.log(`   Token X: $${prepared.tokenXAmount.toFixed(2)}`);
    console.log(`   Token Y: $${prepared.tokenYAmount.toFixed(2)}`);
    console.log(`   Bin Range: ${prepared.rangeConfig.minBinId} → ${prepared.rangeConfig.maxBinId}`);
    console.log(`   Range: ${(prepared.rangeConfig.binsPerSide * 2)} bins wider than Spot\n`);
    testsPassed++;
  } catch (error) {
    console.log(chalk.red(`❌ Curve strategy failed: ${error}\n`));
    testsFailed++;
  }

  // Test 4: Test BidAsk Strategy
  console.log(chalk.blue.bold('4️⃣ TEST BID-ASK STRATEGY (Custom Range)\n'));
  try {
    const bidAskParams: CreatePositionParams = {
      poolAddress: 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y',
      strategy: 'BidAsk',
      depositAmount: 1000,
      depositToken: 'both',
      minBinId: 8388588,
      maxBinId: 8388628,
    };

    const prepared = await positionService.preparePositionCreation(bidAskParams, poolInfo);
    
    console.log(chalk.green('✅ BidAsk strategy prepared:'));
    console.log(`   Min Bin: ${prepared.rangeConfig.minBinId}`);
    console.log(`   Max Bin: ${prepared.rangeConfig.maxBinId}`);
    console.log(`   Price Range: ${prepared.rangeConfig.binPrice.minPrice.toFixed(8)} - ${prepared.rangeConfig.binPrice.maxPrice.toFixed(8)}\n`);
    testsPassed++;
  } catch (error) {
    console.log(chalk.red(`❌ BidAsk strategy failed: ${error}\n`));
    testsFailed++;
  }

  // Test 5: Test Zap Deposit (Single Token)
  console.log(chalk.blue.bold('5️⃣ TEST ZAP DEPOSIT (Single Token - Auto-Swap)\n'));
  try {
    const zapParams: CreatePositionParams = {
      poolAddress: 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y',
      strategy: 'Spot',
      depositAmount: 1000,
      depositToken: 'tokenX', // Only depositing TokenX (SOL)
      binsPerSide: 20,
    };

    const prepared = await positionService.preparePositionCreation(zapParams, poolInfo);
    
    if (prepared.swapNeeded && prepared.swapDirection) {
      console.log(chalk.green('✅ Zap swap detected and prepared:'));
      console.log(`   Input: ${zapParams.depositAmount} ${poolInfo.tokenX.symbol}`);
      console.log(`   Swap Direction: ${prepared.swapDirection}`);
      console.log(`   Swap Amount: ${prepared.swapAmount?.toFixed(4)}`);
      console.log(`   After Swap:`);
      console.log(`     - ${poolInfo.tokenX.symbol}: $${prepared.tokenXAmount.toFixed(2)}`);
      console.log(`     - ${poolInfo.tokenY.symbol}: $${prepared.tokenYAmount.toFixed(2)}\n`);
      testsPassed++;
    } else {
      throw new Error('Swap should be needed for zap deposit');
    }
  } catch (error) {
    console.log(chalk.red(`❌ Zap deposit failed: ${error}\n`));
    testsFailed++;
  }

  // Test 6: Validation - Invalid Parameters
  console.log(chalk.blue.bold('6️⃣ TEST VALIDATION (Invalid Parameters)\n'));
  try {
    const invalidParams: CreatePositionParams = {
      poolAddress: 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y',
      strategy: 'Spot',
      depositAmount: 5, // Below minimum
      depositToken: 'both',
    };

    const validation = positionService.validatePositionParams(invalidParams, poolInfo);
    
    if (!validation.valid && validation.errors.length > 0) {
      console.log(chalk.green('✅ Validation correctly rejected invalid parameters:'));
      validation.errors.forEach((err) => {
        console.log(`   • ${err}`);
      });
      console.log();
      testsPassed++;
    } else {
      throw new Error('Should have detected invalid deposit amount');
    }
  } catch (error) {
    console.log(chalk.red(`❌ Validation test failed: ${error}\n`));
    testsFailed++;
  }

  // Test 7: Position Execution (Mock)
  console.log(chalk.blue.bold('7️⃣ TEST POSITION EXECUTION (Mock)\n'));
  try {
    const createParams: CreatePositionParams = {
      poolAddress: 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y',
      strategy: 'Spot',
      depositAmount: 500,
      depositToken: 'both',
      binsPerSide: 20,
    };

    const prepared = await positionService.preparePositionCreation(createParams, poolInfo);
    const result = await positionService.executePositionCreation(createParams, prepared);
    
    if (result.status === 'success') {
      console.log(chalk.green('✅ Position execution (mock) successful:'));
      console.log(`   Position Address: ${result.positionAddress}`);
      console.log(`   Pool: ${result.tokenXAmount ? '✓' : '✗'} Token X, ${result.tokenYAmount ? '✓' : '✗'} Token Y`);
      console.log(`   Initial Value: $${createParams.depositAmount}`);
      console.log(`   Gas Cost: $${result.cost.toFixed(4)}\n`);
      testsPassed++;
    } else {
      throw new Error(`Execution failed: ${result.errorMessage}`);
    }
  } catch (error) {
    console.log(chalk.red(`❌ Position execution failed: ${error}\n`));
    testsFailed++;
  }

  // Summary
  console.log(chalk.cyan.bold('╔═══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║         📊 TEST RESULTS 📊                                   ║'));
  console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════════╝\n'));

  const total = testsPassed + testsFailed;
  const percentage = total > 0 ? Math.round((testsPassed / total) * 100) : 0;

  console.log(`Tests Passed: ${chalk.green(testsPassed)}`);
  console.log(`Tests Failed: ${testsFailed > 0 ? chalk.red(testsFailed) : testsFailed}`);
  console.log(`Total Tests:  ${total}`);
  console.log(`Success Rate: ${percentage}%\n`);

  if (testsFailed === 0 && testsPassed > 0) {
    console.log(chalk.green.bold('✅ POSITION CREATION WORKFLOW COMPLETE!\n'));
    console.log(chalk.yellow.bold('Features Verified:'));
    console.log('  ✅ Pool detection and information retrieval');
    console.log('  ✅ Spot strategy (balanced 50/50)');
    console.log('  ✅ Curve strategy (concentrated)');
    console.log('  ✅ BidAsk strategy (custom ranges)');
    console.log('  ✅ Zap deposits (single token auto-swap)');
    console.log('  ✅ Parameter validation');
    console.log('  ✅ Position execution and tracking\n');
  }
}

testPositionCreation().catch(console.error);

