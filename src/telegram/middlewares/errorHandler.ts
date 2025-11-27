/**
 * Global Error Handler Middleware
 * 
 * Catches and handles errors gracefully across all handlers.
 */

import { BotContext, MESSAGES } from '../types';
import chalk from 'chalk';

export interface TelegramError extends Error {
    code?: string | number;
    description?: string;
}

/**
 * Error types we can handle specially
 */
const ERROR_HANDLERS: Record<string, (ctx: BotContext, error: TelegramError) => Promise<void>> = {
    // Rate limit errors from Telegram
    '429': async (ctx, error) => {
        console.warn(chalk.yellow('Rate limited by Telegram API'));
        // Don't reply, just log
    },
    
    // Message not found (already deleted)
    'Bad Request: message to edit not found': async (ctx, error) => {
        console.warn(chalk.gray('Message already deleted or not found'));
        // Silently ignore
    },
    
    // Message not modified (content unchanged)
    'Bad Request: message is not modified': async (ctx, error) => {
        console.warn(chalk.gray('Message content unchanged'));
        // Silently ignore
    },
    
    // Query too old
    'Bad Request: query is too old': async (ctx, error) => {
        console.warn(chalk.gray('Callback query expired'));
        try {
            await ctx.answerCbQuery('⏳ This action has expired. Please try again.');
        } catch (e) {
            // Ignore
        }
    },
    
    // Bot blocked by user
    'Forbidden: bot was blocked by the user': async (ctx, error) => {
        console.warn(chalk.yellow(`Bot blocked by user ${ctx.from?.id}`));
        // Clean up user data if needed
    },
};

/**
 * Handle known blockchain/wallet errors
 */
function isBlockchainError(error: Error): boolean {
    const blockchainErrors = [
        'insufficient funds',
        'blockhash not found',
        'Transaction simulation failed',
        'Node is behind',
        'Account does not exist',
    ];
    
    return blockchainErrors.some(e => 
        error.message.toLowerCase().includes(e.toLowerCase())
    );
}

/**
 * Global error handler
 */
export async function handleError(error: TelegramError, ctx: BotContext) {
    const userId = ctx.from?.id || 'unknown';
    const errorMessage = error.message || error.description || 'Unknown error';
    
    console.error(chalk.red(`❌ Error for user ${userId}:`), errorMessage);
    
    // Check for known error patterns
    for (const [pattern, handler] of Object.entries(ERROR_HANDLERS)) {
        if (errorMessage.includes(pattern) || error.code?.toString() === pattern) {
            await handler(ctx, error);
            return;
        }
    }
    
    // Handle blockchain errors
    if (isBlockchainError(error)) {
        console.error(chalk.red('Blockchain error:'), error.message);
        
        try {
            if (error.message.toLowerCase().includes('insufficient funds')) {
                await ctx.reply('❌ Insufficient funds for this transaction. Please check your balance.');
            } else if (error.message.toLowerCase().includes('blockhash')) {
                await ctx.reply('⚠️ Network congestion detected. Please try again in a moment.');
            } else {
                await ctx.reply('⚠️ Blockchain error occurred. Please try again.');
            }
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
        return;
    }
    
    // Generic error response
    try {
        // Try to answer callback query if applicable
        if (ctx.callbackQuery) {
            try {
                await ctx.answerCbQuery('⚠️ An error occurred');
            } catch (e) {
                // Ignore callback query errors
            }
        }
        
        await ctx.reply(MESSAGES.ERRORS.UNKNOWN_ERROR);
    } catch (e) {
        console.error(chalk.red('Failed to send error response:'), e);
    }
}

/**
 * Wrap handler with error catching
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(handler: T): T {
    return (async (...args: any[]) => {
        try {
            return await handler(...args);
        } catch (error: any) {
            const ctx = args[0] as BotContext;
            await handleError(error, ctx);
        }
    }) as T;
}

/**
 * Safe delete message (ignores errors)
 */
export async function safeDeleteMessage(ctx: BotContext, messageId?: number) {
    try {
        if (messageId) {
            await ctx.telegram.deleteMessage(ctx.chat!.id, messageId);
        } else {
            await ctx.deleteMessage();
        }
    } catch (error) {
        // Silently ignore delete errors
    }
}

/**
 * Safe edit message (falls back to new message if edit fails)
 */
export async function safeEditMessage(
    ctx: BotContext, 
    text: string, 
    options?: any
): Promise<void> {
    try {
        await ctx.editMessageText(text, options);
    } catch (error: any) {
        if (error.message?.includes('message is not modified')) {
            // Content unchanged, ignore
            return;
        }
        if (error.message?.includes('message to edit not found')) {
            // Send new message instead
            await ctx.reply(text, options);
            return;
        }
        throw error;
    }
}

/**
 * Safe answer callback query
 */
export async function safeAnswerCbQuery(ctx: BotContext, text?: string) {
    try {
        await ctx.answerCbQuery(text);
    } catch (error) {
        // Silently ignore
    }
}
