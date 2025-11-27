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
exports.swapMenu = swapMenu;
var inquirer_1 = require("inquirer");
var chalk_1 = require("chalk");
var anchor_1 = require("@coral-xyz/anchor");
var pool_service_1 = require("../../services/pool.service");
var swap_service_1 = require("../../services/swap.service");
// Helper for wait
function waitForUser() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, inquirer_1.default.prompt([{
                            type: 'input',
                            name: 'continue',
                            message: 'Press ENTER to continue...',
                        }])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function displayHeader() {
    // console.clear();
    // console.log(chalk.blue.bold('💱 SWAP TOKENS\n'));
}
function swapMenu() {
    return __awaiter(this, void 0, void 0, function () {
        var tokenAnswers, inputToken, outputToken, pools, selectedPool, poolChoices, poolAnswer, swapForY, matchToken, dirAnswer, sourceToken, destToken, amountAnswer, amountIn, decimals, amountInBN, quote, outDecimals, outAmount, minOut, confirm_1, signature, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    displayHeader();
                    console.log(chalk_1.default.blue.bold('💱 SWAP TOKENS\n'));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 21, , 22]);
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'input',
                                name: 'inputToken',
                                message: 'Enter input token symbol or mint (e.g. SOL) (or leave empty to cancel):',
                                default: 'SOL'
                            },
                            {
                                type: 'input',
                                name: 'outputToken',
                                message: 'Enter output token symbol or mint (e.g. USDC):',
                                default: 'USDC',
                                when: function (answers) { return answers.inputToken && answers.inputToken.trim().length > 0; }
                            }
                        ])];
                case 2:
                    tokenAnswers = _a.sent();
                    if (!(!tokenAnswers.inputToken || tokenAnswers.inputToken.trim().length === 0)) return [3 /*break*/, 4];
                    console.log(chalk_1.default.gray('Swap cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
                case 4:
                    inputToken = tokenAnswers.inputToken.trim();
                    outputToken = tokenAnswers.outputToken.trim();
                    // Step 2: Find Pool
                    console.log(chalk_1.default.yellow("\nSearching for pools pairing ".concat(inputToken, " and ").concat(outputToken, "...")));
                    return [4 /*yield*/, pool_service_1.poolService.getPoolsByTokenPair(inputToken, outputToken)];
                case 5:
                    pools = _a.sent();
                    if (!(pools.length === 0)) return [3 /*break*/, 7];
                    console.log(chalk_1.default.red("\n\u274C No pools found for pair ".concat(inputToken, "-").concat(outputToken, ".")));
                    return [4 /*yield*/, waitForUser()];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
                case 7:
                    selectedPool = pools[0];
                    if (!(pools.length > 1)) return [3 /*break*/, 9];
                    poolChoices = pools.map(function (p, idx) {
                        var _a;
                        return ({
                            name: "".concat(idx + 1, ". ").concat(p.address.slice(0, 8), "... (TVL: $").concat(((_a = p.tvl) === null || _a === void 0 ? void 0 : _a.toLocaleString()) || '0', ")"),
                            value: p
                        });
                    });
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'pool',
                            message: 'Select a pool for the swap:',
                            choices: poolChoices
                        })];
                case 8:
                    poolAnswer = _a.sent();
                    selectedPool = poolAnswer.pool;
                    return [3 /*break*/, 10];
                case 9:
                    console.log(chalk_1.default.green("\u2705 Found pool: ".concat(selectedPool.address)));
                    _a.label = 10;
                case 10:
                    swapForY = true;
                    matchToken = function (token, input) {
                        return token.symbol.toUpperCase() === input.toUpperCase() ||
                            token.mint === input;
                    };
                    if (!matchToken(selectedPool.tokenX, inputToken)) return [3 /*break*/, 11];
                    swapForY = true; // X -> Y
                    return [3 /*break*/, 14];
                case 11:
                    if (!matchToken(selectedPool.tokenY, inputToken)) return [3 /*break*/, 12];
                    swapForY = false; // Y -> X
                    return [3 /*break*/, 14];
                case 12:
                    // If explicit match failed (e.g. user typed "SOL" but pool has "Wrapped SOL"), ask user
                    console.log(chalk_1.default.yellow("\n\u26A0\uFE0F  Could not automatically determine swap direction for \"".concat(inputToken, "\".")));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'direction',
                            message: "Select swap direction:",
                            choices: [
                                { name: "".concat(selectedPool.tokenX.symbol, " (").concat(selectedPool.tokenX.mint.slice(0, 4), "..) -> ").concat(selectedPool.tokenY.symbol, " (").concat(selectedPool.tokenY.mint.slice(0, 4), "..)"), value: true },
                                { name: "".concat(selectedPool.tokenY.symbol, " (").concat(selectedPool.tokenY.mint.slice(0, 4), "..) -> ").concat(selectedPool.tokenX.symbol, " (").concat(selectedPool.tokenX.mint.slice(0, 4), "..)"), value: false }
                            ]
                        })];
                case 13:
                    dirAnswer = _a.sent();
                    swapForY = dirAnswer.direction;
                    _a.label = 14;
                case 14:
                    sourceToken = swapForY ? selectedPool.tokenX : selectedPool.tokenY;
                    destToken = swapForY ? selectedPool.tokenY : selectedPool.tokenX;
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'number',
                            name: 'amount',
                            message: "Enter amount of ".concat(sourceToken.symbol, " to swap:"),
                            validate: function (val) { return val > 0 ? true : 'Amount must be greater than 0'; }
                        })];
                case 15:
                    amountAnswer = _a.sent();
                    amountIn = amountAnswer.amount;
                    decimals = sourceToken.decimals || 6;
                    amountInBN = new anchor_1.BN(Math.round(amountIn * Math.pow(10, decimals)));
                    // Step 6: Get Quote
                    console.log(chalk_1.default.yellow('\nFetching swap quote...'));
                    return [4 /*yield*/, swap_service_1.swapService.getSwapQuote(selectedPool.address, amountInBN, swapForY, 1.0 // 1% slippage default
                        )];
                case 16:
                    quote = _a.sent();
                    outDecimals = destToken.decimals || 6;
                    outAmount = Number(quote.outAmount.toString()) / Math.pow(10, outDecimals);
                    minOut = Number(quote.minOutAmount.toString()) / Math.pow(10, outDecimals);
                    console.log(chalk_1.default.green('\n✅ SWAP QUOTE:\n'));
                    console.log("Input:  ".concat(amountIn, " ").concat(sourceToken.symbol));
                    console.log("Output: ".concat(outAmount.toFixed(6), " ").concat(destToken.symbol));
                    console.log("Min Output (1% slip): ".concat(minOut.toFixed(6), " ").concat(destToken.symbol));
                    console.log("Price Impact: ".concat(quote.priceImpact.toFixed(4), "%"));
                    // Fee is usually in Lamports for SOL swaps or Token for others? 
                    // DLMM swap fee is usually retained in the pool, transaction fee is SOL. 
                    // quote.fee is the protocol fee.
                    console.log("Est. Protocol Fee: ".concat(quote.fee.toString(), " units"));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'confirm',
                            name: 'execute',
                            message: 'Execute Swap?',
                            default: false
                        })];
                case 17:
                    confirm_1 = _a.sent();
                    if (!confirm_1.execute) return [3 /*break*/, 19];
                    console.log(chalk_1.default.yellow('\n🔄 Executing swap...'));
                    return [4 /*yield*/, swap_service_1.swapService.executeSwap(selectedPool.address, quote)];
                case 18:
                    signature = _a.sent();
                    console.log(chalk_1.default.green.bold('\n✅ SWAP SUCCESSFUL!'));
                    console.log("Signature: ".concat(signature, "\n"));
                    return [3 /*break*/, 20];
                case 19:
                    console.log(chalk_1.default.gray('\n🚫 Swap cancelled.'));
                    _a.label = 20;
                case 20: return [3 /*break*/, 22];
                case 21:
                    error_1 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Swap failed: ".concat(error_1.message || error_1)));
                    return [3 /*break*/, 22];
                case 22: return [4 /*yield*/, waitForUser()];
                case 23:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
