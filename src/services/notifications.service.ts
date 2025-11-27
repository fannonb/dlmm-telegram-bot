import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export type NotificationType =
    | 'POSITION_OUT_OF_RANGE'
    | 'HIGH_IL_ALERT'
    | 'FEE_THRESHOLD_MET'
    | 'REBALANCE_EXECUTED'
    | 'REBALANCE_RECOMMENDED'
    | 'AUTO_REBALANCE_FAILED'
    | 'AUTO_CLAIM_EXECUTED'
    | 'AUTO_CLAIM_FAILED'
    | 'SYSTEM_ERROR'
    | 'INFO';

export interface Notification {
    id: string;
    timestamp: number;
    type: NotificationType;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'success';
    positionAddress?: string;
    poolAddress?: string;
    metadata?: Record<string, any>;
    read: boolean;
}

export class NotificationsService {
    private logsDir: string;
    private logsFile: string;
    private notificationsFile: string;
    private notifications: Notification[] = [];

    constructor(logsDir: string = './data/logs') {
        this.logsDir = logsDir;
        this.logsFile = join(this.logsDir, 'notifications.log');
        this.notificationsFile = join(this.logsDir, 'notifications.json');

        this.initializeLogsDirectory();
        this.loadNotifications();
    }

    /**
     * Initialize logs directory
     */
    private initializeLogsDirectory(): void {
        try {
            const fs = require('fs');
            if (!fs.existsSync(this.logsDir)) {
                fs.mkdirSync(this.logsDir, { recursive: true });
                console.log(chalk.green(`✓ Logs directory created: ${this.logsDir}`));
            }

            if (!existsSync(this.logsFile)) {
                writeFileSync(this.logsFile, '');
            }
            if (!existsSync(this.notificationsFile)) {
                writeFileSync(this.notificationsFile, JSON.stringify([], null, 2));
            }
        } catch (error) {
            console.error(chalk.red('Error initializing logs directory:'), error);
        }
    }

    /**
     * Load notifications from file
     */
    private loadNotifications(): void {
        try {
            const data = readFileSync(this.notificationsFile, 'utf-8');
            this.notifications = JSON.parse(data) || [];
        } catch (error) {
            console.error(chalk.red('Error loading notifications:'), error);
            this.notifications = [];
        }
    }

    /**
     * Save notifications to file
     */
    private saveNotifications(): void {
        try {
            // Keep only last 1000 notifications
            if (this.notifications.length > 1000) {
                this.notifications = this.notifications.slice(-1000);
            }
            writeFileSync(this.notificationsFile, JSON.stringify(this.notifications, null, 2));
        } catch (error) {
            console.error(chalk.red('Error saving notifications:'), error);
        }
    }

    /**
     * Create and display a notification
     */
    notify(
        type: NotificationType,
        title: string,
        message: string,
        severity: 'info' | 'warning' | 'error' | 'success' = 'info',
        options?: {
            positionAddress?: string;
            poolAddress?: string;
            metadata?: Record<string, any>;
        }
    ): Notification {
        const notification: Notification = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            type,
            title,
            message,
            severity,
            positionAddress: options?.positionAddress,
            poolAddress: options?.poolAddress,
            metadata: options?.metadata,
            read: false,
        };

        this.notifications.push(notification);
        this.saveNotifications();

        // Display in CLI
        this.displayNotification(notification);

        // Log to file
        this.logNotification(notification);

        return notification;
    }

    /**
     * Display notification in CLI with appropriate formatting
     */
    private displayNotification(notif: Notification): void {
        const icons: Record<NotificationType, string> = {
            POSITION_OUT_OF_RANGE: '🔴',
            HIGH_IL_ALERT: '⚠️',
            FEE_THRESHOLD_MET: '💰',
            REBALANCE_EXECUTED: '✓',
            REBALANCE_RECOMMENDED: '💡',
            AUTO_REBALANCE_FAILED: '❌',
            AUTO_CLAIM_EXECUTED: '✓',
            AUTO_CLAIM_FAILED: '❌',
            SYSTEM_ERROR: '🛑',
            INFO: 'ℹ️',
        };

        const colors: Record<string, any> = {
            info: chalk.blue,
            warning: chalk.yellow,
            error: chalk.red,
            success: chalk.green,
        };

        const icon = icons[notif.type] || 'ℹ️';
        const colorFn = colors[notif.severity] || chalk.white;

        console.log('');
        console.log(
            colorFn(
                `${icon} [${new Date(notif.timestamp).toLocaleTimeString()}] ${notif.title}`
            )
        );
        console.log(colorFn(`   ${notif.message}`));

        if (notif.positionAddress) {
            console.log(colorFn(`   📍 Position: ${notif.positionAddress.slice(0, 8)}...`));
        }

        console.log('');
    }

    /**
     * Log notification to file
     */
    private logNotification(notif: Notification): void {
        try {
            const logEntry = {
                timestamp: new Date(notif.timestamp).toISOString(),
                type: notif.type,
                severity: notif.severity,
                title: notif.title,
                message: notif.message,
                positionAddress: notif.positionAddress || 'N/A',
                poolAddress: notif.poolAddress || 'N/A',
                metadata: notif.metadata || {},
            };

            appendFileSync(
                this.logsFile,
                JSON.stringify(logEntry) + '\n'
            );
        } catch (error) {
            console.error(chalk.red('Error logging notification:'), error);
        }
    }

    /**
     * Notify: Position out of range
     */
    notifyPositionOutOfRange(
        positionAddress: string,
        activeBin: number,
        minBin: number,
        maxBin: number
    ): void {
        this.notify(
            'POSITION_OUT_OF_RANGE',
            '🔴 Position Out of Range',
            `Your position is no longer earning fees. Active bin ${activeBin} is outside your range (${minBin} to ${maxBin}). Consider rebalancing.`,
            'error',
            {
                positionAddress,
                metadata: { activeBin, minBin, maxBin },
            }
        );
    }

    /**
     * Notify: High IL alert
     */
    notifyHighILAlert(
        positionAddress: string,
        ilPercent: number,
        threshold: number
    ): void {
        this.notify(
            'HIGH_IL_ALERT',
            '⚠️ High Impermanent Loss Detected',
            `Position IL is at ${ilPercent.toFixed(2)}%, exceeding your threshold of ${threshold.toFixed(2)}%.`,
            'warning',
            {
                positionAddress,
                metadata: { ilPercent, threshold },
            }
        );
    }

    /**
     * Notify: Fee threshold met
     */
    notifyFeeThresholdMet(
        positionAddress: string,
        feesUsd: number,
        threshold: number
    ): void {
        this.notify(
            'FEE_THRESHOLD_MET',
            '💰 Fee Claim Threshold Reached',
            `Accumulated fees of $${feesUsd.toFixed(2)} have reached your threshold of $${threshold.toFixed(2)}. Ready to claim.`,
            'success',
            {
                positionAddress,
                metadata: { feesUsd, threshold },
            }
        );
    }

    /**
     * Notify: Rebalance executed
     */
    notifyRebalanceExecuted(
        oldPositionAddress: string,
        newPositionAddress: string,
        feesClaimedUsd: number,
        costUsd: number
    ): void {
        this.notify(
            'REBALANCE_EXECUTED',
            '✓ Position Rebalanced Successfully',
            `Position rebalanced. Fees claimed: $${feesClaimedUsd.toFixed(2)}. Transaction cost: $${costUsd.toFixed(4)}.`,
            'success',
            {
                positionAddress: newPositionAddress,
                metadata: {
                    oldPosition: oldPositionAddress,
                    newPosition: newPositionAddress,
                    feesClaimedUsd,
                    costUsd,
                },
            }
        );
    }

    /**
     * Notify: Rebalance recommended
     */
    notifyRebalanceRecommended(
        positionAddress: string,
        reason: string,
        projectedGainUsd: number
    ): void {
        this.notify(
            'REBALANCE_RECOMMENDED',
            '💡 Rebalance Recommended',
            `${reason}. Projected daily fee increase: $${projectedGainUsd.toFixed(2)}.`,
            'warning',
            {
                positionAddress,
                metadata: { reason, projectedGainUsd },
            }
        );
    }

    /**
     * Notify: Auto-rebalance failed
     */
    notifyAutoRebalanceFailed(
        positionAddress: string,
        error: string
    ): void {
        this.notify(
            'AUTO_REBALANCE_FAILED',
            '❌ Auto-Rebalance Failed',
            `Automatic rebalance failed: ${error}. Please check your position.`,
            'error',
            {
                positionAddress,
                metadata: { error },
            }
        );
    }

    /**
     * Notify: Auto-claim executed
     */
    notifyAutoClaimExecuted(
        positionAddress: string,
        claimedUsd: number,
        costUsd: number
    ): void {
        this.notify(
            'AUTO_CLAIM_EXECUTED',
            '✓ Fees Auto-Claimed',
            `Fees automatically claimed: $${claimedUsd.toFixed(2)}. Transaction cost: $${costUsd.toFixed(4)}.`,
            'success',
            {
                positionAddress,
                metadata: { claimedUsd, costUsd },
            }
        );
    }

    /**
     * Notify: Auto-claim failed
     */
    notifyAutoClaimFailed(
        positionAddress: string,
        error: string
    ): void {
        this.notify(
            'AUTO_CLAIM_FAILED',
            '❌ Auto-Claim Failed',
            `Automatic fee claim failed: ${error}. Please claim manually.`,
            'error',
            {
                positionAddress,
                metadata: { error },
            }
        );
    }

    /**
     * Notify: System error
     */
    notifySystemError(
        title: string,
        error: string,
        context?: Record<string, any>
    ): void {
        this.notify(
            'SYSTEM_ERROR',
            `🛑 ${title}`,
            error,
            'error',
            { metadata: context }
        );
    }

    /**
     * Notify: Generic info
     */
    notifyInfo(title: string, message: string): void {
        this.notify('INFO', title, message, 'info');
    }

    /**
     * Get all unread notifications
     */
    getUnreadNotifications(): Notification[] {
        return this.notifications.filter(n => !n.read);
    }

    /**
     * Mark notification as read
     */
    markAsRead(notifId: string): void {
        const notif = this.notifications.find(n => n.id === notifId);
        if (notif) {
            notif.read = true;
            this.saveNotifications();
        }
    }

    /**
     * Get notifications by type
     */
    getNotificationsByType(type: NotificationType): Notification[] {
        return this.notifications.filter(n => n.type === type);
    }

    /**
     * Get notifications by severity
     */
    getNotificationsBySeverity(severity: 'info' | 'warning' | 'error' | 'success'): Notification[] {
        return this.notifications.filter(n => n.severity === severity);
    }

    /**
     * Get recent notifications (last N)
     */
    getRecentNotifications(count: number = 10): Notification[] {
        return this.notifications.slice(-count).reverse();
    }

    /**
     * Clear all notifications
     */
    clearAllNotifications(): void {
        this.notifications = [];
        this.saveNotifications();
        console.log(chalk.green('✓ All notifications cleared'));
    }

    /**
     * Clear old notifications (older than X days)
     */
    clearOldNotifications(days: number = 30): void {
        const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
        this.notifications = this.notifications.filter(n => n.timestamp >= cutoffTime);
        this.saveNotifications();
        console.log(chalk.green(`✓ Cleared notifications older than ${days} days`));
    }

    /**
     * Get logs file path (for external access)
     */
    getLogsFilePath(): string {
        return this.logsFile;
    }

    /**
     * Get notifications file path (for external access)
     */
    getNotificationsFilePath(): string {
        return this.notificationsFile;
    }
}

// Singleton export
let notificationsService: NotificationsService;

export function initNotificationsService(logsDir?: string): NotificationsService {
    notificationsService = new NotificationsService(logsDir);
    return notificationsService;
}

export { notificationsService };
