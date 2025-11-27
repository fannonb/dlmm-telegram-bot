import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { configManager } from '../config/config.manager';
import { rpcManager } from './rpcManager.service';

export class ConnectionService {
  private connection: Connection | null = null;
  private rpcEndpoint: string;
  private commitment: 'processed' | 'confirmed' | 'finalized';
  private useRpcManager: boolean = true; // Enable RPC manager by default

  constructor() {
    const config = configManager.getConfig();
    this.rpcEndpoint = config.connection.rpcEndpoint;
    this.commitment = config.connection.commitment;
    
    // Start RPC manager health monitoring
    if (this.useRpcManager) {
      rpcManager.start();
    }
  }

  /**
   * Get or create connection (uses RPC manager with failover)
   */
  public getConnection(): Connection {
    if (this.useRpcManager) {
      return rpcManager.getConnection();
    }
    
    // Legacy single-endpoint mode
    if (!this.connection) {
      this.connection = new Connection(this.rpcEndpoint, {
        commitment: this.commitment,
        confirmTransactionInitialTimeout: 60000,
      });
    }
    return this.connection;
  }

  /**
   * Execute a request with automatic retry and failover
   */
  public async executeWithRetry<T>(
    operation: (connection: Connection) => Promise<T>,
    options?: { retries?: number; timeout?: number }
  ): Promise<T> {
    if (this.useRpcManager) {
      return rpcManager.execute(operation, options);
    }
    
    // Legacy mode without retry
    return operation(this.getConnection());
  }

  /**
   * Enable or disable RPC manager
   */
  public setUseRpcManager(enabled: boolean): void {
    this.useRpcManager = enabled;
    if (enabled) {
      rpcManager.start();
    } else {
      rpcManager.stop();
    }
  }

  /**
   * Get RPC manager instance
   */
  public getRpcManager() {
    return rpcManager;
  }

  /**
   * Set RPC endpoint (also updates RPC manager)
   */
  public setRpcEndpoint(endpoint: string): void {
    this.rpcEndpoint = endpoint;
    this.connection = null; // Force reconnection
    
    // Update RPC manager primary endpoint
    if (this.useRpcManager) {
      const endpoints = rpcManager.getEndpoints();
      const primaryIndex = endpoints.findIndex(ep => ep.name === 'Primary' || ep.weight >= 10);
      if (primaryIndex >= 0) {
        rpcManager.removeEndpoint(endpoints[primaryIndex].url);
      }
      rpcManager.addEndpoint({
        url: endpoint,
        name: 'Primary',
        weight: 10,
        rateLimit: 50,
      });
    }
    
    // Update config
    const config = configManager.getConfig();
    configManager.updateConfig({
      connection: {
        ...config.connection,
        rpcEndpoint: endpoint,
      },
    });
  }

  /**
   * Set commitment level
   */
  public setCommitment(commitment: 'processed' | 'confirmed' | 'finalized'): void {
    this.commitment = commitment;
    this.connection = null; // Force reconnection
    
    // Update RPC manager commitment
    if (this.useRpcManager) {
      rpcManager.setCommitment(commitment);
    }
    
    // Update config
    const config = configManager.getConfig();
    configManager.updateConfig({
      connection: {
        ...config.connection,
        commitment,
      },
    });
  }

  /**
   * Test connection (with retry through RPC manager)
   */
  public async testConnection(): Promise<{
    success: boolean;
    version?: any;
    blockHeight?: number;
    error?: string;
  }> {
    try {
      if (this.useRpcManager) {
        const result = await rpcManager.execute(async (connection) => {
          const version = await connection.getVersion();
          const blockHeight = await connection.getBlockHeight();
          return { version, blockHeight };
        });
        return {
          success: true,
          ...result,
        };
      }
      
      const connection = this.getConnection();
      const version = await connection.getVersion();
      const blockHeight = await connection.getBlockHeight();
      
      return {
        success: true,
        version,
        blockHeight,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get SOL balance
   */
  public async getBalance(publicKey: PublicKey): Promise<number> {
    const connection = this.getConnection();
    const balance = await connection.getBalance(publicKey);
    return balance / 1e9; // Convert lamports to SOL
  }

  /**
   * Get token account balance
   */
  public async getTokenBalance(tokenAccount: PublicKey): Promise<{
    amount: string;
    decimals: number;
    uiAmount: number;
  }> {
    const connection = this.getConnection();
    const balance = await connection.getTokenAccountBalance(tokenAccount);
    return {
      amount: balance.value.amount,
      decimals: balance.value.decimals,
      uiAmount: balance.value.uiAmount || 0,
    };
  }

  /**
   * Get token accounts for owner
   */
  public async getTokenAccountsByOwner(
    owner: PublicKey,
    mint?: PublicKey
  ): Promise<Array<{
    pubkey: PublicKey;
    account: any;
  }>> {
    const connection = this.getConnection();
    
    const filters = mint
      ? { mint }
      : { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') };

    const response = await connection.getTokenAccountsByOwner(owner, filters);
    return response.value as Array<{
      pubkey: PublicKey;
      account: any;
    }>;
  }

  /**
   * Get or create associated token account
   */
  public async getOrCreateAssociatedTokenAccount(
    owner: PublicKey,
    mint: PublicKey
  ): Promise<PublicKey> {
    const ata = await getAssociatedTokenAddress(mint, owner);
    
    try {
      // Check if account exists
      const connection = this.getConnection();
      await getAccount(connection, ata);
      return ata;
    } catch (error) {
      // Account doesn't exist, need to create it
      // Note: Actual creation will be handled by the transaction that needs it
      return ata;
    }
  }

  /**
   * Get current RPC endpoint
   */
  public getRpcEndpoint(): string {
    return this.rpcEndpoint;
  }

  /**
   * Get current commitment level
   */
  public getCommitment(): 'processed' | 'confirmed' | 'finalized' {
    return this.commitment;
  }

  /**
   * Get connection config
   */
  public getConfig(): {
    endpoint: string;
    commitment: 'processed' | 'confirmed' | 'finalized';
  } {
    return {
      endpoint: this.rpcEndpoint,
      commitment: this.commitment,
    };
  }

  /**
   * Get recent blockhash
   */
  public async getRecentBlockhash(): Promise<{
    blockhash: string;
    lastValidBlockHeight: number;
  }> {
    const connection = this.getConnection();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    return { blockhash, lastValidBlockHeight };
  }

  /**
   * Get transaction fee estimate
   */
  public async estimateFee(message: any): Promise<number> {
    const connection = this.getConnection();
    const fee = await connection.getFeeForMessage(message);
    return fee.value || 0;
  }
}

// Export singleton instance
export const connectionService = new ConnectionService();
