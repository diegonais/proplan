import { Navigate, Route, Routes } from 'react-router-dom';

import { BootstrapStatusPage } from '../../features/bootstrap/pages/BootstrapStatusPage';
import { MainLayout } from '../../layouts/MainLayout';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<BootstrapStatusPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
