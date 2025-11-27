/**
 * Verify Position Ownership
 * Checks if the current wallet owns the positions
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import DLMM from '@meteora-ag/dlmm';

// Devnet Configuration
const RPC_URL = 'https://api.devnet.solana.com';
const POOL_ADDRESS = '9fQYAVUpQ79p98xo1D1cCudik5DrgaU6LmjSexLBWZa1';

// Position addresses
const POSITIONS = [
  '3oVsaTyptEzy2PFGPTgSyqypZP55YAmDX6PgE2x2MTXu',
  'GV6aHS3mwYeiQZTXTzUsRfgR1xMc1rnDyU4dVRMNqyjW',
  '28P7bKnprGdu5cFByYHX9qe2nMnEuUaxnCi8gDpktTXB',
  'JBq6mbXjw9v9mRNi1v2Pfx9sp3KgoMBHh5aWpzBvqjKq',
  '4vPcqTcGuWdpNh9Sr6oDRixVtUWtS3LAyY4FL5AUdTqY',
];

async function verifyOwnership() {
  try {
    console.log('=== Verifying Position Ownership ===\n');

    // Setup connection and wallet
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Load wallet
    const walletPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'solana', 'id.json');
    const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    
    console.log(`Wallet: ${wallet.publicKey.toBase58()}\n`);
    
    // Initialize DLMM
    const poolPubKey = new PublicKey(POOL_ADDRESS);
    const dlmm = await DLMM.create(connection, poolPubKey);
    
    console.log(`Checking ownership for ${POSITIONS.length} positions...\n`);
    
    // Check each position
    for (let i = 0; i < POSITIONS.length; i++) {
      const positionAddr = POSITIONS[i];
      console.log(`Position ${i + 1}: ${positionAddr}`);
      
      try {
        const positionPubKey = new PublicKey(positionAddr);
        const position = await dlmm.getPosition(positionPubKey);
        
        // Get the account info to check owner
        const accountInfo = await connection.getAccountInfo(positionPubKey);
        
        console.log(`  Position Data:`);
        console.log(`    Lower Bin: ${position.positionData.lowerBinId}`);
        console.log(`    Upper Bin: ${position.positionData.upperBinId}`);
        console.log(`    Total X: ${position.positionData.totalXAmount.toString()}`);
        console.log(`    Total Y: ${position.positionData.totalYAmount.toString()}`);
        
        if (accountInfo) {
          console.log(`  Account Info:`);
          console.log(`    Owner Program: ${accountInfo.owner.toBase58()}`);
          console.log(`    Data Length: ${accountInfo.data.length} bytes`);
          
          // The position account is owned by the DLMM program,
          // but we need to check the position's owner field
          // This is typically in the position data structure
          console.log(`  Position Owner: (checking...)`);
          
          // Try to decode the owner from position data
          // The owner is typically stored at the beginning of the account data
          if (accountInfo.data.length >= 40) {
            // First 8 bytes are discriminator, next 32 bytes should be the owner
            const ownerPubkey = new PublicKey(accountInfo.data.slice(8, 40));
            console.log(`    Decoded Owner: ${ownerPubkey.toBase58()}`);
            
            if (ownerPubkey.equals(wallet.publicKey)) {
              console.log(`    ✅ OWNED BY CURRENT WALLET`);
            } else {
              console.log(`    ❌ NOT owned by current wallet`);
              console.log(`    Expected: ${wallet.publicKey.toBase58()}`);
            }
          }
        }
        
        console.log('');
        
      } catch (error) {
        console.log(`  ❌ Error checking position: ${error}`);
        console.log('');
      }
    }
    
    console.log('=== Verification Complete ===');

  } catch (error) {
    console.error('\n❌ Error:');
    console.error(error);
  }
}

verifyOwnership();
