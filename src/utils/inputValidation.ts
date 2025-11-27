/**
 * Input Validation and Sanitization Utilities
 * 
 * Comprehensive input validation to prevent injection attacks,
 * buffer overflows, and other security vulnerabilities.
 */

import { PublicKey } from '@solana/web3.js';
import { SecurityError, SECURITY_ERRORS } from '../config/security';

export interface ValidationResult<T> {
    isValid: boolean;
    value?: T;
    error?: string;
}

export class InputValidator {
    
    // ==================== NUMERIC VALIDATION ====================
    
    /**
     * Validate and sanitize numeric amounts
     */
    static validateAmount(input: string, options: {
        min?: number;
        max?: number;
        decimals?: number;
        allowZero?: boolean;
    } = {}): ValidationResult<number> {
        const {
            min = 0,
            max = Number.MAX_SAFE_INTEGER,
            decimals = 18,
            allowZero = false
        } = options;
        
        // Basic sanitization
        const trimmed = input.trim().replace(/[^\d.-]/g, '');
        
        if (!trimmed) {
            return { isValid: false, error: 'Amount is required' };
        }
        
        const num = parseFloat(trimmed);
        
        if (isNaN(num)) {
            return { isValid: false, error: 'Invalid number format' };
        }
        
        if (!allowZero && num === 0) {
            return { isValid: false, error: 'Amount must be greater than zero' };
        }
        
        if (num < min) {
            return { isValid: false, error: `Amount must be at least ${min}` };
        }
        
        if (num > max) {
            return { isValid: false, error: `Amount must not exceed ${max}` };
        }
        
        // Check decimal places
        const decimalPlaces = (trimmed.split('.')[1] || '').length;
        if (decimalPlaces > decimals) {
            return { isValid: false, error: `Maximum ${decimals} decimal places allowed` };
        }
        
        return { isValid: true, value: num };
    }
    
    /**
     * Validate percentage values (0-100)
     */
    static validatePercentage(input: string): ValidationResult<number> {
        return this.validateAmount(input, {
            min: 0,
            max: 100,
            decimals: 2,
            allowZero: true
        });
    }
    
    // ==================== TEXT VALIDATION ====================
    
    /**
     * Sanitize and validate text input
     */
    static sanitizeText(input: string, options: {
        maxLength?: number;
        allowSpecialChars?: boolean;
        allowNewlines?: boolean;
    } = {}): ValidationResult<string> {
        const {
            maxLength = 1000,
            allowSpecialChars = false,
            allowNewlines = false
        } = options;
        
        if (!input) {
            return { isValid: false, error: 'Text is required' };
        }
        
        let sanitized = input.trim();
        
        if (sanitized.length === 0) {
            return { isValid: false, error: 'Text cannot be empty' };
        }
        
        if (sanitized.length > maxLength) {
            return { isValid: false, error: `Text too long (max ${maxLength} characters)` };
        }
        
        // Remove potentially dangerous characters
        if (!allowSpecialChars) {
            sanitized = sanitized.replace(/[<>&"'`]/g, '');
        }
        
        if (!allowNewlines) {
            sanitized = sanitized.replace(/[\r\n]/g, ' ');
        }
        
        // Check for potential injection patterns
        const suspiciousPatterns = [
            /javascript:/i,
            /vbscript:/i,
            /onload=/i,
            /onerror=/i,
            /eval\s*\(/i,
            /expression\s*\(/i
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(sanitized)) {
                return { isValid: false, error: 'Invalid characters detected' };
            }
        }
        
        return { isValid: true, value: sanitized };
    }
    
    /**
     * Validate wallet names
     */
    static validateWalletName(input: string): ValidationResult<string> {
        const result = this.sanitizeText(input, {
            maxLength: 50,
            allowSpecialChars: false,
            allowNewlines: false
        });
        
        if (!result.isValid) return result;
        
        const name = result.value!;
        
        // Additional wallet name rules
        if (!/^[a-zA-Z0-9_-\s]+$/.test(name)) {
            return { isValid: false, error: 'Wallet name can only contain letters, numbers, spaces, hyphens, and underscores' };
        }
        
        if (name.length < 2) {
            return { isValid: false, error: 'Wallet name must be at least 2 characters' };
        }
        
        return { isValid: true, value: name };
    }
    
    // ==================== BLOCKCHAIN VALIDATION ====================
    
    /**
     * Validate Solana address format
     */
    static validateSolanaAddress(input: string): ValidationResult<string> {
        const trimmed = input.trim();
        
        if (!trimmed) {
            return { isValid: false, error: 'Address is required' };
        }
        
        // Check length (Solana addresses are typically 32-44 characters)
        if (trimmed.length < 32 || trimmed.length > 44) {
            return { isValid: false, error: 'Invalid address length' };
        }
        
        // Check Base58 format
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        if (!base58Regex.test(trimmed)) {
            return { isValid: false, error: 'Invalid address format' };
        }
        
        // Validate using Solana's PublicKey class
        try {
            new PublicKey(trimmed);
            return { isValid: true, value: trimmed };
        } catch (error) {
            return { isValid: false, error: 'Invalid Solana address' };
        }
    }
    
    /**
     * Validate private key format
     */
    static validatePrivateKey(input: string): ValidationResult<string> {
        const trimmed = input.trim();
        
        if (!trimmed) {
            return { isValid: false, error: 'Private key is required' };
        }
        
        // Check length (Solana private keys are typically 87-88 characters in base58)
        if (trimmed.length < 80 || trimmed.length > 100) {
            return { isValid: false, error: 'Invalid private key length' };
        }
        
        // Check Base58 format
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        if (!base58Regex.test(trimmed)) {
            return { isValid: false, error: 'Invalid private key format' };
        }
        
        // Additional security checks
        if (trimmed.includes(' ')) {
            return { isValid: false, error: 'Private key cannot contain spaces' };
        }
        
        return { isValid: true, value: trimmed };
    }
    
    /**
     * Validate mnemonic seed phrase
     */
    static validateMnemonic(input: string): ValidationResult<string> {
        const trimmed = input.trim();
        
        if (!trimmed) {
            return { isValid: false, error: 'Seed phrase is required' };
        }
        
        const words = trimmed.toLowerCase().split(/\s+/);
        
        // Check word count
        if (words.length !== 12 && words.length !== 24) {
            return { isValid: false, error: 'Seed phrase must be 12 or 24 words' };
        }
        
        // Check for suspicious patterns
        for (const word of words) {
            if (!/^[a-z]+$/.test(word)) {
                return { isValid: false, error: 'Seed phrase can only contain lowercase letters' };
            }
            
            if (word.length < 3 || word.length > 8) {
                return { isValid: false, error: 'Invalid word length in seed phrase' };
            }
        }
        
        return { isValid: true, value: words.join(' ') };
    }
    
    // ==================== URL VALIDATION ====================
    
    /**
     * Validate RPC endpoint URLs
     */
    static validateRpcUrl(input: string): ValidationResult<string> {
        const trimmed = input.trim();
        
        if (!trimmed) {
            return { isValid: false, error: 'RPC URL is required' };
        }
        
        try {
            const url = new URL(trimmed);
            
            // Only allow HTTPS for security
            if (url.protocol !== 'https:') {
                return { isValid: false, error: 'Only HTTPS URLs are allowed' };
            }
            
            // Check for suspicious hosts
            const suspiciousHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
            if (suspiciousHosts.some(host => url.hostname.includes(host))) {
                return { isValid: false, error: 'Local URLs are not allowed' };
            }
            
            return { isValid: true, value: trimmed };
        } catch (error) {
            return { isValid: false, error: 'Invalid URL format' };
        }
    }
    
    // ==================== COMMAND PARSING ====================
    
    /**
     * Parse and validate command arguments
     */
    static parseCommandArgs(input: string, expectedArgs: number): ValidationResult<string[]> {
        const trimmed = input.trim();
        
        if (!trimmed) {
            return { isValid: false, error: 'Command arguments are required' };
        }
        
        const args = trimmed.split(/\s+/).filter(arg => arg.length > 0);
        
        if (args.length !== expectedArgs) {
            return { isValid: false, error: `Expected ${expectedArgs} arguments, got ${args.length}` };
        }
        
        // Sanitize each argument
        const sanitizedArgs = args.map(arg => {
            const result = this.sanitizeText(arg, { maxLength: 100, allowSpecialChars: false });
            return result.value || '';
        });
        
        return { isValid: true, value: sanitizedArgs };
    }
    
    // ==================== UTILITY METHODS ====================
    
    /**
     * Throw security error for invalid input
     */
    static throwValidationError(message: string): never {
        throw new SecurityError(message, SECURITY_ERRORS.INVALID_INPUT);
    }
    
    /**
     * Validate input and throw on error
     */
    static validateAndThrow<T>(result: ValidationResult<T>): T {
        if (!result.isValid) {
            this.throwValidationError(result.error!);
        }
        return result.value!;
    }
}