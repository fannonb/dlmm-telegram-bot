#!/usr/bin/env ts-node

/**
 * INITIALIZE MORE BIN ARRAYS
 * 
 * This script adds liquidity to additional bins to initialize more bin arrays.
 * This is necessary for swaps to work properly, as the swap2 instruction
 * requires a minimum number of bin array accounts.
 * 
 * Strategy: Add smaller liquidity positions across a wider range to initialize
 * multiple bin arrays without using too many tokens.
 */

import { Connection, PublicKey, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
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

async function addLiquidityToBinRange(
  connection: Connection,
  wallet: Keypair,
  poolAddress: PublicKey,
  minBin: number,
  maxBin: number,
  amountX: number,
  amountY: number,
  decimalsX: number,
  decimalsY: number,
  rangeName: string
): Promise<PublicKey> {
  console.log(`\n📍 Adding liquidity to ${rangeName}:`);
  console.log(`   Bin Range: ${minBin} to ${maxBin}`);
  console.log(`   Amount X: ${amountX}`);
  console.log(`   Amount Y: ${amountY}`);
  
  try {
    // Create DLMM instance
    const dlmmPool = await DLMM.create(connection, poolAddress, {
      cluster: 'devnet'
    });
    
    // Create new position keypair
    const positionKeypair = Keypair.generate();
    console.log(`   Position: ${positionKeypair.publicKey.toBase58()}`);
    
    // Convert amounts to proper units
    const totalXAmount = new BN(amountX).mul(new BN(10).pow(new BN(decimalsX)));
    const totalYAmount = new BN(amountY).mul(new BN(10).pow(new BN(decimalsY)));
    
    // Add liquidity with Spot strategy
    const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: positionKeypair.publicKey,
      user: wallet.publicKey,
      totalXAmount,
      totalYAmount,
      strategy: {
        minBinId: minBin,
        maxBinId: maxBin,
        strategyType: 1, // Spot strategy
      },
    });
    
    // Send transaction
    const txHash = await sendAndConfirmTransaction(
      connection,
      createPositionTx,
      [wallet, positionKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log(`   ✅ Transaction: ${txHash}`);
    console.log(`   ✅ Position created successfully!`);
    
    return positionKeypair.publicKey;
    
  } catch (error: any) {
    console.error(`   ❌ Failed: ${error.message}`);
    throw error;
  }
}

async function checkBinArrays(connection: Connection, poolAddress: PublicKey) {
  console.log(`\n📊 Checking bin arrays...`);
  
  const dlmmPool = await DLMM.create(connection, poolAddress, {
    cluster: 'devnet'
  });
  
  const binArrays = await dlmmPool.getBinArrays();
  console.log(`   Total bin arrays: ${binArrays.length}`);
  
  binArrays.forEach((ba, index) => {
    console.log(`   ${index + 1}. Index: ${ba.account.index}, Pubkey: ${ba.publicKey.toBase58()}`);
  });
  
  return binArrays.length;
}

async function main() {
  console.log('\n🔧 INITIALIZE MORE BIN ARRAYS');
  console.log('='.repeat(70));
  
  try {
    // Setup
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    const wallet = await loadWallet();
    const poolConfig = await loadPoolConfig();
    
    console.log(`\n📋 Setup:`);
    console.log(`   Wallet: ${wallet.publicKey.toBase58()}`);
    console.log(`   Pool: ${poolConfig.poolAddress}`);
    console.log(`   Token A: ${poolConfig.tokenASymbol} (${poolConfig.tokenADecimals} decimals)`);
    console.log(`   Token B: ${poolConfig.tokenBSymbol} (${poolConfig.tokenBDecimals} decimals)`);
    
    const poolAddress = new PublicKey(poolConfig.poolAddress);
    
    // Get current balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`   SOL Balance: ${(balance / 1e9).toFixed(4)} SOL`);
    
    // Check current bin arrays
    const initialBinArrays = await checkBinArrays(connection, poolAddress);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('STRATEGY: Add liquidity to initialize more bin arrays');
    console.log('='.repeat(70));
    console.log(`\nBin arrays are initialized when liquidity is added to new bin ranges.`);
    console.log(`Each bin array covers a range of bins.`);
    console.log(`We'll add small liquidity positions across multiple ranges.`);
    
    // Bin array covers 70 bins in DLMM
    // Our existing position: bins -10 to +10 (in bin array index 0)
    // We need to add positions in different bin array ranges
    
    const positions: PublicKey[] = [];
    
    // Position 2: Bins -80 to -50 (should be in bin array index -1)
    console.log(`\n${'='.repeat(70)}`);
    console.log('POSITION 2: Lower Range (Bin Array -1)');
    console.log('='.repeat(70));
    const pos2 = await addLiquidityToBinRange(
      connection,
      wallet,
      poolAddress,
      -80, -50,
      1000000, // 1M tokens
      1000000,
      poolConfig.tokenADecimals,
      poolConfig.tokenBDecimals,
      'Lower Range (-80 to -50)'
    );
    positions.push(pos2);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Position 3: Bins 50 to 80 (should be in bin array index 1)
    console.log(`\n${'='.repeat(70)}`);
    console.log('POSITION 3: Upper Range (Bin Array +1)');
    console.log('='.repeat(70));
    const pos3 = await addLiquidityToBinRange(
      connection,
      wallet,
      poolAddress,
      50, 80,
      1000000, // 1M tokens
      1000000,
      poolConfig.tokenADecimals,
      poolConfig.tokenBDecimals,
      'Upper Range (50 to 80)'
    );
    positions.push(pos3);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Position 4: Bins -150 to -120 (should be in bin array index -2)
    console.log(`\n${'='.repeat(70)}`);
    console.log('POSITION 4: Far Lower Range (Bin Array -2)');
    console.log('='.repeat(70));
    const pos4 = await addLiquidityToBinRange(
      connection,
      wallet,
      poolAddress,
      -150, -120,
      500000, // 500K tokens
      500000,
      poolConfig.tokenADecimals,
      poolConfig.tokenBDecimals,
      'Far Lower Range (-150 to -120)'
    );
    positions.push(pos4);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Position 5: Bins 120 to 150 (should be in bin array index 2)
    console.log(`\n${'='.repeat(70)}`);
    console.log('POSITION 5: Far Upper Range (Bin Array +2)');
    console.log('='.repeat(70));
    const pos5 = await addLiquidityToBinRange(
      connection,
      wallet,
      poolAddress,
      120, 150,
      500000, // 500K tokens
      500000,
      poolConfig.tokenADecimals,
      poolConfig.tokenBDecimals,
      'Far Upper Range (120 to 150)'
    );
    positions.push(pos5);
    
    // Check bin arrays again
    console.log(`\n${'='.repeat(70)}`);
    console.log('FINAL BIN ARRAY CHECK');
    console.log('='.repeat(70));
    const finalBinArrays = await checkBinArrays(connection, poolAddress);
    
    // Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ BIN ARRAY INITIALIZATION COMPLETE!');
    console.log('='.repeat(70));
    
    console.log(`\n📊 Summary:`);
    console.log(`   Initial Bin Arrays: ${initialBinArrays}`);
    console.log(`   Final Bin Arrays: ${finalBinArrays}`);
    console.log(`   New Bin Arrays Added: ${finalBinArrays - initialBinArrays}`);
    console.log(`   New Positions Created: ${positions.length}`);
    
    console.log(`\n📍 Position Addresses:`);
    positions.forEach((pos, index) => {
      console.log(`   ${index + 1}. ${pos.toBase58()}`);
    });
    
    console.log(`\n💡 Next Steps:`);
    console.log(`   1. Test swap functionality again`);
    console.log(`   2. Swaps should now work with multiple bin arrays`);
    console.log(`   3. Fees will be generated across all positions`);
    console.log(`   4. Test fee claiming from multiple positions`);
    
    console.log(`\n🎯 Pool now has sufficient bin arrays for swaps!`);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
