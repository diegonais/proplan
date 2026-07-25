import { httpClient } from '../../../services/http/httpClient';
import { UserRole } from '../../auth/types';
import { PaginatedUsersResponse, User, UserPayload, UsersListParams } from '../types';

export async function listUsers(params: UsersListParams): Promise<PaginatedUsersResponse> {
  const response = await httpClient.get<PaginatedUsersResponse>('/users', {
    params: removeEmptyParams(params),
  });

  return response.data;
}

export async function createUser(payload: UserPayload): Promise<User> {
  const response = await httpClient.post<User>('/users', payload);

  return response.data;
}

export async function updateUserRole(uuid: string, role: UserRole): Promise<User> {
  const response = await httpClient.patch<User>(`/users/${uuid}/role`, { role });

  return response.data;
}

export async function updateUserStatus(uuid: string, isActive: boolean): Promise<User> {
  const response = await httpClient.patch<User>(`/users/${uuid}/status`, { isActive });

  return response.data;
}

function removeEmptyParams(params: UsersListParams): UsersListParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as UsersListParams;
}
