import axios from 'axios';

import { env } from '../../utils/env';
import { getAccessToken } from '../session/tokenStorage';

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    'X-Time-Zone': env.timeZone,
  },
});

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

httpClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();

  if (accessToken !== null) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      unauthorizedHandler?.();
    }

    return Promise.reject(error instanceof Error ? error : new Error('HTTP request failed.'));
  },
);
