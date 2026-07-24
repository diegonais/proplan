import { Navigate, Route, Routes } from 'react-router-dom';

import { DashboardPage } from '../../features/dashboard/pages/DashboardPage';
import { NotFoundPage } from '../../features/errors/pages/NotFoundPage';
import { UnauthorizedPage } from '../../features/errors/pages/UnauthorizedPage';
import { LoginPage } from '../../features/auth/pages/LoginPage';
import { ModulePendingPage } from '../../features/pending/pages/ModulePendingPage';
import { AuthenticatedLayout } from '../../layouts/AuthenticatedLayout';
import { PublicLayout } from '../../layouts/PublicLayout';
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
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ModulePendingPage title="Proyectos" />} />
          <Route path="/tasks" element={<ModulePendingPage title="Actividades" />} />
          <Route path="/team" element={<ModulePendingPage title="Equipo" />} />
          <Route path="/reports" element={<ModulePendingPage title="Reportes" />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route
              path="/admin/users"
              element={<ModulePendingPage title="Administración de usuarios" />}
            />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
