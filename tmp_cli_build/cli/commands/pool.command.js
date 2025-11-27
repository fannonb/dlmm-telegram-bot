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
exports.searchPoolByAddress = searchPoolByAddress;
exports.getTopPoolsByTVL = getTopPoolsByTVL;
exports.getTopPoolsByAPR = getTopPoolsByAPR;
exports.getPoolStats = getPoolStats;
exports.findTokenPair = findTokenPair;
exports.binPriceCalculator = binPriceCalculator;
var inquirer_1 = require("inquirer");
var chalk_1 = require("chalk");
var connection_service_1 = require("../../services/connection.service");
var pool_service_1 = require("../../services/pool.service");
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
function searchPoolByAddress() {
    return __awaiter(this, void 0, void 0, function () {
        var config, networkName, answers, pool, action, createPositionWorkflow, error_1;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    config = connection_service_1.connectionService.getConfig();
                    networkName = config.endpoint.includes('devnet') ? 'Devnet' :
                        config.endpoint.includes('mainnet') ? 'Mainnet' : 'Custom';
                    console.log(chalk_1.default.blue.bold('\n🔍 SEARCH POOL BY ADDRESS\n'));
                    console.log(chalk_1.default.yellow("Current Network: ".concat(networkName)));
                    console.log(chalk_1.default.gray('Ensure the pool address exists on this network.\n'));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'input',
                            name: 'address',
                            message: 'Enter pool address (or leave empty to cancel):',
                        })];
                case 1:
                    answers = _d.sent();
                    if (!(!answers.address || answers.address.trim().length === 0)) return [3 /*break*/, 3];
                    console.log(chalk_1.default.gray('Operation cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 2:
                    _d.sent();
                    return [2 /*return*/];
                case 3:
                    _d.trys.push([3, 9, , 10]);
                    console.log(chalk_1.default.yellow('Fetching pool information...'));
                    return [4 /*yield*/, pool_service_1.poolService.searchPoolByAddress(answers.address)];
                case 4:
                    pool = _d.sent();
                    console.log(chalk_1.default.green('\n✅ POOL FOUND:\n'));
                    console.log("Address: ".concat(pool.address));
                    console.log("Pair: ".concat(pool.tokenX.symbol, "/").concat(pool.tokenY.symbol));
                    console.log("\nToken X:");
                    console.log("  Mint: ".concat(pool.tokenX.mint));
                    console.log("  Symbol: ".concat(pool.tokenX.symbol));
                    console.log("  Decimals: ".concat(pool.tokenX.decimals));
                    console.log("\nToken Y:");
                    console.log("  Mint: ".concat(pool.tokenY.mint));
                    console.log("  Symbol: ".concat(pool.tokenY.symbol));
                    console.log("  Decimals: ".concat(pool.tokenY.decimals));
                    console.log("\nPool Details:");
                    console.log("  Bin Step: ".concat(pool.binStep, " bps"));
                    console.log("  Fee: ".concat((pool.feeBps / 100).toFixed(2), "%"));
                    console.log("  Active Bin: ".concat(pool.activeBin));
                    console.log("  TVL: $".concat(((_a = pool.tvl) === null || _a === void 0 ? void 0 : _a.toLocaleString()) || 'N/A'));
                    console.log("  24h Volume: $".concat(((_b = pool.volume24h) === null || _b === void 0 ? void 0 : _b.toLocaleString()) || 'N/A'));
                    console.log("  APR: ".concat(((_c = pool.apr) === null || _c === void 0 ? void 0 : _c.toFixed(2)) || 'N/A', "%\n"));
                    return [4 /*yield*/, inquirer_1.default.prompt({
                            type: 'list',
                            name: 'action',
                            message: 'What would you like to do?',
                            choices: [
                                '➕ Create Position (Add Liquidity)',
                                '🔙 Back to Search'
                            ]
                        })];
                case 5:
                    action = (_d.sent()).action;
                    if (!action.includes('Create Position')) return [3 /*break*/, 8];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('./position.command'); })];
                case 6:
                    createPositionWorkflow = (_d.sent()).createPositionWorkflow;
                    return [4 /*yield*/, createPositionWorkflow(pool.address)];
                case 7:
                    _d.sent();
                    _d.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_1 = _d.sent();
                    console.log(chalk_1.default.red("\n\u274C Search failed: ".concat(error_1, "\n")));
                    return [3 /*break*/, 10];
                case 10: return [4 /*yield*/, waitForUser()];
                case 11:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getTopPoolsByTVL() {
    return __awaiter(this, void 0, void 0, function () {
        var pools, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n📊 TOP POOLS BY TVL\n'));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    console.log(chalk_1.default.yellow('Fetching top pools...'));
                    return [4 /*yield*/, pool_service_1.poolService.getTopPoolsByTVL(10)];
                case 2:
                    pools = _a.sent();
                    console.log(chalk_1.default.green("\n\u2705 Top 10 Pools by TVL:\n"));
                    pools.forEach(function (pool, index) {
                        var _a, _b, _c;
                        console.log("".concat(index + 1, ". ").concat(pool.tokenX.symbol, "/").concat(pool.tokenY.symbol));
                        console.log("   TVL: $".concat(((_a = pool.tvl) === null || _a === void 0 ? void 0 : _a.toLocaleString()) || 'N/A'));
                        console.log("   24h Volume: $".concat(((_b = pool.volume24h) === null || _b === void 0 ? void 0 : _b.toLocaleString()) || 'N/A'));
                        console.log("   APR: ".concat(((_c = pool.apr) === null || _c === void 0 ? void 0 : _c.toFixed(2)) || 'N/A', "%\n"));
                    });
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Failed to fetch pools: ".concat(error_2, "\n")));
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, waitForUser()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getTopPoolsByAPR() {
    return __awaiter(this, void 0, void 0, function () {
        var pools, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n📈 TOP POOLS BY APR\n'));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    console.log(chalk_1.default.yellow('Fetching top pools...'));
                    return [4 /*yield*/, pool_service_1.poolService.getTopPoolsByAPR(10)];
                case 2:
                    pools = _a.sent();
                    console.log(chalk_1.default.green("\n\u2705 Top 10 Pools by APR:\n"));
                    pools.forEach(function (pool, index) {
                        var _a, _b, _c;
                        console.log("".concat(index + 1, ". ").concat(pool.tokenX.symbol, "/").concat(pool.tokenY.symbol));
                        console.log("   APR: ".concat(((_a = pool.apr) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || 'N/A', "%"));
                        console.log("   TVL: $".concat(((_b = pool.tvl) === null || _b === void 0 ? void 0 : _b.toLocaleString()) || 'N/A'));
                        console.log("   24h Volume: $".concat(((_c = pool.volume24h) === null || _c === void 0 ? void 0 : _c.toLocaleString()) || 'N/A', "\n"));
                    });
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Failed to fetch pools: ".concat(error_3, "\n")));
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, waitForUser()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getPoolStats() {
    return __awaiter(this, void 0, void 0, function () {
        var stats, error_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n📋 POOL STATISTICS\n'));
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    console.log(chalk_1.default.yellow('Fetching statistics...'));
                    return [4 /*yield*/, pool_service_1.poolService.getPoolStats()];
                case 2:
                    stats = _c.sent();
                    console.log(chalk_1.default.green("\n\u2705 POOL NETWORK STATISTICS:\n"));
                    console.log("Total Pools: ".concat(stats.totalPools.toLocaleString()));
                    console.log("Total TVL: $".concat(stats.totalTVL.toLocaleString()));
                    console.log("Average APR: ".concat(stats.averageAPR.toFixed(2), "%\n"));
                    if (stats.topPoolByTVL) {
                        console.log(chalk_1.default.blue('📊 Top Pool by TVL:'));
                        console.log("   ".concat(stats.topPoolByTVL.tokenX.symbol, "/").concat(stats.topPoolByTVL.tokenY.symbol));
                        console.log("   TVL: $".concat(((_a = stats.topPoolByTVL.tvl) === null || _a === void 0 ? void 0 : _a.toLocaleString()) || 'N/A', "\n"));
                    }
                    if (stats.topPoolByAPR) {
                        console.log(chalk_1.default.blue('📈 Top Pool by APR:'));
                        console.log("   ".concat(stats.topPoolByAPR.tokenX.symbol, "/").concat(stats.topPoolByAPR.tokenY.symbol));
                        console.log("   APR: ".concat(((_b = stats.topPoolByAPR.apr) === null || _b === void 0 ? void 0 : _b.toFixed(2)) || 'N/A', "%\n"));
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_4 = _c.sent();
                    console.log(chalk_1.default.red("\n\u274C Failed to fetch statistics: ".concat(error_4, "\n")));
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, waitForUser()];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function findTokenPair() {
    return __awaiter(this, void 0, void 0, function () {
        var answers, pools, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n🔎 FIND TOKEN PAIR\n'));
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'input',
                                name: 'token1',
                                message: 'Enter first token (e.g., USDC) (or leave empty to cancel):',
                                default: 'USDC',
                            },
                            {
                                type: 'input',
                                name: 'token2',
                                message: 'Enter second token (e.g., USDT):',
                                default: 'USDT',
                                when: function (answers) { return answers.token1 && answers.token1.trim().length > 0; }
                            },
                        ])];
                case 1:
                    answers = _a.sent();
                    if (!(!answers.token1 || answers.token1.trim().length === 0)) return [3 /*break*/, 3];
                    console.log(chalk_1.default.gray('Operation cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    console.log(chalk_1.default.yellow('Searching for pools...'));
                    return [4 /*yield*/, pool_service_1.poolService.getPoolsByTokenPair(answers.token1, answers.token2)];
                case 4:
                    pools = _a.sent();
                    if (pools.length === 0) {
                        console.log(chalk_1.default.yellow("\n\u274C No pools found for ".concat(answers.token1, "-").concat(answers.token2, "\n")));
                    }
                    else {
                        console.log(chalk_1.default.green("\n\u2705 Found ".concat(pools.length, " pools for ").concat(answers.token1, "-").concat(answers.token2, ":\n")));
                        pools.slice(0, 5).forEach(function (pool, index) {
                            var _a, _b;
                            console.log("".concat(index + 1, ". ").concat(pool.address.slice(0, 16), "..."));
                            console.log("   Fee: ".concat((pool.feeBps / 100).toFixed(2), "%"));
                            console.log("   TVL: $".concat(((_a = pool.tvl) === null || _a === void 0 ? void 0 : _a.toLocaleString()) || 'N/A'));
                            console.log("   APR: ".concat(((_b = pool.apr) === null || _b === void 0 ? void 0 : _b.toFixed(2)) || 'N/A', "%\n"));
                        });
                    }
                    return [3 /*break*/, 6];
                case 5:
                    error_5 = _a.sent();
                    console.log(chalk_1.default.red("\n\u274C Search failed: ".concat(error_5, "\n")));
                    return [3 /*break*/, 6];
                case 6: return [4 /*yield*/, waitForUser()];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function binPriceCalculator() {
    return __awaiter(this, void 0, void 0, function () {
        var answers, binId, price, range;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n📐 BIN PRICE CALCULATOR\n'));
                    return [4 /*yield*/, inquirer_1.default.prompt([
                            {
                                type: 'input', // Changed to input to allow empty check
                                name: 'binId',
                                message: 'Enter bin ID (or leave empty to cancel):',
                                default: '8388608',
                                validate: function (val) {
                                    if (!val || val.trim().length === 0)
                                        return true;
                                    return !isNaN(Number(val)) ? true : 'Please enter a valid number';
                                }
                            },
                            {
                                type: 'number',
                                name: 'binStep',
                                message: 'Enter bin step (in basis points):',
                                default: 20,
                                when: function (answers) { return answers.binId && answers.binId.trim().length > 0; }
                            },
                        ])];
                case 1:
                    answers = _a.sent();
                    if (!(!answers.binId || answers.binId.trim().length === 0)) return [3 /*break*/, 3];
                    console.log(chalk_1.default.gray('Operation cancelled.'));
                    return [4 /*yield*/, waitForUser()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3:
                    binId = Number(answers.binId);
                    try {
                        price = pool_service_1.poolService.calculateBinPrice(binId, answers.binStep);
                        range = pool_service_1.poolService.getPriceRange(binId - 10, binId + 10, answers.binStep);
                        console.log(chalk_1.default.green('\n✅ BIN PRICE CALCULATION:\n'));
                        console.log("Bin ID: ".concat(binId));
                        console.log("Bin Step: ".concat(answers.binStep, " bps"));
                        console.log("Current Price: ".concat(price.toFixed(8), "\n"));
                        console.log(chalk_1.default.blue('Price Range (±10 bins):'));
                        console.log("  Min Price: ".concat(range.minPrice.toFixed(8)));
                        console.log("  Center Price: ".concat(range.centerPrice.toFixed(8)));
                        console.log("  Max Price: ".concat(range.maxPrice.toFixed(8), "\n"));
                    }
                    catch (error) {
                        console.log(chalk_1.default.red("\n\u274C Calculation failed: ".concat(error, "\n")));
                    }
                    return [4 /*yield*/, waitForUser()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
