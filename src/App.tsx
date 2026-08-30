import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { TVChart } from './components/TVChart';
import { DEFAULT_TIMEFRAME, TIMEFRAMES, TIMEFRAME_GROUPS, type Timeframe } from './configs/timeframes';
import tvChartConfig from './configs/tv-chart.json';

interface ChartWorkspace {
    id: string;
    name: string;
    symbols: string[];
}

interface WorkspaceExport {
    version: 1;
    workspaces: ChartWorkspace[];
}

interface ChartSettings {
    version: 1;
    timeframe: Timeframe;
    timezone: string;
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Dialog = 'create' | 'edit' | 'export' | 'import' | null;
type ImportDestination = 'active' | 'new-tabs' | 'replace-all';
type ExportScope = 'active' | 'all-tabs';
type View = 'home' | 'explore' | 'sets';

const STORAGE_KEY = 'quoter-chart-workspaces';
const CHART_SETTINGS_STORAGE_KEY = 'quoter-chart-settings';
const favoriteTimeframes = new Set<Timeframe>(['1m', '30m', '1h']);
const FALLBACK_CHART_TIMEZONE = tvChartConfig.timezone;
const TIMEZONE_OPTIONS = [
    { value: 'America/Toronto', label: 'Toronto' },
    { value: 'America/Chicago', label: 'Chicago' },
    { value: 'Etc/UTC', label: 'UTC' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
] as const;
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
    const requestedView = new URLSearchParams(window.location.search).get('view');
    return requestedView === 'sets' || requestedView === 'explore' ? requestedView : 'home';
}

function normalizeTimeZone(timeZone: string) {
    return timeZone === 'UTC' ? 'Etc/UTC' : timeZone;
}

function isValidTimeZone(timeZone: string) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone });
        return true;
    } catch {
        return false;
    }
}

function getTimeZoneOffsetLabel(timeZone: string, date = new Date()) {
    const offsetPart = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
    }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value;
    return offsetPart?.replace('GMT', 'UTC') ?? 'UTC';
}

function getDefaultChartTimezone() {
    const userTimezone = normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    return userTimezone && isValidTimeZone(userTimezone) ? userTimezone : FALLBACK_CHART_TIMEZONE;
}

function readChartSettings(): ChartSettings {
    try {
        const defaultTimezone = getDefaultChartTimezone();
        const stored = localStorage.getItem(CHART_SETTINGS_STORAGE_KEY);
        if (!stored) return { version: 1, timeframe: DEFAULT_TIMEFRAME, timezone: defaultTimezone };
        const parsed = JSON.parse(stored) as Partial<ChartSettings>;
        const validTimeframe = parsed.timeframe && parsed.timeframe in TIMEFRAMES ? parsed.timeframe : DEFAULT_TIMEFRAME;
        const parsedTimezone = typeof parsed.timezone === 'string' ? normalizeTimeZone(parsed.timezone) : '';
        const validTimezone = parsedTimezone && isValidTimeZone(parsedTimezone) ? parsedTimezone : defaultTimezone;
        return { version: 1, timeframe: validTimeframe, timezone: validTimezone };
    } catch {
        return { version: 1, timeframe: DEFAULT_TIMEFRAME, timezone: getDefaultChartTimezone() };
    }
}

function getTimeZoneParts(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
    return {
        year: values.year,
        month: values.month,
        day: values.day,
        hour: values.hour,
        minute: values.minute,
        second: values.second,
    };
}

function getTimeZoneOffset(date: Date, timeZone: string) {
    const parts = getTimeZoneParts(date, timeZone);
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime();
}

function zonedTimeToDate(parts: ReturnType<typeof getTimeZoneParts>, timeZone: string) {
    const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
    return new Date(utcGuess.getTime() - getTimeZoneOffset(utcGuess, timeZone));
}

function addLocalDays(parts: ReturnType<typeof getTimeZoneParts>, days: number) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second));
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
    };
}

function getNextIntervalBoundary(interval: string, now: Date, timeZone: string): Date | null {
    const localNow = getTimeZoneParts(now, timeZone);
    const minuteInterval = Number(interval);
    if (Number.isFinite(minuteInterval) && minuteInterval > 0) {
        const currentMinuteOfDay = localNow.hour * 60 + localNow.minute;
        const nextMinuteOfDay = Math.floor(currentMinuteOfDay / minuteInterval) * minuteInterval + minuteInterval;
        const nextDayOffset = Math.floor(nextMinuteOfDay / 1440);
        const boundary = addLocalDays(localNow, nextDayOffset);
        boundary.hour = Math.floor((nextMinuteOfDay % 1440) / 60);
        boundary.minute = nextMinuteOfDay % 60;
        boundary.second = 0;
        return zonedTimeToDate(boundary, timeZone);
    }
    if (interval === 'D') {
        return zonedTimeToDate({ ...addLocalDays(localNow, 1), hour: 0, minute: 0, second: 0 }, timeZone);
    }
    if (interval === 'W') {
        const localDate = zonedTimeToDate({ ...localNow, hour: 0, minute: 0, second: 0 }, timeZone);
        const daysUntilMonday = (8 - localDate.getUTCDay()) % 7 || 7;
        return zonedTimeToDate({ ...addLocalDays(localNow, daysUntilMonday), hour: 0, minute: 0, second: 0 }, timeZone);
    }
    const monthMatch = interval.match(/^(\d*)M$/);
    if (monthMatch) {
        const monthsPerBar = Number(monthMatch[1] || 1);
        const nextMonth = Math.floor((localNow.month - 1) / monthsPerBar) * monthsPerBar + monthsPerBar;
        return zonedTimeToDate({ year: localNow.year, month: nextMonth + 1, day: 1, hour: 0, minute: 0, second: 0 }, timeZone);
    }
    return null;
}

function formatTimeRemaining(interval: string, now: Date, timeZone: string) {
    const nextBoundary = getNextIntervalBoundary(interval, now, timeZone);
    if (!nextBoundary) return 'Live';
    const remainingSeconds = Math.max(0, Math.ceil((nextBoundary.getTime() - now.getTime()) / 1000));
    const days = Math.floor(remainingSeconds / 86400);
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    if (days > 0) {
        const dayHours = Math.floor((remainingSeconds % 86400) / 3600);
        return `${days}d ${dayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function App() {
    const [workspaces, setWorkspaces] = useState<ChartWorkspace[]>(readWorkspaces);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => readWorkspaceId(readWorkspaces()));
    const [view, setView] = useState<View>(readView);
    const [graphTimeframe, setGraphTimeframe] = useState<Timeframe>(() => readChartSettings().timeframe);
    const [chartTimezone, setChartTimezone] = useState(() => readChartSettings().timezone);
    const [exploreSymbol, setExploreSymbol] = useState('NASDAQ:AAPL');
    const [isTimeframeMenuOpen, setIsTimeframeMenuOpen] = useState(false);
    const [isTimezoneMenuOpen, setIsTimezoneMenuOpen] = useState(false);
    const [isTimeframeStatusOpen, setIsTimeframeStatusOpen] = useState(false);
    const [now, setNow] = useState(() => new Date());
    const [dialog, setDialog] = useState<Dialog>(null);
    const [draftName, setDraftName] = useState('');
    const [draftSymbols, setDraftSymbols] = useState('');
    const [exportScope, setExportScope] = useState<ExportScope>('active');
    const [importDestination, setImportDestination] = useState<ImportDestination>('new-tabs');
    const [importError, setImportError] = useState<string | null>(null);
    const [canInstall, setCanInstall] = useState(false);
    const timeframeMenuRef = useRef<HTMLDivElement | null>(null);
    const timezoneMenuRef = useRef<HTMLDivElement | null>(null);
    const timeframeStatusRef = useRef<HTMLDivElement | null>(null);
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

    const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
    const baseChartConfig = { timezone: chartTimezone };
    const timezoneOptions = TIMEZONE_OPTIONS.some((option) => option.value === chartTimezone)
        ? TIMEZONE_OPTIONS
        : [{ value: chartTimezone, label: chartTimezone }, ...TIMEZONE_OPTIONS];
    const activeTimezoneLabel = timezoneOptions.find((option) => option.value === chartTimezone)?.label ?? chartTimezone;
    const activeTimeRemaining = formatTimeRemaining(TIMEFRAMES[graphTimeframe].tradingViewInterval, now, chartTimezone);
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, workspaces } satisfies WorkspaceExport));
    }, [workspaces]);

    useEffect(() => {
        localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify({
            version: 1,
            timeframe: graphTimeframe,
            timezone: chartTimezone,
        } satisfies ChartSettings));
    }, [graphTimeframe, chartTimezone]);

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
            if (!timezoneMenuRef.current?.contains(event.target as Node)) {
                setIsTimezoneMenuOpen(false);
            }
            if (!timeframeStatusRef.current?.contains(event.target as Node)) {
                setIsTimeframeStatusOpen(false);
            }
        };

        document.addEventListener('mousedown', closeTimeframeMenu);
        return () => document.removeEventListener('mousedown', closeTimeframeMenu);
    }, []);

    useEffect(() => {
        const intervalId = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const captureInstallPrompt = (event: Event) => {
            event.preventDefault();
            installPromptRef.current = event as BeforeInstallPromptEvent;
            setCanInstall(true);
        };
        const clearInstallPrompt = () => {
            installPromptRef.current = null;
            setCanInstall(false);
        };

        window.addEventListener('beforeinstallprompt', captureInstallPrompt);
        window.addEventListener('appinstalled', clearInstallPrompt);
        return () => {
            window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
            window.removeEventListener('appinstalled', clearInstallPrompt);
        };
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

    const openSymbolInExplore = (symbol: string) => {
        setExploreSymbol(symbol);
        setView('explore');
    };

    const focusWorkspace = (workspaceId: string) => {
        setActiveWorkspaceId(workspaceId);
    };

    const installApp = async () => {
        const installPrompt = installPromptRef.current;
        if (!installPrompt) return;
        await installPrompt.prompt();
        installPromptRef.current = null;
        setCanInstall(false);
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
            <header className="app-header relative z-50 border-b border-trading-border px-4 py-3 sm:px-6">
                <div className="mx-auto flex min-h-9 max-w-[1600px] flex-wrap items-center gap-3">
                    <div className="flex shrink-0 items-center gap-2.5 text-sm font-bold text-white">
                        <img src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" className="h-9 w-9 object-contain" />
                        <span>Quoter</span>
                    </div>
                    <nav aria-label="Main navigation" className="app-nav flex h-9 items-center p-1 text-xs">
                        <button type="button" onClick={() => setView('home')} className={`flex h-full items-center px-3 ${view === 'home' ? 'app-nav-active' : 'text-slate-400 hover:text-white'}`}>Home</button>
                        <button type="button" onClick={() => setView('explore')} className={`flex h-full items-center px-3 ${view === 'explore' ? 'app-nav-active' : 'text-slate-400 hover:text-white'}`}>Explore</button>
                        <button type="button" onClick={() => setView('sets')} className={`flex h-full items-center px-3 ${view === 'sets' ? 'app-nav-active' : 'text-slate-400 hover:text-white'}`}>Graph sets</button>
                    </nav>
                    <div className="min-w-0 flex-1 truncate text-xs font-medium text-slate-400">
                        {view === 'home' ? activeWorkspace.name : view === 'explore' ? `Exploring ${exploreSymbol}` : `${workspaces.length} saved graph sets`}
                    </div>
                    {canInstall && (
                        <button type="button" onClick={installApp} className="app-button app-button-secondary shrink-0" title="Install Quoter as an app">
                            Install app
                        </button>
                    )}
                    {(view === 'home' || view === 'explore') && (
                    <div className="ml-auto flex shrink-0 items-center gap-1 rounded border border-[#303540] bg-[#151821] p-1">
                        <div ref={timeframeStatusRef} className="relative order-last">
                            <button
                                type="button"
                                aria-expanded={isTimeframeStatusOpen}
                                aria-haspopup="dialog"
                                onClick={() => { setIsTimeframeStatusOpen((isOpen) => !isOpen); setIsTimezoneMenuOpen(false); setIsTimeframeMenuOpen(false); }}
                                className="flex h-8 items-center gap-1.5 rounded-sm px-2 text-left hover:bg-[#2e3340] focus:bg-[#2e3340] focus:outline-none"
                                title="Show all candle timeframe statuses"
                            >
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Close</span>
                                <span className="font-mono text-[11px] text-sky-200">{activeTimeRemaining}</span>
                            </button>
                            {isTimeframeStatusOpen && (
                                <div role="dialog" aria-label="Candle timeframe statuses" className="absolute right-0 top-[calc(100%+4px)] z-[70] w-[min(34rem,calc(100vw-2rem))] border border-[#343941] bg-[#151821] p-3 text-xs text-slate-200 shadow-2xl">
                                    <div className="mb-2 flex items-center justify-between border-b border-trading-border pb-2">
                                        <span className="font-semibold text-white">All candle statuses</span>
                                        <span className="font-mono text-[10px] text-slate-500">{now.toLocaleTimeString([], { timeZone: chartTimezone, timeZoneName: 'short' })}</span>
                                    </div>
                                    <div className="grid max-h-[22rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                                        {TIMEFRAME_GROUPS.map((group) => (
                                            <section key={group.label}>
                                                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{group.label}</div>
                                                <div className="grid gap-1">
                                                    {group.values.map((timeframe) => (
                                                        <div key={timeframe} className={`grid grid-cols-[3rem_1fr_auto] items-center gap-2 px-2 py-1 ${timeframe === graphTimeframe ? 'bg-sky-400/10 text-sky-100' : 'text-slate-300'}`}>
                                                            <span className="font-semibold">{timeframe}</span>
                                                            <span className="truncate text-slate-400">{TIMEFRAMES[timeframe].label}</span>
                                                            <span className="font-mono text-[11px]">{formatTimeRemaining(TIMEFRAMES[timeframe].tradingViewInterval, now, chartTimezone)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        ))}
                                    </div>
                                    <div className="mt-2 border-t border-trading-border pt-2 text-[10px] text-slate-500">
                                        {activeTimezoneLabel} {getTimeZoneOffsetLabel(chartTimezone, now)}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div ref={timezoneMenuRef} className="relative">
                            <button
                                type="button"
                                aria-expanded={isTimezoneMenuOpen}
                                aria-haspopup="listbox"
                                aria-label="Chart timezone"
                                onClick={() => { setIsTimezoneMenuOpen((isOpen) => !isOpen); setIsTimeframeMenuOpen(false); setIsTimeframeStatusOpen(false); }}
                                className="flex h-8 min-w-32 items-center justify-between gap-2 rounded-sm px-2 text-left hover:bg-[#2e3340] focus:bg-[#2e3340] focus:outline-none"
                                title="Chart timezone"
                            >
                                <span className="min-w-0">
                                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">TZ</span>
                                    <span className="block truncate text-xs font-semibold text-slate-100">{activeTimezoneLabel}</span>
                                </span>
                                <span className="shrink-0 font-mono text-[10px] text-sky-200">{getTimeZoneOffsetLabel(chartTimezone, now)}</span>
                            </button>
                            {isTimezoneMenuOpen && (
                                <div role="listbox" aria-label="Timezones" className="absolute right-0 top-[calc(100%+4px)] z-[70] w-52 overflow-hidden border border-[#343941] bg-[#1f1f20] py-1 text-xs text-slate-100 shadow-xl">
                                    {timezoneOptions.map((timeZone) => (
                                        <button
                                            key={timeZone.value}
                                            type="button"
                                            role="option"
                                            aria-selected={chartTimezone === timeZone.value}
                                            onClick={() => { setChartTimezone(timeZone.value); setIsTimezoneMenuOpen(false); }}
                                            className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 px-3 py-1.5 text-left hover:bg-[#36383d] ${chartTimezone === timeZone.value ? 'bg-[#2962cc] text-white hover:bg-[#2962cc]' : ''}`}
                                        >
                                            <span className="truncate">{timeZone.label}</span>
                                            <span className="font-mono text-[11px] text-sky-200">{getTimeZoneOffsetLabel(timeZone.value, now)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div ref={timeframeMenuRef} className="relative order-first">
                            <button
                                type="button"
                                aria-expanded={isTimeframeMenuOpen}
                                aria-haspopup="listbox"
                                aria-label="Chart timeframe"
                                onClick={() => { setIsTimeframeMenuOpen((isOpen) => !isOpen); setIsTimezoneMenuOpen(false); setIsTimeframeStatusOpen(false); }}
                                className="flex h-8 min-w-28 items-center justify-between rounded-sm px-2 text-left hover:bg-[#2e3340] focus:bg-[#2e3340] focus:outline-none"
                            >
                                <span>
                                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">TF</span>
                                    <span className="block text-xs font-semibold text-slate-100">{TIMEFRAMES[graphTimeframe].label}</span>
                                </span>
                                <span aria-hidden="true" className="ml-5 h-1.5 w-1.5 -translate-y-0.5 rotate-45 border-b border-r border-slate-300" />
                            </button>
                            {isTimeframeMenuOpen && (
                                <div role="listbox" aria-label="Timeframes" className="absolute right-0 top-[calc(100%+4px)] z-[70] max-h-[calc(100vh-4rem)] w-40 overflow-y-auto border border-[#343941] bg-[#1f1f20] py-1 text-xs text-slate-100 shadow-xl">
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

            <main className={`mx-auto p-4 sm:p-6 ${view === 'explore' ? 'max-w-none' : 'max-w-[1600px]'}`}>
                {view === 'home' && activeWorkspace.symbols.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {activeWorkspace.symbols.map((symbol) => (
                            <TVChart key={symbol} symbol={symbol} name={symbol} timeframe={graphTimeframe} configOverrides={baseChartConfig} onOpenExplore={openSymbolInExplore} />
                        ))}
                    </div>
                ) : view === 'home' ? (
                    <div className="border border-dashed border-[#3b4352] px-5 py-12 text-center">
                        <h1 className="text-base font-bold text-white">This graph set is empty</h1>
                        <p className="mt-2 text-sm text-slate-400">Add symbols, create another set, or import a saved workspace.</p>
                        <button type="button" onClick={() => setView('sets')} className="app-button app-button-primary mt-5">Go to Graph sets</button>
                    </div>
                ) : view === 'explore' ? (
                    <section className="explore-view">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-trading-border pb-3">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">Explore</div>
                                <h1 className="mt-1 text-lg font-bold text-white">{exploreSymbol}</h1>
                            </div>
                        </div>
                        <TVChart
                            symbol={exploreSymbol}
                            name={exploreSymbol}
                            timeframe={graphTimeframe}
                            height="calc(100vh - 178px)"
                            className="min-h-[560px]"
                            configOverrides={{ ...exploreChartConfig, ...baseChartConfig }}
                            onSymbolChange={setExploreSymbol}
                        />
                    </section>
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