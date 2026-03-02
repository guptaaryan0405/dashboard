import { Box } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Run, StageName, ChartConfig } from '../../types';

interface ChartWidgetProps {
    config: ChartConfig;
    runs: Run[];
}

const getMetricValue = (run: Run, stage: StageName, metric: string, pathGroup: string) => {
    const stageData = run.stages[stage];
    if (!stageData) return null;

    if (metric === 'area_mm2' || metric === 'leakage_mw' || metric === 'drc_count') {
        const val = stageData.metrics?.[metric as keyof typeof stageData.metrics];
        return val ?? null;
    }

    if (metric === 'flow_cputime_s' || metric === 'flow_realtime_s') {
        const val = stageData.runtime?.[metric as keyof typeof stageData.runtime];
        return val ?? null;
    }

    const viewData = stageData.views?.[pathGroup];
    if (!viewData) return null;

    return viewData[metric as keyof typeof viewData] ?? null;
};

export function ChartWidget({ config, runs }: ChartWidgetProps) {
    const displayRuns = config.runIds ? runs.filter(r => config.runIds!.includes(r.id)) : runs;
    const { metric, pathGroup, targetStage, isIntermediate } = config;

    const renderChart = () => {
        if (isIntermediate) {
            // Compare across intermediate passes
            let maxPasses = 0;
            displayRuns.forEach(run => {
                const passes = run.stages[config.targetStage]?.intermediate?.length || 0;
                if (passes > maxPasses) maxPasses = passes;
            });

            if (maxPasses === 0) {
                return (
                    <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        No intermediate data available for this stage.
                    </Box>
                );
            }

            const data = Array.from({ length: maxPasses }).map((_, i) => {
                const pointData: any = { name: `Pass ${i + 1}` };

                displayRuns.forEach(run => {
                    const intStep = run.stages[targetStage]?.intermediate?.[i];
                    // Using "All Paths" if "all" isn't strictly available in intermediate
                    const safePathGroup = intStep?.views[pathGroup] ? pathGroup : 'All Paths';
                    pointData[run.run_tag] = intStep ? (intStep.views[safePathGroup]?.[metric as keyof typeof intStep.views[string]] ?? null) : null;
                });
                return pointData;
            });

            const colors = ['#1a73e8', '#e53935', '#43a047', '#fb8c00', '#8e24aa'];

            return (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {displayRuns.map((r, i) => (
                            <Line key={r.id} type="monotone" dataKey={r.run_tag} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            );
        }

        const data = displayRuns.map(run => {
            const point: any = { name: run.run_tag };
            point[pathGroup] = getMetricValue(run, targetStage, metric, pathGroup);
            return point;
        });

        return (
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey={pathGroup} stroke="#1a73e8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
            </ResponsiveContainer>
        );
    };

    return (
        <Box sx={{ width: '100%', height: 400 }}>
            {renderChart()}
        </Box>
    );
}
