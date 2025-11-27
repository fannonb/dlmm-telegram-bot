"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsMenu = settingsMenu;
var inquirer_1 = require("inquirer");
var chalk_1 = require("chalk");
var connection_service_1 = require("../../services/connection.service");
// Helper for wait
function waitForUser() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, inquirer_1.default.prompt([{
                            type: 'input',
                            name: 'continue',
                            message: 'Press ENTER to continue...',
                        }])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function displayHeader() {
    // console.clear();
    // console.log(chalk.blue.bold('⚙️  SETTINGS\n'));
}
function settingsMenu() {
    return __awaiter(this, void 0, void 0, function () {
        var currentConfig, choices, answers, action, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!true) return [3 /*break*/, 21];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 18, , 20]);
                    displayHeader();
                    console.log(chalk_1.default.blue.bold('⚙️  SETTINGS\n'));
                    currentConfig = connection_service_1.connectionService.getConfig();
                    console.log(chalk_1.default.yellow('📋 Current Configuration:'));
                    console.log("   RPC Endpoint: ".concat(currentConfig.endpoint));
                    console.log("   Commitment: ".concat(currentConfig.commitment, "\n"));
                    choices = [
                        new inquirer_1.default.Separator('═══ CONNECTION ═══'),
                        '🔌 Switch RPC Endpoint',
                        '⚙️  Change Commitment Level',
                        '🧪 Test RPC Connection',
                        '📊 Get Network Info',
                        new inquirer_1.default.Separator('═══ NAVIGATION ═══'),
                        '⬅️ Back to Main Menu'
                    ];
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'action',
                            message: 'Settings:',
                            choices: choices,
                            pageSize: 10
                        })];
                case 2:
                    answers = _b.sent();
                    action = answers.action;
                    if (!action.includes('Test RPC Connection')) return [3 /*break*/, 4];
                    return [4 /*yield*/, testRpcConnection()];
                case 3:
                    _b.sent();
                    return [3 /*break*/, 17];
                case 4:
                    if (!action.includes('Switch RPC Endpoint')) return [3 /*break*/, 6];
                    return [4 /*yield*/, switchRpcEndpoint()];
                case 5:
                    _b.sent();
                    return [3 /*break*/, 17];
                case 6:
                    if (!action.includes('Change Commitment Level')) return [3 /*break*/, 8];
                    return [4 /*yield*/, changeCommitmentLevel()];
                case 7:
                    _b.sent();
                    return [3 /*break*/, 17];
                case 8:
                    if (!action.includes('Get Network Info')) return [3 /*break*/, 10];
                    return [4 /*yield*/, getNetworkInfo()];
                case 9:
                    _b.sent();
                    return [3 /*break*/, 17];
                case 10:
                    if (!action.includes('Automation Settings')) return [3 /*break*/, 12];
                    console.log(chalk_1.default.yellow('\n⚠️ Automation settings coming soon!'));
                    return [4 /*yield*/, waitForUser()];
                case 11:
                    _b.sent();
                    return [3 /*break*/, 17];
                case 12:
                    if (!action.includes('Notification Settings')) return [3 /*break*/, 14];
                    console.log(chalk_1.default.yellow('\n⚠️ Notification settings coming soon!'));
                    return [4 /*yield*/, waitForUser()];
                case 13:
                    _b.sent();
                    return [3 /*break*/, 17];
                case 14:
                    if (!action.includes('Risk Management')) return [3 /*break*/, 16];
                    console.log(chalk_1.default.yellow('\n⚠️ Risk management coming soon!'));
                    return [4 /*yield*/, waitForUser()];
                case 15:
                    _b.sent();
                    return [3 /*break*/, 17];
                case 16:
                    if (action.includes('Back to Main Menu')) {
                        return [2 /*return*/];
                    }
                    _b.label = 17;
                case 17: return [3 /*break*/, 20];
                case 18:
                    error_1 = _b.sent();
                    if (((_a = error_1.message) === null || _a === void 0 ? void 0 : _a.includes('force closed')) || error_1.name === 'ExitPromptError') {
                        throw error_1;
                    }
                    console.error(chalk_1.default.red('Error in settings menu:', error_1.message || 'Unknown error'));
                    return [4 /*yield*/, waitForUser()];
                case 19:
                    _b.sent();
                    return [3 /*break*/, 20];
                case 20: return [3 /*break*/, 0];
                case 21: return [2 /*return*/];
            }
        });
    });
}
function testRpcConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n🧪 TEST RPC CONNECTION\n'));
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    console.log(chalk_1.default.yellow('🔄 Testing RPC connection...'));
                    return [4 /*yield*/, connection_service_1.connectionService.testConnection()];
                case 2:
                    result = _b.sent();
                    if (result.success) {
                        console.log(chalk_1.default.green('\n✅ RPC CONNECTION SUCCESSFUL!\n'));
                        console.log(chalk_1.default.blue('Network Information:'));
                        console.log("   Solana Version: ".concat((_a = result.version) === null || _a === void 0 ? void 0 : _a['solana-core']));
                        console.log("   Block Height: ".concat(result.blockHeight));
                    }
                    else {
                        console.log(chalk_1.default.red("\n\u274C RPC Connection Failed:"));
                        console.log(chalk_1.default.red("   Error: ".concat(result.error)));
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _b.sent();
                    console.log(chalk_1.default.red("\n\u274C Error testing connection: ".concat(error_2)));
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, waitForUser()];
                case 5:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function switchRpcEndpoint() {
    return __awaiter(this, void 0, void 0, function () {
        var endpointChoice, customEndpoint, endpointName;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n🔌 SWITCH RPC ENDPOINT\n'));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'endpointChoice',
                            message: 'Select RPC endpoint:',
                            choices: [
                                { name: 'Mainnet (mainnet-beta)', value: 'https://api.mainnet-beta.solana.com' },
                                { name: 'Devnet (devnet)', value: 'https://api.devnet.solana.com' },
                                { name: 'Testnet (testnet)', value: 'https://api.testnet.solana.com' },
                                { name: 'Custom endpoint', value: 'custom' },
                                new inquirer_1.default.Separator(),
                                { name: '🔙 Back', value: 'back' }
                            ]
                        })];
                case 1:
                    endpointChoice = (_a.sent()).endpointChoice;
                    if (endpointChoice === 'back') {
                        return [2 /*return*/];
                    }
                    if (!(endpointChoice === 'custom')) return [3 /*break*/, 5];
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'input',
                            name: 'customEndpoint',
                            message: 'Enter custom RPC endpoint URL (or leave empty to cancel):',
                            validate: function (input) {
                                if (!input || input.trim().length === 0)
                                    return true; // Allow empty to cancel
                                try {
                                    new URL(input);
                                    return true;
                                }
                                catch (_a) {
                                    return 'Please enter a valid URL';
                                }
                            }
                        })];
                case 2:
                    customEndpoint = (_a.sent()).customEndpoint;
                    if (!(!customEndpoint || customEndpoint.trim().length === 0)) return [3 /*break*/, 4];
                    console.log(chalk_1.default.gray('Operation cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
                case 4:
                    try {
                        connection_service_1.connectionService.setRpcEndpoint(customEndpoint);
                        console.log(chalk_1.default.green("\n\u2705 RPC endpoint switched to: ".concat(customEndpoint)));
                    }
                    catch (error) {
                        console.log(chalk_1.default.red("\n\u274C Error switching endpoint: ".concat(error)));
                    }
                    return [3 /*break*/, 6];
                case 5:
                    try {
                        connection_service_1.connectionService.setRpcEndpoint(endpointChoice);
                        endpointName = endpointChoice.includes('mainnet') ? 'Mainnet' :
                            endpointChoice.includes('devnet') ? 'Devnet' : 'Testnet';
                        console.log(chalk_1.default.green("\n\u2705 RPC endpoint switched to: ".concat(endpointName)));
                    }
                    catch (error) {
                        console.log(chalk_1.default.red("\n\u274C Error switching endpoint: ".concat(error)));
                    }
                    _a.label = 6;
                case 6: return [4 /*yield*/, waitForUser()];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function changeCommitmentLevel() {
    return __awaiter(this, void 0, void 0, function () {
        var commitment;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n⚙️ CHANGE COMMITMENT LEVEL\n'));
                    console.log(chalk_1.default.yellow('Commitment Levels:'));
                    console.log('  processed  - Lowest latency, lowest confirmation');
                    console.log('  confirmed  - Moderate latency, moderate confirmation');
                    console.log('  finalized  - Highest latency, highest confirmation\n');
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'commitment',
                            message: 'Select commitment level:',
                            choices: [
                                { name: 'processed', value: 'processed' },
                                { name: 'confirmed', value: 'confirmed' },
                                { name: 'finalized', value: 'finalized' },
                                new inquirer_1.default.Separator(),
                                { name: '🔙 Back', value: 'back' }
                            ]
                        })];
                case 1:
                    commitment = (_a.sent()).commitment;
                    if (commitment === 'back') {
                        return [2 /*return*/];
                    }
                    try {
                        connection_service_1.connectionService.setCommitment(commitment);
                        console.log(chalk_1.default.green("\n\u2705 Commitment level changed to: ".concat(commitment)));
                    }
                    catch (error) {
                        console.log(chalk_1.default.red("\n\u274C Error changing commitment: ".concat(error)));
                    }
                    return [4 /*yield*/, waitForUser()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getNetworkInfo() {
    return __awaiter(this, void 0, void 0, function () {
        var blockHash, config, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n📊 NETWORK INFORMATION\n'));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    console.log(chalk_1.default.yellow('🔄 Fetching network information...'));
                    return [4 /*yield*/, connection_service_1.connectionService.getRecentBlockhash()];
                case 2:
                    blockHash = _a.sent();
                    console.log(chalk_1.default.green('\n✅ Network Information Retrieved!\n'));
                    console.log(chalk_1.default.blue('Blockchain State:'));
                    console.log("   Recent Blockhash: ".concat(blockHash.blockhash));
                    console.log("   Last Valid Block Height: ".concat(blockHash.lastValidBlockHeight));
                    config = connection_service_1.connectionService.getConfig();
                    console.log(chalk_1.default.blue('\nConnection Config:'));
                    console.log("   RPC Endpoint: ".concat(config.endpoint));
                    console.log("   Commitment: ".concat(config.commitment, "\n"));
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Error fetching network info: ".concat(error_3)));
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, waitForUser()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
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
*/
