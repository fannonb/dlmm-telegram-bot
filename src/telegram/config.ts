import dotenv from 'dotenv';
dotenv.config();

export const BOT_CONFIG = {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    // Session settings
    sessionTTL: 24 * 60 * 60, // 24 hours
    // Rate limiting
    maxCommandsPerMinute: 10,
};

// Validate configuration
if (!BOT_CONFIG.token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .env file');
    process.exit(1);
}
