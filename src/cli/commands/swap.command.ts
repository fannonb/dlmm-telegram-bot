import inquirer from 'inquirer';
import chalk from 'chalk';
import { BN } from '@coral-xyz/anchor';
import { poolService } from '../../services/pool.service';
import { swapService } from '../../services/swap.service';

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
    // console.log(chalk.blue.bold('💱 SWAP TOKENS\n'));
}

export async function swapMenu() {
    displayHeader();
    console.log(chalk.blue.bold('💱 SWAP TOKENS\n'));

    try {
        // Step 1: Select Tokens
        const tokenAnswers = await inquirer.prompt([
            {
                type: 'input',
                name: 'inputToken',
                message: 'Enter input token symbol or mint (e.g. SOL) (or leave empty to cancel):',
                default: 'SOL'
            },
            {
                type: 'input',
                name: 'outputToken',
                message: 'Enter output token symbol or mint (e.g. USDC):',
                default: 'USDC',
                when: (answers) => answers.inputToken && answers.inputToken.trim().length > 0
            }
        ]);

        if (!tokenAnswers.inputToken || tokenAnswers.inputToken.trim().length === 0) {
            console.log(chalk.gray('Swap cancelled.'));
            await waitForUser();
            return;
        }

        const inputToken = tokenAnswers.inputToken.trim();
        const outputToken = tokenAnswers.outputToken.trim();

        // Step 2: Find Pool
        console.log(chalk.yellow(`\nSearching for pools pairing ${inputToken} and ${outputToken}...`));
        const pools = await poolService.getPoolsByTokenPair(inputToken, outputToken);

        if (pools.length === 0) {
            console.log(chalk.red(`\n❌ No pools found for pair ${inputToken}-${outputToken}.`));
            await waitForUser();
            return;
        }

        // Step 3: Select Pool (if multiple)
        let selectedPool = pools[0];
        if (pools.length > 1) {
            const poolChoices = pools.map((p, idx) => ({
                name: `${idx + 1}. ${p.address.slice(0, 8)}... (TVL: $${p.tvl?.toLocaleString() || '0'})`,
                value: p
            }));

            const poolAnswer = await inquirer.prompt({
                type: 'list',
                name: 'pool',
                message: 'Select a pool for the swap:',
                choices: poolChoices
            });
            selectedPool = poolAnswer.pool;
        } else {
            console.log(chalk.green(`✅ Found pool: ${selectedPool.address}`));
        }

        // Step 4: Determine direction (X to Y or Y to X)
        // We need to match input token to pool token X or Y
        let swapForY = true;

        // Helper to normalize comparisons
        const matchToken = (token: any, input: string) => {
            return token.symbol.toUpperCase() === input.toUpperCase() ||
                token.mint === input;
        };

        if (matchToken(selectedPool.tokenX, inputToken)) {
            swapForY = true; // X -> Y
        } else if (matchToken(selectedPool.tokenY, inputToken)) {
            swapForY = false; // Y -> X
        } else {
            // If explicit match failed (e.g. user typed "SOL" but pool has "Wrapped SOL"), ask user
            console.log(chalk.yellow(`\n⚠️  Could not automatically determine swap direction for "${inputToken}".`));
            const dirAnswer = await inquirer.prompt({
                type: 'list',
                name: 'direction',
                message: `Select swap direction:`,
                choices: [
                    { name: `${selectedPool.tokenX.symbol} (${selectedPool.tokenX.mint.slice(0, 4)}..) -> ${selectedPool.tokenY.symbol} (${selectedPool.tokenY.mint.slice(0, 4)}..)`, value: true },
                    { name: `${selectedPool.tokenY.symbol} (${selectedPool.tokenY.mint.slice(0, 4)}..) -> ${selectedPool.tokenX.symbol} (${selectedPool.tokenX.mint.slice(0, 4)}..)`, value: false }
                ]
            });
            swapForY = dirAnswer.direction;
        }

        const sourceToken = swapForY ? selectedPool.tokenX : selectedPool.tokenY;
        const destToken = swapForY ? selectedPool.tokenY : selectedPool.tokenX;

        // Step 5: Amount
        const amountAnswer = await inquirer.prompt({
            type: 'number',
            name: 'amount',
            message: `Enter amount of ${sourceToken.symbol} to swap:`,
            validate: (val) => val > 0 ? true : 'Amount must be greater than 0'
        });

        const amountIn = amountAnswer.amount;
        const decimals = sourceToken.decimals || 6;
        // Use Math.round to handle floating point issues, or string parsing
        const amountInBN = new BN(Math.round(amountIn * Math.pow(10, decimals)));

        // Step 6: Get Quote
        console.log(chalk.yellow('\nFetching swap quote...'));
        const quote = await swapService.getSwapQuote(
            selectedPool.address,
            amountInBN,
            swapForY,
            1.0 // 1% slippage default
        );

        const outDecimals = destToken.decimals || 6;
        const outAmount = Number(quote.outAmount.toString()) / Math.pow(10, outDecimals);
        const minOut = Number(quote.minOutAmount.toString()) / Math.pow(10, outDecimals);

        console.log(chalk.green('\n✅ SWAP QUOTE:\n'));
        console.log(`Input:  ${amountIn} ${sourceToken.symbol}`);
        console.log(`Output: ${outAmount.toFixed(6)} ${destToken.symbol}`);
        console.log(`Min Output (1% slip): ${minOut.toFixed(6)} ${destToken.symbol}`);
        console.log(`Price Impact: ${quote.priceImpact.toFixed(4)}%`);
        // Fee is usually in Lamports for SOL swaps or Token for others? 
        // DLMM swap fee is usually retained in the pool, transaction fee is SOL. 
        // quote.fee is the protocol fee.
        console.log(`Est. Protocol Fee: ${quote.fee.toString()} units`);

        // Step 7: Execute
        const confirm = await inquirer.prompt({
            type: 'confirm',
            name: 'execute',
            message: 'Execute Swap?',
            default: false
        });

        if (confirm.execute) {
            console.log(chalk.yellow('\n🔄 Executing swap...'));
            const signature = await swapService.executeSwap(selectedPool.address, quote);
            console.log(chalk.green.bold('\n✅ SWAP SUCCESSFUL!'));
            console.log(`Signature: ${signature}\n`);
        } else {
            console.log(chalk.gray('\n🚫 Swap cancelled.'));
        }

    } catch (error: any) {
        console.log(chalk.red(`\n❌ Swap failed: ${error.message || error}`));
    }

    await waitForUser();
}
