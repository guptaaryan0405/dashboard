import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { useRunStore } from '../../store/useRunStore';
import type { StageName } from '../../types';

interface PathGroupDialogProps {
    runId: string | null;
    onClose: () => void;
}

const STAGES: StageName[] = ['PRECTS', 'CTS', 'ROUTE', 'POSTROUTE'];

export function PathGroupDialog({ runId, onClose }: PathGroupDialogProps) {
    const run = useRunStore(state => state.runs.find(r => r.id === runId));

    if (!run) return null;

    // Find all unique path groups for *this* run
    const pathGroups = new Set<string>();
    STAGES.forEach(stage => {
        const views = run.stages[stage]?.views;
        if (views) Object.keys(views).forEach(pg => pathGroups.add(pg));
    });

    const columns = Array.from(pathGroups).sort();

    return (
        <Dialog open={!!runId} onClose={onClose} maxWidth="xl" fullWidth>
            <DialogTitle>All Path Groups: {run.run_tag}</DialogTitle>
            <DialogContent>
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                    <Table size="small" sx={{ minWidth: 800 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell rowSpan={2} sx={{ fontWeight: 'bold', backgroundColor: 'action.hover' }}>Stage</TableCell>
                                {columns.map(pg => (
                                    <TableCell key={pg} colSpan={2} align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider', fontWeight: 'bold', backgroundColor: 'action.hover' }}>
                                        {pg}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                {columns.map(pg => (
                                    <React.Fragment key={`${pg}-headers`}>
                                        <TableCell align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider', backgroundColor: 'action.hover', fontSize: '0.8rem' }}>WNS</TableCell>
                                        <TableCell align="center" sx={{ borderColor: 'divider', backgroundColor: 'action.hover', fontSize: '0.8rem' }}>TNS</TableCell>
                                    </React.Fragment>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {STAGES.map(stage => {
                                const hasData = Object.keys(run.stages[stage] || {}).length > 0;
                                if (!hasData) return null;
                                return (
                                    <TableRow key={stage}>
                                        <TableCell sx={{ fontWeight: 'bold' }}>{stage}</TableCell>
                                        {columns.map(pg => {
                                            const metrics = run.stages[stage]?.views?.[pg];
                                            const wns = metrics?.WNS ?? '—';
                                            const tns = metrics?.TNS ?? '—';
                                            const isWnsNegative = typeof wns === 'number' && wns < 0;
                                            const isTnsNegative = typeof tns === 'number' && tns < 0;
                                            return (
                                                <React.Fragment key={`${stage}-${pg}`}>
                                                    <TableCell align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider', color: isWnsNegative ? 'error.main' : 'inherit' }}>{wns}</TableCell>
                                                    <TableCell align="center" sx={{ borderColor: 'divider', color: isTnsNegative ? 'error.main' : 'inherit' }}>{tns}</TableCell>
                                                </React.Fragment>
                                            )
                                        })}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
