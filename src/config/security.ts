/**
 * Security Configuration
 * 
 * Centralized security settings and access control configuration
 */

export interface SecurityConfig {
    authorizedUsers: number[];
    adminUsers: number[];
    requireWhitelist: boolean;
    maxWalletsPerUser: number;
    maxCommandsPerMinute: number;
    maxCommandsPerHour: number;
    sessionTimeoutMinutes: number;
    enableAuditLogging: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
}

// Parse environment variables with fallbacks
const parseNumberArray = (envVar: string | undefined): number[] => {
    if (!envVar) return [];
    return envVar.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
};

const parseBoolean = (envVar: string | undefined, defaultValue: boolean = false): boolean => {
    if (!envVar) return defaultValue;
    return envVar.toLowerCase() === 'true';
};

const parseNumber = (envVar: string | undefined, defaultValue: number): number => {
    if (!envVar) return defaultValue;
    const parsed = parseInt(envVar);
    return isNaN(parsed) ? defaultValue : parsed;
};

export const SECURITY_CONFIG: SecurityConfig = {
    // User Authorization
    authorizedUsers: parseNumberArray(process.env.AUTHORIZED_TELEGRAM_IDS),
    adminUsers: parseNumberArray(process.env.ADMIN_TELEGRAM_IDS),
    requireWhitelist: parseBoolean(process.env.REQUIRE_USER_WHITELIST, false),
    maxWalletsPerUser: parseNumber(process.env.MAX_WALLETS_PER_USER, 5),
    
    // Rate Limiting
    maxCommandsPerMinute: parseNumber(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE, 10),
    maxCommandsPerHour: parseNumber(process.env.RATE_LIMIT_REQUESTS_PER_HOUR, 200),
    
    // Session Management
    sessionTimeoutMinutes: parseNumber(process.env.SESSION_TIMEOUT_MINUTES, 60),
    
    // Security Logging
    enableAuditLogging: parseBoolean(process.env.ENABLE_AUDIT_LOGGING, true),
    logLevel: (process.env.SECURITY_LOG_LEVEL as any) || 'warn',
};

/**
 * Security utility functions
 */
export class SecurityUtils {
    /**
     * Check if user is authorized to use the bot
     */
    static isAuthorizedUser(telegramId: number): boolean {
        // If whitelist is disabled, allow all users
        if (!SECURITY_CONFIG.requireWhitelist) {
            return true;
        }
        
        // Check if user is in authorized list
        return SECURITY_CONFIG.authorizedUsers.includes(telegramId);
    }
    
    /**
     * Check if user has admin privileges
     */
    static isAdminUser(telegramId: number): boolean {
        return SECURITY_CONFIG.adminUsers.includes(telegramId);
    }
    
    /**
     * Validate that user hasn't exceeded wallet limits
     */
    static canCreateWallet(telegramId: number, currentWalletCount: number): boolean {
        // Admins have no limits
        if (this.isAdminUser(telegramId)) {
            return true;
        }
        
        return currentWalletCount < SECURITY_CONFIG.maxWalletsPerUser;
    }
    
    /**
     * Get sanitized user info for logging
     */
    static getSafeUserInfo(telegramId: number, username?: string): string {
        const maskedId = telegramId.toString().slice(0, 3) + '***';
        const maskedUsername = username ? username.slice(0, 3) + '***' : 'unknown';
        return `${maskedId}(@${maskedUsername})`;
    }
    
    /**
     * Log security events
     */
    static logSecurityEvent(event: string, telegramId: number, details?: any): void {
        if (!SECURITY_CONFIG.enableAuditLogging) return;
        
        const timestamp = new Date().toISOString();
        const userInfo = this.getSafeUserInfo(telegramId);
        const logMessage = `[SECURITY] ${timestamp} - ${event} - User: ${userInfo}`;
        
        if (SECURITY_CONFIG.logLevel === 'debug' && details) {
            console.log(logMessage, details);
        } else {
            console.log(logMessage);
        }
    }
}

/**
 * Security validation errors
 */
export class SecurityError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'SecurityError';
    }
}

export const SECURITY_ERRORS = {
    UNAUTHORIZED_USER: 'UNAUTHORIZED_USER',
    ADMIN_REQUIRED: 'ADMIN_REQUIRED',
    WALLET_LIMIT_EXCEEDED: 'WALLET_LIMIT_EXCEEDED',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    INVALID_INPUT: 'INVALID_INPUT',
} as const;