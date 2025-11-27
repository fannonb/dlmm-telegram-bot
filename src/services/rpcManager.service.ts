/**
 * RPC Manager Service
 * 
 * Production-grade RPC management with:
 * - Multiple endpoint pool (primary + fallbacks)
 * - Automatic failover with health checks
 * - Exponential backoff retry
 * - Request rate limiting (per endpoint)
 * - Request queuing to prevent overwhelming
 */

import { Connection, ConnectionConfig as SolanaConnectionConfig } from '@solana/web3.js';
import { EventEmitter } from 'events';

// ==================== TYPES ====================

export interface RpcEndpoint {
    url: string;
    name: string;
    weight: number;           // Priority weight (higher = preferred)
    rateLimit: number;        // Requests per second
    isHealthy: boolean;
    lastHealthCheck: number;
    successCount: number;
    failureCount: number;
    averageLatency: number;
    lastError?: string;
    lastErrorTime?: number;
}

export interface RpcManagerConfig {
    endpoints: RpcEndpointConfig[];
    healthCheckIntervalMs: number;      // How often to check endpoint health
    maxRetries: number;                  // Max retries before failover
    retryBaseDelayMs: number;           // Base delay for exponential backoff
    retryMaxDelayMs: number;            // Max delay for exponential backoff
    requestTimeoutMs: number;           // Timeout for requests
    queueMaxSize: number;               // Max queued requests
    failoverThreshold: number;          // Failures before marking unhealthy
    recoveryThreshold: number;          // Successes before marking healthy again
    commitment: 'processed' | 'confirmed' | 'finalized';
}

export interface RpcEndpointConfig {
    url: string;
    name: string;
    weight?: number;
    rateLimit?: number;
}

export interface QueuedRequest<T> {
    id: string;
    operation: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    retries: number;
    createdAt: number;
    endpointUrl?: string;
}

export interface RpcStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalRetries: number;
    averageLatency: number;
    queueSize: number;
    endpoints: RpcEndpoint[];
}

// ==================== DEFAULT CONFIG ====================

const DEFAULT_CONFIG: RpcManagerConfig = {
    endpoints: [
        { url: 'https://api.mainnet-beta.solana.com', name: 'Primary', weight: 5, rateLimit: 10 },
    ],
    healthCheckIntervalMs: 60000,      // 60 seconds (reduced frequency)
    maxRetries: 2,                     // Reduced retries for faster failover
    retryBaseDelayMs: 500,             // 500ms (faster retry)
    retryMaxDelayMs: 5000,             // 5 seconds max
    requestTimeoutMs: 10000,           // 10 seconds (reduced from 30)
    queueMaxSize: 100,
    failoverThreshold: 2,              // 2 failures (faster failover)
    recoveryThreshold: 3,              // 3 successes
    commitment: 'confirmed',
};

// ==================== RPC MANAGER CLASS ====================

export class RpcManager extends EventEmitter {
    private config: RpcManagerConfig;
    private endpoints: Map<string, RpcEndpoint> = new Map();
    private connections: Map<string, Connection> = new Map();
    private requestQueue: QueuedRequest<any>[] = [];
    private isProcessingQueue: boolean = false;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private rateLimitTokens: Map<string, number> = new Map();
    private rateLimitLastRefill: Map<string, number> = new Map();
    
    // Stats
    private stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalRetries: 0,
        latencySum: 0,
    };

    constructor(config?: Partial<RpcManagerConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initializeEndpoints();
    }

    // ==================== INITIALIZATION ====================

    private initializeEndpoints(): void {
        for (const epConfig of this.config.endpoints) {
            const endpoint: RpcEndpoint = {
                url: epConfig.url,
                name: epConfig.name,
                weight: epConfig.weight ?? 1,
                rateLimit: epConfig.rateLimit ?? 30,
                isHealthy: true,
                lastHealthCheck: Date.now(),
                successCount: 0,
                failureCount: 0,
                averageLatency: 0,
            };
            
            this.endpoints.set(epConfig.url, endpoint);
            this.rateLimitTokens.set(epConfig.url, endpoint.rateLimit);
            this.rateLimitLastRefill.set(epConfig.url, Date.now());
        }

        console.log(`[RPC Manager] Initialized with ${this.endpoints.size} endpoint(s)`);
    }

    /**
     * Start health monitoring
     */
    public start(): void {
        if (this.healthCheckInterval) {
            return;
        }

        // Initial health check - non-blocking
        setImmediate(() => {
            this.checkAllEndpointsHealth().catch(err => {
                console.warn('[RPC Manager] Initial health check failed:', err.message);
            });
        });

        // Periodic health checks
        this.healthCheckInterval = setInterval(() => {
            this.checkAllEndpointsHealth().catch(err => {
                console.warn('[RPC Manager] Periodic health check failed:', err.message);
            });
        }, this.config.healthCheckIntervalMs);

        console.log('[RPC Manager] Started health monitoring');
    }

    /**
     * Stop health monitoring
     */
    public stop(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        console.log('[RPC Manager] Stopped health monitoring');
    }

    // ==================== ENDPOINT MANAGEMENT ====================

    /**
     * Add a new RPC endpoint
     */
    public addEndpoint(config: RpcEndpointConfig): void {
        if (this.endpoints.has(config.url)) {
            console.log(`[RPC Manager] Endpoint already exists: ${config.name}`);
            return;
        }

        const endpoint: RpcEndpoint = {
            url: config.url,
            name: config.name,
            weight: config.weight ?? 1,
            rateLimit: config.rateLimit ?? 30,
            isHealthy: true,
            lastHealthCheck: 0,
            successCount: 0,
            failureCount: 0,
            averageLatency: 0,
        };

        this.endpoints.set(config.url, endpoint);
        this.rateLimitTokens.set(config.url, endpoint.rateLimit);
        this.rateLimitLastRefill.set(config.url, Date.now());

        // Immediately check health
        this.checkEndpointHealth(config.url);

        console.log(`[RPC Manager] Added endpoint: ${config.name}`);
        this.emit('endpointAdded', endpoint);
    }

    /**
     * Remove an RPC endpoint
     */
    public removeEndpoint(url: string): boolean {
        const endpoint = this.endpoints.get(url);
        if (!endpoint) {
            return false;
        }

        this.endpoints.delete(url);
        this.connections.delete(url);
        this.rateLimitTokens.delete(url);
        this.rateLimitLastRefill.delete(url);

        console.log(`[RPC Manager] Removed endpoint: ${endpoint.name}`);
        this.emit('endpointRemoved', endpoint);
        return true;
    }

    /**
     * Update endpoint configuration
     */
    public updateEndpoint(url: string, updates: Partial<RpcEndpointConfig>): boolean {
        const endpoint = this.endpoints.get(url);
        if (!endpoint) {
            return false;
        }

        if (updates.name) endpoint.name = updates.name;
        if (updates.weight !== undefined) endpoint.weight = updates.weight;
        if (updates.rateLimit !== undefined) {
            endpoint.rateLimit = updates.rateLimit;
            this.rateLimitTokens.set(url, updates.rateLimit);
        }

        return true;
    }

    /**
     * Get all endpoints
     */
    public getEndpoints(): RpcEndpoint[] {
        return Array.from(this.endpoints.values());
    }

    /**
     * Get healthy endpoints sorted by weight
     */
    public getHealthyEndpoints(): RpcEndpoint[] {
        return Array.from(this.endpoints.values())
            .filter(ep => ep.isHealthy)
            .sort((a, b) => b.weight - a.weight);
    }

    // ==================== CONNECTION MANAGEMENT ====================

    /**
     * Get a connection for a specific endpoint
     */
    private getConnectionForEndpoint(url: string): Connection {
        let connection = this.connections.get(url);
        if (!connection) {
            connection = new Connection(url, {
                commitment: this.config.commitment,
                confirmTransactionInitialTimeout: this.config.requestTimeoutMs,
            });
            this.connections.set(url, connection);
        }
        return connection;
    }

    /**
     * Get the best available connection (for backward compatibility)
     */
    public getConnection(): Connection {
        const bestEndpoint = this.selectBestEndpoint();
        if (!bestEndpoint) {
            // Fallback to first endpoint even if unhealthy
            const firstEndpoint = Array.from(this.endpoints.values())[0];
            if (firstEndpoint) {
                return this.getConnectionForEndpoint(firstEndpoint.url);
            }
            throw new Error('No RPC endpoints configured');
        }
        return this.getConnectionForEndpoint(bestEndpoint.url);
    }

    // ==================== ENDPOINT SELECTION ====================

    /**
     * Select the best endpoint based on health, weight, and rate limits
     */
    private selectBestEndpoint(): RpcEndpoint | null {
        const healthyEndpoints = this.getHealthyEndpoints();
        
        if (healthyEndpoints.length === 0) {
            // All endpoints unhealthy, try the one with most recent success
            const allEndpoints = Array.from(this.endpoints.values());
            if (allEndpoints.length === 0) return null;
            
            // Sort by failure count (ascending) and latency
            allEndpoints.sort((a, b) => {
                if (a.failureCount !== b.failureCount) {
                    return a.failureCount - b.failureCount;
                }
                return a.averageLatency - b.averageLatency;
            });
            return allEndpoints[0];
        }

        // Filter by rate limit availability
        const availableEndpoints = healthyEndpoints.filter(ep => 
            this.hasRateLimitCapacity(ep.url)
        );

        if (availableEndpoints.length === 0) {
            // All rate limited, return highest weight
            return healthyEndpoints[0];
        }

        // Weighted random selection among available endpoints
        const totalWeight = availableEndpoints.reduce((sum, ep) => sum + ep.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const endpoint of availableEndpoints) {
            random -= endpoint.weight;
            if (random <= 0) {
                return endpoint;
            }
        }

        return availableEndpoints[0];
    }

    // ==================== RATE LIMITING ====================

    /**
     * Check if endpoint has rate limit capacity
     */
    private hasRateLimitCapacity(url: string): boolean {
        this.refillRateLimitTokens(url);
        const tokens = this.rateLimitTokens.get(url) ?? 0;
        return tokens > 0;
    }

    /**
     * Consume a rate limit token
     */
    private consumeRateLimitToken(url: string): boolean {
        this.refillRateLimitTokens(url);
        const tokens = this.rateLimitTokens.get(url) ?? 0;
        
        if (tokens > 0) {
            this.rateLimitTokens.set(url, tokens - 1);
            return true;
        }
        return false;
    }

    /**
     * Refill rate limit tokens based on time elapsed
     */
    private refillRateLimitTokens(url: string): void {
        const endpoint = this.endpoints.get(url);
        if (!endpoint) return;

        const lastRefill = this.rateLimitLastRefill.get(url) ?? Date.now();
        const now = Date.now();
        const elapsed = now - lastRefill;
        
        // Refill tokens based on time (tokens per second)
        const tokensToAdd = Math.floor(elapsed / 1000) * endpoint.rateLimit;
        
        if (tokensToAdd > 0) {
            const currentTokens = this.rateLimitTokens.get(url) ?? 0;
            const newTokens = Math.min(currentTokens + tokensToAdd, endpoint.rateLimit);
            this.rateLimitTokens.set(url, newTokens);
            this.rateLimitLastRefill.set(url, now);
        }
    }

    // ==================== HEALTH CHECKS ====================

    /**
     * Check health of all endpoints
     */
    private async checkAllEndpointsHealth(): Promise<void> {
        const checks = Array.from(this.endpoints.keys()).map(url => 
            this.checkEndpointHealth(url)
        );
        await Promise.allSettled(checks);
    }

    /**
     * Check health of a specific endpoint
     */
    private async checkEndpointHealth(url: string): Promise<void> {
        const endpoint = this.endpoints.get(url);
        if (!endpoint) return;

        const startTime = Date.now();
        
        try {
            const connection = this.getConnectionForEndpoint(url);
            const blockHeight = await Promise.race([
                connection.getBlockHeight(),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Health check timeout')), 5000)
                )
            ]);

            const latency = Date.now() - startTime;
            
            // Update endpoint stats
            endpoint.lastHealthCheck = Date.now();
            endpoint.successCount++;
            endpoint.failureCount = 0;
            endpoint.averageLatency = endpoint.averageLatency === 0 
                ? latency 
                : (endpoint.averageLatency * 0.8 + latency * 0.2);
            endpoint.lastError = undefined;

            // Check recovery
            if (!endpoint.isHealthy && endpoint.successCount >= this.config.recoveryThreshold) {
                endpoint.isHealthy = true;
                console.log(`[RPC Manager] Endpoint recovered: ${endpoint.name}`);
                this.emit('endpointRecovered', endpoint);
            } else if (!endpoint.isHealthy) {
                // Still recovering
            } else {
                endpoint.isHealthy = true;
            }

        } catch (error) {
            endpoint.lastHealthCheck = Date.now();
            endpoint.failureCount++;
            endpoint.successCount = 0;
            endpoint.lastError = error instanceof Error ? error.message : 'Unknown error';
            endpoint.lastErrorTime = Date.now();

            // Check if should mark unhealthy
            if (endpoint.isHealthy && endpoint.failureCount >= this.config.failoverThreshold) {
                endpoint.isHealthy = false;
                console.log(`[RPC Manager] Endpoint marked unhealthy: ${endpoint.name} - ${endpoint.lastError}`);
                this.emit('endpointUnhealthy', endpoint);
            }
        }
    }

    // ==================== REQUEST EXECUTION ====================

    /**
     * Execute a request with automatic retry and failover
     */
    public async execute<T>(
        operation: (connection: Connection) => Promise<T>,
        options?: { 
            retries?: number;
            timeout?: number;
            preferredEndpoint?: string;
        }
    ): Promise<T> {
        const maxRetries = options?.retries ?? this.config.maxRetries;
        const timeout = options?.timeout ?? this.config.requestTimeoutMs;
        
        let lastError: Error | null = null;
        let retryCount = 0;
        const triedEndpoints = new Set<string>();

        this.stats.totalRequests++;

        while (retryCount <= maxRetries) {
            // Select endpoint
            let endpoint: RpcEndpoint | null = null;
            
            if (options?.preferredEndpoint && !triedEndpoints.has(options.preferredEndpoint)) {
                endpoint = this.endpoints.get(options.preferredEndpoint) ?? null;
            }
            
            if (!endpoint || !endpoint.isHealthy || triedEndpoints.has(endpoint.url)) {
                // Get next best endpoint not yet tried
                const available = this.getHealthyEndpoints()
                    .filter(ep => !triedEndpoints.has(ep.url));
                endpoint = available[0] ?? null;
            }

            if (!endpoint) {
                // All endpoints tried, reset and try again with backoff
                triedEndpoints.clear();
                endpoint = this.selectBestEndpoint();
            }

            if (!endpoint) {
                throw new Error('No RPC endpoints available');
            }

            triedEndpoints.add(endpoint.url);

            try {
                // Wait for rate limit
                while (!this.consumeRateLimitToken(endpoint.url)) {
                    await this.delay(100);
                }

                const connection = this.getConnectionForEndpoint(endpoint.url);
                const startTime = Date.now();

                // Execute with timeout
                const result = await Promise.race([
                    operation(connection),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Request timeout')), timeout)
                    )
                ]);

                const latency = Date.now() - startTime;
                
                // Update stats
                this.stats.successfulRequests++;
                this.stats.latencySum += latency;
                endpoint.successCount++;
                endpoint.failureCount = 0;
                endpoint.averageLatency = endpoint.averageLatency === 0
                    ? latency
                    : (endpoint.averageLatency * 0.8 + latency * 0.2);

                // Check recovery
                if (!endpoint.isHealthy && endpoint.successCount >= this.config.recoveryThreshold) {
                    endpoint.isHealthy = true;
                    this.emit('endpointRecovered', endpoint);
                }

                return result;

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                // Update endpoint failure stats
                endpoint.failureCount++;
                endpoint.successCount = 0;
                endpoint.lastError = lastError.message;
                endpoint.lastErrorTime = Date.now();

                // Check rate limit errors
                if (this.isRateLimitError(lastError)) {
                    // Deplete rate limit tokens for this endpoint
                    this.rateLimitTokens.set(endpoint.url, 0);
                    console.log(`[RPC Manager] Rate limited on ${endpoint.name}`);
                }

                // Check if should mark unhealthy
                if (endpoint.isHealthy && endpoint.failureCount >= this.config.failoverThreshold) {
                    endpoint.isHealthy = false;
                    console.log(`[RPC Manager] Marking unhealthy: ${endpoint.name}`);
                    this.emit('endpointUnhealthy', endpoint);
                }

                retryCount++;
                this.stats.totalRetries++;

                if (retryCount <= maxRetries) {
                    // Exponential backoff
                    const delay = Math.min(
                        this.config.retryBaseDelayMs * Math.pow(2, retryCount - 1),
                        this.config.retryMaxDelayMs
                    );
                    await this.delay(delay);
                }
            }
        }

        this.stats.failedRequests++;
        throw lastError ?? new Error('Request failed after all retries');
    }

    /**
     * Check if error is rate limit related
     */
    private isRateLimitError(error: Error): boolean {
        const message = error.message.toLowerCase();
        return message.includes('429') || 
               message.includes('rate limit') ||
               message.includes('too many requests');
    }

    // ==================== REQUEST QUEUE ====================

    /**
     * Queue a request for execution
     */
    public async queueRequest<T>(
        operation: () => Promise<T>,
        timeout?: number
    ): Promise<T> {
        if (this.requestQueue.length >= this.config.queueMaxSize) {
            throw new Error('Request queue is full');
        }

        return new Promise<T>((resolve, reject) => {
            const request: QueuedRequest<T> = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                operation,
                resolve,
                reject,
                retries: 0,
                createdAt: Date.now(),
            };

            this.requestQueue.push(request);
            this.processQueue();

            // Timeout for queued request
            if (timeout) {
                setTimeout(() => {
                    const index = this.requestQueue.findIndex(r => r.id === request.id);
                    if (index !== -1) {
                        this.requestQueue.splice(index, 1);
                        reject(new Error('Queued request timeout'));
                    }
                }, timeout);
            }
        });
    }

    /**
     * Process the request queue
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            while (this.requestQueue.length > 0) {
                const request = this.requestQueue.shift();
                if (!request) break;

                try {
                    const result = await request.operation();
                    request.resolve(result);
                } catch (error) {
                    request.reject(error instanceof Error ? error : new Error(String(error)));
                }

                // Small delay between queue items
                await this.delay(10);
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    // ==================== STATS & MONITORING ====================

    /**
     * Get current stats
     */
    public getStats(): RpcStats {
        return {
            totalRequests: this.stats.totalRequests,
            successfulRequests: this.stats.successfulRequests,
            failedRequests: this.stats.failedRequests,
            totalRetries: this.stats.totalRetries,
            averageLatency: this.stats.successfulRequests > 0 
                ? this.stats.latencySum / this.stats.successfulRequests 
                : 0,
            queueSize: this.requestQueue.length,
            endpoints: Array.from(this.endpoints.values()),
        };
    }

    /**
     * Reset stats
     */
    public resetStats(): void {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalRetries: 0,
            latencySum: 0,
        };
    }

    // ==================== CONFIGURATION ====================

    /**
     * Get current configuration
     */
    public getConfig(): RpcManagerConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    public updateConfig(updates: Partial<RpcManagerConfig>): void {
        this.config = { ...this.config, ...updates };
        
        // Restart health checks if interval changed
        if (updates.healthCheckIntervalMs && this.healthCheckInterval) {
            this.stop();
            this.start();
        }
    }

    /**
     * Set endpoints (replace all)
     */
    public setEndpoints(endpoints: RpcEndpointConfig[]): void {
        // Clear existing
        this.endpoints.clear();
        this.connections.clear();
        this.rateLimitTokens.clear();
        this.rateLimitLastRefill.clear();

        // Update config
        this.config.endpoints = endpoints;

        // Re-initialize
        this.initializeEndpoints();

        // Check health
        this.checkAllEndpointsHealth();
    }

    // ==================== UTILITIES ====================

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get commitment level
     */
    public getCommitment(): 'processed' | 'confirmed' | 'finalized' {
        return this.config.commitment;
    }

    /**
     * Set commitment level
     */
    public setCommitment(commitment: 'processed' | 'confirmed' | 'finalized'): void {
        this.config.commitment = commitment;
        // Clear connections to use new commitment
        this.connections.clear();
    }
}

// ==================== SINGLETON INSTANCE ====================

// Load initial config from environment
function loadInitialEndpoints(): RpcEndpointConfig[] {
    const endpoints: RpcEndpointConfig[] = [];
    
    // Primary RPC from env
    const primaryRpc = process.env.RPC_ENDPOINT || process.env.SOLANA_RPC_URL;
    if (primaryRpc) {
        endpoints.push({
            url: primaryRpc,
            name: 'Primary',
            weight: 10,
            rateLimit: 50,
        });
    }

    // Fallback RPCs from env (comma-separated)
    const fallbackRpcs = process.env.RPC_FALLBACK_ENDPOINTS;
    if (fallbackRpcs) {
        const fallbacks = fallbackRpcs.split(',').map(url => url.trim());
        fallbacks.forEach((url, index) => {
            endpoints.push({
                url,
                name: `Fallback ${index + 1}`,
                weight: 5 - index,
                rateLimit: 30,
            });
        });
    }

    // No longer adding public Solana RPC as fallback - it's too rate-limited for production
    // Users must configure RPC_ENDPOINT with a proper RPC (Helius, QuickNode, etc.)
    if (endpoints.length === 0) {
        console.error('[RPC Manager] ⚠️ No RPC endpoints configured! Please set RPC_ENDPOINT environment variable.');
    }

    return endpoints;
}

export const rpcManager = new RpcManager({
    endpoints: loadInitialEndpoints(),
    healthCheckIntervalMs: 30000,
    maxRetries: 3,
    retryBaseDelayMs: 1000,
    retryMaxDelayMs: 30000,
    requestTimeoutMs: 30000,
    queueMaxSize: 100,
    failoverThreshold: 3,
    recoveryThreshold: 5,
    commitment: 'confirmed',
});
