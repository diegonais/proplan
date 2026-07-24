import axios from 'axios';

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

export interface ApiErrorMessage {
  statusCode?: number;
  message: string;
}

export function getApiErrorMessage(error: unknown): ApiErrorMessage {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const response = error.response;

    if (response?.data !== undefined) {
      return {
        statusCode: response.status,
        message: normalizeMessage(response.data.message),
      };
    }

    if (error.code === 'ERR_NETWORK') {
      return {
        message: 'No se pudo conectar con el servidor. Verifique la conexión e intente nuevamente.',
      };
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return { message: error.message };
  }

  return { message: 'Ocurrió un error inesperado.' };
}

function normalizeMessage(message: string | string[]): string {
  if (Array.isArray(message)) {
    return message.join(' ');
  }

  return message;
}
