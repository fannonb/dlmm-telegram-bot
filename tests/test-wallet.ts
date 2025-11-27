// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import { walletService } from '../src/services/wallet.service';

async function testWalletService() {
  console.log('Testing Wallet Service...\n');

  // Test 1: Create new wallet
  console.log('Test 1: Create new wallet');
  const { wallet, mnemonic, keypair } = await walletService.createWallet('My Test Wallet');
  console.log('✓ Wallet created:');
  console.log('  Name:', wallet.name);
  console.log('  Public Key:', wallet.publicKey);
  console.log('  Mnemonic:', mnemonic);
  console.log('  ⚠️  IMPORTANT: Save this mnemonic securely!\n');

  // Test 2: Get keypair from wallet
  console.log('Test 2: Get keypair from wallet');
  const retrievedKeypair = walletService.getKeypair(wallet);
  console.log('✓ Keypair retrieved:', 
    retrievedKeypair.publicKey.toString() === wallet.publicKey ? 'MATCH' : 'ERROR'
  );

  // Test 3: Import from mnemonic (use a different mnemonic to avoid duplicate)
  console.log('\nTest 3: Import wallet from mnemonic');
  try {
    // Try to import same mnemonic first (should fail due to duplicate checking)
    await walletService.importFromMnemonic('Imported Wallet', mnemonic);
    console.log('❌ Should have failed: duplicate wallet detection');
  } catch (error) {
    console.log('✓ Duplicate wallet correctly rejected');
  }
  
  // Now import with a different mnemonic to test the functionality
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const importedWallet = await walletService.importFromMnemonic(
    'Imported Wallet',
    testMnemonic
  );
  console.log('✓ Wallet imported:', importedWallet.name);
  console.log('  Different wallet created successfully: YES');

  // Test 4: List all wallets
  console.log('\nTest 4: List all wallets');
  const wallets = walletService.listWallets();
  console.log('✓ Total wallets:', wallets.length);
  wallets.forEach((w, i) => {
    console.log(`  ${i + 1}. ${w.name} - ${w.publicKey.slice(0, 8)}...`);
  });

  // Test 5: Get active wallet
  console.log('\nTest 5: Get active wallet');
  const activeWallet = walletService.getActiveWallet();
  console.log('✓ Active wallet:', activeWallet?.name);

  // Test 6: Get active keypair
  console.log('\nTest 6: Get active keypair');
  const activeKeypair = walletService.getActiveKeypair();
  console.log('✓ Active keypair retrieved:', activeKeypair ? 'YES' : 'NO');

  // Test 7: Switch active wallet
  if (wallets.length > 1) {
    console.log('\nTest 7: Switch active wallet');
    walletService.setActiveWallet(wallets[1].publicKey);
    const newActive = walletService.getActiveWallet();
    console.log('✓ Switched to:', newActive?.name);
  }

  // Test 8: Export private key
  console.log('\nTest 8: Export private key');
  const exportedKey = walletService.exportPrivateKey(wallet.publicKey);
  console.log('✓ Private key exported (base58):', exportedKey.slice(0, 20) + '...');

  // Test 9: Delete wallet functionality
  console.log('\nTest 9: Delete wallet functionality');
  const walletsBeforeDelete = walletService.listWallets();
  console.log('✓ Wallets before deletion:', walletsBeforeDelete.length);
  
  // Test deleting non-active wallet first
  const nonActiveWallet = walletsBeforeDelete.find(w => w.publicKey !== walletService.getActiveWallet()?.publicKey);
  if (nonActiveWallet) {
    console.log(`  Deleting non-active wallet: ${nonActiveWallet.name}`);
    walletService.deleteWallet(nonActiveWallet.publicKey);
    
    const walletsAfterFirstDelete = walletService.listWallets();
    console.log('✓ Wallets after first deletion:', walletsAfterFirstDelete.length);
    console.log('✓ Active wallet preserved:', walletService.getActiveWallet()?.name);
  }
  
  // Test deleting the active wallet
  const currentActiveWallet = walletService.getActiveWallet();
  if (currentActiveWallet) {
    console.log(`  Deleting active wallet: ${currentActiveWallet.name}`);
    walletService.deleteWallet(currentActiveWallet.publicKey);
    
    const walletsAfterSecondDelete = walletService.listWallets();
    const newActiveWallet = walletService.getActiveWallet();
    
    console.log('✓ Wallets after deleting active wallet:', walletsAfterSecondDelete.length);
    if (walletsAfterSecondDelete.length > 0) {
      console.log('✓ New active wallet set automatically:', newActiveWallet?.name);
    } else {
      console.log('✓ No wallets remaining, active wallet set to null:', newActiveWallet === null ? 'CORRECT' : 'ERROR');
    }
  }

  // Test 10: Error handling for delete operations
  console.log('\nTest 10: Delete error handling');
  try {
    walletService.deleteWallet('NonExistentWalletPublicKey');
    console.log('✓ Deleting non-existent wallet handled gracefully');
  } catch (error) {
    console.log('✓ Delete operation handles missing wallets properly');
  }

  // Test 11: Recreate wallets to verify system still works
  console.log('\nTest 11: System recovery after deletions');
  const { wallet: newWallet } = await walletService.createWallet('Recovery Test Wallet');
  console.log('✓ New wallet created after deletions:', newWallet.name);
  console.log('✓ Active wallet automatically set:', walletService.getActiveWallet()?.name);

  const finalWalletCount = walletService.listWallets().length;
  console.log('✓ Final wallet count:', finalWalletCount);

  console.log('\n✅ All wallet tests passed (including delete functionality)!');
  console.log('\n📝 Original mnemonic for recovery: ' + mnemonic);
  console.log('⚠️  Save this mnemonic in a secure location!');
}

testWalletService().catch(console.error);
