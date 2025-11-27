/**
 * Phase 2 Remove Liquidity Test
 * Tests removeLiquidity on custom Devnet pool positions
 * Removes 10% from Position 1 to test the functionality
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import DLMM from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import { LiquidityService } from '../src/services/liquidity.service';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

// Devnet Configuration
const RPC_URL = 'https://api.devnet.solana.com';
const POOL_ADDRESS = '9fQYAVUpQ79p98xo1D1cCudik5DrgaU6LmjSexLBWZa1';

// Position addresses (from successful verification)
const POSITION_1 = '3oVsaTyptEzy2PFGPTgSyqypZP55YAmDX6PgE2x2MTXu'; // Bins -10 to +10

// TEST tokens
const TEST_A = '81aJQM7SCZLW2HN72AGmNULJtqeHDdTWXfHBQPWxUiwZ'; // 9 decimals
const TEST_B = '7ZfVVVe2HL6FhVWBU7u6Ja8DUpABhPe7BXKZLXJ1EbSBr'; // 6 decimals

async function testRemoveLiquidity() {
  try {
    console.log('=== Phase 2: Remove Liquidity Test ===\n');

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
    const solBalanceBefore = await connection.getBalance(wallet.publicKey) / 1e9;
    console.log(`Initial SOL Balance: ${solBalanceBefore.toFixed(4)} SOL`);
    
    // Check token balances before
    let testABalanceBefore = 0;
    let testBBalanceBefore = 0;
    
    try {
      const testAMint = new PublicKey(TEST_A);
      const testAAta = await getAssociatedTokenAddress(testAMint, wallet.publicKey);
      const testAAccount = await getAccount(connection, testAAta);
      testABalanceBefore = Number(testAAccount.amount) / 1e9;
    } catch (error) {
      // Token account doesn't exist yet
    }
    
    try {
      const testBMint = new PublicKey(TEST_B);
      const testBAta = await getAssociatedTokenAddress(testBMint, wallet.publicKey);
      const testBAccount = await getAccount(connection, testBAta);
      testBBalanceBefore = Number(testBAccount.amount) / 1e6;
    } catch (error) {
      // Token account doesn't exist yet
    }
    
    console.log(`TEST-A Balance: ${testABalanceBefore.toLocaleString()}`);
    console.log(`TEST-B Balance: ${testBBalanceBefore.toLocaleString()}\n`);

    // ===========================
    // TEST: Remove 10% Liquidity
    // ===========================
    console.log('--- TEST: Remove 10% Liquidity from Position 1 ---\n');
    
    const position1PubKey = new PublicKey(POSITION_1);
    
    // Get position state before removal
    console.log('Getting position state before removal...');
    const positionBeforeRemoval = await dlmm.getPosition(position1PubKey);
    console.log(`  Position: ${POSITION_1}`);
    console.log(`  Bins: ${positionBeforeRemoval.positionData.lowerBinId} to ${positionBeforeRemoval.positionData.upperBinId}`);
    console.log(`  Total X Amount: ${positionBeforeRemoval.positionData.totalXAmount.toString()}`);
    console.log(`  Total Y Amount: ${positionBeforeRemoval.positionData.totalYAmount.toString()}`);
    
    console.log('\nRemoving 10% of liquidity from Position 1...');
    const removeResult = await liquidityService.removeLiquidity({
      positionPubKey: position1PubKey,
      percentage: 10,
      user: wallet.publicKey,
      wallet: wallet,
      shouldClaimAndClose: false,
    });
    
    if (removeResult.success) {
      console.log('\n✅ Remove Liquidity SUCCESS!');
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
      
      // Verify approximately 10% was removed
      const xPercentRemoved = (xDecrease.toNumber() / xBeforeRemoval.toNumber()) * 100;
      const yPercentRemoved = (yDecrease.toNumber() / yBeforeRemoval.toNumber()) * 100;
      console.log(`  Actual X Removed: ${xPercentRemoved.toFixed(2)}%`);
      console.log(`  Actual Y Removed: ${yPercentRemoved.toFixed(2)}%`);
      
      // Check token balances after
      console.log('\nChecking wallet token balances after removal...');
      
      let testABalanceAfter = 0;
      let testBBalanceAfter = 0;
      
      try {
        const testAMint = new PublicKey(TEST_A);
        const testAAta = await getAssociatedTokenAddress(testAMint, wallet.publicKey);
        const testAAccount = await getAccount(connection, testAAta);
        testABalanceAfter = Number(testAAccount.amount) / 1e9;
      } catch (error) {
        // Token account doesn't exist
      }
      
      try {
        const testBMint = new PublicKey(TEST_B);
        const testBAta = await getAssociatedTokenAddress(testBMint, wallet.publicKey);
        const testBAccount = await getAccount(connection, testBAta);
        testBBalanceAfter = Number(testBAccount.amount) / 1e6;
      } catch (error) {
        // Token account doesn't exist
      }
      
      console.log(`  TEST-A Balance: ${testABalanceAfter.toLocaleString()}`);
      console.log(`  TEST-B Balance: ${testBBalanceAfter.toLocaleString()}`);
      console.log(`  TEST-A Increase: ${(testABalanceAfter - testABalanceBefore).toLocaleString()}`);
      console.log(`  TEST-B Increase: ${(testBBalanceAfter - testBBalanceBefore).toLocaleString()}`);
      
    } else {
      console.log('❌ Remove Liquidity FAILED');
    }

    // Final Summary
    console.log('\n=== Final Summary ===');
    
    const solBalanceAfter = await connection.getBalance(wallet.publicKey) / 1e9;
    const solUsed = solBalanceBefore - solBalanceAfter;
    console.log(`Final SOL Balance: ${solBalanceAfter.toFixed(4)} SOL`);
    console.log(`SOL Used for Fees: ${solUsed.toFixed(4)} SOL`);
    
    console.log('\n✅ Phase 2 Remove Liquidity Test Complete!');
    console.log('\nNote: This test removed 10% from Position 1.');
    console.log('The tokens should now be back in the wallet.');
    console.log('You can add them back with addLiquidity() when you have SOL for fees.');

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
testRemoveLiquidity();
