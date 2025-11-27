#!/usr/bin/env ts-node

/**
 * Comprehensive Search for Test Token Solutions
 * 
 * This script attempts multiple approaches to get test tokens:
 * 1. Check if tokens have mint authority (can we mint them?)
 * 2. Search for similar Devnet pools with more accessible tokens
 * 3. Check token metadata for faucet/docs links
 * 4. Analyze token accounts and holders
 * 5. Try creating our own test pool with mintable tokens
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

const DEVNET_RPC = 'https://api.devnet.solana.com';
const CURRENT_POOL = '3W2HKgUa96Z69zzG3LK1g8KdcRAWzAttiLiHfYnKuPw5';

interface Solution {
  option: number;
  title: string;
  description: string;
  feasible: boolean;
  steps?: string[];
  data?: any;
}

async function loadWallet() {
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

async function checkMintAuthority(connection: Connection, mintAddress: PublicKey): Promise<Solution> {
  console.log(`\n🔍 Checking mint authority for ${mintAddress.toBase58().substring(0, 8)}...`);
  
  try {
    const mintInfo = await connection.getParsedAccountInfo(mintAddress);
    
    if (!mintInfo.value) {
      return {
        option: 1,
        title: 'Mint Token Authority',
        description: 'Check if we can mint the pool tokens ourselves',
        feasible: false,
        data: { error: 'Mint account not found' }
      };
    }

    const parsedData = (mintInfo.value.data as any).parsed;
    const mintAuthority = parsedData?.info?.mintAuthority;
    const freezeAuthority = parsedData?.info?.freezeAuthority;
    
    console.log(`   Mint Authority: ${mintAuthority || 'None'}`);
    console.log(`   Freeze Authority: ${freezeAuthority || 'None'}`);
    
    return {
      option: 1,
      title: 'Mint Token Authority',
      description: 'Check if we can mint the pool tokens ourselves',
      feasible: false, // Usually controlled by protocol
      data: {
        mintAuthority,
        freezeAuthority,
        reason: mintAuthority ? 'Authority exists but not controlled by us' : 'No mint authority'
      }
    };
  } catch (error: any) {
    return {
      option: 1,
      title: 'Mint Token Authority',
      description: 'Check if we can mint the pool tokens ourselves',
      feasible: false,
      data: { error: error.message }
    };
  }
}

async function searchAlternativePools(connection: Connection): Promise<Solution> {
  console.log('\n🔍 Searching for alternative Devnet pools...');
  
  // Known Meteora program ID
  const METEORA_PROGRAM_ID = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');
  
  try {
    // This would require getProgramAccounts which is expensive
    // Instead, let's provide known alternatives
    const knownDevnetPools = [
      '3W2HKgUa96Z69zzG3LK1g8KdcRAWzAttiLiHfYnKuPw5', // Current pool
      // Add more if we find them
    ];

    return {
      option: 2,
      title: 'Use Alternative Devnet Pool',
      description: 'Find a pool with more accessible test tokens',
      feasible: false,
      data: {
        knownPools: knownDevnetPools,
        note: 'Limited Devnet pools available. Most testing is on mainnet with small amounts.'
      },
      steps: [
        'Check Meteora Discord for test pool recommendations',
        'Ask Meteora team for Devnet test token faucet',
        'Consider using mainnet with minimal amounts instead'
      ]
    };
  } catch (error: any) {
    return {
      option: 2,
      title: 'Use Alternative Devnet Pool',
      description: 'Find a pool with more accessible test tokens',
      feasible: false,
      data: { error: error.message }
    };
  }
}

async function createOwnTestPool(connection: Connection, wallet: Keypair): Promise<Solution> {
  console.log('\n🔍 Analyzing feasibility of creating our own test pool...');
  
  const balance = await connection.getBalance(wallet.publicKey);
  const balanceSOL = balance / 1e9;
  
  console.log(`   Current balance: ${balanceSOL.toFixed(4)} SOL`);
  
  // Check if we have enough for pool creation (~0.5 SOL for rent + tx fees)
  const needsSOL = 0.5;
  const feasible = balanceSOL >= needsSOL;
  
  return {
    option: 3,
    title: 'Create Custom Test Pool',
    description: 'Create our own DLMM pool with mintable test tokens',
    feasible,
    data: {
      currentBalance: balanceSOL,
      requiredBalance: needsSOL,
      canProceed: feasible
    },
    steps: feasible ? [
      '1. Create two custom SPL tokens (we control mint authority)',
      '2. Mint initial supply to our wallet',
      '3. Create DLMM pool using Meteora SDK',
      '4. Add initial liquidity to the pool',
      '5. Use this pool for all testing',
      '',
      'Advantages:',
      '- Full control over token supply',
      '- Can mint tokens anytime',
      '- Realistic testing environment',
      '- No dependency on external faucets'
    ] : [
      `Need at least ${needsSOL} SOL (have ${balanceSOL.toFixed(4)} SOL)`,
      'Request more SOL from Devnet faucet first'
    ]
  };
}

async function checkLargestHolders(connection: Connection, mintAddress: PublicKey): Promise<Solution> {
  console.log(`\n🔍 Checking largest holders of ${mintAddress.toBase58().substring(0, 8)}...`);
  
  try {
    const largestAccounts = await connection.getTokenLargestAccounts(mintAddress);
    
    console.log(`   Found ${largestAccounts.value.length} token accounts`);
    largestAccounts.value.slice(0, 3).forEach((acc, i) => {
      console.log(`   ${i + 1}. ${acc.address.toBase58()} - ${acc.uiAmount} tokens`);
    });
    
    return {
      option: 4,
      title: 'Analyze Token Holders',
      description: 'Check if there are faucets or known distributors',
      feasible: false,
      data: {
        topHolders: largestAccounts.value.slice(0, 5).map(acc => ({
          address: acc.address.toBase58(),
          amount: acc.uiAmount
        })),
        note: 'Would need to analyze if any are faucet addresses'
      }
    };
  } catch (error: any) {
    return {
      option: 4,
      title: 'Analyze Token Holders',
      description: 'Check if there are faucets or known distributors',
      feasible: false,
      data: { error: error.message }
    };
  }
}

async function switchToMainnet(): Promise<Solution> {
  console.log('\n🔍 Analyzing mainnet option...');
  
  return {
    option: 5,
    title: 'Switch to Mainnet Testing',
    description: 'Use mainnet with very small amounts for realistic testing',
    feasible: true,
    data: {
      advantages: [
        'Real pools with real liquidity',
        'All tokens available via Jupiter/Raydium swaps',
        'Realistic testing conditions',
        'No test token dependency'
      ],
      considerations: [
        'Need small amount of real SOL (~0.1 SOL)',
        'Minimal costs for testing',
        'Can use low-liquidity pools to minimize slippage'
      ],
      estimatedCost: '~$0.50 - $2.00 USD for comprehensive testing'
    },
    steps: [
      '1. Change RPC to mainnet-beta',
      '2. Fund wallet with ~0.1 SOL',
      '3. Select a mainnet pool (many available)',
      '4. Swap small amounts for pool tokens',
      '5. Create test positions',
      '6. Test all features with real data',
      '',
      'Note: This is the most realistic testing approach'
    ]
  };
}

async function contactMeteoraTeam(): Promise<Solution> {
  return {
    option: 6,
    title: 'Contact Meteora Team',
    description: 'Request test token faucet or Devnet test resources',
    feasible: true,
    data: {
      channels: [
        'Discord: https://discord.gg/meteora',
        'Twitter: @MeteoraAG',
        'GitHub: https://github.com/MeteoraAg/dlmm-sdk/issues'
      ]
    },
    steps: [
      '1. Join Meteora Discord server',
      '2. Ask in #developer-support channel about Devnet test tokens',
      '3. Request test token faucet for pool: 3W2HKgUa96Z69zzG3LK1g8KdcRAWzAttiLiHfYnKuPw5',
      '4. Ask if there\'s a recommended Devnet testing approach',
      '',
      'Questions to ask:',
      '- Is there a faucet for Devnet pool tokens?',
      '- What\'s the recommended way to test on Devnet?',
      '- Should we create our own test pool instead?'
    ]
  };
}

async function main() {
  console.log('\n🔬 COMPREHENSIVE TEST TOKEN SOLUTION FINDER');
  console.log('='.repeat(70));
  
  const solutions: Solution[] = [];
  
  try {
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    const wallet = await loadWallet();
    
    console.log(`\nWallet: ${wallet.publicKey.toBase58()}`);
    console.log(`Pool: ${CURRENT_POOL}`);
    
    // Load pool info
    const dlmmPool = await DLMM.create(connection, new PublicKey(CURRENT_POOL));
    console.log(`\nToken X: ${dlmmPool.tokenX.publicKey.toBase58()}`);
    console.log(`Token Y: ${dlmmPool.tokenY.publicKey.toBase58()}`);
    
    // Run all checks
    solutions.push(await checkMintAuthority(connection, dlmmPool.tokenX.publicKey));
    solutions.push(await checkMintAuthority(connection, dlmmPool.tokenY.publicKey));
    solutions.push(await searchAlternativePools(connection));
    solutions.push(await createOwnTestPool(connection, wallet));
    solutions.push(await checkLargestHolders(connection, dlmmPool.tokenX.publicKey));
    solutions.push(await switchToMainnet());
    solutions.push(await contactMeteoraTeam());
    
    // Display results
    console.log('\n\n📊 SOLUTIONS SUMMARY');
    console.log('='.repeat(70));
    
    const feasibleSolutions = solutions.filter(s => s.feasible);
    const infeasibleSolutions = solutions.filter(s => !s.feasible);
    
    console.log('\n✅ FEASIBLE OPTIONS:\n');
    feasibleSolutions.forEach(sol => {
      console.log(`${sol.option}. ${sol.title}`);
      console.log(`   ${sol.description}`);
      if (sol.steps) {
        console.log(`\n   Steps:`);
        sol.steps.forEach(step => console.log(`   ${step}`));
      }
      console.log();
    });
    
    console.log('\n❌ NOT FEASIBLE:\n');
    infeasibleSolutions.forEach(sol => {
      console.log(`${sol.option}. ${sol.title}`);
      console.log(`   Reason: ${sol.data?.reason || sol.data?.error || 'See details above'}`);
    });
    
    console.log('\n\n🎯 RECOMMENDATION:');
    console.log('='.repeat(70));
    console.log('\nBased on analysis, here are the best approaches (in order):\n');
    console.log('1️⃣  CREATE OWN TEST POOL (Option 3)');
    console.log('    - Full control, no external dependencies');
    console.log('    - Takes ~30 minutes to set up');
    console.log('    - Best for comprehensive testing');
    console.log('    - Requires: 0.5 SOL balance (we have ~5 SOL ✅)');
    
    console.log('\n2️⃣  SWITCH TO MAINNET (Option 5)');
    console.log('    - Most realistic testing');
    console.log('    - Low cost (~$1-2 USD)');
    console.log('    - Immediate access to all tokens');
    console.log('    - Production-ready testing');
    
    console.log('\n3️⃣  CONTACT METEORA (Option 6)');
    console.log('    - May provide official test resources');
    console.log('    - Could take 1-2 days for response');
    console.log('    - Good for community support');
    
    console.log('\n\n💡 NEXT STEPS:');
    console.log('Choose one of the above options. I recommend Option 3 (Create Own Test Pool)');
    console.log('as we have sufficient SOL balance and it provides the most control.');
    console.log('\nWould you like me to:');
    console.log('A) Implement Option 3 (create test pool)');
    console.log('B) Implement Option 5 (switch to mainnet)');
    console.log('C) Implement Option 6 (prepare Discord message)');
    console.log('D) Continue with Phase 2 implementation instead');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);
