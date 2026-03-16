import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, List, ListItem, ListItemText, Box, ToggleButtonGroup, ToggleButton } from '@mui/material';
import type { Run, StageName } from '../../types';

interface ErrorLogsDialogProps {
    open: boolean;
    onClose: () => void;
    runData: Run | null;
}

const STAGES: StageName[] = ['PRECTS', 'CTS', 'ROUTE', 'POSTROUTE'];

export function ErrorLogsDialog({ open, onClose, runData }: ErrorLogsDialogProps) {
    const [targetStage, setTargetStage] = useState<StageName>('PRECTS');

    const handleStageChange = (_event: React.MouseEvent<HTMLElement>, newStage: StageName | null) => {
        if (newStage !== null) {
            setTargetStage(newStage);
        }
    };

    if (!runData) return null;

    const stageData = runData.stages[targetStage];
    const errors = stageData?.error_list || [];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ pb: 1 }}>
                Error Logs - {runData.run_tag}
            </DialogTitle>
            <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Target Stage
                    </Typography>
                    <ToggleButtonGroup
                        value={targetStage}
                        exclusive
                        onChange={handleStageChange}
                        size="small"
                        color="primary"
                    >
                        {STAGES.map(stage => (
                            <ToggleButton key={stage} value={stage} sx={{ px: 3 }}>{stage}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </Box>
                <Box sx={{ flexGrow: 1, minHeight: 200, bgcolor: 'background.default', borderRadius: 1, p: 1 }}>
                    {errors.length === 0 ? (
                        <Box sx={{ p: 4, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography color="text.secondary">No errors found in the logs for {targetStage}.</Typography>
                        </Box>
                    ) : (
                        <List dense disablePadding>
                            {errors.map((err, idx) => (
                                <ListItem key={idx} sx={{ alignItems: 'flex-start' }}>
                                    <ListItemText
                                        primary={err}
                                        primaryTypographyProps={{
                                            variant: 'body2',
                                            color: 'error.main',
                                            fontFamily: 'monospace',
                                            sx: { wordBreak: 'break-word', whiteSpace: 'pre-wrap' }
                                        }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary">Close</Button>
            </DialogActions>
        </Dialog>
    );
}
