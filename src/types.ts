export type StageName = 'PRECTS' | 'CTS' | 'ROUTE' | 'POSTROUTE';
export type PathGroupName = string; // e.g., 'all', 'reg2reg', 'default', 'In2reg', etc.

export interface TimingMetrics {
    WNS?: number; // ns
    TNS?: number; // ns
    FEP?: number;
    violating_paths?: number;
    all_paths?: number;
}

export interface StageLevelMetrics {
    area_mm2?: number;
    leakage_mw?: number;
    density_pct?: number;
    drc_count?: number;
    drc_shorts?: number;
    drc_total?: number;
    clock_buffer_count?: number;
    clock_inverter_count?: number;
    clock_icg_count?: number;
    clock_cell_area_um2?: number;
}

export type ViewMetrics = Record<PathGroupName, TimingMetrics>;

export interface IntermediateData {
    label: string;
    tnsopt_pass: number;
    place_opt_design: number;
    views: ViewMetrics;
}

export interface RuntimeData {
    flow_cputime?: string;
    flow_realtime?: string;
    flow_cputime_s?: number;
    flow_realtime_s?: number;
    timing_setup_tns?: number;
    timing_setup_wns?: number;
}

export interface StageData {
    stage: StageName;
    source_log?: string;
    status?: string;
    error_list?: string[];
    last_updated?: string;
    views?: Partial<ViewMetrics>;
    intermediate?: IntermediateData[];
    runtime?: RuntimeData;
    metrics?: StageLevelMetrics;
}

export interface ChartConfig {
    id: string;
    metric: string;
    pathGroup: string;
    targetStage: StageName;
    isIntermediate?: boolean;
    runIds?: string[];
}

export interface Run {
    id: string; // internal UUID
    run_tag: string; // Displayed tag
    parent_id?: string; // UUID of parent run for flowchart branching
    frequency_ghz?: number;
    date?: string;
    git_tag?: string;
    flow_version?: string;
    notes?: string;

    stages: Partial<Record<StageName, StageData>>;
}
