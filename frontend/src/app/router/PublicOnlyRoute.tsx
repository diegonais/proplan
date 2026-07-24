import { Navigate, Outlet } from 'react-router-dom';

import { LoadingScreen } from '../../components/feedback/LoadingScreen';
import { useAuth } from '../../features/auth/authContext';

export function PublicOnlyRoute() {
  const { status } = useAuth();

  if (status === 'checking') {
    return <LoadingScreen />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
