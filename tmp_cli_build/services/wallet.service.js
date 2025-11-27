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
exports.walletService = exports.WalletService = void 0;
var web3_js_1 = require("@solana/web3.js");
var bip39 = require("bip39");
var bs58_1 = require("bs58");
var config_manager_1 = require("../config/config.manager");
var WalletService = /** @class */ (function () {
    function WalletService() {
    }
    /**
     * Generate a new wallet with mnemonic
     */
    WalletService.prototype.createWallet = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            var mnemonic, seed, keypair, wallet;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mnemonic = bip39.generateMnemonic();
                        return [4 /*yield*/, bip39.mnemonicToSeed(mnemonic)];
                    case 1:
                        seed = _a.sent();
                        keypair = web3_js_1.Keypair.fromSeed(seed.slice(0, 32));
                        wallet = {
                            name: name,
                            publicKey: keypair.publicKey.toString(),
                            encryptedPrivateKey: config_manager_1.configManager.encryptPrivateKey(bs58_1.default.encode(keypair.secretKey)),
                            createdAt: new Date().toISOString(),
                            isActive: true,
                        };
                        // Save to config
                        config_manager_1.configManager.addWallet(wallet);
                        return [2 /*return*/, { wallet: wallet, mnemonic: mnemonic, keypair: keypair }];
                }
            });
        });
    };
    /**
     * Import wallet from private key (base58 encoded)
     */
    WalletService.prototype.importFromPrivateKey = function (name, privateKeyBase58) {
        try {
            // Decode private key
            var secretKey = bs58_1.default.decode(privateKeyBase58);
            var keypair = web3_js_1.Keypair.fromSecretKey(secretKey);
            // Create wallet config
            var wallet = {
                name: name,
                publicKey: keypair.publicKey.toString(),
                encryptedPrivateKey: config_manager_1.configManager.encryptPrivateKey(privateKeyBase58),
                createdAt: new Date().toISOString(),
                isActive: true,
            };
            // Save to config
            config_manager_1.configManager.addWallet(wallet);
            return wallet;
        }
        catch (error) {
            throw new Error("Invalid private key: ".concat(error));
        }
    };
    /**
     * Import wallet from mnemonic phrase
     */
    WalletService.prototype.importFromMnemonic = function (name, mnemonic) {
        return __awaiter(this, void 0, void 0, function () {
            var seed, keypair, wallet, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // Validate mnemonic
                        if (!bip39.validateMnemonic(mnemonic)) {
                            throw new Error('Invalid mnemonic phrase');
                        }
                        return [4 /*yield*/, bip39.mnemonicToSeed(mnemonic)];
                    case 1:
                        seed = _a.sent();
                        keypair = web3_js_1.Keypair.fromSeed(seed.slice(0, 32));
                        wallet = {
                            name: name,
                            publicKey: keypair.publicKey.toString(),
                            encryptedPrivateKey: config_manager_1.configManager.encryptPrivateKey(bs58_1.default.encode(keypair.secretKey)),
                            createdAt: new Date().toISOString(),
                            isActive: true,
                        };
                        // Save to config
                        config_manager_1.configManager.addWallet(wallet);
                        return [2 /*return*/, wallet];
                    case 2:
                        error_1 = _a.sent();
                        throw new Error("Failed to import from mnemonic: ".concat(error_1));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get keypair from wallet config
     */
    WalletService.prototype.getKeypair = function (walletConfig) {
        var decryptedKey = config_manager_1.configManager.decryptPrivateKey(walletConfig.encryptedPrivateKey);
        var secretKey = bs58_1.default.decode(decryptedKey);
        return web3_js_1.Keypair.fromSecretKey(secretKey);
    };
    /**
     * List all wallets
     */
    WalletService.prototype.listWallets = function () {
        return config_manager_1.configManager.getConfig().wallets;
    };
    /**
     * Get active wallet
     */
    WalletService.prototype.getActiveWallet = function () {
        return config_manager_1.configManager.getActiveWallet();
    };
    /**
     * Get active keypair
     */
    WalletService.prototype.getActiveKeypair = function () {
        var wallet = this.getActiveWallet();
        if (!wallet)
            return null;
        return this.getKeypair(wallet);
    };
    /**
     * Set active wallet
     */
    WalletService.prototype.setActiveWallet = function (publicKey) {
        config_manager_1.configManager.setActiveWallet(publicKey);
    };
    /**
     * Get wallet by public key
     */
    WalletService.prototype.getWallet = function (publicKey) {
        return config_manager_1.configManager.getWallet(publicKey);
    };
    /**
     * Export private key (use with caution!)
     */
    WalletService.prototype.exportPrivateKey = function (publicKey) {
        var wallet = this.getWallet(publicKey);
        if (!wallet) {
            throw new Error('Wallet not found');
        }
        return config_manager_1.configManager.decryptPrivateKey(wallet.encryptedPrivateKey);
    };
    /**
     * Delete wallet
     */
    WalletService.prototype.deleteWallet = function (publicKey) {
        var config = config_manager_1.configManager.getConfig();
        var updatedWallets = config.wallets.filter(function (w) { return w.publicKey !== publicKey; });
        // If deleting active wallet, set new active
        if (config.activeWallet === publicKey && updatedWallets.length > 0) {
            config.activeWallet = updatedWallets[0].publicKey;
        }
        else if (updatedWallets.length === 0) {
            config.activeWallet = null;
        }
        config_manager_1.configManager.updateConfig({
            wallets: updatedWallets,
            activeWallet: config.activeWallet,
        });
    };
    return WalletService;
}());
exports.WalletService = WalletService;
// Export singleton instance
exports.walletService = new WalletService();
