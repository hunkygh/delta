import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  X
} from 'lucide-react';
import type { CustomRecurrenceConfig, Event, EventTask, RecurrenceRule } from '../types/Event';
import Button from './Button';
import WeekCalendar from './calendar/WeekCalendar';
import EventDrawer from './calendar/EventDrawer';
import type { CalendarEvent } from './calendar/WeekCalendar';
import { calendarService } from '../services/calendarService';
import threadService from '../services/threadService';
import focalBoardService from '../services/focalBoardService';
import { useAuth } from '../context/AuthContext';
import type { ProposalReviewRow } from './ProposalReviewTable';
import type { CalendarProposal, FieldUpdateProposal, NewActionProposal } from '../contracts/executionContracts';

interface CalendarProps {
  events: Event[];
  attachTree?: AttachNode[];
  onSaveEvent?: (event: Event) => Promise<Event | void>;
  onSaveEvents?: (events: Event[]) => Promise<void>;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onOptimizeTimeBlock?: (timeBlockId: string) => Promise<{ source?: string; proposal?: any } | void>;
  initialFocusEventId?: string | null;
}

type WeekAnchorMode = 'today_second' | 'sunday';
type ResizeScope = 'one_off' | 'recurring';
type EditScopeMode = 'this_event' | 'all_future' | 'next_window';
type DrawerPhase = 'basics' | 'details' | 'attach_work';
type AttachMode = 'node_only' | 'with_children';
type AttachRecurrenceMode = 'match_event' | 'custom';

interface AttachNode {
  id: string;
  label: string;
  level: 'domain' | 'project' | 'task' | 'subtask';
  children?: AttachNode[];
}

interface AttachSelectionConfig {
  mode: AttachMode;
  recurrenceMode: AttachRecurrenceMode;
  recurrenceRule: RecurrenceRule;
  recurrenceConfig: CustomRecurrenceConfig;
}

interface ResizeConfirmState {
  eventId: string;
  snapshot: Event[];
  affectedEventIds: string[];
}

interface TimeBlockContentRule {
  id: string;
  user_id: string;
  time_block_id: string;
  selector_type: 'all' | 'weekday';
  selector_value: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | null;
  list_id: string;
  item_ids: string[];
}

interface ListItemOption {
  id: string;
  title: string;
}

interface ListOption {
  id: string;
  name: string;
  items: ListItemOption[];
}

interface FocalListTree {
  id: string;
  name: string;
  lists: ListOption[];
}

interface OccurrenceContext {
  instanceId: string;
  sourceEventId: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
  weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
}

interface DraftLinkedItem {
  id: string;
  title: string;
  listId: string;
}

interface AttachTreeNodeLike {
  id?: string;
  name?: string;
  label?: string;
  title?: string;
  children?: AttachTreeNodeLike[];
  lists?: AttachTreeNodeLike[];
  items?: AttachTreeNodeLike[];
  list_id?: string;
  item_id?: string;
}

const DEFAULT_RECURRENCE_CONFIG: CustomRecurrenceConfig = {
  unit: 'week',
  interval: 1,
  limitType: 'indefinite'
};

const DEFAULT_ATTACH_SELECTION_CONFIG: AttachSelectionConfig = {
  mode: 'node_only',
  recurrenceMode: 'match_event',
  recurrenceRule: 'daily',
  recurrenceConfig: { ...DEFAULT_RECURRENCE_CONFIG }
};

const CONTENT_WEEKDAYS: Array<{ key: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'; label: string }> = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' }
];

export default function Calendar({
  events,
  attachTree = [],
  onSaveEvent,
  onSaveEvents,
  onDeleteEvent,
  onOptimizeTimeBlock,
  initialFocusEventId = null
}: CalendarProps): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eventList, setEventList] = useState<Event[]>(events);
  const [weekAnchorMode, setWeekAnchorMode] = useState<WeekAnchorMode>('today_second');
  const [weekStart, setWeekStart] = useState<Date>(() => getStartForMode(new Date(), 'today_second'));
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);  // Track resize operations
  const resizeOriginalStates = useRef<Map<string, { startMs: number; endMs: number }>>(new Map());  // Store original states for undo
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [drawerPhase, setDrawerPhase] = useState<DrawerPhase>('basics');
  const [isAiContextActive, setIsAiContextActive] = useState(false);
  const [isTaskLinkPanelOpen, setIsTaskLinkPanelOpen] = useState(false);
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDrawerRendered, setIsDrawerRendered] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isOptimizingBlock, setIsOptimizingBlock] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<{ source?: string } | null>(null);
  const [proposalRows, setProposalRows] = useState<ProposalReviewRow[]>([]);
  const [proposalApplying, setProposalApplying] = useState(false);
  const [proposalPayloadByRowId, setProposalPayloadByRowId] = useState<Record<string, {
    kind: 'field_update' | 'new_action' | 'calendar_proposal';
    value: FieldUpdateProposal | NewActionProposal | CalendarProposal;
  }>>({});
  const [fallbackListOptions, setFallbackListOptions] = useState<ListOption[]>([]);
  const [fallbackFocalTree, setFallbackFocalTree] = useState<FocalListTree[]>([]);
  const [timeblockComments, setTimeblockComments] = useState<Array<{
    id: string;
    author_type: 'user' | 'ai';
    content: string;
    created_at: string;
  }>>([]);
  const [timeblockCommentsLoading, setTimeblockCommentsLoading] = useState(false);
  const [timeblockCommentError, setTimeblockCommentError] = useState<string | null>(null);
  const [timeblockCommentDraft, setTimeblockCommentDraft] = useState('');
  const [timeblockCommentSubmitting, setTimeblockCommentSubmitting] = useState(false);
  const [attachSelection, setAttachSelection] = useState<Record<string, AttachSelectionConfig>>({});
  const [timeBlockContentRules, setTimeBlockContentRules] = useState<Record<string, TimeBlockContentRule[]>>({});
  const [resolvedItemsByOccurrence, setResolvedItemsByOccurrence] = useState<
    Record<string, Array<{ id: string; title: string; completed: boolean; kind: 'task' | 'item'; parentItemId?: string }>>
  >({});
  const [occurrenceContext, setOccurrenceContext] = useState<OccurrenceContext | null>(null);
  const [contentMode, setContentMode] = useState<'all' | 'weekday'>('all');
  const [contentAll, setContentAll] = useState<{ listId: string; itemIds: string[] }>({ listId: '', itemIds: [] });
  const [contentByWeekday, setContentByWeekday] = useState<
    Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', { listId: string; itemIds: string[] }>
  >({
    mon: { listId: '', itemIds: [] },
    tue: { listId: '', itemIds: [] },
    wed: { listId: '', itemIds: [] },
    thu: { listId: '', itemIds: [] },
    fri: { listId: '', itemIds: [] },
    sat: { listId: '', itemIds: [] },
    sun: { listId: '', itemIds: [] }
  });
  const [draftLinkedItems, setDraftLinkedItems] = useState<DraftLinkedItem[]>([]);
  const [formState, setFormState] = useState<{
    title: string;
    description: string;
    start: string;
    end: string;
      recurrence: RecurrenceRule;
      recurrenceConfig: CustomRecurrenceConfig;
      includeWeekends: boolean;
      tasks: EventTask[];
  }>({
    title: '',
    description: '',
    start: '',
    end: '',
    recurrence: 'none',
    recurrenceConfig: { ...DEFAULT_RECURRENCE_CONFIG },
    includeWeekends: true,
    tasks: []
  });

  const [resizeConfirm, setResizeConfirm] = useState<ResizeConfirmState | null>(null);
  const [resizeScope, setResizeScope] = useState<ResizeScope>('one_off');
  const [resizeCadence, setResizeCadence] = useState<Extract<RecurrenceRule, 'daily' | 'weekly' | 'monthly'>>('weekly');
  const [resizeIndefinite, setResizeIndefinite] = useState(true);
  const [resizeCount, setResizeCount] = useState('8');
  const [editScopeMode, setEditScopeMode] = useState<EditScopeMode>('this_event');
  const [editScopeCount, setEditScopeCount] = useState('4');
  const [editScopeCadence, setEditScopeCadence] = useState<'days' | 'weeks' | 'months'>('weeks');

  const resizeSnapshotRef = useRef<Event[] | null>(null);
  const resizeAffectedIdsRef = useRef<string[]>([]);
  const focusEventHandledRef = useRef<string | null>(null);
  const closeModalTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setWeekStart(getStartForMode(new Date(), weekAnchorMode));
  }, [weekAnchorMode]);

  useEffect(() => {
    setEventList(events);
  }, [events]);

  useEffect(() => {
    if (closeModalTimerRef.current) {
      return () => {
        if (closeModalTimerRef.current) {
          window.clearTimeout(closeModalTimerRef.current);
        }
      };
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      setIsDrawerRendered(true);
      const frame = window.requestAnimationFrame(() => {
        setIsDrawerVisible(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setIsDrawerVisible(false);
    if (isDrawerRendered) {
      const timer = window.setTimeout(() => setIsDrawerRendered(false), 180);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isModalOpen, isDrawerRendered]);

  useEffect(() => {
    if (!initialFocusEventId || focusEventHandledRef.current === initialFocusEventId || eventList.length === 0) {
      return;
    }
    const target = eventList.find((entry) => entry.id === initialFocusEventId);
    if (!target) {
      return;
    }
    focusEventHandledRef.current = initialFocusEventId;
    openEditModal(target);
  }, [eventList, initialFocusEventId]);

  useEffect(() => {
    if (!isModalOpen) {
      setIsOptimizingBlock(false);
      setOptimizeError(null);
      setOptimizeResult(null);
      setProposalRows([]);
      setProposalApplying(false);
      setProposalPayloadByRowId({});
      setTimeblockComments([]);
      setTimeblockCommentDraft('');
      setTimeblockCommentError(null);
      setTimeblockCommentsLoading(false);
      setTimeblockCommentSubmitting(false);
    }
  }, [isModalOpen, editingEventId]);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setFallbackListOptions([]);
      setFallbackFocalTree([]);
      return () => {
        active = false;
      };
    }
    const shouldHydrateFallback = !attachTree || attachTree.length === 0;
    if (!shouldHydrateFallback) return () => { active = false; };

    void (async () => {
      try {
        const [focals, lists] = await Promise.all([
          focalBoardService.getFocals(user.id),
          focalBoardService.getListsForUser(user.id)
        ]);
        const itemsPerList = await Promise.all(
          (lists || []).map(async (list: any) => {
            const rows = await focalBoardService.getItemsByListId(list.id);
            return [list.id, (rows || []).map((item: any) => ({ id: item.id, title: item.title }))] as const;
          })
        );
        if (!active) return;
        const itemMap = new Map(itemsPerList);
        const listOptions: ListOption[] = (lists || []).map((list: any) => ({
          id: list.id,
          name: list.name,
          items: itemMap.get(list.id) || []
        }));
        const focalTree: FocalListTree[] = (focals || []).map((focal: any) => ({
          id: focal.id,
          name: focal.name,
          lists: (lists || [])
            .filter((list: any) => list.focal_id === focal.id)
            .map((list: any) => ({
              id: list.id,
              name: list.name,
              items: itemMap.get(list.id) || []
            }))
        }));
        setFallbackListOptions(listOptions);
        setFallbackFocalTree(focalTree);
      } catch (error) {
        console.error('Failed to hydrate fallback calendar list options:', error);
        if (!active) return;
        setFallbackListOptions([]);
        setFallbackFocalTree([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [attachTree, user?.id]);

  useEffect(() => {
    let active = true;
    if (!isModalOpen || !editingEventId) {
      setTimeblockComments([]);
      setTimeblockCommentError(null);
      setTimeblockCommentsLoading(false);
      return () => {
        active = false;
      };
    }

    void (async () => {
      setTimeblockCommentsLoading(true);
      setTimeblockCommentError(null);
      try {
        const thread = await threadService.getThreadByScope({
          scope: 'timeblock',
          scope_id: editingEventId
        });
        if (!thread) {
          if (active) {
            setTimeblockComments([]);
          }
          return;
        }
        const comments = await threadService.listComments(thread.id, { limit: 100 });
        if (!active) return;
        setTimeblockComments(comments || []);
      } catch (error: any) {
        if (!active) return;
        setTimeblockCommentError(error?.message || 'Failed to load notes');
      } finally {
        if (active) {
          setTimeblockCommentsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [editingEventId, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen || !editingEventId) {
      return;
    }
    const latest = eventList.find((item) => item.id === editingEventId);
    if (!latest) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      start: toLocalDateTimeValue(new Date(latest.start)),
      end: toLocalDateTimeValue(new Date(latest.end))
    }));
  }, [editingEventId, eventList, isModalOpen]);

  const weekRangeLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const startLabel = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  }, [weekStart]);

  const monthLabel = useMemo(
    () => weekStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [weekStart]
  );
  const weekEnd = useMemo(() => {
    const end = addDays(weekStart, 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [weekStart]);

  const listOptions = useMemo<ListOption[]>(() => {
    const options: ListOption[] = [];
    const seenListIds = new Set<string>();
    const rootNodes = (attachTree as unknown as AttachTreeNodeLike[]) || [];

    const pushList = (listNode: AttachTreeNodeLike): void => {
      const listId =
        extractNodeRawId(listNode.id || '', 'lane') ||
        (typeof listNode.list_id === 'string' ? listNode.list_id : null) ||
        (typeof listNode.id === 'string' ? listNode.id : null);
      if (!listId || seenListIds.has(listId)) return;

      const rawItemNodes = (listNode.children || listNode.items || []) as AttachTreeNodeLike[];
      const items = rawItemNodes
        .map((itemNode) => {
          const itemId =
            extractNodeRawId(itemNode.id || '', 'item') ||
            (typeof itemNode.item_id === 'string' ? itemNode.item_id : null) ||
            (typeof itemNode.id === 'string' ? itemNode.id : null);
          if (!itemId) return null;
          return {
            id: itemId,
            title: itemNode.label || itemNode.title || itemNode.name || 'Untitled'
          };
        })
        .filter(Boolean) as ListItemOption[];

      options.push({
        id: listId,
        name: listNode.label || listNode.name || listNode.title || 'Untitled list',
        items
      });
      seenListIds.add(listId);
    };

    for (const rootNode of rootNodes) {
      const possibleLists = (rootNode.children || rootNode.lists || []) as AttachTreeNodeLike[];
      if (possibleLists.length > 0) {
        for (const listNode of possibleLists) {
          pushList(listNode);
        }
        continue;
      }
      // Fallback: root may itself be a list node.
      if ((rootNode.items && rootNode.items.length > 0) || rootNode.list_id || rootNode.id) {
        pushList(rootNode);
      }
    }

    return options.length > 0 ? options : fallbackListOptions;
  }, [attachTree, fallbackListOptions]);

  const itemTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of listOptions) {
      for (const item of option.items) {
        if (!map.has(item.id)) {
          map.set(item.id, item.title);
        }
      }
    }
    return map;
  }, [listOptions]);

  const contentItemOptionsByList = useMemo(
    () =>
      listOptions.reduce<Record<string, ListItemOption[]>>((acc, option) => {
        acc[option.id] = option.items;
        return acc;
      }, {}),
    [listOptions]
  );

  const contentFocalTree = useMemo<FocalListTree[]>(() => {
    const focals: FocalListTree[] = [];
    const rootNodes = (attachTree as unknown as AttachTreeNodeLike[]) || [];
    let fallbackIndex = 0;

    for (const rootNode of rootNodes) {
      const focalId =
        extractNodeRawId(rootNode.id || '', 'focal') ||
        (typeof rootNode.id === 'string' ? rootNode.id : `focal-fallback-${fallbackIndex++}`);
      const focalName = rootNode.label || rootNode.name || rootNode.title || 'Space';
      const listNodes = (rootNode.children || rootNode.lists || []) as AttachTreeNodeLike[];
      const lists: ListOption[] = [];

      for (const listNode of listNodes) {
        const listId =
          extractNodeRawId(listNode.id || '', 'lane') ||
          (typeof listNode.list_id === 'string' ? listNode.list_id : null) ||
          (typeof listNode.id === 'string' ? listNode.id : null);
        if (!listId) continue;
        const itemNodes = (listNode.children || listNode.items || []) as AttachTreeNodeLike[];
        const items = itemNodes
          .map((itemNode) => {
            const itemId =
              extractNodeRawId(itemNode.id || '', 'item') ||
              (typeof itemNode.item_id === 'string' ? itemNode.item_id : null) ||
              (typeof itemNode.id === 'string' ? itemNode.id : null);
            if (!itemId) return null;
            return {
              id: itemId,
              title: itemNode.label || itemNode.title || itemNode.name || 'Untitled'
            };
          })
          .filter(Boolean) as ListItemOption[];
        lists.push({
          id: listId,
          name: listNode.label || listNode.name || listNode.title || 'Untitled list',
          items
        });
      }

      if (lists.length > 0) {
        focals.push({
          id: focalId,
          name: focalName,
          lists
        });
      }
    }
    return focals.length > 0 ? focals : fallbackFocalTree;
  }, [attachTree, fallbackFocalTree]);

  const listIdByItemId = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of listOptions) {
      for (const item of list.items) {
        map.set(item.id, list.id);
      }
    }
    return map;
  }, [listOptions]);

  const baseVisibleEvents = useMemo(() => {
    let baseEvents: Event[] = [...eventList];

    if (isModalOpen && editingEventId) {
      baseEvents = baseEvents.map((item) =>
        item.id === editingEventId
          ? {
              ...item,
              title: formState.title.trim() || item.title,
              description: formState.description,
              start: new Date(formState.start).toISOString(),
              end: new Date(formState.end).toISOString(),
              recurrence: formState.recurrence,
              recurrenceConfig: formState.recurrenceConfig,
              includeWeekends: formState.includeWeekends,
              tasks: formState.tasks
            }
          : item
      );
    }

    if (isModalOpen && !editingEventId && showDraftPreview) {
      baseEvents.push({
        id: '__draft__',
        title: formState.title.trim() || 'New Time Block',
        description: formState.description,
        start: new Date(formState.start).toISOString(),
        end: new Date(formState.end).toISOString(),
        recurrence: formState.recurrence,
        recurrenceConfig: formState.recurrenceConfig,
        includeWeekends: formState.includeWeekends,
        timezone: getUserTimeZone(),
        tasks: formState.tasks
      });
    }

    return expandEventsForWeek(baseEvents, weekStart, weekEnd);
  }, [
    editingEventId,
    eventList,
    formState.description,
    formState.end,
    formState.includeWeekends,
    formState.recurrence,
    formState.recurrenceConfig,
    formState.start,
    formState.tasks,
    formState.title,
    isModalOpen,
    showDraftPreview,
    weekEnd,
    weekStart
  ]);

  useEffect(() => {
    let active = true;
    const sourceIds = [...new Set(baseVisibleEvents.map((event) => event.sourceEventId ?? event.id))].filter(
      (id) => id && id !== '__draft__'
    );
    if (sourceIds.length === 0) {
      setTimeBlockContentRules({});
      return () => {
        active = false;
      };
    }
    void (async () => {
      try {
        const entries = await Promise.all(
          sourceIds.map(async (timeBlockId) => [timeBlockId, await calendarService.getTimeBlockContentRules(timeBlockId)] as const)
        );
        if (!active) return;
        setTimeBlockContentRules((prev) => {
          const next = { ...prev };
          for (const [timeBlockId, rules] of entries) {
            next[timeBlockId] = rules as TimeBlockContentRule[];
          }
          return next;
        });
      } catch (error) {
        console.error('Failed to load time block content rules:', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [baseVisibleEvents]);

  useEffect(() => {
    let active = true;
    const sourceIds = [...new Set(baseVisibleEvents.map((event) => event.sourceEventId ?? event.id))].filter(Boolean);
    if (baseVisibleEvents.length === 0 || sourceIds.length === 0) {
      setResolvedItemsByOccurrence({});
      return () => {
        active = false;
      };
    }
    void (async () => {
      try {
        const timezone = getUserTimeZone();
        const perOccurrenceItemIds = new Map<string, string[]>();
        const allItemIds = new Set<string>();
        for (const event of baseVisibleEvents) {
          const sourceId = event.sourceEventId ?? event.id;
          const occurrenceStartUtc = new Date(event.start).toISOString();
          const weekday = calendarService.getWeekdayKeyForOccurrence(occurrenceStartUtc, timezone);
          const resolvedIds = calendarService.resolveItemsForOccurrence({
            rules: timeBlockContentRules[sourceId] || [],
            occurrenceStart: occurrenceStartUtc,
            weekday,
            timezone
          });
          perOccurrenceItemIds.set(event.id, resolvedIds);
          resolvedIds.forEach((itemId: string) => allItemIds.add(itemId));
        }

        const actions = await calendarService.getActionsForItems({ itemIds: [...allItemIds] });
        const actionIds = [...new Set(actions.map((entry: any) => entry.id).filter(Boolean))];
        const actionsByItemId = new Map<string, Array<{ id: string; title: string }>>();
        for (const action of actions) {
          const list = actionsByItemId.get(action.item_id) || [];
          list.push({
            id: action.id,
            title: action.title || 'Untitled task'
          });
          actionsByItemId.set(action.item_id, list);
        }

        const taskCompletionRows =
          actionIds.length > 0
            ? await calendarService.getOccurrenceTaskCompletionRows({
                timeBlockIds: sourceIds,
                rangeStartUtc: weekStart.toISOString(),
                rangeEndUtc: weekEnd.toISOString(),
                actionIds
              })
            : [];

        const itemCompletionRows = await calendarService.getOccurrenceCompletionRows({
          timeBlockIds: sourceIds,
          rangeStartUtc: weekStart.toISOString(),
          rangeEndUtc: weekEnd.toISOString(),
          itemIds: [...allItemIds]
        });
        if (!active) return;

        const taskCompletedMap = new Map<string, boolean>();
        for (const row of taskCompletionRows) {
          if (row.completion_state === 'completed') {
            taskCompletedMap.set(`${row.action_id}:${row.time_block_id}:${new Date(row.scheduled_start).toISOString()}`, true);
          }
        }

        const itemCompletedMap = new Map<string, boolean>();
        for (const row of itemCompletionRows) {
          if (row.completion_state === 'completed') {
            itemCompletedMap.set(`${row.item_id}:${row.time_block_id}:${new Date(row.scheduled_start).toISOString()}`, true);
          }
        }

        const nextResolved: Record<
          string,
          Array<{ id: string; title: string; completed: boolean; kind: 'task' | 'item'; parentItemId?: string }>
        > = {};
        for (const event of baseVisibleEvents) {
          const sourceId = event.sourceEventId ?? event.id;
          const occurrenceStartUtc = new Date(event.start).toISOString();
          const itemIds = perOccurrenceItemIds.get(event.id) || [];
          const entries: Array<{
            id: string;
            title: string;
            completed: boolean;
            kind: 'task' | 'item';
            parentItemId?: string;
          }> = [];

          for (const itemId of itemIds) {
            const itemTasks = actionsByItemId.get(itemId) || [];
            if (itemTasks.length > 0) {
              for (const task of itemTasks) {
                entries.push({
                  id: task.id,
                  title: task.title,
                  completed: taskCompletedMap.get(`${task.id}:${sourceId}:${occurrenceStartUtc}`) === true,
                  kind: 'task',
                  parentItemId: itemId
                });
              }
              continue;
            }

            entries.push({
              id: itemId,
              title: itemTitleById.get(itemId) || 'Untitled',
              completed: itemCompletedMap.get(`${itemId}:${sourceId}:${occurrenceStartUtc}`) === true,
              kind: 'item'
            });
          }
          nextResolved[event.id] = entries;
        }
        setResolvedItemsByOccurrence(nextResolved);
      } catch (error) {
        console.error('Failed to resolve occurrence contents:', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [baseVisibleEvents, itemTitleById, timeBlockContentRules, weekEnd, weekStart]);

  const visibleEvents = baseVisibleEvents;

  const editingEvent = editingEventId
    ? eventList.find((item) => item.id === editingEventId) ?? null
    : null;
  const isCreateFlow = !editingEventId;
  const isRecurringSelection = formState.recurrence !== 'none';
  const showSeriesScopeControls = Boolean(editingEventId) && isRecurringSelection;
  const activeOccurrenceItems = occurrenceContext ? (resolvedItemsByOccurrence[occurrenceContext.instanceId] || []) : [];

  const hydrateContentDrafts = (timeBlockId: string): void => {
    const rules = timeBlockContentRules[timeBlockId] || [];
    const hasWeekday = rules.some((rule) => rule.selector_type === 'weekday');
    setContentMode(hasWeekday ? 'weekday' : 'all');

    const allRule = rules.find((rule) => rule.selector_type === 'all');
    setContentAll({
      listId: allRule?.list_id || '',
      itemIds: allRule?.item_ids || []
    });

    const weekdayDraft = CONTENT_WEEKDAYS.reduce(
      (acc, entry) => {
        const rule = rules.find((candidate) => candidate.selector_type === 'weekday' && candidate.selector_value === entry.key);
        acc[entry.key] = {
          listId: rule?.list_id || '',
          itemIds: rule?.item_ids || []
        };
        return acc;
      },
      {} as Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', { listId: string; itemIds: string[] }>
    );
    setContentByWeekday(weekdayDraft);
  };

  useEffect(() => {
    if (!editingEventId) return;
    hydrateContentDrafts(editingEventId);
  }, [editingEventId, timeBlockContentRules]);

  const persistContentRule = async ({
    selectorType,
    selectorValue,
    listId,
    itemIds
  }: {
    selectorType: 'all' | 'weekday';
    selectorValue: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | null;
    listId: string;
    itemIds: string[];
  }): Promise<void> => {
    if (!editingEventId) return;

    const existing = timeBlockContentRules[editingEventId] || [];
    const selectorMatches = existing.filter(
      (rule) => rule.selector_type === selectorType && (selectorType === 'all' || rule.selector_value === selectorValue)
    );

    const keepRule = selectorMatches.find((rule) => rule.list_id === listId);
    const deleteRules = selectorMatches.filter((rule) => !keepRule || rule.id !== keepRule.id);

    for (const rule of deleteRules) {
      await calendarService.deleteTimeBlockContentRule(rule.id);
    }

    let savedRule: TimeBlockContentRule | null = null;
    if (listId) {
      savedRule = await calendarService.upsertTimeBlockContentRule({
        id: keepRule?.id,
        time_block_id: editingEventId,
        selector_type: selectorType,
        selector_value: selectorType === 'weekday' ? selectorValue : null,
        list_id: listId,
        item_ids: itemIds
      });
    }

    setTimeBlockContentRules((prev) => {
      const next = [...(prev[editingEventId] || [])].filter((rule) => !deleteRules.some((removed) => removed.id === rule.id));
      if (savedRule) {
        const index = next.findIndex((rule) => rule.id === savedRule?.id);
        if (index >= 0) next[index] = savedRule;
        else next.push(savedRule);
      } else {
        for (const match of selectorMatches) {
          if (!deleteRules.some((removed) => removed.id === match.id)) {
            const idx = next.findIndex((entry) => entry.id === match.id);
            if (idx >= 0) next.splice(idx, 1);
          }
        }
      }
      return {
        ...prev,
        [editingEventId]: next
      };
    });
  };

  const persistContentRuleForTimeBlock = async ({
    timeBlockId,
    selectorType,
    selectorValue,
    listId,
    itemIds
  }: {
    timeBlockId: string;
    selectorType: 'all' | 'weekday';
    selectorValue: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | null;
    listId: string;
    itemIds: string[];
  }): Promise<void> => {
    const existing = timeBlockContentRules[timeBlockId] || [];
    const selectorMatches = existing.filter(
      (rule) => rule.selector_type === selectorType && (selectorType === 'all' || rule.selector_value === selectorValue)
    );

    const keepRule = selectorMatches.find((rule) => rule.list_id === listId);
    const deleteRules = selectorMatches.filter((rule) => !keepRule || rule.id !== keepRule.id);

    for (const rule of deleteRules) {
      await calendarService.deleteTimeBlockContentRule(rule.id);
    }

    let savedRule: TimeBlockContentRule | null = null;
    if (listId) {
      savedRule = await calendarService.upsertTimeBlockContentRule({
        id: keepRule?.id,
        time_block_id: timeBlockId,
        selector_type: selectorType,
        selector_value: selectorType === 'weekday' ? selectorValue : null,
        list_id: listId,
        item_ids: itemIds
      });
    }

    setTimeBlockContentRules((prev) => {
      const next = [...(prev[timeBlockId] || [])].filter((rule) => !deleteRules.some((removed) => removed.id === rule.id));
      if (savedRule) {
        const index = next.findIndex((rule) => rule.id === savedRule?.id);
        if (index >= 0) next[index] = savedRule;
        else next.push(savedRule);
      } else {
        for (const match of selectorMatches) {
          if (!deleteRules.some((removed) => removed.id === match.id)) {
            const idx = next.findIndex((entry) => entry.id === match.id);
            if (idx >= 0) next.splice(idx, 1);
          }
        }
      }
      return {
        ...prev,
        [timeBlockId]: next
      };
    });
  };

  const handleToggleOccurrenceItem = async (
    entry: { id: string; title: string; completed: boolean; kind: 'task' | 'item'; parentItemId?: string },
    checked: boolean
  ): Promise<void> => {
    if (!occurrenceContext) return;
    if (entry.kind === 'task') {
      await calendarService.setOccurrenceTaskCompletion({
        actionId: entry.id,
        timeBlockId: occurrenceContext.sourceEventId,
        scheduledStartUtc: occurrenceContext.scheduledStartUtc,
        scheduledEndUtc: occurrenceContext.scheduledEndUtc,
        checked
      });
    } else {
      await calendarService.setOccurrenceItemCompletion({
        itemId: entry.id,
        timeBlockId: occurrenceContext.sourceEventId,
        scheduledStartUtc: occurrenceContext.scheduledStartUtc,
        scheduledEndUtc: occurrenceContext.scheduledEndUtc,
        checked
      });
    }
    setResolvedItemsByOccurrence((prev) => ({
      ...prev,
      [occurrenceContext.instanceId]: (prev[occurrenceContext.instanceId] || []).map((row) =>
        row.id === entry.id ? { ...row, completed: checked } : row
      )
    }));
  };

  const handleOpenOccurrenceItem = (entry: {
    id: string;
    title: string;
    completed: boolean;
    kind: 'task' | 'item';
    parentItemId?: string;
  }): void => {
    const itemId = entry.kind === 'task' ? entry.parentItemId : entry.id;
    if (!itemId) return;
    const listId = listIdByItemId.get(itemId);
    if (!listId) {
      return;
    }
    closeModal();
    navigate(`/focals/list/${listId}`, {
      state: { openItemId: itemId }
    });
  };

  const openCreateModal = (range?: { start: Date; end: Date }): void => {
    const start = range?.start ?? roundDateToNearest15(new Date());
    const end = range?.end ?? new Date(start.getTime() + 60 * 60 * 1000);

    setEditingEventId(null);
    setFormState({
      title: '',
      description: '',
      start: toLocalDateTimeValue(start),
      end: toLocalDateTimeValue(end),
      recurrence: 'none',
      recurrenceConfig: { ...DEFAULT_RECURRENCE_CONFIG },
      includeWeekends: true,
      tasks: []
    });
    setShowDraftPreview(Boolean(range));
    setSelectedEventId(range ? '__draft__' : null);
    setDrawerPhase('details');
    setIsAiContextActive(false);
    setIsTaskLinkPanelOpen(false);
    setAttachSelection({});
    setOccurrenceContext(null);
    setContentMode('all');
    setContentAll({ listId: '', itemIds: [] });
    setContentByWeekday({
      mon: { listId: '', itemIds: [] },
      tue: { listId: '', itemIds: [] },
      wed: { listId: '', itemIds: [] },
      thu: { listId: '', itemIds: [] },
      fri: { listId: '', itemIds: [] },
      sat: { listId: '', itemIds: [] },
      sun: { listId: '', itemIds: [] }
    });
    setDraftLinkedItems([]);
    setEditScopeMode('this_event');
    setIsModalOpen(true);
  };

  const openEditModal = (
    eventItem: Event,
    occurrence?: { instanceId: string; scheduledStartUtc: string; scheduledEndUtc: string }
  ): void => {
    setEditingEventId(eventItem.id);
    setSelectedEventId(eventItem.id);
    const effectiveStart = occurrence?.scheduledStartUtc ?? eventItem.start;
    const effectiveEnd = occurrence?.scheduledEndUtc ?? eventItem.end;
    const weekday = (calendarService.getWeekdayKeyForOccurrence(effectiveStart, getUserTimeZone()) || 'mon') as OccurrenceContext['weekday'];
    setOccurrenceContext({
      instanceId: occurrence?.instanceId || eventItem.id,
      sourceEventId: eventItem.id,
      scheduledStartUtc: new Date(effectiveStart).toISOString(),
      scheduledEndUtc: new Date(effectiveEnd).toISOString(),
      weekday
    });
    setFormState({
      title: eventItem.title,
      description: eventItem.description,
      start: toLocalDateTimeValue(new Date(effectiveStart)),
      end: toLocalDateTimeValue(new Date(effectiveEnd)),
      recurrence: eventItem.recurrence ?? 'none',
      recurrenceConfig: eventItem.recurrenceConfig ?? { ...DEFAULT_RECURRENCE_CONFIG },
      includeWeekends: eventItem.includeWeekends ?? true,
      tasks: eventItem.tasks ?? []
    });
    setShowDraftPreview(false);
    setDrawerPhase('details');
    setIsAiContextActive(false);
    setIsTaskLinkPanelOpen(false);
    setAttachSelection(extractAttachSelection(eventItem.tags));
    hydrateContentDrafts(eventItem.id);
    setDraftLinkedItems([]);
    setEditScopeMode('this_event');
    setIsModalOpen(true);
  };

  const closeModal = (): void => {
    setIsModalOpen(false);
    if (closeModalTimerRef.current) {
      window.clearTimeout(closeModalTimerRef.current);
    }
    closeModalTimerRef.current = window.setTimeout(() => {
      setEditingEventId(null);
      setNewTaskTitle('');
      setShowDraftPreview(false);
      setSelectedEventId(null);
      setOccurrenceContext(null);
      setDrawerPhase('basics');
      setIsAiContextActive(false);
      setIsTaskLinkPanelOpen(false);
      setAttachSelection({});
      setDraftLinkedItems([]);
    }, 170);
  };

  const mergeUniqueIds = (base: string[], additional: string[]): string[] => [...new Set([...(base || []), ...(additional || [])])];

  const saveEvent = async (): Promise<void> => {
    try {
      const normalizedTitle = formState.title.trim() || 'Untitled event';
      const attachTags = buildAttachTags(attachSelection);
      const normalizedRecurrenceConfig = normalizeRecurrenceConfigForRule(
        formState.recurrence,
        formState.recurrenceConfig
      );

      const parsedStart = new Date(formState.start);
      const fallbackStart = roundDateToNearest15(new Date());
      const safeStart = Number.isNaN(parsedStart.getTime()) ? fallbackStart : parsedStart;
      const parsedEnd = new Date(formState.end);
      const fallbackEnd = new Date(safeStart.getTime() + 60 * 60 * 1000);
      let safeEnd = Number.isNaN(parsedEnd.getTime()) ? fallbackEnd : parsedEnd;
      if (safeEnd.getTime() <= safeStart.getTime()) {
        safeEnd = new Date(safeStart.getTime() + 15 * 60 * 1000);
      }

      const record: Event = {
        id: editingEventId ?? crypto.randomUUID(),
        title: normalizedTitle,
        description: formState.description.trim(),
        start: safeStart.toISOString(),
        end: safeEnd.toISOString(),
        recurrence: formState.recurrence,
        recurrenceConfig: normalizedRecurrenceConfig,
        includeWeekends: formState.includeWeekends,
        timezone: getUserTimeZone(),
        tasks: formState.tasks,
        tags: attachTags
      };

      setEventList((prev) => {
        if (editingEventId) {
          return prev.map((item) => (item.id === editingEventId ? record : item));
        }
        return [record, ...prev];
      });

      let persistedId = record.id;
      if (onSaveEvent) {
        try {
          const saved = await onSaveEvent(record);
          if (saved?.id && saved.id !== record.id) {
            setEventList((prev) => prev.map((item) => (item.id === record.id ? saved : item)));
            persistedId = saved.id;
          }
          if (saved?.id) {
            persistedId = saved.id;
          }
        } catch (error) {
          console.error('Failed to persist event:', error);
        }
      }

      try {
        const createdItemIdsByList: Record<string, string[]> = {};
        if (user?.id && draftLinkedItems.length > 0) {
          for (const entry of draftLinkedItems) {
            if (!entry.listId || !entry.title.trim()) continue;
            const created = await focalBoardService.createItem(entry.listId, user.id, entry.title.trim(), null);
            if (!createdItemIdsByList[entry.listId]) {
              createdItemIdsByList[entry.listId] = [];
            }
            createdItemIdsByList[entry.listId].push(created.id);
          }
        }

        if (contentMode === 'all') {
          const mergedAll = mergeUniqueIds(contentAll.itemIds, createdItemIdsByList[contentAll.listId] || []);
          await persistContentRuleForTimeBlock({
            timeBlockId: persistedId,
            selectorType: 'all',
            selectorValue: null,
            listId: contentAll.listId,
            itemIds: mergedAll
          });
        } else {
          for (const weekday of CONTENT_WEEKDAYS) {
            const row = contentByWeekday[weekday.key];
            const mergedWeekday = mergeUniqueIds(row.itemIds, createdItemIdsByList[row.listId] || []);
            await persistContentRuleForTimeBlock({
              timeBlockId: persistedId,
              selectorType: 'weekday',
              selectorValue: weekday.key,
              listId: row.listId,
              itemIds: mergedWeekday
            });
          }
        }
      } catch (error) {
        console.error('Failed to persist content links for event:', error);
      }

      closeModal();
    } catch (error) {
      console.error('Failed to save event from drawer:', error);
    }
  };

  const handleOptimizeBlock = async (): Promise<void> => {
    if (!editingEventId || !onOptimizeTimeBlock) {
      return;
    }
    setIsOptimizingBlock(true);
    setOptimizeError(null);
    try {
      const result = await onOptimizeTimeBlock(editingEventId);
      const proposal = result?.proposal;
      const rows: ProposalReviewRow[] = [];
      const payloadMap: Record<string, {
        kind: 'field_update' | 'new_action' | 'calendar_proposal';
        value: FieldUpdateProposal | NewActionProposal | CalendarProposal;
      }> = {};

      (proposal?.field_updates || []).forEach((update: FieldUpdateProposal, index: number) => {
        const key = `field-${update.entity}-${update.id}-${index}`;
        const changeKey = Object.keys(update.changes || {})[0] || 'change';
        rows.push({
          id: key,
          entity: update.entity,
          currentValue: '—',
          proposedValue: String(update.changes?.[changeKey] ?? '—'),
          reason: proposal?.reasoning || 'Proposed update',
          approved: false
        });
        payloadMap[key] = { kind: 'field_update', value: update };
      });

      (proposal?.new_actions || []).forEach((entry: NewActionProposal, index: number) => {
        const key = `new-action-${entry.item_id}-${index}`;
        rows.push({
          id: key,
          entity: 'action',
          currentValue: 'none',
          proposedValue: entry.title,
          reason: proposal?.reasoning || 'Proposed new action',
          approved: false
        });
        payloadMap[key] = { kind: 'new_action', value: entry };
      });

      (proposal?.calendar_proposals || []).forEach((entry: CalendarProposal, index: number) => {
        const key = `calendar-${index}-${entry.scheduled_start_utc}`;
        rows.push({
          id: key,
          entity: 'time_block',
          currentValue: 'none',
          proposedValue: entry.title,
          reason: proposal?.reasoning || 'Proposed calendar placement',
          approved: false
        });
        payloadMap[key] = { kind: 'calendar_proposal', value: entry };
      });

      setProposalRows(rows);
      setProposalPayloadByRowId(payloadMap);
      setOptimizeResult(result || { source: 'unknown' });
    } catch (error: any) {
      setOptimizeError(error?.message || 'Failed to optimize block');
    } finally {
      setIsOptimizingBlock(false);
    }
  };

  const handleApproveSelectedProposals = async (): Promise<void> => {
    const selected = proposalRows.filter((row) => row.approved);
    if (selected.length === 0) return;

    setProposalApplying(true);
    setOptimizeError(null);
    try {
      for (const row of selected) {
        const payload = proposalPayloadByRowId[row.id];
        if (!payload) continue;
        if (payload.kind === 'field_update') {
          const update = payload.value as FieldUpdateProposal;
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
        if (payload.kind === 'new_action') {
          if (!user?.id) {
            throw new Error('Sign in is required to apply action proposals');
          }
          const actionProposal = payload.value as NewActionProposal;
          await focalBoardService.createAction(
            actionProposal.item_id,
            user.id,
            actionProposal.title,
            actionProposal.notes ?? null,
            actionProposal.due_at_utc ?? null
          );
          continue;
        }
        if (payload.kind === 'calendar_proposal') {
          const proposal = payload.value as CalendarProposal;
          await onSaveEvent?.({
            id: crypto.randomUUID(),
            title: proposal.title,
            description: proposal.notes || '',
            start: new Date(proposal.scheduled_start_utc).toISOString(),
            end: proposal.scheduled_end_utc
              ? new Date(proposal.scheduled_end_utc).toISOString()
              : new Date(new Date(proposal.scheduled_start_utc).getTime() + 60 * 60 * 1000).toISOString(),
            recurrence: 'none',
            recurrenceConfig: DEFAULT_RECURRENCE_CONFIG,
            includeWeekends: true,
            timezone: getUserTimeZone(),
            tasks: [],
            tags: []
          });
          continue;
        }
      }
      setProposalRows([]);
    } catch (error: any) {
      setOptimizeError(error?.message || 'Failed to apply selected proposals');
    } finally {
      setProposalApplying(false);
    }
  };

  const handleSubmitTimeblockNote = async (): Promise<void> => {
    if (!editingEventId) return;
    const body = timeblockCommentDraft.trim();
    if (!body) return;

    setTimeblockCommentSubmitting(true);
    setTimeblockCommentError(null);
    try {
      const thread = await threadService.getOrCreateThread({
        scope: 'timeblock',
        scope_id: editingEventId
      });
      const comment = await threadService.addComment({
        thread_id: thread.id,
        body,
        source: 'user'
      });
      setTimeblockComments((prev) => [...prev, comment]);
      setTimeblockCommentDraft('');
    } catch (error: any) {
      setTimeblockCommentError(error?.message || 'Failed to post note');
    } finally {
      setTimeblockCommentSubmitting(false);
    }
  };

  const deleteEvent = async (): Promise<void> => {
    if (!editingEventId) {
      return;
    }
    const targetId = editingEventId;
    setEventList((prev) => prev.filter((item) => item.id !== editingEventId));
    if (onDeleteEvent) {
      try {
        await onDeleteEvent(targetId);
      } catch (error) {
        console.error('Failed to delete event:', error);
      }
    }
    closeModal();
  };

  const addTaskToForm = (): void => {
    const title = newTaskTitle.trim();
    if (!title) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        {
          id: `task-${Date.now()}`,
          title,
          completed: false,
          recurrenceMode: 'match_event'
        }
      ]
    }));
    setNewTaskTitle('');
  };

  const addTaskToEvent = (eventId: string, title: string): void => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }
    setEventList((prev) =>
      prev.map((item) =>
        item.id === eventId
          ? {
              ...item,
              tasks: [
                ...(item.tasks ?? []),
                {
                  id: `task-${Date.now()}`,
                  title: nextTitle,
                  completed: false,
                  recurrenceMode: 'match_event'
                }
              ]
            }
          : item
      )
    );
  };

  const reorderEventTasks = (eventId: string, fromIndex: number, toIndex: number): void => {
    if (fromIndex === toIndex) {
      return;
    }
    setEventList((prev) =>
      prev.map((item) => {
        if (item.id !== eventId || !item.tasks || item.tasks.length < 2) {
          return item;
        }
        const tasks = [...item.tasks];
        const [moved] = tasks.splice(fromIndex, 1);
        if (!moved) {
          return item;
        }
        tasks.splice(toIndex, 0, moved);
        return { ...item, tasks };
      })
    );
  };

  const goToAttachWork = (): void => setDrawerPhase('attach_work');
  const goBackPhase = (): void => {
    if (drawerPhase === 'attach_work') {
      setDrawerPhase('details');
      return;
    }
    if (drawerPhase === 'details') {
      setDrawerPhase('basics');
    }
  };

  const toggleAttachNode = (nodeId: string): void => {
    setAttachSelection((prev) => {
      const next = { ...prev };
      if (next[nodeId]) {
        delete next[nodeId];
        return next;
      }
      next[nodeId] = { ...DEFAULT_ATTACH_SELECTION_CONFIG };
      return next;
    });
  };

  const setAttachMode = (nodeId: string, mode: AttachMode): void => {
    setAttachSelection((prev) => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] ?? DEFAULT_ATTACH_SELECTION_CONFIG),
        mode
      }
    }));
  };

  const setAttachRecurrenceMode = (nodeId: string, recurrenceMode: AttachRecurrenceMode): void => {
    setAttachSelection((prev) => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] ?? DEFAULT_ATTACH_SELECTION_CONFIG),
        recurrenceMode
      }
    }));
  };

  const setAttachRecurrenceRule = (nodeId: string, recurrenceRule: RecurrenceRule): void => {
    setAttachSelection((prev) => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] ?? DEFAULT_ATTACH_SELECTION_CONFIG),
        recurrenceRule
      }
    }));
  };

  const setAttachRecurrenceConfig = (nodeId: string, recurrenceConfig: CustomRecurrenceConfig): void => {
    setAttachSelection((prev) => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] ?? DEFAULT_ATTACH_SELECTION_CONFIG),
        recurrenceConfig
      }
    }));
  };

  const openAiWithContext = (extraTag?: string): void => {
    setIsAiContextActive(true);
    window.setTimeout(() => setIsAiContextActive(false), 360);
    const start = new Date(formState.start);
    const end = new Date(formState.end);
    const baseTag = `[TimeBlock: ${start.toLocaleDateString(undefined, {
      weekday: 'long'
    })} ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}-${end.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    })} | ${formState.title.trim() || 'Untitled'}]`;
    const tag = extraTag ? `${baseTag} ${extraTag}` : baseTag;
    window.dispatchEvent(
      new CustomEvent('delta:ai-open-with-context', {
        detail: {
          source: 'event_drawer',
          tag,
          eventContext: {
            id: editingEventId ?? '__draft__',
            title: formState.title.trim() || 'Untitled',
            description: formState.description,
            start: new Date(formState.start).toISOString(),
            end: new Date(formState.end).toISOString(),
            recurrence: formState.recurrence,
            includeWeekends: formState.includeWeekends,
            tasks: formState.tasks,
            links: buildAttachTags(attachSelection)
          }
        }
      })
    );
  };

  const handleAskDeltaForTaskLinking = (): void => {
    openAiWithContext('[Task Linking: requested]');
  };

  const handleResizeStart = (payload?: {
    eventId: string;
    start: Date;
    end: Date;
    direction: 'start' | 'end';
    originalStart: Date;
    originalEnd: Date;
  }): void => {
    setIsResizing(true);
    if (!payload) {
      return;
    }

    resizeSnapshotRef.current = [...eventList];
    resizeAffectedIdsRef.current = [];
    
    // Store original states for all events before resize (for undo functionality)
    const dayKey = payload.originalStart.toDateString();
    eventList.forEach(event => {
      if (new Date(event.start).toDateString() === dayKey) {
        const startMs = new Date(event.start).getTime();
        const endMs = new Date(event.end).getTime();
        resizeOriginalStates.current.set(event.id, { startMs, endMs });
      }
    });
    
    setEventList((prev) => {
      const result = applyResizeWithPolicy(prev, payload, allowOverlap);
      resizeAffectedIdsRef.current = result.affectedIds;
      return result.events;
    });
  };

  const handleResizePreview = (payload: {
    eventId: string;
    start: Date;
    end: Date;
    direction: 'start' | 'end';
    originalStart: Date;
    originalEnd: Date;
  }): void => {
    setEventList((prev) => {
      const result = applyResizeWithPolicy(prev, payload, allowOverlap);
      
      // Check if we've returned to original position (undo scenario)
      const resizedEvent = result.events.find(e => e.id === payload.eventId);
      if (resizedEvent) {
        const currentStartMs = new Date(resizedEvent.start).getTime();
        const currentEndMs = new Date(resizedEvent.end).getTime();
        const originalState = resizeOriginalStates.current.get(payload.eventId);
        
        if (originalState) {
          const isBackToOriginal = 
            Math.abs(currentStartMs - originalState.startMs) < 1000 && // Within 1 second
            Math.abs(currentEndMs - originalState.endMs) < 1000;
          
          if (isBackToOriginal) {
            // Restore all affected events to their original states
            const restoredEvents = result.events.map(event => {
              const originalEventState = resizeOriginalStates.current.get(event.id);
              if (originalEventState) {
                return {
                  ...event,
                  start: new Date(originalEventState.startMs).toISOString(),
                  end: new Date(originalEventState.endMs).toISOString()
                };
              }
              return event;
            });
            return restoredEvents;
          }
        }
      }
      
      resizeAffectedIdsRef.current = result.affectedIds;
      return result.events;
    });
  };

  const handleResizeEnd = (payload: {
    eventId: string;
    start: Date;
    end: Date;
    direction: 'start' | 'end';
    originalStart: Date;
    originalEnd: Date;
  }): void => {
    setIsResizing(false);  // Reset resizing state
    if (allowOverlap) {
      if (onSaveEvent) {
        const target = eventList.find((item) => item.id === payload.eventId);
        if (target) {
          void onSaveEvent({
            ...target,
            start: payload.start.toISOString(),
            end: payload.end.toISOString()
          }).catch((error) => {
            console.error('Failed to persist resized event:', error);
          });
        }
      }
      setResizeConfirm(null);
      return;
    }

    const snapshot = resizeSnapshotRef.current ?? [...eventList];
    setResizeScope('one_off');
    setResizeCadence('weekly');
    setResizeIndefinite(true);
    setResizeCount('8');
    setResizeConfirm({
      eventId: payload.eventId,
      snapshot,
      affectedEventIds: resizeAffectedIdsRef.current
    });
  };

  const handleEventMovePreview = (payload: {
    eventId: string;
    start: Date;
    end: Date;
    originalStart: Date;
    originalEnd: Date;
  }): void => {
    setEventList((prev) =>
      prev.map((item) =>
        item.id === payload.eventId
          ? {
              ...item,
              start: payload.start.toISOString(),
              end: payload.end.toISOString()
            }
          : item
      )
    );
    if (isModalOpen && editingEventId === payload.eventId) {
      setFormState((prev) => ({
        ...prev,
        start: toLocalDateTimeValue(payload.start),
        end: toLocalDateTimeValue(payload.end)
      }));
    }
  };

  const handleEventMoveEnd = (payload: {
    eventId: string;
    start: Date;
    end: Date;
    originalStart: Date;
    originalEnd: Date;
  }): void => {
    if (onSaveEvent) {
      const target = eventList.find((item) => item.id === payload.eventId);
      if (target) {
        void onSaveEvent({
          ...target,
          start: payload.start.toISOString(),
          end: payload.end.toISOString()
        }).catch((error) => {
          console.error('Failed to persist moved event:', error);
        });
      }
    }

    if (isModalOpen && editingEventId === payload.eventId) {
      setFormState((prev) => ({
        ...prev,
        start: toLocalDateTimeValue(payload.start),
        end: toLocalDateTimeValue(payload.end)
      }));
    }
  };

  const cancelResizeConfirm = (): void => {
    if (!resizeConfirm) {
      return;
    }
    setEventList(resizeConfirm.snapshot);
    setResizeConfirm(null);
  };

  const applyResizeConfirm = (): void => {
    if (!resizeConfirm) {
      return;
    }

    if (resizeScope === 'recurring') {
      const applyIds = new Set([resizeConfirm.eventId, ...resizeConfirm.affectedEventIds]);
      setEventList((prev) =>
        prev.map((item) => {
          if (!applyIds.has(item.id)) {
            return item;
          }
          const nextTags = [
            ...(item.tags ?? []).filter((tag) => !tag.startsWith('rrule_window:')),
            resizeIndefinite ? 'rrule_window:indefinite' : `rrule_window:${resizeCount}`
          ];

          return {
            ...item,
            recurrence: resizeCadence,
            recurrenceConfig: item.recurrenceConfig ?? DEFAULT_RECURRENCE_CONFIG,
            tags: nextTags
          };
        })
      );
      if (onSaveEvents) {
        const applySet = new Set([resizeConfirm.eventId, ...resizeConfirm.affectedEventIds]);
        const nextEvents = eventList
          .filter((item) => applySet.has(item.id))
          .map((item) => ({
            ...item,
            recurrence: resizeCadence,
            recurrenceConfig: item.recurrenceConfig ?? DEFAULT_RECURRENCE_CONFIG,
            tags: [
              ...(item.tags ?? []).filter((tag) => !tag.startsWith('rrule_window:')),
              resizeIndefinite ? 'rrule_window:indefinite' : `rrule_window:${resizeCount}`
            ]
          }));
        void onSaveEvents(nextEvents).catch((error) => {
          console.error('Failed to persist recurring resize update:', error);
        });
      }
    }
    if (resizeScope === 'one_off' && onSaveEvent) {
      const target = eventList.find((item) => item.id === resizeConfirm.eventId);
      if (target) {
        void onSaveEvent(target).catch((error) => {
          console.error('Failed to persist one-off resize update:', error);
        });
      }
    }

    setResizeConfirm(null);
  };

  const handleContentModeChange = (mode: 'all' | 'weekday'): void => {
    setContentMode(mode);
  };

  const handleAllListChange = async (listId: string): Promise<void> => {
    const nextItems = (listOptions.find((option) => option.id === listId)?.items || []).map((entry) => entry.id);
    setContentAll({
      listId,
      itemIds: nextItems
    });
    await persistContentRule({
      selectorType: 'all',
      selectorValue: null,
      listId,
      itemIds: nextItems
    });
  };

  const handleAllItemsChange = async (itemIds: string[]): Promise<void> => {
    setContentAll((prev) => ({
      ...prev,
      itemIds
    }));
    await persistContentRule({
      selectorType: 'all',
      selectorValue: null,
      listId: contentAll.listId,
      itemIds
    });
  };

  const handleWeekdayListChange = async (
    weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
    listId: string
  ): Promise<void> => {
    const nextItems = (listOptions.find((option) => option.id === listId)?.items || []).map((entry) => entry.id);
    setContentByWeekday((prev) => ({
      ...prev,
      [weekday]: {
        listId,
        itemIds: nextItems
      }
    }));
    await persistContentRule({
      selectorType: 'weekday',
      selectorValue: weekday,
      listId,
      itemIds: nextItems
    });
  };

  const handleWeekdayItemsChange = async (
    weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
    itemIds: string[]
  ): Promise<void> => {
    const listId = contentByWeekday[weekday]?.listId || '';
    setContentByWeekday((prev) => ({
      ...prev,
      [weekday]: {
        ...prev[weekday],
        itemIds
      }
    }));
    await persistContentRule({
      selectorType: 'weekday',
      selectorValue: weekday,
      listId,
      itemIds
    });
  };

  return (
    <section className="calendar-week-view">
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-left">
          <h1 className="calendar-title">Calendar</h1>
          <Button variant="secondary" className="calendar-add-btn" onClick={() => openCreateModal()}>
            <Plus size={14} aria-hidden="true" />
            Add
          </Button>
        </div>

        <div className="calendar-toolbar-right">
          <div className="calendar-range-group">
            <button
              type="button"
              className="calendar-nav-btn"
              aria-label="Previous week"
              onClick={() => setWeekStart((prev) => addDays(prev, -7))}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="calendar-nav-btn"
              aria-label="Next week"
              onClick={() => setWeekStart((prev) => addDays(prev, 7))}
            >
              <ChevronRight size={16} />
            </button>
            <div className="calendar-range-copy">
              <p className="calendar-month-name">{monthLabel}</p>
              <p className="calendar-week-label">{weekRangeLabel}</p>
            </div>
          </div>

          <div className="calendar-tools-group">
            <Button
              variant="secondary"
              className="calendar-today-btn"
              onClick={() => setWeekStart(getStartForMode(new Date(), weekAnchorMode))}
            >
              Today
            </Button>
            <button type="button" className="calendar-view-chip">
              <CalendarDays size={14} />
              Week
            </button>
          <div className="calendar-config-wrap">
            <button
              type="button"
              className="calendar-view-chip icon-only"
              aria-label="View options"
              onClick={() => setIsConfigOpen((value) => !value)}
            >
              <SlidersHorizontal size={14} />
            </button>

            {isConfigOpen && (
              <div className="calendar-config-menu">
                <label className="calendar-config-row">
                  <span>Event Overlap</span>
                  <button
                    type="button"
                    className={`calendar-switch ${allowOverlap ? 'on' : 'off'}`.trim()}
                    aria-label={`Event overlap ${allowOverlap ? 'on' : 'off'}`}
                    onClick={() => setAllowOverlap((value) => !value)}
                  >
                    <span className="calendar-switch-thumb" />
                  </button>
                </label>

                <label className="calendar-config-row">
                  <span>Week starts Sunday</span>
                  <button
                    type="button"
                    className={`calendar-switch ${weekAnchorMode === 'sunday' ? 'on' : 'off'}`.trim()}
                    aria-label={`Week anchor ${weekAnchorMode === 'sunday' ? 'sunday' : 'today second column'}`}
                    onClick={() =>
                      setWeekAnchorMode((mode) => (mode === 'sunday' ? 'today_second' : 'sunday'))
                    }
                  >
                    <span className="calendar-switch-thumb" />
                  </button>
                </label>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      <div className="calendar-main-row">
        <div className="calendar-grid-area">
          <WeekCalendar
            startOfWeek={weekStart}
            events={visibleEvents}
            hours={{ start: 1, end: 23 }}
            pixelsPerMinute={1}
            onEventClick={(eventItem) => {
              // Don't open drawer if we're resizing
              if (isResizing) {
                return;
              }
              const sourceId = eventItem.sourceEventId ?? eventItem.id;
              setSelectedEventId(sourceId);
              const sourceEvent = eventList.find((record) => record.id === sourceId);
              if (sourceEvent) {
                openEditModal(sourceEvent, {
                  instanceId: eventItem.id,
                  scheduledStartUtc: new Date(eventItem.start).toISOString(),
                  scheduledEndUtc: new Date(eventItem.end).toISOString()
                });
              }
            }}
            onTimeRangeSelect={({ start, end }) => openCreateModal({ start, end })}
            onEventResizeStart={handleResizeStart}
            onEventResizePreview={handleResizePreview}
            onEventResizeEnd={handleResizeEnd}
            onEventMovePreview={handleEventMovePreview}
            onEventMoveEnd={handleEventMoveEnd}
            selectedEventId={selectedEventId}
            onEventAddTask={addTaskToEvent}
            onEventReorderTasks={reorderEventTasks}
          />
        </div>

        {isDrawerRendered && (
          <div className={`calendar-drawer-overlay-shell ${isDrawerVisible ? 'open' : 'closed'}`.trim()}>
            <EventDrawer
            isCreateFlow={!editingEventId}
            title={formState.title}
            description={formState.description}
            start={formState.start}
            end={formState.end}
            recurrence={formState.recurrence}
            recurrenceConfig={formState.recurrenceConfig}
            includeWeekends={formState.includeWeekends}
            aiHandoffActive={isAiContextActive}
            onTitleChange={(value) =>
              setFormState((prev) => ({
                ...prev,
                title: value
              }))
            }
            onDescriptionChange={(value) =>
              setFormState((prev) => ({
                ...prev,
                description: value
              }))
            }
            onStartChange={(value) =>
              setFormState((prev) => ({
                ...prev,
                start: value
              }))
            }
            onEndChange={(value) =>
              setFormState((prev) => ({
                ...prev,
                end: value
              }))
            }
            onRecurrenceChange={(value) =>
              setFormState((prev) => ({
                ...prev,
                recurrence: value,
                recurrenceConfig: normalizeRecurrenceConfigForRule(value, prev.recurrenceConfig)
              }))
            }
            onRecurrenceConfigChange={(value) =>
              setFormState((prev) => ({
                ...prev,
                recurrenceConfig: normalizeRecurrenceConfigForRule(prev.recurrence, value)
              }))
            }
            onToggleIncludeWeekends={() =>
              setFormState((prev) => ({
                ...prev,
                includeWeekends: !prev.includeWeekends
              }))
            }
            onAskDelta={openAiWithContext}
            isTaskLinkRequested={isTaskLinkPanelOpen}
            onLinkTasks={() => setIsTaskLinkPanelOpen((prev) => !prev)}
            onAskDeltaForTasks={handleAskDeltaForTaskLinking}
            draftItems={draftLinkedItems}
            onDraftItemAdd={(title) =>
              setDraftLinkedItems((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  title,
                  listId: contentAll.listId || ''
                }
              ])
            }
            onDraftItemRemove={(id) => setDraftLinkedItems((prev) => prev.filter((entry) => entry.id !== id))}
            onDraftItemAssign={(id, listId) =>
              setDraftLinkedItems((prev) =>
                prev.map((entry) => (entry.id === id ? { ...entry, listId } : entry))
              )
            }
            canOptimize={Boolean(editingEventId)}
            isOptimizingBlock={isOptimizingBlock}
            optimizeError={optimizeError}
            optimizeSource={optimizeResult?.source}
            onOptimizeBlock={handleOptimizeBlock}
            proposalRows={proposalRows}
            proposalsApplying={proposalApplying}
            onToggleProposalRow={(id, approved) =>
              setProposalRows((prev) => prev.map((row) => (row.id === id ? { ...row, approved } : row)))
            }
            onApproveSelectedProposals={() => void handleApproveSelectedProposals()}
            onCancelProposals={() => setProposalRows([])}
            timeblockNotes={timeblockComments}
            timeblockNotesLoading={timeblockCommentsLoading}
            timeblockNoteError={timeblockCommentError}
            timeblockNoteDraft={timeblockCommentDraft}
            timeblockNoteSubmitting={timeblockCommentSubmitting}
            onTimeblockNoteDraftChange={setTimeblockCommentDraft}
            onSubmitTimeblockNote={() => void handleSubmitTimeblockNote()}
            contentMode={contentMode}
            onContentModeChange={handleContentModeChange}
            contentListOptions={listOptions.map((option) => ({ id: option.id, name: option.name }))}
            contentItemOptionsByList={contentItemOptionsByList}
            contentFocalTree={contentFocalTree}
            contentAll={contentAll}
            contentByWeekday={contentByWeekday}
            onContentAllListChange={(listId) => void handleAllListChange(listId)}
            onContentAllItemsChange={(itemIds) => void handleAllItemsChange(itemIds)}
            onContentWeekdayListChange={(weekday, listId) => void handleWeekdayListChange(weekday, listId)}
            onContentWeekdayItemsChange={(weekday, itemIds) => void handleWeekdayItemsChange(weekday, itemIds)}
            occurrenceWeekday={occurrenceContext?.weekday || null}
            occurrenceItems={activeOccurrenceItems}
            onToggleOccurrenceItem={(entry, checked) => void handleToggleOccurrenceItem(entry, checked)}
            onOpenOccurrenceItem={handleOpenOccurrenceItem}
            onCancel={closeModal}
            onSave={saveEvent}
            />
          </div>
        )}
      </div>

      {resizeConfirm && (
        <div className="modal-overlay calendar-drawer-overlay" onClick={cancelResizeConfirm}>
          <section
            className="modal calendar-event-modal calendar-event-drawer resize-confirm-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="calendar-event-modal-header compact">
              <h3>Apply Time Change</h3>
              <button className="calendar-drawer-close" type="button" onClick={cancelResizeConfirm} aria-label="Close">
                <X size={14} />
              </button>
            </header>

            <div className="resize-confirm-grid">
              <label>
                <input
                  type="radio"
                  checked={resizeScope === 'one_off'}
                  onChange={() => setResizeScope('one_off')}
                />
                One-off
              </label>
              <label>
                <input
                  type="radio"
                  checked={resizeScope === 'recurring'}
                  onChange={() => setResizeScope('recurring')}
                />
                Recurring
              </label>

              {resizeScope === 'recurring' && (
                <>
                  <label className="calendar-field">
                    <span>Cadence</span>
                    <select
                      className="calendar-input"
                      value={resizeCadence}
                      onChange={(event) =>
                        setResizeCadence(
                          event.target.value as Extract<RecurrenceRule, 'daily' | 'weekly' | 'monthly'>
                        )
                      }
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={resizeIndefinite}
                      onChange={(event) => setResizeIndefinite(event.target.checked)}
                    />
                    Indefinite
                  </label>

                  {!resizeIndefinite && (
                    <label className="calendar-field">
                      <span>Occurrences</span>
                      <input
                        className="calendar-input"
                        value={resizeCount}
                        onChange={(event) => setResizeCount(event.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
            </div>

            <footer className="calendar-drawer-footer">
              <Button variant="secondary" onClick={cancelResizeConfirm}>
                Cancel
              </Button>
              <Button className="calendar-confirm-btn" onClick={applyResizeConfirm}>
                Apply
              </Button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

function buildAttachTags(selection: Record<string, AttachSelectionConfig>): string[] {
  const tags: string[] = [];
  for (const [id, config] of Object.entries(selection)) {
    tags.push(`attach:${id}:${config.mode}`);
    tags.push(
      `attachcfg:${id}:${config.recurrenceMode}:${config.recurrenceRule}:${config.recurrenceConfig.interval}:${config.recurrenceConfig.unit}:${config.recurrenceConfig.limitType}:${config.recurrenceConfig.count ?? ''}:${config.recurrenceConfig.until ?? ''}`
    );
  }
  return tags;
}

function extractAttachSelection(tags: string[] | undefined): Record<string, AttachSelectionConfig> {
  if (!tags?.length) {
    return {};
  }
  const parsed = tags.reduce<Record<string, AttachSelectionConfig>>((acc, tag) => {
    if (!tag.startsWith('attach:')) {
      return acc;
    }
    const [, id, mode] = tag.split(':');
    if (!id || (mode !== 'node_only' && mode !== 'with_children')) {
      return acc;
    }
    acc[id] = {
      ...DEFAULT_ATTACH_SELECTION_CONFIG,
      mode
    };
    return acc;
  }, {});

  for (const tag of tags) {
    if (!tag.startsWith('attachcfg:')) {
      continue;
    }
    const [, id, recurrenceMode, recurrenceRule, intervalRaw, unit, limitType, countRaw, untilRaw] = tag.split(':');
    if (!id || !parsed[id]) {
      continue;
    }
    if (recurrenceMode !== 'match_event' && recurrenceMode !== 'custom') {
      continue;
    }
    const interval = Math.max(1, Number.parseInt(intervalRaw || '1', 10));
    const count = countRaw ? Math.max(1, Number.parseInt(countRaw, 10)) : undefined;
    const safeRule: RecurrenceRule = isRecurrenceRule(recurrenceRule) ? recurrenceRule : 'daily';
    const safeUnit: CustomRecurrenceConfig['unit'] =
      unit === 'day' || unit === 'week' || unit === 'month' || unit === 'year' ? unit : 'week';
    const safeLimitType: CustomRecurrenceConfig['limitType'] =
      limitType === 'count' || limitType === 'until' || limitType === 'indefinite'
        ? limitType
        : 'indefinite';

    parsed[id] = {
      ...parsed[id],
      recurrenceMode,
      recurrenceRule: safeRule,
      recurrenceConfig: {
        interval,
        unit: safeUnit,
        limitType: safeLimitType,
        count,
        until: untilRaw || undefined
      }
    };
  }

  return parsed;
}

function extractNodeRawId(nodeId: string, expectedKind: 'focal' | 'lane' | 'item' | 'action'): string | null {
  if (!nodeId) return null;
  const parts = nodeId.split('|');
  if (parts.length === 1) {
    // Legacy trees may provide raw UUID ids without kind prefix.
    return nodeId;
  }
  const [kind, rawId] = parts;
  if (!rawId) return null;

  const aliasMatch =
    (expectedKind === 'lane' && (kind === 'lane' || kind === 'list' || kind === 'project')) ||
    (expectedKind === 'item' && (kind === 'item' || kind === 'task')) ||
    (expectedKind === 'focal' && (kind === 'focal' || kind === 'space' || kind === 'domain')) ||
    (expectedKind === 'action' && (kind === 'action' || kind === 'subtask'));

  if (aliasMatch) {
    return rawId;
  }

  return null;
}

function isRecurrenceRule(value: string): value is RecurrenceRule {
  return value === 'none' || value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'custom';
}

function normalizeRecurrenceConfigForRule(
  recurrence: RecurrenceRule,
  recurrenceConfig: CustomRecurrenceConfig
): CustomRecurrenceConfig {
  if (recurrence === 'daily') {
    return { ...recurrenceConfig, unit: 'day', interval: Math.max(1, recurrenceConfig.interval || 1) };
  }
  if (recurrence === 'weekly') {
    return { ...recurrenceConfig, unit: 'week', interval: Math.max(1, recurrenceConfig.interval || 1) };
  }
  if (recurrence === 'monthly') {
    return { ...recurrenceConfig, unit: 'month', interval: Math.max(1, recurrenceConfig.interval || 1) };
  }
  return {
    ...recurrenceConfig,
    interval: Math.max(1, recurrenceConfig.interval || 1)
  };
}

interface AttachNodeRowProps {
  node: AttachNode;
  depth?: number;
  selected: Record<string, AttachSelectionConfig>;
  onToggle: (id: string) => void;
  onModeChange: (id: string, mode: AttachMode) => void;
  onRecurrenceModeChange: (id: string, recurrenceMode: AttachRecurrenceMode) => void;
  onRecurrenceRuleChange: (id: string, recurrenceRule: RecurrenceRule) => void;
  onRecurrenceConfigChange: (id: string, recurrenceConfig: CustomRecurrenceConfig) => void;
}

function AttachNodeRow({
  node,
  depth = 0,
  selected,
  onToggle,
  onModeChange,
  onRecurrenceModeChange,
  onRecurrenceRuleChange,
  onRecurrenceConfigChange
}: AttachNodeRowProps): JSX.Element {
  const activeConfig = selected[node.id];
  const activeMode = activeConfig?.mode;
  const resolvedConfig = activeConfig ?? DEFAULT_ATTACH_SELECTION_CONFIG;
  return (
    <div className="attach-node-row" style={{ marginLeft: `${depth * 10}px` }}>
      <label className="attach-node-main">
        <input
          type="checkbox"
          checked={Boolean(activeMode)}
          onChange={() => onToggle(node.id)}
        />
        <span>{node.label}</span>
      </label>
      {activeMode && (
        <div className="attach-node-controls">
          <select
            className="calendar-input attach-node-mode"
            value={activeMode}
            onChange={(event) => onModeChange(node.id, event.target.value as AttachMode)}
          >
            <option value="node_only">Just this node</option>
            <option value="with_children">Node + all downstream</option>
          </select>
          <select
            className="calendar-input attach-node-mode"
            value={resolvedConfig.recurrenceMode}
            onChange={(event) =>
              onRecurrenceModeChange(node.id, event.target.value as AttachRecurrenceMode)
            }
          >
            <option value="match_event">Match time block</option>
            <option value="custom">Custom recurrence</option>
          </select>
          {resolvedConfig.recurrenceMode === 'custom' && (
            <div className="attach-node-custom-recurrence">
              <label className="calendar-field">
                <span>Rule</span>
                <select
                  className="calendar-input"
                  value={resolvedConfig.recurrenceRule}
                  onChange={(event) =>
                    onRecurrenceRuleChange(node.id, event.target.value as RecurrenceRule)
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="calendar-field">
                <span>Every</span>
                <input
                  className="calendar-input"
                  type="number"
                  min={1}
                  value={resolvedConfig.recurrenceConfig.interval}
                  onChange={(event) =>
                    onRecurrenceConfigChange(node.id, {
                      ...resolvedConfig.recurrenceConfig,
                      interval: Math.max(1, Number.parseInt(event.target.value || '1', 10))
                    })
                  }
                />
              </label>
              <label className="calendar-field">
                <span>Unit</span>
                <select
                  className="calendar-input"
                  value={resolvedConfig.recurrenceConfig.unit}
                  onChange={(event) =>
                    onRecurrenceConfigChange(node.id, {
                      ...resolvedConfig.recurrenceConfig,
                      unit: event.target.value as CustomRecurrenceConfig['unit']
                    })
                  }
                >
                  <option value="day">Days</option>
                  <option value="week">Weeks</option>
                  <option value="month">Months</option>
                  <option value="year">Years</option>
                </select>
              </label>
              <label className="calendar-field">
                <span>Ends</span>
                <select
                  className="calendar-input"
                  value={resolvedConfig.recurrenceConfig.limitType}
                  onChange={(event) =>
                    onRecurrenceConfigChange(node.id, {
                      ...resolvedConfig.recurrenceConfig,
                      limitType: event.target.value as CustomRecurrenceConfig['limitType']
                    })
                  }
                >
                  <option value="indefinite">Never</option>
                  <option value="count">After count</option>
                  <option value="until">On date</option>
                </select>
              </label>
              {resolvedConfig.recurrenceConfig.limitType === 'count' && (
                <label className="calendar-field">
                  <span>Count</span>
                  <input
                    className="calendar-input"
                    type="number"
                    min={1}
                    value={resolvedConfig.recurrenceConfig.count ?? 8}
                    onChange={(event) =>
                      onRecurrenceConfigChange(node.id, {
                        ...resolvedConfig.recurrenceConfig,
                        count: Math.max(1, Number.parseInt(event.target.value || '1', 10))
                      })
                    }
                  />
                </label>
              )}
              {resolvedConfig.recurrenceConfig.limitType === 'until' && (
                <label className="calendar-field">
                  <span>Until</span>
                  <input
                    className="calendar-input"
                    type="date"
                    value={resolvedConfig.recurrenceConfig.until ?? ''}
                    onChange={(event) =>
                      onRecurrenceConfigChange(node.id, {
                        ...resolvedConfig.recurrenceConfig,
                        until: event.target.value
                      })
                    }
                  />
                </label>
              )}
            </div>
          )}
        </div>
      )}
      {node.children?.map((child) => (
        <AttachNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selected={selected}
          onToggle={onToggle}
          onModeChange={onModeChange}
          onRecurrenceModeChange={onRecurrenceModeChange}
          onRecurrenceRuleChange={onRecurrenceRuleChange}
          onRecurrenceConfigChange={onRecurrenceConfigChange}
        />
      ))}
    </div>
  );
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getSundayStart(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - next.getDay());
  next.setHours(0, 0, 0, 0);
  return next;
}

function getStartForMode(date: Date, mode: WeekAnchorMode): Date {
  if (mode === 'sunday') {
    return getSundayStart(date);
  }
  const next = new Date(date);
  next.setDate(next.getDate() - 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toLocalDateTimeValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function roundDateToNearest15(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  rounded.setMinutes(roundedMinutes, 0, 0);
  return rounded;
}

function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver';
}

function expandEventsForWeek(events: Event[], weekStart: Date, weekEnd: Date): CalendarEvent[] {
  const visible: CalendarEvent[] = [];

  for (const event of events) {
    const recurrence = event.recurrence ?? 'none';
    const recurrenceConfig = event.recurrenceConfig;
    const includeWeekends = event.includeWeekends ?? true;
    const baseStart = new Date(event.start);
    const baseEnd = new Date(event.end);
    const durationMs = Math.max(15 * 60 * 1000, baseEnd.getTime() - baseStart.getTime());

    if (recurrence === 'none') {
      if (baseEnd >= weekStart && baseStart <= weekEnd) {
        visible.push({
          id: event.id,
          sourceEventId: event.id,
          title: event.title,
          start: baseStart,
          end: baseEnd,
          tasks: event.tasks
        });
      }
      continue;
    }

    let cursor = new Date(baseStart);
    let guard = 0;
    const maxIterations = 1200;
    while (cursor < weekStart && guard < 800) {
      if (hasRecurrenceExceededLimit(baseStart, cursor, recurrence, recurrenceConfig)) {
        break;
      }
      cursor = shiftByRecurrence(cursor, recurrence, recurrenceConfig);
      guard += 1;
    }

    while (cursor <= weekEnd && guard < maxIterations) {
      if (hasRecurrenceExceededLimit(baseStart, cursor, recurrence, recurrenceConfig)) {
        break;
      }
      const occurrenceEnd = new Date(cursor.getTime() + durationMs);
      const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;
      const shouldIncludeOccurrence =
        (recurrence !== 'daily' && recurrence !== 'custom') || includeWeekends || !isWeekend;
      if (shouldIncludeOccurrence && occurrenceEnd >= weekStart && cursor <= weekEnd) {
        visible.push({
          id: `${event.id}__${cursor.toISOString()}`,
          sourceEventId: event.id,
          title: event.title,
          start: new Date(cursor),
          end: occurrenceEnd,
          tasks: event.tasks
        });
      }
      cursor = shiftByRecurrence(cursor, recurrence, recurrenceConfig);
      guard += 1;
    }
  }

  return visible;
}

function shiftByRecurrence(
  date: Date,
  recurrence: Extract<RecurrenceRule, 'daily' | 'weekly' | 'monthly' | 'custom'>,
  recurrenceConfig?: CustomRecurrenceConfig
): Date {
  const next = new Date(date);
  if (recurrence === 'daily') {
    const interval = Math.max(1, recurrenceConfig?.interval ?? 1);
    next.setDate(next.getDate() + interval);
    return next;
  }
  if (recurrence === 'weekly') {
    const interval = Math.max(1, recurrenceConfig?.interval ?? 1);
    next.setDate(next.getDate() + interval * 7);
    return next;
  }
  if (recurrence === 'monthly') {
    const interval = Math.max(1, recurrenceConfig?.interval ?? 1);
    next.setMonth(next.getMonth() + interval);
    return next;
  }
  if (recurrence === 'custom') {
    const unit = recurrenceConfig?.unit ?? 'week';
    const interval = Math.max(1, recurrenceConfig?.interval ?? 1);
    if (unit === 'day') {
      next.setDate(next.getDate() + interval);
      return next;
    }
    if (unit === 'week') {
      next.setDate(next.getDate() + interval * 7);
      return next;
    }
    if (unit === 'year') {
      next.setFullYear(next.getFullYear() + interval);
      return next;
    }
    next.setMonth(next.getMonth() + interval);
    return next;
  }
  const interval = Math.max(1, recurrenceConfig?.interval ?? 1);
  next.setMonth(next.getMonth() + interval);
  return next;
}

function hasRecurrenceExceededLimit(
  baseStart: Date,
  occurrenceStart: Date,
  recurrence: RecurrenceRule,
  recurrenceConfig?: CustomRecurrenceConfig
): boolean {
  if (recurrence === 'none' || !recurrenceConfig) {
    return false;
  }

  if (recurrenceConfig.limitType === 'until' && recurrenceConfig.until) {
    const untilDate = new Date(`${recurrenceConfig.until}T23:59:59.999`);
    if (occurrenceStart.getTime() > untilDate.getTime()) {
      return true;
    }
  }

  if (recurrenceConfig.limitType === 'count' && recurrenceConfig.count) {
    const occurrenceCount = computeOccurrenceCount(baseStart, occurrenceStart, recurrence, recurrenceConfig);
    return occurrenceCount > recurrenceConfig.count;
  }

  return false;
}

function computeOccurrenceCount(
  baseStart: Date,
  occurrenceStart: Date,
  recurrence: RecurrenceRule,
  recurrenceConfig: CustomRecurrenceConfig
): number {
  const interval = Math.max(1, recurrenceConfig.interval || 1);
  const diffMs = occurrenceStart.getTime() - baseStart.getTime();
  if (diffMs <= 0) return 1;

  if (recurrence === 'daily') {
    return Math.floor(diffMs / (24 * 60 * 60 * 1000 * interval)) + 1;
  }
  if (recurrence === 'weekly') {
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000 * interval)) + 1;
  }
  if (recurrence === 'monthly') {
    const monthDiff =
      (occurrenceStart.getFullYear() - baseStart.getFullYear()) * 12 +
      (occurrenceStart.getMonth() - baseStart.getMonth());
    return Math.floor(monthDiff / interval) + 1;
  }

  if (recurrenceConfig.unit === 'day') {
    return Math.floor(diffMs / (24 * 60 * 60 * 1000 * interval)) + 1;
  }
  if (recurrenceConfig.unit === 'week') {
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000 * interval)) + 1;
  }
  if (recurrenceConfig.unit === 'year') {
    const yearDiff = occurrenceStart.getFullYear() - baseStart.getFullYear();
    return Math.floor(yearDiff / interval) + 1;
  }

  const monthDiff =
    (occurrenceStart.getFullYear() - baseStart.getFullYear()) * 12 +
    (occurrenceStart.getMonth() - baseStart.getMonth());
  return Math.floor(monthDiff / interval) + 1;
}

function applyOverlapOnResize(
  events: Event[],
  payload: {
    eventId: string;
    start: Date;
    end: Date;
    direction: 'start' | 'end';
    originalStart: Date;
    originalEnd: Date;
  }
): { events: Event[]; affectedIds: string[] } {
  // For overlap ON, we allow the resize and let the layout system handle lane splitting
  // The existing buildEventLayouts function will create appropriate lanes
  return { events, affectedIds: [] };
}

function applyResizeWithPolicy(
  events: Event[],
  payload: {
    eventId: string;
    start: Date;
    end: Date;
    direction: 'start' | 'end';
    originalStart: Date;
    originalEnd: Date;
  },
  allowOverlap: boolean
): { events: Event[]; affectedIds: string[] } {
  const MIN_DURATION_MS = 15 * 60 * 1000;
  const TOUCH_TOLERANCE_MS = 60 * 1000;
  const updated = events.map((event) =>
    event.id === payload.eventId
      ? {
          ...event,
          start: payload.start.toISOString(),
          end: payload.end.toISOString()
        }
      : event
  );

  if (allowOverlap) {
    // Enhanced overlap ON: implement sophisticated lane splitting
    return applyOverlapOnResize(updated, payload);
  }

  const dayKey = payload.originalStart.toDateString();
  const resizedEvent = updated.find((event) => event.id === payload.eventId);
  if (!resizedEvent) {
    return { events: updated, affectedIds: [] };
  }

  const affectedIds: string[] = [];
  const dayEvents = updated
    .filter((event) => new Date(event.start).toDateString() === dayKey)
    .map((event) => ({
      id: event.id,
      ref: event,
      startMs: new Date(event.start).getTime(),
      endMs: new Date(event.end).getTime()
    }))
    .sort((a, b) => a.startMs - b.startMs);

  const targetIndex = dayEvents.findIndex((item) => item.id === payload.eventId);
  if (targetIndex === -1) {
    return { events: updated, affectedIds: [] };
  }

  const target = dayEvents[targetIndex];
  const targetStartMs = target.startMs;
  const targetEndMs = target.endMs;
  
  // Find all events that overlap with the resized event
  const overlappingEvents = dayEvents.filter((event) => 
    event.id !== payload.eventId && 
    !(event.endMs <= targetStartMs || event.startMs >= targetEndMs)
  );
  const dayStartMs = new Date(
    payload.originalStart.getFullYear(),
    payload.originalStart.getMonth(),
    payload.originalStart.getDate(),
    0,
    0,
    0,
    0
  ).getTime();
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

  // Enhanced overlap OFF logic: shrink any overlapping events
  for (const overlappingEvent of overlappingEvents) {
    if (payload.direction === 'start') {
      // If resizing start, shrink overlapping events that start before the new start
      if (overlappingEvent.startMs < targetStartMs) {
        overlappingEvent.endMs = Math.min(overlappingEvent.endMs, targetStartMs);
        if (!affectedIds.includes(overlappingEvent.id)) {
          affectedIds.push(overlappingEvent.id);
        }
      }
    } else {
      // If resizing end, shrink overlapping events that end after the new end
      if (overlappingEvent.endMs > targetEndMs) {
        overlappingEvent.startMs = Math.max(overlappingEvent.startMs, targetEndMs);
        if (!affectedIds.includes(overlappingEvent.id)) {
          affectedIds.push(overlappingEvent.id);
        }
      }
    }
  }

  for (const item of dayEvents) {
    item.ref.start = new Date(item.startMs).toISOString();
    item.ref.end = new Date(Math.max(item.endMs, item.startMs + MIN_DURATION_MS)).toISOString();
  }

  return { events: updated, affectedIds };
}
