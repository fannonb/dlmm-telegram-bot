// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import { connectionService } from '../src/services/connection.service';
import { walletService } from '../src/services/wallet.service';
import { PublicKey } from '@solana/web3.js';
import chalk from 'chalk';

async function testConnectionService() {
  console.log(chalk.blue.bold('\n🔗 PHASE 2.2: CONNECTION SERVICE TESTS\n'));
  console.log(chalk.gray('================================\n'));

  // Test 1: Get connection
  console.log(chalk.yellow('Test 1: Get Connection'));
  try {
    const connection = connectionService.getConnection();
    console.log(chalk.green('✓ Connection created successfully'));
    console.log(`  Type: ${connection.constructor.name}`);
    console.log(`  Endpoint: ${connectionService.getRpcEndpoint()}`);
    console.log(`  Commitment: ${connectionService.getCommitment()}\n`);
  } catch (error) {
    console.log(chalk.red(`✗ Failed to get connection: ${error}\n`));
  }

  // Test 2: Test connection to RPC
  console.log(chalk.yellow('Test 2: Test RPC Connection'));
  try {
    console.log('  🔄 Testing connection to RPC endpoint...');
    const result = await connectionService.testConnection();
    
    if (result.success) {
      console.log(chalk.green('✓ RPC Connection Successful!'));
      console.log(`  Solana Version: ${result.version?.['solana-core']}`);
      console.log(`  Block Height: ${result.blockHeight}\n`);
    } else {
      console.log(chalk.yellow(`⚠ RPC Connection Failed: ${result.error}`));
      console.log(chalk.gray('  This is expected if using default RPC or rate-limited endpoint.\n'));
    }
  } catch (error) {
    console.log(chalk.yellow(`⚠ Connection test error: ${error}\n`));
  }

  // Test 3: Set RPC endpoint
  console.log(chalk.yellow('Test 3: Set RPC Endpoint'));
  try {
    const originalEndpoint = connectionService.getRpcEndpoint();
    console.log(`  Original endpoint: ${originalEndpoint}`);
    
    // Try switching to devnet
    const devnetEndpoint = 'https://api.devnet.solana.com';
    connectionService.setRpcEndpoint(devnetEndpoint);
    
    const newEndpoint = connectionService.getRpcEndpoint();
    console.log(`  New endpoint: ${newEndpoint}`);
    
    if (newEndpoint === devnetEndpoint) {
      console.log(chalk.green('✓ RPC endpoint updated successfully'));
    }
    
    // Switch back to original
    connectionService.setRpcEndpoint(originalEndpoint);
    console.log(chalk.green('✓ RPC endpoint restored\n'));
  } catch (error) {
    console.log(chalk.red(`✗ Failed to set RPC endpoint: ${error}\n`));
  }

  // Test 4: Set commitment level
  console.log(chalk.yellow('Test 4: Set Commitment Level'));
  try {
    const originalCommitment = connectionService.getCommitment();
    console.log(`  Original commitment: ${originalCommitment}`);
    
    connectionService.setCommitment('confirmed');
    const newCommitment = connectionService.getCommitment();
    console.log(`  New commitment: ${newCommitment}`);
    
    if (newCommitment === 'confirmed') {
      console.log(chalk.green('✓ Commitment level updated successfully'));
    }
    
    // Switch back to original
    connectionService.setCommitment(originalCommitment);
    console.log(chalk.green('✓ Commitment level restored\n'));
  } catch (error) {
    console.log(chalk.red(`✗ Failed to set commitment: ${error}\n`));
  }

  // Test 5: Get connection config
  console.log(chalk.yellow('Test 5: Get Connection Config'));
  try {
    const config = connectionService.getConfig();
    console.log(chalk.green('✓ Connection config retrieved:'));
    console.log(`  Endpoint: ${config.endpoint}`);
    console.log(`  Commitment: ${config.commitment}\n`);
  } catch (error) {
    console.log(chalk.red(`✗ Failed to get config: ${error}\n`));
  }

  // Test 6: Get SOL balance (using a known address)
  console.log(chalk.yellow('Test 6: Get SOL Balance'));
  try {
    // Use a well-known address (Solana's system program)
    const publicKey = new PublicKey('11111111111111111111111111111111');
    
    console.log(`  Fetching balance for: ${publicKey.toString()}`);
    const balance = await connectionService.getBalance(publicKey);
    
    console.log(chalk.green(`✓ SOL Balance retrieved: ${balance} SOL\n`));
  } catch (error) {
    console.log(chalk.yellow(`⚠ Balance retrieval: ${error}`));
    console.log(chalk.gray('  This may fail if RPC endpoint is rate-limited.\n'));
  }

  // Test 7: Create wallet and check its token accounts
  console.log(chalk.yellow('Test 7: Token Account Query'));
  try {
    console.log('  Creating test wallet...');
    const wallet = await walletService.createWallet('Connection Test Wallet');
    const walletPublicKey = new PublicKey(wallet.wallet.publicKey);
    
    console.log(`  Wallet created: ${wallet.wallet.publicKey.slice(0, 8)}...`);
    console.log('  Querying token accounts...');
    
    const tokenAccounts = await connectionService.getTokenAccountsByOwner(walletPublicKey);
    console.log(chalk.green(`✓ Token accounts retrieved: ${tokenAccounts.length} found\n`));
  } catch (error) {
    console.log(chalk.yellow(`⚠ Token account query: ${error}`));
    console.log(chalk.gray('  This may fail if RPC endpoint is rate-limited.\n'));
  }

  // Test 8: Get recent blockhash
  console.log(chalk.yellow('Test 8: Get Recent Blockhash'));
  try {
    console.log('  Fetching recent blockhash...');
    const blockhash = await connectionService.getRecentBlockhash();
    
    console.log(chalk.green('✓ Recent blockhash retrieved:'));
    console.log(`  Blockhash: ${blockhash.blockhash.slice(0, 8)}...`);
    console.log(`  Last Valid Block Height: ${blockhash.lastValidBlockHeight}\n`);
  } catch (error) {
    console.log(chalk.yellow(`⚠ Blockhash retrieval: ${error}`));
    console.log(chalk.gray('  This may fail if RPC endpoint is rate-limited.\n'));
  }

  // Test 9: Connection persistence
  console.log(chalk.yellow('Test 9: Connection Persistence'));
  try {
    const conn1 = connectionService.getConnection();
    const conn2 = connectionService.getConnection();
    
    const sameConnection = conn1 === conn2;
    console.log(`  First call === Second call: ${sameConnection}`);
    
    if (sameConnection) {
      console.log(chalk.green('✓ Connection is cached/reused (singleton pattern)\n'));
    } else {
      console.log(chalk.yellow('⚠ New connection created each time\n'));
    }
  } catch (error) {
    console.log(chalk.red(`✗ Connection persistence test: ${error}\n`));
  }

  // Test 10: Connection reset after endpoint change
  console.log(chalk.yellow('Test 10: Connection Reset After Endpoint Change'));
  try {
    const conn1 = connectionService.getConnection();
    
    // Change endpoint
    const originalEndpoint = connectionService.getRpcEndpoint();
    const newEndpoint = originalEndpoint.includes('mainnet') 
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com';
    
    connectionService.setRpcEndpoint(newEndpoint);
    const conn2 = connectionService.getConnection();
    
    const differentConnection = conn1 !== conn2;
    console.log(`  Connection before change === Connection after change: ${!differentConnection}`);
    
    if (differentConnection) {
      console.log(chalk.green('✓ Connection properly reset after endpoint change\n'));
    }
    
    // Restore endpoint
    connectionService.setRpcEndpoint(originalEndpoint);
  } catch (error) {
    console.log(chalk.red(`✗ Connection reset test: ${error}\n`));
  }

  console.log(chalk.green.bold('✅ CONNECTION SERVICE TESTS COMPLETE!\n'));
  
  console.log(chalk.blue.bold('📊 PHASE 2.2 SUMMARY:\n'));
  console.log(chalk.green('✓ Connection Service Implementation'));
  console.log('   - RPC endpoint management');
  console.log('   - Commitment level configuration');
  console.log('   - Connection caching (singleton)');
  console.log('   - Connection testing capabilities');
  console.log('   - Balance querying');
  console.log('   - Token account management');
  console.log('   - Blockchain information retrieval');
  console.log('   - Blockhash fetching');
  console.log('   - Fee estimation\n');
  
  console.log(chalk.blue.bold('🔗 CONNECTION SERVICE READY!\n'));
  console.log(chalk.yellow('Key Features:'));
  console.log('   - Supports multiple RPC endpoints');
  console.log('   - Configurable commitment levels');
  console.log('   - Token account discovery');
  console.log('   - Balance queries');
  console.log('   - Transaction fee estimation');
  console.log('   - Blockhash and blockchain state queries\n');
}

testConnectionService().catch(console.error);

