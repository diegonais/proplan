import { formatDateOnlyForDisplay, formatInstantForDisplay } from './dateTime';

describe('dateTime utilities', () => {
  it('keeps YYYY-MM-DD dates on the same calendar day', () => {
    const formattedDate = formatDateOnlyForDisplay('2026-07-24');

    expect(formattedDate).toContain('24');
    expect(formattedDate).toContain('2026');
  });

  it('shows UTC timestamps in America/La_Paz', () => {
    const formattedInstant = formatInstantForDisplay('2026-07-25T00:30:00.000Z');

    expect(formattedInstant).toContain('24');
    expect(formattedInstant).toMatch(/20:30|8:30/);
  });
});
