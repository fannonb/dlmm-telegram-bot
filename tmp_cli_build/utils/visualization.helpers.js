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
exports.buildAsciiBinDistribution = buildAsciiBinDistribution;
var DEFAULT_SAMPLE_COUNT = 11;
var DEFAULT_BAR_WIDTH = 24;
/**
 * Build an ASCII-ready distribution map showing liquidity concentration per bin.
 */
function buildAsciiBinDistribution(options) {
    var _a;
    var points = generateDistributionPoints(options);
    if (points.length === 0) {
        return ['(no bins to visualize)'];
    }
    var width = (_a = options.barWidth) !== null && _a !== void 0 ? _a : DEFAULT_BAR_WIDTH;
    var maxWeight = Math.max.apply(Math, __spreadArray(__spreadArray([], points.map(function (point) { return point.weight; }), false), [1], false));
    return points.map(function (point) {
        var fillLength = Math.max(1, Math.round((point.weight / maxWeight) * width));
        var isActive = point.binId === options.activeBinId;
        var barChar = isActive ? '#'.repeat(fillLength) : '='.repeat(fillLength);
        var paddedBar = barChar.padEnd(width, '.');
        var relative = point.binId - options.activeBinId;
        var binLabel = relative === 0 ? 'Bin   0' : "Bin ".concat(relative > 0 ? '+' : '').concat(relative);
        var priceLabel = point.price !== undefined ? "$".concat(point.price.toFixed(6)) : 'price n/a';
        var notionalLabel = point.notionalUsd !== undefined ? "$".concat(point.notionalUsd.toFixed(2)) : '';
        return "".concat(binLabel.padEnd(10), " ").concat(paddedBar, "  ").concat(priceLabel.padEnd(14), " ").concat(notionalLabel).trimEnd();
    });
}
function generateDistributionPoints(options) {
    var _a, _b;
    var span = options.upperBinId - options.lowerBinId;
    if (span <= 0) {
        return [];
    }
    var sampleCount = Math.max(3, (_a = options.sampleCount) !== null && _a !== void 0 ? _a : DEFAULT_SAMPLE_COUNT);
    var step = Math.max(1, Math.floor(span / (sampleCount - 1)));
    var sigma = Math.max(span / 4, 1);
    var weights = [];
    for (var bin = options.lowerBinId; bin <= options.upperBinId; bin += step) {
        var distance = bin - options.activeBinId;
        var weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));
        var price = options.priceResolver ? options.priceResolver(bin) : undefined;
        weights.push({ binId: bin, weight: weight, price: price });
    }
    var weightSum = weights.reduce(function (sum, point) { return sum + point.weight; }, 0) || 1;
    var totalValue = (_b = options.totalValueUsd) !== null && _b !== void 0 ? _b : 0;
    return weights.map(function (point) { return (__assign(__assign({}, point), { notionalUsd: totalValue > 0 ? (point.weight / weightSum) * totalValue : undefined })); });
}
