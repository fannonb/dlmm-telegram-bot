#!/usr/bin/env ts-node

/**
 * CREATE CUSTOM TEST POOL
 * 
 * This script creates a complete testing infrastructure:
 * 1. Creates 2 custom SPL tokens (TEST-A and TEST-B)
 * 2. Mints initial supply to our wallet
 * 3. Creates a DLMM pool with these tokens
 * 4. Adds initial liquidity to the pool
 * 5. Saves pool info to config for future testing
 * 
 * After running this, we'll have:
 * - Full control over token supply (can mint more anytime)
 * - A working DLMM pool for testing
 * - No dependency on external faucets
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  sendAndConfirmTransaction,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo, 
  TOKEN_PROGRAM_ID,
  getMint
} from '@solana/spl-token';
import DLMM, { deriveCustomizablePermissionlessLbPair, LBCLMM_PROGRAM_IDS } from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

const DEVNET_RPC = 'https://api.devnet.solana.com';

interface TestPoolInfo {
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

async function saveTestPoolInfo(poolInfo: TestPoolInfo) {
  const configPath = path.join(__dirname, '..', 'data', 'test-pool-config.json');
  fs.writeFileSync(configPath, JSON.stringify(poolInfo, null, 2));
  console.log(`\n✅ Pool configuration saved to: ${configPath}`);
}

async function createTestToken(
  connection: Connection,
  payer: Keypair,
  decimals: number,
  name: string
): Promise<PublicKey> {
  console.log(`\n🪙 Creating ${name} token...`);
  
  const mintKeypair = Keypair.generate();
  
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority
    payer.publicKey, // freeze authority
    decimals,
    mintKeypair,
    { commitment: 'confirmed' },
    TOKEN_PROGRAM_ID
  );
  
  console.log(`   ✅ ${name} Mint: ${mint.toBase58()}`);
  console.log(`   ✅ Decimals: ${decimals}`);
  console.log(`   ✅ Authority: ${payer.publicKey.toBase58()}`);
  
  return mint;
}

async function mintTokensToWallet(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  amount: number,
  decimals: number,
  name: string
): Promise<PublicKey> {
  console.log(`\n💰 Minting ${amount.toLocaleString()} ${name} tokens...`);
  
  // Get or create token account
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    false,
    'confirmed',
    { commitment: 'confirmed' },
    TOKEN_PROGRAM_ID
  );
  
  console.log(`   ✅ Token Account: ${tokenAccount.address.toBase58()}`);
  
  // Mint tokens
  const mintAmount = amount * Math.pow(10, decimals);
  await mintTo(
    connection,
    payer,
    mint,
    tokenAccount.address,
    payer.publicKey,
    mintAmount,
    [],
    { commitment: 'confirmed' },
    TOKEN_PROGRAM_ID
  );
  
  console.log(`   ✅ Minted ${amount.toLocaleString()} ${name} tokens`);
  
  return tokenAccount.address;
}

async function createDLMMPool(
  connection: Connection,
  payer: Keypair,
  tokenA: PublicKey,
  tokenB: PublicKey
): Promise<PublicKey> {
  console.log('\n🏊 Creating DLMM Pool...');
  
  try {
    // Pool parameters
    const binStep = 25; // 0.25% price bins (25 basis points) - wider bins
    const initialPrice = 1.0; // 1:1 price ratio
    const feeBps = 50; // 0.5% fee (50 basis points) - lower fee
    
    // Calculate activeId from price
    // For 1:1 price, activeId is typically around 0
    const activeId = new BN(0);
    
    // Get current slot and set activation 100 slots in the future
    const currentSlot = await connection.getSlot();
    const activationPoint = new BN(currentSlot + 100);
    
    console.log('   Pool Parameters:');
    console.log(`   - Bin Step: ${binStep} (${binStep/100}% per bin)`);
    console.log(`   - Initial Price: ${initialPrice}`);
    console.log(`   - Active Bin ID: ${activeId.toString()}`);
    console.log(`   - Fee: ${feeBps / 100}%`);
    console.log(`   - Current Slot: ${currentSlot}`);
    console.log(`   - Activation Slot: ${activationPoint.toString()}`);
    
    // Create the pool using SDK
    const createPoolTx = await DLMM.createCustomizablePermissionlessLbPair(
      connection,
      new BN(binStep),
      tokenA,
      tokenB,
      activeId,
      new BN(feeBps),
      0, // Activation type: slot-based
      false, // No alpha vault
      payer.publicKey,
      activationPoint, // Activate 100 slots from now
      false, // creatorPoolOnOffControl
      { cluster: 'devnet' }
    );
    
    console.log('   📝 Sending pool creation transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      createPoolTx,
      [payer],
      { commitment: 'confirmed' }
    );
    
    console.log(`   ✅ Pool Created! TX: ${signature}`);
    
    // Derive pool address using the SDK helper
    const programId = new PublicKey(LBCLMM_PROGRAM_IDS['devnet']);
    const [poolAddress] = deriveCustomizablePermissionlessLbPair(tokenA, tokenB, programId);
    
    console.log(`   ✅ Pool Address: ${poolAddress.toBase58()}`);
    
    return poolAddress;
    
  } catch (error: any) {
    console.error('❌ Error creating pool:', error);
    if (error.logs) {
      console.error('   Transaction logs:');
      error.logs.forEach((log: string) => console.error(`     ${log}`));
    }
    throw error;
  }
}

async function addInitialLiquidity(
  connection: Connection,
  payer: Keypair,
  poolAddress: PublicKey,
  amountA: number,
  amountB: number,
  decimalsA: number,
  decimalsB: number
): Promise<void> {
  console.log('\n💧 Adding Initial Liquidity...');
  
  try {
    // Create DLMM instance
    const dlmmPool = await DLMM.create(connection, poolAddress, {
      cluster: 'devnet'
    });
    
    console.log('   ✅ Pool loaded successfully');
    console.log(`   Active Bin ID: ${dlmmPool.lbPair.activeId}`);
    
    // Calculate amounts in lamports (must use integer arithmetic)
    const totalXAmount = new BN(amountA).mul(new BN(10).pow(new BN(decimalsA)));
    const totalYAmount = new BN(amountB).mul(new BN(10).pow(new BN(decimalsB)));
    
    console.log(`   Adding ${amountA.toLocaleString()} Token A`);
    console.log(`   Adding ${amountB.toLocaleString()} Token B`);
    
    // Create position and add liquidity
    const positionKeypair = Keypair.generate();
    
    // Define liquidity distribution (spot distribution around active bin)
    const minBinId = dlmmPool.lbPair.activeId - 10; // 10 bins below
    const maxBinId = dlmmPool.lbPair.activeId + 10; // 10 bins above
    
    console.log(`   Distribution: Bins ${minBinId} to ${maxBinId}`);
    
    const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: positionKeypair.publicKey,
      user: payer.publicKey,
      totalXAmount,
      totalYAmount,
      strategy: {
        minBinId,
        maxBinId,
        strategyType: 1, // Spot strategy (balanced around active bin)
      },
    });
    
    console.log('   📝 Sending liquidity transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      createPositionTx,
      [payer, positionKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log(`   ✅ Liquidity Added! TX: ${signature}`);
    console.log(`   ✅ Position: ${positionKeypair.publicKey.toBase58()}`);
    
  } catch (error: any) {
    console.error('❌ Error adding liquidity:', error.message);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    throw error;
  }
}

async function main() {
  console.log('\n🚀 CREATING CUSTOM TEST POOL');
  console.log('='.repeat(70));
  
  try {
    // 1. Setup
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    const wallet = await loadWallet();
    
    console.log(`\n📋 Setup:`);
    console.log(`   Wallet: ${wallet.publicKey.toBase58()}`);
    
    const balance = await connection.getBalance(wallet.publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    console.log(`   Balance: ${balanceSOL.toFixed(4)} SOL`);
    
    if (balanceSOL < 0.5) {
      throw new Error(`Insufficient balance. Need at least 0.5 SOL, have ${balanceSOL.toFixed(4)} SOL`);
    }
    
    // 2. Create Test Tokens
    console.log('\n' + '='.repeat(70));
    console.log('STEP 1: Creating Test Tokens');
    console.log('='.repeat(70));
    
    const tokenADecimals = 9;
    const tokenBDecimals = 6;
    
    const tokenAMint = await createTestToken(connection, wallet, tokenADecimals, 'TEST-A');
    const tokenBMint = await createTestToken(connection, wallet, tokenBDecimals, 'TEST-B');
    
    // 3. Mint Initial Supply
    console.log('\n' + '='.repeat(70));
    console.log('STEP 2: Minting Initial Supply');
    console.log('='.repeat(70));
    
    const initialSupplyA = 1_000_000_000; // 1 billion
    const initialSupplyB = 1_000_000_000; // 1 billion
    
    await mintTokensToWallet(connection, wallet, tokenAMint, initialSupplyA, tokenADecimals, 'TEST-A');
    await mintTokensToWallet(connection, wallet, tokenBMint, initialSupplyB, tokenBDecimals, 'TEST-B');
    
    // 4. Create DLMM Pool
    console.log('\n' + '='.repeat(70));
    console.log('STEP 3: Creating DLMM Pool');
    console.log('='.repeat(70));
    
    const poolAddress = await createDLMMPool(connection, wallet, tokenAMint, tokenBMint);
    
    // 5. Add Initial Liquidity (or note that it's pending activation)
    console.log('\n' + '='.repeat(70));
    console.log('STEP 4: Checking Pool Activation Status');
    console.log('='.repeat(70));
    
    const liquidityAmountA = 10_000_000; // 10 million
    const liquidityAmountB = 10_000_000; // 10 million
    
    const currentSlotAfterCreation = await connection.getSlot();
    const poolData = await connection.getAccountInfo(poolAddress);
    
    console.log(`\n   Current Slot: ${currentSlotAfterCreation}`);
    console.log(`   Activation Slot: ${currentSlotAfterCreation + 100}`);
    
    if (currentSlotAfterCreation < (currentSlotAfterCreation + 100)) {
      console.log('\n   ⏳ Pool is not yet activated.');
      console.log(`   ℹ️  Pool will activate in ~${Math.ceil((100) * 0.4)} seconds`);
      console.log('   ℹ️  You can add liquidity after activation.');
      console.log('\n   Skipping initial liquidity for now...');
    } else {
      // Add liquidity
      await addInitialLiquidity(
        connection,
        wallet,
        poolAddress,
        liquidityAmountA,
        liquidityAmountB,
        tokenADecimals,
        tokenBDecimals
      );
    }
    
    // 6. Save Configuration
    console.log('\n' + '='.repeat(70));
    console.log('STEP 5: Saving Configuration');
    console.log('='.repeat(70));
    
    const poolInfo: TestPoolInfo = {
      poolAddress: poolAddress.toBase58(),
      tokenAMint: tokenAMint.toBase58(),
      tokenBMint: tokenBMint.toBase58(),
      tokenASymbol: 'TEST-A',
      tokenBSymbol: 'TEST-B',
      tokenADecimals,
      tokenBDecimals,
      initialLiquidityAdded: true,
      createdAt: new Date().toISOString(),
    };
    
    await saveTestPoolInfo(poolInfo);
    
    // 7. Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST POOL CREATION COMPLETE!');
    console.log('='.repeat(70));
    
    console.log('\n📊 Pool Summary:');
    console.log(`   Pool Address: ${poolInfo.poolAddress}`);
    console.log(`   Token A (TEST-A): ${poolInfo.tokenAMint}`);
    console.log(`   Token B (TEST-B): ${poolInfo.tokenBMint}`);
    console.log(`   Token Supply: ${initialSupplyA.toLocaleString()} A / ${initialSupplyB.toLocaleString()} B (in wallet)`);
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Wait ~40 seconds for pool to activate');
    console.log('   2. Run the liquidity script to add initial liquidity');
    console.log('   3. Use this pool for all Phase 1A/1B testing');
    console.log('   4. You can mint more tokens anytime (you own the mint authority)');
    console.log('   5. Create test positions with these tokens');
    console.log('   6. Test fee claiming, liquidity operations, etc.');
    
    console.log('\n📝 Pool Details:');
    console.log(`   Pool: ${poolInfo.poolAddress}`);
    console.log(`   Token A: ${poolInfo.tokenAMint}`);
    console.log(`   Token B: ${poolInfo.tokenBMint}`);
    
    console.log('\n🎯 Ready for testing (after activation)!');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
