import inquirer from 'inquirer';
import chalk from 'chalk';
import { connectionService } from '../../services/connection.service';
// import { automationScheduler, DEFAULT_AUTOMATION_CONFIG, AutomationConfig } from '../../services/automationScheduler.service';
// import { notificationsService as notificationService } from '../../services/notifications.service';
import fs from 'fs';
import path from 'path';

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
    // console.log(chalk.blue.bold('⚙️  SETTINGS\n'));
}

export async function settingsMenu() {
    while (true) {
        try {
            displayHeader();
            console.log(chalk.blue.bold('⚙️  SETTINGS\n'));

            const currentConfig = connectionService.getConfig();
            console.log(chalk.yellow('📋 Current Configuration:'));
            console.log(`   RPC Endpoint: ${currentConfig.endpoint}`);
            console.log(`   Commitment: ${currentConfig.commitment}\n`);

            const choices = [
                new inquirer.Separator('═══ CONNECTION ═══'),
                '🔌 Switch RPC Endpoint',
                '⚙️  Change Commitment Level',
                '🧪 Test RPC Connection',
                '📊 Get Network Info',
                '🦅 Configure Birdeye API',
                new inquirer.Separator('═══ AI SETTINGS ═══'),
                '🤖 Configure LLM Provider',
                new inquirer.Separator('═══ NAVIGATION ═══'),
                '⬅️ Back to Main Menu'
            ];

            const answers = await inquirer.prompt({
                type: 'list',
                name: 'action',
                message: 'Settings:',
                choices: choices,
                pageSize: 12
            });

            const action = answers.action;

            if (action.includes('Test RPC Connection')) {
                await testRpcConnection();
            } else if (action.includes('Switch RPC Endpoint')) {
                await switchRpcEndpoint();
            } else if (action.includes('Change Commitment Level')) {
                await changeCommitmentLevel();
            } else if (action.includes('Get Network Info')) {
                await getNetworkInfo();
            } else if (action.includes('Configure Birdeye API')) {
                await configureBirdeye();
            } else if (action.includes('Configure LLM Provider')) {
                await configureLLM();
            } else if (action.includes('Automation Settings')) {
                console.log(chalk.yellow('\n⚠️ Automation settings coming soon!'));
                await waitForUser();
            } else if (action.includes('Notification Settings')) {
                console.log(chalk.yellow('\n⚠️ Notification settings coming soon!'));
                await waitForUser();
            } else if (action.includes('Risk Management')) {
                console.log(chalk.yellow('\n⚠️ Risk management coming soon!'));
                await waitForUser();
            } else if (action.includes('Back to Main Menu')) {
                return;
            }
        } catch (error: any) {
            if (error.message?.includes('force closed') || error.name === 'ExitPromptError') {
                throw error;
            }
            console.error(chalk.red('Error in settings menu:', error.message || 'Unknown error'));
            await waitForUser();
        }
    }
}

async function testRpcConnection() {
    console.log(chalk.blue.bold('\n🧪 TEST RPC CONNECTION\n'));

    try {
        console.log(chalk.yellow('🔄 Testing RPC connection...'));
        const result = await connectionService.testConnection();

        if (result.success) {
            console.log(chalk.green('\n✅ RPC CONNECTION SUCCESSFUL!\n'));
            console.log(chalk.blue('Network Information:'));
            console.log(`   Solana Version: ${result.version?.['solana-core']}`);
            console.log(`   Block Height: ${result.blockHeight}`);
        } else {
            console.log(chalk.red(`\n❌ RPC Connection Failed:`));
            console.log(chalk.red(`   Error: ${result.error}`));
        }
    } catch (error) {
        console.log(chalk.red(`\n❌ Error testing connection: ${error}`));
    }

    await waitForUser();
}

async function switchRpcEndpoint() {
    console.log(chalk.blue.bold('\n🔌 SWITCH RPC ENDPOINT\n'));

    const { endpointChoice } = await inquirer.prompt({
        type: 'list',
        name: 'endpointChoice',
        message: 'Select RPC endpoint:',
        choices: [
            { name: 'Mainnet (mainnet-beta)', value: 'https://api.mainnet-beta.solana.com' },
            { name: 'Devnet (devnet)', value: 'https://api.devnet.solana.com' },
            { name: 'Testnet (testnet)', value: 'https://api.testnet.solana.com' },
            { name: 'Custom endpoint', value: 'custom' },
            new inquirer.Separator(),
            { name: '🔙 Back', value: 'back' }
        ]
    });

    if (endpointChoice === 'back') {
        return;
    }

    if (endpointChoice === 'custom') {
        const { customEndpoint } = await inquirer.prompt({
            type: 'input',
            name: 'customEndpoint',
            message: 'Enter custom RPC endpoint URL (or leave empty to cancel):',
            validate: (input: string) => {
                if (!input || input.trim().length === 0) return true; // Allow empty to cancel
                try {
                    new URL(input);
                    return true;
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        });

        if (!customEndpoint || customEndpoint.trim().length === 0) {
            console.log(chalk.gray('Operation cancelled.'));
            await waitForUser();
            return;
        }

        try {
            connectionService.setRpcEndpoint(customEndpoint);
            console.log(chalk.green(`\n✅ RPC endpoint switched to: ${customEndpoint}`));
        } catch (error) {
            console.log(chalk.red(`\n❌ Error switching endpoint: ${error}`));
        }
    } else {
        try {
            connectionService.setRpcEndpoint(endpointChoice);
            const endpointName = endpointChoice.includes('mainnet') ? 'Mainnet' :
                endpointChoice.includes('devnet') ? 'Devnet' : 'Testnet';
            console.log(chalk.green(`\n✅ RPC endpoint switched to: ${endpointName}`));
        } catch (error) {
            console.log(chalk.red(`\n❌ Error switching endpoint: ${error}`));
        }
    }

    await waitForUser();
}

async function changeCommitmentLevel() {
    console.log(chalk.blue.bold('\n⚙️ CHANGE COMMITMENT LEVEL\n'));

    console.log(chalk.yellow('Commitment Levels:'));
    console.log('  processed  - Lowest latency, lowest confirmation');
    console.log('  confirmed  - Moderate latency, moderate confirmation');
    console.log('  finalized  - Highest latency, highest confirmation\n');

    const { commitment } = await inquirer.prompt({
        type: 'list',
        name: 'commitment',
        message: 'Select commitment level:',
        choices: [
            { name: 'processed', value: 'processed' },
            { name: 'confirmed', value: 'confirmed' },
            { name: 'finalized', value: 'finalized' },
            new inquirer.Separator(),
            { name: '🔙 Back', value: 'back' }
        ]
    });

    if (commitment === 'back') {
        return;
    }

    try {
        connectionService.setCommitment(commitment);
        console.log(chalk.green(`\n✅ Commitment level changed to: ${commitment}`));
    } catch (error) {
        console.log(chalk.red(`\n❌ Error changing commitment: ${error}`));
    }

    await waitForUser();
}

async function getNetworkInfo() {
    console.log(chalk.blue.bold('\n📊 NETWORK INFORMATION\n'));

    try {
        console.log(chalk.yellow('🔄 Fetching network information...'));

        const blockHash = await connectionService.getRecentBlockhash();
        console.log(chalk.green('\n✅ Network Information Retrieved!\n'));

        console.log(chalk.blue('Blockchain State:'));
        console.log(`   Recent Blockhash: ${blockHash.blockhash}`);
        console.log(`   Last Valid Block Height: ${blockHash.lastValidBlockHeight}`);

        const config = connectionService.getConfig();
        console.log(chalk.blue('\nConnection Config:'));
        console.log(`   RPC Endpoint: ${config.endpoint}`);
        console.log(`   Commitment: ${config.commitment}\n`);
    } catch (error) {
        console.log(chalk.red(`\n❌ Error fetching network info: ${error}`));
    }

    await waitForUser();
}

/*
async function automationSettingsMenu() {
    console.clear();
    console.log(chalk.blue.bold('🤖 AUTOMATION SETTINGS\n'));

    try {
        // Load current automation config or use defaults
        let config: AutomationConfig;
        try {
            const configPath = path.join(process.cwd(), 'data', 'automation-config.json');
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            } else {
                config = { ...DEFAULT_AUTOMATION_CONFIG };
            }
        } catch {
            config = { ...DEFAULT_AUTOMATION_CONFIG };
        }

        // Display current settings
        console.log(chalk.yellow('📋 Current Automation Settings:'));
        console.log(`   Automation: ${config.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
        console.log(`   Check Interval: ${config.checkIntervalMinutes} minutes`);
        console.log(`   Auto-Rebalance: ${config.autoRebalance.enabled ? chalk.green('On') : chalk.red('Off')}`);
        console.log(`   Auto-Claim Fees: ${config.autoClaimFees.enabled ? chalk.green('On') : chalk.red('Off')}`);
        console.log(`   Notifications: ${config.notifications.enabled ? chalk.green('On') : chalk.red('Off')}\n`);

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: 'Automation Settings:',
            choices: [
                config.enabled ? '🔴 Disable Automation' : '🟢 Enable Automation',
                '⏰ Set Check Interval',
                '♻️ Configure Auto-Rebalance',
                '💰 Configure Auto-Claim Fees',
                '📊 View Automation Status',
                '💾 Save Settings',
                '🔄 Reset to Defaults',
                '⬅️ Back'
            ]
        });

        if (action.includes('Enable') || action.includes('Disable')) {
            config.enabled = !config.enabled;
            console.log(chalk.green(`\n✅ Automation ${config.enabled ? 'enabled' : 'disabled'}`));
        } else if (action.includes('Check Interval')) {
            const { interval } = await inquirer.prompt({
                type: 'number',
                name: 'interval',
                message: 'Check interval (minutes):',
                default: config.checkIntervalMinutes,
                validate: (val) => val > 0 && val <= 1440 ? true : 'Enter 1-1440 minutes'
            });
            config.checkIntervalMinutes = interval;
            console.log(chalk.green(`\n✅ Check interval set to ${interval} minutes`));
        } else if (action.includes('Auto-Rebalance')) {
            await configureAutoRebalance(config);
        } else if (action.includes('Auto-Claim')) {
            await configureAutoClaimFees(config);
        } else if (action.includes('Status')) {
            await showAutomationStatus();
        } else if (action.includes('Save')) {
            await saveAutomationConfig(config);
        } else if (action.includes('Reset')) {
            config = { ...DEFAULT_AUTOMATION_CONFIG };
            console.log(chalk.green('\n✅ Settings reset to defaults'));
        } else {
            return;
        }

        await waitForUser();
        await automationSettingsMenu(); // Loop back
    } catch (error: any) {
        console.error(chalk.red(`Error in automation settings: ${error.message}`));
        await waitForUser();
    }
}

async function configureAutoRebalance(config: AutomationConfig) {
    console.log(chalk.cyan('\n♻️ AUTO-REBALANCE CONFIGURATION'));
    
    const { enabled } = await inquirer.prompt({
        type: 'confirm',
        name: 'enabled',
        message: 'Enable automatic rebalancing?',
        default: config.autoRebalance.enabled
    });
    
    config.autoRebalance.enabled = enabled;
    
    if (enabled) {
        const { priority } = await inquirer.prompt({
            type: 'list',
            name: 'priority',
            message: 'Minimum priority to trigger rebalance:',
            choices: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
            default: config.autoRebalance.minimumPriority
        });
        
        const { maxCost } = await inquirer.prompt({
            type: 'number',
            name: 'maxCost',
            message: 'Maximum daily cost for rebalances ($USD):',
            default: config.autoRebalance.maxDailyCostUsd,
            validate: (val: any) => val >= 0 ? true : 'Enter positive number'
        });
        
        const { breakEven } = await inquirer.prompt({
            type: 'number',
            name: 'breakEven',
            message: 'Minimum break-even time (hours):',
            default: config.autoRebalance.minBreakEvenHours,
            validate: (val: any) => val >= 0 ? true : 'Enter positive number'
        });
        
        config.autoRebalance.minimumPriority = priority;
        config.autoRebalance.maxDailyCostUsd = maxCost;
        config.autoRebalance.minBreakEvenHours = breakEven;
    }
    
    console.log(chalk.green('\n✅ Auto-rebalance settings updated'));
}

async function configureAutoClaimFees(config: AutomationConfig) {
    console.log(chalk.cyan('\n💰 AUTO-CLAIM FEES CONFIGURATION'));
    
    const { enabled } = await inquirer.prompt({
        type: 'confirm',
        name: 'enabled',
        message: 'Enable automatic fee claiming?',
        default: config.autoClaimFees.enabled
    });
    
    config.autoClaimFees.enabled = enabled;
    
    if (enabled) {
        const { threshold } = await inquirer.prompt({
            type: 'number',
            name: 'threshold',
            message: 'Fee threshold to trigger claim ($USD):',
            default: config.autoClaimFees.thresholdUsd,
            validate: (val: any) => val > 0 ? true : 'Enter positive number'
        });
        
        const { maxCost } = await inquirer.prompt({
            type: 'number',
            name: 'maxCost',
            message: 'Maximum daily cost for fee claims ($USD):',
            default: config.autoClaimFees.maxDailyCostUsd,
            validate: (val: any) => val >= 0 ? true : 'Enter positive number'
        });
        
        config.autoClaimFees.thresholdUsd = threshold;
        config.autoClaimFees.maxDailyCostUsd = maxCost;
    }
    
    console.log(chalk.green('\n✅ Auto-claim fees settings updated'));
}

async function showAutomationStatus() {
    console.clear();
    console.log(chalk.blue.bold('📊 AUTOMATION STATUS\n'));
    
    try {
        const status = automationScheduler.getStatus();
        
        console.log(chalk.yellow('🤖 Scheduler Status:'));
        console.log(`   Running: ${status.isRunning ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`   Last Check: ${status.lastCheckTime ? new Date(status.lastCheckTime).toLocaleString() : 'Never'}`);
        console.log(`   Next Check: ${status.nextCheckTime ? new Date(status.nextCheckTime).toLocaleString() : 'N/A'}`);
        
        console.log(chalk.cyan('\n📈 Statistics:'));
        console.log(`   Total Checks: ${status.totalChecks}`);
        console.log(`   Total Rebalances: ${status.totalRebalances}`);
        console.log(`   Total Fee Claims: ${status.totalFeeClaims}`);
        console.log(`   Total Cost: $${status.totalCostUsd.toFixed(2)}`);
        
        if (status.errors.length > 0) {
            console.log(chalk.red('\n❌ Recent Errors:'));
            status.errors.slice(-5).forEach(error => {
                console.log(`   ${new Date(error.timestamp).toLocaleString()}: ${error.error}`);
            });
        }
    } catch (error: any) {
        console.log(chalk.red(`Error fetching status: ${error.message}`));
    }
}

async function saveAutomationConfig(config: AutomationConfig) {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const configPath = path.join(dataDir, 'automation-config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log(chalk.green(`\n✅ Automation settings saved to ${configPath}`));
    } catch (error: any) {
        console.log(chalk.red(`\n❌ Error saving settings: ${error.message}`));
    }
}

async function notificationSettingsMenu() {
    console.clear();
    console.log(chalk.blue.bold('🔔 NOTIFICATION SETTINGS\n'));
    
    try {
        const notifications = await notificationService.getRecentNotifications(10);
        console.log(chalk.yellow(`📋 Recent Notifications (${notifications.length}):`));
        
        if (notifications.length === 0) {
            console.log(chalk.gray('   No notifications yet'));
        } else {
            notifications.slice(0, 5).forEach(notif => {
                const icon = notif.severity === 'error' ? '❌' : notif.severity === 'warning' ? '⚠️' : 'ℹ️';
                console.log(`   ${icon} ${notif.title} (${new Date(notif.timestamp).toLocaleString()})`);
            });
        }
        
        console.log();
        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: 'Notification Settings:',
            choices: [
                '📜 View All Notifications',
                '🗑️ Clear Old Notifications',
                '⚙️ Configure Notification Types',
                '⬅️ Back'
            ]
        });
        
        if (action.includes('View All')) {
            await showAllNotifications();
        } else if (action.includes('Clear')) {
            await notificationService.clearOldNotifications(7); // Clear older than 7 days
            console.log(chalk.green('\n✅ Old notifications cleared'));
        } else if (action.includes('Configure')) {
            console.log(chalk.yellow('\n⚠️ Notification type configuration is managed in Automation Settings'));
        } else {
            return;
        }
        
        await waitForUser();
        await notificationSettingsMenu();
    } catch (error: any) {
        console.error(chalk.red(`Error in notification settings: ${error.message}`));
        await waitForUser();
    }
}

async function showAllNotifications() {
    console.clear();
    console.log(chalk.blue.bold('📜 ALL NOTIFICATIONS\n'));
    
    try {
        const notifications = await notificationService.getRecentNotifications(50);
        
        if (notifications.length === 0) {
            console.log(chalk.gray('No notifications found'));
            return;
        }
        
        notifications.forEach((notif, idx) => {
            const icon = notif.severity === 'error' ? '❌' : notif.severity === 'warning' ? '⚠️' : 'ℹ️';
            const readStatus = notif.read ? '' : chalk.bold(' [NEW]');
            console.log(`${idx + 1}. ${icon} ${notif.title}${readStatus}`);
            console.log(`   ${notif.message}`);
            console.log(`   ${chalk.gray(new Date(notif.timestamp).toLocaleString())}\n`);
        });
        
        // Mark as read
        await notificationService.markAllAsRead();
    } catch (error: any) {
        console.log(chalk.red(`Error loading notifications: ${error.message}`));
    }
}

async function riskManagementMenu() {
    console.clear();
    console.log(chalk.blue.bold('🛡️ RISK MANAGEMENT\n'));
    
    console.log(chalk.yellow('⚠️ Risk management features are planned for future implementation'));
    console.log('\nPlanned features:');
    console.log('• Maximum impermanent loss alerts');
    console.log('• Emergency position exit thresholds');
    console.log('• Daily transaction cost limits');
    console.log('• Position value monitoring\n');
    
    await waitForUser();
}


}
*/

async function configureBirdeye() {
    console.log(chalk.blue.bold('\n🦅 CONFIGURE BIRDEYE API\n'));

    // Use configManager directly to get full config including preferences
    const { configManager } = require('../../config/config.manager');
    const currentConfig = configManager.getConfig();
    const currentKey = currentConfig.preferences.birdeyeApiKey;

    if (currentKey) {
        console.log(chalk.yellow('Current API Key: ') + `${currentKey.substring(0, 4)}...${currentKey.substring(currentKey.length - 4)}`);
    } else {
        console.log(chalk.yellow('Current API Key: ') + chalk.gray('(not set)'));
    }

    console.log(chalk.gray('\nBirdeye API is used to fetch historical price data for better LLM analysis.'));
    console.log(chalk.gray('Get a free key at: https://birdeye.so/\n'));

    const { apiKey } = await inquirer.prompt({
        type: 'password',
        name: 'apiKey',
        message: 'Enter Birdeye API Key (leave empty to keep current):',
        mask: '*'
    });

    if (!apiKey || apiKey.trim().length === 0) {
        console.log(chalk.gray('Operation cancelled.'));
        await waitForUser();
        return;
    }

    try {
        // Update config via configManager (accessed through connectionService for convenience, 
        // or we could import configManager directly if needed, but connectionService wraps it)
        // Since connectionService doesn't expose updateConfig directly for arbitrary fields,
        // we should use configManager directly here.
        const { configManager } = require('../../config/config.manager');

        const currentPreferences = configManager.getConfig().preferences;
        configManager.updateConfig({
            preferences: {
                ...currentPreferences,
                birdeyeApiKey: apiKey.trim()
            }
        });

        console.log(chalk.green('\n✅ Birdeye API Key saved successfully!'));
    } catch (error: any) {
        console.log(chalk.red(`\n❌ Error saving API key: ${error.message}`));
    }

    await waitForUser();
}

async function configureLLM() {
    console.log(chalk.blue.bold('\n🤖 CONFIGURE LLM PROVIDER\n'));

    try {
        const { configManager } = require('../../config/config.manager');
        const { llmAgent } = require('../../services/llmAgent.service');

        const currentConfig = configManager.getConfig().preferences.llm;

        if (currentConfig && currentConfig.provider !== 'none') {
            console.log(chalk.yellow('📋 Current LLM Configuration:'));
            console.log(`   Provider: ${currentConfig.provider}`);
            console.log(`   Model: ${currentConfig.model || 'default'}`);
            console.log(`   Status: ${llmAgent.isAvailable() ? chalk.green('✓ Available') : chalk.red('✗ Not Available')}\n`);
        } else {
            console.log(chalk.yellow('⚠️  No LLM provider configured yet.\n'));
        }

        // Provider selection
        const { provider } = await inquirer.prompt({
            type: 'list',
            name: 'provider',
            message: 'Select LLM Provider:',
            choices: [
                { name: '🤖 OpenAI (Recommended: GPT-4o-mini - Fast & Affordable)', value: 'openai' },
                { name: '🧠 DeepSeek (Current: Slower but detailed reasoning)', value: 'deepseek' },
                { name: '🎭 Anthropic Claude (High quality)', value: 'anthropic' },
                { name: '🚀 Grok (Fast)', value: 'grok' },
                { name: '💫 Kimi (Balanced)', value: 'kimi' },
                { name: '💎 Gemini (Fast)', value: 'gemini' },
                { name: '⬅️  Back', value: 'back' }
            ],
            default: currentConfig?.provider || 'openai'
        });

        if (provider === 'back') {
            return;
        }

        // API Key input
        const { apiKey } = await inquirer.prompt({
            type: 'password',
            name: 'apiKey',
            message: `Enter ${provider} API Key:`,
            mask: '*',
            validate: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'API Key cannot be empty';
                }
                return true;
            }
        });

        // Model selection based on provider
        let model = '';
        let baseURL = null;

        if (provider === 'openai') {
            const { selectedModel } = await inquirer.prompt({
                type: 'list',
                name: 'selectedModel',
                message: 'Select OpenAI Model:',
                choices: [
                    { name: '⚡ gpt-4o-mini (Recommended: 10-20x faster than DeepSeek)', value: 'gpt-4o-mini' },
                    { name: '🚀 gpt-4o (Faster, more expensive)', value: 'gpt-4o' },
                    { name: '🧠 gpt-4-turbo (High quality, slower)', value: 'gpt-4-turbo' },
                    { name: '💬 gpt-3.5-turbo (Very fast, basic)', value: 'gpt-3.5-turbo' }
                ],
                default: 'gpt-4o-mini'
            });
            model = selectedModel;
        } else if (provider === 'deepseek') {
            model = 'deepseek-reasoner';
            baseURL = 'https://api.deepseek.com';
        } else if (provider === 'anthropic') {
            model = 'claude-3-5-sonnet-20241022';
        } else if (provider === 'grok') {
            model = 'grok-beta';
            baseURL = 'https://api.x.ai/v1';
        } else if (provider === 'kimi') {
            model = 'moonshot-v1-8k';
            baseURL = 'https://api.moonshot.cn/v1';
        } else if (provider === 'gemini') {
            model = 'gemini-pro';
            baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
        }

        // Save configuration
        console.log(chalk.cyan('\n💾 Saving configuration...'));

        const currentPreferences = configManager.getConfig().preferences;
        configManager.updateConfig({
            preferences: {
                ...currentPreferences,
                llm: {
                    provider,
                    model,
                    apiKey: apiKey.trim(),
                    baseURL
                }
            }
        });

        console.log(chalk.green('\n✅ LLM Configuration saved successfully!'));
        console.log(chalk.yellow('\n📌 Important Notes:'));
        console.log(chalk.gray('   • Your API key is encrypted and stored securely'));
        console.log(chalk.gray('   • The CLI will reinitialize the LLM client on next use'));

        if (provider === 'openai' && model === 'gpt-4o-mini') {
            console.log(chalk.cyan('\n⚡ Speed Improvement:'));
            console.log(chalk.gray('   • DeepSeek R1: 30-60 seconds per analysis'));
            console.log(chalk.gray('   • GPT-4o-mini: 2-3 seconds per analysis (10-20x faster!)'));
            console.log(chalk.gray('   • Same quality recommendations, much faster experience\n'));
        }

        // Reload LLM agent
        llmAgent.reloadConfig();

        console.log(chalk.green('✓ LLM agent reloaded with new configuration\n'));

    } catch (error: any) {
        console.log(chalk.red(`\n❌ Error configuring LLM: ${error.message}`));
    }

    await waitForUser();
}
