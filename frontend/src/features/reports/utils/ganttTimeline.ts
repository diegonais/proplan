import { parseIsoDateOnly } from '../../../utils/dateTime';
import { GanttTaskReportItem } from '../types';

export interface TimelineDay {
  isoDate: string;
  dayOfMonth: string;
  weekdayLabel: string;
  isWeekend: boolean;
  isToday: boolean;
}

export function buildTimelineDays(startDate: string, endDate: string): TimelineDay[] {
  const days: TimelineDay[] = [];
  const current = toUtcNoonDate(startDate);
  const end = toUtcNoonDate(endDate);
  const todayIsoDate = getTodayIsoDate();
  const weekdayFormatter = new Intl.DateTimeFormat('es-BO', {
    weekday: 'short',
    timeZone: 'UTC',
  });

  while (current.getTime() <= end.getTime()) {
    const isoDate = formatUtcDateOnly(current);
    const weekday = current.getUTCDay();

    days.push({
      isoDate,
      dayOfMonth: String(current.getUTCDate()).padStart(2, '0'),
      weekdayLabel: weekdayFormatter.format(current).replace('.', ''),
      isWeekend: weekday === 0 || weekday === 6,
      isToday: isoDate === todayIsoDate,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

export function daysBetweenInclusive(startDate: string, endDate: string): number {
  const start = toUtcNoonDate(startDate);
  const end = toUtcNoonDate(endDate);
  const dayInMilliseconds = 24 * 60 * 60 * 1000;

  return Math.max(Math.floor((end.getTime() - start.getTime()) / dayInMilliseconds) + 1, 1);
}

export function getVisibleTaskRange(
  task: Pick<GanttTaskReportItem, 'startDate' | 'endDate'>,
  timelineDays: readonly TimelineDay[],
): { gridStart: number; gridSpan: number } | null {
  const visibleStartIndex = timelineDays.findIndex((day) => day.isoDate >= task.startDate);
  const visibleEndIndex = findLastIndex(timelineDays, (day) => day.isoDate <= task.endDate);

  if (visibleStartIndex === -1 || visibleEndIndex === -1 || visibleStartIndex > visibleEndIndex) {
    return null;
  }

  return {
    gridStart: visibleStartIndex + 1,
    gridSpan: visibleEndIndex - visibleStartIndex + 1,
  };
}

export function toUtcNoonDate(value: string): Date {
  const dateParts = parseIsoDateOnly(value);

  return new Date(Date.UTC(dateParts.year, dateParts.monthIndex, dateParts.day, 12, 0, 0));
}

function formatUtcDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${String(year)}-${month}-${day}`;
}

function getTodayIsoDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function findLastIndex<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];

    if (item !== undefined && predicate(item)) {
      return index;
    }
  }

  return -1;
}
