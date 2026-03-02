import { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, FormControl, InputLabel, Select, MenuItem,
    Box, FormControlLabel, Switch, Typography
} from '@mui/material';
import { v4 as uuidv4 } from 'uuid';
import type { StageName, ChartConfig } from '../../types';

interface AddChartModalProps {
    open: boolean;
    onClose: () => void;
    onAdd: (config: ChartConfig) => void;
    initialSelectedRunIds?: string[];
}

const METRICS = ['WNS', 'TNS', 'FEP', 'area_mm2', 'leakage_mw', 'drc_count', 'flow_cputime_s', 'flow_realtime_s'];
const STAGES: StageName[] = ['PRECTS', 'CTS', 'POSTROUTE'];

export function AddChartModal({ open, onClose, onAdd, initialSelectedRunIds }: AddChartModalProps) {
    const [metric, setMetric] = useState<string>('WNS');
    const [pathGroup, setPathGroup] = useState<string>('all');
    const [targetStage, setTargetStage] = useState<StageName>('POSTROUTE');
    const [isIntermediate, setIsIntermediate] = useState<boolean>(false);

    // If the modal was launched from a selection context, we assume the user only wants to graph those selections.
    // If open without selection (e.g., from workspace directly), initialSelectedRunIds will be undefined/empty.
    const runIdsToSave = initialSelectedRunIds && initialSelectedRunIds.length > 0 ? initialSelectedRunIds : undefined;

    const handleSave = () => {
        const config: ChartConfig = {
            id: uuidv4(),
            metric,
            pathGroup,
            targetStage,
            isIntermediate,
            runIds: runIdsToSave
        };
        onAdd(config);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Add New Chart</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Metric</InputLabel>
                        <Select value={metric} label="Metric" onChange={(e) => setMetric(e.target.value)}>
                            {METRICS.map(m => <MenuItem key={m} value={m}>{m.toUpperCase()}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel>Path Group / View</InputLabel>
                        <Select value={pathGroup} label="Path Group / View" onChange={(e) => setPathGroup(e.target.value)}>
                            <MenuItem value="all">all</MenuItem>
                            <MenuItem value="reg2reg">reg2reg</MenuItem>
                            <MenuItem value="default">default</MenuItem>
                            <MenuItem value="In2reg">In2reg</MenuItem>
                            <MenuItem value="Reg2out">Reg2out</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel>Target Stage</InputLabel>
                        <Select value={targetStage} label="Target Stage" onChange={(e) => setTargetStage(e.target.value as StageName)}>
                            {STAGES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <Box sx={{ mt: 1 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={isIntermediate}
                                    onChange={(e) => setIsIntermediate(e.target.checked)}
                                    color="primary"
                                />
                            }
                            label="Compare Intermediate Milestone Trends"
                        />
                        {isIntermediate && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
                                This will graph the progression of `place_opt_design` passes on the X-Axis, comparing all selected runs against each other as separate lines.
                            </Typography>
                        )}
                    </Box>

                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                >
                    Create Chart
                </Button>
            </DialogActions>
        </Dialog>
    );
}
