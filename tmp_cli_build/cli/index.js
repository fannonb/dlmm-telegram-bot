#!/usr/bin/env node
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
// Load environment variables first
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
var commander_1 = require("commander");
var inquirer_1 = require("inquirer");
var chalk_1 = require("chalk");
var web3_js_1 = require("@solana/web3.js");
var wallet_service_1 = require("../services/wallet.service");
var connection_service_1 = require("../services/connection.service");
var position_service_1 = require("../services/position.service");
// Import command modules
var wallet_command_1 = require("./commands/wallet.command");
var config_command_1 = require("./commands/config.command");
var swap_command_1 = require("./commands/swap.command");
var analytics_command_1 = require("./commands/analytics.command");
var position_command_1 = require("./commands/position.command");
var llm_command_1 = require("./commands/llm.command");
var monitoring_command_1 = require("./commands/monitoring.command");
// CLI Art Header
function displayHeader() {
    console.clear();
    console.log(chalk_1.default.cyan.bold("\n  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2584   \u2584\u2588          \u2584\u2584\u2584\u2584\u2588\u2588\u2588\u2584\u2584\u2584\u2584      \u2584\u2584\u2584\u2584\u2588\u2588\u2588\u2584\u2584\u2584\u2584   \n  \u2588\u2588\u2588   \u2580\u2588\u2588\u2588 \u2588\u2588\u2588        \u2584\u2588\u2588\u2580\u2580\u2580\u2588\u2588\u2588\u2580\u2580\u2580\u2588\u2588\u2584  \u2584\u2588\u2588\u2580\u2580\u2580\u2588\u2588\u2588\u2580\u2580\u2580\u2588\u2588\u2584 \n  \u2588\u2588\u2588    \u2588\u2588\u2588 \u2588\u2588\u2588        \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588  \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588 \n  \u2588\u2588\u2588    \u2588\u2588\u2588 \u2588\u2588\u2588        \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588  \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588 \n  \u2588\u2588\u2588    \u2588\u2588\u2588 \u2588\u2588\u2588        \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588  \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588 \n  \u2588\u2588\u2588    \u2588\u2588\u2588 \u2588\u2588\u2588        \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588  \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588 \n  \u2588\u2588\u2588   \u2584\u2588\u2588\u2588 \u2588\u2588\u2588\u258C    \u2584  \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588  \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588 \n  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2580  \u2588\u2588\u2588\u2588\u2588\u2584\u2584\u2588\u2588   \u2580\u2588   \u2588\u2588\u2588   \u2588\u2580    \u2580\u2588   \u2588\u2588\u2588   \u2588\u2580  \n             \u2580                                            \n  "));
    console.log(chalk_1.default.yellow.bold('            METEORA DLMM CLI - LIQUIDITY PROVIDER'));
    console.log(chalk_1.default.gray('            Interactive Testing & Management Interface'));
    console.log(chalk_1.default.gray('            =========================================\n'));
}
function showMainMenu() {
    return __awaiter(this, void 0, void 0, function () {
        var wallets, activeWallet, positionsCount, positions, e_1, connection, balance, balanceSOL, error_1, answers, action, error_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!true) return [3 /*break*/, 34];
                    displayHeader();
                    wallets = wallet_service_1.walletService.listWallets();
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    positionsCount = 0;
                    if (!activeWallet) return [3 /*break*/, 4];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, position_service_1.positionService.getAllPositions(activeWallet.publicKey)];
                case 2:
                    positions = _b.sent();
                    positionsCount = positions.length;
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _b.sent();
                    return [3 /*break*/, 4];
                case 4:
                    console.log(chalk_1.default.blue.bold('📊 CURRENT STATUS:'));
                    console.log("   Wallets: ".concat(wallets.length));
                    if (!activeWallet) return [3 /*break*/, 10];
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 8, , 9]);
                    return [4 /*yield*/, connection_service_1.connectionService.getConnection()];
                case 6:
                    connection = _b.sent();
                    return [4 /*yield*/, connection.getBalance(new web3_js_1.PublicKey(activeWallet.publicKey))];
                case 7:
                    balance = _b.sent();
                    balanceSOL = balance / 1e9;
                    console.log("   Active: ".concat(activeWallet.name, " (").concat(activeWallet.publicKey.slice(0, 8), "...)"));
                    console.log("   Balance: ".concat(chalk_1.default.green(balanceSOL.toFixed(4) + ' SOL')));
                    return [3 /*break*/, 9];
                case 8:
                    error_1 = _b.sent();
                    console.log("   Active: ".concat(activeWallet.name, " (").concat(activeWallet.publicKey.slice(0, 8), "...)"));
                    console.log("   Balance: ".concat(chalk_1.default.red('Error fetching')));
                    return [3 /*break*/, 9];
                case 9: return [3 /*break*/, 11];
                case 10:
                    console.log("   Active: None");
                    _b.label = 11;
                case 11:
                    console.log("   Positions: ".concat(positionsCount, "\n"));
                    _b.label = 12;
                case 12:
                    _b.trys.push([12, 31, , 33]);
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'action',
                            message: 'What would you like to do?',
                            choices: [
                                new inquirer_1.default.Separator('═══ MAIN MENU ═══'),
                                '💼 My Positions',
                                '📊 Analytics & Monitoring',
                                '🤖 Automated Monitoring',
                                '➕ New Position',
                                '💱 Swap Tokens',
                                '🤖 LLM AI Selection',
                                new inquirer_1.default.Separator('═══ CONFIGURATION ═══'),
                                '🔑 Wallets',
                                '⚙️  Settings',
                                '❌ Exit'
                            ],
                            pageSize: 10
                        })];
                case 13:
                    answers = _b.sent();
                    action = answers.action;
                    if (!action.includes('My Positions')) return [3 /*break*/, 15];
                    return [4 /*yield*/, (0, position_command_1.myPositionsMenu)()];
                case 14:
                    _b.sent();
                    return [3 /*break*/, 30];
                case 15:
                    if (!action.includes('Analytics')) return [3 /*break*/, 17];
                    return [4 /*yield*/, (0, analytics_command_1.analyticsMenu)()];
                case 16:
                    _b.sent();
                    return [3 /*break*/, 30];
                case 17:
                    if (!action.includes('Automated Monitoring')) return [3 /*break*/, 19];
                    return [4 /*yield*/, (0, monitoring_command_1.monitoringCommand)()];
                case 18:
                    _b.sent();
                    return [3 /*break*/, 30];
                case 19:
                    if (!action.includes('New Position')) return [3 /*break*/, 21];
                    return [4 /*yield*/, (0, position_command_1.newPositionMenu)()];
                case 20:
                    _b.sent();
                    return [3 /*break*/, 30];
                case 21:
                    if (!action.includes('Swap Tokens')) return [3 /*break*/, 23];
                    return [4 /*yield*/, (0, swap_command_1.swapMenu)()];
                case 22:
                    _b.sent();
                    return [3 /*break*/, 30];
                case 23:
                    if (!action.includes('LLM AI Selection')) return [3 /*break*/, 25];
                    return [4 /*yield*/, (0, llm_command_1.llmConfigMenu)()];
                case 24:
                    _b.sent();
                    return [3 /*break*/, 30];
                case 25:
                    if (!action.includes('Wallets')) return [3 /*break*/, 27];
                    return [4 /*yield*/, (0, wallet_command_1.walletMenu)()];
                case 26:
                    _b.sent();
                    return [3 /*break*/, 30];
                case 27:
                    if (!action.includes('Settings')) return [3 /*break*/, 29];
                    return [4 /*yield*/, (0, config_command_1.settingsMenu)()];
                case 28:
                    _b.sent();
                    return [3 /*break*/, 30];
                case 29:
                    if (action.includes('Exit')) {
                        console.log(chalk_1.default.green('\n👋 Thank you for using DLMM CLI! Goodbye!'));
                        process.exit(0);
                    }
                    _b.label = 30;
                case 30: return [3 /*break*/, 33];
                case 31:
                    error_2 = _b.sent();
                    if (((_a = error_2.message) === null || _a === void 0 ? void 0 : _a.includes('force closed')) || error_2.name === 'ExitPromptError') {
                        console.log(chalk_1.default.yellow('\n👋 CLI session ended. Goodbye!'));
                        process.exit(0);
                    }
                    console.error(chalk_1.default.red('Error in main menu:', error_2.message || 'Unknown error'));
                    // Wait before restarting loop
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                case 32:
                    // Wait before restarting loop
                    _b.sent();
                    return [3 /*break*/, 33];
                case 33: return [3 /*break*/, 0];
                case 34: return [2 /*return*/];
            }
        });
    });
}
// Handle CLI arguments if any, otherwise show interactive menu
commander_1.program
    .version('1.0.0')
    .description('Meteora DLMM Liquidity Provider CLI')
    .action(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, showMainMenu()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
commander_1.program.command('interactive')
    .description('Start interactive mode')
    .action(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, showMainMenu()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
commander_1.program.command('wallet')
    .description('Manage wallets')
    .action(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, wallet_command_1.walletMenu)()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
commander_1.program.parse(process.argv);
// If no args, show help or start interactive?
// Commander handles this if we set up action on top level.
if (!process.argv.slice(2).length) {
    commander_1.program.outputHelp();
    // Or just start interactive:
    // showMainMenu();
}
