import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';
import { ChartWidget } from '../charts/ChartWidget';
import { useRunStore } from '../../store/useRunStore';
import type { ChartConfig } from '../../types';

interface ViewChartDialogProps {
    open: boolean;
    config: ChartConfig | null;
    onClose: () => void;
}

export function ViewChartDialog({ open, config, onClose }: ViewChartDialogProps) {
    const { runs } = useRunStore();

    if (!config) return null;

    const title = config.isIntermediate
        ? `Intermediate Trend of ${config.metric} at ${config.targetStage} (${config.pathGroup})`
        : `Comparison of ${config.metric} at ${config.targetStage} (${config.pathGroup})`;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, pb: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {title}
                <IconButton onClick={onClose} size="small">
                    <Close fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 4 }}>
                {/* We pass a dummy onRemove handler because the ChartWidget doesn't need to delete itself from global state anymore */}
                <ChartWidget config={config} runs={runs} onRemove={onClose} />
            </DialogContent>
        </Dialog>
    );
}
