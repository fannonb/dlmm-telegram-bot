/**
 * Pagination Utilities for Telegram
 * 
 * Handles paginated lists with inline keyboard navigation.
 */

import { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/types';

export interface PaginationConfig {
    itemsPerPage: number;
    currentPage: number;
    totalItems: number;
    callbackPrefix: string;  // e.g., 'pos' for positions
}

export interface PaginatedResult<T> {
    items: T[];
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    startIndex: number;
    endIndex: number;
}

/**
 * Paginate an array of items
 */
export function paginate<T>(items: T[], config: PaginationConfig): PaginatedResult<T> {
    const { itemsPerPage, currentPage, totalItems } = config;
    
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
    
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    
    return {
        items: items.slice(startIndex, endIndex),
        currentPage: safeCurrentPage,
        totalPages,
        hasNext: safeCurrentPage < totalPages,
        hasPrev: safeCurrentPage > 1,
        startIndex,
        endIndex,
    };
}

/**
 * Build pagination keyboard buttons
 */
export function buildPaginationButtons(config: PaginationConfig): InlineKeyboardButton[] {
    const { currentPage, totalItems, itemsPerPage, callbackPrefix } = config;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) {
        return [];
    }
    
    const buttons: InlineKeyboardButton[] = [];
    
    // Previous button
    if (currentPage > 1) {
        buttons.push({
            text: '◀️ Prev',
            callback_data: `${callbackPrefix}_page_${currentPage - 1}`,
        });
    }
    
    // Page indicator
    buttons.push({
        text: `${currentPage}/${totalPages}`,
        callback_data: `${callbackPrefix}_page_current`,  // No-op
    });
    
    // Next button
    if (currentPage < totalPages) {
        buttons.push({
            text: 'Next ▶️',
            callback_data: `${callbackPrefix}_page_${currentPage + 1}`,
        });
    }
    
    return buttons;
}

/**
 * Build a complete paginated inline keyboard
 * @param itemButtons - Array of button rows for the items
 * @param config - Pagination config
 * @param additionalButtons - Additional button rows to add at the bottom
 */
export function buildPaginatedKeyboard(
    itemButtons: InlineKeyboardButton[][],
    config: PaginationConfig,
    additionalButtons?: InlineKeyboardButton[][]
): InlineKeyboardMarkup {
    const keyboard: InlineKeyboardButton[][] = [...itemButtons];
    
    // Add pagination row if needed
    const paginationButtons = buildPaginationButtons(config);
    if (paginationButtons.length > 0) {
        keyboard.push(paginationButtons);
    }
    
    // Add additional buttons
    if (additionalButtons) {
        keyboard.push(...additionalButtons);
    }
    
    return { inline_keyboard: keyboard };
}

/**
 * Parse page number from callback data
 */
export function parsePageFromCallback(callbackData: string, prefix: string): number | null {
    const regex = new RegExp(`^${prefix}_page_(\\d+)$`);
    const match = callbackData.match(regex);
    
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Default items per page for different list types
 */
export const DEFAULT_ITEMS_PER_PAGE = {
    positions: 5,
    pools: 8,
    transactions: 10,
    alerts: 10,
    history: 10,
};

/**
 * Build item selection keyboard (for selecting from a paginated list)
 */
export function buildSelectionKeyboard<T>(
    items: T[],
    getLabel: (item: T, index: number) => string,
    getCallbackData: (item: T, index: number) => string,
    config: PaginationConfig,
    additionalButtons?: InlineKeyboardButton[][]
): InlineKeyboardMarkup {
    const paginated = paginate(items, config);
    const startIndex = (config.currentPage - 1) * config.itemsPerPage;
    
    const itemButtons: InlineKeyboardButton[][] = paginated.items.map((item, i) => [{
        text: getLabel(item, startIndex + i),
        callback_data: getCallbackData(item, startIndex + i),
    }]);
    
    return buildPaginatedKeyboard(itemButtons, {
        ...config,
        currentPage: paginated.currentPage,
    }, additionalButtons);
}
