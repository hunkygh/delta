import type { HoursWindow } from './WeekCalendar';

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + amount);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function normalizeToDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatHourLabel(hour24: number): string {
  const period = hour24 >= 12 ? 'pm' : 'am';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12} ${period}`;
}

export function formatTimeRange(start: Date | string, end: Date | string): string {
  const s = normalizeToDate(start);
  const e = normalizeToDate(end);
  return `${toShortTime(s)} - ${toShortTime(e)}`;
}

function toShortTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

export function getStartMinute(hours: HoursWindow): number {
  return hours.start * 60;
}

export function getEndMinute(hours: HoursWindow): number {
  return (hours.end + 1) * 60;
}

export function getTotalVisibleMinutes(hours: HoursWindow): number {
  return getEndMinute(hours) - getStartMinute(hours);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function dayDateAtMinutes(date: Date, minutesFromStartOfDay: number): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setMinutes(minutesFromStartOfDay, 0, 0);
  return next;
}

export function roundMinutesTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

export function getMinutesFromStartOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}
