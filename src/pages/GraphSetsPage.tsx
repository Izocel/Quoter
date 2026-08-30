import type { BuiltInWorkspace, ChartWorkspace } from '../types/workspace';

interface GraphSetsPageProps {
    workspaces: ChartWorkspace[];
    builtInWorkspaces: BuiltInWorkspace[];
    activeWorkspaceId: string;
    onFocusWorkspace: (workspaceId: string) => void;
    onOpenWorkspace: (workspaceId: string) => void;
    onEditWorkspace: (workspace: ChartWorkspace) => void;
    onOpenImport: () => void;
    onOpenExport: () => void;
    onOpenCreate: () => void;
    workspaceUrl: (workspaceId: string) => string;
}

interface WorkspaceCardProps {
    workspace: ChartWorkspace;
    activeWorkspaceId: string;
    isBuiltIn?: boolean;
    onFocusWorkspace: (workspaceId: string) => void;
    onOpenWorkspace: (workspaceId: string) => void;
    onEditWorkspace?: (workspace: ChartWorkspace) => void;
    workspaceUrl: (workspaceId: string) => string;
}

function WorkspaceCard({ workspace, activeWorkspaceId, isBuiltIn = false, onFocusWorkspace, onOpenWorkspace, onEditWorkspace, workspaceUrl }: WorkspaceCardProps) {
    const isActive = workspace.id === activeWorkspaceId;
    const titleElement = isBuiltIn ? <h3 className="truncate text-base font-bold text-white">{workspace.name}</h3> : <h2 className="truncate text-base font-bold text-white">{workspace.name}</h2>;

    return (
        <article
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            onClick={() => onFocusWorkspace(workspace.id)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onFocusWorkspace(workspace.id);
                }
            }}
            className={`workspace-card cursor-pointer border p-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${isActive ? 'workspace-card-active' : 'border-trading-border hover:border-slate-500'}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        {titleElement}
                        <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isBuiltIn ? 'border-sky-400/30 bg-sky-400/10 text-sky-200' : 'border-slate-600 text-slate-400'}`}>{isBuiltIn ? 'Market story' : 'Custom'}</span>
                        {isActive && <span className="rounded-sm bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">Active</span>}
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-400">{workspace.symbols.length} symbols</p>
                </div>
                <a href={workspaceUrl(workspace.id)} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="app-icon-button" aria-label={`Open ${workspace.name} in a new window`} title="Open in a new window"><span aria-hidden="true">↗</span></a>
            </div>
            <p className={`mt-5 min-h-10 text-xs leading-5 ${isBuiltIn ? 'text-slate-400' : 'line-clamp-2 text-slate-500'}`}>{isBuiltIn ? workspace.description : workspace.symbols.join(', ') || 'No symbols added'}</p>
            {isBuiltIn && <p className="mt-3 line-clamp-1 text-xs leading-5 text-slate-500">{workspace.symbols.join(', ')}</p>}
            <div className="mt-5 flex items-center justify-between border-t border-trading-border pt-4">
                <button type="button" onClick={(event) => { event.stopPropagation(); onOpenWorkspace(workspace.id); }} className="app-button app-button-open">Open set</button>
                {isBuiltIn ? <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Read-only</span> : <button type="button" onClick={(event) => { event.stopPropagation(); onEditWorkspace?.(workspace); }} className="app-icon-button" aria-label={`Edit ${workspace.name}`} title="Edit graph set">Edit</button>}
            </div>
        </article>
    );
}

export function GraphSetsPage({ workspaces, builtInWorkspaces, activeWorkspaceId, onFocusWorkspace, onOpenWorkspace, onEditWorkspace, onOpenImport, onOpenExport, onOpenCreate, workspaceUrl }: GraphSetsPageProps) {
    return (
        <section className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-trading-border pb-5">
                <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">Workspace library</div>
                    <h1 className="text-2xl font-bold text-white">Graph sets</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={onOpenImport} className="app-button app-button-secondary">Import</button>
                    <button type="button" onClick={onOpenExport} className="app-button app-button-secondary">Export</button>
                    <button type="button" onClick={onOpenCreate} className="app-button app-button-primary">Add graph set</button>
                </div>
            </div>
            <section aria-labelledby="custom-sets-title">
                <div className="mb-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Your graph sets</div>
                    <h2 id="custom-sets-title" className="mt-1 text-lg font-bold text-white">Custom sets</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {workspaces.map((workspace) => <WorkspaceCard key={workspace.id} workspace={workspace} activeWorkspaceId={activeWorkspaceId} onFocusWorkspace={onFocusWorkspace} onOpenWorkspace={onOpenWorkspace} onEditWorkspace={onEditWorkspace} workspaceUrl={workspaceUrl} />)}
                </div>
            </section>
            <section className="mt-10 border-t border-trading-border pt-6" aria-labelledby="market-stories-title">
                <div className="mb-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">Built-in graph sets</div>
                    <h2 id="market-stories-title" className="mt-1 text-lg font-bold text-white">Market stories</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {builtInWorkspaces.map((workspace) => <WorkspaceCard key={workspace.id} workspace={workspace} activeWorkspaceId={activeWorkspaceId} isBuiltIn onFocusWorkspace={onFocusWorkspace} onOpenWorkspace={onOpenWorkspace} workspaceUrl={workspaceUrl} />)}
                </div>
            </section>
        </section>
    );
}
