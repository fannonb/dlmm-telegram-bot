/**
 * Check Wallet Token Balances
 * Checks SOL and all token balances for the current wallet
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Devnet Configuration
const RPC_URL = 'https://api.devnet.solana.com';

// TEST tokens
const TEST_A = '81aJQM7SCZLW2HN72AGmNULJtqeHDdTWXfHBQPWxUiwZ'; // 9 decimals
const TEST_B = '7ZfVVe2HL6FhVWBU7u6Ja8DUpABhPe7BXKZLXJ1EbSBr'; // 6 decimals

async function checkBalances() {
  try {
    console.log('=== Wallet Token Balances ===\n');

    // Setup connection and wallet
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Load wallet
    const walletPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'solana', 'id.json');
    const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    
    console.log(`Wallet: ${wallet.publicKey.toBase58()}\n`);
    
    // Check SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey) / 1e9;
    console.log(`SOL: ${solBalance.toFixed(4)}`);
    
    // Check TEST-A balance
    try {
      const testAMint = new PublicKey(TEST_A);
      const testAAta = await getAssociatedTokenAddress(testAMint, wallet.publicKey);
      const testAAccount = await getAccount(connection, testAAta);
      const testABalance = Number(testAAccount.amount) / 1e9; // 9 decimals
      console.log(`TEST-A: ${testABalance.toLocaleString()}`);
      console.log(`  Token Account: ${testAAta.toBase58()}`);
    } catch (error) {
      console.log(`TEST-A: 0 (No token account)`);
    }
    
    // Check TEST-B balance
    try {
      const testBMint = new PublicKey(TEST_B);
      const testBAta = await getAssociatedTokenAddress(testBMint, wallet.publicKey);
      const testBAccount = await getAccount(connection, testBAta);
      const testBBalance = Number(testBAccount.amount) / 1e6; // 6 decimals
      console.log(`TEST-B: ${testBBalance.toLocaleString()}`);
      console.log(`  Token Account: ${testBAta.toBase58()}`);
    } catch (error) {
      console.log(`TEST-B: 0 (No token account)`);
    }

  } catch (error) {
    console.error('\n❌ Error checking balances:');
    console.error(error);
  }
}

checkBalances();
