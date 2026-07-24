import { Navigate, Outlet } from 'react-router-dom';

import { LoadingScreen } from '../../components/feedback/LoadingScreen';
import { useAuth } from '../../features/auth/authContext';
import { UserRole } from '../../features/auth/types';

interface ProtectedRouteProps {
  allowedRoles?: readonly UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { status, user } = useAuth();

  if (status === 'checking') {
    return <LoadingScreen />;
  }

  if (status !== 'authenticated' || user === null) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles !== undefined && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
