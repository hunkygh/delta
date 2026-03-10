import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, TouchEvent } from 'react';
import {
  Settings,
  UserCircle,
  X,
  Send,
  Mic,
  Type,
  CalendarPlus,
  Clock3,
  Plus,
  Circle,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  CalendarDays,
  CheckSquare,
  ArrowLeft,
  Folder,
  SlidersHorizontal,
  Trash2
} from 'lucide-react';
import { Mountains } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import chatService from '../../services/chatService';
import chatPersistence from '../../services/chatPersistence';
import focalBoardService from '../../services/focalBoardService';
import { calendarService } from '../../services/calendarService';
import listFieldService from '../../services/listFieldService';
import itemFieldValueService from '../../services/itemFieldValueService';
import commentsService from '../../services/commentsService';
import docsService, { type DocNote } from '../../services/docsService';
import type { ChatMessage, ChatProposal } from '../../types/chat';

type MobileBlockItem = {
  id: string;
  name: string;
  description?: string;
  subItems?: Array<{ id: string; name: string }>;
  focalId?: string;
  listId?: string;
};

type MobileBlock = {
  id: string;
  name: string;
  description?: string;
  startMin: number;
  endMin: number;
  recurrence?: AddSheetRecurrence;
  items: MobileBlockItem[];
};

type AddSheetRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

type DrawerState = {
  open: boolean;
  mode: 'peek' | 'full' | 'edit' | 'item' | 'addTask';
  blockId: string | null;
  itemId?: string | null;
};

type AddSheetState = {
  open: boolean;
  type: 'space' | 'list' | 'item' | 'subitem' | 'event' | 'doc';
  focalId?: string | null;
  listId?: string | null;
  itemId?: string | null;
};

type MobileFocal = {
  id: string;
  name: string;
  order_num?: number;
};

type MobileList = {
  id: string;
  name: string;
  item_label?: string;
  action_label?: string;
};

type MobileItem = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  status_id?: string | null;
  actions?: Array<{ id: string; title: string; subtask_status?: string | null; subtask_status_id?: string | null }>;
};

type IndexedList = {
  id: string;
  name: string;
  focalId: string;
  focalName: string;
  items: Array<{ id: string; title: string }>;
};

type MobileScope = {
  level: 'focals' | 'focal' | 'list';
  focalId: string | null;
  listId: string | null;
};

type MobileChatSourceOption = {
  id: string;
  label: string;
  context: Record<string, string>;
};

const DAY_START_MIN = 6 * 60;
const DAY_END_MIN = 22 * 60;
const PX_PER_MIN = 2.2;

const FALLBACK_FOCAL_OPTIONS = [
  { id: 'health', name: 'Health', lists: [{ id: 'workouts', name: 'Workouts' }, { id: 'meals', name: 'Meals' }] },
  { id: 'global-payments', name: 'Global Payments', lists: [{ id: 'route-a', name: 'Route A - SLC Coffee Shops' }] }
];

const formatTime = (totalMin: number): string => {
  const h24 = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
};

const formatRange = (start: number, end: number): string => `${formatTime(start)} - ${formatTime(end)}`;
const isNowInside = (block: MobileBlock, nowMin: number): boolean => nowMin >= block.startMin && nowMin < block.endMin;
const makeId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const minutesFromDate = (value: string): number => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DAY_START_MIN;
  return date.getHours() * 60 + date.getMinutes();
};

const toInputTime = (minute: number): string => {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.round(minute)));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const sortMobileBlockItems = (
  items: MobileBlockItem[],
  completedMap: Record<string, boolean>
): MobileBlockItem[] =>
  [...items].sort((a, b) => {
    const aDone = completedMap[a.id] === true;
    const bDone = completedMap[b.id] === true;
    if (aDone !== bDone) {
      return aDone ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });

const dedupeMobileBlockItems = (items: MobileBlockItem[]): MobileBlockItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export default function MobileCalendarWireframe(): JSX.Element {
  const { user } = useAuth();
  const [view, setView] = useState<'calendar' | 'ai'>('calendar');
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, mode: 'peek', blockId: null });
  const [editDrawerName, setEditDrawerName] = useState('');
  const [editDrawerDescription, setEditDrawerDescription] = useState('');
  const [editDrawerStart, setEditDrawerStart] = useState('09:00');
  const [editDrawerEnd, setEditDrawerEnd] = useState('10:00');
  const [editDrawerRecurrence, setEditDrawerRecurrence] = useState<AddSheetRecurrence>('none');
  const [editDrawerRecurrenceExpanded, setEditDrawerRecurrenceExpanded] = useState(false);
  const [editDrawerSaving, setEditDrawerSaving] = useState(false);
  const [isDrawerDragging, setIsDrawerDragging] = useState(false);
  const [drawerDragY, setDrawerDragY] = useState(0);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isViewGestureDragging, setIsViewGestureDragging] = useState(false);
  const [viewDragX, setViewDragX] = useState(0);
  const [activeNav, setActiveNav] = useState<'docs' | 'focals' | 'calendar'>('calendar');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickPanelOpen, setQuickPanelOpen] = useState(false);
  const [quickPanelMounted, setQuickPanelMounted] = useState(false);
  const [captureMode, setCaptureMode] = useState<'none' | 'text'>('none');
  const [captureInputMode, setCaptureInputMode] = useState<'text' | 'voice'>('text');
  const [addSheet, setAddSheet] = useState<AddSheetState>({ open: false, type: 'item' });
  const [addSheetClosing, setAddSheetClosing] = useState(false);
  const [isAddSheetDragging, setIsAddSheetDragging] = useState(false);
  const [addSheetDragY, setAddSheetDragY] = useState(0);
  const [addSheetName, setAddSheetName] = useState('');
  const [addSheetDescription, setAddSheetDescription] = useState('');
  const [addItemStatuses, setAddItemStatuses] = useState<Array<{ id?: string; key: string; name: string; is_default?: boolean }>>([]);
  const [addItemStatusValue, setAddItemStatusValue] = useState('');
  const [addItemFields, setAddItemFields] = useState<any[]>([]);
  const [addItemFieldDrafts, setAddItemFieldDrafts] = useState<Record<string, string>>({});
  const [addSheetStart, setAddSheetStart] = useState('09:00');
  const [addSheetEnd, setAddSheetEnd] = useState('10:00');
  const [addSheetRecurrence, setAddSheetRecurrence] = useState<AddSheetRecurrence>('none');
  const [addSheetRecurrenceExpanded, setAddSheetRecurrenceExpanded] = useState(false);
  const [viewedDate, setViewedDate] = useState<Date>(() => new Date());
  const [timelineDraft, setTimelineDraft] = useState<{
    startMin: number;
    endMin: number;
    topPx: number;
    heightPx: number;
  } | null>(null);
  const [blocks, setBlocks] = useState<MobileBlock[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [expandedTasksByBlock, setExpandedTasksByBlock] = useState<Record<string, boolean>>({});
  const [expandedItemsInList, setExpandedItemsInList] = useState<Record<string, boolean>>({});
  const [subtaskComposerByItem, setSubtaskComposerByItem] = useState<Record<string, boolean>>({});
  const [subtaskDraftByItem, setSubtaskDraftByItem] = useState<Record<string, string>>({});
  const [itemDrawerPanel, setItemDrawerPanel] = useState<'details' | 'comments'>('details');
  const [itemDrawerFields, setItemDrawerFields] = useState<any[]>([]);
  const [itemDrawerFieldValues, setItemDrawerFieldValues] = useState<Record<string, any>>({});
  const [itemDrawerComments, setItemDrawerComments] = useState<Array<{ id: string; body: string; created_at: string; author_type?: string }>>([]);
  const [itemDrawerCommentsLoading, setItemDrawerCommentsLoading] = useState(false);
  const [itemDrawerCommentDraft, setItemDrawerCommentDraft] = useState('');
  const [itemDrawerCommentSubmitting, setItemDrawerCommentSubmitting] = useState(false);
  const [taskDrawerSearch, setTaskDrawerSearch] = useState('');
  const [taskDrawerListId, setTaskDrawerListId] = useState<string | null>(null);
  const [taskDrawerPendingKey, setTaskDrawerPendingKey] = useState<string | null>(null);
  const [taskDrawerLoading, setTaskDrawerLoading] = useState(false);
  const [taskDrawerExpandedFocals, setTaskDrawerExpandedFocals] = useState<Record<string, boolean>>({});
  const [taskDrawerExpandedLists, setTaskDrawerExpandedLists] = useState<Record<string, boolean>>({});

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [applyingMobileProposalId, setApplyingMobileProposalId] = useState<string | null>(null);
  const [approvedMobileProposalIds, setApprovedMobileProposalIds] = useState<Record<string, boolean>>({});
  const [dismissedMobileProposalIds, setDismissedMobileProposalIds] = useState<Record<string, boolean>>({});
  const [mobileProposalNotes, setMobileProposalNotes] = useState<Record<string, string>>({});
  const [useTimeBlockContext, setUseTimeBlockContext] = useState(true);
  const [mobileMemoMode, setMobileMemoMode] = useState(false);
  const [mobileChatSourceMenuOpen, setMobileChatSourceMenuOpen] = useState(false);
  const [mobileChatSourceId, setMobileChatSourceId] = useState('current');
  const [mobileChatSourceContext, setMobileChatSourceContext] = useState<Record<string, string> | null>(null);
  const [textCaptureDraft, setTextCaptureDraft] = useState('');
  const [captureConfirmation, setCaptureConfirmation] = useState<{
    open: boolean;
    text: string;
    aiText: string;
    proposals: ChatProposal[];
    routing: boolean;
    error: string | null;
  }>({
    open: false,
    text: '',
    aiText: '',
    proposals: [],
    routing: false,
    error: null
  });
  const [captureDismissedProposalIds, setCaptureDismissedProposalIds] = useState<Record<string, boolean>>({});
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceBars, setVoiceBars] = useState<number[]>([8, 14, 10, 16, 11, 13, 9, 15]);

  const [mobileScope, setMobileScope] = useState<MobileScope>({ level: 'focals', focalId: null, listId: null });
  const [focals, setFocals] = useState<MobileFocal[]>([]);
  const [listsByFocal, setListsByFocal] = useState<Record<string, MobileList[]>>({});
  const [itemsByList, setItemsByList] = useState<Record<string, MobileItem[]>>({});
  const [listStatusesByList, setListStatusesByList] = useState<
    Record<string, Array<{ id?: string; key: string; name: string; color?: string; is_default?: boolean }>>
  >({});
  const [subtaskStatusesByList, setSubtaskStatusesByList] = useState<
    Record<string, Array<{ id?: string; key: string; name: string; color?: string; is_default?: boolean }>>
  >({});
  const [focalsLoading, setFocalsLoading] = useState(false);
  const [focalsError, setFocalsError] = useState<string>('');
  const [mobileDraggingFocalId, setMobileDraggingFocalId] = useState<string | null>(null);
  const [showMobileNewFocalInput, setShowMobileNewFocalInput] = useState(false);
  const [mobileNewFocalName, setMobileNewFocalName] = useState('');
  const [mobileCreatingFocal, setMobileCreatingFocal] = useState(false);
  const [docsNotes, setDocsNotes] = useState<DocNote[]>([]);
  const [docsSearch, setDocsSearch] = useState('');
  const [docsSearchOpen, setDocsSearchOpen] = useState(false);
  const [activeNoteEditor, setActiveNoteEditor] = useState<DocNote | null>(null);
  const [noteEditorTitle, setNoteEditorTitle] = useState('');
  const [noteEditorBody, setNoteEditorBody] = useState('');
  const [noteEditorSaving, setNoteEditorSaving] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [viewportWidth, setViewportWidth] = useState<number>(() => (typeof window !== 'undefined' ? window.innerWidth : 390));

  const longPressTimer = useRef<number | null>(null);
  const timelineDraftPressTimerRef = useRef<number | null>(null);
  const timelineDraftGestureRef = useRef<{
    active: boolean;
    touchId: number | null;
    startClientY: number;
    startMin: number;
  }>({
    active: false,
    touchId: null,
    startClientY: 0,
    startMin: DAY_START_MIN
  });
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const mobileSourceMenuRef = useRef<HTMLDivElement | null>(null);
  const textCaptureRef = useRef<HTMLTextAreaElement | null>(null);
  const addSheetNameRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const voiceRafRef = useRef<number | null>(null);
  const captureConfirmTimerRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const gestureMetaRef = useRef<{ lastX: number; lastY: number; lastT: number; velocityX: number; velocityY: number }>({
    lastX: 0,
    lastY: 0,
    lastT: 0,
    velocityX: 0,
    velocityY: 0
  });
  const addSheetGestureRef = useRef<{ startY: number; lastY: number; lastT: number; velocityY: number }>({
    startY: 0,
    lastY: 0,
    lastT: 0,
    velocityY: 0
  });
  const addSheetPointerIdRef = useRef<number | null>(null);
  const drawerGestureRef = useRef<{ startY: number; lastY: number; lastT: number; velocityY: number }>({
    startY: 0,
    lastY: 0,
    lastT: 0,
    velocityY: 0
  });
  const drawerPointerIdRef = useRef<number | null>(null);
  const itemDrawerGestureRef = useRef<{ startX: number; startY: number }>({ startX: 0, startY: 0 });

  const now = new Date();
  const isTodayView =
    viewedDate.getFullYear() === now.getFullYear() &&
    viewedDate.getMonth() === now.getMonth() &&
    viewedDate.getDate() === now.getDate();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const currentBlockId = useMemo(
    () => (isTodayView ? blocks.find((block) => isNowInside(block, nowMin))?.id ?? null : null),
    [blocks, nowMin, isTodayView]
  );
  const activeDrawerBlock = useMemo(
    () => (drawer.blockId ? blocks.find((block) => block.id === drawer.blockId) ?? null : null),
    [blocks, drawer.blockId]
  );
  const activeDrawerItem = useMemo(
    () => (activeDrawerBlock && drawer.itemId ? activeDrawerBlock.items.find((item) => item.id === drawer.itemId) || null : null),
    [activeDrawerBlock, drawer.itemId]
  );
  const activeDrawerScopedListItem = useMemo(() => {
    if (!drawer.itemId || !mobileScope.listId) return null;
    const item = (itemsByList[mobileScope.listId] || []).find((entry) => entry.id === drawer.itemId) || null;
    if (!item) return null;
    return {
      id: item.id,
      name: item.title,
      listId: mobileScope.listId,
      description: item.description || ''
    };
  }, [drawer.itemId, itemsByList, mobileScope.listId]);
  const resolvedDrawerItem = activeDrawerItem || activeDrawerScopedListItem;

  const selectedFocal = useMemo(
    () => focals.find((focal) => focal.id === mobileScope.focalId) || null,
    [focals, mobileScope.focalId]
  );
  const selectedList = useMemo(
    () => (mobileScope.focalId ? (listsByFocal[mobileScope.focalId] || []).find((list) => list.id === mobileScope.listId) || null : null),
    [listsByFocal, mobileScope.focalId, mobileScope.listId]
  );

  const addFocalOptions = useMemo(() => {
    if (focals.length === 0) return FALLBACK_FOCAL_OPTIONS;
    return focals.map((focal) => ({
      id: focal.id,
      name: focal.name,
      lists: (listsByFocal[focal.id] || []).map((list) => ({ id: list.id, name: list.name }))
    }));
  }, [focals, listsByFocal]);

  const indexedLists = useMemo<IndexedList[]>(() => {
    const rows: IndexedList[] = [];
    Object.entries(listsByFocal).forEach(([focalId, lists]) => {
      const focalName = focals.find((entry) => entry.id === focalId)?.name || 'Space';
      lists.forEach((list) => {
        rows.push({
          id: list.id,
          name: list.name,
          focalId,
          focalName,
          items: (itemsByList[list.id] || []).map((item) => ({ id: item.id, title: item.title }))
        });
      });
    });
    return rows;
  }, [focals, itemsByList, listsByFocal]);

  const taskSearchQuery = taskDrawerSearch.trim().toLowerCase();
  const taskHasExactMatch = useMemo(() => {
    if (!taskSearchQuery) return false;
    return indexedLists.some((list) => list.items.some((item) => item.title.trim().toLowerCase() === taskSearchQuery));
  }, [indexedLists, taskSearchQuery]);
  const taskTreeRows = useMemo(() => {
    const grouped = new Map<string, { focalId: string; focalName: string; lists: IndexedList[] }>();
    indexedLists.forEach((list) => {
      const focalId = list.focalId || 'unassigned';
      const existing = grouped.get(focalId);
      if (existing) {
        existing.lists.push(list);
      } else {
        grouped.set(focalId, { focalId, focalName: list.focalName || 'Space', lists: [list] });
      }
    });
    const rows = Array.from(grouped.values()).map((entry) => ({
      ...entry,
      lists: entry.lists.sort((a, b) => a.name.localeCompare(b.name))
    }));
    rows.sort((a, b) => a.focalName.localeCompare(b.focalName));
    if (!taskSearchQuery) return rows;
    return rows
      .map((focal) => {
        const focalMatches = focal.focalName.toLowerCase().includes(taskSearchQuery);
        const lists = focal.lists
          .map((list) => {
            const listMatches = list.name.toLowerCase().includes(taskSearchQuery);
            const items = list.items.filter((item) => item.title.toLowerCase().includes(taskSearchQuery));
            if (focalMatches || listMatches) return list;
            if (items.length > 0) return { ...list, items };
            return null;
          })
          .filter(Boolean) as IndexedList[];
        return { ...focal, lists };
      })
      .filter((focal) => focal.lists.length > 0);
  }, [indexedLists, taskSearchQuery]);

  const scopeTitle = useMemo(() => {
    if (activeNav === 'docs') return 'Notes';
    if (activeNav !== 'focals') return '';
    if (mobileScope.level === 'focals') return 'Spaces';
    if (mobileScope.level === 'focal') return selectedFocal?.name || 'Space';
    return selectedList?.name || 'List';
  }, [activeNav, mobileScope.level, selectedFocal?.name, selectedList?.name]);

  const timelineHeight = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN;
  const nowTop = Math.min(Math.max((nowMin - DAY_START_MIN) * PX_PER_MIN, 0), timelineHeight);

  const ticks = useMemo(() => {
    const rows: Array<{ minute: number; label: string }> = [];
    for (let minute = DAY_START_MIN; minute <= DAY_END_MIN; minute += 60) {
      rows.push({ minute, label: formatTime(minute).replace(':00', '') });
    }
    return rows;
  }, []);

  const gridLines = useMemo(() => {
    const rows: Array<{ minute: number; tone: 'hour' | 'half' | 'quarter' }> = [];
    for (let minute = DAY_START_MIN; minute <= DAY_END_MIN; minute += 15) {
      const offset = minute - DAY_START_MIN;
      const tone = offset % 60 === 0 ? 'hour' : offset % 30 === 0 ? 'half' : 'quarter';
      rows.push({ minute, tone });
    }
    return rows;
  }, []);

  const navOrder: Array<'docs' | 'focals' | 'calendar'> = ['docs', 'focals', 'calendar'];
  const activeNavIndex = navOrder.indexOf(activeNav);
  const addSubitemParentOptions = useMemo(() => {
    return indexedLists.flatMap((list) =>
      list.items.map((item) => ({
        listId: list.id,
        listName: list.name,
        itemId: item.id,
        itemTitle: item.title
      }))
    );
  }, [indexedLists]);
  const addSubitemParentValue =
    addSheet.type === 'subitem' && addSheet.listId && addSheet.itemId ? `${addSheet.listId}:${addSheet.itemId}` : '';
  const addItemColumnFields = useMemo(
    () => addItemFields.filter((field: any) => field?.type !== 'status' && !field?.is_primary),
    [addItemFields]
  );
  const canSubmitAddSheet =
    (addSheet.type === 'doc' ? !!(addSheetName.trim() || addSheetDescription.trim()) : !!addSheetName.trim()) &&
    (addSheet.type !== 'list' || !!addSheet.focalId) &&
    (addSheet.type !== 'item' || !!addSheet.listId) &&
    (addSheet.type !== 'subitem' || (!!addSheet.listId && !!addSheet.itemId));

  const buildMobileChatContext = (): Record<string, string> => {
    if (mobileChatSourceContext) {
      return { ...mobileChatSourceContext };
    }
    const context: Record<string, string> = {};
    if (currentBlockId && useTimeBlockContext) {
      context.time_block_id = currentBlockId;
    }
    if (activeNav === 'focals') {
      if (mobileScope.focalId) context.focal_id = mobileScope.focalId;
      if (mobileScope.listId) context.list_id = mobileScope.listId;
    }
    return context;
  };

  const mobileChatSourceOptions = useMemo<MobileChatSourceOption[]>(() => {
    const options: MobileChatSourceOption[] = [
      { id: 'current', label: 'Current', context: buildMobileChatContext() }
    ];
    focals.forEach((focal) => {
      options.push({
        id: `focal:${focal.id}`,
        label: `Space · ${focal.name}`,
        context: { focal_id: focal.id }
      });
    });
    Object.entries(listsByFocal).forEach(([focalId, lists]) => {
      const focalName = focals.find((entry) => entry.id === focalId)?.name || 'Space';
      lists.forEach((list) => {
        options.push({
          id: `list:${list.id}`,
          label: `List · ${focalName} / ${list.name}`,
          context: { focal_id: focalId, list_id: list.id }
        });
      });
    });
    const selectedListId = mobileScope.listId;
    if (selectedListId && itemsByList[selectedListId]) {
      itemsByList[selectedListId].slice(0, 40).forEach((item) => {
        const itemContext: Record<string, string> = {
          list_id: selectedListId,
          item_id: item.id
        };
        if (mobileScope.focalId) {
          itemContext.focal_id = mobileScope.focalId;
        }
        options.push({
          id: `item:${item.id}`,
          label: `Item · ${item.title}`,
          context: itemContext
        });
      });
    }
    return options;
  }, [buildMobileChatContext, focals, itemsByList, listsByFocal, mobileScope.focalId, mobileScope.listId]);

  const loadFocals = async (): Promise<void> => {
    if (!user?.id) {
      setFocals([]);
      setListsByFocal({});
      setItemsByList({});
      return;
    }
    setFocalsLoading(true);
    setFocalsError('');
    try {
      const focalRows = await focalBoardService.getFocals(user.id);
      const nextFocals = (focalRows || []).map((entry: any) => ({
        id: entry.id,
        name: entry.name,
        order_num: entry.order_num ?? 0
      }));
      setFocals(nextFocals);

      const listPairs = await Promise.all(
        nextFocals.map(async (focal: MobileFocal) => {
          const lists = await focalBoardService.getListsForFocal(focal.id);
          return [
            focal.id,
            (lists || []).map((list: any) => ({
              id: list.id,
              name: list.name,
              item_label: list.item_label || 'Items',
              action_label: list.action_label || 'Tasks'
            }))
          ] as const;
        })
      );
      setListsByFocal(Object.fromEntries(listPairs));
    } catch (error: any) {
      setFocalsError(error?.message || 'Failed to load spaces');
    } finally {
      setFocalsLoading(false);
    }
  };

  const loadDocsNotes = async (): Promise<void> => {
    if (!user?.id) {
      setDocsNotes([]);
      return;
    }
    setDocsLoading(true);
    setDocsError('');
    try {
      const rows = await docsService.getNotes({
        userId: user.id,
        archived: false,
        search: docsSearch
      });
      setDocsNotes(rows);
    } catch (error: any) {
      setDocsError(error?.message || 'Failed to load notes');
      setDocsNotes([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const loadCalendarBlocks = async (): Promise<void> => {
    if (!user?.id) {
      setBlocks([]);
      return;
    }
    try {
      const events = await calendarService.getTimeBlocks(user.id);
      const visibleEvents = (events || []);
      const contentRuleEntries = await Promise.all(
        visibleEvents.map(async (event: any) => [event.id, await calendarService.getTimeBlockContentRules(event.id)] as const)
      );
      const contentRulesByEventId = Object.fromEntries(contentRuleEntries) as Record<string, any[]>;
      const listIdsToHydrate = [...new Set(
        contentRuleEntries.flatMap(([, rules]) =>
          (rules || []).map((rule: any) => rule?.list_id).filter(Boolean)
        )
      )];
      const listRows = await Promise.all(
        listIdsToHydrate.map(async (listId) => [listId, await focalBoardService.getItemsByListId(listId)] as const)
      );
      const itemsByListId = new Map<string, any[]>(listRows);

      const dayStart = new Date(viewedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const viewedDateWeekdayKey =
        calendarService.getWeekdayKeyForOccurrence(
          new Date(viewedDate.getFullYear(), viewedDate.getMonth(), viewedDate.getDate(), 12, 0, 0, 0).toISOString(),
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver'
        ) || 'mon';
      const mapped = visibleEvents
        .filter((event: any) => {
          const start = new Date(event.start);
          const end = new Date(event.end || event.start);
          if (Number.isNaN(start.getTime())) return false;
          const safeEnd = Number.isNaN(end.getTime()) ? new Date(start.getTime() + 30 * 60 * 1000) : end;
          return start < dayEnd && safeEnd > dayStart;
        })
        .map((event: any) => ({
          id: event.id,
          name: event.title || 'Untitled',
          description: event.description || '',
          startMin: minutesFromDate(event.start),
          endMin: Math.max(minutesFromDate(event.end), minutesFromDate(event.start) + 30),
          recurrence:
            event.recurrence === 'daily' || event.recurrence === 'weekly' || event.recurrence === 'monthly'
              ? event.recurrence
              : 'none',
          items: (() => {
            const rules = (contentRulesByEventId[event.id] || []).filter(
              (rule: any) =>
                rule?.selector_type === 'all' ||
                (rule?.selector_type === 'weekday' && rule?.selector_value === viewedDateWeekdayKey)
            );
            const hydratedItems: MobileBlockItem[] = [];
            const seenItemIds = new Set<string>();
            for (const rule of rules) {
              const listId = rule?.list_id;
              const rows = listId ? (itemsByListId.get(listId) || []) : [];
              const rowById = new Map(rows.map((row: any) => [row.id, row]));
              for (const itemId of rule?.item_ids || []) {
                if (!itemId || seenItemIds.has(itemId)) continue;
                seenItemIds.add(itemId);
                const indexedList = indexedLists.find((list) => list.id === listId);
                const row = rowById.get(itemId);
                hydratedItems.push({
                  id: itemId,
                  name: row?.title || indexedList?.items.find((item) => item.id === itemId)?.title || 'Untitled',
                  description: row?.description || '',
                  focalId: indexedList?.focalId,
                  listId: listId || undefined,
                  subItems: (row?.actions || []).map((action: any) => ({
                    id: action.id,
                    name: action.title || 'Untitled subtask'
                  }))
                });
              }
            }
            return hydratedItems;
          })()
        }))
        .sort((a: MobileBlock, b: MobileBlock) => a.startMin - b.startMin);
      setBlocks(mapped);
    } catch (error) {
      console.error('Mobile calendar failed to load time blocks:', error);
      setBlocks([]);
    }
  };

  const loadListItems = async (listId: string, forceReload = false): Promise<void> => {
    if (!listId || (!forceReload && itemsByList[listId])) return;
    try {
      const rows = await focalBoardService.getItemsByListId(listId);
      const mapped: MobileItem[] = (rows || []).map((entry: any) => ({
        id: entry.id,
        title: entry.title,
        description: entry.description || '',
        status: entry.status || null,
        status_id: entry.status_id || null,
        actions: (entry.actions || []).map((action: any) => ({
          id: action.id,
          title: action.title,
          subtask_status: action.subtask_status || null,
          subtask_status_id: action.subtask_status_id || null
        }))
      }));
      setItemsByList((prev) => ({ ...prev, [listId]: mapped }));
    } catch {
      setItemsByList((prev) => ({ ...prev, [listId]: [] }));
    }
  };

  const loadStatusesForList = async (listId: string): Promise<void> => {
    if (!listId) return;
    try {
      const [itemStatuses, actionStatuses] = await Promise.all([
        focalBoardService.getLaneStatuses(listId),
        focalBoardService.getLaneSubtaskStatuses(listId)
      ]);
      setListStatusesByList((prev) => ({
        ...prev,
        [listId]: (itemStatuses || []).map((entry: any) => ({
          id: entry.id,
          key: entry.key || 'pending',
          name: entry.name || entry.key || 'To do',
          color: entry.color || undefined,
          is_default: Boolean(entry.is_default)
        }))
      }));
      setSubtaskStatusesByList((prev) => ({
        ...prev,
        [listId]: (actionStatuses || []).map((entry: any) => ({
          id: entry.id,
          key: entry.key || 'not_started',
          name: entry.name || entry.key || 'Not started',
          color: entry.color || undefined,
          is_default: Boolean(entry.is_default)
        }))
      }));
    } catch (error) {
      console.error('Failed to load list statuses for mobile list view:', error);
      setListStatusesByList((prev) => ({ ...prev, [listId]: [] }));
      setSubtaskStatusesByList((prev) => ({ ...prev, [listId]: [] }));
    }
  };

  const reorderFocalMobileToTarget = async (sourceFocalId: string, targetFocalId: string): Promise<void> => {
    const sourceIndex = focals.findIndex((entry) => entry.id === sourceFocalId);
    const targetIndex = focals.findIndex((entry) => entry.id === targetFocalId);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

    const snapshot = [...focals];
    const reordered = [...focals];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const normalized = reordered.map((entry, index) => ({ ...entry, order_num: index }));
    setFocals(normalized);
    try {
      await Promise.all(
        normalized.map((entry) =>
          focalBoardService.updateFocal(entry.id, { order_num: entry.order_num ?? 0 })
        )
      );
    } catch (error) {
      console.error('Failed to drag-reorder spaces on mobile:', error);
      setFocals(snapshot);
    }
  };

  const createMobileFocalInline = async (): Promise<void> => {
    const title = mobileNewFocalName.trim();
    if (!title || !user?.id || mobileCreatingFocal) return;
    setMobileCreatingFocal(true);
    try {
      const created = await focalBoardService.createFocal(user.id, title);
      setFocals((prev) => [...prev, created]);
      setMobileNewFocalName('');
      setShowMobileNewFocalInput(false);
    } catch (error) {
      console.error('Failed to create mobile space inline:', error);
    } finally {
      setMobileCreatingFocal(false);
    }
  };

  useEffect(() => {
    if (activeNav !== 'focals') return;
    void loadFocals();
  }, [activeNav, user?.id]);

  useEffect(() => {
    if (activeNav !== 'docs') return;
    void loadDocsNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav, user?.id, docsSearch]);

  useEffect(() => {
    if (activeNav !== 'focals') return;
    if (mobileScope.level === 'list' && mobileScope.listId) {
      void loadListItems(mobileScope.listId);
      void loadStatusesForList(mobileScope.listId);
    }
  }, [activeNav, mobileScope.level, mobileScope.listId]);

  useEffect(() => {
    if (!addSheet.open) return;
    if ((addSheet.type === 'item' || addSheet.type === 'subitem') && addSheet.listId) {
      void loadListItems(addSheet.listId);
    }
  }, [addSheet.open, addSheet.type, addSheet.listId]);

  useEffect(() => {
    if (!addSheet.open || addSheet.type !== 'item' || !addSheet.listId) {
      setAddItemFields([]);
      setAddItemFieldDrafts({});
      setAddItemStatuses([]);
      setAddItemStatusValue('');
      return;
    }
    const loadAddItemMeta = async (): Promise<void> => {
      try {
        const [fields, statuses] = await Promise.all([
          listFieldService.getFields(addSheet.listId as string),
          focalBoardService.getLaneStatuses(addSheet.listId as string)
        ]);
        const normalizedStatuses = (statuses || []).map((entry: any) => ({
          id: entry.id,
          key: entry.key || 'pending',
          name: entry.name || entry.key || 'Pending',
          is_default: Boolean(entry.is_default)
        }));
        const defaultStatus = normalizedStatuses.find((entry: any) => entry.is_default) || normalizedStatuses[0] || null;
        setAddItemStatuses(normalizedStatuses);
        setAddItemStatusValue(defaultStatus ? (defaultStatus.id || defaultStatus.key) : '');
        setAddItemFields((fields || []).filter((field: any) => !field?.is_primary));
        setAddItemFieldDrafts({});
      } catch (error) {
        console.error('Failed loading add-item metadata:', error);
        setAddItemStatuses([]);
        setAddItemStatusValue('');
        setAddItemFields([]);
        setAddItemFieldDrafts({});
      }
    };
    void loadAddItemMeta();
  }, [addSheet.open, addSheet.type, addSheet.listId]);

  useEffect(() => {
    if (!addSheet.open || (addSheet.type !== 'item' && addSheet.type !== 'event' && addSheet.type !== 'subitem')) return;
    const timer = window.setTimeout(() => addSheetNameRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [addSheet.open, addSheet.type]);

  useEffect(() => {
    if (activeNav !== 'calendar') return;
    void loadCalendarBlocks();
  }, [activeNav, user?.id, viewedDate]);

  useEffect(() => {
    const loadItemDrawerData = async (): Promise<void> => {
      if (!drawer.open || drawer.mode !== 'item' || !resolvedDrawerItem?.id) {
        setItemDrawerFields([]);
        setItemDrawerFieldValues({});
        setItemDrawerComments([]);
        return;
      }

      const listId = resolvedDrawerItem.listId || null;
      if (listId) {
        try {
          const [fields, valuesMap] = await Promise.all([
            listFieldService.getFields(listId),
            itemFieldValueService.bulkFetchForList(listId)
          ]);
          setItemDrawerFields((fields || []).filter((field: any) => field.is_pinned));
          setItemDrawerFieldValues(valuesMap?.[resolvedDrawerItem.id] || {});
        } catch (error) {
          console.error('Failed loading item drawer fields:', error);
          setItemDrawerFields([]);
          setItemDrawerFieldValues({});
        }
      } else {
        setItemDrawerFields([]);
        setItemDrawerFieldValues({});
      }

      setItemDrawerCommentsLoading(true);
      try {
        const rows = await commentsService.getItemComments(resolvedDrawerItem.id, 80);
        setItemDrawerComments(rows || []);
      } catch (error) {
        console.error('Failed loading item drawer comments:', error);
        setItemDrawerComments([]);
      } finally {
        setItemDrawerCommentsLoading(false);
      }
    };

    void loadItemDrawerData();
  }, [drawer.open, drawer.mode, resolvedDrawerItem?.id, resolvedDrawerItem?.listId]);

  useEffect(() => {
    if (view !== 'calendar' || activeNav !== 'calendar' || !isTodayView) return;
    const container = timelineScrollRef.current;
    if (!container) return;
    // Keep current-time line around ~80% viewport height on first load/view return.
    const target = Math.max(0, nowTop - container.clientHeight * 0.8);
    container.scrollTo({ top: target, behavior: 'smooth' });
  }, [view, activeNav, isTodayView, nowTop]);

  useEffect(() => {
    if (currentBlockId) {
      setUseTimeBlockContext(true);
    }
  }, [currentBlockId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = (): void => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (quickPanelOpen) return;
    if (!quickPanelMounted) return;
    const timer = window.setTimeout(() => setQuickPanelMounted(false), 430);
    return () => window.clearTimeout(timer);
  }, [quickPanelOpen, quickPanelMounted]);

  useEffect(() => {
    return () => {
      if (timelineDraftPressTimerRef.current) {
        window.clearTimeout(timelineDraftPressTimerRef.current);
        timelineDraftPressTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const persistenceUserId = user?.id ?? 'device-local';
    const state = chatPersistence.load(persistenceUserId, 60);
    setChatMessages(state.messages || []);
  }, [user?.id]);

  useEffect(() => {
    const persistenceUserId = user?.id ?? 'device-local';
    chatPersistence.save(persistenceUserId, chatMessages, 60);
  }, [chatMessages, user?.id]);

  useEffect(() => {
    if (view !== 'ai') return;
    const node = chatMessagesRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, view]);

  const onTouchStart = (event: TouchEvent): void => {
    if (timelineDraftGestureRef.current.active) return;
    if (addSheet.open || drawer.open) return;
    const touch = event.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
    setIsViewGestureDragging(false);
    setViewDragX(0);
    gestureMetaRef.current = {
      lastX: touch.clientX,
      lastY: touch.clientY,
      lastT: performance.now(),
      velocityX: 0,
      velocityY: 0
    };
  };

  const onTouchMove = (event: TouchEvent): void => {
    if (timelineDraftGestureRef.current.active) return;
    if (touchStartX == null || touchStartY == null || addSheet.open || drawer.open) return;
    const touch = event.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const now = performance.now();
    const dt = Math.max(1, now - gestureMetaRef.current.lastT);
    const vx = (touch.clientX - gestureMetaRef.current.lastX) / dt;
    const vy = (touch.clientY - gestureMetaRef.current.lastY) / dt;
    gestureMetaRef.current = {
      lastX: touch.clientX,
      lastY: touch.clientY,
      lastT: now,
      velocityX: vx,
      velocityY: vy
    };

    if (!isViewGestureDragging) {
      if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy) + 6) return;
      setIsViewGestureDragging(true);
    }

    event.preventDefault();
    if (view === 'calendar') {
      if (dx <= 0) {
        setViewDragX(Math.max(-viewportWidth, dx));
      } else {
        setViewDragX(dx * 0.2);
      }
    } else {
      if (dx >= 0) {
        setViewDragX(Math.min(viewportWidth, dx));
      } else {
        setViewDragX(dx * 0.2);
      }
    }
  };

  const onTouchEnd = (event: TouchEvent): void => {
    if (timelineDraftGestureRef.current.active) return;
    if (touchStartX == null || touchStartY == null) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const velocityX = gestureMetaRef.current.velocityX;
    if (isViewGestureDragging) {
      const dragDistance = Math.abs(viewDragX);
      const distanceThreshold = viewportWidth * 0.3;
      const velocityThreshold = 0.45;
      const shouldSwitch = dragDistance > distanceThreshold || Math.abs(velocityX) > velocityThreshold;
      if (view === 'calendar') {
        if ((viewDragX < 0 && shouldSwitch) || velocityX < -velocityThreshold) {
          setView('ai');
        }
      } else if ((viewDragX > 0 && shouldSwitch) || velocityX > velocityThreshold) {
        setView('calendar');
      }
    } else if (Math.abs(dx) > 34 && Math.abs(dy) < 68) {
      if (dx < 0 && view === 'calendar') setView('ai');
      if (dx > 0 && view === 'ai') setView('calendar');
    }
    setTouchStartX(null);
    setTouchStartY(null);
    setIsViewGestureDragging(false);
    setViewDragX(0);
  };

  const getMinuteFromTimelineClientY = (clientY: number): number => {
    const container = timelineScrollRef.current;
    if (!container) return DAY_START_MIN;
    const rect = container.getBoundingClientRect();
    const y = clientY - rect.top + container.scrollTop;
    const minute = DAY_START_MIN + y / PX_PER_MIN;
    return Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, minute));
  };

  const finalizeTimelineDraftToEvent = (): void => {
    const draft = timelineDraft;
    if (!draft) return;
    const startMin = Math.floor(Math.min(draft.startMin, draft.endMin) / 15) * 15;
    const rawEnd = Math.ceil(Math.max(draft.startMin, draft.endMin) / 15) * 15;
    const endMin = Math.max(startMin + 30, Math.min(DAY_END_MIN, rawEnd));
    openAddSheet({ open: true, type: 'event' });
    setAddSheetStart(toInputTime(startMin));
    setAddSheetEnd(toInputTime(endMin));
    setTimelineDraft(null);
  };

  const onTimelineTouchStart = (event: TouchEvent): void => {
    if (activeNav !== 'calendar' || view !== 'calendar' || addSheet.open || drawer.open) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.mobile-time-block, button, input, textarea, select')) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const startMin = getMinuteFromTimelineClientY(touch.clientY);
    timelineDraftGestureRef.current = {
      active: false,
      touchId: touch.identifier,
      startClientY: touch.clientY,
      startMin
    };
    if (timelineDraftPressTimerRef.current) {
      window.clearTimeout(timelineDraftPressTimerRef.current);
      timelineDraftPressTimerRef.current = null;
    }
    timelineDraftPressTimerRef.current = window.setTimeout(() => {
      const px = (startMin - DAY_START_MIN) * PX_PER_MIN;
      timelineDraftGestureRef.current.active = true;
      setTimelineDraft({
        startMin,
        endMin: startMin + 30,
        topPx: px,
        heightPx: Math.max(30 * PX_PER_MIN, 24)
      });
    }, 320);
  };

  const onTimelineTouchMove = (event: TouchEvent): void => {
    const gesture = timelineDraftGestureRef.current;
    if (gesture.touchId == null) return;
    const touch = Array.from(event.changedTouches).find((entry) => entry.identifier === gesture.touchId);
    if (!touch) return;

    if (!gesture.active) {
      if (Math.abs(touch.clientY - gesture.startClientY) > 10) {
        if (timelineDraftPressTimerRef.current) {
          window.clearTimeout(timelineDraftPressTimerRef.current);
          timelineDraftPressTimerRef.current = null;
        }
        timelineDraftGestureRef.current.touchId = null;
      }
      return;
    }

    event.preventDefault();
    const currentMin = getMinuteFromTimelineClientY(touch.clientY);
    const startMin = gesture.startMin;
    const topMin = Math.min(startMin, currentMin);
    const heightMin = Math.max(30, Math.abs(currentMin - startMin));
    setTimelineDraft({
      startMin,
      endMin: currentMin,
      topPx: (topMin - DAY_START_MIN) * PX_PER_MIN,
      heightPx: Math.max(heightMin * PX_PER_MIN, 24)
    });
  };

  const onTimelineTouchEnd = (event: TouchEvent): void => {
    const gesture = timelineDraftGestureRef.current;
    if (gesture.touchId == null) return;
    const touch = Array.from(event.changedTouches).find((entry) => entry.identifier === gesture.touchId);
    if (!touch) return;

    if (timelineDraftPressTimerRef.current) {
      window.clearTimeout(timelineDraftPressTimerRef.current);
      timelineDraftPressTimerRef.current = null;
    }

    const wasActive = gesture.active;
    timelineDraftGestureRef.current = {
      active: false,
      touchId: null,
      startClientY: 0,
      startMin: DAY_START_MIN
    };
    if (wasActive) {
      event.preventDefault();
      finalizeTimelineDraftToEvent();
    } else {
      setTimelineDraft(null);
    }
  };

  const onAddSheetTouchStart = (event: TouchEvent): void => {
    if (!addSheet.open) return;
    const touch = event.touches[0];
    setIsAddSheetDragging(true);
    addSheetGestureRef.current = {
      startY: touch.clientY,
      lastY: touch.clientY,
      lastT: performance.now(),
      velocityY: 0
    };
  };

  const onAddSheetTouchMove = (event: TouchEvent): void => {
    if (!isAddSheetDragging || !addSheet.open) return;
    const touch = event.touches[0];
    const dy = touch.clientY - addSheetGestureRef.current.startY;
    const now = performance.now();
    const dt = Math.max(1, now - addSheetGestureRef.current.lastT);
    const vy = (touch.clientY - addSheetGestureRef.current.lastY) / dt;
    addSheetGestureRef.current = {
      ...addSheetGestureRef.current,
      lastY: touch.clientY,
      lastT: now,
      velocityY: vy
    };
    if (dy <= 0) {
      setAddSheetDragY(dy * 0.2);
      return;
    }
    event.preventDefault();
    setAddSheetDragY(Math.min(dy, window.innerHeight * 0.85));
  };

  const onAddSheetTouchEnd = (): void => {
    if (!isAddSheetDragging) return;
    const closeByDistance = addSheetDragY > window.innerHeight * 0.18;
    const closeByVelocity = addSheetGestureRef.current.velocityY > 0.6;
    if (closeByDistance || closeByVelocity) {
      setIsAddSheetDragging(false);
      setAddSheetDragY(0);
      closeAddSheet();
      return;
    }
    setIsAddSheetDragging(false);
    setAddSheetDragY(0);
  };

  const onAddSheetPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!addSheet.open) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    addSheetPointerIdRef.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // no-op
    }
    setIsAddSheetDragging(true);
    addSheetGestureRef.current = {
      startY: event.clientY,
      lastY: event.clientY,
      lastT: performance.now(),
      velocityY: 0
    };
  };

  const onAddSheetPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!isAddSheetDragging || !addSheet.open) return;
    if (addSheetPointerIdRef.current !== event.pointerId) return;
    const dy = event.clientY - addSheetGestureRef.current.startY;
    const now = performance.now();
    const dt = Math.max(1, now - addSheetGestureRef.current.lastT);
    const vy = (event.clientY - addSheetGestureRef.current.lastY) / dt;
    addSheetGestureRef.current = {
      ...addSheetGestureRef.current,
      lastY: event.clientY,
      lastT: now,
      velocityY: vy
    };
    if (dy <= 0) {
      setAddSheetDragY(dy * 0.2);
      return;
    }
    event.preventDefault();
    setAddSheetDragY(Math.min(dy, window.innerHeight * 0.85));
  };

  const onAddSheetPointerEnd = (event: PointerEvent<HTMLDivElement>): void => {
    if (addSheetPointerIdRef.current !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // no-op
    }
    addSheetPointerIdRef.current = null;
    onAddSheetTouchEnd();
  };

  const moveDay = (delta: number): void => {
    setViewedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  };

  const dateLabel = viewedDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const openPeekDrawer = (blockId: string): void => {
    setDrawerClosing(false);
    setDrawer({ open: true, mode: 'peek', blockId });
  };
  const openFullDrawer = (blockId: string): void => {
    setDrawerClosing(false);
    setDrawer({ open: true, mode: 'full', blockId });
  };
  const openEditDrawer = (blockId: string): void => {
    setDrawerClosing(false);
    setDrawer({ open: true, mode: 'edit', blockId });
  };
  const openItemDrawer = (blockId: string, itemId: string): void => {
    setItemDrawerPanel('details');
    setItemDrawerCommentDraft('');
    setDrawerClosing(false);
    setDrawer({ open: true, mode: 'item', blockId, itemId });
  };

  const openAddSheet = (next: AddSheetState): void => {
    setAddSheetClosing(false);
    setAddSheetName('');
    setAddSheetDescription('');
    setAddItemStatuses([]);
    setAddItemStatusValue('');
    setAddItemFields([]);
    setAddItemFieldDrafts({});
    setAddSheetStart('09:00');
    setAddSheetEnd('10:00');
    setAddSheetRecurrence('none');
    setAddSheetRecurrenceExpanded(false);
    setAddSheet({
      ...next,
      focalId: next.focalId ?? mobileScope.focalId ?? focals[0]?.id ?? null,
      listId: next.listId ?? mobileScope.listId ?? null
    });
    setQuickPanelOpen(false);
    setCaptureMode('none');
  };

  const closeAddSheet = (): void => {
    setAddSheetClosing(true);
    window.setTimeout(() => {
      setAddSheet((prev) => ({ ...prev, open: false }));
      setAddSheetClosing(false);
    }, 210);
  };

  const closeDrawer = (): void => {
    setIsDrawerDragging(false);
    setDrawerDragY(0);
    setItemDrawerPanel('details');
    setItemDrawerCommentDraft('');
    setDrawerClosing(true);
    window.setTimeout(() => {
      setDrawer({ open: false, mode: 'peek', blockId: null });
      setDrawerClosing(false);
      setEditDrawerSaving(false);
    }, 220);
  };

  useEffect(() => {
    if (!drawer.open || drawer.mode !== 'edit' || !activeDrawerBlock) return;
    setEditDrawerName(activeDrawerBlock.name || '');
    setEditDrawerDescription(activeDrawerBlock.description || '');
    setEditDrawerStart(minutesToClock(activeDrawerBlock.startMin));
    setEditDrawerEnd(minutesToClock(activeDrawerBlock.endMin));
    setEditDrawerRecurrence(activeDrawerBlock.recurrence || 'none');
    setEditDrawerRecurrenceExpanded((activeDrawerBlock.recurrence || 'none') !== 'none');
  }, [activeDrawerBlock, drawer.mode, drawer.open]);

  const onDrawerTouchStart = (event: TouchEvent): void => {
    if (!drawer.open) return;
    const touch = event.touches[0];
    setIsDrawerDragging(true);
    drawerGestureRef.current = {
      startY: touch.clientY,
      lastY: touch.clientY,
      lastT: performance.now(),
      velocityY: 0
    };
  };

  const onDrawerTouchMove = (event: TouchEvent): void => {
    if (!isDrawerDragging || !drawer.open) return;
    const touch = event.touches[0];
    const dy = touch.clientY - drawerGestureRef.current.startY;
    const now = performance.now();
    const dt = Math.max(1, now - drawerGestureRef.current.lastT);
    const vy = (touch.clientY - drawerGestureRef.current.lastY) / dt;
    drawerGestureRef.current = {
      ...drawerGestureRef.current,
      lastY: touch.clientY,
      lastT: now,
      velocityY: vy
    };

    if (drawer.mode === 'peek' && dy < 0) {
      event.preventDefault();
      setDrawerDragY(Math.max(dy, -180));
      return;
    }

    if (dy > 0) {
      event.preventDefault();
      setDrawerDragY(Math.min(dy, window.innerHeight * 0.85));
      return;
    }

    setDrawerDragY(dy * 0.18);
  };

  const onDrawerTouchEnd = (): void => {
    if (!isDrawerDragging) return;
    const dy = drawerDragY;
    const vy = drawerGestureRef.current.velocityY;

    if ((dy > 180 && vy >= 0) || vy > 0.7) {
      closeDrawer();
      return;
    }

    if (drawer.mode === 'peek' && (dy < -64 || vy < -0.55)) {
      setDrawer((prev) => ({ ...prev, mode: 'full' }));
      setIsDrawerDragging(false);
      setDrawerDragY(0);
      return;
    }

    if (drawer.mode === 'full' && dy > 96 && vy > 0.25) {
      setDrawer((prev) => ({ ...prev, mode: 'peek' }));
      setIsDrawerDragging(false);
      setDrawerDragY(0);
      return;
    }

    setIsDrawerDragging(false);
    setDrawerDragY(0);
  };

  const onDrawerPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!drawer.open) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drawerPointerIdRef.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // no-op
    }
    setIsDrawerDragging(true);
    drawerGestureRef.current = {
      startY: event.clientY,
      lastY: event.clientY,
      lastT: performance.now(),
      velocityY: 0
    };
  };

  const onDrawerPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!isDrawerDragging || !drawer.open) return;
    if (drawerPointerIdRef.current !== event.pointerId) return;
    const dy = event.clientY - drawerGestureRef.current.startY;
    const now = performance.now();
    const dt = Math.max(1, now - drawerGestureRef.current.lastT);
    const vy = (event.clientY - drawerGestureRef.current.lastY) / dt;
    drawerGestureRef.current = {
      ...drawerGestureRef.current,
      lastY: event.clientY,
      lastT: now,
      velocityY: vy
    };

    if (drawer.mode === 'peek' && dy < 0) {
      event.preventDefault();
      setDrawerDragY(Math.max(dy, -180));
      return;
    }

    if (dy > 0) {
      event.preventDefault();
      setDrawerDragY(Math.min(dy, window.innerHeight * 0.85));
      return;
    }

    setDrawerDragY(dy * 0.18);
  };

  const onDrawerPointerEnd = (event: PointerEvent<HTMLDivElement>): void => {
    if (drawerPointerIdRef.current !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // no-op
    }
    drawerPointerIdRef.current = null;
    onDrawerTouchEnd();
  };

  const startLongPress = (blockId: string): void => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => openEditDrawer(blockId), 420);
  };

  const clearLongPress = (): void => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const toggleComplete = (itemId: string): void => setCompleted((prev) => ({ ...prev, [itemId]: !prev[itemId] }));

  const minutesToClock = (minutes: number): string => {
    const safe = Math.max(0, Math.min(24 * 60 - 1, Number.isFinite(minutes) ? minutes : 0));
    const hh = Math.floor(safe / 60)
      .toString()
      .padStart(2, '0');
    const mm = Math.floor(safe % 60)
      .toString()
      .padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const clockToMinutes = (value: string): number => {
    const [h, m] = value.split(':').map((entry) => Number.parseInt(entry, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return Math.max(0, Math.min(24 * 60 - 1, h * 60 + m));
  };

  const buildIsoFromViewedDate = (timeValue: string): string => {
    const minutes = clockToMinutes(timeValue);
    const next = new Date(viewedDate);
    next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return next.toISOString();
  };

  const deleteDrawerBlock = async (): Promise<void> => {
    if (!user?.id || !drawer.blockId) return;
    const targetId = drawer.blockId;
    setBlocks((prev) => prev.filter((entry) => entry.id !== targetId));
    closeDrawer();
    try {
      await calendarService.deleteTimeBlock(user.id, targetId);
    } catch (error) {
      console.error('Failed to delete mobile time block:', error);
      await loadCalendarBlocks();
    }
  };

  const saveDrawerEdits = async (): Promise<void> => {
    if (!user?.id || !drawer.blockId) return;
    const title = editDrawerName.trim();
    if (!title) return;
    let startMin = clockToMinutes(editDrawerStart);
    let endMin = clockToMinutes(editDrawerEnd);
    if (endMin <= startMin) endMin = Math.min(startMin + 30, 24 * 60 - 1);

    const patch = {
      title,
      description: editDrawerDescription.trim(),
      start_time: buildIsoFromViewedDate(minutesToClock(startMin)),
      end_time: buildIsoFromViewedDate(minutesToClock(endMin)),
      recurrence_rule: editDrawerRecurrence,
      recurrence_config:
        editDrawerRecurrence === 'none'
          ? null
          : {
              unit:
                editDrawerRecurrence === 'daily'
                  ? 'day'
                  : editDrawerRecurrence === 'weekly'
                    ? 'week'
                    : 'month',
              interval: 1,
              limitType: 'indefinite'
            }
    };

    setEditDrawerSaving(true);
    setBlocks((prev) =>
      prev.map((entry) =>
        entry.id === drawer.blockId
          ? {
              ...entry,
              name: title,
              description: editDrawerDescription,
              startMin,
              endMin,
              recurrence: editDrawerRecurrence
            }
          : entry
      )
    );
    try {
      await calendarService.patchTimeBlock(drawer.blockId, patch);
    } catch (error) {
      console.error('Failed to save mobile drawer event edits:', error);
      await loadCalendarBlocks();
    } finally {
      setEditDrawerSaving(false);
    }
  };

  const toggleBlockTaskExpansion = (blockId: string): void => {
    setExpandedTasksByBlock((prev) => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const toggleSubtaskComposer = (itemId: string): void => {
    setSubtaskComposerByItem((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const createSubtaskFromBlock = async (blockId: string, itemId: string): Promise<void> => {
    const title = (subtaskDraftByItem[itemId] || '').trim();
    if (!title || !user?.id) return;
    try {
      const created = await focalBoardService.createAction(itemId, user.id, title, null, null);
      setBlocks((prev) =>
        prev.map((block) => {
          if (block.id !== blockId) return block;
          return {
            ...block,
            items: block.items.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    subItems: [...(item.subItems || []), { id: created.id, name: created.title || title }]
                  }
                : item
            )
          };
        })
      );
      setSubtaskDraftByItem((prev) => ({ ...prev, [itemId]: '' }));
      setSubtaskComposerByItem((prev) => ({ ...prev, [itemId]: false }));
    } catch (error) {
      console.error('Failed to create subtask from mobile block:', error);
    }
  };

  const submitItemDrawerComment = async (): Promise<void> => {
    if (!user?.id || !activeDrawerItem?.id) return;
    const body = itemDrawerCommentDraft.trim();
    if (!body) return;
    setItemDrawerCommentSubmitting(true);
    try {
      const created = await commentsService.createComment(activeDrawerItem.id, user.id, body);
      setItemDrawerComments((prev) => [...prev, created]);
      setItemDrawerCommentDraft('');
    } catch (error) {
      console.error('Failed to add item comment from mobile drawer:', error);
    } finally {
      setItemDrawerCommentSubmitting(false);
    }
  };

  const getFieldDisplayValue = (field: any): string => {
    const value = itemDrawerFieldValues[field.id];
    if (!value) return '--';
    if (field.type === 'status' || field.type === 'select') {
      const option = (field.options || []).find((entry: any) => entry.id === value.option_id);
      return option?.label || '--';
    }
    if (field.type === 'text') return value.value_text || '--';
    if (field.type === 'contact') {
      const raw = String(value.value_text || '').trim();
      if (!raw) return '--';
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return raw;
        const parts = [parsed.name, parsed.phone, parsed.email, parsed.address].filter(Boolean);
        return parts.length > 0 ? parts.join(' • ') : raw;
      } catch {
        return raw;
      }
    }
    if (field.type === 'number') return value.value_number != null ? String(value.value_number) : '--';
    if (field.type === 'date') return value.value_date ? new Date(value.value_date).toLocaleDateString() : '--';
    if (field.type === 'boolean') return value.value_boolean ? 'Yes' : 'No';
    return '--';
  };

  const onItemDrawerPanelTouchStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    itemDrawerGestureRef.current = { startX: touch.clientX, startY: touch.clientY };
  };

  const onItemDrawerPanelTouchEnd = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - itemDrawerGestureRef.current.startX;
    const dy = touch.clientY - itemDrawerGestureRef.current.startY;
    if (Math.abs(dy) > 56 || Math.abs(dx) < 52) return;
    if (dx > 0) {
      setItemDrawerPanel('comments');
    } else if (dx < 0) {
      setItemDrawerPanel('details');
    }
  };

  const inferListForBlock = (blockId: string): string | null => {
    const block = blocks.find((entry) => entry.id === blockId);
    const existing = block?.items.find((item) => item.listId)?.listId || null;
    if (existing) return existing;
    return indexedLists[0]?.id || null;
  };

  const upsertBlockContentItems = async (blockId: string, listId: string, itemIds: string[]): Promise<void> => {
    if (!blockId || !listId || itemIds.length === 0) return;
    const existing = await calendarService.getTimeBlockContentRules(blockId);
    const viewedDateWeekdayKey =
      calendarService.getWeekdayKeyForOccurrence(
        new Date(viewedDate.getFullYear(), viewedDate.getMonth(), viewedDate.getDate(), 12, 0, 0, 0).toISOString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver'
      ) || 'mon';
    const matchingWeekdayRule = (existing || []).find(
      (rule: any) =>
        rule.selector_type === 'weekday' &&
        rule.selector_value === viewedDateWeekdayKey &&
        rule.list_id === listId
    );
    const matchingAllRule = (existing || []).find(
      (rule: any) => rule.selector_type === 'all' && !rule.selector_value && rule.list_id === listId
    );
    const target =
      matchingWeekdayRule ||
      matchingAllRule ||
      ((existing || []).some((rule: any) => rule.selector_type === 'weekday')
        ? { selector_type: 'weekday', selector_value: viewedDateWeekdayKey, list_id: listId }
        : { selector_type: 'all', selector_value: null, list_id: listId });
    const mergedItemIds = [...new Set([...(target?.item_ids || []), ...itemIds])];
    await calendarService.upsertTimeBlockContentRule({
      id: target?.id,
      time_block_id: blockId,
      selector_type: target?.selector_type || 'all',
      selector_value: target?.selector_type === 'weekday' ? target?.selector_value || viewedDateWeekdayKey : null,
      list_id: listId,
      item_ids: mergedItemIds
    });
  };

  const addItemsIntoBlockState = (
    blockId: string,
    entries: Array<{ id: string; title: string; listId: string | null }>
  ): void => {
    if (!entries.length) return;
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        const seen = new Set(block.items.map((item) => item.id));
        const appended = entries
          .filter((entry) => !seen.has(entry.id))
          .map((entry) => ({ id: entry.id, name: entry.title, listId: entry.listId || undefined }));
        return { ...block, items: [...block.items, ...appended] };
      })
    );
  };

  const ensureTaskDrawerIndexData = async (): Promise<void> => {
    if (!user?.id) return;
    setTaskDrawerLoading(true);
    try {
      const lists = await focalBoardService.getListsForUser(user.id);
      const grouped = (lists || []).reduce((acc: Record<string, MobileList[]>, list: any) => {
        const focalId = list?.focal_id;
        if (!focalId) return acc;
        const bucket = acc[focalId] || [];
        bucket.push({
          id: list.id,
          name: list.name,
          item_label: list.item_label || 'Items',
          action_label: list.action_label || 'Tasks'
        });
        acc[focalId] = bucket;
        return acc;
      }, {});
      setListsByFocal(grouped);
      if (!taskDrawerListId && lists?.[0]?.id) {
        setTaskDrawerListId(lists[0].id);
      }

      const missingListIds = (lists || [])
        .map((entry: any) => entry.id)
        .filter((listId: string) => !itemsByList[listId]);

      if (missingListIds.length > 0) {
        const fetched = await Promise.all(
          missingListIds.map(async (listId: string) => {
            const rows = await focalBoardService.getItemsByListId(listId);
            const mapped: MobileItem[] = (rows || []).map((entry: any) => ({
              id: entry.id,
              title: entry.title,
              actions: (entry.actions || []).map((action: any) => ({ id: action.id, title: action.title }))
            }));
            return [listId, mapped] as const;
          })
        );
        setItemsByList((prev) => ({ ...prev, ...Object.fromEntries(fetched) }));
      }
    } catch (error) {
      console.error('Task drawer failed to hydrate list/item index:', error);
    } finally {
      setTaskDrawerLoading(false);
    }
  };

  const openAddTaskDrawer = (blockId: string): void => {
    setDrawerClosing(false);
    setTaskDrawerSearch('');
    setTaskDrawerPendingKey(null);
    setTaskDrawerListId(inferListForBlock(blockId));
    setTaskDrawerExpandedFocals({});
    setTaskDrawerExpandedLists({});
    setDrawer({ open: true, mode: 'addTask', blockId });
    void ensureTaskDrawerIndexData();
  };

  const attachExistingItemToBlock = async (blockId: string, item: { id: string; title: string; listId: string }): Promise<void> => {
    setTaskDrawerPendingKey(`item:${item.id}`);
    try {
      await upsertBlockContentItems(blockId, item.listId, [item.id]);
      addItemsIntoBlockState(blockId, [{ id: item.id, title: item.title, listId: item.listId }]);
      setItemsByList((prev) => {
        if ((prev[item.listId] || []).some((entry) => entry.id === item.id)) return prev;
        return {
          ...prev,
          [item.listId]: [...(prev[item.listId] || []), { id: item.id, title: item.title, actions: [] }]
        };
      });
      void loadCalendarBlocks();
    } finally {
      setTaskDrawerPendingKey(null);
    }
  };

  const createNewTaskFromDrawer = async (blockId: string): Promise<void> => {
    const title = taskDrawerSearch.trim();
    if (!title || !user?.id) return;
    setTaskDrawerPendingKey('create');
    let chosenListId = taskDrawerListId;
    try {
      if (!chosenListId) {
        chosenListId = indexedLists[0]?.id || null;
        if (chosenListId) {
          setTaskDrawerListId(chosenListId);
        }
      }
      if (!chosenListId) {
        return;
      }
      let created: any = null;
      created = await focalBoardService.createItem(chosenListId, user.id, title);
      if (!created?.id) return;
      if (chosenListId) {
        await upsertBlockContentItems(blockId, chosenListId, [created.id]);
      }
      addItemsIntoBlockState(blockId, [{ id: created.id, title: created.title || title, listId: chosenListId || null }]);
      setItemsByList((prev) => ({
        ...prev,
        [chosenListId as string]: [
          ...(prev[chosenListId as string] || []),
          {
            id: created.id,
            title: created.title || title,
            actions: []
          }
        ]
      }));
      setTaskDrawerSearch('');
      void loadCalendarBlocks();
    } finally {
      setTaskDrawerPendingKey(null);
    }
  };

  const quickAddToCurrent = (): void => {
    if (!currentBlockId) return;
    openAddTaskDrawer(currentBlockId);
    setActiveNav('calendar');
    setQuickPanelOpen(false);
  };

  const quickAddCalendarEvent = (): void => {
    openAddSheet({ open: true, type: 'event' });
  };

  const renderBlockItemRows = (blockId: string, items: MobileBlockItem[], emptyLabel = 'No attached items yet.') => {
    const orderedItems = dedupeMobileBlockItems(sortMobileBlockItems(items, completed));
    if (!orderedItems.length) {
      return <div className="mobile-drawer-empty">{emptyLabel}</div>;
    }

    return (
      <div className="mobile-drawer-linked-list actionable">
        {orderedItems.map((item) => (
          <div key={item.id} className="mobile-item-row">
            <button
              type="button"
              className={`mobile-item-check ${completed[item.id] ? 'done' : 'todo'}`.trim()}
              onClick={(event) => {
                event.stopPropagation();
                toggleComplete(item.id);
              }}
              aria-label={completed[item.id] ? 'Mark not done' : 'Mark done'}
            >
              {completed[item.id] ? <CheckCircle2 size={20} /> : <span className="mobile-status-ring" />}
            </button>
            <button
              type="button"
              className="mobile-item-text"
              onClick={(event) => {
                event.stopPropagation();
                openItemDrawer(blockId, item.id);
              }}
            >
              <div className="mobile-item-main">
                <span className="mobile-item-label">{item.name}</span>
              </div>
            </button>
            <button
              type="button"
              className="mobile-item-subtask-toggle"
              aria-label="Add subtask"
              onClick={(event) => {
                event.stopPropagation();
                toggleSubtaskComposer(item.id);
              }}
            >
              +
            </button>
            {item.subItems && item.subItems.length > 0 && (
              <div className="mobile-subitems">
                {item.subItems.map((subItem) => (
                  <div key={subItem.id} className="mobile-item-subrow">
                    <button
                      type="button"
                      className={`mobile-item-check sub ${completed[subItem.id] ? 'done' : 'todo'}`.trim()}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleComplete(subItem.id);
                      }}
                      aria-label={completed[subItem.id] ? 'Mark subtask not done' : 'Mark subtask done'}
                    >
                      {completed[subItem.id] ? <CheckCircle2 size={17} /> : <span className="mobile-status-ring small" />}
                    </button>
                    <button
                      type="button"
                      className="mobile-item-subtext"
                      onClick={(event) => {
                        event.stopPropagation();
                        openItemDrawer(blockId, item.id);
                      }}
                    >
                      <div className="mobile-item-sub">↳ {subItem.name}</div>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {subtaskComposerByItem[item.id] && (
              <div className="mobile-item-subtask-composer">
                <input
                  type="text"
                  value={subtaskDraftByItem[item.id] || ''}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    setSubtaskDraftByItem((prev) => ({
                      ...prev,
                      [item.id]: event.target.value
                    }))
                  }
                  placeholder="Add subtask"
                />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void createSubtaskFromBlock(blockId, item.id);
                  }}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const getContextualAddSpec = (): { label: string; icon: any } => {
    if (activeNav === 'calendar') return { label: 'Time Block', icon: CalendarPlus };
    if (activeNav === 'docs') return { label: 'Note +', icon: FileText };
    if (mobileScope.level === 'focals') return { label: 'Space +', icon: Mountains };
    if (mobileScope.level === 'focal') return { label: 'List +', icon: Folder };
    return { label: 'Item +', icon: CheckSquare };
  };

  const quickAddByContext = async (): Promise<void> => {
    setQuickPanelOpen(false);
    if (activeNav === 'calendar') {
      quickAddCalendarEvent();
      return;
    }
    if (activeNav === 'docs') {
      openAddSheet({ open: true, type: 'doc' });
      return;
    }
    await handleScopedAdd();
  };

  const openFocal = (focalId: string): void => {
    setMobileScope({ level: 'focal', focalId, listId: null });
  };

  const openList = (focalId: string, listId: string): void => {
    setMobileScope({ level: 'list', focalId, listId });
  };

  const navigateToParent = (): void => {
    if (mobileScope.level === 'list') {
      setMobileScope((prev) => ({ ...prev, level: 'focal', listId: null }));
      return;
    }
    if (mobileScope.level === 'focal') {
      setMobileScope({ level: 'focals', focalId: null, listId: null });
    }
  };

  const handleScopedAdd = async (): Promise<void> => {
    if (mobileScope.level === 'focals') {
      openAddSheet({ open: true, type: 'space' });
      return;
    }
    if (mobileScope.level === 'focal' && mobileScope.focalId) {
      openAddSheet({ open: true, type: 'list', focalId: mobileScope.focalId });
      return;
    }
    if (mobileScope.level === 'list' && mobileScope.listId) {
      openAddSheet({
        open: true,
        type: 'item',
        focalId: mobileScope.focalId,
        listId: mobileScope.listId
      });
    }
  };

  const handleQuickAddListInSpace = async (focalId: string): Promise<void> => {
    openAddSheet({ open: true, type: 'list', focalId });
  };

  const handleAddSubItem = async (itemId: string): Promise<void> => {
    if (!mobileScope.listId) return;
    openAddSheet({
      open: true,
      type: 'subitem',
      focalId: mobileScope.focalId,
      listId: mobileScope.listId,
      itemId
    });
  };

  const handleStatusToggle = async (itemId: string, entityType: 'item' | 'action' = 'item'): Promise<void> => {
    if (!mobileScope.listId) {
      setCompleted((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
      return;
    }
    const listId = mobileScope.listId;
    const statusSet = entityType === 'item' ? (listStatusesByList[listId] || []) : (subtaskStatusesByList[listId] || []);
    if (statusSet.length === 0) {
      setCompleted((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
      return;
    }

    const getCurrentKey = (): string | null => {
      const listItems = itemsByList[listId] || [];
      if (entityType === 'item') {
        const row = listItems.find((entry) => entry.id === itemId);
        if (!row) return null;
        const byId = row.status_id ? statusSet.find((entry) => entry.id === row.status_id) : null;
        return byId?.key || row.status || null;
      }
      for (const row of listItems) {
        const action = (row.actions || []).find((entry) => entry.id === itemId);
        if (!action) continue;
        const byId = action.subtask_status_id ? statusSet.find((entry) => entry.id === action.subtask_status_id) : null;
        return byId?.key || action.subtask_status || null;
      }
      return null;
    };

    const currentKey = getCurrentKey();
    const currentIndex = Math.max(0, statusSet.findIndex((entry) => entry.key === currentKey));
    const nextStatus = statusSet[(currentIndex + 1) % statusSet.length] || statusSet[0];

    setItemsByList((prev) => {
      const listItems = prev[listId] || [];
      const nextItems = listItems.map((row) => {
        if (entityType === 'item' && row.id === itemId) {
          return {
            ...row,
            status: nextStatus.key,
            status_id: nextStatus.id || null
          };
        }
        if (entityType === 'action' && (row.actions || []).some((entry) => entry.id === itemId)) {
          return {
            ...row,
            actions: (row.actions || []).map((entry) =>
              entry.id === itemId
                ? {
                    ...entry,
                    subtask_status: nextStatus.key,
                    subtask_status_id: nextStatus.id || null
                  }
                : entry
            )
          };
        }
        return row;
      });
      return { ...prev, [listId]: nextItems };
    });

    try {
      if (entityType === 'item') {
        await focalBoardService.updateItem(itemId, {
          status: nextStatus.key,
          status_id: nextStatus.id || null
        });
      } else {
        await focalBoardService.updateAction(itemId, {
          subtask_status: nextStatus.key,
          subtask_status_id: nextStatus.id || null
        });
      }
    } catch (error) {
      console.error('Failed updating status from mobile list view:', error);
      await loadListItems(listId, true);
    }
  };

  const openItemDrawerForItem = (itemId: string): void => {
    setItemDrawerPanel('details');
    setItemDrawerCommentDraft('');
    setDrawerClosing(false);
    setDrawer({ open: true, mode: 'item', blockId: null, itemId });
  };

  const toggleItemExpansion = (itemId: string): void => {
    setExpandedItemsInList((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const submitAddSheet = async (): Promise<void> => {
    if (!user?.id) return;
    const name = addSheetName.trim();
    if (!name) return;

    try {
      if (addSheet.type === 'space') {
        await focalBoardService.createFocal(user.id, name);
        await loadFocals();
      } else if (addSheet.type === 'list' && addSheet.focalId) {
        await focalBoardService.createLane(addSheet.focalId, user.id, name, 'Items', 'Tasks');
        await loadFocals();
      } else if (addSheet.type === 'item' && addSheet.listId) {
        const created = await focalBoardService.createItem(addSheet.listId, user.id, name, addSheetDescription.trim() || null);
        if (created?.id) {
          const chosenStatus = addItemStatuses.find((entry) => (entry.id || entry.key) === addItemStatusValue) || null;
          if (chosenStatus) {
            await focalBoardService.updateItem(created.id, {
              status: chosenStatus.key || 'pending',
              status_id: chosenStatus.id ?? null
            });
          }
          for (const field of addItemColumnFields) {
            const raw = (addItemFieldDrafts[field.id] || '').trim();
            if (!raw) continue;
            if (field.type === 'text' || field.type === 'contact') {
              await itemFieldValueService.upsertValue(user.id, created.id, field.id, { value_text: raw });
              continue;
            }
            if (field.type === 'number') {
              const normalized = raw.replace(/\+/g, '');
              const parsed = Number.parseFloat(normalized);
              if (Number.isFinite(parsed)) {
                await itemFieldValueService.upsertValue(user.id, created.id, field.id, { value_number: parsed });
              }
              continue;
            }
            if (field.type === 'date') {
              const iso = new Date(`${raw}T00:00:00`).toISOString();
              await itemFieldValueService.upsertValue(user.id, created.id, field.id, { value_date: iso });
              continue;
            }
            if (field.type === 'boolean') {
              await itemFieldValueService.upsertValue(user.id, created.id, field.id, { value_boolean: raw === 'true' });
              continue;
            }
            if (field.type === 'select' && raw) {
              await itemFieldValueService.upsertValue(user.id, created.id, field.id, { option_id: raw });
            }
          }
        }
        // Clear cache and force reload
        setItemsByList((prev) => {
          const next = { ...prev };
          delete next[addSheet.listId as string];
          return next;
        });
        // Force reload by calling loadListItems after state update
        setTimeout(() => {
          void loadListItems(addSheet.listId as string, true);
        }, 0);
      } else if (addSheet.type === 'subitem' && addSheet.itemId && addSheet.listId) {
        await focalBoardService.createAction(addSheet.itemId, user.id, name);
        // Clear cache and force reload
        setItemsByList((prev) => {
          const next = { ...prev };
          delete next[addSheet.listId as string];
          return next;
        });
        // Force reload by calling loadListItems after state update
        setTimeout(() => {
          void loadListItems(addSheet.listId as string, true);
        }, 0);
      } else if (addSheet.type === 'event') {
        const base = new Date(viewedDate);
        const [startHour, startMinute] = addSheetStart.split(':').map((v) => Number(v));
        const [endHour, endMinute] = addSheetEnd.split(':').map((v) => Number(v));
        base.setHours(startHour || 0, startMinute || 0, 0, 0);
        const end = new Date(viewedDate);
        end.setHours(endHour || 0, endMinute || 0, 0, 0);
        if (end <= base) {
          end.setTime(base.getTime() + 60 * 60 * 1000);
        }
        const createdEvent = await calendarService.upsertTimeBlock(user.id, {
          title: name,
          description: addSheetDescription.trim(),
          start: base.toISOString(),
          end: end.toISOString(),
          recurrence: addSheetRecurrence,
          recurrenceConfig:
            addSheetRecurrence === 'none'
              ? null
              : {
                  unit: addSheetRecurrence === 'daily' ? 'day' : addSheetRecurrence === 'weekly' ? 'week' : 'month',
                  interval: 1,
                  limitType: 'indefinite'
                },
          includeWeekends: true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver',
          tags: []
        });

        const dayStart = new Date(viewedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const createdStart = new Date(createdEvent.start);
        const createdEnd = new Date(createdEvent.end || createdEvent.start);
        const safeCreatedEnd = Number.isNaN(createdEnd.getTime()) ? new Date(createdStart.getTime() + 30 * 60 * 1000) : createdEnd;

        if (!Number.isNaN(createdStart.getTime()) && createdStart < dayEnd && safeCreatedEnd > dayStart) {
          setBlocks((prev) =>
            [...prev.filter((block) => block.id !== createdEvent.id), {
              id: createdEvent.id,
              name: createdEvent.title || 'Untitled',
              startMin: minutesFromDate(createdEvent.start),
              endMin: Math.max(minutesFromDate(createdEvent.end), minutesFromDate(createdEvent.start) + 30),
              recurrence:
                createdEvent.recurrence === 'daily' ||
                createdEvent.recurrence === 'weekly' ||
                createdEvent.recurrence === 'monthly'
                  ? createdEvent.recurrence
                  : 'none',
              items: []
            }].sort((a, b) => a.startMin - b.startMin)
          );
        }

        await loadCalendarBlocks();
        closeAddSheet();
        setAddSheetName('');
        setAddSheetDescription('');
        setAddItemFields([]);
        setAddItemFieldDrafts({});
        setAddItemStatuses([]);
        setAddItemStatusValue('');
        openAddTaskDrawer(createdEvent.id);
        return;
      } else if (addSheet.type === 'doc') {
        const body = addSheetDescription.trim() || addSheetName.trim();
        const title = addSheetName.trim() || body.split('\n')[0]?.trim() || 'Untitled note';
        await docsService.createNote({
          userId: user.id,
          title,
          body,
          source: 'quick_text',
          originContext: buildMobileChatContext()
        });
        await loadDocsNotes();
      }
      closeAddSheet();
      setAddSheetName('');
      setAddSheetDescription('');
      setAddItemFields([]);
      setAddItemFieldDrafts({});
      setAddItemStatuses([]);
      setAddItemStatusValue('');
    } catch (error) {
      console.error('Mobile add sheet submit failed:', error);
      // keep the sheet open so user can retry
    }
  };

  const sendMobileChat = async (): Promise<void> => {
    const content = chatDraft.trim();
    if (!content || chatSending) return;
    setChatSending(true);
    setChatDraft('');
    try {
      const userMessage: ChatMessage = {
        id: makeId(),
        role: 'user',
        content,
        created_at: Date.now()
      };
      setChatMessages((prev) => [...prev, userMessage]);

      const payloadMessages = [...chatMessages, userMessage]
        .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
        .slice(-24)
        .map((entry) => ({ role: entry.role, content: entry.content }));

      const reply = await chatService.send({
        messages: payloadMessages,
        context: buildMobileChatContext(),
        mode: mobileMemoMode ? 'memo' : 'ai'
      });

      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: reply.text || 'No response generated.',
        created_at: Date.now(),
        proposals: reply.proposals || []
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: 'I could not process that request right now. Please try again.',
        created_at: Date.now()
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    if (!mobileChatSourceMenuOpen) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!mobileSourceMenuRef.current) return;
      if (!mobileSourceMenuRef.current.contains(event.target as Node)) {
        setMobileChatSourceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [mobileChatSourceMenuOpen]);

  const selectedMobileSourceLabel =
    mobileChatSourceId === 'current'
      ? 'Current'
      : mobileChatSourceOptions.find((option) => option.id === mobileChatSourceId)?.label || 'Current';

  const handleSelectMobileChatSource = (option: MobileChatSourceOption): void => {
    setMobileChatSourceId(option.id);
    setMobileChatSourceContext(option.id === 'current' ? null : option.context);
    setMobileChatSourceMenuOpen(false);
  };

  const handleChatKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMobileChat();
    }
  };

  const applyMobileProposalMutation = async (
    proposal: ChatProposal,
    noteOverride: string | null
  ): Promise<string> => {
    if (!user?.id) throw new Error('User not signed in');
    await focalBoardService.applyChatProposalAtomic({
      userId: user.id,
      proposal,
      noteOverride,
      idempotencyKey: proposal.id
    });
    await loadCalendarBlocks();
    return proposal.type === 'resolve_time_conflict' ? proposal.event_title : proposal.title;
  };

  const handleApproveMobileProposal = async (proposal: ChatProposal): Promise<void> => {
    if (!user?.id || applyingMobileProposalId) return;
    setApplyingMobileProposalId(proposal.id);
    try {
      const noteOverride = (mobileProposalNotes[proposal.id] || '').trim() || null;
      const appliedTitle = await applyMobileProposalMutation(proposal, noteOverride);

      setApprovedMobileProposalIds((prev) => ({ ...prev, [proposal.id]: true }));
      setMobileProposalNotes((prev) => {
        const next = { ...prev };
        delete next[proposal.id];
        return next;
      });
      setChatMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          content: `Applied: ${appliedTitle}.`,
          created_at: Date.now()
        }
      ]);
    } catch (error: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          content: 'I could not apply that update safely right now. Nothing was partially applied.',
          created_at: Date.now()
        }
      ]);
    } finally {
      setApplyingMobileProposalId(null);
    }
  };

  useEffect(() => {
    return () => {
      stopVoiceAnimation();
    };
  }, []);

  const persistCaptureToDocs = async (
    content: string,
    source: 'quick_text' | 'quick_voice'
  ): Promise<void> => {
    if (!user?.id) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    try {
      const now = new Date();
      const prefix = source === 'quick_voice' ? 'Voice note' : 'Quick note';
      const title = `${prefix} • ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
      await docsService.createNote({
        userId: user.id,
        title,
        body: trimmed,
        source,
        originContext: buildMobileChatContext()
      });
      if (activeNav === 'docs') {
        await loadDocsNotes();
      }
    } catch (error) {
      console.error('Failed to persist capture note to notes:', error);
    }
  };

  const stopVoiceAnimation = (): void => {
    if (voiceRafRef.current) {
      cancelAnimationFrame(voiceRafRef.current);
      voiceRafRef.current = null;
    }
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.onresult = null;
      speechRecognitionRef.current.onerror = null;
      speechRecognitionRef.current.onend = null;
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // no-op
      }
      speechRecognitionRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    analyserRef.current = null;
    setVoiceRecording(false);
    setVoiceBars([8, 14, 10, 16, 11, 13, 9, 15]);
  };

  const startVoiceCapture = async (): Promise<void> => {
    setCaptureInputMode('voice');
    setCaptureMode('text');
    setQuickPanelOpen(false);
    setVoiceTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const animateBars = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(bins);
        const segment = Math.max(1, Math.floor(bins.length / 8));
        const nextBars = Array.from({ length: 8 }, (_, idx) => {
          const start = idx * segment;
          const end = Math.min(bins.length, start + segment);
          const slice = bins.slice(start, end);
          const avg = slice.length ? slice.reduce((sum, value) => sum + value, 0) / slice.length : 0;
          return 6 + Math.round((avg / 255) * 26);
        });
        setVoiceBars(nextBars);
        voiceRafRef.current = requestAnimationFrame(animateBars);
      };
      voiceRafRef.current = requestAnimationFrame(animateBars);
      setVoiceRecording(true);

      const SpeechCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechCtor) {
        const recognition = new SpeechCtor();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i += 1) {
            transcript += event.results[i][0]?.transcript || '';
          }
          setVoiceTranscript(transcript.trim());
        };
        recognition.onerror = () => {
          stopVoiceAnimation();
        };
        recognition.onend = () => {
          stopVoiceAnimation();
        };
        speechRecognitionRef.current = recognition;
        recognition.start();
      }
    } catch {
      setCaptureMode('none');
      stopVoiceAnimation();
    }
  };

  const openUnifiedCapture = (mode: 'text' | 'voice'): void => {
    setCaptureInputMode(mode);
    setCaptureMode('text');
    setQuickPanelOpen(false);
    if (mode === 'voice') {
      void startVoiceCapture();
      return;
    }
    stopVoiceAnimation();
    window.setTimeout(() => textCaptureRef.current?.focus(), 30);
  };

  const submitTextCapture = async (): Promise<void> => {
    const text = captureInputMode === 'voice' ? voiceTranscript.trim() : textCaptureDraft.trim();
    if (!text) return;
    setTextCaptureDraft('');
    setVoiceTranscript('');
    stopVoiceAnimation();
    setCaptureMode('none');
    await persistCaptureToDocs(text, 'quick_text');
    setCaptureDismissedProposalIds({});
    setCaptureConfirmation({
      open: true,
      text,
      aiText: '',
      proposals: [],
      routing: true,
      error: null
    });
    void routeCaptureNow(text);
  };

  const routeCaptureNow = async (captureText?: string): Promise<void> => {
    const text = (captureText ?? captureConfirmation.text).trim();
    if (!text || chatSending) return;
    setCaptureConfirmation((prev) => ({ ...prev, routing: true, error: null }));
    setChatSending(true);
    try {
      const userMessage: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: text,
        created_at: Date.now()
      };
      setChatMessages((prev) => [...prev, userMessage]);
      const payloadMessages = [...chatMessages, userMessage]
        .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
        .slice(-24)
        .map((entry) => ({ role: entry.role, content: entry.content }));
      const reply = await chatService.send({
        messages: payloadMessages,
        context: buildMobileChatContext(),
        mode: mobileMemoMode ? 'memo' : 'ai'
      });
      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: reply.text || 'No response generated.',
        created_at: Date.now(),
        proposals: reply.proposals || []
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
      setCaptureConfirmation((prev) => ({
        ...prev,
        open: true,
        text,
        aiText: reply.text || 'No response generated.',
        proposals: reply.proposals || [],
        routing: false,
        error: null
      }));
    } catch {
      setCaptureConfirmation((prev) => ({
        ...prev,
        routing: false,
        error: 'AI analysis failed. You can review this in AI.'
      }));
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => () => {
    if (captureConfirmTimerRef.current) {
      window.clearTimeout(captureConfirmTimerRef.current);
    }
  }, []);

  const renderCalendarHeader = (): JSX.Element => (
    <header className="mobile-wireframe-header">
      <div className="mobile-header-settings-wrap">
        <button
          type="button"
          className="mobile-wireframe-menu-btn icon-only"
          aria-label="Settings"
          onClick={(event) => {
            event.stopPropagation();
            setSettingsOpen((prev) => !prev);
          }}
        >
          <Settings size={20} />
        </button>
        <div className={`mobile-settings-slideout ${settingsOpen ? 'open' : ''}`.trim()} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="mobile-settings-action" aria-label="Open profile settings" onClick={() => setSettingsOpen(false)}>
            <UserCircle size={17} />
          </button>
          <button type="button" className="mobile-settings-action" aria-label="Open page settings" onClick={() => setSettingsOpen(false)}>
            <SlidersHorizontal size={17} />
          </button>
        </div>
      </div>
      <div className="mobile-date-pill">{dateLabel}</div>
      <div className="mobile-day-nav">
        <button type="button" aria-label="Previous day" onClick={() => moveDay(-1)}>
          <ChevronLeft size={16} />
        </button>
        <button type="button" aria-label="Next day" onClick={() => moveDay(1)}>
          <ChevronRight size={16} />
        </button>
      </div>
    </header>
  );

  const renderFocalsHeader = (): JSX.Element => (
    <header className="mobile-wireframe-header mobile-focals-header">
      <div className="mobile-focals-title-wrap">
        {activeNav === 'focals' && mobileScope.level !== 'focals' && (
          <button type="button" className="mobile-focals-back" onClick={navigateToParent} aria-label="Back to parent">
            <ArrowLeft size={15} />
          </button>
        )}
        {activeNav === 'docs' ? (
          <button
            type="button"
            className="mobile-focals-back"
            aria-label="Toggle note search"
            onClick={() => setDocsSearchOpen((prev) => !prev)}
          >
            <Search size={15} />
          </button>
        ) : (
          (activeNav !== 'focals' || mobileScope.level === 'focals') && <span className="mobile-focals-back-spacer" />
        )}
        <div className="mobile-date-pill">{scopeTitle}</div>
        {activeNav === 'focals' && mobileScope.level === 'focals' ? (
          <button
            type="button"
            className="mobile-focals-add-space"
            aria-label="Add space"
            onClick={() => setShowMobileNewFocalInput((prev) => !prev)}
          >
            <Plus size={14} />
          </button>
        ) : (
          <span className="mobile-focals-add-spacer" />
        )}
      </div>
      <div className="mobile-header-settings-wrap">
        <div className={`mobile-settings-slideout ${settingsOpen ? 'open' : ''}`.trim()} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="mobile-settings-action" aria-label="Open profile settings" onClick={() => setSettingsOpen(false)}>
            <UserCircle size={17} />
          </button>
          <button type="button" className="mobile-settings-action" aria-label="Open page settings" onClick={() => setSettingsOpen(false)}>
            <SlidersHorizontal size={17} />
          </button>
        </div>
        <button
          type="button"
          className="mobile-wireframe-menu-btn icon-only"
          aria-label="Settings"
          onClick={(event) => {
            event.stopPropagation();
            setSettingsOpen((prev) => !prev);
          }}
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );

  const renderDocsBody = (): JSX.Element => (
    <div className="mobile-focals-surface docs">
      {docsSearchOpen && (
        <div className="mobile-docs-search-wrap drop">
          <input
            type="text"
            placeholder="Search notes"
            value={docsSearch}
            onChange={(event) => setDocsSearch(event.target.value)}
          />
        </div>
      )}
      {docsError && <article className="mobile-focal-card muted"><p>{docsError}</p></article>}
      {docsLoading && <article className="mobile-focal-card muted"><p>Loading notes…</p></article>}
      {!docsLoading && !docsError && docsNotes.length === 0 && (
        <article className="mobile-focal-card muted"><p>No notes yet. Use quick capture to add one.</p></article>
      )}
      {!docsLoading &&
        !docsError &&
        docsNotes.map((note) => (
          <article
            key={note.id}
            className="mobile-focal-card mobile-doc-note"
            onClick={() => {
              setActiveNoteEditor(note);
              setNoteEditorTitle(note.title || 'Untitled note');
              setNoteEditorBody(note.body || '');
            }}
          >
            <header>
              <h3>{note.title}</h3>
              <span>{new Date(note.created_at).toLocaleDateString()}</span>
            </header>
            <p>{note.body}</p>
            <div className="mobile-doc-note-meta">
              <span>
                {note.source === 'quick_text'
                  ? 'Quick Text'
                  : note.source === 'quick_voice'
                    ? 'Quick Voice'
                    : note.source === 'memo'
                      ? 'Memo'
                      : 'AI'}
              </span>
            </div>
          </article>
        ))}
    </div>
  );

  const renderFocalsBody = (): JSX.Element => {
    if (focalsLoading) {
      return (
        <div className="mobile-focals-surface">
          <article className="mobile-focal-card muted"><p>Loading spaces…</p></article>
        </div>
      );
    }

    if (focalsError) {
      return (
        <div className="mobile-focals-surface">
          <article className="mobile-focal-card muted"><p>{focalsError}</p></article>
        </div>
      );
    }

    if (mobileScope.level === 'focals') {
      return (
        <div className="mobile-focals-surface">
          {focals.map((focal) => {
            const lists = listsByFocal[focal.id] || [];
            return (
              <article
                key={focal.id}
                className={`mobile-focal-card ${mobileDraggingFocalId === focal.id ? 'dragging' : ''}`.trim()}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', focal.id);
                  setMobileDraggingFocalId(focal.id);
                }}
                onDragEnd={() => setMobileDraggingFocalId(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId = event.dataTransfer.getData('text/plain');
                  if (!sourceId) return;
                  void reorderFocalMobileToTarget(sourceId, focal.id);
                  setMobileDraggingFocalId(null);
                }}
                onClick={() => openFocal(focal.id)}
              >
                <header>
                  <h3>{focal.name}</h3>
                  <div className="mobile-focal-card-actions">
                    <span>{lists.length} list{lists.length === 1 ? '' : 's'}</span>
                    <button
                      type="button"
                      className="mobile-focal-inline-add"
                      aria-label={`Add list in ${focal.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleQuickAddListInSpace(focal.id);
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </header>
              </article>
            );
          })}
          {showMobileNewFocalInput && (
            <article className="mobile-focal-card mobile-focal-card-input">
              <input
                type="text"
                value={mobileNewFocalName}
                onChange={(event) => setMobileNewFocalName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void createMobileFocalInline();
                  }
                  if (event.key === 'Escape') {
                    setShowMobileNewFocalInput(false);
                    setMobileNewFocalName('');
                  }
                }}
                disabled={mobileCreatingFocal}
                placeholder={mobileCreatingFocal ? 'Creating…' : 'Space name'}
                className="mobile-focal-inline-input"
                autoFocus
              />
            </article>
          )}
          {focals.length === 0 && <article className="mobile-focal-card muted"><p>No spaces yet. Tap + to add one.</p></article>}
        </div>
      );
    }

    if (mobileScope.level === 'focal' && mobileScope.focalId) {
      const lists = listsByFocal[mobileScope.focalId] || [];
      return (
        <div className="mobile-focals-surface">
          {lists.map((list) => (
            <article key={list.id} className="mobile-focal-card" onClick={() => openList(mobileScope.focalId as string, list.id)}>
              <header>
                <h3>{list.name}</h3>
                <span>{list.item_label || 'Items'} / {list.action_label || 'Tasks'}</span>
              </header>
            </article>
          ))}
          {lists.length === 0 && <article className="mobile-focal-card muted"><p>No lists yet. Tap + to add one.</p></article>}
        </div>
      );
    }

    if (mobileScope.level === 'list' && mobileScope.listId) {
      const items = itemsByList[mobileScope.listId] || [];
      const itemStatuses = listStatusesByList[mobileScope.listId] || [];
      const subtaskStatuses = subtaskStatusesByList[mobileScope.listId] || [];
      const statusById = new Map(itemStatuses.filter((entry) => Boolean(entry.id)).map((entry) => [entry.id as string, entry]));
      const subtaskStatusById = new Map(subtaskStatuses.filter((entry) => Boolean(entry.id)).map((entry) => [entry.id as string, entry]));
      const defaultItemStatus = itemStatuses.find((entry) => entry.is_default) || itemStatuses[0] || null;
      const defaultSubtaskStatus = subtaskStatuses.find((entry) => entry.is_default) || subtaskStatuses[0] || null;
      const getItemStatusEntry = (item: MobileItem) => {
        if (item.status_id && statusById.has(item.status_id)) return statusById.get(item.status_id) || null;
        if (item.status) return itemStatuses.find((entry) => entry.key === item.status) || null;
        return defaultItemStatus;
      };
      const getActionStatusEntry = (action: { subtask_status?: string | null; subtask_status_id?: string | null }) => {
        if (action.subtask_status_id && subtaskStatusById.has(action.subtask_status_id)) {
          return subtaskStatusById.get(action.subtask_status_id) || null;
        }
        if (action.subtask_status) return subtaskStatuses.find((entry) => entry.key === action.subtask_status) || null;
        return defaultSubtaskStatus;
      };
      const isDashedStatus = (status: { key?: string | null } | null): boolean =>
        !status || /(pending|todo|not_started|needs_action)/i.test(status.key || '');
      const itemSections =
        itemStatuses.length > 0
          ? [
              ...itemStatuses.map((status) => ({
                id: status.id || status.key,
                label: status.name || status.key,
                items: items.filter((item) => (getItemStatusEntry(item)?.key || '') === status.key)
              })),
              {
                id: '__no_status__',
                label: 'No status',
                items: items.filter((item) => !getItemStatusEntry(item))
              }
            ].filter((section) => section.items.length > 0)
          : [{ id: '__all__', label: '', items }];
      return (
        <div className="mobile-focals-surface list-level">
          {itemSections.map((section) => (
            <div key={section.id} className="mobile-list-status-section">
              {section.label && <h4 className="mobile-list-status-heading">{section.label}</h4>}
              {section.items.map((item) => {
            const itemStatusEntry = getItemStatusEntry(item);
            const hasSubitems = (item.actions || []).length > 0;
            const isExpanded = expandedItemsInList[item.id];
            
            return (
              <div key={item.id} className="mobile-item-with-subitems">
                <article className="mobile-item-row">
                  {hasSubitems ? (
                    <button
                      type="button"
                      className="mobile-item-expand"
                      onClick={() => void toggleItemExpansion(item.id)}
                      aria-label={isExpanded ? 'Collapse subitems' : 'Expand subitems'}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  ) : (
                    <span className="mobile-item-expand-placeholder" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    className={`mobile-item-check ${isDashedStatus(itemStatusEntry) ? 'todo' : 'done'}`.trim()}
                    onClick={() => void handleStatusToggle(item.id, 'item')}
                    aria-label="Change status"
                  >
                    {isDashedStatus(itemStatusEntry) ? (
                      <span className="mobile-status-ring" style={{ color: itemStatusEntry?.color || undefined }} />
                    ) : (
                      <Circle size={18} fill={itemStatusEntry?.color || 'currentColor'} stroke={itemStatusEntry?.color || 'currentColor'} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="mobile-item-text"
                    onClick={() => void openItemDrawerForItem(item.id)}
                  >
                    <div className="mobile-item-main">
                      <span className="mobile-item-label">{item.title}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="mobile-item-subtask-toggle plain-text"
                    aria-label="Add subtask"
                    onClick={() => void handleAddSubItem(item.id)}
                  >
                    +
                  </button>
                </article>
                
                {isExpanded && (
                  <div className="mobile-subitems-list">
                    {(item.actions || []).map((action) => (
                      <article key={action.id} className="mobile-item-row subitem">
                        <span className="mobile-item-expand-placeholder" aria-hidden="true" />
                        {(() => {
                          const actionStatusEntry = getActionStatusEntry(action);
                          const actionDashed = isDashedStatus(actionStatusEntry);
                          return (
                        <button
                          type="button"
                          className={`mobile-item-check sub ${actionDashed ? 'todo' : 'done'}`.trim()}
                          onClick={() => void handleStatusToggle(action.id, 'action')}
                          aria-label="Change status"
                        >
                          {actionDashed ? (
                            <span className="mobile-status-ring small" style={{ color: actionStatusEntry?.color || undefined }} />
                          ) : (
                            <Circle size={15} fill={actionStatusEntry?.color || 'currentColor'} stroke={actionStatusEntry?.color || 'currentColor'} />
                          )}
                        </button>
                          );
                        })()}
                        <button
                          type="button"
                          className="mobile-item-text"
                          onClick={() => void openItemDrawerForItem(item.id)}
                        >
                          <div className="mobile-item-main">
                            <span className="mobile-item-label">{action.title}</span>
                          </div>
                        </button>
                        <div></div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
            </div>
          ))}
          {items.length === 0 && <article className="mobile-focal-card muted"><p>No items yet. Tap + to add one.</p></article>}
        </div>
      );
    }

    return (
      <div className="mobile-focals-surface">
        <article className="mobile-focal-card muted"><p>Select a space.</p></article>
      </div>
    );
  };

  const baseCalendarX = view === 'calendar' ? 0 : -Math.round(viewportWidth * 0.12);
  const baseAiX = view === 'calendar' ? viewportWidth : 0;
  const calendarX = isViewGestureDragging
    ? view === 'calendar'
      ? Math.min(0, Math.max(-viewportWidth, viewDragX))
      : Math.min(0, Math.max(baseCalendarX, baseCalendarX + viewDragX))
    : baseCalendarX;
  const aiX = isViewGestureDragging
    ? view === 'calendar'
      ? Math.max(0, Math.min(viewportWidth, baseAiX + viewDragX))
      : Math.max(0, Math.min(viewportWidth, viewDragX))
    : baseAiX;
  const calendarOpacity = view === 'calendar' ? 1 : 0.4;
  const liveCalendarOpacity = isViewGestureDragging
    ? view === 'calendar'
      ? Math.max(0.4, 1 - (Math.abs(calendarX) / viewportWidth) * 0.6)
      : Math.min(1, 0.4 + (Math.max(0, aiX) / viewportWidth) * 0.6)
    : calendarOpacity;

  return (
    <section
      className={`mobile-wireframe-root ${isViewGestureDragging ? 'gesture-dragging' : ''}`.trim()}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={() => {
        if (settingsOpen) setSettingsOpen(false);
        if (quickPanelOpen) setQuickPanelOpen(false);
      }}
    >
      <div className="mobile-wireframe-shell">
        <div
          className={`mobile-wireframe-screen mobile-calendar-screen ${view === 'ai' ? 'hidden-left' : ''}`}
          style={{ transform: `translateX(${calendarX}px)`, opacity: liveCalendarOpacity }}
        >
          {activeNav === 'calendar' ? renderCalendarHeader() : renderFocalsHeader()}

          {activeNav === 'calendar' && (
            <div className="mobile-wireframe-scroll" ref={timelineScrollRef}>
              <div
                className="mobile-timeline"
                style={{ height: `${timelineHeight + 140}px` }}
                onTouchStart={onTimelineTouchStart}
                onTouchMove={onTimelineTouchMove}
                onTouchEnd={onTimelineTouchEnd}
                onTouchCancel={onTimelineTouchEnd}
              >
                <div className="mobile-timeline-ticks">
                  {ticks.map((tick) => (
                    <div key={tick.minute} className="mobile-tick-row" style={{ top: `${(tick.minute - DAY_START_MIN) * PX_PER_MIN}px` }}>
                      <span>{tick.label}</span>
                    </div>
                  ))}
                </div>

                <div className="mobile-now-line" style={{ top: `${nowTop}px` }} />
                <div className="mobile-time-grid-lines" aria-hidden="true">
                  {gridLines.map((line) => (
                    <div
                      key={`line-${line.minute}`}
                      className={`mobile-time-grid-line ${line.tone}`}
                      style={{ top: `${(line.minute - DAY_START_MIN) * PX_PER_MIN}px` }}
                    />
                  ))}
                </div>

                {timelineDraft && (
                  <div
                    className="mobile-time-draft-block"
                    style={{ top: `${timelineDraft.topPx}px`, height: `${timelineDraft.heightPx}px` }}
                    aria-hidden="true"
                  />
                )}

                <div className="mobile-block-layer">
                  {blocks.map((block) => {
                    const blockGap = 8;
                    const rawTop = (block.startMin - DAY_START_MIN) * PX_PER_MIN;
                    const rawHeight = Math.max((block.endMin - block.startMin) * PX_PER_MIN, 74);
                    const top = rawTop + blockGap / 2;
                    const height = Math.max(rawHeight - blockGap, 24);
                    const isCurrent = block.id === currentBlockId;
                    const orderedBlockItems = sortMobileBlockItems(block.items, completed);
                    const visibleItems = orderedBlockItems.filter((item) => !completed[item.id]);
                    const expandedInline = isCurrent || expandedTasksByBlock[block.id];
                    const canToggleTasks = !isCurrent && visibleItems.length > 0;
                    const reservedHeight = 42 + (canToggleTasks ? 24 : 0);
                    const maxInlineItems = Math.max(0, Math.min(3, Math.floor((height - reservedHeight) / 32)));
                    const renderedItems = expandedInline ? visibleItems.slice(0, maxInlineItems) : [];
                    const hiddenItemCount = expandedInline ? Math.max(0, visibleItems.length - renderedItems.length) : 0;
                    return (
                      <article
                        key={block.id}
                        className={`mobile-time-block ${isCurrent ? 'current' : ''}`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={() => openFullDrawer(block.id)}
                      >
                        <div className="mobile-time-block-head">
                          <h3>{block.name}</h3>
                          <div className="mobile-time-block-head-right">
                            <span>{formatRange(block.startMin, block.endMin)}</span>
                            <button
                              type="button"
                              className="mobile-block-add-btn"
                              aria-label="Add task"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                openAddTaskDrawer(block.id);
                              }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>

                        {canToggleTasks && (
                          <button
                            type="button"
                            className="mobile-block-show-tasks"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleBlockTaskExpansion(block.id);
                            }}
                          >
                            <ChevronDown size={14} className={expandedTasksByBlock[block.id] ? 'open' : ''} />
                            {expandedTasksByBlock[block.id] ? 'Hide tasks' : 'Show tasks'}
                          </button>
                        )}

                        {expandedInline && (
                          <div className="mobile-time-block-items">
                            {renderedItems.map((item) => (
                              <div key={item.id} className="mobile-item-row">
                                <button
                                  type="button"
                                  className={`mobile-item-check ${completed[item.id] ? 'done' : 'todo'}`.trim()}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleComplete(item.id);
                                  }}
                                  aria-label={completed[item.id] ? 'Mark not done' : 'Mark done'}
                                >
                                  {completed[item.id] ? <CheckCircle2 size={20} /> : <span className="mobile-status-ring" />}
                                </button>
                                <button
                                  type="button"
                                  className="mobile-item-text"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openItemDrawer(block.id, item.id);
                                  }}
                                >
                                  <div className="mobile-item-main">
                                    <span className="mobile-item-label">{item.name}</span>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  className="mobile-item-subtask-toggle"
                                  aria-label="Add subtask"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleSubtaskComposer(item.id);
                                  }}
                                >
                                  +
                                </button>
                                {item.subItems && item.subItems.length > 0 && (
                                  <div className="mobile-subitems">
                                    {item.subItems.map((subItem) => (
                                      <div key={subItem.id} className="mobile-item-subrow">
                                        <button
                                          type="button"
                                          className={`mobile-item-check sub ${completed[subItem.id] ? 'done' : 'todo'}`.trim()}
                                          onPointerDown={(event) => event.stopPropagation()}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            toggleComplete(subItem.id);
                                          }}
                                          aria-label={completed[subItem.id] ? 'Mark subtask not done' : 'Mark subtask done'}
                                        >
                                          {completed[subItem.id] ? <CheckCircle2 size={17} /> : <span className="mobile-status-ring small" />}
                                        </button>
                                        <button
                                          type="button"
                                          className="mobile-item-subtext"
                                          onPointerDown={(event) => event.stopPropagation()}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openItemDrawer(block.id, item.id);
                                          }}
                                        >
                                          <div className="mobile-item-sub">↳ {subItem.name}</div>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {subtaskComposerByItem[item.id] && (
                                  <div className="mobile-item-subtask-composer">
                                    <input
                                      type="text"
                                      value={subtaskDraftByItem[item.id] || ''}
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={(event) =>
                                        setSubtaskDraftByItem((prev) => ({ ...prev, [item.id]: event.target.value }))
                                      }
                                      placeholder="Add subtask"
                                    />
                                    <button
                                      type="button"
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void createSubtaskFromBlock(block.id, item.id);
                                      }}
                                    >
                                      Add
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                            {hiddenItemCount > 0 && (
                              <button
                                type="button"
                                className="mobile-block-view-more"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openFullDrawer(block.id);
                                }}
                              >
                                View more ({hiddenItemCount})
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeNav === 'focals' && renderFocalsBody()}
          {activeNav === 'docs' && renderDocsBody()}
        </div>

        <div
          className={`mobile-wireframe-screen mobile-ai-screen ${view === 'ai' ? 'visible' : ''}`}
          style={{ transform: `translateX(${aiX}px)`, opacity: aiX >= viewportWidth ? 0.7 : 1 }}
        >
          <header className="mobile-wireframe-header mobile-ai-header">
            <button type="button" className="mobile-ai-back-btn" onClick={() => setView('calendar')} aria-label="Back to calendar">
              <X size={18} />
            </button>
            <h2>Delta AI</h2>
          </header>
          <div className="mobile-ai-messages" ref={chatMessagesRef}>
            {chatMessages.length === 0 && (
              <div className="mobile-ai-assistant">
                Ask anything about your spaces, lists, items, or current block.
              </div>
            )}
            {chatMessages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="mobile-ai-user">
                  {message.content}
                </div>
              ) : (
                <div key={message.id} className="mobile-ai-assistant">
                  <div className="mobile-ai-provenance-chip">
                    {message.debug_meta?.source === 'db' ? 'DB' : message.debug_meta?.source === 'llm' ? 'LLM' : 'Fallback'}
                  </div>
                  {message.content}
                  {Array.isArray(message.debug_meta?.warnings) && message.debug_meta.warnings.length > 0 && (
                    <div className="mobile-ai-warning-line">{message.debug_meta.warnings[0]}</div>
                  )}
                  {(message.proposals || [])
                    .filter((proposal) => !dismissedMobileProposalIds[proposal.id])
                    .map((proposal) => (
                      <div key={proposal.id} className="mobile-ai-proposal-card">
                        <p>{proposal.type === 'resolve_time_conflict' ? proposal.event_title : proposal.title}</p>
                        {(proposal.type === 'create_action' ||
                          proposal.type === 'create_follow_up_action' ||
                          proposal.type === 'create_time_block' ||
                          proposal.type === 'resolve_time_conflict') && (
                          <input
                            type="text"
                            className="mobile-ai-proposal-input"
                            placeholder="Optional description"
                            value={mobileProposalNotes[proposal.id] ?? proposal.notes ?? ''}
                            onChange={(event) =>
                              setMobileProposalNotes((prev) => ({ ...prev, [proposal.id]: event.target.value }))
                            }
                          />
                        )}
                        <div className="mobile-ai-proposal-actions">
                          <button
                            type="button"
                            className="approve"
                            disabled={Boolean(approvedMobileProposalIds[proposal.id]) || applyingMobileProposalId === proposal.id}
                            onClick={() => void handleApproveMobileProposal(proposal)}
                          >
                            {approvedMobileProposalIds[proposal.id]
                              ? 'Applied'
                              : applyingMobileProposalId === proposal.id
                                ? 'Applying…'
                                : 'Approve'}
                          </button>
                          <button
                            type="button"
                            className="dismiss"
                            disabled={Boolean(approvedMobileProposalIds[proposal.id]) || applyingMobileProposalId === proposal.id}
                            onClick={() =>
                              setDismissedMobileProposalIds((prev) => ({ ...prev, [proposal.id]: true }))
                            }
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )
            )}
          </div>
          <div className="mobile-ai-composer-wrap">
            <div className="mobile-ai-composer">
              <textarea
                rows={2}
                placeholder="Ask Delta…"
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onKeyDown={handleChatKeyDown}
              />
              <button type="button" aria-label="Send" onClick={() => void sendMobileChat()} disabled={chatSending || !chatDraft.trim()}>
                <Send size={17} />
              </button>
            </div>
            <div className="mobile-ai-footer-strip">
              <button
                type="button"
                className="mobile-ai-voice-btn"
                aria-label="Voice mode"
                onClick={() => {
                  openUnifiedCapture('voice');
                }}
              >
                <Mic size={16} />
              </button>
              <div className="mobile-ai-source-control" ref={mobileSourceMenuRef}>
                {mobileChatSourceId === 'current' ? (
                  <button
                    type="button"
                    className="mobile-ai-source-add"
                    onClick={() => setMobileChatSourceMenuOpen((prev) => !prev)}
                  >
                    <span>Add source</span>
                    <ChevronDown size={14} />
                  </button>
                ) : (
                  <span className="mobile-ai-chip">
                    <span>{selectedMobileSourceLabel}</span>
                    <button
                      type="button"
                      aria-label="Clear selected source"
                      onClick={() => {
                        setMobileChatSourceId('current');
                        setMobileChatSourceContext(null);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {mobileChatSourceMenuOpen && (
                  <div className="mobile-ai-source-menu">
                    {mobileChatSourceOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => handleSelectMobileChatSource(option)}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mobile-ai-chip-controls">
                <span>Memo</span>
                <button
                  type="button"
                  className={`mobile-ai-toggle ${mobileMemoMode ? 'on' : ''}`.trim()}
                  aria-label="Toggle memo mode"
                  aria-pressed={mobileMemoMode}
                  onClick={() => setMobileMemoMode((prev) => !prev)}
                >
                  <span />
                </button>
              </div>
            </div>
          </div>
        </div>

        {view === 'calendar' && (
          <div className="mobile-bottom-nav-wrap">
            {quickPanelMounted && (
              <div className={`mobile-quick-panel ${quickPanelOpen ? 'open' : ''}`.trim()}>
                {(() => {
                  const contextualAdd = getContextualAddSpec();
                  const ContextIcon = contextualAdd.icon;
                  return (
                    <button type="button" onClick={() => void quickAddByContext()}>
                      <ContextIcon size={16} />
                      <span>{contextualAdd.label}</span>
                    </button>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => {
                    setQuickPanelOpen(false);
                    openAddSheet({ open: true, type: 'doc' });
                  }}
                >
                  <FileText size={16} />
                  <span>Note +</span>
                </button>
                <button type="button" onClick={() => openUnifiedCapture('text')}>
                  <Type size={16} />
                  <span>Capture</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickPanelOpen(false);
                    setView('ai');
                  }}
                >
                  <img src="/Delta-AI-Button.png" alt="" aria-hidden="true" />
                  <span>Delta AI</span>
                </button>
              </div>
            )}
            {captureMode === 'text' && (
              <div className={`mobile-text-capture-bar ${captureInputMode === 'voice' ? 'voice' : 'text'}`.trim()}>
                <div className={`mobile-capture-input-shell ${captureInputMode === 'voice' ? 'voice' : 'text'}`.trim()}>
                  {captureInputMode === 'voice' ? (
                    <>
                      <div className="mobile-capture-voice-gradient" aria-hidden="true" />
                      <div className="mobile-capture-voice-content">
                        <span className={`mobile-capture-voice-text ${voiceTranscript.trim() ? '' : 'placeholder'}`.trim()}>
                          {voiceTranscript || (voiceRecording ? 'Listening…' : 'Tap voice capture to start')}
                        </span>
                        <div className="mobile-capture-voice-bars" aria-hidden="true">
                          {voiceBars.map((height, idx) => (
                            <span key={`bar-${idx}`} style={{ height: `${height}px` }} />
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <textarea
                      ref={textCaptureRef}
                      rows={1}
                      value={textCaptureDraft}
                      readOnly={false}
                      placeholder="Capture quickly…"
                      onChange={(event) => {
                        setTextCaptureDraft(event.target.value);
                        const target = event.target;
                        target.style.height = '0px';
                        target.style.height = `${Math.min(target.scrollHeight, 148)}px`;
                      }}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="mobile-capture-send"
                  onClick={() => void submitTextCapture()}
                  disabled={!(captureInputMode === 'voice' ? voiceTranscript.trim() : textCaptureDraft.trim()) || chatSending}
                >
                  <Send size={16} />
                </button>
              </div>
            )}
            <div className="mobile-bottom-pill">
              <span
                className="mobile-bottom-pill-indicator"
                style={{ transform: `translateX(${activeNavIndex * 100}%)` }}
              />
              <button type="button" className={activeNav === 'docs' ? 'active' : ''} onClick={() => setActiveNav('docs')}>
                <FileText size={15} />
                <span>Notes</span>
              </button>
              <button type="button" className={activeNav === 'focals' ? 'active' : ''} onClick={() => setActiveNav('focals')}>
                <Mountains size={15} weight="regular" />
                <span>Spaces</span>
              </button>
              <button type="button" className={activeNav === 'calendar' ? 'active' : ''} onClick={() => setActiveNav('calendar')}>
                <CalendarDays size={15} />
                <span>Calendar</span>
              </button>
            </div>
            <button
              type="button"
              className={`mobile-quick-add-btn ${quickPanelOpen ? 'open' : ''}`.trim()}
              onClick={() => {
                if (captureMode !== 'none') {
                  stopVoiceAnimation();
                  setCaptureMode('none');
                  return;
                }
                if (quickPanelOpen) {
                  setQuickPanelOpen(false);
                  return;
                }
                setQuickPanelMounted(true);
                window.requestAnimationFrame(() => setQuickPanelOpen(true));
              }}
              aria-label="Quick add"
            >
              <Plus className="mobile-quick-add-icon" size={31} />
            </button>
          </div>
        )}
      </div>

      {captureConfirmation.open && (
        <div className="mobile-capture-confirm">
          <div className="mobile-capture-confirm-copy">
            <strong>Captured to Notes</strong>
            <span>{captureConfirmation.text}</span>
            {captureConfirmation.routing && <em>Delta is analyzing this capture…</em>}
            {captureConfirmation.aiText && !captureConfirmation.routing && (
              <p className="mobile-capture-confirm-ai">{captureConfirmation.aiText}</p>
            )}
          </div>
          {captureConfirmation.error && (
            <p className="mobile-capture-confirm-error">{captureConfirmation.error}</p>
          )}
          {!captureConfirmation.routing &&
            captureConfirmation.proposals
              .filter((proposal) => !captureDismissedProposalIds[proposal.id])
              .map((proposal) => (
                <div key={proposal.id} className="mobile-ai-proposal-card mobile-capture-proposal-card">
                  <p>{proposal.type === 'resolve_time_conflict' ? proposal.event_title : proposal.title}</p>
                  {(proposal.type === 'create_action' ||
                    proposal.type === 'create_follow_up_action' ||
                    proposal.type === 'create_time_block' ||
                    proposal.type === 'resolve_time_conflict') && (
                    <input
                      type="text"
                      className="mobile-ai-proposal-input"
                      placeholder="Optional description"
                      value={mobileProposalNotes[proposal.id] ?? proposal.notes ?? ''}
                      onChange={(event) =>
                        setMobileProposalNotes((prev) => ({ ...prev, [proposal.id]: event.target.value }))
                      }
                    />
                  )}
                  <div className="mobile-ai-proposal-actions">
                    <button
                      type="button"
                      className="approve"
                      disabled={Boolean(approvedMobileProposalIds[proposal.id]) || applyingMobileProposalId === proposal.id}
                      onClick={() => void handleApproveMobileProposal(proposal)}
                    >
                      {approvedMobileProposalIds[proposal.id]
                        ? 'Applied'
                        : applyingMobileProposalId === proposal.id
                          ? 'Applying…'
                          : 'Apply'}
                    </button>
                    <button
                      type="button"
                      className="dismiss"
                      disabled={Boolean(approvedMobileProposalIds[proposal.id]) || applyingMobileProposalId === proposal.id}
                      onClick={() =>
                        setCaptureDismissedProposalIds((prev) => ({ ...prev, [proposal.id]: true }))
                      }
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
          <div className="mobile-capture-confirm-actions">
            <button
              type="button"
              className="review"
              onClick={() => {
                setView('ai');
                setChatDraft(captureConfirmation.text);
                setCaptureConfirmation((prev) => ({ ...prev, open: false }));
              }}
              disabled={captureConfirmation.routing || chatSending}
            >
              Review in AI
            </button>
            <button
              type="button"
              className="done"
              onClick={() =>
                setCaptureConfirmation({
                  open: false,
                  text: '',
                  aiText: '',
                  proposals: [],
                  routing: false,
                  error: null
                })
              }
            >
              Done
            </button>
          </div>
        </div>
      )}

      {activeNoteEditor && (
        <div className="mobile-note-editor-overlay" onClick={() => setActiveNoteEditor(null)}>
          <div className="mobile-note-editor" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-note-editor-head">
              <button type="button" className="done" onClick={() => setActiveNoteEditor(null)}>
                Done
              </button>
              <button
                type="button"
                className="save"
                disabled={noteEditorSaving}
                onClick={async () => {
                  if (!activeNoteEditor) return;
                  setNoteEditorSaving(true);
                  try {
                    const updated = await docsService.updateNote(activeNoteEditor.id, {
                      title: noteEditorTitle,
                      body: noteEditorBody
                    });
                    setDocsNotes((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
                    setActiveNoteEditor((prev) => (prev ? { ...prev, ...updated } : prev));
                  } catch (error) {
                    console.error('Failed to update note:', error);
                  } finally {
                    setNoteEditorSaving(false);
                  }
                }}
              >
                {noteEditorSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div className="mobile-note-editor-body">
              <input
                type="text"
                value={noteEditorTitle}
                onChange={(event) => setNoteEditorTitle(event.target.value)}
                placeholder="Note title"
              />
              <textarea
                value={noteEditorBody}
                onChange={(event) => setNoteEditorBody(event.target.value)}
                placeholder="Write your note"
                rows={14}
              />
            </div>
          </div>
        </div>
      )}

      {addSheet.open && (
        <div className={`mobile-add-sheet-overlay ${addSheetClosing ? 'closing' : ''}`.trim()} onClick={closeAddSheet}>
          <div
            className={`mobile-add-sheet ${addSheetClosing ? 'closing' : ''} ${isAddSheetDragging ? 'dragging' : ''}`.trim()}
            style={{ transform: `translateY(${addSheetDragY}px)` }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="mobile-add-sheet-grab"
              onTouchStart={onAddSheetTouchStart}
              onTouchMove={onAddSheetTouchMove}
              onTouchEnd={onAddSheetTouchEnd}
              onPointerDown={onAddSheetPointerDown}
              onPointerMove={onAddSheetPointerMove}
              onPointerUp={onAddSheetPointerEnd}
              onPointerCancel={onAddSheetPointerEnd}
            />
            <div className="mobile-add-sheet-head">
              {addSheet.type === 'item' || addSheet.type === 'event' || addSheet.type === 'subitem' ? (
                <input
                  ref={addSheetNameRef}
                  className="mobile-add-sheet-title-input"
                  value={addSheetName}
                  onChange={(event) => setAddSheetName(event.target.value)}
                  placeholder="Name"
                />
              ) : (
                <strong>
                  {addSheet.type === 'space' && 'Add Space'}
                  {addSheet.type === 'list' && 'Add List'}
                  {addSheet.type === 'doc' && 'Add Note'}
                </strong>
              )}
              <button
                type="button"
                className="mobile-add-sheet-submit-top"
                aria-label="Add"
                onTouchStart={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  void submitAddSheet();
                }}
                disabled={!canSubmitAddSheet}
              >
                Add
              </button>
            </div>
            <div className={`mobile-add-sheet-body ${addSheet.type === 'event' ? 'event-editor' : ''} ${addSheet.type === 'item' ? 'item-editor' : ''}`.trim()}>
              {(addSheet.type === 'list') && (
                <label className="mobile-add-field">
                  <span>Space</span>
                  <select
                    value={addSheet.focalId || ''}
                    onChange={(event) => {
                      const nextFocal = event.target.value || null;
                      setAddSheet((prev) => ({
                        ...prev,
                        focalId: nextFocal,
                        listId: nextFocal ? (listsByFocal[nextFocal] || [])[0]?.id || null : null,
                        itemId: null
                      }));
                    }}
                  >
                    <option value="">Select space</option>
                    {focals.map((focal) => (
                      <option key={focal.id} value={focal.id}>
                        {focal.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {addSheet.type === 'subitem' && (
                <label className="mobile-add-field">
                  <span>Parent</span>
                  <select
                    value={addSubitemParentValue}
                    onChange={(event) => {
                      const value = event.target.value || '';
                      if (!value) {
                        setAddSheet((prev) => ({ ...prev, listId: null, itemId: null }));
                        return;
                      }
                      const [listId, itemId] = value.split(':');
                      setAddSheet((prev) => ({ ...prev, listId: listId || null, itemId: itemId || null }));
                    }}
                  >
                    <option value="">Select parent item</option>
                    {addSubitemParentOptions.map((option) => (
                      <option key={`${option.listId}:${option.itemId}`} value={`${option.listId}:${option.itemId}`}>
                        {option.listName} / {option.itemTitle}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {addSheet.type !== 'item' && addSheet.type !== 'event' && addSheet.type !== 'subitem' && (
                <label className="mobile-add-field">
                  <span>{addSheet.type === 'doc' ? 'Title' : 'Name'}</span>
                  <input
                    value={addSheetName}
                    onChange={(event) => setAddSheetName(event.target.value)}
                    placeholder={addSheet.type === 'doc' ? 'Note title' : 'Enter name'}
                  />
                </label>
              )}

              {addSheet.type === 'item' && (
                <>
                  <label className="mobile-add-field mobile-item-description-field">
                    <textarea
                      value={addSheetDescription}
                      onChange={(event) => setAddSheetDescription(event.target.value)}
                      placeholder="Description"
                      rows={3}
                    />
                  </label>

                  {addItemStatuses.length > 0 && (
                    <label className="mobile-add-field">
                      <span>Status</span>
                      <select value={addItemStatusValue} onChange={(event) => setAddItemStatusValue(event.target.value)}>
                        {addItemStatuses.map((status) => (
                          <option key={status.id || status.key} value={status.id || status.key}>
                            {status.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {addItemColumnFields.map((field: any) => (
                    <label key={field.id} className="mobile-add-field">
                      <span>{field.name}</span>
                      {(field.type === 'select') && (
                        <select
                          value={addItemFieldDrafts[field.id] || ''}
                          onChange={(event) =>
                            setAddItemFieldDrafts((prev) => ({
                              ...prev,
                              [field.id]: event.target.value
                            }))
                          }
                        >
                          <option value="">Select</option>
                          {(field.options || []).map((option: any) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {(field.type === 'text' || field.type === 'number' || field.type === 'contact') && (
                        <input
                          type="text"
                          value={addItemFieldDrafts[field.id] || ''}
                          onChange={(event) =>
                            setAddItemFieldDrafts((prev) => ({
                              ...prev,
                              [field.id]: event.target.value
                            }))
                          }
                          placeholder={field.type === 'number' ? 'Enter number' : field.type === 'contact' ? 'Name • phone • email' : 'Enter text'}
                        />
                      )}
                      {field.type === 'date' && (
                        <input
                          type="date"
                          value={addItemFieldDrafts[field.id] || ''}
                          onChange={(event) =>
                            setAddItemFieldDrafts((prev) => ({
                              ...prev,
                              [field.id]: event.target.value
                            }))
                          }
                        />
                      )}
                      {field.type === 'boolean' && (
                        <select
                          value={addItemFieldDrafts[field.id] || ''}
                          onChange={(event) =>
                            setAddItemFieldDrafts((prev) => ({
                              ...prev,
                              [field.id]: event.target.value
                            }))
                          }
                        >
                          <option value="">Select</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      )}
                    </label>
                  ))}
                </>
              )}

              {addSheet.type === 'doc' && (
                <label className="mobile-add-field">
                  <span>Body</span>
                  <textarea
                    value={addSheetDescription}
                    onChange={(event) => setAddSheetDescription(event.target.value)}
                    placeholder="Write your note"
                    rows={4}
                  />
                </label>
              )}

              {addSheet.type === 'event' && (
                <>
                  <div className="mobile-add-time-grid clean">
                    <label className="mobile-add-field">
                      <span>Start time</span>
                      <input type="time" value={addSheetStart} onChange={(event) => setAddSheetStart(event.target.value)} />
                    </label>
                    <span className="mobile-add-time-sep" aria-hidden="true">to</span>
                    <label className="mobile-add-field">
                      <span>End time</span>
                      <input type="time" value={addSheetEnd} onChange={(event) => setAddSheetEnd(event.target.value)} />
                    </label>
                  </div>

                  <div className="mobile-add-inline-row repeat-row">
                    <span className="mobile-add-inline-label">Repeat</span>
                    <button
                      type="button"
                      className={`mobile-inline-toggle ${addSheetRecurrence !== 'none' ? 'on' : ''}`.trim()}
                      aria-pressed={addSheetRecurrence !== 'none'}
                      onClick={() => {
                        const nextEnabled = addSheetRecurrence === 'none';
                        setAddSheetRecurrence(nextEnabled ? 'weekly' : 'none');
                        setAddSheetRecurrenceExpanded(nextEnabled);
                      }}
                    >
                      <span />
                    </button>
                  </div>

                  {addSheetRecurrence !== 'none' && addSheetRecurrenceExpanded && (
                    <div className="mobile-add-inline-options dropdown">
                      {(['none', 'daily', 'weekly', 'monthly'] as AddSheetRecurrence[]).map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={addSheetRecurrence === value ? 'active' : ''}
                          onClick={() => setAddSheetRecurrence(value)}
                        >
                          {value === 'none' ? 'None' : value[0].toUpperCase() + value.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}

                  <label className="mobile-add-field mobile-item-description-field">
                    <textarea
                      value={addSheetDescription}
                      onChange={(event) => setAddSheetDescription(event.target.value)}
                      placeholder="Description"
                      rows={3}
                    />
                  </label>

                  <div className="mobile-event-flow-note">
                    <strong>Add items after you create the block</strong>
                    <span>The block opens straight into the same add-items drawer used everywhere else, so item actions stay consistent.</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {drawer.open && (
        <div className="mobile-drawer-overlay" onClick={closeDrawer}>
          <div
            className={`mobile-drawer ${drawer.mode} ${isDrawerDragging ? 'dragging' : ''} ${drawerClosing ? 'closing' : ''}`.trim()}
            style={{ transform: `translateY(${drawerDragY}px)` }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="mobile-drawer-grab"
              onTouchStart={onDrawerTouchStart}
              onTouchMove={onDrawerTouchMove}
              onTouchEnd={onDrawerTouchEnd}
              onPointerDown={onDrawerPointerDown}
              onPointerMove={onDrawerPointerMove}
              onPointerUp={onDrawerPointerEnd}
              onPointerCancel={onDrawerPointerEnd}
            />
            <div className="mobile-drawer-head">
              <Clock3 size={15} />
                <strong>
                {drawer.mode === 'addTask'
                  ? 'Add Task'
                  : drawer.mode === 'item'
                    ? resolvedDrawerItem?.name || 'Item Details'
                    : activeDrawerBlock?.name || 'Time Block'}
              </strong>
              {drawer.mode !== 'addTask' && drawer.mode !== 'item' && drawer.blockId && (
                <div className="mobile-drawer-head-actions">
                  {drawer.mode !== 'edit' && (
                    <button
                      type="button"
                      aria-label="Edit event"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditDrawer(drawer.blockId as string);
                      }}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Delete event"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteDrawerBlock();
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="mobile-drawer-body">
            {drawer.mode === 'addTask' && drawer.blockId && (
              <div className="mobile-task-drawer">
                <label className="mobile-task-drawer-search">
                  <input
                    type="text"
                    placeholder="Search"
                    value={taskDrawerSearch}
                    onChange={(event) => setTaskDrawerSearch(event.target.value)}
                  />
                </label>
                <div className="mobile-task-drawer-results">
                  {taskDrawerLoading && <div className="mobile-task-drawer-empty">Loading lists and items…</div>}
                  {!taskDrawerLoading && taskTreeRows.length === 0 && (
                    <div className="mobile-task-drawer-empty">No matching lists</div>
                  )}
                  {taskTreeRows.map((focal) => {
                    const focalExpanded = taskDrawerExpandedFocals[focal.focalId] ?? true;
                    return (
                      <div key={focal.focalId} className="mobile-task-drawer-focal">
                        <button
                          type="button"
                          className={`mobile-task-drawer-tree-toggle ${focalExpanded ? 'expanded' : ''}`}
                          onClick={() =>
                            setTaskDrawerExpandedFocals((prev) => ({ ...prev, [focal.focalId]: !focalExpanded }))
                          }
                        >
                          <ChevronDown size={14} />
                          <span>{focal.focalName}</span>
                        </button>
                        {focalExpanded && focal.lists.map((list) => {
                          const listExpanded = taskDrawerExpandedLists[list.id] ?? (taskSearchQuery ? true : taskDrawerListId === list.id);
                          return (
                            <div key={list.id} className="mobile-task-drawer-list">
                              <button
                                type="button"
                                className={`mobile-task-drawer-tree-toggle list ${listExpanded ? 'expanded' : ''}`}
                                onClick={() => {
                                  setTaskDrawerListId(list.id);
                                  setTaskDrawerExpandedLists((prev) => ({ ...prev, [list.id]: !listExpanded }));
                                }}
                              >
                                <ChevronDown size={13} />
                                <span>{list.name}</span>
                              </button>
                              {listExpanded && (
                                <div className="mobile-task-drawer-items">
                                  {list.items.map((item) => {
                                    const isAdded = !!activeDrawerBlock?.items.some((entry) => entry.id === item.id);
                                    return (
                                      <div key={item.id} className="mobile-task-drawer-result-row">
                                        <div className="mobile-task-drawer-result-copy">
                                          <strong>{item.title}</strong>
                                        </div>
                                        <button
                                          type="button"
                                          className={`mobile-task-drawer-result-add ${isAdded ? 'added' : ''}`}
                                          disabled={isAdded || taskDrawerPendingKey === `item:${item.id}`}
                                          onClick={() =>
                                            void attachExistingItemToBlock(drawer.blockId as string, {
                                              id: item.id,
                                              title: item.title,
                                              listId: list.id
                                            })
                                          }
                                        >
                                          {isAdded ? <CheckCircle2 size={14} /> : 'Add'}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  {!!taskDrawerSearch.trim() && !taskHasExactMatch && (
                    <div className="mobile-task-drawer-create-row">
                      <div className="mobile-task-drawer-result-copy">
                        <strong>{taskDrawerSearch.trim()}</strong>
                        <span>Create new item{taskDrawerListId ? '' : ' (pick a list first)'}</span>
                      </div>
                      <button
                        type="button"
                        className="mobile-task-drawer-create"
                        disabled={taskDrawerPendingKey === 'create' || (!taskDrawerListId && indexedLists.length === 0)}
                        onClick={() => void createNewTaskFromDrawer(drawer.blockId as string)}
                      >
                        Create New
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {drawer.mode !== 'item' && drawer.mode !== 'addTask' && drawer.mode !== 'edit' && (
              <>
                <p className="mobile-drawer-description">
                  {activeDrawerBlock?.description?.trim() || 'No description yet.'}
                </p>
                <div className="mobile-drawer-linked">
                  <div className="mobile-drawer-linked-head">
                    <h4>Attached items</h4>
                    <button
                      type="button"
                      className="mobile-task-drawer-create"
                      onClick={() => drawer.blockId && openAddTaskDrawer(drawer.blockId)}
                    >
                      Add items
                    </button>
                  </div>
                  {drawer.blockId && renderBlockItemRows(drawer.blockId, activeDrawerBlock?.items || [])}
                </div>
              </>
            )}
            {drawer.mode === 'edit' && (
              <div className="mobile-drawer-edit">
                <label className="mobile-drawer-edit-field">
                  <input
                    type="text"
                    value={editDrawerName}
                    onChange={(event) => setEditDrawerName(event.target.value)}
                    placeholder="Event name"
                  />
                </label>
                <label className="mobile-drawer-edit-field">
                  <textarea
                    value={editDrawerDescription}
                    onChange={(event) => setEditDrawerDescription(event.target.value)}
                    placeholder="Description"
                    rows={3}
                  />
                </label>

                <div className="mobile-add-time-grid clean mobile-drawer-edit-times">
                  <label className="mobile-drawer-edit-field">
                    <span>Start time</span>
                    <input
                      type="time"
                      value={editDrawerStart}
                      onChange={(event) => setEditDrawerStart(event.target.value)}
                    />
                  </label>
                  <span className="mobile-add-time-sep" aria-hidden="true">to</span>
                  <label className="mobile-drawer-edit-field">
                    <span>End time</span>
                    <input
                      type="time"
                      value={editDrawerEnd}
                      onChange={(event) => setEditDrawerEnd(event.target.value)}
                    />
                  </label>
                </div>

                <div className="mobile-add-inline-row repeat-row mobile-drawer-edit-repeat">
                  <span className="mobile-add-inline-label">Repeat</span>
                  <button
                    type="button"
                    className={`mobile-inline-toggle ${editDrawerRecurrence !== 'none' ? 'on' : ''}`.trim()}
                    aria-pressed={editDrawerRecurrence !== 'none'}
                    onClick={() => {
                      const nextEnabled = editDrawerRecurrence === 'none';
                      setEditDrawerRecurrence(nextEnabled ? 'weekly' : 'none');
                      setEditDrawerRecurrenceExpanded(nextEnabled);
                    }}
                  >
                    <span />
                  </button>
                </div>

                {editDrawerRecurrence !== 'none' && editDrawerRecurrenceExpanded && (
                  <div className="mobile-add-inline-options dropdown mobile-drawer-edit-recurrence">
                    {(['none', 'daily', 'weekly', 'monthly'] as AddSheetRecurrence[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={editDrawerRecurrence === value ? 'active' : ''}
                        onClick={() => setEditDrawerRecurrence(value)}
                      >
                        {value === 'none' ? 'None' : value[0].toUpperCase() + value.slice(1)}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mobile-drawer-edit-actions">
                  <button
                    type="button"
                    className="mobile-task-drawer-create"
                    onClick={() => void saveDrawerEdits()}
                    disabled={editDrawerSaving || !editDrawerName.trim()}
                  >
                    {editDrawerSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
            {drawer.mode === 'item' && resolvedDrawerItem && (
              <div
                className={`mobile-item-drawer-panel ${itemDrawerPanel}`.trim()}
                onTouchStart={onItemDrawerPanelTouchStart}
                onTouchEnd={onItemDrawerPanelTouchEnd}
              >
                <div className="mobile-item-drawer-tabs">
                  <button type="button" className={itemDrawerPanel === 'details' ? 'active' : ''} onClick={() => setItemDrawerPanel('details')}>
                    Details
                  </button>
                  <button type="button" className={itemDrawerPanel === 'comments' ? 'active' : ''} onClick={() => setItemDrawerPanel('comments')}>
                    Comments
                  </button>
                </div>

                {itemDrawerPanel === 'details' ? (
                  <div className="mobile-item-drawer-details">
                    <h4>{resolvedDrawerItem.name}</h4>
                    <p>{resolvedDrawerItem.description?.trim() || activeDrawerBlock?.description?.trim() || 'No description yet.'}</p>
                    <div className="mobile-item-drawer-fields">
                      <h5>Column values</h5>
                      {itemDrawerFields.length === 0 && <div className="mobile-item-drawer-empty">No column values on this task yet.</div>}
                      {itemDrawerFields.map((field) => (
                        <div key={field.id} className="mobile-item-drawer-field-row">
                          <span>{field.name}</span>
                          <strong>{getFieldDisplayValue(field)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mobile-item-drawer-comments">
                    {itemDrawerCommentsLoading && <div className="mobile-item-drawer-empty">Loading comments…</div>}
                    {!itemDrawerCommentsLoading && itemDrawerComments.length === 0 && (
                      <div className="mobile-item-drawer-empty">No comments yet.</div>
                    )}
                    {!itemDrawerCommentsLoading && itemDrawerComments.length > 0 && (
                      <div className="mobile-item-drawer-comment-list">
                        {itemDrawerComments.map((comment) => (
                          <article key={comment.id} className="mobile-item-drawer-comment">
                            <p>{comment.body}</p>
                            <time>{new Date(comment.created_at).toLocaleString()}</time>
                          </article>
                        ))}
                      </div>
                    )}
                    <form
                      className="mobile-item-drawer-comment-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitItemDrawerComment();
                      }}
                    >
                      <input
                        type="text"
                        value={itemDrawerCommentDraft}
                        onChange={(event) => setItemDrawerCommentDraft(event.target.value)}
                        placeholder="Add comment"
                      />
                      <button type="submit" disabled={itemDrawerCommentSubmitting || !itemDrawerCommentDraft.trim()}>
                        Send
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
