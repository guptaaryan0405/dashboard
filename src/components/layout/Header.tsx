import { AppBar, Toolbar, Typography, Box, IconButton, Autocomplete, TextField, useTheme, Button, Switch, Tooltip, FormControlLabel } from '@mui/material';
import { Brightness4, Brightness7, Add, Upload, Download, Settings } from '@mui/icons-material';
import { useRunStore } from '../../store/useRunStore';
import { AutoLoadSettingsDialog } from '../modals/AutoLoadSettingsDialog';
import { useState, useEffect } from 'react';

interface HeaderProps {
    onToggleTheme: () => void;
    onOpenAdd: () => void;
}

export function Header({ onToggleTheme, onOpenAdd }: HeaderProps) {
    const theme = useTheme();
    const { runs, fileRef, fileHandle, autoConfig, setLastRefreshTime, setSelectedRun, setAutoRefresh } = useRunStore();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [intervalInput, setIntervalInput] = useState(autoConfig.refreshIntervalMinutes?.toString() || '30');
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    // 30 Minute Auto-Refresh Polling Loop
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
                        console.log(`Auto-refreshed successfully at ${new Date().toLocaleTimeString()}`);
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
                        console.log(`Auto-refreshed via fallback successfully at ${new Date().toLocaleTimeString()}`);
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
                            console.log(`Auto-refreshed via direct path successfully at ${new Date().toLocaleTimeString()}`);
                        }
                    } else {
                        console.error("Auto-refresh via direct path failed:", res.statusText);
                    }
                } catch (err) {
                    console.error("Auto-refresh via direct path failed:", err);
                }
            }
        }, (autoConfig.refreshIntervalMinutes || 30) * 60 * 1000); // dynamic interval in milliseconds

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

    const handleExportSession = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(runs, null, 2));
        const anchorNode = document.createElement('a');
        anchorNode.setAttribute("href", dataStr);
        anchorNode.setAttribute("download", `run_tracker_session_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(anchorNode); // required for firefox
        anchorNode.click();
        anchorNode.remove();
    };

    const handleImportSession = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedRuns = JSON.parse(e.target?.result as string);
                if (Array.isArray(importedRuns)) {
                    // Overwrite state completely
                    useRunStore.setState({ runs: importedRuns });
                }
            } catch (err) {
                console.error("Failed to parse session file:", err);
                alert("Invalid session file format.");
            }
        };
        reader.readAsText(file);

        // Reset input so the same file could be imported again if needed
        event.target.value = '';
    };

    return (
        <AppBar position="fixed" color="inherit" elevation={1} sx={{ zIndex: theme.zIndex.drawer + 1 }}>
            <Toolbar>
                <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 0, mr: 4, fontWeight: 'bold' }}>
                    Run Tracker
                </Typography>

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

                <Box sx={{ flexGrow: 1 }} />

                {autoConfig.path && (
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

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mr: 2 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={!!(fileRef || fileHandle || autoConfig.path)}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setSettingsOpen(true);
                                    } else {
                                        setAutoRefresh({ path: '', lastRefreshTime: null, refreshIntervalMinutes: 30 }, null, null);
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
                        sx={{ mr: 1 }}
                    />

                    {!!(fileRef || fileHandle || autoConfig.path) && (
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
                                    }
                                }}
                                sx={{ minWidth: 'auto', px: 1 }}
                            >
                                Apply
                            </Button>
                        </Box>
                    )}
                    <Tooltip title="Export Session (JSON)">
                        <IconButton size="small" color="inherit" onClick={handleExportSession}>
                            <Download fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Import Session (JSON)">
                        <IconButton size="small" color="inherit" component="label">
                            <Upload fontSize="small" />
                            <input
                                type="file"
                                hidden
                                accept=".json"
                                onChange={handleImportSession}
                            />
                        </IconButton>
                    </Tooltip>

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

                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Add />}
                    onClick={onOpenAdd}
                    sx={{ mr: 2 }}
                >
                    New Run
                </Button>

                <IconButton sx={{ ml: 1 }} onClick={onToggleTheme} color="inherit">
                    {theme.palette.mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
                </IconButton>
            </Toolbar>

            <AutoLoadSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </AppBar>
    );
}
