interface ClientEnvironment {
  apiBaseUrl: string;
  timeZone: 'America/La_Paz';
}

const timeZone = import.meta.env.VITE_TIME_ZONE ?? 'America/La_Paz';

if (timeZone !== 'America/La_Paz') {
  throw new Error('VITE_TIME_ZONE must be America/La_Paz.');
}

export const env: ClientEnvironment = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
  timeZone,
};
