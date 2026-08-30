import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { CandleData, TickerStatus } from '../types/trading';
import tvChartConfig from '../configs/tv-chart.json';
import { getTimeframe } from '../configs/timeframes';

interface ChartProps {
    symbol: string;
    name: string;
    data?: CandleData[];
    timeframe?: string;
    status?: TickerStatus;
}

interface TVChartConfig {
    height: number;
    theme: string;
    style: string;
    locale: string;
    timezone: string;
    toolbarBackground: string;
    backgroundColor: string;
    gridColor: string;
    hideLegend: boolean;
    hideSideToolbar: boolean;
    hideTopToolbar: boolean;
    hideVolume: boolean;
    allowSymbolEdit: boolean;
    allowSaveImage: boolean;
    calendar: boolean;
    details: boolean;
    hotlist: boolean;
    withDateRanges: boolean;
    studies?: string[];
    compareSymbols?: string[];
    watchlist?: string[];
    autosize: boolean;
    supportHost?: string;
}

export const TVChart: React.FC<ChartProps> = ({ symbol, timeframe = '4h' }) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const syncFullscreenState = () => {
            setIsFullscreen(document.fullscreenElement === cardRef.current);
        };

        document.addEventListener('fullscreenchange', syncFullscreenState);
        return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
    }, []);

    // Normalize ticker symbol for TradingView (e.g. NA.TO -> TSX:NA)
    const formatSymbol = (sym: string): string => {
        const uppercase = sym.trim().toUpperCase();
        if (uppercase.endsWith('.TO')) {
            return `TSX:${uppercase.replace('.TO', '')}`;
        }
        return uppercase;
    };

    const tvSymbol = formatSymbol(symbol);
    const tvInterval = getTimeframe(timeframe).tradingViewInterval;
    const chartConfig: TVChartConfig = tvChartConfig;

    const widgetSettings = {
        symbol: tvSymbol,
        interval: tvInterval,
        allow_symbol_change: chartConfig.allowSymbolEdit,
        save_image: chartConfig.allowSaveImage,
        theme: chartConfig.theme,
        style: chartConfig.style,
        timezone: chartConfig.timezone,
        backgroundColor: chartConfig.backgroundColor,
        gridColor: chartConfig.gridColor,
        hide_legend: chartConfig.hideLegend,
        hide_side_toolbar: chartConfig.hideSideToolbar,
        hide_top_toolbar: chartConfig.hideTopToolbar,
        hide_volume: chartConfig.hideVolume,
        calendar: chartConfig.calendar,
        details: chartConfig.details,
        hotlist: chartConfig.hotlist,
        withdateranges: chartConfig.withDateRanges,
        ...(chartConfig.studies ? { studies: chartConfig.studies } : {}),
        ...(chartConfig.compareSymbols ? { compareSymbols: chartConfig.compareSymbols } : {}),
        ...(chartConfig.watchlist ? { watchlist: chartConfig.watchlist } : {}),
        autosize: chartConfig.autosize,
        ...(chartConfig.supportHost ? { support_host: chartConfig.supportHost } : {}),
    };
    const iframeUrl = `https://www.tradingview.com/embed-widget/advanced-chart/?locale=${encodeURIComponent(chartConfig.locale)}#${encodeURIComponent(JSON.stringify(widgetSettings))}`;

    useLayoutEffect(() => {
        setIsLoading(true);
    }, [iframeUrl]);

    const toggleFullscreen = () => {
        if (!cardRef.current) return;
        if (!document.fullscreenElement) {
            cardRef.current.requestFullscreen().catch(() => { });
        } else {
            document.exitFullscreen().catch(() => { });
        }
    };

    return (
        <div
            ref={cardRef}
            className={`overflow-hidden rounded-md border border-trading-border bg-[#11151c] transition-colors hover:border-slate-500 ${isFullscreen ? 'flex flex-col h-screen w-screen p-2' : ''
                }`}
        >
            <div className="flex justify-end border-b border-trading-border/60 bg-[#151821] px-2 py-1">
                <button
                    onClick={toggleFullscreen}
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#303540] bg-[#20232c] text-sm text-slate-300 hover:bg-[#2e3340] hover:text-white"
                    title={isFullscreen ? 'Quitter le mode plein écran' : 'Passer en plein écran'}
                    aria-label={isFullscreen ? 'Quitter le mode plein écran' : 'Passer en plein écran'}
                >
                    <span aria-hidden="true">⛶</span>
                </button>
            </div>
            <div className={`relative overflow-hidden ${isFullscreen ? 'flex-1' : ''}`} style={isFullscreen ? undefined : { height: chartConfig.height }}>
                {isLoading && (
                    <div aria-busy="true" aria-label={`Chargement du graphique ${symbol}`} className="absolute inset-0 z-10 animate-pulse bg-[#11151c] p-4">
                        <div className="flex h-full gap-3">
                            <div className="w-7 shrink-0 space-y-4 border-r border-slate-700/40 pr-3">
                                <div className="h-7 w-7 bg-slate-700/40" />
                                <div className="h-5 w-7 bg-slate-700/30" />
                                <div className="h-5 w-7 bg-slate-700/30" />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <div className="h-3 w-24 bg-slate-600/40" />
                                <div className="mt-4 flex-1 border-y border-slate-700/30" style={{ backgroundImage: 'linear-gradient(rgba(100, 116, 139, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(100, 116, 139, 0.12) 1px, transparent 1px)', backgroundSize: '36px 28px' }}>
                                    <div className="mt-[38%] h-1 w-full -rotate-6 bg-sky-400/25" />
                                </div>
                                <div className="mt-3 flex items-end gap-1"><div className="h-5 flex-1 bg-sky-400/15" /><div className="h-9 flex-1 bg-sky-400/20" /><div className="h-7 flex-1 bg-sky-400/15" /><div className="h-11 flex-1 bg-sky-400/25" /><div className="h-6 flex-1 bg-sky-400/15" /></div>
                            </div>
                        </div>
                    </div>
                )}
                <iframe
                    key={`${tvSymbol}-${tvInterval}`}
                    title={`TradingView Chart ${symbol}`}
                    src={iframeUrl}
                    onLoad={() => setIsLoading(false)}
                    className={`h-full w-full border-0 ${isFullscreen ? 'flex-1' : ''}`}
                    allowFullScreen
                />
            </div>
        </div>
    );
};
