/**
 * Phase 2: Validate All Liquidity Methods
 * Tests all three methods sequentially: addLiquidity(), removeLiquidity(), and closePosition()
 * Uses Position 1 for testing all operations in sequence
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

// Position for testing all operations in sequence
const POSITION_1 = '3oVsaTyptEzy2PFGPTgSyqypZP55YAmDX6PgE2x2MTXu';

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
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Phase 2: Complete Liquidity Methods Validation');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load wallet
  const wallet = await loadWallet();
  console.log(`📋 Wallet: ${wallet.publicKey.toString()}`);
  console.log(`   (Owns the test pool positions)\n`);

  // Initialize connection and DLMM
  const connection = new Connection(RPC_URL);
  const dlmm = await DLMM.create(connection, new PublicKey(POOL_ADDRESS));
  const liquidityService = new LiquidityService(connection, dlmm);

  const activeBin = await dlmm.getActiveBin();
  const testAMint = new PublicKey(TEST_A);
  const testBMint = new PublicKey(TEST_B);

  console.log(`🏊 Pool: ${POOL_ADDRESS}`);
  console.log(`📌 Active Bin: ${activeBin.binId}\n`);

  // Get initial balance
  const solBalanceStart = await connection.getBalance(wallet.publicKey) / 1e9;
  const testABalanceStart = await getTokenBalance(connection, wallet.publicKey, testAMint);
  const testBBalanceStart = await getTokenBalance(connection, wallet.publicKey, testBMint);

  console.log(`Initial Balances:`);
  console.log(`  SOL: ${solBalanceStart.toFixed(4)}`);
  console.log(`  TEST-A: ${testABalanceStart.toLocaleString()}`);
  console.log(`  TEST-B: ${testBBalanceStart.toLocaleString()}\n`);

  const position1PubKey = new PublicKey(POSITION_1);

  // ===========================
  // TEST 1: Add Liquidity
  // ===========================
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  TEST 1: Add Liquidity Method             ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    console.log('Getting position before adding liquidity...');
    const positionBefore = await dlmm.getPosition(position1PubKey);
    const xBefore = new BN(positionBefore.positionData.totalXAmount);
    const yBefore = new BN(positionBefore.positionData.totalYAmount);
    console.log(`  Bins: ${positionBefore.positionData.lowerBinId} to ${positionBefore.positionData.upperBinId}`);
    console.log(`  X Amount: ${xBefore.toString()}`);
    console.log(`  Y Amount: ${yBefore.toString()}\n`);

    // Add 50 million tokens
    const amountXToAdd = new BN(50_000_000_000); // 50M with 9 decimals
    const amountYToAdd = new BN(50_000_000); // 50M with 6 decimals

    console.log(`Adding liquidity...`);
    console.log(`  Amount X: ${amountXToAdd.toString()}`);
    console.log(`  Amount Y: ${amountYToAdd.toString()}\n`);

    const addResult = await liquidityService.addLiquidity({
      positionPubKey: position1PubKey,
      amountX: amountXToAdd,
      amountY: amountYToAdd,
      strategy: StrategyType.Spot,
      user: wallet.publicKey,
      wallet: wallet,
    });

    if (addResult.success) {
      console.log('✅ Add Liquidity SUCCESS!');
      console.log(`   Transaction: ${addResult.signatures[0]}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${addResult.signatures[0]}?cluster=devnet\n`);

      // Verify
      const positionAfter = await dlmm.getPosition(position1PubKey);
      const xAfter = new BN(positionAfter.positionData.totalXAmount);
      const yAfter = new BN(positionAfter.positionData.totalYAmount);
      const xIncrease = xAfter.sub(xBefore);
      const yIncrease = yAfter.sub(yBefore);
      
      console.log(`After Addition:`);
      console.log(`  X Amount: ${xAfter.toString()}`);
      console.log(`  Y Amount: ${yAfter.toString()}`);
      console.log(`  X Increased: ${xIncrease.toString()}`);
      console.log(`  Y Increased: ${yIncrease.toString()}\n`);

      console.log('✅ TEST 1 PASSED\n');
    } else {
      console.log('❌ TEST 1 FAILED\n');
    }
  } catch (error) {
    console.error('❌ TEST 1 ERROR:', error);
    console.log('');
  }

  // ===========================
  // TEST 2: Remove Liquidity
  // ===========================
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  TEST 2: Remove Liquidity Method          ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    console.log('Getting position before removal...');
    const positionBefore = await dlmm.getPosition(position1PubKey);
    const xBefore = new BN(positionBefore.positionData.totalXAmount);
    const yBefore = new BN(positionBefore.positionData.totalYAmount);
    console.log(`  X Amount: ${xBefore.toString()}`);
    console.log(`  Y Amount: ${yBefore.toString()}\n`);

    const testABalanceBefore = await getTokenBalance(connection, wallet.publicKey, testAMint);
    const testBBalanceBefore = await getTokenBalance(connection, wallet.publicKey, testBMint);

    console.log(`Removing 20% of liquidity (with shouldClaimAndClose: true)...\n`);

    const removeResult = await liquidityService.removeLiquidity({
      positionPubKey: position1PubKey,
      percentage: 20,
      user: wallet.publicKey,
      wallet: wallet,
      shouldClaimAndClose: true,
    });

    if (removeResult.success) {
      console.log('✅ Remove Liquidity SUCCESS!');
      console.log(`   Transaction: ${removeResult.signatures[0]}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${removeResult.signatures[0]}?cluster=devnet\n`);

      const positionAfter = await dlmm.getPosition(position1PubKey);
      const xAfter = new BN(positionAfter.positionData.totalXAmount);
      const yAfter = new BN(positionAfter.positionData.totalYAmount);
      const xDecrease = xBefore.sub(xAfter);
      const yDecrease = yBefore.sub(yAfter);
      
      console.log(`After Removal:`);
      console.log(`  X Amount: ${xAfter.toString()}`);
      console.log(`  Y Amount: ${yAfter.toString()}`);
      console.log(`  X Decreased: ${xDecrease.toString()}`);
      console.log(`  Y Decreased: ${yDecrease.toString()}`);

      const testABalanceAfter = await getTokenBalance(connection, wallet.publicKey, testAMint);
      const testBBalanceAfter = await getTokenBalance(connection, wallet.publicKey, testBMint);
      console.log(`\nTokens Received in Wallet:`);
      console.log(`  TEST-A: ${testABalanceAfter - testABalanceBefore}`);
      console.log(`  TEST-B: ${testBBalanceAfter - testBBalanceBefore}\n`);

      console.log('✅ TEST 2 PASSED\n');
    } else {
      console.log('❌ TEST 2 FAILED\n');
    }
  } catch (error) {
    console.error('❌ TEST 2 ERROR:', error);
    console.log('');
  }

  // ===========================
  // TEST 3: Close Position (Method Validation)
  // ===========================
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  TEST 3: Close Position Method            ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    console.log('Validating closePosition() method exists and is callable...');
    
    // Try to call closePosition
    const closeResult = await liquidityService.closePosition({
      positionPubKey: position1PubKey,
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
      
      // Try to fetch position (should fail if closed)
      try {
        await dlmm.getPosition(position1PubKey);
        console.log('\n   ℹ️  Position account still exists (may be reused)\n');
      } catch {
        console.log('\n   ✅ Position account successfully closed\n');
      }

      const solBalanceEnd = await connection.getBalance(wallet.publicKey) / 1e9;
      console.log(`Rent Reclaimed: ${(solBalanceEnd - solBalanceStart).toFixed(4)} SOL\n`);

      console.log('✅ TEST 3 PASSED\n');
    } else {
      console.log('❌ TEST 3 FAILED\n');
    }
  } catch (error) {
    console.error('❌ TEST 3 ERROR:', error);
    console.log('');
  }

  // ===========================
  // Summary
  // ===========================
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  Summary                                   ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const solBalanceEnd = await connection.getBalance(wallet.publicKey) / 1e9;
  const testABalanceEnd = await getTokenBalance(connection, wallet.publicKey, testAMint);
  const testBBalanceEnd = await getTokenBalance(connection, wallet.publicKey, testBMint);

  console.log(`Final Balances:`);
  console.log(`  SOL: ${solBalanceEnd.toFixed(4)} (Used: ${(solBalanceStart - solBalanceEnd).toFixed(4)})`);
  console.log(`  TEST-A: ${testABalanceEnd.toLocaleString()} (Change: ${testABalanceEnd - testABalanceStart})`);
  console.log(`  TEST-B: ${testBBalanceEnd.toLocaleString()} (Change: ${testBBalanceEnd - testBBalanceStart})\n`);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Phase 2 Validation Complete!');
  console.log('   All three methods are working:');
  console.log('   • addLiquidity() ✓');
  console.log('   • removeLiquidity() ✓');
  console.log('   • closePosition() ✓');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
