import { type ReactNode } from 'react';
import { TVChart } from '../components/TVChart';
import type { Timeframe } from '../configs/timeframes';
import type { ChartWorkspace } from '../types/workspace';

interface HomePageProps {
    activeWorkspace: ChartWorkspace;
    description: string;
    timeframe: Timeframe;
    timezone: string;
    workspacePicker: ReactNode;
    isActive: boolean;
    isEditable: boolean;
    hasUnsavedTickerChanges: boolean;
    onOpenExplore: (symbol: string) => void;
    onOpenGraphSets: () => void;
    onSymbolChange: (symbolIndex: number, nextSymbol: string) => void;
    onAddChart: () => void;
    onEditWorkspace: () => void;
    onSaveTickerChanges: () => void;
}

export function HomePage({ activeWorkspace, description, timeframe, timezone, workspacePicker, isActive, isEditable, hasUnsavedTickerChanges, onOpenExplore, onOpenGraphSets, onSymbolChange, onAddChart, onEditWorkspace, onSaveTickerChanges }: HomePageProps) {
    return (
        <section className={isActive ? '' : 'hidden'}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-trading-border pb-3">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">Graph set</div>
                    {workspacePicker}
                    <p className="mt-1 max-w-2xl text-xs text-slate-400">{description}</p>
                    {isEditable && (
                        <div className="mt-3 flex items-center gap-1">
                            <button type="button" onClick={onAddChart} className="app-button app-button-secondary">Add</button>
                            <button type="button" onClick={onEditWorkspace} className="app-button app-button-secondary">Edit</button>
                            {hasUnsavedTickerChanges && <button type="button" onClick={onSaveTickerChanges} className="app-button app-button-primary">Save</button>}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {activeWorkspace.symbols.length > 0 && <div className="text-xs font-medium text-slate-400">{activeWorkspace.symbols.length} symbols</div>}
                </div>
            </div>
            {activeWorkspace.symbols.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {activeWorkspace.symbols.map((symbol, symbolIndex) => (
                        <TVChart key={`${activeWorkspace.id}-${symbol}-${symbolIndex}`} symbol={symbol} name={symbol} timeframe={timeframe} configOverrides={{ timezone }} onOpenExplore={onOpenExplore} onSymbolChange={(nextSymbol) => onSymbolChange(symbolIndex, nextSymbol)} />
                    ))}
                </div>
            ) : (
                <div className="border border-dashed border-[#3b4352] px-5 py-12 text-center">
                    <h2 className="text-base font-bold text-white">This graph set is empty</h2>
                    <p className="mt-2 text-sm text-slate-400">Add symbols, create another set, or import a saved workspace.</p>
                    <button type="button" onClick={onOpenGraphSets} className="app-button app-button-primary mt-5">Go to Graph sets</button>
                </div>
            )}
        </section>
    );
}
