import { CommentAdd } from 'clicons-react';
import type { Event } from '../../types/Event';
import CurrentBlockWorkspace from './CurrentBlockWorkspace';

interface ShellCenterProps {
  primaryBlock: Event | null;
  nextBlock: Event | null;
  visibleBlocks: Event[];
  selectedDate: Date;
  loading: boolean;
  error: string | null;
  onSelectEvent: (event: Event) => void;
  onOpenAiThread: (event: Event) => void;
  onStartCurrentBlock: () => Promise<void>;
  onDescribeCurrentBlock: (input: string) => Promise<void>;
  onPlanFutureDay: (input: string) => Promise<void>;
  onOpenCreateComposer: () => void;
}

const formatRange = (startIso: string, endIso: string): string => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const format = (value: Date) =>
    value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  return `${format(start)} - ${format(end)}`;
};

export default function ShellCenter({
  primaryBlock,
  nextBlock,
  visibleBlocks,
  selectedDate,
  loading,
  error,
  onSelectEvent,
  onOpenAiThread,
  onStartCurrentBlock,
  onDescribeCurrentBlock,
  onPlanFutureDay,
  onOpenCreateComposer
}: ShellCenterProps): JSX.Element {
  const selectedDateLabel = selectedDate.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  return (
    <main className="shell-center">
      <CurrentBlockWorkspace
        primaryBlock={primaryBlock}
        nextBlock={nextBlock}
        selectedDate={selectedDate}
        selectedDateEvents={visibleBlocks}
        loading={loading}
        error={error}
        onStartCurrentBlock={onStartCurrentBlock}
        onDescribeCurrentBlock={onDescribeCurrentBlock}
        onPlanFutureDay={onPlanFutureDay}
        onOpenCreateComposer={onOpenCreateComposer}
        onOpenAiThread={onOpenAiThread}
      />
      <div className="shell-upcoming-stack" aria-label={`${selectedDateLabel} blocks`}>
        {visibleBlocks.map((event, index) => (
          <article key={event.id} className="shell-upcoming-line" style={{ opacity: Math.max(0.14, 0.96 - index * 0.2) }}>
            <button type="button" className="shell-upcoming-line-main" onClick={() => onSelectEvent(event)}>
              <strong>{event.title}</strong>
              <span>{formatRange(event.start, event.end)}</span>
            </button>
            <button
              type="button"
              className="shell-upcoming-comment-btn"
              aria-label={`Open comments for ${event.title}`}
              onClick={() => onOpenAiThread(event)}
            >
              <CommentAdd size={18} strokeWidth={1.5} />
            </button>
          </article>
        ))}
        {!loading && !primaryBlock && visibleBlocks.length === 0 && (
          <article className="shell-upcoming-line empty">
            <button type="button" className="shell-upcoming-add-btn" onClick={onOpenCreateComposer}>
              + Add
            </button>
          </article>
        )}
      </div>
    </main>
  );
}
