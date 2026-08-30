export interface ChartWorkspace {
    id: string;
    name: string;
    description?: string;
    symbols: string[];
}

export interface BuiltInWorkspace extends ChartWorkspace {
    description: string;
}

export interface WorkspaceExport {
    version: 1;
    workspaces: ChartWorkspace[];
}

export type View = 'home' | 'explore' | 'sets';
