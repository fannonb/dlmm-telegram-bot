/**
 * Multi-Wallet Storage Service for Telegram Users
 * 
 * Supports multiple wallets per user with:
 * - Create new wallet
 * - Import from mnemonic
 * - Import from private key
 * - List all wallets
 * - Set active wallet
 * - Export private key
 * - Delete wallet
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Keypair, PublicKey } from '@solana/web3.js';
import * as bip39 from 'bip39';
import bs58 from 'bs58';

export interface TelegramWallet {
    name: string;
    publicKey: string;
    encryptedPrivateKey: string;
    createdAt: number;
    isActive: boolean;
}

export interface UserWalletData {
    telegramId: number;
    wallets: TelegramWallet[];
    activeWallet: string | null; // publicKey of active wallet
}

interface WalletStorageData {
    users: UserWalletData[];
    masterPasswordHash: string;
}

export interface CreateWalletResult {
    wallet: TelegramWallet;
    mnemonic: string;
    keypair: Keypair;
}

export interface ImportWalletResult {
    wallet: TelegramWallet;
    keypair: Keypair;
}

export class MultiWalletStorageService {
    private dataPath: string;
    private masterPassword: string;
    private data: WalletStorageData;

    constructor() {
        this.dataPath = path.join(process.cwd(), 'data', 'telegram_wallets_v2.json');
        this.masterPassword = process.env.WALLET_MASTER_PASSWORD || this.generateMasterPassword();
        this.ensureDataFile();
        this.data = this.loadData();
        this.migrateFromV1();
    }

    private generateMasterPassword(): string {
        const password = crypto.randomBytes(32).toString('hex');
        console.warn('⚠️  New master password generated. Check secure logs for details.');
        // Security: Never log sensitive credentials
        // Master password has been generated and should be manually added to .env
        return password;
    }

    private ensureDataFile(): void {
        const dir = path.dirname(this.dataPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.dataPath)) {
            const initialData: WalletStorageData = {
                users: [],
                masterPasswordHash: crypto.createHash('sha256').update(this.masterPassword).digest('hex')
            };
            fs.writeFileSync(this.dataPath, JSON.stringify(initialData, null, 2));
        }
    }

    private loadData(): WalletStorageData {
        try {
            const raw = fs.readFileSync(this.dataPath, 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            console.error('Failed to load wallet data:', error);
            return { users: [], masterPasswordHash: '' };
        }
    }

    private saveData(): void {
        fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
    }

    // Migrate from v1 (single wallet per user) to v2 (multi-wallet)
    private migrateFromV1(): void {
        const v1Path = path.join(process.cwd(), 'data', 'telegram_wallets.json');
        if (!fs.existsSync(v1Path)) return;

        try {
            const v1Raw = fs.readFileSync(v1Path, 'utf8');
            const v1Data = JSON.parse(v1Raw);

            if (v1Data.wallets && Array.isArray(v1Data.wallets)) {
                for (const oldWallet of v1Data.wallets) {
                    const existingUser = this.data.users.find(u => u.telegramId === oldWallet.telegramId);
                    if (!existingUser) {
                        // Migrate user
                        this.data.users.push({
                            telegramId: oldWallet.telegramId,
                            wallets: [{
                                name: 'Main Wallet',
                                publicKey: oldWallet.publicKey,
                                encryptedPrivateKey: oldWallet.encryptedPrivateKey,
                                createdAt: oldWallet.createdAt,
                                isActive: true
                            }],
                            activeWallet: oldWallet.publicKey
                        });
                    }
                }
                this.saveData();
                console.log('✅ Migrated wallets from v1 to v2 format');
            }
        } catch (error) {
            console.error('Failed to migrate from v1:', error);
        }
    }

    private encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync(this.masterPassword, 'salt', 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    private decrypt(encrypted: string): string {
        const parts = encrypted.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];
        const key = crypto.scryptSync(this.masterPassword, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    private getUserData(telegramId: number): UserWalletData | undefined {
        return this.data.users.find(u => u.telegramId === telegramId);
    }

    private ensureUserData(telegramId: number): UserWalletData {
        let userData = this.getUserData(telegramId);
        if (!userData) {
            userData = {
                telegramId,
                wallets: [],
                activeWallet: null
            };
            this.data.users.push(userData);
        }
        return userData;
    }

    // ==================== PUBLIC METHODS ====================

    /**
     * Create a new wallet with generated mnemonic
     */
    async createWallet(telegramId: number, name: string): Promise<CreateWalletResult> {
        const mnemonic = bip39.generateMnemonic();
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const keypair = Keypair.fromSeed(seed.slice(0, 32));

        const wallet: TelegramWallet = {
            name,
            publicKey: keypair.publicKey.toBase58(),
            encryptedPrivateKey: this.encrypt(bs58.encode(keypair.secretKey)),
            createdAt: Date.now(),
            isActive: true
        };

        const userData = this.ensureUserData(telegramId);
        
        // Set all other wallets to inactive
        userData.wallets.forEach(w => w.isActive = false);
        
        userData.wallets.push(wallet);
        userData.activeWallet = wallet.publicKey;
        this.saveData();

        return { wallet, mnemonic, keypair };
    }

    /**
     * Import wallet from mnemonic phrase
     */
    async importFromMnemonic(telegramId: number, name: string, mnemonic: string): Promise<ImportWalletResult> {
        if (!bip39.validateMnemonic(mnemonic.trim())) {
            throw new Error('Invalid mnemonic phrase');
        }

        const seed = await bip39.mnemonicToSeed(mnemonic.trim());
        const keypair = Keypair.fromSeed(seed.slice(0, 32));

        // Check if wallet already exists
        const userData = this.ensureUserData(telegramId);
        const existing = userData.wallets.find(w => w.publicKey === keypair.publicKey.toBase58());
        if (existing) {
            throw new Error('This wallet is already imported');
        }

        const wallet: TelegramWallet = {
            name,
            publicKey: keypair.publicKey.toBase58(),
            encryptedPrivateKey: this.encrypt(bs58.encode(keypair.secretKey)),
            createdAt: Date.now(),
            isActive: true
        };

        // Set all other wallets to inactive
        userData.wallets.forEach(w => w.isActive = false);
        
        userData.wallets.push(wallet);
        userData.activeWallet = wallet.publicKey;
        this.saveData();

        return { wallet, keypair };
    }

    /**
     * Import wallet from private key (base58)
     */
    importFromPrivateKey(telegramId: number, name: string, privateKey: string): ImportWalletResult {
        let keypair: Keypair;
        try {
            keypair = Keypair.fromSecretKey(bs58.decode(privateKey.trim()));
        } catch (error) {
            throw new Error('Invalid private key format');
        }

        // Check if wallet already exists
        const userData = this.ensureUserData(telegramId);
        const existing = userData.wallets.find(w => w.publicKey === keypair.publicKey.toBase58());
        if (existing) {
            throw new Error('This wallet is already imported');
        }

        const wallet: TelegramWallet = {
            name,
            publicKey: keypair.publicKey.toBase58(),
            encryptedPrivateKey: this.encrypt(bs58.encode(keypair.secretKey)),
            createdAt: Date.now(),
            isActive: true
        };

        // Set all other wallets to inactive
        userData.wallets.forEach(w => w.isActive = false);
        
        userData.wallets.push(wallet);
        userData.activeWallet = wallet.publicKey;
        this.saveData();

        return { wallet, keypair };
    }

    /**
     * List all wallets for a user
     */
    listWallets(telegramId: number): TelegramWallet[] {
        const userData = this.getUserData(telegramId);
        return userData?.wallets || [];
    }

    /**
     * Get active wallet for a user
     */
    getActiveWallet(telegramId: number): TelegramWallet | null {
        const userData = this.getUserData(telegramId);
        if (!userData || !userData.activeWallet) return null;
        return userData.wallets.find(w => w.publicKey === userData.activeWallet) || null;
    }

    /**
     * Get active keypair for a user
     */
    getActiveKeypair(telegramId: number): Keypair | null {
        const wallet = this.getActiveWallet(telegramId);
        if (!wallet) return null;
        
        try {
            const decryptedKey = this.decrypt(wallet.encryptedPrivateKey);
            return Keypair.fromSecretKey(bs58.decode(decryptedKey));
        } catch (error) {
            console.error('Failed to decrypt wallet:', error);
            return null;
        }
    }

    /**
     * Get keypair by public key
     */
    getKeypairByPublicKey(telegramId: number, publicKey: string): Keypair | null {
        const userData = this.getUserData(telegramId);
        if (!userData) return null;

        const wallet = userData.wallets.find(w => w.publicKey === publicKey);
        if (!wallet) return null;

        try {
            const decryptedKey = this.decrypt(wallet.encryptedPrivateKey);
            return Keypair.fromSecretKey(bs58.decode(decryptedKey));
        } catch (error) {
            console.error('Failed to decrypt wallet:', error);
            return null;
        }
    }

    /**
     * Set active wallet
     */
    setActiveWallet(telegramId: number, publicKey: string): boolean {
        const userData = this.getUserData(telegramId);
        if (!userData) return false;

        const wallet = userData.wallets.find(w => w.publicKey === publicKey);
        if (!wallet) return false;

        // Update active states
        userData.wallets.forEach(w => w.isActive = w.publicKey === publicKey);
        userData.activeWallet = publicKey;
        this.saveData();

        return true;
    }

    /**
     * Export private key (base58)
     */
    exportPrivateKey(telegramId: number, publicKey: string): string | null {
        const userData = this.getUserData(telegramId);
        if (!userData) return null;

        const wallet = userData.wallets.find(w => w.publicKey === publicKey);
        if (!wallet) return null;

        try {
            return this.decrypt(wallet.encryptedPrivateKey);
        } catch (error) {
            console.error('Failed to decrypt private key:', error);
            return null;
        }
    }

    /**
     * Delete a wallet
     */
    deleteWallet(telegramId: number, publicKey: string): boolean {
        const userData = this.getUserData(telegramId);
        if (!userData) return false;

        const index = userData.wallets.findIndex(w => w.publicKey === publicKey);
        if (index === -1) return false;

        const wasActive = userData.wallets[index].isActive;
        userData.wallets.splice(index, 1);

        // If deleted wallet was active, set new active wallet
        if (wasActive && userData.wallets.length > 0) {
            userData.wallets[0].isActive = true;
            userData.activeWallet = userData.wallets[0].publicKey;
        } else if (userData.wallets.length === 0) {
            userData.activeWallet = null;
        }

        this.saveData();
        return true;
    }

    /**
     * Rename a wallet
     */
    renameWallet(telegramId: number, publicKey: string, newName: string): boolean {
        const userData = this.getUserData(telegramId);
        if (!userData) return false;

        const wallet = userData.wallets.find(w => w.publicKey === publicKey);
        if (!wallet) return false;

        wallet.name = newName;
        this.saveData();
        return true;
    }

    /**
     * Check if user has any wallet
     */
    hasWallet(telegramId: number): boolean {
        const userData = this.getUserData(telegramId);
        return userData ? userData.wallets.length > 0 : false;
    }

    /**
     * Get wallet count for a user
     */
    getWalletCount(telegramId: number): number {
        const userData = this.getUserData(telegramId);
        return userData?.wallets.length || 0;
    }

    /**
     * Get all telegram IDs with wallets
     */
    getAllUserIds(): number[] {
        return this.data.users.map(u => u.telegramId);
    }

    /**
     * Get wallet by short address (first 8 chars)
     */
    getWalletByShortAddress(telegramId: number, shortAddr: string): TelegramWallet | null {
        const userData = this.getUserData(telegramId);
        if (!userData) return null;
        return userData.wallets.find(w => w.publicKey.startsWith(shortAddr)) || null;
    }

    // Legacy compatibility methods
    
    /**
     * @deprecated Use createWallet instead
     */
    storeWallet(telegramId: number, keypair: Keypair): void {
        const userData = this.ensureUserData(telegramId);
        
        const existing = userData.wallets.find(w => w.publicKey === keypair.publicKey.toBase58());
        if (existing) {
            // Update existing
            existing.encryptedPrivateKey = this.encrypt(bs58.encode(keypair.secretKey));
        } else {
            // Add new
            const wallet: TelegramWallet = {
                name: `Wallet ${userData.wallets.length + 1}`,
                publicKey: keypair.publicKey.toBase58(),
                encryptedPrivateKey: this.encrypt(bs58.encode(keypair.secretKey)),
                createdAt: Date.now(),
                isActive: userData.wallets.length === 0
            };
            userData.wallets.push(wallet);
            if (wallet.isActive) {
                userData.activeWallet = wallet.publicKey;
            }
        }
        this.saveData();
    }

    /**
     * @deprecated Use getActiveKeypair instead
     */
    getWallet(telegramId: number): Keypair | null {
        return this.getActiveKeypair(telegramId);
    }

    /**
     * @deprecated Use getActiveWallet instead
     */
    getPublicKey(telegramId: number): string | null {
        const wallet = this.getActiveWallet(telegramId);
        return wallet?.publicKey || null;
    }
}

// Singleton instance
export const multiWalletStorage = new MultiWalletStorageService();
