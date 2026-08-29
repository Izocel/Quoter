import React, { useState, useRef } from 'react';
import { CandleData, TickerStatus } from '../types/trading';
import tvChartConfig from '../configs/tv-chart.json';

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

export const TVChart: React.FC<ChartProps> = ({ symbol, name, timeframe = '4H' }) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Map timeframe selection to TradingView interval string
    const getInterval = (tf: string): string => {
        switch (tf) {
            case 'En direct':
                return '1';
            case '1H':
                return '60';
            case '4H':
                return '240';
            case 'Daily':
                return 'D';
            default:
                return '240';
        }
    };

    // Normalize ticker symbol for TradingView (e.g. NA.TO -> TSX:NA)
    const formatSymbol = (sym: string): string => {
        const uppercase = sym.trim().toUpperCase();
        if (uppercase.endsWith('.TO')) {
            return `TSX:${uppercase.replace('.TO', '')}`;
        }
        return uppercase;
    };

    const tvSymbol = formatSymbol(symbol);
    const tvInterval = getInterval(timeframe);
    const chartConfig: TVChartConfig = tvChartConfig;

    const widgetParams = new URLSearchParams({
        symbol: tvSymbol,
        interval: tvInterval,
        symboledit: chartConfig.allowSymbolEdit ? '1' : '0',
        saveimage: chartConfig.allowSaveImage ? '1' : '0',
        toolbarbg: chartConfig.toolbarBackground,
        theme: chartConfig.theme,
        style: chartConfig.style,
        timezone: chartConfig.timezone,
        locale: chartConfig.locale,
        backgroundColor: chartConfig.backgroundColor,
        gridColor: chartConfig.gridColor,
        hide_legend: chartConfig.hideLegend ? '1' : '0',
        hide_side_toolbar: chartConfig.hideSideToolbar ? '1' : '0',
        hide_top_toolbar: chartConfig.hideTopToolbar ? '1' : '0',
        hide_volume: chartConfig.hideVolume ? '1' : '0',
        calendar: chartConfig.calendar ? '1' : '0',
        details: chartConfig.details ? '1' : '0',
        hotlist: chartConfig.hotlist ? '1' : '0',
        withdateranges: chartConfig.withDateRanges ? '1' : '0',
        studies: JSON.stringify(chartConfig.studies),
        compareSymbols: JSON.stringify(chartConfig.compareSymbols),
        watchlist: JSON.stringify(chartConfig.watchlist),
        autosize: chartConfig.autosize ? '1' : '0',
        ...(chartConfig.supportHost ? { support_host: chartConfig.supportHost } : {}),
    });
    const iframeUrl = `https://s.tradingview.com/widgetembed/?${widgetParams.toString()}`;

    const toggleFullscreen = () => {
        if (!cardRef.current) return;
        if (!document.fullscreenElement) {
            cardRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
        }
    };

    return (
        <div
            ref={cardRef}
            className={`overflow-hidden rounded-md border border-trading-border bg-[#11151c] transition-colors hover:border-slate-500 ${isFullscreen ? 'flex flex-col h-screen w-screen p-2' : ''
                }`}
        >
            <div className="flex items-center justify-between border-b border-trading-border/60 bg-[#151821] px-3 py-1.5 text-xs">
                <div className="min-w-0 font-semibold text-white truncate">
                    {symbol} <span className="font-normal text-slate-400">({name})</span>
                </div>
                <button
                    onClick={toggleFullscreen}
                    className="rounded border border-[#303540] bg-[#20232c] px-2 py-0.5 text-[11px] text-slate-300 hover:bg-[#2e3340] hover:text-white"
                    title={isFullscreen ? 'Quitter le mode plein écran' : 'Passer en plein écran'}
                >
                    {isFullscreen ? '⤢ Quitter' : '⤢ Plein écran'}
                </button>
            </div>
            <iframe
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
