import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CalendarEvent, HoursWindow } from './WeekCalendar';
import {
  clamp,
  dayDateAtMinutes,
  dayKey,
  getEndMinute,
  getMinutesFromStartOfDay,
  getStartMinute,
  getTotalVisibleMinutes,
  normalizeToDate,
  roundMinutesTo15
} from './calendarUtils';
import EventCard from './EventCard';
import NowIndicator from './NowIndicator';

interface DayColumnProps {
  date: Date;
  dayIndex: number;
  maxForwardDays: number;
  events: CalendarEvent[];
  hours: HoursWindow;
  pixelsPerMinute: number;
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
  onEventAddTask?: (eventId: string, title: string) => void;
  onEventReorderTasks?: (eventId: string, fromIndex: number, toIndex: number) => void;
  onDragPreviewChange?: (payload: {
    originDayIndex: number;
    dayOffset: number;
    top: number;
    height: number;
    label: string;
  } | null) => void;
  externalDragPreview?: {
    originDayIndex: number;
    dayOffset: number;
    top: number;
    height: number;
    label: string;
  } | null;
}

export default function DayColumn({
  date,
  dayIndex,
  maxForwardDays,
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
  onEventReorderTasks,
  onDragPreviewChange,
  externalDragPreview
}: DayColumnProps): JSX.Element {
  const [dragMinutes, setDragMinutes] = useState<{
    start: number;
    end: number;
    dayOffset: number;
    startDayIndex: number;
    startColumnLeft: number;
    columnWidth: number;
    columnTop: number;
    columnHeight: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPointerId, setDragPointerId] = useState<number | null>(null);
  const [resizeDraft, setResizeDraft] = useState<{
    eventId: string;
    direction: 'start' | 'end';
    startY: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);
  const [moveDraft, setMoveDraft] = useState<{
    eventId: string;
    startX: number;
    startY: number;
    startDayIndex: number;
    columnWidth: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);
  const [suppressNextEventClick, setSuppressNextEventClick] = useState(false);
  const moveDragDetectedRef = useRef(false);
  const resizeDragDetectedRef = useRef(false);

  const startMinute = getStartMinute(hours);
  const endMinute = getEndMinute(hours);
  const totalMinutes = getTotalVisibleMinutes(hours);
  const columnHeight = totalMinutes * pixelsPerMinute;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('.week-event-card')) {
      return;
    }
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = pointerToVisibleMinutes(event.clientY, {
      top: rect.top,
      height: rect.height,
      startMinute,
      endMinute
    });

    setIsDragging(true);
    setDragPointerId(event.pointerId);
    setDragMinutes({
      start: minutes,
      end: minutes,
      dayOffset: 0,
      startDayIndex: dayIndex,
      startColumnLeft: rect.left,
      columnWidth: rect.width,
      columnTop: rect.top,
      columnHeight: rect.height
    });
  };

  useEffect(() => {
    if (!isDragging || !dragMinutes) {
      return;
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (dragPointerId !== null && event.pointerId !== dragPointerId) {
        return;
      }
      const minValue = Math.min(dragMinutes.start, dragMinutes.end);
      const maxValue = Math.max(dragMinutes.start, dragMinutes.end);
      const dayOffset = dragMinutes.dayOffset;

      setIsDragging(false);
      setDragPointerId(null);
      setDragMinutes(null);

      if (!onTimeRangeSelect) {
        return;
      }
      if (maxValue === minValue && dayOffset === 0) {
        return;
      }
      const finalEnd = maxValue === minValue ? minValue + 15 : maxValue;
      const endDate = addDays(date, dayOffset);

      onTimeRangeSelect({
        date,
        start: dayDateAtMinutes(date, minValue),
        end: dayDateAtMinutes(endDate, finalEnd)
      });
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (dragPointerId !== null && event.pointerId !== dragPointerId) {
        return;
      }
      setDragMinutes((prev) => {
        if (!prev) {
          return prev;
        }
        const minutes = pointerToVisibleMinutes(event.clientY, {
          top: prev.columnTop,
          height: prev.columnHeight,
          startMinute,
          endMinute
        });
        const hit = document.elementFromPoint(event.clientX, event.clientY);
        const hitColumn = hit?.closest?.('.week-day-column') as HTMLElement | null;
        const hitDayIndexRaw = hitColumn?.dataset?.dayIndex;
        const hitDayIndex = hitDayIndexRaw ? Number.parseInt(hitDayIndexRaw, 10) : Number.NaN;
        const deltaByColumn = Math.floor(
          (event.clientX - prev.startColumnLeft) / Math.max(1, prev.columnWidth)
        );
        const deltaFromHit = Number.isNaN(hitDayIndex) ? deltaByColumn : hitDayIndex - prev.startDayIndex;
        const dayOffset = clamp(Math.max(deltaByColumn, deltaFromHit), 0, maxForwardDays);

        return {
          ...prev,
          end: minutes,
          dayOffset
        };
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [date, dragMinutes, dragPointerId, endMinute, isDragging, maxForwardDays, onTimeRangeSelect, startMinute]);

  useEffect(() => {
    if (!resizeDraft) {
      return;
    }

    const dayStartMs = new Date(
      resizeDraft.originalStart.getFullYear(),
      resizeDraft.originalStart.getMonth(),
      resizeDraft.originalStart.getDate(),
      0,
      0,
      0,
      0
    ).getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

    const onMouseMove = (event: MouseEvent): void => {
      const minuteDelta = roundMinutesTo15((event.clientY - resizeDraft.startY) / pixelsPerMinute);
      if (minuteDelta !== 0) {
        resizeDragDetectedRef.current = true;
      }
      let nextStart = new Date(resizeDraft.originalStart);
      let nextEnd = new Date(resizeDraft.originalEnd);

      if (resizeDraft.direction === 'start') {
        nextStart = new Date(resizeDraft.originalStart.getTime() + minuteDelta * 60000);
        if (nextStart >= nextEnd) {
          nextStart = new Date(nextEnd.getTime() - 15 * 60000);
        }
        if (nextStart.getTime() < dayStartMs) {
          nextStart = new Date(dayStartMs);
        }
      } else {
        nextEnd = new Date(resizeDraft.originalEnd.getTime() + minuteDelta * 60000);
        if (nextEnd <= nextStart) {
          nextEnd = new Date(nextStart.getTime() + 15 * 60000);
        }
        if (nextEnd.getTime() > dayEndMs) {
          nextEnd = new Date(dayEndMs);
        }
      }

      onEventResizePreview?.({
        eventId: resizeDraft.eventId,
        start: nextStart,
        end: nextEnd,
        direction: resizeDraft.direction,
        originalStart: resizeDraft.originalStart,
        originalEnd: resizeDraft.originalEnd
      });
    };

    const onMouseUp = (event: MouseEvent): void => {
      const minuteDelta = roundMinutesTo15((event.clientY - resizeDraft.startY) / pixelsPerMinute);
      let finalStart = new Date(resizeDraft.originalStart);
      let finalEnd = new Date(resizeDraft.originalEnd);

      if (resizeDraft.direction === 'start') {
        finalStart = new Date(resizeDraft.originalStart.getTime() + minuteDelta * 60000);
        if (finalStart >= finalEnd) {
          finalStart = new Date(finalEnd.getTime() - 15 * 60000);
        }
        if (finalStart.getTime() < dayStartMs) {
          finalStart = new Date(dayStartMs);
        }
      } else {
        finalEnd = new Date(resizeDraft.originalEnd.getTime() + minuteDelta * 60000);
        if (finalEnd <= finalStart) {
          finalEnd = new Date(finalStart.getTime() + 15 * 60000);
        }
        if (finalEnd.getTime() > dayEndMs) {
          finalEnd = new Date(dayEndMs);
        }
      }

      onEventResizeEnd?.({
        eventId: resizeDraft.eventId,
        start: finalStart,
        end: finalEnd,
        direction: resizeDraft.direction,
        originalStart: resizeDraft.originalStart,
        originalEnd: resizeDraft.originalEnd
      });
      if (resizeDragDetectedRef.current) {
        setSuppressNextEventClick(true);
        window.setTimeout(() => setSuppressNextEventClick(false), 250);
      }
      setResizeDraft(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onEventResizeEnd, onEventResizePreview, pixelsPerMinute, resizeDraft]);

  useEffect(() => {
    if (!moveDraft) {
      return;
    }

    const durationMs = Math.max(15 * 60 * 1000, moveDraft.originalEnd.getTime() - moveDraft.originalStart.getTime());
    const durationMinutes = Math.round(durationMs / 60000);
    const originalStartMinute = getMinutesFromStartOfDay(moveDraft.originalStart);

    const onMouseMove = (event: MouseEvent): void => {
      if (
        !moveDragDetectedRef.current &&
        (Math.abs(event.clientX - moveDraft.startX) >= 4 || Math.abs(event.clientY - moveDraft.startY) >= 4)
      ) {
        moveDragDetectedRef.current = true;
      }

      const minuteDelta = roundMinutesTo15((event.clientY - moveDraft.startY) / pixelsPerMinute);
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const hitColumn = hit?.closest?.('.week-day-column') as HTMLElement | null;
      const hitDayIndexRaw = hitColumn?.dataset?.dayIndex;
      const hitDayIndex = hitDayIndexRaw ? Number.parseInt(hitDayIndexRaw, 10) : Number.NaN;
      const deltaByColumn = Math.round((event.clientX - moveDraft.startX) / Math.max(1, moveDraft.columnWidth));
      const dayDelta = Number.isNaN(hitDayIndex) ? deltaByColumn : hitDayIndex - moveDraft.startDayIndex;
      const clampedDayDelta = clamp(dayDelta, -moveDraft.startDayIndex, 6 - moveDraft.startDayIndex);

      const shiftedDate = addDays(moveDraft.originalStart, clampedDayDelta);
      const boundedStartMinute = clamp(originalStartMinute + minuteDelta, 0, 24 * 60 - durationMinutes);
      const nextStart = dayDateAtMinutes(shiftedDate, boundedStartMinute);
      const nextEnd = new Date(nextStart.getTime() + durationMs);

      onEventMovePreview?.({
        eventId: moveDraft.eventId,
        start: nextStart,
        end: nextEnd,
        originalStart: moveDraft.originalStart,
        originalEnd: moveDraft.originalEnd
      });
    };

    const onMouseUp = (event: MouseEvent): void => {
      const minuteDelta = roundMinutesTo15((event.clientY - moveDraft.startY) / pixelsPerMinute);
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const hitColumn = hit?.closest?.('.week-day-column') as HTMLElement | null;
      const hitDayIndexRaw = hitColumn?.dataset?.dayIndex;
      const hitDayIndex = hitDayIndexRaw ? Number.parseInt(hitDayIndexRaw, 10) : Number.NaN;
      const deltaByColumn = Math.round((event.clientX - moveDraft.startX) / Math.max(1, moveDraft.columnWidth));
      const dayDelta = Number.isNaN(hitDayIndex) ? deltaByColumn : hitDayIndex - moveDraft.startDayIndex;
      const clampedDayDelta = clamp(dayDelta, -moveDraft.startDayIndex, 6 - moveDraft.startDayIndex);

      const shiftedDate = addDays(moveDraft.originalStart, clampedDayDelta);
      const boundedStartMinute = clamp(originalStartMinute + minuteDelta, 0, 24 * 60 - durationMinutes);
      const finalStart = dayDateAtMinutes(shiftedDate, boundedStartMinute);
      const finalEnd = new Date(finalStart.getTime() + durationMs);

      onEventMoveEnd?.({
        eventId: moveDraft.eventId,
        start: finalStart,
        end: finalEnd,
        originalStart: moveDraft.originalStart,
        originalEnd: moveDraft.originalEnd
      });
      if (moveDragDetectedRef.current) {
        setSuppressNextEventClick(true);
        window.setTimeout(() => setSuppressNextEventClick(false), 250);
      }
      setMoveDraft(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [moveDraft, onEventMoveEnd, onEventMovePreview, pixelsPerMinute]);

  const dragTop = dragMinutes
    ? (Math.min(dragMinutes.start, dragMinutes.end) - startMinute) * pixelsPerMinute
    : 0;
  const dragHeight = dragMinutes
    ? Math.max(15 * pixelsPerMinute, Math.abs(dragMinutes.end - dragMinutes.start) * pixelsPerMinute)
    : 0;
  const dragStartMinute = dragMinutes ? Math.min(dragMinutes.start, dragMinutes.end) : 0;
  const dragEndMinute = dragMinutes ? Math.max(dragMinutes.start, dragMinutes.end) : 0;
  const dragIsCompact = dragEndMinute - dragStartMinute <= 15;
  const dragDayOffset = dragMinutes?.dayOffset ?? 0;
  const dragLabel = `${formatMinuteLabel(dragStartMinute)} - ${formatMinuteLabel(
    dragEndMinute || dragStartMinute + 15
  )}`;

  useEffect(() => {
    if (!dragMinutes) {
      if (externalDragPreview?.originDayIndex === dayIndex) {
        onDragPreviewChange?.(null);
      }
      return;
    }

    onDragPreviewChange?.({
      originDayIndex: dayIndex,
      dayOffset: dragDayOffset,
      top: dragTop,
      height: dragHeight,
      label: dragLabel
    });
  }, [dayIndex, dragDayOffset, dragHeight, dragLabel, dragMinutes, dragTop, onDragPreviewChange]);

  const hourLines = Array.from({ length: hours.end - hours.start + 2 }, (_, idx) => idx * 60);
  const halfHourLines = Array.from({ length: hours.end - hours.start + 1 }, (_, idx) => idx * 60 + 30);
  const eventLayouts = buildEventLayouts(events, {
    startMinute,
    endMinute,
    pixelsPerMinute
  });
  const todayKey = dayKey(new Date());
  const isTodayColumn = dayKey(date) === todayKey;
  const hintTop = (9 * 60 - startMinute) * pixelsPerMinute;

  return (
    <div
      className="week-day-column"
      data-day={dayKey(date)}
      data-day-index={dayIndex}
      style={{ height: `${columnHeight}px` }}
      onPointerDown={onPointerDown}
    >
      <div className="week-column-lines" aria-hidden="true">
        {hourLines.map((offset) => (
          <span key={`h-${offset}`} className="week-hour-line" style={{ top: `${offset * pixelsPerMinute}px` }} />
        ))}
        {halfHourLines.map((offset) => (
          <span
            key={`hh-${offset}`}
            className="week-half-hour-line"
            style={{ top: `${offset * pixelsPerMinute}px` }}
          />
        ))}
      </div>

      <div className="week-column-events">
        {eventLayouts.map((layout) => {
          return (
            <EventCard
              key={layout.event.id}
              event={layout.event}
              top={layout.top}
              height={layout.height}
              leftPct={layout.leftPct}
              widthPct={layout.widthPct}
              isActive={(layout.event.sourceEventId ?? layout.event.id) === resizeDraft?.eventId}
              isOpen={selectedEventId === (layout.event.sourceEventId ?? layout.event.id)}
              onClick={() => {
                if (suppressNextEventClick) {
                  setSuppressNextEventClick(false);
                  return;
                }
                onEventClick?.(layout.event);
              }}
              onAddTask={(title) => onEventAddTask?.(layout.event.sourceEventId ?? layout.event.id, title)}
              onReorderTasks={(fromIndex, toIndex) =>
                onEventReorderTasks?.(layout.event.sourceEventId ?? layout.event.id, fromIndex, toIndex)
              }
              onResizeHandleMouseDown={(direction, event) => {
                resizeDragDetectedRef.current = false;
                const originalStart = normalizeToDate(layout.event.start);
                const originalEnd = normalizeToDate(layout.event.end);
                onEventResizeStart?.({
                  eventId: layout.event.sourceEventId ?? layout.event.id,
                  start: originalStart,
                  end: originalEnd,
                  direction,
                  originalStart,
                  originalEnd
                });
                setResizeDraft({
                  eventId: layout.event.sourceEventId ?? layout.event.id,
                  direction,
                  startY: event.clientY,
                  originalStart,
                  originalEnd
                });
              }}
              onMoveMouseDown={(event) => {
                moveDragDetectedRef.current = false;
                const rect = event.currentTarget.getBoundingClientRect();
                setMoveDraft({
                  eventId: layout.event.sourceEventId ?? layout.event.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  startDayIndex: dayIndex,
                  columnWidth: rect.width,
                  originalStart: normalizeToDate(layout.event.start),
                  originalEnd: normalizeToDate(layout.event.end)
                });
              }}
            />
          );
        })}
      </div>

      {dragMinutes && (
        <div
          className={`week-drag-preview ${dragIsCompact ? 'compact' : ''}`.trim()}
          style={{ top: `${dragTop}px`, height: `${dragHeight}px` }}
        >
          <span className="week-drag-preview-time">{dragLabel}</span>
        </div>
      )}

      {externalDragPreview &&
        dayIndex > externalDragPreview.originDayIndex &&
        dayIndex <= externalDragPreview.originDayIndex + externalDragPreview.dayOffset && (
          <div
            className="week-drag-preview ghost"
            style={{ top: `${externalDragPreview.top}px`, height: `${externalDragPreview.height}px` }}
          >
            <span className="week-drag-preview-time">{externalDragPreview.label}</span>
          </div>
        )}

      {isTodayColumn && events.length === 0 && !externalDragPreview && !dragMinutes && (
        <div className="week-empty-hint" style={{ top: `${Math.max(8, hintTop)}px` }}>
          Drag to create a time block
        </div>
      )}

      <NowIndicator date={date} hours={hours} pixelsPerMinute={pixelsPerMinute} />
    </div>
  );
}

function pointerToVisibleMinutes(
  clientY: number,
  bounds: { top: number; height: number; startMinute: number; endMinute: number }
): number {
  const relativeY = clamp(clientY - bounds.top, 0, bounds.height);
  const ratio = bounds.height === 0 ? 0 : relativeY / bounds.height;
  const absoluteMinutes = bounds.startMinute + ratio * (bounds.endMinute - bounds.startMinute);
  return clamp(roundMinutesTo15(absoluteMinutes), bounds.startMinute, bounds.endMinute);
}

function addDays(date: Date, count: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function formatMinuteLabel(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'pm' : 'am';
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hour12}:${String(mins).padStart(2, '0')} ${period}`;
}

interface EventLayout {
  event: CalendarEvent;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
}

function buildEventLayouts(
  events: CalendarEvent[],
  bounds: { startMinute: number; endMinute: number; pixelsPerMinute: number }
): EventLayout[] {
  const EVENT_VERTICAL_GAP_PX = 2;
  const processed = events
    .map((event) => {
      const start = normalizeToDate(event.start);
      const end = normalizeToDate(event.end);
      const rawStart = getMinutesFromStartOfDay(start);
      const rawEnd = getMinutesFromStartOfDay(end);
      const startMin = clamp(rawStart, bounds.startMinute, bounds.endMinute);
      const endMin = clamp(rawEnd, bounds.startMinute, bounds.endMinute);

      return {
        event,
        startMin,
        endMin: endMin <= startMin ? startMin + 15 : endMin
      };
    })
    .filter((item) => item.endMin > bounds.startMinute && item.startMin < bounds.endMinute)
    .sort((a, b) => (a.startMin === b.startMin ? a.endMin - b.endMin : a.startMin - b.startMin));

  type Provisional = {
    event: CalendarEvent;
    startMin: number;
    endMin: number;
    laneIndex: number;
    laneCount: number;
  };

  const output: Provisional[] = [];
  const active: Array<{ endMin: number; laneIndex: number; outputIndex: number }> = [];
  let clusterIndices: number[] = [];
  let clusterLaneCount = 0;

  const closeCluster = (): void => {
    if (clusterIndices.length === 0) {
      return;
    }
    for (const index of clusterIndices) {
      output[index].laneCount = clusterLaneCount;
    }
    clusterIndices = [];
    clusterLaneCount = 0;
  };

  for (const item of processed) {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i].endMin <= item.startMin) {
        active.splice(i, 1);
      }
    }

    if (active.length === 0) {
      closeCluster();
    }

    const usedLanes = new Set(active.map((entry) => entry.laneIndex));
    let laneIndex = 0;
    while (usedLanes.has(laneIndex)) {
      laneIndex += 1;
    }

    const outputIndex = output.push({
      event: item.event,
      startMin: item.startMin,
      endMin: item.endMin,
      laneIndex,
      laneCount: 1
    }) - 1;

    active.push({ endMin: item.endMin, laneIndex, outputIndex });
    clusterIndices.push(outputIndex);
    clusterLaneCount = Math.max(clusterLaneCount, laneIndex + 1);
  }

  closeCluster();

  return output.map((item) => {
    const durationMinutes = Math.max(15, item.endMin - item.startMin);
    const rawTop = (item.startMin - bounds.startMinute) * bounds.pixelsPerMinute;
    const rawHeight = durationMinutes * bounds.pixelsPerMinute;
    const top = rawTop + EVENT_VERTICAL_GAP_PX / 2;
    const height = Math.max(12, rawHeight - EVENT_VERTICAL_GAP_PX);
    const widthPct = 100 / item.laneCount;
    const leftPct = item.laneIndex * widthPct;

    return {
      event: item.event,
      top,
      height,
      leftPct,
      widthPct
    };
  });
}
