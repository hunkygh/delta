import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
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
  onOptimizeBlock?: (prompt?: string) => void;
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
  includeRecurringTasks: boolean;
  onToggleIncludeRecurringTasks: () => void;
  repeatTasksByItemId: Record<string, boolean>;
  onRepeatTasksForItemChange: (itemId: string, enabled: boolean) => void;
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
  parentItemTitleById?: Record<string, string>;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
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
  contentMode,
  onContentModeChange,
  contentListOptions,
  contentItemOptionsByList,
  contentAll,
  contentByWeekday,
  includeRecurringTasks,
  onToggleIncludeRecurringTasks,
  repeatTasksByItemId,
  onRepeatTasksForItemChange,
  onContentAllListChange,
  onContentAllItemsChange,
  onContentWeekdayListChange,
  onContentWeekdayItemsChange,
  occurrenceWeekday,
  occurrenceItems,
  onToggleOccurrenceItem,
  onOpenOccurrenceItem,
  onCancel,
  onSave,
  onDelete
}: EventDrawerProps): JSX.Element {
  const normalizeSearchText = (value: string): string =>
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’`"]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const levenshteinDistance = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j += 1) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[a.length][b.length];
  };

  const fuzzyTokenMatch = (needleRaw: string, haystackRaw: string): boolean => {
    const needle = normalizeSearchText(needleRaw);
    const haystack = normalizeSearchText(haystackRaw);
    if (!needle) return true;
    if (!haystack) return false;
    if (haystack.includes(needle)) return true;

    const needleParts = needle.split(' ').filter(Boolean);
    const hayParts = haystack.split(' ').filter(Boolean);
    return needleParts.every((needlePart) => {
      if (haystack.includes(needlePart)) return true;
      const maxDistance = needlePart.length <= 4 ? 1 : 2;
      return hayParts.some((hayPart) => {
        const distance = levenshteinDistance(needlePart, hayPart);
        return distance <= maxDistance;
      });
    });
  };

  const fuzzyScore = (queryRaw: string, targetRaw: string): number => {
    const query = normalizeSearchText(queryRaw);
    const target = normalizeSearchText(targetRaw);
    if (!query) return 1;
    if (!target) return 0;
    if (target.startsWith(query)) return 1;
    if (target.includes(query)) return 0.85;
    const queryParts = query.split(' ').filter(Boolean);
    const targetParts = target.split(' ').filter(Boolean);
    let matches = 0;
    for (const queryPart of queryParts) {
      const maxDistance = queryPart.length <= 4 ? 1 : 2;
      const found = targetParts.some((part) => levenshteinDistance(queryPart, part) <= maxDistance);
      if (found) matches += 1;
    }
    return queryParts.length ? matches / queryParts.length : 0;
  };

  type SlashAttachOption = {
    listId: string;
    listName: string;
    itemId: string;
    itemTitle: string;
  };
  const [attachSearch, setAttachSearch] = useState('');
  const [activeWeekday, setActiveWeekday] = useState<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>('mon');
  const [recurrenceExpanded, setRecurrenceExpanded] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [openDraftAssignId, setOpenDraftAssignId] = useState<string | null>(null);
  const [optimizePrompt, setOptimizePrompt] = useState('');
  const [optimizePromptOpen, setOptimizePromptOpen] = useState(false);
  const [slashAttachOpen, setSlashAttachOpen] = useState(false);
  const [slashAttachQuery, setSlashAttachQuery] = useState('');
  const [slashAttachIndex, setSlashAttachIndex] = useState(0);
  const [slashTokenStart, setSlashTokenStart] = useState<number | null>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
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
  const filterItemsForList = (listId: string): Array<{ id: string; title: string }> => {
    const source = contentItemOptionsByList[listId] || [];
    const query = attachSearch.trim();
    if (!query) return source;
    return source
      .filter((item) => fuzzyTokenMatch(query, item.title))
      .sort((a, b) => fuzzyScore(query, b.title) - fuzzyScore(query, a.title));
  };

  const slashAttachOptions = useMemo<SlashAttachOption[]>(() => {
    const rows: SlashAttachOption[] = [];
    for (const list of contentListOptions) {
      const items = contentItemOptionsByList[list.id] || [];
      for (const item of items) {
        rows.push({
          listId: list.id,
          listName: list.name,
          itemId: item.id,
          itemTitle: item.title
        });
      }
    }
    const query = slashAttachQuery.trim();
    if (!query) return rows.slice(0, 12);
    return rows
      .filter((row) => fuzzyTokenMatch(query, row.itemTitle) || fuzzyTokenMatch(query, row.listName))
      .sort(
        (a, b) =>
          Math.max(fuzzyScore(query, b.itemTitle), fuzzyScore(query, b.listName)) -
          Math.max(fuzzyScore(query, a.itemTitle), fuzzyScore(query, a.listName))
      )
      .slice(0, 20);
  }, [contentItemOptionsByList, contentListOptions, slashAttachQuery]);

  const attachedItemsRows = useMemo(() => {
    const byListId = new Map(contentListOptions.map((entry) => [entry.id, entry.name]));
    const currentSelection =
      contentMode === 'all'
        ? { listId: contentAll.listId, itemIds: contentAll.itemIds || [] }
        : contentByWeekday[activeWeekday] || { listId: '', itemIds: [] };

    if (!currentSelection.listId || !currentSelection.itemIds?.length) return [];
    const listId = currentSelection.listId;
    const listName = byListId.get(listId) || 'List';
    const source = contentItemOptionsByList[listId] || [];
    const itemById = new Map(source.map((entry) => [entry.id, entry.title]));

    return currentSelection.itemIds.map((itemId) => ({
      itemId,
      listId,
      listName,
      title: itemById.get(itemId) || 'Item'
    }));
  }, [activeWeekday, contentAll.itemIds, contentAll.listId, contentByWeekday, contentItemOptionsByList, contentListOptions, contentMode]);

  const closeSlashAttach = (): void => {
    setSlashAttachOpen(false);
    setSlashAttachQuery('');
    setSlashAttachIndex(0);
    setSlashTokenStart(null);
  };

  const applySlashAttach = (row: SlashAttachOption): void => {
    if (contentMode === 'all') {
      if (contentAll.listId !== row.listId) {
        onContentAllListChange(row.listId);
        onContentAllItemsChange([row.itemId]);
      } else {
        onContentAllItemsChange(Array.from(new Set([...(contentAll.itemIds || []), row.itemId])));
      }
    } else {
      const weekdayRow = contentByWeekday[activeWeekday];
      if ((weekdayRow?.listId || '') !== row.listId) {
        onContentWeekdayListChange(activeWeekday, row.listId);
        onContentWeekdayItemsChange(activeWeekday, [row.itemId]);
      } else {
        onContentWeekdayItemsChange(
          activeWeekday,
          Array.from(new Set([...(weekdayRow?.itemIds || []), row.itemId]))
        );
      }
    }

    if (slashTokenStart != null && descriptionInputRef.current) {
      const textarea = descriptionInputRef.current;
      const caret = textarea.selectionStart ?? description.length;
      const prefix = description.slice(0, slashTokenStart);
      const suffix = description.slice(caret);
      const mentionText = `@${row.itemTitle}`;
      const needsLeadingSpace = prefix.length > 0 && !/\s$/.test(prefix);
      const insertion = `${needsLeadingSpace ? ' ' : ''}${mentionText}`;
      const nextValue = `${prefix}${insertion}${suffix}`.replace(/[ \t]{2,}/g, ' ');
      onDescriptionChange(nextValue);
      window.requestAnimationFrame(() => {
        if (!descriptionInputRef.current) return;
        const nextCaret = (prefix + insertion).length;
        descriptionInputRef.current.selectionStart = nextCaret;
        descriptionInputRef.current.selectionEnd = nextCaret;
      });
    }
    closeSlashAttach();
  };

  const syncSlashQueryFromTextarea = (value: string, caret: number): void => {
    const slashIndex = value.lastIndexOf('/', Math.max(0, caret - 1));
    if (slashIndex === -1) {
      closeSlashAttach();
      return;
    }
    const token = value.slice(slashIndex + 1, caret);
    if (token.includes('\n')) {
      closeSlashAttach();
      return;
    }
    const hasBoundaryBefore = slashIndex === 0 || /\s/.test(value[slashIndex - 1] || '');
    if (!hasBoundaryBefore) {
      closeSlashAttach();
      return;
    }
    setSlashAttachOpen(true);
    setSlashTokenStart(slashIndex);
    setSlashAttachQuery(token.trim());
    setSlashAttachIndex(0);
  };

  useEffect(() => {
    if (!slashAttachOpen) return;
    setSlashAttachIndex((prev) => {
      if (slashAttachOptions.length === 0) return 0;
      if (prev >= slashAttachOptions.length) return slashAttachOptions.length - 1;
      return prev;
    });
  }, [slashAttachOpen, slashAttachOptions.length]);

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
            <label className="calendar-field calendar-event-time-field">
              <span>Start</span>
              <input
                className="calendar-input"
                type="datetime-local"
                value={start}
                onChange={(event) => onStartChange(event.target.value)}
              />
            </label>
            <label className="calendar-field calendar-event-time-field">
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
            ref={descriptionInputRef}
            className="calendar-event-description-input"
            value={description}
            onChange={(event) => {
              onDescriptionChange(event.target.value);
              syncSlashQueryFromTextarea(event.target.value, event.target.selectionStart ?? event.target.value.length);
            }}
            onKeyDown={(event) => {
              if (event.key === '/') {
                window.requestAnimationFrame(() => {
                  if (!descriptionInputRef.current) return;
                  const input = descriptionInputRef.current;
                  syncSlashQueryFromTextarea(input.value, input.selectionStart ?? input.value.length);
                });
                return;
              }

              if (!slashAttachOpen) return;
              if (event.key === 'Escape') {
                event.preventDefault();
                closeSlashAttach();
                return;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSlashAttachIndex((prev) =>
                  slashAttachOptions.length === 0 ? 0 : Math.min(prev + 1, slashAttachOptions.length - 1)
                );
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSlashAttachIndex((prev) => Math.max(prev - 1, 0));
                return;
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                if (slashAttachOptions[slashAttachIndex]) {
                  event.preventDefault();
                  applySlashAttach(slashAttachOptions[slashAttachIndex]);
                }
              }
            }}
            placeholder="Type notes… Press / to attach items"
          />
          {slashAttachOpen && (
            <div className="calendar-event-slash-popover" role="dialog" aria-label="Attach item">
              <div className="calendar-event-slash-results">
                {slashAttachOptions.length === 0 ? (
                  <p className="calendar-event-slash-empty">No matching items</p>
                ) : (
                  slashAttachOptions.map((row, index) => (
                    <button
                      key={`${row.listId}:${row.itemId}`}
                      type="button"
                      className={`calendar-event-slash-result ${index === slashAttachIndex ? 'active' : ''}`.trim()}
                      onMouseEnter={() => setSlashAttachIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applySlashAttach(row)}
                    >
                      <span className="calendar-event-slash-result-copy">
                        <strong>{row.itemTitle}</strong>
                        <small>{row.listName}</small>
                      </span>
                      <span className="calendar-event-slash-add" aria-hidden="true">
                        +
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="calendar-event-slash-footer">
                <button type="button" className="calendar-event-slash-advanced" onClick={onLinkTasks}>
                  Advanced picker
                </button>
              </div>
            </div>
          )}
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
              <label className="calendar-event-recurrence-row">
                <span>Include Tasks</span>
                <button
                  type="button"
                  className={`calendar-switch ${includeRecurringTasks ? 'on' : 'off'}`.trim()}
                  aria-label={`Include tasks ${includeRecurringTasks ? 'on' : 'off'}`}
                  onClick={onToggleIncludeRecurringTasks}
                >
                  <span className="calendar-switch-thumb" />
                </button>
              </label>
            </div>
          )}
        </section>

        <section className="calendar-event-task-link-block">
          <div className="calendar-event-task-link-row">
            <div className="calendar-event-attach-inline">
              {attachedItemsRows.length === 0 ? (
                <span className="calendar-event-attach-empty">no items attached</span>
              ) : (
                attachedItemsRows.map((row) => (
                  <div key={`${row.listId}:${row.itemId}`} className="calendar-event-attach-row-wrap">
                    <div className="calendar-event-attach-row">
                      <span className="calendar-event-attach-caret placeholder" aria-hidden="true" />
                      <span className="calendar-event-attach-status todo" aria-hidden="true" />
                      <button
                        type="button"
                        className="calendar-event-attach-inline-add"
                        onClick={() =>
                          onOpenOccurrenceItem?.({
                            id: row.itemId,
                            title: row.title,
                            completed: false,
                            kind: 'item'
                          })
                        }
                        aria-label="Open item"
                      >
                        +
                      </button>
                      <button type="button" className="calendar-event-attach-title">
                        {row.title}
                      </button>
                      <button
                        type="button"
                        className="calendar-event-attach-remove"
                        onClick={() => {
                          if (contentMode === 'all') {
                            onContentAllItemsChange((contentAll.itemIds || []).filter((entry) => entry !== row.itemId));
                            return;
                          }
                          const weekdayRow = contentByWeekday[activeWeekday];
                          const next = (weekdayRow?.itemIds || []).filter((entry) => entry !== row.itemId);
                          onContentWeekdayItemsChange(activeWeekday, next);
                        }}
                        aria-label="Remove item"
                      >
                        −
                      </button>
                      {recurrenceEnabled && includeRecurringTasks && (
                        <button
                          type="button"
                          className={`calendar-switch calendar-switch-inline ${repeatTasksByItemId[row.itemId] === false ? 'off' : 'on'}`.trim()}
                          aria-label={`Repeat tasks for ${row.title} ${(repeatTasksByItemId[row.itemId] === false) ? 'off' : 'on'}`}
                          onClick={() => onRepeatTasksForItemChange(row.itemId, repeatTasksByItemId[row.itemId] === false)}
                        >
                          <span className="calendar-switch-thumb" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {isTaskLinkRequested && (
          <div className="calendar-event-task-flyout" role="dialog" aria-label="Add items to time block">
            <div className="calendar-event-task-flyout-head">
              <p>Add Items</p>
              <div className="calendar-event-task-flyout-head-actions">
                {canOptimize && onOptimizeBlock && (
                  <button
                    type="button"
                    className="calendar-event-flyout-ai-btn"
                    onClick={() => setOptimizePromptOpen((prev) => !prev)}
                    aria-label="Ask Delta for item plan"
                  >
                    <img className="delta-ai-button-icon" src="/Delta-AI-Button.png" alt="" aria-hidden="true" width={13} height={13} />
                  </button>
                )}
                <button
                  type="button"
                  className="calendar-event-flyout-close-btn"
                  onClick={onLinkTasks}
                  aria-label="Close add items panel"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {canOptimize && onOptimizeBlock && optimizePromptOpen && (
              <form
                className="calendar-event-flyout-ai-prompt"
                onSubmit={(event) => {
                  event.preventDefault();
                  onOptimizeBlock(optimizePrompt.trim() || undefined);
                }}
              >
                <input
                  type="text"
                  value={optimizePrompt}
                  onChange={(event) => setOptimizePrompt(event.target.value)}
                  className="calendar-event-list-picker-search"
                  placeholder="Ask Delta what to pull into this block..."
                />
                <button type="submit" className="calendar-event-link-tasks-btn" disabled={isOptimizingBlock}>
                  {isOptimizingBlock ? 'Thinking…' : 'Run'}
                </button>
              </form>
            )}

            <div className="calendar-event-task-flyout-filter">
              <input
                type="text"
                value={attachSearch}
                onChange={(event) => setAttachSearch(event.target.value)}
                className="calendar-event-list-picker-search"
                placeholder="Search"
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
                  <label className="calendar-field">
                    <span>List</span>
                    <select
                      className="calendar-input calendar-event-list-select"
                      value={contentAll.listId}
                      onChange={(event) => onContentAllListChange(event.target.value)}
                    >
                      <option value="">Select list</option>
                      {contentListOptions.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {contentAll.listId && (
                    <div className="calendar-event-contents-items">
                      {filterItemsForList(contentAll.listId).map((item) => (
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
                    const options = row?.listId ? filterItemsForList(row.listId) : [];
                    return (
                      <div className="calendar-event-contents-weekday-panel">
                        <label className="calendar-field">
                          <span>List</span>
                          <select
                            className="calendar-input calendar-event-list-select"
                            value={row?.listId || ''}
                            onChange={(event) => onContentWeekdayListChange(activeWeekday, event.target.value)}
                          >
                            <option value="">Select list</option>
                            {contentListOptions.map((list) => (
                              <option key={list.id} value={list.id}>
                                {list.name}
                              </option>
                            ))}
                          </select>
                        </label>
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

            {canOptimize && (
              <div className="calendar-event-flyout-proposals">
                {optimizeError && <p className="calendar-event-drawer-card-placeholder">{optimizeError}</p>}
                <ProposalReviewTable
                  title="Optimization Review"
                  source={optimizeSource === 'groq' ? 'ai' : optimizeSource}
                  rows={proposalRows}
                  applying={proposalsApplying}
                  onToggleRow={(id, approved) => onToggleProposalRow?.(id, approved)}
                  onApproveSelected={() => onApproveSelectedProposals?.()}
                  onCancel={() => onCancelProposals?.()}
                />
              </div>
            )}
          </div>
        )}

      </div>

      <footer className="calendar-event-drawer-side-footer">
        {!isCreateFlow && onDelete && (
          <Button variant="secondary" className="calendar-event-delete-btn" onClick={onDelete}>
            Delete
          </Button>
        )}
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
