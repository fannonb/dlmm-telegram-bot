/**
 * Create Simple Test Position with CLI Wallet
 * Creates a small position for testing Phase 2 liquidity operations
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';

// Devnet Configuration
const RPC_URL = 'https://api.devnet.solana.com';
const POOL_ADDRESS = '9fQYAVUpQ79p98xo1D1cCudik5DrgaU6LmjSexLBWZa1';

async function createTestPosition() {
  try {
    console.log('=== Creating Test Position with CLI Wallet ===\n');

    // Setup connection
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Load CLI wallet
    const walletPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'solana', 'id.json');
    const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    
    console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
    
    // Check SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey) / 1e9;
    console.log(`SOL Balance: ${solBalance.toFixed(4)} SOL`);
    
    if (solBalance < 0.5) {
      console.log('\n⚠️  Insufficient SOL. Run get-devnet-sol.ts first.');
      return;
    }

    // Initialize DLMM
    const poolPubKey = new PublicKey(POOL_ADDRESS);
    const dlmm = await DLMM.create(connection, poolPubKey);
    
    const activeBin = await dlmm.getActiveBin();
    console.log(`\nPool: ${POOL_ADDRESS}`);
    console.log(`Active Bin: ${activeBin.binId}\n`);

    // Create position keypair
    const positionKeypair = Keypair.generate();
    console.log(`New Position: ${positionKeypair.publicKey.toBase58()}`);

    // Small amounts for testing
    // TEST-A: 1,000 tokens (9 decimals)
    // TEST-B: 1,000 tokens (6 decimals)
    const totalXAmount = new BN(1000).mul(new BN(10).pow(new BN(9)));
    const totalYAmount = new BN(1000).mul(new BN(10).pow(new BN(6)));

    console.log('\nLiquidity Amounts:');
    console.log(`  TEST-A: 1,000 tokens`);
    console.log(`  TEST-B: 1,000 tokens`);

    // Bin range: -5 to +5 (11 bins total)
    const minBinId = activeBin.binId - 5;
    const maxBinId = activeBin.binId + 5;

    console.log(`\nBin Range: ${minBinId} to ${maxBinId}`);
    console.log('Strategy: Spot (balanced distribution)');

    // Create position and add liquidity
    console.log('\nCreating position...');
    const createPositionTx = await dlmm.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: positionKeypair.publicKey,
      user: wallet.publicKey,
      totalXAmount,
      totalYAmount,
      strategy: {
        minBinId,
        maxBinId,
        strategyType: StrategyType.Spot,
      },
      slippage: 1, // 1% slippage
    });

    // Send transaction
    console.log('Sending transaction...');
    
    const { Connection: SolConnection, sendAndConfirmTransaction } = require('@solana/web3.js');
    const txHash = await sendAndConfirmTransaction(
      connection,
      createPositionTx,
      [wallet, positionKeypair],
      { commitment: 'confirmed' }
    );

    console.log('\n✅ Position Created Successfully!');
    console.log(`\nTransaction: ${txHash}`);
    console.log(`Explorer: https://explorer.solana.com/tx/${txHash}?cluster=devnet`);

    // Verify position
    console.log('\nVerifying position...');
    const position = await dlmm.getPosition(positionKeypair.publicKey);
    
    console.log('\nPosition Details:');
    console.log(`  Address: ${positionKeypair.publicKey.toBase58()}`);
    console.log(`  Lower Bin: ${position.positionData.lowerBinId}`);
    console.log(`  Upper Bin: ${position.positionData.upperBinId}`);
    console.log(`  Total X Amount: ${position.positionData.totalXAmount.toString()}`);
    console.log(`  Total Y Amount: ${position.positionData.totalYAmount.toString()}`);
    console.log(`  Bins with Liquidity: ${position.positionData.positionBinData.length}`);

    // Save position address for testing
    const testPositionData = {
      address: positionKeypair.publicKey.toBase58(),
      owner: wallet.publicKey.toBase58(),
      pool: POOL_ADDRESS,
      createdAt: new Date().toISOString(),
      lowerBinId: position.positionData.lowerBinId,
      upperBinId: position.positionData.upperBinId,
      totalXAmount: position.positionData.totalXAmount.toString(),
      totalYAmount: position.positionData.totalYAmount.toString(),
    };

    const outputPath = path.join(__dirname, '..', 'data', 'test-position-cli.json');
    fs.writeFileSync(outputPath, JSON.stringify(testPositionData, null, 2));
    
    console.log(`\n📝 Position data saved to: data/test-position-cli.json`);

    console.log('\n=== Next Steps ===');
    console.log('Now you can test Phase 2 operations:');
    console.log('  1. npx ts-node tests/test-remove-liquidity.ts');
    console.log('     (Update script to use this position address)');
    console.log('\n  2. Test removing 10% liquidity');
    console.log('  3. Test adding more liquidity');
    console.log('  4. Test closing position');

  } catch (error) {
    console.error('\n❌ Error creating position:');
    console.error(error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

createTestPosition();
