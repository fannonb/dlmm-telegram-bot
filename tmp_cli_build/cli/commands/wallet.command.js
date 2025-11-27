"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletMenu = walletMenu;
var inquirer_1 = require("inquirer");
var chalk_1 = require("chalk");
var web3_js_1 = require("@solana/web3.js");
var wallet_service_1 = require("../../services/wallet.service");
var connection_service_1 = require("../../services/connection.service");
var position_service_1 = require("../../services/position.service");
var fee_service_1 = require("../../services/fee.service");
var token_service_1 = require("../../services/token.service");
var config_manager_1 = require("../../config/config.manager");
var constants_1 = require("../../config/constants");
function walletMenu() {
    return __awaiter(this, void 0, void 0, function () {
        var _loop_1, state_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _loop_1 = function () {
                        var wallets, activeWallet_1, choices, answers, action, error_1;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 21, , 23]);
                                    wallets = wallet_service_1.walletService.listWallets();
                                    activeWallet_1 = wallet_service_1.walletService.getActiveWallet();
                                    console.log(chalk_1.default.blue.bold('\n🔑 WALLET MANAGEMENT\n'));
                                    if (wallets.length > 0) {
                                        console.log(chalk_1.default.yellow('📋 Current Wallets:'));
                                        wallets.forEach(function (wallet, index) {
                                            var isActive = wallet.publicKey === (activeWallet_1 === null || activeWallet_1 === void 0 ? void 0 : activeWallet_1.publicKey);
                                            console.log("   ".concat(index + 1, ". ").concat(wallet.name, " (").concat(wallet.publicKey.slice(0, 8), "...) ").concat(isActive ? chalk_1.default.green('⭐ ACTIVE') : ''));
                                        });
                                        console.log();
                                    }
                                    else {
                                        console.log(chalk_1.default.gray('📋 No wallets found. Create or import a wallet to get started.\n'));
                                    }
                                    choices = __spreadArray(__spreadArray([
                                        '➕ Create New Wallet',
                                        '📥 Import from Mnemonic',
                                        '🔐 Import from Private Key'
                                    ], (wallets.length > 0 ? [
                                        '📋 List All Wallets',
                                        '🎯 Set Active Wallet',
                                        '📤 Export Private Key',
                                        '💸 Transfer Fees to Wallet',
                                        '⚙️ Configure Transaction Defaults',
                                        '🗑️ Delete Wallet'
                                    ] : []), true), [
                                        '🔙 Back to Main Menu'
                                    ], false);
                                    return [4 /*yield*/, inquirer_1.default.prompt({
                                            type: 'list',
                                            name: 'action',
                                            message: 'Wallet operations:',
                                            choices: choices,
                                            pageSize: 10
                                        })];
                                case 1:
                                    answers = _c.sent();
                                    action = answers.action;
                                    if (!action.includes('Create New Wallet')) return [3 /*break*/, 3];
                                    return [4 /*yield*/, createWallet()];
                                case 2:
                                    _c.sent();
                                    return [3 /*break*/, 20];
                                case 3:
                                    if (!action.includes('Import from Mnemonic')) return [3 /*break*/, 5];
                                    return [4 /*yield*/, importFromMnemonic()];
                                case 4:
                                    _c.sent();
                                    return [3 /*break*/, 20];
                                case 5:
                                    if (!action.includes('Import from Private Key')) return [3 /*break*/, 7];
                                    return [4 /*yield*/, importFromPrivateKey()];
                                case 6:
                                    _c.sent();
                                    return [3 /*break*/, 20];
                                case 7:
                                    if (!action.includes('List All Wallets')) return [3 /*break*/, 9];
                                    return [4 /*yield*/, listWallets()];
                                case 8:
                                    _c.sent();
                                    return [3 /*break*/, 20];
                                case 9:
                                    if (!action.includes('Set Active Wallet')) return [3 /*break*/, 11];
                                    return [4 /*yield*/, setActiveWallet()];
                                case 10:
                                    _c.sent();
                                    return [3 /*break*/, 20];
                                case 11:
                                    if (!action.includes('Export Private Key')) return [3 /*break*/, 13];
                                    return [4 /*yield*/, exportPrivateKey()];
                                case 12:
                                    _c.sent();
                                    return [3 /*break*/, 20];
                                case 13:
                                    if (!action.includes('Transfer Fees')) return [3 /*break*/, 15];
                                    return [4 /*yield*/, transferFeesMenu()];
                                case 14:
                                    _c.sent();
                                    return [3 /*break*/, 20];
                                case 15:
                                    if (!action.includes('Configure Transaction')) return [3 /*break*/, 17];
                                    return [4 /*yield*/, configureTransactionDefaults()];
                                case 16:
                                    _c.sent();
                                    return [3 /*break*/, 20];
                                case 17:
                                    if (!action.includes('Delete Wallet')) return [3 /*break*/, 19];
                                    return [4 /*yield*/, deleteWallet()];
                                case 18:
                                    _c.sent();
                                    return [3 /*break*/, 20];
                                case 19:
                                    if (action.includes('Back to Main Menu')) {
                                        return [2 /*return*/, { value: void 0 }];
                                    }
                                    _c.label = 20;
                                case 20: return [3 /*break*/, 23];
                                case 21:
                                    error_1 = _c.sent();
                                    if (((_a = error_1.message) === null || _a === void 0 ? void 0 : _a.includes('force closed')) || error_1.name === 'ExitPromptError') {
                                        throw error_1;
                                    }
                                    console.error(chalk_1.default.red('Error in wallet menu:', error_1.message || 'Unknown error'));
                                    return [4 /*yield*/, waitForUser()];
                                case 22:
                                    _c.sent();
                                    return [3 /*break*/, 23];
                                case 23: return [2 /*return*/];
                            }
                        });
                    };
                    _b.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 3];
                    return [5 /*yield**/, _loop_1()];
                case 2:
                    state_1 = _b.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createWallet() {
    return __awaiter(this, void 0, void 0, function () {
        var name, _a, wallet, mnemonic, keypair, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n🔑 CREATE NEW WALLET\n'));
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'input',
                                name: 'name',
                                message: 'Enter wallet name (or leave empty to cancel):',
                            }])];
                case 1:
                    name = (_b.sent()).name;
                    if (!(!name || name.trim().length === 0)) return [3 /*break*/, 3];
                    console.log(chalk_1.default.gray('Operation cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 2:
                    _b.sent();
                    return [2 /*return*/];
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    console.log(chalk_1.default.yellow('🔄 Creating wallet...'));
                    return [4 /*yield*/, wallet_service_1.walletService.createWallet(name.trim())];
                case 4:
                    _a = _b.sent(), wallet = _a.wallet, mnemonic = _a.mnemonic, keypair = _a.keypair;
                    console.log(chalk_1.default.green.bold('\n✅ WALLET CREATED SUCCESSFULLY!\n'));
                    console.log(chalk_1.default.blue('📋 Wallet Details:'));
                    console.log("   Name: ".concat(wallet.name));
                    console.log("   Public Key: ".concat(wallet.publicKey));
                    console.log("   Created: ".concat(new Date(wallet.createdAt).toLocaleString()));
                    console.log("   Status: ".concat(chalk_1.default.green('⭐ ACTIVE'), "\n"));
                    console.log(chalk_1.default.red.bold('🔐 IMPORTANT - SAVE YOUR RECOVERY PHRASE:'));
                    console.log(chalk_1.default.yellow("   ".concat(mnemonic, "\n")));
                    console.log(chalk_1.default.red('⚠️  Store this mnemonic phrase securely! It\'s the only way to recover your wallet.'));
                    return [3 /*break*/, 6];
                case 5:
                    error_2 = _b.sent();
                    console.log(chalk_1.default.red("\n\u274C Error creating wallet: ".concat(error_2)));
                    return [3 /*break*/, 6];
                case 6: return [4 /*yield*/, waitForUser()];
                case 7:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function importFromMnemonic() {
    return __awaiter(this, void 0, void 0, function () {
        var answers, mnemonicAnswer, wallet, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n📥 IMPORT WALLET FROM MNEMONIC\n'));
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'input',
                                name: 'name',
                                message: 'Enter wallet name (or leave empty to cancel):',
                            }
                        ])];
                case 1:
                    answers = _a.sent();
                    if (!(!answers.name || answers.name.trim().length === 0)) return [3 /*break*/, 3];
                    console.log(chalk_1.default.gray('Operation cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3: return [4 /*yield*/, inquirer_1.default.prompt([
                        {
                            type: 'password',
                            name: 'mnemonic',
                            message: 'Enter mnemonic phrase (12 words):',
                            validate: function (input) {
                                var words = input.trim().split(' ');
                                return words.length === 12 ? true : 'Please enter exactly 12 words';
                            }
                        }
                    ])];
                case 4:
                    mnemonicAnswer = _a.sent();
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    console.log(chalk_1.default.yellow('🔄 Importing wallet...'));
                    return [4 /*yield*/, wallet_service_1.walletService.importFromMnemonic(answers.name.trim(), mnemonicAnswer.mnemonic.trim())];
                case 6:
                    wallet = _a.sent();
                    console.log(chalk_1.default.green.bold('\n✅ WALLET IMPORTED SUCCESSFULLY!\n'));
                    console.log(chalk_1.default.blue('📋 Wallet Details:'));
                    console.log("   Name: ".concat(wallet.name));
                    console.log("   Public Key: ".concat(wallet.publicKey));
                    console.log("   Status: ".concat(chalk_1.default.green('⭐ ACTIVE'), "\n"));
                    return [3 /*break*/, 8];
                case 7:
                    error_3 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Error importing wallet: ".concat(error_3)));
                    return [3 /*break*/, 8];
                case 8: return [4 /*yield*/, waitForUser()];
                case 9:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function importFromPrivateKey() {
    return __awaiter(this, void 0, void 0, function () {
        var answers, keyAnswer, wallet, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n🔐 IMPORT WALLET FROM PRIVATE KEY\n'));
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'input',
                                name: 'name',
                                message: 'Enter wallet name (or leave empty to cancel):',
                            }
                        ])];
                case 1:
                    answers = _a.sent();
                    if (!(!answers.name || answers.name.trim().length === 0)) return [3 /*break*/, 3];
                    console.log(chalk_1.default.gray('Operation cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3: return [4 /*yield*/, inquirer_1.default.prompt([
                        {
                            type: 'password',
                            name: 'privateKey',
                            message: 'Enter private key (base58):',
                            validate: function (input) { return input.trim() ? true : 'Private key is required'; }
                        }
                    ])];
                case 4:
                    keyAnswer = _a.sent();
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    console.log(chalk_1.default.yellow('🔄 Importing wallet...'));
                    return [4 /*yield*/, wallet_service_1.walletService.importFromPrivateKey(answers.name.trim(), keyAnswer.privateKey.trim())];
                case 6:
                    wallet = _a.sent();
                    console.log(chalk_1.default.green.bold('\n✅ WALLET IMPORTED SUCCESSFULLY!\n'));
                    console.log(chalk_1.default.blue('📋 Wallet Details:'));
                    console.log("   Name: ".concat(wallet.name));
                    console.log("   Public Key: ".concat(wallet.publicKey));
                    console.log("   Status: ".concat(chalk_1.default.green('⭐ ACTIVE'), "\n"));
                    return [3 /*break*/, 8];
                case 7:
                    error_4 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Error importing wallet: ".concat(error_4)));
                    return [3 /*break*/, 8];
                case 8: return [4 /*yield*/, waitForUser()];
                case 9:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function listWallets() {
    return __awaiter(this, void 0, void 0, function () {
        var wallets, activeWallet, connection, index, wallet, isActive, balance, balanceSOL, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n📋 ALL WALLETS\n'));
                    wallets = wallet_service_1.walletService.listWallets();
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!(wallets.length === 0)) return [3 /*break*/, 2];
                    console.log(chalk_1.default.gray('No wallets found.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    console.log(chalk_1.default.yellow('🔄 Fetching balances...\n'));
                    return [4 /*yield*/, connection_service_1.connectionService.getConnection()];
                case 3:
                    connection = _a.sent();
                    index = 0;
                    _a.label = 4;
                case 4:
                    if (!(index < wallets.length)) return [3 /*break*/, 9];
                    wallet = wallets[index];
                    isActive = wallet.publicKey === (activeWallet === null || activeWallet === void 0 ? void 0 : activeWallet.publicKey);
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, connection.getBalance(new web3_js_1.PublicKey(wallet.publicKey))];
                case 6:
                    balance = _a.sent();
                    balanceSOL = balance / 1e9;
                    console.log("".concat(index + 1, ". ").concat(chalk_1.default.cyan(wallet.name)));
                    console.log("   Public Key: ".concat(wallet.publicKey));
                    console.log("   Balance: ".concat(chalk_1.default.green(balanceSOL.toFixed(4) + ' SOL')));
                    console.log("   Created: ".concat(new Date(wallet.createdAt).toLocaleString()));
                    console.log("   Status: ".concat(isActive ? chalk_1.default.green('⭐ ACTIVE') : chalk_1.default.gray('Inactive'), "\n"));
                    return [3 /*break*/, 8];
                case 7:
                    error_5 = _a.sent();
                    console.log("".concat(index + 1, ". ").concat(chalk_1.default.cyan(wallet.name)));
                    console.log("   Public Key: ".concat(wallet.publicKey));
                    console.log("   Balance: ".concat(chalk_1.default.red('Error fetching balance')));
                    console.log("   Created: ".concat(new Date(wallet.createdAt).toLocaleString()));
                    console.log("   Status: ".concat(isActive ? chalk_1.default.green('⭐ ACTIVE') : chalk_1.default.gray('Inactive'), "\n"));
                    return [3 /*break*/, 8];
                case 8:
                    index++;
                    return [3 /*break*/, 4];
                case 9: return [4 /*yield*/, waitForUser()];
                case 10:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function setActiveWallet() {
    return __awaiter(this, void 0, void 0, function () {
        var wallets, activeWallet, choices, selectedWallet, newActive;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    wallets = wallet_service_1.walletService.listWallets();
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!(wallets.length === 0)) return [3 /*break*/, 2];
                    console.log(chalk_1.default.red('\n❌ No wallets available.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    console.log(chalk_1.default.blue.bold('\n🎯 SET ACTIVE WALLET\n'));
                    choices = __spreadArray(__spreadArray([], wallets.map(function (wallet) { return ({
                        name: "".concat(wallet.name, " (").concat(wallet.publicKey.slice(0, 8), "...) ").concat(wallet.publicKey === (activeWallet === null || activeWallet === void 0 ? void 0 : activeWallet.publicKey) ? chalk_1.default.green('[CURRENT]') : ''),
                        value: wallet.publicKey
                    }); }), true), [
                        new inquirer_1.default.Separator(),
                        { name: '🔙 Back', value: 'back' }
                    ], false);
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'list',
                                name: 'selectedWallet',
                                message: 'Select wallet to make active:',
                                choices: choices
                            }])];
                case 3:
                    selectedWallet = (_a.sent()).selectedWallet;
                    if (selectedWallet === 'back') {
                        return [2 /*return*/];
                    }
                    try {
                        wallet_service_1.walletService.setActiveWallet(selectedWallet);
                        newActive = wallet_service_1.walletService.getActiveWallet();
                        console.log(chalk_1.default.green("\n\u2705 Active wallet set to: ".concat(newActive === null || newActive === void 0 ? void 0 : newActive.name)));
                    }
                    catch (error) {
                        console.log(chalk_1.default.red("\n\u274C Error setting active wallet: ".concat(error)));
                    }
                    return [4 /*yield*/, waitForUser()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function exportPrivateKey() {
    return __awaiter(this, void 0, void 0, function () {
        var wallets, choices, selectedWallet, confirm, privateKey, wallet;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    wallets = wallet_service_1.walletService.listWallets();
                    if (!(wallets.length === 0)) return [3 /*break*/, 2];
                    console.log(chalk_1.default.red('\n❌ No wallets available.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    console.log(chalk_1.default.blue.bold('\n📤 EXPORT PRIVATE KEY\n'));
                    console.log(chalk_1.default.red('⚠️  WARNING: Never share your private key with anyone!'));
                    choices = __spreadArray(__spreadArray([], wallets.map(function (wallet) { return ({
                        name: "".concat(wallet.name, " (").concat(wallet.publicKey.slice(0, 8), "...)"),
                        value: wallet.publicKey
                    }); }), true), [
                        new inquirer_1.default.Separator(),
                        { name: '🔙 Back', value: 'back' }
                    ], false);
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'list',
                                name: 'selectedWallet',
                                message: 'Select wallet to export private key:',
                                choices: choices
                            }])];
                case 3:
                    selectedWallet = (_a.sent()).selectedWallet;
                    if (selectedWallet === 'back') {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'confirm',
                                name: 'confirm',
                                message: 'Are you sure you want to export the private key?',
                                default: false
                            }])];
                case 4:
                    confirm = (_a.sent()).confirm;
                    if (!!confirm) return [3 /*break*/, 6];
                    console.log(chalk_1.default.gray('\n🚫 Export cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
                case 6:
                    try {
                        privateKey = wallet_service_1.walletService.exportPrivateKey(selectedWallet);
                        wallet = wallet_service_1.walletService.getWallet(selectedWallet);
                        console.log(chalk_1.default.green.bold('\n✅ PRIVATE KEY EXPORTED:\n'));
                        console.log(chalk_1.default.blue("Wallet: ".concat(wallet === null || wallet === void 0 ? void 0 : wallet.name)));
                        console.log(chalk_1.default.blue("Public Key: ".concat(selectedWallet)));
                        console.log(chalk_1.default.yellow("Private Key: ".concat(privateKey, "\n")));
                        console.log(chalk_1.default.red('⚠️  Store this private key securely and never share it!'));
                    }
                    catch (error) {
                        console.log(chalk_1.default.red("\n\u274C Error exporting private key: ".concat(error)));
                    }
                    return [4 /*yield*/, waitForUser()];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function deleteWallet() {
    return __awaiter(this, void 0, void 0, function () {
        var wallets, choices, selectedWallet, wallet, isActive, confirm, newActive;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    wallets = wallet_service_1.walletService.listWallets();
                    if (!(wallets.length === 0)) return [3 /*break*/, 2];
                    console.log(chalk_1.default.red('\n❌ No wallets available.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _b.sent();
                    return [2 /*return*/];
                case 2:
                    console.log(chalk_1.default.blue.bold('\n🗑️ DELETE WALLET\n'));
                    console.log(chalk_1.default.red('⚠️  WARNING: This action cannot be undone!'));
                    choices = __spreadArray(__spreadArray([], wallets.map(function (wallet) { return ({
                        name: "".concat(wallet.name, " (").concat(wallet.publicKey.slice(0, 8), "...)"),
                        value: wallet.publicKey
                    }); }), true), [
                        new inquirer_1.default.Separator(),
                        { name: '🔙 Back', value: 'back' }
                    ], false);
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'list',
                                name: 'selectedWallet',
                                message: 'Select wallet to delete:',
                                choices: choices
                            }])];
                case 3:
                    selectedWallet = (_b.sent()).selectedWallet;
                    if (selectedWallet === 'back') {
                        return [2 /*return*/];
                    }
                    wallet = wallet_service_1.walletService.getWallet(selectedWallet);
                    isActive = ((_a = wallet_service_1.walletService.getActiveWallet()) === null || _a === void 0 ? void 0 : _a.publicKey) === selectedWallet;
                    console.log(chalk_1.default.yellow("\nYou are about to delete: ".concat(wallet === null || wallet === void 0 ? void 0 : wallet.name)));
                    if (isActive) {
                        console.log(chalk_1.default.red('This is your ACTIVE wallet!'));
                    }
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'confirm',
                                name: 'confirm',
                                message: 'Are you absolutely sure you want to delete this wallet?',
                                default: false
                            }])];
                case 4:
                    confirm = (_b.sent()).confirm;
                    if (!!confirm) return [3 /*break*/, 6];
                    console.log(chalk_1.default.gray('\n🚫 Deletion cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 5:
                    _b.sent();
                    return [2 /*return*/];
                case 6:
                    try {
                        wallet_service_1.walletService.deleteWallet(selectedWallet);
                        console.log(chalk_1.default.green("\n\u2705 Wallet \"".concat(wallet === null || wallet === void 0 ? void 0 : wallet.name, "\" deleted successfully!")));
                        if (isActive) {
                            newActive = wallet_service_1.walletService.getActiveWallet();
                            if (newActive) {
                                console.log(chalk_1.default.blue("\uD83C\uDFAF New active wallet: ".concat(newActive.name)));
                            }
                            else {
                                console.log(chalk_1.default.gray('🎯 No active wallet (no wallets remaining)'));
                            }
                        }
                        console.log("\uD83D\uDCCA Remaining wallets: ".concat(wallet_service_1.walletService.listWallets().length));
                    }
                    catch (error) {
                        console.log(chalk_1.default.red("\n\u274C Error deleting wallet: ".concat(error)));
                    }
                    return [4 /*yield*/, waitForUser()];
                case 7:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
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
function transferFeesMenu() {
    return __awaiter(this, void 0, void 0, function () {
        var activeWallet, positions, feeBearing, choices, selectedPositions, chosenPositions, destination, totals, confirm, claimSignatures, _i, chosenPositions_1, pos, summary, error_6, transferResults, _a, totals_1, entry, signature, error_7;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n💸 TRANSFER FEES TO ANOTHER WALLET\n'));
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!!activeWallet) return [3 /*break*/, 2];
                    console.log(chalk_1.default.red('❌ No active wallet selected.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _b.sent();
                    return [2 /*return*/];
                case 2:
                    console.log(chalk_1.default.yellow('🔄 Fetching positions with unclaimed fees...'));
                    return [4 /*yield*/, position_service_1.positionService.getAllPositions(activeWallet.publicKey)];
                case 3:
                    positions = _b.sent();
                    feeBearing = positions.filter(function (pos) {
                        var _a, _b;
                        var xFee = (_a = pos.unclaimedFees.xUi) !== null && _a !== void 0 ? _a : 0;
                        var yFee = (_b = pos.unclaimedFees.yUi) !== null && _b !== void 0 ? _b : 0;
                        return xFee > 0 || yFee > 0;
                    });
                    if (!(feeBearing.length === 0)) return [3 /*break*/, 5];
                    console.log(chalk_1.default.gray('\nNo unclaimed fees detected. Use "My Positions" to generate fees first.'));
                    return [4 /*yield*/, waitForUser()];
                case 4:
                    _b.sent();
                    return [2 /*return*/];
                case 5:
                    choices = feeBearing.map(function (pos) { return ({
                        name: "".concat(pos.tokenX.symbol || 'TokenX', "/").concat(pos.tokenY.symbol || 'TokenY', " (").concat(pos.publicKey.slice(0, 8), "...) -> ").concat(formatUnclaimedFeeSummary(pos)),
                        value: pos.publicKey,
                        checked: true,
                    }); });
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'checkbox',
                                name: 'selectedPositions',
                                message: 'Select positions to claim & transfer fees from:',
                                choices: choices,
                                pageSize: 10,
                                validate: function (value) { return (value.length ? true : 'Select at least one position'); },
                            },
                        ])];
                case 6:
                    selectedPositions = (_b.sent()).selectedPositions;
                    chosenPositions = feeBearing.filter(function (pos) { return selectedPositions.includes(pos.publicKey); });
                    if (!(chosenPositions.length === 0)) return [3 /*break*/, 8];
                    console.log(chalk_1.default.gray('\nOperation cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 7:
                    _b.sent();
                    return [2 /*return*/];
                case 8: return [4 /*yield*/, inquirer_1.default.prompt([
                        {
                            type: 'input',
                            name: 'destination',
                            message: 'Enter destination wallet address:',
                            validate: function (value) {
                                try {
                                    new web3_js_1.PublicKey(value);
                                    return true;
                                }
                                catch (_a) {
                                    return 'Enter a valid Solana public key';
                                }
                            },
                        },
                    ])];
                case 9:
                    destination = (_b.sent()).destination;
                    totals = aggregateFeesByMint(chosenPositions);
                    if (!!totals.length) return [3 /*break*/, 11];
                    console.log(chalk_1.default.gray('\nNo transferable fees detected.'));
                    return [4 /*yield*/, waitForUser()];
                case 10:
                    _b.sent();
                    return [2 /*return*/];
                case 11:
                    console.log(chalk_1.default.yellow('\nThis action will:'));
                    console.log('  1. Claim fees from the selected positions');
                    console.log("  2. Transfer the claimed tokens to ".concat(destination));
                    console.log('\nSummary:');
                    totals.forEach(function (entry) {
                        console.log("   \u2022 ".concat(entry.symbol, ": ").concat(entry.amount.toFixed(6), " (mint ").concat(entry.mint.slice(0, 6), "...)"));
                    });
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'confirm',
                                name: 'confirm',
                                message: 'Proceed with claim + transfer?',
                                default: true,
                            },
                        ])];
                case 12:
                    confirm = (_b.sent()).confirm;
                    if (!!confirm) return [3 /*break*/, 14];
                    console.log(chalk_1.default.gray('\nTransfer cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 13:
                    _b.sent();
                    return [2 /*return*/];
                case 14:
                    claimSignatures = [];
                    _i = 0, chosenPositions_1 = chosenPositions;
                    _b.label = 15;
                case 15:
                    if (!(_i < chosenPositions_1.length)) return [3 /*break*/, 20];
                    pos = chosenPositions_1[_i];
                    _b.label = 16;
                case 16:
                    _b.trys.push([16, 18, , 19]);
                    return [4 /*yield*/, fee_service_1.feeService.claimFeesForPosition(pos.poolAddress, new web3_js_1.PublicKey(pos.publicKey))];
                case 17:
                    summary = _b.sent();
                    summary.signatures.forEach(function (sig) { return claimSignatures.push(sig); });
                    return [3 /*break*/, 19];
                case 18:
                    error_6 = _b.sent();
                    console.log(chalk_1.default.red("\u274C Failed to claim fees for ".concat(pos.publicKey.slice(0, 8), "...: ").concat(error_6 instanceof Error ? error_6.message : error_6)));
                    return [3 /*break*/, 19];
                case 19:
                    _i++;
                    return [3 /*break*/, 15];
                case 20:
                    if (claimSignatures.length > 0) {
                        console.log(chalk_1.default.green("\n\u2705 Claimed fees with ".concat(claimSignatures.length, " transactions.")));
                    }
                    transferResults = [];
                    _a = 0, totals_1 = totals;
                    _b.label = 21;
                case 21:
                    if (!(_a < totals_1.length)) return [3 /*break*/, 26];
                    entry = totals_1[_a];
                    if (entry.amount <= 0)
                        return [3 /*break*/, 25];
                    _b.label = 22;
                case 22:
                    _b.trys.push([22, 24, , 25]);
                    return [4 /*yield*/, token_service_1.tokenService.transferSplToken({
                            mint: entry.mint,
                            amount: entry.amount,
                            destination: destination,
                            decimals: entry.decimals,
                        })];
                case 23:
                    signature = _b.sent();
                    transferResults.push({ symbol: entry.symbol, amount: entry.amount, signature: signature });
                    return [3 /*break*/, 25];
                case 24:
                    error_7 = _b.sent();
                    transferResults.push({
                        symbol: entry.symbol,
                        amount: entry.amount,
                        error: error_7 instanceof Error ? error_7.message : String(error_7),
                    });
                    return [3 /*break*/, 25];
                case 25:
                    _a++;
                    return [3 /*break*/, 21];
                case 26:
                    console.log('\n📬 Transfer results:');
                    transferResults.forEach(function (result) {
                        var _a;
                        if (result.error) {
                            console.log(chalk_1.default.red("   \u2022 ".concat(result.symbol, ": Failed (").concat(result.error, ")")));
                        }
                        else {
                            console.log(chalk_1.default.green("   \u2022 ".concat(result.symbol, ": Sent ").concat(result.amount.toFixed(6), " (sig ").concat((_a = result.signature) === null || _a === void 0 ? void 0 : _a.slice(0, 8), "...)")));
                        }
                    });
                    return [4 /*yield*/, waitForUser()];
                case 27:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function aggregateFeesByMint(positions) {
    var map = new Map();
    var addAmount = function (mint, symbol, amount, decimals) {
        if (!mint || !amount || amount <= 0) {
            return;
        }
        var key = mint;
        var existing = map.get(key);
        if (existing) {
            existing.amount += amount;
        }
        else {
            map.set(key, {
                mint: mint,
                symbol: symbol || 'Token',
                amount: amount,
                decimals: typeof decimals === 'number' ? decimals : 6,
            });
        }
    };
    positions.forEach(function (pos) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        addAmount((_a = pos.tokenX) === null || _a === void 0 ? void 0 : _a.mint, (_b = pos.tokenX) === null || _b === void 0 ? void 0 : _b.symbol, (_c = pos.unclaimedFees) === null || _c === void 0 ? void 0 : _c.xUi, (_d = pos.tokenX) === null || _d === void 0 ? void 0 : _d.decimals);
        addAmount((_e = pos.tokenY) === null || _e === void 0 ? void 0 : _e.mint, (_f = pos.tokenY) === null || _f === void 0 ? void 0 : _f.symbol, (_g = pos.unclaimedFees) === null || _g === void 0 ? void 0 : _g.yUi, (_h = pos.tokenY) === null || _h === void 0 ? void 0 : _h.decimals);
    });
    return Array.from(map.values()).filter(function (entry) { return entry.amount > 0; });
}
function formatUnclaimedFeeSummary(position) {
    var _a, _b;
    var parts = [];
    if (((_a = position.unclaimedFees) === null || _a === void 0 ? void 0 : _a.xUi) && position.unclaimedFees.xUi > 0) {
        parts.push("".concat(position.unclaimedFees.xUi.toFixed(4), " ").concat(position.tokenX.symbol || 'TokenX'));
    }
    if (((_b = position.unclaimedFees) === null || _b === void 0 ? void 0 : _b.yUi) && position.unclaimedFees.yUi > 0) {
        parts.push("".concat(position.unclaimedFees.yUi.toFixed(4), " ").concat(position.tokenY.symbol || 'TokenY'));
    }
    return parts.length ? parts.join(' / ') : '0';
}
function configureTransactionDefaults() {
    return __awaiter(this, void 0, void 0, function () {
        var config, transaction, slippageInput, slippage, priorityMode, priorityFeeAmount, priorityFeeMultiplier, answers, answers;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n⚙️ CONFIGURE TRANSACTION DEFAULTS\n'));
                    config = config_manager_1.configManager.getConfig();
                    transaction = config.transaction;
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'input',
                                name: 'slippageInput',
                                message: 'Default slippage (%) for position creation (or leave empty to cancel):',
                                default: ((_a = transaction.slippage) !== null && _a !== void 0 ? _a : constants_1.DEFAULT_CONFIG.SLIPPAGE).toString(),
                                validate: function (value) {
                                    if (!value || value.trim().length === 0)
                                        return true;
                                    var num = Number(value);
                                    return (num > 0 && num <= 5) ? true : 'Enter a value between 0 and 5';
                                },
                            },
                        ])];
                case 1:
                    slippageInput = (_e.sent()).slippageInput;
                    if (!(!slippageInput || slippageInput.trim().length === 0)) return [3 /*break*/, 3];
                    console.log(chalk_1.default.gray('Operation cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 2:
                    _e.sent();
                    return [2 /*return*/];
                case 3:
                    slippage = Number(slippageInput);
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'list',
                                name: 'priorityMode',
                                message: 'Priority fee mode:',
                                default: (_b = transaction.priorityFee) !== null && _b !== void 0 ? _b : 'dynamic',
                                choices: [
                                    { name: 'Dynamic (use cluster medians)', value: 'dynamic' },
                                    { name: 'Fixed (manual microLamports per compute unit)', value: 'fixed' },
                                ],
                            },
                        ])];
                case 4:
                    priorityMode = (_e.sent()).priorityMode;
                    if (!(priorityMode === 'fixed')) return [3 /*break*/, 6];
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'number',
                                name: 'priorityFeeAmount',
                                message: 'Set microLamports per compute unit:',
                                default: (_c = transaction.priorityFeeAmount) !== null && _c !== void 0 ? _c : 1000,
                                validate: function (value) { return (value > 0 ? true : 'Enter a positive number'); },
                            },
                        ])];
                case 5:
                    answers = _e.sent();
                    priorityFeeAmount = answers.priorityFeeAmount;
                    return [3 /*break*/, 8];
                case 6: return [4 /*yield*/, inquirer_1.default.prompt([
                        {
                            type: 'number',
                            name: 'priorityFeeMultiplier',
                            message: 'Dynamic multiplier (applied to median priority fee):',
                            default: (_d = transaction.priorityFeeMultiplier) !== null && _d !== void 0 ? _d : constants_1.DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER,
                            validate: function (value) { return (value > 0 ? true : 'Enter a positive number'); },
                        },
                    ])];
                case 7:
                    answers = _e.sent();
                    priorityFeeMultiplier = answers.priorityFeeMultiplier;
                    _e.label = 8;
                case 8:
                    config_manager_1.configManager.updateConfig({
                        transaction: __assign(__assign({}, transaction), { slippage: slippage, priorityFee: priorityMode, priorityFeeAmount: priorityMode === 'fixed' ? priorityFeeAmount : undefined, priorityFeeMultiplier: priorityMode === 'dynamic'
                                ? priorityFeeMultiplier !== null && priorityFeeMultiplier !== void 0 ? priorityFeeMultiplier : constants_1.DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER
                                : undefined }),
                    });
                    console.log(chalk_1.default.green('\n✅ Transaction defaults updated.'));
                    return [4 /*yield*/, waitForUser()];
                case 9:
                    _e.sent();
                    return [2 /*return*/];
            }
        });
    });
}
