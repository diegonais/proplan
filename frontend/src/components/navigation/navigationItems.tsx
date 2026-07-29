import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { ReactNode } from 'react';

import { UserRole } from '../../features/auth/types';

export interface NavigationItem {
  label: string;
  path?: string;
  icon: ReactNode;
  allowedRoles?: readonly UserRole[];
  disabled?: boolean;
}

export const navigationItems: readonly NavigationItem[] = [
  {
    label: 'Panel general',
    path: '/dashboard',
    icon: <DashboardOutlinedIcon aria-hidden="true" />,
  },
  {
    label: 'Proyectos',
    path: '/projects',
    icon: <FolderOutlinedIcon aria-hidden="true" />,
  },
  {
    label: 'Recursos',
    path: '/resources',
    icon: <Inventory2OutlinedIcon aria-hidden="true" />,
    allowedRoles: ['ADMIN', 'PROJECT_MANAGER'],
  },
  {
    label: 'Reportes',
    path: '/reports',
    icon: <AssessmentOutlinedIcon aria-hidden="true" />,
  },
  {
    label: 'Administración de usuarios',
    path: '/admin/users',
    icon: <ManageAccountsOutlinedIcon aria-hidden="true" />,
    allowedRoles: ['ADMIN'],
  },
];

export function canAccessNavigationItem(item: NavigationItem, role: UserRole): boolean {
  return item.allowedRoles === undefined || item.allowedRoles.includes(role);
}
