import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Calendar from '../components/Calendar';
import MobileCalendarWireframe from '../components/mobile/MobileCalendarWireframe';
import type { Event } from '../types/Event';
import { useAuth } from '../context/AuthContext';
import { calendarService } from '../services/calendarService';
import focalBoardService from '../services/focalBoardService';

export default function CalendarView(): JSX.Element {
  const { user } = useAuth();
  const location = useLocation();
  const [events, setEvents] = useState<Event[]>([]);
  const [attachTree, setAttachTree] = useState<any[]>([]);
  const [calendarDataError, setCalendarDataError] = useState<string | null>(null);
  const [isMobileWireframe, setIsMobileWireframe] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 900px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 900px)');
    const update = (): void => setIsMobileWireframe(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const loadCalendarData = useCallback(async () => {
    if (!user?.id) {
      setEvents([]);
      setAttachTree([]);
      setCalendarDataError(null);
      return;
    }
    let nextError: string | null = null;

    try {
      const dbEvents = await calendarService.getTimeBlocks(user.id);
      setEvents(dbEvents);
    } catch (error) {
      console.error('Failed to load calendar events:', error);
      nextError = 'Failed to load calendar events from the database.';
    }

    try {
      const tree = await calendarService.getLinkableFocalTree(user.id);
      setAttachTree(tree);
    } catch (error) {
      console.error('Failed to load calendar attach tree:', error);
      setAttachTree([]);
      if (!nextError) {
        nextError = 'Calendar loaded, but list linking is temporarily unavailable.';
      }
    }

    setCalendarDataError(nextError);
  }, [user?.id]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  useEffect(() => {
    if (!calendarDataError) return;
    const timer = window.setTimeout(() => setCalendarDataError(null), 3600);
    return () => window.clearTimeout(timer);
  }, [calendarDataError]);

  const handleSaveEvent = useCallback(
    async (event: Event) => {
      if (!user?.id) return;
      const saved = await calendarService.upsertTimeBlock(user.id, event);
      try {
        await calendarService.syncTimeBlockLinks(user.id, saved.id, saved.tags || [], saved);
      } catch (error) {
        console.error('Failed to sync event links after save:', error);
      }
      setEvents((prev) => {
        const exists = prev.some((entry) => entry.id === saved.id);
        if (exists) {
          return prev.map((entry) => (entry.id === saved.id ? saved : entry));
        }
        return [saved, ...prev];
      });

      // Re-sync from DB so UI state cannot drift if prior local state was stale.
      void loadCalendarData();

      return saved;
    },
    [loadCalendarData, user?.id]
  );

  const handleSaveEvents = useCallback(
    async (updatedEvents: Event[]) => {
      if (!user?.id || updatedEvents.length === 0) return;
      await Promise.all(
        updatedEvents.map(async (event) => {
          const saved = await calendarService.upsertTimeBlock(user.id, event);
          try {
            await calendarService.syncTimeBlockLinks(user.id, saved.id, saved.tags || [], saved);
          } catch (error) {
            console.error('Failed to sync event links after bulk save:', error);
          }
        })
      );
      await loadCalendarData();
    },
    [loadCalendarData, user?.id]
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      if (!user?.id) return;
      await calendarService.deleteTimeBlock(user.id, eventId);
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
    },
    [user?.id]
  );

  const handleOptimizeTimeBlock = useCallback(
    async (timeBlockId: string, prompt?: string) => {
      if (!timeBlockId) {
        return { source: 'heuristic', proposal: null };
      }
      return focalBoardService.getOptimizationProposal({
        scope: 'timeblock',
        scope_id: timeBlockId,
        user_prompt: prompt || undefined
      });
    },
    []
  );

  return (
    <section className="app-page calendar-page">
      {calendarDataError && (
        <div className="calendar-toast" role="status" aria-live="polite">
          {calendarDataError}
        </div>
      )}
      {isMobileWireframe ? (
        <MobileCalendarWireframe />
      ) : (
        <Calendar
          events={events}
          attachTree={attachTree}
          onSaveEvent={handleSaveEvent}
          onSaveEvents={handleSaveEvents}
          onDeleteEvent={handleDeleteEvent}
          onOptimizeTimeBlock={handleOptimizeTimeBlock}
          initialFocusEventId={location.state?.focusEventId || null}
        />
      )}
    </section>
  );
}
