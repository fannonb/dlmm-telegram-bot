/**
 * Telegram Bot Module Exports
 * 
 * Centralized exports for the Telegram bot functionality.
 */

// Types
export * from './types';

// Services
export { walletStorage } from './services/walletStorage';
export { userDataService, PositionHistoryEntry, AnalyticsSnapshot } from './services/userDataService';
export { userContextManager, UserContext, getUserContext } from './services/userContext';

// Keyboards
export * from './keyboards';

// Utils
export * from './utils/formatting';
export * from './utils/pagination';

// Middlewares
export { rateLimitMiddleware } from './middlewares/rateLimit';
export { requireWallet, checkWallet, getUserCtx, replyWalletRequired } from './middlewares/auth';
export { handleError, withErrorHandler, safeDeleteMessage, safeEditMessage, safeAnswerCbQuery } from './middlewares/errorHandler';

// Bot
export { startBot } from './bot';
