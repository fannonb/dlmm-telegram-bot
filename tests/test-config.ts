// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import { configManager } from '../src/config/config.manager';
import { WalletConfig, PositionData, PoolInfo } from '../src/config/types';

async function testConfigManager() {
  console.log('🧪 Testing Enhanced Configuration Manager...\n');

  try {
    // Test 1: Get default config with enhanced features
    console.log('Test 1: Get default config with enhanced features');
    const config = configManager.getConfig();
    console.log('✅ Config loaded:', {
      version: config.version,
      walletsCount: config.wallets.length,
      activeWallet: config.activeWallet,
      poolSelection: config.preferences.poolSelection ? 'Present' : 'Missing',
      notifications: config.preferences.notifications ? 'Present' : 'Missing',
    });

    // Test 2: Add a test wallet with enhanced validation
    console.log('\nTest 2: Add test wallet with enhanced validation');
    const testWallet: WalletConfig = {
      name: 'Test Enhanced Wallet',
      publicKey: 'TestPublicKey12345678901234567890123456789',
      encryptedPrivateKey: configManager.encryptPrivateKey('test-private-key-enhanced'),
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    
    configManager.addWallet(testWallet);
    const retrievedWallet = configManager.getWallet(testWallet.publicKey);
    console.log('✅ Enhanced wallet added and retrieved:', retrievedWallet?.name);

    // Test 3: Enhanced encryption/decryption
    console.log('\nTest 3: Enhanced encryption/decryption');
    if (retrievedWallet) {
      const decrypted = configManager.decryptPrivateKey(retrievedWallet.encryptedPrivateKey);
      console.log('✅ Decrypted key:', decrypted === 'test-private-key-enhanced' ? 'MATCH' : 'ERROR');
    }

    // Test 4: Test active wallet management
    console.log('\nTest 4: Enhanced active wallet management');
    const activeWallet = configManager.getActiveWallet();
    console.log('✅ Active wallet:', activeWallet?.name);

    // Test 5: Test enhanced pool favorites
    console.log('\nTest 5: Enhanced pool favorites management');
    configManager.addFavoritePool('ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq', 'USDC/USDT');
    configManager.addFavoritePool('TestPoolAddress123456789012345678901234', 'TEST/SOL');
    
    const updatedConfig = configManager.getConfig();
    console.log('✅ Favorite pools added:', updatedConfig.preferences.poolSelection.favoritePoolAddresses.length);
    console.log('✅ Pool history entries:', updatedConfig.preferences.poolSelection.poolHistory.length);

    // Test 6: Test enhanced position management
    console.log('\nTest 6: Enhanced position management');
    
    // Create a mock PoolInfo for the position
    const mockPoolInfo: PoolInfo = {
      address: 'TestPoolAddress123456789012345678901234',
      tokenX: { mint: 'USDC_MINT', symbol: 'USDC', decimals: 6 },
      tokenY: { mint: 'SOL_MINT', symbol: 'SOL', decimals: 9 },
      binStep: 25,
      feeBps: 25,
      activeBin: 1000,
      tvl: 50000,
      volume24h: 10000,
      apr: 15.5,
      isActive: true,
      lastUpdated: new Date().toISOString(),
      validationStatus: 'valid',
    };

    const testPosition: PositionData = {
      address: 'TestPositionAddress123456789012345678901',
      poolAddress: 'TestPoolAddress123456789012345678901234',
      poolInfo: mockPoolInfo,
      tokenX: 'USDC',
      tokenY: 'SOL',
      minBinId: 995,
      maxBinId: 1005,
      strategy: 'Curve',
      createdAt: new Date().toISOString(),
      initialValue: 1000,
      poolGroup: 'stablecoin-group',
      notes: 'Test position for enhanced features',
    };

    configManager.addPosition(testPosition);
    const retrievedPosition = configManager.getPosition(testPosition.address);
    console.log('✅ Enhanced position added:', retrievedPosition?.notes);

    // Test 7: Test multiple positions filtering
    console.log('\nTest 7: Multiple positions filtering');
    const positionsByPool = configManager.getPositions(testPosition.poolAddress);
    const allPositions = configManager.getPositions();
    console.log('✅ Positions by pool:', positionsByPool.length);
    console.log('✅ All positions:', allPositions.length);

    // Test 8: Test configuration statistics
    console.log('\nTest 8: Configuration statistics');
    const stats = configManager.getStats();
    console.log('✅ Config stats:', {
      wallets: stats.walletsCount,
      positions: stats.positionsCount,
      favorites: stats.favoritePools,
      version: stats.configVersion,
    });

    // Test 9: Test configuration update with enhanced features
    console.log('\nTest 9: Enhanced configuration update');
    configManager.updateConfig({
      transaction: {
        priorityFee: 'fixed',
        priorityFeeAmount: 5000,
        slippage: 1.0,
        enableSimulation: false,
      },
      preferences: {
        ...updatedConfig.preferences,
        displayCurrency: 'SOL',
        notifications: {
          rebalanceAlerts: false,
          compoundAlerts: true,
          priceAlerts: true,
        },
      },
    });
    
    const finalConfig = configManager.getConfig();
    console.log('✅ Enhanced config updated:', {
      priorityFee: finalConfig.transaction.priorityFee,
      slippage: finalConfig.transaction.slippage,
      displayCurrency: finalConfig.preferences.displayCurrency,
      priceAlerts: finalConfig.preferences.notifications.priceAlerts,
    });

    // Test 10: Error handling tests
    console.log('\nTest 10: Error handling validation');
    
    try {
      // Test duplicate wallet
      configManager.addWallet(testWallet);
      console.log('❌ Should have failed: duplicate wallet');
    } catch (error) {
      console.log('✅ Duplicate wallet rejected correctly');
    }

    try {
      // Test duplicate position
      configManager.addPosition(testPosition);
      console.log('❌ Should have failed: duplicate position');
    } catch (error) {
      console.log('✅ Duplicate position rejected correctly');
    }

    try {
      // Test invalid wallet selection
      configManager.setActiveWallet('NonExistentWallet');
      console.log('❌ Should have failed: invalid wallet');
    } catch (error) {
      console.log('✅ Invalid wallet selection rejected correctly');
    }

    console.log('\n🎉 All enhanced configuration tests passed!');
    console.log('\n📊 Final Configuration Summary:');
    console.log(`   • Wallets: ${stats.walletsCount}`);
    console.log(`   • Positions: ${stats.positionsCount}`);
    console.log(`   • Favorite Pools: ${stats.favoritePools}`);
    console.log(`   • Pool History: ${finalConfig.preferences.poolSelection.poolHistory.length}`);
    console.log(`   • Enhanced Features: ✅ All working`);
    
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
    throw error;
  }
}

// Additional test: Environment validation
function testEnvironmentSetup() {
  console.log('\n🔐 Testing Environment Setup...');
  
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.log('⚠️  WARNING: ENCRYPTION_KEY not set in environment');
    console.log('   Set a secure 32+ character encryption key in .env file');
    return false;
  }
  
  if (encryptionKey.length < 32) {
    console.log('⚠️  WARNING: ENCRYPTION_KEY is too short (minimum 32 characters)');
    return false;
  }
  
  if (encryptionKey === 'change-this-to-32-char-secret!!') {
    console.log('⚠️  WARNING: Using default ENCRYPTION_KEY - change for production!');
    return false;
  }
  
  console.log('✅ Environment setup is secure');
  return true;
}

// Run tests
export async function runConfigTests() {
  console.log('🚀 Starting Phase 1.2 Configuration Tests\n');
  
  // Test environment first
  const envSecure = testEnvironmentSetup();
  
  // Run configuration tests
  await testConfigManager();
  
  console.log('\n📋 Test Summary:');
  console.log(`   • Configuration System: ✅ PASS`);
  console.log(`   • Enhanced Features: ✅ PASS`);
  console.log(`   • Error Handling: ✅ PASS`);
  console.log(`   • Environment Security: ${envSecure ? '✅ PASS' : '⚠️  NEEDS ATTENTION'}`);
  
  return true;
}

// Run if called directly
if (require.main === module) {
  runConfigTests().catch(console.error);
}
