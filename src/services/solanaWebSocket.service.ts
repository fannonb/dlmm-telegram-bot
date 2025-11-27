import { Connection, PublicKey, AccountInfo, Context } from '@solana/web3.js';
import { EventEmitter } from 'events';

/**
 * Solana WebSocket Service for Position Monitoring
 * 
 * Uses Solana's native WebSocket subscriptions to monitor:
 * - Position account changes (real-time fee accrual, liquidity changes)
 * - Transaction confirmations
 * 
 * Works with any RPC that supports WebSocket (including Helius free tier)
 */

export interface AccountChangeEvent {
  publicKey: string;
  accountInfo: AccountInfo<Buffer>;
  slot: number;
  context: Context;
}

export interface TransactionConfirmation {
  signature: string;
  slot: number;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized';
  err: any | null;
}

class SolanaWebSocketService extends EventEmitter {
  private connection: Connection | null = null;
  private wsEndpoint: string | null = null;
  private accountSubscriptions: Map<string, number> = new Map(); // pubkey -> subscriptionId
  private signatureSubscriptions: Map<string, number> = new Map(); // signature -> subscriptionId
  private isInitialized = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly MAX_SUBSCRIPTIONS = 10; // Helius free tier limit

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Initialize WebSocket connection
   * @param rpcEndpoint HTTP RPC endpoint (will convert to WSS)
   */
  public async initialize(rpcEndpoint: string): Promise<void> {
    if (this.isInitialized) {
      console.log('[SolanaWS] Already initialized');
      return;
    }

    try {
      // Convert HTTP to WebSocket endpoint
      this.wsEndpoint = this.httpToWs(rpcEndpoint);
      console.log(`[SolanaWS] Connecting to ${this.wsEndpoint}`);

      // Create connection with WebSocket commitment
      this.connection = new Connection(rpcEndpoint, {
        commitment: 'confirmed',
        wsEndpoint: this.wsEndpoint,
      });

      // Test the connection
      const slot = await this.connection.getSlot();
      console.log(`[SolanaWS] ✓ Connected (current slot: ${slot})`);
      
      this.isInitialized = true;
      this.emit('connected');

    } catch (error) {
      console.error('[SolanaWS] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Convert HTTP endpoint to WebSocket endpoint
   */
  private httpToWs(httpUrl: string): string {
    return httpUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');
  }

  /**
   * Subscribe to account changes (position monitoring)
   * Returns subscription ID for later unsubscription
   */
  public async subscribeToAccount(
    publicKey: string | PublicKey,
    callback?: (event: AccountChangeEvent) => void
  ): Promise<number> {
    if (!this.connection) {
      throw new Error('WebSocket not initialized. Call initialize() first.');
    }

    const pubkeyStr = typeof publicKey === 'string' ? publicKey : publicKey.toBase58();
    
    // Check if already subscribed
    if (this.accountSubscriptions.has(pubkeyStr)) {
      console.log(`[SolanaWS] Already subscribed to ${pubkeyStr.slice(0, 8)}...`);
      return this.accountSubscriptions.get(pubkeyStr)!;
    }

    // Check subscription limit
    if (this.accountSubscriptions.size >= this.MAX_SUBSCRIPTIONS) {
      console.warn(`[SolanaWS] Max subscriptions (${this.MAX_SUBSCRIPTIONS}) reached. Consider upgrading RPC plan.`);
      // Remove oldest subscription
      const [oldestKey] = this.accountSubscriptions.keys();
      await this.unsubscribeFromAccount(oldestKey);
    }

    const pubkey = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;

    const subscriptionId = this.connection.onAccountChange(
      pubkey,
      (accountInfo: AccountInfo<Buffer>, context: Context) => {
        const event: AccountChangeEvent = {
          publicKey: pubkeyStr,
          accountInfo,
          slot: context.slot,
          context,
        };

        // Emit event
        this.emit('accountChange', event);
        this.emit(`account:${pubkeyStr}`, event);

        // Call callback if provided
        if (callback) {
          callback(event);
        }
      },
      'confirmed'
    );

    this.accountSubscriptions.set(pubkeyStr, subscriptionId);
    console.log(`[SolanaWS] ✓ Subscribed to account ${pubkeyStr.slice(0, 8)}... (ID: ${subscriptionId})`);
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from account changes
   */
  public async unsubscribeFromAccount(publicKey: string | PublicKey): Promise<void> {
    if (!this.connection) return;

    const pubkeyStr = typeof publicKey === 'string' ? publicKey : publicKey.toBase58();
    const subscriptionId = this.accountSubscriptions.get(pubkeyStr);

    if (subscriptionId !== undefined) {
      await this.connection.removeAccountChangeListener(subscriptionId);
      this.accountSubscriptions.delete(pubkeyStr);
      console.log(`[SolanaWS] Unsubscribed from account ${pubkeyStr.slice(0, 8)}...`);
    }
  }

  /**
   * Subscribe to transaction confirmation
   */
  public async subscribeToSignature(
    signature: string,
    callback?: (confirmation: TransactionConfirmation) => void
  ): Promise<number> {
    if (!this.connection) {
      throw new Error('WebSocket not initialized. Call initialize() first.');
    }

    // Check if already subscribed
    if (this.signatureSubscriptions.has(signature)) {
      return this.signatureSubscriptions.get(signature)!;
    }

    const subscriptionId = this.connection.onSignature(
      signature,
      (signatureResult, context) => {
        const confirmation: TransactionConfirmation = {
          signature,
          slot: context.slot,
          confirmationStatus: 'confirmed',
          err: signatureResult.err,
        };

        this.emit('signatureConfirmed', confirmation);
        this.emit(`signature:${signature}`, confirmation);

        if (callback) {
          callback(confirmation);
        }

        // Auto-cleanup after confirmation
        this.signatureSubscriptions.delete(signature);
      },
      'confirmed'
    );

    this.signatureSubscriptions.set(signature, subscriptionId);
    console.log(`[SolanaWS] ✓ Watching signature ${signature.slice(0, 16)}...`);
    
    return subscriptionId;
  }

  /**
   * Subscribe to multiple positions at once
   */
  public async subscribeToPositions(
    positionPublicKeys: (string | PublicKey)[],
    callback?: (event: AccountChangeEvent) => void
  ): Promise<Map<string, number>> {
    const results = new Map<string, number>();

    for (const pubkey of positionPublicKeys) {
      try {
        const subId = await this.subscribeToAccount(pubkey, callback);
        const pubkeyStr = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
        results.set(pubkeyStr, subId);
      } catch (error) {
        const pubkeyStr = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
        console.error(`[SolanaWS] Failed to subscribe to ${pubkeyStr}:`, error);
      }
    }

    return results;
  }

  /**
   * Unsubscribe from all accounts
   */
  public async unsubscribeAll(): Promise<void> {
    if (!this.connection) return;

    // Unsubscribe from all accounts
    for (const [pubkey, subId] of this.accountSubscriptions) {
      try {
        await this.connection.removeAccountChangeListener(subId);
      } catch (error) {
        console.error(`[SolanaWS] Error unsubscribing from ${pubkey}:`, error);
      }
    }
    this.accountSubscriptions.clear();

    // Unsubscribe from all signatures
    for (const [sig, subId] of this.signatureSubscriptions) {
      try {
        await this.connection.removeSignatureListener(subId);
      } catch (error) {
        console.error(`[SolanaWS] Error unsubscribing from signature:`, error);
      }
    }
    this.signatureSubscriptions.clear();

    console.log('[SolanaWS] Unsubscribed from all accounts');
  }

  /**
   * Disconnect WebSocket
   */
  public async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    await this.unsubscribeAll();
    this.connection = null;
    this.isInitialized = false;
    
    console.log('[SolanaWS] Disconnected');
    this.emit('disconnected');
  }

  /**
   * Get current subscription count
   */
  public getSubscriptionCount(): number {
    return this.accountSubscriptions.size;
  }

  /**
   * Get max allowed subscriptions
   */
  public getMaxSubscriptions(): number {
    return this.MAX_SUBSCRIPTIONS;
  }

  /**
   * Check if initialized
   */
  public get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get subscribed account pubkeys
   */
  public getSubscribedAccounts(): string[] {
    return Array.from(this.accountSubscriptions.keys());
  }
}

// Export singleton instance
export const solanaWebSocketService = new SolanaWebSocketService();
