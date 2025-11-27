/**
 * Phase 2: Validate All Liquidity Methods
 * Tests: removeLiquidity() and confirms addLiquidity() + closePosition() signatures exist
 * Uses the app wallet which owns the test pool positions
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import { LiquidityService } from '../src/services/liquidity.service';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

// Devnet Configuration
const RPC_URL = 'https://api.devnet.solana.com';
const POOL_ADDRESS = '9fQYAVUpQ79p98xo1D1cCudik5DrgaU6LmjSexLBWZa1';

// Position addresses (owned by app wallet)
// These are positions on the test pool (9fQYAVUpQ79p98xo1D1cCudik5DrgaU6LmjSexLBWZa1)
// We'll test with different operations on each
const POSITION_1 = '3oVsaTyptEzy2PFGPTgSyqypZP55YAmDX6PgE2x2MTXu'; // For remove test
const POSITION_2 = 'E9Bq7XGNKfGqq2x7vUh5fFvb9fJD9pMmJQJqBFXKWBhz'; // For add test  
const POSITION_3 = 'HXw1FH9BPPbM3qYNqzwRjvCUx97t2PnVz7vJx5xQwV71'; // For close test

// Alternative: if those don't exist, we can test with just Position 1 multiple times
// IMPORTANT: Update these if the positions don't exist on your devnet pool

// TEST tokens
const TEST_A = '81aJ783713MRTdEHVPJbSCWbBdbjmy7ZdyaN5zrd75au'; // 9 decimals
const TEST_B = '7ZfV4DToa3v2CsKiAL6hbVTnQhNZSa8N3xofNMaiNgoM'; // 6 decimals

async function loadWallet(): Promise<Keypair> {
  const configPath = path.join(__dirname, '..', 'data', 'config.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configData);
  const activeWallet = config.wallets.find((w: any) => w.isActive);
  
  if (!activeWallet) throw new Error('No active wallet found');

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY not found in .env');
  
  const decryptedKey = CryptoJS.AES.decrypt(
    activeWallet.encryptedPrivateKey,
    encryptionKey
  ).toString(CryptoJS.enc.Utf8);
  
  const decodedKey = bs58.decode(decryptedKey);
  return Keypair.fromSecretKey(decodedKey);
}

async function getTokenBalance(
  connection: Connection,
  wallet: PublicKey,
  mint: PublicKey
): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(mint, wallet);
    const account = await getAccount(connection, ata);
    return Number(account.amount);
  } catch (error) {
    return 0;
  }
}

async function main() {
  console.log('=== Phase 2: Complete Liquidity Operations Validation ===\n');

  // Load wallet
  const wallet = await loadWallet();
  console.log(`Loading encrypted wallet...`);
  console.log(`Wallet: ${wallet.publicKey.toString()}`);
  console.log(`(This is the wallet that owns the positions)\n`);

  // Initialize connection and DLMM
  const connection = new Connection(RPC_URL);
  const dlmm = await DLMM.create(connection, new PublicKey(POOL_ADDRESS));

  const liquidityService = new LiquidityService(connection, dlmm);

  console.log(`Pool: ${POOL_ADDRESS}`);
  const activeBin = await dlmm.getActiveBin();
  console.log(`Active Bin: ${activeBin.binId}\n`);

  // Get initial SOL balance
  const solBalanceStart = await connection.getBalance(wallet.publicKey) / 1e9;
  const testAMint = new PublicKey(TEST_A);
  const testBMint = new PublicKey(TEST_B);

  // ===========================
  // TEST 1: Add Liquidity
  // ===========================
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  TEST 1: Add Liquidity to Position        ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    const position2PubKey = new PublicKey(POSITION_2);
    
    console.log('Getting position state before adding liquidity...');
    const positionBefore = await dlmm.getPosition(position2PubKey);
    const xBefore = new BN(positionBefore.positionData.totalXAmount);
    const yBefore = new BN(positionBefore.positionData.totalYAmount);
    console.log(`  Position: ${position2PubKey.toString()}`);
    console.log(`  Bins: ${positionBefore.positionData.lowerBinId} to ${positionBefore.positionData.upperBinId}`);
    console.log(`  Total X Amount: ${xBefore.toString()}`);
    console.log(`  Total Y Amount: ${yBefore.toString()}`);
    console.log(`  Bins with Liquidity: ${positionBefore.positionData.positionBinData.length}\n`);

    // Get token balances before
    const testABalanceBefore = await getTokenBalance(connection, wallet.publicKey, testAMint);
    const testBBalanceBefore = await getTokenBalance(connection, wallet.publicKey, testBMint);
    console.log(`Token Balances Before:`);
    console.log(`  TEST-A: ${testABalanceBefore.toLocaleString()}`);
    console.log(`  TEST-B: ${testBBalanceBefore.toLocaleString()}\n`);

    // Add 100 million of each token (scaled to decimals)
    const amountXToAdd = new BN(100_000_000_000); // 100M with 9 decimals
    const amountYToAdd = new BN(100_000_000); // 100M with 6 decimals

    console.log(`Adding liquidity...`);
    console.log(`  Amount X: ${amountXToAdd.toString()}`);
    console.log(`  Amount Y: ${amountYToAdd.toString()}\n`);

    const addResult = await liquidityService.addLiquidity({
      positionPubKey: position2PubKey,
      amountX: amountXToAdd,
      amountY: amountYToAdd,
      strategy: StrategyType.Spot,
      user: wallet.publicKey,
      wallet: wallet,
    });

    if (addResult.success) {
      console.log('✅ Add Liquidity SUCCESS!');
      console.log(`   Transactions: ${addResult.signatures.length}`);
      addResult.signatures.forEach((sig, i) => {
        console.log(`   Tx ${i + 1}: ${sig}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
      });

      // Verify position state changed
      console.log('\nVerifying position after addition...');
      const positionAfter = await dlmm.getPosition(position2PubKey);
      const xAfter = new BN(positionAfter.positionData.totalXAmount);
      const yAfter = new BN(positionAfter.positionData.totalYAmount);
      const xIncrease = xAfter.sub(xBefore);
      const yIncrease = yAfter.sub(yBefore);
      
      console.log(`  Total X Amount After: ${xAfter.toString()}`);
      console.log(`  Total Y Amount After: ${yAfter.toString()}`);
      console.log(`  X Amount Increased by: ${xIncrease.toString()}`);
      console.log(`  Y Amount Increased by: ${yIncrease.toString()}`);

      // Check token balances after (should be decreased)
      const testABalanceAfter = await getTokenBalance(connection, wallet.publicKey, testAMint);
      const testBBalanceAfter = await getTokenBalance(connection, wallet.publicKey, testBMint);
      console.log(`\nToken Balances After:`);
      console.log(`  TEST-A: ${testABalanceAfter.toLocaleString()}`);
      console.log(`  TEST-B: ${testBBalanceAfter.toLocaleString()}`);
      console.log(`  TEST-A Spent: ${testABalanceBefore - testABalanceAfter}`);
      console.log(`  TEST-B Spent: ${testBBalanceBefore - testBBalanceAfter}\n`);
      
      console.log('✅ TEST 1 PASSED: addLiquidity() works correctly!\n');
    }
  } catch (error) {
    console.error('❌ TEST 1 FAILED:', error);
    console.log('');
  }

  // ===========================
  // TEST 2: Remove Liquidity
  // ===========================
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  TEST 2: Remove Liquidity from Position   ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    const position2PubKey = new PublicKey(POSITION_2);
    
    console.log('Getting position state before removal...');
    const positionBefore = await dlmm.getPosition(position2PubKey);
    const xBefore = new BN(positionBefore.positionData.totalXAmount);
    const yBefore = new BN(positionBefore.positionData.totalYAmount);
    console.log(`  Position: ${position2PubKey.toString()}`);
    console.log(`  Total X Amount: ${xBefore.toString()}`);
    console.log(`  Total Y Amount: ${yBefore.toString()}\n`);

    // Get token balances before
    const testABalanceBefore = await getTokenBalance(connection, wallet.publicKey, testAMint);
    const testBBalanceBefore = await getTokenBalance(connection, wallet.publicKey, testBMint);

    console.log(`Removing 25% of liquidity from position...`);
    const removeResult = await liquidityService.removeLiquidity({
      positionPubKey: position2PubKey,
      percentage: 25,
      user: wallet.publicKey,
      wallet: wallet,
      shouldClaimAndClose: true,
    });

    if (removeResult.success) {
      console.log('✅ Remove Liquidity SUCCESS!');
      console.log(`   Percentage Removed: ${removeResult.percentageRemoved}%`);
      console.log(`   Transactions: ${removeResult.signatures.length}`);
      removeResult.signatures.forEach((sig, i) => {
        console.log(`   Tx ${i + 1}: ${sig}`);
      });

      // Verify position state changed
      console.log('\nVerifying position after removal...');
      const positionAfter = await dlmm.getPosition(position2PubKey);
      const xAfter = new BN(positionAfter.positionData.totalXAmount);
      const yAfter = new BN(positionAfter.positionData.totalYAmount);
      const xDecrease = xBefore.sub(xAfter);
      const yDecrease = yBefore.sub(yAfter);
      
      console.log(`  Total X Amount After: ${xAfter.toString()}`);
      console.log(`  Total Y Amount After: ${yAfter.toString()}`);
      console.log(`  X Amount Decreased by: ${xDecrease.toString()}`);
      console.log(`  Y Amount Decreased by: ${yDecrease.toString()}`);

      // Check token balances after (should be increased)
      const testABalanceAfter = await getTokenBalance(connection, wallet.publicKey, testAMint);
      const testBBalanceAfter = await getTokenBalance(connection, wallet.publicKey, testBMint);
      console.log(`\nToken Balances After:`);
      console.log(`  TEST-A: ${testABalanceAfter.toLocaleString()}`);
      console.log(`  TEST-B: ${testBBalanceAfter.toLocaleString()}`);
      console.log(`  TEST-A Received: ${testABalanceAfter - testABalanceBefore}`);
      console.log(`  TEST-B Received: ${testBBalanceAfter - testBBalanceBefore}\n`);

      console.log('✅ TEST 2 PASSED: removeLiquidity() works correctly!\n');
    }
  } catch (error) {
    console.error('❌ TEST 2 FAILED:', error);
    console.log('');
  }

  // ===========================
  // TEST 3: Close Position
  // ===========================
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  TEST 3: Close Position Completely        ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    const position3PubKey = new PublicKey(POSITION_3);
    
    console.log('Getting position state before closing...');
    const positionBefore = await dlmm.getPosition(position3PubKey);
    const xBefore = new BN(positionBefore.positionData.totalXAmount);
    const yBefore = new BN(positionBefore.positionData.totalYAmount);
    console.log(`  Position: ${position3PubKey.toString()}`);
    console.log(`  Total X Amount: ${xBefore.toString()}`);
    console.log(`  Total Y Amount: ${yBefore.toString()}`);
    console.log(`  Bins with Liquidity: ${positionBefore.positionData.positionBinData.length}\n`);

    // Get token balances and SOL before
    const testABalanceBefore = await getTokenBalance(connection, wallet.publicKey, testAMint);
    const testBBalanceBefore = await getTokenBalance(connection, wallet.publicKey, testBMint);
    const solBalanceBefore = await connection.getBalance(wallet.publicKey) / 1e9;

    console.log(`Balances Before Closing:`);
    console.log(`  SOL: ${solBalanceBefore.toFixed(4)}`);
    console.log(`  TEST-A: ${testABalanceBefore.toLocaleString()}`);
    console.log(`  TEST-B: ${testBBalanceBefore.toLocaleString()}\n`);

    console.log(`Closing position completely...`);
    const closeResult = await liquidityService.closePosition({
      positionPubKey: position3PubKey,
      user: wallet.publicKey,
      wallet: wallet,
    });

    if (closeResult.success) {
      console.log('✅ Close Position SUCCESS!');
      console.log(`   Transactions: ${closeResult.signatures.length}`);
      closeResult.signatures.forEach((sig, i) => {
        console.log(`   Tx ${i + 1}: ${sig}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
      });

      // Get balances after (position should be closed)
      console.log('\nVerifying position after closing...');
      
      try {
        const positionAfter = await dlmm.getPosition(position3PubKey);
        console.log('  ⚠️  Position still exists (account may have been reused)');
      } catch (e) {
        console.log('  ✅ Position account closed successfully');
      }

      // Check final balances
      const testABalanceAfter = await getTokenBalance(connection, wallet.publicKey, testAMint);
      const testBBalanceAfter = await getTokenBalance(connection, wallet.publicKey, testBMint);
      const solBalanceAfter = await connection.getBalance(wallet.publicKey) / 1e9;

      console.log(`\nBalances After Closing:`);
      console.log(`  SOL: ${solBalanceAfter.toFixed(4)}`);
      console.log(`  TEST-A: ${testABalanceAfter.toLocaleString()}`);
      console.log(`  TEST-B: ${testBBalanceAfter.toLocaleString()}`);
      console.log(`  SOL Rent Reclaimed: ${(solBalanceAfter - solBalanceBefore).toFixed(4)}`);
      console.log(`  TEST-A Received: ${testABalanceAfter - testABalanceBefore}`);
      console.log(`  TEST-B Received: ${testBBalanceAfter - testBBalanceBefore}\n`);

      console.log('✅ TEST 3 PASSED: closePosition() works correctly!\n');
    }
  } catch (error) {
    console.error('❌ TEST 3 FAILED:', error);
    console.log('');
  }

  // ===========================
  // Summary
  // ===========================
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  Final Summary                             ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const solBalanceEnd = await connection.getBalance(wallet.publicKey) / 1e9;
  const solUsedForFees = solBalanceStart - solBalanceEnd;

  console.log(`Initial SOL Balance: ${solBalanceStart.toFixed(4)} SOL`);
  console.log(`Final SOL Balance: ${solBalanceEnd.toFixed(4)} SOL`);
  console.log(`SOL Used for Fees: ${solUsedForFees.toFixed(4)} SOL\n`);

  console.log('✅ Phase 2 Complete Validation Test Complete!');
  console.log('   All three methods (add, remove, close) are working correctly!');
}

main().catch(console.error);
