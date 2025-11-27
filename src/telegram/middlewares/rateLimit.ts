import { BotContext } from '../types';
import { rateLimiter } from '../../services/rateLimiter.service';
import { SecurityUtils } from '../../config/security';

export async function rateLimitMiddleware(ctx: BotContext, next: () => Promise<void>) {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // Check rate limits
    const result = rateLimiter.checkRate(userId);

    if (!result.allowed) {
        const retryAfter = result.retryAfter || 60;
        const minutes = Math.ceil(retryAfter / 60);
        
        SecurityUtils.logSecurityEvent('RATE_LIMITED', userId, { 
            retryAfter,
            command: ctx.message ? 'message' : 'callback' 
        });

        await ctx.reply(
            `⚠️ **Rate Limit Exceeded**\n\n` +
            `Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before sending more commands.\n\n` +
            `This helps keep the bot responsive for everyone.`
        );
        return;
    }

    // Log remaining tokens for monitoring
    if (result.remaining !== undefined && result.remaining <= 2) {
        SecurityUtils.logSecurityEvent('RATE_LIMIT_WARNING', userId, { 
            remaining: result.remaining 
        });
    }

    return next();
}

/**
 * Enhanced rate limiting for specific actions
 */
export async function actionRateLimit(action: string) {
    return async (ctx: BotContext, next: () => Promise<void>) => {
        const userId = ctx.from?.id;
        if (!userId) return next();

        const result = rateLimiter.checkRate(userId, action);

        if (!result.allowed) {
            const retryAfter = result.retryAfter || 60;
            
            SecurityUtils.logSecurityEvent('ACTION_RATE_LIMITED', userId, { 
                action,
                retryAfter 
            });

            await ctx.reply(
                `⚠️ **Action Rate Limited**\n\n` +
                `Too many "${action}" requests. Please wait ${Math.ceil(retryAfter / 60)} minute(s).`
            );
            return;
        }

        return next();
    };
}
