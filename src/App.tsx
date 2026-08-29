import { useState } from 'react';
import { TVChart } from './components/TVChart';
import type { GoNoGoState, TickerData, DashboardParams, TickerStatus } from './types/trading';
import { useRealTimeQuotes } from './hooks/useRealTimeQuotes';
import { generateDeterministicCandles } from './services/marketApi';

import tickersConfig from './configs/tickers.json';
import dashboardConfig from './configs/dashboard.json';
import graphsConfig from './configs/graphs.json';

const seed: Omit<TickerData, 'candles'>[] = tickersConfig.tickers.map((t) => ({
    symbol: t.symbol,
    name: t.name,
    price: t.lastPrice,
    state: 'GO' as GoNoGoState,
    status: 'up-to-date' as TickerStatus,
    score: 0.45,
    volumeChange: 15,
    ma9: Number((t.lastPrice * 0.99).toFixed(2)),
    ma21: Number((t.lastPrice * 0.98).toFixed(2)),
    rsi: 50,
}));

const initialLists: [string, string[]][] = dashboardConfig.watchLists.map(
    (wl) => [wl.name, wl.symbols] as [string, string[]]
);

const labels: Record<GoNoGoState, string> = {
    STRONG_GO: 'Strong Go',
    GO: 'Go',
    NEUTRAL: 'Neutral',
    WEAK_NOGO: 'Weak NoGo',
    NOGO: 'NoGo',
};

const badge: Record<GoNoGoState, string> = {
    STRONG_GO: 'bg-blue-600',
    GO: 'bg-sky-500',
    NEUTRAL: 'bg-zinc-500',
    WEAK_NOGO: 'bg-pink-400',
    NOGO: 'bg-pink-500',
};

export default function App() {
    const [tab, setTab] = useState<'screener' | 'charts'>(
        (dashboardConfig.defaultTab as 'screener' | 'charts') || 'screener'
    );
    const [graphTimeframe, setGraphTimeframe] = useState<string>(
        graphsConfig.defaultTimeframe || '4H'
    );
    const [params, setParams] = useState<DashboardParams>({
        refreshInterval: dashboardConfig.refreshInterval,
        volumeThreshold: dashboardConfig.volumeThreshold,
        fastMA: dashboardConfig.fastMA,
        slowMA: dashboardConfig.slowMA,
        rsiLength: dashboardConfig.rsiLength,
        rsiThreshold: dashboardConfig.rsiThreshold,
        timeframe: dashboardConfig.timeframe,
    });

    const [watchLists, setWatchLists] = useState<[string, string[]][]>(initialLists);
    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [addError, setAddError] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState<boolean>(false);

    const [initialTickers] = useState(() =>
        seed.map((ticker) => ({
            ...ticker,
            candles: generateDeterministicCandles(ticker.symbol, graphTimeframe, ticker.price),
        }))
    );

    const {
        tickers,
        alertLogs,
        updateMarketData,
        addTicker,
    } = useRealTimeQuotes(initialTickers, params, graphTimeframe);

    const bySymbol = Object.fromEntries(tickers.map((ticker) => [ticker.symbol, ticker]));

    const handleAddTicker = async (listName: string) => {
        const value = inputValues[listName] || '';
        if (!value.trim()) return;
        const uppercase = value.trim().toUpperCase();

        setAddError(null);
        setIsAdding(true);

        const result = await addTicker(uppercase);

        setIsAdding(false);

        if (!result.success) {
            setAddError(result.error || `Ticker '${uppercase}' inexistant ou invalide.`);
            return;
        }

        setWatchLists((prev) =>
            prev.map(([name, symbols]) => {
                if (name === listName && !symbols.includes(uppercase)) {
                    return [name, [...symbols, uppercase]];
                }
                return [name, symbols];
            })
        );

        setInputValues((prev) => ({ ...prev, [listName]: '' }));
    };

    const handleRemoveSymbol = (listName: string, symbolToRemove: string) => {
        setWatchLists((prev) =>
            prev.map(([name, symbols]) => {
                if (name === listName) {
                    return [name, symbols.filter((s) => s !== symbolToRemove)];
                }
                return [name, symbols];
            })
        );
    };

    return (
        <div className="min-h-screen bg-trading-bg text-slate-200">
            <header className="flex min-h-14 items-center justify-between border-b border-trading-border bg-[#151821] px-4 sm:px-8">
                <div className="flex items-center gap-6">
                    <div className="text-sm font-semibold text-white">
                        <span className="mr-2 text-lg text-sky-400">◩</span>Quoter
                    </div>
                    <nav className="hidden rounded-md border border-[#303540] bg-[#20232c] p-0.5 text-xs sm:flex">
                        <button
                            onClick={() => setTab('screener')}
                            className={`rounded px-3 py-1.5 ${tab === 'screener' ? 'bg-[#343944] text-white' : 'text-slate-400'
                                }`}
                        >
                            Dashboard Marchés
                        </button>
                        <button
                            onClick={() => setTab('charts')}
                            className={`rounded px-3 py-1.5 ${tab === 'charts' ? 'bg-[#343944] text-white' : 'text-slate-400'
                                }`}
                        >
                            Graphiques
                        </button>
                    </nav>
                </div>
            </header>

            <main className={`grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-8 ${tab === 'screener' ? '' : 'hidden'}`}>
                <section className="min-w-0">
                    <div className="mb-5 flex items-center justify-between border-b border-trading-border pb-5">
                        <h1 className="text-xl font-bold text-white">
                            <span className="mr-3 rounded bg-slate-200 px-1.5 py-0.5 text-base text-rose-500">
                                ↗
                            </span>
                            Alertes Bourse - timeframe {params.timeframe}min
                        </h1>
                    </div>

                    {addError && (
                        <div className="mb-4 flex items-center justify-between rounded-lg border border-rose-800/60 bg-rose-950/40 px-4 py-2.5 text-xs text-rose-300">
                            <span>⚠️ {addError}</span>
                            <button onClick={() => setAddError(null)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                    )}

                    <div className="space-y-5">
                        {watchLists.map(([name, symbols]) => (
                            <section
                                key={name}
                                className="overflow-hidden rounded-lg border border-trading-border bg-trading-card"
                            >
                                <div className="flex justify-between border-b border-trading-border px-4 py-3">
                                    <h2 className="text-sm font-bold text-white">
                                        {name}{' '}
                                        <span className="font-normal text-slate-500">
                                            ({symbols.length})
                                        </span>
                                    </h2>
                                    <button
                                        onClick={() =>
                                            setWatchLists((prev) =>
                                                prev.filter(([lName]) => lName !== name)
                                            )
                                        }
                                        className="text-xs text-slate-500 hover:text-rose-400"
                                    >
                                        supprimer la liste
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[780px] text-left text-sm">
                                        <thead className="border-b border-trading-border text-[11px] uppercase tracking-wide text-slate-500">
                                            <tr>
                                                {[
                                                    'Titre',
                                                    'Prix',
                                                    'GoNoGo',
                                                    'Volume',
                                                    `MA${params.fastMA}`,
                                                    `MA${params.slowMA}`,
                                                    `RSI${params.rsiLength} / ${params.rsiThreshold}`,
                                                    '',
                                                ].map((heading) => (
                                                    <th key={heading} className="px-3 py-2 font-medium">
                                                        {heading}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-trading-border/80">
                                            {symbols.map((symbol) => {
                                                const ticker = bySymbol[symbol];
                                                if (!ticker) return null;
                                                return (
                                                    <tr
                                                        key={symbol}
                                                        className="hover:bg-white/[.025]"
                                                    >
                                                        <td className="px-3 py-2.5 font-bold">
                                                            <div className="flex items-center gap-2">
                                                                {ticker.status === 'pending' && (
                                                                    <span title="Mise à jour en cours (pending)" className="relative flex h-2 w-2">
                                                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                                                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                                                                    </span>
                                                                )}
                                                                {ticker.status === 'unavailable' && (
                                                                    <span title="Données indisponibles (unavailable)" className="relative flex h-2 w-2">
                                                                        <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-rose-400 opacity-75" />
                                                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                                                                    </span>
                                                                )}
                                                                {ticker.status === 'up-to-date' && (
                                                                    <span title="À jour (up-to-date)" className="h-2 w-2 rounded-full bg-emerald-400" />
                                                                )}
                                                                <span>{ticker.symbol}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 font-medium">
                                                            ${ticker.price.toFixed(2)}
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${badge[ticker.state]
                                                                    }`}
                                                            >
                                                                {labels[ticker.state]} (
                                                                {ticker.score.toFixed(2)})
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5 font-medium">
                                                            {ticker.volumeChange > 0 ? '+' : ''}
                                                            {ticker.volumeChange}%
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span
                                                                className={
                                                                    ticker.ma9 >= ticker.price
                                                                        ? 'metric-negative'
                                                                        : 'metric-positive'
                                                                }
                                                            >
                                                                {ticker.ma9 >= ticker.price
                                                                    ? '▼'
                                                                    : '▲'}{' '}
                                                                {ticker.ma9.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span
                                                                className={
                                                                    ticker.ma21 >= ticker.price
                                                                        ? 'metric-negative'
                                                                        : 'metric-positive'
                                                                }
                                                            >
                                                                {ticker.ma21 >= ticker.price
                                                                    ? '▼'
                                                                    : '▲'}{' '}
                                                                {ticker.ma21.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            {ticker.rsi.toFixed(1)}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center text-slate-500">
                                                            <button
                                                                onClick={() =>
                                                                    handleRemoveSymbol(
                                                                        name,
                                                                        symbol
                                                                    )
                                                                }
                                                                className="hover:text-rose-400"
                                                            >
                                                                ×
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex gap-2 border-t border-trading-border px-4 py-3">
                                    <input
                                        className="h-8 min-w-0 flex-1 rounded border border-[#282d38] bg-[#0d0f15] px-3 text-xs text-white placeholder:text-slate-600"
                                        placeholder={`Ajouter un ticker à ${name} (ex: TSLA, MC.PA, ^GSPC)`}
                                        value={inputValues[name] || ''}
                                        onChange={(e) =>
                                            setInputValues({
                                                ...inputValues,
                                                [name]: e.target.value,
                                            })
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddTicker(name);
                                        }}
                                    />
                                    <button
                                        onClick={() => handleAddTicker(name)}
                                        disabled={isAdding}
                                        className="rounded bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                                    >
                                        {isAdding ? 'Vérification...' : 'Ajouter'}
                                    </button>
                                </div>
                            </section>
                        ))}
                    </div>

                    <section className="mt-5 rounded-lg border border-trading-border bg-trading-card">
                        <h2 className="border-b border-trading-border px-4 py-3 text-sm font-bold text-white">
                            Paramètres Indicateurs
                        </h2>
                        <div className="grid gap-3 p-4 sm:grid-cols-3">
                            <label className="setting-label">
                                Timeframe (min)
                                <input
                                    type="number"
                                    value={params.timeframe}
                                    onChange={(e) =>
                                        setParams((p) => ({
                                            ...p,
                                            timeframe: Number(e.target.value) || 90,
                                        }))
                                    }
                                />
                            </label>
                            <label className="setting-label">
                                Volume seuil (%)
                                <input
                                    type="number"
                                    value={params.volumeThreshold}
                                    onChange={(e) =>
                                        setParams((p) => ({
                                            ...p,
                                            volumeThreshold: Number(e.target.value) || 35,
                                        }))
                                    }
                                />
                            </label>
                            <label className="setting-label">
                                Fast MA (période)
                                <input
                                    type="number"
                                    value={params.fastMA}
                                    onChange={(e) =>
                                        setParams((p) => ({
                                            ...p,
                                            fastMA: Number(e.target.value) || 9,
                                        }))
                                    }
                                />
                            </label>
                            <label className="setting-label">
                                Slow MA (période)
                                <input
                                    type="number"
                                    value={params.slowMA}
                                    onChange={(e) =>
                                        setParams((p) => ({
                                            ...p,
                                            slowMA: Number(e.target.value) || 21,
                                        }))
                                    }
                                />
                            </label>
                            <label className="setting-label">
                                RSI seuil
                                <input
                                    type="number"
                                    value={params.rsiThreshold}
                                    onChange={(e) =>
                                        setParams((p) => ({
                                            ...p,
                                            rsiThreshold: Number(e.target.value) || 40,
                                        }))
                                    }
                                />
                            </label>
                        </div>
                    </section>
                </section>

                <aside className="h-fit overflow-hidden rounded-lg border border-trading-border bg-trading-card lg:sticky lg:top-4">
                    <div className="flex justify-between border-b border-trading-border px-4 py-3">
                        <h2 className="text-sm font-bold text-white">Journal d'alertes temps réel</h2>
                        <button
                            onClick={updateMarketData}
                            className="rounded border border-[#303540] px-2 py-1 text-xs hover:bg-[#20232c]"
                        >
                            Tester notif
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 border-b border-trading-border px-4 py-3 text-xs text-slate-400">
                        ☑ GoNoGo ☑ Volume ☑ MA{params.fastMA} ☑ MA{params.slowMA} ☑ RSI{params.rsiLength}
                    </div>
                    <div className="max-h-[500px] overflow-y-auto divide-y divide-trading-border">
                        {alertLogs.map((alert) => (
                            <div key={alert.id} className="px-4 py-3">
                                <div className="flex justify-between text-xs">
                                    <b>
                                        {alert.symbol} {alert.title}
                                    </b>
                                    <span className="text-slate-500">{alert.time}</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-400">{alert.description}</p>
                            </div>
                        ))}
                    </div>
                </aside>
            </main>
            <main className={`p-3 sm:p-5 ${tab === 'charts' ? '' : 'hidden'}`}>
                <div className="mb-3 flex justify-between">
                    <div className="flex gap-1 rounded border border-[#252a34] bg-[#141720] p-0.5 text-xs">
                        {graphsConfig.supportedTimeframes.map((tf) => (
                            <button
                                key={tf}
                                onClick={() => setGraphTimeframe(tf)}
                                className={`rounded px-3 py-1.5 ${graphTimeframe === tf
                                    ? 'bg-blue-600 font-bold text-white'
                                    : 'text-slate-300'
                                    }`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                </div>
                <p className="mb-5 text-xs text-slate-500">
                    Graphiques temps réel ({graphTimeframe}) mis à jour dynamiquement — MA {params.fastMA}/{params.slowMA} pré-chargées
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {tickers.map((ticker) => (
                        <TVChart
                            key={ticker.symbol}
                            symbol={ticker.symbol}
                            name={ticker.name}
                            data={ticker.candles}
                            timeframe={graphTimeframe}
                            status={ticker.status}
                        />
                    ))}
                </div>
            </main>
        </div>
    );
}
