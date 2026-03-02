import { Drawer, Box, Typography, Toolbar, Divider, Checkbox, FormControlLabel, FormGroup, Button } from '@mui/material';
import { useRunStore } from '../../store/useRunStore';

const drawerWidth = 280;

export function Sidebar() {
    const filters = useRunStore((state) => state.filters);
    const toggleStageFilter = useRunStore((state) => state.toggleStageFilter);
    const togglePathGroupFilter = useRunStore((state) => state.togglePathGroupFilter);

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
            }}
        >
            <Toolbar />
            <Box sx={{ overflow: 'auto', p: 2 }}>

                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    sx={{ mb: 3 }}
                    onClick={() => window.dispatchEvent(new CustomEvent('open-add-run-modal'))}
                >
                    + New Run
                </Button>

                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    STAGES
                </Typography>
                <FormGroup sx={{ mb: 3 }}>
                    <FormControlLabel control={<Checkbox checked={filters.stages.PRECTS} onChange={() => toggleStageFilter('PRECTS')} size="small" />} label="PRECTS" />
                    <FormControlLabel control={<Checkbox checked={filters.stages.CTS} onChange={() => toggleStageFilter('CTS')} size="small" />} label="CTS" />
                    <FormControlLabel control={<Checkbox checked={filters.stages.POSTROUTE} onChange={() => toggleStageFilter('POSTROUTE')} size="small" />} label="POSTROUTE" />
                </FormGroup>
                <Divider sx={{ mb: 2 }} />

                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    PATH GROUPS
                </Typography>
                <FormGroup sx={{ mb: 3 }}>
                    <FormControlLabel control={<Checkbox checked={filters.pathGroups.all} onChange={() => togglePathGroupFilter('all')} size="small" />} label="all" />
                    <FormControlLabel control={<Checkbox checked={filters.pathGroups.reg2reg} onChange={() => togglePathGroupFilter('reg2reg')} size="small" />} label="reg2reg" />
                </FormGroup>
                <Divider sx={{ mb: 2 }} />

                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    METRICS
                </Typography>
                <FormGroup sx={{ mb: 3 }}>
                    <FormControlLabel control={<Checkbox defaultChecked size="small" />} label="WNS" />
                    <FormControlLabel control={<Checkbox defaultChecked size="small" />} label="TNS" />
                    <FormControlLabel control={<Checkbox defaultChecked size="small" />} label="FEP" />
                    <FormControlLabel control={<Checkbox defaultChecked size="small" />} label="Area" />
                    <FormControlLabel control={<Checkbox defaultChecked size="small" />} label="Leakage" />
                    <FormControlLabel control={<Checkbox defaultChecked size="small" />} label="DRCs" />
                </FormGroup>

            </Box>
        </Drawer>
    );
}
