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
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionService = exports.ConnectionService = void 0;
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var config_manager_1 = require("../config/config.manager");
var ConnectionService = /** @class */ (function () {
    function ConnectionService() {
        this.connection = null;
        var config = config_manager_1.configManager.getConfig();
        this.rpcEndpoint = config.connection.rpcEndpoint;
        this.commitment = config.connection.commitment;
    }
    /**
     * Get or create connection
     */
    ConnectionService.prototype.getConnection = function () {
        if (!this.connection) {
            this.connection = new web3_js_1.Connection(this.rpcEndpoint, {
                commitment: this.commitment,
                confirmTransactionInitialTimeout: 60000,
            });
        }
        return this.connection;
    };
    /**
     * Set RPC endpoint
     */
    ConnectionService.prototype.setRpcEndpoint = function (endpoint) {
        this.rpcEndpoint = endpoint;
        this.connection = null; // Force reconnection
        // Update config
        var config = config_manager_1.configManager.getConfig();
        config_manager_1.configManager.updateConfig({
            connection: __assign(__assign({}, config.connection), { rpcEndpoint: endpoint }),
        });
    };
    /**
     * Set commitment level
     */
    ConnectionService.prototype.setCommitment = function (commitment) {
        this.commitment = commitment;
        this.connection = null; // Force reconnection
        // Update config
        var config = config_manager_1.configManager.getConfig();
        config_manager_1.configManager.updateConfig({
            connection: __assign(__assign({}, config.connection), { commitment: commitment }),
        });
    };
    /**
     * Test connection
     */
    ConnectionService.prototype.testConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var connection, version, blockHeight, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        connection = this.getConnection();
                        return [4 /*yield*/, connection.getVersion()];
                    case 1:
                        version = _a.sent();
                        return [4 /*yield*/, connection.getBlockHeight()];
                    case 2:
                        blockHeight = _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                version: version,
                                blockHeight: blockHeight,
                            }];
                    case 3:
                        error_1 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: error_1 instanceof Error ? error_1.message : 'Unknown error',
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get SOL balance
     */
    ConnectionService.prototype.getBalance = function (publicKey) {
        return __awaiter(this, void 0, void 0, function () {
            var connection, balance;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        connection = this.getConnection();
                        return [4 /*yield*/, connection.getBalance(publicKey)];
                    case 1:
                        balance = _a.sent();
                        return [2 /*return*/, balance / 1e9]; // Convert lamports to SOL
                }
            });
        });
    };
    /**
     * Get token account balance
     */
    ConnectionService.prototype.getTokenBalance = function (tokenAccount) {
        return __awaiter(this, void 0, void 0, function () {
            var connection, balance;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        connection = this.getConnection();
                        return [4 /*yield*/, connection.getTokenAccountBalance(tokenAccount)];
                    case 1:
                        balance = _a.sent();
                        return [2 /*return*/, {
                                amount: balance.value.amount,
                                decimals: balance.value.decimals,
                                uiAmount: balance.value.uiAmount || 0,
                            }];
                }
            });
        });
    };
    /**
     * Get token accounts for owner
     */
    ConnectionService.prototype.getTokenAccountsByOwner = function (owner, mint) {
        return __awaiter(this, void 0, void 0, function () {
            var connection, filters, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        connection = this.getConnection();
                        filters = mint
                            ? { mint: mint }
                            : { programId: new web3_js_1.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') };
                        return [4 /*yield*/, connection.getTokenAccountsByOwner(owner, filters)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.value];
                }
            });
        });
    };
    /**
     * Get or create associated token account
     */
    ConnectionService.prototype.getOrCreateAssociatedTokenAccount = function (owner, mint) {
        return __awaiter(this, void 0, void 0, function () {
            var ata, connection, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, spl_token_1.getAssociatedTokenAddress)(mint, owner)];
                    case 1:
                        ata = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        connection = this.getConnection();
                        return [4 /*yield*/, (0, spl_token_1.getAccount)(connection, ata)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, ata];
                    case 4:
                        error_2 = _a.sent();
                        // Account doesn't exist, need to create it
                        // Note: Actual creation will be handled by the transaction that needs it
                        return [2 /*return*/, ata];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get current RPC endpoint
     */
    ConnectionService.prototype.getRpcEndpoint = function () {
        return this.rpcEndpoint;
    };
    /**
     * Get current commitment level
     */
    ConnectionService.prototype.getCommitment = function () {
        return this.commitment;
    };
    /**
     * Get connection config
     */
    ConnectionService.prototype.getConfig = function () {
        return {
            endpoint: this.rpcEndpoint,
            commitment: this.commitment,
        };
    };
    /**
     * Get recent blockhash
     */
    ConnectionService.prototype.getRecentBlockhash = function () {
        return __awaiter(this, void 0, void 0, function () {
            var connection, _a, blockhash, lastValidBlockHeight;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        connection = this.getConnection();
                        return [4 /*yield*/, connection.getLatestBlockhash()];
                    case 1:
                        _a = _b.sent(), blockhash = _a.blockhash, lastValidBlockHeight = _a.lastValidBlockHeight;
                        return [2 /*return*/, { blockhash: blockhash, lastValidBlockHeight: lastValidBlockHeight }];
                }
            });
        });
    };
    /**
     * Get transaction fee estimate
     */
    ConnectionService.prototype.estimateFee = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var connection, fee;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        connection = this.getConnection();
                        return [4 /*yield*/, connection.getFeeForMessage(message)];
                    case 1:
                        fee = _a.sent();
                        return [2 /*return*/, fee.value || 0];
                }
            });
        });
    };
    return ConnectionService;
}());
exports.ConnectionService = ConnectionService;
// Export singleton instance
exports.connectionService = new ConnectionService();
