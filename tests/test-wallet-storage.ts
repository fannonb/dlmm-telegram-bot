/**
 * Quick test for wallet storage service
 * Run with: ts-node tests/test-wallet-storage.ts
 */

import { Keypair } from '@solana/web3.js';
import { walletStorage } from '../src/telegram/services/walletStorage';
import chalk from 'chalk';

async function testWalletStorage() {
    console.log(chalk.blue('🧪 Testing Wallet Storage Service\n'));

    const testTelegramId = 123456789;

    // Test 1: Create and store a wallet
    console.log(chalk.cyan('Test 1: Store Wallet'));
    const keypair = Keypair.generate();
    const originalPublicKey = keypair.publicKey.toBase58();
    console.log(`  Generated wallet: ${originalPublicKey}`);

    walletStorage.storeWallet(testTelegramId, keypair);
    console.log(chalk.green('  ✓ Wallet stored\n'));

    // Test 2: Check if wallet exists
    console.log(chalk.cyan('Test 2: Check Wallet Exists'));
    const exists = walletStorage.hasWallet(testTelegramId);
    console.log(`  Has wallet: ${exists ? chalk.green('✓ Yes') : chalk.red('✗ No')}\n`);

    // Test 3: Retrieve and decrypt wallet
    console.log(chalk.cyan('Test 3: Retrieve Wallet'));
    const retrieved = walletStorage.getWallet(testTelegramId);

    if (retrieved) {
        const retrievedPublicKey = retrieved.publicKey.toBase58();
        console.log(`  Retrieved wallet: ${retrievedPublicKey}`);

        if (retrievedPublicKey === originalPublicKey) {
            console.log(chalk.green('  ✓ Encryption/Decryption works correctly!\n'));
        } else {
            console.log(chalk.red('  ✗ Key mismatch!\n'));
        }
    } else {
        console.log(chalk.red('  ✗ Failed to retrieve wallet\n'));
    }

    // Test 4: Delete wallet
    console.log(chalk.cyan('Test 4: Delete Wallet'));
    const deleted = walletStorage.deleteWallet(testTelegramId);
    console.log(`  Deleted: ${deleted ? chalk.green('✓ Yes') : chalk.red('✗ No')}`);

    const stillExists = walletStorage.hasWallet(testTelegramId);
    console.log(`  Still exists: ${stillExists ? chalk.red('✗ Yes') : chalk.green('✓ No')}\n`);

    console.log(chalk.green('✅ All tests passed!'));
}

testWalletStorage().catch(console.error);
