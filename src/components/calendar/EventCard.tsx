import { useState, useEffect } from 'react';
import type { DragEvent as ReactDragEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { CalendarEvent, CalendarViewMode } from './WeekCalendar';
import { formatTimeRange } from './calendarUtils';

interface EventCardProps {
  event: CalendarEvent;
  viewMode?: CalendarViewMode;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  isActive?: boolean;
  isOpen?: boolean;
  isCurrentTimeBlock?: boolean;
  onClick?: () => void;
  onAddItem?: () => void;
  onReorderTasks?: (fromIndex: number, toIndex: number) => void;
  onOccurrenceToggle?: (
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
  onOccurrenceOpen?: (entry: {
    id: string;
    title: string;
    completed: boolean;
    kind: 'task' | 'item';
    parentItemId?: string;
    parentItemTitle?: string;
  }) => void;
  onResizeHandleMouseDown?: (
    direction: 'start' | 'end',
    event: ReactMouseEvent<HTMLElement>
  ) => void;
  onMoveMouseDown?: (event: ReactMouseEvent<HTMLElement>) => void;
}

export default function EventCard({
  event,
  viewMode = 'week',
  top,
  height,
  leftPct,
  widthPct,
  isActive = false,
  isOpen = false,
  isCurrentTimeBlock = false,
  onClick,
  onAddItem,
  onReorderTasks,
  onOccurrenceToggle,
  onOccurrenceOpen,
  onResizeHandleMouseDown,
  onMoveMouseDown
}: EventCardProps): JSX.Element {
  const [dragTaskIndex, setDragTaskIndex] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const tasks = event.tasks ?? [];
  const occurrenceItems = event.occurrenceItems ?? [];
  const blockTasks = event.blockTasks ?? [];
  const isCompact = height <= 46;
  const isTiny = height <= 18;

  // Reset resizing state when resize operation ends
  useEffect(() => {
    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
      }
    };

    if (isResizing) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isResizing]);
  const cardClassName = [
    'week-event-card',
    viewMode === 'day' ? 'day-mode' : 'week-mode',
    isActive ? 'active' : '',
    isOpen ? 'open' : '',
    isCurrentTimeBlock ? 'current-time-block' : '',
    isCompact ? 'compact' : '',
    isTiny ? 'tiny' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const nestedBlockTaskItemIds = new Set(blockTasks.flatMap((task) => task.linkedItems.map((linked) => linked.itemId)));
  const interactiveRows =
    occurrenceItems.length > 0
      ? occurrenceItems.filter((entry) => entry.kind !== 'item' || !nestedBlockTaskItemIds.has(entry.id))
      : tasks
          .map((task) => ({ ...task, kind: 'item' as const }))
          .filter((entry) => !nestedBlockTaskItemIds.has(entry.id));
  const previewLimit = Math.max(1, Math.floor((Math.max(height, isOpen ? 66 : 54) - (isOpen ? 44 : 26)) / 22));
  const showBlockTaskHeaders = previewLimit > 3;
  const blockTaskPreviewRows = blockTasks.flatMap((task) => [
    ...(showBlockTaskHeaders ? [{ type: 'block-task' as const, id: task.id, title: task.title }] : []),
    ...task.linkedItems.map((linked) => ({
      type: 'block-task-item' as const,
      id: linked.blockTaskItemId,
      itemId: linked.itemId,
      title: linked.title,
      completed: Boolean(linked.completedInContext)
    }))
  ]);
  const previewRows = [...blockTaskPreviewRows, ...interactiveRows.map((row) => ({ type: 'occurrence' as const, row }))];
  const visibleRows = previewRows.slice(0, previewLimit);
  const hiddenCount = Math.max(0, previewRows.length - visibleRows.length);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cardClassName}
      style={{
        top: `${top + 1}px`,
        height: `${Math.max(8, height - 2)}px`,
        left: `calc(${leftPct}% + 4px)`,
        width: `calc(${widthPct}% - 8px)`
      }}
      onClick={() => {
        // Don't open drawer if we're resizing
        if (!isResizing) {
          onClick?.();
        }
      }}
      onKeyDown={(eventKey: KeyboardEvent<HTMLDivElement>) => {
        if (eventKey.key === 'Enter' || eventKey.key === ' ') {
          eventKey.preventDefault();
          onClick?.();
        }
      }}
      onMouseDown={(eventMouse) => {
        eventMouse.stopPropagation();
        const target = eventMouse.target as HTMLElement;
        if (
          target.closest(
            '.week-event-resize-handle, .week-event-task-add, .week-event-task-input, .week-event-task-item, input, button, textarea, select, label'
          )
        ) {
          return;
        }
        onMoveMouseDown?.(eventMouse);
      }}
      title={event.title}
    >
      <span
        className="week-event-resize-handle top"
        onMouseDown={(eventMouse) => {
          eventMouse.stopPropagation();
          setIsResizing(true);
          onResizeHandleMouseDown?.('start', eventMouse);
        }}
      />
      <span
        className="week-event-resize-handle bottom"
        onMouseDown={(eventMouse) => {
          eventMouse.stopPropagation();
          setIsResizing(true);
          onResizeHandleMouseDown?.('end', eventMouse);
        }}
      />

      <span className="week-event-card-title">{event.title}</span>
      <span className="week-event-card-time">{formatTimeRange(event.start, event.end)}</span>

      {!isTiny && previewRows.length > 0 && (
        <div className="week-event-task-preview" onClick={(eventMouse) => eventMouse.stopPropagation()}>
          {visibleRows.map((entry) => {
            if (entry.type === 'block-task') {
              return (
                <div key={`block-task:${entry.id}`} className="week-event-block-task-row">
                  <span className="week-event-block-task-pill">{entry.title}</span>
                </div>
              );
            }

            if (entry.type === 'block-task-item') {
              return (
                <div key={`block-task-item:${entry.id}`} className={`week-event-task-row nested ${entry.completed ? 'completed' : ''}`.trim()}>
                  <span className={`week-event-task-bullet ${entry.completed ? 'done' : ''}`.trim()} aria-hidden="true" />
                  <button
                    type="button"
                    className="week-event-task-link nested"
                    onClick={(eventMouse) => {
                      eventMouse.stopPropagation();
                      onOccurrenceOpen?.({
                        id: entry.itemId,
                        title: entry.title,
                        completed: entry.completed,
                        kind: 'item'
                      });
                    }}
                  >
                    {entry.title}
                  </button>
                </div>
              );
            }

            const occurrenceEntry = entry.row;
            return (
              <div key={`${occurrenceEntry.kind}:${occurrenceEntry.id}`} className={`week-event-task-row ${occurrenceEntry.completed ? 'completed' : ''}`.trim()}>
                <input
                  type="checkbox"
                  checked={occurrenceEntry.completed}
                  onChange={(eventChange) => onOccurrenceToggle?.(occurrenceEntry, eventChange.target.checked)}
                  onClick={(eventMouse) => eventMouse.stopPropagation()}
                />
                <button
                  type="button"
                  className="week-event-task-link"
                  onClick={(eventMouse) => {
                    eventMouse.stopPropagation();
                    onOccurrenceOpen?.(occurrenceEntry);
                  }}
                >
                  {occurrenceEntry.title}
                </button>
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              className="week-event-more"
              onClick={(eventMouse) => {
                eventMouse.stopPropagation();
                onClick?.();
              }}
            >
              {hiddenCount} more ↗
            </button>
          )}
        </div>
      )}

      {!isCompact && isOpen && tasks.length > 0 && occurrenceItems.length === 0 && (
        <div className="week-event-tasks" onClick={(eventMouse) => eventMouse.stopPropagation()}>
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className="week-event-task-item"
              draggable
              onDragStart={() => setDragTaskIndex(index)}
              onDragOver={(eventDrag: ReactDragEvent<HTMLDivElement>) => eventDrag.preventDefault()}
              onDrop={() => {
                if (dragTaskIndex === null || dragTaskIndex === index) {
                  return;
                }
                onReorderTasks?.(dragTaskIndex, index);
                setDragTaskIndex(null);
              }}
            >
              {task.title}
            </div>
          ))}
        </div>
      )}

      {!isTiny && (occurrenceItems.length > 0 || blockTasks.length > 0) && (
        <button
          type="button"
          className="week-event-task-add"
          onClick={(eventMouse) => {
            eventMouse.stopPropagation();
            onAddItem?.();
          }}
        >
          + Add item
        </button>
      )}
    </div>
  );
}
