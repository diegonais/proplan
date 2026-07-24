export type UserRole = 'ADMIN' | 'PROJECT_MANAGER' | 'USER';

export interface AuthenticatedUser {
  uuid: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: AuthenticatedUser;
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    ADMIN: 'Administrador',
    PROJECT_MANAGER: 'Jefe de proyecto',
    USER: 'Usuario',
  };

  return labels[role];
}
