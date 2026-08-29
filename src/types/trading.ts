export type GoNoGoState = 'STRONG_GO' | 'GO' | 'NEUTRAL' | 'WEAK_NOGO' | 'NOGO';

export interface CandleData {
    time: string; // Format 'YYYY-MM-DD'
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
    score: number;
    volumeChange: number; // Pourcentage (ex: 131 pour +131%)
    ma9: number;
    ma21: number;
    rsi: number;
    candles: CandleData[];
}

export interface DashboardParams {
    refreshInterval: number;
    volumeThreshold: number;
    fastMA: number;
    slowMA: number;
    rsiLength: number;
    timeframe: number;
}
