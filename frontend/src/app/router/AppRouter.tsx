import { Navigate, Route, Routes } from 'react-router-dom';

import { DashboardPage } from '../../features/dashboard/pages/DashboardPage';
import { NotFoundPage } from '../../features/errors/pages/NotFoundPage';
import { UnauthorizedPage } from '../../features/errors/pages/UnauthorizedPage';
import { LoginPage } from '../../features/auth/pages/LoginPage';
import { ProjectCreatePage } from '../../features/projects/pages/ProjectCreatePage';
import { ProjectDetailPage } from '../../features/projects/pages/ProjectDetailPage';
import { ProjectEditPage } from '../../features/projects/pages/ProjectEditPage';
import { ProjectsListPage } from '../../features/projects/pages/ProjectsListPage';
import { ReportsPage } from '../../features/reports/pages/ReportsPage';
import { ResourcesPage } from '../../features/resources/pages/ResourcesPage';
import { UsersAdminPage } from '../../features/users/pages/UsersAdminPage';
import { useAuth } from '../../features/auth/authContext';
import { AuthenticatedLayout } from '../../layouts/AuthenticatedLayout';
import { PublicLayout } from '../../layouts/PublicLayout';
import { getDefaultAuthenticatedPath } from './defaultRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedLayout />}>
          <Route index element={<DefaultAuthenticatedRedirect />} />
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          <Route path="/projects" element={<ProjectsListPage />} />
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']} />}>
            <Route path="/projects/new" element={<ProjectCreatePage />} />
            <Route path="/projects/:uuid/edit" element={<ProjectEditPage />} />
          </Route>
          <Route path="/projects/:uuid" element={<ProjectDetailPage />} />
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/resources" element={<ResourcesPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']} />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route
              path="/admin/users"
              element={<UsersAdminPage />}
            />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

function DefaultAuthenticatedRedirect() {
  const { user } = useAuth();

  return <Navigate to={getDefaultAuthenticatedPath(user?.role ?? 'USER')} replace />;
}
