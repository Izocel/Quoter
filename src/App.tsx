import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { TVChart } from './components/TVChart';
import { DEFAULT_TIMEFRAME, TIMEFRAMES, TIMEFRAME_GROUPS, type Timeframe } from './configs/timeframes';

interface ChartWorkspace {
    id: string;
    name: string;
    symbols: string[];
}

interface WorkspaceExport {
    version: 1;
    workspaces: ChartWorkspace[];
}

type Dialog = 'create' | 'edit' | 'export' | 'import' | null;
type ImportDestination = 'active' | 'new-tabs' | 'replace-all';
type ExportScope = 'active' | 'all-tabs';
type View = 'home' | 'sets';

const STORAGE_KEY = 'quoter-chart-workspaces';
const favoriteTimeframes = new Set<Timeframe>(['1m', '30m', '1h']);

function createId() {
    return `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSymbols(value: string | string[]) {
    const rawSymbols = Array.isArray(value) ? value : value.split(/[\s,;]+/);
    return [...new Set(rawSymbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
}

function defaultWorkspace(): ChartWorkspace {
    return { id: 'market-overview', name: 'Market overview', symbols: [] };
}

function readWorkspaces(): ChartWorkspace[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [defaultWorkspace()];
        const parsed = JSON.parse(stored) as Partial<WorkspaceExport>;
        const workspaces = parsed.workspaces
            ?.filter((workspace): workspace is ChartWorkspace =>
                typeof workspace?.id === 'string' &&
                typeof workspace.name === 'string' &&
                Array.isArray(workspace.symbols)
            )
            .map((workspace) => ({
                id: workspace.id,
                name: workspace.name.trim() || 'Untitled workspace',
                symbols: normalizeSymbols(workspace.symbols),
            }));
        if (!workspaces?.length) return [defaultWorkspace()];

        return workspaces;
    } catch {
        return [defaultWorkspace()];
    }
}

function readWorkspaceId(workspaces: ChartWorkspace[]) {
    const requestedId = new URLSearchParams(window.location.search).get('tab');
    return workspaces.some((workspace) => workspace.id === requestedId)
        ? requestedId!
        : workspaces[0].id;
}

function readView(): View {
    return new URLSearchParams(window.location.search).get('view') === 'sets' ? 'sets' : 'home';
}

export default function App() {
    const [workspaces, setWorkspaces] = useState<ChartWorkspace[]>(readWorkspaces);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => readWorkspaceId(readWorkspaces()));
    const [view, setView] = useState<View>(readView);
    const [graphTimeframe, setGraphTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
    const [isTimeframeMenuOpen, setIsTimeframeMenuOpen] = useState(false);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [draftName, setDraftName] = useState('');
    const [draftSymbols, setDraftSymbols] = useState('');
    const [exportScope, setExportScope] = useState<ExportScope>('active');
    const [importDestination, setImportDestination] = useState<ImportDestination>('new-tabs');
    const [importError, setImportError] = useState<string | null>(null);
    const timeframeMenuRef = useRef<HTMLDivElement | null>(null);
    const importInputRef = useRef<HTMLInputElement | null>(null);

    const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, workspaces } satisfies WorkspaceExport));
    }, [workspaces]);

    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', activeWorkspace.id);
        url.searchParams.set('view', view);
        window.history.replaceState(null, '', url);
    }, [activeWorkspace.id, view]);

    useEffect(() => {
        const closeTimeframeMenu = (event: MouseEvent) => {
            if (!timeframeMenuRef.current?.contains(event.target as Node)) {
                setIsTimeframeMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', closeTimeframeMenu);
        return () => document.removeEventListener('mousedown', closeTimeframeMenu);
    }, []);

    const closeDialog = () => {
        setDialog(null);
        setImportError(null);
    };

    const openCreateDialog = () => {
        setDraftName(`Workspace ${workspaces.length + 1}`);
        setDraftSymbols('');
        setDialog('create');
    };

    const openEditDialog = (workspace: ChartWorkspace = activeWorkspace) => {
        setActiveWorkspaceId(workspace.id);
        setDraftName(workspace.name);
        setDraftSymbols(workspace.symbols.join(', '));
        setDialog('edit');
    };

    const saveWorkspace = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = draftName.trim();
        if (!name) return;
        const symbols = normalizeSymbols(draftSymbols);

        if (dialog === 'create') {
            const workspace = { id: createId(), name, symbols };
            setWorkspaces((current) => [...current, workspace]);
            setActiveWorkspaceId(workspace.id);
        } else {
            setWorkspaces((current) => current.map((workspace) =>
                workspace.id === activeWorkspace.id ? { ...workspace, name, symbols } : workspace
            ));
        }
        closeDialog();
    };

    const deleteActiveWorkspace = () => {
        if (workspaces.length === 1) return;
        const nextWorkspace = workspaces.find((workspace) => workspace.id !== activeWorkspace.id);
        setWorkspaces((current) => current.filter((workspace) => workspace.id !== activeWorkspace.id));
        setActiveWorkspaceId(nextWorkspace!.id);
    };

    const workspaceUrl = (workspaceId: string) => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', workspaceId);
        url.searchParams.set('view', 'home');
        return url.toString();
    };

    const openWorkspaceWindow = (workspaceId: string) => {
        window.open(workspaceUrl(workspaceId), '_blank', 'noopener,noreferrer');
    };

    const selectWorkspace = (workspaceId: string) => {
        setActiveWorkspaceId(workspaceId);
        setView('home');
    };

    const focusWorkspace = (workspaceId: string) => {
        setActiveWorkspaceId(workspaceId);
    };

    const exportWorkspaces = () => {
        const selectedWorkspaces = exportScope === 'active' ? [activeWorkspace] : workspaces;
        const exportData: WorkspaceExport = { version: 1, workspaces: selectedWorkspaces };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${activeWorkspace.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'quoter'}-workspaces.json`;
        link.click();
        URL.revokeObjectURL(downloadUrl);
        closeDialog();
    };

    const selectImportFile = () => importInputRef.current?.click();

    const importWorkspaces = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        try {
            const parsed = JSON.parse(await file.text()) as Partial<WorkspaceExport>;
            const imported = parsed.workspaces
                ?.filter((workspace): workspace is ChartWorkspace =>
                    typeof workspace?.name === 'string' && Array.isArray(workspace.symbols)
                )
                .map((workspace) => ({
                    id: createId(),
                    name: workspace.name.trim() || 'Imported workspace',
                    symbols: normalizeSymbols(workspace.symbols),
                }));

            if (!imported?.length) {
                throw new Error('No workspace found');
            }

            if (importDestination === 'active') {
                const replacement = { ...imported[0], id: activeWorkspace.id };
                setWorkspaces((current) => current.map((workspace) =>
                    workspace.id === activeWorkspace.id ? replacement : workspace
                ));
            } else if (importDestination === 'replace-all') {
                setWorkspaces(imported);
                setActiveWorkspaceId(imported[0].id);
            } else {
                setWorkspaces((current) => [...current, ...imported]);
                setActiveWorkspaceId(imported[0].id);
            }
            closeDialog();
        } catch {
            setImportError('This file does not contain a valid Quoter workspace export.');
        }
    };

    return (
        <div className="app-shell min-h-screen text-slate-200">
            <header className="app-header border-b border-trading-border px-4 py-3 sm:px-6">
                <div className="mx-auto flex min-h-9 max-w-[1600px] flex-wrap items-center gap-3">
                    <div className="flex shrink-0 items-center gap-2.5 text-sm font-bold text-white">
                        <img src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" className="h-9 w-9 object-contain" />
                        <span>Quoter</span>
                    </div>
                    <nav aria-label="Main navigation" className="app-nav flex h-9 items-center p-1 text-xs">
                        <button type="button" onClick={() => setView('home')} className={`flex h-full items-center px-3 ${view === 'home' ? 'app-nav-active' : 'text-slate-400 hover:text-white'}`}>Home</button>
                        <button type="button" onClick={() => setView('sets')} className={`flex h-full items-center px-3 ${view === 'sets' ? 'app-nav-active' : 'text-slate-400 hover:text-white'}`}>Graph sets</button>
                    </nav>
                    <div className="min-w-0 flex-1 truncate text-xs font-medium text-slate-400">
                        {view === 'home' ? activeWorkspace.name : `${workspaces.length} saved graph sets`}
                    </div>
                    {view === 'home' && (
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                        <div ref={timeframeMenuRef} className="relative">
                            <button
                                type="button"
                                aria-expanded={isTimeframeMenuOpen}
                                aria-haspopup="listbox"
                                aria-label="Chart timeframe"
                                onClick={() => setIsTimeframeMenuOpen((isOpen) => !isOpen)}
                                className="flex h-8 min-w-28 items-center justify-between border border-[#303540] bg-[#20232c] px-3 text-xs font-semibold text-slate-100 hover:bg-[#2e3340] focus:border-blue-500 focus:outline-none"
                            >
                                {TIMEFRAMES[graphTimeframe].label}
                                <span aria-hidden="true" className="ml-5 h-1.5 w-1.5 -translate-y-0.5 rotate-45 border-b border-r border-slate-300" />
                            </button>
                            {isTimeframeMenuOpen && (
                                <div role="listbox" aria-label="Timeframes" className="absolute right-0 top-[calc(100%+4px)] z-30 max-h-[calc(100vh-4rem)] w-40 overflow-y-auto border border-[#343941] bg-[#1f1f20] py-1 text-xs text-slate-100 shadow-xl">
                                    {TIMEFRAME_GROUPS.map((group, groupIndex) => (
                                        <div key={group.label} className={groupIndex === 0 ? '' : 'mt-1 border-t border-[#303136] pt-1'}>
                                            <div className="px-3 py-1 text-[10px] font-medium uppercase text-slate-500">{group.label}</div>
                                            {group.values.map((timeframe) => (
                                                <button key={timeframe} type="button" role="option" aria-selected={graphTimeframe === timeframe} onClick={() => { setGraphTimeframe(timeframe); setIsTimeframeMenuOpen(false); }} className={`flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-[#36383d] ${graphTimeframe === timeframe ? 'bg-[#2962cc] text-white hover:bg-[#2962cc]' : ''}`}>
                                                    {TIMEFRAMES[timeframe].label}
                                                    {favoriteTimeframes.has(timeframe) && <span aria-label="Favorite" className="text-amber-400">*</span>}
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
                {view === 'home' && activeWorkspace.symbols.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {activeWorkspace.symbols.map((symbol) => (
                            <TVChart key={symbol} symbol={symbol} name={symbol} timeframe={graphTimeframe} />
                        ))}
                    </div>
                ) : view === 'home' ? (
                    <div className="border border-dashed border-[#3b4352] px-5 py-12 text-center text-sm text-slate-400">
                        This workspace has no symbols. Use Edit to add a comma-separated list.
                    </div>
                ) : (
                    <section className="mx-auto max-w-6xl">
                        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-trading-border pb-5">
                            <div>
                                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">Workspace library</div>
                                <h1 className="text-2xl font-bold text-white">Graph sets</h1>
                                <p className="mt-1.5 text-sm text-slate-400">Select a set to make it active, then open it from Home.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => setDialog('import')} className="app-button app-button-secondary">Import</button>
                                <button type="button" onClick={() => setDialog('export')} className="app-button app-button-secondary">Export</button>
                                <button type="button" onClick={openCreateDialog} className="app-button app-button-primary">Add graph set</button>
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {workspaces.map((workspace) => (
                                <article
                                    key={workspace.id}
                                    role="button"
                                    tabIndex={0}
                                    aria-pressed={workspace.id === activeWorkspace.id}
                                    onClick={() => focusWorkspace(workspace.id)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            focusWorkspace(workspace.id);
                                        }
                                    }}
                                    className={`workspace-card cursor-pointer border p-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${workspace.id === activeWorkspace.id ? 'workspace-card-active' : 'border-trading-border hover:border-slate-500'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2"><h2 className="truncate text-base font-bold text-white">{workspace.name}</h2>{workspace.id === activeWorkspace.id && <span className="rounded-sm bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">Active</span>}</div>
                                            <p className="mt-2 text-xs font-medium text-slate-400">{workspace.symbols.length} symbols</p>
                                        </div>
                                        <button type="button" onClick={(event) => { event.stopPropagation(); openWorkspaceWindow(workspace.id); }} className="app-icon-button" aria-label={`Open ${workspace.name} in a new window`} title="Open in a new window"><span aria-hidden="true">↗</span></button>
                                    </div>
                                    <p className="mt-5 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{workspace.symbols.join(', ') || 'No symbols added'}</p>
                                    <div className="mt-5 flex items-center justify-between border-t border-trading-border pt-4">
                                        <button type="button" onClick={(event) => { event.stopPropagation(); selectWorkspace(workspace.id); }} className="app-button app-button-open">Open set</button>
                                        <button type="button" onClick={(event) => { event.stopPropagation(); openEditDialog(workspace); }} className="app-icon-button" aria-label={`Edit ${workspace.name}`} title="Edit graph set">Edit</button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                )}
            </main>

            {dialog !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={closeDialog}>
                    <section role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg border border-[#3b4352] bg-[#151821] shadow-2xl">
                        {(dialog === 'create' || dialog === 'edit') && (
                            <form onSubmit={saveWorkspace}>
                                <div className="border-b border-trading-border px-4 py-3"><h1 id="dialog-title" className="text-sm font-bold text-white">{dialog === 'create' ? 'Add chart tab' : 'Edit chart tab'}</h1></div>
                                <div className="space-y-4 p-4">
                                    <label className="block text-xs font-medium text-slate-300">Tab name<input autoFocus required value={draftName} onChange={(event) => setDraftName(event.target.value)} className="mt-1 h-9 w-full border border-[#3b4352] bg-[#0d0f15] px-2 text-sm text-white focus:border-blue-500 focus:outline-none" /></label>
                                    <label className="block text-xs font-medium text-slate-300">Symbols<textarea value={draftSymbols} onChange={(event) => setDraftSymbols(event.target.value)} placeholder="AAPL, MSFT, NVDA" rows={4} className="mt-1 w-full border border-[#3b4352] bg-[#0d0f15] p-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none" /></label>
                                </div>
                                <div className="flex items-center justify-between border-t border-trading-border px-4 py-3">
                                    {dialog === 'edit' && <button type="button" disabled={workspaces.length === 1} onClick={() => { deleteActiveWorkspace(); closeDialog(); }} className="text-xs text-rose-300 hover:text-rose-200 disabled:cursor-not-allowed disabled:text-slate-600">Delete tab</button>}
                                    <div className="ml-auto flex gap-2"><button type="button" onClick={closeDialog} className="h-8 px-3 text-xs text-slate-300 hover:text-white">Cancel</button><button type="submit" className="h-8 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500">Save</button></div>
                                </div>
                            </form>
                        )}
                        {dialog === 'export' && (
                            <div>
                                <div className="border-b border-trading-border px-4 py-3"><h1 id="dialog-title" className="text-sm font-bold text-white">Export JSON</h1></div>
                                <fieldset className="space-y-3 p-4 text-sm text-slate-300"><legend className="mb-2 text-xs text-slate-400">What would you like to export?</legend><label className="flex items-center gap-2"><input type="radio" checked={exportScope === 'active'} onChange={() => setExportScope('active')} /> {activeWorkspace.name}</label><label className="flex items-center gap-2"><input type="radio" checked={exportScope === 'all-tabs'} onChange={() => setExportScope('all-tabs')} /> All tabs ({workspaces.length})</label></fieldset>
                                <div className="flex justify-end gap-2 border-t border-trading-border px-4 py-3"><button type="button" onClick={closeDialog} className="h-8 px-3 text-xs text-slate-300 hover:text-white">Cancel</button><button type="button" onClick={exportWorkspaces} className="h-8 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500">Download JSON</button></div>
                            </div>
                        )}
                        {dialog === 'import' && (
                            <div>
                                <div className="border-b border-trading-border px-4 py-3"><h1 id="dialog-title" className="text-sm font-bold text-white">Import JSON</h1></div>
                                <fieldset className="space-y-3 p-4 text-sm text-slate-300"><legend className="mb-2 text-xs text-slate-400">Where should the imported workspace go?</legend><label className="flex items-center gap-2"><input type="radio" checked={importDestination === 'new-tabs'} onChange={() => setImportDestination('new-tabs')} /> Add as new tabs</label><label className="flex items-center gap-2"><input type="radio" checked={importDestination === 'active'} onChange={() => setImportDestination('active')} /> Replace {activeWorkspace.name}</label><label className="flex items-center gap-2 text-rose-200"><input type="radio" checked={importDestination === 'replace-all'} onChange={() => setImportDestination('replace-all')} /> Replace all graph sets</label>{importError && <p className="text-xs text-rose-300">{importError}</p>}</fieldset>
                                <div className="flex justify-end gap-2 border-t border-trading-border px-4 py-3"><button type="button" onClick={closeDialog} className="h-8 px-3 text-xs text-slate-300 hover:text-white">Cancel</button><button type="button" onClick={selectImportFile} className="h-8 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500">Choose JSON file</button></div>
                            </div>
                        )}
                    </section>
                </div>
            )}
            <input ref={importInputRef} type="file" accept="application/json,.json" onChange={importWorkspaces} className="hidden" />
        </div>
    );
}