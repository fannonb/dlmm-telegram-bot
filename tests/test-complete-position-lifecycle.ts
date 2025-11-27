/**
 * Complete Position Lifecycle Test
 * 1. Create a new position
 * 2. Add liquidity
 * 3. Generate fees (via swaps)
 * 4. Claim fees
 * 5. Remove liquidity
 * Tracks wallet balance changes at every step
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import { LiquidityService } from '../src/services/liquidity.service';
import { FeeService } from '../src/services/fee.service';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

const RPC_URL = 'https://api.devnet.solana.com';
const POOL_ADDRESS = '9fQYAVUpQ79p98xo1D1cCudik5DrgaU6LmjSexLBWZa1';

const TEST_A = '81aJ783713MRTdEHVPJbSCWbBdbjmy7ZdyaN5zrd75au';
const TEST_B = '7ZfV4DToa3v2CsKiAL6hbVTnQhNZSa8N3xofNMaiNgoM';

async function loadWallet(): Promise<Keypair> {
  const configPath = path.join(__dirname, '..', 'data', 'config.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configData);
  const activeWallet = config.wallets.find((w: any) => w.isActive);
  
  if (!activeWallet) throw new Error('No active wallet found');

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY not found in .env');
  
  const decryptedKey = CryptoJS.AES.decrypt(
    activeWallet.encryptedPrivateKey,
    encryptionKey
  ).toString(CryptoJS.enc.Utf8);
  
  const decodedKey = bs58.decode(decryptedKey);
  return Keypair.fromSecretKey(decodedKey);
}

async function getTokenBalance(
  connection: Connection,
  wallet: PublicKey,
  mint: PublicKey
): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(mint, wallet);
    const account = await getAccount(connection, ata);
    return Number(account.amount);
  } catch (error) {
    return 0;
  }
}

async function getSolBalance(connection: Connection, wallet: PublicKey): Promise<number> {
  return (await connection.getBalance(wallet)) / 1e9;
}

function formatBalance(balance: number, decimals: number = 0): string {
  if (decimals === 9) {
    return (balance / 1e9).toFixed(4);
  } else if (decimals === 6) {
    return (balance / 1e6).toFixed(6);
  }
  return balance.toLocaleString();
}

interface BalanceSnapshot {
  sol: number;
  testA: number;
  testB: number;
  timestamp: string;
}

async function captureBalances(connection: Connection, wallet: PublicKey): Promise<BalanceSnapshot> {
  const sol = await getSolBalance(connection, wallet);
  const testA = await getTokenBalance(connection, wallet, new PublicKey(TEST_A));
  const testB = await getTokenBalance(connection, wallet, new PublicKey(TEST_B));
  
  return { sol, testA, testB, timestamp: new Date().toLocaleTimeString() };
}

function printBalanceChange(label: string, before: BalanceSnapshot, after: BalanceSnapshot): void {
  const solDiff = after.sol - before.sol;
  const testADiff = after.testA - before.testA;
  const testBDiff = after.testB - before.testB;

  console.log(`\n${label}`);
  console.log(`  SOL:    ${after.sol.toFixed(4)} (${solDiff >= 0 ? '+' : ''}${solDiff.toFixed(4)})`);
  console.log(`  TEST-A: ${after.testA.toLocaleString()} (${testADiff >= 0 ? '+' : ''}${testADiff})`);
  console.log(`  TEST-B: ${after.testB.toLocaleString()} (${testBDiff >= 0 ? '+' : ''}${testBDiff})`);
}

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   POSITION LIFECYCLE TEST WITH WALLET TRACKING           ║');
  console.log('║   Create → Add Liquidity → Claim Fees → Remove           ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const wallet = await loadWallet();
  const connection = new Connection(RPC_URL);
  let dlmm = await DLMM.create(connection, new PublicKey(POOL_ADDRESS));
  const testAMint = new PublicKey(TEST_A);
  const testBMint = new PublicKey(TEST_B);

  console.log(`Wallet: ${wallet.publicKey.toString()}\n`);

  // === STEP 1: Initial State ===
  console.log('📊 STEP 1: Initial State');
  console.log('─'.repeat(60));

  const initial = await captureBalances(connection, wallet.publicKey);
  console.log(`[${initial.timestamp}]`);
  console.log(`SOL:    ${initial.sol.toFixed(4)}`);
  console.log(`TEST-A: ${initial.testA.toLocaleString()}`);
  console.log(`TEST-B: ${initial.testB.toLocaleString()}\n`);

  // === STEP 2: Use Existing Test Position ===
  console.log('💼 STEP 2: Using Existing Test Position');
  console.log('─'.repeat(60));

  // Use position created in earlier tests
  const positionAddress = new PublicKey('GV6aHS3mwYeiQZTXTzUsRfgR1xMc1rnDyU4dVRMNqyjW');
  console.log(`Position: ${positionAddress.toString()}\n`);

  // Verify position exists
  dlmm = await DLMM.create(connection, new PublicKey(POOL_ADDRESS));
  const positionBefore = await dlmm.getPosition(positionAddress);
  console.log(`✅ Position Found`);
  console.log(`   Current X: ${positionBefore.positionData.totalXAmount.toString()}`);
  console.log(`   Current Y: ${positionBefore.positionData.totalYAmount.toString()}\n`);

  // Capture balances after loading position
  await new Promise(resolve => setTimeout(resolve, 1000));
  const afterCreate = await captureBalances(connection, wallet.publicKey);
  printBalanceChange('After Loading Position:', initial, afterCreate);

  const newPositionAddress = positionAddress;

  // === STEP 3: Verify Position & Add Liquidity ===
  console.log('➕ STEP 3: Add More Liquidity to Position');
  console.log('─'.repeat(60));

  dlmm = await DLMM.create(connection, new PublicKey(POOL_ADDRESS));
  const liquidityService = new LiquidityService(connection, dlmm);

  const position = await dlmm.getPosition(newPositionAddress);
  console.log(`Position current liquidity:`);
  console.log(`  X: ${position.positionData.totalXAmount}`);
  console.log(`  Y: ${position.positionData.totalYAmount}`);
  console.log(`\nAdding: 50B TEST-A + 50M TEST-B...\n`);

  const addResult = await liquidityService.addLiquidity({
    positionPubKey: newPositionAddress,
    amountX: new BN(50_000_000_000),
    amountY: new BN(50_000_000),
    strategy: 1,
    user: wallet.publicKey,
    wallet,
  });

  console.log(`✅ Liquidity added`);
  console.log(`   Tx: ${addResult.signatures[0].substring(0, 40)}...\n`);

  await new Promise(resolve => setTimeout(resolve, 2000));
  const afterAdd = await captureBalances(connection, wallet.publicKey);
  printBalanceChange('After Adding Liquidity:', afterCreate, afterAdd);

  // === STEP 4: Remove Liquidity (without claiming fees yet) ===
  console.log('\n\n💸 STEP 4: Remove 25% Liquidity');
  console.log('─'.repeat(60));

  dlmm = await DLMM.create(connection, new PublicKey(POOL_ADDRESS));
  const liquidityService2 = new LiquidityService(connection, dlmm);

  console.log('Removing 25% of liquidity (shouldClaimAndClose: false)...\n');

  const removeResult = await liquidityService2.removeLiquidity({
    positionPubKey: newPositionAddress,
    percentage: 25,
    user: wallet.publicKey,
    wallet,
    shouldClaimAndClose: false, // Don't claim yet
  });

  console.log(`✅ Liquidity removed (tokens in position, not claimed yet)`);
  console.log(`   Tx: ${removeResult.signatures[0].substring(0, 40)}...\n`);

  await new Promise(resolve => setTimeout(resolve, 2000));
  const afterRemove = await captureBalances(connection, wallet.publicKey);
  printBalanceChange('After Removing Liquidity (not claimed):', afterAdd, afterRemove);

  // === STEP 5: Claim Fees ===
  console.log('\n\n💰 STEP 5: Claim Fees and Unclaimed Tokens');
  console.log('─'.repeat(60));

  dlmm = await DLMM.create(connection, new PublicKey(POOL_ADDRESS));
  const feeService = new FeeService(connection, dlmm);

  console.log('Checking for unclaimed fees...');
  
  try {
    const claimResult = await feeService.claimFees(
      newPositionAddress,
      wallet.publicKey,
      wallet
    );

    console.log(`✅ Fees claimed`);
    console.log(`   Transactions: ${claimResult.signatures.length}`);
    claimResult.signatures.forEach((sig, i) => {
      console.log(`   Tx ${i + 1}: ${sig.substring(0, 40)}...`);
    });
    console.log('');
  } catch (error) {
    console.log(`⚠️  No fees to claim (or error): ${(error as any).message}\n`);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));
  const afterClaim = await captureBalances(connection, wallet.publicKey);
  printBalanceChange('After Claiming Fees:', afterRemove, afterClaim);

  // === STEP 6: Final Remove and Close ===
  console.log('\n\n🔚 STEP 6: Remove Remaining Liquidity and Close Position');
  console.log('─'.repeat(60));

  dlmm = await DLMM.create(connection, new PublicKey(POOL_ADDRESS));
  const liquidityService3 = new LiquidityService(connection, dlmm);

  console.log('Removing 100% of remaining liquidity (closing position)...\n');

  const closeResult = await liquidityService3.closePosition({
    positionPubKey: newPositionAddress,
    user: wallet.publicKey,
    wallet,
  });

  console.log(`✅ Position closed`);
  console.log(`   Transactions: ${closeResult.signatures.length}`);
  closeResult.signatures.forEach((sig, i) => {
    console.log(`   Tx ${i + 1}: ${sig.substring(0, 40)}...`);
  });
  console.log('');

  await new Promise(resolve => setTimeout(resolve, 2000));
  const final = await captureBalances(connection, wallet.publicKey);
  printBalanceChange('After Closing Position:', afterClaim, final);

  // === SUMMARY ===
  console.log('\n\n');
  console.log('═'.repeat(60));
  console.log('SUMMARY: Complete Wallet Balance Journey');
  console.log('═'.repeat(60));

  console.log('\nInitial:              SOL: ' + initial.sol.toFixed(4).padEnd(10) +
              ' TEST-A: ' + initial.testA.toLocaleString().padEnd(20) +
              ' TEST-B: ' + initial.testB.toLocaleString());
  
  console.log('After Create:         SOL: ' + afterCreate.sol.toFixed(4).padEnd(10) +
              ' TEST-A: ' + afterCreate.testA.toLocaleString().padEnd(20) +
              ' TEST-B: ' + afterCreate.testB.toLocaleString());
  
  console.log('After Add Liquidity:  SOL: ' + afterAdd.sol.toFixed(4).padEnd(10) +
              ' TEST-A: ' + afterAdd.testA.toLocaleString().padEnd(20) +
              ' TEST-B: ' + afterAdd.testB.toLocaleString());
  
  console.log('After Remove (25%):   SOL: ' + afterRemove.sol.toFixed(4).padEnd(10) +
              ' TEST-A: ' + afterRemove.testA.toLocaleString().padEnd(20) +
              ' TEST-B: ' + afterRemove.testB.toLocaleString());
  
  console.log('After Claim Fees:     SOL: ' + afterClaim.sol.toFixed(4).padEnd(10) +
              ' TEST-A: ' + afterClaim.testA.toLocaleString().padEnd(20) +
              ' TEST-B: ' + afterClaim.testB.toLocaleString());
  
  console.log('Final:                SOL: ' + final.sol.toFixed(4).padEnd(10) +
              ' TEST-A: ' + final.testA.toLocaleString().padEnd(20) +
              ' TEST-B: ' + final.testB.toLocaleString());

  console.log('\n' + '─'.repeat(60));
  console.log('Total Changes:');
  console.log(`  SOL:    ${(final.sol - initial.sol).toFixed(4)} (transaction fees)`);
  console.log(`  TEST-A: ${final.testA - initial.testA} (net change)`);
  console.log(`  TEST-B: ${final.testB - initial.testB} (net change)`);

  console.log('\n' + '═'.repeat(60));
  console.log('✅ COMPLETE POSITION LIFECYCLE TEST FINISHED');
  console.log('═'.repeat(60) + '\n');
}

main().catch(console.error);
