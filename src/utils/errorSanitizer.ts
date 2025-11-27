/**
 * Error Sanitization Utilities
 * 
 * Prevents sensitive information disclosure in error messages
 * while maintaining useful debugging information for developers.
 */

import { SecurityUtils } from '../config/security';

export interface SanitizedError {
    userMessage: string;
    logMessage: string;
    errorCode: string;
    timestamp: number;
}

export class ErrorSanitizer {
    
    // Patterns that indicate sensitive information
    private static readonly SENSITIVE_PATTERNS = [
        /private.?key/i,
        /secret/i,
        /password/i,
        /token/i,
        /mnemonic/i,
        /seed/i,
        /api.?key/i,
        /authorization/i,
        /bearer/i,
        /wallet/i,
        /keypair/i,
        /signature/i,
        /0x[a-fA-F0-9]{40,}/,  // Ethereum-style addresses
        /[1-9A-HJ-NP-Za-km-z]{32,44}/, // Base58 addresses (likely Solana)
        /\b[A-Za-z0-9+/]{40,}={0,2}\b/, // Base64 encoded data
    ];
    
    // Generic error messages for different categories
    private static readonly ERROR_CATEGORIES = {
        AUTHENTICATION: 'Authentication failed. Please check your credentials.',
        AUTHORIZATION: 'Access denied. Insufficient permissions.',
        WALLET: 'Wallet operation failed. Please try again.',
        NETWORK: 'Network connection error. Please check your internet connection.',
        BLOCKCHAIN: 'Blockchain transaction failed. Please try again later.',
        VALIDATION: 'Invalid input provided. Please check your data.',
        RATE_LIMIT: 'Too many requests. Please wait and try again.',
        INTERNAL: 'An internal error occurred. Please contact support if this persists.',
        CONFIGURATION: 'Service configuration error. Please contact support.',
        EXTERNAL_API: 'External service temporarily unavailable. Please try again later.',
    };

    /**
     * Sanitize error for user display
     */
    public static sanitizeForUser(
        error: Error | string,
        userId?: number,
        context?: string
    ): SanitizedError {
        const errorMessage = typeof error === 'string' ? error : error.message;
        const timestamp = Date.now();
        
        // Determine error category and generate safe message
        const category = this.categorizeError(errorMessage);
        const userMessage = this.generateUserMessage(category, errorMessage);
        const errorCode = this.generateErrorCode(category, timestamp);
        
        // Create detailed log message (for internal use only)
        const logMessage = typeof error === 'string' ? error : `${error.name}: ${error.message}\n${error.stack || ''}`;
        
        // Log security event if user is provided
        if (userId) {
            SecurityUtils.logSecurityEvent('ERROR_OCCURRED', userId, {
                category,
                errorCode,
                context,
                originalError: this.sanitizeForLogging(logMessage)
            });
        }
        
        return {
            userMessage,
            logMessage,
            errorCode,
            timestamp
        };
    }

    /**
     * Sanitize error for logging (remove most sensitive data but keep some context)
     */
    public static sanitizeForLogging(message: string): string {
        let sanitized = message;
        
        // Replace sensitive patterns with placeholders
        this.SENSITIVE_PATTERNS.forEach((pattern, index) => {
            sanitized = sanitized.replace(pattern, `[REDACTED_${index}]`);
        });
        
        // Remove specific sensitive strings but keep error structure
        sanitized = sanitized
            .replace(/([a-zA-Z0-9+/]{40,}={0,2})/g, '[BASE64_REDACTED]')
            .replace(/([1-9A-HJ-NP-Za-km-z]{32,44})/g, '[ADDRESS_REDACTED]')
            .replace(/(sk_[a-zA-Z0-9]{48,})/g, '[SECRET_KEY_REDACTED]')
            .replace(/(pk_[a-zA-Z0-9]{48,})/g, '[PUBLIC_KEY_REDACTED]');
        
        return sanitized;
    }

    /**
     * Categorize error based on message content
     */
    private static categorizeError(errorMessage: string): string {
        const lowerMessage = errorMessage.toLowerCase();
        
        if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
            return 'AUTHENTICATION';
        }
        
        if (lowerMessage.includes('forbidden') || lowerMessage.includes('access denied')) {
            return 'AUTHORIZATION';
        }
        
        if (lowerMessage.includes('wallet') || lowerMessage.includes('keypair') || lowerMessage.includes('private key')) {
            return 'WALLET';
        }
        
        if (lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('timeout')) {
            return 'NETWORK';
        }
        
        if (lowerMessage.includes('transaction') || lowerMessage.includes('blockchain') || lowerMessage.includes('insufficient funds')) {
            return 'BLOCKCHAIN';
        }
        
        if (lowerMessage.includes('invalid') || lowerMessage.includes('validation') || lowerMessage.includes('format')) {
            return 'VALIDATION';
        }
        
        if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
            return 'RATE_LIMIT';
        }
        
        if (lowerMessage.includes('config') || lowerMessage.includes('environment')) {
            return 'CONFIGURATION';
        }
        
        if (lowerMessage.includes('api') || lowerMessage.includes('service unavailable')) {
            return 'EXTERNAL_API';
        }
        
        return 'INTERNAL';
    }

    /**
     * Generate user-friendly error message
     */
    private static generateUserMessage(category: string, originalMessage: string): string {
        const baseMessage = this.ERROR_CATEGORIES[category as keyof typeof this.ERROR_CATEGORIES] || this.ERROR_CATEGORIES.INTERNAL;
        
        // For validation errors, we can be more specific if it's safe
        if (category === 'VALIDATION') {
            const safeValidationMessage = this.extractSafeValidationMessage(originalMessage);
            if (safeValidationMessage) {
                return safeValidationMessage;
            }
        }
        
        // For blockchain errors, provide more specific guidance
        if (category === 'BLOCKCHAIN') {
            if (originalMessage.toLowerCase().includes('insufficient')) {
                return 'Insufficient funds to complete the transaction.';
            }
            if (originalMessage.toLowerCase().includes('slippage')) {
                return 'Transaction failed due to price changes. Please try again.';
            }
        }
        
        return baseMessage;
    }

    /**
     * Extract safe validation messages
     */
    private static extractSafeValidationMessage(message: string): string | null {
        // Safe validation messages that don't contain sensitive info
        const safePatterns = [
            /amount must be (greater than|at least|between) [\d.]+/i,
            /invalid number format/i,
            /maximum \d+ decimal places allowed/i,
            /text too long \(max \d+ characters\)/i,
            /invalid address length/i,
            /invalid address format/i,
            /seed phrase must be \d+ or \d+ words/i,
            /expected \d+ arguments, got \d+/i,
        ];
        
        for (const pattern of safePatterns) {
            const match = message.match(pattern);
            if (match) {
                return match[0];
            }
        }
        
        return null;
    }

    /**
     * Generate unique error code for tracking
     */
    private static generateErrorCode(category: string, timestamp: number): string {
        const shortTimestamp = timestamp.toString().slice(-8);
        const categoryCode = category.substring(0, 3).toUpperCase();
        return `${categoryCode}-${shortTimestamp}`;
    }

    /**
     * Create formatted error response for Telegram
     */
    public static formatTelegramError(
        sanitizedError: SanitizedError,
        includeCode: boolean = true
    ): string {
        let message = `❌ **Error**\n\n${sanitizedError.userMessage}`;
        
        if (includeCode) {
            message += `\n\n*Error Code: ${sanitizedError.errorCode}*`;
        }
        
        return message;
    }

    /**
     * Check if error message contains sensitive information
     */
    public static containsSensitiveInfo(message: string): boolean {
        return this.SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
    }

    /**
     * Get safe error for external APIs (minimal information)
     */
    public static getSafeExternalError(error: Error | string): { message: string; code: number } {
        const message = typeof error === 'string' ? error : error.message;
        
        // Always return generic message for external APIs
        return {
            message: 'Service temporarily unavailable',
            code: 500
        };
    }
}