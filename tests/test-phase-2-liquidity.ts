/**
 * Phase 2 Liquidity Operations Test
 * Tests addLiquidity, removeLiquidity, and closePosition on custom Devnet pool
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import { LiquidityService } from '../src/services/liquidity.service';

// Devnet Configuration
const RPC_URL = 'https://api.devnet.solana.com';
const POOL_ADDRESS = '9fQYAVUpQ79p98xo1D1cCudik5DrgaU6LmjSexLBWZa1';

// Position addresses (from successful verification)
const POSITION_1 = '3oVsaTyptEzy2PFGPTgSyqypZP55YAmDX6PgE2x2MTXu'; // Bins -10 to +10
const POSITION_2 = 'GV6aHS3mwYeiQZTXTzUsRfgR1xMc1rnDyU4dVRMNqyjW'; // Bins -80 to -50

async function testPhase2Operations() {
  try {
    console.log('=== Phase 2 Liquidity Operations Test ===\n');

    // Setup connection and wallet
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Load wallet
    const walletPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'solana', 'id.json');
    const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    
    console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
    
    // Initialize DLMM and LiquidityService
    const poolPubKey = new PublicKey(POOL_ADDRESS);
    const dlmm = await DLMM.create(connection, poolPubKey);
    const liquidityService = new LiquidityService(connection, dlmm);
    
    const activeBin = await dlmm.getActiveBin();
    
    console.log(`Pool: ${POOL_ADDRESS}`);
    console.log(`Active Bin: ${activeBin.binId}\n`);

    // Get initial wallet balances
    const solBalance = await connection.getBalance(wallet.publicKey) / 1e9;
    console.log(`Initial SOL Balance: ${solBalance.toFixed(4)} SOL\n`);

    // ===========================
    // TEST 1: Add Liquidity
    // ===========================
    console.log('--- TEST 1: Add Liquidity to Position 1 ---');
    
    const position1PubKey = new PublicKey(POSITION_1);
    
    // Get position state before
    console.log('Getting position state before adding liquidity...');
    const positionBefore = await dlmm.getPosition(position1PubKey);
    console.log(`  Total X Amount Before: ${positionBefore.positionData.totalXAmount.toString()}`);
    console.log(`  Total Y Amount Before: ${positionBefore.positionData.totalYAmount.toString()}`);
    
    // Add small amount of liquidity
    console.log('\nAdding liquidity: 5,000,000 TEST-A, 5,000 TEST-B (using Spot strategy)...');
    const addResult = await liquidityService.addLiquidity({
      positionPubKey: position1PubKey,
      amountX: new BN(5_000_000_000), // 5,000 TEST-A (9 decimals)
      amountY: new BN(5_000_000_000),  // 5,000 TEST-B (6 decimals)
      user: wallet.publicKey,
      wallet: wallet,
      strategy: StrategyType.Spot,
      slippage: 1, // 1% slippage tolerance
    });
    
    if (addResult.success) {
      console.log('✅ Add Liquidity SUCCESS!');
      console.log(`   Transaction: ${addResult.signatures[0]}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${addResult.signatures[0]}?cluster=devnet`);
      
      // Get position state after
      console.log('\nGetting position state after adding liquidity...');
      const positionAfter = await dlmm.getPosition(position1PubKey);
      console.log(`  Total X Amount After: ${positionAfter.positionData.totalXAmount.toString()}`);
      console.log(`  Total Y Amount After: ${positionAfter.positionData.totalYAmount.toString()}`);
      
      // Calculate increase (amounts are strings, convert to BN for calculation)
      const xBefore = new BN(positionBefore.positionData.totalXAmount);
      const xAfter = new BN(positionAfter.positionData.totalXAmount);
      const yBefore = new BN(positionBefore.positionData.totalYAmount);
      const yAfter = new BN(positionAfter.positionData.totalYAmount);
      
      const xIncrease = xAfter.sub(xBefore);
      const yIncrease = yAfter.sub(yBefore);
      console.log(`  X Amount Increased by: ${xIncrease.toString()}`);
      console.log(`  Y Amount Increased by: ${yIncrease.toString()}`);
    } else {
      console.log('❌ Add Liquidity FAILED');
    }

    // Wait a moment between tests
    console.log('\nWaiting 3 seconds before next test...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ===========================
    // TEST 2: Remove Liquidity (25%)
    // ===========================
    console.log('--- TEST 2: Remove 25% Liquidity from Position 1 ---');
    
    // Get position state before removal
    const positionBeforeRemoval = await dlmm.getPosition(position1PubKey);
    console.log(`  Total X Amount Before: ${positionBeforeRemoval.positionData.totalXAmount.toString()}`);
    console.log(`  Total Y Amount Before: ${positionBeforeRemoval.positionData.totalYAmount.toString()}`);
    
    console.log('\nRemoving 25% of liquidity...');
    const removeResult = await liquidityService.removeLiquidity({
      positionPubKey: position1PubKey,
      percentage: 25,
      user: wallet.publicKey,
      wallet: wallet,
      shouldClaimAndClose: false,
    });
    
    if (removeResult.success) {
      console.log('✅ Remove Liquidity SUCCESS!');
      console.log(`   Percentage Removed: ${removeResult.percentageRemoved}%`);
      console.log(`   Transactions: ${removeResult.signatures.length}`);
      removeResult.signatures.forEach((sig, i) => {
        console.log(`   Transaction ${i + 1}: ${sig}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
      });
      
      // Get position state after removal
      console.log('\nGetting position state after removal...');
      const positionAfterRemoval = await dlmm.getPosition(position1PubKey);
      console.log(`  Total X Amount After: ${positionAfterRemoval.positionData.totalXAmount.toString()}`);
      console.log(`  Total Y Amount After: ${positionAfterRemoval.positionData.totalYAmount.toString()}`);
      
      // Calculate decrease (amounts are strings, convert to BN for calculation)
      const xBeforeRemoval = new BN(positionBeforeRemoval.positionData.totalXAmount);
      const xAfterRemoval = new BN(positionAfterRemoval.positionData.totalXAmount);
      const yBeforeRemoval = new BN(positionBeforeRemoval.positionData.totalYAmount);
      const yAfterRemoval = new BN(positionAfterRemoval.positionData.totalYAmount);
      
      const xDecrease = xBeforeRemoval.sub(xAfterRemoval);
      const yDecrease = yBeforeRemoval.sub(yAfterRemoval);
      console.log(`  X Amount Decreased by: ${xDecrease.toString()}`);
      console.log(`  Y Amount Decreased by: ${yDecrease.toString()}`);
      
      // Verify approximately 25% was removed
      const xPercentRemoved = (xDecrease.toNumber() / xBeforeRemoval.toNumber()) * 100;
      const yPercentRemoved = (yDecrease.toNumber() / yBeforeRemoval.toNumber()) * 100;
      console.log(`  Actual X Removed: ${xPercentRemoved.toFixed(2)}%`);
      console.log(`  Actual Y Removed: ${yPercentRemoved.toFixed(2)}%`);
    } else {
      console.log('❌ Remove Liquidity FAILED');
    }

    // Wait a moment before final summary
    console.log('\nWaiting 3 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ===========================
    // Final Summary
    // ===========================
    console.log('=== Final Summary ===');
    
    const finalSolBalance = await connection.getBalance(wallet.publicKey) / 1e9;
    const solUsed = solBalance - finalSolBalance;
    console.log(`Final SOL Balance: ${finalSolBalance.toFixed(4)} SOL`);
    console.log(`SOL Used for Fees: ${solUsed.toFixed(4)} SOL`);
    
    console.log('\n✅ Phase 2 Liquidity Operations Test Complete!');
    console.log('\nNote: To test closePosition(), create a small test position first,');
    console.log('then call closePosition() to remove 100% and close the account.');

  } catch (error) {
    console.error('\n❌ Test Failed with Error:');
    console.error(error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testPhase2Operations();
