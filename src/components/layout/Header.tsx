import { AppBar, Toolbar, Typography, Box, IconButton, Autocomplete, TextField, useTheme, Button, Switch, Tooltip, FormControlLabel } from '@mui/material';
import { Brightness4, Brightness7, Settings, Refresh, FolderOpen } from '@mui/icons-material';
import { useRunStore } from '../../store/useRunStore';
import { AutoLoadSettingsDialog } from '../modals/AutoLoadSettingsDialog';
import { useState, useEffect, useRef } from 'react';

interface HeaderProps {
    onToggleTheme: () => void;
}

export function Header({ onToggleTheme }: HeaderProps) {
    const theme = useTheme();
    const { runs, fileRef, fileHandle, autoConfig, setLastRefreshTime, setSelectedRun, setAutoRefresh } = useRunStore();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [intervalInput, setIntervalInput] = useState(autoConfig.refreshIntervalMinutes?.toString() || '5');
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // X Minute Auto-Refresh Polling Loop
    useEffect(() => {
        const intervalId = setInterval(async () => {
            if (fileHandle) {
                try {
                    const file = await fileHandle.getFile();
                    const text = await file.text();
                    const importedRuns = JSON.parse(text);
                    if (Array.isArray(importedRuns)) {
                        useRunStore.setState({ runs: importedRuns });
                        setLastRefreshTime(Date.now());
                    }
                } catch (err) {
                    console.error("Auto-refresh via handle failed:", err);
                }
            } else if (fileRef) {
                try {
                    const text = await fileRef.text();
                    const importedRuns = JSON.parse(text);
                    if (Array.isArray(importedRuns)) {
                        useRunStore.setState({ runs: importedRuns });
                        setLastRefreshTime(Date.now());
                    }
                } catch (err) {
                    console.error("Auto-refresh via fallback failed:", err);
                }
            } else if (autoConfig.path) {
                try {
                    const fetchPath = autoConfig.path.startsWith('/') ? `/@fs${autoConfig.path}` : autoConfig.path;
                    const res = await fetch(fetchPath);
                    if (res.ok) {
                        const text = await res.text();
                        const importedRuns = JSON.parse(text);
                        if (Array.isArray(importedRuns)) {
                            useRunStore.setState({ runs: importedRuns });
                            setLastRefreshTime(Date.now());
                        }
                    }
                } catch (err) {
                    console.error("Auto-refresh via direct path failed:", err);
                }
            }
        }, (autoConfig.refreshIntervalMinutes || 5) * 60 * 1000); // dynamic interval in milliseconds

        return () => clearInterval(intervalId);
    }, [fileHandle, fileRef, autoConfig.path, autoConfig.refreshIntervalMinutes, setLastRefreshTime]);

    // 1-Second Countdown Timer Loop
    useEffect(() => {
        if (!autoConfig.lastRefreshTime || !autoConfig.refreshIntervalMinutes || !(fileRef || fileHandle || autoConfig.path)) {
            setTimeLeft(null);
            return;
        }

        const calculateTimeLeft = () => {
            const nextRefresh = autoConfig.lastRefreshTime! + autoConfig.refreshIntervalMinutes * 60 * 1000;
            const remaining = Math.max(0, nextRefresh - Date.now());
            setTimeLeft(remaining);
        };

        // Initial calculation
        calculateTimeLeft();

        const intervalId = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(intervalId);
    }, [autoConfig.lastRefreshTime, autoConfig.refreshIntervalMinutes, fileRef, fileHandle, autoConfig.path]);

    const parseAndLoadFile = async (file: File) => {
        try {
            const text = await file.text();
            const importedRuns = JSON.parse(text);
            if (Array.isArray(importedRuns)) {
                useRunStore.setState({ runs: importedRuns });
                setLastRefreshTime(Date.now());
                return true;
            }
        } catch (err: any) {
            console.error("Failed to parse auto-refresh file:", err);
            alert(`Could not load runs from the selected file. Error: ${err.message || String(err)}`);
            return false;
        }
    };

    const handleLoadJsonAndTrack = async () => {
        if ('showOpenFilePicker' in window) {
            try {
                const [handle] = await (window as any).showOpenFilePicker({
                    types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
                    multiple: false
                });
                const file = await handle.getFile();
                setAutoRefresh({ path: file.name, lastRefreshTime: Date.now(), refreshIntervalMinutes: autoConfig.refreshIntervalMinutes || 5 }, file, handle);
                await parseAndLoadFile(file);
            } catch (err) { console.log("User cancelled or API failed:", err); }
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleFallbackFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setAutoRefresh({ path: file.name, lastRefreshTime: Date.now(), refreshIntervalMinutes: autoConfig.refreshIntervalMinutes || 5 }, file, null);
        await parseAndLoadFile(file);
        event.target.value = '';
    };

    const handleManualRefresh = async () => {
        if (fileHandle) {
            try {
                const file = await fileHandle.getFile();
                await parseAndLoadFile(file);
            } catch (err) {
                console.error("Stale file handle:", err);
                alert("Browser lost permission to read the file. Please re-select it.");
            }
        } else if (fileRef) {
            try {
                await parseAndLoadFile(fileRef);
            } catch (err) {
                console.error("Stale file reference:", err);
                alert("Browser lost reference to the file.");
            }
        } else if (autoConfig.path) {
            try {
                const fetchPath = autoConfig.path.startsWith('/') ? `/@fs${autoConfig.path}` : autoConfig.path;
                const res = await fetch(fetchPath);
                if (res.ok) {
                    const text = await res.text();
                    const importedRuns = JSON.parse(text);
                    if (Array.isArray(importedRuns)) {
                        useRunStore.setState({ runs: importedRuns });
                        setLastRefreshTime(Date.now());
                    }
                }
            } catch (err) {
                console.error("Path refresh failed", err);
            }
        }
    };

    const isTracking = !!(fileRef || fileHandle || autoConfig.path);
    const hasRunsAndFilterable = isTracking || runs.length > 0;

    return (
        <AppBar position="fixed" color="inherit" elevation={1} sx={{ zIndex: theme.zIndex.drawer + 1 }}>
            <Toolbar>
                <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 0, mr: 4, fontWeight: 'bold' }}>
                    Run Tracker
                </Typography>

                {hasRunsAndFilterable && (
                    <Box sx={{ width: 300 }}>
                        <Autocomplete
                            size="small"
                            options={runs}
                            getOptionLabel={(option) => option.run_tag}
                            onChange={(_, value) => {
                                if (value) {
                                    setSelectedRun(value.id);
                                }
                            }}
                            renderInput={(params) => <TextField {...params} placeholder="Search run tags..." variant="outlined" />}
                            sx={{
                                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                borderRadius: 1,
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': { borderColor: 'transparent' },
                                    '&:hover fieldset': { borderColor: 'transparent' },
                                    '&.Mui-focused fieldset': { borderColor: 'transparent' },
                                }
                            }}
                        />
                    </Box>
                )}

                <Box sx={{ flexGrow: 1 }} />

                {/* Empty State / Load JSON Banner Condition */}
                {!hasRunsAndFilterable && (
                    <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, justifyContent: 'center', mr: 2 }}>
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<FolderOpen />}
                            onClick={handleLoadJsonAndTrack}
                            sx={{ py: 1, px: 3, borderStyle: 'dashed', borderWidth: 2 }}
                        >
                            Load Dashboard JSON
                        </Button>
                        <input
                            type="file"
                            hidden
                            accept=".json"
                            ref={fileInputRef}
                            onChange={handleFallbackFileChange}
                        />
                    </Box>
                )}

                {/* Tracking View File String + Timestamp */}
                {isTracking && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mr: 2, justifyContent: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 600, wordBreak: 'break-all' }}>
                            {autoConfig.path}
                        </Typography>
                        {autoConfig.lastRefreshTime && (
                            <Typography variant="caption" color="text.secondary">
                                Updated: {new Date(autoConfig.lastRefreshTime).toLocaleTimeString()}
                                {timeLeft !== null && (
                                    <span>
                                        {' '}
                                        (Next check in {Math.floor(timeLeft / 60000)}m {Math.floor((timeLeft % 60000) / 1000)}s)
                                    </span>
                                )}
                            </Typography>
                        )}
                    </Box>
                )}

                {hasRunsAndFilterable && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mr: 2 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={isTracking}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSettingsOpen(true);
                                        } else {
                                            setAutoRefresh({ path: '', lastRefreshTime: null, refreshIntervalMinutes: 5 }, null, null);
                                        }
                                    }}
                                />
                            }
                            label={
                                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                                    Auto-Load
                                </Typography>
                            }
                            labelPlacement="start"
                            sx={{ mr: 1, ml: 2 }}
                        />

                        {isTracking && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1, pr: 2, borderRight: `1px solid ${theme.palette.divider}` }}>
                                <TextField
                                    size="small"
                                    label="Refresh (min)"
                                    value={intervalInput}
                                    onChange={(e) => setIntervalInput(e.target.value)}
                                    sx={{ width: 90 }}
                                    inputProps={{ type: 'number', min: 1 }}
                                />
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => {
                                        const mins = parseInt(intervalInput);
                                        if (!isNaN(mins) && mins > 0) {
                                            setAutoRefresh({ ...autoConfig, refreshIntervalMinutes: mins }, fileRef, fileHandle);
                                            handleManualRefresh(); // Also refresh when applying the time
                                        }
                                    }}
                                    sx={{ minWidth: 'auto', px: 1 }}
                                >
                                    Apply
                                </Button>
                                <Tooltip title="Refresh Now">
                                    <IconButton size="small" color="primary" onClick={handleManualRefresh} sx={{ ml: 0.5, backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}>
                                        <Refresh fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )}

                        <Tooltip title="Local Auto-Load Settings">
                            <IconButton size="small" color="inherit" onClick={() => setSettingsOpen(true)}>
                                <Settings fontSize="small" />
                                {fileRef || fileHandle ? (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: 4, right: 4,
                                        width: 8, height: 8,
                                        bgcolor: 'success.main',
                                        borderRadius: '50%'
                                    }} />
                                ) : null}
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}

                <IconButton sx={{ ml: 1 }} onClick={onToggleTheme} color="inherit">
                    {theme.palette.mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
                </IconButton>
            </Toolbar>

            <AutoLoadSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </AppBar>
    );
}
