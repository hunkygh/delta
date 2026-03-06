export function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleString()} - ${end.toLocaleTimeString()}`;
}

export function normalizeRecurrence(rrule?: string): string {
  if (!rrule) return 'No recurrence';
  return rrule.toUpperCase();
}
