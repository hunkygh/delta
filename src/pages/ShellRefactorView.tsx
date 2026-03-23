import { Navigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Event } from '../types/Event';
import { useAuth } from '../context/AuthContext';
import { calendarService } from '../services/calendarService';
import focalBoardService from '../services/focalBoardService';
import { hasRecurrenceExceededLimit, normalizeRecurrenceConfigForRule, shiftByRecurrence } from '../utils/recurrence.js';
import ShellLayout from '../components/shell/ShellLayout';
import type { ShellFocalSummary, ShellItemSummary, ShellListSummary, ShellTaskSummary } from '../components/shell/types';
import '../styles/shell.css';

export default function ShellRefactorView(): JSX.Element {
  const { user, loading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [focals, setFocals] = useState<ShellFocalSummary[]>([]);
  const [lists, setLists] = useState<ShellListSummary[]>([]);
  const [items, setItems] = useState<ShellItemSummary[]>([]);
  const [tasks, setTasks] = useState<ShellTaskSummary[]>([]);
  const [shellError, setShellError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const expandShellEvents = useCallback((sourceEvents: Event[]): Event[] => {
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 30);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date();
    rangeEnd.setDate(rangeEnd.getDate() + 365);
    rangeEnd.setHours(23, 59, 59, 999);

    const expanded: Event[] = [];

    sourceEvents.forEach((event) => {
      const recurrence = event.recurrence || 'none';
      const baseStart = new Date(event.start);
      const baseEnd = new Date(event.end);
      const durationMs = Math.max(1, baseEnd.getTime() - baseStart.getTime());

      if (recurrence === 'none') {
        expanded.push(event);
        return;
      }

      const recurrenceConfig = normalizeRecurrenceConfigForRule(recurrence, event.recurrenceConfig || undefined);
      let cursor = new Date(baseStart);
      let guard = 0;

      while (guard < 520) {
        if (hasRecurrenceExceededLimit(baseStart, cursor, recurrence, recurrenceConfig)) {
          break;
        }

        const occurrenceStart = new Date(cursor);
        const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
        if (occurrenceEnd >= rangeStart && occurrenceStart <= rangeEnd) {
          const startIso = occurrenceStart.toISOString();
          expanded.push({
            ...event,
            id: occurrenceStart.getTime() === baseStart.getTime() ? event.id : `${event.id}::${startIso}`,
            sourceEventId: event.id,
            occurrenceStartUtc: startIso,
            occurrenceEndUtc: occurrenceEnd.toISOString(),
            isOccurrenceInstance: occurrenceStart.getTime() !== baseStart.getTime(),
            start: startIso,
            end: occurrenceEnd.toISOString()
          });
        }

        cursor = shiftByRecurrence(cursor, recurrence, recurrenceConfig);
        guard += 1;
      }
    });

    return expanded.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, []);

  const mergeSavedEvent = useCallback((saved: Event) => {
    setEvents((prev) => {
      const exists = prev.some((entry) => entry.id === saved.id);
      const next = exists ? prev.map((entry) => (entry.id === saved.id ? saved : entry)) : [...prev, saved];
      return next.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    });
  }, []);

  const refreshShellData = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      setEvents([]);
      setFocals([]);
      setLists([]);
      setItems([]);
      setTasks([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setShellError(null);

    try {
      const [timeBlocks, focalRows, listRows] = await Promise.all([
        calendarService.getTimeBlocks(user.id),
        focalBoardService.getFocals(user.id),
        focalBoardService.getListsForUser(user.id)
      ]);

      const focalNameById = new Map<string, string>((focalRows || []).map((entry: any) => [entry.id, entry.name || 'Space']));
      const listCountByFocal = new Map<string, number>();
      for (const list of listRows || []) {
        if (!list?.focal_id) continue;
        listCountByFocal.set(list.focal_id, (listCountByFocal.get(list.focal_id) || 0) + 1);
      }

      const listDetails = await Promise.all(
        (listRows || []).map(async (entry: any) => {
          try {
            const detail = await focalBoardService.getListDetail(entry.id);
            return {
              list: entry,
              items: detail?.items || []
            };
          } catch {
            return {
              list: entry,
              items: []
            };
          }
        })
      );

      const nextItems: ShellItemSummary[] = [];
      const nextTasks: ShellTaskSummary[] = [];
      listDetails.forEach(({ list, items: listItems }) => {
        (listItems || []).forEach((item: any) => {
          nextItems.push({
            id: item.id,
            listId: list.id,
            listName: list.name || 'Untitled list',
            focalId: list.focal_id || null,
            title: item.title || 'Untitled item'
          });
          (item.actions || []).forEach((action: any) => {
            const statusKey = action.subtask_status_id || action.status || null;
            const normalizedStatus = typeof statusKey === 'string' ? statusKey.toLowerCase() : '';
            nextTasks.push({
              id: action.id,
              itemId: item.id,
              itemTitle: item.title || 'Untitled item',
              listId: list.id,
              listName: list.name || 'Untitled list',
              focalId: list.focal_id || null,
              title: action.title || 'Untitled task',
              scheduledAt: action.scheduled_at || null,
              status: action.status || action.subtask_status_id || null,
              isComplete: normalizedStatus === 'done' || normalizedStatus === 'completed'
            });
          });
        });
      });

      const enrichedTimeBlocks = await Promise.all(
        (timeBlocks || []).map(async (entry) => ({
          ...entry,
          sourceEventId: entry.id,
          occurrenceStartUtc: entry.start,
          occurrenceEndUtc: entry.end,
          isOccurrenceInstance: false,
          blockTasks: await calendarService.getBlockTasksWithItems({
            timeBlockId: entry.id,
            scheduledStartUtc: entry.start
          })
        }))
      );

      setEvents(enrichedTimeBlocks);
      setFocals(
        (focalRows || []).map((entry: any) => ({
          id: entry.id,
          name: entry.name || 'Untitled space',
          listCount: listCountByFocal.get(entry.id) || 0
        }))
      );
      setLists(
        (listRows || []).map((entry: any) => ({
          id: entry.id,
          focalId: entry.focal_id || null,
          focalName: focalNameById.get(entry.focal_id) || 'Space',
          name: entry.name || 'Untitled list'
        }))
      );
      setItems(nextItems);
      setTasks(nextTasks);
    } catch (error: any) {
      setShellError(error?.message || 'Failed to load shell data');
    } finally {
      setDataLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    const run = async (): Promise<void> => {
      await refreshShellData();
      if (!active) return;
    };
    void run();
    return () => {
      active = false;
    };
  }, [refreshShellData]);

  const handleSaveEvent = useCallback(
    async (event: Event): Promise<Event> => {
      if (!user?.id) {
        throw new Error('User is required');
      }

      const saved = await calendarService.upsertTimeBlock(user.id, event);
      try {
        await calendarService.syncTimeBlockLinks(user.id, saved.id, saved.tags || [], saved);
      } catch (error) {
        console.error('Failed to sync shell event links after save:', error);
      }
      mergeSavedEvent(saved);
      return saved;
    },
    [mergeSavedEvent, user?.id]
  );

  const handleCreateSpace = useCallback(
    async (name: string): Promise<void> => {
      if (!user?.id) throw new Error('User is required');
      const created = await focalBoardService.createFocal(user.id, name);
      setFocals((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name || name,
          listCount: 0
        }
      ]);
    },
    [user?.id]
  );

  const handleCreateList = useCallback(
    async (focalId: string, name: string): Promise<void> => {
      if (!user?.id) throw new Error('User is required');
      const created = await focalBoardService.createLane(focalId, user.id, name);
      const focalName = focals.find((entry) => entry.id === focalId)?.name || 'Space';
      setLists((prev) => [
        ...prev,
        {
          id: created.id,
          focalId: created.focal_id || focalId,
          focalName,
          name: created.name || name
        }
      ]);
      setFocals((prev) =>
        prev.map((entry) =>
          entry.id === focalId ? { ...entry, listCount: entry.listCount + 1 } : entry
        )
      );
    },
    [focals, user?.id]
  );

  useEffect(() => {
    document.documentElement.classList.add('shell-route-active');
    document.body.classList.add('shell-route-active');

    return () => {
      document.documentElement.classList.remove('shell-route-active');
      document.body.classList.remove('shell-route-active');
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const orderedEvents = useMemo(() => expandShellEvents(events), [events, expandShellEvents]);

  const currentBlock = useMemo(
    () =>
      orderedEvents.find((event) => {
        const start = new Date(event.start).getTime();
        const end = new Date(event.end).getTime();
        return start <= now && end >= now;
      }) || null,
    [now, orderedEvents]
  );

  const upcomingBlocks = useMemo(() => {
    const future = orderedEvents.filter((event) => new Date(event.end).getTime() > now);
    if (currentBlock) {
      return future.filter((event) => event.id !== currentBlock.id).slice(0, 3);
    }
    return future.slice(0, 3);
  }, [currentBlock, now, orderedEvents]);

  const nextBlock = upcomingBlocks[0] || null;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-screen-mark" aria-label="Delta loading">
          <img className="loading-screen-logo" src="/in-app-logo.png" alt="" aria-hidden="true" />
          <div className="loading-screen-wordmark">
            <span className="loading-screen-text">THE CLARITY OS</span>
            <span className="loading-screen-cursor" aria-hidden="true">
              _
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <section className="shell-refactor-page" aria-label="Delta shell refactor preview">
      <ShellLayout
        userId={user.id}
        sourceEvents={events}
        events={orderedEvents}
        currentBlock={currentBlock}
        nextBlock={nextBlock}
        upcomingBlocks={upcomingBlocks}
        focals={focals}
        lists={lists}
        items={items}
        tasks={tasks}
        loading={dataLoading}
        error={shellError}
        onSaveEvent={handleSaveEvent}
        onCreateSpace={handleCreateSpace}
        onCreateList={handleCreateList}
        onRefreshShellData={refreshShellData}
      />
    </section>
  );
}
