import inquirer from 'inquirer';
import chalk from 'chalk';
import { connectionService } from '../../services/connection.service';
import { poolService } from '../../services/pool.service';

// Helper for wait
async function waitForUser() {
    await inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: 'Press ENTER to continue...',
    }]);
}

export async function searchPoolByAddress() {
    const config = connectionService.getConfig();
    const networkName = config.endpoint.includes('devnet') ? 'Devnet' :
        config.endpoint.includes('mainnet') ? 'Mainnet' : 'Custom';

    console.log(chalk.blue.bold('\n🔍 SEARCH POOL BY ADDRESS\n'));
    console.log(chalk.yellow(`Current Network: ${networkName}`));
    console.log(chalk.gray('Ensure the pool address exists on this network.\n'));

    const answers = await inquirer.prompt({
        type: 'input',
        name: 'address',
        message: 'Enter pool address (or leave empty to cancel):',
    });

    if (!answers.address || answers.address.trim().length === 0) {
        console.log(chalk.gray('Operation cancelled.'));
        await waitForUser();
        return;
    }

    try {
        console.log(chalk.yellow('Fetching pool information...'));
        const pool = await poolService.searchPoolByAddress(answers.address);

        console.log(chalk.green('\n✅ POOL FOUND:\n'));
        console.log(`Address: ${pool.address}`);
        console.log(`Pair: ${pool.tokenX.symbol}/${pool.tokenY.symbol}`);
        console.log(`\nToken X:`);
        console.log(`  Mint: ${pool.tokenX.mint}`);
        console.log(`  Symbol: ${pool.tokenX.symbol}`);
        console.log(`  Decimals: ${pool.tokenX.decimals}`);
        console.log(`\nToken Y:`);
        console.log(`  Mint: ${pool.tokenY.mint}`);
        console.log(`  Symbol: ${pool.tokenY.symbol}`);
        console.log(`  Decimals: ${pool.tokenY.decimals}`);
        console.log(`\nPool Details:`);
        console.log(`  Bin Step: ${pool.binStep} bps`);
        console.log(`  Fee: ${(pool.feeBps / 100).toFixed(2)}%`);
        console.log(`  Active Bin: ${pool.activeBin}`);
        console.log(`  TVL: $${pool.tvl?.toLocaleString() || 'N/A'}`);
        console.log(`  24h Volume: $${pool.volume24h?.toLocaleString() || 'N/A'}`);
        console.log(`  APR: ${pool.apr?.toFixed(2) || 'N/A'}%\n`);

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                '➕ Create Position (Add Liquidity)',
                '🔙 Back to Search'
            ]
        });

        if (action.includes('Create Position')) {
            // Dynamic import to avoid circular dependency
            const { createPositionWorkflow } = await import('./position.command');
            await createPositionWorkflow(pool.address);
        }
    } catch (error) {
        console.log(chalk.red(`\n❌ Search failed: ${error}\n`));
    }

    await waitForUser();
}

export async function getTopPoolsByTVL() {
    console.log(chalk.blue.bold('\n📊 TOP POOLS BY TVL\n'));

    try {
        console.log(chalk.yellow('Fetching top pools...'));
        const pools = await poolService.getTopPoolsByTVL(10);

        console.log(chalk.green(`\n✅ Top 10 Pools by TVL:\n`));
        pools.forEach((pool, index) => {
            console.log(`${index + 1}. ${pool.tokenX.symbol}/${pool.tokenY.symbol}`);
            console.log(`   TVL: $${pool.tvl?.toLocaleString() || 'N/A'}`);
            console.log(`   24h Volume: $${pool.volume24h?.toLocaleString() || 'N/A'}`);
            console.log(`   APR: ${pool.apr?.toFixed(2) || 'N/A'}%\n`);
        });
    } catch (error) {
        console.log(chalk.red(`\n❌ Failed to fetch pools: ${error}\n`));
    }

    await waitForUser();
}

export async function getTopPoolsByAPR() {
    console.log(chalk.blue.bold('\n📈 TOP POOLS BY APR\n'));

    try {
        console.log(chalk.yellow('Fetching top pools...'));
        const pools = await poolService.getTopPoolsByAPR(10);

        console.log(chalk.green(`\n✅ Top 10 Pools by APR:\n`));
        pools.forEach((pool, index) => {
            console.log(`${index + 1}. ${pool.tokenX.symbol}/${pool.tokenY.symbol}`);
            console.log(`   APR: ${pool.apr?.toFixed(2) || 'N/A'}%`);
            console.log(`   TVL: $${pool.tvl?.toLocaleString() || 'N/A'}`);
            console.log(`   24h Volume: $${pool.volume24h?.toLocaleString() || 'N/A'}\n`);
        });
    } catch (error) {
        console.log(chalk.red(`\n❌ Failed to fetch pools: ${error}\n`));
    }

    await waitForUser();
}

export async function getPoolStats() {
    console.log(chalk.blue.bold('\n📋 POOL STATISTICS\n'));

    try {
        console.log(chalk.yellow('Fetching statistics...'));
        const stats = await poolService.getPoolStats();

        console.log(chalk.green(`\n✅ POOL NETWORK STATISTICS:\n`));
        console.log(`Total Pools: ${stats.totalPools.toLocaleString()}`);
        console.log(`Total TVL: $${stats.totalTVL.toLocaleString()}`);
        console.log(`Average APR: ${stats.averageAPR.toFixed(2)}%\n`);

        if (stats.topPoolByTVL) {
            console.log(chalk.blue('📊 Top Pool by TVL:'));
            console.log(`   ${stats.topPoolByTVL.tokenX.symbol}/${stats.topPoolByTVL.tokenY.symbol}`);
            console.log(`   TVL: $${stats.topPoolByTVL.tvl?.toLocaleString() || 'N/A'}\n`);
        }

        if (stats.topPoolByAPR) {
            console.log(chalk.blue('📈 Top Pool by APR:'));
            console.log(`   ${stats.topPoolByAPR.tokenX.symbol}/${stats.topPoolByAPR.tokenY.symbol}`);
            console.log(`   APR: ${stats.topPoolByAPR.apr?.toFixed(2) || 'N/A'}%\n`);
        }
    } catch (error) {
        console.log(chalk.red(`\n❌ Failed to fetch statistics: ${error}\n`));
    }

    await waitForUser();
}

export async function findTokenPair() {
    console.log(chalk.blue.bold('\n🔎 FIND TOKEN PAIR\n'));

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'token1',
            message: 'Enter first token (e.g., USDC) (or leave empty to cancel):',
            default: 'USDC',
        },
        {
            type: 'input',
            name: 'token2',
            message: 'Enter second token (e.g., USDT):',
            default: 'USDT',
            when: (answers) => answers.token1 && answers.token1.trim().length > 0
        },
    ]);

    if (!answers.token1 || answers.token1.trim().length === 0) {
        console.log(chalk.gray('Operation cancelled.'));
        await waitForUser();
        return;
    }

    try {
        console.log(chalk.yellow('Searching for pools...'));
        const pools = await poolService.getPoolsByTokenPair(answers.token1, answers.token2);

        if (pools.length === 0) {
            console.log(chalk.yellow(`\n❌ No pools found for ${answers.token1}-${answers.token2}\n`));
        } else {
            console.log(chalk.green(`\n✅ Found ${pools.length} pools for ${answers.token1}-${answers.token2}:\n`));
            pools.slice(0, 5).forEach((pool, index) => {
                console.log(`${index + 1}. ${pool.address.slice(0, 16)}...`);
                console.log(`   Fee: ${(pool.feeBps / 100).toFixed(2)}%`);
                console.log(`   TVL: $${pool.tvl?.toLocaleString() || 'N/A'}`);
                console.log(`   APR: ${pool.apr?.toFixed(2) || 'N/A'}%\n`);
            });
        }
    } catch (error) {
        console.log(chalk.red(`\n❌ Search failed: ${error}\n`));
    }

    await waitForUser();
}

export async function binPriceCalculator() {
    console.log(chalk.blue.bold('\n📐 BIN PRICE CALCULATOR\n'));

    const answers = await inquirer.prompt([
        {
            type: 'input', // Changed to input to allow empty check
            name: 'binId',
            message: 'Enter bin ID (or leave empty to cancel):',
            default: '8388608',
            validate: (val) => {
                if (!val || val.trim().length === 0) return true;
                return !isNaN(Number(val)) ? true : 'Please enter a valid number';
            }
        },
        {
            type: 'number',
            name: 'binStep',
            message: 'Enter bin step (in basis points):',
            default: 20,
            when: (answers) => answers.binId && answers.binId.trim().length > 0
        },
    ]);

    if (!answers.binId || answers.binId.trim().length === 0) {
        console.log(chalk.gray('Operation cancelled.'));
        await waitForUser();
        return;
    }

    const binId = Number(answers.binId);

    try {
        const price = poolService.calculateBinPrice(binId, answers.binStep);
        const range = poolService.getPriceRange(binId - 10, binId + 10, answers.binStep);

        console.log(chalk.green('\n✅ BIN PRICE CALCULATION:\n'));
        console.log(`Bin ID: ${binId}`);
        console.log(`Bin Step: ${answers.binStep} bps`);
        console.log(`Current Price: ${price.toFixed(8)}\n`);

        console.log(chalk.blue('Price Range (±10 bins):'));
        console.log(`  Min Price: ${range.minPrice.toFixed(8)}`);
        console.log(`  Center Price: ${range.centerPrice.toFixed(8)}`);
        console.log(`  Max Price: ${range.maxPrice.toFixed(8)}\n`);
    } catch (error) {
        console.log(chalk.red(`\n❌ Calculation failed: ${error}\n`));
    }

    await waitForUser();
}
