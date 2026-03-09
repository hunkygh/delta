import { useState, useEffect } from 'react';
import type { DragEvent as ReactDragEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { CalendarEvent } from './WeekCalendar';
import { formatTimeRange } from './calendarUtils';

interface EventCardProps {
  event: CalendarEvent;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  isActive?: boolean;
  isOpen?: boolean;
  onClick?: () => void;
  onAddTask?: (title: string) => void;
  onReorderTasks?: (fromIndex: number, toIndex: number) => void;
  onResizeHandleMouseDown?: (
    direction: 'start' | 'end',
    event: ReactMouseEvent<HTMLElement>
  ) => void;
  onMoveMouseDown?: (event: ReactMouseEvent<HTMLElement>) => void;
}

export default function EventCard({
  event,
  top,
  height,
  leftPct,
  widthPct,
  isActive = false,
  isOpen = false,
  onClick,
  onAddTask,
  onReorderTasks,
  onResizeHandleMouseDown,
  onMoveMouseDown
}: EventCardProps): JSX.Element {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [draftTaskTitle, setDraftTaskTitle] = useState('');
  const [dragTaskIndex, setDragTaskIndex] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const tasks = event.tasks ?? [];
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
    isActive ? 'active' : '',
    isOpen ? 'open' : '',
    isCompact ? 'compact' : '',
    isTiny ? 'tiny' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const submitTask = (): void => {
    const value = draftTaskTitle.trim();
    if (!value) {
      return;
    }
    onAddTask?.(value);
    setDraftTaskTitle('');
    setIsAddingTask(false);
  };

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

      {!isTiny && !isOpen && tasks.length > 0 && (
        <div className="week-event-task-preview" onClick={(eventMouse) => eventMouse.stopPropagation()}>
          {tasks.slice(0, 2).map((task) => (
            <span key={task.id} className={task.completed ? 'completed' : ''}>
              {task.title}
            </span>
          ))}
          {tasks.length > 2 && <span className="more">+{tasks.length - 2}</span>}
        </div>
      )}

      {!isCompact && isOpen && (
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

          {isAddingTask ? (
            <input
              className="week-event-task-input"
              value={draftTaskTitle}
              placeholder="What needs to get done?"
              onChange={(eventInput) => setDraftTaskTitle(eventInput.target.value)}
              onKeyDown={(eventKey) => {
                if (eventKey.key === 'Enter') {
                  eventKey.preventDefault();
                  submitTask();
                }
              }}
              onBlur={submitTask}
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="week-event-task-add"
              onClick={() => setIsAddingTask(true)}
            >
              + Add Task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
