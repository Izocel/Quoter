import type { CandleData, GoNoGoState } from "../types/trading";


interface MarketParams {
    fastMA: number;
    slowMA: number;
}

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
