import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { httpClient } from '../services/http/httpClient';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface MockHttpResponse {
  status: number;
  data: unknown;
}

interface MockHttpRequest {
  body: unknown;
  config: InternalAxiosRequestConfig;
}

interface CapturedHttpRequest {
  method: HttpMethod;
  url: string;
  authorizationHeader: string | null;
  body: unknown;
  params: unknown;
}

interface MockHttpRoute {
  method: HttpMethod;
  url: string;
  response: MockHttpResponse | ((request: MockHttpRequest) => MockHttpResponse);
}

const originalAdapter = httpClient.defaults.adapter;
const capturedRequests: CapturedHttpRequest[] = [];

export function installHttpMock(routes: readonly MockHttpRoute[]): void {
  capturedRequests.length = 0;

  httpClient.defaults.adapter = (config) => {
    const method = normalizeMethod(config.method);
    const url = config.url ?? '';
    const route = routes.find((candidate) => candidate.method === method && candidate.url === url);

    if (route === undefined) {
      return Promise.resolve(
        createAxiosResponse(config, {
          status: 404,
          data: {
            statusCode: 404,
            message: `No existe mock para ${method} ${url}.`,
            error: 'NotFound',
            timestamp: new Date().toISOString(),
            path: url,
          },
        }),
      );
    }

    const body = parseRequestBody(config.data);
    capturedRequests.push({
      method,
      url,
      authorizationHeader: readAuthorizationHeader(config),
      body,
      params: config.params,
    });

    const response =
      typeof route.response === 'function' ? route.response({ body, config }) : route.response;

    return Promise.resolve(createAxiosResponse(config, response));
  };
}

export function resetHttpMock(): void {
  capturedRequests.length = 0;
  httpClient.defaults.adapter = originalAdapter;
}

export function getCapturedRequests(): readonly CapturedHttpRequest[] {
  return capturedRequests;
}

function normalizeMethod(method: string | undefined): HttpMethod {
  const normalizedMethod = (method ?? 'GET').toUpperCase();

  if (
    normalizedMethod === 'GET' ||
    normalizedMethod === 'POST' ||
    normalizedMethod === 'PATCH' ||
    normalizedMethod === 'DELETE'
  ) {
    return normalizedMethod;
  }

  throw new Error(`Método HTTP no soportado en pruebas: ${normalizedMethod}.`);
}

function parseRequestBody(data: unknown): unknown {
  if (typeof data !== 'string') {
    return data;
  }

  try {
    return JSON.parse(data) as unknown;
  } catch {
    return data;
  }
}

function readAuthorizationHeader(config: InternalAxiosRequestConfig): string | null {
  const headerValue = config.headers.Authorization;

  return typeof headerValue === 'string' ? headerValue : null;
}

function createAxiosResponse(
  config: InternalAxiosRequestConfig,
  mockResponse: MockHttpResponse,
): AxiosResponse<unknown> {
  const response: AxiosResponse<unknown> = {
    data: mockResponse.data,
    status: mockResponse.status,
    statusText: mockResponse.status >= 400 ? 'Error' : 'OK',
    headers: {},
    config,
  };

  if (mockResponse.status >= 400) {
    throw new AxiosError(
      `Request failed with status code ${mockResponse.status.toString()}`,
      undefined,
      config,
      undefined,
      response,
    );
  }

  return response;
}
