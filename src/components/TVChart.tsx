import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { ExternalLink, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { CandleData, TickerStatus } from '../types/trading';
import type { ChartStyle } from '../types/workspace';
import tvChartConfig from '../configs/tv-chart.json';
import { getTimeframe } from '../configs/timeframes';

interface ChartProps {
    symbol: string;
    name: string;
    data?: CandleData[];
    timeframe?: string;
    status?: TickerStatus;
    className?: string;
    height?: number | string;
    onSymbolChange?: (symbol: string) => void;
    onSymbolNameChange?: (name: string) => void;
    configOverrides?: Partial<TVChartConfig>;
    onOpenExplore?: (symbol: string) => void;
    onDelete?: () => void;
    topLabel?: string;
    statusLabel?: string;
    hideFullscreen?: boolean;
}

interface TVChartConfig {
    height: number;
    theme: string;
    style: ChartStyle;
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

// Maps human-readable config names to TradingView's numeric widget style codes.
const CHART_STYLE_CODES: Record<ChartStyle, string> = {
    bars: '0',
    candle: '1',
    line: '2',
    area: '3',
    heikinAshi: '8',
    hollowCandle: '9',
    baseline: '10',
    hiLo: '12',
    column: '13',
};

interface WidgetData {
    symbol: string | null;
    name: string | null;
}

function parseTradingViewData(data: unknown): WidgetData {
    const parsedData = typeof data === 'string' ? parseMessageString(data) : data;
    return {
        symbol: findSymbolValue(parsedData),
        name: findNameValue(parsedData),
    };
}

function parseMessageString(data: string): unknown {
    try {
        return JSON.parse(data);
    } catch {
        const symbolMatch = data.match(/(?:symbol|ticker|pro_name|short_name)["']?\s*[:=]\s*["']([^"']+)/i);
        return symbolMatch ? { symbol: symbolMatch[1] } : null;
    }
}

function findSymbolValue(value: unknown, depth = 0): string | null {
    if (depth > 4 || value === null) return null;
    if (Array.isArray(value)) {
        for (const nestedValue of value) {
            const symbol = findSymbolValue(nestedValue, depth + 1);
            if (symbol) return symbol;
        }
        return null;
    }
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        for (const key of ['symbol', 'ticker', 'pro_name', 'short_name']) {
            const symbol = normalizeSymbolCandidate(record[key]);
            if (symbol) return symbol;
        }
        for (const nestedValue of Object.values(record)) {
            if (typeof nestedValue !== 'object' || nestedValue === null) continue;
            const symbol = findSymbolValue(nestedValue, depth + 1);
            if (symbol) return symbol;
        }
    }
    return null;
}

function normalizeSymbolCandidate(value: unknown): string | null {
    if (typeof value === 'string') {
        const candidate = value.trim();
        return /^[A-Z0-9._:-]{1,32}$/i.test(candidate) ? candidate.toUpperCase() : null;
    }
    return null;
}

function findNameValue(value: unknown, depth = 0): string | null {
    if (depth > 4 || value === null) return null;
    if (Array.isArray(value)) {
        for (const nestedValue of value) {
            const name = findNameValue(nestedValue, depth + 1);
            if (name) return name;
        }
        return null;
    }
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        for (const key of ['description', 'short_description', 'name', 'full_name', 'title']) {
            const name = normalizeNameCandidate(record[key]);
            if (name) return name;
        }
        for (const nestedValue of Object.values(record)) {
            if (typeof nestedValue !== 'object' || nestedValue === null) continue;
            const name = findNameValue(nestedValue, depth + 1);
            if (name) return name;
        }
    }
    return null;
}

function normalizeNameCandidate(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const candidate = value.trim();
    if (candidate.length < 2 || candidate.length > 80) return null;
    if (/^[A-Z0-9._:-]{1,32}$/i.test(candidate)) return null;
    return candidate;
}

export const TVChart: React.FC<ChartProps> = ({ symbol, name, timeframe = '4h', className = '', height, onSymbolChange, onSymbolNameChange, configOverrides, onOpenExplore, onDelete, topLabel, statusLabel, hideFullscreen = false }) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const lastSymbolRef = useRef<string>(symbol.trim().toUpperCase());
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [widgetData, setWidgetData] = useState<WidgetData>({ symbol: null, name: null });

    useEffect(() => {
        const syncFullscreenState = () => {
            setIsFullscreen(document.fullscreenElement === cardRef.current);
        };

        document.addEventListener('fullscreenchange', syncFullscreenState);
        return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
    }, []);

    useEffect(() => {
        lastSymbolRef.current = symbol.trim().toUpperCase();
        setWidgetData({ symbol: null, name: null });
    }, [symbol, timeframe]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return;
            const nextData = parseTradingViewData(event.data);
            if (nextData.symbol || nextData.name) {
                setWidgetData((current) => ({
                    symbol: nextData.symbol ?? current.symbol,
                    name: nextData.name ?? current.name,
                }));
            }
            if (nextData.name) {
                onSymbolNameChange?.(nextData.name);
            }
            if (!nextData.symbol || nextData.symbol === lastSymbolRef.current) return;
            lastSymbolRef.current = nextData.symbol;
            onSymbolChange?.(nextData.symbol);
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onSymbolChange, onSymbolNameChange]);

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
    const chartConfig: TVChartConfig = { ...tvChartConfig, style: tvChartConfig.style as ChartStyle, ...configOverrides };

    const widgetSettings = {
        symbol: tvSymbol,
        interval: tvInterval,
        allow_symbol_change: chartConfig.allowSymbolEdit,
        save_image: chartConfig.allowSaveImage,
        theme: chartConfig.theme,
        style: CHART_STYLE_CODES[chartConfig.style] ?? CHART_STYLE_CODES.candle,
        timezone: chartConfig.timezone,
        toolbar_bg: chartConfig.toolbarBackground,
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
    const iframeKey = iframeUrl;
    const chartHeight = height ?? chartConfig.height;
    const displayedSymbol = widgetData.symbol ?? tvSymbol;
    const displayedName = widgetData.name ?? name;

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
                } ${className
                }`}
        >
            <div className="flex min-h-9 items-center justify-between gap-2 border-b border-trading-border/60 bg-[#151821] px-2 py-1">
                <div className="flex min-w-0 items-center gap-2 text-xs">
                    {topLabel && !statusLabel && <span className="shrink-0 rounded-sm border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-200">{topLabel}</span>}
                    <span className="truncate font-bold text-white">{displayedSymbol}</span>
                    <span className="hidden min-w-0 truncate text-slate-400 sm:inline">{displayedName}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {statusLabel && (
                        <React.Fragment>
                            {topLabel && <span className="inline-flex h-7 items-center rounded-sm border border-sky-400/30 bg-sky-400/10 px-2 text-[10px] font-bold uppercase tracking-wide text-sky-200">{topLabel}</span>}
                            <span className="inline-flex h-7 items-center rounded-sm border border-[#303540] bg-[#20232c] px-2 font-mono text-[11px] font-semibold text-slate-200">{statusLabel}</span>
                        </React.Fragment>
                    )}
                    {onOpenExplore && (
                        <button
                            type="button"
                            onClick={() => onOpenExplore(displayedSymbol)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#303540] bg-[#20232c] text-slate-300 transition-colors hover:border-slate-500 hover:bg-[#2e3340] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                            title="See in Explore"
                            aria-label={`See ${displayedSymbol} in Explore`}
                        >
                            <ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
                        </button>
                    )}
                    {!hideFullscreen && (
                        <button
                            type="button"
                            onClick={toggleFullscreen}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#303540] bg-[#20232c] text-slate-300 transition-colors hover:border-slate-500 hover:bg-[#2e3340] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                            title={isFullscreen ? 'Quitter le mode plein écran' : 'Passer en plein écran'}
                            aria-label={isFullscreen ? 'Quitter le mode plein écran' : 'Passer en plein écran'}
                        >
                            {isFullscreen ? <Minimize2 aria-hidden="true" size={15} strokeWidth={1.8} /> : <Maximize2 aria-hidden="true" size={15} strokeWidth={1.8} />}
                        </button>
                    )}
                    {onDelete && (
                        <React.Fragment>
                            <button
                                type="button"
                                onClick={onDelete}
                                className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-sm text-rose-400 transition-colors hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                                title="Remove chart"
                                aria-label={`Remove ${displayedSymbol} chart`}
                            >
                                <Trash2 aria-hidden="true" size={15} strokeWidth={1.8} />
                            </button>
                        </React.Fragment>
                    )}
                </div>
            </div>
            <div className={`relative overflow-hidden ${isFullscreen ? 'flex-1' : ''}`} style={isFullscreen ? undefined : { height: chartHeight }}>
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
                    ref={iframeRef}
                    key={iframeKey}
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
