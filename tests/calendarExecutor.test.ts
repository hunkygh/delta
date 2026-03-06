import { describe, expect, it } from 'vitest';
import { formatTimeRange, normalizeRecurrence } from '../src/utils/calendarUtils';

describe('calendar utils', () => {
  it('normalizes recurrence', () => {
    expect(normalizeRecurrence('rrule:fReQ=dAiLy')).toBe('RRULE:FREQ=DAILY');
  });

  it('formats time range', () => {
    const value = formatTimeRange(new Date().toISOString(), new Date().toISOString());
    expect(value).toContain('-');
  });
});
