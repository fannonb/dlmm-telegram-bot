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
Object.defineProperty(exports, "__esModule", { value: true });
exports.configManager = exports.ConfigManager = void 0;
var fs_1 = require("fs");
var path_1 = require("path");
var crypto_js_1 = require("crypto-js");
var constants_1 = require("./constants");
var ConfigManager = /** @class */ (function () {
    function ConfigManager() {
        this.configPath = constants_1.CONFIG_FILE;
        this.walletsPath = constants_1.WALLETS_FILE;
        this.ensureDataDirectory();
        this.config = this.loadConfig();
    }
    /**
     * Ensure data directory exists
     */
    ConfigManager.prototype.ensureDataDirectory = function () {
        if (!fs_1.default.existsSync(constants_1.DATA_DIR)) {
            fs_1.default.mkdirSync(constants_1.DATA_DIR, { recursive: true });
        }
        if (!fs_1.default.existsSync(path_1.default.join(constants_1.DATA_DIR, 'logs'))) {
            fs_1.default.mkdirSync(path_1.default.join(constants_1.DATA_DIR, 'logs'), { recursive: true });
        }
    };
    /**
     * Load configuration from file or create default
     */
    ConfigManager.prototype.loadConfig = function () {
        var _a;
        try {
            if (fs_1.default.existsSync(this.configPath)) {
                var data = fs_1.default.readFileSync(this.configPath, 'utf-8');
                var loadedConfig = JSON.parse(data);
                // Ensure compatibility with new enhanced features
                if (!((_a = loadedConfig.preferences) === null || _a === void 0 ? void 0 : _a.poolSelection)) {
                    loadedConfig.preferences = __assign(__assign({}, loadedConfig.preferences), { poolSelection: this.createDefaultPoolSelection() });
                }
                return loadedConfig;
            }
        }
        catch (error) {
            console.warn('Error loading config, creating default:', error);
        }
        // Create enhanced default config with dynamic pool support
        var defaultConfig = {
            version: '1.0.0',
            wallets: [],
            activeWallet: null,
            connection: {
                rpcEndpoint: process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
                commitment: 'confirmed',
            },
            transaction: {
                priorityFee: 'dynamic',
                priorityFeeMultiplier: constants_1.DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER,
                slippage: constants_1.DEFAULT_CONFIG.SLIPPAGE,
                enableSimulation: true,
            },
            positions: [],
            automation: {
                rebalancing: {
                    enabled: false,
                    triggers: {
                        priceDeviation: constants_1.DEFAULT_CONFIG.REBALANCE_PRICE_DEVIATION,
                        performance: constants_1.DEFAULT_CONFIG.REBALANCE_PERFORMANCE_THRESHOLD,
                        timeInterval: constants_1.DEFAULT_CONFIG.REBALANCE_TIME_INTERVAL,
                    },
                    strategy: {
                        maintainStrategy: true,
                        maintainBinCount: true,
                        centerAtActiveBin: true,
                    },
                    swap: {
                        enabled: true,
                        maxSlippage: constants_1.DEFAULT_CONFIG.SWAP_MAX_SLIPPAGE,
                        method: 'auto',
                    },
                    constraints: {
                        minTimeBetween: constants_1.DEFAULT_CONFIG.REBALANCE_MIN_TIME_BETWEEN,
                        maxGasCost: constants_1.DEFAULT_CONFIG.REBALANCE_MAX_GAS_COST,
                        minAprImprovement: constants_1.DEFAULT_CONFIG.REBALANCE_MIN_APR_IMPROVEMENT,
                    },
                },
                compounding: {
                    enabled: false,
                    threshold: constants_1.DEFAULT_CONFIG.COMPOUND_THRESHOLD,
                    strategy: 'balanced',
                    swapSettings: {
                        enabled: true,
                        maxSlippage: constants_1.DEFAULT_CONFIG.SWAP_MAX_SLIPPAGE,
                        imbalanceThreshold: constants_1.DEFAULT_CONFIG.COMPOUND_IMBALANCE_THRESHOLD,
                    },
                    limits: {
                        maxPerWeek: constants_1.DEFAULT_CONFIG.COMPOUND_MAX_PER_WEEK,
                        minTimeBetween: constants_1.DEFAULT_CONFIG.COMPOUND_MIN_TIME_BETWEEN,
                        maxGasCost: constants_1.DEFAULT_CONFIG.COMPOUND_MAX_GAS_COST,
                    },
                },
            },
            preferences: {
                // NEW: Enhanced pool selection instead of defaultPool
                poolSelection: this.createDefaultPoolSelection(),
                defaultStrategy: constants_1.DEFAULT_CONFIG.DEFAULT_STRATEGY,
                defaultBinCount: constants_1.DEFAULT_CONFIG.DEFAULT_BIN_COUNT,
                displayCurrency: 'USD',
                notifications: {
                    rebalanceAlerts: true,
                    compoundAlerts: true,
                    priceAlerts: false,
                },
            },
        };
        this.saveConfig(defaultConfig);
        return defaultConfig;
    };
    /**
     * Create default pool selection preferences
     */
    ConfigManager.prototype.createDefaultPoolSelection = function () {
        return {
            favoritePoolAddresses: [],
            defaultPoolFilters: {
                minTvl: 10000, // $10k minimum
                minVolume24h: 1000, // $1k minimum
                tokenTypes: 'all',
            },
            poolHistory: [],
        };
    };
    /**
     * Save configuration to file
     */
    ConfigManager.prototype.saveConfig = function (config) {
        try {
            var configDir = path_1.default.dirname(this.configPath);
            if (!fs_1.default.existsSync(configDir)) {
                fs_1.default.mkdirSync(configDir, { recursive: true });
            }
            fs_1.default.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        }
        catch (error) {
            console.error('Error saving configuration:', error);
            throw new Error("Failed to save configuration: ".concat(error));
        }
    };
    /**
     * Get current configuration
     */
    ConfigManager.prototype.getConfig = function () {
        return this.config;
    };
    /**
     * Update configuration with enhanced validation
     */
    ConfigManager.prototype.updateConfig = function (updates) {
        try {
            this.config = __assign(__assign({}, this.config), updates);
            // Ensure enhanced features are preserved
            if (!this.config.preferences.poolSelection) {
                this.config.preferences.poolSelection = this.createDefaultPoolSelection();
            }
            this.saveConfig(this.config);
        }
        catch (error) {
            console.error('Error updating configuration:', error);
            throw new Error("Failed to update configuration: ".concat(error));
        }
    };
    /**
     * Encrypt and save wallet with enhanced security
     */
    ConfigManager.prototype.addWallet = function (wallet) {
        try {
            // Validate encryption key
            var encryptionKey = process.env.ENCRYPTION_KEY;
            if (!encryptionKey) {
                throw new Error('ENCRYPTION_KEY not set in environment');
            }
            if (encryptionKey.length < 32) {
                throw new Error('ENCRYPTION_KEY must be at least 32 characters');
            }
            // Check for duplicate public keys
            var existingWallet = this.config.wallets.find(function (w) { return w.publicKey === wallet.publicKey; });
            if (existingWallet) {
                throw new Error("Wallet with public key ".concat(wallet.publicKey, " already exists"));
            }
            // Add to wallets array
            this.config.wallets.push(wallet);
            // Set as active if first wallet
            if (this.config.wallets.length === 1) {
                this.config.activeWallet = wallet.publicKey;
            }
            this.saveConfig(this.config);
        }
        catch (error) {
            console.error('Error adding wallet:', error);
            throw error;
        }
    };
    /**
     * Get wallet by public key
     */
    ConfigManager.prototype.getWallet = function (publicKey) {
        return this.config.wallets.find(function (w) { return w.publicKey === publicKey; });
    };
    /**
     * Get active wallet
     */
    ConfigManager.prototype.getActiveWallet = function () {
        if (!this.config.activeWallet)
            return null;
        return this.getWallet(this.config.activeWallet) || null;
    };
    /**
     * Set active wallet with validation
     */
    ConfigManager.prototype.setActiveWallet = function (publicKey) {
        var wallet = this.getWallet(publicKey);
        if (!wallet) {
            throw new Error("Wallet ".concat(publicKey, " not found"));
        }
        this.config.activeWallet = publicKey;
        this.saveConfig(this.config);
    };
    /**
     * Decrypt wallet private key with enhanced security
     */
    ConfigManager.prototype.decryptPrivateKey = function (encryptedKey) {
        try {
            var encryptionKey = process.env.ENCRYPTION_KEY;
            if (!encryptionKey) {
                throw new Error('ENCRYPTION_KEY not set in environment');
            }
            var decrypted = crypto_js_1.default.AES.decrypt(encryptedKey, encryptionKey);
            var decryptedString = decrypted.toString(crypto_js_1.default.enc.Utf8);
            if (!decryptedString) {
                throw new Error('Failed to decrypt private key - invalid encryption key or corrupted data');
            }
            return decryptedString;
        }
        catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt private key');
        }
    };
    /**
     * Encrypt private key with enhanced security
     */
    ConfigManager.prototype.encryptPrivateKey = function (privateKey) {
        try {
            var encryptionKey = process.env.ENCRYPTION_KEY;
            if (!encryptionKey) {
                throw new Error('ENCRYPTION_KEY not set in environment');
            }
            return crypto_js_1.default.AES.encrypt(privateKey, encryptionKey).toString();
        }
        catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt private key');
        }
    };
    /**
     * Add position with enhanced metadata
     */
    ConfigManager.prototype.addPosition = function (position) {
        try {
            // Validate position data
            if (!position.address || !position.poolAddress) {
                throw new Error('Position must have valid address and pool address');
            }
            // Check for duplicate positions
            var existingPosition = this.config.positions.find(function (p) { return p.address === position.address; });
            if (existingPosition) {
                throw new Error("Position ".concat(position.address, " already exists"));
            }
            this.config.positions.push(position);
            this.saveConfig(this.config);
        }
        catch (error) {
            console.error('Error adding position:', error);
            throw error;
        }
    };
    /**
     * Update position with validation
     */
    ConfigManager.prototype.updatePosition = function (address, updates) {
        try {
            var index = this.config.positions.findIndex(function (p) { return p.address === address; });
            if (index === -1) {
                throw new Error("Position ".concat(address, " not found"));
            }
            this.config.positions[index] = __assign(__assign({}, this.config.positions[index]), updates);
            this.saveConfig(this.config);
        }
        catch (error) {
            console.error('Error updating position:', error);
            throw error;
        }
    };
    /**
     * Get all positions (enhanced with filtering support)
     */
    ConfigManager.prototype.getPositions = function (poolAddress) {
        if (poolAddress) {
            return this.config.positions.filter(function (p) { return p.poolAddress === poolAddress; });
        }
        return this.config.positions;
    };
    /**
     * Get position by address
     */
    ConfigManager.prototype.getPosition = function (address) {
        return this.config.positions.find(function (p) { return p.address === address; });
    };
    /**
     * Remove position with validation
     */
    ConfigManager.prototype.removePosition = function (address) {
        try {
            var originalLength = this.config.positions.length;
            this.config.positions = this.config.positions.filter(function (p) { return p.address !== address; });
            if (this.config.positions.length === originalLength) {
                throw new Error("Position ".concat(address, " not found"));
            }
            this.saveConfig(this.config);
        }
        catch (error) {
            console.error('Error removing position:', error);
            throw error;
        }
    };
    /**
     * Enhanced pool preferences management
     */
    ConfigManager.prototype.addFavoritePool = function (poolAddress, poolName) {
        try {
            var favorites = this.config.preferences.poolSelection.favoritePoolAddresses;
            if (!favorites.includes(poolAddress)) {
                favorites.push(poolAddress);
                // Add to history
                this.config.preferences.poolSelection.poolHistory.unshift({
                    address: poolAddress,
                    name: poolName,
                    lastUsed: new Date().toISOString(),
                });
                // Keep only last 50 in history
                this.config.preferences.poolSelection.poolHistory =
                    this.config.preferences.poolSelection.poolHistory.slice(0, 50);
                this.saveConfig(this.config);
            }
        }
        catch (error) {
            console.error('Error adding favorite pool:', error);
            throw error;
        }
    };
    /**
     * Remove pool from favorites
     */
    ConfigManager.prototype.removeFavoritePool = function (poolAddress) {
        try {
            var favorites = this.config.preferences.poolSelection.favoritePoolAddresses;
            this.config.preferences.poolSelection.favoritePoolAddresses =
                favorites.filter(function (addr) { return addr !== poolAddress; });
            this.saveConfig(this.config);
        }
        catch (error) {
            console.error('Error removing favorite pool:', error);
            throw error;
        }
    };
    /**
     * Get configuration statistics for monitoring
     */
    ConfigManager.prototype.getStats = function () {
        return {
            walletsCount: this.config.wallets.length,
            positionsCount: this.config.positions.length,
            favoritePools: this.config.preferences.poolSelection.favoritePoolAddresses.length,
            configVersion: this.config.version,
            lastUpdated: new Date().toISOString(),
        };
    };
    return ConfigManager;
}());
exports.ConfigManager = ConfigManager;
// Export singleton instance
exports.configManager = new ConfigManager();
