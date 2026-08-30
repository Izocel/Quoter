import { TVChart } from '../components/TVChart';
import type { Timeframe } from '../configs/timeframes';

interface ExplorePageProps {
    symbol: string;
    description: string;
    timeframe: Timeframe;
    timezone: string;
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

export function ExplorePage({ symbol, description, timeframe, timezone, isActive, onSymbolChange, onSymbolNameChange }: ExplorePageProps) {
    return (
        <section className={`explore-view ${isActive ? '' : 'hidden'}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-trading-border pb-3">
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
                height="calc(100vh - 178px)"
                className="min-h-[560px]"
                configOverrides={{ ...exploreChartConfig, timezone }}
                onSymbolChange={onSymbolChange}
                onSymbolNameChange={onSymbolNameChange}
            />
        </section>
    );
}
