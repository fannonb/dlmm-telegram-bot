import inquirer from 'inquirer';
import chalk from 'chalk';
import { configManager } from '../../config/config.manager';
import { llmAgent } from '../../services/llmAgent.service';

export interface LLMProvider {
    name: string;
    key: 'anthropic' | 'openai' | 'deepseek' | 'grok' | 'kimi' | 'gemini' | 'none';
    displayName: string;
    defaultModel: string;
    baseURL?: string;
    description: string;
    apiKeyEnvVar: string;
}

const LLM_PROVIDERS: LLMProvider[] = [
    {
        name: 'Anthropic Claude',
        key: 'anthropic',
        displayName: '🤖 Anthropic Claude (Sonnet 4.5)',
        defaultModel: 'claude-sonnet-4-20250514',
        description: 'Industry-leading reasoning, optimal for complex LP decisions',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY'
    },
    {
        name: 'OpenAI GPT',
        key: 'openai',
        displayName: '🧠 OpenAI GPT-4o-mini',
        defaultModel: 'gpt-4o-mini',
        description: 'Fast & affordable, 10-20x faster than DeepSeek (~2-3s analysis)',
        apiKeyEnvVar: 'OPENAI_API_KEY'
    },
    {
        name: 'DeepSeek',
        key: 'deepseek',
        displayName: '💎 DeepSeek R1 Reasoning',
        defaultModel: 'deepseek-reasoner',
        baseURL: 'https://api.deepseek.com/v1',
        description: 'Cost-effective reasoning model, $0.27/1M tokens',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY'
    },
    {
        name: 'Grok',
        key: 'grok',
        displayName: '🚀 Grok 4.1 Thinking',
        defaultModel: 'grok-4.1-thinking',
        baseURL: 'https://api.x.ai/v1',
        description: '#1 on LMArena, advanced reasoning with 256K context',
        apiKeyEnvVar: 'XAI_API_KEY'
    },
    {
        name: 'Kimi',
        key: 'kimi',
        displayName: '🌙 Kimi K2 Thinking',
        defaultModel: 'kimi-k2-thinking',
        baseURL: 'https://api.moonshot.ai/v1',
        description: 'Latest reasoning model with 256K context',
        apiKeyEnvVar: 'MOONSHOT_API_KEY'
    },
    {
        name: 'Gemini',
        key: 'gemini',
        displayName: '✨ Gemini 3 Pro Preview',
        defaultModel: 'gemini-3-pro-preview',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        description: 'Google\'s most intelligent model, state-of-the-art reasoning',
        apiKeyEnvVar: 'GOOGLE_API_KEY'
    },
    {
        name: 'None (Disable)',
        key: 'none',
        displayName: '❌ Disable LLM Agent',
        defaultModel: '',
        description: 'Turn off AI-powered decision making',
        apiKeyEnvVar: ''
    }
];

/**
 * Main LLM configuration menu
 */
export async function llmConfigMenu(): Promise<void> {
    while (true) {
        console.clear();
        console.log(chalk.cyan.bold('\n🤖 LLM AI SELECTION\n'));

        // Show current configuration
        const config = configManager.getConfig();
        const currentLLM = config.preferences.llm;

        if (currentLLM && currentLLM.provider !== 'none') {
            const provider = LLM_PROVIDERS.find(p => p.key === currentLLM.provider);
            console.log(chalk.green('✅ Current Configuration:'));
            console.log(chalk.gray(`   Provider: ${provider?.name || currentLLM.provider}`));
            console.log(chalk.gray(`   Model: ${currentLLM.model || provider?.defaultModel}`));
            console.log(chalk.gray(`   API Key: ${currentLLM.apiKey ? '***************' + currentLLM.apiKey.slice(-4) : 'Not set'}`));
            if (currentLLM.baseURL) {
                console.log(chalk.gray(`   Base URL: ${currentLLM.baseURL}`));
            }
        } else {
            console.log(chalk.yellow('⚠️  No LLM provider configured'));
            console.log(chalk.gray('   LLM-powered decision making is disabled'));
        }

        console.log(chalk.gray('\n─────────────────────────────────────────────\n'));

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: 'Select an option:',
            choices: [
                new inquirer.Separator('═══ CONFIGURE PROVIDER ═══'),
                ...LLM_PROVIDERS.map(p => p.displayName),
                new inquirer.Separator('═══ OPTIONS ═══'),
                '🔧 Change Model',
                '🧪 Test Connection',
                '🔄 Reset Configuration',
                '← Back to Main Menu'
            ],
            pageSize: 15
        });

        if (action === '← Back to Main Menu') {
            break;
        }

        if (action === '🔧 Change Model') {
            await changeModel();
        } else if (action === '🧪 Test Connection') {
            await testConnection();
        } else if (action === '🔄 Reset Configuration') {
            await resetConfiguration();
        } else {
            // Provider selection
            const provider = LLM_PROVIDERS.find(p => action.includes(p.name));
            if (provider) {
                await configureProvider(provider);
            }
        }
    }
}

/**
 * Configure a specific LLM provider
 */
async function configureProvider(provider: LLMProvider): Promise<void> {
    console.clear();
    console.log(chalk.cyan.bold(`\n🤖 Configure ${provider.name}\n`));
    console.log(chalk.gray(provider.description));
    console.log('');

    if (provider.key === 'none') {
        const { confirm } = await inquirer.prompt({
            type: 'confirm',
            name: 'confirm',
            message: 'Disable LLM agent? This will turn off AI-powered decision making.',
            default: false
        });

        if (confirm) {
            configManager.updateConfig({
                preferences: {
                    ...configManager.getConfig().preferences,
                    llm: {
                        provider: 'none',
                        model: '',
                        apiKey: ''
                    }
                }
            });
            llmAgent.reloadConfig();
            console.log(chalk.green('\n✅ LLM agent disabled'));
            await pause();
        }
        return;
    }

    // Provider configuration loop
    while (true) {
        console.clear();
        console.log(chalk.cyan.bold(`\n🤖 Configure ${provider.name}\n`));
        console.log(chalk.gray(provider.description));
        console.log('');

        // Show current status
        const config = configManager.getConfig();
        const currentLLM = config.preferences.llm;
        const isCurrentProvider = currentLLM?.provider === provider.key;

        console.log(chalk.yellow('📋 Current Settings:'));
        if (isCurrentProvider && currentLLM?.apiKey) {
            console.log(`   API Key: ${chalk.green('✅ Configured')} (***************${configManager.decryptPrivateKey(currentLLM.apiKey).slice(-4)})`);
        } else {
            console.log(`   API Key: ${chalk.red('❌ Not configured')}`);
        }

        // Check for stale configuration (e.g. OpenAI provider with Grok model)
        let currentModel = isCurrentProvider ? (currentLLM?.model || provider.defaultModel) : provider.defaultModel;

        // Fix: If current model is clearly from another provider, reset to default
        if (isCurrentProvider && currentModel !== provider.defaultModel) {
            const isStale = (
                (provider.key === 'openai' && currentModel.includes('grok')) ||
                (provider.key === 'openai' && currentModel.includes('moonshot')) ||
                (provider.key === 'openai' && currentModel.includes('gemini'))
            );

            if (isStale) {
                currentModel = provider.defaultModel;
                // Auto-fix the config
                configManager.updateConfig({
                    preferences: {
                        ...config.preferences,
                        llm: {
                            ...currentLLM!,
                            model: provider.defaultModel
                        }
                    }
                });
                llmAgent.reloadConfig();
            }
        }



        console.log(`   Model:   ${chalk.white(currentModel)}`);
        console.log('');

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: 'What would you like to configure?',
            choices: [
                '🔑 Set/Update API Key',
                '🔧 Configure Model',
                new inquirer.Separator(),
                '🔙 Back to Provider Selection'
            ]
        });

        if (action === '🔙 Back to Provider Selection') {
            return;
        }

        if (action === '🔑 Set/Update API Key') {
            // Get API key
            console.log(chalk.yellow(`\n📝 API Key Required\n`));
            console.log(chalk.gray(`Get your API key from:`));

            const apiKeyUrls: Record<string, string> = {
                anthropic: 'https://console.anthropic.com/settings/keys',
                openai: 'https://platform.openai.com/api-keys',
                deepseek: 'https://platform.deepseek.com/api_keys',
                grok: 'https://console.x.ai',
                kimi: 'https://platform.moonshot.cn/console/api-keys',
                gemini: 'https://aistudio.google.com/app/apikey'
            };

            if (apiKeyUrls[provider.key]) {
                console.log(chalk.blue(`   ${apiKeyUrls[provider.key]}`));
            }
            console.log('');
            console.log(chalk.gray('💡 Tip: Press Ctrl+C to cancel and go back\n'));

            let apiKey: string;
            try {
                const response = await inquirer.prompt({
                    type: 'password',
                    name: 'apiKey',
                    message: 'Enter API Key (or Ctrl+C to cancel):',
                    mask: '*',
                    validate: (input) => {
                        if (!input || input.length < 10) {
                            return 'API key must be at least 10 characters';
                        }
                        return true;
                    }
                });
                apiKey = response.apiKey;
            } catch (error: any) {
                if (error.isTtyError || error.name === 'ExitPromptError') {
                    console.log(chalk.yellow('\n❌ Cancelled'));
                    await pause();
                    continue;
                }
                throw error;
            }

            // Encrypt and save
            const encryptedKey = configManager.encryptPrivateKey(apiKey);

            configManager.updateConfig({
                preferences: {
                    ...configManager.getConfig().preferences,
                    llm: {
                        provider: provider.key,
                        model: currentModel,
                        apiKey: encryptedKey,
                        baseURL: provider.baseURL
                    }
                }
            });

            // Ensure the running agent immediately picks up the new credentials
            llmAgent.reloadConfig();

            // Auto-test connection after saving key
            console.log(chalk.yellow('\n⏳ Testing API connection...'));
            await testConnection(true); // true = skip pause
            await pause();
        }

        if (action === '🔧 Configure Model') {
            const { useDefaultModel } = await inquirer.prompt({
                type: 'confirm',
                name: 'useDefaultModel',
                message: `Use default model (${provider.defaultModel})?`,
                default: true
            });

            let model = provider.defaultModel;
            if (!useDefaultModel) {
                const { customModel } = await inquirer.prompt({
                    type: 'input',
                    name: 'customModel',
                    message: 'Enter model name:',
                    default: provider.defaultModel
                });
                model = customModel;
            }

            // Save model config (preserve API key if exists)
            const currentConfig = configManager.getConfig().preferences.llm;
            const apiKey = (currentConfig?.provider === provider.key) ? currentConfig.apiKey : undefined;

            configManager.updateConfig({
                preferences: {
                    ...configManager.getConfig().preferences,
                    llm: {
                        provider: provider.key,
                        model,
                        apiKey,
                        baseURL: provider.baseURL
                    }
                }
            });
            llmAgent.reloadConfig();

            console.log(chalk.green(`\n✅ Model updated to: ${model}`));
            await pause();
        }
    }
}

/**
 * Change model for current provider
 */
async function changeModel(): Promise<void> {
    const config = configManager.getConfig();
    const currentLLM = config.preferences.llm;

    if (!currentLLM) {
        console.log(chalk.red('\n❌ No LLM provider configured. Please configure a provider first.'));
        await pause();
        return;
    }

    console.log(chalk.blue.bold('\n🔧 CONFIGURE MODEL\n'));
    console.log(`Current Provider: ${currentLLM.provider}`);
    console.log(`Current Model: ${currentLLM.model}`);

    const { model } = await inquirer.prompt({
        type: 'input',
        name: 'model',
        message: 'Enter new model name (or leave empty to cancel):',
        default: currentLLM.model
    });

    if (!model || model.trim().length === 0) {
        console.log(chalk.gray('Operation cancelled.'));
        await pause();
        return;
    }

    configManager.updateConfig({
        preferences: {
            ...config.preferences,
            llm: {
                ...currentLLM,
                model: model.trim()
            }
        }
    });
    llmAgent.reloadConfig();

    console.log(chalk.green(`\n✅ Model updated to: ${model.trim()}`));
    await pause();
}

/**
 * Test LLM connection
 */
async function testConnection(skipPause: boolean = false): Promise<void> {
    const config = configManager.getConfig();
    const currentLLM = config.preferences.llm;

    if (!currentLLM || currentLLM.provider === 'none' || !currentLLM.apiKey) {
        console.log(chalk.yellow('\n⚠️  Please configure a provider first'));
        if (!skipPause) await pause();
        return;
    }

    if (!skipPause) {
        console.clear();
        console.log(chalk.cyan.bold('\n🧪 Testing Connection\n'));
        console.log(chalk.gray(`Provider: ${currentLLM.provider}`));
        console.log(chalk.gray(`Model: ${currentLLM.model}`));
        console.log('');
        console.log(chalk.yellow('⏳ Testing API connection...\n'));
    }

    const apiKey = configManager.decryptPrivateKey(currentLLM.apiKey);

    try {
        let success = false;
        let message = '';

        if (currentLLM.provider === 'anthropic') {
            try {
                const Anthropic = require('@anthropic-ai/sdk');
                const anthropic = new Anthropic({ apiKey });
                const response = await anthropic.messages.create({
                    model: currentLLM.model,
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Hello' }]
                });
                success = true;
                message = 'Successfully connected to Anthropic!';
            } catch (e: any) {
                throw new Error(e.message);
            }
        } else {
            // OpenAI compatible (OpenAI, DeepSeek, Grok, Kimi, Gemini)
            try {
                const OpenAI = require('openai');
                const openai = new OpenAI({
                    apiKey,
                    baseURL: currentLLM.baseURL || undefined
                });

                await openai.chat.completions.create({
                    model: currentLLM.model,
                    messages: [{ role: 'user', content: 'Hello' }],
                    max_tokens: 5
                });
                success = true;
                message = `Successfully connected to ${currentLLM.provider}!`;
            } catch (e: any) {
                throw new Error(e.message);
            }
        }

        if (success) {
            console.log(chalk.green(`\n✅ ${message}`));
        }

    } catch (error: any) {
        console.log(chalk.red(`\n❌ Connection Failed: ${error.message}`));
        if (error.code === 'MODULE_NOT_FOUND') {
            console.log(chalk.yellow('\n⚠️  Missing dependencies. Please run:'));
            console.log(chalk.white('npm install @anthropic-ai/sdk openai'));
        }
    }

    if (!skipPause) await pause();
}

/**
 * Reset LLM configuration
 */
async function resetConfiguration(): Promise<void> {
    const { confirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: 'Reset all LLM configuration? This will remove your API keys.',
        default: false
    });

    if (confirm) {
        configManager.updateConfig({
            preferences: {
                ...configManager.getConfig().preferences,
                llm: {
                    provider: 'none',
                    model: '',
                    apiKey: ''
                }
            }
        });
        llmAgent.reloadConfig();

        console.log(chalk.green('\n✅ Configuration reset'));
        await pause();
    }
}

/**
 * Pause for user to read output
 */
async function pause(): Promise<void> {
    await inquirer.prompt({
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
    });
}

