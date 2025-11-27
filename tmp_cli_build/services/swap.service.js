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
exports.swapService = exports.SwapService = void 0;
var web3_js_1 = require("@solana/web3.js");
var anchor_1 = require("@coral-xyz/anchor");
var wallet_service_1 = require("./wallet.service");
var pool_service_1 = require("./pool.service");
var connection_service_1 = require("./connection.service");
var SwapService = /** @class */ (function () {
    function SwapService() {
    }
    /**
     * Get a swap quote
     */
    SwapService.prototype.getSwapQuote = function (poolAddress, amountIn, swapForY, slippagePercent) {
        return __awaiter(this, void 0, void 0, function () {
            var dlmm, binArrays, allowedSlippage, quote, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolAddress)];
                    case 1:
                        dlmm = _a.sent();
                        return [4 /*yield*/, dlmm.getBinArrayForSwap(swapForY)];
                    case 2:
                        binArrays = _a.sent();
                        allowedSlippage = new anchor_1.BN(slippagePercent * 100);
                        quote = dlmm.swapQuote(amountIn, swapForY, allowedSlippage, binArrays);
                        return [2 /*return*/, {
                                inAmount: amountIn,
                                outAmount: quote.outAmount,
                                fee: quote.fee,
                                priceImpact: Number(quote.priceImpact),
                                minOutAmount: quote.minOutAmount,
                                binArraysPubkey: quote.binArraysPubkey.map(function (pk) { return new web3_js_1.PublicKey(pk); }), // Ensure PublicKey type
                                swapForY: swapForY
                            }];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Error getting swap quote:', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute a swap based on a quote
     */
    SwapService.prototype.executeSwap = function (poolAddress, quote) {
        return __awaiter(this, void 0, void 0, function () {
            var keypair, dlmm, tx, connection, signature, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        keypair = wallet_service_1.walletService.getActiveKeypair();
                        if (!keypair)
                            throw new Error('No active wallet found');
                        return [4 /*yield*/, pool_service_1.poolService.getDlmmInstance(poolAddress)];
                    case 1:
                        dlmm = _a.sent();
                        return [4 /*yield*/, dlmm.swap({
                                inToken: quote.swapForY ? dlmm.tokenX.publicKey : dlmm.tokenY.publicKey,
                                outToken: quote.swapForY ? dlmm.tokenY.publicKey : dlmm.tokenX.publicKey,
                                inAmount: quote.inAmount,
                                minOutAmount: quote.minOutAmount,
                                lbPair: new web3_js_1.PublicKey(poolAddress),
                                user: keypair.publicKey,
                                binArraysPubkey: quote.binArraysPubkey
                            })];
                    case 2:
                        tx = _a.sent();
                        connection = connection_service_1.connectionService.getConnection();
                        return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [keypair], { commitment: 'confirmed' })];
                    case 3:
                        signature = _a.sent();
                        return [2 /*return*/, signature];
                    case 4:
                        error_2 = _a.sent();
                        console.error('Error executing swap:', error_2);
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return SwapService;
}());
exports.SwapService = SwapService;
exports.swapService = new SwapService();
