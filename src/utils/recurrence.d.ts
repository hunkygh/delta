export const DEFAULT_RECURRENCE_CONFIG: {
  unit: string;
  interval: number;
  limitType: string;
};

export function normalizeRecurrenceConfigForRule(
  recurrence: string,
  recurrenceConfig?: any
): any;

export function shiftByRecurrence(
  date: Date,
  recurrence: string,
  recurrenceConfig?: any
): Date;

export function hasRecurrenceExceededLimit(
  baseStart: Date,
  occurrenceStart: Date,
  recurrence: string,
  recurrenceConfig?: any
): boolean;
