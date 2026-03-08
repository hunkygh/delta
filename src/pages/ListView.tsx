import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRightLeft, ChevronRight, Eye, EyeOff, GitMerge, Trash2, X as CloseIcon } from 'lucide-react';
import { GearSix, PaperPlaneTilt, Plus } from '@phosphor-icons/react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import StatusSelect from '../components/FocalBoard/StatusSelect';
import ProposalReviewTable from '../components/ProposalReviewTable';
import { useAuth } from '../context/AuthContext';
import focalBoardService from '../services/focalBoardService';
import { calendarService } from '../services/calendarService';
import listFieldService from '../services/listFieldService';
import fieldOptionService from '../services/fieldOptionService';
import itemFieldValueService from '../services/itemFieldValueService';
import commentsService from '../services/commentsService';
import chatService from '../services/chatService';
import '../components/FocalBoard/StatusSelect.css';
import './ListView.css';
import type { CalendarProposal, FieldUpdateProposal, NewActionProposal } from '../contracts/executionContracts';
import type { FieldOption, ItemFieldValue, ItemFieldValueMap, ListField, ListFieldType } from '../types/customFields';

interface LaneStatus {
  id: string | null;
  key: string;
  name: string;
  color: string;
  order_num?: number;
}

interface ActionItem {
  id: string;
  title: string;
  status?: string;
  recurring?: RecurringItemMeta;
}

interface ListItem {
  id: string;
  title: string;
  description?: string | null;
  order_num?: number;
  status?: string;
  status_id?: string | null;
  signal_label?: string;
  signal_score?: number;
  actions?: ActionItem[];
}

interface RecurringOccurrence {
  time_block_id: string;
  scheduled_start: string;
  scheduled_end: string;
}

interface RecurringItemMeta {
  scheduled_count: number;
  completed_count: number;
  task_scheduled_count?: number;
  task_completed_count?: number;
  active_task_total_count?: number;
  active_task_completed_count?: number;
  active_completion_state?: 'pending' | 'completed' | 'skipped' | 'missed';
  streak: number;
  next_occurrence: RecurringOccurrence | null;
  current_or_next_occurrence: RecurringOccurrence | null;
  last_completed: {
    completed_at?: string | null;
    scheduled_start?: string;
  } | null;
}

interface RecurringListItem extends ListItem {
  recurring?: RecurringItemMeta;
  actions?: ActionItem[];
}

interface ThreadComment {
  id: string;
  author_type: 'user' | 'ai';
  content: string;
  created_at: string;
}

interface EditingFieldCell {
  itemId: string;
  fieldId: string;
}

type ProposalPayload =
  | { kind: 'field_update'; value: FieldUpdateProposal }
  | { kind: 'new_action'; value: NewActionProposal }
  | { kind: 'calendar_proposal'; value: CalendarProposal };

interface ProposalRow {
  id: string;
  entity: string;
  currentValue: string;
  proposedValue: string;
  reason: string;
  approved: boolean;
  payload: ProposalPayload;
}

type CommentScopeType = 'item' | 'action';

interface CommentScope {
  type: CommentScopeType;
  scopeId: string;
}

interface ColumnOptionDraft {
  id: string;
  label: string;
  color_fill: string;
  color_border: string;
  color_text: string;
}

const STATUS_COLORS = [
  '#8EA3BF',
  '#5FA8D3',
  '#7B8CE6',
  '#9A7ED7',
  '#D97AA8',
  '#D28A53',
  '#E0B04A',
  '#5CB487',
  '#4FB0A7',
  '#D36A6A'
];

const DEFAULT_STATUS_OPTION_PRESETS = [
  { label: 'New', color_fill: '#EEF5FF', color_border: '#CFE2FF', color_text: '#29466D' },
  { label: 'In Progress', color_fill: '#F3F2FF', color_border: '#D8D1FF', color_text: '#42306A' },
  { label: 'Follow Up', color_fill: '#FFF5E8', color_border: '#FFDDB2', color_text: '#674527' },
  { label: 'Closed', color_fill: '#ECF9F1', color_border: '#C9EFD9', color_text: '#29543B' }
];

const isMissingCustomFieldsSchemaError = (err: any): boolean => {
  const message = String(err?.message || '').toLowerCase();
  if (!message) return false;
  const missingTable =
    message.includes('list_fields') ||
    message.includes('field_options') ||
    message.includes('item_field_values');
  const missingReason = message.includes('schema cache') || message.includes('does not exist');
  return missingTable && missingReason;
};

const CUSTOM_FIELDS_MIGRATION_HINT =
  'Custom fields schema is missing. Run src/database/migrations/20260305_custom_fields_mvp.sql on your database.';


const normalizeStatusKey = (label: string): string =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const DEFAULT_STATUSES: LaneStatus[] = [
  { id: null, key: 'pending', name: 'To do', color: '#94a3b8', order_num: 0 },
  { id: null, key: 'in_progress', name: 'In progress', color: '#f59e0b', order_num: 1 },
  { id: null, key: 'completed', name: 'Done', color: '#22c55e', order_num: 2 }
];

const formatCommentTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const formatOccurrenceTime = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export default function ListView(): JSX.Element {
  const { listId } = useParams<{ listId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any>(null);
  const [listMode, setListMode] = useState<'one_off' | 'recurring'>('one_off');
  const [items, setItems] = useState<ListItem[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringListItem[]>([]);
  const [recurringSummary, setRecurringSummary] = useState<{
    scheduled_count: number;
    completed_count: number;
    task_scheduled_count?: number;
    task_completed_count?: number;
  }>({
    scheduled_count: 0,
    completed_count: 0
  });
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringError, setRecurringError] = useState<string | null>(null);
  const [recurringComposerOpen, setRecurringComposerOpen] = useState(false);
  const [recurringDraft, setRecurringDraft] = useState('');
  const [recurringComposerMode, setRecurringComposerMode] = useState<'item' | 'subtask'>('item');
  const [lastCreatedRecurringItemId, setLastCreatedRecurringItemId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<LaneStatus[]>([]);
  const [draftByStatus, setDraftByStatus] = useState<Record<string, string>>({});
  const [composerOpenByStatus, setComposerOpenByStatus] = useState<Record<string, boolean>>({});
  const [composerModeByStatus, setComposerModeByStatus] = useState<Record<string, 'item' | 'subtask'>>({});
  const [lastCreatedItemByStatus, setLastCreatedItemByStatus] = useState<Record<string, string>>({});
  const [expandedByItem, setExpandedByItem] = useState<Record<string, boolean>>({});
  const [actionComposerByItem, setActionComposerByItem] = useState<Record<string, boolean>>({});
  const [actionDraftByItem, setActionDraftByItem] = useState<Record<string, string>>({});
  const [statusManagerOpen, setStatusManagerOpen] = useState(false);
  const [fieldManagerOpen, setFieldManagerOpen] = useState(false);
  const [statusNameDraft, setStatusNameDraft] = useState('');
  const [statusColorDraft, setStatusColorDraft] = useState(STATUS_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [listFields, setListFields] = useState<ListField[]>([]);
  const [itemFieldValues, setItemFieldValues] = useState<ItemFieldValueMap>({});
  const [editingFieldCell, setEditingFieldCell] = useState<EditingFieldCell | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<ListFieldType>('status');
  const [newOptionByField, setNewOptionByField] = useState<Record<string, string>>({});
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [showCompletedSubtasks, setShowCompletedSubtasks] = useState(false);
  const [renameMode, setRenameMode] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const columnPopoverRef = useRef<HTMLDivElement | null>(null);
  const columnPopoverCloseTimerRef = useRef<number | null>(null);
  const [columnPopoverStatusKey, setColumnPopoverStatusKey] = useState<string | null>(null);
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [columnPopoverFieldId, setColumnPopoverFieldId] = useState<string | null>(null);
  const [columnPopoverName, setColumnPopoverName] = useState('');
  const [columnPopoverType, setColumnPopoverType] = useState<ListFieldType>('status');
  const [columnPopoverPinned, setColumnPopoverPinned] = useState(true);
  const [columnPopoverOptions, setColumnPopoverOptions] = useState<ColumnOptionDraft[]>([]);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [modalTitleDraft, setModalTitleDraft] = useState('');
  const [modalDescriptionDraft, setModalDescriptionDraft] = useState('');
  const [modalStatusValue, setModalStatusValue] = useState<string | null>('pending');
  const [savingItem, setSavingItem] = useState(false);
  const [itemModalSettingsOpen, setItemModalSettingsOpen] = useState(false);
  const [itemMoveMenuOpen, setItemMoveMenuOpen] = useState(false);
  const [moveTargetListId, setMoveTargetListId] = useState('');
  const [peerLists, setPeerLists] = useState<Array<{ id: string; name: string }>>([]);
  const [movingItem, setMovingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState(false);
  const descriptionAutosaveTimerRef = useRef<number | null>(null);
  const [descriptionAutosaveBusy, setDescriptionAutosaveBusy] = useState(false);

  const [activeCommentScope, setActiveCommentScope] = useState<CommentScope | null>(null);
  const [selectedActionForThreadId, setSelectedActionForThreadId] = useState<string | null>(null);
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [pushingCommentId, setPushingCommentId] = useState<string | null>(null);
  const [statusImportListId, setStatusImportListId] = useState('');
  const [statusImportCandidates, setStatusImportCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [importingStatuses, setImportingStatuses] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [proposalSource, setProposalSource] = useState<'ai' | 'heuristic' | 'unknown'>('unknown');
  const [bulkApplying, setBulkApplying] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user || !listId) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await focalBoardService.getListDetail(listId);
        setList(data);
        // Stage 1 model shift: lists are always item containers in UI.
        // Recurrence remains task-level behavior, not list-mode behavior.
        setListMode('one_off');
        setItems((data.items || []).map((item: any) => ({ ...item, actions: item.actions || [] })));
        setRecurringItems([]);
        setRecurringSummary({ scheduled_count: 0, completed_count: 0 });
        const nextStatuses = (data.lane_statuses || []).length
          ? [...data.lane_statuses].sort((a: any, b: any) => (a.order_num ?? 0) - (b.order_num ?? 0))
          : DEFAULT_STATUSES;
        setStatuses(nextStatuses);
      } catch (err: any) {
        setError(err?.message || 'Failed to load list');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [listId, user]);

  useEffect(() => {
    const openItemId = (location.state as { openItemId?: string } | null)?.openItemId;
    if (!openItemId || items.length === 0) {
      return;
    }
    const target = items.find((item) => item.id === openItemId);
    if (!target) {
      return;
    }
    setSelectedItemId(target.id);
    setCommentDraft('');
    setCommentError(null);
    navigate(location.pathname, { replace: true, state: {} });
  }, [items, location.pathname, location.state, navigate]);

  useEffect(() => {
    setRenameDraft(list?.name || '');
  }, [list?.name]);

  useEffect(() => {
    if (!settingsMenuOpen) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!settingsMenuRef.current) return;
      if (!settingsMenuRef.current.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [settingsMenuOpen]);

  useEffect(() => {
    if (!columnPopoverStatusKey) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!columnPopoverRef.current) return;
      if (!columnPopoverRef.current.contains(event.target as Node)) {
        closeColumnPopover();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [columnPopoverStatusKey]);

  useEffect(() => {
    return () => {
      if (columnPopoverCloseTimerRef.current != null) {
        window.clearTimeout(columnPopoverCloseTimerRef.current);
      }
    };
  }, []);

  const selectedItem = useMemo(
    () => (selectedItemId ? items.find((item) => item.id === selectedItemId) || null : null),
    [items, selectedItemId]
  );

  useEffect(() => {
    if (!selectedItem) {
      return;
    }
    setModalTitleDraft(selectedItem.title || '');
    setModalDescriptionDraft(selectedItem.description || '');
    setModalStatusValue(selectedItem.status_id ?? selectedItem.status ?? 'pending');
    setItemModalSettingsOpen(false);
    setItemMoveMenuOpen(false);
    setMoveTargetListId('');
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem || !list?.focal_id) {
      setPeerLists([]);
      return;
    }
    const loadPeerLists = async (): Promise<void> => {
      try {
        const rows = await focalBoardService.getListsForFocal(list.focal_id);
        const mapped: Array<{ id: string; name: string }> = (rows || [])
          .filter((entry: any) => entry.id !== list.id)
          .map((entry: any) => ({ id: entry.id, name: entry.name }));
        setPeerLists(mapped);
      } catch {
        setPeerLists([]);
      }
    };
    void loadPeerLists();
  }, [selectedItem, list?.focal_id, list?.id]);

  useEffect(() => {
    if (!statusManagerOpen || !list?.focal_id || !list?.id) {
      setStatusImportCandidates([]);
      setStatusImportListId('');
      return;
    }
    const loadStatusImportCandidates = async (): Promise<void> => {
      try {
        const rows = await focalBoardService.getListsForFocal(list.focal_id);
        const candidates: Array<{ id: string; name: string }> = (rows || [])
          .filter((entry: any) => entry.id !== list.id)
          .map((entry: any) => ({ id: entry.id, name: entry.name }));
        setStatusImportCandidates(candidates);
        setStatusImportListId((prev) => (prev && candidates.some((entry) => entry.id === prev) ? prev : candidates[0]?.id || ''));
      } catch {
        setStatusImportCandidates([]);
        setStatusImportListId('');
      }
    };
    void loadStatusImportCandidates();
  }, [statusManagerOpen, list?.focal_id, list?.id]);

  useEffect(() => {
    if (!listId) return;
    window.dispatchEvent(
      new CustomEvent('delta:chat-context-set', {
        detail: {
          list_id: listId,
          item_id: selectedItemId || undefined,
          action_id: selectedActionForThreadId || undefined
        }
      })
    );
  }, [listId, selectedActionForThreadId, selectedItemId]);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }
    setSelectedActionForThreadId(null);
    setActiveCommentScope({ type: 'item', scopeId: selectedItem.id });
  }, [selectedItem]);

  useEffect(() => {
    const loadComments = async () => {
      if (!user || !activeCommentScope) {
        setComments([]);
        return;
      }
      setCommentsLoading(true);
      setCommentError(null);
      try {
        if (activeCommentScope.type === 'item') {
          const [itemComments, scopedComments] = await Promise.all([
            commentsService.getItemComments(activeCommentScope.scopeId, 50),
            focalBoardService.getScopedComments('item', activeCommentScope.scopeId, user.id)
          ]);
          const legacyRows: ThreadComment[] = (itemComments || []).map((entry: any) => ({
            id: `item-${entry.id}`,
            author_type: 'user',
            content: entry.body,
            created_at: entry.created_at
          }));
          const scopedRows: ThreadComment[] = (scopedComments || []).map((entry: any) => ({
            id: `thread-${entry.id}`,
            author_type: entry.author_type === 'ai' ? 'ai' : 'user',
            content: entry.content,
            created_at: entry.created_at
          }));
          const merged = [...legacyRows, ...scopedRows].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          setComments(merged);
        } else {
          const data = await focalBoardService.getScopedComments(activeCommentScope.type, activeCommentScope.scopeId, user.id);
          setComments(data || []);
        }
      } catch (err: any) {
        setCommentError(err?.message || 'Failed to load comments');
      } finally {
        setCommentsLoading(false);
      }
    };
    void loadComments();
  }, [activeCommentScope, user]);

  const loadCustomFields = useCallback(async () => {
    if (!listId || !user?.id) {
      setListFields([]);
      setItemFieldValues({});
      return;
    }
    try {
      const [fields, values] = await Promise.all([
        listFieldService.getFields(listId),
        itemFieldValueService.bulkFetchForList(listId)
      ]);
      setListFields(fields || []);
      setItemFieldValues(values || {});
    } catch (err: any) {
      if (isMissingCustomFieldsSchemaError(err)) {
        setListFields([]);
        setItemFieldValues({});
        return;
      }
      setError(err?.message || 'Failed to load custom fields');
    }
  }, [listId, user?.id]);

  useEffect(() => {
    void loadCustomFields();
  }, [loadCustomFields]);

  const loadRecurringViewData = useCallback(async () => {
      if (!user || !listId) return;
      setRecurringLoading(true);
      setRecurringError(null);
      try {
        const weekStart = new Date();
        weekStart.setUTCHours(0, 0, 0, 0);
        const day = weekStart.getUTCDay();
        const diff = day === 0 ? -6 : 1 - day;
        weekStart.setUTCDate(weekStart.getUTCDate() + diff);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        weekEnd.setUTCHours(23, 59, 59, 999);

        const payload = await focalBoardService.getRecurringListMvpView(
          listId,
          weekStart.toISOString(),
          weekEnd.toISOString()
        );
        setRecurringItems(payload.items || []);
        setRecurringSummary(payload.summary || { scheduled_count: 0, completed_count: 0 });
      } catch (err: any) {
        setRecurringError(err?.message || 'Failed to load recurring view');
      } finally {
        setRecurringLoading(false);
      }
    }, [listId, user]);

  useEffect(() => {
    if (listMode !== 'recurring') {
      return;
    }
    void loadRecurringViewData();
  }, [listMode, loadRecurringViewData]);

  const grouped = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        items: items.filter((item) =>
          status.id ? item.status_id === status.id : (item.status || 'pending') === status.key
        )
      })),
    [items, statuses]
  );

  const pinnedFields = useMemo(
    () =>
      (listFields || [])
        .filter((field) => field.is_pinned)
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [listFields]
  );

  const getOptionById = useCallback(
    (field: ListField, optionId?: string | null): FieldOption | null => {
      if (!optionId) return null;
      return (field.options || []).find((option) => option.id === optionId) || null;
    },
    []
  );

  const getFieldValueForItem = useCallback(
    (itemId: string, fieldId: string): ItemFieldValue | null => itemFieldValues?.[itemId]?.[fieldId] || null,
    [itemFieldValues]
  );

  const getDisplayValue = useCallback(
    (field: ListField, value: ItemFieldValue | null): string => {
      if (!value) return '—';
      if (field.type === 'status' || field.type === 'select') {
        return getOptionById(field, value.option_id)?.label || '—';
      }
      if (field.type === 'text') return value.value_text || '—';
      if (field.type === 'number') return value.value_number != null ? String(value.value_number) : '—';
      if (field.type === 'date') return value.value_date ? new Date(value.value_date).toLocaleDateString() : '—';
      if (field.type === 'boolean') return value.value_boolean ? 'Yes' : 'No';
      return '—';
    },
    [getOptionById]
  );

  const parseNumericFieldInput = useCallback((raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Allow optional leading "+" while preserving numeric-only storage.
    const normalized = trimmed.replace(/^\+/, '');
    if (!normalized) return null;

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }, []);

  const upsertFieldValue = useCallback(
    async (itemId: string, field: ListField, payload: any): Promise<void> => {
      if (!user?.id) return;
      try {
        const saved = await itemFieldValueService.upsertValue(user.id, itemId, field.id, payload);
        setItemFieldValues((prev) => ({
          ...prev,
          [itemId]: {
            ...(prev[itemId] || {}),
            [field.id]: saved
          }
        }));
      } catch (err: any) {
        if (isMissingCustomFieldsSchemaError(err)) {
          setError(CUSTOM_FIELDS_MIGRATION_HINT);
          return;
        }
        setError(err?.message || 'Failed to save custom field value');
      } finally {
        setEditingFieldCell(null);
      }
    },
    [user?.id]
  );

  const updateItemLocally = (itemId: string, patch: Partial<ListItem>): void => {
    setItems((prev) => prev.map((entry) => (entry.id === itemId ? { ...entry, ...patch } : entry)));
  };

  const handleDropItem = useCallback(
    async (targetItemId: string, targetStatus: LaneStatus, sourceItemId?: string): Promise<void> => {
      const activeSourceId = sourceItemId || draggingItemId;
      if (!activeSourceId || activeSourceId === targetItemId) return;

      const movingItem = items.find((entry) => entry.id === activeSourceId);
      if (!movingItem) return;

      const nextItems = [...items];
      const sourceIndex = nextItems.findIndex((entry) => entry.id === activeSourceId);
      const targetIndexBeforeRemoval = nextItems.findIndex((entry) => entry.id === targetItemId);
      if (sourceIndex < 0 || targetIndexBeforeRemoval < 0) return;

      const [moved] = nextItems.splice(sourceIndex, 1);
      const targetIndex = nextItems.findIndex((entry) => entry.id === targetItemId);
      if (targetIndex < 0) return;

      nextItems.splice(targetIndex, 0, {
        ...moved,
        status: targetStatus.key || 'pending',
        status_id: targetStatus.id ?? null
      });
      setItems(nextItems);
      setDraggingItemId(null);

      const byGroup = new Map<string, ListItem[]>();
      for (const entry of nextItems) {
        const groupKey = entry.status_id ?? entry.status ?? 'pending';
        const group = byGroup.get(groupKey) || [];
        group.push(entry);
        byGroup.set(groupKey, group);
      }

      const updates: Array<{ id: string; payload: Record<string, any> }> = [];
      for (const [, groupItems] of byGroup) {
        groupItems.forEach((entry, index) => {
          updates.push({
            id: entry.id,
            payload: {
              order_num: index,
              status: entry.status || 'pending',
              status_id: entry.status_id ?? null
            }
          });
        });
      }

      try {
        await Promise.all(updates.map((entry) => focalBoardService.updateItem(entry.id, entry.payload)));
      } catch (err: any) {
        setError(err?.message || 'Failed to reorder items');
        if (listId) {
          const refreshed = await focalBoardService.getListDetail(listId);
          setItems((refreshed.items || []).map((entry: any) => ({ ...entry, actions: entry.actions || [] })));
        }
      }
    },
    [draggingItemId, items, listId]
  );

  const handleModeChange = async (mode: 'one_off' | 'recurring'): Promise<void> => {
    if (!list?.id || mode === listMode) {
      return;
    }
    const previous = listMode;
    setListMode(mode);
    try {
      const updated = await focalBoardService.updateListMode(list.id, mode);
      setList((prev: any) => ({ ...(prev || {}), mode: updated.mode || mode }));
    } catch (err: any) {
      setListMode(previous);
      setError(err?.message || 'Failed to update list mode');
    }
  };

  const handleToggleRecurringOccurrence = async (item: RecurringListItem): Promise<void> => {
    if (!user || !item.recurring?.current_or_next_occurrence) {
      return;
    }
    const target = item.recurring.current_or_next_occurrence;
    const currentlyCompleted =
      item.recurring.active_completion_state === 'completed' ||
      (item.recurring.completed_count > 0 && item.recurring.last_completed?.scheduled_start === target.scheduled_start);

    try {
      await focalBoardService.setOccurrenceCompletion({
        itemId: item.id,
        timeBlockId: target.time_block_id,
        scheduledStartUtc: target.scheduled_start,
        scheduledEndUtc: target.scheduled_end,
        checked: !currentlyCompleted,
        userId: user.id
      });

      await loadRecurringViewData();
    } catch (err: any) {
      setRecurringError(err?.message || 'Failed to update occurrence');
    }
  };

  const handleToggleRecurringTaskOccurrence = async (item: RecurringListItem, action: ActionItem): Promise<void> => {
    if (!user || !action.recurring?.current_or_next_occurrence) {
      return;
    }
    const target = action.recurring.current_or_next_occurrence;
    const currentlyCompleted = action.recurring.active_completion_state === 'completed';

    try {
      await focalBoardService.setTaskOccurrenceCompletion({
        actionId: action.id,
        timeBlockId: target.time_block_id,
        scheduledStartUtc: target.scheduled_start,
        scheduledEndUtc: target.scheduled_end,
        checked: !currentlyCompleted,
        userId: user.id
      });
      await loadRecurringViewData();
    } catch (err: any) {
      setRecurringError(err?.message || 'Failed to update task occurrence');
    }
  };

  const handleStatusChange = async (item: ListItem, status: LaneStatus): Promise<void> => {
    const nextStatus = status.key || 'pending';
    const updates = status.id ? { status_id: status.id, status: nextStatus } : { status: nextStatus, status_id: null };
    updateItemLocally(item.id, updates);
    try {
      await focalBoardService.updateItem(item.id, updates);
    } catch {
      if (listId) {
        const refreshed = await focalBoardService.getListDetail(listId);
        setItems((refreshed.items || []).map((entry: any) => ({ ...entry, actions: entry.actions || [] })));
      }
    }
  };

  const handleActionStatusChange = async (itemId: string, actionId: string, status: LaneStatus): Promise<void> => {
    const nextStatus = status.key || 'pending';
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              actions: (item.actions || []).map((action) =>
                action.id === actionId ? { ...action, status: nextStatus } : action
              )
            }
          : item
      )
    );

    try {
      await focalBoardService.updateAction(actionId, { status: nextStatus });
      setRecurringItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                actions: (item.actions || []).map((action) =>
                  action.id === actionId ? { ...action, status: nextStatus } : action
                )
              }
            : item
        )
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to update action');
      if (listId) {
        const refreshed = await focalBoardService.getListDetail(listId);
        setItems((refreshed.items || []).map((entry: any) => ({ ...entry, actions: entry.actions || [] })));
      }
    }
  };

  const handleCreateItemInStatus = async (status: LaneStatus): Promise<void> => {
    if (!user || !list?.id) {
      return;
    }
    const draft = draftByStatus[status.key]?.trim();
    if (!draft) {
      return;
    }
    const mode = composerModeByStatus[status.key] || 'item';
    const parentItemId = lastCreatedItemByStatus[status.key];
    try {
      if (mode === 'subtask' && parentItemId) {
        const createdAction = await focalBoardService.createAction(parentItemId, user.id, draft, null, null);
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === parentItemId ? { ...entry, actions: [...(entry.actions || []), createdAction] } : entry
          )
        );
        setDraftByStatus((prev) => ({ ...prev, [status.key]: '' }));
        setComposerOpenByStatus((prev) => ({ ...prev, [status.key]: true }));
        return;
      }
      const created = await focalBoardService.createItem(list.id, user.id, draft, null);
      const updates = status.id ? { status_id: status.id, status: status.key } : { status: status.key, status_id: null };
      const updated = await focalBoardService.updateItem(created.id, updates);
      setItems((prev) => [...prev, { ...updated, actions: [] }]);
      setLastCreatedItemByStatus((prev) => ({ ...prev, [status.key]: updated.id }));
      setDraftByStatus((prev) => ({ ...prev, [status.key]: '' }));
      setComposerOpenByStatus((prev) => ({ ...prev, [status.key]: true }));
    } catch (err: any) {
      setError(err?.message || 'Failed to create item');
    }
  };

  const handleCreateAction = async (itemId: string): Promise<void> => {
    if (!user) {
      return;
    }
    const draft = actionDraftByItem[itemId]?.trim();
    if (!draft) {
      return;
    }

    try {
      const created = await focalBoardService.createAction(itemId, user.id, draft, null, null);
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === itemId ? { ...entry, actions: [...(entry.actions || []), created] } : entry
        )
      );
      setRecurringItems((prev) =>
        prev.map((entry) =>
          entry.id === itemId ? { ...entry, actions: [...(entry.actions || []), created] } : entry
        )
      );
      setActionDraftByItem((prev) => ({ ...prev, [itemId]: '' }));
      setActionComposerByItem((prev) => ({ ...prev, [itemId]: false }));
      setExpandedByItem((prev) => ({ ...prev, [itemId]: true }));
    } catch (err: any) {
      setError(err?.message || 'Failed to create action');
    }
  };

  const handleCreateRecurringItem = async (): Promise<void> => {
    if (!user || !list?.id) {
      return;
    }
    const draft = recurringDraft.trim();
    if (!draft) {
      return;
    }
    if (recurringComposerMode === 'subtask' && lastCreatedRecurringItemId) {
      try {
        const createdAction = await focalBoardService.createAction(lastCreatedRecurringItemId, user.id, draft, null, null);
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === lastCreatedRecurringItemId ? { ...entry, actions: [...(entry.actions || []), createdAction] } : entry
          )
        );
        setRecurringDraft('');
      } catch (err: any) {
        setRecurringError(err?.message || 'Failed to create action');
      }
      return;
    }
    try {
      const created = await focalBoardService.createItem(list.id, user.id, draft, null);
      setItems((prev) => [...prev, { ...created, actions: [] }]);
      setLastCreatedRecurringItemId(created.id);
      setRecurringDraft('');
      setRecurringComposerOpen(true);
      await loadRecurringViewData();
    } catch (err: any) {
      setRecurringError(err?.message || 'Failed to create item');
    }
  };

  const openItemModal = (item: ListItem): void => {
    setSelectedItemId(item.id);
    setCommentDraft('');
    setCommentError(null);
  };

  const closeItemModal = (): void => {
    setSelectedItemId(null);
    setCommentDraft('');
    setCommentError(null);
    setSelectedActionForThreadId(null);
    setActiveCommentScope(null);
    setItemModalSettingsOpen(false);
    setItemMoveMenuOpen(false);
    setMoveTargetListId('');
  };

  const handleSaveItemFromModal = async (): Promise<void> => {
    if (!selectedItem) {
      return;
    }
    const selectedStatus = statuses.find((status) => status.id === modalStatusValue || status.key === modalStatusValue);
    const updates: Record<string, any> = {
      title: modalTitleDraft.trim() || selectedItem.title,
      description: modalDescriptionDraft.trim() || null,
      status: selectedStatus?.key || 'pending'
    };
    if (selectedStatus?.id) {
      updates.status_id = selectedStatus.id;
    } else {
      updates.status_id = null;
    }

    setSavingItem(true);
    try {
      const updated = await focalBoardService.updateItem(selectedItem.id, updates);
      updateItemLocally(selectedItem.id, {
        title: updated.title,
        description: updated.description,
        status: updated.status,
        status_id: updated.status_id ?? null
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to update item');
    } finally {
      setSavingItem(false);
    }
  };

  useEffect(() => {
    if (!selectedItem) return;
    if (descriptionAutosaveTimerRef.current != null) {
      window.clearTimeout(descriptionAutosaveTimerRef.current);
    }
    const initialDescription = selectedItem.description || '';
    if (modalDescriptionDraft === initialDescription) {
      return;
    }
    descriptionAutosaveTimerRef.current = window.setTimeout(async () => {
      try {
        setDescriptionAutosaveBusy(true);
        const updated = await focalBoardService.updateItem(selectedItem.id, {
          description: modalDescriptionDraft.trim() || null
        });
        updateItemLocally(selectedItem.id, {
          description: updated.description
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to autosave description');
      } finally {
        setDescriptionAutosaveBusy(false);
      }
    }, 620);
    return () => {
      if (descriptionAutosaveTimerRef.current != null) {
        window.clearTimeout(descriptionAutosaveTimerRef.current);
      }
    };
  }, [modalDescriptionDraft, selectedItem]);

  const handleMoveItemToList = async (targetListIdArg?: string): Promise<void> => {
    const targetListId = targetListIdArg || moveTargetListId;
    if (!selectedItem || !targetListId) return;
    setMovingItem(true);
    try {
      await focalBoardService.updateItem(selectedItem.id, { lane_id: targetListId });
      setItems((prev) => prev.filter((entry) => entry.id !== selectedItem.id));
      closeItemModal();
    } catch (err: any) {
      setError(err?.message || 'Failed to move item');
    } finally {
      setMovingItem(false);
    }
  };

  const handleDeleteItemFromModal = async (): Promise<void> => {
    if (!selectedItem) return;
    const approved = window.confirm(`Delete "${selectedItem.title}"? This cannot be undone.`);
    if (!approved) return;
    setDeletingItem(true);
    try {
      await focalBoardService.deleteItem(selectedItem.id);
      setItems((prev) => prev.filter((entry) => entry.id !== selectedItem.id));
      closeItemModal();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete item');
    } finally {
      setDeletingItem(false);
    }
  };

  const handleSubmitComment = async (): Promise<void> => {
    if (!user || !activeCommentScope) {
      return;
    }
    const body = commentDraft.trim();
    if (!body) {
      return;
    }

    setCommentSubmitting(true);
    setCommentError(null);
    try {
      if (activeCommentScope.type === 'item') {
        const created = await commentsService.createComment(activeCommentScope.scopeId, user.id, body);
        setComments((prev) => [
          ...prev,
          {
            id: created.id,
            author_type: 'user',
            content: created.body,
            created_at: created.created_at
          }
        ]);
      } else {
        const created = await focalBoardService.createScopedComment(
          activeCommentScope.type,
          activeCommentScope.scopeId,
          user.id,
          body,
          'user'
        );
        setComments((prev) => [...prev, created]);
      }
      setCommentDraft('');
    } catch (err: any) {
      setCommentError(err?.message || 'Failed to send comment');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handlePushCommentToAi = async (comment: ThreadComment): Promise<void> => {
    if (!user || !activeCommentScope) {
      return;
    }
    const body = comment.content?.trim();
    if (!body) {
      return;
    }

    setPushingCommentId(comment.id);
    setCommentError(null);
    try {
      const scopeItemId =
        activeCommentScope.type === 'item' ? activeCommentScope.scopeId : selectedItem?.id || undefined;
      const scopedItem = scopeItemId ? items.find((entry) => entry.id === scopeItemId) || null : selectedItem || null;
      const scopedAction =
        activeCommentScope.type === 'action'
          ? scopedItem?.actions?.find((entry) => entry.id === activeCommentScope.scopeId) || null
          : null;
      const scopedFieldContext = scopedItem
        ? listFields.map((field) => {
            const value = getFieldValueForItem(scopedItem.id, field.id);
            const display = getDisplayValue(field, value);
            return `- ${field.name}: ${display}`;
          })
        : [];

      const aiContext = {
        focal_id: list?.focal_id || list?.focals?.id || undefined,
        list_id: list?.id || undefined,
        item_id: scopeItemId,
        action_id: activeCommentScope.type === 'action' ? activeCommentScope.scopeId : undefined
      };
      const prompt = [
        'Treat this comment as actionable workspace input.',
        'You can update lists/items/actions/time blocks when warranted by the comment.',
        'Ground every suggestion in the provided live item context and field values.',
        'Based on current workspace state, suggest specific next steps and any concrete updates needed.',
        'If an update requires confirmation, ask one short question at the end.',
        '',
        `List: ${list?.name || 'Unknown list'}`,
        `Item: ${scopedItem?.title || 'Unknown item'}`,
        `Description: ${(scopedItem?.description || '').trim() || 'None'}`,
        activeCommentScope.type === 'action'
          ? `Action: ${scopedAction?.title || 'Unknown action'}`
          : 'Action: (item-level thread)',
        '',
        'Custom fields:',
        ...(scopedFieldContext.length > 0 ? scopedFieldContext : ['- None']),
        '',
        `Comment: ${body}`
      ].join('\n');

      const reply = await chatService.send({
        mode: 'ai',
        context: aiContext,
        messages: [{ role: 'user', content: prompt }]
      });

      const saved = await focalBoardService.createScopedComment(
        activeCommentScope.type,
        activeCommentScope.scopeId,
        user.id,
        reply.text,
        'ai'
      );
      setComments((prev) => [...prev, saved]);
    } catch (err: any) {
      setCommentError(err?.message || 'Failed to push comment to Delta AI');
    } finally {
      setPushingCommentId(null);
    }
  };

  const handleCreateField = async (): Promise<void> => {
    if (!user?.id || !listId) return;
    const name = newFieldName.trim();
    if (!name) return;
    try {
      const created = await listFieldService.createField(listId, {
        user_id: user.id,
        name,
        field_key: normalizeStatusKey(name),
        type: newFieldType,
        order_index: listFields.length,
        is_pinned: true
      });
      if (newFieldType === 'status') {
        const defaults = [
          { label: 'New', color_fill: '#EEF5FF', color_border: '#CFE2FF', color_text: '#29466D' },
          { label: 'In Progress', color_fill: '#F3F2FF', color_border: '#D8D1FF', color_text: '#42306A' },
          { label: 'Follow Up', color_fill: '#FFF5E8', color_border: '#FFDDB2', color_text: '#674527' },
          { label: 'Closed', color_fill: '#ECF9F1', color_border: '#C9EFD9', color_text: '#29543B' }
        ];
        await Promise.all(
          defaults.map((entry, index) =>
            fieldOptionService.createOption(created.id, {
              user_id: user.id,
              label: entry.label,
              option_key: normalizeStatusKey(entry.label),
              order_index: index,
              color_fill: entry.color_fill,
              color_border: entry.color_border,
              color_text: entry.color_text
            })
          )
        );
      }
      setNewFieldName('');
      await loadCustomFields();
    } catch (err: any) {
      if (isMissingCustomFieldsSchemaError(err)) {
        setError(CUSTOM_FIELDS_MIGRATION_HINT);
        return;
      }
      setError(err?.message || 'Failed to create field');
    }
  };

  const handleToggleFieldPinned = async (field: ListField): Promise<void> => {
    try {
      const updated = await listFieldService.updateField(field.id, { is_pinned: !field.is_pinned });
      setListFields((prev) => prev.map((entry) => (entry.id === field.id ? { ...entry, ...updated } : entry)));
    } catch (err: any) {
      if (isMissingCustomFieldsSchemaError(err)) {
        setError(CUSTOM_FIELDS_MIGRATION_HINT);
        return;
      }
      setError(err?.message || 'Failed to update field');
    }
  };

  const handleDeleteField = async (fieldId: string): Promise<void> => {
    try {
      await listFieldService.deleteField(fieldId);
      setListFields((prev) => prev.filter((entry) => entry.id !== fieldId));
      setItemFieldValues((prev) => {
        const next: ItemFieldValueMap = {};
        for (const [itemId, values] of Object.entries(prev)) {
          const copy = { ...values };
          delete copy[fieldId];
          next[itemId] = copy;
        }
        return next;
      });
    } catch (err: any) {
      if (isMissingCustomFieldsSchemaError(err)) {
        setError(CUSTOM_FIELDS_MIGRATION_HINT);
        return;
      }
      setError(err?.message || 'Failed to delete field');
    }
  };

  const handleCreateFieldOption = async (field: ListField): Promise<void> => {
    if (!user?.id) return;
    const label = (newOptionByField[field.id] || '').trim();
    if (!label) return;
    try {
      await fieldOptionService.createOption(field.id, {
        user_id: user.id,
        label,
        option_key: normalizeStatusKey(label),
        order_index: (field.options || []).length
      });
      setNewOptionByField((prev) => ({ ...prev, [field.id]: '' }));
      await loadCustomFields();
    } catch (err: any) {
      if (isMissingCustomFieldsSchemaError(err)) {
        setError(CUSTOM_FIELDS_MIGRATION_HINT);
        return;
      }
      setError(err?.message || 'Failed to create option');
    }
  };

  const handleDeleteFieldOption = async (optionId: string): Promise<void> => {
    try {
      await fieldOptionService.deleteOption(optionId);
      await loadCustomFields();
    } catch (err: any) {
      if (isMissingCustomFieldsSchemaError(err)) {
        setError(CUSTOM_FIELDS_MIGRATION_HINT);
        return;
      }
      setError(err?.message || 'Failed to delete option');
    }
  };

  const handleRenameList = async (): Promise<void> => {
    if (!list?.id) return;
    const nextName = renameDraft.trim();
    if (!nextName || nextName === list.name) {
      setRenameMode(false);
      setRenameDraft(list.name || '');
      return;
    }
    try {
      const updated = await focalBoardService.updateLane(list.id, { name: nextName });
      setList((prev: any) => ({ ...(prev || {}), name: updated?.name || nextName }));
      setRenameMode(false);
      setSettingsMenuOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to rename list');
    }
  };

  const handleDeleteList = async (): Promise<void> => {
    if (!list?.id) return;
    const approved = window.confirm(`Delete "${list.name}"? This cannot be undone.`);
    if (!approved) return;
    try {
      await focalBoardService.deleteLane(list.id);
      navigate('/spaces', {
        state: {
          selectedFocal: list.focals?.name,
          selectedFocalId: list.focal_id || list.focals?.id,
          listsRefreshToken: Date.now()
        }
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to delete list');
    }
  };

  const buildDefaultOptionDrafts = (type: ListFieldType): ColumnOptionDraft[] => {
    if (type === 'status') {
      return DEFAULT_STATUS_OPTION_PRESETS.map((entry, index) => ({
        id: `new-${Date.now()}-${index}`,
        label: entry.label,
        color_fill: entry.color_fill,
        color_border: entry.color_border,
        color_text: entry.color_text
      }));
    }
    if (type === 'select') {
      return [
        {
          id: `new-${Date.now()}-0`,
          label: 'Option 1',
          color_fill: '#EEF5FF',
          color_border: '#CFE2FF',
          color_text: '#29466D'
        }
      ];
    }
    return [];
  };

  const closeColumnPopover = (immediate = false): void => {
    setColumnPopoverOpen(false);
    if (columnPopoverCloseTimerRef.current != null) {
      window.clearTimeout(columnPopoverCloseTimerRef.current);
    }
    const finalize = (): void => {
      setColumnPopoverStatusKey(null);
      setColumnPopoverFieldId(null);
    };
    if (immediate) {
      finalize();
      return;
    }
    columnPopoverCloseTimerRef.current = window.setTimeout(finalize, 210);
  };

  const openCreateColumnPopover = (statusKey: string): void => {
    if (columnPopoverCloseTimerRef.current != null) {
      window.clearTimeout(columnPopoverCloseTimerRef.current);
    }
    setColumnPopoverStatusKey(statusKey);
    setColumnPopoverFieldId(null);
    setColumnPopoverName('');
    setColumnPopoverType('status');
    setColumnPopoverPinned(true);
    setColumnPopoverOptions(buildDefaultOptionDrafts('status'));
    window.requestAnimationFrame(() => setColumnPopoverOpen(true));
  };

  const openEditColumnPopover = (statusKey: string, field: ListField): void => {
    if (columnPopoverCloseTimerRef.current != null) {
      window.clearTimeout(columnPopoverCloseTimerRef.current);
    }
    setColumnPopoverStatusKey(statusKey);
    setColumnPopoverFieldId(field.id);
    setColumnPopoverName(field.name);
    setColumnPopoverType(field.type);
    setColumnPopoverPinned(Boolean(field.is_pinned));
    setColumnPopoverOptions(
      (field.options || []).map((option, index) => ({
        id: option.id || `existing-${index}`,
        label: option.label,
        color_fill: option.color_fill || '#EEF5FF',
        color_border: option.color_border || '#CFE2FF',
        color_text: option.color_text || '#29466D'
      }))
    );
    window.requestAnimationFrame(() => setColumnPopoverOpen(true));
  };

  const appendColumnOptionDraft = (): void => {
    setColumnPopoverOptions((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${prev.length}`,
        label: `Option ${prev.length + 1}`,
        color_fill: '#EEF5FF',
        color_border: '#CFE2FF',
        color_text: '#29466D'
      }
    ]);
  };

  const updateColumnOptionDraft = (id: string, patch: Partial<ColumnOptionDraft>): void => {
    setColumnPopoverOptions((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const removeColumnOptionDraft = (id: string): void => {
    setColumnPopoverOptions((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleSaveColumnPopover = async (): Promise<void> => {
    if (!user?.id || !listId) return;
    const name = columnPopoverName.trim();
    if (!name) return;

    const normalizedOptions = columnPopoverOptions
      .map((entry) => ({
        ...entry,
        label: entry.label.trim()
      }))
      .filter((entry) => entry.label.length > 0);

    try {
      if (!columnPopoverFieldId) {
        const created = await listFieldService.createField(listId, {
          user_id: user.id,
          name,
          field_key: normalizeStatusKey(name),
          type: columnPopoverType,
          order_index: listFields.length,
          is_pinned: columnPopoverPinned
        });
        if ((columnPopoverType === 'status' || columnPopoverType === 'select') && normalizedOptions.length > 0) {
          await Promise.all(
            normalizedOptions.map((entry, index) =>
              fieldOptionService.createOption(created.id, {
                user_id: user.id,
                label: entry.label,
                option_key: normalizeStatusKey(entry.label),
                order_index: index,
                color_fill: entry.color_fill,
                color_border: entry.color_border,
                color_text: entry.color_text
              })
            )
          );
        }
      } else {
        const targetField = listFields.find((field) => field.id === columnPopoverFieldId);
        if (!targetField) return;

        await listFieldService.updateField(columnPopoverFieldId, {
          name,
          is_pinned: columnPopoverPinned
        });

        if (targetField.type === 'status' || targetField.type === 'select') {
          const existingOptions = targetField.options || [];
          const existingById = new Map(existingOptions.map((entry) => [entry.id, entry]));
          const nextIds = new Set(normalizedOptions.map((entry) => entry.id).filter((id) => !id.startsWith('new-')));

          await Promise.all(
            existingOptions
              .filter((entry) => !nextIds.has(entry.id))
              .map((entry) => fieldOptionService.deleteOption(entry.id))
          );

          await Promise.all(
            normalizedOptions.map(async (entry, index) => {
              if (entry.id.startsWith('new-')) {
                await fieldOptionService.createOption(columnPopoverFieldId, {
                  user_id: user.id,
                  label: entry.label,
                  option_key: normalizeStatusKey(entry.label),
                  order_index: index,
                  color_fill: entry.color_fill,
                  color_border: entry.color_border,
                  color_text: entry.color_text
                });
                return;
              }
              const previous = existingById.get(entry.id);
              if (!previous) return;
              await fieldOptionService.updateOption(entry.id, {
                label: entry.label,
                order_index: index,
                color_fill: entry.color_fill,
                color_border: entry.color_border,
                color_text: entry.color_text
              });
            })
          );
        }
      }

      closeColumnPopover(true);
      await loadCustomFields();
    } catch (err: any) {
      if (isMissingCustomFieldsSchemaError(err)) {
        setError(CUSTOM_FIELDS_MIGRATION_HINT);
        return;
      }
      setError(err?.message || 'Failed to save column');
    }
  };

  const handleDeleteColumnFromPopover = async (): Promise<void> => {
    if (!columnPopoverFieldId) return;
    try {
      await handleDeleteField(columnPopoverFieldId);
      closeColumnPopover(true);
    } catch {
      // errors are handled in handleDeleteField
    }
  };

  const handleReorderPinnedFields = useCallback(
    async (sourceFieldId: string, targetFieldId: string): Promise<void> => {
      if (!listId || sourceFieldId === targetFieldId) return;
      const sourceIndex = pinnedFields.findIndex((field) => field.id === sourceFieldId);
      const targetIndex = pinnedFields.findIndex((field) => field.id === targetFieldId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

      const reordered = [...pinnedFields];
      const [moved] = reordered.splice(sourceIndex, 1);
      if (!moved) return;
      reordered.splice(targetIndex, 0, moved);
      const orderMap = new Map(reordered.map((field, index) => [field.id, index]));

      const snapshot = listFields;
      setListFields((prev) =>
        prev.map((field) =>
          orderMap.has(field.id)
            ? {
                ...field,
                order_index: orderMap.get(field.id) as number
              }
            : field
        )
      );

      try {
        await listFieldService.reorderFields(
          listId,
          reordered.map((field) => field.id)
        );
        await loadCustomFields();
      } catch (err: any) {
        setListFields(snapshot);
        if (isMissingCustomFieldsSchemaError(err)) {
          setError(CUSTOM_FIELDS_MIGRATION_HINT);
          return;
        }
        setError(err?.message || 'Failed to reorder columns');
      }
    },
    [listFields, listId, loadCustomFields, pinnedFields]
  );

  const handleAnalyze = async (): Promise<void> => {
    if (!list?.id) {
      return;
    }
    setAnalyzing(true);
    setProposalError(null);
    try {
      const result = await focalBoardService.getOptimizationProposal({
        scope: 'list',
        scope_id: list.id
      });
      const proposal = result?.proposal;
      setProposalSource((proposal?.source as 'ai' | 'heuristic') || 'unknown');

      const nextRows: ProposalRow[] = [];
      const itemsById = new Map(items.map((entry) => [entry.id, entry]));
      const actionsById = new Map(items.flatMap((entry) => (entry.actions || []).map((action) => [action.id, action] as const)));

      (proposal?.field_updates || []).forEach((update: FieldUpdateProposal, index: number) => {
        const firstKey = Object.keys(update.changes || {})[0] || 'change';
        const proposed = update.changes?.[firstKey];
        const entityName = update.entity === 'item'
          ? itemsById.get(update.id)?.title || 'Item'
          : update.entity === 'action'
            ? actionsById.get(update.id)?.title || 'Action'
            : update.entity === 'list'
              ? list.name
              : 'Time block';
        const currentRaw = update.entity === 'item'
          ? (itemsById.get(update.id) as any)?.[firstKey]
          : update.entity === 'action'
            ? (actionsById.get(update.id) as any)?.[firstKey]
            : null;
        nextRows.push({
          id: `field-${update.entity}-${update.id}-${index}`,
          entity: `${update.entity}: ${entityName}`,
          currentValue: currentRaw == null ? '—' : String(currentRaw),
          proposedValue: proposed == null ? '—' : String(proposed),
          reason: proposal?.reasoning || 'Proposed update',
          approved: false,
          payload: { kind: 'field_update', value: update }
        });
      });

      (proposal?.new_actions || []).forEach((newAction: NewActionProposal, index: number) => {
        nextRows.push({
          id: `new-action-${newAction.item_id}-${index}`,
          entity: `action: ${itemsById.get(newAction.item_id)?.title || 'Item'}`,
          currentValue: 'none',
          proposedValue: newAction.title,
          reason: proposal?.reasoning || 'Proposed new action',
          approved: false,
          payload: { kind: 'new_action', value: newAction }
        });
      });

      (proposal?.calendar_proposals || []).forEach((entry: CalendarProposal, index: number) => {
        nextRows.push({
          id: `calendar-${index}-${entry.scheduled_start_utc}`,
          entity: 'time_block: calendar',
          currentValue: 'none',
          proposedValue: entry.title,
          reason: proposal?.reasoning || 'Proposed calendar placement',
          approved: false,
          payload: { kind: 'calendar_proposal', value: entry }
        });
      });

      const rows: ProposalRow[] = nextRows;
      setProposals(rows);
    } catch (err: any) {
      setProposalError(err?.message || 'Failed to analyze list');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleBulkApprove = async (): Promise<void> => {
    if (!user) {
      return;
    }
    const approvedRows = proposals.filter((row) => row.approved);
    if (approvedRows.length === 0) {
      return;
    }

    setBulkApplying(true);
    try {
      for (const row of approvedRows) {
        if (row.payload.kind === 'field_update') {
          const update = row.payload.value;
          if (update.entity === 'item') {
            await focalBoardService.updateItem(update.id, update.changes);
          } else if (update.entity === 'action') {
            await focalBoardService.updateAction(update.id, update.changes);
          } else if (update.entity === 'list') {
            await focalBoardService.updateLane(update.id, update.changes);
          } else if (update.entity === 'time_block') {
            await calendarService.patchTimeBlock(update.id, update.changes);
          }
          continue;
        }
        if (row.payload.kind === 'new_action') {
          const proposal = row.payload.value;
          await focalBoardService.createAction(
            proposal.item_id,
            user.id,
            proposal.title,
            proposal.notes ?? null,
            proposal.due_at_utc ?? null
          );
          continue;
        }
        if (row.payload.kind === 'calendar_proposal') {
          await calendarService.createTimeBlockFromProposal(user.id, row.payload.value);
        }
      }

      if (listId) {
        const refreshed = await focalBoardService.getListDetail(listId);
        setItems((refreshed.items || []).map((entry: any) => ({ ...entry, actions: entry.actions || [] })));
      }
      setProposals([]);
    } catch (err: any) {
      setProposalError(err?.message || 'Failed to apply approved proposals');
    } finally {
      setBulkApplying(false);
    }
  };

  const canManagePersistedStatuses = statuses.length > 0 && statuses.every((status) => Boolean(status.id));

  const handleCreateStatus = async (): Promise<void> => {
    if (!user || !list?.id || !canManagePersistedStatuses) {
      setError('Run the latest migration before managing custom statuses.');
      return;
    }
    const name = statusNameDraft.trim();
    if (!name) {
      return;
    }
    const existingKeys = new Set(statuses.map((status) => status.key));
    const baseKey = normalizeStatusKey(name) || 'status';
    let key = baseKey;
    let suffix = 2;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${suffix}`;
      suffix += 1;
    }
    try {
      const created = await focalBoardService.createLaneStatus(list.id, user.id, {
        key,
        name,
        color: statusColorDraft,
        group_key: key,
        order_num: statuses.length,
        is_default: false
      });
      setStatuses((prev) => [...prev, created]);
      setStatusNameDraft('');
      setStatusColorDraft(STATUS_COLORS[0]);
    } catch (err: any) {
      setError(err?.message || 'Failed to create status');
    }
  };

  const handleImportStatusesFromList = async (): Promise<void> => {
    if (!user || !list?.id || !statusImportListId || !canManagePersistedStatuses) {
      return;
    }
    setImportingStatuses(true);
    try {
      const sourceStatuses = await focalBoardService.getLaneStatuses(statusImportListId);
      if (!sourceStatuses?.length) {
        return;
      }
      const existingKeys = new Set(statuses.map((status) => status.key));
      let nextOrder = statuses.length;
      const createdRows: LaneStatus[] = [];
      for (const source of sourceStatuses) {
        const baseKey = normalizeStatusKey(source.name || source.key || 'status') || 'status';
        let key = baseKey;
        let suffix = 2;
        while (existingKeys.has(key)) {
          key = `${baseKey}_${suffix}`;
          suffix += 1;
        }
        existingKeys.add(key);
        const created = await focalBoardService.createLaneStatus(list.id, user.id, {
          key,
          name: source.name,
          color: source.color || STATUS_COLORS[0],
          group_key: source.group_key || key,
          order_num: nextOrder,
          is_default: false
        });
        nextOrder += 1;
        createdRows.push(created);
      }
      if (createdRows.length > 0) {
        setStatuses((prev) => [...prev, ...createdRows]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to import statuses');
    } finally {
      setImportingStatuses(false);
    }
  };

  const handlePatchStatus = async (statusId: string, updates: Partial<LaneStatus>): Promise<void> => {
    const snapshot = [...statuses];
    setStatuses((prev) => prev.map((entry) => (entry.id === statusId ? { ...entry, ...updates } : entry)));
    try {
      await focalBoardService.updateLaneStatus(statusId, updates);
    } catch (err: any) {
      setStatuses(snapshot);
      setError(err?.message || 'Failed to update status');
    }
  };

  const handleMoveStatus = async (statusId: string, direction: 'up' | 'down'): Promise<void> => {
    const currentIndex = statuses.findIndex((status) => status.id === statusId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= statuses.length) return;

    const snapshot = [...statuses];
    const reordered = [...statuses];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const normalized = reordered.map((status, index) => ({ ...status, order_num: index }));
    setStatuses(normalized);

    try {
      await Promise.all(
        normalized
          .filter((status) => Boolean(status.id))
          .map((status) => focalBoardService.updateLaneStatus(status.id as string, { order_num: status.order_num }))
      );
    } catch (err: any) {
      setStatuses(snapshot);
      setError(err?.message || 'Failed to reorder statuses');
    }
  };

  const handleDeleteStatus = async (status: LaneStatus): Promise<void> => {
    if (!status.id || statuses.length <= 1) {
      return;
    }
    const fallback = statuses.find((entry) => entry.id !== status.id);
    if (!fallback) {
      return;
    }

    const affectedItems = items.filter((item) => item.status_id === status.id);
    const nextItems = items.map((item) =>
      item.status_id === status.id
        ? { ...item, status_id: fallback.id, status: fallback.key }
        : item
    );
    const nextStatuses = statuses
      .filter((entry) => entry.id !== status.id)
      .map((entry, index) => ({ ...entry, order_num: index }));

    const itemSnapshot = [...items];
    const statusSnapshot = [...statuses];
    setItems(nextItems);
    setStatuses(nextStatuses);
    try {
      await Promise.all(
        affectedItems.map((item) =>
          focalBoardService.updateItem(item.id, { status_id: fallback.id, status: fallback.key })
        )
      );
      await focalBoardService.deleteLaneStatus(status.id);
      await Promise.all(
        nextStatuses
          .filter((entry) => Boolean(entry.id))
          .map((entry) => focalBoardService.updateLaneStatus(entry.id as string, { order_num: entry.order_num }))
      );
    } catch (err: any) {
      setItems(itemSnapshot);
      setStatuses(statusSnapshot);
      setError(err?.message || 'Failed to delete status');
    }
  };

  const renderPinnedFieldCell = (item: ListItem, field: ListField): JSX.Element => {
    const value = getFieldValueForItem(item.id, field.id);
    const isEditing = editingFieldCell?.itemId === item.id && editingFieldCell?.fieldId === field.id;

    if ((field.type === 'status' || field.type === 'select') && isEditing) {
      return (
        <select
          className="list-field-cell-input"
          value={value?.option_id || ''}
          onChange={(event) => {
            const optionId = event.target.value;
            if (!optionId) return;
            void upsertFieldValue(item.id, field, { option_id: optionId });
          }}
          onBlur={() => setEditingFieldCell(null)}
          autoFocus
        >
          <option value="">Select</option>
          {(field.options || []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'boolean') {
      const checked = Boolean(value?.value_boolean);
      return (
        <button
          type="button"
          className={`list-field-boolean ${checked ? 'on' : ''}`.trim()}
          onClick={(event) => {
            event.stopPropagation();
            void upsertFieldValue(item.id, field, { value_boolean: !checked });
          }}
        >
          {checked ? 'Yes' : 'No'}
        </button>
      );
    }

    if (isEditing) {
      if (field.type === 'text') {
        return (
          <input
            className="list-field-cell-input"
            defaultValue={value?.value_text || ''}
            onBlur={(event) => void upsertFieldValue(item.id, field, { value_text: event.target.value.trim() || '' })}
            autoFocus
          />
        );
      }
      if (field.type === 'number') {
        return (
          <input
            className="list-field-cell-input"
            type="text"
            inputMode="decimal"
            defaultValue={value?.value_number ?? undefined}
            onBlur={(event) => {
              const num = parseNumericFieldInput(event.target.value);
              if (num == null) {
                setEditingFieldCell(null);
                return;
              }
              void upsertFieldValue(item.id, field, { value_number: num });
            }}
            autoFocus
          />
        );
      }
      if (field.type === 'date') {
        return (
          <input
            className="list-field-cell-input"
            type="date"
            defaultValue={value?.value_date ? new Date(value.value_date).toISOString().slice(0, 10) : ''}
            onBlur={(event) => {
              if (!event.target.value) {
                setEditingFieldCell(null);
                return;
              }
              void upsertFieldValue(item.id, field, { value_date: new Date(event.target.value).toISOString() });
            }}
            autoFocus
          />
        );
      }
    }

    const option = getOptionById(field, value?.option_id);
    if (field.type === 'status' || field.type === 'select') {
      return (
        <button
          type="button"
          className="list-field-cell-value"
          onClick={(event) => {
            event.stopPropagation();
            setEditingFieldCell({ itemId: item.id, fieldId: field.id });
          }}
        >
          {option?.label || '--'}
        </button>
      );
    }

    const cellClassName = field.type === 'text'
      ? 'list-field-cell-value list-field-cell-text'
      : 'list-field-cell-value';

    return (
      <button
        type="button"
        className={cellClassName}
        onClick={(event) => {
          event.stopPropagation();
          setEditingFieldCell({ itemId: item.id, fieldId: field.id });
        }}
      >
        {getDisplayValue(field, value)}
      </button>
    );
  };

  if (authLoading || loading) {
    return <div className="app-page"><div className="list-view-loading">Loading list...</div></div>;
  }

  if (!user) {
    return <div className="app-page"><div className="list-view-error">Sign in to view this list.</div></div>;
  }

  if (error) {
    return <div className="app-page"><div className="list-view-error">{error}</div></div>;
  }

  if (!list) {
    return <div className="app-page"><div className="list-view-error">List not found.</div></div>;
  }

  const itemTerm = list.item_label || 'Items';
  const actionTerm = list.action_label || 'Tasks';
  const oneOffRowTemplate = pinnedFields.length
    ? `auto auto minmax(140px,1fr) repeat(${pinnedFields.length}, minmax(120px, 1fr))`
    : 'auto auto minmax(140px, 1fr)';
  const oneOffHeaderTemplate = oneOffRowTemplate;
  const recurringRowTemplate = pinnedFields.length
    ? `auto auto minmax(140px,1fr) repeat(${pinnedFields.length}, minmax(120px, 1fr)) minmax(260px, 1.6fr)`
    : 'auto auto minmax(140px, 1fr) minmax(260px, 1.6fr)';

  return (
    <div className="app-page list-view-page">
      <div className="list-view-head">
        <button type="button" className="list-view-back" onClick={() => navigate('/spaces', { state: { selectedFocal: list.focals?.name } })}>
          ← Back
        </button>
        {renameMode ? (
          <form
            className="list-title-rename-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleRenameList();
            }}
          >
            <input
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              autoFocus
              onBlur={() => void handleRenameList()}
            />
          </form>
        ) : (
          <h1
            className="page-title list-title-editable"
            onDoubleClick={() => setRenameMode(true)}
            title="Double-click to rename"
          >
            {list.name}
          </h1>
        )}
        <div className="list-settings-menu-wrap" ref={settingsMenuRef}>
          <button
            type="button"
            className="list-settings-gear-btn"
            onClick={() => setSettingsMenuOpen((prev) => !prev)}
            aria-label="List settings"
            aria-expanded={settingsMenuOpen}
          >
            <GearSix size={18} weight="regular" />
          </button>
          <div className={`list-settings-menu ${settingsMenuOpen ? 'open' : ''}`.trim()}>
            <button
              type="button"
              className="list-settings-icon-btn"
              onClick={() => void handleAnalyze()}
              disabled={analyzing}
              aria-label={analyzing ? 'Analyzing list' : 'Analyze list'}
              title={analyzing ? 'Analyzing list' : 'Analyze list'}
            >
              <img className="delta-ai-button-icon" src="/Delta-AI-Button.png" alt="" aria-hidden="true" width={14} height={14} />
            </button>
            <button
              type="button"
              className="list-settings-icon-btn"
              onClick={() => setShowCompletedSubtasks((prev) => !prev)}
              aria-label={showCompletedSubtasks ? 'Hide completed tasks' : 'Show completed tasks'}
              title={showCompletedSubtasks ? 'Hide completed tasks' : 'Show completed tasks'}
            >
              {showCompletedSubtasks ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              type="button"
              className="list-settings-icon-btn danger"
              onClick={() => void handleDeleteList()}
              aria-label="Delete list"
              title="Delete list"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {proposalError && <p className="list-proposal-error">{proposalError}</p>}

      <ProposalReviewTable
        title="Optimization Review"
        source={proposalSource}
        rows={proposals}
        applying={bulkApplying}
        onToggleRow={(id, approved) =>
          setProposals((prev) => prev.map((row) => (row.id === id ? { ...row, approved } : row)))
        }
        onApproveSelected={() => void handleBulkApprove()}
        onCancel={() => setProposals([])}
      />

      {listMode === 'one_off' ? (
        <div className="list-status-groups">
          {grouped.map(({ status, items: groupedItems }) => (
            <section key={status.id || status.key} className="list-status-group">
              <header className="list-status-header">
                <div className="list-status-title">
                  <span className="list-status-chip" style={{ '--status-color': status.color } as CSSProperties}>
                    <span className="list-status-chip-dot" />
                    {status.name}
                  </span>
                </div>
              </header>

              <div className="list-status-items">
                <div className="list-fields-header-row" style={{ gridTemplateColumns: oneOffHeaderTemplate }}>
                  <span className="list-fields-header-spacer list-fields-header-spacer-expand" aria-hidden="true" />
                  <span className="list-fields-header-spacer list-fields-header-spacer-status" aria-hidden="true" />
                  <span className="list-fields-header-title">Name</span>
                  {pinnedFields.map((field) => (
                    <span key={`head-${status.key}-${field.id}`} className="list-fields-header-cell">
                      <button
                        type="button"
                        className="list-column-header-btn list-column-control-label"
                        onClick={() => openEditColumnPopover(status.key, field)}
                        title="Edit column"
                        draggable
                        onDragStart={(event) => {
                          setDraggingFieldId(field.id);
                          event.dataTransfer.setData('text/plain', field.id);
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const sourceId = event.dataTransfer.getData('text/plain') || draggingFieldId;
                          if (sourceId) {
                            void handleReorderPinnedFields(sourceId, field.id);
                          }
                          setDraggingFieldId(null);
                        }}
                        onDragEnd={() => setDraggingFieldId(null)}
                      >
                        {field.name}
                      </button>
                    </span>
                  ))}
                  <span className="list-fields-header-cell add-column" ref={columnPopoverStatusKey === status.key ? columnPopoverRef : null}>
                    <button
                      type="button"
                      className="list-add-column-btn"
                      aria-expanded={columnPopoverStatusKey === status.key && columnPopoverOpen}
                      onClick={() =>
                        columnPopoverStatusKey === status.key && columnPopoverOpen
                          ? closeColumnPopover()
                          : openCreateColumnPopover(status.key)
                      }
                    >
                      <span className="list-add-column-plus-wrap">
                        <Plus size={13} />
                      </span>
                      <span className="list-add-column-label">Add Column</span>
                    </button>
                    {columnPopoverStatusKey === status.key && (
                      <div className={`list-column-popover ${columnPopoverOpen ? 'open' : 'closing'}`.trim()}>
                        <div className="list-column-popover-head">
                          <strong>{columnPopoverFieldId ? 'Edit Column' : 'Add Column'}</strong>
                          {columnPopoverFieldId && (
                            <button
                              type="button"
                              className="list-column-popover-delete"
                              onClick={() => void handleDeleteColumnFromPopover()}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        <label className="list-column-popover-field">
                          <span>Field name</span>
                          <input
                            value={columnPopoverName}
                            onChange={(event) => setColumnPopoverName(event.target.value)}
                            placeholder="e.g. Lead source"
                            autoFocus
                          />
                        </label>
                        <label className="list-column-popover-field">
                          <span>Field type</span>
                          <select
                            value={columnPopoverType}
                            onChange={(event) => {
                              const nextType = event.target.value as ListFieldType;
                              setColumnPopoverType(nextType);
                              if (nextType === 'status' || nextType === 'select') {
                                if (columnPopoverOptions.length === 0) {
                                  setColumnPopoverOptions(buildDefaultOptionDrafts(nextType));
                                }
                              } else {
                                setColumnPopoverOptions([]);
                              }
                            }}
                            disabled={Boolean(columnPopoverFieldId)}
                          >
                            <option value="status">Status</option>
                            <option value="select">Select</option>
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="boolean">Boolean</option>
                          </select>
                        </label>
                        <label className="list-column-popover-pin">
                          <input
                            type="checkbox"
                            checked={columnPopoverPinned}
                            onChange={(event) => setColumnPopoverPinned(event.target.checked)}
                          />
                          <span>Show in table</span>
                        </label>

                        {(columnPopoverType === 'status' || columnPopoverType === 'select') && (
                          <div className="list-column-options-editor">
                            <div className="list-column-options-head">
                              <span>{columnPopoverType === 'status' ? 'Status options' : 'Select options'}</span>
                              <button type="button" onClick={appendColumnOptionDraft}>
                                + Add option
                              </button>
                            </div>
                            <div className="list-column-options-list">
                              {columnPopoverOptions.map((option) => (
                                <div key={option.id} className="list-column-option-row">
                                  <input
                                    value={option.label}
                                    onChange={(event) =>
                                      updateColumnOptionDraft(option.id, { label: event.target.value })
                                    }
                                    placeholder="Option label"
                                  />
                                  <label className="list-column-option-color">
                                    <input
                                      type="color"
                                      value={option.color_fill}
                                      onChange={(event) =>
                                        updateColumnOptionDraft(option.id, {
                                          color_fill: event.target.value,
                                          color_border: event.target.value
                                        })
                                      }
                                      aria-label="Option color"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className="list-column-option-remove"
                                    onClick={() => removeColumnOptionDraft(option.id)}
                                    aria-label="Remove option"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="list-column-popover-actions">
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => closeColumnPopover()}
                          >
                            Cancel
                          </button>
                          <button type="button" className="primary" onClick={() => void handleSaveColumnPopover()}>
                            Save
                          </button>
                        </div>
                      </div>
                    )}
                  </span>
                </div>
                {groupedItems.map((item) => {
                  const actions = showCompletedSubtasks
                    ? (item.actions || [])
                    : (item.actions || []).filter((action) => action.status !== 'completed');
                  const isExpanded = Boolean(expandedByItem[item.id]);

                  return (
                    <article className="list-item-block" key={item.id}>
                      <div
                        className={`list-item-row ${draggingItemId === item.id ? 'dragging' : ''}`.trim()}
                        style={{ gridTemplateColumns: oneOffRowTemplate }}
                        onClick={() => openItemModal(item)}
                        draggable
                        onDragStart={(event) => {
                          setDraggingItemId(item.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', item.id);
                        }}
                        onDragEnd={() => setDraggingItemId(null)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const sourceId = event.dataTransfer.getData('text/plain') || draggingItemId;
                          if (!sourceId) return;
                          void handleDropItem(item.id, status, sourceId);
                        }}
                      >
                        <button
                          type="button"
                          className={`list-item-expand ${isExpanded ? 'expanded' : ''}`.trim()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedByItem((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                          }}
                          aria-label={isExpanded ? 'Collapse actions' : 'Expand actions'}
                        >
                          <ChevronRight size={12} />
                        </button>

                        <StatusSelect
                          statuses={statuses}
                          value={item.status_id ?? item.status}
                          onChange={(next: LaneStatus) => void handleStatusChange(item, next)}
                          appearance="circle"
                          onManageStatuses={() => setStatusManagerOpen(true)}
                        />

                        <span className="list-item-title">{item.title}</span>
                        {pinnedFields.map((field) => (
                          <span key={`${item.id}-${field.id}`} className="list-item-field-cell">
                            {renderPinnedFieldCell(item, field)}
                          </span>
                        ))}

                      </div>

                      {isExpanded && (
                        <div className="list-item-actions">
                          {actions.map((action) => (
                            <div className="list-action-row" key={action.id}>
                              <StatusSelect
                                statuses={statuses}
                                value={action.status}
                                onChange={(next: LaneStatus) => void handleActionStatusChange(item.id, action.id, next)}
                                appearance="circle"
                                onManageStatuses={() => setStatusManagerOpen(true)}
                              />
                              <span className="list-action-title">{action.title}</span>
                            </div>
                          ))}

                          {actionComposerByItem[item.id] ? (
                            <form
                              className="list-action-add-form"
                              onSubmit={(event) => {
                                event.preventDefault();
                                void handleCreateAction(item.id);
                              }}
                            >
                              <input
                                value={actionDraftByItem[item.id] || ''}
                                onChange={(event) =>
                                  setActionDraftByItem((prev) => ({ ...prev, [item.id]: event.target.value }))
                                }
                                placeholder={`New ${actionTerm}`}
                                autoFocus
                              />
                              <button type="submit">Save</button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="list-action-add"
                              onClick={() => setActionComposerByItem((prev) => ({ ...prev, [item.id]: true }))}
                            >
                              <span className="list-inline-add-label">+ New {actionTerm}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}

                {composerOpenByStatus[status.key] ? (
                  <form
                    className="list-status-add-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleCreateItemInStatus(status);
                    }}
                  >
                    <input
                      value={draftByStatus[status.key] || ''}
                      onChange={(event) =>
                        setDraftByStatus((prev) => ({ ...prev, [status.key]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setComposerOpenByStatus((prev) => ({ ...prev, [status.key]: false }));
                          setDraftByStatus((prev) => ({ ...prev, [status.key]: '' }));
                          setComposerModeByStatus((prev) => ({ ...prev, [status.key]: 'item' }));
                          return;
                        }
                        if (event.key === 'Tab') {
                          event.preventDefault();
                          if (event.shiftKey) {
                            setComposerModeByStatus((prev) => ({ ...prev, [status.key]: 'item' }));
                            return;
                          }
                          if (lastCreatedItemByStatus[status.key]) {
                            setComposerModeByStatus((prev) => ({ ...prev, [status.key]: 'subtask' }));
                          }
                        }
                      }}
                      autoFocus
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    className="list-status-add"
                    onClick={() => {
                      setComposerOpenByStatus((prev) => ({ ...prev, [status.key]: true }));
                      setComposerModeByStatus((prev) => ({ ...prev, [status.key]: 'item' }));
                    }}
                    >
                    <span className="list-inline-add-label">+ New {itemTerm}</span>
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="list-recurring-shell">
          <header className="list-recurring-head">
            <h2>Recurring View</h2>
            <span>
              Tasks this week: {(recurringSummary.task_completed_count ?? recurringSummary.completed_count)}/
              {(recurringSummary.task_scheduled_count ?? recurringSummary.scheduled_count)}
            </span>
          </header>
          {recurringLoading && <p className="list-recurring-note">Loading recurring schedule...</p>}
          {recurringError && <p className="list-recurring-note error">{recurringError}</p>}
          {!recurringLoading && !recurringError && recurringItems.length === 0 && (
            <p className="list-recurring-note">No items yet.</p>
          )}
          {!recurringLoading && !recurringError && recurringItems.length > 0 && (
            <div className="list-recurring-items">
              {recurringItems.map((item) => {
                const activeOccurrence = item.recurring?.current_or_next_occurrence || null;
                const canCheck = Boolean(activeOccurrence);
                const isChecked = Boolean(
                  activeOccurrence &&
                    item.recurring?.last_completed?.scheduled_start === activeOccurrence.scheduled_start
                );
                const actions = showCompletedSubtasks
                  ? (item.actions || [])
                  : (item.actions || []).filter((action) => action.status !== 'completed');
                const isExpanded = Boolean(expandedByItem[item.id]);
                const activeTaskTotal = item.recurring?.active_task_total_count ?? 0;
                const activeTaskCompleted = item.recurring?.active_task_completed_count ?? 0;
                return (
                  <article className="list-item-block recurring-item-block" key={`rec-${item.id}`}>
                    <div
                      className="list-item-row recurring"
                      style={{ gridTemplateColumns: recurringRowTemplate }}
                      onClick={() => openItemModal(item)}
                    >
                      <button
                        type="button"
                        className={`list-item-expand ${isExpanded ? 'expanded' : ''}`.trim()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedByItem((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                        }}
                        aria-label={isExpanded ? 'Collapse actions' : 'Expand actions'}
                      >
                        <ChevronRight size={12} />
                      </button>
                      <button
                        type="button"
                        className={`list-recurring-check ${isChecked ? 'checked' : ''}`.trim()}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleToggleRecurringOccurrence(item);
                        }}
                        disabled={!canCheck}
                      >
                        {isChecked ? 'Completed' : 'Mark done'}
                      </button>
                      <span className="list-item-title recurring-title-with-progress">
                        <span>{item.title}</span>
                        {activeTaskTotal > 0 && (
                          <span className="list-item-task-progress">
                            {activeTaskCompleted}/{activeTaskTotal} tasks completed
                          </span>
                        )}
                      </span>
                      {pinnedFields.map((field) => (
                        <span key={`rec-${item.id}-${field.id}`} className="list-item-field-cell">
                          {renderPinnedFieldCell(item, field)}
                        </span>
                      ))}
                      <span className="list-recurring-meta">
                        <span>Next: {formatOccurrenceTime(item.recurring?.next_occurrence?.scheduled_start)}</span>
                        <span>Last: {formatOccurrenceTime(item.recurring?.last_completed?.completed_at || item.recurring?.last_completed?.scheduled_start)}</span>
                        <span>Streak: {item.recurring?.streak || 0}</span>
                        <span>
                          Tasks this week: {(item.recurring?.task_completed_count ?? item.recurring?.completed_count ?? 0)}/
                          {(item.recurring?.task_scheduled_count ?? item.recurring?.scheduled_count ?? 0)}
                        </span>
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="list-item-actions">
                        {actions.map((action) => (
                          <div className="list-action-row" key={action.id}>
                            <button
                              type="button"
                              className={`list-recurring-check ${action.recurring?.active_completion_state === 'completed' ? 'checked' : ''}`.trim()}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleToggleRecurringTaskOccurrence(item, action);
                              }}
                              disabled={!action.recurring?.current_or_next_occurrence}
                            >
                              {action.recurring?.active_completion_state === 'completed' ? 'Done' : 'Do'}
                            </button>
                            <StatusSelect
                              statuses={statuses}
                              value={action.status}
                              onChange={(next: LaneStatus) => void handleActionStatusChange(item.id, action.id, next)}
                              appearance="circle"
                              onManageStatuses={() => setStatusManagerOpen(true)}
                            />
                            <span className="list-action-title">{action.title}</span>
                          </div>
                        ))}

                        {actionComposerByItem[item.id] ? (
                          <form
                            className="list-action-add-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void handleCreateAction(item.id);
                            }}
                          >
                            <input
                              value={actionDraftByItem[item.id] || ''}
                              onChange={(event) =>
                                setActionDraftByItem((prev) => ({ ...prev, [item.id]: event.target.value }))
                              }
                              placeholder={`New ${actionTerm}`}
                              autoFocus
                            />
                            <button type="submit">Save</button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            className="list-action-add"
                            onClick={() => setActionComposerByItem((prev) => ({ ...prev, [item.id]: true }))}
                          >
                            <span className="list-inline-add-label">+ New {actionTerm}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          {!recurringLoading && !recurringError && (
            recurringComposerOpen ? (
              <form
                className="list-status-add-form recurring-add-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateRecurringItem();
                }}
              >
                <input
                  value={recurringDraft}
                  onChange={(event) => setRecurringDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setRecurringComposerOpen(false);
                      setRecurringDraft('');
                      setRecurringComposerMode('item');
                      return;
                    }
                    if (event.key === 'Tab') {
                      event.preventDefault();
                      if (event.shiftKey) {
                        setRecurringComposerMode('item');
                        return;
                      }
                      if (lastCreatedRecurringItemId) {
                        setRecurringComposerMode('subtask');
                      }
                    }
                  }}
                  autoFocus
                />
              </form>
            ) : (
              <button
                type="button"
                className="list-status-add recurring-add-trigger"
                onClick={() => {
                  setRecurringComposerOpen(true);
                  setRecurringComposerMode('item');
                }}
              >
                <span className="list-inline-add-label">+ New {itemTerm}</span>
              </button>
            )
          )}
          {!recurringLoading && !recurringError && recurringItems.every((item) => !item.recurring?.next_occurrence) && (
            <p className="list-recurring-note">Link this list to calendar time blocks to enable recurring completion.</p>
          )}
        </section>
      )}

      {selectedItem && (
        <div className="list-item-modal-overlay" onClick={closeItemModal}>
          <section className="list-item-modal" onClick={(event) => event.stopPropagation()}>
            <header className="list-item-modal-head">
              <h2>{selectedItem.title}</h2>
              <button type="button" className="list-item-modal-close" onClick={closeItemModal} aria-label="Close item panel">
                <CloseIcon size={16} />
              </button>
            </header>

            <div className="list-item-modal-body">
              <div className="list-item-modal-main">
                <label className="list-item-field">
                  <span>Name</span>
                  <input
                    value={modalTitleDraft}
                    onChange={(event) => setModalTitleDraft(event.target.value)}
                    placeholder="Item name"
                  />
                </label>

                <label className="list-item-field">
                  <span>Description</span>
                  <textarea
                    value={modalDescriptionDraft}
                    onChange={(event) => setModalDescriptionDraft(event.target.value)}
                    placeholder="Details, notes, and context"
                    rows={5}
                  />
                </label>
                {descriptionAutosaveBusy && <p className="list-item-autosave-note">Saving description…</p>}

                <div className="list-item-field">
                  <span>Status</span>
                  <StatusSelect
                    statuses={statuses}
                    value={modalStatusValue}
                    onChange={(next: LaneStatus) => setModalStatusValue(next.id ?? next.key)}
                    onManageStatuses={() => setStatusManagerOpen(true)}
                  />
                </div>

                <div className="list-item-field list-item-column-values">
                  <span>Column values</span>
                  {(listFields || []).length === 0 ? (
                    <p className="list-item-column-empty">No custom columns yet.</p>
                  ) : (
                    <div className="list-item-column-grid">
                      {listFields.map((field) => {
                        const fieldValue = getFieldValueForItem(selectedItem.id, field.id);
                        return (
                          <div key={field.id} className="list-item-column-row">
                            <strong>{field.name}</strong>
                            <span>{getDisplayValue(field, fieldValue)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="list-item-modal-actions">
                  <h3>{actionTerm}</h3>
                  <div className="list-item-modal-action-list">
                    {(selectedItem.actions || []).map((action) => (
                      <div
                        className={`list-action-row thread-target ${selectedActionForThreadId === action.id ? 'active' : ''}`.trim()}
                        key={`modal-${action.id}`}
                        onClick={() => {
                          setSelectedActionForThreadId(action.id);
                          setActiveCommentScope({ type: 'action', scopeId: action.id });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedActionForThreadId(action.id);
                            setActiveCommentScope({ type: 'action', scopeId: action.id });
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <StatusSelect
                          statuses={statuses}
                          value={action.status}
                          onChange={(next: LaneStatus) => void handleActionStatusChange(selectedItem.id, action.id, next)}
                          appearance="circle"
                          onManageStatuses={() => setStatusManagerOpen(true)}
                        />
                        <span className="list-action-title">{action.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="list-item-modal-save-row">
                  <div className="list-item-modal-settings-wrap">
                    <button
                      type="button"
                      className="list-item-settings-btn"
                      onClick={() => {
                        setItemModalSettingsOpen((prev) => !prev);
                        setItemMoveMenuOpen(false);
                      }}
                      aria-label="Item settings"
                    >
                      <GearSix size={16} weight="regular" />
                    </button>
                    <div className={`list-item-settings-slideout ${itemModalSettingsOpen ? 'open' : ''}`.trim()}>
                      <button
                        type="button"
                        className="list-item-settings-icon-btn"
                        onClick={() => setItemMoveMenuOpen((prev) => !prev)}
                        aria-label="Move item"
                        title="Move item"
                      >
                        <ArrowRightLeft size={16} />
                      </button>
                      <button
                        type="button"
                        className="list-item-settings-icon-btn danger"
                        onClick={() => void handleDeleteItemFromModal()}
                        disabled={deletingItem}
                        aria-label={deletingItem ? 'Deleting item' : 'Delete item'}
                        title={deletingItem ? 'Deleting item' : 'Delete item'}
                      >
                        <Trash2 size={16} />
                      </button>
                      <button type="button" className="list-item-settings-icon-btn" disabled aria-label="Merge item (soon)" title="Merge item (soon)">
                        <GitMerge size={16} />
                      </button>
                    </div>
                    <div className={`list-item-move-menu ${itemMoveMenuOpen ? 'open' : ''}`.trim()}>
                      {peerLists.length === 0 && <p>No lists available</p>}
                      {peerLists.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            setMoveTargetListId(entry.id);
                            setItemMoveMenuOpen(false);
                            void handleMoveItemToList(entry.id);
                          }}
                          disabled={movingItem}
                        >
                          {entry.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => void handleSaveItemFromModal()} disabled={savingItem}>
                    {savingItem ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>

              <aside className="list-item-modal-comments">
                <h3>Comments</h3>

                <div className="list-thread-scope-toggle" role="tablist" aria-label="Thread scope">
                  <button
                    type="button"
                    className={activeCommentScope?.type === 'item' ? 'active' : ''}
                    onClick={() => {
                      setSelectedActionForThreadId(null);
                      setActiveCommentScope({ type: 'item', scopeId: selectedItem.id });
                    }}
                  >
                    Item
                  </button>
                  <button
                    type="button"
                    className={activeCommentScope?.type === 'action' ? 'active' : ''}
                    onClick={() => {
                      if (!selectedActionForThreadId) return;
                      setActiveCommentScope({ type: 'action', scopeId: selectedActionForThreadId });
                    }}
                    disabled={!selectedActionForThreadId}
                  >
                    Action
                  </button>
                </div>

                <div className="list-item-comments-thread">
                  {commentsLoading && <p className="list-item-comments-empty">Loading comments...</p>}
                  {!commentsLoading && comments.length === 0 && (
                    <p className="list-item-comments-empty">No comments yet.</p>
                  )}
                  {comments.map((comment) => (
                    <div
                      className={`list-item-comment-row ${comment.author_type === 'ai' ? 'assistant' : 'user'}`.trim()}
                      key={comment.id}
                    >
                      {comment.author_type === 'ai' ? (
                        <article className="list-item-comment-assistant-block">
                          <div className="list-item-comment-meta">
                            <span>AI</span>
                            <time>{formatCommentTime(comment.created_at)}</time>
                          </div>
                          <p className="list-item-comment-assistant-text">{comment.content}</p>
                        </article>
                      ) : (
                        <article className="list-item-comment-user-bubble">
                          <p>{comment.content}</p>
                          <div className="list-item-comment-user-meta">
                            <time>{formatCommentTime(comment.created_at)}</time>
                            <button
                              type="button"
                              className="list-item-comment-push-ai"
                              onClick={() => void handlePushCommentToAi(comment)}
                              disabled={commentSubmitting || commentsLoading || pushingCommentId === comment.id}
                            >
                              {pushingCommentId === comment.id ? 'Sending…' : 'Push to Delta AI'}
                            </button>
                          </div>
                        </article>
                      )}
                    </div>
                  ))}
                </div>

                {commentError && <p className="list-item-comment-error">{commentError}</p>}

                <form
                  className="list-item-comment-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmitComment();
                  }}
                >
                  <div className="list-item-comment-composer-surface">
                    <div className="list-item-comment-input-row">
                      <div className="list-item-comment-input-wrap">
                        <textarea
                          className="list-item-comment-input"
                          value={commentDraft}
                          onChange={(event) => setCommentDraft(event.target.value)}
                          placeholder="Write a comment..."
                          rows={1}
                        />
                      </div>
                      <button
                        type="submit"
                        className="list-item-comment-send-button"
                        aria-label="Send comment"
                        disabled={commentSubmitting || !commentDraft.trim()}
                      >
                        <PaperPlaneTilt size={18} className="list-item-comment-send-icon" weight="fill" />
                      </button>
                    </div>
                  </div>
                </form>
              </aside>
            </div>
          </section>
        </div>
      )}

      {fieldManagerOpen && (
        <div className="list-status-manager-overlay" onClick={() => setFieldManagerOpen(false)}>
          <section className="list-status-manager list-fields-manager" onClick={(event) => event.stopPropagation()}>
            <header className="list-status-manager-head">
              <h2>Fields</h2>
              <button type="button" onClick={() => setFieldManagerOpen(false)}>Close</button>
            </header>

            <div className="list-status-manager-list">
              {listFields.map((field) => (
                <div key={field.id} className="list-status-manager-row list-field-manager-row">
                  <strong>{field.name}</strong>
                  <span>{field.type}</span>
                  <label className="list-field-pin-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(field.is_pinned)}
                      onChange={() => void handleToggleFieldPinned(field)}
                    />
                    <span>Pinned</span>
                  </label>
                  <button type="button" onClick={() => void handleDeleteField(field.id)}>Delete</button>

                  {(field.type === 'status' || field.type === 'select') && (
                    <div className="list-field-options-manager">
                      <div className="list-field-options-list">
                        {(field.options || []).map((option) => (
                          <span key={option.id} className="list-field-option-chip">
                            {option.label}
                            <button type="button" onClick={() => void handleDeleteFieldOption(option.id)}>×</button>
                          </span>
                        ))}
                      </div>
                      <form
                        className="list-field-option-create"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleCreateFieldOption(field);
                        }}
                      >
                        <input
                          value={newOptionByField[field.id] || ''}
                          onChange={(event) =>
                            setNewOptionByField((prev) => ({ ...prev, [field.id]: event.target.value }))
                          }
                          placeholder="Add option"
                        />
                        <button type="submit">Add</button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <form
              className="list-status-manager-create"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateField();
              }}
            >
              <input
                value={newFieldName}
                onChange={(event) => setNewFieldName(event.target.value)}
                placeholder="Field name"
              />
              <select value={newFieldType} onChange={(event) => setNewFieldType(event.target.value as ListFieldType)}>
                <option value="status">Status</option>
                <option value="select">Select</option>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="boolean">Boolean</option>
              </select>
              <button type="submit">Add Field</button>
            </form>
          </section>
        </div>
      )}

      {statusManagerOpen && (
        <div className="list-status-manager-overlay" onClick={() => setStatusManagerOpen(false)}>
          <section className="list-status-manager" onClick={(event) => event.stopPropagation()}>
            <header className="list-status-manager-head">
              <h2>Manage Statuses</h2>
              <button type="button" onClick={() => setStatusManagerOpen(false)}>Close</button>
            </header>

            {!canManagePersistedStatuses && (
              <p className="list-status-manager-note">
                Run the latest migration first to enable custom status management.
              </p>
            )}

            {canManagePersistedStatuses && statusImportCandidates.length > 0 && (
              <div className="list-status-import-row">
                <span>Inherit statuses from another list</span>
                <select value={statusImportListId} onChange={(event) => setStatusImportListId(event.target.value)}>
                  {statusImportCandidates.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => void handleImportStatusesFromList()} disabled={!statusImportListId || importingStatuses}>
                  {importingStatuses ? 'Importing…' : 'Import'}
                </button>
              </div>
            )}

            <div className="list-status-manager-list">
              {statuses.map((status, index) => (
                <div key={status.id || status.key} className="list-status-manager-row">
                  <span
                    className="list-status-manager-dot"
                    style={{ backgroundColor: status.color }}
                    aria-hidden="true"
                  />
                  <input
                    value={status.name}
                    onChange={(event) =>
                      void handlePatchStatus(status.id || '', {
                        name: event.target.value,
                        key: normalizeStatusKey(event.target.value) || status.key
                      })
                    }
                    disabled={!status.id}
                  />
                  <div className="list-status-color-swatches">
                    {STATUS_COLORS.map((color) => (
                      <button
                        key={`${status.id || status.key}-${color}`}
                        type="button"
                        className={`status-swatch ${status.color === color ? 'active' : ''}`.trim()}
                        style={{ backgroundColor: color }}
                        onClick={() => void handlePatchStatus(status.id || '', { color })}
                        disabled={!status.id}
                      />
                    ))}
                  </div>
                  <div className="list-status-manager-controls">
                    <button type="button" onClick={() => void handleMoveStatus(status.id || '', 'up')} disabled={!status.id || index === 0}>
                      ↑
                    </button>
                    <button type="button" onClick={() => void handleMoveStatus(status.id || '', 'down')} disabled={!status.id || index === statuses.length - 1}>
                      ↓
                    </button>
                    <button type="button" onClick={() => void handleDeleteStatus(status)} disabled={!status.id || statuses.length <= 1}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form
              className="list-status-manager-create"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateStatus();
              }}
            >
              <input
                value={statusNameDraft}
                onChange={(event) => setStatusNameDraft(event.target.value)}
                placeholder="New status name"
                disabled={!canManagePersistedStatuses}
              />
              <div className="list-status-color-swatches">
                {STATUS_COLORS.map((color) => (
                  <button
                    key={`draft-${color}`}
                    type="button"
                    className={`status-swatch ${statusColorDraft === color ? 'active' : ''}`.trim()}
                    style={{ backgroundColor: color }}
                    onClick={() => setStatusColorDraft(color)}
                    disabled={!canManagePersistedStatuses}
                  />
                ))}
              </div>
              <button type="submit" disabled={!canManagePersistedStatuses}>Add Status</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
