import { describe, expect, it } from 'vitest';
import { parseBrainDump } from '../src/utils/parseBrainDump';

describe('parseBrainDump', () => {
  it('returns a calendar-first plan object', () => {
    const plan = parseBrainDump('Block 2 hours for UX flow mapping.');
    expect(plan.mode).toBe('calendar_description');
    expect(plan.event.title.length).toBeGreaterThan(0);
  });
});
