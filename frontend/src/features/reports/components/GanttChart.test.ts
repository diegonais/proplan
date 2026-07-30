import { describe, expect, it } from 'vitest';

import { buildTimelineDays, getVisibleTaskRange } from '../utils/ganttTimeline';

describe('GanttChart date alignment', () => {
  it('marks only Saturdays and Sundays as weekend days', () => {
    const days = buildTimelineDays('2026-02-01', '2026-02-15');
    const weekendDays = days
      .filter((day) => day.isWeekend)
      .map((day) => `${day.isoDate} ${day.weekdayLabel}`);

    expect(weekendDays).toEqual([
      '2026-02-01 dom',
      '2026-02-07 sáb',
      '2026-02-08 dom',
      '2026-02-14 sáb',
      '2026-02-15 dom',
    ]);
  });

  it('clips task bars to the visible timeline range without creating implicit columns', () => {
    const days = buildTimelineDays('2026-02-01', '2026-02-15');

    expect(getVisibleTaskRange({ startDate: '2026-02-07', endDate: '2026-02-10' }, days)).toEqual({
      gridStart: 7,
      gridSpan: 4,
    });
    expect(getVisibleTaskRange({ startDate: '2026-01-29', endDate: '2026-02-02' }, days)).toEqual({
      gridStart: 1,
      gridSpan: 2,
    });
    expect(getVisibleTaskRange({ startDate: '2026-02-14', endDate: '2026-02-20' }, days)).toEqual({
      gridStart: 14,
      gridSpan: 2,
    });
  });
});
