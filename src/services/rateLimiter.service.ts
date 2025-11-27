/**
 * Persistent Rate Limiting Service
 * 
 * File-based rate limiting that persists across bot restarts
 * with token bucket algorithm for smooth rate limiting.
 */

import fs from 'fs';
import path from 'path';
import { SECURITY_CONFIG, SecurityUtils } from '../config/security';

interface RateLimitEntry {
    userId: number;
    tokens: number;
    lastRefill: number;
    requestCount: number;
    hourlyCount: number;
    hourlyReset: number;
}

interface RateLimitStorage {
    entries: Record<string, RateLimitEntry>;
    lastCleanup: number;
}

export class PersistentRateLimiter {
    private static instance: PersistentRateLimiter;
    private storage!: RateLimitStorage;
    private storageFile: string;
    private cleanupInterval: NodeJS.Timeout;

    private constructor() {
        this.storageFile = path.join(process.cwd(), 'data', 'rate-limits.json');
        this.loadStorage();
        
        // Cleanup expired entries every 10 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 10 * 60 * 1000);

        // Save on process exit
        process.on('exit', () => this.saveStorage());
        process.on('SIGINT', () => this.saveStorage());
        process.on('SIGTERM', () => this.saveStorage());
    }

    public static getInstance(): PersistentRateLimiter {
        if (!PersistentRateLimiter.instance) {
            PersistentRateLimiter.instance = new PersistentRateLimiter();
        }
        return PersistentRateLimiter.instance;
    }

    /**
     * Check if user is within rate limits
     */
    public checkRate(userId: number, action: string = 'default'): {
        allowed: boolean;
        retryAfter?: number;
        remaining?: number;
    } {
        const key = `${userId}-${action}`;
        const now = Date.now();
        
        // Get or create user entry
        let entry = this.storage.entries[key];
        if (!entry) {
            entry = {
                userId,
                tokens: SECURITY_CONFIG.maxCommandsPerMinute,
                lastRefill: now,
                requestCount: 0,
                hourlyCount: 0,
                hourlyReset: now + 3600000 // 1 hour
            };
            this.storage.entries[key] = entry;
        }

        // Refill tokens (1 token per 60/maxCommandsPerMinute seconds)
        const refillInterval = 60000 / SECURITY_CONFIG.maxCommandsPerMinute;
        const timeSinceLastRefill = now - entry.lastRefill;
        const tokensToAdd = Math.floor(timeSinceLastRefill / refillInterval);
        
        if (tokensToAdd > 0) {
            entry.tokens = Math.min(
                SECURITY_CONFIG.maxCommandsPerMinute,
                entry.tokens + tokensToAdd
            );
            entry.lastRefill = now;
        }

        // Reset hourly counter if needed
        if (now > entry.hourlyReset) {
            entry.hourlyCount = 0;
            entry.hourlyReset = now + 3600000;
        }

        // Check hourly limit
        if (entry.hourlyCount >= SECURITY_CONFIG.maxCommandsPerHour) {
            SecurityUtils.logSecurityEvent('HOURLY_RATE_LIMIT_EXCEEDED', userId, {
                action,
                hourlyCount: entry.hourlyCount,
                limit: SECURITY_CONFIG.maxCommandsPerHour
            });
            
            const retryAfter = Math.ceil((entry.hourlyReset - now) / 1000);
            return {
                allowed: false,
                retryAfter,
                remaining: 0
            };
        }

        // Check per-minute limit
        if (entry.tokens < 1) {
            const retryAfter = Math.ceil(refillInterval / 1000);
            
            SecurityUtils.logSecurityEvent('MINUTE_RATE_LIMIT_EXCEEDED', userId, {
                action,
                tokens: entry.tokens,
                limit: SECURITY_CONFIG.maxCommandsPerMinute
            });
            
            return {
                allowed: false,
                retryAfter,
                remaining: 0
            };
        }

        // Consume token
        entry.tokens -= 1;
        entry.requestCount += 1;
        entry.hourlyCount += 1;

        this.saveStorage();

        return {
            allowed: true,
            remaining: entry.tokens
        };
    }

    /**
     * Get user's current rate limit status
     */
    public getStatus(userId: number, action: string = 'default'): {
        tokensRemaining: number;
        hourlyRemaining: number;
        nextRefill: number;
        hourlyReset: number;
    } {
        const key = `${userId}-${action}`;
        const entry = this.storage.entries[key];
        const now = Date.now();

        if (!entry) {
            return {
                tokensRemaining: SECURITY_CONFIG.maxCommandsPerMinute,
                hourlyRemaining: SECURITY_CONFIG.maxCommandsPerHour,
                nextRefill: now,
                hourlyReset: now + 3600000
            };
        }

        const refillInterval = 60000 / SECURITY_CONFIG.maxCommandsPerMinute;
        const nextRefill = entry.lastRefill + refillInterval;

        return {
            tokensRemaining: entry.tokens,
            hourlyRemaining: SECURITY_CONFIG.maxCommandsPerHour - entry.hourlyCount,
            nextRefill,
            hourlyReset: entry.hourlyReset
        };
    }

    /**
     * Reset rate limits for a user (admin function)
     */
    public resetUser(userId: number, action?: string): void {
        if (action) {
            const key = `${userId}-${action}`;
            delete this.storage.entries[key];
        } else {
            // Reset all actions for user
            Object.keys(this.storage.entries).forEach(key => {
                if (this.storage.entries[key].userId === userId) {
                    delete this.storage.entries[key];
                }
            });
        }
        
        this.saveStorage();
        SecurityUtils.logSecurityEvent('RATE_LIMIT_RESET', userId, { action });
    }

    /**
     * Get rate limiting statistics
     */
    public getStats(): {
        totalUsers: number;
        totalRequests: number;
        activeUsers: number;
        rateLimitedUsers: number;
    } {
        const now = Date.now();
        const activeThreshold = 3600000; // 1 hour
        
        let totalRequests = 0;
        let activeUsers = 0;
        let rateLimitedUsers = 0;
        const uniqueUsers = new Set<number>();

        Object.values(this.storage.entries).forEach(entry => {
            uniqueUsers.add(entry.userId);
            totalRequests += entry.requestCount;

            if (now - entry.lastRefill < activeThreshold) {
                activeUsers++;
            }

            if (entry.tokens === 0 || entry.hourlyCount >= SECURITY_CONFIG.maxCommandsPerHour) {
                rateLimitedUsers++;
            }
        });

        return {
            totalUsers: uniqueUsers.size,
            totalRequests,
            activeUsers,
            rateLimitedUsers
        };
    }

    /**
     * Load storage from file
     */
    private loadStorage(): void {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.storageFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            if (fs.existsSync(this.storageFile)) {
                const data = fs.readFileSync(this.storageFile, 'utf8');
                this.storage = JSON.parse(data);
            } else {
                this.storage = {
                    entries: {},
                    lastCleanup: Date.now()
                };
            }
        } catch (error) {
            console.error('Error loading rate limit storage:', error);
            this.storage = {
                entries: {},
                lastCleanup: Date.now()
            };
        }
    }

    /**
     * Save storage to file
     */
    private saveStorage(): void {
        try {
            fs.writeFileSync(this.storageFile, JSON.stringify(this.storage, null, 2));
        } catch (error) {
            console.error('Error saving rate limit storage:', error);
        }
    }

    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        const expiryTime = 24 * 60 * 60 * 1000; // 24 hours
        
        Object.keys(this.storage.entries).forEach(key => {
            const entry = this.storage.entries[key];
            
            // Remove entries older than 24 hours with no recent activity
            if (now - entry.lastRefill > expiryTime && entry.tokens === SECURITY_CONFIG.maxCommandsPerMinute) {
                delete this.storage.entries[key];
            }
        });

        this.storage.lastCleanup = now;
        this.saveStorage();
    }

    /**
     * Shutdown and cleanup
     */
    public shutdown(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.saveStorage();
    }
}

// Export singleton instance
export const rateLimiter = PersistentRateLimiter.getInstance();