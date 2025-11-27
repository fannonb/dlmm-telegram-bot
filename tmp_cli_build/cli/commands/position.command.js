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
exports.myPositionsMenu = myPositionsMenu;
exports.newPositionMenu = newPositionMenu;
exports.createPositionWorkflow = createPositionWorkflow;
var inquirer_1 = require("inquirer");
var chalk_1 = require("chalk");
var web3_js_1 = require("@solana/web3.js");
var dlmm_1 = require("@meteora-ag/dlmm");
var anchor_1 = require("@coral-xyz/anchor");
var wallet_service_1 = require("../../services/wallet.service");
var position_service_1 = require("../../services/position.service");
var fee_service_1 = require("../../services/fee.service");
var pool_service_1 = require("../../services/pool.service");
var liquidity_service_1 = require("../../services/liquidity.service");
var connection_service_1 = require("../../services/connection.service");
var balance_utils_1 = require("../../utils/balance.utils");
var range_recommender_service_1 = require("../../services/range-recommender.service");
var market_context_service_1 = require("../../services/market-context.service");
var analyticsDataStore_service_1 = require("../../services/analyticsDataStore.service");
var visualization_helpers_1 = require("../../utils/visualization.helpers");
var swap_service_1 = require("../../services/swap.service");
var config_manager_1 = require("../../config/config.manager");
var constants_1 = require("../../config/constants");
var rebalancing_service_1 = require("../../services/rebalancing.service");
var compounding_service_1 = require("../../services/compounding.service");
var analyticsStore = (0, analyticsDataStore_service_1.getAnalyticsDataStore)();
var EDGE_BUFFER_BINS = 2;
var SNAPSHOT_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
var analyticsSnapshotTimer = null;
ensureSnapshotScheduler();
var STABLE_TOKEN_SYMBOLS = new Set([
    'USDC',
    'USDT',
    'USDC.E',
    'USDT.E',
    'USDL',
    'USDH',
    'DAI',
    'PYUSD',
    'USDP',
    'FRAX',
    'UXD',
    'EURC',
]);
function isStableToken(token) {
    if (!(token === null || token === void 0 ? void 0 : token.symbol)) {
        return false;
    }
    return STABLE_TOKEN_SYMBOLS.has(token.symbol.toUpperCase());
}
function calculateVolumeSkew(context, poolPrice) {
    var _a;
    if (!((_a = context === null || context === void 0 ? void 0 : context.volumeNodes) === null || _a === void 0 ? void 0 : _a.length) || !poolPrice || poolPrice <= 0) {
        return 0;
    }
    var above = context.volumeNodes
        .filter(function (node) { return node.price > poolPrice; })
        .reduce(function (sum, node) { return sum + node.weight; }, 0);
    var below = context.volumeNodes
        .filter(function (node) { return node.price < poolPrice; })
        .reduce(function (sum, node) { return sum + node.weight; }, 0);
    var total = above + below;
    if (total === 0) {
        return 0;
    }
    return (above - below) / total;
}
function recommendStrategyForPool(poolInfo, context) {
    var _a, _b, _c, _d;
    var stableX = isStableToken(poolInfo.tokenX);
    var stableY = isStableToken(poolInfo.tokenY);
    var stablePair = stableX && stableY;
    var includesStable = stableX || stableY;
    var volatilityScore = (_a = context === null || context === void 0 ? void 0 : context.volatilityScore) !== null && _a !== void 0 ? _a : 0.08;
    var poolPrice = (_c = (_b = context === null || context === void 0 ? void 0 : context.poolPrice) !== null && _b !== void 0 ? _b : poolInfo.price) !== null && _c !== void 0 ? _c : 1;
    var volumeSkew = calculateVolumeSkew(context, poolPrice);
    var atrPercent = (_d = context === null || context === void 0 ? void 0 : context.atrPercent) !== null && _d !== void 0 ? _d : volatilityScore;
    var atrState = 'flat';
    if (atrPercent > 0.02) {
        atrState = 'expanding';
    }
    else if (atrPercent < 0.008) {
        atrState = 'contracting';
    }
    var strategy = 'Spot';
    var confidence = 'medium';
    var reasons = [];
    var lowVol = volatilityScore < 0.08 && atrState !== 'expanding';
    var highVol = volatilityScore > 0.18 || atrState === 'expanding';
    var deepSkew = Math.abs(volumeSkew) > 0.25;
    if (stablePair || (includesStable && lowVol)) {
        strategy = 'Curve';
        confidence = stablePair ? 'high' : 'medium';
        reasons.push('Meteora docs describe Curve as ideal for tightly-pegged markets where liquidity can stay concentrated.');
        if (stablePair) {
            reasons.push('Both tokens are stable-pegged, so concentrating liquidity maximizes fee capture per bin.');
        }
        else {
            reasons.push("Volatility score ".concat((volatilityScore * 100).toFixed(1), "% is low, so a narrower Curve band is efficient."));
        }
        if (atrState === 'contracting') {
            reasons.push("ATR contracting (".concat((atrPercent * 100).toFixed(2), "%) confirms price compression suitable for Curve."));
        }
        else if (atrState === 'expanding') {
            reasons.push('ATR is expanding, so monitor for breakout before going overly tight.');
        }
    }
    else if (highVol || deepSkew) {
        strategy = 'BidAsk';
        confidence = deepSkew ? 'high' : 'medium';
        reasons.push('Bid-Ask is suited for directional or DCA-style provision per Meteora guidance.');
        if (highVol) {
            reasons.push("ATR ".concat((atrPercent * 100).toFixed(2), "% / volatility ").concat((volatilityScore * 100).toFixed(1), "% suggest leaning single-sided to harvest swings."));
        }
        if (deepSkew) {
            reasons.push("Volume profile is ".concat((volumeSkew > 0 ? 'ask-heavy' : 'bid-heavy'), " (").concat((volumeSkew * 100).toFixed(1), "% skew), so asymmetric liquidity can capture flow."));
        }
    }
    else {
        strategy = 'Spot';
        confidence = 'medium';
        reasons.push('Spot keeps a balanced 50/50 distribution, which Meteora highlights as the versatile default for mixed markets.');
        reasons.push("Volatility score ".concat((volatilityScore * 100).toFixed(1), "% and neutral order flow favor a symmetric approach."));
        if (atrState !== 'expanding') {
            reasons.push("ATR ".concat((atrPercent * 100).toFixed(2), "% indicates muted drift, reinforcing balanced placement."));
        }
    }
    return {
        strategy: strategy,
        confidence: confidence,
        reasons: reasons,
        metrics: {
            volatilityScore: volatilityScore,
            volumeSkew: volumeSkew,
            stablePair: stablePair,
            includesStable: includesStable,
            atrPercent: atrPercent,
            atrState: atrState,
        },
    };
}
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
// Helper for header (optional, or imported if we make a shared UI module)
function displayHeader() {
    // console.clear(); // Optional
    // console.log(chalk.yellow.bold('METEORA DLMM CLI - POSITIONS'));
}
var MIN_SWAP_AMOUNT = 0.000001;
var BALANCE_TOLERANCE = 0.000001;
var PRICE_BUFFER = 1.02;
var FEE_AMOUNT_EPSILON = 0.0000001;
function toBaseUnits(amount, decimals) {
    var factor = Math.pow(10, decimals);
    var scaled = Math.floor(amount * factor);
    return new anchor_1.BN(Math.max(scaled, 1));
}
function fromBaseUnits(value, decimals) {
    var factor = Math.pow(10, decimals);
    return parseFloat(value.toString()) / factor;
}
function maybeHandleAutoSwapShortfalls(context) {
    return __awaiter(this, void 0, void 0, function () {
        var poolInfo, amountX, amountY, balances, deficitX, deficitY, plans, feasiblePlans, config, slippagePercent, inferredPrice, priceHint, _i, feasiblePlans_1, plan, tokenInMeta, tokenOutMeta, tokenInSymbol, tokenOutSymbol, quotePlan, confirmSwap, signature, error_1;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    poolInfo = context.poolInfo, amountX = context.amountX, amountY = context.amountY, balances = context.balances;
                    deficitX = Math.max(0, amountX - balances.tokenXBalance);
                    deficitY = Math.max(0, amountY - balances.tokenYBalance);
                    plans = [];
                    if (deficitX > BALANCE_TOLERANCE) {
                        plans.push({
                            deficitToken: 'tokenX',
                            deficitAmount: deficitX,
                            inputToken: 'tokenY',
                            availableInput: Math.max(0, balances.tokenYBalance - amountY),
                            swapForY: false,
                        });
                    }
                    if (deficitY > BALANCE_TOLERANCE) {
                        plans.push({
                            deficitToken: 'tokenY',
                            deficitAmount: deficitY,
                            inputToken: 'tokenX',
                            availableInput: Math.max(0, balances.tokenXBalance - amountX),
                            swapForY: true,
                        });
                    }
                    feasiblePlans = plans.filter(function (plan) { return plan.availableInput > BALANCE_TOLERANCE; });
                    if (!feasiblePlans.length) {
                        return [2 /*return*/, false];
                    }
                    config = config_manager_1.configManager.getConfig();
                    slippagePercent = (_b = (_a = config.transaction) === null || _a === void 0 ? void 0 : _a.slippage) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_CONFIG.SLIPPAGE;
                    inferredPrice = amountX > 0 ? amountY / Math.max(amountX, 1e-9) : undefined;
                    priceHint = Math.max((_d = (_c = poolInfo.price) !== null && _c !== void 0 ? _c : inferredPrice) !== null && _d !== void 0 ? _d : 1, 1e-9);
                    _i = 0, feasiblePlans_1 = feasiblePlans;
                    _g.label = 1;
                case 1:
                    if (!(_i < feasiblePlans_1.length)) return [3 /*break*/, 8];
                    plan = feasiblePlans_1[_i];
                    tokenInMeta = plan.inputToken === 'tokenX' ? poolInfo.tokenX : poolInfo.tokenY;
                    tokenOutMeta = plan.deficitToken === 'tokenX' ? poolInfo.tokenX : poolInfo.tokenY;
                    tokenInSymbol = tokenInMeta.symbol || (plan.inputToken === 'tokenX' ? 'Token X' : 'Token Y');
                    tokenOutSymbol = tokenOutMeta.symbol || (plan.deficitToken === 'tokenX' ? 'Token X' : 'Token Y');
                    console.log(chalk_1.default.cyan("\n\uD83D\uDD01 Attempting to swap ".concat(tokenInSymbol, " \u2192 ").concat(tokenOutSymbol, " to cover shortfall.")));
                    console.log("   Missing ".concat(tokenOutSymbol, ": ").concat(chalk_1.default.yellow(plan.deficitAmount.toFixed(6))));
                    console.log("   Available ".concat(tokenInSymbol, " to swap: ").concat(chalk_1.default.yellow(plan.availableInput.toFixed(6))));
                    return [4 /*yield*/, buildSwapQuoteForDeficit({
                            poolAddress: context.poolAddress,
                            targetOutAmount: plan.deficitAmount,
                            maxInputAmount: plan.availableInput,
                            slippagePercent: slippagePercent,
                            swapForY: plan.swapForY,
                            tokenInDecimals: (_e = tokenInMeta.decimals) !== null && _e !== void 0 ? _e : 6,
                            tokenOutDecimals: (_f = tokenOutMeta.decimals) !== null && _f !== void 0 ? _f : 6,
                            priceHint: priceHint,
                        })];
                case 2:
                    quotePlan = _g.sent();
                    if (!quotePlan) {
                        console.log(chalk_1.default.gray('   Unable to source a swap quote that meets the shortfall.'));
                        return [3 /*break*/, 7];
                    }
                    console.log(chalk_1.default.cyan("\n   Quote: swap ".concat(chalk_1.default.yellow(quotePlan.inputAmount.toFixed(6)), " ").concat(tokenInSymbol, " for \u2248 ").concat(chalk_1.default.yellow(quotePlan.expectedOutput.toFixed(6)), " ").concat(tokenOutSymbol)));
                    console.log(chalk_1.default.gray("   Price impact: ".concat((quotePlan.quote.priceImpact * 100).toFixed(3), "% (slippage cap ").concat(slippagePercent.toFixed(2), "%)")));
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'confirm',
                                name: 'confirmSwap',
                                message: "Execute swap to acquire missing ".concat(tokenOutSymbol, "?"),
                                default: true,
                            }])];
                case 3:
                    confirmSwap = (_g.sent()).confirmSwap;
                    if (!confirmSwap) {
                        console.log(chalk_1.default.gray('   Swap cancelled by user.'));
                        return [3 /*break*/, 7];
                    }
                    _g.label = 4;
                case 4:
                    _g.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, swap_service_1.swapService.executeSwap(context.poolAddress, quotePlan.quote)];
                case 5:
                    signature = _g.sent();
                    console.log(chalk_1.default.green("   \u2705 Swap executed! Signature: ".concat(signature)));
                    return [2 /*return*/, true];
                case 6:
                    error_1 = _g.sent();
                    console.log(chalk_1.default.red("   Swap failed: ".concat(error_1)));
                    return [2 /*return*/, false];
                case 7:
                    _i++;
                    return [3 /*break*/, 1];
                case 8: return [2 /*return*/, false];
            }
        });
    });
}
function buildSwapQuoteForDeficit(params) {
    return __awaiter(this, void 0, void 0, function () {
        var attempts, estimateInput, attempt, quote, error_2, expectedOut, ratio, nextEstimate;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (params.maxInputAmount < MIN_SWAP_AMOUNT) {
                        return [2 /*return*/, null];
                    }
                    attempts = 3;
                    estimateInput = Math.min(params.maxInputAmount, Math.max(MIN_SWAP_AMOUNT, (params.swapForY
                        ? params.targetOutAmount / Math.max(params.priceHint, 1e-9)
                        : params.targetOutAmount * params.priceHint) * PRICE_BUFFER));
                    attempt = 0;
                    _a.label = 1;
                case 1:
                    if (!(attempt < attempts)) return [3 /*break*/, 7];
                    if (estimateInput > params.maxInputAmount) {
                        estimateInput = params.maxInputAmount;
                    }
                    if (estimateInput < MIN_SWAP_AMOUNT) {
                        return [2 /*return*/, null];
                    }
                    quote = null;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, swap_service_1.swapService.getSwapQuote(params.poolAddress, toBaseUnits(estimateInput, params.tokenInDecimals), params.swapForY, params.slippagePercent)];
                case 3:
                    quote = _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    console.log(chalk_1.default.gray("   Quote attempt ".concat(attempt + 1, " failed: ").concat(error_2)));
                    if (attempt === attempts - 1) {
                        return [2 /*return*/, null];
                    }
                    return [3 /*break*/, 6];
                case 5:
                    expectedOut = fromBaseUnits(quote.outAmount, params.tokenOutDecimals);
                    if (expectedOut >= params.targetOutAmount * 0.995) {
                        return [2 /*return*/, {
                                quote: quote,
                                inputAmount: estimateInput,
                                expectedOutput: expectedOut,
                            }];
                    }
                    ratio = params.targetOutAmount / Math.max(expectedOut, MIN_SWAP_AMOUNT);
                    nextEstimate = Math.min(params.maxInputAmount, estimateInput * ratio * 1.05);
                    if (nextEstimate <= estimateInput * 1.01) {
                        return [2 /*return*/, null];
                    }
                    estimateInput = nextEstimate;
                    _a.label = 6;
                case 6:
                    attempt++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, null];
            }
        });
    });
}
function myPositionsMenu() {
    return __awaiter(this, void 0, void 0, function () {
        var activeWallet, positions, totals, choices, action, selectedPosition, selectedPosition, selectedPosition, error_3;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!true) return [3 /*break*/, 34];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 31, , 33]);
                    displayHeader();
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!!activeWallet) return [3 /*break*/, 3];
                    console.log(chalk_1.default.red('❌ No active wallet found. Please select a wallet first.'));
                    return [4 /*yield*/, waitForUser()];
                case 2:
                    _b.sent();
                    return [2 /*return*/];
                case 3:
                    console.log(chalk_1.default.yellow('🔄 Fetching positions from blockchain...'));
                    return [4 /*yield*/, position_service_1.positionService.getAllPositions(activeWallet.publicKey)];
                case 4:
                    positions = _b.sent();
                    console.log(chalk_1.default.blue.bold('💼 MY POSITIONS\n'));
                    if (positions.length === 0) {
                        console.log(chalk_1.default.gray('📋 No positions found for this wallet.\n'));
                    }
                    else {
                        console.log(chalk_1.default.yellow('📋 Your Positions:\n'));
                        positions.forEach(function (pos, index) {
                            var _a;
                            var status = determineRangeStatus(pos);
                            var statusLabel = formatRangeStatus(status);
                            var tokenXAmount = getUiAmount(pos.tokenX);
                            var tokenYAmount = getUiAmount(pos.tokenY);
                            var feesUsd = (_a = pos.unclaimedFees.usdValue) !== null && _a !== void 0 ? _a : 0;
                            console.log("".concat(index + 1, ". ").concat(pos.tokenX.symbol || 'Unknown', "/").concat(pos.tokenY.symbol || 'Unknown'));
                            console.log("   Address: ".concat(pos.publicKey.slice(0, 8), "..."));
                            console.log("   Pool: ".concat(pos.poolAddress.slice(0, 8), "..."));
                            console.log("   Range: [".concat(pos.lowerBinId, " - ").concat(pos.upperBinId, "] ").concat(statusLabel));
                            console.log("   Active Bin: ".concat(pos.activeBinId));
                            console.log("   Tokens: ".concat(tokenXAmount.toFixed(6), " ").concat(pos.tokenX.symbol || 'X', " / ").concat(tokenYAmount.toFixed(6), " ").concat(pos.tokenY.symbol || 'Y'));
                            if (pos.totalValueUSD !== undefined) {
                                console.log("   Total Value: ".concat(formatUsd(pos.totalValueUSD)));
                            }
                            console.log("   Unclaimed Fees: ".concat(formatUsd(feesUsd), " (").concat(formatFeeBreakdownForPosition(pos), ")\n"));
                        });
                        totals = summarizePortfolioTotals(positions);
                        console.log(chalk_1.default.cyan("\uD83D\uDCC8 Portfolio Value: ".concat(formatUsd(totals.valueUsd))));
                        console.log(chalk_1.default.cyan("\uD83D\uDCB8 Unclaimed Fees: ".concat(formatUsd(totals.feesUsd), " (").concat(formatFeeBreakdown(totals.feesByToken), ")")));
                        console.log();
                    }
                    choices = [
                        new inquirer_1.default.Separator('═══ POSITION ACTIONS ═══'),
                        '🔧 Manage Position (Add/Remove/Close)',
                        '📊 View Position Details',
                        '♻️ Rebalance Tools',
                        '💰 Claim / Compound Fees',
                        new inquirer_1.default.Separator('═══ DATA & ANALYTICS ═══'),
                        '🔄 Refresh Position Data',
                        '📈 Refresh Analytics Snapshots',
                        new inquirer_1.default.Separator('═══ NAVIGATION ═══'),
                        '⬅️ Back to Main Menu'
                    ];
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'action',
                            message: 'Select an action:',
                            choices: choices,
                            pageSize: 15
                        })];
                case 5:
                    action = (_b.sent()).action;
                    if (!action.includes('Manage Position')) return [3 /*break*/, 11];
                    if (!(positions.length === 0)) return [3 /*break*/, 7];
                    console.log(chalk_1.default.yellow('\n⚠️  No positions to manage.'));
                    return [4 /*yield*/, waitForUser()];
                case 6:
                    _b.sent();
                    return [3 /*break*/, 0];
                case 7: return [4 /*yield*/, promptForPositionSelection(positions, 'Select a position to manage:')];
                case 8:
                    selectedPosition = _b.sent();
                    if (!selectedPosition) return [3 /*break*/, 10];
                    return [4 /*yield*/, managePositionMenu(selectedPosition)];
                case 9:
                    _b.sent();
                    _b.label = 10;
                case 10: return [3 /*break*/, 0];
                case 11:
                    if (!action.includes('View Position Details')) return [3 /*break*/, 17];
                    if (!(positions.length === 0)) return [3 /*break*/, 13];
                    console.log(chalk_1.default.yellow('\n⚠️  No positions to inspect.'));
                    return [4 /*yield*/, waitForUser()];
                case 12:
                    _b.sent();
                    return [3 /*break*/, 0];
                case 13: return [4 /*yield*/, promptForPositionSelection(positions, 'Select a position to inspect:')];
                case 14:
                    selectedPosition = _b.sent();
                    if (!selectedPosition) return [3 /*break*/, 16];
                    return [4 /*yield*/, positionDetailMenu(selectedPosition)];
                case 15:
                    _b.sent();
                    _b.label = 16;
                case 16: return [3 /*break*/, 0];
                case 17:
                    if (!action.includes('Claim / Compound')) return [3 /*break*/, 19];
                    return [4 /*yield*/, feeClaimingMenu(positions)];
                case 18:
                    _b.sent();
                    return [3 /*break*/, 0];
                case 19:
                    if (!action.includes('Refresh Position Data')) return [3 /*break*/, 21];
                    return [4 /*yield*/, refreshPositionData()];
                case 20:
                    _b.sent();
                    return [3 /*break*/, 0]; // Loop back to show updated data
                case 21:
                    if (!action.includes('Refresh Analytics')) return [3 /*break*/, 23];
                    return [4 /*yield*/, captureAnalyticsSnapshots(positions, { source: 'manual' })];
                case 22:
                    _b.sent();
                    return [3 /*break*/, 30];
                case 23:
                    if (!action.includes('Rebalance Tools')) return [3 /*break*/, 29];
                    if (!(positions.length === 0)) return [3 /*break*/, 25];
                    console.log(chalk_1.default.yellow('\n⚠️  No positions to analyze.'));
                    return [4 /*yield*/, waitForUser()];
                case 24:
                    _b.sent();
                    return [3 /*break*/, 0];
                case 25: return [4 /*yield*/, promptForPositionSelection(positions, 'Select a position to rebalance:')];
                case 26:
                    selectedPosition = _b.sent();
                    if (!selectedPosition) return [3 /*break*/, 28];
                    return [4 /*yield*/, rebalanceAnalysisMenu(selectedPosition)];
                case 27:
                    _b.sent();
                    _b.label = 28;
                case 28: return [3 /*break*/, 0];
                case 29:
                    if (action.includes('Back to Main Menu')) {
                        return [2 /*return*/];
                    }
                    _b.label = 30;
                case 30: return [3 /*break*/, 33];
                case 31:
                    error_3 = _b.sent();
                    if (((_a = error_3.message) === null || _a === void 0 ? void 0 : _a.includes('force closed')) || error_3.name === 'ExitPromptError') {
                        throw error_3;
                    }
                    console.error(chalk_1.default.red('Error in positions menu:', error_3.message || 'Unknown error'));
                    return [4 /*yield*/, waitForUser()];
                case 32:
                    _b.sent();
                    return [3 /*break*/, 33];
                case 33: return [3 /*break*/, 0];
                case 34: return [2 /*return*/];
            }
        });
    });
}
function newPositionMenu() {
    return __awaiter(this, void 0, void 0, function () {
        var poolOption, poolCommand, error_4;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    displayHeader();
                    console.log(chalk_1.default.blue.bold('➕ CREATE NEW POSITION\n'));
                    console.log(chalk_1.default.yellow('Step 1: Find a pool to provide liquidity\n'));
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 16, , 18]);
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'poolOption',
                            message: 'How would you like to find a pool?',
                            choices: [
                                new inquirer_1.default.Separator('═══ POOL DISCOVERY ═══'),
                                '🔍 Search by Pool Address',
                                '🏆 Browse Top Pools by TVL',
                                '📈 Browse Top Pools by APR',
                                '🔎 Find Token Pair',
                                new inquirer_1.default.Separator('═══ NAVIGATION ═══'),
                                '⬅️ Back to Main Menu'
                            ],
                            pageSize: 10
                        })];
                case 2:
                    poolOption = (_b.sent()).poolOption;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('./pool.command'); })];
                case 3:
                    poolCommand = _b.sent();
                    if (!poolOption.includes('Search by Pool Address')) return [3 /*break*/, 5];
                    return [4 /*yield*/, poolCommand.searchPoolByAddress()];
                case 4:
                    _b.sent();
                    return [3 /*break*/, 15];
                case 5:
                    if (!poolOption.includes('Browse Top Pools by TVL')) return [3 /*break*/, 8];
                    return [4 /*yield*/, poolCommand.getTopPoolsByTVL()];
                case 6:
                    _b.sent();
                    return [4 /*yield*/, createPositionWorkflow()];
                case 7:
                    _b.sent();
                    return [3 /*break*/, 15];
                case 8:
                    if (!poolOption.includes('Browse Top Pools by APR')) return [3 /*break*/, 11];
                    return [4 /*yield*/, poolCommand.getTopPoolsByAPR()];
                case 9:
                    _b.sent();
                    return [4 /*yield*/, createPositionWorkflow()];
                case 10:
                    _b.sent();
                    return [3 /*break*/, 15];
                case 11:
                    if (!poolOption.includes('Find Token Pair')) return [3 /*break*/, 14];
                    return [4 /*yield*/, poolCommand.findTokenPair()];
                case 12:
                    _b.sent();
                    return [4 /*yield*/, createPositionWorkflow()];
                case 13:
                    _b.sent();
                    return [3 /*break*/, 15];
                case 14:
                    if (poolOption.includes('Back to Main Menu')) {
                        return [2 /*return*/];
                    }
                    _b.label = 15;
                case 15: return [3 /*break*/, 18];
                case 16:
                    error_4 = _b.sent();
                    if (((_a = error_4.message) === null || _a === void 0 ? void 0 : _a.includes('force closed')) || error_4.name === 'ExitPromptError') {
                        throw error_4;
                    }
                    console.error(chalk_1.default.red('Error in new position menu:', error_4.message || 'Unknown error'));
                    return [4 /*yield*/, waitForUser()];
                case 17:
                    _b.sent();
                    return [3 /*break*/, 18];
                case 18: return [2 /*return*/];
            }
        });
    });
}
function createPositionWorkflow(preselectedPoolAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var poolAddress, poolAnswers, poolInfo_1, rangeMarketContext, contextError_1, activeBinDetails, error_5, recommendationContext, aiRecommendation, useAI, llmAgent, useAiConfig, error_6, strategyRecommendation, strategyAnswers, strategyRecommendation, rangeRecommendation, useVpvrRecommendation, error_7, volPct, devPct, toggleAnswer, getDefaultBinsPerSide, minBinId, maxBinId, binsPerSide, centerBinOverride, rangeAnswers, defaultBinsPerSide, binsAnswers, binsValue, suggestedCenter, amountXAnswer, amountX, amountY, strategyTypeEnum, calcMinBinId, calcMaxBinId, health, confirmContinue, impliedPrice, activePrice, priceDev, isSuspicious, useManualEntry, manualAnswer, error_8, amountYAnswer, keypair, connection, tokenXMint, tokenYMint, currentBalances, printBalances, validationResult_1, showErrors, autoSwapPerformed, swapFixed, continueAnswer, successMsg, error_9, transactionConfig, _a, sessionSlippage, priorityFeeOptions, positionParams, validation, prepared, formatPrice, costAnalysis, usdValuePrefix, describeSource, formatUsdInput, checks, error_10, confirmAnswers, progressSteps_1, currentStep_1, showProgress, result, errorMsg, error_11, errorMsg, error_12;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n📊 CREATE NEW POSITION\n'));
                    _q.label = 1;
                case 1:
                    _q.trys.push([1, 79, , 80]);
                    poolAddress = preselectedPoolAddress;
                    if (!!poolAddress) return [3 /*break*/, 3];
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'input',
                            name: 'poolAddress',
                            message: 'Enter pool address (Solana public key):',
                        })];
                case 2:
                    poolAnswers = _q.sent();
                    poolAddress = poolAnswers.poolAddress;
                    _q.label = 3;
                case 3:
                    if (!(!poolAddress || poolAddress.trim().length === 0)) return [3 /*break*/, 5];
                    console.log(chalk_1.default.yellow('\n❌ Pool address cannot be empty\n'));
                    return [4 /*yield*/, waitForUser()];
                case 4:
                    _q.sent();
                    return [2 /*return*/];
                case 5:
                    console.log(chalk_1.default.yellow('🔄 Fetching pool information...\n'));
                    return [4 /*yield*/, pool_service_1.poolService.searchPoolByAddress(poolAddress)];
                case 6:
                    poolInfo_1 = _q.sent();
                    rangeMarketContext = void 0;
                    _q.label = 7;
                case 7:
                    _q.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, market_context_service_1.marketContextService.buildRangeContext(poolInfo_1)];
                case 8:
                    rangeMarketContext = _q.sent();
                    return [3 /*break*/, 10];
                case 9:
                    contextError_1 = _q.sent();
                    console.log(chalk_1.default.yellow("\u26A0\uFE0F  Could not build market context: ".concat(contextError_1)));
                    return [3 /*break*/, 10];
                case 10:
                    // STEP 1: FETCH POOL ACTIVE BIN & PRICE (Enhanced Display)
                    console.log(chalk_1.default.green.bold('═'.repeat(65)));
                    console.log(chalk_1.default.green.bold('│ STEP 1: POOL ACTIVE BIN & PRICE                              │'));
                    console.log(chalk_1.default.green.bold('═'.repeat(65)));
                    console.log();
                    console.log(chalk_1.default.cyan.bold("\u2705 Pool Found: ".concat(poolInfo_1.tokenX.symbol, "/").concat(poolInfo_1.tokenY.symbol)));
                    console.log(chalk_1.default.gray("   Address: ".concat(poolAddress.slice(0, 8), "...").concat(poolAddress.slice(-6))));
                    console.log();
                    console.log(chalk_1.default.blue.bold('📊 Active Bin Information:'));
                    _q.label = 11;
                case 11:
                    _q.trys.push([11, 13, , 14]);
                    return [4 /*yield*/, pool_service_1.poolService.getActiveBinDetails(poolAddress)];
                case 12:
                    activeBinDetails = _q.sent();
                    console.log("   \u2022 Active Bin ID: ".concat(chalk_1.default.yellow(poolInfo_1.activeBin.toString())));
                    console.log("   \u2022 Current Price: ".concat(chalk_1.default.green("$".concat(((_b = poolInfo_1.price) === null || _b === void 0 ? void 0 : _b.toFixed(6)) || 'N/A')), " (").concat(poolInfo_1.tokenX.symbol, "/").concat(poolInfo_1.tokenY.symbol, ")"));
                    console.log("   \u2022 Bin Liquidity: ".concat(chalk_1.default.cyan("".concat(activeBinDetails.xAmount.toFixed(4), " ").concat(poolInfo_1.tokenX.symbol))));
                    console.log("   \u2022               ".concat(chalk_1.default.cyan("".concat(activeBinDetails.yAmount.toFixed(4), " ").concat(poolInfo_1.tokenY.symbol))));
                    console.log("   \u2022 Bin Step: ".concat(poolInfo_1.binStep, " bps (").concat((poolInfo_1.binStep / 100).toFixed(2), "% per bin)"));
                    console.log("   \u2022 TVL: ".concat(chalk_1.default.cyan("$".concat(((_c = poolInfo_1.tvl) === null || _c === void 0 ? void 0 : _c.toLocaleString()) || 'N/A'))));
                    console.log("   \u2022 APR: ".concat(chalk_1.default.magenta("".concat(((_d = poolInfo_1.apr) === null || _d === void 0 ? void 0 : _d.toFixed(2)) || 'N/A', "%"))));
                    return [3 /*break*/, 14];
                case 13:
                    error_5 = _q.sent();
                    // Gracefully fall back to basic pool info if active bin details unavailable
                    console.log("   \u2022 Active Bin ID: ".concat(chalk_1.default.yellow(poolInfo_1.activeBin.toString())));
                    console.log("   \u2022 Current Price: ".concat(chalk_1.default.green("$".concat(((_e = poolInfo_1.price) === null || _e === void 0 ? void 0 : _e.toFixed(6)) || 'N/A')), " (").concat(poolInfo_1.tokenX.symbol, "/").concat(poolInfo_1.tokenY.symbol, ")"));
                    console.log("   \u2022 Bin Step: ".concat(poolInfo_1.binStep, " bps (").concat((poolInfo_1.binStep / 100).toFixed(2), "% per bin)"));
                    console.log("   \u2022 TVL: ".concat(chalk_1.default.cyan("$".concat(((_f = poolInfo_1.tvl) === null || _f === void 0 ? void 0 : _f.toLocaleString()) || 'N/A'))));
                    console.log("   \u2022 APR: ".concat(chalk_1.default.magenta("".concat(((_g = poolInfo_1.apr) === null || _g === void 0 ? void 0 : _g.toFixed(2)) || 'N/A', "%"))));
                    console.log();
                    console.log(chalk_1.default.gray.italic('ℹ️  Note: Real-time bin liquidity data unavailable for this pool.\n   Please verify the pool is an active DLMM pool on this network.'));
                    return [3 /*break*/, 14];
                case 14:
                    console.log();
                    // Educational sidenote about active bin
                    console.log(chalk_1.default.gray.italic('ℹ️  SIDENOTE - Active Bin Understanding:'));
                    console.log(chalk_1.default.gray.italic('   The active bin is where trading currently happens. It\'s the ONLY bin'));
                    console.log(chalk_1.default.gray.italic('   earning fees right now. Bin IDs are integers: negative bins (more'));
                    console.log(chalk_1.default.gray.italic("   ".concat(poolInfo_1.tokenY.symbol, "), positive bins (more ").concat(poolInfo_1.tokenX.symbol, ").")));
                    console.log(chalk_1.default.gray.italic("   With ".concat(poolInfo_1.binStep, " bps bin step, each bin = ").concat((poolInfo_1.binStep / 100).toFixed(2), "% price difference.")));
                    console.log();
                    if ((_h = rangeMarketContext === null || rangeMarketContext === void 0 ? void 0 : rangeMarketContext.volumeNodes) === null || _h === void 0 ? void 0 : _h.length) {
                        console.log(chalk_1.default.gray('On-chain liquidity shelves (top 3 by notional):'));
                        rangeMarketContext.volumeNodes.slice(0, 3).forEach(function (node, idx) {
                            console.log(chalk_1.default.gray("   ".concat(idx + 1, ". Price ~ ").concat(node.price.toFixed(6), " (").concat((node.weight * 100).toFixed(1), "% of sampled depth)")));
                        });
                        console.log();
                    }
                    return [4 /*yield*/, waitForUser()];
                case 15:
                    _q.sent();
                    recommendationContext = rangeMarketContext
                        ? __assign(__assign({}, rangeMarketContext), { poolPrice: poolInfo_1.price }) : { poolPrice: poolInfo_1.price };
                    // ========== AI-POWERED STRATEGY ANALYSIS ==========
                    console.log(chalk_1.default.cyan.bold('\n🤖 AI STRATEGY ANALYSIS\n'));
                    console.log(chalk_1.default.gray('Analyzing pool characteristics, market data, and optimal strategy...'));
                    aiRecommendation = null;
                    useAI = false;
                    _q.label = 16;
                case 16:
                    _q.trys.push([16, 21, , 22]);
                    llmAgent = require('../../services/llmAgent.service').llmAgent;
                    if (!llmAgent.isAvailable()) return [3 /*break*/, 19];
                    return [4 /*yield*/, llmAgent.analyzePoolForCreation(poolInfo_1)];
                case 17:
                    aiRecommendation = _q.sent();
                    // Display AI analysis
                    console.log(chalk_1.default.green.bold('\n═══════════════════════════════════════════════════════════════'));
                    console.log(chalk_1.default.green.bold('│ AI RECOMMENDATION                                           │'));
                    console.log(chalk_1.default.green.bold('═══════════════════════════════════════════════════════════════\n'));
                    console.log(chalk_1.default.cyan("Strategy: ".concat(chalk_1.default.bold(aiRecommendation.strategy))));
                    console.log(chalk_1.default.cyan("Confidence: ".concat(chalk_1.default.bold(aiRecommendation.confidence + '%'), " ").concat(aiRecommendation.confidence >= 85 ? '(HIGH)' : aiRecommendation.confidence >= 70 ? '(MEDIUM)' : '(LOW)')));
                    console.log(chalk_1.default.cyan("Market Regime: ".concat(aiRecommendation.marketRegime, "\n")));
                    console.log(chalk_1.default.yellow('Why This Strategy?'));
                    aiRecommendation.reasoning.forEach(function (reason) {
                        console.log(chalk_1.default.gray("  \u2713 ".concat(reason)));
                    });
                    console.log();
                    console.log(chalk_1.default.blue('Recommended Configuration:'));
                    console.log(chalk_1.default.gray("  \u2022 Bid Bins: ".concat(aiRecommendation.binConfiguration.bidBins)));
                    console.log(chalk_1.default.gray("  \u2022 Ask Bins: ".concat(aiRecommendation.binConfiguration.askBins)));
                    console.log(chalk_1.default.gray("  \u2022 Total Range: ".concat(aiRecommendation.binConfiguration.totalBins, " bins")));
                    console.log(chalk_1.default.gray("  \u2022 Liquidity Split: ".concat(aiRecommendation.liquidityDistribution.tokenXPercentage, "% ").concat(poolInfo_1.tokenX.symbol, " / ").concat(aiRecommendation.liquidityDistribution.tokenYPercentage, "% ").concat(poolInfo_1.tokenY.symbol)));
                    console.log();
                    console.log(chalk_1.default.magenta('Expected Performance:'));
                    console.log(chalk_1.default.gray("  \u2022 Estimated APR: ~".concat(aiRecommendation.expectedPerformance.estimatedAPR.toFixed(1), "%")));
                    console.log(chalk_1.default.gray("  \u2022 Fee Efficiency: ".concat(aiRecommendation.expectedPerformance.feeEfficiency, "%")));
                    console.log(chalk_1.default.gray("  \u2022 Rebalance Frequency: ".concat(aiRecommendation.expectedPerformance.rebalanceFrequency)));
                    console.log();
                    if (aiRecommendation.risks.length > 0) {
                        console.log(chalk_1.default.red('Risks:'));
                        aiRecommendation.risks.forEach(function (risk) {
                            console.log(chalk_1.default.gray("  \u26A0\uFE0F  ".concat(risk)));
                        });
                        console.log();
                    }
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'confirm',
                            name: 'useAiConfig',
                            message: chalk_1.default.cyan('Apply AI recommendation automatically?'),
                            default: aiRecommendation.confidence >= 80
                        })];
                case 18:
                    useAiConfig = (_q.sent()).useAiConfig;
                    useAI = useAiConfig;
                    return [3 /*break*/, 20];
                case 19:
                    console.log(chalk_1.default.yellow('ℹ️  LLM not configured. Using algorithmic analysis.\n'));
                    _q.label = 20;
                case 20: return [3 /*break*/, 22];
                case 21:
                    error_6 = _q.sent();
                    console.log(chalk_1.default.yellow("\u2139\uFE0F  AI analysis unavailable: ".concat(error_6.message)));
                    console.log(chalk_1.default.gray('Falling back to algorithmic guidance.\n'));
                    return [3 /*break*/, 22];
                case 22:
                    // Algorithmic fallback (always show for comparison or if AI unavailable)
                    if (!useAI) {
                        strategyRecommendation = recommendStrategyForPool(poolInfo_1, recommendationContext);
                        console.log(chalk_1.default.cyan('\n📊 Algorithmic Strategy Guidance'));
                        console.log("   Suggested: ".concat(chalk_1.default.bold(strategyRecommendation.strategy), " (").concat(strategyRecommendation.confidence, " confidence)"));
                        strategyRecommendation.reasons.forEach(function (reason) {
                            console.log("   \u2022 ".concat(reason));
                        });
                        console.log("   ATR Drift: ".concat((strategyRecommendation.metrics.atrPercent * 100).toFixed(2), "% (").concat(strategyRecommendation.metrics.atrState, ")"));
                        console.log();
                    }
                    strategyAnswers = void 0;
                    if (!(useAI && aiRecommendation)) return [3 /*break*/, 23];
                    // Auto-apply AI recommendation
                    console.log(chalk_1.default.green("\u2705 Using AI-recommended strategy: ".concat(aiRecommendation.strategy, "\n")));
                    strategyAnswers = { strategy: aiRecommendation.strategy };
                    return [3 /*break*/, 25];
                case 23:
                    strategyRecommendation = recommendStrategyForPool(poolInfo_1, recommendationContext);
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'strategy',
                            message: 'Choose liquidity provision strategy:',
                            choices: [
                                new inquirer_1.default.Separator('=== STRATEGIES ==='),
                                {
                                    name: '🎯 Spot (Balanced) - 50/50 distribution around current price',
                                    value: 'Spot',
                                },
                                {
                                    name: '📈 Curve (Concentrated) - Concentrated around peg with wider range',
                                    value: 'Curve',
                                },
                                {
                                    name: '📍 Bid-Ask (Custom) - Specify exact bin ranges',
                                    value: 'BidAsk',
                                },
                            ],
                            default: strategyRecommendation.strategy,
                        })];
                case 24:
                    strategyAnswers = _q.sent();
                    _q.label = 25;
                case 25:
                    rangeRecommendation = null;
                    useVpvrRecommendation = true;
                    _q.label = 26;
                case 26:
                    _q.trys.push([26, 28, , 29]);
                    return [4 /*yield*/, range_recommender_service_1.rangeRecommenderService.suggestRange(strategyAnswers.strategy, poolInfo_1, recommendationContext)];
                case 27:
                    rangeRecommendation = _q.sent();
                    return [3 /*break*/, 29];
                case 28:
                    error_7 = _q.sent();
                    console.log(chalk_1.default.yellow("\u26A0\uFE0F  Could not build range recommendation: ".concat(error_7)));
                    return [3 /*break*/, 29];
                case 29:
                    if (!rangeRecommendation) return [3 /*break*/, 31];
                    if (useVpvrRecommendation) {
                        console.log(chalk_1.default.cyan('\n🧠 Suggested Range Configuration:'));
                        volPct = (rangeRecommendation.metrics.volatilityScore * 100).toFixed(1);
                        devPct = (rangeRecommendation.metrics.priceDeviation * 100).toFixed(1);
                        console.log("  \u2022 Strategy: ".concat(rangeRecommendation.strategy));
                        if (strategyAnswers.strategy === 'BidAsk') {
                            console.log("  \u2022 Bid bins: ".concat((_j = rangeRecommendation.recommendedBidBins) !== null && _j !== void 0 ? _j : '-', " | Ask bins: ").concat((_k = rangeRecommendation.recommendedAskBins) !== null && _k !== void 0 ? _k : '-'));
                        }
                        else {
                            console.log("  \u2022 Recommended bins per side: ".concat((_l = rangeRecommendation.recommendedBinsPerSide) !== null && _l !== void 0 ? _l : '-'));
                        }
                        console.log("  \u2022 Range: ".concat(rangeRecommendation.minBinId, " \u2192 ").concat(rangeRecommendation.maxBinId));
                        console.log("  \u2022 Volatility score: ".concat(volPct, "% | Oracle deviation: ").concat(devPct, "%"));
                        rangeRecommendation.rationale.forEach(function (note) {
                            console.log("     - ".concat(note));
                        });
                        console.log();
                    }
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'confirm',
                            name: 'useVpvrRecommendation',
                            message: 'Use VPVR-guided range (recommended) instead of symmetric range?',
                            default: true,
                        })];
                case 30:
                    toggleAnswer = _q.sent();
                    useVpvrRecommendation = toggleAnswer.useVpvrRecommendation;
                    _q.label = 31;
                case 31:
                    getDefaultBinsPerSide = function (strategy) {
                        switch (strategy) {
                            case 'Curve':
                                return 2; // Concentrated liquidity for stablecoins (1-3 bins recommended)
                            case 'BidAsk':
                                return 25; // Spread distribution for volatile pairs (20-30 bins recommended)
                            case 'Spot':
                            default:
                                return 20; // Balanced distribution (standard default)
                        }
                    };
                    minBinId = void 0;
                    maxBinId = void 0;
                    binsPerSide = void 0;
                    centerBinOverride = void 0;
                    if (!(strategyAnswers.strategy === 'BidAsk')) return [3 /*break*/, 33];
                    console.log(chalk_1.default.blue("\nCurrent Active Bin: ".concat(poolInfo_1.activeBin)));
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'number',
                                name: 'minBinId',
                                message: 'Enter minimum bin ID:',
                                default: useVpvrRecommendation && (rangeRecommendation === null || rangeRecommendation === void 0 ? void 0 : rangeRecommendation.minBinId) !== undefined
                                    ? rangeRecommendation.minBinId
                                    : poolInfo_1.activeBin - 20,
                            },
                            {
                                type: 'number',
                                name: 'maxBinId',
                                message: 'Enter maximum bin ID:',
                                default: useVpvrRecommendation && (rangeRecommendation === null || rangeRecommendation === void 0 ? void 0 : rangeRecommendation.maxBinId) !== undefined
                                    ? rangeRecommendation.maxBinId
                                    : poolInfo_1.activeBin + 20,
                            },
                        ])];
                case 32:
                    rangeAnswers = _q.sent();
                    minBinId = rangeAnswers.minBinId;
                    maxBinId = rangeAnswers.maxBinId;
                    centerBinOverride = useVpvrRecommendation
                        ? (_m = rangeRecommendation === null || rangeRecommendation === void 0 ? void 0 : rangeRecommendation.centerBin) !== null && _m !== void 0 ? _m : poolInfo_1.activeBin
                        : poolInfo_1.activeBin;
                    return [3 /*break*/, 35];
                case 33:
                    defaultBinsPerSide = (_o = rangeRecommendation === null || rangeRecommendation === void 0 ? void 0 : rangeRecommendation.recommendedBinsPerSide) !== null && _o !== void 0 ? _o : getDefaultBinsPerSide(strategyAnswers.strategy);
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'number',
                            name: 'binsPerSide',
                            message: 'Number of bins to each side of center:',
                            default: defaultBinsPerSide,
                            validate: function (value) {
                                if (value < 1)
                                    return 'Must be at least 1 bin';
                                if (value > 34)
                                    return 'Maximum 34 bins per side (69 total limit per DLMM protocol)';
                                return true;
                            },
                        })];
                case 34:
                    binsAnswers = _q.sent();
                    binsPerSide = binsAnswers.binsPerSide;
                    binsValue = binsPerSide !== null && binsPerSide !== void 0 ? binsPerSide : defaultBinsPerSide;
                    suggestedCenter = useVpvrRecommendation
                        ? (_p = rangeRecommendation === null || rangeRecommendation === void 0 ? void 0 : rangeRecommendation.centerBin) !== null && _p !== void 0 ? _p : poolInfo_1.activeBin
                        : poolInfo_1.activeBin;
                    centerBinOverride = suggestedCenter;
                    minBinId = suggestedCenter - binsValue;
                    maxBinId = suggestedCenter + binsValue;
                    _q.label = 35;
                case 35:
                    // Step 4: Enter X Token Amount (ENHANCED with auto Y calculation)
                    console.log(chalk_1.default.yellow("\n\uD83D\uDCB0 Enter deposit amount:"));
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'number',
                                name: 'amountX',
                                message: "Amount of ".concat(poolInfo_1.tokenX.symbol, " to deposit:"),
                                validate: function (value) { return value > 0 ? true : 'Amount must be greater than 0'; },
                            }
                        ])];
                case 36:
                    amountXAnswer = _q.sent();
                    amountX = amountXAnswer.amountX;
                    // Step 5: AUTO-CALCULATE Y AMOUNT (CRITICAL ENHANCEMENT)
                    console.log(chalk_1.default.blue.bold('\n🧮 Calculating optimal Y amount based on strategy...\n'));
                    amountY = 0;
                    _q.label = 37;
                case 37:
                    _q.trys.push([37, 46, , 48]);
                    strategyTypeEnum = strategyAnswers.strategy === 'Spot' ? dlmm_1.StrategyType.Spot :
                        strategyAnswers.strategy === 'Curve' ? dlmm_1.StrategyType.Curve : dlmm_1.StrategyType.BidAsk;
                    calcMinBinId = minBinId;
                    calcMaxBinId = maxBinId;
                    if (typeof calcMinBinId !== 'number' || typeof calcMaxBinId !== 'number') {
                        // For Spot/Curve strategies, calculate from binsPerSide
                        calcMinBinId = poolInfo_1.activeBin - (binsPerSide || 20);
                        calcMaxBinId = poolInfo_1.activeBin + (binsPerSide || 20);
                    }
                    return [4 /*yield*/, liquidity_service_1.liquidityService.calculateOptimalYAmount(poolAddress, amountX, calcMinBinId, calcMaxBinId, strategyTypeEnum)];
                case 38:
                    amountY = _q.sent();
                    console.log(chalk_1.default.green.bold('✅ Y Amount Calculated!\n'));
                    console.log(chalk_1.default.cyan("Auto-calculated ".concat(poolInfo_1.tokenY.symbol, ": ").concat(chalk_1.default.yellow(amountY.toFixed(6)))));
                    console.log(chalk_1.default.gray("(Based on ".concat(strategyAnswers.strategy, " strategy distribution)\n")));
                    return [4 /*yield*/, liquidity_service_1.liquidityService.checkPriceHealth(poolAddress)];
                case 39:
                    health = _q.sent();
                    if (!(!health.isHealthy && health.oraclePrice)) return [3 /*break*/, 41];
                    console.log(chalk_1.default.red.bold('\n⚠️  CRITICAL PRICE WARNING ⚠️'));
                    console.log(chalk_1.default.yellow("The pool price is significantly different from the Oracle price."));
                    console.log(chalk_1.default.yellow("Pool Price:   ".concat(health.poolPrice.toFixed(6))));
                    console.log(chalk_1.default.yellow("Oracle Price: ".concat(health.oraclePrice.toFixed(6))));
                    console.log(chalk_1.default.yellow("Deviation:    ".concat((health.deviation * 100).toFixed(0), "%")));
                    console.log(chalk_1.default.red("Providing liquidity at this price may result in immediate loss."));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'confirm',
                            name: 'confirmContinue',
                            message: 'Do you want to continue despite this warning?',
                            default: false
                        })];
                case 40:
                    confirmContinue = (_q.sent()).confirmContinue;
                    if (!confirmContinue) {
                        console.log(chalk_1.default.yellow('Operation cancelled by user.'));
                        return [2 /*return*/];
                    }
                    _q.label = 41;
                case 41:
                    impliedPrice = amountY / amountX;
                    activePrice = poolInfo_1.price || 1;
                    priceDev = Math.abs((impliedPrice - activePrice) / activePrice);
                    // If there's significant price deviation detected by Oracle, inform user
                    if (priceDev > 0.5) {
                        console.log(chalk_1.default.yellow.bold('⚠️  PRICE MISMATCH DETECTED!\n'));
                        console.log(chalk_1.default.yellow("   Pool Price: 1 ".concat(poolInfo_1.tokenX.symbol, " = ").concat(activePrice.toFixed(6), " ").concat(poolInfo_1.tokenY.symbol)));
                        console.log(chalk_1.default.yellow("   Oracle Price: 1 ".concat(poolInfo_1.tokenX.symbol, " = ").concat(impliedPrice.toFixed(6), " ").concat(poolInfo_1.tokenY.symbol)));
                        console.log(chalk_1.default.yellow("   Deviation: ".concat((priceDev * 100).toFixed(1), "%\n")));
                        console.log(chalk_1.default.gray('The Oracle integration has detected that the pool price differs'));
                        console.log(chalk_1.default.gray('significantly from the market price. The calculation above uses the'));
                        console.log(chalk_1.default.gray('Oracle price to ensure you deposit amounts that match market rates.\n'));
                    }
                    isSuspicious = amountY < 0.0001 || impliedPrice < 0.001;
                    if (!isSuspicious) return [3 /*break*/, 44];
                    console.log(chalk_1.default.yellow('⚠️  Warning: Calculated Y amount seems unusually small relative to X amount'));
                    console.log(chalk_1.default.yellow("   Implied price: 1 ".concat(poolInfo_1.tokenX.symbol, " = ").concat(impliedPrice.toFixed(8), " ").concat(poolInfo_1.tokenY.symbol)));
                    console.log(chalk_1.default.yellow("   This might indicate the pool data is inverted or in an extreme state.\n"));
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'confirm',
                                name: 'useManualEntry',
                                message: "Would you like to enter a different ".concat(poolInfo_1.tokenY.symbol, " amount manually?"),
                                default: true
                            }
                        ])];
                case 42:
                    useManualEntry = (_q.sent()).useManualEntry;
                    if (!useManualEntry) return [3 /*break*/, 44];
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'number',
                                name: 'amountY',
                                message: "Amount of ".concat(poolInfo_1.tokenY.symbol, " to deposit:"),
                                validate: function (value) { return value > 0 ? true : 'Amount must be greater than 0'; },
                            }
                        ])];
                case 43:
                    manualAnswer = _q.sent();
                    amountY = manualAnswer.amountY;
                    console.log(chalk_1.default.cyan("\n\u2705 Using manual entry: ".concat(amountY.toFixed(6), " ").concat(poolInfo_1.tokenY.symbol, "\n")));
                    _q.label = 44;
                case 44: return [4 /*yield*/, waitForUser()];
                case 45:
                    _q.sent();
                    return [3 /*break*/, 48];
                case 46:
                    error_8 = _q.sent();
                    console.log(chalk_1.default.yellow("\u26A0\uFE0F  Could not auto-calculate Y amount: ".concat(error_8)));
                    console.log(chalk_1.default.yellow("Please enter ".concat(poolInfo_1.tokenY.symbol, " amount manually.\n")));
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'number',
                                name: 'amountY',
                                message: "Amount of ".concat(poolInfo_1.tokenY.symbol, " to deposit:"),
                                validate: function (value) { return value > 0 ? true : 'Amount must be greater than 0'; },
                            }
                        ])];
                case 47:
                    amountYAnswer = _q.sent();
                    amountY = amountYAnswer.amountY;
                    return [3 /*break*/, 48];
                case 48:
                    // Step 5.5: ENHANCED - Validate Wallet Balance
                    console.log(chalk_1.default.blue.bold('\n🔍 Validating wallet balance...'));
                    _q.label = 49;
                case 49:
                    _q.trys.push([49, 61, , 63]);
                    keypair = wallet_service_1.walletService.getActiveKeypair();
                    if (!keypair) {
                        throw new Error('No active wallet found');
                    }
                    connection = connection_service_1.connectionService.getConnection();
                    tokenXMint = new web3_js_1.PublicKey(poolInfo_1.tokenX.mint);
                    tokenYMint = new web3_js_1.PublicKey(poolInfo_1.tokenY.mint);
                    return [4 /*yield*/, (0, balance_utils_1.getWalletBalances)(connection, keypair.publicKey, tokenXMint, tokenYMint)];
                case 50:
                    currentBalances = _q.sent();
                    printBalances = function (title, balances) {
                        console.log(chalk_1.default.cyan("\n".concat(title)));
                        console.log("   \u2022 SOL: ".concat(chalk_1.default.yellow(balances.solBalance.toFixed(4))));
                        console.log("   \u2022 ".concat(poolInfo_1.tokenX.symbol, ": ").concat(chalk_1.default.yellow(balances.tokenXBalance.toFixed(4))));
                        console.log("   \u2022 ".concat(poolInfo_1.tokenY.symbol, ": ").concat(chalk_1.default.yellow(balances.tokenYBalance.toFixed(4))));
                        console.log();
                    };
                    printBalances('📊 Current Wallet Balances:', currentBalances);
                    console.log(chalk_1.default.cyan('📋 Required Amounts:'));
                    console.log("   \u2022 ".concat(poolInfo_1.tokenX.symbol, ": ").concat(chalk_1.default.yellow(amountX.toFixed(6))));
                    console.log("   \u2022 ".concat(poolInfo_1.tokenY.symbol, ": ").concat(chalk_1.default.yellow(amountY.toFixed(6))));
                    console.log();
                    return [4 /*yield*/, (0, balance_utils_1.validateWalletBalance)(connection, keypair.publicKey, tokenXMint, tokenYMint, amountX, amountY)];
                case 51:
                    validationResult_1 = _q.sent();
                    showErrors = function () {
                        console.log(chalk_1.default.red.bold('❌ Insufficient Balance:'));
                        validationResult_1.errors.forEach(function (error) {
                            console.log(chalk_1.default.red("   \u2022 ".concat(error)));
                        });
                        console.log();
                    };
                    if (!validationResult_1.isValid) {
                        showErrors();
                    }
                    autoSwapPerformed = false;
                    _q.label = 52;
                case 52:
                    if (!!validationResult_1.isValid) return [3 /*break*/, 56];
                    return [4 /*yield*/, maybeHandleAutoSwapShortfalls({
                            poolInfo: poolInfo_1,
                            poolAddress: poolAddress,
                            amountX: amountX,
                            amountY: amountY,
                            balances: currentBalances,
                        })];
                case 53:
                    swapFixed = _q.sent();
                    if (!swapFixed) {
                        return [3 /*break*/, 56];
                    }
                    autoSwapPerformed = true;
                    console.log(chalk_1.default.cyan('\n🔁 Swap executed. Re-checking wallet balances...'));
                    return [4 /*yield*/, (0, balance_utils_1.getWalletBalances)(connection, keypair.publicKey, tokenXMint, tokenYMint)];
                case 54:
                    currentBalances = _q.sent();
                    printBalances('📊 Updated Wallet Balances:', currentBalances);
                    return [4 /*yield*/, (0, balance_utils_1.validateWalletBalance)(connection, keypair.publicKey, tokenXMint, tokenYMint, amountX, amountY)];
                case 55:
                    validationResult_1 = _q.sent();
                    if (!validationResult_1.isValid) {
                        console.log(chalk_1.default.red.bold('❌ Remaining shortfall detected:'));
                        validationResult_1.errors.forEach(function (error) {
                            console.log(chalk_1.default.red("   \u2022 ".concat(error)));
                        });
                        console.log();
                    }
                    return [3 /*break*/, 52];
                case 56:
                    if (!!validationResult_1.isValid) return [3 /*break*/, 58];
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'confirm',
                                name: 'continue',
                                message: 'Continue despite insufficient balance?',
                                default: false,
                            }])];
                case 57:
                    continueAnswer = _q.sent();
                    if (!continueAnswer.continue) {
                        console.log(chalk_1.default.yellow('📍 Position creation cancelled.'));
                        return [2 /*return*/];
                    }
                    return [3 /*break*/, 59];
                case 58:
                    if (validationResult_1.warnings.length > 0) {
                        console.log(chalk_1.default.yellow('⚠️  Warnings:'));
                        validationResult_1.warnings.forEach(function (warning) {
                            console.log(chalk_1.default.yellow("   ".concat(warning)));
                        });
                        if (autoSwapPerformed) {
                            console.log(chalk_1.default.yellow('   • Auto swap completed to balance tokens.'));
                        }
                        console.log();
                    }
                    else {
                        successMsg = autoSwapPerformed
                            ? '✅ Wallet balance validated after auto swap!'
                            : '✅ Wallet balance validated successfully!';
                        console.log(chalk_1.default.green(successMsg));
                        console.log();
                    }
                    _q.label = 59;
                case 59: return [4 /*yield*/, waitForUser()];
                case 60:
                    _q.sent();
                    return [3 /*break*/, 63];
                case 61:
                    error_9 = _q.sent();
                    console.log(chalk_1.default.yellow("\u26A0\uFE0F  Could not validate wallet balance: ".concat(error_9)));
                    console.log(chalk_1.default.yellow('   Proceeding with position creation...'));
                    console.log();
                    return [4 /*yield*/, waitForUser()];
                case 62:
                    _q.sent();
                    return [3 /*break*/, 63];
                case 63:
                    transactionConfig = config_manager_1.configManager.getConfig().transaction;
                    return [4 /*yield*/, promptTransactionOverrides(transactionConfig)];
                case 64:
                    _a = _q.sent(), sessionSlippage = _a.slippage, priorityFeeOptions = _a.priorityFeeOptions;
                    // Prepare position creation
                    console.log(chalk_1.default.yellow('\nCalculating position details...\n'));
                    positionParams = {
                        poolAddress: poolAddress,
                        strategy: strategyAnswers.strategy,
                        amountX: amountX,
                        amountY: amountY,
                        binsPerSide: binsPerSide,
                        minBinId: minBinId,
                        maxBinId: maxBinId,
                        centerBinOverride: centerBinOverride,
                        slippage: sessionSlippage,
                        priorityFeeOptions: priorityFeeOptions,
                    };
                    validation = position_service_1.positionService.validatePositionParams(positionParams, poolInfo_1);
                    if (!!validation.valid) return [3 /*break*/, 66];
                    console.log(chalk_1.default.red('❌ Validation errors:\n'));
                    validation.errors.forEach(function (err) { return console.log("  \u2022 ".concat(err)); });
                    console.log();
                    return [4 /*yield*/, waitForUser()];
                case 65:
                    _q.sent();
                    return [2 /*return*/];
                case 66: return [4 /*yield*/, position_service_1.positionService.preparePositionCreation(positionParams, poolInfo_1)];
                case 67:
                    prepared = _q.sent();
                    // ENHANCED Step 6: Preview Distribution with Cost & APR Analysis
                    console.log(chalk_1.default.green('\n✅ POSITION PREVIEW:\n'));
                    console.log(chalk_1.default.blue.bold('Strategy Configuration:'));
                    console.log("  Strategy: ".concat(prepared.rangeConfig.strategy));
                    console.log("  Bin Range: ".concat(prepared.rangeConfig.minBinId, " \u2192 ").concat(prepared.rangeConfig.maxBinId));
                    console.log("  Center Bin: ".concat(prepared.rangeConfig.centerBin));
                    if (rangeRecommendation) {
                        console.log(chalk_1.default.gray('  Range Rationale:'));
                        rangeRecommendation.rationale.forEach(function (note, idx) {
                            console.log(chalk_1.default.gray("    ".concat(idx + 1, ". ").concat(note)));
                        });
                        if (centerBinOverride && centerBinOverride !== poolInfo_1.activeBin) {
                            console.log(chalk_1.default.gray("    Shifted ".concat(centerBinOverride - poolInfo_1.activeBin, " bins from active center based on recommendation")));
                        }
                    }
                    formatPrice = function (price) {
                        if (price === 0)
                            return '0.000000';
                        if (price < 1e-6)
                            return price.toExponential(3);
                        if (price > 1e6)
                            return price.toExponential(3);
                        return price.toFixed(6);
                    };
                    console.log("  Price Range: ".concat(formatPrice(prepared.rangeConfig.binPrice.minPrice), " - ").concat(formatPrice(prepared.rangeConfig.binPrice.maxPrice), "\n"));
                    console.log(chalk_1.default.blue.bold('Estimated Token Deposit:'));
                    console.log("  ".concat(poolInfo_1.tokenX.symbol, ": ").concat(prepared.tokenXAmount));
                    console.log("  ".concat(poolInfo_1.tokenY.symbol, ": ").concat(prepared.tokenYAmount, "\n"));
                    _q.label = 68;
                case 68:
                    _q.trys.push([68, 70, , 71]);
                    return [4 /*yield*/, fee_service_1.feeService.analyzePositionCosts(poolInfo_1, amountX, amountY)];
                case 69:
                    costAnalysis = _q.sent();
                    console.log(chalk_1.default.blue.bold('💰 Cost Breakdown:'));
                    console.log("  Rent (position account): ".concat(chalk_1.default.yellow("".concat(costAnalysis.rentCostSOL.toFixed(4), " SOL"))));
                    console.log("  Transaction Fees: ".concat(chalk_1.default.yellow("".concat(costAnalysis.transactionFeesSOL.toFixed(6), " SOL"))));
                    console.log("  Total Initial Cost: ".concat(chalk_1.default.cyan("".concat(costAnalysis.totalInitialCostSOL.toFixed(5), " SOL"))));
                    console.log();
                    console.log(chalk_1.default.blue.bold('📊 Liquidity Value & Returns:'));
                    usdValuePrefix = costAnalysis.isUsdEstimate ? '≈' : '';
                    console.log("  Position Value: ".concat(chalk_1.default.cyan("".concat(usdValuePrefix, "$").concat(costAnalysis.totalValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 }))), " USD"));
                    console.log("  (".concat(poolInfo_1.tokenX.symbol, ": $").concat(costAnalysis.tokenXValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 }), " | ").concat(poolInfo_1.tokenY.symbol, ": $").concat(costAnalysis.tokenYValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 }), ")"));
                    describeSource = {
                        oracle: 'oracle quote',
                        'pool-derived': 'derived via pool price',
                        missing: 'unavailable',
                    };
                    formatUsdInput = function (value) {
                        return value === null ? 'N/A' : "$".concat(value.toLocaleString(undefined, { maximumFractionDigits: value > 1 ? 4 : 6 }));
                    };
                    console.log(chalk_1.default.gray('  USD Inputs:'));
                    console.log(chalk_1.default.gray("    \u2022 ".concat(poolInfo_1.tokenX.symbol, ": ").concat(formatUsdInput(costAnalysis.tokenXUsdPrice), " (").concat(describeSource[costAnalysis.usdPriceSources.tokenX], ")")));
                    console.log(chalk_1.default.gray("    \u2022 ".concat(poolInfo_1.tokenY.symbol, ": ").concat(formatUsdInput(costAnalysis.tokenYUsdPrice), " (").concat(describeSource[costAnalysis.usdPriceSources.tokenY], ")")));
                    if (costAnalysis.usdValuationWarnings.length) {
                        console.log(chalk_1.default.yellow('  ⚠️  USD Valuation Notes:'));
                        costAnalysis.usdValuationWarnings.forEach(function (warning) {
                            return console.log(chalk_1.default.yellow("    \u2022 ".concat(warning)));
                        });
                    }
                    console.log();
                    console.log(chalk_1.default.blue.bold('📈 Estimated Annual APY:'));
                    console.log("  Annual: ".concat(chalk_1.default.magenta("".concat(costAnalysis.estimatedAnnualAPY.toFixed(2), "%"))));
                    console.log("  Monthly: ".concat(chalk_1.default.cyan("".concat(costAnalysis.estimatedMonthlyAPY.toFixed(2), "%"))));
                    console.log("  Weekly: ".concat(chalk_1.default.cyan("".concat(costAnalysis.estimatedWeeklyAPY.toFixed(2), "%"))));
                    console.log("  Daily: ".concat(chalk_1.default.cyan("".concat(costAnalysis.estimatedDailyAPY.toFixed(3), "%")), "\n"));
                    // Validation checklist
                    console.log(chalk_1.default.blue.bold('✓ Validation Checklist:'));
                    checks = [
                        { pass: costAnalysis.totalInitialCostSOL <= 0.25, msg: '✓ Position cost below 0.25 SOL' },
                        { pass: costAnalysis.totalValueUSD >= 25, msg: '✓ Position size at least $25' },
                        { pass: costAnalysis.hasFullOracleCoverage, msg: '✓ Oracle USD coverage confirmed' },
                        { pass: costAnalysis.estimatedAnnualAPY >= 5, msg: '✓ APY meets 5% minimum target' },
                        { pass: prepared.rangeConfig.maxBinId - prepared.rangeConfig.minBinId <= 69, msg: '✓ Within 69-bin protocol limit' },
                        { pass: poolInfo_1.isActive, msg: '✓ Pool is active' },
                    ];
                    checks.forEach(function (check, idx) {
                        if (check.pass) {
                            console.log(chalk_1.default.green("  ".concat(idx + 1, ". ").concat(check.msg)));
                        }
                        else {
                            console.log(chalk_1.default.yellow("  ".concat(idx + 1, ". \u26A0\uFE0F  ").concat(check.msg)));
                        }
                    });
                    console.log();
                    return [3 /*break*/, 71];
                case 70:
                    error_10 = _q.sent();
                    console.log(chalk_1.default.yellow("\u26A0\uFE0F  Could not calculate cost analysis: ".concat(error_10, "\n")));
                    return [3 /*break*/, 71];
                case 71: return [4 /*yield*/, inquirer_1.default.prompt({
                        type: 'confirm',
                        name: 'confirm',
                        message: 'Create position with these settings?',
                        default: false,
                    })];
                case 72:
                    confirmAnswers = _q.sent();
                    if (!!confirmAnswers.confirm) return [3 /*break*/, 74];
                    console.log(chalk_1.default.yellow('\n❌ Position creation cancelled\n'));
                    return [4 /*yield*/, waitForUser()];
                case 73:
                    _q.sent();
                    return [2 /*return*/];
                case 74:
                    // ENHANCED Step 7: Execute with Progress Indicators & Error Handling
                    console.log(chalk_1.default.yellow('\n🔄 Creating position... (This requires signing a transaction)\n'));
                    progressSteps_1 = [
                        { msg: 'Preparing transaction', symbol: '⏳' },
                        { msg: 'Signing transaction', symbol: '🔑' },
                        { msg: 'Sending to network', symbol: '📡' },
                        { msg: 'Confirming transaction', symbol: '✅' }
                    ];
                    currentStep_1 = 0;
                    showProgress = function () {
                        if (currentStep_1 < progressSteps_1.length) {
                            var step = progressSteps_1[currentStep_1];
                            console.log(chalk_1.default.cyan("  ".concat(step.symbol, " ").concat(step.msg, "...")));
                        }
                    };
                    // Start showing progress
                    showProgress();
                    _q.label = 75;
                case 75:
                    _q.trys.push([75, 77, , 78]);
                    // Increment step
                    currentStep_1 = 1;
                    showProgress();
                    return [4 /*yield*/, position_service_1.positionService.executePositionCreation(positionParams, prepared)];
                case 76:
                    result = _q.sent();
                    if (result.status === 'success') {
                        // Show success
                        console.log(chalk_1.default.green("\n\u2705 Transaction Confirmed!\n"));
                        console.log(chalk_1.default.green.bold('✅ POSITION CREATED SUCCESSFULLY!\n'));
                        console.log(chalk_1.default.cyan('📍 Position Details:'));
                        console.log("   Address: ".concat(chalk_1.default.yellow(result.positionAddress)));
                        console.log("   Signature: ".concat(chalk_1.default.yellow(result.depositSignature.slice(0, 20)), "..."));
                        console.log("   Token X: ".concat(result.tokenXAmount.toFixed(6), " ").concat(poolInfo_1.tokenX.symbol));
                        console.log("   Token Y: ".concat(result.tokenYAmount.toFixed(6), " ").concat(poolInfo_1.tokenY.symbol));
                        console.log("   Range: ".concat(result.minBinId, " \u2192 ").concat(result.maxBinId));
                        console.log("   Strategy: ".concat(result.strategy, "\n"));
                        console.log(chalk_1.default.gray('💡 Use "My Positions" to view and manage this position.'));
                        console.log(chalk_1.default.gray('💡 Use "Monitor Positions" to track performance.\n'));
                        // Optionally save to local storage (Phase 3 feature)
                        try {
                            // This could be extended to save position data locally
                            // await analyticsDataStore.recordPositionCreated({ ... });
                        }
                        catch (e) {
                            // Silent fail if storage not available
                        }
                    }
                    else {
                        console.log(chalk_1.default.red.bold('\n❌ POSITION CREATION FAILED\n'));
                        console.log(chalk_1.default.red('Error Details:'));
                        errorMsg = result.errorMessage || 'Unknown error';
                        if (errorMsg.includes('insufficient funds')) {
                            console.log(chalk_1.default.red('   • Insufficient funds to complete the transaction'));
                            console.log(chalk_1.default.yellow('   💡 Tip: Add more SOL or reduce deposit amounts'));
                        }
                        else if (errorMsg.includes('slippage')) {
                            console.log(chalk_1.default.red('   • Price slippage exceeded tolerance'));
                            console.log(chalk_1.default.yellow('   💡 Tip: Try again or increase slippage tolerance'));
                        }
                        else if (errorMsg.includes('timeout')) {
                            console.log(chalk_1.default.red('   • Transaction confirmation timed out'));
                            console.log(chalk_1.default.yellow('   💡 Tip: Network may be congested. Try again in a moment.'));
                        }
                        else if (errorMsg.includes('invalid')) {
                            console.log(chalk_1.default.red('   • Invalid transaction parameters'));
                            console.log(chalk_1.default.yellow('   💡 Tip: Check your inputs and pool configuration'));
                        }
                        else {
                            console.log(chalk_1.default.red("   \u2022 ".concat(errorMsg)));
                        }
                        console.log();
                    }
                    return [3 /*break*/, 78];
                case 77:
                    error_11 = _q.sent();
                    // Handle unexpected errors
                    console.log(chalk_1.default.red.bold('\n❌ UNEXPECTED ERROR\n'));
                    console.log(chalk_1.default.red('Error Details:'));
                    errorMsg = error_11 instanceof Error ? error_11.message : String(error_11);
                    if (errorMsg.includes('User rejected')) {
                        console.log(chalk_1.default.red('   • Transaction signing cancelled by user'));
                    }
                    else if (errorMsg.includes('network')) {
                        console.log(chalk_1.default.red('   • Network connection error'));
                        console.log(chalk_1.default.yellow('   💡 Tip: Check your internet connection'));
                    }
                    else if (errorMsg.includes('wallet')) {
                        console.log(chalk_1.default.red('   • Wallet configuration error'));
                        console.log(chalk_1.default.yellow('   💡 Tip: Verify your wallet is properly configured'));
                    }
                    else {
                        console.log(chalk_1.default.red("   \u2022 ".concat(errorMsg)));
                    }
                    console.log(chalk_1.default.gray('\n📋 For support, check the docs or retry the operation.\n'));
                    return [3 /*break*/, 78];
                case 78: return [3 /*break*/, 80];
                case 79:
                    error_12 = _q.sent();
                    console.log(chalk_1.default.red("\n\u274C Outer error: ".concat(error_12, "\n")));
                    return [3 /*break*/, 80];
                case 80: return [4 /*yield*/, waitForUser()];
                case 81:
                    _q.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function managePositionMenu(position) {
    return __awaiter(this, void 0, void 0, function () {
        var action;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    console.clear();
                    console.log(chalk_1.default.blue.bold("\uD83D\uDD27 MANAGING POSITION: ".concat(position.publicKey.slice(0, 8), "...")));
                    console.log("Pool: ".concat(position.tokenX.symbol, "/").concat(position.tokenY.symbol));
                    console.log("Range: ".concat(position.lowerBinId, " - ").concat(position.upperBinId));
                    console.log("Liquidity: ".concat(((_a = position.tokenX.uiAmount) === null || _a === void 0 ? void 0 : _a.toFixed(6)) || 0, " ").concat(position.tokenX.symbol, " / ").concat(((_b = position.tokenY.uiAmount) === null || _b === void 0 ? void 0 : _b.toFixed(6)) || 0, " ").concat(position.tokenY.symbol));
                    console.log("Unclaimed Fees: ".concat(((_c = position.unclaimedFees.xUi) === null || _c === void 0 ? void 0 : _c.toFixed(6)) || 0, " ").concat(position.tokenX.symbol, " / ").concat(((_d = position.unclaimedFees.yUi) === null || _d === void 0 ? void 0 : _d.toFixed(6)) || 0, " ").concat(position.tokenY.symbol, "\n"));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'action',
                            message: 'Choose action:',
                            choices: [
                                // '➕ Add Liquidity (Not implemented in CLI yet)',
                                '➖ Remove Liquidity',
                                '🚫 Close Position',
                                '🔙 Back'
                            ]
                        })];
                case 1:
                    action = (_e.sent()).action;
                    if (!action.includes('Remove Liquidity')) return [3 /*break*/, 3];
                    return [4 /*yield*/, removeLiquidityWorkflow(position)];
                case 2:
                    _e.sent();
                    return [3 /*break*/, 5];
                case 3:
                    if (!action.includes('Close Position')) return [3 /*break*/, 5];
                    return [4 /*yield*/, closePositionWorkflow(position)];
                case 4:
                    _e.sent();
                    _e.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
function removeLiquidityWorkflow(position) {
    return __awaiter(this, void 0, void 0, function () {
        var percent, bps, confirm, activeWallet, shouldClose, sigs, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n➖ REMOVE LIQUIDITY\n'));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'number',
                            name: 'percent',
                            message: 'Enter percentage to remove (1-100):',
                            validate: function (val) { return val > 0 && val <= 100 ? true : 'Enter 1-100'; }
                        })];
                case 1:
                    percent = (_a.sent()).percent;
                    bps = Math.floor(percent * 100);
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'confirm',
                            name: 'confirm',
                            message: "Remove ".concat(percent, "% liquidity from this position?"),
                            default: false
                        })];
                case 2:
                    confirm = (_a.sent()).confirm;
                    if (!confirm)
                        return [2 /*return*/];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 6, , 8]);
                    console.log(chalk_1.default.yellow('Removing liquidity...'));
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!activeWallet)
                        throw new Error("No active wallet");
                    shouldClose = percent === 100;
                    return [4 /*yield*/, liquidity_service_1.liquidityService.removeLiquidity({
                            positionPubKey: new web3_js_1.PublicKey(position.publicKey),
                            poolAddress: position.poolAddress,
                            userPublicKey: new web3_js_1.PublicKey(activeWallet.publicKey),
                            bps: bps,
                            shouldClaimAndClose: shouldClose
                        })];
                case 4:
                    sigs = _a.sent();
                    console.log(chalk_1.default.green.bold('\n✅ LIQUIDITY REMOVED!'));
                    sigs.forEach(function (s) { return console.log("Sig: ".concat(s)); });
                    if (shouldClose) {
                        console.log(chalk_1.default.green('Position closed and rent reclaimed.'));
                    }
                    return [4 /*yield*/, waitForUser()];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 6:
                    e_1 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Failed: ".concat(e_1.message || e_1)));
                    return [4 /*yield*/, waitForUser()];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function feeClaimingMenu(positions) {
    return __awaiter(this, void 0, void 0, function () {
        var claimable, totalUsd, estimate, solCost, usdCost, error_13, action, confirm_1, selected, selected;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.clear();
                    console.log(chalk_1.default.blue.bold('💰 FEE CLAIMING CENTER'));
                    claimable = getClaimablePositions(positions);
                    if (!(claimable.length === 0)) return [3 /*break*/, 2];
                    console.log(chalk_1.default.yellow('\nNo claimable fees detected. Earn some fees first or refresh analytics.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    totalUsd = claimable.reduce(function (sum, pos) { var _a; return sum + ((_a = pos.unclaimedFees.usdValue) !== null && _a !== void 0 ? _a : 0); }, 0);
                    console.log(chalk_1.default.cyan("\nPending Positions: ".concat(claimable.length)));
                    console.log(chalk_1.default.cyan("Claimable USD: ".concat(formatUsd(totalUsd))));
                    claimable.forEach(function (pos, idx) {
                        var _a;
                        var ageLabel = describeFeeAge(pos);
                        console.log("\n".concat(idx + 1, ". ").concat(buildPositionLabel(pos)));
                        console.log("   Fees: ".concat(formatUsd((_a = pos.unclaimedFees.usdValue) !== null && _a !== void 0 ? _a : 0), " (").concat(formatFeeBreakdownForPosition(pos), ")"));
                        console.log("   Age: ".concat(ageLabel));
                    });
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, fee_service_1.feeService.estimateClaimCost(claimable.length)];
                case 4:
                    estimate = _a.sent();
                    solCost = "".concat(estimate.totalSol.toFixed(6), " SOL");
                    usdCost = estimate.totalUsd ? " (".concat(formatUsd(estimate.totalUsd), ")") : '';
                    console.log(chalk_1.default.gray("\n\u2699\uFE0F  Estimated Transaction Fees: ".concat(solCost).concat(usdCost)));
                    return [3 /*break*/, 6];
                case 5:
                    error_13 = _a.sent();
                    console.log(chalk_1.default.gray("\n\u2699\uFE0F  Unable to estimate transaction fees: ".concat(error_13 instanceof Error ? error_13.message : error_13)));
                    return [3 /*break*/, 6];
                case 6: return [4 /*yield*/, inquirer_1.default.prompt({
                        type: 'list',
                        name: 'action',
                        message: '\nChoose a fee action:',
                        choices: [
                            'Claim all pending fees',
                            'Claim fees for a specific position',
                            'Claim & compound a position',
                            '⬅️ Back'
                        ],
                    })];
                case 7:
                    action = (_a.sent()).action;
                    if (!action.includes('Claim all')) return [3 /*break*/, 12];
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'confirm',
                            name: 'confirm',
                            message: "Claim fees from ".concat(claimable.length, " positions now?"),
                            default: true,
                        })];
                case 8:
                    confirm_1 = (_a.sent()).confirm;
                    if (!!confirm_1) return [3 /*break*/, 10];
                    console.log(chalk_1.default.gray('\nBatch claim cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 9:
                    _a.sent();
                    return [2 /*return*/];
                case 10: return [4 /*yield*/, claimFeesForPositions(claimable)];
                case 11:
                    _a.sent();
                    return [2 /*return*/];
                case 12:
                    if (!action.includes('specific')) return [3 /*break*/, 15];
                    return [4 /*yield*/, promptForPositionSelection(claimable, 'Select a position to claim fees from:')];
                case 13:
                    selected = _a.sent();
                    if (!selected) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, claimFeesForSinglePosition(selected)];
                case 14:
                    _a.sent();
                    return [2 /*return*/];
                case 15:
                    if (!action.includes('compound')) return [3 /*break*/, 18];
                    return [4 /*yield*/, promptForPositionSelection(claimable, 'Select a position to claim & compound:')];
                case 16:
                    selected = _a.sent();
                    if (!selected) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, claimAndCompoundPositionMenu(selected)];
                case 17:
                    _a.sent();
                    return [2 /*return*/];
                case 18: return [2 /*return*/];
            }
        });
    });
}
function getClaimablePositions(positions) {
    return positions.filter(function (pos) {
        var _a, _b, _c;
        var usd = (_a = pos.unclaimedFees.usdValue) !== null && _a !== void 0 ? _a : 0;
        var feeX = (_b = pos.unclaimedFees.xUi) !== null && _b !== void 0 ? _b : 0;
        var feeY = (_c = pos.unclaimedFees.yUi) !== null && _c !== void 0 ? _c : 0;
        return usd > 0 || feeX > FEE_AMOUNT_EPSILON || feeY > FEE_AMOUNT_EPSILON;
    });
}
function buildPositionLabel(position) {
    var pair = "".concat(position.tokenX.symbol || 'TokenX', "/").concat(position.tokenY.symbol || 'TokenY');
    return "".concat(pair, " (").concat(position.publicKey.slice(0, 8), "...)");
}
function claimFeesForPositions(positions) {
    return __awaiter(this, void 0, void 0, function () {
        var requests, outcomes, error_14;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.yellow('\n🔄 Claiming fees...'));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    requests = positions.map(function (pos) { return ({
                        poolAddress: pos.poolAddress,
                        positionAddress: pos.publicKey,
                        method: 'manual',
                    }); });
                    return [4 /*yield*/, fee_service_1.feeService.claimFeesBatch(requests)];
                case 2:
                    outcomes = _a.sent();
                    renderBatchClaimOutcomes(outcomes);
                    return [3 /*break*/, 4];
                case 3:
                    error_14 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Batch claim failed: ".concat(error_14 instanceof Error ? error_14.message : error_14)));
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, waitForUser()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function claimFeesForSinglePosition(position) {
    return __awaiter(this, void 0, void 0, function () {
        var summary, error_15;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.yellow("\n\uD83D\uDD04 Claiming fees for ".concat(buildPositionLabel(position), "...")));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 6]);
                    return [4 /*yield*/, fee_service_1.feeService.claimFeesForPosition(position.poolAddress, new web3_js_1.PublicKey(position.publicKey), { method: 'manual' })];
                case 2:
                    summary = _a.sent();
                    renderFeeClaimSummary(summary);
                    return [4 /*yield*/, waitForUser()];
                case 3:
                    _a.sent();
                    return [2 /*return*/, summary];
                case 4:
                    error_15 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Claim failed: ".concat(error_15 instanceof Error ? error_15.message : error_15)));
                    return [4 /*yield*/, waitForUser()];
                case 5:
                    _a.sent();
                    return [2 /*return*/, null];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function renderFeeClaimSummary(summary) {
    console.log(chalk_1.default.green('\n✅ Fees claimed!'));
    var breakdown = [
        formatTokenAmount(summary.claimedX, summary.tokenXSymbol),
        formatTokenAmount(summary.claimedY, summary.tokenYSymbol),
    ].filter(Boolean).join(' + ');
    console.log("   Claimed: ".concat(breakdown));
    console.log("   USD Value: ".concat(formatUsd(summary.claimedUsd)));
    console.log("   Tx Cost: ".concat(summary.estimatedTxCostSol.toFixed(6), " SOL").concat(summary.estimatedTxCostUsd ? " (".concat(formatUsd(summary.estimatedTxCostUsd), ")") : ''));
    if (summary.signatures.length) {
        console.log('   Signatures:');
        summary.signatures.forEach(function (sig) { return console.log("      \u2022 ".concat(sig)); });
    }
}
function renderBatchClaimOutcomes(outcomes) {
    if (!outcomes.length) {
        console.log(chalk_1.default.gray('\nNo claim attempts were made.'));
        return;
    }
    var successTotals = { usd: 0, solCost: 0, positions: 0, tokenTotals: {} };
    outcomes.forEach(function (outcome, idx) {
        var prefix = outcome.success ? chalk_1.default.green('✓') : chalk_1.default.red('✗');
        var label = "".concat(prefix, " [").concat(idx + 1, "] ").concat(outcome.positionAddress.slice(0, 8), "...");
        if (outcome.success && outcome.summary) {
            var summary = outcome.summary;
            console.log("".concat(label, " \u2014 ").concat(formatUsd(summary.claimedUsd), " (").concat(formatTokenAmount(summary.claimedX, summary.tokenXSymbol), " / ").concat(formatTokenAmount(summary.claimedY, summary.tokenYSymbol), ")"));
            if (summary.signatures.length) {
                console.log("      Sig: ".concat(summary.signatures[summary.signatures.length - 1]));
            }
            successTotals.usd += summary.claimedUsd;
            successTotals.solCost += summary.estimatedTxCostSol;
            successTotals.positions += 1;
            if (summary.claimedX > 0) {
                successTotals.tokenTotals[summary.tokenXSymbol] = (successTotals.tokenTotals[summary.tokenXSymbol] || 0) + summary.claimedX;
            }
            if (summary.claimedY > 0) {
                successTotals.tokenTotals[summary.tokenYSymbol] = (successTotals.tokenTotals[summary.tokenYSymbol] || 0) + summary.claimedY;
            }
        }
        else {
            console.log("".concat(label, " \u2014 Failed after ").concat(outcome.attempts, " attempt(s): ").concat(outcome.error || 'Unknown error'));
        }
    });
    console.log(chalk_1.default.cyan('\nBatch Summary'));
    console.log("   Successful Positions: ".concat(successTotals.positions, "/").concat(outcomes.length));
    if (successTotals.positions > 0) {
        var tokenBreakdown = formatTokenTotals(successTotals.tokenTotals);
        console.log("   Total Fees: ".concat(formatUsd(successTotals.usd)).concat(tokenBreakdown ? " (".concat(tokenBreakdown, ")") : ''));
        console.log("   Gas Cost: ".concat(successTotals.solCost.toFixed(6), " SOL"));
    }
}
function formatTokenTotals(tokenTotals) {
    var entries = Object.entries(tokenTotals).filter(function (_a) {
        var amt = _a[1];
        return amt > 0;
    });
    if (!entries.length) {
        return '';
    }
    return entries.map(function (_a) {
        var symbol = _a[0], amt = _a[1];
        return "".concat(formatTokenAmount(amt, symbol));
    }).join(', ');
}
function claimAndCompoundPositionMenu(position) {
    return __awaiter(this, void 0, void 0, function () {
        var selection, overrides;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.clear();
                    console.log(chalk_1.default.blue.bold('🔁 CLAIM & COMPOUND'));
                    console.log(chalk_1.default.gray("Position: ".concat(buildPositionLabel(position))));
                    console.log("Unclaimed Fees: ".concat(formatUsd((_a = position.unclaimedFees.usdValue) !== null && _a !== void 0 ? _a : 0), " (").concat(formatFeeBreakdownForPosition(position), ")"));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'selection',
                            message: 'Choose compounding action:',
                            choices: [
                                'Claim fees only',
                                'Claim & compound (100%)',
                                'Claim & compound (custom ratio)',
                                '⬅️ Back'
                            ],
                        })];
                case 1:
                    selection = (_b.sent()).selection;
                    if (selection.includes('Back')) {
                        return [2 /*return*/];
                    }
                    if (!selection.includes('fees only')) return [3 /*break*/, 3];
                    return [4 /*yield*/, claimFeesForSinglePosition(position)];
                case 2:
                    _b.sent();
                    return [2 /*return*/];
                case 3:
                    if (!selection.includes('custom')) return [3 /*break*/, 8];
                    return [4 /*yield*/, promptCompoundOverrides()];
                case 4:
                    overrides = _b.sent();
                    if (!!overrides) return [3 /*break*/, 6];
                    console.log(chalk_1.default.gray('Custom compounding cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 5:
                    _b.sent();
                    return [2 /*return*/];
                case 6: return [4 /*yield*/, executeCompoundFlow(position, {
                        tokenPercentOverrides: overrides,
                    })];
                case 7:
                    _b.sent();
                    return [2 /*return*/];
                case 8: return [4 /*yield*/, executeCompoundFlow(position, { compoundPercent: 100 })];
                case 9:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function executeCompoundFlow(position, params) {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_16;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.yellow('\n🔄 Claiming fees and redepositing...'));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, compounding_service_1.compoundingService.claimAndCompound({
                            poolAddress: position.poolAddress,
                            positionAddress: position.publicKey,
                            compoundPercent: params.compoundPercent,
                            tokenPercentOverrides: params.tokenPercentOverrides,
                            method: 'manual',
                        })];
                case 2:
                    result = _a.sent();
                    renderCompoundResult(result);
                    return [3 /*break*/, 4];
                case 3:
                    error_16 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Compound failed: ".concat(error_16 instanceof Error ? error_16.message : error_16)));
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, waitForUser()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function promptCompoundOverrides() {
    return __awaiter(this, void 0, void 0, function () {
        var answers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, inquirer_1.default.prompt([
                        {
                            type: 'number',
                            name: 'tokenXPercent',
                            message: 'Percent of token X fees to reinvest (0-100):',
                            default: 100,
                            validate: function (value) { return (value >= 0 && value <= 100) ? true : 'Enter a value between 0 and 100'; },
                        },
                        {
                            type: 'number',
                            name: 'tokenYPercent',
                            message: 'Percent of token Y fees to reinvest (0-100):',
                            default: 100,
                            validate: function (value) { return (value >= 0 && value <= 100) ? true : 'Enter a value between 0 and 100'; },
                        },
                    ])];
                case 1:
                    answers = _a.sent();
                    return [2 /*return*/, {
                            tokenXPercent: answers.tokenXPercent,
                            tokenYPercent: answers.tokenYPercent,
                        }];
            }
        });
    });
}
function renderCompoundResult(result) {
    renderFeeClaimSummary(result.claimed);
    if (!result.compounded) {
        console.log(chalk_1.default.yellow("\n\u26A0\uFE0F  Fees were claimed but not compounded: ".concat(result.skippedReason || 'No reason provided.')));
        return;
    }
    console.log(chalk_1.default.green('\n✅ Compounding complete!'));
    console.log("   Reinvested: ".concat(formatTokenAmount(result.reinvestedX, result.claimed.tokenXSymbol), " / ").concat(formatTokenAmount(result.reinvestedY, result.claimed.tokenYSymbol)));
    if (result.addLiquiditySignature) {
        console.log("   Liquidity tx: ".concat(result.addLiquiditySignature));
    }
}
function describeFeeAge(position) {
    var lastTimestamp = getLastFeeClaimTimestamp(position.publicKey);
    if (!lastTimestamp) {
        return 'Never claimed';
    }
    var delta = Date.now() - lastTimestamp;
    return "".concat(formatRelativeDuration(delta), " since last claim");
}
function getLastFeeClaimTimestamp(positionAddress) {
    var _a;
    try {
        var claims = (_a = analyticsStore === null || analyticsStore === void 0 ? void 0 : analyticsStore.getPositionFeeClaims(positionAddress, 120)) !== null && _a !== void 0 ? _a : [];
        if (!claims.length) {
            return null;
        }
        return claims[claims.length - 1].timestamp;
    }
    catch (_b) {
        return null;
    }
}
function formatRelativeDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) {
        return 'recently';
    }
    var minutes = Math.floor(ms / 60000);
    if (minutes < 60) {
        return "".concat(minutes, "m");
    }
    var hours = Math.floor(minutes / 60);
    if (hours < 24) {
        var remMinutes = minutes % 60;
        return "".concat(hours, "h ").concat(remMinutes, "m");
    }
    var days = Math.floor(hours / 24);
    var remHours = hours % 24;
    return "".concat(days, "d ").concat(remHours, "h");
}
function formatTokenAmount(amount, symbol) {
    var finalSymbol = symbol || 'Token';
    if (amount === 0) {
        return "0 ".concat(finalSymbol);
    }
    var decimals = amount >= 1 ? 4 : 6;
    return "".concat(amount.toFixed(decimals), " ").concat(finalSymbol);
}
function closePositionWorkflow(position) {
    return __awaiter(this, void 0, void 0, function () {
        var confirm, activeWallet, sigs, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n🚫 CLOSE POSITION\n'));
                    console.log(chalk_1.default.yellow('This will remove 100% liquidity, claim fees, and close the account to reclaim rent.'));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'confirm',
                            name: 'confirm',
                            message: 'Are you sure you want to close this position?',
                            default: false
                        })];
                case 1:
                    confirm = (_a.sent()).confirm;
                    if (!confirm)
                        return [2 /*return*/];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, , 7]);
                    console.log(chalk_1.default.yellow('Closing position...'));
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!activeWallet)
                        throw new Error("No active wallet");
                    return [4 /*yield*/, liquidity_service_1.liquidityService.removeLiquidity({
                            positionPubKey: new web3_js_1.PublicKey(position.publicKey),
                            poolAddress: position.poolAddress,
                            userPublicKey: new web3_js_1.PublicKey(activeWallet.publicKey),
                            bps: 10000, // 100%
                            shouldClaimAndClose: true
                        })];
                case 3:
                    sigs = _a.sent();
                    console.log(chalk_1.default.green.bold('\n✅ POSITION CLOSED!'));
                    sigs.forEach(function (s) { return console.log("Sig: ".concat(s)); });
                    return [4 /*yield*/, waitForUser()];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 5:
                    e_2 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Failed: ".concat(e_2.message || e_2)));
                    return [4 /*yield*/, waitForUser()];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function positionDetailMenu(position) {
    return __awaiter(this, void 0, void 0, function () {
        var poolInfo, error_17, status, tokenXAmount, tokenYAmount, feesUsd, snapshotRange, rangeSnapshots, firstSnapshot, latestSnapshot, sevenDaySnapshots, sevenDayDelta, feeClaims30d, lastFeeClaimEntry, totalFeeClaimsUsd30d, currentValueUsd, priceX, priceY, holdValueUsd, ilUsd, ilPercent, pnlUsd, pnlPercent, timeInRangePercent, tokenXSymbol, tokenYSymbol, deltaX, deltaY, ago, decimalsX_1, decimalsY_1, lines, detailAction;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        return __generator(this, function (_p) {
            switch (_p.label) {
                case 0:
                    console.clear();
                    console.log(chalk_1.default.blue.bold('📊 POSITION DETAIL'));
                    console.log(chalk_1.default.gray("Address: ".concat(position.publicKey)));
                    poolInfo = null;
                    _p.label = 1;
                case 1:
                    _p.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(position.poolAddress)];
                case 2:
                    poolInfo = _p.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_17 = _p.sent();
                    console.log(chalk_1.default.yellow("\n\u26A0\uFE0F  Unable to refresh pool metadata: ".concat((error_17 === null || error_17 === void 0 ? void 0 : error_17.message) || error_17)));
                    return [3 /*break*/, 4];
                case 4:
                    status = determineRangeStatus(position);
                    tokenXAmount = getUiAmount(position.tokenX);
                    tokenYAmount = getUiAmount(position.tokenY);
                    feesUsd = (_a = position.unclaimedFees.usdValue) !== null && _a !== void 0 ? _a : 0;
                    snapshotRange = analyticsStore === null || analyticsStore === void 0 ? void 0 : analyticsStore.getPositionSnapshotRange(position.publicKey, { days: 30 });
                    if (!(snapshotRange && snapshotRange.snapshots.length === 0)) return [3 /*break*/, 6];
                    return [4 /*yield*/, captureAnalyticsSnapshots([position], { silent: true, source: 'manual' })];
                case 5:
                    _p.sent();
                    snapshotRange = analyticsStore === null || analyticsStore === void 0 ? void 0 : analyticsStore.getPositionSnapshotRange(position.publicKey, { days: 30 });
                    _p.label = 6;
                case 6:
                    rangeSnapshots = (_b = snapshotRange === null || snapshotRange === void 0 ? void 0 : snapshotRange.snapshots) !== null && _b !== void 0 ? _b : [];
                    firstSnapshot = snapshotRange === null || snapshotRange === void 0 ? void 0 : snapshotRange.first;
                    latestSnapshot = snapshotRange === null || snapshotRange === void 0 ? void 0 : snapshotRange.latest;
                    sevenDaySnapshots = ((_c = analyticsStore === null || analyticsStore === void 0 ? void 0 : analyticsStore.getPositionSnapshots(position.publicKey, 7)) !== null && _c !== void 0 ? _c : [])
                        .sort(function (a, b) { return a.timestamp - b.timestamp; });
                    sevenDayDelta = sevenDaySnapshots.length >= 2
                        ? sevenDaySnapshots[sevenDaySnapshots.length - 1].usdValue - sevenDaySnapshots[0].usdValue
                        : undefined;
                    feeClaims30d = (_d = analyticsStore === null || analyticsStore === void 0 ? void 0 : analyticsStore.getPositionFeeClaims(position.publicKey, 30)) !== null && _d !== void 0 ? _d : [];
                    lastFeeClaimEntry = feeClaims30d.length ? feeClaims30d[feeClaims30d.length - 1] : undefined;
                    totalFeeClaimsUsd30d = feeClaims30d.reduce(function (sum, entry) { var _a; return sum + ((_a = entry.claimedUsd) !== null && _a !== void 0 ? _a : 0); }, 0);
                    currentValueUsd = (_e = position.totalValueUSD) !== null && _e !== void 0 ? _e : ((_f = position.tokenX.usdValue) !== null && _f !== void 0 ? _f : 0) + ((_g = position.tokenY.usdValue) !== null && _g !== void 0 ? _g : 0);
                    priceX = deriveTokenPrice(position.tokenX);
                    priceY = deriveTokenPrice(position.tokenY);
                    holdValueUsd = firstSnapshot && priceX !== undefined && priceY !== undefined
                        ? firstSnapshot.tokenXAmount * priceX + firstSnapshot.tokenYAmount * priceY
                        : undefined;
                    ilUsd = holdValueUsd !== undefined ? currentValueUsd - holdValueUsd : undefined;
                    ilPercent = holdValueUsd && holdValueUsd !== 0 ? (ilUsd / holdValueUsd) * 100 : undefined;
                    pnlUsd = firstSnapshot ? currentValueUsd + feesUsd - firstSnapshot.usdValue : undefined;
                    pnlPercent = firstSnapshot && firstSnapshot.usdValue !== 0
                        ? (pnlUsd / firstSnapshot.usdValue) * 100
                        : undefined;
                    timeInRangePercent = rangeSnapshots.length
                        ? (rangeSnapshots.filter(function (s) { return s.inRange; }).length / rangeSnapshots.length) * 100
                        : undefined;
                    console.log(chalk_1.default.yellow('\nOVERVIEW'));
                    console.log("   Pool: ".concat(position.tokenX.symbol || 'TokenX', "/").concat(position.tokenY.symbol || 'TokenY'));
                    console.log("   Pool Address: ".concat(position.poolAddress));
                    if (typeof (poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.apr) === 'number') {
                        console.log("   Pool APR: ".concat(poolInfo.apr.toFixed(2), "%"));
                    }
                    else if (position.poolApr !== undefined) {
                        console.log("   Pool APR: ".concat(position.poolApr.toFixed(2), "%"));
                    }
                    if (poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.price) {
                        console.log("   Spot Price: $".concat(poolInfo.price.toFixed(6)));
                    }
                    console.log(chalk_1.default.cyan('\nCURRENT STATUS'));
                    console.log("   Status: ".concat(formatRangeStatus(status)));
                    console.log("   Active Bin: ".concat(position.activeBinId));
                    console.log("   Range: ".concat(position.lowerBinId, " \u2192 ").concat(position.upperBinId));
                    console.log("   Pool Bin Step: ".concat((_j = (_h = poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.binStep) !== null && _h !== void 0 ? _h : position.binStep) !== null && _j !== void 0 ? _j : 'n/a'));
                    console.log(chalk_1.default.green('\nLIQUIDITY BREAKDOWN'));
                    tokenXSymbol = position.tokenX.symbol || 'X';
                    tokenYSymbol = position.tokenY.symbol || 'Y';
                    console.log("   ".concat(tokenXSymbol, ": ").concat(tokenXAmount.toFixed(6), " ").concat(tokenXSymbol, " (").concat(formatUsd(position.tokenX.usdValue), ")"));
                    if (firstSnapshot) {
                        deltaX = tokenXAmount - firstSnapshot.tokenXAmount;
                        console.log("      Start ".concat(tokenXSymbol, ": ").concat(firstSnapshot.tokenXAmount.toFixed(6), " | \u0394 ").concat(formatSignedNumber(deltaX)));
                    }
                    console.log("   ".concat(tokenYSymbol, ": ").concat(tokenYAmount.toFixed(6), " ").concat(tokenYSymbol, " (").concat(formatUsd(position.tokenY.usdValue), ")"));
                    if (firstSnapshot) {
                        deltaY = tokenYAmount - firstSnapshot.tokenYAmount;
                        console.log("      Start ".concat(tokenYSymbol, ": ").concat(firstSnapshot.tokenYAmount.toFixed(6), " | \u0394 ").concat(formatSignedNumber(deltaY)));
                    }
                    console.log("   Total Value: ".concat(formatUsd(currentValueUsd)));
                    if (firstSnapshot) {
                        console.log("      Initial Deposit: ".concat(formatUsd(firstSnapshot.usdValue)));
                    }
                    console.log(chalk_1.default.magenta('\nPERFORMANCE'));
                    console.log("   Unclaimed Fees: ".concat(formatUsd(feesUsd), " (").concat(formatFeeBreakdownForPosition(position), ")"));
                    if (position.poolApr !== undefined) {
                        console.log("   Position APR (pool): ".concat(position.poolApr.toFixed(2), "%"));
                    }
                    if (pnlUsd !== undefined) {
                        console.log("   30d P&L: ".concat(formatUsdWithSign(pnlUsd), " (").concat(formatPercent(pnlPercent), ")"));
                    }
                    else {
                        console.log('   30d P&L: Capture analytics snapshots to enable this metric.');
                    }
                    if (ilUsd !== undefined) {
                        console.log("   Impermanent Loss: ".concat(formatUsdWithSign(ilUsd), " (").concat(formatPercent(ilPercent), ")"));
                    }
                    else {
                        console.log('   Impermanent Loss: N/A (requires price data + snapshots)');
                    }
                    if (timeInRangePercent !== undefined) {
                        console.log("   Time In Range (30d): ".concat(timeInRangePercent.toFixed(1), "%"));
                    }
                    else {
                        console.log('   Time In Range (30d): Capture analytics snapshots to enable this metric.');
                    }
                    if (rangeSnapshots.length > 0 && latestSnapshot) {
                        console.log("   Snapshots (30d): ".concat(rangeSnapshots.length));
                        console.log("   Last Capture: ".concat(new Date(latestSnapshot.timestamp).toLocaleString()));
                    }
                    else {
                        console.log('   Snapshots: none captured yet (use "Refresh Analytics")');
                    }
                    if (sevenDayDelta !== undefined) {
                        console.log("   7d Value \u0394: ".concat(formatUsdWithSign(sevenDayDelta)));
                    }
                    if (lastFeeClaimEntry) {
                        ago = formatRelativeDuration(Date.now() - lastFeeClaimEntry.timestamp);
                        console.log("   Last Fee Claim: ".concat(formatUsd(lastFeeClaimEntry.claimedUsd), " (").concat(ago, " ago)"));
                    }
                    else {
                        console.log('   Last Fee Claim: No recorded claims yet.');
                    }
                    if (feeClaims30d.length) {
                        console.log("   30d Fee Claims: ".concat(formatUsd(totalFeeClaimsUsd30d), " across ").concat(feeClaims30d.length, " claim(s)"));
                    }
                    console.log(chalk_1.default.blue('\nBIN DISTRIBUTION MAP'));
                    if (poolInfo) {
                        decimalsX_1 = (_l = (_k = poolInfo.tokenX.decimals) !== null && _k !== void 0 ? _k : position.tokenX.decimals) !== null && _l !== void 0 ? _l : 6;
                        decimalsY_1 = (_o = (_m = poolInfo.tokenY.decimals) !== null && _m !== void 0 ? _m : position.tokenY.decimals) !== null && _o !== void 0 ? _o : 6;
                        lines = (0, visualization_helpers_1.buildAsciiBinDistribution)({
                            lowerBinId: position.lowerBinId,
                            upperBinId: position.upperBinId,
                            activeBinId: position.activeBinId,
                            totalValueUsd: position.totalValueUSD,
                            priceResolver: function (binId) { return pool_service_1.poolService.calculateBinPrice(binId, poolInfo.binStep, decimalsX_1, decimalsY_1); },
                        });
                        lines.forEach(function (line) { return console.log("   ".concat(line)); });
                    }
                    else {
                        console.log('   Unable to render map without pool metadata.');
                    }
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'detailAction',
                            message: 'Next action:',
                            choices: [
                                '⬅️ Back to Positions',
                                '💹 Claim / Compound Fees',
                                '♻️ Open Rebalance Tools',
                                '📈 Refresh Analytics Snapshots',
                            ],
                        })];
                case 7:
                    detailAction = (_p.sent()).detailAction;
                    if (!detailAction.includes('Claim')) return [3 /*break*/, 9];
                    return [4 /*yield*/, claimAndCompoundPositionMenu(position)];
                case 8:
                    _p.sent();
                    return [2 /*return*/];
                case 9:
                    if (!detailAction.includes('Rebalance')) return [3 /*break*/, 11];
                    return [4 /*yield*/, rebalanceAnalysisMenu(position)];
                case 10:
                    _p.sent();
                    return [2 /*return*/];
                case 11:
                    if (!detailAction.includes('Refresh')) return [3 /*break*/, 14];
                    return [4 /*yield*/, captureAnalyticsSnapshots([position], { source: 'manual' })];
                case 12:
                    _p.sent();
                    return [4 /*yield*/, positionDetailMenu(position)];
                case 13:
                    _p.sent();
                    return [2 /*return*/];
                case 14: return [2 /*return*/];
            }
        });
    });
}
function ensureRebalancingServiceInstance() {
    if (!rebalancing_service_1.rebalancingService) {
        return (0, rebalancing_service_1.initRebalancingService)(connection_service_1.connectionService.getConnection());
    }
    return rebalancing_service_1.rebalancingService;
}
function buildRebalancePreview(position, poolInfo, binsOverride) {
    var _a, _b, _c, _d, _e;
    var activeBin = (_a = poolInfo.activeBin) !== null && _a !== void 0 ? _a : position.activeBinId;
    var currentWidth = Math.max(6, Math.floor((position.upperBinId - position.lowerBinId) / 2));
    var binsPerSide = Math.min(binsOverride !== null && binsOverride !== void 0 ? binsOverride : Math.min(20, currentWidth), 34);
    var minBin = activeBin - binsPerSide;
    var maxBin = activeBin + binsPerSide;
    var minPrice;
    var maxPrice;
    try {
        var decimalsX = (_c = (_b = poolInfo.tokenX.decimals) !== null && _b !== void 0 ? _b : position.tokenX.decimals) !== null && _c !== void 0 ? _c : 6;
        var decimalsY = (_e = (_d = poolInfo.tokenY.decimals) !== null && _d !== void 0 ? _d : position.tokenY.decimals) !== null && _e !== void 0 ? _e : 6;
        minPrice = pool_service_1.poolService.calculateBinPrice(minBin, poolInfo.binStep, decimalsX, decimalsY);
        maxPrice = pool_service_1.poolService.calculateBinPrice(maxBin, poolInfo.binStep, decimalsX, decimalsY);
    }
    catch (_f) {
        // Silent fallback if price math fails
    }
    return {
        centerBin: activeBin,
        activeBin: activeBin,
        binsPerSide: binsPerSide,
        minBin: minBin,
        maxBin: maxBin,
        minPrice: minPrice,
        maxPrice: maxPrice,
    };
}
function mapReasonCodeFromStatus(status) {
    if (status === 'OUT_OF_RANGE')
        return 'OUT_OF_RANGE';
    if (status === 'EDGE_RANGE')
        return 'EFFICIENCY';
    return 'MANUAL';
}
function rebalanceAnalysisMenu(position) {
    return __awaiter(this, void 0, void 0, function () {
        var poolInfo, error_18, service, analysis, costBenefit, preview, error_19, quotePair, action;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!true) return [3 /*break*/, 18];
                    console.clear();
                    console.log(chalk_1.default.blue.bold('♻️ REBALANCE ANALYSIS'));
                    console.log(chalk_1.default.gray("Position: ".concat(position.publicKey)));
                    poolInfo = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(position.poolAddress)];
                case 2:
                    poolInfo = _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_18 = _a.sent();
                    console.log(chalk_1.default.yellow("\u26A0\uFE0F  Pool metadata unavailable: ".concat((error_18 === null || error_18 === void 0 ? void 0 : error_18.message) || error_18)));
                    return [3 /*break*/, 4];
                case 4:
                    service = ensureRebalancingServiceInstance();
                    analysis = null;
                    costBenefit = null;
                    preview = null;
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 8, , 9]);
                    return [4 /*yield*/, service.analyzeRebalanceNeeded(position, poolInfo !== null && poolInfo !== void 0 ? poolInfo : undefined)];
                case 6:
                    analysis = _a.sent();
                    return [4 /*yield*/, service.costBenefitAnalysis(position, poolInfo !== null && poolInfo !== void 0 ? poolInfo : undefined)];
                case 7:
                    costBenefit = _a.sent();
                    if (poolInfo) {
                        preview = buildRebalancePreview(position, poolInfo);
                    }
                    return [3 /*break*/, 9];
                case 8:
                    error_19 = _a.sent();
                    console.log(chalk_1.default.red("\u26A0\uFE0F  Failed to compute analysis: ".concat((error_19 === null || error_19 === void 0 ? void 0 : error_19.message) || error_19)));
                    return [3 /*break*/, 9];
                case 9:
                    if (analysis && costBenefit) {
                        console.log(chalk_1.default.cyan('\nCURRENT STATE'));
                        console.log("   Priority: ".concat(analysis.priority, " \u2014 ").concat(analysis.reason));
                        console.log("   In Range: ".concat(analysis.currentInRange ? 'Yes' : 'No', " (distance ").concat(analysis.distanceFromCenter, " bins)"));
                        console.log("   Recommendation: ".concat(analysis.recommendation));
                        console.log(chalk_1.default.magenta('\nCOST / BENEFIT'));
                        console.log("   Current Daily Fees: ".concat(formatUsd(costBenefit.currentDailyFees)));
                        console.log("   Projected Daily Fees: ".concat(formatUsd(costBenefit.projectedDailyFees)));
                        console.log("   Net Daily Gain: ".concat(formatUsd(costBenefit.netDailyGain)));
                        console.log("   Estimated Cost: ".concat(formatUsd(costBenefit.rebalanceCostUsd)));
                        console.log("   Break-even: ".concat(costBenefit.breakEvenLabel));
                        if (preview) {
                            console.log(chalk_1.default.green('\nSUGGESTED RANGE'));
                            console.log("   Range: ".concat(preview.minBin, " \u2192 ").concat(preview.maxBin, " (center ").concat(preview.centerBin, ", ").concat(preview.binsPerSide, " bins/side)"));
                            if (preview.minPrice && preview.maxPrice && poolInfo) {
                                quotePair = "".concat(poolInfo.tokenX.symbol || 'TokenX', "/").concat(poolInfo.tokenY.symbol || 'TokenY');
                                console.log("   Price Band (".concat(quotePair, "): ").concat(preview.minPrice.toFixed(6), " - ").concat(preview.maxPrice.toFixed(6)));
                            }
                        }
                    }
                    else {
                        console.log(chalk_1.default.yellow('\nAnalysis unavailable. Capture analytics snapshots and try again.'));
                    }
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'action',
                            message: 'Choose next step:',
                            choices: [
                                '🚀 Execute Suggested Rebalance',
                                '📜 View Rebalance History',
                                '🔁 Refresh Analysis',
                                '⬅️ Back to Positions',
                            ],
                        })];
                case 10:
                    action = (_a.sent()).action;
                    if (!action.includes('Execute')) return [3 /*break*/, 14];
                    if (!!preview) return [3 /*break*/, 12];
                    console.log(chalk_1.default.yellow('\nPool metadata required before executing a rebalance.'));
                    return [4 /*yield*/, waitForUser()];
                case 11:
                    _a.sent();
                    return [3 /*break*/, 0];
                case 12: return [4 /*yield*/, executeRebalanceFlow(position, preview)];
                case 13:
                    _a.sent();
                    return [2 /*return*/];
                case 14:
                    if (!action.includes('History')) return [3 /*break*/, 16];
                    return [4 /*yield*/, showRebalanceHistory(position)];
                case 15:
                    _a.sent();
                    return [3 /*break*/, 17];
                case 16:
                    if (action.includes('Refresh')) {
                        return [3 /*break*/, 0];
                    }
                    else {
                        return [2 /*return*/];
                    }
                    _a.label = 17;
                case 17: return [3 /*break*/, 0];
                case 18: return [2 /*return*/];
            }
        });
    });
}
function executeRebalanceFlow(position, preview) {
    return __awaiter(this, void 0, void 0, function () {
        var service, config, slippage, confirm, result, error_20;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    service = ensureRebalancingServiceInstance();
                    config = config_manager_1.configManager.getConfig();
                    slippage = (_b = (_a = config.transaction) === null || _a === void 0 ? void 0 : _a.slippage) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_CONFIG.SLIPPAGE;
                    console.clear();
                    console.log(chalk_1.default.blue.bold('🚀 EXECUTE REBALANCE'));
                    console.log("Position: ".concat(position.publicKey));
                    console.log("Target Range: ".concat(preview.minBin, " \u2192 ").concat(preview.maxBin, " (center ").concat(preview.centerBin, ")"));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'confirm',
                            name: 'confirm',
                            message: 'Remove liquidity and recreate the position in this range?',
                            default: true,
                        })];
                case 1:
                    confirm = (_d.sent()).confirm;
                    if (!!confirm) return [3 /*break*/, 3];
                    console.log(chalk_1.default.gray('\nOperation cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 2:
                    _d.sent();
                    return [2 /*return*/];
                case 3:
                    _d.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, service.executeRebalance(position, {
                            binsPerSide: preview.binsPerSide,
                            slippageBps: slippage,
                            reasonCode: mapReasonCodeFromStatus(determineRangeStatus(position)),
                            reason: "CLI-targeted range ".concat(preview.minBin, "\u2192").concat(preview.maxBin),
                        })];
                case 4:
                    result = _d.sent();
                    console.log(chalk_1.default.green('\n✅ Rebalance complete!'));
                    console.log("   Old Position: ".concat(result.oldPositionAddress));
                    console.log("   New Position: ".concat(result.newPositionAddress));
                    if ((_c = result.transactions) === null || _c === void 0 ? void 0 : _c.length) {
                        console.log('   Transactions:');
                        result.transactions.forEach(function (sig) { return console.log("      \u2022 ".concat(sig)); });
                    }
                    console.log(chalk_1.default.gray('\nTip: Re-open "My Positions" to refresh the list and load the new address.'));
                    return [3 /*break*/, 6];
                case 5:
                    error_20 = _d.sent();
                    console.log(chalk_1.default.red("\n\u274C Rebalance failed: ".concat((error_20 === null || error_20 === void 0 ? void 0 : error_20.message) || error_20)));
                    return [3 /*break*/, 6];
                case 6: return [4 /*yield*/, waitForUser()];
                case 7:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function showRebalanceHistory(position) {
    return __awaiter(this, void 0, void 0, function () {
        var history, recent;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.clear();
                    console.log(chalk_1.default.blue.bold('📜 REBALANCE HISTORY'));
                    console.log(chalk_1.default.gray("Position: ".concat(position.publicKey)));
                    history = (_a = analyticsStore === null || analyticsStore === void 0 ? void 0 : analyticsStore.getPositionRebalanceHistory(position.publicKey)) !== null && _a !== void 0 ? _a : [];
                    if (!!history.length) return [3 /*break*/, 2];
                    console.log(chalk_1.default.gray('\nNo recorded rebalances for this position yet.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _b.sent();
                    return [2 /*return*/];
                case 2:
                    recent = history.slice(-5).reverse();
                    recent.forEach(function (entry, idx) {
                        console.log("\n".concat(idx + 1, ". ").concat(new Date(entry.timestamp).toLocaleString(), " (").concat(entry.reasonCode, ")"));
                        console.log("   Old Range: ".concat(entry.oldRange.min, " \u2192 ").concat(entry.oldRange.max));
                        console.log("   New Range: ".concat(entry.newRange.min, " \u2192 ").concat(entry.newRange.max));
                        console.log("   Fees Claimed: ".concat(entry.feesClaimedUsd.toFixed(2), " USD"));
                        if (entry.signature) {
                            console.log("   Signature: ".concat(entry.signature));
                        }
                    });
                    return [4 /*yield*/, waitForUser()];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function promptForPositionSelection(positions, message) {
    return __awaiter(this, void 0, void 0, function () {
        var selectedPosition;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (positions.length === 0) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'selectedPosition',
                            message: message,
                            choices: positions.map(function (p, idx) { return ({
                                name: "".concat(idx + 1, ". ").concat(p.tokenX.symbol || 'TokenX', "/").concat(p.tokenY.symbol || 'TokenY', " (").concat(p.publicKey.slice(0, 8), "...)"),
                                value: p,
                            }); }),
                        })];
                case 1:
                    selectedPosition = (_a.sent()).selectedPosition;
                    return [2 /*return*/, selectedPosition];
            }
        });
    });
}
function determineRangeStatus(position) {
    if (position.activeBinId < position.lowerBinId || position.activeBinId > position.upperBinId) {
        return 'OUT_OF_RANGE';
    }
    if (position.activeBinId - position.lowerBinId <= EDGE_BUFFER_BINS ||
        position.upperBinId - position.activeBinId <= EDGE_BUFFER_BINS) {
        return 'EDGE_RANGE';
    }
    return 'IN_RANGE';
}
function formatRangeStatus(status) {
    switch (status) {
        case 'IN_RANGE':
            return chalk_1.default.green('🟢 IN-RANGE');
        case 'EDGE_RANGE':
            return chalk_1.default.yellow('⚠️  EDGE-RANGE');
        default:
            return chalk_1.default.red('🔴 OUT-OF-RANGE');
    }
}
function getUiAmount(token) {
    var _a;
    if (!token) {
        return 0;
    }
    if (typeof token.uiAmount === 'number') {
        return token.uiAmount;
    }
    var decimals = (_a = token.decimals) !== null && _a !== void 0 ? _a : 6;
    var raw = token.amount ? Number(token.amount) : 0;
    return raw / Math.pow(10, decimals);
}
function formatUsd(value) {
    if (value === undefined || Number.isNaN(value)) {
        return '$0.00';
    }
    var formatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return "$".concat(formatter.format(value));
}
function formatFeeBreakdownForPosition(position) {
    var parts = [];
    if (position.unclaimedFees.xUi && position.unclaimedFees.xUi > 0) {
        parts.push("".concat(position.unclaimedFees.xUi.toFixed(6), " ").concat(position.tokenX.symbol || 'X'));
    }
    if (position.unclaimedFees.yUi && position.unclaimedFees.yUi > 0) {
        parts.push("".concat(position.unclaimedFees.yUi.toFixed(6), " ").concat(position.tokenY.symbol || 'Y'));
    }
    return parts.length ? parts.join(' / ') : '0';
}
function formatFeeBreakdown(feesByToken) {
    var entries = Object.entries(feesByToken).filter(function (_a) {
        var value = _a[1];
        return value > 0;
    });
    if (entries.length === 0) {
        return '0';
    }
    return entries.map(function (_a) {
        var symbol = _a[0], amount = _a[1];
        return "".concat(amount.toFixed(4), " ").concat(symbol);
    }).join(', ');
}
function deriveTokenPrice(token) {
    if (!token) {
        return undefined;
    }
    if (typeof token.priceUsd === 'number' && token.priceUsd > 0) {
        return token.priceUsd;
    }
    if (typeof token.usdValue === 'number' && token.uiAmount && token.uiAmount > 0) {
        return token.usdValue / token.uiAmount;
    }
    return undefined;
}
function formatSignedNumber(value, decimals) {
    if (decimals === void 0) { decimals = 6; }
    if (value === undefined || Number.isNaN(value)) {
        return 'N/A';
    }
    var prefix = value > 0 ? '+' : value < 0 ? '-' : '';
    return "".concat(prefix).concat(Math.abs(value).toFixed(decimals));
}
function formatUsdWithSign(value) {
    if (value === undefined || Number.isNaN(value)) {
        return 'N/A';
    }
    if (value === 0) {
        return formatUsd(0);
    }
    var prefix = value > 0 ? '+' : '-';
    return "".concat(prefix).concat(formatUsd(Math.abs(value)));
}
function formatPercent(value, decimals) {
    if (decimals === void 0) { decimals = 2; }
    if (value === undefined || Number.isNaN(value)) {
        return 'N/A';
    }
    var prefix = value > 0 ? '+' : value < 0 ? '-' : '';
    return "".concat(prefix).concat(Math.abs(value).toFixed(decimals), "%");
}
function summarizePortfolioTotals(positions) {
    return positions.reduce(function (acc, pos) {
        var _a, _b;
        acc.valueUsd += (_a = pos.totalValueUSD) !== null && _a !== void 0 ? _a : 0;
        var feeUsd = (_b = pos.unclaimedFees.usdValue) !== null && _b !== void 0 ? _b : 0;
        acc.feesUsd += feeUsd;
        if (pos.unclaimedFees.xUi && pos.unclaimedFees.xUi > 0) {
            var symbol = pos.tokenX.symbol || 'TokenX';
            acc.feesByToken[symbol] = (acc.feesByToken[symbol] || 0) + pos.unclaimedFees.xUi;
        }
        if (pos.unclaimedFees.yUi && pos.unclaimedFees.yUi > 0) {
            var symbol = pos.tokenY.symbol || 'TokenY';
            acc.feesByToken[symbol] = (acc.feesByToken[symbol] || 0) + pos.unclaimedFees.yUi;
        }
        return acc;
    }, { valueUsd: 0, feesUsd: 0, feesByToken: {} });
}
function promptTransactionOverrides(transactionConfig) {
    return __awaiter(this, void 0, void 0, function () {
        var defaultSlippage, defaultPriorityMode, amount, multiplier, customize, slippage, priorityMode, priorityFeeOptions, fee, multiplier;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    defaultSlippage = (_a = transactionConfig === null || transactionConfig === void 0 ? void 0 : transactionConfig.slippage) !== null && _a !== void 0 ? _a : constants_1.DEFAULT_CONFIG.SLIPPAGE;
                    defaultPriorityMode = (_b = transactionConfig === null || transactionConfig === void 0 ? void 0 : transactionConfig.priorityFee) !== null && _b !== void 0 ? _b : 'dynamic';
                    console.log(chalk_1.default.cyan('\nTRANSACTION SETTINGS'));
                    console.log("   Default slippage: ".concat(defaultSlippage.toFixed(2), "%"));
                    if (defaultPriorityMode === 'fixed') {
                        amount = (_c = transactionConfig === null || transactionConfig === void 0 ? void 0 : transactionConfig.priorityFeeAmount) !== null && _c !== void 0 ? _c : 0;
                        console.log("   Priority fee: Fixed (".concat(amount, " \u00B5-lamports per CU)"));
                    }
                    else {
                        multiplier = (_d = transactionConfig === null || transactionConfig === void 0 ? void 0 : transactionConfig.priorityFeeMultiplier) !== null && _d !== void 0 ? _d : constants_1.DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER;
                        console.log("   Priority fee: Dynamic (x".concat(multiplier.toFixed(2), " of median)"));
                    }
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'confirm',
                            name: 'customize',
                            message: 'Adjust slippage/priority fee for this position?',
                            default: false,
                        })];
                case 1:
                    customize = (_g.sent()).customize;
                    if (!customize) {
                        return [2 /*return*/, { slippage: defaultSlippage }];
                    }
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'number',
                            name: 'slippage',
                            message: 'Set slippage (%) for this transaction:',
                            default: defaultSlippage,
                            validate: function (value) { return (value > 0 && value <= 5 ? true : 'Enter a value between 0 and 5'); },
                        })];
                case 2:
                    slippage = (_g.sent()).slippage;
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'priorityMode',
                            message: 'Select priority fee mode for this transaction:',
                            default: defaultPriorityMode,
                            choices: [
                                { name: 'Dynamic (median-based)', value: 'dynamic' },
                                { name: 'Fixed (manual microLamports)', value: 'fixed' },
                            ],
                        })];
                case 3:
                    priorityMode = (_g.sent()).priorityMode;
                    if (!(priorityMode === 'fixed')) return [3 /*break*/, 5];
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'number',
                            name: 'fee',
                            message: 'MicroLamports per compute unit:',
                            default: (_e = transactionConfig === null || transactionConfig === void 0 ? void 0 : transactionConfig.priorityFeeAmount) !== null && _e !== void 0 ? _e : 1000,
                            validate: function (value) { return (value > 0 ? true : 'Enter a positive number'); },
                        })];
                case 4:
                    fee = (_g.sent()).fee;
                    priorityFeeOptions = { mode: 'fixed', microLamports: fee };
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, inquirer_1.default.prompt({
                        type: 'number',
                        name: 'multiplier',
                        message: 'Dynamic multiplier (applied to median priority fee):',
                        default: (_f = transactionConfig === null || transactionConfig === void 0 ? void 0 : transactionConfig.priorityFeeMultiplier) !== null && _f !== void 0 ? _f : constants_1.DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER,
                        validate: function (value) { return (value > 0 ? true : 'Enter a positive number'); },
                    })];
                case 6:
                    multiplier = (_g.sent()).multiplier;
                    priorityFeeOptions = { mode: 'dynamic', multiplier: multiplier };
                    _g.label = 7;
                case 7: return [2 /*return*/, { slippage: slippage, priorityFeeOptions: priorityFeeOptions }];
            }
        });
    });
}
function captureAnalyticsSnapshots(positions, options) {
    return __awaiter(this, void 0, void 0, function () {
        var silent, poolCache, _i, positions_1, position, poolInfo, snapshot, error_21;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    silent = (_a = options === null || options === void 0 ? void 0 : options.silent) !== null && _a !== void 0 ? _a : false;
                    if (!(positions.length === 0)) return [3 /*break*/, 3];
                    if (!!silent) return [3 /*break*/, 2];
                    console.log(chalk_1.default.yellow('\n⚠️  No positions found for analytics capture.'));
                    return [4 /*yield*/, waitForUser()];
                case 1:
                    _b.sent();
                    _b.label = 2;
                case 2: return [2 /*return*/];
                case 3:
                    if (!silent) {
                        console.log(chalk_1.default.yellow('\n📈 Capturing analytics snapshots...'));
                    }
                    poolCache = new Map();
                    _i = 0, positions_1 = positions;
                    _b.label = 4;
                case 4:
                    if (!(_i < positions_1.length)) return [3 /*break*/, 9];
                    position = positions_1[_i];
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, getCachedPoolInfo(position.poolAddress, poolCache)];
                case 6:
                    poolInfo = _b.sent();
                    snapshot = buildSnapshotFromPosition(position, poolInfo);
                    analyticsStore.recordSnapshot(snapshot);
                    if (!silent) {
                        console.log(chalk_1.default.gray("   \u2022 Snapshot recorded for ".concat(position.publicKey.slice(0, 8), "...")));
                    }
                    return [3 /*break*/, 8];
                case 7:
                    error_21 = _b.sent();
                    if (!silent) {
                        console.log(chalk_1.default.red("   \u2022 Failed snapshot for ".concat(position.publicKey.slice(0, 8), "...: ").concat((error_21 === null || error_21 === void 0 ? void 0 : error_21.message) || error_21)));
                    }
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 4];
                case 9:
                    if (!!silent) return [3 /*break*/, 11];
                    console.log(chalk_1.default.green('\n✓ Analytics snapshots updated.'));
                    return [4 /*yield*/, waitForUser()];
                case 10:
                    _b.sent();
                    _b.label = 11;
                case 11: return [2 /*return*/];
            }
        });
    });
}
function autoCaptureSnapshots() {
    return __awaiter(this, void 0, void 0, function () {
        var activeWallet, positions, error_22;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!activeWallet) {
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, position_service_1.positionService.getAllPositions(activeWallet.publicKey)];
                case 2:
                    positions = _a.sent();
                    if (positions.length === 0) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, captureAnalyticsSnapshots(positions, { silent: true, source: 'auto' })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_22 = _a.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function ensureSnapshotScheduler() {
    if (analyticsSnapshotTimer) {
        return;
    }
    analyticsSnapshotTimer = setInterval(function () {
        autoCaptureSnapshots().catch(function () { return undefined; });
    }, SNAPSHOT_INTERVAL_MS);
}
function getCachedPoolInfo(poolAddress, cache) {
    return __awaiter(this, void 0, void 0, function () {
        var info;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (cache.has(poolAddress)) {
                        return [2 /*return*/, cache.get(poolAddress)];
                    }
                    return [4 /*yield*/, pool_service_1.poolService.getPoolInfo(poolAddress)];
                case 1:
                    info = _a.sent();
                    cache.set(poolAddress, info);
                    return [2 /*return*/, info];
            }
        });
    });
}
function buildSnapshotFromPosition(position, poolInfo) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var tokenXAmount = getUiAmount(position.tokenX);
    var tokenYAmount = getUiAmount(position.tokenY);
    var tokenXPrice = (_a = position.tokenX.priceUsd) !== null && _a !== void 0 ? _a : 0;
    var tokenYPrice = (_b = position.tokenY.priceUsd) !== null && _b !== void 0 ? _b : 0;
    var feeXAmount = (_c = position.unclaimedFees.xUi) !== null && _c !== void 0 ? _c : 0;
    var feeYAmount = (_d = position.unclaimedFees.yUi) !== null && _d !== void 0 ? _d : 0;
    var feesUsdValue = (_e = position.unclaimedFees.usdValue) !== null && _e !== void 0 ? _e : (feeXAmount * tokenXPrice + feeYAmount * tokenYPrice);
    return {
        timestamp: Date.now(),
        positionAddress: position.publicKey,
        poolAddress: position.poolAddress,
        tokenXAmount: tokenXAmount,
        tokenYAmount: tokenYAmount,
        usdValue: (_f = position.totalValueUSD) !== null && _f !== void 0 ? _f : tokenXAmount * tokenXPrice + tokenYAmount * tokenYPrice,
        feesXAmount: feeXAmount,
        feesYAmount: feeYAmount,
        feesUsdValue: feesUsdValue,
        activeBinId: position.activeBinId,
        inRange: position.inRange,
        poolApr: (_h = (_g = poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.apr) !== null && _g !== void 0 ? _g : position.poolApr) !== null && _h !== void 0 ? _h : 0,
        gasCostUsd: 0.0005,
        timeInRangePercent: position.inRange ? 100 : 0,
    };
}
/**
 * Refresh position data by clearing any cached data and refetching from blockchain
 */
function refreshPositionData() {
    return __awaiter(this, void 0, void 0, function () {
        var activeWallet, positions, totals, error_23;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.clear();
                    console.log(chalk_1.default.blue.bold('🔄 REFRESHING POSITION DATA\n'));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    activeWallet = wallet_service_1.walletService.getActiveWallet();
                    if (!!activeWallet) return [3 /*break*/, 3];
                    console.log(chalk_1.default.red('❌ No active wallet found'));
                    return [4 /*yield*/, waitForUser()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3:
                    console.log(chalk_1.default.yellow('🔄 Refetching position data from blockchain...'));
                    console.log("   Wallet: ".concat(activeWallet.name, " (").concat(activeWallet.publicKey.slice(0, 8), "...)\n"));
                    // Add a small delay to show the refresh is happening
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 4:
                    // Add a small delay to show the refresh is happening
                    _a.sent();
                    return [4 /*yield*/, position_service_1.positionService.getAllPositions(activeWallet.publicKey)];
                case 5:
                    positions = _a.sent();
                    console.log(chalk_1.default.green("\u2705 Successfully refreshed ".concat(positions.length, " position(s)")));
                    // Show summary of refreshed data
                    if (positions.length > 0) {
                        console.log('\n' + chalk_1.default.cyan('📊 Updated Position Summary:'));
                        positions.forEach(function (pos, idx) {
                            var _a, _b;
                            var status = pos.inRange ? '🟢 IN-RANGE' : '🔴 OUT-OF-RANGE';
                            console.log("   ".concat(idx + 1, ". ").concat(pos.tokenX.symbol, "/").concat(pos.tokenY.symbol, " ").concat(status));
                            console.log("      Liquidity: ".concat((_a = pos.tokenX.uiAmount) === null || _a === void 0 ? void 0 : _a.toFixed(6), " ").concat(pos.tokenX.symbol, " / ").concat((_b = pos.tokenY.uiAmount) === null || _b === void 0 ? void 0 : _b.toFixed(6), " ").concat(pos.tokenY.symbol));
                            console.log("      Fees: ".concat(formatUsd(pos.unclaimedFees.usdValue || 0)));
                        });
                        totals = summarizePortfolioTotals(positions);
                        console.log(chalk_1.default.cyan("\n   Portfolio Total: ".concat(formatUsd(totals.valueUsd))));
                        console.log(chalk_1.default.cyan("   Unclaimed Fees: ".concat(formatUsd(totals.feesUsd))));
                    }
                    else {
                        console.log(chalk_1.default.gray('\n   No positions found'));
                    }
                    console.log(chalk_1.default.blue('\n💡 Tips:'));
                    console.log('   • Position data is fetched directly from the Solana blockchain');
                    console.log('   • Discrepancies with other UIs may occur due to different calculation methods');
                    console.log('   • Refresh periodically to get the latest fee accumulations and bin updates');
                    console.log(chalk_1.default.green('\n✅ Position data refresh complete!'));
                    return [3 /*break*/, 7];
                case 6:
                    error_23 = _a.sent();
                    console.log(chalk_1.default.red("\u274C Error refreshing position data: ".concat(error_23.message)));
                    if (error_23.stack) {
                        console.log(chalk_1.default.gray("\nDebug: ".concat(error_23.stack.split('\n')[0])));
                    }
                    return [3 /*break*/, 7];
                case 7: return [4 /*yield*/, waitForUser()];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
