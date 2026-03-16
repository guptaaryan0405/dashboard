import { Card, CardContent, Typography, Box, Table, TableBody, TableCell, TableRow } from '@mui/material';
import type { Run, StageName, StageData } from '../../types';

interface RunCardProps {
    run: Run;
}

const STAGES: StageName[] = ['PRECTS', 'CTS', 'ROUTE', 'POSTROUTE'];

function StageTable({ stageData, stageName }: { stageData?: StageData; stageName: StageName }) {
    if (!stageData) {
        return (
            <Box sx={{ p: 2, textAlign: 'center', backgroundColor: 'action.hover', borderRadius: 1, mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    {stageName} Not Available
                </Typography>
            </Box>
        );
    }

    const { views, metrics } = stageData;

    const getWnsColor = (val?: number) => val !== undefined && val < 0 ? 'error.main' : 'text.primary';

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>{stageName}</Typography>
            <Table size="small" sx={{
                '& .MuiTableCell-root': { padding: '4px 8px', borderBottom: '1px solid', borderColor: 'divider' },
                '& .MuiTableCell-head': { fontWeight: 'bold', backgroundColor: 'action.hover' }
            }}>
                <TableBody>
                    <TableRow>
                        <TableCell variant="head" width="33%"></TableCell>
                        <TableCell variant="head" width="33%">ALL</TableCell>
                        <TableCell variant="head" width="33%">REG2REG</TableCell>
                    </TableRow>

                    <TableRow>
                        <TableCell variant="head">WNS</TableCell>
                        <TableCell sx={{ color: getWnsColor(views?.ALL?.WNS) }}>{views?.ALL?.WNS ?? '—'}</TableCell>
                        <TableCell sx={{ color: getWnsColor(views?.REG2REG?.WNS) }}>{views?.REG2REG?.WNS ?? '—'}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell variant="head">TNS</TableCell>
                        <TableCell>{views?.ALL?.TNS ?? '—'}</TableCell>
                        <TableCell>{views?.REG2REG?.TNS ?? '—'}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell variant="head">FEP</TableCell>
                        <TableCell>{views?.ALL?.FEP ?? '—'}</TableCell>
                        <TableCell>{views?.REG2REG?.FEP ?? '—'}</TableCell>
                    </TableRow>

                    <TableRow>
                        <TableCell variant="head">Area (mm²)</TableCell>
                        <TableCell colSpan={2}>{metrics?.area_mm2?.toFixed(3) ?? '—'}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell variant="head">Leakage (mW)</TableCell>
                        <TableCell colSpan={2}>{metrics?.leakage_mw ?? '—'}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell variant="head">DRCs</TableCell>
                        <TableCell colSpan={2}>{metrics?.drc_count ?? '—'}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </Box>
    );
}

export function RunCard({ run }: RunCardProps) {
    return (
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, backgroundColor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1" fontWeight="bold" noWrap title={run.run_tag}>
                    {run.run_tag}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Frequency: {run.frequency_ghz ? `${run.frequency_ghz} GHz` : '—'}
                </Typography>
            </Box>
            <CardContent sx={{ flexGrow: 1, p: 2 }}>
                {STAGES.map((stageName) => (
                    <StageTable key={stageName} stageName={stageName} stageData={run.stages[stageName]} />
                ))}
            </CardContent>
        </Card>
    );
}
