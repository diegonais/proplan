import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import { ReactNode } from 'react';

import { UserRole } from '../../features/auth/types';

export interface NavigationItem {
  label: string;
  path: string;
  icon: ReactNode;
  allowedRoles?: readonly UserRole[];
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
    label: 'Actividades',
    path: '/tasks',
    icon: <AssignmentOutlinedIcon aria-hidden="true" />,
  },
  {
    label: 'Equipo',
    path: '/team',
    icon: <GroupsOutlinedIcon aria-hidden="true" />,
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
