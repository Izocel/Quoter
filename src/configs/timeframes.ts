export const TIMEFRAMES = {
    '1m': { label: '1 minute', tradingViewInterval: '1', marketInterval: '1m', marketRange: '7d', usesDateOnly: false },
    '3m': { label: '3 minutes', tradingViewInterval: '3', marketInterval: '5m', marketRange: '5d', usesDateOnly: false },
    '5m': { label: '5 minutes', tradingViewInterval: '5', marketInterval: '5m', marketRange: '5d', usesDateOnly: false },
    '15m': { label: '15 minutes', tradingViewInterval: '15', marketInterval: '15m', marketRange: '1mo', usesDateOnly: false },
    '30m': { label: '30 minutes', tradingViewInterval: '30', marketInterval: '30m', marketRange: '1mo', usesDateOnly: false },
    '45m': { label: '45 minutes', tradingViewInterval: '45', marketInterval: '30m', marketRange: '1mo', usesDateOnly: false },
    '1h': { label: '1 heure', tradingViewInterval: '60', marketInterval: '60m', marketRange: '1mo', usesDateOnly: false },
    '2h': { label: '2 heures', tradingViewInterval: '120', marketInterval: '60m', marketRange: '1mo', usesDateOnly: false },
    '3h': { label: '3 heures', tradingViewInterval: '180', marketInterval: '60m', marketRange: '3mo', usesDateOnly: false },
    '4h': { label: '4 heures', tradingViewInterval: '240', marketInterval: '60m', marketRange: '3mo', usesDateOnly: false },
    '1d': { label: '1 jour', tradingViewInterval: 'D', marketInterval: '1d', marketRange: '6mo', usesDateOnly: true },
    '1w': { label: '1 semaine', tradingViewInterval: 'W', marketInterval: '1wk', marketRange: '2y', usesDateOnly: true },
    '1mo': { label: '1 mois', tradingViewInterval: 'M', marketInterval: '1mo', marketRange: '2y', usesDateOnly: true },
    '3mo': { label: '3 mois', tradingViewInterval: '3M', marketInterval: '1mo', marketRange: '5y', usesDateOnly: true },
    '6mo': { label: '6 mois', tradingViewInterval: '6M', marketInterval: '1mo', marketRange: '10y', usesDateOnly: true },
    '12mo': { label: '12 mois', tradingViewInterval: '12M', marketInterval: '1mo', marketRange: '10y', usesDateOnly: true },
    '1r': { label: '1 plage', tradingViewInterval: '1R', marketInterval: '1d', marketRange: '5d', usesDateOnly: false },
    '10r': { label: '10 plages', tradingViewInterval: '10R', marketInterval: '1d', marketRange: '1mo', usesDateOnly: false },
    '100r': { label: '100 plages', tradingViewInterval: '100R', marketInterval: '1d', marketRange: '6mo', usesDateOnly: false },
    '1000r': { label: '1000 plages', tradingViewInterval: '1000R', marketInterval: '1d', marketRange: '5y', usesDateOnly: false },
} as const;

export type Timeframe = keyof typeof TIMEFRAMES;

export const DEFAULT_TIMEFRAME: Timeframe = '4h';

export const TIMEFRAME_GROUPS: ReadonlyArray<{ label: string; values: readonly Timeframe[] }> = [
    { label: 'Minutes', values: ['1m', '3m', '5m', '15m', '30m', '45m'] },
    { label: 'Heures', values: ['1h', '2h', '3h', '4h'] },
    { label: 'Jours', values: ['1d', '1w', '1mo', '3mo', '6mo', '12mo'] },
    { label: 'Gammes', values: ['1r', '10r', '100r', '1000r'] },
];

export function getTimeframe(timeframe: string) {
    return TIMEFRAMES[timeframe as Timeframe] || TIMEFRAMES[DEFAULT_TIMEFRAME];
}