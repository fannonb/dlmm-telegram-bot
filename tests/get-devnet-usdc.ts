#!/usr/bin/env ts-node

/**
 * GET DEVNET USDC AND TEST SWAPS
 * 
 * This script helps:
 * 1. Display wallet address for Circle faucet
 * 2. Check USDC balance
 * 3. Find USDC pools on Meteora Devnet
 * 4. Test swaps with real USDC
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

const DEVNET_RPC = 'https://api.devnet.solana.com';
const USDC_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // Circle USDC Devnet

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

async function checkUSDCBalance(connection: Connection, wallet: Keypair): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(
      USDC_DEVNET,
      wallet.publicKey
    );
    
    const account = await getAccount(connection, ata);
    const balance = Number(account.amount) / 1e6; // USDC has 6 decimals
    return balance;
  } catch (error: any) {
    if (error.name === 'TokenAccountNotFoundError') {
      return 0;
    }
    throw error;
  }
}

async function main() {
  console.log('\n🎁 GET DEVNET USDC FOR TESTING');
  console.log('='.repeat(70));
  
  try {
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    const wallet = await loadWallet();
    
    // Display wallet info
    console.log(`\n📋 Wallet Information:`);
    console.log(`   Address: ${wallet.publicKey.toBase58()}`);
    
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(`   SOL Balance: ${(solBalance / 1e9).toFixed(4)} SOL`);
    
    // Check USDC balance
    const usdcBalance = await checkUSDCBalance(connection, wallet);
    console.log(`   USDC Balance: ${usdcBalance.toFixed(2)} USDC`);
    
    // Instructions
    console.log(`\n${'='.repeat(70)}`);
    console.log('STEP 1: GET DEVNET USDC FROM CIRCLE FAUCET');
    console.log('='.repeat(70));
    
    console.log(`\n📍 Visit: https://faucet.circle.com/`);
    console.log(`\n✅ Steps:`);
    console.log(`   1. Go to https://faucet.circle.com/`);
    console.log(`   2. Select "Solana Devnet"`);
    console.log(`   3. Paste your wallet address:`);
    console.log(`      ${wallet.publicKey.toBase58()}`);
    console.log(`   4. Click "Get USDC"`);
    console.log(`   5. You'll receive 10 USDC (test tokens)`);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('STEP 2: VERIFY USDC RECEIVED');
    console.log('='.repeat(70));
    
    console.log(`\n💡 Run this script again to check your USDC balance:`);
    console.log(`   npm run test:usdc`);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('STEP 3: FIND USDC POOLS ON METEORA');
    console.log('='.repeat(70));
    
    console.log(`\n📍 Meteora DLMM pools with USDC on Devnet:`);
    console.log(`\n   Common pairs:`);
    console.log(`   • SOL/USDC - Most liquid`);
    console.log(`   • USDT/USDC - Stablecoin pair`);
    
    console.log(`\n💡 To find pools:`);
    console.log(`   1. Visit: https://app.meteora.ag/pools/dlmm`);
    console.log(`   2. Switch to Devnet (if available in UI)`);
    console.log(`   3. Search for USDC pairs`);
    console.log(`   4. Copy the pool address`);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('STEP 4: TEST SWAP WITH REAL USDC');
    console.log('='.repeat(70));
    
    console.log(`\n💱 Once you have USDC:`);
    console.log(`   • We'll modify test-swap script to use real USDC pool`);
    console.log(`   • Perform small swap (e.g., 1 USDC)`);
    console.log(`   • Generate real fees`);
    console.log(`   • Test fee claiming functionality`);
    
    if (usdcBalance > 0) {
      console.log(`\n✅ YOU HAVE USDC! Ready to test swaps!`);
      console.log(`   Current USDC: ${usdcBalance.toFixed(2)} USDC`);
    } else {
      console.log(`\n⏳ Waiting for USDC...`);
      console.log(`   Get USDC from: https://faucet.circle.com/`);
    }
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('USEFUL RESOURCES');
    console.log('='.repeat(70));
    
    console.log(`\n🔗 Links:`);
    console.log(`   • Circle Faucet: https://faucet.circle.com/`);
    console.log(`   • Meteora App: https://app.meteora.ag/`);
    console.log(`   • Solana Explorer (Devnet): https://explorer.solana.com/?cluster=devnet`);
    console.log(`   • Your Wallet: https://explorer.solana.com/address/${wallet.publicKey.toBase58()}?cluster=devnet`);
    
    console.log(`\n📝 USDC Token Info (Devnet):`);
    console.log(`   Address: ${USDC_DEVNET.toBase58()}`);
    console.log(`   Decimals: 6`);
    console.log(`   Issuer: Circle`);
    
    console.log(`\n🎯 Next Steps:`);
    console.log(`   1. Get USDC from faucet (if balance is 0)`);
    console.log(`   2. Find a USDC/SOL pool on Meteora Devnet`);
    console.log(`   3. Update swap test script with pool address`);
    console.log(`   4. Test swap → generate fees → claim fees!`);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
