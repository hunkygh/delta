import { useEffect, useMemo, useState } from 'react';
import type { CustomRecurrenceConfig, RecurrenceRule } from '../../types/Event';
import Button from '../Button';
import ProposalReviewTable, { type ProposalReviewRow } from '../ProposalReviewTable';

interface EventDrawerProps {
  isCreateFlow: boolean;
  title: string;
  description: string;
  start: string;
  end: string;
  recurrence: RecurrenceRule;
  recurrenceConfig: CustomRecurrenceConfig;
  includeWeekends: boolean;
  aiHandoffActive?: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onRecurrenceChange: (value: RecurrenceRule) => void;
  onRecurrenceConfigChange: (value: CustomRecurrenceConfig) => void;
  onToggleIncludeWeekends: () => void;
  onAskDelta: () => void;
  isTaskLinkRequested: boolean;
  onLinkTasks: () => void;
  onAskDeltaForTasks: () => void;
  draftItems: Array<{ id: string; title: string; listId: string }>;
  onDraftItemAdd: (title: string) => void;
  onDraftItemRemove: (id: string) => void;
  onDraftItemAssign: (id: string, listId: string) => void;
  canOptimize?: boolean;
  isOptimizingBlock?: boolean;
  optimizeError?: string | null;
  optimizeSource?: string;
  onOptimizeBlock?: () => void;
  proposalRows?: ProposalReviewRow[];
  proposalsApplying?: boolean;
  onToggleProposalRow?: (id: string, approved: boolean) => void;
  onApproveSelectedProposals?: () => void;
  onCancelProposals?: () => void;
  timeblockNotes?: Array<{
    id: string;
    author_type: 'user' | 'ai';
    content: string;
    created_at: string;
  }>;
  timeblockNotesLoading?: boolean;
  timeblockNoteError?: string | null;
  timeblockNoteDraft?: string;
  timeblockNoteSubmitting?: boolean;
  onTimeblockNoteDraftChange?: (value: string) => void;
  onSubmitTimeblockNote?: () => void;
  contentMode: 'all' | 'weekday';
  onContentModeChange: (mode: 'all' | 'weekday') => void;
  contentListOptions: Array<{ id: string; name: string }>;
  contentItemOptionsByList: Record<string, Array<{ id: string; title: string }>>;
  contentFocalTree: Array<{
    id: string;
    name: string;
    lists: Array<{
      id: string;
      name: string;
      items: Array<{ id: string; title: string }>;
    }>;
  }>;
  contentAll: { listId: string; itemIds: string[] };
  contentByWeekday: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', { listId: string; itemIds: string[] }>;
  onContentAllListChange: (listId: string) => void;
  onContentAllItemsChange: (itemIds: string[]) => void;
  onContentWeekdayListChange: (
    weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
    listId: string
  ) => void;
  onContentWeekdayItemsChange: (
    weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
    itemIds: string[]
  ) => void;
  occurrenceWeekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | null;
  occurrenceItems: Array<{
    id: string;
    title: string;
    completed: boolean;
    kind: 'task' | 'item';
    parentItemId?: string;
  }>;
  onToggleOccurrenceItem: (
    entry: { id: string; title: string; completed: boolean; kind: 'task' | 'item'; parentItemId?: string },
    checked: boolean
  ) => void;
  onOpenOccurrenceItem?: (entry: {
    id: string;
    title: string;
    completed: boolean;
    kind: 'task' | 'item';
    parentItemId?: string;
  }) => void;
  onCancel: () => void;
  onSave: () => void;
}

export default function EventDrawer({
  isCreateFlow,
  title,
  description,
  start,
  end,
  recurrence,
  recurrenceConfig,
  includeWeekends,
  aiHandoffActive = false,
  onTitleChange,
  onDescriptionChange,
  onStartChange,
  onEndChange,
  onRecurrenceChange,
  onRecurrenceConfigChange,
  onToggleIncludeWeekends,
  onAskDelta,
  isTaskLinkRequested,
  onLinkTasks,
  onAskDeltaForTasks,
  draftItems,
  onDraftItemAdd,
  onDraftItemRemove,
  onDraftItemAssign,
  canOptimize = false,
  isOptimizingBlock = false,
  optimizeError = null,
  optimizeSource,
  onOptimizeBlock,
  proposalRows = [],
  proposalsApplying = false,
  onToggleProposalRow,
  onApproveSelectedProposals,
  onCancelProposals,
  timeblockNotes = [],
  timeblockNotesLoading = false,
  timeblockNoteError = null,
  timeblockNoteDraft = '',
  timeblockNoteSubmitting = false,
  onTimeblockNoteDraftChange,
  onSubmitTimeblockNote,
  contentMode,
  onContentModeChange,
  contentListOptions,
  contentItemOptionsByList,
  contentFocalTree,
  contentAll,
  contentByWeekday,
  onContentAllListChange,
  onContentAllItemsChange,
  onContentWeekdayListChange,
  onContentWeekdayItemsChange,
  occurrenceWeekday,
  occurrenceItems,
  onToggleOccurrenceItem,
  onOpenOccurrenceItem,
  onCancel,
  onSave
}: EventDrawerProps): JSX.Element {
  const [openListPicker, setOpenListPicker] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [activeWeekday, setActiveWeekday] = useState<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>('mon');
  const [recurrenceExpanded, setRecurrenceExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [openDraftAssignId, setOpenDraftAssignId] = useState<string | null>(null);
  const recurrenceEnabled = recurrence !== 'none';
  const recurrenceUnit: CustomRecurrenceConfig['unit'] =
    recurrence === 'daily'
      ? 'day'
      : recurrence === 'weekly'
        ? 'week'
        : recurrence === 'monthly'
          ? 'month'
          : recurrenceConfig.unit;

  const recurrenceUnitLabel = recurrenceUnit === 'day'
    ? 'days'
    : recurrenceUnit === 'week'
      ? 'weeks'
      : recurrenceUnit === 'month'
        ? 'months'
      : 'years';
  const recurrenceSummary = recurrenceEnabled
    ? recurrence === 'custom'
      ? `Custom • every ${Math.max(1, recurrenceConfig.interval)} ${recurrenceUnitLabel}`
      : `${recurrence[0].toUpperCase()}${recurrence.slice(1)}`
    : 'None';
  const weekdayRows: Array<{ key: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'; label: string }> = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
    { key: 'sat', label: 'Sat' },
    { key: 'sun', label: 'Sun' }
  ];
  const listNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of contentListOptions) {
      map.set(option.id, option.name);
    }
    return map;
  }, [contentListOptions]);

  useEffect(() => {
    if (occurrenceWeekday) {
      setActiveWeekday(occurrenceWeekday);
      return;
    }
    setActiveWeekday('mon');
  }, [occurrenceWeekday]);

  useEffect(() => {
    if (!recurrenceEnabled) {
      setRecurrenceExpanded(false);
    }
  }, [recurrenceEnabled]);

  const filteredTree = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return contentFocalTree;
    return contentFocalTree
      .map((focal) => {
        const focalMatch = focal.name.toLowerCase().includes(query);
        const lists = focal.lists
          .map((list) => {
            const listMatch = list.name.toLowerCase().includes(query);
            const items = list.items.filter((item) => item.title.toLowerCase().includes(query));
            if (focalMatch || listMatch || items.length > 0) {
              return {
                ...list,
                items
              };
            }
            return null;
          })
          .filter(Boolean) as typeof focal.lists;
        if (focalMatch || lists.length > 0) {
          return {
            ...focal,
            lists
          };
        }
        return null;
      })
      .filter(Boolean) as typeof contentFocalTree;
  }, [contentFocalTree, pickerSearch]);

  const renderListPickerMenu = (
    pickerKey: string,
    selectedListId: string,
    onSelectList: (listId: string) => void
  ) => {
    if (openListPicker !== pickerKey) {
      return null;
    }
    return (
      <div className="calendar-event-list-picker-menu">
        <div className="calendar-event-list-picker-search-wrap">
          <input
            type="text"
            value={pickerSearch}
            onChange={(event) => setPickerSearch(event.target.value)}
            className="calendar-event-list-picker-search"
            placeholder="Find items or lists..."
          />
        </div>
        <div className="calendar-event-list-picker-tree">
          {filteredTree.length > 0 ? (
            filteredTree.map((focal) => (
              <div key={focal.id} className="calendar-event-list-picker-focal">
                <div className="calendar-event-list-picker-focal-name">{focal.name}</div>
                <div className="calendar-event-list-picker-lists">
                  {focal.lists.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      className={`calendar-event-list-picker-option ${selectedListId === list.id ? 'active' : ''}`.trim()}
                      onClick={() => {
                        onSelectList(list.id);
                        setPickerSearch('');
                        setOpenListPicker(null);
                      }}
                    >
                      <span>{list.name}</span>
                      {list.items.length > 0 && (
                        <small>
                          {list.items.slice(0, 2).map((item) => item.title).join(' · ')}
                          {list.items.length > 2 ? ` +${list.items.length - 2}` : ''}
                        </small>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="calendar-event-list-picker-lists">
              {contentListOptions.length > 0 ? (
                contentListOptions.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    className={`calendar-event-list-picker-option ${selectedListId === list.id ? 'active' : ''}`.trim()}
                    onClick={() => {
                      onSelectList(list.id);
                      setPickerSearch('');
                      setOpenListPicker(null);
                    }}
                  >
                    <span>{list.name}</span>
                  </button>
                ))
              ) : (
                <div className="calendar-event-list-picker-empty">No lists found</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const formatNoteTime = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <aside className={`calendar-event-drawer-side ${aiHandoffActive ? 'ai-handoff' : ''}`.trim()}>
      <div className="calendar-event-drawer-side-body">
        <div className="calendar-event-drawer-toprow">
          <input
            id="event-drawer-title"
            className="calendar-event-drawer-title-input"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Event name"
            autoFocus
          />
          <button type="button" className="calendar-event-drawer-top-ai-btn" onClick={onAskDelta} aria-label="Ask Delta">
            <img className="delta-ai-button-icon" src="/Delta-AI-Button.png" alt="" aria-hidden="true" width={14} height={14} />
          </button>
        </div>

        <section className="calendar-event-drawer-section">
          <div className="calendar-event-time-preview">
            {new Date(start).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
            {' · '}
            {new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            {' → '}
            {new Date(end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </div>
          <div className="calendar-event-time-inputs">
            <label className="calendar-field">
              <span>Start</span>
              <input
                className="calendar-input"
                type="datetime-local"
                value={start}
                onChange={(event) => onStartChange(event.target.value)}
              />
            </label>
            <label className="calendar-field">
              <span>End</span>
              <input
                className="calendar-input"
                type="datetime-local"
                value={end}
                onChange={(event) => onEndChange(event.target.value)}
              />
            </label>
          </div>
          <textarea
            className="calendar-event-description-input"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Add description"
          />
        </section>

        <section className="calendar-event-recurrence-block">
          <div className="calendar-event-recurrence-header">
            <button
              type="button"
              className="calendar-event-summary-btn"
              onClick={() => recurrenceEnabled && setRecurrenceExpanded((prev) => !prev)}
            >
              <span>Repeat</span>
              <strong>{recurrenceSummary}</strong>
            </button>
            <div className="calendar-event-recurrence-controls">
              <button
                type="button"
                className={`calendar-switch ${recurrenceEnabled ? 'on' : 'off'}`.trim()}
                aria-label={`Recurrence ${recurrenceEnabled ? 'on' : 'off'}`}
                onClick={() => {
                  const nextEnabled = !recurrenceEnabled;
                  onRecurrenceChange(nextEnabled ? 'daily' : 'none');
                  setRecurrenceExpanded(nextEnabled);
                }}
              >
                <span className="calendar-switch-thumb" />
              </button>
            </div>
          </div>
          {recurrenceEnabled && recurrenceExpanded && (
            <div className="calendar-event-recurrence-expanded">
              <div className="calendar-event-recurrence-row calendar-event-frequency-row">
                <span>Frequency</span>
                <div className="calendar-event-frequency-inline">
                  <span>every</span>
                  <input
                    className="calendar-input calendar-event-frequency-interval"
                    type="number"
                    min={1}
                    max={99}
                    value={recurrenceConfig.interval}
                    onChange={(event) =>
                      onRecurrenceConfigChange({
                        ...recurrenceConfig,
                        interval: Math.max(1, Math.min(99, Number.parseInt(event.target.value || '1', 10)))
                      })
                    }
                  />
                  <select
                    className="calendar-input calendar-event-frequency-unit"
                    value={recurrence === 'custom' ? 'custom' : recurrenceUnit}
                    onChange={(event) => {
                      const value = event.target.value as 'day' | 'week' | 'month' | 'year' | 'custom';
                      if (value === 'custom') {
                        onRecurrenceChange('custom');
                        return;
                      }
                      const nextRule: RecurrenceRule =
                        value === 'day' ? 'daily' : value === 'week' ? 'weekly' : value === 'month' ? 'monthly' : 'custom';
                      onRecurrenceChange(nextRule);
                      onRecurrenceConfigChange({
                        ...recurrenceConfig,
                        unit: value
                      });
                    }}
                  >
                    <option value="day">days</option>
                    <option value="week">weeks</option>
                    <option value="month">months</option>
                    <option value="custom">custom</option>
                  </select>
                </div>
              </div>
              <div className="calendar-event-recurrence-custom-grid">
                <div className="calendar-field">
                  <span>Ends</span>
                  <div className="calendar-event-text-options">
                    {(['indefinite', 'count', 'until'] as CustomRecurrenceConfig['limitType'][]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={recurrenceConfig.limitType === value ? 'active' : ''}
                        onClick={() =>
                          onRecurrenceConfigChange({
                            ...recurrenceConfig,
                            limitType: value
                          })
                        }
                      >
                        {value === 'indefinite' ? 'Never' : value === 'count' ? 'After count' : 'On date'}
                      </button>
                    ))}
                  </div>
                </div>
                {recurrenceConfig.limitType === 'count' && (
                  <label className="calendar-field">
                    <span>Count</span>
                    <input
                      className="calendar-input"
                      type="number"
                      min={1}
                      value={recurrenceConfig.count ?? 8}
                      onChange={(event) =>
                        onRecurrenceConfigChange({
                          ...recurrenceConfig,
                          count: Math.max(1, Number.parseInt(event.target.value || '1', 10))
                        })
                      }
                    />
                  </label>
                )}
                {recurrenceConfig.limitType === 'until' && (
                  <label className="calendar-field">
                    <span>Until</span>
                    <input
                      className="calendar-input"
                      type="date"
                      value={recurrenceConfig.until ?? ''}
                      onChange={(event) =>
                        onRecurrenceConfigChange({
                          ...recurrenceConfig,
                          until: event.target.value
                        })
                      }
                    />
                  </label>
                )}
              </div>
              <label className="calendar-event-recurrence-row">
                <span>Include weekends</span>
                <button
                  type="button"
                  className={`calendar-switch ${includeWeekends ? 'on' : 'off'}`.trim()}
                  aria-label={`Include weekends ${includeWeekends ? 'on' : 'off'}`}
                  onClick={onToggleIncludeWeekends}
                >
                  <span className="calendar-switch-thumb" />
                </button>
              </label>
            </div>
          )}
        </section>

        <section className="calendar-event-task-link-block">
          <div className="calendar-event-task-link-row">
            <button type="button" className="calendar-event-link-tasks-btn" onClick={onLinkTasks}>
              Add Items
            </button>
          </div>
        </section>

        {isTaskLinkRequested && (
          <div className="calendar-event-task-flyout" role="dialog" aria-label="Add items to time block">
            <div className="calendar-event-task-flyout-head">
              <p>Add Items</p>
              <button type="button" className="calendar-event-link-tasks-btn" onClick={onLinkTasks}>
                Close
              </button>
            </div>
            <div className="calendar-event-task-flyout-filter">
              <input
                type="text"
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                className="calendar-event-list-picker-search"
                placeholder="Filter by list/item text"
              />
            </div>

            <form
              className="calendar-event-draft-create"
              onSubmit={(event) => {
                event.preventDefault();
                const value = draftTitle.trim();
                if (!value) return;
                onDraftItemAdd(value);
                setDraftTitle('');
              }}
            >
              <input
                type="text"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="calendar-event-list-picker-search"
                placeholder="Create new item"
              />
              <button type="submit" className="calendar-event-link-tasks-btn">
                Add
              </button>
            </form>
            {draftItems.length > 0 && (
              <div className="calendar-event-draft-list">
                {draftItems.map((entry) => (
                  <div key={entry.id} className="calendar-event-draft-row">
                    <span className="calendar-event-draft-title">{entry.title}</span>
                    <div className="calendar-event-draft-actions">
                      <button
                        type="button"
                        className="calendar-event-link-tasks-btn"
                        onClick={() => setOpenDraftAssignId((prev) => (prev === entry.id ? null : entry.id))}
                      >
                        {listNameById.get(entry.listId) || 'Assign list'}
                      </button>
                      <button
                        type="button"
                        className="calendar-event-link-tasks-btn"
                        onClick={() => onDraftItemRemove(entry.id)}
                      >
                        Remove
                      </button>
                    </div>
                    {openDraftAssignId === entry.id && (
                      <div className="calendar-event-draft-assign-menu">
                        {contentListOptions.map((list) => (
                          <button
                            key={list.id}
                            type="button"
                            className={`calendar-event-list-picker-option ${entry.listId === list.id ? 'active' : ''}`.trim()}
                            onClick={() => {
                              onDraftItemAssign(entry.id, list.id);
                              setOpenDraftAssignId(null);
                            }}
                          >
                            {list.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="calendar-event-contents-shell">
              <div className="calendar-event-contents-mode">
                <button
                  type="button"
                  className={contentMode === 'all' ? 'active' : ''}
                  onClick={() => onContentModeChange('all')}
                >
                  Same every time
                </button>
                <button
                  type="button"
                  className={contentMode === 'weekday' ? 'active' : ''}
                  onClick={() => onContentModeChange('weekday')}
                >
                  By weekday
                </button>
              </div>

              {contentMode === 'all' ? (
                <div className="calendar-event-contents-block">
                  <div className="calendar-event-list-picker-wrap">
                    <button
                      type="button"
                      className="calendar-event-list-picker-trigger"
                      onClick={() => setOpenListPicker((prev) => (prev === 'all' ? null : 'all'))}
                    >
                      <span>{listNameById.get(contentAll.listId) || 'Select list'}</span>
                    </button>
                  </div>
                  {contentAll.listId && (
                    <div className="calendar-event-contents-items">
                      {(contentItemOptionsByList[contentAll.listId] || []).map((item) => (
                        <label key={item.id} className="calendar-event-contents-item-row">
                          <input
                            type="checkbox"
                            checked={contentAll.itemIds.includes(item.id)}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...new Set([...contentAll.itemIds, item.id])]
                                : contentAll.itemIds.filter((entry) => entry !== item.id);
                              onContentAllItemsChange(next);
                            }}
                          />
                          <span>{item.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="calendar-event-contents-weekday-shell">
                  <div className="calendar-event-contents-weekday-tabs" role="tablist" aria-label="Weekday selector">
                    {weekdayRows.map((weekday) => (
                      <button
                        key={weekday.key}
                        type="button"
                        role="tab"
                        aria-selected={activeWeekday === weekday.key}
                        className={[
                          'calendar-event-weekday-tab',
                          activeWeekday === weekday.key ? 'active' : '',
                          occurrenceWeekday === weekday.key ? 'current' : ''
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => setActiveWeekday(weekday.key)}
                      >
                        {weekday.label}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const row = contentByWeekday[activeWeekday];
                    const options = row?.listId ? (contentItemOptionsByList[row.listId] || []) : [];
                    const pickerKey = `weekday-${activeWeekday}`;
                    return (
                      <div className="calendar-event-contents-weekday-panel">
                        <div className="calendar-event-list-picker-wrap">
                          <button
                            type="button"
                            className="calendar-event-list-picker-trigger"
                            onClick={() => setOpenListPicker((prev) => (prev === pickerKey ? null : pickerKey))}
                          >
                            <span>{listNameById.get(row?.listId || '') || 'Select list'}</span>
                          </button>
                        </div>
                        {row?.listId && (
                          <div className="calendar-event-contents-items">
                            {options.map((item) => (
                              <label key={item.id} className="calendar-event-contents-item-row">
                                <input
                                  type="checkbox"
                                  checked={(row.itemIds || []).includes(item.id)}
                                  onChange={(event) => {
                                    const next = event.target.checked
                                      ? [...new Set([...(row.itemIds || []), item.id])]
                                      : (row.itemIds || []).filter((entry) => entry !== item.id);
                                    onContentWeekdayItemsChange(activeWeekday, next);
                                  }}
                                />
                                <span>{item.title}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {contentMode === 'all' && renderListPickerMenu('all', contentAll.listId, onContentAllListChange)}
              {contentMode === 'weekday' && openListPicker?.startsWith('weekday-') && (() => {
                const weekdayKey = openListPicker.replace('weekday-', '') as 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
                const selected = contentByWeekday[weekdayKey]?.listId || '';
                return renderListPickerMenu(openListPicker, selected, (listId) =>
                  onContentWeekdayListChange(weekdayKey, listId)
                );
              })()}

              {occurrenceItems.length > 0 && (
                <div className="calendar-event-contents-completion">
                  {occurrenceItems.map((entry) => (
                    <label key={entry.id} className="calendar-event-contents-item-row completion">
                      <input
                        type="checkbox"
                        checked={entry.completed}
                        onChange={(event) => onToggleOccurrenceItem(entry, event.target.checked)}
                      />
                      <button
                        type="button"
                        className="calendar-event-contents-item-link"
                        onClick={() => onOpenOccurrenceItem?.(entry)}
                      >
                        {entry.title}
                      </button>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {canOptimize && (
          <section className="calendar-event-task-link-block">
            <div className="calendar-event-task-link-row">
              <button
                type="button"
                className="calendar-event-link-tasks-btn calendar-event-ai-btn"
                onClick={onOptimizeBlock}
                disabled={isOptimizingBlock}
              >
                <img className="delta-ai-button-icon" src="/Delta-AI-Button.png" alt="" aria-hidden="true" width={13} height={13} />
                {isOptimizingBlock ? 'Optimizing...' : 'Optimize Block'}
              </button>
              {optimizeSource && (
                <span className="calendar-event-drawer-card-placeholder">Source: {optimizeSource === 'groq' ? 'ai' : optimizeSource}</span>
              )}
            </div>
            {optimizeError && (
              <p className="calendar-event-drawer-card-placeholder">{optimizeError}</p>
            )}
            <ProposalReviewTable
              title="Optimization Review"
              source={optimizeSource === 'groq' ? 'ai' : optimizeSource}
              rows={proposalRows}
              applying={proposalsApplying}
              onToggleRow={(id, approved) => onToggleProposalRow?.(id, approved)}
              onApproveSelected={() => onApproveSelectedProposals?.()}
              onCancel={() => onCancelProposals?.()}
            />
          </section>
        )}

        {canOptimize && (
          <section className="calendar-event-task-link-block">
            <div className="calendar-event-task-link-row">
              <button
                type="button"
                className="calendar-event-summary-btn"
                onClick={() => setNotesExpanded((prev) => !prev)}
              >
                <span>Notes</span>
                <strong>{notesExpanded ? 'Hide' : 'Show'}</strong>
              </button>
            </div>
            {notesExpanded && (
              <div className="calendar-event-drawer-card notes-expanded">
                {timeblockNotesLoading && (
                  <p className="calendar-event-drawer-card-placeholder">Loading notes...</p>
                )}
                {!timeblockNotesLoading && timeblockNotes.length > 0 && (
                  <div className="calendar-event-drawer-card notes-list">
                    {timeblockNotes.slice(-8).map((note) => (
                      <article key={note.id} className="calendar-event-drawer-card-row">
                        <strong>{note.author_type === 'ai' ? 'AI' : 'You'}</strong>
                        <span>{note.content}</span>
                        <span className="calendar-event-drawer-card-placeholder">{formatNoteTime(note.created_at)}</span>
                      </article>
                    ))}
                  </div>
                )}
                <textarea
                  className="calendar-event-description-input"
                  style={{ border: 'none', padding: '0.15rem 0', minHeight: '80px' }}
                  value={timeblockNoteDraft}
                  onChange={(event) => onTimeblockNoteDraftChange?.(event.target.value)}
                  placeholder="Write a note..."
                  onFocus={() => setNotesExpanded(true)}
                />
                {timeblockNoteError && (
                  <p className="calendar-event-drawer-card-placeholder">{timeblockNoteError}</p>
                )}
                <div className="calendar-event-task-link-row">
                  <button
                    type="button"
                    className="calendar-event-link-tasks-btn"
                    onClick={onSubmitTimeblockNote}
                    disabled={timeblockNoteSubmitting || !timeblockNoteDraft.trim()}
                  >
                    {timeblockNoteSubmitting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

      </div>

      <footer className="calendar-event-drawer-side-footer">
        <Button variant="secondary" className="calendar-event-secondary-btn" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="calendar-event-add-btn calendar-event-primary-btn" onClick={onSave}>
          {isCreateFlow ? 'Add' : 'Save'}
        </Button>
      </footer>
    </aside>
  );
}
