import { ThemeProvider, CssBaseline } from '@mui/material';
import { useMemo, useState } from 'react';
import { lightTheme, darkTheme } from './theme';
import { Layout } from './components/layout/Layout';
import { RunTable } from './components/dashboard/RunTable';

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);

  const toggleTheme = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

  const handleEditRun = (runId: string) => {
    window.dispatchEvent(new CustomEvent('open-edit-run-modal', { detail: { runId } }));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout onToggleTheme={toggleTheme}>
        <RunTable onEditRun={handleEditRun} />
      </Layout>
    </ThemeProvider>
  );
}

export default App;
