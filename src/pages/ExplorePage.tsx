import { type ReactNode } from 'react';
import { TVChart } from '../components/TVChart';
import { TIMEFRAMES, type Timeframe } from '../configs/timeframes';

interface ExplorePageProps {
    symbol: string;
    description: string;
    timeframe: Timeframe;
    timezone: string;
    showTopToolbar: boolean;
    showSideToolbar: boolean;
    showDetails: boolean;
    widgetToolbarControl: ReactNode;
    isActive: boolean;
    getCandleStatus: (timeframe: Timeframe) => string;
    onSymbolChange: (symbol: string) => void;
    onSymbolNameChange: (name: string) => void;
}

const exploreChartConfig = {
    hideLegend: false,
    hideSideToolbar: false,
    hideTopToolbar: false,
    hideVolume: false,
    allowSymbolEdit: true,
    allowSaveImage: true,
    calendar: true,
    details: true,
    hotlist: true,
    withDateRanges: true,
};

const multiTimeframeRows: ReadonlyArray<readonly Timeframe[]> = [
    ['1w', '1d', '4h'],
    ['1h', '30m', '15m'],
    ['15m', '5m', '1m'],
];
const multiTimeframeRowLabels = ['Slow', 'Medium', 'Fast'] as const;

export function ExplorePage({ symbol, description, timeframe, timezone, showTopToolbar, showSideToolbar, showDetails, widgetToolbarControl, isActive, getCandleStatus, onSymbolChange, onSymbolNameChange }: ExplorePageProps) {
    const toolbarConfig = { timezone, hideLegend: !showTopToolbar, hideTopToolbar: !showTopToolbar, hideSideToolbar: !showSideToolbar, details: showDetails, withDateRanges: showDetails };

    return (
        <section className={`explore-view ${isActive ? '' : 'hidden'}`}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-trading-border py-3">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">Explore</div>
                    <h1 className="mt-1 text-lg font-bold text-white">{symbol}</h1>
                    <p className="mt-1 text-sm text-slate-400">{description || `Live chart for ${symbol}.`}</p>
                </div>
            </div>
            <TVChart
                symbol={symbol}
                name={symbol}
                timeframe={timeframe}
                height="min(68vh, 720px)"
                className="min-h-[480px]"
                topLabel={TIMEFRAMES[timeframe].label}
                configOverrides={{ ...exploreChartConfig, timezone }}
                onSymbolChange={onSymbolChange}
                onSymbolNameChange={onSymbolNameChange}
            />
            <section aria-label="Multi-timeframe charts" className="mt-6 space-y-5 py-2">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-trading-border pb-3">
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">Multi-timeframe</div>
                        <h2 className="mt-1 text-lg font-bold text-white">Pace views</h2>
                    </div>
                    {widgetToolbarControl}
                </div>
                {multiTimeframeRows.map((row, rowIndex) => (
                    <section key={rowIndex} className="border-t border-trading-border/80 pt-4">
                        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{multiTimeframeRowLabels[rowIndex]}</div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {row.map((multiTimeframe, chartIndex) => (
                            <TVChart
                                key={`${multiTimeframe}-${rowIndex}-${chartIndex}`}
                                symbol={symbol}
                                name={symbol}
                                timeframe={multiTimeframe}
                                height={280}
                                topLabel={TIMEFRAMES[multiTimeframe].label}
                                statusLabel={getCandleStatus(multiTimeframe)}
                                hideFullscreen
                                configOverrides={{ ...exploreChartConfig, ...toolbarConfig, allowSymbolEdit: false }}
                            />
                        ))}
                        </div>
                    </section>
                ))}
            </section>
        </section>
    );
}
