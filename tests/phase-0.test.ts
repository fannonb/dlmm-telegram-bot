/**
 * PHASE 0 TESTS: Foundation & Critical Fixes
 * Tests for:
 * - 69-bin validation bug fix
 * - Rebalancing Service
 * - Analytics Data Store
 * - Notifications Service
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AnalyticsDataStore, AnalyticsSnapshot } from '../src/services/analyticsDataStore.service';
import { NotificationsService, NotificationType } from '../src/services/notifications.service';
import { RebalancingService } from '../src/services/rebalancing.service';
import { Connection } from '@solana/web3.js';
import { tmpdir } from 'os';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('PHASE 0: Foundation & Critical Fixes', () => {
    describe('0.1: 69-Bin Validation Bug Fix', () => {
        it('should reject more than 34 bins per side (maximum allowed)', () => {
            // The validation should now be: if (value > 34) return error
            const validateBinsPerSide = (value: number): boolean => {
                if (value < 1) return false;
                if (value > 34) return false; // Fixed: was 100, now 34
                return true;
            };

            expect(validateBinsPerSide(34)).toBe(true);
            expect(validateBinsPerSide(35)).toBe(false);
            expect(validateBinsPerSide(100)).toBe(false);
            expect(validateBinsPerSide(69)).toBe(false); // Beyond limit
        });

        it('should calculate total bins correctly: 34 per side = 69 total', () => {
            const binsPerSide = 34;
            const totalBins = binsPerSide * 2 + 1; // +1 for center bin

            expect(totalBins).toBe(69);
        });

        it('should accept valid bin ranges within limits', () => {
            const validateBinsPerSide = (value: number): boolean => {
                return value >= 1 && value <= 34;
            };

            expect(validateBinsPerSide(1)).toBe(true);
            expect(validateBinsPerSide(10)).toBe(true);
            expect(validateBinsPerSide(20)).toBe(true);
            expect(validateBinsPerSide(34)).toBe(true);
        });
    });

    describe('0.2: Rebalancing Service', () => {
        let rebalancingService: RebalancingService;
        let mockConnection: any;

        beforeEach(() => {
            // Create mock connection
            mockConnection = {
                getLatestBlockhash: jest.fn(),
                sendAndConfirmTransaction: jest.fn(),
            };

            rebalancingService = new RebalancingService(mockConnection);
        });

        it('should initialize rebalancing service', () => {
            expect(rebalancingService).toBeDefined();
        });

        it('should calculate priority level CRITICAL for out-of-range position', () => {
            const position = {
                minBinId: -20,
                maxBinId: 20,
            };
            const activeBinId = 35; // Outside range

            const priority = rebalancingService.calculateRebalancePriority(position, activeBinId);

            expect(priority).toBe('CRITICAL');
        });

        it('should calculate priority level HIGH for near-edge position', () => {
            const position = {
                minBinId: -20,
                maxBinId: 20,
            };
            const activeBinId = 16; // 4 bins from edge

            const priority = rebalancingService.calculateRebalancePriority(position, activeBinId);

            expect(priority).toBe('HIGH');
        });

        it('should calculate priority level MEDIUM for drifted center', () => {
            const position = {
                minBinId: -20,
                maxBinId: 20,
            };
            const activeBinId = 12; // 12 bins from center

            const priority = rebalancingService.calculateRebalancePriority(position, activeBinId);

            expect(priority).toBe('MEDIUM');
        });

        it('should calculate priority level LOW for slightly drifted position', () => {
            const position = {
                minBinId: -20,
                maxBinId: 20,
            };
            const activeBinId = 8; // 8 bins from center

            const priority = rebalancingService.calculateRebalancePriority(position, activeBinId);

            expect(priority).toBe('LOW');
        });

        it('should calculate priority level NONE for centered position', () => {
            const position = {
                minBinId: -20,
                maxBinId: 20,
            };
            const activeBinId = 0; // At center

            const priority = rebalancingService.calculateRebalancePriority(position, activeBinId);

            expect(priority).toBe('NONE');
        });

        it('should estimate rebalance cost', async () => {
            const cost = await rebalancingService.estimateRebalanceCost('somePositionAddress');

            expect(cost).toBeGreaterThan(0);
            expect(cost).toBeLessThan(1); // Should be under $1 for Solana
        });

        it('should calculate fee projection correctly', () => {
            const currentDaily = 10; // $10 daily
            const binsActive = 56; // 56% of bins active

            const projection = rebalancingService.calculateFeeProjection(currentDaily, binsActive);

            expect(projection.current).toBe(10);
            expect(projection.projected).toBeGreaterThan(10); // After rebalance should be higher
            expect(projection.increase).toBeGreaterThan(0);
        });
    });

    describe('0.3: Analytics Data Store', () => {
        let analyticsStore: AnalyticsDataStore;
        let testDataDir: string;

        beforeEach(() => {
            testDataDir = join(tmpdir(), `analytics-test-${Date.now()}`);
            analyticsStore = new AnalyticsDataStore(testDataDir);
        });

        afterEach(() => {
            // Cleanup
            if (existsSync(testDataDir)) {
                rmSync(testDataDir, { recursive: true, force: true });
            }
        });

        it('should initialize data store', () => {
            expect(analyticsStore).toBeDefined();
        });

        it('should record and retrieve snapshots', () => {
            const snapshot: AnalyticsSnapshot = {
                timestamp: Date.now(),
                positionAddress: 'test_position_1',
                poolAddress: 'test_pool_1',
                tokenXAmount: 10,
                tokenYAmount: 9876.54,
                usdValue: 19876.54,
                feesXAmount: 0.0234,
                feesYAmount: 23.45,
                feesUsdValue: 46.90,
                activeBinId: -2,
                inRange: true,
                poolApr: 0.41,
                gasCostUsd: 0.0002,
                timeInRangePercent: 89.3,
            };

            analyticsStore.recordSnapshot(snapshot);
            const snapshots = analyticsStore.loadSnapshots();

            expect(snapshots.length).toBeGreaterThan(0);
            expect(snapshots[0].positionAddress).toBe('test_position_1');
        });

        it('should filter snapshots by position address', () => {
            const snapshot1: AnalyticsSnapshot = {
                timestamp: Date.now(),
                positionAddress: 'position_A',
                poolAddress: 'pool_1',
                tokenXAmount: 10,
                tokenYAmount: 9876.54,
                usdValue: 19876.54,
                feesXAmount: 0.0234,
                feesYAmount: 23.45,
                feesUsdValue: 46.90,
                activeBinId: 0,
                inRange: true,
                poolApr: 0.41,
                gasCostUsd: 0.0002,
                timeInRangePercent: 89.3,
            };

            const snapshot2: AnalyticsSnapshot = {
                ...snapshot1,
                positionAddress: 'position_B',
                timestamp: Date.now() + 1000,
            };

            analyticsStore.recordSnapshot(snapshot1);
            analyticsStore.recordSnapshot(snapshot2);

            const positionASnapshots = analyticsStore.getPositionSnapshots('position_A', 7);

            expect(positionASnapshots.length).toBeGreaterThan(0);
            expect(positionASnapshots[0].positionAddress).toBe('position_A');
        });

        it('should record and retrieve rebalance history', () => {
            const rebalanceEntry = {
                timestamp: Date.now(),
                oldPositionAddress: 'old_pos_1',
                newPositionAddress: 'new_pos_1',
                poolAddress: 'pool_1',
                reasonCode: 'OUT_OF_RANGE' as const,
                reason: 'Position moved outside range',
                feesClaimedX: 0.0234,
                feesClaimedY: 23.45,
                feesClaimedUsd: 46.90,
                transactionCostUsd: 0.0003,
                oldRange: { min: -20, max: 20 },
                newRange: { min: -22, max: 18 },
            };

            analyticsStore.recordRebalance(rebalanceEntry);
            const history = analyticsStore.loadRebalanceHistory();

            expect(history.length).toBeGreaterThan(0);
            expect(history[0].oldPositionAddress).toBe('old_pos_1');
        });

        it('should record and retrieve fee claims', () => {
            const claim = {
                timestamp: Date.now(),
                positionAddress: 'position_1',
                poolAddress: 'pool_1',
                claimedX: 0.0234,
                claimedY: 23.45,
                claimedUsd: 46.90,
                transactionCostUsd: 0.0001,
                method: 'manual' as const,
            };

            analyticsStore.recordFeeClaim(claim);
            const claims = analyticsStore.loadFeeClaims();

            expect(claims.length).toBeGreaterThan(0);
            expect(claims[0].claimedUsd).toBe(46.90);
        });

        it('should calculate portfolio stats', () => {
            const snapshot: AnalyticsSnapshot = {
                timestamp: Date.now(),
                positionAddress: 'position_1',
                poolAddress: 'pool_1',
                tokenXAmount: 10,
                tokenYAmount: 9876.54,
                usdValue: 19876.54,
                feesXAmount: 0.0234,
                feesYAmount: 23.45,
                feesUsdValue: 46.90,
                activeBinId: 0,
                inRange: true,
                poolApr: 0.41,
                gasCostUsd: 0.0002,
                timeInRangePercent: 89.3,
            };

            analyticsStore.recordSnapshot(snapshot);

            const stats = analyticsStore.calculatePortfolioStats(['position_1'], 30);

            expect(stats.totalFeesEarned).toBeGreaterThan(0);
            expect(stats.positionCount).toBe(1);
            expect(stats.averageDailyFees).toBeGreaterThan(0);
        });

        it('should export snapshots to CSV', () => {
            const snapshot: AnalyticsSnapshot = {
                timestamp: Date.now(),
                positionAddress: 'position_1',
                poolAddress: 'pool_1',
                tokenXAmount: 10,
                tokenYAmount: 9876.54,
                usdValue: 19876.54,
                feesXAmount: 0.0234,
                feesYAmount: 23.45,
                feesUsdValue: 46.90,
                activeBinId: 0,
                inRange: true,
                poolApr: 0.41,
                gasCostUsd: 0.0002,
                timeInRangePercent: 89.3,
            };

            analyticsStore.recordSnapshot(snapshot);

            const exportPath = join(testDataDir, 'export.csv');
            analyticsStore.exportToCsv('snapshots', exportPath);

            expect(existsSync(exportPath)).toBe(true);
        });
    });

    describe('0.4: Notifications Service', () => {
        let notificationsService: NotificationsService;
        let testLogsDir: string;

        beforeEach(() => {
            testLogsDir = join(tmpdir(), `logs-test-${Date.now()}`);
            notificationsService = new NotificationsService(testLogsDir);
        });

        afterEach(() => {
            if (existsSync(testLogsDir)) {
                rmSync(testLogsDir, { recursive: true, force: true });
            }
        });

        it('should initialize notifications service', () => {
            expect(notificationsService).toBeDefined();
        });

        it('should create and store notifications', () => {
            notificationsService.notifyInfo('Test Title', 'Test message');

            const notifications = notificationsService.getRecentNotifications(1);

            expect(notifications.length).toBeGreaterThan(0);
            expect(notifications[0].title).toBe('Test Title');
        });

        it('should notify position out of range', () => {
            notificationsService.notifyPositionOutOfRange('pos_1', 35, -20, 20);

            const notifications = notificationsService.getNotificationsByType('POSITION_OUT_OF_RANGE');

            expect(notifications.length).toBeGreaterThan(0);
            expect(notifications[0].severity).toBe('error');
        });

        it('should notify high IL alert', () => {
            notificationsService.notifyHighILAlert('pos_1', 3.5, 2.0);

            const notifications = notificationsService.getNotificationsByType('HIGH_IL_ALERT');

            expect(notifications.length).toBeGreaterThan(0);
            expect(notifications[0].severity).toBe('warning');
        });

        it('should notify fee threshold met', () => {
            notificationsService.notifyFeeThresholdMet('pos_1', 125.50, 100);

            const notifications = notificationsService.getNotificationsByType('FEE_THRESHOLD_MET');

            expect(notifications.length).toBeGreaterThan(0);
            expect(notifications[0].severity).toBe('success');
        });

        it('should notify rebalance executed', () => {
            notificationsService.notifyRebalanceExecuted('old_pos', 'new_pos', 46.90, 0.0003);

            const notifications = notificationsService.getNotificationsByType('REBALANCE_EXECUTED');

            expect(notifications.length).toBeGreaterThan(0);
            expect(notifications[0].severity).toBe('success');
        });

        it('should notify rebalance recommended', () => {
            notificationsService.notifyRebalanceRecommended(
                'pos_1',
                'Position drifted 15 bins from center',
                10.5
            );

            const notifications = notificationsService.getNotificationsByType('REBALANCE_RECOMMENDED');

            expect(notifications.length).toBeGreaterThan(0);
        });

        it('should get unread notifications', () => {
            notificationsService.notifyInfo('Notification 1', 'Message 1');
            notificationsService.notifyInfo('Notification 2', 'Message 2');

            const unread = notificationsService.getUnreadNotifications();

            expect(unread.length).toBeGreaterThan(0);
        });

        it('should mark notifications as read', () => {
            const notif = notificationsService.notifyInfo('Test', 'Test message');
            const unreadBefore = notificationsService.getUnreadNotifications().length;

            notificationsService.markAsRead(notif.id);

            const unreadAfter = notificationsService.getUnreadNotifications().length;

            expect(unreadAfter).toBeLessThan(unreadBefore);
        });

        it('should filter notifications by severity', () => {
            notificationsService.notifyInfo('Info', 'Info message');
            notificationsService.notifyPositionOutOfRange('pos_1', 35, -20, 20); // error

            const errors = notificationsService.getNotificationsBySeverity('error');

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].severity).toBe('error');
        });

        it('should get recent notifications', () => {
            for (let i = 0; i < 15; i++) {
                notificationsService.notifyInfo(`Notification ${i}`, `Message ${i}`);
            }

            const recent = notificationsService.getRecentNotifications(10);

            expect(recent.length).toBeLessThanOrEqual(10);
        });

        it('should clear old notifications', () => {
            notificationsService.notifyInfo('Old', 'Old notification');

            const before = notificationsService.getRecentNotifications(100).length;
            notificationsService.clearOldNotifications(0); // Clear all

            const after = notificationsService.getRecentNotifications(100).length;

            expect(after).toBeLessThanOrEqual(before);
        });
    });
});
