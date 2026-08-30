import { type ReactNode } from 'react';
import { TVChart } from '../components/TVChart';
import type { Timeframe } from '../configs/timeframes';

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

export function ExplorePage({ symbol, description, timeframe, timezone, showTopToolbar, showSideToolbar, showDetails, widgetToolbarControl, isActive, onSymbolChange, onSymbolNameChange }: ExplorePageProps) {
    const toolbarConfig = { timezone, hideTopToolbar: !showTopToolbar, hideSideToolbar: !showSideToolbar, details: showDetails, withDateRanges: showDetails };

    return (
        <section className={`explore-view ${isActive ? '' : 'hidden'}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-trading-border pb-3">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">Explore</div>
                    <h1 className="mt-1 text-lg font-bold text-white">{symbol}</h1>
                    <p className="mt-1 text-sm text-slate-400">{description || `Live chart for ${symbol}.`}</p>
                </div>
                {widgetToolbarControl}
            </div>
            <TVChart
                symbol={symbol}
                name={symbol}
                timeframe={timeframe}
                height="min(68vh, 720px)"
                className="min-h-[480px]"
                configOverrides={{ ...exploreChartConfig, ...toolbarConfig }}
                onSymbolChange={onSymbolChange}
                onSymbolNameChange={onSymbolNameChange}
            />
            <section aria-label="Multi-timeframe charts" className="mt-4 space-y-3">
                {multiTimeframeRows.map((row, rowIndex) => (
                    <div key={rowIndex} className={`grid grid-cols-1 gap-3 md:grid-cols-3 ${rowIndex > 0 ? 'border-t border-trading-border pt-3' : ''}`}>
                        {row.map((multiTimeframe, chartIndex) => (
                            <TVChart
                                key={`${multiTimeframe}-${rowIndex}-${chartIndex}`}
                                symbol={symbol}
                                name={symbol}
                                timeframe={multiTimeframe}
                                height={280}
                                configOverrides={{ ...exploreChartConfig, ...toolbarConfig, allowSymbolEdit: false }}
                            />
                        ))}
                    </div>
                ))}
            </section>
        </section>
    );
}
