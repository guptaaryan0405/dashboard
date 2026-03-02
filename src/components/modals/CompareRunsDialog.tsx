import React, { useState, useMemo, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, FormControl, InputLabel, Select, MenuItem,
    Box, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Checkbox, ListItemText,
    OutlinedInput, ToggleButtonGroup, ToggleButton, Typography
} from '@mui/material';
import { useRunStore } from '../../store/useRunStore';
import type { StageName } from '../../types';

interface CompareRunsDialogProps {
    open: boolean;
    onClose: () => void;
    initialSelectedRunIds?: string[];
}

const STAGES: StageName[] = ['PRECTS', 'CTS', 'POSTROUTE'];

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
    PaperProps: {
        style: {
            maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
            width: 250,
        },
    },
};

export function CompareRunsDialog({ open, onClose, initialSelectedRunIds = [] }: CompareRunsDialogProps) {
    const runs = useRunStore(state => state.runs);

    const [selectedRunIds, setSelectedRunIds] = useState<string[]>(initialSelectedRunIds);
    const [targetStage, setTargetStage] = useState<StageName>('PRECTS');
    const [pathGroup, setPathGroup] = useState<string>('all');

    useEffect(() => {
        if (open && initialSelectedRunIds.length > 0) {
            setSelectedRunIds(initialSelectedRunIds);
        } else if (open && initialSelectedRunIds.length === 0) {
            setSelectedRunIds([]);
        }
    }, [open, initialSelectedRunIds]);

    const handleRunChange = (event: any) => {
        const {
            target: { value },
        } = event;
        setSelectedRunIds(
            typeof value === 'string' ? value.split(',') : value,
        );
    };

    const selectedRuns = useMemo(() => {
        return runs.filter(r => selectedRunIds.includes(r.id));
    }, [runs, selectedRunIds]);

    const maxPasses = useMemo(() => {
        return Math.max(...selectedRuns.map(r => r.stages[targetStage]?.intermediate?.length || 0), 0);
    }, [selectedRuns, targetStage]);

    // Gather available path groups among selected runs for the target stage
    const availablePathGroups = useMemo(() => {
        const groups = new Set<string>();
        groups.add('all'); // default
        selectedRuns.forEach(r => {
            const intData = r.stages[targetStage]?.intermediate;
            if (intData && intData.length > 0) {
                intData.forEach(pass => {
                    if (pass.views) {
                        Object.keys(pass.views).forEach(pg => groups.add(pg));
                    }
                });
            }
        });
        return Array.from(groups).sort();
    }, [selectedRuns, targetStage]);

    // Ensure currently selected pathGroup is valid, or fallback to 'all' or 'All Paths'
    const safePathGroup = availablePathGroups.includes(pathGroup) ? pathGroup :
        (availablePathGroups.includes('All Paths') ? 'All Paths' : availablePathGroups[0] || 'all');

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>Compare Intermediate Runs</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl sx={{ minWidth: 300 }} size="small">
                        <InputLabel>Select Runs</InputLabel>
                        <Select
                            multiple
                            value={selectedRunIds}
                            onChange={handleRunChange}
                            input={<OutlinedInput label="Select Runs" />}
                            renderValue={(selected) => runs.filter(r => selected.includes(r.id)).map(r => r.run_tag).join(', ')}
                            MenuProps={MenuProps}
                        >
                            {runs.map((run) => (
                                <MenuItem key={run.id} value={run.id}>
                                    <Checkbox checked={selectedRunIds.indexOf(run.id) > -1} />
                                    <ListItemText primary={run.run_tag} />
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl sx={{ minWidth: 200 }} size="small">
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>Target Stage</Typography>
                        <ToggleButtonGroup
                            color="primary"
                            value={targetStage}
                            exclusive
                            onChange={(_, newStage) => {
                                if (newStage !== null) setTargetStage(newStage as StageName);
                            }}
                            size="small"
                        >
                            {STAGES.map(s => <ToggleButton key={s} value={s}>{s}</ToggleButton>)}
                        </ToggleButtonGroup>
                    </FormControl>

                    <FormControl sx={{ minWidth: 150 }} size="small">
                        <InputLabel>Path Group / View</InputLabel>
                        <Select value={safePathGroup} label="Path Group / View" onChange={(e) => setPathGroup(e.target.value)}>
                            {availablePathGroups.map(pg => <MenuItem key={pg} value={pg}>{pg}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>

                <Box sx={{ mt: 3 }}>
                    {selectedRuns.length === 0 ? (
                        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary', border: '1px dashed grey', borderRadius: 1 }}>
                            Select runs to compare their intermediate passes.
                        </Box>
                    ) : maxPasses === 0 ? (
                        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary', border: '1px dashed grey', borderRadius: 1 }}>
                            No intermediate data available for the selected runs at stage "{targetStage}".
                        </Box>
                    ) : (
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell rowSpan={2} sx={{ fontWeight: 'bold', backgroundColor: 'action.hover', position: 'sticky', left: 0, zIndex: 10, borderRight: '1px solid', borderColor: 'divider' }}>
                                            Pass
                                        </TableCell>
                                        {selectedRuns.map(run => (
                                            <TableCell key={run.id} colSpan={2} align="center" sx={{ fontWeight: 'bold', backgroundColor: 'action.hover', borderLeft: '1px solid', borderRight: '1px solid', borderColor: 'divider' }}>
                                                {run.run_tag}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    <TableRow>
                                        {selectedRuns.map(run => (
                                            <React.Fragment key={`${run.id}-subheaders`}>
                                                <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: 'action.hover', borderLeft: '1px solid', borderColor: 'divider' }}>WNS</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: 'action.hover', borderRight: '1px solid', borderColor: 'divider' }}>TNS</TableCell>
                                            </React.Fragment>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.from({ length: maxPasses }).map((_, i) => {
                                        const passNum = i + 1;

                                        // Attempt to find a label for this row by looking at the selected runs
                                        let rowLabel = `Pass ${passNum}`;
                                        for (const run of selectedRuns) {
                                            const passDef = run.stages[targetStage]?.intermediate?.[i];
                                            if (passDef?.label) {
                                                rowLabel = passDef.label;
                                                break;
                                            }
                                        }

                                        return (
                                            <TableRow key={`pass-${passNum}`} hover>
                                                <TableCell sx={{ fontWeight: 'bold', position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 5, whiteSpace: 'nowrap', borderRight: '1px solid', borderColor: 'divider' }}>
                                                    {rowLabel}
                                                </TableCell>
                                                {selectedRuns.map(run => {
                                                    const intData = run.stages[targetStage]?.intermediate;
                                                    const passData = intData && i < intData.length ? intData[i] : null;

                                                    let wnsVal: any = '—';
                                                    let tnsVal: any = '—';

                                                    if (passData) {
                                                        const views = passData.views;
                                                        const pgToUse = views[safePathGroup] ? safePathGroup : (safePathGroup === 'all' && views['All Paths'] ? 'All Paths' : safePathGroup);
                                                        const pgMetrics = views[pgToUse];

                                                        if (pgMetrics) {
                                                            if ('WNS' in pgMetrics) wnsVal = pgMetrics['WNS'];
                                                            if ('TNS' in pgMetrics) tnsVal = pgMetrics['TNS'];
                                                        }
                                                    }

                                                    const isWnsNegative = typeof wnsVal === 'number' && wnsVal < 0;
                                                    const isTnsNegative = typeof tnsVal === 'number' && tnsVal < 0;

                                                    return (
                                                        <React.Fragment key={`${passNum}-${run.id}`}>
                                                            <TableCell align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider', color: isWnsNegative ? 'error.main' : 'inherit', fontWeight: isWnsNegative ? 'medium' : 'normal' }}>
                                                                {wnsVal}
                                                            </TableCell>
                                                            <TableCell align="center" sx={{ borderRight: '1px solid', borderColor: 'divider', color: isTnsNegative ? 'error.main' : 'inherit', fontWeight: isTnsNegative ? 'medium' : 'normal' }}>
                                                                {tnsVal}
                                                            </TableCell>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
