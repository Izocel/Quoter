import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { DEFAULT_TIMEFRAME, TIMEFRAMES, TIMEFRAME_GROUPS, type Timeframe } from './configs/timeframes';
import tvChartConfig from './configs/tv-chart.json';
import marketMetrics from './configs/hotset/market-metrics.json';
import riskAppetite from './configs/hotset/risk-appetite.json';
import globalCurrencies from './configs/hotset/global-currencies.json';
import commoditiesWatch from './configs/hotset/commodities-watch.json';
import sectorLeaders from './configs/hotset/sector-leaders.json';
import ratesYieldCurve from './configs/hotset/rates-yield-curve.json';
import cryptoPulse from './configs/hotset/crypto-pulse.json';
import megacapTech from './configs/hotset/megacap-tech.json';
import { ExplorePage } from './pages/ExplorePage';
import { HomePage } from './pages/HomePage';
import type { BuiltInWorkspace, ChartStyle, ChartWorkspace, View, WorkspaceExport } from './types/workspace';

interface ChartSettings {
    version: 1;
    timeframe: Timeframe;
    timezone: string;
    showTopToolbar: boolean;
    showSideToolbar: boolean;
    showDetails: boolean;
}

interface WidgetSettings {
    version: 1;
    showTopToolbar: boolean;
    showSideToolbar: boolean;
    showDetails: boolean;
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface StandaloneNavigator extends Navigator {
    standalone?: boolean;
}

type Dialog = 'create' | 'edit' | 'export' | 'import' | null;
type ImportDestination = 'active' | 'new-tabs' | 'replace-all';
type ExportScope = 'active' | 'all-tabs';

const STORAGE_KEY = 'quoter-chart-workspaces';
const CHART_SETTINGS_STORAGE_KEY = 'quoter-chart-settings';
const EXPLORE_CHART_SETTINGS_STORAGE_KEY = 'quoter-explore-chart-settings';
const INSTALL_STATE_STORAGE_KEY = 'quoter-app-installed';
const MARKET_SESSION_TIMEZONE = 'America/Toronto';
const MARKET_SESSION_START_HOUR = 17;
const MARKET_DAILY_CLOSE_HOUR = 17;
const MARKET_WEEKLY_CLOSE_DAY = 5;
const MARKET_WEEKLY_CLOSE_HOUR = 17;
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
const BUILT_IN_WORKSPACES: BuiltInWorkspace[] = [marketMetrics, riskAppetite, globalCurrencies, commoditiesWatch, sectorLeaders, ratesYieldCurve, cryptoPulse, megacapTech] as BuiltInWorkspace[];
const CHART_STYLE_OPTIONS: { value: ChartStyle; label: string }[] = [
    { value: 'candle', label: 'Candles' },
    { value: 'line', label: 'Line' },
    { value: 'area', label: 'Area' },
    { value: 'bars', label: 'Bars' },
    { value: 'heikinAshi', label: 'Heikin Ashi' },
    { value: 'hollowCandle', label: 'Hollow candles' },
    { value: 'baseline', label: 'Baseline' },
    { value: 'hiLo', label: 'Hi-Lo' },
    { value: 'column', label: 'Column' },
];

function createId() {
    return `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSymbols(value: string | string[]) {
    const rawSymbols = Array.isArray(value) ? value : value.split(/[\s,;]+/);
    return rawSymbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
}

function getWorkspaceDescription(workspace: ChartWorkspace) {
    return workspace.description?.trim() || 'A custom graph set you can edit from Graph sets.';
}

function defaultWorkspace(): ChartWorkspace {
    return { id: 'market-overview', name: 'Market overview', description: 'A custom graph set you can edit from Graph sets.', symbols: [] };
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
                description: typeof workspace.description === 'string' ? workspace.description.trim() : '',
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

function isRunningStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as StandaloneNavigator).standalone === true;
}

function readInstalledState() {
    return localStorage.getItem(INSTALL_STATE_STORAGE_KEY) === 'true';
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

function defaultChartSettings(): ChartSettings {
    const widgetSettings = defaultWidgetSettings();
    return {
        version: 1,
        timeframe: DEFAULT_TIMEFRAME,
        timezone: getDefaultChartTimezone(),
        showTopToolbar: widgetSettings.showTopToolbar,
        showSideToolbar: widgetSettings.showSideToolbar,
        showDetails: widgetSettings.showDetails,
    };
}

function defaultWidgetSettings(): WidgetSettings {
    return {
        version: 1,
        showTopToolbar: !tvChartConfig.hideTopToolbar,
        showSideToolbar: !tvChartConfig.hideSideToolbar,
        showDetails: tvChartConfig.withDateRanges,
    };
}

function readWidgetSettings(storageKey: string): WidgetSettings {
    try {
        const defaults = defaultWidgetSettings();
        const stored = localStorage.getItem(storageKey);
        if (!stored) return defaults;
        const parsed = JSON.parse(stored) as Partial<WidgetSettings>;
        return {
            version: 1,
            showTopToolbar: typeof parsed.showTopToolbar === 'boolean' ? parsed.showTopToolbar : defaults.showTopToolbar,
            showSideToolbar: typeof parsed.showSideToolbar === 'boolean' ? parsed.showSideToolbar : defaults.showSideToolbar,
            showDetails: typeof parsed.showDetails === 'boolean' ? parsed.showDetails : defaults.showDetails,
        };
    } catch {
        return defaultWidgetSettings();
    }
}

function readChartSettings(): ChartSettings {
    try {
        const defaults = defaultChartSettings();
        const stored = localStorage.getItem(CHART_SETTINGS_STORAGE_KEY);
        if (!stored) return defaults;
        const parsed = JSON.parse(stored) as Partial<ChartSettings>;
        const validTimeframe = parsed.timeframe && parsed.timeframe in TIMEFRAMES ? parsed.timeframe : DEFAULT_TIMEFRAME;
        const parsedTimezone = typeof parsed.timezone === 'string' ? normalizeTimeZone(parsed.timezone) : '';
        const validTimezone = parsedTimezone && isValidTimeZone(parsedTimezone) ? parsedTimezone : defaults.timezone;
        return {
            version: 1,
            timeframe: validTimeframe,
            timezone: validTimezone,
            showTopToolbar: typeof parsed.showTopToolbar === 'boolean' ? parsed.showTopToolbar : defaults.showTopToolbar,
            showSideToolbar: typeof parsed.showSideToolbar === 'boolean' ? parsed.showSideToolbar : defaults.showSideToolbar,
            showDetails: typeof parsed.showDetails === 'boolean' ? parsed.showDetails : defaults.showDetails,
        };
    } catch {
        return defaultChartSettings();
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

function getNextIntervalBoundary(interval: string, now: Date): Date | null {
    const minuteInterval = Number(interval);
    if (Number.isFinite(minuteInterval) && minuteInterval > 0) {
        const marketNow = getTimeZoneParts(now, MARKET_SESSION_TIMEZONE);
        const currentMinuteOfDay = marketNow.hour * 60 + marketNow.minute;
        const sessionStartMinute = MARKET_SESSION_START_HOUR * 60;
        const sessionStartedToday = currentMinuteOfDay >= sessionStartMinute;
        const sessionStart = addLocalDays(marketNow, sessionStartedToday ? 0 : -1);
        const minutesSinceSessionStart = currentMinuteOfDay - sessionStartMinute + (sessionStartedToday ? 0 : 1440);
        const nextBoundaryMinute = Math.floor(minutesSinceSessionStart / minuteInterval) * minuteInterval + minuteInterval;
        const boundaryMinuteOfDay = sessionStartMinute + nextBoundaryMinute;
        const boundary = addLocalDays(sessionStart, Math.floor(boundaryMinuteOfDay / 1440));
        boundary.hour = Math.floor((boundaryMinuteOfDay % 1440) / 60);
        boundary.minute = boundaryMinuteOfDay % 60;
        boundary.second = 0;
        return zonedTimeToDate(boundary, MARKET_SESSION_TIMEZONE);
    }
    if (interval === 'D') {
        const marketNow = getTimeZoneParts(now, MARKET_SESSION_TIMEZONE);
        const nextSessionDay = marketNow.hour < MARKET_DAILY_CLOSE_HOUR ? 0 : 1;
        return zonedTimeToDate({ ...addLocalDays(marketNow, nextSessionDay), hour: MARKET_DAILY_CLOSE_HOUR, minute: 0, second: 0 }, MARKET_SESSION_TIMEZONE);
    }
    if (interval === 'W') {
        const marketNow = getTimeZoneParts(now, MARKET_SESSION_TIMEZONE);
        const marketDate = zonedTimeToDate({ ...marketNow, hour: 0, minute: 0, second: 0 }, MARKET_SESSION_TIMEZONE);
        const daysUntilFriday = (MARKET_WEEKLY_CLOSE_DAY - marketDate.getUTCDay() + 7) % 7;
        const isAfterFridayClose = daysUntilFriday === 0 && marketNow.hour >= MARKET_WEEKLY_CLOSE_HOUR;
        const nextCloseDay = daysUntilFriday + (isAfterFridayClose ? 7 : 0);
        return zonedTimeToDate({ ...addLocalDays(marketNow, nextCloseDay), hour: MARKET_WEEKLY_CLOSE_HOUR, minute: 0, second: 0 }, MARKET_SESSION_TIMEZONE);
    }
    const monthMatch = interval.match(/^(\d*)M$/);
    if (monthMatch) {
        const monthsPerBar = Number(monthMatch[1] || 1);
        const marketNow = getTimeZoneParts(now, MARKET_SESSION_TIMEZONE);
        const lastDayOfCurrentMonth = new Date(Date.UTC(marketNow.year, marketNow.month, 0)).getUTCDate();
        const isPastCurrentMonthClose = marketNow.day === lastDayOfCurrentMonth && marketNow.hour >= MARKET_DAILY_CLOSE_HOUR;
        const currentMonthIndex = marketNow.month - 1 + (isPastCurrentMonthClose ? 1 : 0);
        const targetMonthIndex = Math.floor(currentMonthIndex / monthsPerBar) * monthsPerBar + monthsPerBar;
        const barEndYear = marketNow.year + Math.floor((targetMonthIndex - 1) / 12);
        const barEndMonth = ((targetMonthIndex - 1) % 12) + 1;
        const barEndDay = new Date(Date.UTC(barEndYear, barEndMonth, 0)).getUTCDate();
        return zonedTimeToDate({ year: barEndYear, month: barEndMonth, day: barEndDay, hour: MARKET_DAILY_CLOSE_HOUR, minute: 0, second: 0 }, MARKET_SESSION_TIMEZONE);
    }
    return null;
}

function formatTimeRemaining(interval: string, now: Date) {
    const nextBoundary = getNextIntervalBoundary(interval, now);
    if (!nextBoundary) return 'Live';
    const remainingSeconds = Math.max(0, Math.floor((nextBoundary.getTime() - now.getTime()) / 1000));
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
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => readWorkspaceId([...readWorkspaces(), ...BUILT_IN_WORKSPACES]));
    const [view, setView] = useState<View>(readView);
    const [graphTimeframe, setGraphTimeframe] = useState<Timeframe>(() => readChartSettings().timeframe);
    const [chartTimezone, setChartTimezone] = useState(() => readChartSettings().timezone);
    const [exploreSymbol, setExploreSymbol] = useState('NASDAQ:AAPL');
    const [exploreDescription, setExploreDescription] = useState('');
    const [pendingHomeSymbols, setPendingHomeSymbols] = useState<{ workspaceId: string; symbols: string[]; hasTickerChanges: boolean } | null>(null);
    const [isTimeframeMenuOpen, setIsTimeframeMenuOpen] = useState(false);
    const [isTimezoneMenuOpen, setIsTimezoneMenuOpen] = useState(false);
    const [isWidgetMenuOpen, setIsWidgetMenuOpen] = useState(false);
    const [isTimeframeStatusOpen, setIsTimeframeStatusOpen] = useState(false);
    const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
    const [showTopToolbar, setShowTopToolbar] = useState(() => readChartSettings().showTopToolbar);
    const [showSideToolbar, setShowSideToolbar] = useState(() => readChartSettings().showSideToolbar);
    const [showDetails, setShowDetails] = useState(() => readChartSettings().showDetails);
    const [exploreShowTopToolbar, setExploreShowTopToolbar] = useState(() => readWidgetSettings(EXPLORE_CHART_SETTINGS_STORAGE_KEY).showTopToolbar);
    const [exploreShowSideToolbar, setExploreShowSideToolbar] = useState(() => readWidgetSettings(EXPLORE_CHART_SETTINGS_STORAGE_KEY).showSideToolbar);
    const [exploreShowDetails, setExploreShowDetails] = useState(() => readWidgetSettings(EXPLORE_CHART_SETTINGS_STORAGE_KEY).showDetails);
    const [now, setNow] = useState(() => new Date());
    const [dialog, setDialog] = useState<Dialog>(null);
    const [draftName, setDraftName] = useState('');
    const [draftDescription, setDraftDescription] = useState('');
    const [draftSymbols, setDraftSymbols] = useState('');
    const [draftChartStyle, setDraftChartStyle] = useState<ChartStyle | ''>('');
    const [draftDefaultTimeframe, setDraftDefaultTimeframe] = useState<Timeframe | ''>('');
    const [exportScope, setExportScope] = useState<ExportScope>('active');
    const [importDestination, setImportDestination] = useState<ImportDestination>('new-tabs');
    const [importError, setImportError] = useState<string | null>(null);
    const [canInstall, setCanInstall] = useState(false);
    const [isStandalone, setIsStandalone] = useState(isRunningStandalone);
    const [hasInstalledApp, setHasInstalledApp] = useState(() => isRunningStandalone() || readInstalledState());
    const timeframeMenuRef = useRef<HTMLDivElement | null>(null);
    const timezoneMenuRef = useRef<HTMLDivElement | null>(null);
    const widgetMenuRef = useRef<HTMLDivElement | null>(null);
    const timeframeStatusRef = useRef<HTMLDivElement | null>(null);
    const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

    const allWorkspaces = [...workspaces, ...BUILT_IN_WORKSPACES];
    const activeWorkspace = allWorkspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? allWorkspaces[0];
    const isActiveWorkspaceBuiltIn = BUILT_IN_WORKSPACES.some((workspace) => workspace.id === activeWorkspace.id);

    useEffect(() => {
        const defaultTimeframe = activeWorkspace.defaultTimeframe;
        if (defaultTimeframe && defaultTimeframe in TIMEFRAMES) {
            setGraphTimeframe(defaultTimeframe as Timeframe);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWorkspace.id]);
    const activeWorkspaceMetadata = getWorkspaceDescription(activeWorkspace);
    const homeSymbols = pendingHomeSymbols?.workspaceId === activeWorkspace.id ? pendingHomeSymbols.symbols : activeWorkspace.symbols;
    const hasUnsavedHomeTickerChanges = pendingHomeSymbols?.workspaceId === activeWorkspace.id && pendingHomeSymbols.hasTickerChanges;
    const isAppInstalled = hasInstalledApp || isStandalone;
    const shouldShowInstallButton = canInstall && !isAppInstalled;
    const timezoneOptions = TIMEZONE_OPTIONS.some((option) => option.value === chartTimezone)
        ? TIMEZONE_OPTIONS
        : [{ value: chartTimezone, label: chartTimezone }, ...TIMEZONE_OPTIONS];
    const activeTimezoneLabel = timezoneOptions.find((option) => option.value === chartTimezone)?.label ?? chartTimezone;
    const activeTimeRemaining = formatTimeRemaining(TIMEFRAMES[graphTimeframe].tradingViewInterval, now);
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, workspaces } satisfies WorkspaceExport));
    }, [workspaces]);

    useEffect(() => {
        localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify({
            version: 1,
            timeframe: graphTimeframe,
            timezone: chartTimezone,
            showTopToolbar,
            showSideToolbar,
            showDetails,
        } satisfies ChartSettings));
    }, [graphTimeframe, chartTimezone, showTopToolbar, showSideToolbar, showDetails]);

    useEffect(() => {
        localStorage.setItem(EXPLORE_CHART_SETTINGS_STORAGE_KEY, JSON.stringify({
            version: 1,
            showTopToolbar: exploreShowTopToolbar,
            showSideToolbar: exploreShowSideToolbar,
            showDetails: exploreShowDetails,
        } satisfies WidgetSettings));
    }, [exploreShowTopToolbar, exploreShowSideToolbar, exploreShowDetails]);

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
            if (!widgetMenuRef.current?.contains(event.target as Node)) {
                setIsWidgetMenuOpen(false);
            }
            if (!timeframeStatusRef.current?.contains(event.target as Node)) {
                setIsTimeframeStatusOpen(false);
            }
            if (!workspaceMenuRef.current?.contains(event.target as Node)) {
                setIsWorkspaceMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', closeTimeframeMenu);
        return () => document.removeEventListener('mousedown', closeTimeframeMenu);
    }, []);

    useEffect(() => {
        let timeoutId = 0;
        const syncClock = () => {
            setNow(new Date());
            timeoutId = window.setTimeout(syncClock, 1000 - (Date.now() % 1000));
        };

        timeoutId = window.setTimeout(syncClock, 1000 - (Date.now() % 1000));
        return () => window.clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
        const standaloneQuery = window.matchMedia('(display-mode: standalone)');
        const syncStandaloneState = () => {
            const isStandaloneMode = isRunningStandalone();
            setIsStandalone(isStandaloneMode);
            if (isStandaloneMode) {
                setHasInstalledApp(true);
                localStorage.setItem(INSTALL_STATE_STORAGE_KEY, 'true');
            }
        };
        const captureInstallPrompt = (event: Event) => {
            event.preventDefault();
            installPromptRef.current = event as BeforeInstallPromptEvent;
            setCanInstall(true);
        };
        const clearInstallPrompt = () => {
            installPromptRef.current = null;
            setCanInstall(false);
            setIsStandalone(true);
            setHasInstalledApp(true);
            localStorage.setItem(INSTALL_STATE_STORAGE_KEY, 'true');
        };

        standaloneQuery.addEventListener('change', syncStandaloneState);
        window.addEventListener('beforeinstallprompt', captureInstallPrompt);
        window.addEventListener('appinstalled', clearInstallPrompt);
        return () => {
            standaloneQuery.removeEventListener('change', syncStandaloneState);
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
        setDraftDescription('');
        setDraftSymbols('');
        setDraftChartStyle('');
        setDraftDefaultTimeframe('');
        setDialog('create');
    };

    const openImportDialog = () => {
        if (isActiveWorkspaceBuiltIn) {
            setImportDestination('new-tabs');
        }
        setDialog('import');
    };

    const openEditDialog = (workspace: ChartWorkspace = activeWorkspace) => {
        setActiveWorkspaceId(workspace.id);
        setDraftName(workspace.name);
        setDraftDescription(workspace.description ?? '');
        setDraftSymbols(workspace.symbols.join(', '));
        setDraftChartStyle(workspace.chartStyle ?? '');
        setDraftDefaultTimeframe((workspace.defaultTimeframe as Timeframe) ?? '');
        setDialog('edit');
    };

    const saveWorkspace = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = draftName.trim();
        if (!name) return;
        const description = draftDescription.trim();
        const symbols = normalizeSymbols(draftSymbols);
        const chartStyle = draftChartStyle || undefined;
        const defaultTimeframe = draftDefaultTimeframe || undefined;

        if (dialog === 'create') {
            const workspace = { id: createId(), name, description, symbols, chartStyle, defaultTimeframe };
            setWorkspaces((current) => [...current, workspace]);
            setActiveWorkspaceId(workspace.id);
        } else {
            setWorkspaces((current) => current.map((workspace) =>
                workspace.id === activeWorkspace.id ? { ...workspace, name, description, symbols, chartStyle, defaultTimeframe } : workspace
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

    const selectWorkspace = (workspaceId: string) => {
        setPendingHomeSymbols(null);
        setActiveWorkspaceId(workspaceId);
        setView('home');
    };

    const openSymbolInExplore = (symbol: string) => {
        setExploreSymbol(symbol);
        setExploreDescription('');
        setView('explore');
    };

    const updateExploreSymbol = (symbol: string) => {
        setExploreSymbol(symbol);
        setExploreDescription('');
    };

    const updateHomeSymbol = (symbolIndex: number, nextSymbol: string) => {
        if (isActiveWorkspaceBuiltIn) return;
        setPendingHomeSymbols((current) => {
            const symbols = current?.workspaceId === activeWorkspace.id ? current.symbols : activeWorkspace.symbols;
            if (symbolIndex < 0 || symbolIndex >= symbols.length || symbols[symbolIndex] === nextSymbol) return current;
            const nextSymbols = [...symbols];
            nextSymbols[symbolIndex] = nextSymbol;
            return { workspaceId: activeWorkspace.id, symbols: nextSymbols, hasTickerChanges: true };
        });
    };

    const addHomeChart = () => {
        if (isActiveWorkspaceBuiltIn) return;
        setPendingHomeSymbols((current) => ({
            workspaceId: activeWorkspace.id,
            symbols: ['NASDAQ:AAPL', ...(current?.workspaceId === activeWorkspace.id ? current.symbols : activeWorkspace.symbols)],
            hasTickerChanges: current?.workspaceId === activeWorkspace.id ? current.hasTickerChanges : false,
        }));
    };

    const deleteHomeChart = (symbolIndex: number) => {
        if (isActiveWorkspaceBuiltIn) return;
        setPendingHomeSymbols((current) => {
            const symbols = current?.workspaceId === activeWorkspace.id ? current.symbols : activeWorkspace.symbols;
            if (symbolIndex < 0 || symbolIndex >= symbols.length) return current;
            return { workspaceId: activeWorkspace.id, symbols: symbols.filter((_, index) => index !== symbolIndex), hasTickerChanges: true };
        });
    };

    const saveHomeTickerChanges = () => {
        if (isActiveWorkspaceBuiltIn || !hasUnsavedHomeTickerChanges) return;
        setWorkspaces((current) => current.map((workspace) =>
            workspace.id === activeWorkspace.id ? { ...workspace, symbols: homeSymbols } : workspace
        ));
        setPendingHomeSymbols(null);
    };

    const focusWorkspace = (workspaceId: string) => {
        setPendingHomeSymbols(null);
        setActiveWorkspaceId(workspaceId);
    };

    const selectHomeWorkspace = (workspaceId: string) => {
        setPendingHomeSymbols(null);
        setActiveWorkspaceId(workspaceId);
        setIsWorkspaceMenuOpen(false);
    };

    const workspacePicker = (
        <div ref={workspaceMenuRef} className="relative mt-1">
            <button
                type="button"
                aria-expanded={isWorkspaceMenuOpen}
                aria-haspopup="listbox"
                aria-label="Current graph set"
                title={activeWorkspaceMetadata}
                onClick={() => setIsWorkspaceMenuOpen((isOpen) => !isOpen)}
                className="flex max-w-full items-center gap-2 text-left text-xl font-bold text-white outline-none hover:text-sky-100 focus-visible:ring-2 focus-visible:ring-sky-400"
            >
                <span className="truncate">{activeWorkspace.name}</span>
                <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isActiveWorkspaceBuiltIn ? 'border-sky-400/30 bg-sky-400/10 text-sky-200' : 'border-slate-600 text-slate-400'}`}>{isActiveWorkspaceBuiltIn ? 'Market story' : 'Custom'}</span>
                <span aria-hidden="true" className={`mb-1 h-2 w-2 shrink-0 rotate-45 border-b-2 border-r-2 border-slate-400 transition-transform ${isWorkspaceMenuOpen ? 'rotate-[225deg]' : ''}`} />
            </button>
            {isWorkspaceMenuOpen && (
                <div role="listbox" aria-label="Graph sets" className="absolute left-0 top-[calc(100%+8px)] z-40 w-72 overflow-hidden border border-[#343941] bg-[#1f1f20] py-1 text-sm text-slate-100 shadow-xl">
                    {allWorkspaces.map((workspace) => (
                        <button
                            key={workspace.id}
                            type="button"
                            role="option"
                            aria-selected={workspace.id === activeWorkspace.id}
                            title={getWorkspaceDescription(workspace)}
                            onClick={() => selectHomeWorkspace(workspace.id)}
                            className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-3 py-2 text-left hover:bg-[#36383d] ${workspace.id === activeWorkspace.id ? 'bg-[#2962cc] text-white hover:bg-[#2962cc]' : ''}`}
                        >
                            <span className="min-w-0"><span className="block truncate font-semibold">{workspace.name}</span><span className={`mt-1 inline-block rounded-sm border px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${BUILT_IN_WORKSPACES.some((builtInWorkspace) => builtInWorkspace.id === workspace.id) ? 'border-sky-400/30 bg-sky-400/10 text-sky-200' : 'border-slate-600 text-slate-400'}`}>{BUILT_IN_WORKSPACES.some((builtInWorkspace) => builtInWorkspace.id === workspace.id) ? 'Market story' : 'Custom'}</span></span>
                            <span className={`text-xs ${workspace.id === activeWorkspace.id ? 'text-sky-100' : 'text-slate-400'}`}>{workspace.symbols.length} {workspace.symbols.length === 1 ? 'symbol' : 'symbols'}</span>
                        </button>
                    ))}
                    <div className="mt-1 border-t border-[#343941] px-1 pt-1">
                        <button type="button" onClick={() => { setIsWorkspaceMenuOpen(false); setView('sets'); }} className="w-full px-2 py-2 text-left text-xs font-semibold text-sky-300 hover:bg-[#36383d] hover:text-sky-100">Manage graph sets</button>
                    </div>
                </div>
            )}
        </div>
    );

    const widgetToolbarControl = (
        symbolCount: number,
        settings: {
            showTopToolbar: boolean;
            showSideToolbar: boolean;
            showDetails: boolean;
            setShowTopToolbar: (value: boolean) => void;
            setShowSideToolbar: (value: boolean) => void;
            setShowDetails: (value: boolean) => void;
        }
    ) => {
        const enabledWidgetAreas = [settings.showTopToolbar ? 'Top' : '', settings.showSideToolbar ? 'Side' : '', settings.showDetails ? 'Bottom' : ''].filter(Boolean);
        const widgetToolbarSummary = enabledWidgetAreas.join(' + ') || 'Off';

        return (
            <div ref={widgetMenuRef} className="relative">
                <button
                    type="button"
                    aria-expanded={isWidgetMenuOpen}
                    aria-haspopup="dialog"
                    aria-label="Configurations"
                    onClick={() => { setIsWidgetMenuOpen((isOpen) => !isOpen); setIsTimeframeMenuOpen(false); setIsTimezoneMenuOpen(false); setIsTimeframeStatusOpen(false); }}
                    className="flex h-9 min-w-32 items-center justify-between gap-2 border border-[#303540] bg-[#151821] px-3 text-left text-xs hover:border-slate-500 hover:bg-[#20232c] focus:border-blue-500 focus:outline-none"
                    title="Configurations"
                >
                    <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{symbolCount} {symbolCount === 1 ? 'Symbol' : 'Symbols'}</span>
                        <span className="block truncate font-semibold text-slate-100">Configurations</span>
                    </span>
                    <span aria-hidden="true" className="ml-2 text-slate-400">&gt;</span>
                </button>
                {isWidgetMenuOpen && (
                    <div role="dialog" aria-label="Configurations" className="absolute right-0 top-[calc(100%+4px)] z-[70] w-56 border border-[#343941] bg-[#1f1f20] p-2 text-xs text-slate-100 shadow-xl">
                        <div className="mb-2 flex items-center justify-between border-b border-trading-border pb-2">
                            <span className="font-semibold text-white">Configurations</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{widgetToolbarSummary}</span>
                        </div>
                        <label className="flex cursor-pointer items-center justify-between gap-3 px-2 py-2 hover:bg-[#36383d]">
                            <span><span className="block font-semibold">Top</span><span className="block text-[11px] text-slate-500">Toolbar and legend</span></span>
                            <input type="checkbox" checked={settings.showTopToolbar} onChange={(event) => settings.setShowTopToolbar(event.target.checked)} />
                        </label>
                        <label className="flex cursor-pointer items-center justify-between gap-3 px-2 py-2 hover:bg-[#36383d]">
                            <span><span className="block font-semibold">Side toolbar</span><span className="block text-[11px] text-slate-500">Drawings and tools</span></span>
                            <input type="checkbox" checked={settings.showSideToolbar} onChange={(event) => settings.setShowSideToolbar(event.target.checked)} />
                        </label>
                        <label className="flex cursor-pointer items-center justify-between gap-3 px-2 py-2 hover:bg-[#36383d]">
                            <span><span className="block font-semibold">Bottom</span><span className="block text-[11px] text-slate-500">Date range and details</span></span>
                            <input type="checkbox" checked={settings.showDetails} onChange={(event) => settings.setShowDetails(event.target.checked)} />
                        </label>
                    </div>
                )}
            </div>
        );
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
                    description: typeof workspace.description === 'string' ? workspace.description.trim() : '',
                    symbols: normalizeSymbols(workspace.symbols),
                }));

            if (!imported?.length) {
                throw new Error('No workspace found');
            }

            if (importDestination === 'active' && !isActiveWorkspaceBuiltIn) {
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
                    <div className="min-w-0 flex-1" />
                    {shouldShowInstallButton && (
                        <button
                            type="button"
                            onClick={installApp}
                            className="install-app-button shrink-0"
                            title="Install Quoter as an app"
                        >
                            <span aria-hidden="true" className="install-app-button-icon" />
                            <span className="install-app-button-copy">
                                <span className="install-app-button-kicker">App</span>
                                <span>Install</span>
                            </span>
                        </button>
                    )}
                    {(view === 'home' || view === 'explore') && (
                        <div className="ml-auto flex shrink-0 items-center gap-1 rounded border border-[#303540] bg-[#151821] p-1">
                            <div ref={timeframeStatusRef} className="relative order-last">
                                <button
                                    type="button"
                                    aria-expanded={isTimeframeStatusOpen}
                                    aria-haspopup="dialog"
                                    onClick={() => { setIsTimeframeStatusOpen((isOpen) => !isOpen); setIsTimezoneMenuOpen(false); setIsWidgetMenuOpen(false); setIsTimeframeMenuOpen(false); }}
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
                                                                <span className="font-mono text-[11px]">{formatTimeRemaining(TIMEFRAMES[timeframe].tradingViewInterval, now)}</span>
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
                                    onClick={() => { setIsTimezoneMenuOpen((isOpen) => !isOpen); setIsTimeframeMenuOpen(false); setIsWidgetMenuOpen(false); setIsTimeframeStatusOpen(false); }}
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
                                    onClick={() => { setIsTimeframeMenuOpen((isOpen) => !isOpen); setIsTimezoneMenuOpen(false); setIsWidgetMenuOpen(false); setIsTimeframeStatusOpen(false); }}
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

            <main className="mx-auto max-w-[1600px] px-10 py-5 sm:px-16 sm:py-8">
                <HomePage
                    key={activeWorkspace.id}
                    activeWorkspace={{ ...activeWorkspace, symbols: homeSymbols }}
                    description={activeWorkspaceMetadata}
                    timeframe={graphTimeframe}
                    timezone={chartTimezone}
                    showTopToolbar={showTopToolbar}
                    showSideToolbar={showSideToolbar}
                    showDetails={showDetails}
                    widgetToolbarControl={view === 'home' ? widgetToolbarControl(homeSymbols.length, {
                        showTopToolbar,
                        showSideToolbar,
                        showDetails,
                        setShowTopToolbar,
                        setShowSideToolbar,
                        setShowDetails,
                    }) : null}
                    workspacePicker={workspacePicker}
                    isActive={view === 'home'}
                    isEditable={!isActiveWorkspaceBuiltIn}
                    hasUnsavedTickerChanges={hasUnsavedHomeTickerChanges}
                    onOpenExplore={openSymbolInExplore}
                    onOpenGraphSets={() => setView('sets')}
                    onSymbolChange={updateHomeSymbol}
                    onAddChart={addHomeChart}
                    onDeleteChart={deleteHomeChart}
                    onEditWorkspace={() => openEditDialog()}
                    onSaveTickerChanges={saveHomeTickerChanges}
                />
                <ExplorePage
                    symbol={exploreSymbol}
                    description={exploreDescription}
                    timeframe={graphTimeframe}
                    timezone={chartTimezone}
                    showTopToolbar={exploreShowTopToolbar}
                    showSideToolbar={exploreShowSideToolbar}
                    showDetails={exploreShowDetails}
                    widgetToolbarControl={view === 'explore' ? widgetToolbarControl(1, {
                        showTopToolbar: exploreShowTopToolbar,
                        showSideToolbar: exploreShowSideToolbar,
                        showDetails: exploreShowDetails,
                        setShowTopToolbar: setExploreShowTopToolbar,
                        setShowSideToolbar: setExploreShowSideToolbar,
                        setShowDetails: setExploreShowDetails,
                    }) : null}
                    isActive={view === 'explore'}
                    getCandleStatus={(statusTimeframe) => formatTimeRemaining(TIMEFRAMES[statusTimeframe].tradingViewInterval, now)}
                    onSymbolChange={updateExploreSymbol}
                    onSymbolNameChange={setExploreDescription}
                />
                {view === 'sets' ? (
                    <section className="mx-auto max-w-6xl">
                        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-trading-border pb-5">
                            <div>
                                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">Workspace library</div>
                                <h1 className="text-2xl font-bold text-white">Graph sets</h1>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={openImportDialog} className="app-button app-button-secondary">Import</button>
                                <button type="button" onClick={() => setDialog('export')} className="app-button app-button-secondary">Export</button>
                                <button type="button" onClick={openCreateDialog} className="app-button app-button-primary">Add graph set</button>
                            </div>
                        </div>
                        <section aria-labelledby="custom-sets-title">
                            <div className="mb-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Your graph sets</div>
                                <h2 id="custom-sets-title" className="mt-1 text-lg font-bold text-white">Custom sets</h2>
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
                                                <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-bold text-white">{workspace.name}</h2><span className="rounded-sm border border-slate-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Custom</span>{workspace.id === activeWorkspace.id && <span className="rounded-sm bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">Active</span>}</div>
                                                <p className="mt-2 text-xs font-medium text-slate-400">{workspace.symbols.length} symbols</p>
                                            </div>
                                            <a href={workspaceUrl(workspace.id)} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="app-icon-button" aria-label={`Open ${workspace.name} in a new window`} title="Open in a new window"><span aria-hidden="true">↗</span></a>
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
                        <section className="mt-10 border-t border-trading-border pt-6" aria-labelledby="market-stories-title">
                            <div className="mb-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">Built-in graph sets</div>
                                <h2 id="market-stories-title" className="mt-1 text-lg font-bold text-white">Market stories</h2>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {BUILT_IN_WORKSPACES.map((workspace) => (
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
                                                <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-bold text-white">{workspace.name}</h3><span className="rounded-sm border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-200">Market story</span>{workspace.id === activeWorkspace.id && <span className="rounded-sm bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">Active</span>}</div>
                                                <p className="mt-2 text-xs font-medium text-slate-400">{workspace.symbols.length} symbols</p>
                                            </div>
                                            <a href={workspaceUrl(workspace.id)} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="app-icon-button" aria-label={`Open ${workspace.name} in a new window`} title="Open in a new window"><span aria-hidden="true">↗</span></a>
                                        </div>
                                        <p className="mt-5 min-h-10 text-xs leading-5 text-slate-400">{workspace.description}</p>
                                        <p className="mt-3 line-clamp-1 text-xs leading-5 text-slate-500">{workspace.symbols.join(', ')}</p>
                                        <div className="mt-5 flex items-center justify-between border-t border-trading-border pt-4">
                                            <button type="button" onClick={(event) => { event.stopPropagation(); selectWorkspace(workspace.id); }} className="app-button app-button-open">Open set</button>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Read-only</span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </section>
                ) : null}
            </main>

            {dialog !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={closeDialog}>
                    <section role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg border border-[#3b4352] bg-[#151821] shadow-2xl">
                        {(dialog === 'create' || dialog === 'edit') && (
                            <form onSubmit={saveWorkspace}>
                                <div className="border-b border-trading-border px-4 py-3"><h1 id="dialog-title" className="text-sm font-bold text-white">{dialog === 'create' ? 'Add chart tab' : 'Edit chart tab'}</h1></div>
                                <div className="space-y-4 p-4">
                                    <label className="block text-xs font-medium text-slate-300">Tab name<input autoFocus required value={draftName} onChange={(event) => setDraftName(event.target.value)} className="mt-1 h-9 w-full border border-[#3b4352] bg-[#0d0f15] px-2 text-sm text-white focus:border-blue-500 focus:outline-none" /></label>
                                    <label className="block text-xs font-medium text-slate-300">Description<textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} placeholder="What does this set help you follow?" rows={2} className="mt-1 w-full resize-y border border-[#3b4352] bg-[#0d0f15] p-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none" /></label>
                                    <label className="block text-xs font-medium text-slate-300">Symbols<textarea value={draftSymbols} onChange={(event) => setDraftSymbols(event.target.value)} placeholder="AAPL, MSFT, NVDA" rows={4} className="mt-1 w-full border border-[#3b4352] bg-[#0d0f15] p-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none" /></label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="block text-xs font-medium text-slate-300">Chart type
                                            <select value={draftChartStyle} onChange={(event) => setDraftChartStyle(event.target.value as ChartStyle | '')} className="mt-1 h-9 w-full border border-[#3b4352] bg-[#0d0f15] px-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                                                <option value="">App default</option>
                                                {CHART_STYLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                            </select>
                                        </label>
                                        <label className="block text-xs font-medium text-slate-300">Default timeframe
                                            <select value={draftDefaultTimeframe} onChange={(event) => setDraftDefaultTimeframe(event.target.value as Timeframe | '')} className="mt-1 h-9 w-full border border-[#3b4352] bg-[#0d0f15] px-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                                                <option value="">App default</option>
                                                {TIMEFRAME_GROUPS.map((group) => group.values.map((timeframeValue) => <option key={timeframeValue} value={timeframeValue}>{TIMEFRAMES[timeframeValue].label}</option>))}
                                            </select>
                                        </label>
                                    </div>
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
                                <fieldset className="space-y-3 p-4 text-sm text-slate-300"><legend className="mb-2 text-xs text-slate-400">Where should the imported workspace go?</legend><label className="flex items-center gap-2"><input type="radio" checked={importDestination === 'new-tabs'} onChange={() => setImportDestination('new-tabs')} /> Add as new tabs</label>{!isActiveWorkspaceBuiltIn && <label className="flex items-center gap-2"><input type="radio" checked={importDestination === 'active'} onChange={() => setImportDestination('active')} /> Replace {activeWorkspace.name}</label>}<label className="flex items-center gap-2 text-rose-200"><input type="radio" checked={importDestination === 'replace-all'} onChange={() => setImportDestination('replace-all')} /> Replace all graph sets</label>{importError && <p className="text-xs text-rose-300">{importError}</p>}</fieldset>
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