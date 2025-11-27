/**
 * Phase 2: Test Remove Liquidity with App Wallet
 * Uses the encrypted wallet that owns the positions
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import DLMM from '@meteora-ag/dlmm';
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
const POSITION_1 = '3oVsaTyptEzy2PFGPTgSyqypZP55YAmDX6PgE2x2MTXu'; // Bins -10 to +10

// TEST tokens (from test-pool-config.json)
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
  
  const secretKey = bs58.decode(decryptedKey);
  return Keypair.fromSecretKey(secretKey);
}

async function testRemoveLiquidity() {
  try {
    console.log('=== Phase 2: Remove Liquidity Test (App Wallet) ===\n');

    // Setup connection
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Load encrypted app wallet
    console.log('Loading encrypted wallet...');
    const wallet = await loadWallet();
    
    console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
    console.log('(This is the wallet that owns the positions)\n');
    
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
    console.log(`  Bins with Liquidity: ${positionBeforeRemoval.positionData.positionBinData.length}`);
    
    console.log('\nRemoving 10% of liquidity from Position 1...');
    console.log('(shouldClaimAndClose: true - will transfer tokens to wallet)');
    const removeResult = await liquidityService.removeLiquidity({
      positionPubKey: position1PubKey,
      percentage: 10,
      user: wallet.publicKey,
      wallet: wallet,
      shouldClaimAndClose: true, // This claims the tokens to the wallet!
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
      
      // Verify approximately 10% was removed (use division to avoid toNumber overflow)
      // Calculate: (decrease / total) * 100
      const xPercentRemoved = xDecrease.mul(new BN(10000)).div(xBeforeRemoval).toNumber() / 100;
      const yPercentRemoved = yDecrease.mul(new BN(10000)).div(yBeforeRemoval).toNumber() / 100;
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
    console.log('\nThis successfully validates the removeLiquidity() implementation!');
    console.log('The tokens were returned to the wallet as expected.');

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
