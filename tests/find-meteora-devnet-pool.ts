#!/usr/bin/env ts-node

/**
 * FIND METEORA DLMM POOLS ON DEVNET
 * 
 * This script searches for Meteora DLMM pools on Devnet,
 * specifically looking for SOL-USDC or USDC-related pools
 */

import { Connection, PublicKey } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const USDC_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // Circle USDC
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112'); // Wrapped SOL

// Known Meteora program IDs
const METEORA_DLMM_PROGRAM = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');

// Some known Meteora pools from documentation/examples (may be mainnet)
const KNOWN_POOLS = [
  'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y', // SOL-USDC (mainnet example)
  'ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq', // Another common example
];

async function testPoolOnDevnet(connection: Connection, poolAddress: string): Promise<boolean> {
  try {
    const pubkey = new PublicKey(poolAddress);
    const dlmm = await DLMM.create(connection, pubkey, { cluster: 'devnet' });
    
    console.log(`\n✅ FOUND POOL: ${poolAddress}`);
    console.log(`   Token X: ${dlmm.tokenX.publicKey.toBase58()}`);
    console.log(`   Token Y: ${dlmm.tokenY.publicKey.toBase58()}`);
    console.log(`   Active Bin: ${dlmm.lbPair.activeId}`);
    console.log(`   Bin Step: ${dlmm.lbPair.binStep} bps`);
    
    const binArrays = await dlmm.getBinArrays();
    console.log(`   Bin Arrays: ${binArrays.length}`);
    
    return true;
  } catch (error: any) {
    console.log(`   ❌ ${poolAddress}: ${error.message}`);
    return false;
  }
}

async function searchForPools() {
  console.log('\n🔍 SEARCHING FOR METEORA DLMM POOLS ON DEVNET');
  console.log('='.repeat(70));
  
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  
  console.log(`\n📋 Target tokens:`);
  console.log(`   SOL (Wrapped): ${SOL_MINT.toBase58()}`);
  console.log(`   USDC (Circle): ${USDC_DEVNET.toBase58()}`);
  console.log(`   Meteora Program: ${METEORA_DLMM_PROGRAM.toBase58()}`);
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('TESTING KNOWN POOL ADDRESSES ON DEVNET');
  console.log('='.repeat(70));
  
  let foundPools = 0;
  for (const poolAddr of KNOWN_POOLS) {
    console.log(`\n🔍 Testing: ${poolAddr}...`);
    const found = await testPoolOnDevnet(connection, poolAddr);
    if (found) foundPools++;
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('TRYING METEORA API');
  console.log('='.repeat(70));
  
  try {
    console.log(`\n📡 Fetching pools from Meteora API...`);
    const response = await fetch('https://dlmm-api.meteora.ag/pair/all');
    
    if (!response.ok) {
      console.log(`   ❌ API request failed: ${response.status} ${response.statusText}`);
    } else {
      const data: any = await response.json();
      console.log(`   ✅ API responded with ${data.length || 0} pools`);
      
      // Filter for devnet pools (if any)
      const devnetPools = data.filter((pool: any) => {
        // Check if pool might be on devnet (this is speculative)
        return pool.address && pool.name && pool.name.includes('Devnet');
      });
      
      if (devnetPools.length > 0) {
        console.log(`\n   Found ${devnetPools.length} potential Devnet pools:`);
        devnetPools.slice(0, 5).forEach((pool: any) => {
          console.log(`   • ${pool.name}: ${pool.address}`);
        });
      } else {
        console.log(`   ℹ️  No explicit Devnet pools found in API`);
        console.log(`   (API likely returns only Mainnet pools)`);
      }
      
      // Look for SOL-USDC pools
      const solUsdcPools = data.filter((pool: any) => 
        pool.name && (
          pool.name.includes('SOL-USDC') || 
          pool.name.includes('USDC-SOL') ||
          pool.name.includes('SOL/USDC')
        )
      );
      
      if (solUsdcPools.length > 0) {
        console.log(`\n   📊 Found ${solUsdcPools.length} SOL-USDC pools (likely Mainnet):`);
        solUsdcPools.slice(0, 3).forEach((pool: any) => {
          console.log(`   • ${pool.name}: ${pool.address}`);
          console.log(`     TVL: $${pool.liquidity?.toLocaleString() || 'N/A'}`);
        });
      }
    }
  } catch (error: any) {
    console.log(`   ❌ API error: ${error.message}`);
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY & RECOMMENDATIONS');
  console.log('='.repeat(70));
  
  if (foundPools > 0) {
    console.log(`\n✅ Found ${foundPools} working pool(s) on Devnet!`);
    console.log(`   You can use these for testing.`);
  } else {
    console.log(`\n⚠️  No Meteora DLMM pools found on Devnet`);
    console.log(`\n   This is because:`);
    console.log(`   • Meteora DLMM is primarily deployed on Mainnet`);
    console.log(`   • Devnet is for testing but may not have public pools`);
    console.log(`   • Test pools may be private or undocumented`);
  }
  
  console.log(`\n🎯 NEXT STEPS:`);
  console.log(`\n   Option 1: Contact Meteora Team`);
  console.log(`   • Discord: https://discord.gg/meteora`);
  console.log(`   • Ask for Devnet pool addresses`);
  console.log(`   • They may provide test pools or create one`);
  
  console.log(`\n   Option 2: Use Mainnet (Small Amount)`);
  console.log(`   • Cost: ~$0.50 for testing`);
  console.log(`   • Use real SOL-USDC pool`);
  console.log(`   • Test complete flow: position → swap → fees → claim`);
  console.log(`   • Switch RPC to mainnet and use existing code`);
  
  console.log(`\n   Option 3: Proceed with Phase 2 on Custom Pool`);
  console.log(`   • Test liquidity operations (add/remove/close)`);
  console.log(`   • Works perfectly on our custom pool`);
  console.log(`   • Defer swap testing to mainnet later`);
  
  console.log(`\n💡 Recommendation: Try Option 1 (Discord) or Option 2 (Mainnet)`);
  console.log(`   We have 10 USDC and 4 SOL ready for testing!`);
  console.log('');
}

searchForPools().catch(console.error);
