import WeekHeader from './WeekHeader';
import WeekGrid from './WeekGrid';
import type { EventTask } from '../../types/Event';

export interface CalendarEvent {
  id: string;
  sourceEventId?: string;
  title: string;
  start: Date | string;
  end: Date | string;
  tasks?: EventTask[];
  occurrenceItems?: Array<{
    id: string;
    title: string;
    completed: boolean;
    kind: 'task' | 'item';
    parentItemId?: string;
    parentItemTitle?: string;
  }>;
  color?: string;
  status?: string;
}

export interface HoursWindow {
  start: number;
  end: number;
}

interface WeekCalendarProps {
  startOfWeek: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onTimeRangeSelect?: (range: { date: Date; start: Date; end: Date }) => void;
  onEventResizeStart?: (payload?: {
    eventId: string;
    start: Date;
    end: Date;
    direction: 'start' | 'end';
    originalStart: Date;
    originalEnd: Date;
  }) => void;
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
  onEventAddItem?: (event: CalendarEvent) => void;
  onEventReorderTasks?: (eventId: string, fromIndex: number, toIndex: number) => void;
  onOccurrenceToggle?: (
    event: CalendarEvent,
    entry: {
      id: string;
      title: string;
      completed: boolean;
      kind: 'task' | 'item';
      parentItemId?: string;
      parentItemTitle?: string;
    },
    checked: boolean
  ) => void;
  onOccurrenceOpen?: (
    event: CalendarEvent,
    entry: {
      id: string;
      title: string;
      completed: boolean;
      kind: 'task' | 'item';
      parentItemId?: string;
      parentItemTitle?: string;
    }
  ) => void;
  hours?: HoursWindow;
  pixelsPerMinute?: number;
}

export default function WeekCalendar({
  startOfWeek,
  events,
  onEventClick,
  onTimeRangeSelect,
  onEventResizeStart,
  onEventResizePreview,
  onEventResizeEnd,
  onEventMovePreview,
  onEventMoveEnd,
  selectedEventId,
  onEventAddItem,
  onEventReorderTasks,
  onOccurrenceToggle,
  onOccurrenceOpen,
  hours = { start: 1, end: 23 },
  pixelsPerMinute = 1
}: WeekCalendarProps): JSX.Element {
  return (
    <section className="week-calendar" aria-label="Week calendar">
      <WeekHeader startOfWeek={startOfWeek} />
      <WeekGrid
        startOfWeek={startOfWeek}
        events={events}
        onEventClick={onEventClick}
        onTimeRangeSelect={onTimeRangeSelect}
        onEventResizeStart={onEventResizeStart}
        onEventResizePreview={onEventResizePreview}
        onEventResizeEnd={onEventResizeEnd}
        onEventMovePreview={onEventMovePreview}
        onEventMoveEnd={onEventMoveEnd}
        selectedEventId={selectedEventId}
        onEventAddItem={onEventAddItem}
        onEventReorderTasks={onEventReorderTasks}
        onOccurrenceToggle={onOccurrenceToggle}
        onOccurrenceOpen={onOccurrenceOpen}
        hours={hours}
        pixelsPerMinute={pixelsPerMinute}
      />
    </section>
  );
}
