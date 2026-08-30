export type GoNoGoState = 'STRONG_GO' | 'GO' | 'NEUTRAL' | 'WEAK_NOGO' | 'NOGO';
export type TickerStatus = 'pending' | 'up-to-date' | 'unavailable';

export interface CandleData {
    time: string | number; // Format 'YYYY-MM-DD' or Unix timestamp in seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface TickerData {
    symbol: string;
    name: string;
    price: number;
    state: GoNoGoState;
    status: TickerStatus;
    score: number;
    volumeChange: number; // Pourcentage (ex: 131 pour +131%)
    ma9: number;
    ma21: number;
    rsi: number;
    candles: CandleData[];
}
