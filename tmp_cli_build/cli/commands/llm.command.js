"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmConfigMenu = llmConfigMenu;
var inquirer_1 = require("inquirer");
var chalk_1 = require("chalk");
var config_manager_1 = require("../../config/config.manager");
var llmAgent_service_1 = require("../../services/llmAgent.service");
var LLM_PROVIDERS = [
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
        displayName: '🧠 OpenAI GPT-5.1 Reasoning',
        defaultModel: 'gpt-5.1-thinking',
        description: 'Latest reasoning model, excellent for complex analysis',
        apiKeyEnvVar: 'OPENAI_API_KEY'
    },
    {
        name: 'DeepSeek',
        key: 'deepseek',
        displayName: '💎 DeepSeek R1 Reasoning',
        defaultModel: 'deepseek-reasoner',
        baseURL: 'https://api.deepseek.com',
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
function llmConfigMenu() {
    return __awaiter(this, void 0, void 0, function () {
        var _loop_1, state_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _loop_1 = function () {
                        var config, currentLLM, provider, action, provider;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    console.clear();
                                    console.log(chalk_1.default.cyan.bold('\n🤖 LLM AI SELECTION\n'));
                                    config = config_manager_1.configManager.getConfig();
                                    currentLLM = config.preferences.llm;
                                    if (currentLLM && currentLLM.provider !== 'none') {
                                        provider = LLM_PROVIDERS.find(function (p) { return p.key === currentLLM.provider; });
                                        console.log(chalk_1.default.green('✅ Current Configuration:'));
                                        console.log(chalk_1.default.gray("   Provider: ".concat((provider === null || provider === void 0 ? void 0 : provider.name) || currentLLM.provider)));
                                        console.log(chalk_1.default.gray("   Model: ".concat(currentLLM.model || (provider === null || provider === void 0 ? void 0 : provider.defaultModel))));
                                        console.log(chalk_1.default.gray("   API Key: ".concat(currentLLM.apiKey ? '***************' + currentLLM.apiKey.slice(-4) : 'Not set')));
                                        if (currentLLM.baseURL) {
                                            console.log(chalk_1.default.gray("   Base URL: ".concat(currentLLM.baseURL)));
                                        }
                                    }
                                    else {
                                        console.log(chalk_1.default.yellow('⚠️  No LLM provider configured'));
                                        console.log(chalk_1.default.gray('   LLM-powered decision making is disabled'));
                                    }
                                    console.log(chalk_1.default.gray('\n─────────────────────────────────────────────\n'));
                                    return [4 /*yield*/, inquirer_1.default.prompt({
                                            type: 'list',
                                            name: 'action',
                                            message: 'Select an option:',
                                            choices: __spreadArray(__spreadArray([
                                                new inquirer_1.default.Separator('═══ CONFIGURE PROVIDER ═══')
                                            ], LLM_PROVIDERS.map(function (p) { return p.displayName; }), true), [
                                                new inquirer_1.default.Separator('═══ OPTIONS ═══'),
                                                '🔧 Change Model',
                                                '🧪 Test Connection',
                                                '🔄 Reset Configuration',
                                                '← Back to Main Menu'
                                            ], false),
                                            pageSize: 15
                                        })];
                                case 1:
                                    action = (_b.sent()).action;
                                    if (action === '← Back to Main Menu') {
                                        return [2 /*return*/, "break"];
                                    }
                                    if (!(action === '🔧 Change Model')) return [3 /*break*/, 3];
                                    return [4 /*yield*/, changeModel()];
                                case 2:
                                    _b.sent();
                                    return [3 /*break*/, 9];
                                case 3:
                                    if (!(action === '🧪 Test Connection')) return [3 /*break*/, 5];
                                    return [4 /*yield*/, testConnection()];
                                case 4:
                                    _b.sent();
                                    return [3 /*break*/, 9];
                                case 5:
                                    if (!(action === '🔄 Reset Configuration')) return [3 /*break*/, 7];
                                    return [4 /*yield*/, resetConfiguration()];
                                case 6:
                                    _b.sent();
                                    return [3 /*break*/, 9];
                                case 7:
                                    provider = LLM_PROVIDERS.find(function (p) { return action.includes(p.name); });
                                    if (!provider) return [3 /*break*/, 9];
                                    return [4 /*yield*/, configureProvider(provider)];
                                case 8:
                                    _b.sent();
                                    _b.label = 9;
                                case 9: return [2 /*return*/];
                            }
                        });
                    };
                    _a.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 3];
                    return [5 /*yield**/, _loop_1()];
                case 2:
                    state_1 = _a.sent();
                    if (state_1 === "break")
                        return [3 /*break*/, 3];
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Configure a specific LLM provider
 */
function configureProvider(provider) {
    return __awaiter(this, void 0, void 0, function () {
        var confirm_1, config, currentLLM, isCurrentProvider, currentModel, isStale, action, apiKeyUrls, apiKey, response, error_1, encryptedKey, useDefaultModel, model, customModel, currentConfig, apiKey;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.clear();
                    console.log(chalk_1.default.cyan.bold("\n\uD83E\uDD16 Configure ".concat(provider.name, "\n")));
                    console.log(chalk_1.default.gray(provider.description));
                    console.log('');
                    if (!(provider.key === 'none')) return [3 /*break*/, 4];
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'confirm',
                            name: 'confirm',
                            message: 'Disable LLM agent? This will turn off AI-powered decision making.',
                            default: false
                        })];
                case 1:
                    confirm_1 = (_a.sent()).confirm;
                    if (!confirm_1) return [3 /*break*/, 3];
                    config_manager_1.configManager.updateConfig({
                        preferences: __assign(__assign({}, config_manager_1.configManager.getConfig().preferences), { llm: {
                                provider: 'none',
                                model: '',
                                apiKey: ''
                            } })
                    });
                    llmAgent_service_1.llmAgent.reloadConfig();
                    console.log(chalk_1.default.green('\n✅ LLM agent disabled'));
                    return [4 /*yield*/, pause()];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/];
                case 4:
                    if (!true) return [3 /*break*/, 20];
                    console.clear();
                    console.log(chalk_1.default.cyan.bold("\n\uD83E\uDD16 Configure ".concat(provider.name, "\n")));
                    console.log(chalk_1.default.gray(provider.description));
                    console.log('');
                    config = config_manager_1.configManager.getConfig();
                    currentLLM = config.preferences.llm;
                    isCurrentProvider = (currentLLM === null || currentLLM === void 0 ? void 0 : currentLLM.provider) === provider.key;
                    console.log(chalk_1.default.yellow('📋 Current Settings:'));
                    if (isCurrentProvider && (currentLLM === null || currentLLM === void 0 ? void 0 : currentLLM.apiKey)) {
                        console.log("   API Key: ".concat(chalk_1.default.green('✅ Configured'), " (***************").concat(config_manager_1.configManager.decryptPrivateKey(currentLLM.apiKey).slice(-4), ")"));
                    }
                    else {
                        console.log("   API Key: ".concat(chalk_1.default.red('❌ Not configured')));
                    }
                    currentModel = isCurrentProvider ? ((currentLLM === null || currentLLM === void 0 ? void 0 : currentLLM.model) || provider.defaultModel) : provider.defaultModel;
                    // Fix: If current model is clearly from another provider, reset to default
                    if (isCurrentProvider && currentModel !== provider.defaultModel) {
                        isStale = ((provider.key === 'openai' && currentModel.includes('grok')) ||
                            (provider.key === 'openai' && currentModel.includes('moonshot')) ||
                            (provider.key === 'openai' && currentModel.includes('gemini')));
                        if (isStale) {
                            currentModel = provider.defaultModel;
                            // Auto-fix the config
                            config_manager_1.configManager.updateConfig({
                                preferences: __assign(__assign({}, config.preferences), { llm: __assign(__assign({}, currentLLM), { model: provider.defaultModel }) })
                            });
                            llmAgent_service_1.llmAgent.reloadConfig();
                        }
                    }
                    console.log("   Model:   ".concat(chalk_1.default.white(currentModel)));
                    console.log('');
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'action',
                            message: 'What would you like to configure?',
                            choices: [
                                '🔑 Set/Update API Key',
                                '🔧 Configure Model',
                                new inquirer_1.default.Separator(),
                                '🔙 Back to Provider Selection'
                            ]
                        })];
                case 5:
                    action = (_a.sent()).action;
                    if (action === '🔙 Back to Provider Selection') {
                        return [2 /*return*/];
                    }
                    if (!(action === '🔑 Set/Update API Key')) return [3 /*break*/, 14];
                    // Get API key
                    console.log(chalk_1.default.yellow("\n\uD83D\uDCDD API Key Required\n"));
                    console.log(chalk_1.default.gray("Get your API key from:"));
                    apiKeyUrls = {
                        anthropic: 'https://console.anthropic.com/settings/keys',
                        openai: 'https://platform.openai.com/api-keys',
                        deepseek: 'https://platform.deepseek.com/api_keys',
                        grok: 'https://console.x.ai',
                        kimi: 'https://platform.moonshot.cn/console/api-keys',
                        gemini: 'https://aistudio.google.com/app/apikey'
                    };
                    if (apiKeyUrls[provider.key]) {
                        console.log(chalk_1.default.blue("   ".concat(apiKeyUrls[provider.key])));
                    }
                    console.log('');
                    console.log(chalk_1.default.gray('💡 Tip: Press Ctrl+C to cancel and go back\n'));
                    apiKey = void 0;
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 11]);
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'password',
                            name: 'apiKey',
                            message: 'Enter API Key (or Ctrl+C to cancel):',
                            mask: '*',
                            validate: function (input) {
                                if (!input || input.length < 10) {
                                    return 'API key must be at least 10 characters';
                                }
                                return true;
                            }
                        })];
                case 7:
                    response = _a.sent();
                    apiKey = response.apiKey;
                    return [3 /*break*/, 11];
                case 8:
                    error_1 = _a.sent();
                    if (!(error_1.isTtyError || error_1.name === 'ExitPromptError')) return [3 /*break*/, 10];
                    console.log(chalk_1.default.yellow('\n❌ Cancelled'));
                    return [4 /*yield*/, pause()];
                case 9:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 10: throw error_1;
                case 11:
                    encryptedKey = config_manager_1.configManager.encryptPrivateKey(apiKey);
                    config_manager_1.configManager.updateConfig({
                        preferences: __assign(__assign({}, config_manager_1.configManager.getConfig().preferences), { llm: {
                                provider: provider.key,
                                model: currentModel,
                                apiKey: encryptedKey,
                                baseURL: provider.baseURL
                            } })
                    });
                    // Ensure the running agent immediately picks up the new credentials
                    llmAgent_service_1.llmAgent.reloadConfig();
                    // Auto-test connection after saving key
                    console.log(chalk_1.default.yellow('\n⏳ Testing API connection...'));
                    return [4 /*yield*/, testConnection(true)];
                case 12:
                    _a.sent(); // true = skip pause
                    return [4 /*yield*/, pause()];
                case 13:
                    _a.sent();
                    _a.label = 14;
                case 14:
                    if (!(action === '🔧 Configure Model')) return [3 /*break*/, 19];
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'confirm',
                            name: 'useDefaultModel',
                            message: "Use default model (".concat(provider.defaultModel, ")?"),
                            default: true
                        })];
                case 15:
                    useDefaultModel = (_a.sent()).useDefaultModel;
                    model = provider.defaultModel;
                    if (!!useDefaultModel) return [3 /*break*/, 17];
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'input',
                            name: 'customModel',
                            message: 'Enter model name:',
                            default: provider.defaultModel
                        })];
                case 16:
                    customModel = (_a.sent()).customModel;
                    model = customModel;
                    _a.label = 17;
                case 17:
                    currentConfig = config_manager_1.configManager.getConfig().preferences.llm;
                    apiKey = ((currentConfig === null || currentConfig === void 0 ? void 0 : currentConfig.provider) === provider.key) ? currentConfig.apiKey : undefined;
                    config_manager_1.configManager.updateConfig({
                        preferences: __assign(__assign({}, config_manager_1.configManager.getConfig().preferences), { llm: {
                                provider: provider.key,
                                model: model,
                                apiKey: apiKey,
                                baseURL: provider.baseURL
                            } })
                    });
                    llmAgent_service_1.llmAgent.reloadConfig();
                    console.log(chalk_1.default.green("\n\u2705 Model updated to: ".concat(model)));
                    return [4 /*yield*/, pause()];
                case 18:
                    _a.sent();
                    _a.label = 19;
                case 19: return [3 /*break*/, 4];
                case 20: return [2 /*return*/];
            }
        });
    });
}
/**
 * Change model for current provider
 */
function changeModel() {
    return __awaiter(this, void 0, void 0, function () {
        var config, currentLLM, model;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config = config_manager_1.configManager.getConfig();
                    currentLLM = config.preferences.llm;
                    if (!!currentLLM) return [3 /*break*/, 2];
                    console.log(chalk_1.default.red('\n❌ No LLM provider configured. Please configure a provider first.'));
                    return [4 /*yield*/, pause()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    console.log(chalk_1.default.blue.bold('\n🔧 CONFIGURE MODEL\n'));
                    console.log("Current Provider: ".concat(currentLLM.provider));
                    console.log("Current Model: ".concat(currentLLM.model));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'input',
                            name: 'model',
                            message: 'Enter new model name (or leave empty to cancel):',
                            default: currentLLM.model
                        })];
                case 3:
                    model = (_a.sent()).model;
                    if (!(!model || model.trim().length === 0)) return [3 /*break*/, 5];
                    console.log(chalk_1.default.gray('Operation cancelled.'));
                    return [4 /*yield*/, pause()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
                case 5:
                    config_manager_1.configManager.updateConfig({
                        preferences: __assign(__assign({}, config.preferences), { llm: __assign(__assign({}, currentLLM), { model: model.trim() }) })
                    });
                    llmAgent_service_1.llmAgent.reloadConfig();
                    console.log(chalk_1.default.green("\n\u2705 Model updated to: ".concat(model.trim())));
                    return [4 /*yield*/, pause()];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Test LLM connection
 */
function testConnection() {
    return __awaiter(this, arguments, void 0, function (skipPause) {
        var config, currentLLM, apiKey, success, message, Anthropic, anthropic, response, e_1, OpenAI, openai, e_2, error_2;
        if (skipPause === void 0) { skipPause = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config = config_manager_1.configManager.getConfig();
                    currentLLM = config.preferences.llm;
                    if (!(!currentLLM || currentLLM.provider === 'none' || !currentLLM.apiKey)) return [3 /*break*/, 3];
                    console.log(chalk_1.default.yellow('\n⚠️  Please configure a provider first'));
                    if (!!skipPause) return [3 /*break*/, 2];
                    return [4 /*yield*/, pause()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/];
                case 3:
                    if (!skipPause) {
                        console.clear();
                        console.log(chalk_1.default.cyan.bold('\n🧪 Testing Connection\n'));
                        console.log(chalk_1.default.gray("Provider: ".concat(currentLLM.provider)));
                        console.log(chalk_1.default.gray("Model: ".concat(currentLLM.model)));
                        console.log('');
                        console.log(chalk_1.default.yellow('⏳ Testing API connection...\n'));
                    }
                    apiKey = config_manager_1.configManager.decryptPrivateKey(currentLLM.apiKey);
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 13, , 14]);
                    success = false;
                    message = '';
                    if (!(currentLLM.provider === 'anthropic')) return [3 /*break*/, 9];
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    Anthropic = require('@anthropic-ai/sdk');
                    anthropic = new Anthropic({ apiKey: apiKey });
                    return [4 /*yield*/, anthropic.messages.create({
                            model: currentLLM.model,
                            max_tokens: 10,
                            messages: [{ role: 'user', content: 'Hello' }]
                        })];
                case 6:
                    response = _a.sent();
                    success = true;
                    message = 'Successfully connected to Anthropic!';
                    return [3 /*break*/, 8];
                case 7:
                    e_1 = _a.sent();
                    throw new Error(e_1.message);
                case 8: return [3 /*break*/, 12];
                case 9:
                    _a.trys.push([9, 11, , 12]);
                    OpenAI = require('openai');
                    openai = new OpenAI({
                        apiKey: apiKey,
                        baseURL: currentLLM.baseURL || undefined
                    });
                    return [4 /*yield*/, openai.chat.completions.create({
                            model: currentLLM.model,
                            messages: [{ role: 'user', content: 'Hello' }],
                            max_tokens: 5
                        })];
                case 10:
                    _a.sent();
                    success = true;
                    message = "Successfully connected to ".concat(currentLLM.provider, "!");
                    return [3 /*break*/, 12];
                case 11:
                    e_2 = _a.sent();
                    throw new Error(e_2.message);
                case 12:
                    if (success) {
                        console.log(chalk_1.default.green("\n\u2705 ".concat(message)));
                    }
                    return [3 /*break*/, 14];
                case 13:
                    error_2 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Connection Failed: ".concat(error_2.message)));
                    if (error_2.code === 'MODULE_NOT_FOUND') {
                        console.log(chalk_1.default.yellow('\n⚠️  Missing dependencies. Please run:'));
                        console.log(chalk_1.default.white('npm install @anthropic-ai/sdk openai'));
                    }
                    return [3 /*break*/, 14];
                case 14:
                    if (!!skipPause) return [3 /*break*/, 16];
                    return [4 /*yield*/, pause()];
                case 15:
                    _a.sent();
                    _a.label = 16;
                case 16: return [2 /*return*/];
            }
        });
    });
}
/**
 * Reset LLM configuration
 */
function resetConfiguration() {
    return __awaiter(this, void 0, void 0, function () {
        var confirm;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, inquirer_1.default.prompt({
                        type: 'confirm',
                        name: 'confirm',
                        message: 'Reset all LLM configuration? This will remove your API keys.',
                        default: false
                    })];
                case 1:
                    confirm = (_a.sent()).confirm;
                    if (!confirm) return [3 /*break*/, 3];
                    config_manager_1.configManager.updateConfig({
                        preferences: __assign(__assign({}, config_manager_1.configManager.getConfig().preferences), { llm: {
                                provider: 'none',
                                model: '',
                                apiKey: ''
                            } })
                    });
                    llmAgent_service_1.llmAgent.reloadConfig();
                    console.log(chalk_1.default.green('\n✅ Configuration reset'));
                    return [4 /*yield*/, pause()];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Pause for user to read output
 */
function pause() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, inquirer_1.default.prompt({
                        type: 'input',
                        name: 'continue',
                        message: 'Press Enter to continue...'
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
