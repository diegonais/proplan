import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNotifications } from '../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../services/http/apiError';
import { setUnauthorizedHandler } from '../../services/http/httpClient';
import { clearAccessToken, getAccessToken, setAccessToken } from '../../services/session/tokenStorage';
import { AuthContext, AuthStatus } from './authContext';
import { getCurrentUser, login as loginRequest } from './services/authApi';
import { AuthenticatedUser, LoginRequest } from './types';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const hasRestoredSession = useRef(false);
  const { showNotification } = useNotifications();

  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (getAccessToken() !== null) {
        clearSession();
        showNotification('La sesión expiró. Inicie sesión nuevamente.', 'warning');
      }
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [clearSession, showNotification]);

  useEffect(() => {
    if (hasRestoredSession.current) {
      return;
    }

    hasRestoredSession.current = true;

    if (getAccessToken() === null) {
      setStatus('unauthenticated');
      return;
    }

    void getCurrentUser()
      .then((currentUser) => {
        setUser(currentUser);
        setStatus('authenticated');
      })
      .catch(() => {
        clearSession();
      });
  }, [clearSession]);

  const login = useCallback(
    async (request: LoginRequest) => {
      try {
        const response = await loginRequest(request);

        setAccessToken(response.accessToken);
        setUser(response.user);
        setStatus('authenticated');
        showNotification('Inicio de sesión correcto.', 'success');
      } catch (error) {
        clearSession();
        throw new Error(getApiErrorMessage(error).message);
      }
    },
    [clearSession, showNotification],
  );

  const logout = useCallback(() => {
    clearSession();
    showNotification('Sesión cerrada correctamente.', 'info');
  }, [clearSession, showNotification]);

  const contextValue = useMemo(
    () => ({
      status,
      user,
      isAuthenticated: status === 'authenticated',
      login,
      logout,
    }),
    [login, logout, status, user],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
