import { Navigate, Outlet } from 'react-router-dom';

import { LoadingScreen } from '../../components/feedback/LoadingScreen';
import { useAuth } from '../../features/auth/authContext';
import { getDefaultAuthenticatedPath } from './defaultRoute';

export function PublicOnlyRoute() {
  const { status, user } = useAuth();

  if (status === 'checking') {
    return <LoadingScreen />;
  }

  if (status === 'authenticated') {
    return <Navigate to={getDefaultAuthenticatedPath(user?.role ?? 'USER')} replace />;
  }

  return <Outlet />;
}
