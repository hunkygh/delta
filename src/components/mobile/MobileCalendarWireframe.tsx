import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, TouchEvent } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  CalendarDays,
  CheckSquare,
  ArrowLeft,
  Folder,
  SlidersHorizontal
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
import type { ChatMessage } from '../../types/chat';

type MobileBlockItem = {
  id: string;
  name: string;
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
  type: 'space' | 'list' | 'item' | 'subitem' | 'event';
  focalId?: string | null;
  listId?: string | null;
  itemId?: string | null;
};

type MobileFocal = {
  id: string;
  name: string;
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
  actions?: Array<{ id: string; title: string }>;
};

type AttachTreeNode = {
  id?: string;
  label?: string;
  name?: string;
  title?: string;
  children?: AttachTreeNode[];
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

export default function MobileCalendarWireframe(): JSX.Element {
  const { user } = useAuth();
  const [view, setView] = useState<'calendar' | 'ai'>('calendar');
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, mode: 'peek', blockId: null });
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
  const [captureMode, setCaptureMode] = useState<'none' | 'voice' | 'text'>('none');
  const [addSheet, setAddSheet] = useState<AddSheetState>({ open: false, type: 'item' });
  const [addSheetClosing, setAddSheetClosing] = useState(false);
  const [isAddSheetDragging, setIsAddSheetDragging] = useState(false);
  const [addSheetDragY, setAddSheetDragY] = useState(0);
  const [addSheetName, setAddSheetName] = useState('');
  const [addSheetDescription, setAddSheetDescription] = useState('');
  const [addSheetStart, setAddSheetStart] = useState('09:00');
  const [addSheetEnd, setAddSheetEnd] = useState('10:00');
  const [addSheetRecurrence, setAddSheetRecurrence] = useState<AddSheetRecurrence>('none');
  const [addSheetRecurrenceExpanded, setAddSheetRecurrenceExpanded] = useState(false);
  const [viewedDate, setViewedDate] = useState<Date>(() => new Date());
  const [blocks, setBlocks] = useState<MobileBlock[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [showCompletedInDrawer, setShowCompletedInDrawer] = useState(false);
  const [expandedTasksByBlock, setExpandedTasksByBlock] = useState<Record<string, boolean>>({});
  const [subtaskComposerByItem, setSubtaskComposerByItem] = useState<Record<string, boolean>>({});
  const [subtaskDraftByItem, setSubtaskDraftByItem] = useState<Record<string, string>>({});
  const [itemDrawerPanel, setItemDrawerPanel] = useState<'details' | 'comments'>('details');
  const [itemDrawerFields, setItemDrawerFields] = useState<any[]>([]);
  const [itemDrawerFieldValues, setItemDrawerFieldValues] = useState<Record<string, any>>({});
  const [itemDrawerComments, setItemDrawerComments] = useState<Array<{ id: string; body: string; created_at: string; author_type?: string }>>([]);
  const [itemDrawerCommentsLoading, setItemDrawerCommentsLoading] = useState(false);
  const [itemDrawerCommentDraft, setItemDrawerCommentDraft] = useState('');
  const [itemDrawerCommentSubmitting, setItemDrawerCommentSubmitting] = useState(false);
  const [calendarAttachTree, setCalendarAttachTree] = useState<AttachTreeNode[]>([]);
  const [taskDrawerSearch, setTaskDrawerSearch] = useState('');
  const [taskDrawerListId, setTaskDrawerListId] = useState<string | null>(null);
  const [taskDrawerPendingKey, setTaskDrawerPendingKey] = useState<string | null>(null);
  const [taskDrawerLoading, setTaskDrawerLoading] = useState(false);
  const [taskDrawerExpandedFocals, setTaskDrawerExpandedFocals] = useState<Record<string, boolean>>({});
  const [taskDrawerExpandedLists, setTaskDrawerExpandedLists] = useState<Record<string, boolean>>({});

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [useTimeBlockContext, setUseTimeBlockContext] = useState(true);
  const [mobileMemoMode, setMobileMemoMode] = useState(false);
  const [mobileChatSourceMenuOpen, setMobileChatSourceMenuOpen] = useState(false);
  const [mobileChatSourceId, setMobileChatSourceId] = useState('current');
  const [mobileChatSourceContext, setMobileChatSourceContext] = useState<Record<string, string> | null>(null);
  const [textCaptureDraft, setTextCaptureDraft] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceBars, setVoiceBars] = useState<number[]>([8, 14, 10, 16, 11, 13, 9, 15]);

  const [mobileScope, setMobileScope] = useState<MobileScope>({ level: 'focals', focalId: null, listId: null });
  const [focals, setFocals] = useState<MobileFocal[]>([]);
  const [listsByFocal, setListsByFocal] = useState<Record<string, MobileList[]>>({});
  const [itemsByList, setItemsByList] = useState<Record<string, MobileItem[]>>({});
  const [focalsLoading, setFocalsLoading] = useState(false);
  const [focalsError, setFocalsError] = useState<string>('');
  const [viewportWidth, setViewportWidth] = useState<number>(() => (typeof window !== 'undefined' ? window.innerWidth : 390));

  const longPressTimer = useRef<number | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const mobileSourceMenuRef = useRef<HTMLDivElement | null>(null);
  const textCaptureRef = useRef<HTMLTextAreaElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const voiceRafRef = useRef<number | null>(null);
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
  const drawerGestureRef = useRef<{ startY: number; lastY: number; lastT: number; velocityY: number }>({
    startY: 0,
    lastY: 0,
    lastT: 0,
    velocityY: 0
  });
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
    const rootNodes = (calendarAttachTree || []) as AttachTreeNode[];
    const rows: IndexedList[] = [];
    for (const focalNode of rootNodes) {
      const focalRaw = typeof focalNode.id === 'string' ? focalNode.id : '';
      const focalId = focalRaw.startsWith('focal|') ? focalRaw.slice(6) : focalRaw;
      const focalName = focalNode.label || focalNode.name || focalNode.title || 'Space';
      const listNodes = (focalNode.children || []) as AttachTreeNode[];
      for (const listNode of listNodes) {
        const listRaw = typeof listNode.id === 'string' ? listNode.id : '';
        const listId = listRaw.startsWith('lane|') ? listRaw.slice(5) : listRaw;
        if (!listId) continue;
        const itemNodes = (listNode.children || []) as AttachTreeNode[];
        rows.push({
          id: listId,
          name: listNode.label || listNode.name || listNode.title || 'Untitled list',
          focalId,
          focalName: focalName || focalId || 'Space',
          items: itemNodes
            .map((itemNode) => {
              const raw = typeof itemNode.id === 'string' ? itemNode.id : '';
              const itemId = raw.startsWith('item|') ? raw.slice(5) : raw;
              if (!itemId) return null;
              return { id: itemId, title: itemNode.label || itemNode.name || itemNode.title || 'Untitled' };
            })
            .filter(Boolean) as Array<{ id: string; title: string }>
        });
      }
    }
    const seenListIds = new Set(rows.map((row) => row.id));
    Object.entries(listsByFocal).forEach(([focalId, lists]) => {
      const focalName = focals.find((entry) => entry.id === focalId)?.name || 'Space';
      lists.forEach((list) => {
        if (seenListIds.has(list.id)) return;
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
  }, [calendarAttachTree, focals, itemsByList, listsByFocal]);

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
    if (activeNav === 'docs') return 'Docs';
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
  const addSheetListOptions = useMemo(() => {
    if (!addSheet.focalId) return [];
    return listsByFocal[addSheet.focalId] || [];
  }, [addSheet.focalId, listsByFocal]);
  const addSheetItemOptions = useMemo(() => {
    if (!addSheet.listId) return [];
    return itemsByList[addSheet.listId] || [];
  }, [addSheet.listId, itemsByList]);
  const canSubmitAddSheet =
    !!addSheetName.trim() &&
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
      const nextFocals = (focalRows || []).map((entry: any) => ({ id: entry.id, name: entry.name }));
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

  const loadCalendarBlocks = async (): Promise<void> => {
    if (!user?.id) {
      setBlocks([]);
      return;
    }
    try {
      const events = await calendarService.getTimeBlocks(user.id);
      const dayStart = new Date(viewedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const mapped = (events || [])
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
          items: []
        }))
        .sort((a: MobileBlock, b: MobileBlock) => a.startMin - b.startMin);
      setBlocks(mapped);
    } catch (error) {
      console.error('Mobile calendar failed to load time blocks:', error);
      setBlocks([]);
    }
  };

  const loadCalendarAttachTree = async (): Promise<void> => {
    if (!user?.id) {
      setCalendarAttachTree([]);
      return;
    }
    try {
      const tree = await calendarService.getLinkableFocalTree(user.id);
      setCalendarAttachTree((tree || []) as AttachTreeNode[]);
    } catch (error) {
      console.error('Mobile calendar failed to load attach tree:', error);
      setCalendarAttachTree([]);
    }
  };

  const loadListItems = async (listId: string): Promise<void> => {
    if (!listId || itemsByList[listId]) return;
    try {
      const rows = await focalBoardService.getItemsByListId(listId);
      const mapped: MobileItem[] = (rows || []).map((entry: any) => ({
        id: entry.id,
        title: entry.title,
        actions: (entry.actions || []).map((action: any) => ({ id: action.id, title: action.title }))
      }));
      setItemsByList((prev) => ({ ...prev, [listId]: mapped }));
    } catch {
      setItemsByList((prev) => ({ ...prev, [listId]: [] }));
    }
  };

  useEffect(() => {
    if (activeNav !== 'focals') return;
    void loadFocals();
  }, [activeNav, user?.id]);

  useEffect(() => {
    if (activeNav !== 'focals') return;
    if (mobileScope.level === 'list' && mobileScope.listId) {
      void loadListItems(mobileScope.listId);
    }
  }, [activeNav, mobileScope.level, mobileScope.listId]);

  useEffect(() => {
    if (!addSheet.open) return;
    if ((addSheet.type === 'item' || addSheet.type === 'subitem') && addSheet.listId) {
      void loadListItems(addSheet.listId);
    }
  }, [addSheet.open, addSheet.type, addSheet.listId]);

  useEffect(() => {
    if (activeNav !== 'calendar') return;
    void loadCalendarBlocks();
  }, [activeNav, user?.id, viewedDate]);

  useEffect(() => {
    if (activeNav !== 'calendar') return;
    void loadCalendarAttachTree();
  }, [activeNav, user?.id]);

  useEffect(() => {
    const loadItemDrawerData = async (): Promise<void> => {
      if (!drawer.open || drawer.mode !== 'item' || !activeDrawerItem?.id) {
        setItemDrawerFields([]);
        setItemDrawerFieldValues({});
        setItemDrawerComments([]);
        return;
      }

      const listId = activeDrawerItem.listId || null;
      if (listId) {
        try {
          const [fields, valuesMap] = await Promise.all([
            listFieldService.getFields(listId),
            itemFieldValueService.bulkFetchForList(listId)
          ]);
          setItemDrawerFields((fields || []).filter((field: any) => field.is_pinned));
          setItemDrawerFieldValues(valuesMap?.[activeDrawerItem.id] || {});
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
        const rows = await commentsService.getItemComments(activeDrawerItem.id, 80);
        setItemDrawerComments(rows || []);
      } catch (error) {
        console.error('Failed loading item drawer comments:', error);
        setItemDrawerComments([]);
      } finally {
        setItemDrawerCommentsLoading(false);
      }
    };

    void loadItemDrawerData();
  }, [drawer.open, drawer.mode, activeDrawerItem?.id, activeDrawerItem?.listId]);

  useEffect(() => {
    if (view !== 'calendar' || activeNav !== 'calendar' || !currentBlockId) return;
    const container = timelineScrollRef.current;
    if (!container) return;
    const currentBlock = blocks.find((block) => block.id === currentBlockId);
    if (!currentBlock) return;
    const blockTop = (currentBlock.startMin - DAY_START_MIN) * PX_PER_MIN;
    const blockHeight = Math.max((currentBlock.endMin - currentBlock.startMin) * PX_PER_MIN, 74);
    const target = Math.max(0, blockTop + blockHeight / 2 - container.clientHeight / 2);
    container.scrollTo({ top: target, behavior: 'smooth' });
  }, [view, activeNav, currentBlockId, blocks]);

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
    setShowCompletedInDrawer(false);
    setDrawer({ open: true, mode: 'peek', blockId });
  };
  const openFullDrawer = (blockId: string): void => {
    setDrawerClosing(false);
    setShowCompletedInDrawer(false);
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
      setShowCompletedInDrawer(false);
    }, 220);
  };

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
    const target = (existing || []).find(
      (rule: any) => rule.selector_type === 'all' && !rule.selector_value && rule.list_id === listId
    );
    const mergedItemIds = [...new Set([...(target?.item_ids || []), ...itemIds])];
    await calendarService.upsertTimeBlockContentRule({
      id: target?.id,
      time_block_id: blockId,
      selector_type: 'all',
      selector_value: null,
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
      let created: any = null;
      try {
        created = await focalBoardService.createItem(chosenListId, user.id, title);
      } catch (firstError) {
        const fallbackList = indexedLists[0]?.id || null;
        if (!chosenListId && fallbackList) {
          chosenListId = fallbackList;
          setTaskDrawerListId(chosenListId);
          created = await focalBoardService.createItem(chosenListId, user.id, title);
        } else {
          throw firstError;
        }
      }
      if (!created?.id) return;
      if (chosenListId) {
        await upsertBlockContentItems(blockId, chosenListId, [created.id]);
      }
      addItemsIntoBlockState(blockId, [{ id: created.id, title: created.title || title, listId: chosenListId || null }]);
      setTaskDrawerSearch('');
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
      setMobileMemoMode(true);
      openTextCapture();
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
        await focalBoardService.createItem(addSheet.listId, user.id, name);
        setItemsByList((prev) => {
          const next = { ...prev };
          delete next[addSheet.listId as string];
          return next;
        });
        await loadListItems(addSheet.listId);
      } else if (addSheet.type === 'subitem' && addSheet.itemId && addSheet.listId) {
        await focalBoardService.createAction(addSheet.itemId, user.id, name);
        setItemsByList((prev) => {
          const next = { ...prev };
          delete next[addSheet.listId as string];
          return next;
        });
        await loadListItems(addSheet.listId);
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
              items: []
            }].sort((a, b) => a.startMin - b.startMin)
          );
        }

        await loadCalendarBlocks();
      }
      closeAddSheet();
      setAddSheetName('');
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

  useEffect(() => {
    return () => {
      stopVoiceAnimation();
    };
  }, []);

  const sendCaptureToAssistant = async (content: string): Promise<void> => {
    const text = content.trim();
    if (!text || chatSending) return;
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
    setCaptureMode('voice');
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

  const submitVoiceCapture = async (): Promise<void> => {
    const transcript = voiceTranscript.trim();
    stopVoiceAnimation();
    setCaptureMode('none');
    if (!transcript) return;
    await sendCaptureToAssistant(transcript);
  };

  const openTextCapture = (): void => {
    setCaptureMode('text');
    setQuickPanelOpen(false);
    window.setTimeout(() => textCaptureRef.current?.focus(), 30);
  };

  const submitTextCapture = async (): Promise<void> => {
    const text = textCaptureDraft.trim();
    if (!text) return;
    setTextCaptureDraft('');
    setCaptureMode('none');
    await sendCaptureToAssistant(text);
  };

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
        {(activeNav !== 'focals' || mobileScope.level === 'focals') && <span className="mobile-focals-back-spacer" />}
        <div className="mobile-date-pill">{scopeTitle}</div>
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
      <article className="mobile-focal-card muted">
        <header>
          <h3>Docs</h3>
        </header>
        <p>Mobile docs workspace is coming in the next pass.</p>
      </article>
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
              <article key={focal.id} className="mobile-focal-card" onClick={() => openFocal(focal.id)}>
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
      return (
        <div className="mobile-focals-surface list-level">
          {items.map((item) => (
            <article key={item.id} className="mobile-item-card">
              <div className="mobile-item-card-row">
                <button type="button" className="mobile-item-check" aria-label="Mark done">
                  <Circle size={15} />
                </button>
                <span>{item.title}</span>
              </div>
              {(item.actions || []).map((action) => (
                <div key={action.id} className="mobile-subitem-row">
                  <span>↳ {action.title}</span>
                </div>
              ))}
              <button type="button" className="mobile-add-subitem" onClick={() => void handleAddSubItem(item.id)}>
                <Plus size={14} />
                <span>Add sub-item</span>
              </button>
            </article>
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
              <div className="mobile-timeline" style={{ height: `${timelineHeight + 140}px` }}>
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

                <div className="mobile-block-layer">
                  {blocks.map((block) => {
                    const blockGap = 8;
                    const rawTop = (block.startMin - DAY_START_MIN) * PX_PER_MIN;
                    const rawHeight = Math.max((block.endMin - block.startMin) * PX_PER_MIN, 74);
                    const top = rawTop + blockGap / 2;
                    const height = Math.max(rawHeight - blockGap, 24);
                    const isCurrent = block.id === currentBlockId;
                    const visibleItems = block.items.filter((item) => !completed[item.id]);
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
                        onClick={() => openPeekDrawer(block.id)}
                        onPointerDown={() => startLongPress(block.id)}
                        onPointerUp={clearLongPress}
                        onPointerLeave={clearLongPress}
                      >
                        <div className="mobile-time-block-head">
                          <h3>{block.name}</h3>
                          <div className="mobile-time-block-head-right">
                            <span>{formatRange(block.startMin, block.endMin)}</span>
                            <button
                              type="button"
                              className="mobile-block-add-btn"
                              aria-label="Add task"
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
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={(event) =>
                                        setSubtaskDraftByItem((prev) => ({ ...prev, [item.id]: event.target.value }))
                                      }
                                      placeholder="Add subtask"
                                    />
                                    <button
                                      type="button"
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
                  {message.content}
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
                  void startVoiceCapture();
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
                <button type="button" onClick={() => void startVoiceCapture()}>
                  <Mic size={16} />
                  <span>Voice</span>
                </button>
                <button type="button" onClick={openTextCapture}>
                  <Type size={16} />
                  <span>Text</span>
                </button>
              </div>
            )}
            {captureMode === 'voice' && (
              <div className={`mobile-capture-surface voice ${voiceRecording ? 'recording' : ''}`.trim()}>
                <div className="mobile-capture-head">
                  <span>Voice capture</span>
                  <button type="button" onClick={() => { stopVoiceAnimation(); setCaptureMode('none'); }} aria-label="Close voice capture">
                    <X size={14} />
                  </button>
                </div>
                <div className="mobile-voice-bars" aria-hidden="true">
                  {voiceBars.map((height, idx) => (
                    <span key={`bar-${idx}`} style={{ height: `${height}px` }} />
                  ))}
                </div>
                <div className="mobile-capture-transcript">
                  {voiceTranscript || 'Listening…'}
                </div>
                <button type="button" className="mobile-capture-send" onClick={() => void submitVoiceCapture()} disabled={!voiceTranscript.trim() || chatSending}>
                  <Send size={16} />
                </button>
              </div>
            )}
            {captureMode === 'text' && (
              <div className="mobile-text-capture-bar">
                <textarea
                  ref={textCaptureRef}
                  rows={1}
                  value={textCaptureDraft}
                  placeholder="Capture quickly…"
                  onChange={(event) => {
                    setTextCaptureDraft(event.target.value);
                    const target = event.target;
                    target.style.height = '0px';
                    target.style.height = `${Math.min(target.scrollHeight, 148)}px`;
                  }}
                />
                <button type="button" className="mobile-capture-send" onClick={() => void submitTextCapture()} disabled={!textCaptureDraft.trim() || chatSending}>
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
                <span>Docs</span>
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
                  if (captureMode === 'voice') {
                    stopVoiceAnimation();
                  }
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
            />
            <div
              className="mobile-add-sheet-head"
              onTouchStart={onAddSheetTouchStart}
              onTouchMove={onAddSheetTouchMove}
              onTouchEnd={onAddSheetTouchEnd}
            >
              <strong>
                {addSheet.type === 'space' && 'Add Space'}
                {addSheet.type === 'list' && 'Add List'}
                {addSheet.type === 'item' && 'Add Item'}
                {addSheet.type === 'subitem' && 'Add Sub-item'}
                {addSheet.type === 'event' && 'Add Event'}
              </strong>
              <button
                type="button"
                aria-label="Close add drawer"
                onTouchStart={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  closeAddSheet();
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div className={`mobile-add-sheet-body ${addSheet.type === 'event' ? 'event-editor' : ''}`.trim()}>
              {(addSheet.type === 'list' || addSheet.type === 'item' || addSheet.type === 'subitem') && (
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

              {(addSheet.type === 'item' || addSheet.type === 'subitem') && (
                <label className="mobile-add-field">
                  <span>List</span>
                  <select
                    value={addSheet.listId || ''}
                    onChange={(event) => {
                      const nextList = event.target.value || null;
                      setAddSheet((prev) => ({ ...prev, listId: nextList, itemId: null }));
                    }}
                  >
                    <option value="">Select list</option>
                    {addSheetListOptions.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {addSheet.type === 'subitem' && (
                <label className="mobile-add-field">
                  <span>Item</span>
                  <select
                    value={addSheet.itemId || ''}
                    onChange={(event) => {
                      const nextItem = event.target.value || null;
                      setAddSheet((prev) => ({ ...prev, itemId: nextItem }));
                    }}
                  >
                    <option value="">Select item</option>
                    {addSheetItemOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className={`mobile-add-field ${addSheet.type === 'event' ? 'mobile-event-title-field' : ''}`.trim()}>
                {addSheet.type !== 'event' && <span>Name</span>}
                <input
                  value={addSheetName}
                  onChange={(event) => setAddSheetName(event.target.value)}
                  placeholder={addSheet.type === 'event' ? 'Event title' : 'Enter name'}
                />
              </label>

              {addSheet.type === 'event' && (
                <>
                  <div className="mobile-add-time-grid">
                    <label className="mobile-add-field">
                      <span>Start</span>
                      <input type="time" value={addSheetStart} onChange={(event) => setAddSheetStart(event.target.value)} />
                    </label>
                    <label className="mobile-add-field">
                      <span>End</span>
                      <input type="time" value={addSheetEnd} onChange={(event) => setAddSheetEnd(event.target.value)} />
                    </label>
                  </div>

                  <div className="mobile-add-inline-row">
                    <button
                      type="button"
                      className="mobile-add-inline-trigger"
                      onClick={() => setAddSheetRecurrenceExpanded((prev) => !prev)}
                    >
                      <span>Repeat</span>
                      <strong>
                        {addSheetRecurrence === 'none'
                          ? 'None'
                          : addSheetRecurrence === 'daily'
                            ? 'Daily'
                            : addSheetRecurrence === 'weekly'
                              ? 'Weekly'
                              : 'Monthly'}
                      </strong>
                    </button>
                  </div>

                  {addSheetRecurrenceExpanded && (
                    <div className="mobile-add-inline-options">
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

                  <label className="mobile-add-field mobile-event-description-field">
                    <textarea
                      value={addSheetDescription}
                      onChange={(event) => setAddSheetDescription(event.target.value)}
                      placeholder="Add description"
                      rows={3}
                    />
                  </label>
                </>
              )}
            </div>
            <div className="mobile-add-sheet-actions">
              <button type="button" className="ghost" onClick={closeAddSheet}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={() => void submitAddSheet()} disabled={!canSubmitAddSheet}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {drawer.open && (
        <div
          className={`mobile-drawer ${drawer.mode} ${isDrawerDragging ? 'dragging' : ''} ${drawerClosing ? 'closing' : ''}`.trim()}
          style={{ transform: `translateY(${drawerDragY}px)` }}
        >
          <div
            className="mobile-drawer-grab"
            onTouchStart={onDrawerTouchStart}
            onTouchMove={onDrawerTouchMove}
            onTouchEnd={onDrawerTouchEnd}
          />
          <div className="mobile-drawer-head">
            <Clock3 size={15} />
            <strong>
              {drawer.mode === 'addTask'
                ? 'Add Task'
                : drawer.mode === 'item'
                  ? activeDrawerItem?.name || 'Item Details'
                  : activeDrawerBlock?.name || 'Time Block'}
            </strong>
            <button type="button" onClick={closeDrawer}>
              <X size={14} />
            </button>
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
                        disabled={taskDrawerPendingKey === 'create'}
                        onClick={() => void createNewTaskFromDrawer(drawer.blockId as string)}
                      >
                        Create New
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {drawer.mode !== 'item' && drawer.mode !== 'addTask' && (
              <>
                <p className="mobile-drawer-description">
                  {activeDrawerBlock?.description?.trim() || 'No description yet.'}
                </p>
                <div className="mobile-drawer-linked">
                  <h4>Attached items</h4>
                  {activeDrawerBlock?.items?.length ? (
                    <div className="mobile-drawer-linked-list">
                      {activeDrawerBlock.items
                        .filter((item) => showCompletedInDrawer || !completed[item.id])
                        .map((item) => (
                        <div key={item.id} className="mobile-drawer-linked-item">
                          <div className="mobile-drawer-linked-title">{item.name}</div>
                          {!!item.subItems?.length && (
                            <div className="mobile-drawer-linked-subtasks">
                              {item.subItems.map((subItem) => (
                                <div key={subItem.id} className="mobile-drawer-linked-subitem">
                                  ↳ {subItem.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {!!activeDrawerBlock.items.filter((item) => completed[item.id]).length && (
                        <button
                          type="button"
                          className="mobile-drawer-show-completed"
                          onClick={(event) => {
                            event.stopPropagation();
                            setShowCompletedInDrawer((prev) => !prev);
                          }}
                        >
                          {showCompletedInDrawer
                            ? 'Hide completed'
                            : `Show completed (${activeDrawerBlock.items.filter((item) => completed[item.id]).length})`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mobile-drawer-empty">No attached items yet.</div>
                  )}
                </div>
              </>
            )}
            {drawer.mode === 'edit' && 'Placeholder edit controls.'}
            {drawer.mode === 'item' && activeDrawerItem && (
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
                    <h4>{activeDrawerItem.name}</h4>
                    <p>{activeDrawerBlock?.description?.trim() || 'No description on the parent time block.'}</p>
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
      )}
    </section>
  );
}
