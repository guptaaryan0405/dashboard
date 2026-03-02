import { Grid, Typography, Button, Box } from '@mui/material';
import { useRunStore } from '../../store/useRunStore';
import { RunCard } from './RunCard';

import { useMemo } from 'react';

export function RunGrid() {
    const { runs, filters, loadDummyData } = useRunStore();

    const filteredRuns = useMemo(() => {
        return runs.filter((run) => {
            if (filters.searchQuery && !run.run_tag.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
                return false;
            }

            const hasAnySelectedStage = Object.entries(filters.stages)
                .filter(([, isChecked]) => isChecked)
                .some(([stageName]) => run.stages[stageName as keyof typeof run.stages] !== undefined);

            const hasNoStagesChecked = Object.values(filters.stages).every(v => !v);
            if (!hasAnySelectedStage && !hasNoStagesChecked) {
                return false;
            }

            return true;
        });
    }, [runs, filters]);

    if (runs.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    No runs found
                </Typography>
                <Button variant="contained" onClick={loadDummyData}>
                    Load Dummy Data
                </Button>
            </Box>
        );
    }

    return (
        <Grid container spacing={3}>
            {filteredRuns.map((run) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={run.id}>
                    <RunCard run={run} />
                </Grid>
            ))}
            {filteredRuns.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 8, width: '100%' }}>
                    <Typography color="text.secondary">No runs match your filters.</Typography>
                </Box>
            )}
        </Grid>
    );
}
