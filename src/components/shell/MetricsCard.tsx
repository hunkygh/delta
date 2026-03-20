import { ArrowLeft, ArrowRight, Circle, Link2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import focalBoardService from '../../services/focalBoardService';
import type { ShellDaySnapshot } from './daySnapshot';
import type { ShellItemSummary } from './types';

interface MetricsCardProps {
  userId: string;
  items: ShellItemSummary[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  snapshot: ShellDaySnapshot;
  onOpenItem: (itemId: string, listId: string, focalId: string | null) => void;
  onRefreshShellData: () => Promise<void>;
}

const addDays = (value: Date, amount: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
};

export default function MetricsCard({
  userId,
  items,
  selectedDate,
  onSelectDate,
  snapshot,
  onOpenItem,
  onRefreshShellData
}: MetricsCardProps): JSX.Element {
  const [activePopover, setActivePopover] = useState<{ taskId: string; type: 'connect' } | null>(null);
  const [connectQuery, setConnectQuery] = useState('');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const allRows = useMemo(
    () => [
      ...snapshot.carryForward,
      ...snapshot.timed,
      ...snapshot.untimed,
      ...snapshot.nested
    ],
    [snapshot.carryForward, snapshot.nested, snapshot.timed, snapshot.untimed]
  );

  const connectMatches = useMemo(() => {
    const targetTask = allRows.find((entry) => entry.id === activePopover?.taskId) || null;
    if (!targetTask?.listId) {
      return [];
    }
    const normalized = connectQuery.trim().toLowerCase();
    const pool = items.filter((item) => item.listId === targetTask.listId);
    if (!normalized) {
      return pool.slice(0, 5);
    }
    return pool
      .filter((item) => item.title.toLowerCase().includes(normalized))
      .slice(0, 5);
  }, [activePopover?.taskId, allRows, connectQuery, items]);

  const handleCompleteTask = async (taskId: string): Promise<void> => {
    try {
      setBusyTaskId(taskId);
      await focalBoardService.updateAction(taskId, {
        status: 'done'
      });
      await onRefreshShellData();
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleConnectTask = async (taskId: string): Promise<void> => {
    const task = allRows.find((entry) => entry.id === taskId) || null;
    if (!task?.listId) {
      return;
    }

    const trimmed = connectQuery.trim();
    if (!trimmed) {
      return;
    }

    try {
      setBusyTaskId(taskId);
      const exactMatch = items.find(
        (item) => item.listId === task.listId && item.title.trim().toLowerCase() === trimmed.toLowerCase()
      );
      const targetItem =
        exactMatch || (await focalBoardService.createItem(task.listId, userId, trimmed, null));

      await focalBoardService.updateAction(taskId, {
        item_id: targetItem.id
      });
      setActivePopover(null);
      setConnectQuery('');
      await onRefreshShellData();
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <section className="shell-card shell-card-frosted shell-metrics-card shell-task-snapshot-card">
      <div className="shell-task-snapshot-head">
        <strong className="shell-task-snapshot-label">Tasks</strong>
        <button type="button" className="shell-task-snapshot-step" onClick={() => onSelectDate(addDays(selectedDate, -1))} aria-label="Previous day">
          <ArrowLeft size={14} />
        </button>
        <strong className="shell-task-snapshot-title">
          <span>{selectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </strong>
        <button type="button" className="shell-task-snapshot-step" onClick={() => onSelectDate(addDays(selectedDate, 1))} aria-label="Next day">
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="shell-task-snapshot-list">
        {allRows.length ? (
          allRows.slice(0, 6).map((task) => {
            const isConnecting = activePopover?.taskId === task.id && activePopover.type === 'connect';
            return (
              <div key={task.id} className={`shell-task-snapshot-entry ${task.bucket}`.trim()}>
                <div className="shell-task-snapshot-row">
                  <button
                    type="button"
                    className="shell-task-snapshot-status"
                    aria-label={`Complete ${task.title}`}
                    onClick={() => {
                      void handleCompleteTask(task.id);
                      setConnectQuery('');
                    }}
                    disabled={busyTaskId === task.id}
                  >
                    <Circle size={16} />
                  </button>
                  <button
                    type="button"
                    className="shell-task-snapshot-row-main"
                    onClick={() => {
                      if (!task.listId) return;
                      onOpenItem(task.itemId, task.listId, task.focalId);
                    }}
                  >
                    <span className="shell-task-snapshot-row-title" title={task.title}>
                      {task.title}
                    </span>
                    <span className="shell-task-snapshot-row-subline">
                      <span className="shell-task-snapshot-row-time" title={task.timeLabel || ''}>
                        {task.timeLabel || '\u00A0'}
                      </span>
                      <span
                        className="shell-task-snapshot-row-meta"
                        title={task.bucket === 'nested' && task.blockTitle ? `in ${task.blockTitle}` : task.itemTitle}
                      >
                        {task.bucket === 'nested' && task.blockTitle ? `in ${task.blockTitle}` : task.itemTitle}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="shell-task-snapshot-connect"
                    aria-label={`Connect ${task.title} to an item`}
                    onClick={() => {
                      setActivePopover((prev) =>
                        prev?.taskId === task.id ? null : { taskId: task.id, type: 'connect' }
                      );
                      setConnectQuery('');
                    }}
                    disabled={busyTaskId === task.id}
                  >
                    <Link2 size={15} />
                  </button>
                </div>
                {isConnecting ? (
                  <div className="shell-task-snapshot-popout" role="dialog" aria-label="Connect task">
                    <input
                      className="shell-task-snapshot-popout-input"
                      type="text"
                      value={connectQuery}
                      onChange={(event) => setConnectQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleConnectTask(task.id);
                        }
                      }}
                      placeholder="Connect to item"
                    />
                    <button
                      type="button"
                      className="shell-task-snapshot-popout-save"
                      onClick={() => void handleConnectTask(task.id)}
                      disabled={busyTaskId === task.id || !connectQuery.trim()}
                    >
                      Save
                    </button>
                    {connectMatches.length ? (
                      <div className="shell-task-snapshot-popout-match-list">
                        {connectMatches.map((match) => (
                          <button
                            key={match.id}
                            type="button"
                            className="shell-task-snapshot-popout-match"
                            onClick={() => {
                              setConnectQuery(match.title);
                            }}
                          >
                            {match.title}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="shell-task-snapshot-empty">
            <strong>No tasks queued</strong>
            <span>This day is clear so far.</span>
          </div>
        )}
      </div>
    </section>
  );
}
