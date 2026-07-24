export type NodeEnvironment = 'development' | 'test' | 'production';

export interface EnvironmentVariables {
  NODE_ENV: NodeEnvironment;
  APP_PORT: number;
  API_PREFIX: string;
  API_VERSION: string;
  TIME_ZONE: 'America/La_Paz';
  CORS_ORIGINS: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
}

type RawEnvironment = Record<string, string | undefined>;

export function validateEnvironment(raw: RawEnvironment): EnvironmentVariables {
  const timeZone = raw.TIME_ZONE ?? 'America/La_Paz';

  if (timeZone !== 'America/La_Paz') {
    throw new Error('TIME_ZONE must be America/La_Paz.');
  }

  return {
    NODE_ENV: parseNodeEnvironment(raw.NODE_ENV),
    APP_PORT: parsePort(raw.APP_PORT ?? '3000', 'APP_PORT'),
    API_PREFIX: parseRequiredString(raw.API_PREFIX ?? 'api', 'API_PREFIX'),
    API_VERSION: parseRequiredString(raw.API_VERSION ?? '1', 'API_VERSION'),
    TIME_ZONE: timeZone,
    CORS_ORIGINS: parseRequiredString(raw.CORS_ORIGINS ?? 'http://localhost:5173', 'CORS_ORIGINS'),
    DB_HOST: parseRequiredString(raw.DB_HOST, 'DB_HOST'),
    DB_PORT: parsePort(raw.DB_PORT, 'DB_PORT'),
    DB_NAME: parseRequiredString(raw.DB_NAME, 'DB_NAME'),
    DB_USERNAME: parseRequiredString(raw.DB_USERNAME, 'DB_USERNAME'),
    DB_PASSWORD: parseRequiredString(raw.DB_PASSWORD, 'DB_PASSWORD'),
  };
}

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  const nodeEnvironment = value ?? 'development';

  if (
    nodeEnvironment !== 'development' &&
    nodeEnvironment !== 'test' &&
    nodeEnvironment !== 'production'
  ) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  return nodeEnvironment;
}

function parseRequiredString(value: string | undefined, variableName: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${variableName} is required.`);
  }

  return value.trim();
}

function parsePort(value: string | undefined, variableName: string): number {
  const rawValue = parseRequiredString(value, variableName);
  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 65535) {
    throw new Error(`${variableName} must be a valid TCP port.`);
  }

  return parsedValue;
}
