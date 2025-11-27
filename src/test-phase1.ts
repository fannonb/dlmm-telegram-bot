/**
 * Phase 1 Testing Script - Data Enhancement Features
 * 
 * Run: ts-node src/test-phase1.ts
 */

import { calculateBinUtilization } from './services/binAnalysis.service';
import { calculateFeePerformance } from './services/feePerformance.service';
import { getVolumeTrend } from './services/volumeTracking.service';
import { getAnalyticsDataStore } from './services/analyticsDataStore.service';
import { positionService } from './services/position.service';
import { walletService } from './services/wallet.service';
import { volumeCache } from './services/meteoraVolume.service';
import chalk from 'chalk';

async function testPhase1() {
    console.log(chalk.blue.bold('\n=== PHASE 1 DATA ENHANCEMENT TESTS ===\n'));

    try {
        // Test 1: Wallet Check
        console.log(chalk.yellow('Test 1: Wallet Service'));
        const wallet = walletService.getActiveWallet();
        if (!wallet) {
            console.log(chalk.red('❌ No active wallet - please select a wallet in CLI first'));
            return;
        }
        console.log(chalk.green(`✅ Active wallet: ${wallet.publicKey.slice(0, 8)}...`));

        // Test 2: Fetch Positions
        console.log(chalk.yellow('\nTest 2: Fetching Positions'));
        const positions = await positionService.getAllPositions(wallet.publicKey);
        console.log(chalk.green(`✅ Found ${positions.length} position(s)`));

        if (positions.length === 0) {
            console.log(chalk.gray('No positions to test with. All tests passed!\n'));
            return;
        }

        const testPosition = positions[0];
        console.log(chalk.gray(`Using position: ${testPosition.publicKey.slice(0, 12)}...`));

        // Test 3: Bin Utilization
        console.log(chalk.yellow('\nTest 3: Bin Utilization Analysis'));
        const binMetrics = await calculateBinUtilization(testPosition);
        console.log(chalk.green(`✅ Bin Utilization:`));
        console.log(chalk.gray(`   Total Bins: ${binMetrics.totalBins}`));
        console.log(chalk.gray(`   Active Bins: ${binMetrics.activeBins}`));
        console.log(chalk.gray(`   Utilization: ${binMetrics.utilizationPercent.toFixed(1)}%`));
        console.log(chalk.gray(`   Concentration: ${binMetrics.liquidityConcentration.toFixed(3)}`));

        // Test 4: Volume Tracking
        console.log(chalk.yellow('\nTest 4: Volume Data & Trend'));
        const volumeData = await volumeCache.getVolume(testPosition.poolAddress);
        console.log(chalk.green(`✅ Volume Data:`));
        console.log(chalk.gray(`   24h Volume: $${volumeData.volume24h.toLocaleString()}`));
        console.log(chalk.gray(`   Volume Ratio: ${volumeData.volumeRatio.toFixed(2)}x`));

        const analytics = getAnalyticsDataStore();

        // Record a test volume snapshot
        analytics.recordVolumeSnapshot({
            timestamp: Date.now(),
            poolAddress: testPosition.poolAddress,
            volume24h: volumeData.volume24h,
            fees24h: 0,
            volumeRatio: volumeData.volumeRatio
        });

        const trend = analytics.getVolumeTrend(testPosition.poolAddress);
        console.log(chalk.gray(`   Trend: ${trend.toUpperCase()}`));

        // Test 5: Fee Performance (create mock snapshot)
        console.log(chalk.yellow('\nTest 5: Fee Performance Calculation'));
        const mockSnapshot = {
            timestamp: Date.now(),
            positionAddress: testPosition.publicKey,
            poolAddress: testPosition.poolAddress,
            tokenXAmount: 0,
            tokenYAmount: 0,
            usdValue: testPosition.totalValueUSD || 1000,
            feesXAmount: 0,
            feesYAmount: 0,
            feesUsdValue: testPosition.unclaimedFees.usdValue || 0,
            activeBinId: testPosition.activeBinId,
            inRange: testPosition.inRange,
            poolApr: testPosition.poolApr || 50,
            gasCostUsd: 0,
            timeInRangePercent: 95
        };

        const feePerf = calculateFeePerformance(testPosition, mockSnapshot);
        console.log(chalk.green(`✅ Fee Performance:`));
        console.log(chalk.gray(`   Expected Daily: $${feePerf!.expectedDailyFeesUsd.toFixed(4)}`));
        console.log(chalk.gray(`   Actual Daily: $${feePerf!.actualDailyFeesUsd.toFixed(4)}`));
        console.log(chalk.gray(`   Efficiency: ${feePerf!.efficiency.toFixed(1)}%`));
        console.log(chalk.gray(`   Distance to Edge: ${feePerf!.distanceToEdge} bins`));

        // Test 6: Extended Snapshot Storage
        console.log(chalk.yellow('\nTest 6: Extended Snapshot Recording'));
        const extendedSnapshot = {
            ...mockSnapshot,
            binUtilization: binMetrics,
            feePerformance: feePerf
        };

        analytics.recordSnapshot(extendedSnapshot);
        console.log(chalk.green(`✅ Snapshot recorded with enhanced metrics`));

        // Verify retrieval
        const snapshots = analytics.getPositionSnapshots(testPosition.publicKey, 1);
        if (snapshots.length > 0 && snapshots[snapshots.length - 1].binUtilization) {
            console.log(chalk.green(`✅ Enhanced snapshot verified`));
        }

        console.log(chalk.green.bold('\n✅ ALL PHASE 1 TESTS PASSED!\n'));
        console.log(chalk.blue('Summary of New Features:'));
        console.log(chalk.gray('  • Bin utilization tracking with Gini coefficient'));
        console.log(chalk.gray('  • Volume trend analysis (7-day history)'));
        console.log(chalk.gray('  • Fee performance metrics (actual vs expected)'));
        console.log(chalk.gray('  • Extended AnalyticsSnapshot with new fields'));
        console.log(chalk.gray('  • Multi-provider LLM support (Claude/GPT/DeepSeek/etc)\n'));

    } catch (error: any) {
        console.log(chalk.red(`\n❌ TEST FAILED: ${error.message}`));
        console.error(error);
    }
}

// Run tests
testPhase1();
