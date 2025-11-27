#!/usr/bin/env ts-node

/**
 * FIND ALL POSITIONS FOR OUR WALLET IN CUSTOM POOL
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';
import * as fs from 'fs';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

const DEVNET_RPC = 'https://api.devnet.solana.com';
const TEST_POOL = new PublicKey('9fQYAVUpQ79p98xo1D1cCudik5DrgaU6LmjSexLBWZa1');

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

async function main() {
  console.log('\n🔍 FINDING ALL POSITIONS IN CUSTOM POOL');
  console.log('='.repeat(70));
  
  try {
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    const wallet = await loadWallet();
    
    console.log(`\n📋 Wallet: ${wallet.publicKey.toBase58()}`);
    console.log(`   Pool: ${TEST_POOL.toBase58()}`);
    
    const dlmm = await DLMM.create(connection, TEST_POOL, { cluster: 'devnet' });
    
    console.log(`\n🔍 Fetching all positions for this wallet...`);
    
    // Use DLMM SDK to get user positions
    const positionsData = await dlmm.getPositionsByUserAndLbPair(wallet.publicKey);
    const positions = positionsData.userPositions;
    
    console.log(`\n✅ Found ${positions.length} position(s):\n`);
    
    positions.forEach((pos, idx) => {
      console.log(`${idx + 1}. Position Address: ${pos.publicKey.toBase58()}`);
      console.log(`   Lower Bin: ${pos.positionData.lowerBinId}`);
      console.log(`   Upper Bin: ${pos.positionData.upperBinId}`);
      console.log(`   Fee X: ${pos.positionData.feeX.toString()}`);
      console.log(`   Fee Y: ${pos.positionData.feeY.toString()}`);
      console.log('');
    });
    
    console.log('='.repeat(70));
    console.log('CORRECTED POSITION ADDRESSES');
    console.log('='.repeat(70));
    
    console.log('\nconst POSITIONS = [');
    positions.forEach((pos, idx) => {
      const lower = pos.positionData.lowerBinId;
      const upper = pos.positionData.upperBinId;
      let name = '';
      
      if (lower >= -10 && upper <= 10) {
        name = 'Position 1 (Original -10 to +10)';
      } else if (lower >= -80 && upper <= -50) {
        name = 'Position 2 (Bins -80 to -50)';
      } else if (lower >= 50 && upper <= 80) {
        name = 'Position 3 (Bins 50 to 80)';
      } else if (lower >= -150 && upper <= -120) {
        name = 'Position 4 (Bins -150 to -120)';
      } else if (lower >= 120 && upper <= 150) {
        name = 'Position 5 (Bins 120 to 150)';
      } else {
        name = `Position (Bins ${lower} to ${upper})`;
      }
      
      console.log(`  { name: '${name}', address: '${pos.publicKey.toBase58()}' },`);
    });
    console.log('];\n');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
