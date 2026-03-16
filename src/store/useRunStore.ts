import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Run, StageName } from '../types';
import { generateDummyData } from '../utils/dummyData';

interface FilterState {
    stages: Record<StageName, boolean>;
    pathGroups: Record<string, boolean>; // Replaced views with open string keys
}

export interface AutoConfig {
    path: string;
    lastRefreshTime: number | null;
    refreshIntervalMinutes: number;
}

interface RunState {
    runs: Run[];
    filters: FilterState;
    selectedRunId: string | null;
    autoConfig: AutoConfig;
    fileRef: File | null;
    fileHandle: any | null; // For showOpenFilePicker if supported

    // Actions
    addRun: (run: Run) => void;
    updateRun: (id: string, run: Run) => void;
    deleteRun: (id: string) => void;
    loadDummyData: () => void;
    clearAll: () => void;
    toggleStageFilter: (stage: StageName) => void;
    togglePathGroupFilter: (pg: string) => void;
    setSelectedRun: (id: string | null) => void;
    setAutoRefresh: (config: AutoConfig, fileRef: File | null, fileHandle: any | null) => void;
    setLastRefreshTime: (time: number) => void;
}

export const useRunStore = create<RunState>()(
    persist(
        (set) => ({
            runs: [],
            selectedRunId: null,
            autoConfig: {
                path: '',
                lastRefreshTime: null,
                refreshIntervalMinutes: 5
            },
            fileRef: null,
            fileHandle: null,
            filters: {
                stages: { PRECTS: true, CTS: true, ROUTE: true, POSTROUTE: true },
                pathGroups: { all: true, reg2reg: true }
            },
            addRun: (run) => set((state) => ({ runs: [...state.runs, run] })),
            updateRun: (id, updatedRun) => set((state) => ({
                runs: state.runs.map((r) => (r.id === id ? updatedRun : r))
            })),
            deleteRun: (id) => set((state) => ({
                runs: state.runs.filter((r) => r.id !== id)
            })),
            loadDummyData: () => set({ runs: generateDummyData() }),
            clearAll: () => set({ runs: [] }),
            toggleStageFilter: (stage) => set((state) => ({
                filters: { ...state.filters, stages: { ...state.filters.stages, [stage]: !state.filters.stages[stage] } }
            })),
            togglePathGroupFilter: (pg) => set((state) => ({
                filters: { ...state.filters, pathGroups: { ...state.filters.pathGroups, [pg]: !state.filters.pathGroups[pg] } }
            })),
            setSelectedRun: (id) => set({ selectedRunId: id }),
            setAutoRefresh: (config, fileRef, fileHandle) => set({ autoConfig: config, fileRef, fileHandle }),
            setLastRefreshTime: (time) => set((state) => ({ autoConfig: { ...state.autoConfig, lastRefreshTime: time } }))
        }),
        {
            name: 'dashboard-run-storage',
            partialize: (state) => Object.fromEntries(
                Object.entries(state).filter(([key]) => !['fileRef', 'fileHandle', 'runs'].includes(key))
            ),
        }
    )
);
