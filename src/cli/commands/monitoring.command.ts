import inquirer from 'inquirer';
import chalk from 'chalk';
import { startMonitoring, stopMonitoring, getMonitoringStatus, MonitoringConfig } from '../../services/monitoring.scheduler';
import { positionService } from '../../services/position.service';
import { hourlySnapshotService } from '../../services/hourlySnapshot.service';
import { walletService } from '../../services/wallet.service';

export async function monitoringCommand(): Promise<void> {
    while (true) {
        console.clear();
        console.log(chalk.cyan.bold('\n🤖 AUTOMATED MONITORING\n'));

        const status = getMonitoringStatus();

        if (status) {
            console.log(chalk.green('Status: ✅ ACTIVE'));
            console.log(chalk.gray(`Jobs Running: ${status.jobCount}`));
            console.log(chalk.gray(`Monitoring: ${status.activePositions} position(s)\n`));
        } else {
            console.log(chalk.yellow('Status: ⏸️  INACTIVE\n'));
        }

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                { name: '▶️  Start Monitoring', value: 'start', disabled: status ? 'Already running' : false },
                { name: '⏹️  Stop Monitoring', value: 'stop', disabled: !status },
                { name: '📊 View Monitoring Schedule', value: 'schedule' },
                { name: '🧪 Test Hourly Snapshot (Manual)', value: 'test_snapshot' },
                { name: '📈 View Recent Snapshots', value: 'view_snapshots' },
                { name: '⚙️  Configure Settings', value: 'configure' },
                { name: '◀️  Back', value: 'back' }
            ]
        }]);

        switch (action) {
            case 'start':
                await startMonitoringFlow();
                break;
            case 'stop':
                stopMonitoring();
                console.log(chalk.green('\n✅ Monitoring stopped\n'));
                await pause();
                break;
            case 'schedule':
                showMonitoringSchedule();
                await pause();
                break;
            case 'test_snapshot':
                await testHourlySnapshot();
                break;
            case 'view_snapshots':
                await viewRecentSnapshots();
                break;
            case 'configure':
                await configureMonitoring();
                break;
            case 'back':
                return;
        }
    }
}

async function startMonitoringFlow(): Promise<void> {
    console.log(chalk.cyan('\n📋 Monitoring Configuration\n'));

    // Get active wallet and positions
    const wallet = walletService.getActiveWallet();
    if (!wallet) {
        console.log(chalk.yellow('⚠️  No active wallet'));
        console.log(chalk.gray('Set an active wallet first\n'));
        await pause();
        return;
    }

    const positions = await positionService.getAllPositions(wallet.publicKey);

    if (positions.length === 0) {
        console.log(chalk.yellow('⚠️  No active positions found'));
        console.log(chalk.gray('Create a position first before starting monitoring\n'));
        await pause();
        return;
    }

    console.log(chalk.green(`Found ${positions.length} active position(s):\n`));
    positions.forEach((pos: any, i: number) => {
        console.log(chalk.gray(`  ${i + 1}. ${pos.publicKey.slice(0, 8)}... (${pos.inRange ? '🟢 IN-RANGE' : '🔴 OUT-OF-RANGE'})`));
    });
    console.log();

    const { enabledJobs } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'enabledJobs',
        message: 'Select monitoring jobs to enable:',
        choices: [
            { name: '📸 Hourly Snapshots (price/volume tracking)', value: 'hourly', checked: true },
            { name: '🔍 30-Minute Position Checks (edge/volume)', value: '30min', checked: true },
            { name: '📊 12-Hour LLM Analysis (08:00 & 20:00 UTC)', value: '12hour', checked: true },
            { name: '🌙 Daily Strategic Review (00:00 UTC)', value: 'daily', checked: true }
        ]
    }]);

    const config: MonitoringConfig = {
        enableHourlySnapshots: enabledJobs.includes('hourly'),
        enable30MinuteMonitoring: enabledJobs.includes('30min'),
        enable12HourAnalysis: enabledJobs.includes('12hour'),
        enableDailyReview: enabledJobs.includes('daily'),
        activePositions: positions.map((p: any) => p.poolAddress)
    };

    startMonitoring(config);

    console.log(chalk.green('\n✅ Monitoring started successfully!\n'));
    console.log(chalk.yellow('💡 Tip: Leave CLI running in background for continuous monitoring'));
    console.log(chalk.gray('   Press Ctrl+C at any time to stop\n'));

    await pause();
}

function showMonitoringSchedule(): void {
    console.log(chalk.cyan('\n📅 Monitoring Schedule (UTC)\n'));

    console.log(chalk.bold('Hourly Snapshots:'));
    console.log(chalk.gray('  ├─ Frequency: Every hour at :00'));
    console.log(chalk.gray('  ├─ Purpose: Track price/volume for intraday trends'));
    console.log(chalk.gray('  └─ Data retained: 7 days (168 snapshots)\n'));

    console.log(chalk.bold('30-Minute Position Checks:'));
    console.log(chalk.gray('  ├─ Frequency: Every 30 minutes (00:00, 00:30, ...)'));
    console.log(chalk.gray('  ├─ Purpose: Detect edge approaches, real-time volume spikes'));
    console.log(chalk.gray('  └─ Action: Trigger urgent LLM if <3 bins from edge OR volume >1.5x avg\n'));

    console.log(chalk.bold('12-Hour LLM Analysis:'));
    console.log(chalk.gray('  ├─ Frequency: 08:00 (US market) & 20:00 (Asia market)'));
    console.log(chalk.gray('  ├─ Purpose: Full analysis if position needs attention'));
    console.log(chalk.gray('  └─ Triggers: Approaching edge, high volume, position age >12h\n'));

    console.log(chalk.bold('Daily Strategic Review:'));
    console.log(chalk.gray('  ├─ Frequency: 00:00 (midnight UTC)'));
    console.log(chalk.gray('  ├─ Purpose: Deep analysis, learning, pattern detection'));
    console.log(chalk.gray('  └─ Action: Always runs for all positions\n'));
}

async function testHourlySnapshot(): Promise<void> {
    console.log(chalk.cyan('\n🧪 Test Hourly Snapshot\n'));

    const wallet = walletService.getActiveWallet();
    if (!wallet) {
        console.log(chalk.yellow('No active wallet\n'));
        await pause();
        return;
    }

    const positions = await positionService.getAllPositions(wallet.publicKey);

    if (positions.length === 0) {
        console.log(chalk.yellow('No active positions to test\n'));
        await pause();
        return;
    }

    const { poolAddress } = await inquirer.prompt([{
        type: 'list',
        name: 'poolAddress',
        message: 'Select position to snapshot:',
        choices: positions.map((p: any) => ({
            name: `${p.publicKey.slice(0, 12)}... (${p.poolAddress.slice(0, 12)}...)`,
            value: p.poolAddress
        }))
    }]);

    console.log(chalk.blue('\n⏳ Recording snapshot...\n'));

    try {
        await hourlySnapshotService.recordSnapshot(poolAddress);
        console.log(chalk.green('✅ Snapshot recorded successfully\n'));

        // Show snapshot data
        const snapshots = hourlySnapshotService.loadSnapshots(poolAddress, 1);
        if (snapshots.length > 0) {
            const latest = snapshots[snapshots.length - 1];
            console.log(chalk.gray('Latest Snapshot:'));
            console.log(chalk.gray(`  Time: ${new Date(latest.timestamp).toLocaleString()}`));
            console.log(chalk.gray(`  Price: $${latest.price.toFixed(2)}`));
            console.log(chalk.gray(`  Volume 24h: $${(latest.volume24h / 1000).toFixed(1)}K`));
            console.log(chalk.gray(`  Volume Ratio: ${latest.volumeRatio.toFixed(2)}x`));
            console.log(chalk.gray(`  Active Bin: ${latest.activeBin}`));
            console.log(chalk.gray(`  Volatility 6h: ${(latest.volatility6h * 100).toFixed(2)}%\n`));
        }
    } catch (error: any) {
        console.error(chalk.red(`❌ Error: ${error.message}\n`));
    }

    await pause();
}

async function viewRecentSnapshots(): Promise<void> {
    console.log(chalk.cyan('\n📈 Recent Snapshots\n'));

    const wallet = walletService.getActiveWallet();
    if (!wallet) {
        console.log(chalk.yellow('No active wallet\n'));
        await pause();
        return;
    }

    const positions = await positionService.getAllPositions(wallet.publicKey);

    if (positions.length === 0) {
        console.log(chalk.yellow('No active positions\n'));
        await pause();
        return;
    }

    const { poolAddress } = await inquirer.prompt([{
        type: 'list',
        name: 'poolAddress',
        message: 'Select position:',
        choices: positions.map((p: any) => ({
            name: `${p.publicKey.slice(0, 12)}... (${p.poolAddress.slice(0, 12)}...)`,
            value: p.poolAddress
        }))
    }]);

    const { hours } = await inquirer.prompt([{
        type: 'list',
        name: 'hours',
        message: 'Timeframe:',
        choices: [
            { name: 'Last 6 hours', value: 6 },
            { name: 'Last 24 hours', value: 24 },
            { name: 'Last 3 days', value: 72 },
            { name: 'Last 7 days', value: 168 }
        ]
    }]);

    const intraDayContext = hourlySnapshotService.getIntraDayContext(poolAddress, hours);

    if (intraDayContext.snapshots.length === 0) {
        console.log(chalk.yellow('\nNo snapshots found for this timeframe'));
        console.log(chalk.gray('Run "Test Hourly Snapshot" first or wait for automated collection\n'));
        await pause();
        return;
    }

    console.log(chalk.green(`\n📊 ${intraDayContext.snapshots.length} snapshots found\n`));

    // Show momentum
    console.log(chalk.bold('Momentum Analysis:'));
    console.log(chalk.gray(`  Price: ${intraDayContext.momentum.price > 0 ? '+' : ''}${intraDayContext.momentum.price.toFixed(2)}% /hour`));
    console.log(chalk.gray(`  Volume: ${intraDayContext.momentum.volume > 0 ? '+' : ''}${intraDayContext.momentum.volume.toFixed(1)}% acceleration`));
    console.log(chalk.gray(`  Direction: ${intraDayContext.momentum.direction}\n`));

    // Show signals
    console.log(chalk.bold('Detected Signals:'));
    console.log(intraDayContext.signals.priceBreakout ? chalk.yellow('  ⚠️  Price breakout detected') : chalk.gray('  ○ No price breakout'));
    console.log(intraDayContext.signals.volumeSpike ? chalk.yellow('  ⚠️  Volume spike detected') : chalk.gray('  ○ Normal volume'));
    console.log(intraDayContext.signals.volatilityShift ? chalk.yellow('  ⚠️  Volatility increased') : chalk.gray('  ○ Normal volatility'));
    console.log();

    await pause();
}

async function configureMonitoring(): Promise<void> {
    console.log(chalk.cyan('\n⚙️  Monitoring Configuration\n'));
    console.log(chalk.yellow('Coming in Phase 3: Telegram notifications'));
    console.log(chalk.gray('  • Notification preferences'));
    console.log(chalk.gray('  • Auto-execute thresholds'));
    console.log(chalk.gray('  • Custom monitoring intervals\n'));
    await pause();
}

async function pause(): Promise<void> {
    await inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: chalk.gray('Press Enter to continue...')
    }]);
}
