import type { CandleData } from '../types/trading';

/**
 * Interface for live quote data
 */
export interface LiveQuote {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: number;
    candles?: CandleData[];
}

interface FetchResult {
    success: boolean;
    quote?: LiveQuote;
    error?: string;
}

/**
 * Fetch market data from Yahoo Finance with CORS proxy fallbacks.
 */
async function queryYahooChart(symbol: string): Promise<FetchResult> {
    const uppercaseSymbol = symbol.trim().toUpperCase();
    const urls = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(uppercaseSymbol)}?interval=1d&range=1mo`,
        `https://corsproxy.io/?${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${uppercaseSymbol}?interval=1d&range=1mo`)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${uppercaseSymbol}?interval=1d&range=1mo`)}`,
    ];

    for (const url of urls) {
        try {
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });

            if (res.status === 404 || res.status === 400) {
                return { success: false, error: `Ticker '${uppercaseSymbol}' inexistant sur les marchés.` };
            }

            if (res.ok) {
                const data = await res.json();
                if (data?.chart?.error) {
                    const desc = data.chart.error.description || 'Non trouvé';
                    return { success: false, error: `Ticker '${uppercaseSymbol}' inexistant (${desc}).` };
                }

                const resultObj = data?.chart?.result?.[0];
                const meta = resultObj?.meta;
                if (meta && typeof meta.regularMarketPrice === 'number' && meta.regularMarketPrice > 0) {
                    const price = meta.regularMarketPrice;
                    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
                    const change = price - prevClose;
                    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

                    let candles: CandleData[] | undefined;
                    const timestamps: number[] = resultObj?.timestamp || [];
                    const quoteData = resultObj?.indicators?.quote?.[0];

                    if (timestamps.length > 0 && quoteData && Array.isArray(quoteData.close)) {
                        candles = [];
                        const seenTimes = new Set<string | number>();
                        for (let i = 0; i < timestamps.length; i++) {
                            const closeVal = quoteData.close[i];
                            if (typeof closeVal === 'number' && !isNaN(closeVal)) {
                                const openVal = quoteData.open?.[i] ?? closeVal;
                                const highVal = quoteData.high?.[i] ?? Math.max(openVal, closeVal);
                                const lowVal = quoteData.low?.[i] ?? Math.min(openVal, closeVal);
                                const volVal = quoteData.volume?.[i] ?? 100000;
                                const timeKey = timestamps[i];

                                if (!seenTimes.has(timeKey)) {
                                    seenTimes.add(timeKey);
                                    candles.push({
                                        time: timeKey,
                                        open: Number(openVal.toFixed(2)),
                                        high: Number(highVal.toFixed(2)),
                                        low: Number(lowVal.toFixed(2)),
                                        close: Number(closeVal.toFixed(2)),
                                        volume: volVal,
                                    });
                                }
                            }
                        }
                    }

                    return {
                        success: true,
                        quote: {
                            symbol: uppercaseSymbol,
                            price,
                            change,
                            changePercent,
                            volume: meta.regularMarketVolume || 0,
                            timestamp: Date.now(),
                            candles: candles && candles.length > 0 ? candles : undefined,
                        },
                    };
                } else if (resultObj === null) {
                    return { success: false, error: `Ticker '${uppercaseSymbol}' inexistant (aucune donnée disponible).` };
                }
            }
        } catch {
            // Try next fallback URL
        }
    }

    return {
        success: false,
        error: `Impossible d'obtenir les données pour '${uppercaseSymbol}'. Ticker inexistant ou serveur non joignable.`,
    };
}

/**
 * Generate deterministic unique candles per ticker for offline/fallback rendering.
 */
function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

export function generateDeterministicCandles(
    symbol: string,
    timeframe: string = '4H',
    providedPrice?: number
): CandleData[] {
    const seed = hashString(symbol);
    const pseudoRandom = (step: number) => {
        const x = Math.sin(seed * 17 + step * 9999) * 10000;
        return x - Math.floor(x);
    };

    const basePrice = providedPrice ?? ((seed % 300) + 20);
    const count = timeframe === 'En direct' ? 25 : timeframe === '1H' ? 35 : timeframe === '4H' ? 45 : 60;
    const stepMs =
        timeframe === 'En direct'
            ? 300000
            : timeframe === '1H'
                ? 3600000
                : timeframe === '4H'
                    ? 14400000
                    : 86400000;

    const now = Date.now();
    const trend = (pseudoRandom(1) - 0.48) * 0.03;
    let current = basePrice;
    const candles: CandleData[] = [];

    for (let i = 0; i < count; i++) {
        const rand = pseudoRandom(i + 2);
        const change = (rand - 0.49 + trend) * basePrice * 0.025;
        const open = current;
        const close = Math.max(1, Number((open + change).toFixed(2)));
        current = close;

        const high = Number((Math.max(open, close) + pseudoRandom(i + 100) * basePrice * 0.015).toFixed(2));
        const low = Number((Math.min(open, close) - pseudoRandom(i + 200) * basePrice * 0.015).toFixed(2));
        const volume = Math.floor(pseudoRandom(i + 300) * 800000) + 50000;

        const date = new Date(now - (count - i) * stepMs);
        const timeVal = timeframe === 'Daily'
            ? date.toISOString().split('T')[0]
            : Math.floor(date.getTime() / 1000);

        candles.push({
            time: timeVal,
            open: Number(open.toFixed(2)),
            high,
            low,
            close,
            volume,
        });
    }

    return candles;
}

/**
 * Fetch real-time market quote using Yahoo Finance with validation.
 */
export async function fetchLiveQuote(symbol: string): Promise<LiveQuote | null> {
    const uppercaseSymbol = symbol.trim().toUpperCase();
    const validSymbolRegex = /^[A-Z0-9.\-^=]{1,10}$/;
    if (!validSymbolRegex.test(uppercaseSymbol)) {
        return null;
    }

    const result = await queryYahooChart(uppercaseSymbol);
    return result.success && result.quote ? result.quote : null;
}

/**
 * Fetch timeframe-specific candles for a symbol.
 */
export async function fetchTickerCandles(symbol: string, timeframe: string = '4H'): Promise<CandleData[]> {
    const uppercaseSymbol = symbol.trim().toUpperCase();

    let interval = '1d';
    let range = '3mo';
    if (timeframe === 'En direct') {
        interval = '5m';
        range = '1d';
    } else if (timeframe === '1H') {
        interval = '60m';
        range = '1mo';
    } else if (timeframe === '4H') {
        interval = '60m';
        range = '3mo';
    } else if (timeframe === 'Daily') {
        interval = '1d';
        range = '6mo';
    }

    const urls = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(uppercaseSymbol)}?interval=${interval}&range=${range}`,
        `https://corsproxy.io/?${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${uppercaseSymbol}?interval=${interval}&range=${range}`)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${uppercaseSymbol}?interval=${interval}&range=${range}`)}`,
    ];

    for (const url of urls) {
        try {
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (res.ok) {
                const data = await res.json();
                const resultObj = data?.chart?.result?.[0];
                const timestamps: number[] = resultObj?.timestamp || [];
                const quoteData = resultObj?.indicators?.quote?.[0];

                if (timestamps.length > 0 && quoteData && Array.isArray(quoteData.close)) {
                    const candles: CandleData[] = [];
                    const seenTimes = new Set<string | number>();
                    for (let i = 0; i < timestamps.length; i++) {
                        const closeVal = quoteData.close[i];
                        if (typeof closeVal === 'number' && !isNaN(closeVal)) {
                            const openVal = quoteData.open?.[i] ?? closeVal;
                            const highVal = quoteData.high?.[i] ?? Math.max(openVal, closeVal);
                            const lowVal = quoteData.low?.[i] ?? Math.min(openVal, closeVal);
                            const volVal = quoteData.volume?.[i] ?? 100000;
                            const timeVal = timeframe === 'Daily'
                                ? new Date(timestamps[i] * 1000).toISOString().split('T')[0]
                                : timestamps[i];

                            if (!seenTimes.has(timeVal)) {
                                seenTimes.add(timeVal);
                                candles.push({
                                    time: timeVal,
                                    open: Number(openVal.toFixed(2)),
                                    high: Number(highVal.toFixed(2)),
                                    low: Number(lowVal.toFixed(2)),
                                    close: Number(closeVal.toFixed(2)),
                                    volume: volVal,
                                });
                            }
                        }
                    }
                    if (candles.length > 0) {
                        return candles;
                    }
                }
            }
        } catch {
            // try next proxy
        }
    }

    return generateDeterministicCandles(uppercaseSymbol, timeframe);
}

/**
 * Validate whether a ticker symbol format is valid and whether it exists in market data.
 */
export async function validateTicker(symbol: string): Promise<{ valid: boolean; quote?: LiveQuote; error?: string }> {
    const uppercaseSymbol = symbol.trim().toUpperCase();

    // Format check: symbols must be 1-10 uppercase alphanumeric chars, or contain '.', '-', '^', '='
    const validSymbolRegex = /^[A-Z0-9.\-^=]{1,10}$/;
    if (!validSymbolRegex.test(uppercaseSymbol)) {
        return { valid: false, error: `Symbol invalide '${uppercaseSymbol}'. Seuls les lettres, chiffres et [.-^=] sont autorisés.` };
    }

    const result = await queryYahooChart(uppercaseSymbol);
    if (!result.success || !result.quote) {
        return {
            valid: false,
            error: result.error || `Ticker '${uppercaseSymbol}' inexistant sur les marchés.`,
        };
    }

    return { valid: true, quote: result.quote };
}
