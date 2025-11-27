/**
 * Telegram Formatting Utilities
 * 
 * Helper functions for formatting messages, numbers, addresses, etc.
 * for Telegram display.
 */

// ==================== NUMBER FORMATTING ====================

/**
 * Format USD value
 */
export function formatUsd(value: number | undefined | null): string {
    if (value === undefined || value === null || isNaN(value)) {
        return '$0.00';
    }
    
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
        return `$${(value / 1000).toFixed(2)}K`;
    }
    if (value >= 1) {
        return `$${value.toFixed(2)}`;
    }
    if (value >= 0.01) {
        return `$${value.toFixed(4)}`;
    }
    return `$${value.toFixed(6)}`;
}

/**
 * Format token amount
 */
export function formatTokenAmount(amount: number | undefined | null, decimals: number = 6): string {
    if (amount === undefined || amount === null || isNaN(amount)) {
        return '0';
    }
    
    if (amount >= 1000000) {
        return `${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
        return `${(amount / 1000).toFixed(2)}K`;
    }
    if (amount >= 1) {
        return amount.toFixed(Math.min(decimals, 4));
    }
    if (amount >= 0.0001) {
        return amount.toFixed(Math.min(decimals, 6));
    }
    return amount.toFixed(decimals);
}

/**
 * Format percentage
 */
export function formatPercent(value: number | undefined | null, decimals: number = 2): string {
    if (value === undefined || value === null || isNaN(value)) {
        return '0%';
    }
    return `${value.toFixed(decimals)}%`;
}

/**
 * Format APR/APY
 */
export function formatApr(value: number | undefined | null): string {
    if (value === undefined || value === null || isNaN(value)) {
        return '0%';
    }
    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K%`;
    }
    return `${value.toFixed(2)}%`;
}

/**
 * Format large numbers with K/M/B suffixes
 */
export function formatLargeNumber(value: number | undefined | null): string {
    if (value === undefined || value === null || isNaN(value)) {
        return '0';
    }
    
    if (value >= 1e9) {
        return `${(value / 1e9).toFixed(2)}B`;
    }
    if (value >= 1e6) {
        return `${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
        return `${(value / 1e3).toFixed(2)}K`;
    }
    return value.toFixed(2);
}

/**
 * Format number with specified decimals
 */
export function formatNumber(value: number | undefined | null, decimals: number = 2): string {
    if (value === undefined || value === null || isNaN(value)) {
        return '0';
    }
    return value.toFixed(decimals);
}

// ==================== ADDRESS FORMATTING ====================

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
    if (!address) return '';
    if (address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format address for copy (with backticks for monospace)
 */
export function formatAddressForCopy(address: string): string {
    return `\`${address}\``;
}

/**
 * Create Solscan link for address
 */
export function solscanAddressLink(address: string, network: 'mainnet' | 'devnet' = 'mainnet'): string {
    const baseUrl = network === 'devnet' 
        ? 'https://solscan.io/account' 
        : 'https://solscan.io/account';
    const cluster = network === 'devnet' ? '?cluster=devnet' : '';
    return `${baseUrl}/${address}${cluster}`;
}

/**
 * Create Solscan link for transaction
 */
export function solscanTxLink(signature: string, network: 'mainnet' | 'devnet' = 'mainnet'): string {
    const baseUrl = 'https://solscan.io/tx';
    const cluster = network === 'devnet' ? '?cluster=devnet' : '';
    return `${baseUrl}/${signature}${cluster}`;
}

// ==================== TIME FORMATTING ====================

/**
 * Format timestamp to readable date/time
 */
export function formatDateTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

/**
 * Format timestamp to date only
 */
export function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ago`;
    }
    if (hours > 0) {
        return `${hours}h ago`;
    }
    if (minutes > 0) {
        return `${minutes}m ago`;
    }
    return 'just now';
}

/**
 * Format duration in hours
 */
export function formatDuration(hours: number): string {
    if (hours < 1) {
        return `${Math.round(hours * 60)}m`;
    }
    if (hours < 24) {
        return `${hours.toFixed(1)}h`;
    }
    return `${(hours / 24).toFixed(1)}d`;
}

// ==================== POSITION STATUS FORMATTING ====================

/**
 * Get range status emoji and text
 */
export function formatRangeStatus(inRange: boolean, distanceFromEdge?: number): string {
    if (inRange) {
        if (distanceFromEdge !== undefined && distanceFromEdge <= 5) {
            return '⚠️ Near Edge';
        }
        return '✅ In Range';
    }
    return '❌ Out of Range';
}

/**
 * Get priority emoji
 */
export function getPriorityEmoji(priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'): string {
    switch (priority) {
        case 'CRITICAL': return '🔴';
        case 'HIGH': return '🟠';
        case 'MEDIUM': return '🟡';
        case 'LOW': return '🟢';
        case 'NONE': return '⚪';
    }
}

/**
 * Format PnL with color indicator
 */
export function formatPnL(pnl: number): string {
    if (pnl > 0) {
        return `📈 +${formatUsd(pnl)}`;
    }
    if (pnl < 0) {
        return `📉 ${formatUsd(pnl)}`;
    }
    return `➡️ ${formatUsd(0)}`;
}

// ==================== POOL FORMATTING ====================

/**
 * Format pool name
 */
export function formatPoolName(tokenX: string, tokenY: string): string {
    return `${tokenX}/${tokenY}`;
}

/**
 * Format TVL
 */
export function formatTvl(tvl: number | undefined | null): string {
    return `TVL: ${formatLargeNumber(tvl || 0)}`;
}

/**
 * Format 24h volume
 */
export function formatVolume24h(volume: number | undefined | null): string {
    return `Vol 24h: ${formatLargeNumber(volume || 0)}`;
}

// ==================== MESSAGE BUILDING ====================

/**
 * Build a divider line
 */
export function divider(): string {
    return '─'.repeat(20);
}

/**
 * Build a section header
 */
export function sectionHeader(title: string): string {
    return `\n*${title}*\n${divider()}`;
}

/**
 * Build a key-value line
 */
export function kvLine(key: string, value: string): string {
    return `• ${key}: ${value}`;
}

/**
 * Escape special characters for Markdown V1
 */
export function escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Build inline link
 */
export function link(text: string, url: string): string {
    return `[${text}](${url})`;
}

// ==================== VALIDATION ====================

/**
 * Validate Solana address format
 */
export function isValidSolanaAddress(address: string): boolean {
    if (!address) return false;
    // Base58 check: 32-44 characters, no 0, O, I, l
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
}

/**
 * Validate seed phrase
 */
export function isValidSeedPhrase(phrase: string): boolean {
    const words = phrase.trim().split(/\s+/);
    return words.length === 12 || words.length === 24;
}

/**
 * Validate private key (base58)
 */
export function isValidPrivateKey(key: string): boolean {
    // Base58 private keys are typically 87-88 characters
    const trimmed = key.trim();
    if (trimmed.length < 85 || trimmed.length > 90) return false;
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    return base58Regex.test(trimmed);
}
