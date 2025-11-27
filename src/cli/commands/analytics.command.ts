import inquirer from 'inquirer';
import chalk from 'chalk';
import { walletService } from '../../services/wallet.service';
import { analyticsService } from '../../services/analytics.service';
import { analyticsDataStore } from '../../services/analyticsDataStore.service';
import { positionService } from '../../services/position.service';
import { renderFeeChart, renderPerformanceComparison } from '../../utils/charting.helpers';
import {
    exportSnapshotsToCSV,
    exportRebalanceHistoryToCSV,
    exportPositionsSummaryToCSV,
    generateTimestampedFilename,
    formatFileSize
} from '../../utils/export-helpers';
import fs from 'fs';

// Helper for wait
async function waitForUser() {
    await inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: 'Press ENTER to continue...',
    }]);
}

function displayHeader() {
    // console.clear();
    // console.log(chalk.blue.bold('📊 ANALYTICS & MONITORING\n'));
}

export async function analyticsMenu() {
    while (true) {
        displayHeader();
        console.log(chalk.blue.bold('📊 ANALYTICS & MONITORING\n'));

        const choices = [
            '📈 Portfolio Overview (PnL & APR)',
            '💰 Fee Trend Chart (7-day)',
            '🏆 Pool Performance Comparison',
            '📊 Export Data to CSV',
            '🚨 Check Alerts (Monitoring)',
            '🔙 Back to Main Menu'
        ];

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: 'Select an option:',
            choices: choices
        });

        if (action.includes('Portfolio Overview')) {
            await showPortfolioAnalytics();
        } else if (action.includes('Fee Trend Chart')) {
            await showFeeTrendChart();
        } else if (action.includes('Performance Comparison')) {
            await showPoolComparison();
        } else if (action.includes('Export Data')) {
            await showExportMenu();
        } else if (action.includes('Check Alerts')) {
            await showMonitoringAlerts();
        } else if (action.includes('Back')) {
            return;
        }
    }
}

async function showPortfolioAnalytics() {
    console.log(chalk.blue.bold('\n📈 PORTFOLIO ANALYTICS\n'));

    const activeWallet = walletService.getActiveWallet();
    if (!activeWallet) {
        console.log(chalk.red('No active wallet.'));
        await waitForUser();
        return;
    }

    console.log(chalk.yellow('Calculating analytics...'));

    try {
        const stats = await analyticsService.getPortfolioAnalytics(activeWallet.publicKey);

        console.log(chalk.green('\n✅ PORTFOLIO SUMMARY:\n'));
        console.log(`Total Value: $${stats.totalValueUSD.toFixed(2)}`);
        console.log(`Total PnL: ${stats.totalPnLUSD >= 0 ? chalk.green('+$' + stats.totalPnLUSD.toFixed(2)) : chalk.red('-$' + Math.abs(stats.totalPnLUSD).toFixed(2))} (${stats.totalPnLPercent.toFixed(2)}%)`);
        console.log(`Avg APR: ${stats.averageApr.toFixed(2)}%`);
        console.log(`Positions: ${stats.positions.length}\n`);

        if (stats.positions.length > 0) {
            console.log(chalk.yellow('📋 Position Details:'));
            stats.positions.forEach((p, i) => {
                console.log(`${i + 1}. ${p.publicKey.slice(0, 8)}...`);
                console.log(`   Value: $${p.currentValueUSD.toFixed(2)}`);
                console.log(`   PnL: ${p.pnlUSD >= 0 ? chalk.green('+$' + p.pnlUSD.toFixed(2)) : chalk.red('-$' + Math.abs(p.pnlUSD).toFixed(2))}`);
                console.log(`   APR: ${p.apr.toFixed(2)}%\n`);
            });
        }

    } catch (e: any) {
        console.log(chalk.red(`\n❌ Error: ${e.message}`));
    }

    await waitForUser();
}

async function showFeeTrendChart() {
    console.log(chalk.blue.bold('\n💰 FEE TREND ANALYSIS\n'));

    const activeWallet = walletService.getActiveWallet();
    if (!activeWallet) {
        console.log(chalk.red('No active wallet.'));
        await waitForUser();
        return;
    }

    try {
        // Get snapshots for all positions
        const positions = await positionService.getAllPositions(activeWallet.publicKey);

        if (positions.length === 0) {
            console.log(chalk.gray('No positions found.'));
            await waitForUser();
            return;
        }

        // Get snapshots from analytics store
        const allSnapshots = analyticsDataStore.loadSnapshots();

        if (allSnapshots.length === 0) {
            console.log(chalk.gray('No historical data available yet.\nData will be collected as you use the app.'));
            await waitForUser();
            return;
        }

        // Ask for number of days
        const { days } = await inquirer.prompt({
            type: 'list',
            name: 'days',
            message: 'Select time period:',
            choices: ['7 days', '14 days', '30 days', new inquirer.Separator(), '🔙 Back'],
            default: '7 days'
        });

        if (days === '🔙 Back') {
            return;
        }

        const numDays = parseInt(days);

        // Render chart
        const chart = renderFeeChart(allSnapshots, numDays);
        console.log(chart);

    } catch (e: any) {
        console.log(chalk.red(`\n❌ Error: ${e.message}`));
    }

    await waitForUser();
}

async function showPoolComparison() {
    console.log(chalk.blue.bold('\n🏆 POOL PERFORMANCE COMPARISON\n'));

    const activeWallet = walletService.getActiveWallet();
    if (!activeWallet) {
        console.log(chalk.red('No active wallet.'));
        await waitForUser();
        return;
    }

    try {
        const stats = await analyticsService.getPortfolioAnalytics(activeWallet.publicKey);

        if (stats.positions.length === 0) {
            console.log(chalk.gray('No positions found.'));
            await waitForUser();
            return;
        }

        // Prepare data for comparison chart
        const comparisonData = stats.positions.map(p => ({
            name: `${p.publicKey.slice(0, 6)}...`,
            apr: p.apr,
            value: p.currentValueUSD
        }));

        const chart = renderPerformanceComparison(comparisonData);
        console.log(chart);

        // Show additional stats
        console.log(chalk.cyan('\n📊 KEY METRICS:\n'));
        console.log(`Best Performer: ${comparisonData.reduce((max, p) => p.apr > max.apr ? p : max).name} (${Math.max(...comparisonData.map(p => p.apr)).toFixed(1)}% APR)`);
        console.log(`Portfolio Avg: ${stats.averageApr.toFixed(1)}% APR`);
        console.log(`Total Value: $${stats.totalValueUSD.toFixed(2)}\n`);

    } catch (e: any) {
        console.log(chalk.red(`\n❌ Error: ${e.message}`));
    }

    await waitForUser();
}

async function showExportMenu() {
    console.log(chalk.blue.bold('\n📊 EXPORT DATA TO CSV\n'));

    const activeWallet = walletService.getActiveWallet();
    if (!activeWallet) {
        console.log(chalk.red('No active wallet.'));
        await waitForUser();
        return;
    }

    const { exportType } = await inquirer.prompt({
        type: 'list',
        name: 'exportType',
        message: 'What would you like to export?',
        choices: [
            'Current Positions Summary',
            'Historical Snapshots',
            'Rebalance History',
            '🔙 Back'
        ]
    });

    if (exportType.includes('Back')) {
        return;
    }

    try {
        let filepath: string;
        let filesize: number;

        if (exportType.includes('Current Positions')) {
            const positions = await positionService.getAllPositions(activeWallet.publicKey);
            const filename = generateTimestampedFilename('positions');
            filepath = exportPositionsSummaryToCSV(positions, filename);

        } else if (exportType.includes('Historical Snapshots')) {
            const snapshots = analyticsDataStore.loadSnapshots();
            const filename = generateTimestampedFilename('snapshots');
            filepath = exportSnapshotsToCSV(snapshots, filename);

        } else if (exportType.includes('Rebalance History')) {
            const history = analyticsDataStore.loadRebalanceHistory();
            const filename = generateTimestampedFilename('rebalances');
            filepath = exportRebalanceHistoryToCSV(history, filename);
        } else {
            return;
        }

        // Get file size
        const stats = fs.statSync(filepath);
        filesize = stats.size;

        console.log(chalk.green(`\n✅ Export successful!`));
        console.log(`File: ${filepath}`);
        console.log(`Size: ${formatFileSize(filesize)}\n`);

    } catch (e: any) {
        console.log(chalk.red(`\n❌ Export failed: ${e.message}`));
    }

    await waitForUser();
}

async function showMonitoringAlerts() {
    console.log(chalk.blue.bold('\n🚨 MONITORING ALERTS\n'));

    const activeWallet = walletService.getActiveWallet();
    if (!activeWallet) {
        console.log(chalk.red('No active wallet.'));
        await waitForUser();
        return;
    }

    // Placeholder for monitoring service integration
    console.log(chalk.gray('Monitoring alerts feature is coming soon.'));

    await waitForUser();
}
