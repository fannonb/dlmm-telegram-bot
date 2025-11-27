import inquirer from 'inquirer';
import chalk from 'chalk';
import { PublicKey } from '@solana/web3.js';
import { walletService } from '../../services/wallet.service';
import { connectionService } from '../../services/connection.service';
import { positionService, UserPosition } from '../../services/position.service';
import { feeService, FeeClaimSummary } from '../../services/fee.service';
import { tokenService } from '../../services/token.service';
import { configManager } from '../../config/config.manager';
import { DEFAULT_CONFIG } from '../../config/constants';

export async function walletMenu() {
  while (true) {
    try {
      // displayHeader(); // Header is handled by main menu usually, but we can add a mini header

      const wallets = walletService.listWallets();
      const activeWallet = walletService.getActiveWallet();

      console.log(chalk.blue.bold('\n🔑 WALLET MANAGEMENT\n'));

      if (wallets.length > 0) {
        console.log(chalk.yellow('📋 Current Wallets:'));
        wallets.forEach((wallet, index) => {
          const isActive = wallet.publicKey === activeWallet?.publicKey;
          console.log(`   ${index + 1}. ${wallet.name} (${wallet.publicKey.slice(0, 8)}...) ${isActive ? chalk.green('⭐ ACTIVE') : ''}`);
        });
        console.log();
      } else {
        console.log(chalk.gray('📋 No wallets found. Create or import a wallet to get started.\n'));
      }

      const choices = [
        '➕ Create New Wallet',
        '📥 Import from Mnemonic',
        '🔐 Import from Private Key',
        ...(wallets.length > 0 ? [
          '📋 List All Wallets',
          '🎯 Set Active Wallet',
          '📤 Export Private Key',
          '💸 Transfer Fees to Wallet',
          '⚙️ Configure Transaction Defaults',
          '🗑️ Delete Wallet'
        ] : []),
        '🔙 Back to Main Menu'
      ];

      const answers = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: 'Wallet operations:',
        choices: choices,
        pageSize: 10
      });

      const action = answers.action;

      if (action.includes('Create New Wallet')) {
        await createWallet();
      } else if (action.includes('Import from Mnemonic')) {
        await importFromMnemonic();
      } else if (action.includes('Import from Private Key')) {
        await importFromPrivateKey();
      } else if (action.includes('List All Wallets')) {
        await listWallets();
      } else if (action.includes('Set Active Wallet')) {
        await setActiveWallet();
      } else if (action.includes('Export Private Key')) {
        await exportPrivateKey();
      } else if (action.includes('Transfer Fees')) {
        await transferFeesMenu();
      } else if (action.includes('Configure Transaction')) {
        await configureTransactionDefaults();
      } else if (action.includes('Delete Wallet')) {
        await deleteWallet();
      } else if (action.includes('Back to Main Menu')) {
        return;
      }

    } catch (error: any) {
      if (error.message?.includes('force closed') || error.name === 'ExitPromptError') {
        throw error;
      }
      console.error(chalk.red('Error in wallet menu:', error.message || 'Unknown error'));
      await waitForUser();
    }
  }
}

async function createWallet() {
  console.log(chalk.blue.bold('\n🔑 CREATE NEW WALLET\n'));

  const { name } = await inquirer.prompt([{
    type: 'input',
    name: 'name',
    message: 'Enter wallet name (or leave empty to cancel):',
  }]);

  if (!name || name.trim().length === 0) {
    console.log(chalk.gray('Operation cancelled.'));
    await waitForUser();
    return;
  }

  try {
    console.log(chalk.yellow('🔄 Creating wallet...'));

    const { wallet, mnemonic, keypair } = await walletService.createWallet(name.trim());

    console.log(chalk.green.bold('\n✅ WALLET CREATED SUCCESSFULLY!\n'));
    console.log(chalk.blue('📋 Wallet Details:'));
    console.log(`   Name: ${wallet.name}`);
    console.log(`   Public Key: ${wallet.publicKey}`);
    console.log(`   Created: ${new Date(wallet.createdAt).toLocaleString()}`);
    console.log(`   Status: ${chalk.green('⭐ ACTIVE')}\n`);

    console.log(chalk.red.bold('🔐 IMPORTANT - SAVE YOUR RECOVERY PHRASE:'));
    console.log(chalk.yellow(`   ${mnemonic}\n`));
    console.log(chalk.red('⚠️  Store this mnemonic phrase securely! It\'s the only way to recover your wallet.'));

  } catch (error) {
    console.log(chalk.red(`\n❌ Error creating wallet: ${error}`));
  }

  await waitForUser();
}

async function importFromMnemonic() {
  console.log(chalk.blue.bold('\n📥 IMPORT WALLET FROM MNEMONIC\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter wallet name (or leave empty to cancel):',
    }
  ]);

  if (!answers.name || answers.name.trim().length === 0) {
    console.log(chalk.gray('Operation cancelled.'));
    await waitForUser();
    return;
  }

  const mnemonicAnswer = await inquirer.prompt([
    {
      type: 'password',
      name: 'mnemonic',
      message: 'Enter mnemonic phrase (12 words):',
      validate: (input) => {
        const words = input.trim().split(' ');
        return words.length === 12 ? true : 'Please enter exactly 12 words';
      }
    }
  ]);

  try {
    console.log(chalk.yellow('🔄 Importing wallet...'));

    const wallet = await walletService.importFromMnemonic(answers.name.trim(), mnemonicAnswer.mnemonic.trim());

    console.log(chalk.green.bold('\n✅ WALLET IMPORTED SUCCESSFULLY!\n'));
    console.log(chalk.blue('📋 Wallet Details:'));
    console.log(`   Name: ${wallet.name}`);
    console.log(`   Public Key: ${wallet.publicKey}`);
    console.log(`   Status: ${chalk.green('⭐ ACTIVE')}\n`);

  } catch (error) {
    console.log(chalk.red(`\n❌ Error importing wallet: ${error}`));
  }

  await waitForUser();
}

async function importFromPrivateKey() {
  console.log(chalk.blue.bold('\n🔐 IMPORT WALLET FROM PRIVATE KEY\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter wallet name (or leave empty to cancel):',
    }
  ]);

  if (!answers.name || answers.name.trim().length === 0) {
    console.log(chalk.gray('Operation cancelled.'));
    await waitForUser();
    return;
  }

  const keyAnswer = await inquirer.prompt([
    {
      type: 'password',
      name: 'privateKey',
      message: 'Enter private key (base58):',
      validate: (input) => input.trim() ? true : 'Private key is required'
    }
  ]);

  try {
    console.log(chalk.yellow('🔄 Importing wallet...'));

    const wallet = await walletService.importFromPrivateKey(answers.name.trim(), keyAnswer.privateKey.trim());

    console.log(chalk.green.bold('\n✅ WALLET IMPORTED SUCCESSFULLY!\n'));
    console.log(chalk.blue('📋 Wallet Details:'));
    console.log(`   Name: ${wallet.name}`);
    console.log(`   Public Key: ${wallet.publicKey}`);
    console.log(`   Status: ${chalk.green('⭐ ACTIVE')}\n`);

  } catch (error) {
    console.log(chalk.red(`\n❌ Error importing wallet: ${error}`));
  }

  await waitForUser();
}

async function listWallets() {
  console.log(chalk.blue.bold('\n📋 ALL WALLETS\n'));

  const wallets = walletService.listWallets();
  const activeWallet = walletService.getActiveWallet();

  if (wallets.length === 0) {
    console.log(chalk.gray('No wallets found.'));
    await waitForUser();
    return;
  }

  console.log(chalk.yellow('🔄 Fetching balances...\n'));

  // Fetch balances for all wallets
  const connection = await connectionService.getConnection();

  for (let index = 0; index < wallets.length; index++) {
    const wallet = wallets[index];
    const isActive = wallet.publicKey === activeWallet?.publicKey;

    try {
      const balance = await connection.getBalance(new PublicKey(wallet.publicKey));
      const balanceSOL = balance / 1e9;

      console.log(`${index + 1}. ${chalk.cyan(wallet.name)}`);
      console.log(`   Public Key: ${wallet.publicKey}`);
      console.log(`   Balance: ${chalk.green(balanceSOL.toFixed(4) + ' SOL')}`);
      console.log(`   Created: ${new Date(wallet.createdAt).toLocaleString()}`);
      console.log(`   Status: ${isActive ? chalk.green('⭐ ACTIVE') : chalk.gray('Inactive')}\n`);
    } catch (error) {
      console.log(`${index + 1}. ${chalk.cyan(wallet.name)}`);
      console.log(`   Public Key: ${wallet.publicKey}`);
      console.log(`   Balance: ${chalk.red('Error fetching balance')}`);
      console.log(`   Created: ${new Date(wallet.createdAt).toLocaleString()}`);
      console.log(`   Status: ${isActive ? chalk.green('⭐ ACTIVE') : chalk.gray('Inactive')}\n`);
    }
  }

  await waitForUser();
}

async function setActiveWallet() {
  const wallets = walletService.listWallets();
  const activeWallet = walletService.getActiveWallet();

  if (wallets.length === 0) {
    console.log(chalk.red('\n❌ No wallets available.'));
    await waitForUser();
    return;
  }

  console.log(chalk.blue.bold('\n🎯 SET ACTIVE WALLET\n'));

  const choices = [
    ...wallets.map(wallet => ({
      name: `${wallet.name} (${wallet.publicKey.slice(0, 8)}...) ${wallet.publicKey === activeWallet?.publicKey ? chalk.green('[CURRENT]') : ''}`,
      value: wallet.publicKey
    })),
    new inquirer.Separator(),
    { name: '🔙 Back', value: 'back' }
  ];

  const { selectedWallet } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedWallet',
    message: 'Select wallet to make active:',
    choices: choices
  }]);

  if (selectedWallet === 'back') {
    return;
  }

  try {
    walletService.setActiveWallet(selectedWallet);
    const newActive = walletService.getActiveWallet();
    console.log(chalk.green(`\n✅ Active wallet set to: ${newActive?.name}`));
  } catch (error) {
    console.log(chalk.red(`\n❌ Error setting active wallet: ${error}`));
  }

  await waitForUser();
}

async function exportPrivateKey() {
  const wallets = walletService.listWallets();

  if (wallets.length === 0) {
    console.log(chalk.red('\n❌ No wallets available.'));
    await waitForUser();
    return;
  }

  console.log(chalk.blue.bold('\n📤 EXPORT PRIVATE KEY\n'));
  console.log(chalk.red('⚠️  WARNING: Never share your private key with anyone!'));

  const choices = [
    ...wallets.map(wallet => ({
      name: `${wallet.name} (${wallet.publicKey.slice(0, 8)}...)`,
      value: wallet.publicKey
    })),
    new inquirer.Separator(),
    { name: '🔙 Back', value: 'back' }
  ];

  const { selectedWallet } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedWallet',
    message: 'Select wallet to export private key:',
    choices: choices
  }]);

  if (selectedWallet === 'back') {
    return;
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Are you sure you want to export the private key?',
    default: false
  }]);

  if (!confirm) {
    console.log(chalk.gray('\n🚫 Export cancelled.'));
    await waitForUser();
    return;
  }

  try {
    const privateKey = walletService.exportPrivateKey(selectedWallet);
    const wallet = walletService.getWallet(selectedWallet);

    console.log(chalk.green.bold('\n✅ PRIVATE KEY EXPORTED:\n'));
    console.log(chalk.blue(`Wallet: ${wallet?.name}`));
    console.log(chalk.blue(`Public Key: ${selectedWallet}`));
    console.log(chalk.yellow(`Private Key: ${privateKey}\n`));
    console.log(chalk.red('⚠️  Store this private key securely and never share it!'));

  } catch (error) {
    console.log(chalk.red(`\n❌ Error exporting private key: ${error}`));
  }

  await waitForUser();
}

async function deleteWallet() {
  const wallets = walletService.listWallets();

  if (wallets.length === 0) {
    console.log(chalk.red('\n❌ No wallets available.'));
    await waitForUser();
    return;
  }

  console.log(chalk.blue.bold('\n🗑️ DELETE WALLET\n'));
  console.log(chalk.red('⚠️  WARNING: This action cannot be undone!'));

  const choices = [
    ...wallets.map(wallet => ({
      name: `${wallet.name} (${wallet.publicKey.slice(0, 8)}...)`,
      value: wallet.publicKey
    })),
    new inquirer.Separator(),
    { name: '🔙 Back', value: 'back' }
  ];

  const { selectedWallet } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedWallet',
    message: 'Select wallet to delete:',
    choices: choices
  }]);

  if (selectedWallet === 'back') {
    return;
  }

  const wallet = walletService.getWallet(selectedWallet);
  const isActive = walletService.getActiveWallet()?.publicKey === selectedWallet;

  console.log(chalk.yellow(`\nYou are about to delete: ${wallet?.name}`));
  if (isActive) {
    console.log(chalk.red('This is your ACTIVE wallet!'));
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Are you absolutely sure you want to delete this wallet?',
    default: false
  }]);

  if (!confirm) {
    console.log(chalk.gray('\n🚫 Deletion cancelled.'));
    await waitForUser();
    return;
  }

  try {
    walletService.deleteWallet(selectedWallet);

    console.log(chalk.green(`\n✅ Wallet "${wallet?.name}" deleted successfully!`));

    if (isActive) {
      const newActive = walletService.getActiveWallet();
      if (newActive) {
        console.log(chalk.blue(`🎯 New active wallet: ${newActive.name}`));
      } else {
        console.log(chalk.gray('🎯 No active wallet (no wallets remaining)'));
      }
    }

    console.log(`📊 Remaining wallets: ${walletService.listWallets().length}`);

  } catch (error) {
    console.log(chalk.red(`\n❌ Error deleting wallet: ${error}`));
  }

  await waitForUser();
}

async function waitForUser() {
  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: 'Press ENTER to continue...',
  }]);
}

async function transferFeesMenu() {
  console.log(chalk.blue.bold('\n💸 TRANSFER FEES TO ANOTHER WALLET\n'));

  const activeWallet = walletService.getActiveWallet();
  if (!activeWallet) {
    console.log(chalk.red('❌ No active wallet selected.'));
    await waitForUser();
    return;
  }

  console.log(chalk.yellow('🔄 Fetching positions with unclaimed fees...'));
  const positions = await positionService.getAllPositions(activeWallet.publicKey);
  const feeBearing = positions.filter((pos) => {
    const xFee = pos.unclaimedFees.xUi ?? 0;
    const yFee = pos.unclaimedFees.yUi ?? 0;
    return xFee > 0 || yFee > 0;
  });

  if (feeBearing.length === 0) {
    console.log(chalk.gray('\nNo unclaimed fees detected. Use "My Positions" to generate fees first.'));
    await waitForUser();
    return;
  }

  const choices = feeBearing.map((pos) => ({
    name: `${pos.tokenX.symbol || 'TokenX'}/${pos.tokenY.symbol || 'TokenY'} (${pos.publicKey.slice(0, 8)}...) -> ${formatUnclaimedFeeSummary(pos)}`,
    value: pos.publicKey,
    checked: true,
  }));

  const { selectedPositions } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedPositions',
      message: 'Select positions to claim & transfer fees from:',
      choices,
      pageSize: 10,
      validate: (value) => (value.length ? true : 'Select at least one position'),
    },
  ]);

  const chosenPositions = feeBearing.filter((pos) => selectedPositions.includes(pos.publicKey));
  if (chosenPositions.length === 0) {
    console.log(chalk.gray('\nOperation cancelled.'));
    await waitForUser();
    return;
  }

  const { destination } = await inquirer.prompt([
    {
      type: 'input',
      name: 'destination',
      message: 'Enter destination wallet address:',
      validate: (value) => {
        try {
          new PublicKey(value);
          return true;
        } catch {
          return 'Enter a valid Solana public key';
        }
      },
    },
  ]);

  const totals = aggregateFeesByMint(chosenPositions);
  if (!totals.length) {
    console.log(chalk.gray('\nNo transferable fees detected.'));
    await waitForUser();
    return;
  }

  console.log(chalk.yellow('\nThis action will:'));
  console.log('  1. Claim fees from the selected positions');
  console.log(`  2. Transfer the claimed tokens to ${destination}`);
  console.log('\nSummary:');
  totals.forEach((entry) => {
    console.log(`   • ${entry.symbol}: ${entry.amount.toFixed(6)} (mint ${entry.mint.slice(0, 6)}...)`);
  });

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Proceed with claim + transfer?',
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.gray('\nTransfer cancelled.'));
    await waitForUser();
    return;
  }

  const claimSignatures: string[] = [];
  for (const pos of chosenPositions) {
    try {
      const summary = await feeService.claimFeesForPosition(
        pos.poolAddress,
        new PublicKey(pos.publicKey)
      );
      summary.signatures.forEach((sig) => claimSignatures.push(sig));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to claim fees for ${pos.publicKey.slice(0, 8)}...: ${error instanceof Error ? error.message : error}`));
    }
  }

  if (claimSignatures.length > 0) {
    console.log(chalk.green(`\n✅ Claimed fees with ${claimSignatures.length} transactions.`));
  }

  const transferResults: Array<{ symbol: string; amount: number; signature?: string; error?: string }> = [];
  for (const entry of totals) {
    if (entry.amount <= 0) continue;
    try {
      const signature = await tokenService.transferSplToken({
        mint: entry.mint,
        amount: entry.amount,
        destination,
        decimals: entry.decimals,
      });
      transferResults.push({ symbol: entry.symbol, amount: entry.amount, signature });
    } catch (error) {
      transferResults.push({
        symbol: entry.symbol,
        amount: entry.amount,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log('\n📬 Transfer results:');
  transferResults.forEach((result) => {
    if (result.error) {
      console.log(chalk.red(`   • ${result.symbol}: Failed (${result.error})`));
    } else {
      console.log(chalk.green(`   • ${result.symbol}: Sent ${result.amount.toFixed(6)} (sig ${result.signature?.slice(0, 8)}...)`));
    }
  });

  await waitForUser();
}

function aggregateFeesByMint(positions: UserPosition[]): Array<{ mint: string; symbol: string; amount: number; decimals: number }> {
  const map = new Map<string, { mint: string; symbol: string; amount: number; decimals: number }>();

  const addAmount = (mint: string | undefined, symbol: string | undefined, amount: number | undefined, decimals?: number) => {
    if (!mint || !amount || amount <= 0) {
      return;
    }
    const key = mint;
    const existing = map.get(key);
    if (existing) {
      existing.amount += amount;
    } else {
      map.set(key, {
        mint,
        symbol: symbol || 'Token',
        amount,
        decimals: typeof decimals === 'number' ? decimals : 6,
      });
    }
  };

  positions.forEach((pos) => {
    addAmount(pos.tokenX?.mint, pos.tokenX?.symbol, pos.unclaimedFees?.xUi, pos.tokenX?.decimals);
    addAmount(pos.tokenY?.mint, pos.tokenY?.symbol, pos.unclaimedFees?.yUi, pos.tokenY?.decimals);
  });

  return Array.from(map.values()).filter((entry) => entry.amount > 0);
}

function formatUnclaimedFeeSummary(position: UserPosition): string {
  const parts: string[] = [];
  if (position.unclaimedFees?.xUi && position.unclaimedFees.xUi > 0) {
    parts.push(`${position.unclaimedFees.xUi.toFixed(4)} ${position.tokenX.symbol || 'TokenX'}`);
  }
  if (position.unclaimedFees?.yUi && position.unclaimedFees.yUi > 0) {
    parts.push(`${position.unclaimedFees.yUi.toFixed(4)} ${position.tokenY.symbol || 'TokenY'}`);
  }
  return parts.length ? parts.join(' / ') : '0';
}

async function configureTransactionDefaults() {
  console.log(chalk.blue.bold('\n⚙️ CONFIGURE TRANSACTION DEFAULTS\n'));

  const config = configManager.getConfig();
  const transaction = config.transaction;

  const { slippageInput } = await inquirer.prompt([
    {
      type: 'input',
      name: 'slippageInput',
      message: 'Default slippage (%) for position creation (or leave empty to cancel):',
      default: (transaction.slippage ?? DEFAULT_CONFIG.SLIPPAGE).toString(),
      validate: (value) => {
        if (!value || value.trim().length === 0) return true;
        const num = Number(value);
        return (num > 0 && num <= 5) ? true : 'Enter a value between 0 and 5';
      },
    },
  ]);

  if (!slippageInput || slippageInput.trim().length === 0) {
    console.log(chalk.gray('Operation cancelled.'));
    await waitForUser();
    return;
  }

  const slippage = Number(slippageInput);

  const { priorityMode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'priorityMode',
      message: 'Priority fee mode:',
      default: transaction.priorityFee ?? 'dynamic',
      choices: [
        { name: 'Dynamic (use cluster medians)', value: 'dynamic' },
        { name: 'Fixed (manual microLamports per compute unit)', value: 'fixed' },
      ],
    },
  ]);

  let priorityFeeAmount: number | undefined;
  let priorityFeeMultiplier: number | undefined;

  if (priorityMode === 'fixed') {
    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'priorityFeeAmount',
        message: 'Set microLamports per compute unit:',
        default: transaction.priorityFeeAmount ?? 1000,
        validate: (value) => (value > 0 ? true : 'Enter a positive number'),
      },
    ]);
    priorityFeeAmount = answers.priorityFeeAmount;
  } else {
    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'priorityFeeMultiplier',
        message: 'Dynamic multiplier (applied to median priority fee):',
        default: transaction.priorityFeeMultiplier ?? DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER,
        validate: (value) => (value > 0 ? true : 'Enter a positive number'),
      },
    ]);
    priorityFeeMultiplier = answers.priorityFeeMultiplier;
  }

  configManager.updateConfig({
    transaction: {
      ...transaction,
      slippage,
      priorityFee: priorityMode,
      priorityFeeAmount: priorityMode === 'fixed' ? priorityFeeAmount : undefined,
      priorityFeeMultiplier: priorityMode === 'dynamic'
        ? priorityFeeMultiplier ?? DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER
        : undefined,
    },
  });

  console.log(chalk.green('\n✅ Transaction defaults updated.'));
  await waitForUser();
}
