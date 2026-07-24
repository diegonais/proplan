import { httpClient } from '../../../services/http/httpClient';
import { AuthenticatedUser, LoginRequest, LoginResponse } from '../types';

const authRoutes = {
  login: '/auth/login',
  me: '/auth/me',
} as const;

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await httpClient.post<LoginResponse>(authRoutes.login, request);

  return response.data;
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  const response = await httpClient.get<AuthenticatedUser>(authRoutes.me);

  return response.data;
}
