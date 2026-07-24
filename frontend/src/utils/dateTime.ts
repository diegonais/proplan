import { env } from './env';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function formatInstantForDisplay(isoInstant: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: env.timeZone,
  }).format(new Date(isoInstant));
}

export function formatDateOnlyForDisplay(isoDateOnly: string): string {
  const dateParts = parseIsoDateOnly(isoDateOnly);
  const calendarDate = new Date(
    Date.UTC(dateParts.year, dateParts.monthIndex, dateParts.day, 12, 0, 0),
  );

  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(calendarDate);
}

export function parseIsoDateOnly(value: string): { year: number; monthIndex: number; day: number } {
  if (!isIsoDateOnly(value)) {
    throw new Error('La fecha debe tener formato YYYY-MM-DD.');
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number.parseInt(yearText ?? '', 10);
  const month = Number.parseInt(monthText ?? '', 10);
  const day = Number.parseInt(dayText ?? '', 10);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('La fecha calendario no es válida.');
  }

  return {
    year,
    monthIndex: month - 1,
    day,
  };
}

export function isIsoDateOnly(value: string): boolean {
  return dateOnlyPattern.test(value);
}
