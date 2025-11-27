import fs from 'fs';
import path from 'path';
import crypto from 'crypto-js';
import { AppConfig, WalletConfig, PositionData, PoolSelectionPreferences } from './types';
import { DEFAULT_CONFIG, DATA_DIR, CONFIG_FILE, WALLETS_FILE } from './constants';

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;
  private walletsPath: string;

  constructor() {
    this.configPath = CONFIG_FILE;
    this.walletsPath = WALLETS_FILE;
    this.ensureDataDirectory();
    this.config = this.loadConfig();
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(path.join(DATA_DIR, 'logs'))) {
      fs.mkdirSync(path.join(DATA_DIR, 'logs'), { recursive: true });
    }
  }

  /**
   * Load configuration from file or create default
   */
  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(data);

        // Ensure compatibility with new enhanced features
        if (!loadedConfig.preferences?.poolSelection) {
          loadedConfig.preferences = {
            ...loadedConfig.preferences,
            poolSelection: this.createDefaultPoolSelection(),
          };
        }

        return loadedConfig;
      }
    } catch (error) {
      console.warn('Error loading config, creating default:', error);
    }

    // Create enhanced default config with dynamic pool support
    const defaultConfig: AppConfig = {
      version: '1.0.0',
      wallets: [],
      activeWallet: null,
      connection: {
        rpcEndpoint: process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
        commitment: 'confirmed',
      },
      transaction: {
        priorityFee: 'dynamic',
        priorityFeeMultiplier: DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER,
        slippage: DEFAULT_CONFIG.SLIPPAGE,
        enableSimulation: true,
      },
      positions: [],
      automation: {
        rebalancing: {
          enabled: false,
          triggers: {
            priceDeviation: DEFAULT_CONFIG.REBALANCE_PRICE_DEVIATION,
            performance: DEFAULT_CONFIG.REBALANCE_PERFORMANCE_THRESHOLD,
            timeInterval: DEFAULT_CONFIG.REBALANCE_TIME_INTERVAL,
          },
          strategy: {
            maintainStrategy: true,
            maintainBinCount: true,
            centerAtActiveBin: true,
          },
          swap: {
            enabled: true,
            maxSlippage: DEFAULT_CONFIG.SWAP_MAX_SLIPPAGE,
            method: 'auto',
          },
          constraints: {
            minTimeBetween: DEFAULT_CONFIG.REBALANCE_MIN_TIME_BETWEEN,
            maxGasCost: DEFAULT_CONFIG.REBALANCE_MAX_GAS_COST,
            minAprImprovement: DEFAULT_CONFIG.REBALANCE_MIN_APR_IMPROVEMENT,
          },
        },
        compounding: {
          enabled: false,
          threshold: DEFAULT_CONFIG.COMPOUND_THRESHOLD,
          strategy: 'balanced',
          swapSettings: {
            enabled: true,
            maxSlippage: DEFAULT_CONFIG.SWAP_MAX_SLIPPAGE,
            imbalanceThreshold: DEFAULT_CONFIG.COMPOUND_IMBALANCE_THRESHOLD,
          },
          limits: {
            maxPerWeek: DEFAULT_CONFIG.COMPOUND_MAX_PER_WEEK,
            minTimeBetween: DEFAULT_CONFIG.COMPOUND_MIN_TIME_BETWEEN,
            maxGasCost: DEFAULT_CONFIG.COMPOUND_MAX_GAS_COST,
          },
        },
      },
      preferences: {
        // NEW: Enhanced pool selection instead of defaultPool
        poolSelection: this.createDefaultPoolSelection(),
        defaultStrategy: DEFAULT_CONFIG.DEFAULT_STRATEGY,
        defaultBinCount: DEFAULT_CONFIG.DEFAULT_BIN_COUNT,
        displayCurrency: 'USD',
        notifications: {
          rebalanceAlerts: true,
          compoundAlerts: true,
          priceAlerts: false,
        },
        birdeyeApiKey: '',
      },
    };

    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * Create default pool selection preferences
   */
  private createDefaultPoolSelection(): PoolSelectionPreferences {
    return {
      favoritePoolAddresses: [],
      defaultPoolFilters: {
        minTvl: 10000, // $10k minimum
        minVolume24h: 1000, // $1k minimum
        tokenTypes: 'all',
      },
      poolHistory: [],
    };
  }

  /**
   * Save configuration to file
   */
  private saveConfig(config: AppConfig): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Update configuration with enhanced validation
   */
  public updateConfig(updates: Partial<AppConfig>): void {
    try {
      this.config = { ...this.config, ...updates };

      // Ensure enhanced features are preserved
      if (!this.config.preferences.poolSelection) {
        this.config.preferences.poolSelection = this.createDefaultPoolSelection();
      }

      this.saveConfig(this.config);
    } catch (error) {
      console.error('Error updating configuration:', error);
      throw new Error(`Failed to update configuration: ${error}`);
    }
  }

  /**
   * Encrypt and save wallet with enhanced security
   */
  public addWallet(wallet: WalletConfig): void {
    try {
      // Validate encryption key
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not set in environment');
      }
      if (encryptionKey.length < 32) {
        throw new Error('ENCRYPTION_KEY must be at least 32 characters');
      }

      // Check for duplicate public keys
      const existingWallet = this.config.wallets.find(w => w.publicKey === wallet.publicKey);
      if (existingWallet) {
        throw new Error(`Wallet with public key ${wallet.publicKey} already exists`);
      }

      // Add to wallets array
      this.config.wallets.push(wallet);

      // Set as active if first wallet
      if (this.config.wallets.length === 1) {
        this.config.activeWallet = wallet.publicKey;
      }

      this.saveConfig(this.config);
    } catch (error) {
      console.error('Error adding wallet:', error);
      throw error;
    }
  }

  /**
   * Get wallet by public key
   */
  public getWallet(publicKey: string): WalletConfig | undefined {
    return this.config.wallets.find(w => w.publicKey === publicKey);
  }

  /**
   * Get active wallet
   */
  public getActiveWallet(): WalletConfig | null {
    if (!this.config.activeWallet) return null;
    return this.getWallet(this.config.activeWallet) || null;
  }

  /**
   * Set active wallet with validation
   */
  public setActiveWallet(publicKey: string): void {
    const wallet = this.getWallet(publicKey);
    if (!wallet) {
      throw new Error(`Wallet ${publicKey} not found`);
    }
    this.config.activeWallet = publicKey;
    this.saveConfig(this.config);
  }

  /**
   * Decrypt wallet private key with enhanced security
   */
  public decryptPrivateKey(encryptedKey: string): string {
    try {
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not set in environment');
      }

      const decrypted = crypto.AES.decrypt(encryptedKey, encryptionKey);
      const decryptedString = decrypted.toString(crypto.enc.Utf8);

      if (!decryptedString) {
        throw new Error('Failed to decrypt private key - invalid encryption key or corrupted data');
      }

      return decryptedString;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt private key');
    }
  }

  /**
   * Encrypt private key with enhanced security
   */
  public encryptPrivateKey(privateKey: string): string {
    try {
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not set in environment');
      }

      return crypto.AES.encrypt(privateKey, encryptionKey).toString();
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Add position with enhanced metadata
   */
  public addPosition(position: PositionData): void {
    try {
      // Validate position data
      if (!position.address || !position.poolAddress) {
        throw new Error('Position must have valid address and pool address');
      }

      // Check for duplicate positions
      const existingPosition = this.config.positions.find(p => p.address === position.address);
      if (existingPosition) {
        throw new Error(`Position ${position.address} already exists`);
      }

      this.config.positions.push(position);
      this.saveConfig(this.config);
    } catch (error) {
      console.error('Error adding position:', error);
      throw error;
    }
  }

  /**
   * Update position with validation
   */
  public updatePosition(address: string, updates: Partial<PositionData>): void {
    try {
      const index = this.config.positions.findIndex(p => p.address === address);
      if (index === -1) {
        throw new Error(`Position ${address} not found`);
      }

      this.config.positions[index] = { ...this.config.positions[index], ...updates };
      this.saveConfig(this.config);
    } catch (error) {
      console.error('Error updating position:', error);
      throw error;
    }
  }

  /**
   * Get all positions (enhanced with filtering support)
   */
  public getPositions(poolAddress?: string): PositionData[] {
    if (poolAddress) {
      return this.config.positions.filter(p => p.poolAddress === poolAddress);
    }
    return this.config.positions;
  }

  /**
   * Get position by address
   */
  public getPosition(address: string): PositionData | undefined {
    return this.config.positions.find(p => p.address === address);
  }

  /**
   * Remove position with validation
   */
  public removePosition(address: string): void {
    try {
      const originalLength = this.config.positions.length;
      this.config.positions = this.config.positions.filter(p => p.address !== address);

      if (this.config.positions.length === originalLength) {
        throw new Error(`Position ${address} not found`);
      }

      this.saveConfig(this.config);
    } catch (error) {
      console.error('Error removing position:', error);
      throw error;
    }
  }

  /**
   * Enhanced pool preferences management
   */
  public addFavoritePool(poolAddress: string, poolName: string): void {
    try {
      const favorites = this.config.preferences.poolSelection.favoritePoolAddresses;

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
    } catch (error) {
      console.error('Error adding favorite pool:', error);
      throw error;
    }
  }

  /**
   * Remove pool from favorites
   */
  public removeFavoritePool(poolAddress: string): void {
    try {
      const favorites = this.config.preferences.poolSelection.favoritePoolAddresses;
      this.config.preferences.poolSelection.favoritePoolAddresses =
        favorites.filter(addr => addr !== poolAddress);

      this.saveConfig(this.config);
    } catch (error) {
      console.error('Error removing favorite pool:', error);
      throw error;
    }
  }

  /**
   * Get configuration statistics for monitoring
   */
  public getStats(): {
    walletsCount: number;
    positionsCount: number;
    favoritePools: number;
    configVersion: string;
    lastUpdated: string;
  } {
    return {
      walletsCount: this.config.wallets.length,
      positionsCount: this.config.positions.length,
      favoritePools: this.config.preferences.poolSelection.favoritePoolAddresses.length,
      configVersion: this.config.version,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
