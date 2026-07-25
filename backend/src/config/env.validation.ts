export type NodeEnvironment = 'development' | 'test' | 'production';

export interface EnvironmentVariables {
  NODE_ENV: NodeEnvironment;
  APP_PORT: number;
  API_PREFIX: string;
  API_VERSION: string;
  TIME_ZONE: 'America/La_Paz';
  CORS_ORIGINS: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  BCRYPT_SALT_ROUNDS: number;
  THROTTLE_TTL_SECONDS: number;
  THROTTLE_LIMIT: number;
  INITIAL_ADMIN_EMAIL?: string;
  INITIAL_ADMIN_NAME?: string;
  INITIAL_ADMIN_PASSWORD?: string;
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
    JWT_SECRET: parseJwtSecret(raw.JWT_SECRET, parseNodeEnvironment(raw.NODE_ENV)),
    JWT_EXPIRES_IN: parseRequiredString(raw.JWT_EXPIRES_IN ?? '1h', 'JWT_EXPIRES_IN'),
    BCRYPT_SALT_ROUNDS: parseIntegerInRange(
      raw.BCRYPT_SALT_ROUNDS ?? '12',
      'BCRYPT_SALT_ROUNDS',
      10,
      14,
    ),
    THROTTLE_TTL_SECONDS: parseIntegerInRange(
      raw.THROTTLE_TTL_SECONDS ?? '60',
      'THROTTLE_TTL_SECONDS',
      1,
      3600,
    ),
    THROTTLE_LIMIT: parseIntegerInRange(raw.THROTTLE_LIMIT ?? '120', 'THROTTLE_LIMIT', 1, 10000),
    INITIAL_ADMIN_EMAIL: parseOptionalString(raw.INITIAL_ADMIN_EMAIL),
    INITIAL_ADMIN_NAME: parseOptionalString(raw.INITIAL_ADMIN_NAME),
    INITIAL_ADMIN_PASSWORD: parseOptionalString(raw.INITIAL_ADMIN_PASSWORD),
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

function parseOptionalString(value: string | undefined): string | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
}

function parseJwtSecret(value: string | undefined, nodeEnvironment: NodeEnvironment): string {
  const jwtSecret = parseRequiredString(value, 'JWT_SECRET');

  if (nodeEnvironment === 'production' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production.');
  }

  return jwtSecret;
}

function parsePort(value: string | undefined, variableName: string): number {
  const rawValue = parseRequiredString(value, variableName);
  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 65535) {
    throw new Error(`${variableName} must be a valid TCP port.`);
  }

  return parsedValue;
}

function parseIntegerInRange(
  value: string | undefined,
  variableName: string,
  minimum: number,
  maximum: number,
): number {
  const rawValue = parseRequiredString(value, variableName);
  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < minimum || parsedValue > maximum) {
    throw new Error(
      `${variableName} must be an integer between ${String(minimum)} and ${String(maximum)}.`,
    );
  }

  return parsedValue;
}
