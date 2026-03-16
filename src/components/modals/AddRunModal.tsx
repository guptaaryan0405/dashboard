import { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Typography, Divider,
    FormControl, InputLabel, Select, MenuItem, Grid, Paper
} from '@mui/material';
import { v4 as uuidv4 } from 'uuid';
import { useRunStore } from '../../store/useRunStore';
import { parseLogToMetrics } from '../../utils/logParser';
import type { Run, StageName, StageData } from '../../types';

interface AddRunModalProps {
    open: boolean;
    onClose: () => void;
    existingRunId?: string | null;
}

const STAGES: StageName[] = ['PRECTS', 'CTS', 'ROUTE', 'POSTROUTE'];

export function AddRunModal({ open, onClose, existingRunId }: AddRunModalProps) {
    const { runs, addRun, updateRun } = useRunStore();

    const [runTag, setRunTag] = useState('');
    const [frequency, setFrequency] = useState('');
    const [parentId, setParentId] = useState<string>('none');

    // Multi-Stage State
    const [stageLogs, setStageLogs] = useState<Record<StageName, string>>({
        PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: ''
    });

    // Future expansion for manual entry like Area/Leakage/Timing overrides
    const [stageArea, setStageArea] = useState<Record<StageName, string>>({
        PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: ''
    });
    const [stageLeakage, setStageLeakage] = useState<Record<StageName, string>>({
        PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: ''
    });
    const [stageWns, setStageWns] = useState<Record<StageName, string>>({
        PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: ''
    });
    const [stageTns, setStageTns] = useState<Record<StageName, string>>({
        PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: ''
    });
    const [stageStatus, setStageStatus] = useState<Record<StageName, string>>({
        PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: ''
    });
    const [stageRuntime, setStageRuntime] = useState<Record<StageName, string>>({
        PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: ''
    });

    useEffect(() => {
        if (open) {
            if (existingRunId) {
                const runToEdit = runs.find(r => r.id === existingRunId);
                if (runToEdit) {
                    setRunTag(runToEdit.run_tag);
                    setFrequency(runToEdit.frequency_ghz?.toString() || '');
                    setParentId(runToEdit.parent_id || 'none');

                    // For editing, we don't try to reverse-engineer the log string. 
                    // We just allow them to paste NEW logs to overwrite, or input manual metrics.
                    setStageLogs({ PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' });

                    const initArea = { PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' };
                    const initLeakage = { PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' };
                    const initWns = { PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' };
                    const initTns = { PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' };
                    const initStatus = { PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' };
                    const initRuntime = { PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' };

                    STAGES.forEach(stage => {
                        const stageData = runToEdit.stages[stage];
                        if (stageData?.metrics) {
                            initArea[stage] = stageData.metrics.area_mm2 !== undefined ? stageData.metrics.area_mm2.toString() : '';
                            initLeakage[stage] = stageData.metrics.leakage_mw !== undefined ? stageData.metrics.leakage_mw.toString() : '';
                        }

                        // Prefill WNS/TNS from 'all' or 'All Paths' if it exists
                        const allMetrics = stageData?.views?.['all'] || stageData?.views?.['All Paths'];
                        if (allMetrics) {
                            initWns[stage] = allMetrics.WNS !== undefined ? allMetrics.WNS.toString() : '';
                            initTns[stage] = allMetrics.TNS !== undefined ? allMetrics.TNS.toString() : '';
                        }

                        if (stageData?.status) initStatus[stage] = stageData.status;
                        if (stageData?.runtime?.flow_realtime) initRuntime[stage] = stageData.runtime.flow_realtime;
                    });

                    setStageArea(initArea);
                    setStageLeakage(initLeakage);
                    setStageWns(initWns);
                    setStageTns(initTns);
                    setStageStatus(initStatus);
                    setStageRuntime(initRuntime);
                }
            } else {
                handleReset();
            }
        }
    }, [open, existingRunId, runs]);

    const handleSave = () => {
        if (!runTag) return;

        const baseRunId = existingRunId || uuidv4();
        const baseRunToEdit = runs.find(r => r.id === baseRunId);

        const newStages: Record<string, StageData> = baseRunToEdit ? { ...baseRunToEdit.stages } : {};

        STAGES.forEach(stage => {
            let stageData = newStages[stage] || { stage, views: {}, metrics: {} };
            let hasUpdates = false;

            // 1. Process Logs if pasted
            const logText = stageLogs[stage];
            if (logText && logText.trim().length > 0) {
                const parsedViews = parseLogToMetrics(logText);
                if (Object.keys(parsedViews).length > 0) {
                    // Merge new parsed views with existing
                    stageData.views = { ...stageData.views, ...parsedViews };
                    hasUpdates = true;
                }
            }

            // 2. Process Manual Metrics (Area, Leakage, WNS, TNS)
            const currentAreaStr = stageData.metrics?.area_mm2 !== undefined ? stageData.metrics.area_mm2.toString() : '';
            if (stageArea[stage] !== currentAreaStr) {
                stageData.metrics = stageData.metrics || {};
                if (stageArea[stage] === '') delete stageData.metrics.area_mm2;
                else stageData.metrics.area_mm2 = parseFloat(stageArea[stage]);
                hasUpdates = true;
            }

            const currentLeakStr = stageData.metrics?.leakage_mw !== undefined ? stageData.metrics.leakage_mw.toString() : '';
            if (stageLeakage[stage] !== currentLeakStr) {
                stageData.metrics = stageData.metrics || {};
                if (stageLeakage[stage] === '') delete stageData.metrics.leakage_mw;
                else stageData.metrics.leakage_mw = parseFloat(stageLeakage[stage]);
                hasUpdates = true;
            }

            const defaultKey = stageData.views?.['All Paths'] ? 'All Paths' : 'all';
            const currentViewMetrics = stageData.views?.[defaultKey] || {};
            const currentWnsStr = currentViewMetrics.WNS !== undefined ? currentViewMetrics.WNS.toString() : '';
            const currentTnsStr = currentViewMetrics.TNS !== undefined ? currentViewMetrics.TNS.toString() : '';

            let timingUpdated = false;
            let newViewMetrics = { ...currentViewMetrics };

            if (stageWns[stage] !== currentWnsStr) {
                if (stageWns[stage] === '') delete newViewMetrics.WNS;
                else newViewMetrics.WNS = parseFloat(stageWns[stage]);
                timingUpdated = true;
            }
            if (stageTns[stage] !== currentTnsStr) {
                if (stageTns[stage] === '') delete newViewMetrics.TNS;
                else newViewMetrics.TNS = parseFloat(stageTns[stage]);
                timingUpdated = true;
            }

            if (timingUpdated) {
                stageData.views = { ...stageData.views, [defaultKey]: newViewMetrics };
                hasUpdates = true;
            }

            // 3. Process Status and Runtime
            const currentStatus = stageData.status || '';
            const currentRuntime = stageData.runtime?.flow_realtime || '';

            if (stageStatus[stage] !== currentStatus) {
                if (stageStatus[stage] === '') delete stageData.status;
                else stageData.status = stageStatus[stage];
                hasUpdates = true;
            }

            if (stageRuntime[stage] !== currentRuntime) {
                stageData.runtime = stageData.runtime || {};
                if (stageRuntime[stage] === '') delete stageData.runtime.flow_realtime;
                else stageData.runtime.flow_realtime = stageRuntime[stage];
                hasUpdates = true;
            }

            if (hasUpdates || baseRunToEdit?.stages[stage]) {
                newStages[stage] = stageData;
            }
        });

        const compiledRun: Run = {
            id: baseRunId,
            run_tag: runTag,
            frequency_ghz: frequency ? parseFloat(frequency) : undefined,
            parent_id: parentId === 'none' ? undefined : parentId,
            stages: newStages
        };

        if (existingRunId) {
            updateRun(existingRunId, compiledRun);
        } else {
            addRun(compiledRun);
        }

        handleClose();
    };

    const handleReset = () => {
        setRunTag('');
        setFrequency('');
        setParentId('none');
        setStageLogs({ PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' });
        setStageArea({ PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' });
        setStageLeakage({ PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' });
        setStageWns({ PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' });
        setStageTns({ PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' });
        setStageStatus({ PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' });
        setStageRuntime({ PRECTS: '', CTS: '', ROUTE: '', POSTROUTE: '' });
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
            <DialogTitle>{existingRunId ? 'Edit Run Data' : 'Add New Run'}</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Header Info */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                        <TextField
                            label="Run Tag (Required)"
                            value={runTag}
                            onChange={(e) => setRunTag(e.target.value)}
                            size="small"
                            required
                            autoFocus
                        />
                        <TextField
                            label="Frequency (GHz)"
                            type="number"
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value)}
                            size="small"
                        />
                        <FormControl size="small">
                            <InputLabel>Parent Run (Branching From)</InputLabel>
                            <Select
                                value={parentId}
                                label="Parent Run (Branching From)"
                                onChange={(e) => setParentId(e.target.value)}
                            >
                                <MenuItem value="none"><em>None (Root)</em></MenuItem>
                                {runs.map(r => (
                                    <MenuItem key={r.id} value={r.id} disabled={r.id === existingRunId}>{r.run_tag}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle2" color="primary">Stage Data Entry (Optional)</Typography>

                    {/* 3 Column Grid for Stages */}
                    <Grid container spacing={3}>
                        {STAGES.map(stage => (
                            <Grid size={{ xs: 12, md: 4 }} key={stage}>
                                <Paper variant="outlined" sx={{ p: 2, height: '100%', backgroundColor: 'background.default' }}>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>{stage}</Typography>

                                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                        <FormControl size="small" fullWidth sx={{ backgroundColor: 'background.paper' }}>
                                            <InputLabel>Status</InputLabel>
                                            <Select
                                                value={stageStatus[stage]}
                                                label="Status"
                                                onChange={(e) => setStageStatus({ ...stageStatus, [stage]: e.target.value })}
                                            >
                                                <MenuItem value=""><em>Completed / None</em></MenuItem>
                                                <MenuItem value="running">Running</MenuItem>
                                                <MenuItem value="crash">Crashed</MenuItem>
                                                <MenuItem value="error">Error</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <TextField
                                            label="Run Time (ex. 02:43:10)"
                                            value={stageRuntime[stage]}
                                            onChange={(e) => setStageRuntime({ ...stageRuntime, [stage]: e.target.value })}
                                            size="small"
                                            fullWidth
                                            sx={{ backgroundColor: 'background.paper' }}
                                        />
                                    </Box>

                                    <TextField
                                        label="Paste Log Table (Setup/Hold mode...)"
                                        multiline
                                        rows={8}
                                        value={stageLogs[stage]}
                                        onChange={(e) => setStageLogs({ ...stageLogs, [stage]: e.target.value })}
                                        fullWidth
                                        size="small"
                                        placeholder="|     Setup mode     |   all   | reg2reg |\n|           WNS (ns):| -0.039  | -0.004  |"
                                        sx={{ mb: 2, backgroundColor: 'background.paper' }}
                                    />

                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                        Manual Metrics Override
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                        <TextField
                                            label="WNS (ns)"
                                            type="number"
                                            value={stageWns[stage]}
                                            onChange={(e) => setStageWns({ ...stageWns, [stage]: e.target.value })}
                                            size="small"
                                            fullWidth
                                            sx={{ backgroundColor: 'background.paper' }}
                                        />
                                        <TextField
                                            label="TNS (ns)"
                                            type="number"
                                            value={stageTns[stage]}
                                            onChange={(e) => setStageTns({ ...stageTns, [stage]: e.target.value })}
                                            size="small"
                                            fullWidth
                                            sx={{ backgroundColor: 'background.paper' }}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField
                                            label="Area (mm²)"
                                            type="number"
                                            value={stageArea[stage]}
                                            onChange={(e) => setStageArea({ ...stageArea, [stage]: e.target.value })}
                                            size="small"
                                            fullWidth
                                            sx={{ backgroundColor: 'background.paper' }}
                                        />
                                        <TextField
                                            label="Leakage (mW)"
                                            type="number"
                                            value={stageLeakage[stage]}
                                            onChange={(e) => setStageLeakage({ ...stageLeakage, [stage]: e.target.value })}
                                            size="small"
                                            fullWidth
                                            sx={{ backgroundColor: 'background.paper' }}
                                        />
                                    </Box>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>

                    <Typography variant="caption" color="text.secondary">
                        Leave fields blank to skip. If editing an existing run, pasting a new log will merge/overwrite existing path groups.
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSave} disabled={!runTag}>
                    {existingRunId ? 'Update Run' : 'Save Run'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
