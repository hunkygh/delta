import { useState } from 'react';
import { CommentAdd } from 'clicons-react';
import type { Event } from '../../types/Event';
import type { ShellItemSummary, ShellListSummary } from './types';
import CurrentBlockWorkspace from './CurrentBlockWorkspace';

interface ShellCenterProps {
  primaryBlock: Event | null;
  nextBlock: Event | null;
  visibleBlocks: Event[];
  lists: ShellListSummary[];
  items: ShellItemSummary[];
  selectedDate: Date;
  loading: boolean;
  error: string | null;
  onSelectEvent: (event: Event) => void;
  onOpenAiThread: (event: Event) => void;
  onStartCurrentBlock: () => Promise<void>;
  onDescribeCurrentBlock: (input: string) => Promise<void>;
  onPlanFutureDay: (input: string) => Promise<void>;
  onOpenCreateComposer: () => void;
  onToggleCreateComposer: () => void;
  onEditBlock: (event: Event) => void;
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

export default function ShellCenter({
  primaryBlock,
  nextBlock,
  visibleBlocks,
  lists,
  items,
  selectedDate,
  loading,
  error,
  onSelectEvent,
  onOpenAiThread,
  onStartCurrentBlock,
  onDescribeCurrentBlock,
  onPlanFutureDay,
  onOpenCreateComposer,
  onToggleCreateComposer,
  onEditBlock,
  onAddBlockTask,
  onToggleBlockTask,
  onToggleBlockTaskItem,
  onOpenItem
}: ShellCenterProps): JSX.Element {
  const [composerEventId, setComposerEventId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState('');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const selectedDateLabel = selectedDate.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const filteredItems = selectedListId ? items.filter((entry) => entry.listId === selectedListId) : [];

  const toggleTaskComposer = (event: Event): void => {
    setComposerEventId((current) => {
      if (current === event.id) {
        setTaskDraft('');
        setSelectedListId('');
        setSelectedItemId('');
        return null;
      }
      setTaskDraft('');
      setSelectedListId('');
      setSelectedItemId('');
      return event.id;
    });
  };

  const submitUpcomingTask = async (event: Event): Promise<void> => {
    const title = taskDraft.trim();
    if (!title) return;
    setSavingEventId(event.id);
    try {
      await onAddBlockTask(event.id, title, selectedItemId ? [selectedItemId] : []);
      setComposerEventId(null);
      setTaskDraft('');
      setSelectedListId('');
      setSelectedItemId('');
    } finally {
      setSavingEventId(null);
    }
  };

  return (
    <main className="shell-center">
      <CurrentBlockWorkspace
        primaryBlock={primaryBlock}
        nextBlock={nextBlock}
        lists={lists}
        items={items}
        selectedDate={selectedDate}
        selectedDateEvents={visibleBlocks}
        loading={loading}
        error={error}
        onStartCurrentBlock={onStartCurrentBlock}
        onDescribeCurrentBlock={onDescribeCurrentBlock}
        onPlanFutureDay={onPlanFutureDay}
        onOpenCreateComposer={onOpenCreateComposer}
        onEditBlock={onEditBlock}
        onOpenAiThread={onOpenAiThread}
        onAddBlockTask={onAddBlockTask}
        onToggleBlockTask={onToggleBlockTask}
        onToggleBlockTaskItem={onToggleBlockTaskItem}
        onOpenItem={onOpenItem}
      />
      <div className="shell-upcoming-stack" aria-label={`${selectedDateLabel} blocks`}>
        <div className="shell-upcoming-sticky-add">
          <button type="button" className="shell-upcoming-add-btn" onClick={onToggleCreateComposer}>
            + Add
          </button>
        </div>
        <div className="shell-upcoming-fade-list">
        {visibleBlocks.map((event) => (
          <article key={event.id} className="shell-upcoming-line">
            <div className="shell-upcoming-line-main">
              <button type="button" className="shell-upcoming-line-title" onClick={() => onSelectEvent(event)}>
                <strong>{event.title}</strong>
              </button>
              <span>{formatRange(event.start, event.end)}</span>
              <div className="shell-upcoming-line-actions">
                <button
                  type="button"
                  className="shell-upcoming-task-btn"
                  onClick={() => toggleTaskComposer(event)}
                >
                  + Add Task
                </button>
                <button
                  type="button"
                  className="shell-upcoming-comment-btn"
                  aria-label={`Open comments for ${event.title}`}
                  onClick={() => onOpenAiThread(event)}
                >
                  <CommentAdd size={18} strokeWidth={1.5} />
                </button>
              </div>
              {composerEventId === event.id ? (
                <div className="shell-upcoming-task-composer">
                  <input
                    type="text"
                    className="shell-upcoming-task-input"
                    placeholder="Task name"
                    value={taskDraft}
                    onChange={(entry) => setTaskDraft(entry.target.value)}
                    onKeyDown={(entry) => {
                      if (entry.key === 'Enter') {
                        entry.preventDefault();
                        void submitUpcomingTask(event);
                      }
                    }}
                  />
                  <div className="shell-upcoming-task-pickers">
                    <select
                      className="shell-upcoming-task-select"
                      value={selectedListId}
                      onChange={(entry) => {
                        setSelectedListId(entry.target.value);
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
                      className="shell-upcoming-task-select"
                      value={selectedItemId}
                      onChange={(entry) => setSelectedItemId(entry.target.value)}
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
                  <div className="shell-upcoming-task-actions">
                    <button
                      type="button"
                      className="shell-upcoming-task-save"
                      disabled={!taskDraft.trim() || savingEventId === event.id}
                      onClick={() => void submitUpcomingTask(event)}
                    >
                      Add
                    </button>
                    <button type="button" className="shell-upcoming-task-cancel" onClick={() => toggleTaskComposer(event)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {!loading && visibleBlocks.length === 0 && (
          <article className="shell-upcoming-line empty">
            <span>No more blocks yet for {selectedDateLabel}.</span>
          </article>
        )}
        </div>
      </div>
    </main>
  );
}
