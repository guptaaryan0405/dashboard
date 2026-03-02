import { Box } from '@mui/material';
import { Header } from './Header';
import { AddRunModal } from '../modals/AddRunModal';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface LayoutProps {
    children: ReactNode;
    onToggleTheme: () => void;
}

export function Layout({ children, onToggleTheme }: LayoutProps) {
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editRunId, setEditRunId] = useState<string | null>(null);

    useEffect(() => {
        const handleOpenAdd = () => {
            setEditRunId(null);
            setAddModalOpen(true);
        };

        const handleOpenEdit = (e: Event) => {
            const customEvent = e as CustomEvent<{ runId: string }>;
            setEditRunId(customEvent.detail.runId);
            setAddModalOpen(true);
        };

        window.addEventListener('open-add-run-modal', handleOpenAdd);
        window.addEventListener('open-edit-run-modal', handleOpenEdit);

        return () => {
            window.removeEventListener('open-add-run-modal', handleOpenAdd);
            window.removeEventListener('open-edit-run-modal', handleOpenEdit);
        };
    }, []);

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
            <Header onToggleTheme={onToggleTheme} onOpenAdd={() => setAddModalOpen(true)} />
            <Box component="main" sx={{ flexGrow: 1, p: 3, backgroundColor: 'background.default', mt: 8 }}>
                {children}
            </Box>
            <AddRunModal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                existingRunId={editRunId}
            />
        </Box>
    );
}
