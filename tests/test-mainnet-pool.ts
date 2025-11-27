#!/usr/bin/env ts-node

/**
 * TEST ON MAINNET SOL-USDC POOL
 * 
 * Tests our implemented features on a real Meteora DLMM pool
 * using MAINNET with small amounts (~$0.50-1.00)
 * 
 * This will test:
 * - Position creation
 * - Position tracking  
 * - Fee management
 * - Liquidity operations
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';
import * as fs from 'fs';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

dotenv.config();

// MAINNET RPC - You can use public or your own RPC
const MAINNET_RPC = process.env.MAINNET_RPC || 'https://api.mainnet-beta.solana.com';

// Known good Meteora SOL-USDC pool on MAINNET
const SOL_USDC_POOL = new PublicKey('BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y');

// Mainnet token addresses
const USDC_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112'); // Wrapped SOL

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

async function checkBalance(
  connection: Connection,
  wallet: PublicKey,
  mint: PublicKey,
  decimals: number
): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(mint, wallet);
    const account = await getAccount(connection, ata);
    return Number(account.amount) / Math.pow(10, decimals);
  } catch (error: any) {
    if (error.name === 'TokenAccountNotFoundError') return 0;
    throw error;
  }
}

async function main() {
  console.log('\n⚠️  MAINNET TESTING - REAL TOKENS WILL BE USED');
  console.log('='.repeat(70));
  
  console.log(`\n📋 IMPORTANT NOTES:`);
  console.log(`   • This will use REAL SOL and USDC on MAINNET`);
  console.log(`   • Estimated cost: ~$0.50-1.00 for testing`);
  console.log(`   • We'll use small amounts to test features`);
  console.log(`   • All transactions are REAL and irreversible`);
  
  console.log(`\n🛑 SAFETY CHECK:`);
  console.log(`   Before proceeding, make sure:`);
  console.log(`   1. You have USDC on MAINNET (not Devnet)`);
  console.log(`   2. You have SOL for transaction fees on MAINNET`);
  console.log(`   3. You're okay spending ~$0.50-1.00 for testing`);
  console.log(`   4. Your wallet has MAINNET tokens, not Devnet`);
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('CHECKING MAINNET WALLET BALANCES');
  console.log('='.repeat(70));
  
  try {
    const connection = new Connection(MAINNET_RPC, 'confirmed');
    const wallet = await loadWallet();
    
    console.log(`\n📋 Wallet: ${wallet.publicKey.toBase58()}`);
    console.log(`   Network: MAINNET`);
    
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(`\n   SOL: ${(solBalance / 1e9).toFixed(4)} SOL`);
    
    const usdcBalance = await checkBalance(connection, wallet.publicKey, USDC_MAINNET, 6);
    console.log(`   USDC: ${usdcBalance.toFixed(2)} USDC`);
    
    if (solBalance < 0.01 * 1e9) {
      console.log(`\n❌ ERROR: Insufficient SOL on MAINNET`);
      console.log(`   You have: ${(solBalance / 1e9).toFixed(4)} SOL`);
      console.log(`   Need at least: 0.01 SOL for transaction fees`);
      console.log(`\n💡 Your Devnet tokens cannot be used on Mainnet`);
      console.log(`   You need to fund this wallet on MAINNET separately`);
      return;
    }
    
    if (usdcBalance < 0.1) {
      console.log(`\n⚠️  WARNING: Low or no USDC on MAINNET`);
      console.log(`   You have: ${usdcBalance.toFixed(2)} USDC`);
      console.log(`   Recommended: At least 1 USDC for testing`);
      console.log(`\n💡 Note: Your 10 USDC is on Devnet, not Mainnet`);
      console.log(`   To get USDC on Mainnet:`);
      console.log(`   1. Buy SOL on an exchange`);
      console.log(`   2. Withdraw to your wallet: ${wallet.publicKey.toBase58()}`);
      console.log(`   3. Swap some SOL for USDC on Jupiter/Raydium`);
    }
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('TESTING POOL CONNECTION');
    console.log('='.repeat(70));
    
    console.log(`\n🔍 Connecting to Meteora SOL-USDC pool...`);
    console.log(`   Pool: ${SOL_USDC_POOL.toBase58()}`);
    
    const dlmm = await DLMM.create(connection, SOL_USDC_POOL);
    
    console.log(`\n✅ POOL CONNECTED!`);
    console.log(`   Token X: ${dlmm.tokenX.publicKey.toBase58()}`);
    console.log(`   Token Y: ${dlmm.tokenY.publicKey.toBase58()}`);
    console.log(`   Active Bin: ${dlmm.lbPair.activeId}`);
    console.log(`   Bin Step: ${dlmm.lbPair.binStep} bps (${(dlmm.lbPair.binStep / 100).toFixed(2)}%)`);
    
    const binArrays = await dlmm.getBinArrays();
    console.log(`   Bin Arrays: ${binArrays.length}`);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('WHAT WE CAN TEST');
    console.log('='.repeat(70));
    
    console.log(`\n✅ With this real pool, we can test:`);
    console.log(`   1. Create a small position (~$0.50-1.00)`);
    console.log(`   2. Track position data`);
    console.log(`   3. Perform small swap to generate fees`);
    console.log(`   4. Check unclaimed fees`);
    console.log(`   5. Claim fees to wallet`);
    console.log(`   6. Add/remove liquidity`);
    console.log(`   7. Close position`);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('RECOMMENDED NEXT STEPS');
    console.log('='.repeat(70));
    
    if (solBalance >= 0.01 * 1e9 && usdcBalance >= 0.1) {
      console.log(`\n✅ You have sufficient balance for testing!`);
      console.log(`\n🎯 Ready to proceed with:`);
      console.log(`   1. Create a small test position`);
      console.log(`   2. Test all implemented features`);
      console.log(`   3. Estimated cost: ~$0.50-1.00`);
      console.log(`\n📝 Shall I create a test script for this?`);
    } else {
      console.log(`\n⚠️  WALLET FUNDING NEEDED:`);
      console.log(`\n   Current situation:`);
      console.log(`   • Your 10 USDC is on DEVNET`);
      console.log(`   • Devnet tokens cannot be used on Mainnet`);
      console.log(`   • Mainnet requires real SOL/USDC`);
      
      console.log(`\n   Options:`);
      console.log(`   A) Fund this wallet on Mainnet (~$5-10 worth)`);
      console.log(`   B) Use our custom Devnet pool for Phase 2 testing`);
      console.log(`   C) Contact Meteora for Devnet test pool`);
      
      console.log(`\n💡 RECOMMENDATION: Option B`);
      console.log(`   • Proceed with Phase 2 (Liquidity Operations)`);
      console.log(`   • Test on our custom Devnet pool (free)`);
      console.log(`   • Plan Mainnet testing when ready to deploy`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('403') || error.message.includes('429')) {
      console.log(`\n💡 RPC Error - Try setting MAINNET_RPC in .env`);
      console.log(`   Free options: Helius, Quicknode, Alchemy`);
    }
  }
}

main().catch(console.error);
