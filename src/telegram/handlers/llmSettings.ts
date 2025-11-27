/**
 * LLM Settings Handlers for Telegram Bot
 * 
 * Phase 7 Implementation:
 * - LLM Provider selection (Anthropic, OpenAI, DeepSeek, Grok, etc.)
 * - API Key configuration
 * - Model selection
 * - Connection testing
 */

import { BotContext } from '../types';
import { userDataService } from '../services/userDataService';
import { llmSettingsKeyboard, llmProviderKeyboard, llmModelKeyboard } from '../keyboards';
import { configManager } from '../../config/config.manager';
import { llmAgent } from '../../services/llmAgent.service';

// ==================== LLM PROVIDER DEFINITIONS ====================

export interface LLMProvider {
    name: string;
    key: 'anthropic' | 'openai' | 'deepseek' | 'grok' | 'kimi' | 'gemini' | 'none';
    emoji: string;
    defaultModel: string;
    baseURL?: string;
    description: string;
}

export const LLM_PROVIDERS: LLMProvider[] = [
    {
        name: 'Anthropic Claude',
        key: 'anthropic',
        emoji: '🤖',
        defaultModel: 'claude-sonnet-4-20250514',
        description: 'Industry-leading reasoning, optimal for LP decisions'
    },
    {
        name: 'OpenAI GPT',
        key: 'openai',
        emoji: '🧠',
        defaultModel: 'gpt-4o-mini',
        description: 'Fast & affordable (~2-3s analysis)'
    },
    {
        name: 'DeepSeek',
        key: 'deepseek',
        emoji: '💎',
        defaultModel: 'deepseek-reasoner',
        baseURL: 'https://api.deepseek.com/v1',
        description: 'Cost-effective reasoning, $0.27/1M tokens'
    },
    {
        name: 'Grok',
        key: 'grok',
        emoji: '🚀',
        defaultModel: 'grok-4.1-thinking',
        baseURL: 'https://api.x.ai/v1',
        description: 'Advanced reasoning with 256K context'
    },
    {
        name: 'Kimi',
        key: 'kimi',
        emoji: '🌙',
        defaultModel: 'kimi-k2-thinking',
        baseURL: 'https://api.moonshot.ai/v1',
        description: 'Latest reasoning model with 256K context'
    },
    {
        name: 'Gemini',
        key: 'gemini',
        emoji: '✨',
        defaultModel: 'gemini-3-pro-preview',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        description: 'Google\'s most intelligent model'
    }
];

// ==================== MAIN LLM SETTINGS MENU ====================

/**
 * Show LLM settings menu
 */
export async function handleLLMSettings(ctx: BotContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        // Get current LLM configuration
        const config = configManager.getConfig();
        const currentLLM = config.preferences?.llm;

        let statusSection: string;

        if (currentLLM && currentLLM.provider !== 'none' && currentLLM.apiKey) {
            const provider = LLM_PROVIDERS.find(p => p.key === currentLLM.provider);
            const maskedKey = '•••••••••' + (configManager.decryptPrivateKey(currentLLM.apiKey)?.slice(-4) || '????');
            
            statusSection = `✅ **Status: Configured**

${provider?.emoji || '🤖'} **Provider:** ${provider?.name || currentLLM.provider}
🔧 **Model:** ${currentLLM.model || provider?.defaultModel || 'default'}
🔑 **API Key:** ${maskedKey}`;
        } else {
            statusSection = `⚠️ **Status: Not Configured**

LLM-powered analysis is disabled.
Configure a provider to enable AI recommendations.`;
        }

        const message = `🤖 **LLM AI Configuration**

${statusSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Available Providers:**
🤖 Anthropic Claude - Best reasoning
🧠 OpenAI GPT - Fast & reliable
💎 DeepSeek - Cost-effective
🚀 Grok - Advanced context
🌙 Kimi - Latest models
✨ Gemini - Google AI

Select an option below to configure:`;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: llmSettingsKeyboard(currentLLM?.provider || 'none')
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleLLMSettings:', error);
        await ctx.answerCbQuery('❌ Error loading LLM settings');
    }
}

// ==================== PROVIDER SELECTION ====================

/**
 * Handle provider selection
 */
export async function handleLLMProviderSelect(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const providerKey = callbackData.replace('llm_set_', '');

        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCbQuery('❌ User not found');
            return;
        }

        const provider = LLM_PROVIDERS.find(p => p.key === providerKey);
        if (!provider) {
            await ctx.answerCbQuery('❌ Invalid provider');
            return;
        }

        // Check if API key is already configured for this provider
        const config = configManager.getConfig();
        const currentLLM = config.preferences?.llm;
        const hasApiKey = currentLLM?.provider === provider.key && currentLLM?.apiKey;

        const apiKeyUrls: Record<string, string> = {
            anthropic: 'console.anthropic.com/settings/keys',
            openai: 'platform.openai.com/api-keys',
            deepseek: 'platform.deepseek.com/api_keys',
            grok: 'console.x.ai',
            kimi: 'platform.moonshot.cn/console/api-keys',
            gemini: 'aistudio.google.com/app/apikey'
        };

        const message = `${provider.emoji} **Configure ${provider.name}**

${provider.description}

**Default Model:** \`${provider.defaultModel}\`

${hasApiKey ? '✅ API Key: Configured' : '❌ API Key: Not set'}

${hasApiKey ? '' : `**Get API Key:**
🔗 ${apiKeyUrls[provider.key] || 'Provider website'}
`}
To set your API key, reply to this message with your key.
The message will be automatically deleted for security.`;

        // Store the provider selection in session for API key input
        ctx.session.currentFlow = 'llm_apikey_input';
        ctx.session.flowData = {
            provider: provider.key,
            model: provider.defaultModel,
            baseURL: provider.baseURL
        };

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: llmModelKeyboard(provider.key, !!hasApiKey)
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleLLMProviderSelect:', error);
        await ctx.answerCbQuery('❌ Error selecting provider');
    }
}

/**
 * Process API key input from text message
 */
export async function processLLMApiKey(ctx: BotContext, apiKey: string): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.reply('❌ User not found');
            return;
        }

        const flowData = ctx.session.flowData;
        if (!flowData?.provider) {
            await ctx.reply('❌ Session expired. Please start again from Settings → LLM Configuration.');
            ctx.session.currentFlow = 'idle';
            return;
        }

        // Delete the message containing the API key for security
        try {
            await ctx.deleteMessage();
        } catch (e) {
            // May fail if message is too old
        }

        // Validate API key length
        if (apiKey.length < 10) {
            await ctx.reply('❌ Invalid API key. Please enter a valid key.');
            return;
        }

        // Encrypt and save
        const encryptedKey = configManager.encryptPrivateKey(apiKey);
        const provider = LLM_PROVIDERS.find(p => p.key === flowData.provider);

        configManager.updateConfig({
            preferences: {
                ...configManager.getConfig().preferences,
                llm: {
                    provider: flowData.provider as 'anthropic' | 'openai' | 'deepseek' | 'grok' | 'kimi' | 'gemini' | 'none',
                    model: flowData.model || provider?.defaultModel || '',
                    apiKey: encryptedKey,
                    baseURL: flowData.baseURL
                }
            }
        });

        // Reload LLM agent config
        llmAgent.reloadConfig();

        // Clear flow
        ctx.session.currentFlow = 'idle';
        ctx.session.flowData = undefined;

        // Test connection
        await ctx.reply('⏳ Testing API connection...');
        
        const testResult = await testLLMConnection(flowData.provider, apiKey, flowData.model, flowData.baseURL);
        
        if (testResult.success) {
            await ctx.reply(`✅ **${provider?.name} Configured Successfully!**\n\n${testResult.message}\n\nYou can now use AI-powered position analysis.`, {
                parse_mode: 'Markdown'
            });
        } else {
            await ctx.reply(`⚠️ **Configuration Saved**\n\nAPI key stored but connection test failed:\n${testResult.message}\n\nPlease verify your API key.`, {
                parse_mode: 'Markdown'
            });
        }
    } catch (error: any) {
        console.error('Error processing API key:', error);
        await ctx.reply(`❌ Error: ${error.message}`);
        ctx.session.currentFlow = 'idle';
    }
}

// ==================== MODEL SELECTION ====================

/**
 * Handle model selection menu
 */
export async function handleLLMModelSelect(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const providerKey = callbackData.replace('llm_model_', '');

        const provider = LLM_PROVIDERS.find(p => p.key === providerKey);
        if (!provider) {
            await ctx.answerCbQuery('❌ Invalid provider');
            return;
        }

        const config = configManager.getConfig();
        const currentModel = config.preferences?.llm?.model || provider.defaultModel;

        const message = `🔧 **Model Selection**

**Provider:** ${provider.name}
**Current Model:** \`${currentModel}\`
**Default:** \`${provider.defaultModel}\`

To use a custom model, reply with the model name.
Or select "Use Default" below.`;

        ctx.session.currentFlow = 'llm_model_custom';
        ctx.session.flowData = {
            provider: provider.key,
            baseURL: provider.baseURL
        };

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Use Default Model', callback_data: `llm_model_default_${provider.key}` }],
                    [{ text: '⬅️ Back', callback_data: 'settings_llm' }]
                ]
            }
        });
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleLLMModelSelect:', error);
        await ctx.answerCbQuery('❌ Error');
    }
}

/**
 * Set default model for provider
 */
export async function handleLLMModelDefault(ctx: BotContext): Promise<void> {
    try {
        const callbackData = (ctx.callbackQuery as any)?.data || '';
        const providerKey = callbackData.replace('llm_model_default_', '');

        const provider = LLM_PROVIDERS.find(p => p.key === providerKey);
        if (!provider) {
            await ctx.answerCbQuery('❌ Invalid provider');
            return;
        }

        const config = configManager.getConfig();
        const currentLLM = config.preferences?.llm;

        if (!currentLLM?.apiKey) {
            await ctx.answerCbQuery('❌ Please set API key first');
            return;
        }

        configManager.updateConfig({
            preferences: {
                ...config.preferences,
                llm: {
                    ...currentLLM,
                    model: provider.defaultModel
                }
            }
        });

        llmAgent.reloadConfig();

        await ctx.answerCbQuery(`✅ Model set to ${provider.defaultModel}`);
        
        // Go back to LLM settings
        await handleLLMSettings(ctx);
    } catch (error) {
        console.error('Error in handleLLMModelDefault:', error);
        await ctx.answerCbQuery('❌ Error setting model');
    }
}

/**
 * Process custom model input
 */
export async function processLLMCustomModel(ctx: BotContext, modelName: string): Promise<void> {
    try {
        const flowData = ctx.session.flowData;
        if (!flowData?.provider) {
            await ctx.reply('❌ Session expired. Please try again.');
            ctx.session.currentFlow = 'idle';
            return;
        }

        const config = configManager.getConfig();
        const currentLLM = config.preferences?.llm;

        if (!currentLLM?.apiKey) {
            await ctx.reply('❌ Please set API key first.');
            ctx.session.currentFlow = 'idle';
            return;
        }

        configManager.updateConfig({
            preferences: {
                ...config.preferences,
                llm: {
                    ...currentLLM,
                    model: modelName.trim()
                }
            }
        });

        llmAgent.reloadConfig();

        ctx.session.currentFlow = 'idle';
        ctx.session.flowData = undefined;

        await ctx.reply(`✅ Model updated to: \`${modelName.trim()}\``, {
            parse_mode: 'Markdown'
        });
    } catch (error: any) {
        console.error('Error processing custom model:', error);
        await ctx.reply(`❌ Error: ${error.message}`);
        ctx.session.currentFlow = 'idle';
    }
}

// ==================== DISABLE LLM ====================

/**
 * Disable LLM agent
 */
export async function handleLLMDisable(ctx: BotContext): Promise<void> {
    try {
        const config = configManager.getConfig();

        configManager.updateConfig({
            preferences: {
                ...config.preferences,
                llm: {
                    provider: 'none',
                    model: '',
                    apiKey: ''
                }
            }
        });

        llmAgent.reloadConfig();

        await ctx.answerCbQuery('🔴 LLM agent disabled');
        await handleLLMSettings(ctx);
    } catch (error) {
        console.error('Error disabling LLM:', error);
        await ctx.answerCbQuery('❌ Error disabling LLM');
    }
}

// ==================== TEST CONNECTION ====================

/**
 * Handle test connection button
 */
export async function handleLLMTestConnection(ctx: BotContext): Promise<void> {
    try {
        const config = configManager.getConfig();
        const currentLLM = config.preferences?.llm;

        if (!currentLLM || currentLLM.provider === 'none' || !currentLLM.apiKey) {
            await ctx.answerCbQuery('⚠️ No LLM configured');
            return;
        }

        await ctx.answerCbQuery('🔄 Testing connection...');

        const apiKey = configManager.decryptPrivateKey(currentLLM.apiKey);
        const result = await testLLMConnection(
            currentLLM.provider,
            apiKey,
            currentLLM.model,
            currentLLM.baseURL
        );

        const provider = LLM_PROVIDERS.find(p => p.key === currentLLM.provider);

        if (result.success) {
            await ctx.editMessageText(
                `🧪 **Connection Test**\n\n✅ **Success!**\n\n${provider?.emoji || '🤖'} ${provider?.name || currentLLM.provider}\n🔧 Model: ${currentLLM.model}\n\n${result.message}`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: llmSettingsKeyboard(currentLLM.provider)
                }
            );
        } else {
            await ctx.editMessageText(
                `🧪 **Connection Test**\n\n❌ **Failed**\n\n${result.message}\n\nPlease check your API key and try again.`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: llmSettingsKeyboard(currentLLM.provider)
                }
            );
        }
    } catch (error: any) {
        console.error('Error testing connection:', error);
        await ctx.answerCbQuery('❌ Test failed');
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Test LLM API connection
 */
async function testLLMConnection(
    provider: string,
    apiKey: string,
    model?: string,
    baseURL?: string
): Promise<{ success: boolean; message: string }> {
    try {
        if (provider === 'anthropic') {
            const Anthropic = require('@anthropic-ai/sdk');
            const anthropic = new Anthropic({ apiKey });
            await anthropic.messages.create({
                model: model || 'claude-sonnet-4-20250514',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hello' }]
            });
            return { success: true, message: 'Successfully connected to Anthropic!' };
        } else {
            // OpenAI compatible (OpenAI, DeepSeek, Grok, Kimi, Gemini)
            const OpenAI = require('openai');
            const openai = new OpenAI({
                apiKey,
                baseURL: baseURL || undefined
            });

            await openai.chat.completions.create({
                model: model || 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 5
            });
            return { success: true, message: `Successfully connected to ${provider}!` };
        }
    } catch (error: any) {
        return { success: false, message: error.message || 'Unknown error' };
    }
}
