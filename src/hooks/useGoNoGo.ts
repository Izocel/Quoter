import type { CandleData, GoNoGoState } from "../types/trading";

interface MarketParams {
    fastMA: number;
    slowMA: number;
    rsiLength?: number;
}

export const calculateRSI = (candles: CandleData[], length = 5): number => {
    if (candles.length <= length) return 50;

    const closes = candles.map(c => c.close);
    let gains = 0;
    let losses = 0;

    for (let i = candles.length - length; i < candles.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
    }

    const avgGain = gains / length;
    const avgLoss = losses / length;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return Number((100 - (100 / (1 + rs))).toFixed(1));
};

export const calculateGoNoGo = (candles: CandleData[], params: MarketParams) => {
    if (candles.length < params.slowMA) {
        return { state: 'NEUTRAL' as GoNoGoState, score: 0, ma9: 0, ma21: 0 };
    }

    const latestCandle = candles[candles.length - 1];
    const closePrices = candles.map(c => c.close);

    const calculateSMA = (prices: number[], length: number): number => {
        const slice = prices.slice(-length);
        return slice.reduce((sum, val) => sum + val, 0) / length;
    };

    const ma9 = calculateSMA(closePrices, params.fastMA);
    const ma21 = calculateSMA(closePrices, params.slowMA);

    const isBullishAlignment = ma9 > ma21;
    const isPriceAboveMA = latestCandle.close > ma9;

    let state: GoNoGoState = 'NEUTRAL';
    let score = 0;

    if (isBullishAlignment && isPriceAboveMA) {
        state = 'STRONG_GO';
        score = 0.96;
    } else if (isBullishAlignment && !isPriceAboveMA) {
        state = 'GO';
        score = 0.45;
    } else if (!isBullishAlignment && isPriceAboveMA) {
        state = 'WEAK_NOGO';
        score = -0.25;
    } else if (!isBullishAlignment && !isPriceAboveMA) {
        state = 'NOGO';
        score = -0.97;
    }

    return { state, score, ma9, ma21 };
};

export const calculateVolumeChange = (candles: CandleData[]): number => {
    if (candles.length < 2) return 0;
    const latestVolume = candles[candles.length - 1].volume;
    const prevSlice = candles.slice(-11, -1);
    if (prevSlice.length === 0) return 0;
    const avgVolume = prevSlice.reduce((acc, c) => acc + c.volume, 0) / prevSlice.length;
    if (avgVolume === 0) return 0;
    return Math.round(((latestVolume - avgVolume) / avgVolume) * 100);
};
