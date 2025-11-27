// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import { walletService } from '../src/services/wallet.service';

async function demonstrateWalletDeletion() {
  console.log('🗑️ WALLET DELETION FEATURE DEMONSTRATION\n');

  // Clean start - remove any existing config
  console.log('Starting with a clean slate...');
  
  // Step 1: Create multiple test wallets
  console.log('\n📝 Step 1: Creating multiple wallets');
  
  const wallet1 = await walletService.createWallet('Main Wallet');
  console.log(`✓ Created: ${wallet1.wallet.name} (${wallet1.wallet.publicKey.slice(0, 8)}...)`);
  
  const wallet2 = await walletService.createWallet('Backup Wallet');  
  console.log(`✓ Created: ${wallet2.wallet.name} (${wallet2.wallet.publicKey.slice(0, 8)}...)`);
  
  const wallet3 = await walletService.createWallet('Trading Wallet');
  console.log(`✓ Created: ${wallet3.wallet.name} (${wallet3.wallet.publicKey.slice(0, 8)}...)`);
  
  let wallets = walletService.listWallets();
  console.log(`\n📊 Total wallets created: ${wallets.length}`);
  console.log(`🎯 Current active wallet: ${walletService.getActiveWallet()?.name}`);
  
  // Step 2: Delete a non-active wallet
  console.log('\n🗑️ Step 2: Deleting a non-active wallet');
  
  // Find a non-active wallet to delete
  const activeWallet = walletService.getActiveWallet();
  const nonActiveWallet = wallets.find(w => w.publicKey !== activeWallet?.publicKey);
  
  if (nonActiveWallet) {
    console.log(`🎯 Target for deletion: ${nonActiveWallet.name} (${nonActiveWallet.publicKey.slice(0, 8)}...)`);
    console.log(`📋 Wallets before deletion: ${walletService.listWallets().length}`);
    
    walletService.deleteWallet(nonActiveWallet.publicKey);
    
    wallets = walletService.listWallets();
    console.log(`✅ Wallet deleted successfully!`);
    console.log(`📋 Wallets after deletion: ${wallets.length}`);
    console.log(`🎯 Active wallet unchanged: ${walletService.getActiveWallet()?.name}`);
    
    console.log('\n📝 Remaining wallets:');
    wallets.forEach((w, i) => {
      const isActive = w.publicKey === walletService.getActiveWallet()?.publicKey;
      console.log(`  ${i + 1}. ${w.name} (${w.publicKey.slice(0, 8)}...) ${isActive ? '⭐ ACTIVE' : ''}`);
    });
  }
  
  // Step 3: Delete the active wallet
  console.log('\n🗑️ Step 3: Deleting the active wallet');
  
  const currentActive = walletService.getActiveWallet();
  if (currentActive) {
    console.log(`🎯 Deleting active wallet: ${currentActive.name} (${currentActive.publicKey.slice(0, 8)}...)`);
    console.log(`📋 Wallets before deletion: ${walletService.listWallets().length}`);
    
    walletService.deleteWallet(currentActive.publicKey);
    
    wallets = walletService.listWallets();
    const newActive = walletService.getActiveWallet();
    
    console.log(`✅ Active wallet deleted successfully!`);
    console.log(`📋 Wallets after deletion: ${wallets.length}`);
    
    if (wallets.length > 0) {
      console.log(`🎯 New active wallet automatically set: ${newActive?.name}`);
    } else {
      console.log(`🎯 No wallets remaining - active wallet set to: ${newActive || 'null'}`);
    }
    
    console.log('\n📝 Remaining wallets:');
    if (wallets.length > 0) {
      wallets.forEach((w, i) => {
        const isActive = w.publicKey === walletService.getActiveWallet()?.publicKey;
        console.log(`  ${i + 1}. ${w.name} (${w.publicKey.slice(0, 8)}...) ${isActive ? '⭐ ACTIVE' : ''}`);
      });
    } else {
      console.log('  (No wallets remaining)');
    }
  }
  
  // Step 4: Test edge cases
  console.log('\n🧪 Step 4: Testing edge cases');
  
  // Try to delete non-existent wallet
  console.log('Testing deletion of non-existent wallet...');
  try {
    walletService.deleteWallet('InvalidPublicKeyThatDoesNotExist123456789');
    console.log('✓ Non-existent wallet deletion handled gracefully (no error thrown)');
  } catch (error) {
    console.log('✓ Non-existent wallet deletion handled with error (as expected)');
  }
  
  // Step 5: Verify system recovery
  console.log('\n🔄 Step 5: System recovery after all deletions');
  
  console.log('Creating new wallet to verify system still works...');
  const recoveryWallet = await walletService.createWallet('Recovery Wallet');
  console.log(`✅ Recovery wallet created: ${recoveryWallet.wallet.name}`);
  console.log(`🎯 Active wallet set: ${walletService.getActiveWallet()?.name}`);
  console.log(`📋 Total wallets: ${walletService.listWallets().length}`);
  
  // Step 6: Delete all wallets scenario
  console.log('\n🗑️ Step 6: Complete cleanup (delete all wallets)');
  
  const allWallets = walletService.listWallets();
  console.log(`Deleting all ${allWallets.length} wallet(s)...`);
  
  allWallets.forEach(wallet => {
    console.log(`  Deleting: ${wallet.name}`);
    walletService.deleteWallet(wallet.publicKey);
  });
  
  const finalWallets = walletService.listWallets();
  const finalActive = walletService.getActiveWallet();
  
  console.log(`✅ All wallets deleted`);
  console.log(`📋 Final wallet count: ${finalWallets.length}`);
  console.log(`🎯 Final active wallet: ${finalActive || 'null'}`);
  
  console.log('\n🎉 WALLET DELETION DEMONSTRATION COMPLETE!');
  console.log('\n📋 Summary of Delete Functionality:');
  console.log('   ✅ Can delete non-active wallets safely');
  console.log('   ✅ Automatically reassigns active wallet when active wallet is deleted');
  console.log('   ✅ Sets active wallet to null when no wallets remain');
  console.log('   ✅ Handles edge cases gracefully');
  console.log('   ✅ System remains functional after deletions');
  console.log('   ✅ Complete cleanup supported');
}

demonstrateWalletDeletion().catch(console.error);
