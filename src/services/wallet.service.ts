import { Keypair, PublicKey } from '@solana/web3.js';
import * as bip39 from 'bip39';
import bs58 from 'bs58';
import { configManager } from '../config/config.manager';
import { WalletConfig } from '../config/types';

export class WalletService {
  /**
   * Generate a new wallet with mnemonic
   */
  public async createWallet(name: string): Promise<{
    wallet: WalletConfig;
    mnemonic: string;
    keypair: Keypair;
  }> {
    // Generate mnemonic (12 words)
    const mnemonic = bip39.generateMnemonic();
    
    // Derive keypair from mnemonic
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const keypair = Keypair.fromSeed(seed.slice(0, 32));

    // Create wallet config
    const wallet: WalletConfig = {
      name,
      publicKey: keypair.publicKey.toString(),
      encryptedPrivateKey: configManager.encryptPrivateKey(
        bs58.encode(keypair.secretKey)
      ),
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    // Save to config
    configManager.addWallet(wallet);

    return { wallet, mnemonic, keypair };
  }

  /**
   * Import wallet from private key (base58 encoded)
   */
  public importFromPrivateKey(name: string, privateKeyBase58: string): WalletConfig {
    try {
      // Decode private key
      const secretKey = bs58.decode(privateKeyBase58);
      const keypair = Keypair.fromSecretKey(secretKey);

      // Create wallet config
      const wallet: WalletConfig = {
        name,
        publicKey: keypair.publicKey.toString(),
        encryptedPrivateKey: configManager.encryptPrivateKey(privateKeyBase58),
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      // Save to config
      configManager.addWallet(wallet);

      return wallet;
    } catch (error) {
      throw new Error(`Invalid private key: ${error}`);
    }
  }

  /**
   * Import wallet from mnemonic phrase
   */
  public async importFromMnemonic(name: string, mnemonic: string): Promise<WalletConfig> {
    try {
      // Validate mnemonic
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
      }

      // Derive keypair
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const keypair = Keypair.fromSeed(seed.slice(0, 32));

      // Create wallet config
      const wallet: WalletConfig = {
        name,
        publicKey: keypair.publicKey.toString(),
        encryptedPrivateKey: configManager.encryptPrivateKey(
          bs58.encode(keypair.secretKey)
        ),
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      // Save to config
      configManager.addWallet(wallet);

      return wallet;
    } catch (error) {
      throw new Error(`Failed to import from mnemonic: ${error}`);
    }
  }

  /**
   * Get keypair from wallet config
   */
  public getKeypair(walletConfig: WalletConfig): Keypair {
    const decryptedKey = configManager.decryptPrivateKey(walletConfig.encryptedPrivateKey);
    const secretKey = bs58.decode(decryptedKey);
    return Keypair.fromSecretKey(secretKey);
  }

  /**
   * List all wallets
   */
  public listWallets(): WalletConfig[] {
    return configManager.getConfig().wallets;
  }

  /**
   * Get active wallet
   */
  public getActiveWallet(): WalletConfig | null {
    return configManager.getActiveWallet();
  }

  /**
   * Get active keypair
   */
  public getActiveKeypair(): Keypair | null {
    const wallet = this.getActiveWallet();
    if (!wallet) return null;
    return this.getKeypair(wallet);
  }

  /**
   * Set active wallet
   */
  public setActiveWallet(publicKey: string): void {
    configManager.setActiveWallet(publicKey);
  }

  /**
   * Get wallet by public key
   */
  public getWallet(publicKey: string): WalletConfig | undefined {
    return configManager.getWallet(publicKey);
  }

  /**
   * Export private key (use with caution!)
   */
  public exportPrivateKey(publicKey: string): string {
    const wallet = this.getWallet(publicKey);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    return configManager.decryptPrivateKey(wallet.encryptedPrivateKey);
  }

  /**
   * Delete wallet
   */
  public deleteWallet(publicKey: string): void {
    const config = configManager.getConfig();
    const updatedWallets = config.wallets.filter(w => w.publicKey !== publicKey);
    
    // If deleting active wallet, set new active
    if (config.activeWallet === publicKey && updatedWallets.length > 0) {
      config.activeWallet = updatedWallets[0].publicKey;
    } else if (updatedWallets.length === 0) {
      config.activeWallet = null;
    }

    configManager.updateConfig({
      wallets: updatedWallets,
      activeWallet: config.activeWallet,
    });
  }
}

// Export singleton instance
export const walletService = new WalletService();
