import { createContext, useContext } from 'react';

export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error';

export interface NotificationsContextValue {
  showNotification: (message: string, severity?: NotificationSeverity) => void;
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);

  if (context === null) {
    throw new Error('useNotifications must be used within NotificationsProvider.');
  }

  return context;
}
