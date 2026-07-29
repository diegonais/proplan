import { UserRole } from '../../features/auth/types';

export function getDefaultAuthenticatedPath(role: UserRole): string {
  return role === 'USER' ? '/projects' : '/dashboard';
}
