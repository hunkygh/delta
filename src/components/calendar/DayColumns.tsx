import { useState } from 'react';
import type { CalendarEvent, HoursWindow } from './WeekCalendar';
import { addDays, isSameDay, normalizeToDate } from './calendarUtils';
import DayColumn from './DayColumn';

interface DayColumnsProps {
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

interface DragPreviewState {
  originDayIndex: number;
  dayOffset: number;
  top: number;
  height: number;
  label: string;
}

export default function DayColumns({
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
}: DayColumnsProps): JSX.Element {
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);
  const days = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek, index));

  return (
    <section className="week-day-columns" aria-label="Week day columns">
      {days.map((date, index) => {
        const dayEvents = events.filter((event) => {
          const start = normalizeToDate(event.start);
          return isSameDay(start, date);
        });

        return (
          <DayColumn
            key={date.toISOString()}
            date={date}
            dayIndex={index}
            maxForwardDays={6 - index}
            events={dayEvents}
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
            onDragPreviewChange={setDragPreview}
            externalDragPreview={dragPreview}
          />
        );
      })}
    </section>
  );
}
