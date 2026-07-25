import { BrowserRouter } from 'react-router-dom';

import { NotificationsProvider } from '../../components/feedback/NotificationsProvider';
import { AuthProvider } from '../../features/auth/AuthProvider';
import { AppErrorBoundary } from '../../components/feedback/AppErrorBoundary';
import { ColorModeProvider } from '../theme/ColorModeProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ColorModeProvider>
      <AppErrorBoundary>
        <BrowserRouter>
          <NotificationsProvider>
            <AuthProvider>{children}</AuthProvider>
          </NotificationsProvider>
        </BrowserRouter>
      </AppErrorBoundary>
    </ColorModeProvider>
  );
}
