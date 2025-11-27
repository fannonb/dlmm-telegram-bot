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
exports.calculateRentExemptMinimum = calculateRentExemptMinimum;
exports.getWalletBalances = getWalletBalances;
exports.validateWalletBalance = validateWalletBalance;
var spl_token_1 = require("@solana/spl-token");
/**
 * Calculate rent-exempt minimum for an account
 * Solana rent formula: (128 + data_size) * 6960 lamports/byte
 * Source: https://solana.com/docs/core/fees#rent
 */
function calculateRentExemptMinimum(accountSizeBytes) {
    var LAMPORTS_PER_SOL = 1000000000;
    var LAMPORTS_PER_BYTE_YEAR = 3480; // Base rate
    var YEARS_FOR_EXEMPTION = 2; // Need 2 years worth
    var ACCOUNT_OVERHEAD = 128; // Every account has 128 byte overhead
    var totalBytes = accountSizeBytes + ACCOUNT_OVERHEAD;
    var lamports = totalBytes * LAMPORTS_PER_BYTE_YEAR * YEARS_FOR_EXEMPTION;
    return lamports / LAMPORTS_PER_SOL;
}
/**
 * Get wallet balances for SOL and two specific tokens
 */
function getWalletBalances(connection, walletPublicKey, tokenXMint, tokenYMint) {
    return __awaiter(this, void 0, void 0, function () {
        var solBalance, solAmount, SOL_MINT, tokenXBalance, tokenXAta, tokenXAccount, mintInfo, decimals, error_1, tokenYBalance, tokenYAta, tokenYAccount, mintInfo, decimals, error_2, error_3;
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    _j.trys.push([0, 14, , 15]);
                    return [4 /*yield*/, connection.getBalance(walletPublicKey)];
                case 1:
                    solBalance = _j.sent();
                    solAmount = solBalance / 1e9;
                    SOL_MINT = 'So11111111111111111111111111111111111111112';
                    tokenXBalance = 0;
                    if (!(tokenXMint.toBase58() === SOL_MINT)) return [3 /*break*/, 2];
                    tokenXBalance = solAmount;
                    return [3 /*break*/, 7];
                case 2:
                    _j.trys.push([2, 6, , 7]);
                    return [4 /*yield*/, (0, spl_token_1.getAssociatedTokenAddress)(tokenXMint, walletPublicKey)];
                case 3:
                    tokenXAta = _j.sent();
                    return [4 /*yield*/, (0, spl_token_1.getAccount)(connection, tokenXAta)];
                case 4:
                    tokenXAccount = _j.sent();
                    return [4 /*yield*/, connection.getParsedAccountInfo(tokenXMint)];
                case 5:
                    mintInfo = _j.sent();
                    decimals = ((_d = (_c = (_b = (_a = mintInfo.value) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.parsed) === null || _c === void 0 ? void 0 : _c.info) === null || _d === void 0 ? void 0 : _d.decimals) || 6;
                    tokenXBalance = Number(tokenXAccount.amount) / Math.pow(10, decimals);
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _j.sent();
                    if (error_1 instanceof spl_token_1.TokenAccountNotFoundError) {
                        tokenXBalance = 0;
                    }
                    else {
                        throw error_1;
                    }
                    return [3 /*break*/, 7];
                case 7:
                    tokenYBalance = 0;
                    if (!(tokenYMint.toBase58() === SOL_MINT)) return [3 /*break*/, 8];
                    tokenYBalance = solAmount;
                    return [3 /*break*/, 13];
                case 8:
                    _j.trys.push([8, 12, , 13]);
                    return [4 /*yield*/, (0, spl_token_1.getAssociatedTokenAddress)(tokenYMint, walletPublicKey)];
                case 9:
                    tokenYAta = _j.sent();
                    return [4 /*yield*/, (0, spl_token_1.getAccount)(connection, tokenYAta)];
                case 10:
                    tokenYAccount = _j.sent();
                    return [4 /*yield*/, connection.getParsedAccountInfo(tokenYMint)];
                case 11:
                    mintInfo = _j.sent();
                    decimals = ((_h = (_g = (_f = (_e = mintInfo.value) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.parsed) === null || _g === void 0 ? void 0 : _g.info) === null || _h === void 0 ? void 0 : _h.decimals) || 6;
                    tokenYBalance = Number(tokenYAccount.amount) / Math.pow(10, decimals);
                    return [3 /*break*/, 13];
                case 12:
                    error_2 = _j.sent();
                    if (error_2 instanceof spl_token_1.TokenAccountNotFoundError) {
                        tokenYBalance = 0;
                    }
                    else {
                        throw error_2;
                    }
                    return [3 /*break*/, 13];
                case 13: return [2 /*return*/, {
                        solBalance: solAmount,
                        tokenXBalance: tokenXBalance,
                        tokenYBalance: tokenYBalance,
                    }];
                case 14:
                    error_3 = _j.sent();
                    console.error('Error fetching wallet balances:', error_3);
                    throw new Error("Failed to fetch wallet balances: ".concat(error_3));
                case 15: return [2 /*return*/];
            }
        });
    });
}
/**
 * Validate wallet has sufficient balance for position creation
 * Uses proper rent calculation based on DLMM position account size (~680 bytes)
 */
function validateWalletBalance(connection, walletPublicKey, tokenXMint, tokenYMint, requiredTokenX, requiredTokenY) {
    return __awaiter(this, void 0, void 0, function () {
        var balances, errors, warnings, DLMM_POSITION_ACCOUNT_SIZE, rentExemptMinimum, transactionFees, safetyBuffer, positionCreationOverhead, solMint, tokenXIsSol, tokenYIsSol, solForLiquidity, totalSolRequired, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getWalletBalances(connection, walletPublicKey, tokenXMint, tokenYMint)];
                case 1:
                    balances = _a.sent();
                    errors = [];
                    warnings = [];
                    DLMM_POSITION_ACCOUNT_SIZE = 680;
                    rentExemptMinimum = calculateRentExemptMinimum(DLMM_POSITION_ACCOUNT_SIZE);
                    transactionFees = 0.00015;
                    safetyBuffer = 0.001;
                    positionCreationOverhead = rentExemptMinimum + transactionFees + safetyBuffer;
                    solMint = 'So11111111111111111111111111111111111111112';
                    tokenXIsSol = tokenXMint.toBase58() === solMint;
                    tokenYIsSol = tokenYMint.toBase58() === solMint;
                    solForLiquidity = (tokenXIsSol ? requiredTokenX : 0) + (tokenYIsSol ? requiredTokenY : 0);
                    totalSolRequired = solForLiquidity + positionCreationOverhead;
                    if (balances.solBalance < totalSolRequired) {
                        errors.push("Insufficient SOL: have ".concat(balances.solBalance.toFixed(4), ", need ").concat(totalSolRequired.toFixed(4), " (").concat(solForLiquidity.toFixed(4), " for liquidity + ").concat(positionCreationOverhead.toFixed(4), " for rent/fees)"));
                    }
                    // Token X validation
                    if (!tokenXIsSol && balances.tokenXBalance < requiredTokenX) {
                        errors.push("Insufficient Token X: have ".concat(balances.tokenXBalance.toFixed(4), ", need ").concat(requiredTokenX.toFixed(4)));
                    }
                    // Token Y validation
                    if (!tokenYIsSol && balances.tokenYBalance < requiredTokenY) {
                        errors.push("Insufficient Token Y: have ".concat(balances.tokenYBalance.toFixed(4), ", need ").concat(requiredTokenY.toFixed(4)));
                    }
                    // Warnings for small amounts
                    if (requiredTokenX < 0.01 || requiredTokenY < 0.01) {
                        warnings.push('⚠️  Position size is very small (<0.01). Consider increasing for better price discovery.');
                    }
                    if (balances.solBalance < 0.05 && balances.solBalance >= positionCreationOverhead) {
                        warnings.push("\u26A0\uFE0F  SOL balance is low (".concat(balances.solBalance.toFixed(4), "). Consider adding more SOL for future transactions."));
                    }
                    return [2 /*return*/, {
                            isValid: errors.length === 0,
                            errors: errors,
                            warnings: warnings,
                        }];
                case 2:
                    error_4 = _a.sent();
                    console.error('Error validating wallet balance:', error_4);
                    return [2 /*return*/, {
                            isValid: false,
                            errors: ["Error validating balance: ".concat(error_4)],
                            warnings: [],
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
