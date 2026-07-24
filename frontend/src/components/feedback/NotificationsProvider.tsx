import { Alert, Snackbar } from '@mui/material';
import { useCallback, useMemo, useState } from 'react';

import { NotificationSeverity, NotificationsContext } from './notificationsContext';

interface NotificationState {
  message: string;
  severity: NotificationSeverity;
}

interface NotificationsProviderProps {
  children: React.ReactNode;
}

export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const showNotification = useCallback(
    (message: string, severity: NotificationSeverity = 'info') => {
      setNotification({ message, severity });
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      showNotification,
    }),
    [showNotification],
  );

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
      <Snackbar
        open={notification !== null}
        autoHideDuration={5000}
        onClose={() => {
          setNotification(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={notification?.severity ?? 'info'}
          variant="filled"
          onClose={() => {
            setNotification(null);
          }}
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </NotificationsContext.Provider>
  );
}
