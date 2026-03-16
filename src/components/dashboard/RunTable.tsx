import { useState, useRef, useEffect } from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Box, Typography, Menu, MenuItem, Divider, IconButton,
    ToggleButtonGroup, ToggleButton, Checkbox, Tooltip, Popover, TextField, Badge
} from '@mui/material';
import React from 'react';
import { Delete, Insights, CompareArrows, FilterList, Visibility } from '@mui/icons-material';
import { useRunStore } from '../../store/useRunStore';
import type { StageName, Run, StageData } from '../../types';
import { PathGroupDialog } from '../modals/PathGroupDialog';
import { CompareRunsDialog } from '../modals/CompareRunsDialog';
import { ErrorLogsDialog } from '../modals/ErrorLogsDialog';
import { AddChartModal } from '../modals/AddChartModal';
import { ViewChartDialog } from '../modals/ViewChartDialog';
import type { ChartConfig } from '../../types';

const STAGES: StageName[] = ['PRECTS', 'CTS', 'ROUTE', 'POSTROUTE'];

interface RunTableProps {
    onEditRun: (runId: string) => void;
}

export function RunTable({ onEditRun }: RunTableProps) {
    const { runs, selectedRunId, setSelectedRun } = useRunStore();
    const rowRefs = useRef<{ [key: string]: HTMLTableRowElement | null }>({});

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{
        mouseX: number;
        mouseY: number;
        runId: string;
    } | null>(null);
    const [pathGroupDialogRunId, setPathGroupDialogRunId] = useState<string | null>(null);
    const [errorLogsRunId, setErrorLogsRunId] = useState<string | null>(null);
    const [compareRunsDialogOpen, setCompareRunsDialogOpen] = useState(false);
    const [addChartModalOpen, setAddChartModalOpen] = useState<boolean>(false);
    const [viewChartConfig, setViewChartConfig] = useState<ChartConfig | null>(null);

    // Phase 7 UX
    const [viewMode, setViewMode] = useState<'timing' | 'run_times' | 'area' | 'power' | 'drcs' | 'cell_count'>('timing');
    const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
    const { deleteRun } = useRunStore();

    // Table Filters
    const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [tagFilter, setTagFilter] = useState('');
    const [freqFilter, setFreqFilter] = useState('');
    const [viewOnlyFilter, setViewOnlyFilter] = useState('');

    const handleSetViewOnly = () => {
        const selectedRuns = selectedRunIds.map(id => runs.find(r => r.id === id)?.run_tag).filter(Boolean);
        if (selectedRuns.length > 0) {
            setViewOnlyFilter(selectedRuns.join(', '));
            setSelectedRunIds([]);
        }
    };

    const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            setSelectedRunIds(runs.map(r => r.id));
            return;
        }
        setSelectedRunIds([]);
    };

    const handleClick = (event: React.MouseEvent<unknown>, id: string) => {
        // Prevent row expansion or navigation if clicking the checkbox
        event.stopPropagation();

        const selectedIndex = selectedRunIds.indexOf(id);
        let newSelected: string[] = [];

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selectedRunIds, id);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selectedRunIds.slice(1));
        } else if (selectedIndex === selectedRunIds.length - 1) {
            newSelected = newSelected.concat(selectedRunIds.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                selectedRunIds.slice(0, selectedIndex),
                selectedRunIds.slice(selectedIndex + 1),
            );
        }
        setSelectedRunIds(newSelected);
    };

    const isSelected = (id: string) => selectedRunIds.indexOf(id) !== -1;

    const handleDeleteSelected = () => {
        if (window.confirm(`Delete ${selectedRunIds.length} runs permanently?`)) {
            selectedRunIds.forEach(id => deleteRun(id));
            setSelectedRunIds([]);
        }
    };

    const handleContextMenu = (event: React.MouseEvent, runId: string) => {
        event.preventDefault();
        setContextMenu(
            contextMenu === null
                ? {
                    mouseX: event.clientX + 2,
                    mouseY: event.clientY - 6,
                    runId,
                }
                : null,
        );
    };

    const handleCloseMenu = () => {
        setContextMenu(null);
    };

    const handleToggleGroups = () => {
        if (contextMenu?.runId) {
            setPathGroupDialogRunId(contextMenu.runId);
        }
        handleCloseMenu();
    };

    const handleEditRun = () => {
        if (contextMenu?.runId) {
            onEditRun(contextMenu.runId);
        }
        handleCloseMenu();
    };

    const handleGenerateChart = (config: ChartConfig) => {
        setAddChartModalOpen(false);
        setViewChartConfig(config);
    };

    const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: 'timing' | 'run_times' | 'area' | 'power' | 'drcs' | 'cell_count' | null) => {
        if (newMode !== null) {
            setViewMode(newMode);
        }
    };

    // Scroll into view when selected node changes
    useEffect(() => {
        if (selectedRunId && rowRefs.current[selectedRunId]) {
            rowRefs.current[selectedRunId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedRunId]);

    if (runs.length === 0) return null;

    // Apply Filters
    let displayRuns = runs.filter(run => {
        if (tagFilter) {
            try {
                const regex = new RegExp(tagFilter, 'i');
                if (!regex.test(run.run_tag)) return false;
            } catch (e) {
                // Ignore invalid regex while typing
                if (!run.run_tag.toLowerCase().includes(tagFilter.toLowerCase())) return false;
            }
        }
        if (freqFilter) {
            const freqStr = run.frequency_ghz?.toString() || '';
            if (!freqStr.includes(freqFilter)) return false;
        }
        return true;
    });

    // Helper: get the most recent last_updated timestamp across all stages of a run
    const getLatestTimestamp = (run: Run): number => {
        let latest = 0;
        if (run.stages) {
            for (const stageData of Object.values(run.stages)) {
                const sd = stageData as StageData | undefined;
                if (sd?.last_updated) {
                    const ts = new Date(sd.last_updated).getTime();
                    if (ts > latest) latest = ts;
                }
            }
        }
        return latest;
    };

    if (viewOnlyFilter.trim() !== '') {
        const viewTags = viewOnlyFilter.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        if (viewTags.length > 0) {
            displayRuns = displayRuns.filter(r => viewTags.includes(r.run_tag.toLowerCase()));
            displayRuns.sort((a, b) => {
                const indexA = viewTags.indexOf(a.run_tag.toLowerCase());
                const indexB = viewTags.indexOf(b.run_tag.toLowerCase());
                return indexA - indexB;
            });
        }
    } else {
        // Default sort: most recently updated runs on top
        displayRuns.sort((a, b) => getLatestTimestamp(b) - getLatestTimestamp(a));
    }

    const numSelected = selectedRunIds.length;
    const activeFilterCount = (tagFilter ? 1 : 0) + (freqFilter ? 1 : 0) + (viewOnlyFilter ? 1 : 0);

    return (
        <Box sx={{ width: '100%', mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                {numSelected > 0 ? (
                    <Paper
                        elevation={2}
                        sx={{
                            display: 'flex', alignItems: 'center', px: 2, py: 1,
                            backgroundColor: 'primary.light', width: '100%'
                        }}
                    >
                        <Typography sx={{ flex: '1 1 100%', color: 'primary.contrastText' }} variant="subtitle1" component="div">
                            {numSelected} runs selected
                        </Typography>

                        <Tooltip title="Generate Graph">
                            <IconButton onClick={() => setAddChartModalOpen(true)} sx={{ color: 'primary.contrastText' }}>
                                <Insights />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="View Only Selected">
                            <IconButton onClick={handleSetViewOnly} sx={{ color: 'primary.contrastText' }}>
                                <Visibility />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Compare Intermediate Runs">
                            <IconButton onClick={() => setCompareRunsDialogOpen(true)} sx={{ color: 'primary.contrastText' }}>
                                <CompareArrows />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                            <IconButton onClick={handleDeleteSelected} sx={{ color: 'primary.contrastText' }}>
                                <Delete />
                            </IconButton>
                        </Tooltip>
                    </Paper>
                ) : (
                    <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h6">Run Data Table</Typography>
                            <Tooltip title="Filter Runs">
                                <IconButton onClick={(e) => setFilterAnchorEl(e.currentTarget)} size="small">
                                    <Badge badgeContent={activeFilterCount} color="primary">
                                        <FilterList />
                                    </Badge>
                                </IconButton>
                            </Tooltip>
                        </Box>
                        <ToggleButtonGroup
                            size="small"
                            color="primary"
                            value={viewMode}
                            exclusive
                            onChange={handleViewModeChange}
                            aria-label="View Mode"
                        >
                            <ToggleButton value="timing" aria-label="timing">Timing</ToggleButton>
                            <ToggleButton value="run_times" aria-label="run_times">Run Times</ToggleButton>
                            <ToggleButton value="area" aria-label="area">Area</ToggleButton>
                            <ToggleButton value="power" aria-label="power">Power</ToggleButton>
                            <ToggleButton value="drcs" aria-label="drcs">DRCs</ToggleButton>
                            <ToggleButton value="cell_count" aria-label="cell_count">Cell Count</ToggleButton>
                        </ToggleButtonGroup>
                    </>
                )}
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100vh - 200px)' }}>
                <Table stickyHeader size="small" sx={{ minWidth: 800 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox" rowSpan={['timing', 'area', 'drcs', 'cell_count'].includes(viewMode) ? 2 : 1} sx={{ backgroundColor: 'background.paper' }}>
                                <Checkbox
                                    color="primary"
                                    indeterminate={numSelected > 0 && numSelected < runs.length}
                                    checked={runs.length > 0 && numSelected === runs.length}
                                    onChange={handleSelectAllClick}
                                />
                            </TableCell>
                            <TableCell rowSpan={['timing', 'area', 'drcs', 'cell_count'].includes(viewMode) ? 2 : 1} sx={{ minWidth: 150, fontWeight: 'bold', backgroundColor: 'background.paper' }}>Run Tag</TableCell>
                            <TableCell rowSpan={['timing', 'area', 'drcs', 'cell_count'].includes(viewMode) ? 2 : 1} sx={{ backgroundColor: 'background.paper', whiteSpace: 'nowrap' }}>Freq (GHz)</TableCell>

                            {STAGES.map(stage => {
                                let colSpan = 1;
                                if (viewMode === 'timing') colSpan = 3;
                                else if (viewMode === 'area') colSpan = 2;
                                else if (viewMode === 'drcs' && (stage === 'ROUTE' || stage === 'POSTROUTE')) colSpan = 2;
                                else if (viewMode === 'cell_count') colSpan = 3;

                                return (
                                    <TableCell
                                        key={stage}
                                        colSpan={colSpan}
                                        align="center"
                                        sx={{ borderLeft: '1px solid', borderColor: 'divider', fontWeight: 'bold', backgroundColor: 'background.paper' }}
                                    >
                                        {stage} {viewMode === 'timing' ? '(all)' : ''}
                                    </TableCell>
                                );
                            })}
                        </TableRow>

                        {viewMode === 'timing' && (
                            <TableRow>
                                {STAGES.map((stage) => (
                                    <React.Fragment key={`${stage}-headers-timing`}>
                                        <TableCell align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper', fontSize: '0.8rem' }}>WNS</TableCell>
                                        <TableCell align="center" sx={{ borderColor: 'divider', backgroundColor: 'background.paper', fontSize: '0.8rem' }}>TNS</TableCell>
                                        <TableCell align="center" sx={{ borderColor: 'divider', backgroundColor: 'background.paper', fontSize: '0.8rem' }}>FEP</TableCell>
                                    </React.Fragment>
                                ))}
                            </TableRow>
                        )}
                        {viewMode === 'area' && (
                            <TableRow>
                                {STAGES.map((stage) => (
                                    <React.Fragment key={`${stage}-headers-area`}>
                                        <TableCell align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper', fontSize: '0.8rem' }}>Area (mm²)</TableCell>
                                        <TableCell align="center" sx={{ borderColor: 'divider', backgroundColor: 'background.paper', fontSize: '0.8rem' }}>Density (%)</TableCell>
                                    </React.Fragment>
                                ))}
                            </TableRow>
                        )}
                        {viewMode === 'drcs' && (
                            <TableRow>
                                {STAGES.map((stage) => (
                                    <React.Fragment key={`${stage}-headers-drcs`}>
                                        {(stage === 'ROUTE' || stage === 'POSTROUTE') ? (
                                            <>
                                                <TableCell align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper', fontSize: '0.8rem' }}>Shorts</TableCell>
                                                <TableCell align="center" sx={{ borderColor: 'divider', backgroundColor: 'background.paper', fontSize: '0.8rem' }}>Total</TableCell>
                                            </>
                                        ) : (
                                            <TableCell align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper', fontSize: '0.8rem' }} />
                                        )}
                                    </React.Fragment>
                                ))}
                            </TableRow>
                        )}
                        {viewMode === 'cell_count' && (
                            <TableRow>
                                {STAGES.map((stage) => (
                                    <React.Fragment key={`${stage}-headers-cellcount`}>
                                        <TableCell align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper', fontSize: '0.8rem' }}>Buffers</TableCell>
                                        <TableCell align="center" sx={{ borderColor: 'divider', backgroundColor: 'background.paper', fontSize: '0.8rem' }}>Inverters</TableCell>
                                        <TableCell align="center" sx={{ borderColor: 'divider', backgroundColor: 'background.paper', fontSize: '0.8rem' }}>ICGs</TableCell>
                                    </React.Fragment>
                                ))}
                            </TableRow>
                        )}
                    </TableHead>
                    <TableBody>
                        {displayRuns.map((run) => {
                            const isItemSelected = isSelected(run.id);

                            return (
                                <TableRow
                                    key={run.id}
                                    ref={(el: HTMLTableRowElement | null) => { rowRefs.current[run.id] = el; }}
                                    onClick={() => setSelectedRun(run.id)}
                                    // Removed context menu logic since checkboxes handle Actions now, but kept double click edit if requested? 
                                    // Actually keeping context menu is fine for edit flow.
                                    onContextMenu={(e) => handleContextMenu(e, run.id)}
                                    hover
                                    selected={run.id === selectedRunId || isItemSelected}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            color="primary"
                                            checked={isItemSelected}
                                            onClick={(event) => handleClick(event, run.id)}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: run.id === selectedRunId ? 'bold' : 'normal' }}>
                                        {run.run_tag}
                                    </TableCell>
                                    <TableCell>{run.frequency_ghz || '—'}</TableCell>

                                    {STAGES.map((stage) => {
                                        const stageData = run.stages[stage];
                                        const status = stageData?.status;

                                        if (status && status !== 'completed') {
                                            let errColSpan = 1;
                                            if (viewMode === 'timing') errColSpan = 3;
                                            else if (viewMode === 'area') errColSpan = 2;
                                            else if (viewMode === 'drcs' && (stage === 'ROUTE' || stage === 'POSTROUTE')) errColSpan = 2;
                                            else if (viewMode === 'cell_count') errColSpan = 3;

                                            return (
                                                <TableCell
                                                    key={`${run.id}-${stage}`}
                                                    colSpan={errColSpan}
                                                    align="center"
                                                    sx={{
                                                        borderLeft: '1px solid',
                                                        borderColor: 'divider',
                                                        color: status.toLowerCase() === 'error' || status.toLowerCase() === 'crash' || status.toLowerCase() === 'failed' ? 'error.main' : 'text.secondary',
                                                        fontWeight: 'medium',
                                                        fontStyle: 'italic',
                                                        textTransform: 'capitalize'
                                                    }}
                                                >
                                                    {status}
                                                </TableCell>
                                            );
                                        }

                                        // Metric rendering logic based on active View Mode
                                        if (viewMode === 'timing') {
                                            const metrics = stageData?.views?.['all'] || stageData?.views?.['All Paths'];
                                            const wns = metrics?.WNS ?? '—';
                                            const tns = metrics?.TNS ?? '—';
                                            const fep = metrics?.violating_paths ?? metrics?.FEP ?? '—';
                                            const isWnsNegative = typeof wns === 'number' && wns < 0;
                                            const isTnsNegative = typeof tns === 'number' && tns < 0;
                                            const isFepPositive = typeof fep === 'number' && fep > 0;

                                            return (
                                                <React.Fragment key={`${run.id}-${stage}`}>
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            borderLeft: '1px solid',
                                                            borderColor: 'divider',
                                                            color: isWnsNegative ? 'error.main' : 'inherit',
                                                            fontWeight: isWnsNegative ? 'medium' : 'normal'
                                                        }}
                                                    >
                                                        {wns}
                                                    </TableCell>
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            borderColor: 'divider',
                                                            color: isTnsNegative ? 'error.main' : 'inherit',
                                                            fontWeight: isTnsNegative ? 'medium' : 'normal'
                                                        }}
                                                    >
                                                        {tns}
                                                    </TableCell>
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            borderColor: 'divider',
                                                            color: isFepPositive ? 'error.main' : 'inherit',
                                                            fontWeight: isFepPositive ? 'medium' : 'normal'
                                                        }}
                                                    >
                                                        {fep}
                                                    </TableCell>
                                                </React.Fragment>
                                            );
                                        } else if (viewMode === 'run_times') {
                                            const rts = stageData?.runtime?.flow_realtime ?? '—';
                                            return (
                                                <TableCell key={`${run.id}-${stage}`} align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider' }}>
                                                    {rts}
                                                </TableCell>
                                            );
                                        } else if (viewMode === 'area') {
                                            const area = stageData?.metrics?.area_mm2 ?? '—';
                                            const density = stageData?.metrics?.density_pct ?? '—';
                                            return (
                                                <React.Fragment key={`${run.id}-${stage}`}>
                                                    <TableCell align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider' }}>
                                                        {area}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ borderColor: 'divider' }}>
                                                        {density}
                                                    </TableCell>
                                                </React.Fragment>
                                            );
                                        } else if (viewMode === 'power') {
                                            const leak = stageData?.metrics?.leakage_mw ?? '—';
                                            return (
                                                <TableCell key={`${run.id}-${stage}`} align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider' }}>
                                                    {leak}
                                                </TableCell>
                                            );
                                        } else if (viewMode === 'drcs') {
                                            if (stage === 'ROUTE' || stage === 'POSTROUTE') {
                                                const shorts = stageData?.metrics?.drc_shorts ?? '—';
                                                const total = stageData?.metrics?.drc_total ?? '—';
                                                return (
                                                    <React.Fragment key={`${run.id}-${stage}`}>
                                                        <TableCell align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider' }}>
                                                            {shorts}
                                                        </TableCell>
                                                        <TableCell align="center" sx={{ borderColor: 'divider' }}>
                                                            {total}
                                                        </TableCell>
                                                    </React.Fragment>
                                                );
                                            } else {
                                                return (
                                                    <TableCell key={`${run.id}-${stage}`} align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider', color: 'text.secondary' }}>
                                                        —
                                                    </TableCell>
                                                );
                                            }
                                        } else if (viewMode === 'cell_count') {
                                            const buffers = stageData?.metrics?.clock_buffer_count ?? '—';
                                            const inverters = stageData?.metrics?.clock_inverter_count ?? '—';
                                            const icgs = stageData?.metrics?.clock_icg_count ?? '—';
                                            return (
                                                <React.Fragment key={`${run.id}-${stage}`}>
                                                    <TableCell align="center" sx={{ borderLeft: '1px solid', borderColor: 'divider' }}>
                                                        {buffers}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ borderColor: 'divider' }}>
                                                        {inverters}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ borderColor: 'divider' }}>
                                                        {icgs}
                                                    </TableCell>
                                                </React.Fragment>
                                            );
                                        }
                                        return null;
                                    })}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Right Click Menu */}
            <Menu
                open={contextMenu !== null}
                onClose={handleCloseMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem onClick={handleToggleGroups}>
                    Show All Path Groups
                </MenuItem>
                <MenuItem onClick={() => {
                    if (contextMenu?.runId) setErrorLogsRunId(contextMenu.runId);
                    handleCloseMenu();
                }}>
                    Show Error Logs
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleEditRun}>
                    Edit Run Data
                </MenuItem>
            </Menu>

            <PathGroupDialog runId={pathGroupDialogRunId} onClose={() => setPathGroupDialogRunId(null)} />
            <ErrorLogsDialog open={errorLogsRunId !== null} onClose={() => setErrorLogsRunId(null)} runData={runs.find(r => r.id === errorLogsRunId) || null} />

            {/* Contextual Modals triggered by Action Bar */}
            <CompareRunsDialog
                open={compareRunsDialogOpen}
                onClose={() => setCompareRunsDialogOpen(false)}
                initialSelectedRunIds={selectedRunIds}
            />
            <AddChartModal
                open={addChartModalOpen}
                onClose={() => setAddChartModalOpen(false)}
                onAdd={handleGenerateChart}
                initialSelectedRunIds={selectedRunIds}
            />
            <ViewChartDialog
                open={viewChartConfig !== null}
                config={viewChartConfig}
                onClose={() => setViewChartConfig(null)}
            />

            <Popover
                open={Boolean(filterAnchorEl)}
                anchorEl={filterAnchorEl}
                onClose={() => setFilterAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, width: 250 }}>
                    <Typography variant="subtitle2" fontWeight="bold">Table Filters</Typography>
                    <TextField
                        size="small"
                        label="Run Tag (Regex)"
                        value={tagFilter}
                        onChange={(e) => setTagFilter(e.target.value)}
                        placeholder="e.g. tag15.*"
                    />
                    <TextField
                        size="small"
                        label="Frequency (GHz)"
                        value={freqFilter}
                        onChange={(e) => setFreqFilter(e.target.value)}
                        placeholder="e.g. 4.7"
                    />
                    <TextField
                        size="small"
                        label="View Only (Comma separated tags)"
                        value={viewOnlyFilter}
                        onChange={(e) => setViewOnlyFilter(e.target.value)}
                        placeholder="e.g. run1, run2, run3"
                    />
                </Box>
            </Popover>
        </Box>
    );
}
