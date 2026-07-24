import { env } from './env';

export function formatInstantForDisplay(isoInstant: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: env.timeZone,
  }).format(new Date(isoInstant));
}

export function isIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
