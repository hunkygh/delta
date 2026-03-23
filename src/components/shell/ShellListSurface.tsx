import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarBlank, CaretLeft, CaretRight, FunnelSimple, GearSix, Microphone, PaperPlaneTilt } from '@phosphor-icons/react';
import StatusSelect from '../FocalBoard/StatusSelect';
import focalBoardService from '../../services/focalBoardService';
import commentsService from '../../services/commentsService';
import listFieldService from '../../services/listFieldService';
import fieldOptionService from '../../services/fieldOptionService';
import itemFieldValueService from '../../services/itemFieldValueService';
import type { FieldOption, ItemFieldValue, ListField, ListFieldType } from '../../types/customFields';
import type { CustomRecurrenceConfig, RecurrenceRule } from '../../types/Event';

interface ShellListSurfaceProps {
  userId: string;
  listId: string;
  initialItemId?: string | null;
  mode?: 'list' | 'item';
  onOpenItem?: (itemId: string) => void;
  onBackToList?: () => void;
}

interface LaneStatus {
  id: string | null;
  key: string;
  name: string;
  color: string;
  order_num?: number;
}

interface SurfaceAction {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  subtask_status_id?: string | null;
  scheduled_at?: string | null;
  recurrence_rule?: RecurrenceRule | null;
  recurrence_config?: CustomRecurrenceConfig | null;
}

interface SurfaceItem {
  id: string;
  title: string;
  description?: string | null;
  order_num?: number;
  status?: string | null;
  status_id?: string | null;
  actions?: SurfaceAction[];
}

interface SurfaceListDetail {
  id: string;
  name: string;
  item_label?: string | null;
  action_label?: string | null;
  lane_statuses?: LaneStatus[];
  items?: SurfaceItem[];
}

interface ThreadComment {
  id: string;
  author_type: 'user' | 'ai' | 'system';
  content: string;
  created_at: string;
}

const DEFAULT_STATUSES: LaneStatus[] = [
  { id: null, key: 'pending', name: 'To do', color: '#94a3b8', order_num: 0 },
  { id: null, key: 'in_progress', name: 'In progress', color: '#f59e0b', order_num: 1 },
  { id: null, key: 'completed', name: 'Done', color: '#22c55e', order_num: 2 }
];

const DEFAULT_SUBTASK_STATUSES: LaneStatus[] = [
  { id: null, key: 'not_started', name: 'Not started', color: '#94a3b8', order_num: 0 },
  { id: null, key: 'done', name: 'Done', color: '#22c55e', order_num: 1 }
];

const STATUS_COLOR_OPTIONS = ['#94a3b8', '#5FA8D3', '#7B8CE6', '#9A7ED7', '#D97AA8', '#D28A53', '#E0B04A', '#5CB487'];
const QUICK_TASK_DAY_COUNT = 10;
const QUICK_TASK_WINDOW_SIZE = 3;
const MAX_QUICK_TASK_WINDOW_START = Math.max(0, QUICK_TASK_DAY_COUNT - QUICK_TASK_WINDOW_SIZE);

const normalizeItemsForStatuses = (rows: SurfaceItem[], laneStatuses: LaneStatus[]): SurfaceItem[] => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (!Array.isArray(laneStatuses) || laneStatuses.length === 0) return rows;

  const byId = new Map(laneStatuses.filter((entry) => Boolean(entry.id)).map((entry) => [entry.id as string, entry]));
  const byKey = new Map(laneStatuses.map((entry) => [entry.key, entry]));
  const fallback = [...laneStatuses].sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))[0];

  return rows.map((item) => {
    if (item.status_id && byId.has(item.status_id)) return item;
    if (item.status && byKey.has(item.status)) {
      const matched = byKey.get(item.status);
      return {
        ...item,
        status_id: matched?.id ?? null,
        status: matched?.key || item.status
      };
    }
    return {
      ...item,
      status_id: fallback?.id ?? null,
      status: fallback?.key || item.status || 'pending'
    };
  });
};

const formatCommentTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const getOptionById = (field: ListField, optionId?: string | null): FieldOption | null => {
  if (!optionId) return null;
  return (field.options || []).find((option) => option.id === optionId) || null;
};

const getDisplayValue = (field: ListField, value: ItemFieldValue | null): string => {
  if (!value) return '—';
  if (field.type === 'status' || field.type === 'select') {
    return getOptionById(field, value.option_id)?.label || '—';
  }
  if (field.type === 'text' || field.type === 'contact') return value.value_text || '—';
  if (field.type === 'number') return value.value_number != null ? String(value.value_number) : '—';
  if (field.type === 'date') return value.value_date ? new Date(value.value_date).toLocaleDateString() : '—';
  if (field.type === 'boolean') return value.value_boolean ? 'Yes' : 'No';
  return '—';
};

const parsePresetLabels = (value: string): string[] => {
  const seen = new Set<string>();
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => {
      const normalized = entry.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};

const getFieldEditorValue = (field: ListField, value: ItemFieldValue | null): string => {
  if (!value) return '';
  if (field.type === 'status' || field.type === 'select') return value.option_id || '';
  if (field.type === 'number') return value.value_number != null ? String(value.value_number) : '';
  if (field.type === 'date') return value.value_date ? new Date(value.value_date).toISOString().slice(0, 10) : '';
  if (field.type === 'boolean') return value.value_boolean === true ? 'true' : value.value_boolean === false ? 'false' : '';
  return value.value_text || '';
};

const DEFAULT_ACTION_RECURRENCE_CONFIG: CustomRecurrenceConfig = {
  unit: 'week',
  interval: 1,
  limitType: 'indefinite'
};

const toDateTimeLocalValue = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const fromDateTimeLocalValue = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toDateInputValue = (value?: string | null): string => {
  if (!value) return '';
  return toDateTimeLocalValue(value).slice(0, 10);
};

const toTimeInputValue = (value?: string | null): string => {
  if (!value) return '';
  return toDateTimeLocalValue(value).slice(11, 16);
};

const mergeDateAndTimeInput = (existingIso: string | null | undefined, nextDate: string, nextTime: string): string | null => {
  const base = existingIso ? new Date(existingIso) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const offset = base.getTimezoneOffset();
  const localBase = new Date(base.getTime() - offset * 60000);
  const datePart = nextDate || localBase.toISOString().slice(0, 10);
  const timePart = nextTime || localBase.toISOString().slice(11, 16);
  return fromDateTimeLocalValue(`${datePart}T${timePart}`);
};

const normalizeActionRecurrenceConfig = (
  recurrence: RecurrenceRule,
  config?: CustomRecurrenceConfig | null
): CustomRecurrenceConfig => {
  const safe = config || DEFAULT_ACTION_RECURRENCE_CONFIG;
  if (recurrence === 'daily') return { ...safe, unit: 'day', interval: Math.max(1, safe.interval || 1) };
  if (recurrence === 'weekly') return { ...safe, unit: 'week', interval: Math.max(1, safe.interval || 1) };
  if (recurrence === 'monthly') return { ...safe, unit: 'month', interval: Math.max(1, safe.interval || 1) };
  return {
    ...safe,
    interval: Math.max(1, safe.interval || 1)
  };
};

const formatActionRecurrenceSummary = (recurrence: RecurrenceRule, config?: CustomRecurrenceConfig | null): string => {
  if (!recurrence || recurrence === 'none') return 'Once';
  if (recurrence === 'daily') return 'Daily';
  if (recurrence === 'weekly') return 'Weekly';
  if (recurrence === 'monthly') return 'Monthly';
  const safe = normalizeActionRecurrenceConfig('custom', config);
  const unitLabel = safe.unit === 'day' ? 'day' : safe.unit === 'week' ? 'week' : safe.unit === 'year' ? 'year' : 'month';
  const plural = safe.interval === 1 ? unitLabel : `${unitLabel}s`;
  return `Every ${safe.interval} ${plural}`;
};

const startOfLocalDay = (value?: Date | string | null): Date => {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const addLocalDays = (value: Date, amount: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return startOfLocalDay(next);
};

const addLocalMonths = (value: Date, amount: number): Date => new Date(value.getFullYear(), value.getMonth() + amount, 1);

const isSameLocalDay = (left?: Date | string | null, right?: Date | string | null): boolean => {
  if (!left || !right) return false;
  const a = startOfLocalDay(left);
  const b = startOfLocalDay(right);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

const formatTaskQuickDateLabel = (date: Date, offset: number): string => {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { weekday: 'long' });
};

const formatTaskQuickDateMeta = (date: Date): string =>
  date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });

const formatTaskCalendarMonth = (date: Date): string =>
  date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildTaskCalendarDays = (month: Date): Date[] => {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = addLocalDays(monthStart, -monthStart.getDay());
  return Array.from({ length: 42 }, (_, index) => addLocalDays(gridStart, index));
};

export default function ShellListSurface({
  userId,
  listId,
  initialItemId = null,
  mode = 'list',
  onOpenItem,
  onBackToList
}: ShellListSurfaceProps): JSX.Element {
  const [detail, setDetail] = useState<SurfaceListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<LaneStatus[]>([]);
  const [subtaskStatuses, setSubtaskStatuses] = useState<LaneStatus[]>(DEFAULT_SUBTASK_STATUSES);
  const [fields, setFields] = useState<ListField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, ItemFieldValue>>>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialItemId);
  const [inlineAddStatusId, setInlineAddStatusId] = useState<string | null>(null);
  const [inlineItemDraft, setInlineItemDraft] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [selectedTitleDraft, setSelectedTitleDraft] = useState('');
  const [selectedDescriptionDraft, setSelectedDescriptionDraft] = useState('');
  const [savingSelectedItem, setSavingSelectedItem] = useState(false);
  const [activeFieldEditorId, setActiveFieldEditorId] = useState<string | null>(null);
  const [activeFieldDraft, setActiveFieldDraft] = useState('');
  const [actionDraft, setActionDraft] = useState('');
  const [savingAction, setSavingAction] = useState(false);
  const [expandedActionIds, setExpandedActionIds] = useState<Record<string, boolean>>({});
  const [actionSaveState, setActionSaveState] = useState<Record<string, 'saved' | 'saving' | 'retrying'>>({});
  const [completionComposerActionId, setCompletionComposerActionId] = useState<string | null>(null);
  const [completionNoteDraft, setCompletionNoteDraft] = useState('');
  const [completionNextTaskDraft, setCompletionNextTaskDraft] = useState('');
  const [completionSaving, setCompletionSaving] = useState(false);
  const [openTaskDatePickerId, setOpenTaskDatePickerId] = useState<string | null>(null);
  const [taskDatePickerMonth, setTaskDatePickerMonth] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [taskDateWindowStart, setTaskDateWindowStart] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentVoiceMode, setCommentVoiceMode] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState(STATUS_COLOR_OPTIONS[0]);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<ListFieldType>('text');
  const [newFieldPresets, setNewFieldPresets] = useState('');
  const [fieldSubmitting, setFieldSubmitting] = useState(false);
  const activeFieldEditorRef = useRef<HTMLDivElement | null>(null);
  const taskDatePickerRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [data, loadedFields, loadedFieldValues, loadedStatuses, loadedSubtaskStatuses] = await Promise.all([
        focalBoardService.getListDetail(listId),
        listFieldService.getFields(listId),
        itemFieldValueService.bulkFetchForList(listId),
        focalBoardService.getLaneStatuses(listId),
        focalBoardService.getLaneSubtaskStatuses(listId)
      ]);

      const nextStatuses = ((loadedStatuses || data?.lane_statuses || []) as LaneStatus[]).length
        ? ([...(loadedStatuses || data?.lane_statuses || [])] as LaneStatus[]).sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
        : DEFAULT_STATUSES;
      const nextItems = normalizeItemsForStatuses((data?.items || []) as SurfaceItem[], nextStatuses);

      setStatuses(nextStatuses);
      setSubtaskStatuses(
        ((loadedSubtaskStatuses || []) as LaneStatus[]).length
          ? ([...(loadedSubtaskStatuses || [])] as LaneStatus[]).sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
          : DEFAULT_SUBTASK_STATUSES
      );
      setFields(loadedFields || []);
      setFieldValues(loadedFieldValues || {});
      setDetail({
        ...(data || {}),
        items: nextItems
      });
      setSelectedItemId((prev) => {
        if (initialItemId && nextItems.some((item) => item.id === initialItemId)) return initialItemId;
        if (prev && nextItems.some((item) => item.id === prev)) return prev;
        return nextItems[0]?.id || null;
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load list');
    } finally {
      setLoading(false);
    }
  }, [initialItemId, listId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(`delta-shell-list-filter:${listId}`);
    if (saved) setStatusFilter(saved);
  }, [listId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`delta-shell-list-filter:${listId}`, statusFilter);
  }, [listId, statusFilter]);

  useEffect(() => {
    if (!configureOpen) setFilterMenuOpen(false);
  }, [configureOpen]);

  const selectedItem =
    (detail?.items || []).find((item) => item.id === selectedItemId) ||
    (detail?.items || [])[0] ||
    null;

  useEffect(() => {
    setSelectedTitleDraft(selectedItem?.title || '');
    setSelectedDescriptionDraft(selectedItem?.description || '');
    setExpandedActionIds({});
    setCompletionComposerActionId(null);
    setCompletionNoteDraft('');
    setCompletionNextTaskDraft('');
    setOpenTaskDatePickerId(null);
  }, [selectedItem?.description, selectedItem?.id, selectedItem?.title]);

  useEffect(() => {
    if (!activeFieldEditorId) return;
    const handlePointerDown = (event: MouseEvent): void => {
      if (activeFieldEditorRef.current && !activeFieldEditorRef.current.contains(event.target as Node)) {
        setActiveFieldEditorId(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [activeFieldEditorId]);

  useEffect(() => {
    if (!openTaskDatePickerId) return;
    const handlePointerDown = (event: MouseEvent): void => {
      if (taskDatePickerRef.current && !taskDatePickerRef.current.contains(event.target as Node)) {
        setOpenTaskDatePickerId(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openTaskDatePickerId]);

  useEffect(() => {
    const loadComments = async (): Promise<void> => {
      if (!selectedItemId) {
        setComments([]);
        return;
      }
      setCommentsLoading(true);
      setCommentError(null);
      try {
        const [legacyComments, scopedComments] = await Promise.all([
          commentsService.getItemComments(selectedItemId, 50),
          focalBoardService.getScopedComments('item', selectedItemId, userId)
        ]);
        const merged: ThreadComment[] = [
          ...(legacyComments || []).map((entry: any) => ({
            id: `legacy-${entry.id}`,
            author_type: 'user' as const,
            content: entry.body,
            created_at: entry.created_at
          })),
          ...(scopedComments || []).map((entry: any) => ({
            id: `thread-${entry.id}`,
            author_type: entry.author_type === 'ai' ? 'ai' : entry.author_type === 'system' ? 'system' : 'user',
            content: entry.content,
            created_at: entry.created_at
          }))
        ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setComments(merged);
      } catch (err: any) {
        setCommentError(err?.message || 'Failed to load comments');
      } finally {
        setCommentsLoading(false);
      }
    };
    void loadComments();
  }, [selectedItemId, userId]);

  const updateItemLocally = (itemId: string, patch: Partial<SurfaceItem>): void => {
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            items: (prev.items || []).map((entry) => (entry.id === itemId ? { ...entry, ...patch } : entry))
          }
        : prev
    );
  };

  const createItemForStatus = async (status: LaneStatus, titleOverride?: string): Promise<void> => {
    const title = (titleOverride ?? inlineItemDraft).trim();
    if (!title) return;
    setSavingItem(true);
    try {
      const created = await focalBoardService.createItem(listId, userId, title, null);
      if (status.id || status.key !== (created.status || 'pending')) {
        await focalBoardService.updateItem(created.id, {
          status: status.key,
          status_id: status.id || null
        });
      }
      setInlineItemDraft('');
      setInlineAddStatusId(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create item');
    } finally {
      setSavingItem(false);
    }
  };

  const saveSelectedItem = async (): Promise<void> => {
    if (!selectedItem) return;
    setSavingSelectedItem(true);
    try {
      const updated = await focalBoardService.updateItem(selectedItem.id, {
        title: selectedTitleDraft.trim() || selectedItem.title,
        description: selectedDescriptionDraft.trim() || null
      });
      updateItemLocally(selectedItem.id, updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to save item');
    } finally {
      setSavingSelectedItem(false);
    }
  };

  const createAction = async (): Promise<void> => {
    if (!selectedItem) return;
    const title = actionDraft.trim();
    if (!title) return;
    setSavingAction(true);
    try {
      const defaultStatus =
        subtaskStatuses.find((entry: any) => Boolean(entry.is_default)) || subtaskStatuses[0] || DEFAULT_SUBTASK_STATUSES[0];
      await focalBoardService.createAction(selectedItem.id, userId, title, null, null, defaultStatus);
      setActionDraft('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create task');
    } finally {
      setSavingAction(false);
    }
  };

  const updateActionStatus = async (actionId: string, status: LaneStatus): Promise<void> => {
    if (!selectedItem) return;
    const normalizedKey = status.key || 'not_started';
    updateActionLocally(actionId, {
      status: normalizedKey,
      subtask_status_id: status.id || null
    });
    try {
      const updated = await focalBoardService.updateAction(actionId, {
        status: normalizedKey,
        subtask_status_id: status.id || null
      });
      updateActionLocally(actionId, {
        status: updated.status,
        subtask_status_id: updated.subtask_status_id ?? null
      });
      if (normalizedKey === 'done' || normalizedKey === 'completed') {
        setCompletionComposerActionId(actionId);
      }
    } catch (err: any) {
      updateActionLocally(actionId, {
        status: selectedItem.actions?.find((action) => action.id === actionId)?.status ?? null,
        subtask_status_id: selectedItem.actions?.find((action) => action.id === actionId)?.subtask_status_id ?? null
      });
      setError(err?.message || 'Failed to update task');
    }
  };

  const updateActionLocally = useCallback(
    (actionId: string, patch: Partial<SurfaceAction>): void => {
      if (!selectedItem) return;
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              items: (prev.items || []).map((item) =>
                item.id === selectedItem.id
                  ? {
                      ...item,
                      actions: (item.actions || []).map((action) => (action.id === actionId ? { ...action, ...patch } : action))
                    }
                  : item
              )
            }
          : prev
      );
    },
    [selectedItem]
  );

  const persistActionDraft = useCallback(
    async (action: SurfaceAction, updates: Partial<SurfaceAction>): Promise<void> => {
      if (!selectedItem) return;
      setActionSaveState((prev) => ({ ...prev, [action.id]: 'saving' }));
      try {
        const persisted = await focalBoardService.updateAction(action.id, updates);
        updateActionLocally(action.id, {
          title: persisted.title,
          description: persisted.description,
          status: persisted.status,
          subtask_status_id: persisted.subtask_status_id ?? null,
          scheduled_at: persisted.scheduled_at ?? null,
          recurrence_rule: persisted.recurrence_rule ?? null,
          recurrence_config: persisted.recurrence_config ?? null
        });
        setActionSaveState((prev) => ({ ...prev, [action.id]: 'saved' }));
      } catch (err: any) {
        setActionSaveState((prev) => ({ ...prev, [action.id]: 'retrying' }));
        setError(err?.message || 'Failed to save task');
      }
    },
    [selectedItem, updateActionLocally]
  );

  const applyActionScheduledDate = useCallback(
    (action: SurfaceAction, nextDate: string | null): void => {
      const nextScheduledAt = nextDate
        ? mergeDateAndTimeInput(action.scheduled_at, nextDate, toTimeInputValue(action.scheduled_at) || '09:00')
        : null;
      updateActionLocally(action.id, { scheduled_at: nextScheduledAt });
      void persistActionDraft(action, { ...action, scheduled_at: nextScheduledAt });
    },
    [persistActionDraft, updateActionLocally]
  );

  const openTaskDatePicker = useCallback((action: SurfaceAction): void => {
    const activeDate = startOfLocalDay(action.scheduled_at || new Date());
    setTaskDatePickerMonth(new Date(activeDate.getFullYear(), activeDate.getMonth(), 1));
    setOpenTaskDatePickerId((prev) => (prev === action.id ? null : action.id));
  }, []);

  const shiftTaskDateWindow = useCallback(
    (actionId: string, direction: -1 | 1): void => {
      setTaskDateWindowStart((prev) => {
        const current = prev[actionId] ?? 0;
        const next = Math.max(0, Math.min(MAX_QUICK_TASK_WINDOW_START, current + direction));
        if (next === current) return prev;
        return {
          ...prev,
          [actionId]: next
        };
      });
    },
    []
  );

  const submitCompletionComposer = useCallback(async (): Promise<void> => {
    if (!selectedItem || !completionComposerActionId) return;
    const targetAction = (selectedItem.actions || []).find((entry) => entry.id === completionComposerActionId);
    if (!targetAction) return;
    setCompletionSaving(true);
    const doneStatus =
      subtaskStatuses.find((entry) => entry.key === 'done' || entry.key === 'completed') || subtaskStatuses[0] || DEFAULT_SUBTASK_STATUSES[1];
    try {
      await persistActionDraft(targetAction, {
        status: doneStatus.key,
        subtask_status_id: doneStatus.id || null,
        description: completionNoteDraft.trim() ? completionNoteDraft.trim() : targetAction.description || null
      });
      if (completionNextTaskDraft.trim()) {
        const defaultStatus =
          subtaskStatuses.find((entry: any) => Boolean(entry.is_default)) || subtaskStatuses[0] || DEFAULT_SUBTASK_STATUSES[0];
        await focalBoardService.createAction(selectedItem.id, userId, completionNextTaskDraft.trim(), null, null, defaultStatus);
        await load();
      }
      setCompletionComposerActionId(null);
      setCompletionNoteDraft('');
      setCompletionNextTaskDraft('');
    } catch (err: any) {
      setError(err?.message || 'Failed to complete task');
    } finally {
      setCompletionSaving(false);
    }
  }, [completionComposerActionId, completionNextTaskDraft, completionNoteDraft, load, persistActionDraft, selectedItem, subtaskStatuses, userId]);

  const applyLocalFieldValue = useCallback(
    (fieldId: string, nextValue: ItemFieldValue | null): void => {
      if (!selectedItem) return;
      setFieldValues((prev) => {
        const itemValues = { ...(prev[selectedItem.id] || {}) };
        if (nextValue) {
          itemValues[fieldId] = nextValue;
        } else {
          delete itemValues[fieldId];
        }
        return {
          ...prev,
          [selectedItem.id]: itemValues
        };
      });
    },
    [selectedItem]
  );

  const openFieldEditor = useCallback(
    (field: ListField): void => {
      if (!selectedItem) return;
      const currentValue = fieldValues[selectedItem.id]?.[field.id] || null;
      setActiveFieldEditorId(field.id);
      setActiveFieldDraft(getFieldEditorValue(field, currentValue));
    },
    [fieldValues, selectedItem]
  );

  const commitFieldValue = useCallback(
    async (field: ListField, draftOverride?: string): Promise<void> => {
      if (!selectedItem) return;
      const rawValue = draftOverride ?? activeFieldDraft;
      try {
        let saved: ItemFieldValue | null = null;
        if (field.type === 'status' || field.type === 'select') {
          if (!rawValue) {
            await itemFieldValueService.deleteValue(selectedItem.id, field.id);
          } else {
            saved = await itemFieldValueService.upsertValue(userId, selectedItem.id, field.id, { option_id: rawValue });
          }
        } else if (field.type === 'number') {
          const trimmed = rawValue.trim();
          if (!trimmed) {
            await itemFieldValueService.deleteValue(selectedItem.id, field.id);
          } else {
            const parsed = Number(trimmed);
            if (Number.isNaN(parsed)) {
              setError('Enter a valid number');
              return;
            }
            saved = await itemFieldValueService.upsertValue(userId, selectedItem.id, field.id, { value_number: parsed });
          }
        } else if (field.type === 'date') {
          if (!rawValue) {
            await itemFieldValueService.deleteValue(selectedItem.id, field.id);
          } else {
            saved = await itemFieldValueService.upsertValue(userId, selectedItem.id, field.id, {
              value_date: new Date(rawValue).toISOString()
            });
          }
        } else if (field.type === 'boolean') {
          if (!rawValue) {
            await itemFieldValueService.deleteValue(selectedItem.id, field.id);
          } else {
            saved = await itemFieldValueService.upsertValue(userId, selectedItem.id, field.id, {
              value_boolean: rawValue === 'true'
            });
          }
        } else {
          const trimmed = rawValue.trim();
          if (!trimmed) {
            await itemFieldValueService.deleteValue(selectedItem.id, field.id);
          } else {
            saved = await itemFieldValueService.upsertValue(userId, selectedItem.id, field.id, { value_text: trimmed });
          }
        }
        applyLocalFieldValue(field.id, saved);
        setActiveFieldEditorId(null);
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Failed to save field');
      }
    },
    [activeFieldDraft, applyLocalFieldValue, selectedItem, userId]
  );

  const createStatus = async (): Promise<void> => {
    const label = newStatusName.trim();
    if (!label) return;
    setStatusSubmitting(true);
    setError(null);
    try {
      await focalBoardService.createLaneStatus(listId, userId, {
        key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        name: label,
        color: newStatusColor,
        group_key: 'todo',
        order_num: statuses.length,
        is_default: false
      });
      setNewStatusName('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create status');
    } finally {
      setStatusSubmitting(false);
    }
  };

  const createField = async (): Promise<void> => {
    const name = newFieldName.trim();
    if (!name) return;
    const presetLabels = parsePresetLabels(newFieldPresets);
    setFieldSubmitting(true);
    setError(null);
    try {
      const createdField = await listFieldService.createField(listId, {
        user_id: userId,
        name,
        type: newFieldType,
        order_index: fields.length,
        is_pinned: true,
        is_required: false
      });
      if ((newFieldType === 'select' || newFieldType === 'status') && presetLabels.length > 0) {
        await Promise.all(
          presetLabels.map((label, index) =>
            fieldOptionService.createOption(createdField.id, {
              user_id: userId,
              label,
              order_index: index
            })
          )
        );
      }
      setNewFieldName('');
      setNewFieldPresets('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create field');
    } finally {
      setFieldSubmitting(false);
    }
  };

  const sendComment = async (): Promise<void> => {
    if (!selectedItemId) return;
    const body = commentDraft.trim();
    if (!body) return;
    setCommentSubmitting(true);
    setCommentError(null);
    try {
      const created = await focalBoardService.createScopedComment('item', selectedItemId, userId, body, 'user');
      setComments((prev) => [
        ...prev,
        {
          id: `thread-${created.id}`,
          author_type: 'user',
          content: created.content,
          created_at: created.created_at
        }
      ]);
      setCommentDraft('');
    } catch (err: any) {
      setCommentError(err?.message || 'Failed to send comment');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const groupedStatuses = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        items: (detail?.items || []).filter((item) =>
          status.id ? item.status_id === status.id : (item.status || 'pending') === status.key
        )
      })),
    [detail?.items, statuses]
  );

  const visibleStatuses = useMemo(() => {
    if (statusFilter === 'all') return groupedStatuses;
    return groupedStatuses.filter(({ status }) => (status.id || status.key) === statusFilter || status.key === statusFilter);
  }, [groupedStatuses, statusFilter]);

  const pinnedFields = useMemo(
    () => [...fields].filter((field) => field.is_pinned).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [fields]
  );

  const completedCount = useMemo(
    () => (detail?.items || []).filter((item) => (item.status || '').includes('completed')).length,
    [detail?.items]
  );
  const totalItems = (detail?.items || []).length;
  const totalActions = useMemo(
    () => (detail?.items || []).reduce((sum, item) => sum + (item.actions?.length || 0), 0),
    [detail?.items]
  );
  const activeStatuses = useMemo(() => groupedStatuses.filter(({ items }) => items.length > 0).length, [groupedStatuses]);
  const quickTaskDates = useMemo(
    () => Array.from({ length: QUICK_TASK_DAY_COUNT }, (_, index) => addLocalDays(startOfLocalDay(new Date()), index)),
    []
  );
  const taskCalendarWeekdays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);
  const maxTaskDateWindowStart = MAX_QUICK_TASK_WINDOW_START;
  const compactFieldPairs = useMemo(
    () =>
      fields.map((field) => {
        const value = selectedItem ? fieldValues[selectedItem.id]?.[field.id] || null : null;
        const displayValue = getDisplayValue(field, value);
        return {
          id: field.id,
          label: field.name,
          value: displayValue === '—' ? 'none set' : displayValue,
          isEmpty: displayValue === '—',
          field
        };
      }),
    [fieldValues, fields, selectedItem]
  );

  const updateSelectedItemStatus = useCallback(
    async (status: LaneStatus): Promise<void> => {
      if (!selectedItem) return;
      try {
        const updated = await focalBoardService.updateItem(selectedItem.id, {
          status: status.key,
          status_id: status.id || null
        });
        updateItemLocally(selectedItem.id, {
          status: updated.status,
          status_id: updated.status_id ?? null
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to save item');
      }
    },
    [selectedItem]
  );

  if (mode === 'list') {
    return (
      <div className="shell-space-panel shell-space-panel-list-single">
        <section className="shell-shell-list-overview shell-shell-list-overview-only">
          <div className="shell-shell-list-panel shell-shell-list-overview-shell">
            <div className="shell-shell-list-overview-head">
              <div className="shell-shell-list-overview-meta">
                <p>
                  {totalItems} {(detail?.item_label || 'item').toLowerCase()}
                  {totalItems === 1 ? '' : 's'} across {statuses.length} column{statuses.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="shell-shell-list-overview-actions">
                <button type="button" className="shell-shell-list-icon-btn" onClick={() => setConfigureOpen((prev) => !prev)} aria-label="Configure list">
                  <GearSix size={16} />
                </button>
                <div className={`shell-shell-list-filter-wrap ${configureOpen ? 'open' : ''}`.trim()}>
                  <button
                    type="button"
                    className="shell-shell-list-filter-btn"
                    aria-label="Filter view"
                    onClick={() => setFilterMenuOpen((prev) => !prev)}
                  >
                    <FunnelSimple size={16} />
                  </button>
                  {filterMenuOpen ? (
                    <div className="shell-shell-list-filter-menu">
                      <button type="button" className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>
                        All
                      </button>
                      {statuses.map((status) => (
                        <button
                          key={status.id || status.key}
                          type="button"
                          className={statusFilter === (status.id || status.key) || statusFilter === status.key ? 'active' : ''}
                          onClick={() => setStatusFilter((status.id || status.key) as string)}
                        >
                          {status.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="shell-shell-list-stats">
              <article className="shell-shell-list-stat">
                <span>Total</span>
                <strong>{totalItems}</strong>
              </article>
              <article className="shell-shell-list-stat">
                <span>Done</span>
                <strong>{completedCount}</strong>
              </article>
              <article className="shell-shell-list-stat">
                <span>Tasks</span>
                <strong>{totalActions}</strong>
              </article>
              <article className="shell-shell-list-stat">
                <span>Active columns</span>
                <strong>{activeStatuses}</strong>
              </article>
            </div>

            {configureOpen ? (
              <div className="shell-shell-list-config">
                <div className="shell-shell-list-config-block">
                  <strong>Add column</strong>
                  <div className="shell-shell-list-config-row">
                    <input value={newStatusName} onChange={(event) => setNewStatusName(event.target.value)} placeholder="Column name" />
                    <select value={newStatusColor} onChange={(event) => setNewStatusColor(event.target.value)}>
                      {STATUS_COLOR_OPTIONS.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => void createStatus()} disabled={statusSubmitting || !newStatusName.trim()}>
                      {statusSubmitting ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
                <div className="shell-shell-list-config-block">
                  <strong>Add field</strong>
                  <div className="shell-shell-list-config-row shell-shell-list-config-row-field">
                    <input value={newFieldName} onChange={(event) => setNewFieldName(event.target.value)} placeholder="Field name" />
                    <select value={newFieldType} onChange={(event) => setNewFieldType(event.target.value as ListFieldType)}>
                      {(['text', 'number', 'date', 'boolean', 'select', 'status', 'contact'] as ListFieldType[]).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(newFieldType === 'select' || newFieldType === 'status') ? (
                    <input
                      value={newFieldPresets}
                      onChange={(event) => setNewFieldPresets(event.target.value)}
                      placeholder="Preset values, comma separated"
                    />
                  ) : null}
                  <button type="button" onClick={() => void createField()} disabled={fieldSubmitting || !newFieldName.trim()}>
                    {fieldSubmitting ? 'Adding…' : 'Add field'}
                  </button>
                </div>
              </div>
            ) : null}

            {loading ? <div className="shell-shell-list-empty">Loading list…</div> : null}
            {error ? <div className="shell-shell-list-empty">{error}</div> : null}

            {!loading && !error ? (
              <div className="shell-shell-status-groups">
                {visibleStatuses.map(({ status, items: statusItems }) => (
                  <section key={status.id || status.key} className="shell-shell-status-section">
                    <header className="shell-shell-status-head">
                      <div className="shell-shell-status-head-copy">
                        <span className="shell-shell-status-dot" style={{ backgroundColor: status.color }} />
                        <strong>{status.name}</strong>
                        <span>{statusItems.length}</span>
                      </div>
                    </header>
                    <div className="shell-shell-status-table">
                      <div className="shell-shell-status-table-head">
                        <span>{detail?.item_label || 'Item'}</span>
                        {pinnedFields.slice(0, 4).map((field) => (
                          <span key={field.id}>{field.name}</span>
                        ))}
                        <span>{detail?.action_label || 'Tasks'}</span>
                      </div>
                      <div className="shell-shell-status-items">
                      {statusItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`shell-shell-status-row ${selectedItem?.id === item.id ? 'selected' : ''}`.trim()}
                          onClick={() => {
                            setSelectedItemId(item.id);
                            onOpenItem?.(item.id);
                          }}
                        >
                          <strong>{item.title}</strong>
                          <div className="shell-shell-status-row-values">
                            {pinnedFields.slice(0, 3).map((field) => (
                              <div key={field.id} className="shell-shell-status-row-cell">
                                <strong>{getDisplayValue(field, fieldValues[item.id]?.[field.id] || null)}</strong>
                              </div>
                            ))}
                            {pinnedFields.length === 0 ? <span className="shell-shell-status-row-empty">—</span> : null}
                          </div>
                          <span className="shell-shell-status-row-count">{(item.actions || []).length}</span>
                        </button>
                      ))}
                      {inlineAddStatusId === (status.id || status.key) ? (
                        <div className="shell-shell-status-inline-add">
                          <input
                            autoFocus
                            value={inlineItemDraft}
                            onChange={(event) => setInlineItemDraft(event.target.value)}
                            placeholder={`+ Add ${detail?.item_label?.toLowerCase() || 'item'}`}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                void createItemForStatus(status, inlineItemDraft);
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                setInlineItemDraft('');
                                setInlineAddStatusId(null);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="shell-shell-status-inline-trigger"
                          onClick={() => {
                            setInlineItemDraft('');
                            setInlineAddStatusId(status.id || status.key);
                          }}
                        >
                          + Add {detail?.item_label?.toLowerCase() || 'item'}
                        </button>
                      )}
                      </div>
                      {statusItems.length === 0 ? <div className="shell-shell-list-empty">No items yet</div> : null}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="shell-space-panel shell-space-panel-item-view shell-space-panel-item-redesign">
      <section className="shell-shell-item-detail-panel">
        {selectedItem ? (
          <div className="shell-shell-list-panel shell-shell-item-detail-shell">
            <div className="shell-shell-item-detail-head">
              <div className="shell-shell-item-detail-head-copy">
                <input
                  className="shell-shell-item-title-input"
                  value={selectedTitleDraft}
                  onChange={(event) => setSelectedTitleDraft(event.target.value)}
                  onBlur={() => void saveSelectedItem()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void saveSelectedItem();
                    }
                  }}
                  placeholder="Untitled item"
                />
                <div className="shell-shell-item-meta">
                  <span>{(selectedItem.actions || []).length} tasks</span>
                  <StatusSelect
                    statuses={statuses}
                    value={selectedItem.status_id ?? selectedItem.status}
                    onChange={(status: LaneStatus) => void updateSelectedItemStatus(status)}
                    appearance="pill"
                    className="shell-shell-item-status-select"
                  />
                </div>
              </div>
            </div>

            <div className="shell-shell-item-detail-scroll">
              <div className="shell-shell-item-info-list">
                <label className="shell-shell-item-info-row shell-shell-item-info-row-description">
                  <textarea
                    className="shell-shell-item-description"
                    value={selectedDescriptionDraft}
                    onChange={(event) => setSelectedDescriptionDraft(event.target.value)}
                    onBlur={() => void saveSelectedItem()}
                    placeholder="Description"
                    aria-label="Description"
                  />
                </label>

                {fields.length ? (
                  <div className="shell-shell-item-info-group">
                    <div className="shell-shell-item-info-group-body">
                      {compactFieldPairs.map((field) => (
                        <div
                          key={field.id}
                          ref={activeFieldEditorId === field.id ? activeFieldEditorRef : null}
                          className={`shell-shell-item-field-pair ${activeFieldEditorId === field.id ? 'active' : ''}`.trim()}
                        >
                          <button
                            type="button"
                            className="shell-shell-item-field-trigger"
                            onClick={() => openFieldEditor(field.field)}
                            aria-label={`Edit ${field.label}`}
                          >
                            <span className="shell-shell-item-field-pair-label">{field.label}:</span>
                            <strong className={`shell-shell-item-field-pair-value ${field.isEmpty ? 'empty' : ''}`.trim()}>{field.value}</strong>
                            <CaretRight size={12} className="shell-shell-item-field-chevron" weight="bold" />
                          </button>
                          {activeFieldEditorId === field.id ? (
                            <div className="shell-shell-item-field-popout" onClick={(event) => event.stopPropagation()}>
                              {field.field.type === 'status' || field.field.type === 'select' ? (
                                <select
                                  autoFocus
                                  value={activeFieldDraft}
                                  onChange={(event) => {
                                    setActiveFieldDraft(event.target.value);
                                    void commitFieldValue(field.field, event.target.value);
                                  }}
                                >
                                  <option value="">none set</option>
                                  {(field.field.options || []).map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : field.field.type === 'boolean' ? (
                                <div className="shell-shell-item-field-popout-boolean">
                                  <button type="button" onClick={() => void commitFieldValue(field.field, '')}>
                                    none set
                                  </button>
                                  <button type="button" onClick={() => void commitFieldValue(field.field, 'true')}>
                                    yes
                                  </button>
                                  <button type="button" onClick={() => void commitFieldValue(field.field, 'false')}>
                                    no
                                  </button>
                                </div>
                              ) : (
                                <input
                                  autoFocus
                                  type={field.field.type === 'date' ? 'date' : 'text'}
                                  inputMode={field.field.type === 'number' ? 'decimal' : undefined}
                                  value={activeFieldDraft}
                                  onChange={(event) => setActiveFieldDraft(event.target.value)}
                                  onBlur={(event) => void commitFieldValue(field.field, event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' && field.field.type !== 'date') {
                                      event.preventDefault();
                                      void commitFieldValue(field.field, event.currentTarget.value);
                                    }
                                    if (event.key === 'Escape') {
                                      event.preventDefault();
                                      setActiveFieldEditorId(null);
                                    }
                                  }}
                                  placeholder={field.label}
                                />
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="shell-shell-item-section shell-shell-item-subtasks">
                <div className="shell-shell-item-subtasks-head">
                  <strong>{detail?.action_label || 'Tasks'}</strong>
                  <span>{(selectedItem.actions || []).length}</span>
                </div>
                <div className="shell-shell-item-subtask-add">
                  <input
                    value={actionDraft}
                    onChange={(event) => setActionDraft(event.target.value)}
                    placeholder={`+ Add ${(detail?.action_label || 'task').toLowerCase()}`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void createAction();
                      }
                    }}
                  />
                  <button type="button" onClick={() => void createAction()} disabled={savingAction || !actionDraft.trim()}>
                    Add
                  </button>
                </div>
                <div className="shell-shell-item-subtask-list">
                  {(selectedItem.actions || []).map((action) => {
                    const selectedQuickDateIndex = quickTaskDates.findIndex((date) => isSameLocalDay(action.scheduled_at, date));
                    const fallbackWindowStart =
                      selectedQuickDateIndex >= 0 ? Math.max(0, Math.min(maxTaskDateWindowStart, selectedQuickDateIndex)) : 0;
                    const currentWindowStart = Math.max(
                      0,
                      Math.min(maxTaskDateWindowStart, taskDateWindowStart[action.id] ?? fallbackWindowStart)
                    );

                    return (
                    <div key={action.id} className={`shell-shell-task-card ${expandedActionIds[action.id] ? 'expanded' : ''}`.trim()}>
                      <button
                        type="button"
                        className="shell-shell-task-head"
                        onClick={() => setExpandedActionIds((prev) => ({ ...prev, [action.id]: !prev[action.id] }))}
                      >
                        <div className="shell-shell-task-head-main">
                          <strong>{action.title}</strong>
                          <span>{action.description?.trim() || 'Add notes, schedule, or recurrence.'}</span>
                        </div>
                        <div className="shell-shell-task-head-actions">
                          <StatusSelect
                            statuses={subtaskStatuses}
                            value={action.subtask_status_id || action.status || 'not_started'}
                            onChange={(status: LaneStatus) => void updateActionStatus(action.id, status)}
                            appearance="pill"
                            className="shell-shell-task-status-select"
                          />
                        </div>
                      </button>
                      {expandedActionIds[action.id] ? (
                        <div className="shell-shell-task-editor">
                          {completionComposerActionId === action.id ? (
                            <div className="shell-shell-task-completion">
                              <input
                                value={completionNoteDraft}
                                onChange={(event) => setCompletionNoteDraft(event.target.value)}
                                placeholder="Completion note"
                              />
                              <input
                                value={completionNextTaskDraft}
                                onChange={(event) => setCompletionNextTaskDraft(event.target.value)}
                                placeholder="Next task (optional)"
                              />
                              <div className="shell-shell-task-completion-actions">
                                <button type="button" onClick={() => setCompletionComposerActionId(null)}>
                                  Cancel
                                </button>
                                <button type="button" onClick={() => void submitCompletionComposer()} disabled={completionSaving}>
                                  {completionSaving ? 'Saving…' : 'Complete'}
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <label className="shell-shell-task-field">
                            <span>Task name</span>
                            <input
                              value={action.title || ''}
                              onChange={(event) => updateActionLocally(action.id, { title: event.target.value })}
                              onBlur={(event) =>
                                void persistActionDraft(action, {
                                  ...action,
                                  title: event.target.value.trim() || action.title
                                })
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void persistActionDraft(action, {
                                    ...action,
                                    title: event.currentTarget.value.trim() || action.title
                                  });
                                }
                              }}
                            />
                          </label>
                          <label className="shell-shell-task-field">
                            <span>Description</span>
                            <textarea
                              rows={3}
                              value={action.description || ''}
                              onChange={(event) => updateActionLocally(action.id, { description: event.target.value })}
                              onBlur={(event) =>
                                void persistActionDraft(action, {
                                  ...action,
                                  description: event.target.value.trim() ? event.target.value : null
                                })
                              }
                              placeholder="Execution notes"
                            />
                          </label>
                          <div className="shell-shell-task-schedule">
                            <div
                              ref={openTaskDatePickerId === action.id ? taskDatePickerRef : null}
                              className="shell-shell-task-field shell-shell-task-date-field"
                            >
                              <span>Date</span>
                              <div className="shell-shell-task-date-control">
                                <button
                                  type="button"
                                  className="shell-shell-task-date-arrow"
                                  onClick={() => shiftTaskDateWindow(action.id, -1)}
                                  disabled={currentWindowStart <= 0}
                                  aria-label="Show earlier days"
                                >
                                  <CaretLeft size={14} weight="bold" />
                                </button>
                                <div className="shell-shell-task-date-viewport" aria-label="Quick task date options">
                                  <div
                                    className="shell-shell-task-date-rail"
                                    style={{
                                      transform: `translateX(-${currentWindowStart * 78}px)`
                                    }}
                                  >
                                    {quickTaskDates.map((date, index) => {
                                      const isoDate = toLocalDateKey(date);
                                      const isSelected = isSameLocalDay(action.scheduled_at, date);
                                      return (
                                        <button
                                          key={isoDate}
                                          type="button"
                                          data-date-key={isoDate}
                                          className={`shell-shell-task-date-chip ${isSelected ? 'selected' : ''}`.trim()}
                                          onClick={() => applyActionScheduledDate(action, isoDate)}
                                        >
                                          <strong>{formatTaskQuickDateLabel(date, index)}</strong>
                                          <span>{formatTaskQuickDateMeta(date)}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="shell-shell-task-date-arrow"
                                  onClick={() => shiftTaskDateWindow(action.id, 1)}
                                  disabled={currentWindowStart >= maxTaskDateWindowStart}
                                  aria-label="Show later days"
                                >
                                  <CaretRight size={14} weight="bold" />
                                </button>
                                <button
                                  type="button"
                                  className="shell-shell-task-date-more"
                                  onClick={() => openTaskDatePicker(action)}
                                  aria-label="Choose another date"
                                  aria-expanded={openTaskDatePickerId === action.id}
                                >
                                  <CalendarBlank size={16} weight="regular" />
                                </button>
                                {openTaskDatePickerId === action.id ? (
                                  <div className="shell-shell-task-date-panel" onClick={(event) => event.stopPropagation()}>
                                    <div className="shell-shell-task-date-panel-head">
                                      <button
                                        type="button"
                                        className="shell-shell-task-date-panel-nav"
                                        onClick={() => setTaskDatePickerMonth((prev) => addLocalMonths(prev, -1))}
                                        aria-label="Previous month"
                                      >
                                        <CaretLeft size={14} weight="bold" />
                                      </button>
                                      <strong>{formatTaskCalendarMonth(taskDatePickerMonth)}</strong>
                                      <button
                                        type="button"
                                        className="shell-shell-task-date-panel-nav"
                                        onClick={() => setTaskDatePickerMonth((prev) => addLocalMonths(prev, 1))}
                                        aria-label="Next month"
                                      >
                                        <CaretRight size={14} weight="bold" />
                                      </button>
                                    </div>
                                    <div className="shell-shell-task-date-panel-weekdays">
                                      {taskCalendarWeekdays.map((weekday, index) => (
                                        <span key={`${weekday}-${index}`}>{weekday}</span>
                                      ))}
                                    </div>
                                    <div className="shell-shell-task-date-panel-grid">
                                      {buildTaskCalendarDays(taskDatePickerMonth).map((date) => {
                                        const isoDate = toLocalDateKey(date);
                                        const isCurrentMonth = date.getMonth() === taskDatePickerMonth.getMonth();
                                        const isToday = isSameLocalDay(date, new Date());
                                        const isSelected = isSameLocalDay(action.scheduled_at, date);
                                        return (
                                          <button
                                            key={isoDate}
                                            type="button"
                                            className={[
                                              'shell-shell-task-date-day',
                                              isCurrentMonth ? '' : 'muted',
                                              isToday ? 'today' : '',
                                              isSelected ? 'selected' : ''
                                            ]
                                              .filter(Boolean)
                                              .join(' ')}
                                            onClick={() => {
                                              applyActionScheduledDate(action, isoDate);
                                              setOpenTaskDatePickerId(null);
                                            }}
                                          >
                                            {date.getDate()}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div className="shell-shell-task-date-panel-actions">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          applyActionScheduledDate(action, null);
                                          setOpenTaskDatePickerId(null);
                                        }}
                                      >
                                        Clear
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          applyActionScheduledDate(action, toLocalDateKey(new Date()));
                                          setOpenTaskDatePickerId(null);
                                        }}
                                      >
                                        Today
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <label className="shell-shell-task-field compact">
                              <span>Time</span>
                              <input
                                type="time"
                                value={toTimeInputValue(action.scheduled_at)}
                                onChange={(event) => {
                                  const nextScheduledAt = mergeDateAndTimeInput(
                                    action.scheduled_at,
                                    toDateInputValue(action.scheduled_at) || toLocalDateKey(new Date()),
                                    event.target.value
                                  );
                                  updateActionLocally(action.id, { scheduled_at: nextScheduledAt });
                                  void persistActionDraft(action, { ...action, scheduled_at: nextScheduledAt });
                                }}
                              />
                            </label>
                            <label className="shell-shell-task-field compact">
                              <span>Repeat</span>
                              <select
                                value={action.recurrence_rule || 'none'}
                                onChange={(event) => {
                                  const nextRule = event.target.value as RecurrenceRule;
                                  const nextConfig =
                                    nextRule === 'none' ? null : normalizeActionRecurrenceConfig(nextRule, action.recurrence_config);
                                  updateActionLocally(action.id, {
                                    recurrence_rule: nextRule,
                                    recurrence_config: nextConfig
                                  });
                                  void persistActionDraft(action, {
                                    ...action,
                                    recurrence_rule: nextRule,
                                    recurrence_config: nextConfig
                                  });
                                }}
                              >
                                <option value="none">Once</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="custom">Custom</option>
                              </select>
                            </label>
                          </div>
                          {(action.recurrence_rule || 'none') !== 'none' ? (
                            <div className="shell-shell-task-recurrence">
                              <label className="shell-shell-task-field compact">
                                <span>Every</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={String(Math.max(1, action.recurrence_config?.interval || 1))}
                                  onChange={(event) =>
                                    updateActionLocally(action.id, {
                                      recurrence_config: {
                                        ...normalizeActionRecurrenceConfig(action.recurrence_rule || 'custom', action.recurrence_config),
                                        interval: Math.max(1, Number.parseInt(event.target.value || '1', 10))
                                      }
                                    })
                                  }
                                  onBlur={(event) => {
                                    const nextConfig = {
                                      ...normalizeActionRecurrenceConfig(action.recurrence_rule || 'custom', action.recurrence_config),
                                      interval: Math.max(1, Number.parseInt(event.target.value || '1', 10))
                                    };
                                    void persistActionDraft(action, { ...action, recurrence_config: nextConfig });
                                  }}
                                />
                              </label>
                              <label className="shell-shell-task-field compact">
                                <span>Unit</span>
                                <select
                                  value={normalizeActionRecurrenceConfig(action.recurrence_rule || 'custom', action.recurrence_config).unit}
                                  disabled={(action.recurrence_rule || 'none') !== 'custom'}
                                  onChange={(event) => {
                                    const nextConfig = {
                                      ...normalizeActionRecurrenceConfig(action.recurrence_rule || 'custom', action.recurrence_config),
                                      unit: event.target.value as CustomRecurrenceConfig['unit']
                                    };
                                    updateActionLocally(action.id, { recurrence_config: nextConfig });
                                    void persistActionDraft(action, { ...action, recurrence_config: nextConfig });
                                  }}
                                >
                                  <option value="day">Days</option>
                                  <option value="week">Weeks</option>
                                  <option value="month">Months</option>
                                  <option value="year">Years</option>
                                </select>
                              </label>
                              <div className="shell-shell-task-recurrence-summary">
                                  {formatActionRecurrenceSummary(action.recurrence_rule || 'none', action.recurrence_config || DEFAULT_ACTION_RECURRENCE_CONFIG)}
                                </div>
                              </div>
                            ) : null}
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                  {(selectedItem.actions || []).length === 0 ? <div className="shell-shell-list-empty">No tasks yet.</div> : null}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="shell-shell-list-panel shell-shell-item-detail-shell shell-shell-item-detail-empty">
            <strong>Select an item</strong>
            <span>Choose an item from a status column to inspect and edit it here.</span>
          </div>
        )}
      </section>

      <aside className="shell-shell-list-panel shell-shell-comments-pane">
        <div className="shell-shell-comments-head">
          <div>
            <span className="shell-shell-list-kicker">Activity</span>
          </div>
        </div>
        <div className="shell-shell-comments-thread">
          {commentsLoading ? <div className="shell-shell-list-empty">Loading comments…</div> : null}
          {!commentsLoading && comments.length === 0 ? <div className="shell-shell-list-empty">No activity yet.</div> : null}
          {comments.map((comment) => (
            <article key={comment.id} className={`shell-shell-comment ${comment.author_type}`.trim()}>
              <p>{comment.content}</p>
              <time>{formatCommentTime(comment.created_at)}</time>
            </article>
          ))}
        </div>
        <div className="shell-shell-comment-compose">
          {commentError ? <div className="shell-shell-comment-error">{commentError}</div> : null}
          <div className="shell-shell-comment-compose-surface">
            <div className="shell-shell-comment-input-stack">
              <textarea
                rows={3}
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Write a comment…"
              />
              <button
                type="button"
                className={`shell-shell-comment-voice-btn ${commentVoiceMode ? 'active' : ''}`.trim()}
                onClick={() => setCommentVoiceMode((prev) => !prev)}
                aria-pressed={commentVoiceMode}
                aria-label={commentVoiceMode ? 'Voice mode on' : 'Voice mode'}
              >
                <Microphone size={21} weight="fill" />
              </button>
              <button
                type="button"
                className="shell-shell-comment-send-btn"
                onClick={() => void sendComment()}
                disabled={commentSubmitting || !commentDraft.trim() || !selectedItemId}
                aria-label={commentSubmitting ? 'Sending comment' : 'Send comment'}
              >
                <PaperPlaneTilt size={21} weight="fill" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
