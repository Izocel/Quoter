import React, { useEffect, useState, useRef } from 'react';
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
    studies: string[];
    compareSymbols: string[];
    watchlist: string[];
    autosize: boolean;
    supportHost?: string;
}

export const TVChart: React.FC<ChartProps> = ({ symbol, timeframe = '4h' }) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

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
        studies: chartConfig.studies,
        compareSymbols: chartConfig.compareSymbols,
        watchlist: chartConfig.watchlist,
        autosize: chartConfig.autosize,
        ...(chartConfig.supportHost ? { support_host: chartConfig.supportHost } : {}),
    };
    const iframeUrl = `https://www.tradingview.com/embed-widget/advanced-chart/?locale=${encodeURIComponent(chartConfig.locale)}#${encodeURIComponent(JSON.stringify(widgetSettings))}`;

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
            <iframe
                key={`${tvSymbol}-${tvInterval}`}
                title={`TradingView Chart ${symbol}`}
                src={iframeUrl}
                className={`w-full border-0 ${isFullscreen ? 'flex-1' : ''}`}
                style={isFullscreen ? undefined : { height: chartConfig.height }}
                allowTransparency
                allowFullScreen
            />
        </div>
    );
};
