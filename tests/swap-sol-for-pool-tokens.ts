#!/usr/bin/env ts-node

/**
 * Swap SOL for pool tokens using Jupiter aggregator
 * This prepares the wallet for creating a position in the Devnet pool
 */

import { Connection, PublicKey, Keypair, VersionedTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';
import fetch from 'cross-fetch';

// Load environment variables
dotenv.config();

const DEVNET_RPC = 'https://api.devnet.solana.com';
const POOL_TOKEN_X = '3odhfo8SMsS6e5mHXLLBcCqYptmMKfpVsdTLxs2oh58v';
const POOL_TOKEN_Y = 'AxVHFc6ighQCmm2xDhQx2FAWkM9xZxDw212mcP5mY2d4';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const SWAP_AMOUNT_SOL = 0.1; // Swap 0.1 SOL for each token

async function main() {
  console.log('\n🔄 SWAPPING SOL FOR POOL TOKENS');
  console.log('='.repeat(60));

  try {
    // 1. Setup connection
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

    console.log(`✅ Wallet: ${activeWallet.name} (${activeWallet.publicKey.slice(0, 8)}...)`);

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

    // 4. Check balance
    const balance = await connection.getBalance(new PublicKey(activeWallet.publicKey));
    const balanceSOL = balance / 1e9;
    console.log(`💰 Current Balance: ${balanceSOL.toFixed(4)} SOL\n`);

    if (balanceSOL < 0.3) {
      throw new Error('Insufficient balance. Need at least 0.3 SOL for swaps + fees');
    }

    // 5. Swap for Token X
    console.log(`\n📊 SWAP 1: SOL → Token X`);
    console.log(`   Token X: ${POOL_TOKEN_X}`);
    console.log(`   Amount: ${SWAP_AMOUNT_SOL} SOL`);
    
    await performSwap(
      connection,
      walletKeypair,
      WSOL_MINT,
      POOL_TOKEN_X,
      SWAP_AMOUNT_SOL * 1e9 // Convert to lamports
    );

    console.log('✅ Swap 1 completed!\n');

    // Wait a bit before next swap
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 6. Swap for Token Y
    console.log(`\n📊 SWAP 2: SOL → Token Y`);
    console.log(`   Token Y: ${POOL_TOKEN_Y}`);
    console.log(`   Amount: ${SWAP_AMOUNT_SOL} SOL`);
    
    await performSwap(
      connection,
      walletKeypair,
      WSOL_MINT,
      POOL_TOKEN_Y,
      SWAP_AMOUNT_SOL * 1e9
    );

    console.log('✅ Swap 2 completed!\n');

    // 7. Final balance check
    const finalBalance = await connection.getBalance(new PublicKey(activeWallet.publicKey));
    const finalBalanceSOL = finalBalance / 1e9;
    
    console.log('\n🎉 SWAPS COMPLETED!');
    console.log('='.repeat(60));
    console.log(`Final SOL Balance: ${finalBalanceSOL.toFixed(4)} SOL`);
    console.log(`Used: ${(balanceSOL - finalBalanceSOL).toFixed(4)} SOL\n`);
    
    console.log('Next step: Run position creation script');
    console.log('  npx ts-node tests/create-position-standalone.ts');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

async function performSwap(
  connection: Connection,
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amount: number
): Promise<void> {
  try {
    console.log('\n   🔍 Getting quote from Jupiter...');
    
    // Get quote from Jupiter (Devnet endpoint)
    // Note: Jupiter may not have full Devnet support, we'll use Raydium or direct pool swap if needed
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
    
    console.log('   ⚠️  Note: Jupiter may not support Devnet for these test tokens');
    console.log('   Attempting to get quote...');
    
    const quoteResponse = await fetch(quoteUrl);
    
    if (!quoteResponse.ok) {
      throw new Error(`Jupiter quote failed: ${quoteResponse.statusText}`);
    }
    
    const quoteData = await quoteResponse.json();
    
    console.log(`   💱 Quote received: ${quoteData.outAmount} output tokens`);
    console.log('   📝 Creating swap transaction...');
    
    // Get swap transaction
    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      })
    });
    
    if (!swapResponse.ok) {
      throw new Error(`Swap transaction creation failed: ${swapResponse.statusText}`);
    }
    
    const swapData = await swapResponse.json();
    
    // Deserialize and sign transaction
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    
    transaction.sign([wallet]);
    
    console.log('   📤 Sending transaction...');
    
    const rawTransaction = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    
    console.log(`   ⏳ Confirming: ${txid.slice(0, 8)}...`);
    
    await connection.confirmTransaction(txid, 'confirmed');
    
    console.log(`   ✅ Success! TX: https://explorer.solana.com/tx/${txid}?cluster=devnet`);
    
  } catch (error: any) {
    if (error.message?.includes('Jupiter')) {
      console.log('\n   ⚠️  Jupiter may not support these Devnet test tokens');
      console.log('   Alternative: Use DLMM pool directly for swap');
      console.log('   Or: Check if tokens have Devnet faucets\n');
    }
    throw error;
  }
}

main();
