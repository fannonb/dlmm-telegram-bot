/**
 * Get Devnet SOL Airdrop
 * Requests SOL from the Solana Devnet faucet
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Devnet Configuration
const RPC_URL = 'https://api.devnet.solana.com';

async function requestAirdrop() {
  try {
    console.log('=== Requesting Devnet SOL Airdrop ===\n');

    // Setup connection
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Load wallet
    const walletPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'solana', 'id.json');
    const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    
    console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
    
    // Check current balance
    const balanceBefore = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
    console.log(`Current Balance: ${balanceBefore.toFixed(4)} SOL\n`);
    
    // Request 2 SOL airdrop
    console.log('Requesting 2 SOL from Devnet faucet...');
    const signature = await connection.requestAirdrop(
      wallet.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    
    console.log(`Transaction: ${signature}`);
    console.log('Waiting for confirmation...');
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('✅ Airdrop confirmed!');
    
    // Check new balance
    const balanceAfter = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
    console.log(`\nNew Balance: ${balanceAfter.toFixed(4)} SOL`);
    console.log(`Received: ${(balanceAfter - balanceBefore).toFixed(4)} SOL`);

  } catch (error) {
    console.error('\n❌ Error requesting airdrop:');
    console.error(error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    console.log('\nNote: Devnet faucet rate limits to 2 SOL per request.');
    console.log('If you get an error, wait a few minutes and try again.');
  }
}

requestAirdrop();
