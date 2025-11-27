#!/usr/bin/env ts-node

/**
 * ADD LIQUIDITY TO TEST POOL
 * 
 * This script adds initial liquidity to the custom test pool.
 * It will:
 * 1. Check if pool is activated
 * 2. Create a position
 * 3. Add liquidity using the Spot strategy
 * 4. Display position details
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

const DEVNET_RPC = 'https://api.devnet.solana.com';

interface TestPoolConfig {
  poolAddress: string;
  tokenAMint: string;
  tokenBMint: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  tokenADecimals: number;
  tokenBDecimals: number;
  initialLiquidityAdded: boolean;
  createdAt: string;
}

async function loadWallet(): Promise<Keypair> {
  const configPath = path.join(__dirname, '..', 'data', 'config.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configData);
  const activeWallet = config.wallets.find((w: any) => w.isActive);
  
  if (!activeWallet) throw new Error('No active wallet found');

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY not found');
  
  const decryptedKey = CryptoJS.AES.decrypt(
    activeWallet.encryptedPrivateKey,
    encryptionKey
  ).toString(CryptoJS.enc.Utf8);
  
  const secretKey = bs58.decode(decryptedKey);
  return Keypair.fromSecretKey(secretKey);
}

async function loadPoolConfig(): Promise<TestPoolConfig> {
  const configPath = path.join(__dirname, '..', 'data', 'test-pool-config.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configData);
}

async function savePoolConfig(config: TestPoolConfig): Promise<void> {
  const configPath = path.join(__dirname, '..', 'data', 'test-pool-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

async function checkPoolActivation(connection: Connection, poolAddress: PublicKey): Promise<boolean> {
  console.log('\n🔍 Checking Pool Activation Status...');
  
  try {
    const dlmmPool = await DLMM.create(connection, poolAddress, {
      cluster: 'devnet'
    });
    
    const currentSlot = await connection.getSlot();
    const poolStatus = dlmmPool.lbPair.status;
    
    console.log(`   Current Slot: ${currentSlot}`);
    console.log(`   Pool Status: ${poolStatus}`);
    console.log(`   Active Bin ID: ${dlmmPool.lbPair.activeId}`);
    
    // Status 0 = enabled, 1 = disabled
    if (poolStatus === 1) {
      console.log(`   ⏳ Pool is still disabled (not yet activated)`);
      return false;
    }
    
    console.log(`   ✅ Pool is activated and ready!`);
    return true;
    
  } catch (error: any) {
    console.error(`   ❌ Error checking pool status: ${error.message}`);
    throw error;
  }
}

async function addLiquidity(
  connection: Connection,
  wallet: Keypair,
  poolConfig: TestPoolConfig,
  amountA: number,
  amountB: number
): Promise<PublicKey> {
  console.log('\n💧 Adding Liquidity to Pool...');
  
  try {
    const poolAddress = new PublicKey(poolConfig.poolAddress);
    
    // Create DLMM instance
    const dlmmPool = await DLMM.create(connection, poolAddress, {
      cluster: 'devnet'
    });
    
    console.log(`   Pool: ${poolConfig.poolAddress}`);
    console.log(`   Active Bin ID: ${dlmmPool.lbPair.activeId}`);
    
    // Calculate amounts in lamports
    const totalXAmount = new BN(amountA).mul(new BN(10).pow(new BN(poolConfig.tokenADecimals)));
    const totalYAmount = new BN(amountB).mul(new BN(10).pow(new BN(poolConfig.tokenBDecimals)));
    
    console.log(`   Adding ${amountA.toLocaleString()} ${poolConfig.tokenASymbol}`);
    console.log(`   Adding ${amountB.toLocaleString()} ${poolConfig.tokenBSymbol}`);
    
    // Create position keypair
    const positionKeypair = Keypair.generate();
    console.log(`   Position Keypair: ${positionKeypair.publicKey.toBase58()}`);
    
    // Define liquidity distribution (spot distribution around active bin)
    // Spot strategy = balanced distribution around the active bin
    const minBinId = dlmmPool.lbPair.activeId - 10; // 10 bins below
    const maxBinId = dlmmPool.lbPair.activeId + 10; // 10 bins above
    
    console.log(`   Distribution Strategy: Spot (balanced)`);
    console.log(`   Bin Range: ${minBinId} to ${maxBinId}`);
    
    // Create position and add liquidity
    console.log('\n   📝 Creating position transaction...');
    const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: positionKeypair.publicKey,
      user: wallet.publicKey,
      totalXAmount,
      totalYAmount,
      strategy: {
        minBinId,
        maxBinId,
        strategyType: 1, // 1 = Spot strategy (balanced around active bin)
      },
    });
    
    console.log('   📤 Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      createPositionTx,
      [wallet, positionKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log(`   ✅ Liquidity Added! TX: ${signature}`);
    console.log(`   ✅ Position Address: ${positionKeypair.publicKey.toBase58()}`);
    
    return positionKeypair.publicKey;
    
  } catch (error: any) {
    console.error('\n❌ Error adding liquidity:', error.message);
    if (error.logs) {
      console.error('   Transaction logs:');
      error.logs.forEach((log: string) => console.error(`     ${log}`));
    }
    throw error;
  }
}

async function getPositionDetails(
  connection: Connection,
  poolAddress: PublicKey,
  positionAddress: PublicKey
): Promise<void> {
  console.log('\n📊 Fetching Position Details...');
  
  try {
    const dlmmPool = await DLMM.create(connection, poolAddress, {
      cluster: 'devnet'
    });
    
    const position = await dlmmPool.getPosition(positionAddress);
    
    console.log(`\n   Position: ${positionAddress.toBase58()}`);
    console.log(`   Lower Bin: ${position.positionData.lowerBinId}`);
    console.log(`   Upper Bin: ${position.positionData.upperBinId}`);
    console.log(`   Total X Amount: ${position.positionData.totalXAmount.toString()}`);
    console.log(`   Total Y Amount: ${position.positionData.totalYAmount.toString()}`);
    console.log(`   Fee X: ${position.positionData.feeX.toString()}`);
    console.log(`   Fee Y: ${position.positionData.feeY.toString()}`);
    
    console.log(`\n   ✅ Position created successfully in bins ${position.positionData.lowerBinId} to ${position.positionData.upperBinId}`);
    
  } catch (error: any) {
    console.error(`   ❌ Error fetching position: ${error.message}`);
  }
}

async function main() {
  console.log('\n💧 ADD LIQUIDITY TO TEST POOL');
  console.log('='.repeat(70));
  
  try {
    // 1. Setup
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    const wallet = await loadWallet();
    const poolConfig = await loadPoolConfig();
    
    console.log(`\n📋 Setup:`);
    console.log(`   Wallet: ${wallet.publicKey.toBase58()}`);
    
    const balance = await connection.getBalance(wallet.publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    console.log(`   Balance: ${balanceSOL.toFixed(4)} SOL`);
    
    console.log(`\n   Pool: ${poolConfig.poolAddress}`);
    console.log(`   Token A: ${poolConfig.tokenASymbol} (${poolConfig.tokenAMint})`);
    console.log(`   Token B: ${poolConfig.tokenBSymbol} (${poolConfig.tokenBMint})`);
    
    // 2. Check if pool is activated
    const poolAddress = new PublicKey(poolConfig.poolAddress);
    const isActivated = await checkPoolActivation(connection, poolAddress);
    
    if (!isActivated) {
      console.log('\n⏳ Pool is not yet activated. Please wait a moment and try again.');
      console.log('   Pool should activate within ~40 seconds of creation.');
      process.exit(0);
    }
    
    // 3. Check if liquidity was already added
    if (poolConfig.initialLiquidityAdded) {
      console.log('\n⚠️  Initial liquidity has already been added to this pool.');
      console.log('   To add more liquidity, you can create additional positions.');
      
      const answer = await new Promise<string>((resolve) => {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        readline.question('\n   Continue to add more liquidity? (y/n): ', (answer: string) => {
          readline.close();
          resolve(answer.toLowerCase());
        });
      });
      
      if (answer !== 'y' && answer !== 'yes') {
        console.log('\n   Cancelled.');
        process.exit(0);
      }
    }
    
    // 4. Add liquidity
    console.log('\n' + '='.repeat(70));
    console.log('ADDING LIQUIDITY');
    console.log('='.repeat(70));
    
    const liquidityAmountA = 10_000_000; // 10 million TEST-A
    const liquidityAmountB = 10_000_000; // 10 million TEST-B
    
    const positionAddress = await addLiquidity(
      connection,
      wallet,
      poolConfig,
      liquidityAmountA,
      liquidityAmountB
    );
    
    // 5. Get position details
    await getPositionDetails(connection, poolAddress, positionAddress);
    
    // 6. Update config
    if (!poolConfig.initialLiquidityAdded) {
      poolConfig.initialLiquidityAdded = true;
      await savePoolConfig(poolConfig);
      console.log('\n   ✅ Updated pool config (initialLiquidityAdded = true)');
    }
    
    // 7. Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ LIQUIDITY ADDED SUCCESSFULLY!');
    console.log('='.repeat(70));
    
    console.log('\n📊 Summary:');
    console.log(`   Pool: ${poolConfig.poolAddress}`);
    console.log(`   Position: ${positionAddress.toBase58()}`);
    console.log(`   Liquidity: ${liquidityAmountA.toLocaleString()} ${poolConfig.tokenASymbol} / ${liquidityAmountB.toLocaleString()} ${poolConfig.tokenBSymbol}`);
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Test Phase 1A - Position tracking');
    console.log('   2. Test Phase 1B - Fee viewing and claiming');
    console.log('   3. Create additional test positions');
    console.log('   4. Perform test swaps to generate fees');
    
    console.log('\n🎯 Ready for Phase 1A/1B testing!');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
