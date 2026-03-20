import { CommentAdd } from 'clicons-react';
import { ArrowUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Event } from '../../types/Event';

interface CurrentBlockWorkspaceProps {
  primaryBlock: Event | null;
  nextBlock: Event | null;
  selectedDate: Date;
  selectedDateEvents: Event[];
  loading: boolean;
  error: string | null;
  onStartCurrentBlock: () => Promise<void>;
  onDescribeCurrentBlock: (input: string) => Promise<void>;
  onPlanFutureDay: (input: string) => Promise<void>;
  onOpenCreateComposer: () => void;
  onOpenAiThread: (event: Event) => void;
}

const formatRange = (startIso: string, endIso: string): string => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const format = (value: Date) =>
    value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  return `${format(start)} - ${format(end)}`;
};

const formatTime = (valueIso: string): string =>
  new Date(valueIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const formatDateLabel = (value: Date): string =>
  value.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

const getProgressPercent = (startIso: string, endIso: string, nowMs: number): number => {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(100, Math.max(0, ((nowMs - start) / (end - start)) * 100));
};

export default function CurrentBlockWorkspace({
  primaryBlock,
  nextBlock,
  selectedDate,
  selectedDateEvents,
  loading,
  error,
  onStartCurrentBlock: _onStartCurrentBlock,
  onDescribeCurrentBlock,
  onPlanFutureDay,
  onOpenCreateComposer,
  onOpenAiThread
}: CurrentBlockWorkspaceProps): JSX.Element {
  const selectedIsToday = isSameDay(selectedDate, new Date());
  const selectedIsFuture = selectedDate.getTime() > new Date(new Date().setHours(23, 59, 59, 999)).getTime();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [captureDraft, setCaptureDraft] = useState('');

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const isActiveBlock = useMemo(() => {
    if (!primaryBlock) return false;
    const start = new Date(primaryBlock.start).getTime();
    const end = new Date(primaryBlock.end).getTime();
    return nowMs >= start && nowMs <= end;
  }, [nowMs, primaryBlock]);

  const nowMarkerPercent = primaryBlock ? getProgressPercent(primaryBlock.start, primaryBlock.end, nowMs) : 0;
  const laneStartIso = primaryBlock?.start || selectedDateEvents[0]?.start || null;
  const laneEndIso = primaryBlock?.end || selectedDateEvents[selectedDateEvents.length - 1]?.end || null;
  const showRailTimes = Boolean(laneStartIso && laneEndIso);
  const showIdleCapture = !loading && !error && !primaryBlock && selectedIsToday;
  const showPlanningCapture = !loading && !error && !primaryBlock && selectedIsFuture;

  const handleSubmit = (): void => {
    const value = captureDraft.trim();
    if (!value) return;
    setCaptureDraft('');
    if (showPlanningCapture) {
      void onPlanFutureDay(value);
      return;
    }
    if (showIdleCapture) {
      void onDescribeCurrentBlock(value);
    }
  };

  const cardClassName = `shell-current-card ${primaryBlock ? 'active' : 'idle'} ${showPlanningCapture ? 'planning' : ''}`.trim();

  return (
    <section className="shell-current-workspace">
      <div className="shell-current-frame">
        <aside className="shell-current-rail" aria-hidden="true">
          {showRailTimes ? (
            <>
              <span className="shell-current-rail-time top">{formatTime(laneStartIso!)}</span>
              <div className="shell-current-rail-track">
                <div className="shell-current-rail-line" />
                {isActiveBlock ? (
                  <div className="shell-current-rail-marker" style={{ top: `${nowMarkerPercent}%` }}>
                    <span className="shell-current-rail-marker-time">
                      {new Date(nowMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}
                    </span>
                    <span className="shell-current-rail-marker-line" />
                  </div>
                ) : null}
              </div>
              <span className="shell-current-rail-time bottom">{formatTime(laneEndIso!)}</span>
            </>
          ) : (
            <div className="shell-current-rail-track shell-current-rail-track-idle">
              <div className="shell-current-rail-line" />
            </div>
          )}
        </aside>

        <article className={cardClassName}>
          <div className="shell-current-card-layout">
            <div className="shell-current-content">
            {loading ? (
              <>
                <span className="shell-current-label">Loading now</span>
                <h1>Building today’s execution surface…</h1>
                <p>Pulling the current schedule into the shell.</p>
              </>
            ) : error ? (
              <>
                <span className="shell-current-label">Unavailable</span>
                <h1>{error}</h1>
                <p>The shell stays isolated while this layout is refined.</p>
              </>
            ) : primaryBlock ? (
              <>
                <span className="shell-current-label">{isActiveBlock && selectedIsToday ? 'In progress' : 'Scheduled block'}</span>
                <div className="shell-current-title-row">
                  <h1>{primaryBlock.title}</h1>
                  <button
                    type="button"
                    className="shell-current-comment-btn"
                    aria-label={`Open comments for ${primaryBlock.title}`}
                    onClick={() => onOpenAiThread(primaryBlock)}
                  >
                    <CommentAdd size={18} strokeWidth={1.5} />
                  </button>
                </div>
                <p>{formatRange(primaryBlock.start, primaryBlock.end)}</p>
                <div className="shell-current-body">
                  <span className="shell-current-muted">
                    {primaryBlock.description?.trim() ||
                      `${primaryBlock.blockTasks?.length || 0} block tasks${
                        nextBlock ? ` · next ${formatRange(nextBlock.start, nextBlock.end).split(' - ')[0]}` : ''
                      }`}
                  </span>
                </div>
              </>
            ) : (
              <>
                <h1>{showPlanningCapture ? 'Plan this day.' : 'What are you up to now?'}</h1>
                {showIdleCapture || showPlanningCapture ? (
                  <div className="shell-current-idle-actions">
                    <div className="shell-current-idle-cta-row">
                      <div className="shell-current-capture-shell">
                        <textarea
                          className="shell-current-capture-input"
                          rows={1}
                          placeholder={
                            showPlanningCapture
                              ? 'Describe what needs to happen that day...'
                              : 'Describe what you’re doing right now...'
                          }
                          value={captureDraft}
                          onChange={(event) => setCaptureDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              handleSubmit();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="shell-current-send-action"
                          disabled={!captureDraft.trim()}
                          onClick={handleSubmit}
                        >
                          <ArrowUp size={16} />
                        </button>
                      </div>
                      <span className="shell-current-inline-or">or</span>
                      <button
                        type="button"
                        className="shell-current-secondary-action"
                          onClick={onOpenCreateComposer}
                        >
                          + Add
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
