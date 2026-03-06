import type { PlanObject } from '../types/PlanObject';

export function parseBrainDump(input: string): PlanObject {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    mode: 'calendar_description',
    event: {
      title: input.slice(0, 50) || 'Untitled Block',
      description: input,
      start: now.toISOString(),
      end: oneHourLater.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    metadata: {
      confidence: 0.45,
      requiresClarification: input.length < 12,
      sourceIntent: 'quick_parse'
    }
  };
}
