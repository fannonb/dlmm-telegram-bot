/**
 * Authentication Middleware
 * 
 * Ensures user has a wallet connected for protected routes.
 */

import { BotContext, MESSAGES } from '../types';
import { userContextManager } from '../services/userContext';
import { walletSetupKeyboard } from '../keyboards';
import { SecurityUtils, SecurityError, SECURITY_ERRORS } from '../../config/security';

/**
 * Middleware that requires user authorization
 * Use this as the first middleware for all routes
 */
export function requireAuthorization() {
    return async (ctx: BotContext, next: () => Promise<void>) => {
        const telegramId = ctx.from?.id;
        
        if (!telegramId) {
            await ctx.reply(MESSAGES.ERRORS.SESSION_EXPIRED);
            return;
        }
        
        // Check if user is authorized
        if (!SecurityUtils.isAuthorizedUser(telegramId)) {
            SecurityUtils.logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', telegramId);
            await ctx.reply('🚫 **Access Denied**\n\nYou are not authorized to use this bot. Please contact an administrator if you believe this is an error.');
            return;
        }
        
        await next();
    };
}

/**
 * Middleware that requires a connected wallet
 * Use this for routes that need wallet access
 */
export function requireWallet() {
    return async (ctx: BotContext, next: () => Promise<void>) => {
        const telegramId = ctx.from?.id;
        
        if (!telegramId) {
            await ctx.reply(MESSAGES.ERRORS.SESSION_EXPIRED);
            return;
        }
        
        const userCtx = userContextManager.getContext(telegramId);
        
        if (!userCtx.hasWallet()) {
            await ctx.reply(MESSAGES.ERRORS.NO_WALLET, {
                reply_markup: walletSetupKeyboard(),
            });
            return;
        }
        
        await next();
    };
}

/**
 * Middleware that requires admin privileges
 * Use this for administrative functions
 */
export function requireAdmin() {
    return async (ctx: BotContext, next: () => Promise<void>) => {
        const telegramId = ctx.from?.id;
        
        if (!telegramId) {
            await ctx.reply(MESSAGES.ERRORS.SESSION_EXPIRED);
            return;
        }
        
        if (!SecurityUtils.isAdminUser(telegramId)) {
            SecurityUtils.logSecurityEvent('ADMIN_ACCESS_DENIED', telegramId);
            await ctx.reply('🔒 **Admin Access Required**\n\nThis function is restricted to administrators only.');
            return;
        }
        
        await next();
    };
}

/**
 * Check if user has wallet (non-blocking)
 * Returns the user context if wallet exists, null otherwise
 */
export function checkWallet(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    
    if (!telegramId) {
        return null;
    }
    
    const userCtx = userContextManager.getContext(telegramId);
    
    if (!userCtx.hasWallet()) {
        return null;
    }
    
    return userCtx;
}

/**
 * Get user context (always returns context, may not have wallet)
 */
export function getUserCtx(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    
    if (!telegramId) {
        return null;
    }
    
    return userContextManager.getContext(telegramId);
}

/**
 * Reply with wallet required message
 */
export async function replyWalletRequired(ctx: BotContext) {
    await ctx.reply(MESSAGES.ERRORS.NO_WALLET, {
        reply_markup: walletSetupKeyboard(),
    });
}
