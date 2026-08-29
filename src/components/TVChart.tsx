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

    const hideLegendParam = tvChartConfig.hideLegend ? '&hide_legend=1' : '';
    const hideToolbarParam = tvChartConfig.hideSideToolbar ? '&hide_side_toolbar=1' : '';
    const symbolEditParam = `&symboledit=${tvChartConfig.allowSymbolEdit ? '1' : '0'}`;
    const saveImageParam = `&saveimage=${tvChartConfig.allowSaveImage ? '1' : '0'}`;
    const toolbarBgParam = `&toolbarbg=${encodeURIComponent(tvChartConfig.toolbarBackground)}`;
    const themeParam = `&theme=${encodeURIComponent(tvChartConfig.theme)}`;
    const styleParam = `&style=${encodeURIComponent(tvChartConfig.style)}`;
    const timezoneParam = `&timezone=${encodeURIComponent(tvChartConfig.timezone)}`;
    const localeParam = `&locale=${encodeURIComponent(tvChartConfig.locale)}`;

    const iframeUrl = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=${tvInterval}${symbolEditParam}${saveImageParam}${toolbarBgParam}${themeParam}${styleParam}${timezoneParam}${localeParam}${hideLegendParam}${hideToolbarParam}`;

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
                className={`w-full border-0 ${isFullscreen ? 'flex-1' : 'h-[270px]'}`}
                allowTransparency
                allowFullScreen
            />
        </div>
    );
};
