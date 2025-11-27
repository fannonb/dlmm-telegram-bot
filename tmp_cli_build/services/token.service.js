"use strict";
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
exports.tokenService = exports.TokenService = void 0;
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var wallet_service_1 = require("./wallet.service");
var connection_service_1 = require("./connection.service");
var transaction_service_1 = require("./transaction.service");
var TokenService = /** @class */ (function () {
    function TokenService() {
    }
    TokenService.prototype.transferSol = function (destination, amountSol, priorityFeeOptions) {
        return __awaiter(this, void 0, void 0, function () {
            var keypair, destinationPubkey, lamports, tx, connection;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (amountSol <= 0) {
                            throw new Error('Amount must be greater than zero');
                        }
                        keypair = wallet_service_1.walletService.getActiveKeypair();
                        if (!keypair) {
                            throw new Error('No active wallet found');
                        }
                        destinationPubkey = new web3_js_1.PublicKey(destination);
                        lamports = Math.round(amountSol * web3_js_1.LAMPORTS_PER_SOL);
                        if (lamports <= 0) {
                            throw new Error('Amount is too small to transfer');
                        }
                        tx = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
                            fromPubkey: keypair.publicKey,
                            toPubkey: destinationPubkey,
                            lamports: lamports,
                        }));
                        return [4 /*yield*/, transaction_service_1.transactionService.applyPriorityFee(tx, priorityFeeOptions)];
                    case 1:
                        _a.sent();
                        connection = connection_service_1.connectionService.getConnection();
                        return [2 /*return*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [keypair], {
                                commitment: 'confirmed',
                            })];
                }
            });
        });
    };
    TokenService.prototype.transferSplToken = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var keypair, connection, mint, destination, decimals, _a, multiplier, rawAmount, sourceAta, destinationAta, tx, destinationAccount;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (options.amount <= 0) {
                            throw new Error('Amount must be greater than zero');
                        }
                        keypair = wallet_service_1.walletService.getActiveKeypair();
                        if (!keypair) {
                            throw new Error('No active wallet found');
                        }
                        connection = connection_service_1.connectionService.getConnection();
                        mint = new web3_js_1.PublicKey(options.mint);
                        destination = new web3_js_1.PublicKey(options.destination);
                        if (!(typeof options.decimals === 'number')) return [3 /*break*/, 1];
                        _a = options.decimals;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, (0, spl_token_1.getMint)(connection, mint)];
                    case 2:
                        _a = (_b.sent()).decimals;
                        _b.label = 3;
                    case 3:
                        decimals = _a;
                        multiplier = Math.pow(10, decimals);
                        rawAmount = BigInt(Math.round(options.amount * multiplier));
                        if (rawAmount <= 0n) {
                            throw new Error('Amount is too small to transfer');
                        }
                        return [4 /*yield*/, (0, spl_token_1.getAssociatedTokenAddress)(mint, keypair.publicKey)];
                    case 4:
                        sourceAta = _b.sent();
                        return [4 /*yield*/, (0, spl_token_1.getAssociatedTokenAddress)(mint, destination)];
                    case 5:
                        destinationAta = _b.sent();
                        tx = new web3_js_1.Transaction();
                        return [4 /*yield*/, connection.getAccountInfo(destinationAta)];
                    case 6:
                        destinationAccount = _b.sent();
                        if (!destinationAccount) {
                            tx.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(keypair.publicKey, destinationAta, destination, mint));
                        }
                        tx.add((0, spl_token_1.createTransferInstruction)(sourceAta, destinationAta, keypair.publicKey, rawAmount));
                        return [4 /*yield*/, transaction_service_1.transactionService.applyPriorityFee(tx, options.priorityFeeOptions)];
                    case 7:
                        _b.sent();
                        return [2 /*return*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [keypair], {
                                commitment: 'confirmed',
                            })];
                }
            });
        });
    };
    return TokenService;
}());
exports.TokenService = TokenService;
exports.tokenService = new TokenService();
