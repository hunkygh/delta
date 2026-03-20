import type { Event } from '../../types/Event';
import type { ShellTaskSummary } from './types';

export type ShellDayTaskBucket = 'timed' | 'nested' | 'untimed' | 'carry_forward';

export interface ShellDayTaskEntry {
  id: string;
  itemId: string;
  itemTitle: string;
  listId: string | null;
  listName: string;
  focalId: string | null;
  title: string;
  scheduledAt: string | null;
  timeLabel: string | null;
  bucket: ShellDayTaskBucket;
  blockId: string | null;
  blockTitle: string | null;
  sortTimeMs: number;
}

export interface ShellDaySnapshot {
  timed: ShellDayTaskEntry[];
  nested: ShellDayTaskEntry[];
  untimed: ShellDayTaskEntry[];
  carryForward: ShellDayTaskEntry[];
}

const startOfLocalDay = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfLocalDay = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
};

const sortEntries = (entries: ShellDayTaskEntry[]): ShellDayTaskEntry[] =>
  [...entries].sort((a, b) => {
    if (a.sortTimeMs !== b.sortTimeMs) {
      return a.sortTimeMs - b.sortTimeMs;
    }
    return a.title.localeCompare(b.title);
  });

const formatTimeLabel = (date: Date): string =>
  date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  }).toLowerCase();

const isTaskComplete = (task: ShellTaskSummary): boolean => {
  if (task.isComplete) {
    return true;
  }

  const normalized = task.status?.toLowerCase() || '';
  return normalized === 'done' || normalized === 'completed';
};

const hasExplicitTime = (date: Date): boolean =>
  !(date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0);

export const buildShellDaySnapshot = ({
  tasks,
  events,
  selectedDate
}: {
  tasks: ShellTaskSummary[];
  events: Event[];
  selectedDate: Date;
}): ShellDaySnapshot => {
  const dayStart = startOfLocalDay(selectedDate);
  const dayEnd = endOfLocalDay(selectedDate);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayEnd.getTime();

  const timed: ShellDayTaskEntry[] = [];
  const nested: ShellDayTaskEntry[] = [];
  const untimed: ShellDayTaskEntry[] = [];
  const carryForward: ShellDayTaskEntry[] = [];

  tasks.forEach((task) => {
    if (!task.scheduledAt || isTaskComplete(task)) {
      return;
    }

    const scheduledDate = new Date(task.scheduledAt);
    const scheduledMs = scheduledDate.getTime();
    if (!Number.isFinite(scheduledMs)) {
      return;
    }

    const baseEntry = {
      id: task.id,
      itemId: task.itemId,
      itemTitle: task.itemTitle,
      listId: task.listId,
      listName: task.listName,
      focalId: task.focalId,
      title: task.title,
      scheduledAt: task.scheduledAt,
      timeLabel: hasExplicitTime(scheduledDate) ? formatTimeLabel(scheduledDate) : null,
      blockId: null,
      blockTitle: null,
      sortTimeMs: scheduledMs
    };

    if (scheduledMs < dayStartMs) {
      carryForward.push({
        ...baseEntry,
        bucket: 'carry_forward'
      });
      return;
    }

    if (scheduledMs > dayEndMs) {
      return;
    }

    if (!hasExplicitTime(scheduledDate)) {
      untimed.push({
        ...baseEntry,
        bucket: 'untimed'
      });
      return;
    }

    const containingBlock =
      events.find((event) => {
        const startMs = new Date(event.start).getTime();
        const endMs = new Date(event.end).getTime();
        return scheduledMs >= startMs && scheduledMs < endMs;
      }) || null;

    if (containingBlock) {
      nested.push({
        ...baseEntry,
        bucket: 'nested',
        blockId: containingBlock.id,
        blockTitle: containingBlock.title
      });
      return;
    }

    timed.push({
      ...baseEntry,
      bucket: 'timed'
    });
  });

  return {
    timed: sortEntries(timed),
    nested: sortEntries(nested),
    untimed: sortEntries(untimed),
    carryForward: sortEntries(carryForward).reverse()
  };
};
