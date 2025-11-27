#!/usr/bin/env ts-node

/**
 * Use DLMM pool to swap SOL for pool tokens
 * This uses the pool's own swap functionality
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
  console.log('\n🔄 CHECKING POOL TOKENS & SWAP OPTIONS');
  console.log('='.repeat(60));

  try {
    // 1. Setup
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    console.log('✅ Connected to Devnet');

    // 2. Load wallet
    const configPath = path.join(__dirname, '..', 'data', 'config.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    const activeWallet = config.wallets.find((w: any) => w.isActive);
    
    if (!activeWallet) {
      throw new Error('No active wallet found');
    }

    console.log(`✅ Wallet: ${activeWallet.name}`);

    // 3. Decrypt wallet
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not found in .env');
    }
    
    const decryptedKey = CryptoJS.AES.decrypt(
      activeWallet.encryptedPrivateKey,
      encryptionKey
    ).toString(CryptoJS.enc.Utf8);
    
    const secretKey = bs58.decode(decryptedKey);
    const walletKeypair = Keypair.fromSecretKey(secretKey);
    const userPubkey = new PublicKey(activeWallet.publicKey);

    // 4. Initialize pool
    console.log('\n📊 Analyzing Pool...');
    const dlmmPool = await DLMM.create(connection, new PublicKey(DEVNET_POOL));
    
    console.log(`\nPool: ${DEVNET_POOL}`);
    console.log(`Token X: ${dlmmPool.tokenX.publicKey.toBase58()}`);
    console.log(`Token Y: ${dlmmPool.tokenY.publicKey.toBase58()}`);
    
    // Get token metadata if available
    const tokenXInfo = await connection.getParsedAccountInfo(dlmmPool.tokenX.publicKey);
    const tokenYInfo = await connection.getParsedAccountInfo(dlmmPool.tokenY.publicKey);
    
    console.log('\n📋 Token Details:');
    console.log('Token X:', tokenXInfo.value ? 'Found' : 'Not found');
    console.log('Token Y:', tokenYInfo.value ? 'Found' : 'Not found');

    // Check if tokens have faucet/airdrop
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('These appear to be test tokens specific to this Devnet pool.');
    console.log('\nOptions:');
    console.log('1. Check Meteora Discord/docs for test token faucets');
    console.log('2. Use a different Devnet pool with more common tokens');
    console.log('3. Request test tokens from Meteora team');
    console.log('4. Try swapping through the pool (if we had one token already)');
    
    // Try to perform a small swap as a test
    console.log('\n🧪 Attempting to perform swap...');
    console.log('Note: This will likely fail due to insufficient token balance\n');
    
    try {
      // Try swapping a tiny amount (1 lamport) to see what happens
      const swapAmount = new BN(1000000); // 0.001 SOL worth
      
      const swapTx = await dlmmPool.swap({
        inToken: dlmmPool.tokenX.publicKey,
        binArraysPubkey: [], // Will be auto-fetched
        inAmount: swapAmount,
        lbPair: new PublicKey(DEVNET_POOL),
        user: userPubkey,
        minOutAmount: new BN(0),
        swapForY: true,
      });

      console.log('Transaction created (simulation only)');
      console.log('This suggests the pool is functional for swaps');
      
    } catch (swapError: any) {
      console.log('❌ Swap attempt failed (expected):', swapError.message.split('\n')[0]);
    }

    console.log('\n📝 NEXT STEPS:');
    console.log('1. Search for "meteora devnet test tokens" or "meteora faucet"');
    console.log('2. Check: https://discord.gg/meteora');
    console.log('3. Or use Meteora UI on Devnet to create a different pool');
    console.log('4. Alternative: Skip Devnet, test directly on mainnet with small amounts');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
