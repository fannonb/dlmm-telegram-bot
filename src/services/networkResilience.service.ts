/**
 * Network Resilience Service
 * 
 * Handles network failures, DNS issues, and connectivity problems
 * Provides fallback mechanisms and network health monitoring
 */

import { Connection } from '@solana/web3.js';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

export interface NetworkHealthCheck {
  endpoint: string;
  isHealthy: boolean;
  latency: number;
  lastChecked: number;
  error?: string;
}

// Get primary RPC from environment (Helius, QuickNode, etc.)
const PRIMARY_RPC = process.env.RPC_ENDPOINT || process.env.SOLANA_RPC_URL;

export class NetworkResilienceService {
  private healthChecks = new Map<string, NetworkHealthCheck>();
  // Only use the configured RPC - no public Solana fallback (it's too rate-limited)
  private fallbackEndpoints: string[] = PRIMARY_RPC ? [PRIMARY_RPC] : [];
  private userEndpoints: string[] = [];
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Log which RPC we're using
    if (PRIMARY_RPC) {
      console.log(`[NetworkResilience] Using primary RPC from env: ${PRIMARY_RPC.substring(0, 50)}...`);
    } else {
      console.error(`[NetworkResilience] ⚠️ No RPC_ENDPOINT set! Please configure RPC_ENDPOINT environment variable.`);
    }
    // Non-blocking initialization - don't await
    this.initPromise = this.initializeHealthChecks();
  }

  /**
   * Add a user-configured endpoint for health checking (prioritized)
   */
  public addUserEndpoint(endpoint: string): void {
    if (!this.userEndpoints.includes(endpoint) && !this.fallbackEndpoints.includes(endpoint)) {
      // User endpoints go first (higher priority)
      this.userEndpoints.unshift(endpoint);
      console.log(`[NetworkResilience] Added user endpoint: ${endpoint}`);
      // Non-blocking health check
      this.checkEndpointHealth(endpoint).catch(err => {
        console.warn(`[NetworkResilience] Health check failed for user endpoint:`, err.message);
      });
    }
  }

  /**
   * Get all endpoints (user first, then fallback)
   */
  public getAllEndpoints(): string[] {
    return [...this.userEndpoints, ...this.fallbackEndpoints];
  }

  private async initializeHealthChecks(): Promise<void> {
    if (this.isInitialized) return;
    
    // Non-blocking - run in background
    setImmediate(async () => {
      console.log('[NetworkResilience] Starting background health checks...');
      
      const allEndpoints = this.getAllEndpoints();
      // Check endpoints in parallel for speed
      const results = await Promise.allSettled(
        allEndpoints.map(endpoint => this.checkEndpointHealth(endpoint))
      );
      
      const healthy = results.filter(r => r.status === 'fulfilled' && (r.value as NetworkHealthCheck).isHealthy).length;
      console.log(`[NetworkResilience] Background health check complete: ${healthy}/${allEndpoints.length} healthy`);
      this.isInitialized = true;
    });
  }

  async checkEndpointHealth(endpoint: string): Promise<NetworkHealthCheck> {
    const startTime = Date.now();
    const HEALTH_CHECK_TIMEOUT = 5000; // 5 second timeout for health checks
    
    try {
      // Extract hostname from URL for DNS check
      const url = new URL(endpoint);
      const hostname = url.hostname;
      
      // Skip DNS check - it adds latency and connection will fail anyway if DNS fails
      // Test RPC connection with timeout
      const connection = new Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: HEALTH_CHECK_TIMEOUT,
      });
      
      // Race between getVersion and timeout
      const version = await Promise.race([
        connection.getVersion(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT)
        )
      ]);
      
      const latency = Date.now() - startTime;
      const healthCheck: NetworkHealthCheck = {
        endpoint,
        isHealthy: true,
        latency,
        lastChecked: Date.now(),
      };
      
      this.healthChecks.set(endpoint, healthCheck);
      console.log(`[NetworkResilience] Health check passed for ${endpoint} (${latency}ms, version: ${version['solana-core']})`);
      
      return healthCheck;
      
    } catch (error: any) {
      const latency = Date.now() - startTime;
      const healthCheck: NetworkHealthCheck = {
        endpoint,
        isHealthy: false,
        latency,
        lastChecked: Date.now(),
        error: error.message
      };
      
      this.healthChecks.set(endpoint, healthCheck);
      console.warn(`[NetworkResilience] Health check failed for ${endpoint}:`, error.message);
      
      return healthCheck;
    }
  }

  async getHealthyEndpoint(): Promise<string | null> {
    // Check cached health status first (within last 2 minutes for faster response)
    const now = Date.now();
    const healthyEndpoints = Array.from(this.healthChecks.entries())
      .filter(([_, check]) => 
        check.isHealthy && 
        (now - check.lastChecked) < 120_000 // 2 minutes
      )
      .sort((a, b) => a[1].latency - b[1].latency) // Sort by latency
      .map(([endpoint]) => endpoint);

    if (healthyEndpoints.length > 0) {
      // Return immediately, trigger background refresh if cache is getting stale
      const selected = healthyEndpoints[0];
      
      // Refresh in background if older than 1 minute
      const oldestCheck = Math.min(...Array.from(this.healthChecks.values()).map(c => c.lastChecked));
      if (now - oldestCheck > 60_000) {
        setImmediate(() => this.refreshHealthChecks());
      }
      
      return selected;
    }

    // If we have user endpoints, return the first one optimistically
    if (this.userEndpoints.length > 0) {
      console.log('[NetworkResilience] Returning user endpoint optimistically');
      // Trigger background health check
      setImmediate(() => this.refreshHealthChecks());
      return this.userEndpoints[0];
    }

    // No cached healthy endpoints, check first available quickly
    console.log('[NetworkResilience] No cached healthy endpoints, checking fastest available...');
    
    const allEndpoints = this.getAllEndpoints();
    
    // Race to find first healthy endpoint (faster startup)
    const results = await Promise.allSettled(
      allEndpoints.map(endpoint => this.checkEndpointHealth(endpoint))
    );
    
    const healthy = results
      .map((result, index) => ({
        endpoint: allEndpoints[index],
        check: result.status === 'fulfilled' ? result.value : null
      }))
      .filter(item => item.check?.isHealthy)
      .sort((a, b) => (a.check?.latency ?? Infinity) - (b.check?.latency ?? Infinity));

    if (healthy.length > 0) {
      const selected = healthy[0].endpoint;
      console.log(`[NetworkResilience] Found healthy endpoint: ${selected.substring(0, 50)}... (${healthy[0].check?.latency}ms)`);
      return selected;
    }
    
    // All failed, return primary from env
    if (PRIMARY_RPC) {
      console.warn('[NetworkResilience] All health checks failed, using primary RPC');
      return PRIMARY_RPC;
    }
    
    throw new Error('No RPC endpoint configured. Please set RPC_ENDPOINT environment variable.');
  }

  private async refreshHealthChecks(): Promise<void> {
    const allEndpoints = this.getAllEndpoints();
    await Promise.allSettled(
      allEndpoints.map(endpoint => this.checkEndpointHealth(endpoint))
    );
  }

  async createResilientConnection(): Promise<Connection> {
    const endpoint = await this.getHealthyEndpoint();
    
    if (!endpoint) {
      if (!PRIMARY_RPC) {
        throw new Error('No RPC endpoint configured. Please set RPC_ENDPOINT environment variable.');
      }
      console.warn('[NetworkResilience] No healthy endpoints available, using primary from env');
      return new Connection(PRIMARY_RPC, 'confirmed');
    }

    return new Connection(endpoint, 'confirmed');
  }

  getHealthStatus(): NetworkHealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  async diagnoseNetworkIssues(): Promise<string[]> {
    const issues: string[] = [];
    const checks = this.getHealthStatus();
    
    if (checks.length === 0) {
      issues.push('No network health checks performed yet');
      return issues;
    }

    const unhealthyCount = checks.filter(check => !check.isHealthy).length;
    
    if (unhealthyCount === checks.length) {
      issues.push('All RPC endpoints are unhealthy - possible network connectivity issue');
    } else if (unhealthyCount > 0) {
      issues.push(`${unhealthyCount}/${checks.length} RPC endpoints are unhealthy`);
    }

    // Check for DNS issues
    const dnsIssues = checks.filter(check => 
      check.error?.includes('DNS resolution failed') || 
      check.error?.includes('ENOTFOUND')
    );
    
    if (dnsIssues.length > 0) {
      issues.push(`DNS resolution issues detected for ${dnsIssues.length} endpoints`);
      issues.push('Possible causes: Network connectivity, DNS server issues, firewall blocking');
    }

    // Check for connection timeouts
    const timeoutIssues = checks.filter(check => 
      check.error?.includes('timeout') || 
      check.error?.includes('ETIMEDOUT')
    );
    
    if (timeoutIssues.length > 0) {
      issues.push(`Connection timeout issues detected for ${timeoutIssues.length} endpoints`);
      issues.push('Possible causes: Network latency, firewall blocking, server overload');
    }

    return issues;
  }
}

export const networkResilienceService = new NetworkResilienceService();