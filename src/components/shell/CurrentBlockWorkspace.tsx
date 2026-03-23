import { CommentAdd } from 'clicons-react';
import { ArrowUp, CheckCircle2, ChevronDown, ChevronRight, Circle, Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Event } from '../../types/Event';
import type { ShellItemSummary, ShellListSummary } from './types';

interface CurrentBlockWorkspaceProps {
  primaryBlock: Event | null;
  nextBlock: Event | null;
  lists: ShellListSummary[];
  items: ShellItemSummary[];
  selectedDate: Date;
  selectedDateEvents: Event[];
  loading: boolean;
  error: string | null;
  onStartCurrentBlock: () => Promise<void>;
  onDescribeCurrentBlock: (input: string) => Promise<void>;
  onPlanFutureDay: (input: string) => Promise<void>;
  onOpenCreateComposer: () => void;
  onEditBlock: (event: Event) => void;
  onOpenAiThread: (event: Event) => void;
  onAddBlockTask: (eventId: string, title: string, linkedItemIds: string[]) => Promise<void>;
  onToggleBlockTask: (eventId: string, taskId: string, checked: boolean) => Promise<void>;
  onToggleBlockTaskItem: (eventId: string, blockTaskItemId: string, checked: boolean) => Promise<void>;
  onOpenItem: (itemId: string) => void;
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
  lists,
  items,
  selectedDate,
  selectedDateEvents,
  loading,
  error,
  onStartCurrentBlock: _onStartCurrentBlock,
  onDescribeCurrentBlock,
  onPlanFutureDay,
  onOpenCreateComposer,
  onEditBlock,
  onOpenAiThread,
  onAddBlockTask,
  onToggleBlockTask,
  onToggleBlockTaskItem,
  onOpenItem
}: CurrentBlockWorkspaceProps): JSX.Element {
  const selectedIsToday = isSameDay(selectedDate, new Date());
  const selectedIsFuture = selectedDate.getTime() > new Date(new Date().setHours(23, 59, 59, 999)).getTime();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [captureDraft, setCaptureDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [busyLinkedItemId, setBusyLinkedItemId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setTaskDraft('');
    setSelectedListId('');
    setSelectedItemId('');
    setTaskComposerOpen(false);
    setBusyTaskId(null);
    setBusyLinkedItemId(null);
    setExpandedTaskIds(primaryBlock?.blockTasks?.filter((task) => task.linkedItems.length > 0).slice(0, 1).map((task) => task.id) || []);
  }, [primaryBlock?.id]);

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
  const frameClassName = `shell-current-frame ${primaryBlock ? 'active' : 'idle'} ${showPlanningCapture ? 'planning' : ''}`.trim();

  const blockTasks = primaryBlock?.blockTasks || [];
  const filteredItems = selectedListId ? items.filter((entry) => entry.listId === selectedListId) : [];

  const toggleExpandedTask = (taskId: string): void => {
    setExpandedTaskIds((current) =>
      current.includes(taskId) ? current.filter((entry) => entry !== taskId) : [...current, taskId]
    );
  };

  const handleAddTask = async (): Promise<void> => {
    const value = taskDraft.trim();
    if (!primaryBlock?.id || !value) return;
    setBusyTaskId('__create__');
    try {
      await onAddBlockTask(primaryBlock.id, value, selectedItemId ? [selectedItemId] : []);
      setTaskDraft('');
      setSelectedListId('');
      setSelectedItemId('');
      setTaskComposerOpen(false);
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <section className="shell-current-workspace">
      <div className={frameClassName}>
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
                <div className="shell-current-meta-row">
                  <span className="shell-current-label">{isActiveBlock && selectedIsToday ? 'In progress' : 'Scheduled block'}</span>
                  <span className="shell-current-meta-dot" aria-hidden="true">
                    ·
                  </span>
                  <span className="shell-current-meta-time">{formatRange(primaryBlock.start, primaryBlock.end)}</span>
                </div>
                <div className="shell-current-title-row">
                  <h1>{primaryBlock.title}</h1>
                  <button
                    type="button"
                    className="shell-current-inline-action"
                    aria-label={`Edit ${primaryBlock.title}`}
                    onClick={() => onEditBlock(primaryBlock)}
                  >
                    <Pencil size={16} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    className="shell-current-inline-action shell-current-comment-btn"
                    aria-label={`Open comments for ${primaryBlock.title}`}
                    onClick={() => onOpenAiThread(primaryBlock)}
                  >
                    <CommentAdd size={18} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="shell-current-body shell-current-task-body">
                  <div className="shell-current-task-head">
                    <button
                      type="button"
                      className="shell-current-add-task"
                      onClick={() => setTaskComposerOpen((current) => !current)}
                    >
                      + Add Task
                    </button>
                  </div>
                  {taskComposerOpen ? (
                    <div className="shell-current-task-composer">
                      <input
                        type="text"
                        className="shell-current-task-input"
                        placeholder="Add a task for this block..."
                        value={taskDraft}
                        onChange={(event) => setTaskDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleAddTask();
                          }
                        }}
                      />
                      <div className="shell-current-task-picker-row">
                        <select
                          className="shell-current-task-select"
                          value={selectedListId}
                          onChange={(event) => {
                            setSelectedListId(event.target.value);
                            setSelectedItemId('');
                          }}
                        >
                          <option value="">No linked item</option>
                          {lists.map((list) => (
                            <option key={list.id} value={list.id}>
                              {list.name}
                            </option>
                          ))}
                        </select>
                        <select
                          className="shell-current-task-select"
                          value={selectedItemId}
                          onChange={(event) => setSelectedItemId(event.target.value)}
                          disabled={!selectedListId}
                        >
                          <option value="">{selectedListId ? 'Choose an item' : 'Choose list first'}</option>
                          {filteredItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="shell-current-task-save"
                        onClick={() => void handleAddTask()}
                        disabled={!taskDraft.trim() || busyTaskId === '__create__'}
                      >
                        Add
                      </button>
                    </div>
                  ) : null}
                  <div className="shell-current-task-list">
                    {blockTasks.length ? (
                      blockTasks.map((task) => {
                        const hasLinkedItems = task.linkedItems.length > 0;
                        const isExpanded = expandedTaskIds.includes(task.id);
                        return (
                          <div key={task.id} className={`shell-current-task-entry ${task.isCompleted ? 'completed' : ''}`.trim()}>
                            <div className="shell-current-task-row">
                              <button
                                type="button"
                                className="shell-current-task-check"
                                aria-label={`${task.isCompleted ? 'Mark incomplete' : 'Mark complete'} ${task.title}`}
                                disabled={busyTaskId === task.id}
                                onClick={() => {
                                  setBusyTaskId(task.id);
                                  void onToggleBlockTask(primaryBlock.id, task.id, !task.isCompleted).finally(() => {
                                    setBusyTaskId(null);
                                  });
                                }}
                              >
                                {task.isCompleted ? <CheckCircle2 size={18} strokeWidth={1.7} /> : <Circle size={18} strokeWidth={1.7} />}
                              </button>
                              <div className="shell-current-task-copy">
                                <button
                                  type="button"
                                  className="shell-current-task-title"
                                  onClick={() => {
                                    if (hasLinkedItems) {
                                      toggleExpandedTask(task.id);
                                    }
                                  }}
                                >
                                  {task.title}
                                </button>
                              </div>
                              {hasLinkedItems ? (
                                <button
                                  type="button"
                                  className="shell-current-task-expand"
                                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${task.title}`}
                                  onClick={() => toggleExpandedTask(task.id)}
                                >
                                  {isExpanded ? <ChevronDown size={16} strokeWidth={1.7} /> : <ChevronRight size={16} strokeWidth={1.7} />}
                                </button>
                              ) : null}
                            </div>
                            {hasLinkedItems && isExpanded ? (
                              <div className="shell-current-task-subitems">
                                {task.linkedItems.map((linkedItem) => (
                                  <div key={linkedItem.id} className={`shell-current-task-subitem ${linkedItem.completedInContext ? 'completed' : ''}`.trim()}>
                                    <button
                                      type="button"
                                      className="shell-current-task-subcheck"
                                      aria-label={`${linkedItem.completedInContext ? 'Mark incomplete' : 'Mark complete'} ${linkedItem.title}`}
                                      disabled={busyLinkedItemId === linkedItem.itemId}
                                      onClick={() => {
                                        setBusyLinkedItemId(linkedItem.itemId);
                                        void onToggleBlockTaskItem(primaryBlock.id, linkedItem.blockTaskItemId, !linkedItem.completedInContext).finally(() => {
                                          setBusyLinkedItemId(null);
                                        });
                                      }}
                                    >
                                      {linkedItem.completedInContext ? <CheckCircle2 size={16} strokeWidth={1.7} /> : <Circle size={16} strokeWidth={1.7} />}
                                    </button>
                                    <button
                                      type="button"
                                      className="shell-current-task-subtitle"
                                      onClick={() => onOpenItem(linkedItem.itemId)}
                                    >
                                      {linkedItem.title}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <span className="shell-current-muted">No tasks in this block yet.</span>
                    )}
                  </div>
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
