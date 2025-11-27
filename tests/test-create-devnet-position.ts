import { Connection, PublicKey, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Script to create a real position on Devnet for testing Phase 1A
 * Pool: 3W2HKgUa96Z69zzG3LK1g8KdcRAWzAttiLiHfYnKuPw5 (Devnet test pool)
 */

const DEVNET_RPC = 'https://api.devnet.solana.com';
const DEVNET_POOL = '3W2HKgUa96Z69zzG3LK1g8KdcRAWzAttiLiHfYnKuPw5';

async function createDevnetPosition() {
  console.log('\n🚀 CREATING DEVNET TEST POSITION\n');
  console.log('='.repeat(60));

  try {
    // 1. Setup connection
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

    // Check balance
    const userPubkey = new PublicKey(activeWallet.publicKey);
    const balance = await connection.getBalance(userPubkey);
    const balanceSOL = balance / 1e9;
    console.log(`💰 Balance: ${balanceSOL.toFixed(4)} SOL`);

    if (balanceSOL < 0.1) {
      throw new Error('Insufficient balance. Need at least 0.1 SOL for position creation + fees');
    }

    // 3. Initialize DLMM pool
    console.log('\n📊 Initializing DLMM Pool...');
    const dlmmPool = await DLMM.create(connection, new PublicKey(DEVNET_POOL));
    
    console.log(`   Pool Address: ${DEVNET_POOL}`);
    console.log(`   Token X: ${dlmmPool.tokenX.publicKey.toBase58()}`);
    console.log(`   Token Y: ${dlmmPool.tokenY.publicKey.toBase58()}`);

    // 4. Get active bin
    const activeBin = await dlmmPool.getActiveBin();
    console.log(`\n🎯 Active Bin ID: ${activeBin.binId}`);
    console.log(`   Price: ${activeBin.price}`);

    // 5. Calculate position range (±5 bins around active)
    const RANGE = 5;
    const minBinId = activeBin.binId - RANGE;
    const maxBinId = activeBin.binId + RANGE;

    console.log(`\n📐 Position Range:`);
    console.log(`   Min Bin: ${minBinId}`);
    console.log(`   Max Bin: ${maxBinId}`);

    // 6. Prepare liquidity amounts (small amounts for testing)
    // Using ~0.01 SOL worth of each token
    const tokenXDecimals = dlmmPool.tokenX.mint?.decimals || 9;
    const tokenYDecimals = dlmmPool.tokenY.mint?.decimals || 9;
    const totalXAmount = new BN(Math.floor(0.01 * 10 ** tokenXDecimals));
    const totalYAmount = new BN(Math.floor(0.01 * 10 ** tokenYDecimals));

    console.log(`\n💧 Liquidity Amounts:`);
    console.log(`   Token X: ${totalXAmount.toString()} (${0.01} tokens)`);
    console.log(`   Token Y: ${totalYAmount.toString()} (${0.01} tokens)`);

    // 7. Create position keypair
    const newPosition = Keypair.generate();
    console.log(`\n🔑 New Position Keypair: ${newPosition.publicKey.toBase58()}`);

    // 8. Decrypt private key using ENCRYPTION_KEY from .env
    console.log('\n🔐 Decrypting wallet...');
    
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not found in environment variables');
    }
    
    let walletKeypair: Keypair;
    try {
      const decryptedKey = CryptoJS.AES.decrypt(activeWallet.encryptedPrivateKey, encryptionKey).toString(CryptoJS.enc.Utf8);
      if (!decryptedKey) {
        throw new Error('Failed to decrypt wallet');
      }
      const secretKey = new Uint8Array(JSON.parse(decryptedKey));
      walletKeypair = Keypair.fromSecretKey(secretKey);
      console.log('✅ Wallet unlocked');
    } catch (error) {
      throw new Error('Failed to decrypt wallet. Check ENCRYPTION_KEY in .env file');
    }

    console.log('\n⚙️  Preparing transaction...');

    // 9. Create position transaction
    const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: newPosition.publicKey,
      user: walletKeypair.publicKey,
      totalXAmount,
      totalYAmount,
      strategy: {
        maxBinId,
        minBinId,
        strategyType: 1, // StrategyType.Spot
      },
    });

    console.log('📤 Sending transaction...');

    // 10. Send transaction
    const txHash = await sendAndConfirmTransaction(
      connection,
      createPositionTx,
      [walletKeypair, newPosition],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    console.log('\n✅ SUCCESS! Position Created\n');
    console.log('='.repeat(60));
    console.log(`Transaction: ${txHash}`);
    console.log(`Position Address: ${newPosition.publicKey.toBase58()}`);
    console.log(`Pool Address: ${DEVNET_POOL}`);
    console.log(`Explorer: https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
    console.log('='.repeat(60));

    // 11. Save position to config
    console.log('\n💾 Saving position to config...');
    
    const newPositionData = {
      address: newPosition.publicKey.toBase58(),
      poolAddress: DEVNET_POOL,
      name: `Devnet Test Position ${new Date().toISOString().split('T')[0]}`,
      createdAt: new Date().toISOString(),
      network: 'devnet' as const,
    };

    config.positions.push(newPositionData);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('✅ Position saved to config.json');

    console.log('\n🎉 DEVNET POSITION READY FOR TESTING!\n');
    console.log('Next steps:');
    console.log('1. Run: npm run test:phase1a');
    console.log('2. Verify position data is fetched correctly');
    console.log('3. Test CLI: npm run cli:interactive');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    if (error.logs) {
      console.error('Transaction Logs:', error.logs);
    }
    throw error;
  }
}

// Run the script
createDevnetPosition()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
