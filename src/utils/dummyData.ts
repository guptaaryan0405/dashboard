import { v4 as uuidv4 } from 'uuid';
import type { Run } from '../types';

export const generateDummyData = (): Run[] => {
    return [
        {
            id: uuidv4(),
            run_tag: 'pnr_tag12_76Dx_5p0ghz_10feb',
            frequency_ghz: 4.7,
            date: '2023-10-26T10:00:00Z',
            stages: {
                PRECTS: {
                    stage: 'PRECTS',
                    views: {
                        ALL: { WNS: -0.01, TNS: -1, FEP: 1000 },
                        REG2REG: { WNS: -0.01, TNS: -1, FEP: 1000 },
                    },
                    metrics: { area_mm2: 254880.037, leakage_mw: 923, drc_count: 350 },
                },
                CTS: {
                    stage: 'CTS',
                    views: {
                        ALL: { WNS: -0.01, TNS: -1, FEP: 1000 },
                        REG2REG: { WNS: -0.01, TNS: -1, FEP: 1000 },
                    },
                    metrics: { area_mm2: 254880.037, leakage_mw: 923, drc_count: 350 },
                },
                POSTROUTE: {
                    stage: 'POSTROUTE',
                    views: {
                        ALL: { WNS: -0.01, TNS: -1, FEP: 1000 },
                        REG2REG: { WNS: -0.01, TNS: -1, FEP: 1000 },
                    },
                    metrics: { area_mm2: 254880.037, leakage_mw: 923, drc_count: 350 },
                }
            }
        },
        {
            id: uuidv4(),
            run_tag: 'test_run_partial_data',
            frequency_ghz: 5.0,
            notes: 'This run stopped at CTS',
            stages: {
                PRECTS: {
                    stage: 'PRECTS',
                    views: {
                        ALL: { WNS: 0.05, TNS: 0, FEP: 0 },
                    },
                    metrics: { area_mm2: 250000.1, leakage_mw: 900, drc_count: 10 },
                },
                CTS: {
                    stage: 'CTS',
                    views: {
                        ALL: { WNS: -0.15, TNS: -10, FEP: 5000 },
                        REG2REG: { WNS: -0.05, TNS: -2, FEP: 200 },
                    },
                    metrics: { area_mm2: 251000.5, leakage_mw: 915 },
                }
            }
        },
        {
            id: uuidv4(),
            run_tag: 'baseline_run_stable',
            frequency_ghz: 4.0,
            stages: {
                PRECTS: {
                    stage: 'PRECTS',
                    views: { ALL: { WNS: 0.1, TNS: 0, FEP: 0 } },
                    metrics: { area_mm2: 240000.0, leakage_mw: 800, drc_count: 0 }
                },
                CTS: {
                    stage: 'CTS',
                    views: { ALL: { WNS: 0.05, TNS: 0, FEP: 0 } },
                    metrics: { area_mm2: 241000.0, leakage_mw: 810, drc_count: 20 }
                },
                POSTROUTE: {
                    stage: 'POSTROUTE',
                    views: {
                        ALL: { WNS: 0.02, TNS: 0, FEP: 0 },
                        REG2REG: { WNS: 0.05, TNS: 0, FEP: 0 }
                    },
                    metrics: { area_mm2: 242000.0, leakage_mw: 825, drc_count: 5 }
                }
            }
        }
    ];
};
