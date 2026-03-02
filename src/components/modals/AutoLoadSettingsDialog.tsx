import { useState, useRef, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Typography, IconButton, Tooltip
} from '@mui/material';
import { FolderOpen, Refresh } from '@mui/icons-material';
import { useRunStore } from '../../store/useRunStore';

interface AutoLoadSettingsDialogProps {
    open: boolean;
    onClose: () => void;
}

export function AutoLoadSettingsDialog({ open, onClose }: AutoLoadSettingsDialogProps) {
    const { autoConfig, fileRef, fileHandle, setAutoRefresh, setLastRefreshTime } = useRunStore();

    const [pathInput, setPathInput] = useState(autoConfig.path);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Sync input when modal opens
    useEffect(() => {
        if (open) {
            setPathInput(autoConfig.path);
        }
    }, [open, autoConfig.path]);

    const handleFileSelect = async () => {
        if ('showOpenFilePicker' in window) {
            try {
                const [handle] = await (window as any).showOpenFilePicker({
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] },
                    }],
                    multiple: false
                });

                const file = await handle.getFile();
                // Prefer the user pasted path if it exists, else default to genuine file name
                const displayPath = pathInput.trim() !== '' ? pathInput : file.name;

                setAutoRefresh({ path: displayPath, lastRefreshTime: Date.now(), refreshIntervalMinutes: autoConfig.refreshIntervalMinutes || 30 }, file, handle);
                setPathInput(displayPath);
                await parseAndLoadFile(file);
            } catch (err) {
                console.log("User cancelled or API failed:", err);
            }
        } else {
            // Firefox Fallback: Use hidden input element
            fileInputRef.current?.click();
        }
    };

    const handleFallbackFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const displayPath = pathInput.trim() !== '' ? pathInput : file.name;
        setAutoRefresh({ path: displayPath, lastRefreshTime: Date.now(), refreshIntervalMinutes: autoConfig.refreshIntervalMinutes || 30 }, file, null);
        setPathInput(displayPath);
        await parseAndLoadFile(file);

        // Reset input
        event.target.value = '';
    };

    const parseAndLoadFile = async (file: File) => {
        try {
            const text = await file.text();
            const importedRuns = JSON.parse(text);
            if (Array.isArray(importedRuns)) {
                useRunStore.setState({ runs: importedRuns });
                setLastRefreshTime(Date.now());
                return true;
            }
        } catch (err) {
            console.error("Failed to parse auto-refresh file:", err);
            alert("Could not load runs from the selected file. Ensure it is valid JSON.");
            return false;
        }
    };

    const parseAndLoadDirectPath = async (path: string) => {
        try {
            const fetchPath = path.startsWith('/') ? `/@fs${path}` : path;
            const res = await fetch(fetchPath);
            if (!res.ok) throw new Error("Network response was not ok");
            const text = await res.text();
            const importedRuns = JSON.parse(text);
            if (Array.isArray(importedRuns)) {
                useRunStore.setState({ runs: importedRuns });
                setLastRefreshTime(Date.now());
                return true;
            }
        } catch (err) {
            console.error("Failed to parse direct path:", err);
            return false;
        }
        return false;
    };

    const handleManualRefresh = async () => {
        if (fileHandle) {
            try {
                // Request updated file reference from the handle
                const file = await fileHandle.getFile();
                await parseAndLoadFile(file);
            } catch (err) {
                console.error("Stale file handle, please re-select:", err);
                alert("Browser lost permission to read the file. Please re-select it.");
            }
        } else if (fileRef) {
            // Fallback
            try {
                await parseAndLoadFile(fileRef);
            } catch (err) {
                console.error("Stale file reference, please re-select:", err);
                alert("Browser lost reference to the file. Please re-select it.");
            }
        } else if (pathInput) {
            const success = await parseAndLoadDirectPath(pathInput);
            if (success) {
                setAutoRefresh({ path: pathInput, lastRefreshTime: Date.now(), refreshIntervalMinutes: autoConfig.refreshIntervalMinutes || 30 }, null, null);
            } else {
                alert("Could not refresh from the provided path. Please re-select the file.");
            }
        }
    };

    const isTracking = fileRef !== null || fileHandle !== null || autoConfig.path !== '';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Auto-Load Settings</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>

                    <Typography variant="body2" color="text.secondary">
                        Start tracking a local JSON file to unlock automatic dashboard updates.
                        If the browser hides absolute paths, you can optionally paste the genuine absolute path into the text box for logging purposes before selecting your file.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                            label="JSON File Path"
                            value={pathInput}
                            onChange={(e) => setPathInput(e.target.value)}
                            fullWidth
                            size="small"
                            placeholder="e.g. /home/user/dashboard_session.json"
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            size="medium"
                            startIcon={<FolderOpen />}
                            onClick={handleFileSelect}
                            sx={{ whiteSpace: 'nowrap', py: 1, px: 2 }}
                        >
                            Browse
                        </Button>
                    </Box>

                    {isTracking && (
                        <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, border: '1px solid', borderColor: 'success.main', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="subtitle2" fontWeight="bold">Currently Tracking</Typography>
                                {autoConfig.lastRefreshTime && (
                                    <Typography variant="caption" color="text.secondary">
                                        Last Refreshed: {new Date(autoConfig.lastRefreshTime).toLocaleTimeString()}
                                    </Typography>
                                )}
                            </Box>
                            <Tooltip title="Force Refresh Now">
                                <IconButton size="small" onClick={handleManualRefresh} color="primary">
                                    <Refresh />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    )}

                    {/* Hidden fallback input for Firefox / unsupported browsers */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".json"
                        onChange={handleFallbackFileChange}
                    />

                </Box>
            </DialogContent>
            <DialogActions>
                <Button
                    variant="outlined"
                    onClick={async () => {
                        // If user modified the path explicitly, attempt to load it and drop old handles
                        if (pathInput && pathInput !== autoConfig.path) {
                            const success = await parseAndLoadDirectPath(pathInput);
                            if (success) {
                                setAutoRefresh({ path: pathInput, lastRefreshTime: Date.now(), refreshIntervalMinutes: autoConfig.refreshIntervalMinutes || 30 }, null, null);
                                onClose();
                            } else {
                                alert("Failed to read the file at that path natively. Ensure the path is correct or try using 'Browse'.");
                            }
                        }
                        // If they didn't modify it but we don't have a handle yet (e.g. they opened, pasted earlier, and reopened to hit Apply)
                        else if (pathInput && !fileRef && !fileHandle) {
                            const success = await parseAndLoadDirectPath(pathInput);
                            if (success) {
                                setAutoRefresh({ path: pathInput, lastRefreshTime: Date.now(), refreshIntervalMinutes: autoConfig.refreshIntervalMinutes || 30 }, null, null);
                                onClose();
                            } else {
                                alert("Failed to read the file at that path natively. Ensure the path is correct or try using 'Browse'.");
                            }
                        }
                        // Otherwise, just save the state and close
                        else {
                            setAutoRefresh({ ...autoConfig, path: pathInput }, fileRef, fileHandle);
                            onClose();
                        }
                    }}
                >
                    Apply & Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
