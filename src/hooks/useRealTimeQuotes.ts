import { useState, useEffect, useCallback, useRef } from 'react';
import type { TickerData, DashboardParams } from '../types/trading';
import { fetchLiveQuote, validateTicker, fetchTickerCandles } from '../services/marketApi';
import { calculateGoNoGo, calculateRSI, calculateVolumeChange } from './useGoNoGo';

export interface AlertLogItem {
    id: string;
    symbol: string;
    title: string;
    description: string;
    time: string;
}

export function useRealTimeQuotes(
    initialTickers: TickerData[],
    dashboardParams: DashboardParams,
    graphTimeframe: string = '4H'
) {
    const [tickers, setTickers] = useState<TickerData[]>(initialTickers);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);
    const [alertLogs, setAlertLogs] = useState<AlertLogItem[]>([
        { id: '1', symbol: 'ETHA', title: 'RSI5 / 40', description: 'RSI(5) croise en-dessous de 40', time: '28/08 12:30' },
        { id: '2', symbol: 'ETHA', title: 'Croise MA21', description: 'Prix croise en-dessous de MA21', time: '28/08 12:28' },
        { id: '3', symbol: 'ETHA', title: 'Croise MA9', description: 'Prix croise en-dessous de MA9', time: '28/08 12:25' },
        { id: '4', symbol: 'TSM', title: 'RSI5 / 40', description: 'RSI(5) croise en-dessous de 40', time: '28/08 12:10' },
        { id: '5', symbol: 'TSM', title: 'Croise MA9', description: 'Prix croise en-dessous de MA9', time: '28/08 11:55' },
        { id: '6', symbol: 'INTC', title: 'Volume +35%', description: 'Volume anormalement élevé', time: '28/08 11:30' },
        { id: '7', symbol: 'INTC', title: 'GoNoGo Trend', description: 'Changement de tendance GoNoGo', time: '28/08 11:00' },
    ]);

    const tickersRef = useRef(tickers);
    useEffect(() => {
        tickersRef.current = tickers;
    }, [tickers]);

    const paramsRef = useRef(dashboardParams);
    useEffect(() => {
        paramsRef.current = dashboardParams;
    }, [dashboardParams]);

    // Reload timeframe-specific candles when graphTimeframe changes
    useEffect(() => {
        let isCancelled = false;
        async function loadTimeframeData() {
            setIsUpdating(true);
            setTickers((prev) => prev.map((t) => ({ ...t, status: 'pending' })));

            let completedCount = 0;
            const currentList = tickersRef.current;
            const total = currentList.length;

            if (total === 0) {
                setIsUpdating(false);
                return;
            }

            currentList.forEach(async (ticker) => {
                try {
                    const candles = await fetchTickerCandles(ticker.symbol, graphTimeframe);
                    if (isCancelled) return;

                    if (!candles || candles.length === 0) {
                        setTickers((prev) =>
                            prev.map((t) => (t.symbol === ticker.symbol ? { ...t, status: 'unavailable' as const } : t))
                        );
                    } else {
                        const latestPrice = candles[candles.length - 1].close;
                        const { state, score, ma9, ma21 } = calculateGoNoGo(candles, {
                            fastMA: paramsRef.current.fastMA,
                            slowMA: paramsRef.current.slowMA,
                        });
                        const rsi = calculateRSI(candles, paramsRef.current.rsiLength);
                        const volumeChange = calculateVolumeChange(candles);

                        const updatedTicker: TickerData = {
                            ...ticker,
                            price: latestPrice,
                            candles,
                            state,
                            status: 'up-to-date' as const,
                            score,
                            ma9: Number(ma9.toFixed(2)),
                            ma21: Number(ma21.toFixed(2)),
                            rsi,
                            volumeChange,
                        };

                        setTickers((prev) =>
                            prev.map((t) => (t.symbol === ticker.symbol ? updatedTicker : t))
                        );
                    }
                } catch {
                    if (!isCancelled) {
                        setTickers((prev) =>
                            prev.map((t) => (t.symbol === ticker.symbol ? { ...t, status: 'unavailable' as const } : t))
                        );
                    }
                } finally {
                    completedCount++;
                    if (completedCount >= total && !isCancelled) {
                        setIsUpdating(false);
                    }
                }
            });
        }

        loadTimeframeData();
        return () => {
            isCancelled = true;
        };
    }, [graphTimeframe]);

    const updateMarketData = useCallback(async () => {
        setIsUpdating(true);
        setTickers((prev) => prev.map((t) => ({ ...t, status: 'pending' })));

        const nowStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = `${new Date().getDate().toString().padStart(2, '0')}/${(new Date().getMonth() + 1).toString().padStart(2, '0')} ${nowStr}`;

        let completedCount = 0;
        const currentList = tickersRef.current;
        const total = currentList.length;

        if (total === 0) {
            setIsUpdating(false);
            return;
        }

        currentList.forEach(async (ticker) => {
            try {
                const liveQuote = await fetchLiveQuote(ticker.symbol);
                if (!liveQuote) {
                    setTickers((prev) =>
                        prev.map((t) => (t.symbol === ticker.symbol ? { ...t, status: 'unavailable' as const } : t))
                    );
                    return;
                }

                let newCandles = [...ticker.candles];
                const last = { ...newCandles[newCandles.length - 1] };
                last.close = liveQuote.price;
                last.high = Math.max(last.high, liveQuote.price);
                last.low = Math.min(last.low, liveQuote.price);
                if (liveQuote.volume) last.volume = liveQuote.volume;
                newCandles = [...newCandles.slice(0, -1), last];

                if (!newCandles || newCandles.length === 0) {
                    setTickers((prev) =>
                        prev.map((t) => (t.symbol === ticker.symbol ? { ...t, status: 'unavailable' as const } : t))
                    );
                    return;
                }

                const latestCandle = newCandles[newCandles.length - 1];
                const newPrice = latestCandle.close;

                const { state, score, ma9, ma21 } = calculateGoNoGo(newCandles, {
                    fastMA: paramsRef.current.fastMA,
                    slowMA: paramsRef.current.slowMA,
                });

                const rsi = calculateRSI(newCandles, paramsRef.current.rsiLength);
                const volumeChange = calculateVolumeChange(newCandles);

                // Detect Alert Conditions
                if (state !== ticker.state) {
                    setAlertLogs((prev) => [
                        {
                            id: `${ticker.symbol}-state-${Date.now()}`,
                            symbol: ticker.symbol,
                            title: 'GoNoGo Trend',
                            description: `Signal passé de ${ticker.state} à ${state}`,
                            time: dateStr,
                        },
                        ...prev,
                    ].slice(0, 30));
                }

                if (rsi < paramsRef.current.rsiThreshold && ticker.rsi >= paramsRef.current.rsiThreshold) {
                    setAlertLogs((prev) => [
                        {
                            id: `${ticker.symbol}-rsi-${Date.now()}`,
                            symbol: ticker.symbol,
                            title: `RSI${paramsRef.current.rsiLength} / ${paramsRef.current.rsiThreshold}`,
                            description: `RSI(${paramsRef.current.rsiLength}) croise sous ${paramsRef.current.rsiThreshold} (${rsi})`,
                            time: dateStr,
                        },
                        ...prev,
                    ].slice(0, 30));
                }

                if (volumeChange >= paramsRef.current.volumeThreshold && ticker.volumeChange < paramsRef.current.volumeThreshold) {
                    setAlertLogs((prev) => [
                        {
                            id: `${ticker.symbol}-vol-${Date.now()}`,
                            symbol: ticker.symbol,
                            title: `Volume +${volumeChange}%`,
                            description: `Variation de volume supérieure à ${paramsRef.current.volumeThreshold}%`,
                            time: dateStr,
                        },
                        ...prev,
                    ].slice(0, 30));
                }

                const updatedTicker: TickerData = {
                    ...ticker,
                    price: newPrice,
                    candles: newCandles,
                    state,
                    status: 'up-to-date' as const,
                    score,
                    ma9: Number(ma9.toFixed(2)),
                    ma21: Number(ma21.toFixed(2)),
                    rsi,
                    volumeChange,
                };

                setTickers((prev) =>
                    prev.map((t) => (t.symbol === ticker.symbol ? updatedTicker : t))
                );
            } catch {
                setTickers((prev) =>
                    prev.map((t) => (t.symbol === ticker.symbol ? { ...t, status: 'unavailable' as const } : t))
                );
            } finally {
                completedCount++;
                if (completedCount >= total) {
                    setIsUpdating(false);
                }
            }
        });
    }, []);

    const addTicker = async (symbol: string): Promise<{ success: boolean; error?: string }> => {
        const uppercaseSymbol = symbol.trim().toUpperCase();
        if (!uppercaseSymbol) {
            return { success: false, error: 'Veuillez saisir un symbole.' };
        }
        if (tickers.some((t) => t.symbol === uppercaseSymbol)) {
            return { success: false, error: `Le ticker '${uppercaseSymbol}' est déjà dans la liste.` };
        }

        const validation = await validateTicker(uppercaseSymbol);
        if (!validation.valid || !validation.quote) {
            return { success: false, error: validation.error || `Le ticker '${uppercaseSymbol}' est inexistant.` };
        }

        const candles = await fetchTickerCandles(uppercaseSymbol, graphTimeframe);

        const { state, score, ma9, ma21 } = calculateGoNoGo(candles, {
            fastMA: dashboardParams.fastMA,
            slowMA: dashboardParams.slowMA,
        });

        const rsi = calculateRSI(candles, dashboardParams.rsiLength);
        const volumeChange = calculateVolumeChange(candles);

        const newTicker: TickerData = {
            symbol: uppercaseSymbol,
            name: uppercaseSymbol,
            price: candles[candles.length - 1].close,
            state,
            status: 'up-to-date' as const,
            score,
            volumeChange,
            ma9,
            ma21,
            rsi,
            candles,
        };

        setTickers((prev) => [...prev, newTicker]);
        return { success: true };
    };

    return {
        tickers,
        isUpdating,
        alertLogs,
        updateMarketData,
        addTicker,
    };
}
