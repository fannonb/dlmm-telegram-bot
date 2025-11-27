import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

interface UserWallet {
    telegramId: number;
    publicKey: string;
    encryptedPrivateKey: string; // Encrypted with master password
    createdAt: number;
}

interface WalletData {
    wallets: UserWallet[];
    masterPasswordHash: string;
}

export class WalletStorageService {
    private dataPath: string;
    private masterPassword: string;
    private data: WalletData;

    constructor() {
        this.dataPath = path.join(process.cwd(), 'data', 'telegram_wallets.json');
        this.masterPassword = process.env.WALLET_MASTER_PASSWORD || this.generateMasterPassword();
        this.ensureDataFile();
        this.data = this.loadData();
    }

    private generateMasterPassword(): string {
        const password = crypto.randomBytes(32).toString('hex');
        console.log('⚠️  Generated new master password. Add to .env:');
        console.log(`WALLET_MASTER_PASSWORD=${password}`);
        return password;
    }

    private ensureDataFile(): void {
        const dir = path.dirname(this.dataPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.dataPath)) {
            const initialData: WalletData = {
                wallets: [],
                masterPasswordHash: crypto.createHash('sha256').update(this.masterPassword).digest('hex')
            };
            fs.writeFileSync(this.dataPath, JSON.stringify(initialData, null, 2));
        }
    }

    private loadData(): WalletData {
        try {
            const raw = fs.readFileSync(this.dataPath, 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            console.error('Failed to load wallet data:', error);
            return { wallets: [], masterPasswordHash: '' };
        }
    }

    private saveData(): void {
        fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
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

    // Store wallet (from seed phrase or keypair)
    storeWallet(telegramId: number, keypair: Keypair): void {
        const existing = this.data.wallets.find(w => w.telegramId === telegramId);

        if (existing) {
            // Update existing
            existing.publicKey = keypair.publicKey.toBase58();
            existing.encryptedPrivateKey = this.encrypt(bs58.encode(keypair.secretKey));
        } else {
            // Create new
            this.data.wallets.push({
                telegramId,
                publicKey: keypair.publicKey.toBase58(),
                encryptedPrivateKey: this.encrypt(bs58.encode(keypair.secretKey)),
                createdAt: Date.now()
            });
        }

        this.saveData();
    }

    // Retrieve wallet keypair
    getWallet(telegramId: number): Keypair | null {
        const wallet = this.data.wallets.find(w => w.telegramId === telegramId);
        if (!wallet) return null;

        try {
            const decryptedKey = this.decrypt(wallet.encryptedPrivateKey);
            const secretKey = bs58.decode(decryptedKey);
            return Keypair.fromSecretKey(secretKey);
        } catch (error) {
            console.error('Failed to decrypt wallet:', error);
            return null;
        }
    }

    // Check if user has wallet
    hasWallet(telegramId: number): boolean {
        return this.data.wallets.some(w => w.telegramId === telegramId);
    }

    // Delete wallet
    deleteWallet(telegramId: number): boolean {
        const index = this.data.wallets.findIndex(w => w.telegramId === telegramId);
        if (index === -1) return false;

        this.data.wallets.splice(index, 1);
        this.saveData();
        return true;
    }

    // Alias for deleteWallet
    removeWallet(telegramId: number): boolean {
        return this.deleteWallet(telegramId);
    }

    // Get public key for a user
    getPublicKey(telegramId: number): string | null {
        const wallet = this.data.wallets.find(w => w.telegramId === telegramId);
        return wallet ? wallet.publicKey : null;
    }

    // Get all telegram IDs with wallets
    getAllUserIds(): number[] {
        return this.data.wallets.map(w => w.telegramId);
    }

    // Get wallet count
    getWalletCount(): number {
        return this.data.wallets.length;
    }

    // Get wallet creation date
    getWalletCreatedAt(telegramId: number): number | null {
        const wallet = this.data.wallets.find(w => w.telegramId === telegramId);
        return wallet ? wallet.createdAt : null;
    }
}

// Singleton instance
export const walletStorage = new WalletStorageService();
