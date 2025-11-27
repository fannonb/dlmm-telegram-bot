#!/usr/bin/env ts-node

/**
 * TEST SWAP TO GENERATE FEES
 * 
 * This script performs a test swap in the test pool to generate fees
 * for the liquidity provider. This will allow testing the fee claiming
 * functionality in Phase 1B.
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

async function performSwap(
  connection: Connection,
  wallet: Keypair,
  poolAddress: PublicKey,
  swapAmount: number,
  swapYtoX: boolean,
  decimals: number
) {
  console.log(`\n💱 Performing Swap:`);
  console.log(`   Direction: ${swapYtoX ? 'Token B → Token A' : 'Token A → Token B'}`);
  console.log(`   Amount: ${swapAmount} tokens`);
  
  try {
    // Create DLMM instance
    const dlmm = await DLMM.create(connection, poolAddress, {
      cluster: 'devnet'
    });
    
    // Convert amount to proper units
    const inAmount = new BN(swapAmount).mul(new BN(10).pow(new BN(decimals)));
    
    // Get bin arrays for swap
    console.log(`\n📊 Getting bin arrays...`);
    const binArrays = await dlmm.getBinArrays();
    
    console.log(`   Found ${binArrays.length} total bin arrays`);
    
    // Get swap quote
    console.log(`   Getting swap quote...`);
    const swapQuote = dlmm.swapQuote(
      inAmount,
      swapYtoX,
      new BN(10), // 10% slippage tolerance (for test pool)
      binArrays
    );
    
    console.log(`✅ Quote Received:`);
    console.log(`   Bin Arrays for Swap: ${swapQuote.binArraysPubkey.length}`);
    console.log(`   Output (estimated): ${swapQuote.outAmount.toString()}`);
    console.log(`   Min Output (with slippage): ${swapQuote.minOutAmount.toString()}`);
    console.log(`   Fee: ${swapQuote.fee.toString()}`);
    console.log(`   Price Impact: ${swapQuote.priceImpact.toFixed(4)}%`);
    
    // Get all bin array pubkeys from the bin arrays we fetched
    const allBinArrayPubkeys = binArrays.map(ba => ba.publicKey);
    console.log(`\n   Available Bin Arrays: ${allBinArrayPubkeys.length}`);
    console.log(`   Using ${allBinArrayPubkeys.length} bin arrays for swap instruction`);
    
    // Execute swap
    console.log(`\n🔄 Executing swap...`);
    const swapTx = await dlmm.swap({
      inToken: swapYtoX ? dlmm.tokenY.publicKey : dlmm.tokenX.publicKey,
      binArraysPubkey: allBinArrayPubkeys, // Use ALL bin arrays instead of just quote bin arrays
      inAmount,
      lbPair: dlmm.pubkey,
      user: wallet.publicKey,
      minOutAmount: swapQuote.minOutAmount,
      outToken: swapYtoX ? dlmm.tokenX.publicKey : dlmm.tokenY.publicKey,
    });
    
    // Sign and send using sendAndConfirmTransaction
    try {
      const signature = await sendAndConfirmTransaction(
        connection,
        swapTx,
        [wallet],
        {
          skipPreflight: false,
          commitment: 'confirmed',
        }
      );
      
      console.log(`\n✅ SWAP SUCCESSFUL!`);
      console.log(`   Transaction: ${signature}`);
      console.log(`   Fee Generated: ${swapQuote.fee.toString()} tokens`);
      console.log(`   💰 This fee is now claimable by the LP!`);
      
      return {
        signature,
        fee: swapQuote.fee,
        inAmount,
        outAmount: swapQuote.outAmount,
      };
    } catch (swapError: any) {
      console.error(`\n❌ Swap transaction failed:`);
      console.error(`   Error: ${swapError.message}`);
      if (swapError.logs) {
        console.error(`   Logs:`, swapError.logs);
      }
      throw swapError;
    }
    
  } catch (error: any) {
    console.error(`\n❌ Swap failed: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('\n💱 TEST SWAP TO GENERATE FEES');
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
    
    // Perform swap: Token A -> Token B
    console.log(`\n${'='.repeat(70)}`);
    console.log('SWAP 1: Token A → Token B');
    console.log('='.repeat(70));
    
    const swap1 = await performSwap(
      connection,
      wallet,
      poolAddress,
      100000, // 100K tokens (smaller amount to stay within bin range)
      false, // Swap X to Y
      poolConfig.tokenADecimals
    );
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Perform reverse swap: Token B -> Token A
    console.log(`\n${'='.repeat(70)}`);
    console.log('SWAP 2: Token B → Token A (Reverse)');
    console.log('='.repeat(70));
    
    const swap2 = await performSwap(
      connection,
      wallet,
      poolAddress,
      50000, // 50K tokens (smaller amount)
      true, // Swap Y to X
      poolConfig.tokenBDecimals
    );
    
    // Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ SWAPS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Swaps: 2`);
    console.log(`   Swap 1 Fee: ${swap1.fee.toString()}`);
    console.log(`   Swap 2 Fee: ${swap2.fee.toString()}`);
    console.log(`   Total Fees Generated: ${swap1.fee.add(swap2.fee).toString()}`);
    
    console.log(`\n💡 Next Steps:`);
    console.log(`   1. Run the Phase 1B test again to verify fee tracking`);
    console.log(`   2. Test fee claiming with feeService.claimFees()`);
    console.log(`   3. Verify fees are transferred to your wallet`);
    
    console.log(`\n🎯 Pool now has fees ready to be claimed!`);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
