import { UserRole } from '../auth/types';

export interface User {
  uuid: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UsersListParams {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  orderBy?: 'name' | 'email' | 'role' | 'isActive' | 'createdAt';
  order?: 'ASC' | 'DESC';
}

export interface PaginatedUsersResponse {
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const userRoles: readonly UserRole[] = ['ADMIN', 'PROJECT_MANAGER', 'USER'];
