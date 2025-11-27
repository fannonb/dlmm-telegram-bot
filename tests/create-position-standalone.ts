#!/usr/bin/env ts-node

/**
 * Standalone script to create a Devnet position
 * No dependencies on CLI or other app modules
 */

import { Connection, PublicKey, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

// Load environment variables
dotenv.config();

const DEVNET_RPC = 'https://api.devnet.solana.com';
const DEVNET_POOL = '3W2HKgUa96Z69zzG3LK1g8KdcRAWzAttiLiHfYnKuPw5';

async function main() {
  console.log('\n🚀 CREATING DEVNET TEST POSITION');
  console.log('='.repeat(60));

  try {
    // 1. Connect to Devnet
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    console.log('✅ Connected to Devnet');

    // 2. Load config and get active wallet
    const configPath = path.join(__dirname, '..', 'data', 'config.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    const activeWallet = config.wallets.find((w: any) => w.isActive);
    
    if (!activeWallet) {
      throw new Error('No active wallet found');
    }

    console.log(`✅ Active Wallet: ${activeWallet.name} (${activeWallet.publicKey.slice(0, 8)}...)`);

    // 3. Check balance
    const userPubkey = new PublicKey(activeWallet.publicKey);
    const balance = await connection.getBalance(userPubkey);
    const balanceSOL = balance / 1e9;
    console.log(`💰 Balance: ${balanceSOL.toFixed(4)} SOL`);

    if (balanceSOL < 0.1) {
      throw new Error('Insufficient balance. Need at least 0.1 SOL');
    }

    // 4. Initialize DLMM pool
    console.log('\n📊 Initializing DLMM Pool...');
    const dlmmPool = await DLMM.create(connection, new PublicKey(DEVNET_POOL));
    
    console.log(`   Pool: ${DEVNET_POOL}`);
    console.log(`   Token X: ${dlmmPool.tokenX.publicKey.toBase58()}`);
    console.log(`   Token Y: ${dlmmPool.tokenY.publicKey.toBase58()}`);

    // 5. Get active bin
    const activeBin = await dlmmPool.getActiveBin();
    console.log(`\n🎯 Active Bin: ${activeBin.binId} (Price: ${activeBin.price})`);

    // 6. Calculate position range (±5 bins)
    const RANGE = 5;
    const minBinId = activeBin.binId - RANGE;
    const maxBinId = activeBin.binId + RANGE;
    console.log(`📐 Range: ${minBinId} to ${maxBinId}`);

    // 7. Prepare liquidity (0.01 of each token)
    const tokenXDecimals = dlmmPool.tokenX.mint?.decimals || 9;
    const tokenYDecimals = dlmmPool.tokenY.mint?.decimals || 9;
    const totalXAmount = new BN(Math.floor(0.01 * 10 ** tokenXDecimals));
    const totalYAmount = new BN(Math.floor(0.01 * 10 ** tokenYDecimals));

    console.log(`\n💧 Liquidity: ${0.01} tokenX, ${0.01} tokenY`);

    // 8. Create position keypair
    const newPosition = Keypair.generate();
    console.log(`\n🔑 Position: ${newPosition.publicKey.toBase58()}`);

    // 9. Decrypt wallet using ENCRYPTION_KEY
    console.log('\n🔐 Decrypting wallet...');
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not found in .env');
    }
    
    const decryptedKey = CryptoJS.AES.decrypt(
      activeWallet.encryptedPrivateKey,
      encryptionKey
    ).toString(CryptoJS.enc.Utf8);
    
    if (!decryptedKey) {
      throw new Error('Failed to decrypt wallet');
    }
    
    // Private key is stored as base58
    const secretKey = bs58.decode(decryptedKey);
    const walletKeypair = Keypair.fromSecretKey(secretKey);
    console.log('✅ Wallet unlocked');

    // 10. Create position transaction
    console.log('\n⚙️  Creating position...');
    
    const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: newPosition.publicKey,
      user: userPubkey,
      totalXAmount,
      totalYAmount,
      strategy: {
        maxBinId,
        minBinId,
        strategyType: 0, // Spot distribution
      },
    });

    // 11. Sign and send
    createPositionTx.partialSign(newPosition, walletKeypair);
    
    console.log('📤 Sending transaction...');
    const txHash = await sendAndConfirmTransaction(
      connection,
      createPositionTx,
      [walletKeypair, newPosition],
      { commitment: 'confirmed' }
    );

    console.log('\n✅ POSITION CREATED!');
    console.log('='.repeat(60));
    console.log(`Position: ${newPosition.publicKey.toBase58()}`);
    console.log(`Pool: ${DEVNET_POOL}`);
    console.log(`TX: https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
    console.log('='.repeat(60));

    // 12. Save to config
    console.log('\n💾 Saving to config...');
    
    const newPositionData = {
      address: newPosition.publicKey.toBase58(),
      poolAddress: DEVNET_POOL,
      name: `Devnet Test - ${new Date().toISOString().split('T')[0]}`,
      createdAt: new Date().toISOString(),
      network: 'devnet',
    };

    config.positions.push(newPositionData);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('✅ Saved to config.json');

    console.log('\n🎉 READY FOR TESTING!');
    console.log('\nNext steps:');
    console.log('1. npm run test:phase1a');
    console.log('2. npm run cli:interactive');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
