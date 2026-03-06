import { useEffect, useRef } from 'react';
import type { CalendarEvent, HoursWindow } from './WeekCalendar';
import TimeColumn from './TimeColumn';
import DayColumns from './DayColumns';
import { getMinutesFromStartOfDay, getStartMinute, getTotalVisibleMinutes } from './calendarUtils';

interface WeekGridProps {
  startOfWeek: Date;
  events: CalendarEvent[];
  hours: HoursWindow;
  pixelsPerMinute: number;
  onEventClick?: (event: CalendarEvent) => void;
  onTimeRangeSelect?: (range: { date: Date; start: Date; end: Date }) => void;
  onEventResizeStart?: () => void;
  onEventResizePreview?: (payload: {
    eventId: string;
    start: Date;
    end: Date;
    direction: 'start' | 'end';
    originalStart: Date;
    originalEnd: Date;
  }) => void;
  onEventResizeEnd?: (payload: {
    eventId: string;
    start: Date;
    end: Date;
    direction: 'start' | 'end';
    originalStart: Date;
    originalEnd: Date;
  }) => void;
  onEventMovePreview?: (payload: {
    eventId: string;
    start: Date;
    end: Date;
    originalStart: Date;
    originalEnd: Date;
  }) => void;
  onEventMoveEnd?: (payload: {
    eventId: string;
    start: Date;
    end: Date;
    originalStart: Date;
    originalEnd: Date;
  }) => void;
  selectedEventId?: string | null;
  onEventAddTask?: (eventId: string, title: string) => void;
  onEventReorderTasks?: (eventId: string, fromIndex: number, toIndex: number) => void;
}

export default function WeekGrid({
  startOfWeek,
  events,
  hours,
  pixelsPerMinute,
  onEventClick,
  onTimeRangeSelect,
  onEventResizeStart,
  onEventResizePreview,
  onEventResizeEnd,
  onEventMovePreview,
  onEventMoveEnd,
  selectedEventId,
  onEventAddTask,
  onEventReorderTasks
}: WeekGridProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didInitialAnchorRef = useRef(false);

  useEffect(() => {
    if (didInitialAnchorRef.current) {
      return;
    }
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const today = new Date();
    const weekEnd = new Date(startOfWeek);
    weekEnd.setDate(startOfWeek.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    if (today < startOfWeek || today > weekEnd) {
      didInitialAnchorRef.current = true;
      return;
    }

    const startMinute = getStartMinute(hours);
    const totalMinutes = getTotalVisibleMinutes(hours);
    const nowMinute = getMinutesFromStartOfDay(today);
    const minuteOffset = Math.max(0, Math.min(totalMinutes, nowMinute - startMinute));
    const nowY = minuteOffset * pixelsPerMinute;
    const oneHourOffset = 60 * pixelsPerMinute;
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const target = Math.max(0, Math.min(maxScrollTop, nowY - oneHourOffset));
    container.scrollTop = target;
    didInitialAnchorRef.current = true;
  }, [hours, pixelsPerMinute, startOfWeek]);

  return (
    <div ref={scrollRef} className="week-grid-scroll" aria-label="Week schedule grid">
      <div className="week-grid-inner">
        <TimeColumn hours={hours} pixelsPerMinute={pixelsPerMinute} />
        <DayColumns
          startOfWeek={startOfWeek}
          events={events}
          hours={hours}
          pixelsPerMinute={pixelsPerMinute}
          onEventClick={onEventClick}
          onTimeRangeSelect={onTimeRangeSelect}
          onEventResizeStart={onEventResizeStart}
          onEventResizePreview={onEventResizePreview}
          onEventResizeEnd={onEventResizeEnd}
          onEventMovePreview={onEventMovePreview}
          onEventMoveEnd={onEventMoveEnd}
          selectedEventId={selectedEventId}
          onEventAddTask={onEventAddTask}
          onEventReorderTasks={onEventReorderTasks}
        />
      </div>
    </div>
  );
}
