import chalk from 'chalk';
import { AnalyticsSnapshot } from '../services/analyticsDataStore.service';

/**
 * Renders an ASCII bar chart for fee trends
 */
export function renderFeeChart(snapshots: AnalyticsSnapshot[], days: number = 7): string {
    if (!snapshots || snapshots.length === 0) {
        return chalk.gray('No data available for chart');
    }

    // Group snapshots by day
    const dailyFees = groupSnapshotsByDay(snapshots, days);

    if (dailyFees.length === 0) {
        return chalk.gray(`No data available for the last ${days} days`);
    }

    // Find max value for scaling
    const maxFees = Math.max(...dailyFees.map(d => d.totalFees));
    const maxBarLength = 20;

    // Build chart
    let chart = chalk.cyan.bold(`\n💰 ${days}-DAY FEE TREND\n\n`);

    dailyFees.forEach(day => {
        const barLength = Math.round((day.totalFees / maxFees) * maxBarLength);
        const filledBar = '█'.repeat(barLength);
        const emptyBar = '░'.repeat(maxBarLength - barLength);

        const dateStr = formatDate(day.date);
        const feesStr = `$${day.totalFees.toFixed(2)}`.padStart(8);

        chart += `${dateStr}: ${chalk.green(filledBar)}${chalk.gray(emptyBar)} ${feesStr}\n`;
    });

    // Add summary
    const totalFees = dailyFees.reduce((sum, d) => sum + d.totalFees, 0);
    const avgFees = totalFees / dailyFees.length;

    chart += chalk.gray(`\nTotal: $${totalFees.toFixed(2)} | Daily Avg: $${avgFees.toFixed(2)}\n`);

    return chart;
}

/**
 * Renders a bin distribution chart
 */
export function renderBinDistributionChart(
    binData: Array<{ binId: number; amount: number; price: number }>,
    maxBars: number = 15
): string {
    if (!binData || binData.length === 0) {
        return chalk.gray('No bin data available');
    }

    // Sort by bin ID
    const sorted = [...binData].sort((a, b) => a.binId - b.binId);

    // Find max amount for scaling
    const maxAmount = Math.max(...sorted.map(b => b.amount));
    const maxBarLength = 20;

    let chart = chalk.cyan.bold('\n📊 BIN DISTRIBUTION\n\n');

    // Show only sample if too many bins
    const binsToShow = sorted.length > maxBars
        ? [...sorted.slice(0, maxBars / 2), ...sorted.slice(-maxBars / 2)]
        : sorted;

    binsToShow.forEach((bin, index) => {
        // Add ellipsis indicator if skipping bins in the middle
        if (index === Math.floor(maxBars / 2) && sorted.length > maxBars) {
            chart += chalk.gray('    ...\n');
        }

        const barLength = Math.round((bin.amount / maxAmount) * maxBarLength);
        const filledBar = '█'.repeat(barLength);
        const emptyBar = '░'.repeat(maxBarLength - barLength);

        const binStr = `Bin ${bin.binId.toString().padStart(4)}`;
        const priceStr = `$${bin.price.toFixed(4)}`;
        const amountStr = bin.amount.toFixed(3);

        chart += `${binStr} ${chalk.green(filledBar)}${chalk.gray(emptyBar)} ${priceStr} | ${amountStr}\n`;
    });

    return chart;
}

/**
 * Renders a performance comparison chart
 */
export function renderPerformanceComparison(
    positions: Array<{ name: string; apr: number; value: number }>
): string {
    if (!positions || positions.length === 0) {
        return chalk.gray('No positions to compare');
    }

    const maxApr = Math.max(...positions.map(p => p.apr));
    const maxBarLength = 20;

    let chart = chalk.cyan.bold('\n📈 POSITION PERFORMANCE COMPARISON\n\n');

    positions.forEach(position => {
        const barLength = Math.round((position.apr / maxApr) * maxBarLength);
        const filledBar = '█'.repeat(barLength);
        const emptyBar = '░'.repeat(maxBarLength - barLength);

        const nameStr = position.name.padEnd(20);
        const aprStr = `${position.apr.toFixed(1)}%`.padStart(7);
        const valueStr = `$${position.value.toFixed(2)}`;

        const color = position.apr >= 50 ? chalk.green : position.apr >= 30 ? chalk.yellow : chalk.red;

        chart += `${nameStr} ${color(filledBar)}${chalk.gray(emptyBar)} ${aprStr} | ${valueStr}\n`;
    });

    return chart;
}

/**
 * Group snapshots by day and sum fees
 */
function groupSnapshotsByDay(snapshots: AnalyticsSnapshot[], days: number): Array<{ date: Date; totalFees: number }> {
    const now = Date.now();
    const cutoffTime = now - (days * 24 * 60 * 60 * 1000);

    // Filter to last N days
    const recentSnapshots = snapshots.filter(s => s.timestamp >= cutoffTime);

    // Group by day
    const dailyMap = new Map<string, number>();

    recentSnapshots.forEach(snapshot => {
        const date = new Date(snapshot.timestamp);
        const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const currentFees = dailyMap.get(dayKey) || 0;
        dailyMap.set(dayKey, currentFees + (snapshot.feesUsdValue || 0));
    });

    // Convert to array and sort
    const dailyFees = Array.from(dailyMap.entries()).map(([dateStr, totalFees]) => ({
        date: new Date(dateStr),
        totalFees
    }));

    dailyFees.sort((a, b) => a.date.getTime() - b.date.getTime());

    return dailyFees;
}

/**
 * Format date for chart display
 */
function formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Renders a simple sparkline for inline display
 */
export function renderSparkline(values: number[], width: number = 10): string {
    if (!values || values.length === 0) return '';

    const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;

    if (range === 0) return chars[0].repeat(width);

    return values
        .slice(-width)
        .map(v => {
            const normalized = (v - min) / range;
            const charIndex = Math.floor(normalized * (chars.length - 1));
            return chars[charIndex];
        })
        .join('');
}

/**
 * Create a horizontal line separator
 */
export function renderSeparator(width: number = 60, char: string = '─'): string {
    return chalk.gray(char.repeat(width));
}

/**
 * Render a progress bar
 */
export function renderProgressBar(current: number, total: number, width: number = 20): string {
    const percentage = Math.min(100, Math.max(0, (current / total) * 100));
    const filledLength = Math.round((percentage / 100) * width);

    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(width - filledLength);

    const color = percentage >= 75 ? chalk.green : percentage >= 50 ? chalk.yellow : chalk.red;

    return `${color(filled)}${chalk.gray(empty)} ${percentage.toFixed(1)}%`;
}
