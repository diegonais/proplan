import { CssBaseline, ThemeProvider } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';

import { NotificationsProvider } from '../../components/feedback/NotificationsProvider';
import { AuthProvider } from '../../features/auth/AuthProvider';
import { AppErrorBoundary } from '../../components/feedback/AppErrorBoundary';
import { appTheme } from '../theme/theme';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AppErrorBoundary>
        <BrowserRouter>
          <NotificationsProvider>
            <AuthProvider>{children}</AuthProvider>
          </NotificationsProvider>
        </BrowserRouter>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
