import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { BlockTask, CustomRecurrenceConfig, RecurrenceRule } from '../../types/Event';
import Button from '../Button';
import MarkdownText from '../MarkdownText';
import ProposalReviewTable, { type ProposalReviewRow } from '../ProposalReviewTable';
import type { StatusDialogOption } from '../StatusChangeDialog';

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
  contentRuleRows: Array<{
    id?: string;
    selector_type: 'all' | 'weekday';
    selector_value: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | null;
    list_id: string;
    item_ids: string[];
  }>;
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
  onCreateAndAttachSearchItem?: (
    title: string,
    options: {
      listId: string;
      weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | null;
      blockTaskId?: string | null;
    }
  ) => Promise<{ id: string; title?: string | null } | void> | void;
  onAttachExistingSearchItem?: (
    itemId: string,
    options: {
      listId: string;
      weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | null;
      blockTaskId?: string | null;
    }
  ) => Promise<void> | void;
  onCreateBlockTask?: (title: string) => Promise<BlockTask | void> | void;
  onUpdateBlockTask?: (blockTaskId: string, updates: { title?: string; description?: string }) => Promise<void> | void;
  onDeleteBlockTask?: (blockTaskId: string) => Promise<void> | void;
  onAttachItemToBlockTask?: (blockTaskId: string, itemId: string) => Promise<void> | void;
  onDetachItemFromBlockTask?: (blockTaskItemId: string) => Promise<void> | void;
  onCompleteAllBlockTaskItems?: (blockTaskId: string) => Promise<void> | void;
  onSubmitBlockTaskItemCompletion?: (
    payload: {
      blockTaskId: string;
      blockTaskItemId: string;
      itemId: string;
      checked: boolean;
      note: string;
      followUpTasks: string[];
      statusUpdate?: StatusDialogOption | null;
    }
  ) => Promise<void> | void;
  getBlockTaskItemStatusOptions?: (
    itemId: string
  ) => Promise<{ statuses: StatusDialogOption[]; currentStatusKey: string | null; currentStatusLabel: string }>;
  occurrenceWeekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | null;
  occurrenceItems: Array<{
    id: string;
    title: string;
    completed: boolean;
    kind: 'task' | 'item';
    parentItemId?: string;
  }>;
  occurrenceBlockTasks?: BlockTask[];
  onToggleOccurrenceItem: (
    entry: { id: string; title: string; completed: boolean; kind: 'task' | 'item'; parentItemId?: string },
    checked: boolean
  ) => void;
  onRequestOccurrenceStatusChange?: (entry: {
    id: string;
    title: string;
    completed: boolean;
    kind: 'task' | 'item';
    parentItemId?: string;
  }) => void;
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
  contentRuleRows,
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
  onCreateAndAttachSearchItem,
  onAttachExistingSearchItem,
  onCreateBlockTask,
  onUpdateBlockTask,
  onDeleteBlockTask,
  onAttachItemToBlockTask,
  onDetachItemFromBlockTask,
  onCompleteAllBlockTaskItems,
  onSubmitBlockTaskItemCompletion,
  getBlockTaskItemStatusOptions,
  occurrenceWeekday,
  occurrenceItems,
  occurrenceBlockTasks = [],
  onToggleOccurrenceItem,
  onRequestOccurrenceStatusChange,
  onOpenOccurrenceItem,
  parentItemTitleById,
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
    kind: 'existing' | 'create';
    listId: string;
    listName: string;
    itemId: string;
    itemTitle: string;
  };
  type BlockTaskAttachOption = {
    kind: 'existing' | 'create';
    listId: string;
    listName: string;
    itemId: string;
    itemTitle: string;
  };
  const [attachSearch, setAttachSearch] = useState('');
  const [activeWeekday, setActiveWeekday] = useState<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>('mon');
  const [recurrenceExpanded, setRecurrenceExpanded] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [blockTaskDraft, setBlockTaskDraft] = useState('');
  const [blockTaskCreateError, setBlockTaskCreateError] = useState<string | null>(null);
  const [blockTaskTitleDrafts, setBlockTaskTitleDrafts] = useState<Record<string, string>>({});
  const [openBlockTaskAttachId, setOpenBlockTaskAttachId] = useState<string | null>(null);
  const [blockTaskAttachQuery, setBlockTaskAttachQuery] = useState('');
  const [openBlockTaskCompletionId, setOpenBlockTaskCompletionId] = useState<string | null>(null);
  const [blockTaskCompletionNote, setBlockTaskCompletionNote] = useState('');
  const [blockTaskCompletionTasks, setBlockTaskCompletionTasks] = useState('');
  const [blockTaskCompletionStatuses, setBlockTaskCompletionStatuses] = useState<StatusDialogOption[]>([]);
  const [blockTaskCompletionSelectedStatusId, setBlockTaskCompletionSelectedStatusId] = useState('');
  const [blockTaskCompletionStatusLoading, setBlockTaskCompletionStatusLoading] = useState(false);
  const [openDraftAssignId, setOpenDraftAssignId] = useState<string | null>(null);
  const [optimizePrompt, setOptimizePrompt] = useState('');
  const [optimizePromptOpen, setOptimizePromptOpen] = useState(false);
  const [slashAttachOpen, setSlashAttachOpen] = useState(false);
  const [slashAttachQuery, setSlashAttachQuery] = useState('');
  const [slashAttachIndex, setSlashAttachIndex] = useState(0);
  const [slashTokenStart, setSlashTokenStart] = useState<number | null>(null);
  const [commandTrigger, setCommandTrigger] = useState<'/' | '+' | null>(null);
  const [recentInlineBlockTaskId, setRecentInlineBlockTaskId] = useState<string | null>(null);
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

  useEffect(() => {
    setBlockTaskTitleDrafts(Object.fromEntries(occurrenceBlockTasks.map((task) => [task.id, task.title])));
  }, [occurrenceBlockTasks]);

  useEffect(() => {
    if (!recentInlineBlockTaskId) return;
    const stillExists = occurrenceBlockTasks.some((task) => task.id === recentInlineBlockTaskId);
    if (!stillExists) {
      setRecentInlineBlockTaskId(null);
    }
  }, [occurrenceBlockTasks, recentInlineBlockTaskId]);
  const filterItemsForList = (listId: string): Array<{ id: string; title: string }> => {
    const source = contentItemOptionsByList[listId] || [];
    const query = attachSearch.trim();
    if (!query) return source;
    return source
      .filter((item) => fuzzyTokenMatch(query, item.title))
      .sort((a, b) => fuzzyScore(query, b.title) - fuzzyScore(query, a.title));
  };

  const attachedItemsRows = useMemo(() => {
    const byListId = new Map(contentListOptions.map((entry) => [entry.id, entry.name]));
    const scopedRules =
      contentMode === 'all'
        ? (contentRuleRows || []).filter((rule) => rule.selector_type === 'all')
        : (contentRuleRows || []).filter(
            (rule) => rule.selector_type === 'weekday' && rule.selector_value === activeWeekday
          );

    const rowsByKey = new Map<string, {
      itemId: string;
      listId: string;
      listName: string;
      title: string;
      removable: boolean;
      completed: boolean;
      kind: 'item' | 'task';
      parentItemId?: string;
    }>();

    scopedRules.forEach((rule) => {
      const listId = rule.list_id;
      if (!listId || !(rule.item_ids || []).length) return;
      const listName = byListId.get(listId) || 'List';
      const source = contentItemOptionsByList[listId] || [];
      const itemById = new Map(source.map((entry) => [entry.id, entry.title]));
      (rule.item_ids || []).forEach((itemId) => {
        rowsByKey.set(`item:${itemId}`, {
          itemId,
          listId,
          listName,
          title: itemById.get(itemId) || 'Item',
          removable: true,
          completed: false,
          kind: 'item',
          parentItemId: undefined
        });
      });
    });

    (occurrenceItems || []).forEach((entry) => {
      const key = `${entry.kind}:${entry.id}`;
      const existing = rowsByKey.get(key);
      rowsByKey.set(key, {
        itemId: entry.id,
        listId: existing?.listId || '',
        listName:
          existing?.listName ||
          (entry.kind === 'task'
            ? entry.parentItemId
              ? parentItemTitleById?.[entry.parentItemId] || 'Task'
              : 'Task'
            : 'Attached'),
        title: entry.title || existing?.title || 'Item',
        removable: entry.kind === 'item' ? existing?.removable ?? false : false,
        completed: Boolean(entry.completed),
        kind: entry.kind,
        parentItemId: entry.parentItemId
      });
    });
    const nestedItemIds = new Set(
      (occurrenceBlockTasks || []).flatMap((task) => task.linkedItems.map((linked) => linked.itemId))
    );
    return Array.from(rowsByKey.values()).filter((row) => row.kind !== 'item' || !nestedItemIds.has(row.itemId));
  }, [
    activeWeekday,
    contentItemOptionsByList,
    contentListOptions,
    contentMode,
    contentRuleRows,
    occurrenceBlockTasks,
    occurrenceItems,
    parentItemTitleById
  ]);

  const inferredAttachListId = useMemo(() => {
    const attachedListIds = [...new Set(attachedItemsRows.map((row) => row.listId).filter(Boolean))];
    if (attachedListIds.length === 1) {
      return attachedListIds[0];
    }
    return '';
  }, [attachedItemsRows]);

  const activeAttachListId =
    (contentMode === 'all' ? contentAll.listId : contentByWeekday[activeWeekday]?.listId) ||
    inferredAttachListId ||
    contentListOptions[0]?.id ||
    '';
  const activeAttachListName = listNameById.get(activeAttachListId) || contentListOptions[0]?.name || 'List';

  const blockTaskAttachOptions = useMemo<BlockTaskAttachOption[]>(() => {
    const rows: BlockTaskAttachOption[] = [];
    for (const list of contentListOptions) {
      const items = contentItemOptionsByList[list.id] || [];
      for (const item of items) {
        rows.push({
          kind: 'existing',
          listId: list.id,
          listName: list.name,
          itemId: item.id,
          itemTitle: item.title
        });
      }
    }
    const query = blockTaskAttachQuery.trim();
    if (!query) return rows.slice(0, 12);
    const normalizedQuery = normalizeSearchText(query);
    const filtered = rows
      .filter((row) => fuzzyTokenMatch(query, row.itemTitle) || fuzzyTokenMatch(query, row.listName))
      .sort(
        (a, b) =>
          Math.max(fuzzyScore(query, b.itemTitle), fuzzyScore(query, b.listName)) -
          Math.max(fuzzyScore(query, a.itemTitle), fuzzyScore(query, a.listName))
      )
      .slice(0, 20);
    const exactMatch =
      filtered.find((row) => normalizeSearchText(row.itemTitle) === normalizedQuery) ||
      rows.find((row) => normalizeSearchText(row.itemTitle) === normalizedQuery) ||
      null;
    const topRow: BlockTaskAttachOption =
      exactMatch
        ? exactMatch
        : {
            kind: 'create',
            listId: activeAttachListId,
            listName: activeAttachListName,
            itemId: `create:${normalizedQuery}`,
            itemTitle: query
          };
    return [topRow, ...filtered.filter((row) => !(row.listId === topRow.listId && row.itemId === topRow.itemId))].slice(0, 20);
  }, [blockTaskAttachQuery, contentItemOptionsByList, contentListOptions]);

  const slashAttachOptions = useMemo<SlashAttachOption[]>(() => {
    const rows: SlashAttachOption[] = [];
    for (const list of contentListOptions) {
      const items = contentItemOptionsByList[list.id] || [];
      for (const item of items) {
        rows.push({
          kind: 'existing',
          listId: list.id,
          listName: list.name,
          itemId: item.id,
          itemTitle: item.title
        });
      }
    }
    const query = slashAttachQuery.trim();
    if (!query) return rows.slice(0, 12);
    const normalizedQuery = normalizeSearchText(query);
    const filtered = rows
      .filter((row) => fuzzyTokenMatch(query, row.itemTitle) || fuzzyTokenMatch(query, row.listName))
      .sort(
        (a, b) =>
          Math.max(fuzzyScore(query, b.itemTitle), fuzzyScore(query, b.listName)) -
          Math.max(fuzzyScore(query, a.itemTitle), fuzzyScore(query, a.listName))
      )
      .slice(0, 20);

    const exactMatch =
      filtered.find((row) => normalizeSearchText(row.itemTitle) === normalizedQuery) ||
      rows.find((row) => normalizeSearchText(row.itemTitle) === normalizedQuery) ||
      null;

    const topRow: SlashAttachOption =
      exactMatch
        ? exactMatch
        : {
            kind: 'create',
            listId: activeAttachListId,
            listName: activeAttachListName,
            itemId: `create:${normalizedQuery}`,
            itemTitle: query
          };

    const deduped = [
      topRow,
      ...filtered.filter((row) => !(row.listId === topRow.listId && row.itemId === topRow.itemId))
    ];
    return deduped.slice(0, 20);
  }, [activeAttachListId, activeAttachListName, contentItemOptionsByList, contentListOptions, slashAttachQuery]);

  const recentInlineBlockTask =
    occurrenceBlockTasks.find((task) => task.id === recentInlineBlockTaskId) || null;

  const closeSlashAttach = (): void => {
    setSlashAttachOpen(false);
    setSlashAttachQuery('');
    setSlashAttachIndex(0);
    setSlashTokenStart(null);
    setCommandTrigger(null);
  };

  const commitBlockTaskTitle = async (task: BlockTask): Promise<void> => {
    const nextTitle = (blockTaskTitleDrafts[task.id] ?? task.title).trim();
    if (!nextTitle || nextTitle === task.title) {
      setBlockTaskTitleDrafts((prev) => ({ ...prev, [task.id]: task.title }));
      return;
    }
    await onUpdateBlockTask?.(task.id, { title: nextTitle });
  };

  const applySlashAttach = async (row: SlashAttachOption): Promise<void> => {
    const targetBlockTaskId = recentInlineBlockTask?.id || null;
    if (row.kind === 'create') {
      if (!row.itemTitle.trim() || !row.listId) return;
      await onCreateAndAttachSearchItem?.(row.itemTitle.trim(), {
        listId: row.listId,
        weekday: contentMode === 'weekday' ? activeWeekday : null,
        blockTaskId: targetBlockTaskId
      });
      closeSlashAttach();
      return;
    }
    if (onAttachExistingSearchItem) {
      await onAttachExistingSearchItem(row.itemId, {
        listId: row.listId,
        weekday: contentMode === 'weekday' ? activeWeekday : null,
        blockTaskId: targetBlockTaskId
      });
    } else if (contentMode === 'all') {
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

  const applyInlineBlockTaskCommand = async (): Promise<void> => {
    const title = slashAttachQuery.trim();
    if (!title) return;
    try {
      setBlockTaskCreateError(null);
      const created = (await onCreateBlockTask?.(title)) || null;
      if (created?.id) {
        setRecentInlineBlockTaskId(created.id);
      }
    } catch (error: any) {
      setBlockTaskCreateError(error?.message || 'Failed to create block task.');
      return;
    }
    if (slashTokenStart != null && descriptionInputRef.current) {
      const textarea = descriptionInputRef.current;
      const caret = textarea.selectionStart ?? description.length;
      const prefix = description.slice(0, slashTokenStart);
      const suffix = description.slice(caret);
      const taskText = `+${title}`;
      const needsLeadingSpace = prefix.length > 0 && !/\s$/.test(prefix);
      const insertion = `${needsLeadingSpace ? ' ' : ''}${taskText} `;
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

  const syncCommandQueryFromTextarea = (value: string, caret: number): void => {
    const searchStart = Math.max(0, caret - 1);
    const slashIndex = value.lastIndexOf('/', searchStart);
    const plusIndex = value.lastIndexOf('+', searchStart);
    const commandIndex = Math.max(slashIndex, plusIndex);
    if (commandIndex === -1) {
      closeSlashAttach();
      return;
    }
    const trigger = value[commandIndex] as '/' | '+';
    const token = value.slice(commandIndex + 1, caret);
    if (token.includes('\n')) {
      closeSlashAttach();
      return;
    }
    const hasBoundaryBefore = commandIndex === 0 || /\s/.test(value[commandIndex - 1] || '');
    if (!hasBoundaryBefore) {
      closeSlashAttach();
      return;
    }
    setSlashAttachOpen(true);
    setCommandTrigger(trigger);
    setSlashTokenStart(commandIndex);
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
              syncCommandQueryFromTextarea(event.target.value, event.target.selectionStart ?? event.target.value.length);
            }}
            onKeyDown={(event) => {
              if (event.key === '/') {
                window.requestAnimationFrame(() => {
                  if (!descriptionInputRef.current) return;
                  const input = descriptionInputRef.current;
                  syncCommandQueryFromTextarea(input.value, input.selectionStart ?? input.value.length);
                });
                return;
              }

              if (event.key === '+') {
                window.requestAnimationFrame(() => {
                  if (!descriptionInputRef.current) return;
                  const input = descriptionInputRef.current;
                  syncCommandQueryFromTextarea(input.value, input.selectionStart ?? input.value.length);
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
                if (commandTrigger === '+') {
                  event.preventDefault();
                  void applyInlineBlockTaskCommand();
                  return;
                }
                if (slashAttachOptions[slashAttachIndex]) {
                  event.preventDefault();
                  void applySlashAttach(slashAttachOptions[slashAttachIndex]);
                }
              }
            }}
            placeholder="Type notes… Press / to attach items or + to add block tasks"
          />
          {description.trim() ? <MarkdownText className="calendar-event-description-preview" text={description} /> : null}
          {slashAttachOpen && (
            <div
              className="calendar-event-slash-popover"
              role="dialog"
              aria-label={commandTrigger === '+' ? 'Create block task' : 'Attach item'}
            >
              <div className="calendar-event-slash-results">
                {commandTrigger === '+' ? (
                  <button
                    type="button"
                    className="calendar-event-slash-result active enter-target"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void applyInlineBlockTaskCommand()}
                  >
                    <span className="calendar-event-slash-result-copy">
                      <strong>{slashAttachQuery.trim() ? `Create block task "${slashAttachQuery.trim()}"` : 'Type a block task name'}</strong>
                      <small>
                        {recentInlineBlockTask
                          ? `Next /item commands attach under ${recentInlineBlockTask.title}`
                          : 'Press Enter to add a block-scoped task'}
                      </small>
                    </span>
                    <span className="calendar-event-slash-add" aria-hidden="true">
                      ↵
                    </span>
                  </button>
                ) : slashAttachOptions.length === 0 ? (
                  <p className="calendar-event-slash-empty">No matching items</p>
                ) : (
                  slashAttachOptions.map((row, index) => (
                    <button
                      key={`${row.listId}:${row.itemId}`}
                      type="button"
                      className={`calendar-event-slash-result ${index === slashAttachIndex ? 'active' : ''} ${index === 0 ? 'enter-target' : ''}`.trim()}
                      onMouseEnter={() => setSlashAttachIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void applySlashAttach(row)}
                    >
                      <span className="calendar-event-slash-result-copy">
                        <strong>{row.kind === 'create' ? `Create "${row.itemTitle}"` : row.itemTitle}</strong>
                        <small>{row.kind === 'create' ? `Attach to ${row.listName}` : row.listName}</small>
                      </span>
                      <span className="calendar-event-slash-add" aria-hidden="true">
                        {index === 0 ? '↵' : '+'}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="calendar-event-slash-footer">
                {commandTrigger === '/' ? (
                  <button type="button" className="calendar-event-slash-advanced" onClick={onLinkTasks}>
                    Advanced picker
                  </button>
                ) : (
                  <span className="calendar-event-slash-advanced">
                    {recentInlineBlockTask ? `Target task: ${recentInlineBlockTask.title}` : 'Creates a block task only'}
                  </span>
                )}
              </div>
              {blockTaskCreateError && commandTrigger === '+' ? (
                <p className="calendar-event-block-task-error">{blockTaskCreateError}</p>
              ) : null}
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
          {onCreateBlockTask ? (
            <>
              <form
                className="calendar-event-block-task-create"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = blockTaskDraft.trim();
                  if (!value) return;
                  void (async () => {
                    try {
                      setBlockTaskCreateError(null);
                      await onCreateBlockTask(value);
                      setBlockTaskDraft('');
                    } catch (error: any) {
                      setBlockTaskCreateError(error?.message || 'Failed to create block task.');
                    }
                  })();
                }}
              >
                <input
                  type="text"
                  value={blockTaskDraft}
                  onChange={(event) => setBlockTaskDraft(event.target.value)}
                  className="calendar-event-list-picker-search"
                  placeholder="Add block task"
                />
                <button type="submit" className="calendar-event-link-tasks-btn">
                  Add
                </button>
              </form>
              {blockTaskCreateError ? <p className="calendar-event-block-task-error">{blockTaskCreateError}</p> : null}
            </>
          ) : null}
          <div className="calendar-event-task-link-row">
            <div className="calendar-event-attach-inline">
              {occurrenceBlockTasks.length === 0 && attachedItemsRows.length === 0 ? (
                <span className="calendar-event-attach-empty">no items attached</span>
              ) : (
                <>
                  {occurrenceBlockTasks.map((task) => (
                    <div key={task.id} className="calendar-event-block-task">
                      <div className="calendar-event-block-task-head">
                        <div className="calendar-event-block-task-head-main">
                          <span className="calendar-event-block-task-kicker">Block Task</span>
                          <div className="calendar-event-block-task-title-row">
                            <input
                              type="text"
                              value={blockTaskTitleDrafts[task.id] ?? task.title}
                              onChange={(event) =>
                                setBlockTaskTitleDrafts((prev) => ({ ...prev, [task.id]: event.target.value }))
                              }
                              onBlur={() => void commitBlockTaskTitle(task)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void commitBlockTaskTitle(task);
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  setBlockTaskTitleDrafts((prev) => ({ ...prev, [task.id]: task.title }));
                                }
                              }}
                              className="calendar-event-block-task-title-input"
                            />
                          </div>
                        </div>
                        {onAttachItemToBlockTask ? (
                          <button
                            type="button"
                            className="calendar-event-block-task-attach-btn"
                            onClick={() => {
                              setOpenBlockTaskAttachId((prev) => (prev === task.id ? null : task.id));
                              setBlockTaskAttachQuery('');
                            }}
                            aria-label="Attach item to block task"
                          >
                            + Add Item
                          </button>
                        ) : null}
                        {task.description ? <span>{task.description}</span> : null}
                      </div>
                      {openBlockTaskAttachId === task.id && onAttachItemToBlockTask ? (
                        <div className="calendar-event-block-task-attach-menu">
                          <input
                            type="text"
                            value={blockTaskAttachQuery}
                            onChange={(event) => setBlockTaskAttachQuery(event.target.value)}
                            className="calendar-event-list-picker-search"
                            placeholder="Attach item to this block task"
                          />
                          <div className="calendar-event-block-task-attach-results">
                            {blockTaskAttachOptions
                              .filter((row) => !task.linkedItems.some((linked) => linked.itemId === row.itemId))
                              .map((row) => (
                                <button
                                  key={`${task.id}:${row.listId}:${row.itemId}`}
                                  type="button"
                                  className="calendar-event-block-task-attach-result"
                                  onClick={() => {
                                    void (async () => {
                                      if (row.kind === 'create') {
                                        await onCreateAndAttachSearchItem?.(row.itemTitle.trim(), {
                                          listId: row.listId,
                                          weekday: contentMode === 'weekday' ? activeWeekday : null,
                                          blockTaskId: task.id
                                        });
                                      } else {
                                        await onAttachItemToBlockTask?.(task.id, row.itemId);
                                      }
                                      setOpenBlockTaskAttachId(null);
                                      setBlockTaskAttachQuery('');
                                    })();
                                  }}
                                >
                                  <span className="calendar-event-block-task-attach-copy">
                                    <strong>{row.kind === 'create' ? `Create "${row.itemTitle}"` : row.itemTitle}</strong>
                                    <small>{row.kind === 'create' ? `Attach to ${row.listName}` : row.listName}</small>
                                  </span>
                                  <span className="calendar-event-slash-add" aria-hidden="true">
                                    {row.kind === 'create' ? '↵' : '+'}
                                  </span>
                                </button>
                              ))}
                          </div>
                        </div>
                      ) : null}
                      {task.linkedItems.length > 0 ? (
                        <div className="calendar-event-block-task-items">
                          {task.linkedItems.some((linked) => !linked.completedInContext) && onCompleteAllBlockTaskItems ? (
                            <div className="calendar-event-block-task-bulk-actions">
                              <button
                                type="button"
                                className="calendar-event-block-task-complete-all"
                                onClick={() => void onCompleteAllBlockTaskItems(task.id)}
                              >
                                Complete all
                              </button>
                            </div>
                          ) : null}
                          {task.linkedItems.map((linked) => (
                            <div key={linked.blockTaskItemId} className="calendar-event-attach-row block-task-child">
                              <span className="calendar-event-attach-caret placeholder" aria-hidden="true" />
                              <input
                                type="checkbox"
                                className="calendar-event-attach-check"
                                checked={Boolean(linked.completedInContext)}
                                onChange={(event) => {
                                  if (!event.target.checked) {
                                    void onSubmitBlockTaskItemCompletion?.({
                                      blockTaskId: task.id,
                                      blockTaskItemId: linked.blockTaskItemId,
                                      itemId: linked.itemId,
                                      checked: false,
                                      note: '',
                                      followUpTasks: []
                                    });
                                    return;
                                  }
                                  setOpenBlockTaskCompletionId(linked.blockTaskItemId);
                                  setBlockTaskCompletionNote('');
                                  setBlockTaskCompletionTasks('');
                                  setBlockTaskCompletionStatuses([]);
                                  setBlockTaskCompletionSelectedStatusId('');
                                  if (getBlockTaskItemStatusOptions) {
                                    setBlockTaskCompletionStatusLoading(true);
                                    void getBlockTaskItemStatusOptions(linked.itemId)
                                      .then((result) => {
                                        setBlockTaskCompletionStatuses(result.statuses || []);
                                        setBlockTaskCompletionSelectedStatusId('');
                                      })
                                      .finally(() => setBlockTaskCompletionStatusLoading(false));
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className={`calendar-event-attach-title ${linked.completedInContext ? 'completed' : ''}`.trim()}
                                onClick={() =>
                                  onOpenOccurrenceItem?.({
                                    id: linked.itemId,
                                    title: linked.title,
                                    completed: Boolean(linked.completedInContext),
                                    kind: 'item'
                                  })
                                }
                              >
                                {linked.title}
                              </button>
                              {onDetachItemFromBlockTask ? (
                                <button
                                  type="button"
                                  className="calendar-event-attach-remove"
                                  onClick={() => void onDetachItemFromBlockTask(linked.blockTaskItemId)}
                                  aria-label="Remove nested item"
                                >
                                  −
                                </button>
                              ) : null}
                            </div>
                          ))}
                          {task.linkedItems.map((linked) =>
                            openBlockTaskCompletionId === linked.blockTaskItemId ? (
                              <form
                                key={`${linked.blockTaskItemId}:completion`}
                                className="calendar-event-block-task-completion"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const followUpTasks = blockTaskCompletionTasks
                                    .split('\n')
                                    .map((entry) => entry.trim())
                                    .filter(Boolean);
                                  void onSubmitBlockTaskItemCompletion?.({
                                    blockTaskId: task.id,
                                    blockTaskItemId: linked.blockTaskItemId,
                                    itemId: linked.itemId,
                                    checked: true,
                                    note: blockTaskCompletionNote.trim(),
                                    followUpTasks,
                                    statusUpdate:
                                      blockTaskCompletionStatuses.find((status) => status.id === blockTaskCompletionSelectedStatusId) ||
                                      blockTaskCompletionStatuses.find((status) => status.key === blockTaskCompletionSelectedStatusId) ||
                                      null
                                  });
                                  setOpenBlockTaskCompletionId(null);
                                  setBlockTaskCompletionNote('');
                                  setBlockTaskCompletionTasks('');
                                  setBlockTaskCompletionStatuses([]);
                                  setBlockTaskCompletionSelectedStatusId('');
                                }}
                              >
                                <input
                                  type="text"
                                  value={blockTaskCompletionNote}
                                  onChange={(event) => setBlockTaskCompletionNote(event.target.value)}
                                  className="calendar-event-list-picker-search"
                                  placeholder="Completion note"
                                  autoFocus
                                />
                                <textarea
                                  value={blockTaskCompletionTasks}
                                  onChange={(event) => setBlockTaskCompletionTasks(event.target.value)}
                                  className="calendar-event-description-input calendar-event-block-task-completion-tasks"
                                  placeholder="Follow-up tasks, one per line"
                                  rows={3}
                                />
                                <label className="calendar-event-block-task-status-branch">
                                  <span>Optional status update</span>
                                  <select
                                    value={blockTaskCompletionSelectedStatusId}
                                    onChange={(event) => setBlockTaskCompletionSelectedStatusId(event.target.value)}
                                    disabled={blockTaskCompletionStatusLoading || blockTaskCompletionStatuses.length === 0}
                                  >
                                    <option value="">
                                      {blockTaskCompletionStatusLoading ? 'Loading statuses…' : 'Keep current status'}
                                    </option>
                                    {blockTaskCompletionStatuses.map((status) => (
                                      <option key={status.id || status.key} value={status.id || status.key}>
                                        {status.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className="calendar-event-block-task-completion-actions">
                                  <button
                                    type="button"
                                    className="calendar-event-secondary-btn block-task-inline-cancel"
                                    onClick={() => {
                                      setOpenBlockTaskCompletionId(null);
                                      setBlockTaskCompletionNote('');
                                      setBlockTaskCompletionTasks('');
                                      setBlockTaskCompletionStatuses([]);
                                      setBlockTaskCompletionSelectedStatusId('');
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button type="submit" className="calendar-event-link-tasks-btn">
                                    Save
                                  </button>
                                </div>
                              </form>
                            ) : null
                          )}
                        </div>
                      ) : null}
                      {onDeleteBlockTask ? (
                        <div className="calendar-event-block-task-footer">
                          <button
                            type="button"
                            className="calendar-event-block-task-delete"
                            onClick={() => void onDeleteBlockTask(task.id)}
                            aria-label="Delete block task"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {attachedItemsRows.map((row, index) => (
                    <div key={`${row.listId || 'attached'}:${row.itemId}:${index}`} className="calendar-event-attach-row-wrap">
                      <div className="calendar-event-attach-row">
                        <span className="calendar-event-attach-caret placeholder" aria-hidden="true" />
                        <input
                          type="checkbox"
                          className="calendar-event-attach-check"
                          checked={Boolean(row.completed)}
                          onChange={(event) => {
                            const entry = {
                              id: row.itemId,
                              title: row.title,
                              completed: Boolean(row.completed),
                              kind: row.kind,
                              parentItemId: row.parentItemId
                            };
                            if (onRequestOccurrenceStatusChange) {
                              onRequestOccurrenceStatusChange(entry);
                              return;
                            }
                            onToggleOccurrenceItem(entry, event.target.checked);
                          }}
                        />
                        <button
                          type="button"
                          className={`calendar-event-attach-title ${row.completed ? 'completed' : ''}`.trim()}
                          onClick={() =>
                            onOpenOccurrenceItem?.({
                              id: row.itemId,
                              title: row.title,
                              completed: Boolean(row.completed),
                              kind: row.kind,
                              parentItemId: row.parentItemId
                            })
                          }
                        >
                          {row.title}
                        </button>
                        <span className="calendar-event-attach-listname">{row.listName}</span>
                        {row.removable !== false && row.kind === 'item' && (
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
                        )}
                        {recurrenceEnabled && includeRecurringTasks && row.kind === 'item' && (
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
                  ))}
                </>
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

              {occurrenceItems.length > 0 && attachedItemsRows.length === 0 && (
                <div className="calendar-event-contents-completion">
                  {occurrenceItems.map((entry) => (
                    <label key={entry.id} className="calendar-event-contents-item-row completion">
                      <input
                        type="checkbox"
                        checked={entry.completed}
                        onChange={(event) => {
                          if (onRequestOccurrenceStatusChange) {
                            onRequestOccurrenceStatusChange(entry);
                            return;
                          }
                          onToggleOccurrenceItem(entry, event.target.checked);
                        }}
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
          <button type="button" className="calendar-event-delete-btn" onClick={onDelete} aria-label="Delete event">
            <Trash2 size={16} />
          </button>
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
