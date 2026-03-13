import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, TouchEvent } from 'react';
import {
  Settings,
  UserCircle,
  X,
  Send,
  Mic,
  CalendarPlus,
  Clock3,
  Plus,
  Circle,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  ArrowLeft,
  Folder,
  SlidersHorizontal,
  Trash2
} from 'lucide-react';
import { CalendarIcon, DatabaseIcon } from '../../icons';
import MarkdownText from '../MarkdownText';
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

type MobileBlockSubItem = {
  id: string;
  name: string;
  description?: string;
  listId?: string;
  parentItemId?: string;
  subtask_status?: string | null;
  subtask_status_id?: string | null;
};

type MobileBlockItem = {
  id: string;
  name: string;
  description?: string;
  status?: string | null;
  status_id?: string | null;
  subItems?: MobileBlockSubItem[];
  focalId?: string;
  listId?: string;
};

type MobileBlockTaskLinkedItem = MobileBlockItem & {
  blockTaskItemId: string;
  itemId: string;
  completedInContext: boolean;
  completionNote?: string | null;
  completedAt?: string | null;
};

type MobileBlockTask = {
  id: string;
  title: string;
  description?: string | null;
  sortOrder?: number;
  isCompleted?: boolean;
  linkedItems: MobileBlockTaskLinkedItem[];
};

type MobileBlock = {
  id: string;
  name: string;
  description?: string;
  startMin: number;
  endMin: number;
  recurrence?: AddSheetRecurrence;
  blockTasks?: MobileBlockTask[];
  items: MobileBlockItem[];
};

type AddSheetRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

type DrawerState = {
  open: boolean;
  mode: 'peek' | 'full' | 'edit' | 'item' | 'addTask';
  blockId: string | null;
  itemId?: string | null;
};

type MobileFullDrawerOrigin = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
};

type MobileEditScopeMode = 'this_event' | 'all_future' | 'next_window';

type MobileEditScopeConfirmState = {
  open: boolean;
  kind: 'save' | 'delete';
  patch?: {
    title: string;
    description: string;
    start: string;
    end: string;
    recurrence: AddSheetRecurrence;
    recurrenceConfig: { unit: 'day' | 'week' | 'month'; interval: number; limitType: 'indefinite' } | null;
  };
};

type MobileSubtaskEditorState = {
  open: boolean;
  parentItemId: string | null;
  subtask: MobileBlockSubItem | null;
  title: string;
  description: string;
  saving: boolean;
  error: string;
};

type AddSheetState = {
  open: boolean;
  type: 'space' | 'list' | 'item' | 'subitem' | 'event' | 'doc' | 'voice';
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
  actions?: Array<{ id: string; title: string; description?: string | null; subtask_status?: string | null; subtask_status_id?: string | null }>;
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

const MOBILE_UNIVERSAL_ADD_TYPES: Array<{
  key: AddSheetState['type'];
  label: string;
  shortLabel: string;
}> = [
  { key: 'item', label: 'Item', shortLabel: 'Item' },
  { key: 'subitem', label: 'Task', shortLabel: 'Task' },
  { key: 'event', label: 'Time Block', shortLabel: 'Block' },
  { key: 'doc', label: 'Note', shortLabel: 'Note' },
  { key: 'voice', label: 'Voice', shortLabel: 'Voice' }
];

type MobileStatusOption = {
  id?: string;
  key: string;
  name: string;
  color?: string;
  is_default?: boolean;
};

type StatusSheetState = {
  open: boolean;
  step: 'select' | 'note';
  entityType: 'item' | 'action';
  listId: string | null;
  targetId: string | null;
  parentItemId: string | null;
  title: string;
  currentStatusLabel: string;
  currentStatusKey: string | null;
  selectedStatus: MobileStatusOption | null;
  loading: boolean;
  saving: boolean;
  error: string;
};

type BlockTaskCompletionSheetState = {
  open: boolean;
  blockId: string | null;
  blockTaskId: string | null;
  blockTaskItemId: string | null;
  itemId: string | null;
  listId: string | null;
  title: string;
  note: string;
  followUpTasks: string;
  statuses: MobileStatusOption[];
  selectedStatus: MobileStatusOption | null;
  loading: boolean;
  saving: boolean;
  error: string;
};

const DAY_START_MIN = 6 * 60;
const DAY_END_MIN = 22 * 60;
const PX_PER_MIN = 2.2;
const MOBILE_CALENDAR_ZOOM_LEVELS = [0.85, 1, 1.2, 1.45, 1.75] as const;
const MIN_TIME_BLOCK_MINUTES = 15;

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

const isPendingLikeStatusKey = (value: string | null | undefined): boolean =>
  !value || /(pending|todo|to_do|not_started|needs_action|backlog|queued|inbox)/i.test(value);

const sortMobileBlockItems = (
  items: MobileBlockItem[]
): MobileBlockItem[] =>
  [...items].sort((a, b) => {
    const aDone = !isPendingLikeStatusKey(a.status);
    const bDone = !isPendingLikeStatusKey(b.status);
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

const normalizeLinkedEntityId = (value: string | null | undefined): string => {
  if (!value) return '';
  if (value.startsWith('item|')) return value.slice(5);
  if (value.startsWith('action|')) return value.slice(7);
  if (value.startsWith('lane|')) return value.slice(5);
  if (value.startsWith('focal|')) return value.slice(6);
  return value;
};

const countMobileBlockTaskRows = (blockTasks: MobileBlockTask[] | undefined): number =>
  (blockTasks || []).reduce((total, task) => total + 1 + (task.linkedItems?.length || 0), 0);

const filterDirectItemsAgainstBlockTasks = (
  items: MobileBlockItem[],
  blockTasks: MobileBlockTask[] | undefined
): MobileBlockItem[] => {
  const nestedIds = new Set((blockTasks || []).flatMap((task) => task.linkedItems.map((linked) => linked.itemId)));
  return items.filter((item) => !nestedIds.has(item.id));
};

const mapThreadComment = (entry: any) => ({
  id: entry.id,
  body: entry.content || entry.body || '',
  created_at: entry.created_at,
  author_type: entry.author_type || entry.source || 'user',
  user_id: entry.user_id || null
});

export default function MobileCalendarWireframe(): JSX.Element {
  const { user } = useAuth();
  const [view, setView] = useState<'calendar' | 'ai'>('calendar');
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, mode: 'peek', blockId: null });
  const [editOverlayBlockId, setEditOverlayBlockId] = useState<string | null>(null);
  const [fullDrawerOrigin, setFullDrawerOrigin] = useState<MobileFullDrawerOrigin | null>(null);
  const [editDrawerName, setEditDrawerName] = useState('');
  const [editDrawerDescription, setEditDrawerDescription] = useState('');
  const [editDrawerStart, setEditDrawerStart] = useState('09:00');
  const [editDrawerEnd, setEditDrawerEnd] = useState('10:00');
  const [editDrawerRecurrence, setEditDrawerRecurrence] = useState<AddSheetRecurrence>('none');
  const [editDrawerRecurrenceExpanded, setEditDrawerRecurrenceExpanded] = useState(false);
  const [editDrawerSaving, setEditDrawerSaving] = useState(false);
  const [mobileEditScopeConfirm, setMobileEditScopeConfirm] = useState<MobileEditScopeConfirmState>({ open: false, kind: 'save' });
  const [mobileEditScopeMode, setMobileEditScopeMode] = useState<MobileEditScopeMode>('this_event');
  const [mobileEditScopeCount, setMobileEditScopeCount] = useState('4');
  const [mobileEditScopeCadence, setMobileEditScopeCadence] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [subtaskEditor, setSubtaskEditor] = useState<MobileSubtaskEditorState>({
    open: false,
    parentItemId: null,
    subtask: null,
    title: '',
    description: '',
    saving: false,
    error: ''
  });
  const [isDrawerDragging, setIsDrawerDragging] = useState(false);
  const [drawerDragY, setDrawerDragY] = useState(0);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isViewGestureDragging, setIsViewGestureDragging] = useState(false);
  const [viewDragX, setViewDragX] = useState(0);
  const [activeNav, setActiveNav] = useState<'docs' | 'focals' | 'calendar'>('calendar');
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const [expandedTasksByBlock, setExpandedTasksByBlock] = useState<Record<string, boolean>>({});
  const [expandedItemsInList, setExpandedItemsInList] = useState<Record<string, boolean>>({});
  const [subtaskComposerByItem, setSubtaskComposerByItem] = useState<Record<string, boolean>>({});
  const [subtaskDraftByItem, setSubtaskDraftByItem] = useState<Record<string, string>>({});
  const [itemDrawerPanel, setItemDrawerPanel] = useState<'details' | 'activity'>('details');
  const [blockDrawerPanel, setBlockDrawerPanel] = useState<'details' | 'activity'>('details');
  const [itemDrawerFields, setItemDrawerFields] = useState<any[]>([]);
  const [itemDrawerFieldValues, setItemDrawerFieldValues] = useState<Record<string, any>>({});
  const [itemDrawerTitleDraft, setItemDrawerTitleDraft] = useState('');
  const [itemDrawerDescriptionDraft, setItemDrawerDescriptionDraft] = useState('');
  const [itemDrawerComments, setItemDrawerComments] = useState<
    Array<{ id: string; body: string; created_at: string; author_type?: string; user_id?: string | null }>
  >([]);
  const [itemDrawerCommentsLoading, setItemDrawerCommentsLoading] = useState(false);
  const [itemDrawerCommentDraft, setItemDrawerCommentDraft] = useState('');
  const [itemDrawerCommentSubmitting, setItemDrawerCommentSubmitting] = useState(false);
  const [blockDrawerActivityMessages, setBlockDrawerActivityMessages] = useState<ChatMessage[]>([]);
  const [blockDrawerActivityDraft, setBlockDrawerActivityDraft] = useState('');
  const [blockDrawerActivitySending, setBlockDrawerActivitySending] = useState(false);
  const [statusSheet, setStatusSheet] = useState<StatusSheetState>({
    open: false,
    step: 'select',
    entityType: 'item',
    listId: null,
    targetId: null,
    parentItemId: null,
    title: '',
    currentStatusLabel: '',
    currentStatusKey: null,
    selectedStatus: null,
    loading: false,
    saving: false,
    error: ''
  });
  const [blockTaskCompletionSheet, setBlockTaskCompletionSheet] = useState<BlockTaskCompletionSheetState>({
    open: false,
    blockId: null,
    blockTaskId: null,
    blockTaskItemId: null,
    itemId: null,
    listId: null,
    title: '',
    note: '',
    followUpTasks: '',
    statuses: [],
    selectedStatus: null,
    loading: false,
    saving: false,
    error: ''
  });
  const [pendingBlockTaskToggleIds, setPendingBlockTaskToggleIds] = useState<Record<string, boolean>>({});
  const [statusNoteDraft, setStatusNoteDraft] = useState('');
  const [taskDrawerSearch, setTaskDrawerSearch] = useState('');
  const [taskDrawerListId, setTaskDrawerListId] = useState<string | null>(null);
  const [taskDrawerPendingKey, setTaskDrawerPendingKey] = useState<string | null>(null);
  const [taskDrawerLoading, setTaskDrawerLoading] = useState(false);
  const [taskDrawerExpandedFocals, setTaskDrawerExpandedFocals] = useState<Record<string, boolean>>({});
  const [taskDrawerExpandedLists, setTaskDrawerExpandedLists] = useState<Record<string, boolean>>({});
  const [taskDrawerListPickerOpen, setTaskDrawerListPickerOpen] = useState(false);
  const [taskDrawerError, setTaskDrawerError] = useState('');
  const [taskDrawerEntryType, setTaskDrawerEntryType] = useState<'linked_item' | 'block_task'>('linked_item');
  const [taskDrawerTargetBlockTaskId, setTaskDrawerTargetBlockTaskId] = useState<string | null>(null);
  const [optimisticAttachedByBlock, setOptimisticAttachedByBlock] = useState<Record<string, string[]>>({});

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [applyingMobileProposalId, setApplyingMobileProposalId] = useState<string | null>(null);
  const [approvedMobileProposalIds, setApprovedMobileProposalIds] = useState<Record<string, boolean>>({});
  const [dismissedMobileProposalIds, setDismissedMobileProposalIds] = useState<Record<string, boolean>>({});
  const [mobileProposalNotes, setMobileProposalNotes] = useState<Record<string, string>>({});
  const [useTimeBlockContext, setUseTimeBlockContext] = useState(true);
  const [mobileCalendarZoom, setMobileCalendarZoom] = useState<number>(1.2);
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
  const previousMobileCalendarZoomRef = useRef<number>(1.2);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const blockDrawerActivityRef = useRef<HTMLDivElement | null>(null);
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
  const drawerOpenedAtRef = useRef(0);
  const addSheetOpenedAtRef = useRef(0);
  const itemDrawerGestureRef = useRef<{ startX: number; startY: number }>({ startX: 0, startY: 0 });
  const blockDrawerGestureRef = useRef<{ startX: number; startY: number }>({ startX: 0, startY: 0 });

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
    () =>
      activeDrawerBlock && drawer.itemId
        ? activeDrawerBlock.items.find((item) => item.id === drawer.itemId) ||
          activeDrawerBlock.blockTasks?.flatMap((task) => task.linkedItems || []).find((item) => item.itemId === drawer.itemId || item.id === drawer.itemId) ||
          null
        : null,
    [activeDrawerBlock, drawer.itemId]
  );
  const activeDrawerScopedListItem = useMemo(() => {
    if (!drawer.itemId || !mobileScope.listId) return null;
    const item = (itemsByList[mobileScope.listId] || []).find((entry) => entry.id === drawer.itemId) || null;
    if (!item) return null;
    return {
      id: item.id,
      name: item.title,
      listId: mobileScope.listId || undefined,
      description: item.description || '',
      status: item.status || null,
      status_id: item.status_id || null,
      subItems: (item.actions || []).map((action) => ({
        id: action.id,
        name: action.title,
        description: action.description || '',
        listId: mobileScope.listId || undefined,
        parentItemId: item.id,
        subtask_status: action.subtask_status || null,
        subtask_status_id: action.subtask_status_id || null
      }))
    };
  }, [drawer.itemId, itemsByList, mobileScope.listId]);
  const resolvedDrawerItem = activeDrawerItem || activeDrawerScopedListItem;
  const getVisibleSubItems = (subItems: MobileBlockSubItem[] | undefined, includeCompleted = false): MobileBlockSubItem[] =>
    (subItems || []).filter((subItem) => includeCompleted || isStatusIncomplete(getSubtaskStatusEntry(subItem)?.key || subItem.subtask_status));
  const getSortedSubItems = (subItems: MobileBlockSubItem[] | undefined, includeCompleted = true): MobileBlockSubItem[] =>
    [...(subItems || [])].sort((a, b) => {
      const aPending = isStatusIncomplete(getSubtaskStatusEntry(a)?.key || a.subtask_status);
      const bPending = isStatusIncomplete(getSubtaskStatusEntry(b)?.key || b.subtask_status);
      if (aPending === bPending) return 0;
      return aPending ? -1 : 1;
    }).filter((subItem) => includeCompleted || isStatusIncomplete(getSubtaskStatusEntry(subItem)?.key || subItem.subtask_status));
  const getItemStatusEntry = (item: { listId?: string; status?: string | null; status_id?: string | null }) => {
    const listId = item.listId || '';
    const statusSet = listStatusesByList[listId] || [];
    if (item.status_id) {
      const byId = statusSet.find((entry) => entry.id === item.status_id);
      if (byId) return byId;
    }
    if (item.status) {
      const byKey = statusSet.find((entry) => entry.key === item.status);
      if (byKey) return byKey;
    }
    return statusSet.find((entry) => entry.is_default) || null;
  };
  const getSubtaskStatusEntry = (subItem: MobileBlockSubItem) => {
    const listId = subItem.listId || '';
    const statusSet = subtaskStatusesByList[listId] || [];
    if (subItem.subtask_status_id) {
      const byId = statusSet.find((entry) => entry.id === subItem.subtask_status_id);
      if (byId) return byId;
    }
    if (subItem.subtask_status) {
      const byKey = statusSet.find((entry) => entry.key === subItem.subtask_status);
      if (byKey) return byKey;
    }
    return statusSet.find((entry) => entry.is_default) || null;
  };
  const isStatusIncomplete = (statusKey: string | null | undefined) => isPendingLikeStatusKey(statusKey);
  const closeStatusSheet = (): void => {
    setStatusSheet({
      open: false,
      step: 'select',
      entityType: 'item',
      listId: null,
      targetId: null,
      parentItemId: null,
      title: '',
      currentStatusLabel: '',
      currentStatusKey: null,
      selectedStatus: null,
      loading: false,
      saving: false,
      error: ''
    });
    setStatusNoteDraft('');
  };

  const selectedFocal = useMemo(
    () => focals.find((focal) => focal.id === mobileScope.focalId) || null,
    [focals, mobileScope.focalId]
  );
  const selectedList = useMemo(
    () => (mobileScope.focalId ? (listsByFocal[mobileScope.focalId] || []).find((list) => list.id === mobileScope.listId) || null : null),
    [listsByFocal, mobileScope.focalId, mobileScope.listId]
  );
  const listMetaById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; focalId: string; focalName: string }>();
    Object.entries(listsByFocal).forEach(([focalId, lists]) => {
      const focalName = focals.find((entry) => entry.id === focalId)?.name || 'Space';
      lists.forEach((list) => {
        map.set(list.id, {
          id: list.id,
          name: list.name,
          focalId,
          focalName
        });
      });
    });
    return map;
  }, [focals, listsByFocal]);

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
  const taskDrawerSelectedList = useMemo(
    () => indexedLists.find((list) => list.id === taskDrawerListId) || null,
    [indexedLists, taskDrawerListId]
  );
  const mobilePxPerMin = PX_PER_MIN * mobileCalendarZoom;
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

  const timelineHeight = (DAY_END_MIN - DAY_START_MIN) * mobilePxPerMin;
  const nowTop = Math.min(Math.max((nowMin - DAY_START_MIN) * mobilePxPerMin, 0), timelineHeight);

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

  const navOrder: Array<'focals' | 'calendar'> = ['focals', 'calendar'];
  const activeNavIndex = Math.max(0, navOrder.indexOf(activeNav as 'focals' | 'calendar'));
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
    (addSheet.type !== 'subitem' || (!!addSheet.listId && !!addSheet.itemId)) &&
    addSheet.type !== 'voice';

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
      const blockTaskEntries = await Promise.all(
        visibleEvents.map(async (event: any) => [
          event.id,
          await calendarService.getBlockTasksWithItems({
            timeBlockId: event.id,
            scheduledStartUtc: new Date(event.start).toISOString()
          })
        ] as const)
      );
      const blockTasksByEventId = Object.fromEntries(blockTaskEntries) as Record<string, any[]>;
      const attachedItemIds = [...new Set(
        contentRuleEntries.flatMap(([, rules]) =>
          (rules || []).flatMap((rule: any) => (rule?.item_ids || []).map((itemId: string) => normalizeLinkedEntityId(itemId)).filter(Boolean))
        )
      )] as string[];
      const blockTaskItemIds = [...new Set(
        blockTaskEntries.flatMap(([, tasks]) =>
          (tasks || []).flatMap((task: any) =>
            (task?.linkedItems || []).map((linked: any) => normalizeLinkedEntityId(linked?.itemId)).filter(Boolean)
          )
        )
      )] as string[];
      const resolvedLookupIds = [...new Set([...attachedItemIds, ...blockTaskItemIds])];
      const listIdsToHydrate = [...new Set(
        contentRuleEntries.flatMap(([, rules]) =>
          (rules || []).map((rule: any) => rule?.list_id).filter(Boolean)
        )
      )];
      const initialListRows = await Promise.all(
        listIdsToHydrate.map(async (listId) => [listId, await focalBoardService.getItemsByListId(listId)] as const)
      );
      const resolvedAttachedRows = resolvedLookupIds.length > 0 ? await focalBoardService.getItemsByIds(user.id, resolvedLookupIds) : [];
      const actualListIdsToHydrate = [...new Set(
        resolvedAttachedRows.map((row: any) => row?.lane_id).filter((listId: string | null | undefined) => Boolean(listId) && !listIdsToHydrate.includes(listId))
      )] as string[];
      const extraListRows = await Promise.all(
        actualListIdsToHydrate.map(async (listId) => [listId, await focalBoardService.getItemsByListId(listId)] as const)
      );
      const listRows = [...initialListRows, ...extraListRows];
      const itemsByListId = new Map<string, any[]>(listRows);
      const resolvedItemById = new Map<string, any>();
      resolvedAttachedRows.forEach((row: any) => {
        const normalizedId = normalizeLinkedEntityId(row?.id);
        if (!normalizedId) return;
        resolvedItemById.set(normalizedId, row);
      });
      const itemTitleById = new Map<string, string>();
      listRows.forEach(([, rows]) => {
        (rows || []).forEach((row: any) => {
          const normalizedId = normalizeLinkedEntityId(row?.id);
          if (!normalizedId) return;
          if (row?.title) itemTitleById.set(normalizedId, row.title);
        });
      });
      resolvedAttachedRows.forEach((row: any) => {
        const normalizedId = normalizeLinkedEntityId(row?.id);
        if (!normalizedId) return;
        if (row?.title) itemTitleById.set(normalizedId, row.title);
      });
      const hydrateMobileBlockItem = (itemId: string, listIdHint?: string | null): MobileBlockItem | null => {
        const normalizedItemId = normalizeLinkedEntityId(itemId);
        if (!normalizedItemId) return null;
        const fallbackIndexedList = listIdHint ? indexedLists.find((list) => list.id === listIdHint) || null : null;
        const resolvedRow = resolvedItemById.get(normalizedItemId);
        const actualListId = resolvedRow?.lane_id || listIdHint || undefined;
        const listRowsForActualList = actualListId ? (itemsByListId.get(actualListId) || []) : [];
        const rowById = new Map(listRowsForActualList.map((row: any) => [normalizeLinkedEntityId(row.id), row]));
        const row = resolvedRow || rowById.get(normalizedItemId);
        const actualListMeta = (actualListId ? listMetaById.get(actualListId) : null) || fallbackIndexedList || null;
        const actualIndexedList = (actualListId ? indexedLists.find((list) => list.id === actualListId) : null) || fallbackIndexedList || null;
        return {
          id: normalizedItemId,
          name:
            row?.title ||
            itemTitleById.get(normalizedItemId) ||
            actualIndexedList?.items.find((item) => normalizeLinkedEntityId(item.id) === normalizedItemId)?.title ||
            fallbackIndexedList?.items.find((item) => normalizeLinkedEntityId(item.id) === normalizedItemId)?.title ||
            'Untitled',
          description: row?.description || '',
          status: row?.status || null,
          status_id: row?.status_id || null,
          focalId: actualListMeta?.focalId,
          listId: actualListId,
          subItems: (row?.actions || []).map((action: any) => ({
            id: action.id,
            name: action.title || 'Untitled subtask',
            description: action.description || '',
            listId: actualListId,
            parentItemId: normalizedItemId,
            subtask_status: action.subtask_status || action.status || null,
            subtask_status_id: action.subtask_status_id || null
          }))
        };
      };

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
          const safeEnd = Number.isNaN(end.getTime())
            ? new Date(start.getTime() + MIN_TIME_BLOCK_MINUTES * 60 * 1000)
            : end;
          return start < dayEnd && safeEnd > dayStart;
        })
        .map((event: any) => {
          const rawEnd = new Date(event.end || event.start);
          const safeEnd = Number.isNaN(rawEnd.getTime())
            ? new Date(new Date(event.start).getTime() + MIN_TIME_BLOCK_MINUTES * 60 * 1000)
            : rawEnd;
          return {
            id: event.id,
            name: event.title || 'Untitled',
            description: event.description || '',
            startMin: minutesFromDate(event.start),
            endMin: Math.max(minutesFromDate(safeEnd.toISOString()), minutesFromDate(event.start) + MIN_TIME_BLOCK_MINUTES),
            recurrence:
              event.recurrence === 'daily' || event.recurrence === 'weekly' || event.recurrence === 'monthly'
                ? event.recurrence
                : 'none',
            blockTasks: (blockTasksByEventId[event.id] || []).map((task: any) => ({
              id: task.id,
              title: task.title || 'Untitled task',
              description: task.description || '',
              linkedItems: (task.linkedItems || [])
                .map((linked: any) => {
                  const hydratedItem = hydrateMobileBlockItem(linked.itemId, null);
                  if (!hydratedItem) return null;
                  return {
                    ...hydratedItem,
                    blockTaskItemId: linked.blockTaskItemId,
                    itemId: linked.itemId,
                    completedInContext: Boolean(linked.completedInContext),
                    completionNote: linked.completionNote || null,
                    completedAt: linked.completedAt || null
                  };
                })
                .filter(Boolean)
            })),
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
                  for (const itemId of rule?.item_ids || []) {
                    const normalizedItemId = normalizeLinkedEntityId(itemId);
                    if (!normalizedItemId || seenItemIds.has(normalizedItemId)) continue;
                    const hydratedItem = hydrateMobileBlockItem(normalizedItemId, listId);
                    if (!hydratedItem) continue;
                    seenItemIds.add(normalizedItemId);
                    hydratedItems.push(hydratedItem);
                  }
                }
              return hydratedItems;
            })()
          };
        })
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
          description: action.description || '',
          subtask_status: action.subtask_status || null,
          subtask_status_id: action.subtask_status_id || null
        }))
      }));
      setItemsByList((prev) => ({ ...prev, [listId]: mapped }));
    } catch {
      setItemsByList((prev) => ({ ...prev, [listId]: [] }));
    }
  };

  const loadStatusesForList = async (
    listId: string
  ): Promise<{ itemStatuses: MobileStatusOption[]; actionStatuses: MobileStatusOption[] }> => {
    if (!listId) return { itemStatuses: [], actionStatuses: [] };
    try {
      const [itemStatuses, actionStatuses] = await Promise.all([
        focalBoardService.getLaneStatuses(listId),
        focalBoardService.getLaneSubtaskStatuses(listId)
      ]);
      const nextItemStatuses = (itemStatuses || []).map((entry: any) => ({
        id: entry.id,
        key: entry.key || 'pending',
        name: entry.name || entry.key || 'To do',
        color: entry.color || undefined,
        is_default: Boolean(entry.is_default)
      }));
      const nextActionStatuses = (actionStatuses || []).map((entry: any) => ({
        id: entry.id,
        key: entry.key || 'not_started',
        name: entry.name || entry.key || 'Not started',
        color: entry.color || undefined,
        is_default: Boolean(entry.is_default)
      }));
      setListStatusesByList((prev) => ({
        ...prev,
        [listId]: nextItemStatuses
      }));
      setSubtaskStatusesByList((prev) => ({
        ...prev,
        [listId]: nextActionStatuses
      }));
      return { itemStatuses: nextItemStatuses, actionStatuses: nextActionStatuses };
    } catch (error) {
      console.error('Failed to load list statuses for mobile list view:', error);
      setListStatusesByList((prev) => ({ ...prev, [listId]: [] }));
      setSubtaskStatusesByList((prev) => ({ ...prev, [listId]: [] }));
      return { itemStatuses: [], actionStatuses: [] };
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
        setItemDrawerTitleDraft('');
        setItemDrawerDescriptionDraft('');
        setItemDrawerComments([]);
        return;
      }

      setItemDrawerTitleDraft(resolvedDrawerItem.name || '');
      setItemDrawerDescriptionDraft(resolvedDrawerItem.description || '');

      const listId = resolvedDrawerItem.listId || null;
      if (listId) {
        try {
          const [fields, valuesMap] = await Promise.all([
            listFieldService.getFields(listId),
            itemFieldValueService.bulkFetchForList(listId)
          ]);
          setItemDrawerFields((fields || []).filter((field: any) => !field?.is_primary && field?.type !== 'status'));
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
        const [legacyRows, scopedRows] = await Promise.all([
          commentsService.getItemComments(resolvedDrawerItem.id, 80),
          user?.id ? focalBoardService.getScopedComments('item', resolvedDrawerItem.id, user.id) : Promise.resolve([])
        ]);
        const merged = [
          ...(legacyRows || []).map((entry: any) => ({
            id: `item-${entry.id}`,
            body: entry.body,
            created_at: entry.created_at,
            author_type: 'user',
            user_id: entry.user_id || null
          })),
          ...(scopedRows || []).map((entry: any) => ({
            id: `thread-${entry.id}`,
            body: entry.content || '',
            created_at: entry.created_at,
            author_type: entry.author_type || entry.source || 'user',
            user_id: entry.user_id || null
          }))
        ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setItemDrawerComments(merged);
      } catch (error) {
        console.error('Failed loading item drawer comments:', error);
        setItemDrawerComments([]);
      } finally {
        setItemDrawerCommentsLoading(false);
      }
    };

    void loadItemDrawerData();
  }, [drawer.open, drawer.mode, resolvedDrawerItem?.id, resolvedDrawerItem?.listId, user?.id]);

  useEffect(() => {
    if (!drawer.open || drawer.mode !== 'full' || !drawer.blockId) {
      setBlockDrawerPanel('details');
      setBlockDrawerActivityMessages([]);
      setBlockDrawerActivityDraft('');
      setBlockDrawerActivitySending(false);
      return;
    }
    setBlockDrawerPanel('details');
    setBlockDrawerActivityMessages([
      {
        id: `block-intro:${drawer.blockId}`,
        role: 'assistant',
        content: 'Ask Delta about this time block, what was worked here, or what should happen next.',
        created_at: Date.now()
      }
    ]);
    setBlockDrawerActivityDraft('');
    setBlockDrawerActivitySending(false);
  }, [drawer.open, drawer.mode, drawer.blockId]);

  useEffect(() => {
    if (view !== 'calendar' || activeNav !== 'calendar' || !isTodayView) return;
    const container = timelineScrollRef.current;
    if (!container) return;
    // Keep current-time line around ~80% viewport height on first load/view return.
    const target = Math.max(0, nowTop - container.clientHeight * 0.8);
    container.scrollTo({ top: target, behavior: 'smooth' });
  }, [view, activeNav, isTodayView, nowTop]);

  useEffect(() => {
    const container = timelineScrollRef.current;
    if (!container) {
      previousMobileCalendarZoomRef.current = mobileCalendarZoom;
      return;
    }
    const previousZoom = previousMobileCalendarZoomRef.current;
    if (previousZoom === mobileCalendarZoom) return;
    const centerMinute =
      DAY_START_MIN + (container.scrollTop + container.clientHeight * 0.5) / (PX_PER_MIN * previousZoom);
    const nextScrollTop = Math.max(
      0,
      (centerMinute - DAY_START_MIN) * mobilePxPerMin - container.clientHeight * 0.5
    );
    container.scrollTo({ top: nextScrollTop, behavior: 'auto' });
    previousMobileCalendarZoomRef.current = mobileCalendarZoom;
  }, [mobileCalendarZoom, mobilePxPerMin]);

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

  useEffect(() => {
    if (!drawer.open || drawer.mode !== 'full' || blockDrawerPanel !== 'activity') return;
    const node = blockDrawerActivityRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [blockDrawerActivityMessages, drawer.open, drawer.mode, blockDrawerPanel]);

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
    const minute = DAY_START_MIN + y / mobilePxPerMin;
    return Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, minute));
  };

  const getTimelineDraftLayout = (rawStartMin: number, rawEndMin: number) => {
    const startMin = Math.floor(Math.min(rawStartMin, rawEndMin) / 15) * 15;
    const rawEnd = Math.ceil(Math.max(rawStartMin, rawEndMin) / 15) * 15;
    const endMin = Math.max(startMin + MIN_TIME_BLOCK_MINUTES, Math.min(DAY_END_MIN, rawEnd));
    const blockGap = 8;
    const rawTop = (startMin - DAY_START_MIN) * mobilePxPerMin;
    const rawHeight = Math.max((endMin - startMin) * mobilePxPerMin, 24);
    return {
      startMin,
      endMin,
      topPx: rawTop + blockGap / 2,
      heightPx: Math.max(rawHeight - blockGap, 24)
    };
  };

  const finalizeTimelineDraftToEvent = (): void => {
    const draft = timelineDraft;
    if (!draft) return;
    const startMin = Math.floor(Math.min(draft.startMin, draft.endMin) / 15) * 15;
    const rawEnd = Math.ceil(Math.max(draft.startMin, draft.endMin) / 15) * 15;
    const endMin = Math.max(startMin + MIN_TIME_BLOCK_MINUTES, Math.min(DAY_END_MIN, rawEnd));
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
      timelineDraftGestureRef.current.active = true;
      setTimelineDraft(getTimelineDraftLayout(startMin, startMin + MIN_TIME_BLOCK_MINUTES));
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
    setTimelineDraft(getTimelineDraftLayout(gesture.startMin, currentMin));
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
    drawerOpenedAtRef.current = Date.now();
    setDrawerClosing(false);
    setEditOverlayBlockId(null);
    setFullDrawerOrigin(null);
    setDrawer({ open: true, mode: 'peek', blockId });
  };
  const openFullDrawer = (blockId: string, originRect?: DOMRect | null): void => {
    drawerOpenedAtRef.current = Date.now();
    setDrawerClosing(false);
    setEditOverlayBlockId(null);
    if (originRect) {
      const viewportWidth = window.innerWidth || 1;
      const viewportHeight = window.innerHeight || 1;
      setFullDrawerOrigin({
        x: originRect.left,
        y: originRect.top,
        scaleX: Math.max(0.08, originRect.width / viewportWidth),
        scaleY: Math.max(0.08, originRect.height / viewportHeight)
      });
    } else {
      setFullDrawerOrigin(null);
    }
    setDrawer({ open: true, mode: 'full', blockId });
  };
  const openEditDrawer = (blockId: string): void => {
    drawerOpenedAtRef.current = Date.now();
    setDrawerClosing(false);
    if (drawer.open && drawer.mode === 'full' && drawer.blockId === blockId) {
      setEditOverlayBlockId(blockId);
      return;
    }
    setDrawer({ open: true, mode: 'edit', blockId });
  };

  const returnFromEditDrawer = (): void => {
    if (editOverlayBlockId) {
      drawerOpenedAtRef.current = Date.now();
      setEditOverlayBlockId(null);
      return;
    }
    if (!drawer.blockId) return;
    drawerOpenedAtRef.current = Date.now();
    setDrawerClosing(false);
    setDrawer({ open: true, mode: 'full', blockId: drawer.blockId });
  };
  const openItemDrawer = (blockId: string, itemId: string): void => {
    setItemDrawerPanel('details');
    setItemDrawerCommentDraft('');
    drawerOpenedAtRef.current = Date.now();
    setDrawerClosing(false);
    setDrawer({ open: true, mode: 'item', blockId, itemId });
  };

  const returnToParentBlockDrawer = (): void => {
    if (!drawer.blockId) return;
    setItemDrawerPanel('details');
    setItemDrawerCommentDraft('');
    drawerOpenedAtRef.current = Date.now();
    setDrawerClosing(false);
    setDrawer({ open: true, mode: 'full', blockId: drawer.blockId });
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
    addSheetOpenedAtRef.current = Date.now();
    setCaptureMode('none');
  };

  const switchUniversalAddType = (nextType: AddSheetState['type']): void => {
    if (nextType === 'voice') {
      closeAddSheet();
      openUnifiedCapture('voice');
      return;
    }
    setAddSheetName('');
    setAddSheetDescription('');
    setAddItemFields([]);
    setAddItemFieldDrafts({});
    setAddItemStatuses([]);
    setAddItemStatusValue('');
    setAddSheet((prev) => ({
      ...prev,
      type: nextType,
      listId:
        nextType === 'item'
          ? prev.listId || mobileScope.listId || null
          : nextType === 'subitem'
            ? prev.listId || mobileScope.listId || null
            : prev.listId,
      itemId: nextType === 'subitem' ? prev.itemId || null : null
    }));
  };

  const closeAddSheet = (): void => {
    setAddSheetClosing(true);
    window.setTimeout(() => {
      setAddSheet((prev) => ({ ...prev, open: false }));
      setAddSheetClosing(false);
    }, 210);
  };

  const closeDrawer = (): void => {
    if (editOverlayBlockId) {
      setEditOverlayBlockId(null);
      return;
    }
    setIsDrawerDragging(false);
    setDrawerDragY(0);
    setItemDrawerPanel('details');
    setBlockDrawerPanel('details');
    setItemDrawerCommentDraft('');
    setDrawerClosing(true);
    window.setTimeout(() => {
      setDrawer({ open: false, mode: 'peek', blockId: null });
      setDrawerClosing(false);
      setEditDrawerSaving(false);
      setFullDrawerOrigin(null);
    }, 220);
  };

  useEffect(() => {
    if (!drawer.open || (!editOverlayBlockId && drawer.mode !== 'edit') || !activeDrawerBlock) return;
    setEditDrawerName(activeDrawerBlock.name || '');
    setEditDrawerDescription(activeDrawerBlock.description || '');
    setEditDrawerStart(minutesToClock(activeDrawerBlock.startMin));
    setEditDrawerEnd(minutesToClock(activeDrawerBlock.endMin));
    setEditDrawerRecurrence(activeDrawerBlock.recurrence || 'none');
    setEditDrawerRecurrenceExpanded((activeDrawerBlock.recurrence || 'none') !== 'none');
  }, [activeDrawerBlock, drawer.mode, drawer.open, editOverlayBlockId]);

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

  const applyMobileEditScope = async (confirmState: MobileEditScopeConfirmState): Promise<void> => {
    if (!user?.id || !drawer.blockId) return;
    setEditDrawerSaving(true);
    try {
      const occurrenceStartUtc = confirmState.patch?.start || buildIsoFromViewedDate(minutesToClock(activeDrawerBlock?.startMin ?? 0));
      const occurrenceEndUtc =
        confirmState.patch?.end ||
        buildIsoFromViewedDate(minutesToClock(activeDrawerBlock?.endMin ?? MIN_TIME_BLOCK_MINUTES));
      await calendarService.applyScopedTimeBlockEdit({
        userId: user.id,
        sourceEventId: drawer.blockId,
        occurrenceStartUtc,
        occurrenceEndUtc,
        scope: mobileEditScopeMode,
        windowCount: Number.parseInt(mobileEditScopeCount || '4', 10) || 4,
        windowCadence: mobileEditScopeCadence,
        updates: confirmState.patch
          ? {
              title: confirmState.patch.title,
              description: confirmState.patch.description,
              start: confirmState.patch.start,
              end: confirmState.patch.end,
              recurrence: confirmState.patch.recurrence,
              recurrenceConfig: confirmState.patch.recurrenceConfig
            }
          : {},
        deleteOnly: confirmState.kind === 'delete'
      });
      setMobileEditScopeConfirm({ open: false, kind: 'save' });
      closeDrawer();
      await loadCalendarBlocks();
    } catch (error) {
      console.error('Failed to apply mobile scoped time block edit:', error);
      await loadCalendarBlocks();
    } finally {
      setEditDrawerSaving(false);
    }
  };

  const deleteDrawerBlock = async (): Promise<void> => {
    if (!user?.id || !drawer.blockId) return;
    if ((activeDrawerBlock?.recurrence || 'none') !== 'none') {
      setMobileEditScopeConfirm({ open: true, kind: 'delete' });
      return;
    }
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
    if (endMin <= startMin) endMin = Math.min(startMin + MIN_TIME_BLOCK_MINUTES, 24 * 60 - 1);

    const recurrenceConfig =
      editDrawerRecurrence === 'none'
        ? null
        : ({
            unit:
              editDrawerRecurrence === 'daily'
                ? 'day'
                : editDrawerRecurrence === 'weekly'
                  ? 'week'
                  : 'month',
            interval: 1,
            limitType: 'indefinite'
          } as const);

    const patch = {
      title,
      description: editDrawerDescription.trim(),
      start: buildIsoFromViewedDate(minutesToClock(startMin)),
      end: buildIsoFromViewedDate(minutesToClock(endMin)),
      recurrence: editDrawerRecurrence,
      recurrenceConfig
    };

    if ((activeDrawerBlock?.recurrence || 'none') !== 'none') {
      setMobileEditScopeConfirm({ open: true, kind: 'save', patch });
      return;
    }

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
      await calendarService.applyScopedTimeBlockEdit({
        userId: user.id,
        sourceEventId: drawer.blockId,
        occurrenceStartUtc: patch.start,
        occurrenceEndUtc: patch.end,
        scope: 'this_event',
        updates: patch,
        deleteOnly: false
      });
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

  const createSubtaskFromBlock = async (blockId: string | null, itemId: string, listId?: string): Promise<void> => {
    const title = (subtaskDraftByItem[itemId] || '').trim();
    if (!title || !user?.id) return;
    try {
      const created = await focalBoardService.createAction(itemId, user.id, title, null, null);
      const nextSubtask = {
        id: created.id,
        name: created.title || title,
        description: created.description || '',
        listId,
        parentItemId: itemId,
        subtask_status: created.subtask_status || created.status || null,
        subtask_status_id: created.subtask_status_id || null
      };
      if (blockId) {
        setBlocks((prev) =>
          prev.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              items: block.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      subItems: [...(item.subItems || []), nextSubtask]
                    }
                  : item
              ),
              blockTasks: (block.blockTasks || []).map((task) => ({
                ...task,
                linkedItems: (task.linkedItems || []).map((linked) =>
                  linked.itemId === itemId || linked.id === itemId
                    ? {
                        ...linked,
                        subItems: [...(linked.subItems || []), nextSubtask]
                      }
                    : linked
                )
              }))
            };
          })
        );
      }
      if (listId) {
        setItemsByList((prev) => ({
          ...prev,
          [listId]: (prev[listId] || []).map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  actions: [
                    ...(item.actions || []),
                    {
                      id: nextSubtask.id,
                      title: nextSubtask.name,
                      description: nextSubtask.description,
                      subtask_status: nextSubtask.subtask_status,
                      subtask_status_id: nextSubtask.subtask_status_id
                    }
                  ]
                }
              : item
          )
        }));
      }
      setSubtaskDraftByItem((prev) => ({ ...prev, [itemId]: '' }));
      setSubtaskComposerByItem((prev) => ({ ...prev, [itemId]: false }));
    } catch (error) {
      console.error('Failed to create subtask from mobile block:', error);
    }
  };

  const closeBlockTaskCompletionSheet = (): void => {
    setBlockTaskCompletionSheet({
      open: false,
      blockId: null,
      blockTaskId: null,
      blockTaskItemId: null,
      itemId: null,
      listId: null,
      title: '',
      note: '',
      followUpTasks: '',
      statuses: [],
      selectedStatus: null,
      loading: false,
      saving: false,
      error: ''
    });
  };

  const syncBlockTaskLinkedItemLocalState = (
    itemId: string,
    blockTaskItemId: string,
    updates: { completedInContext?: boolean; completionNote?: string | null; completedAt?: string | null }
  ): void => {
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        blockTasks: (block.blockTasks || []).map((task) => ({
          ...task,
          linkedItems: (task.linkedItems || []).map((linked) =>
            linked.blockTaskItemId === blockTaskItemId || linked.itemId === itemId
              ? {
                  ...linked,
                  completedInContext: updates.completedInContext ?? linked.completedInContext,
                  completionNote:
                    updates.completionNote === undefined ? linked.completionNote : updates.completionNote,
                  completedAt: updates.completedAt === undefined ? linked.completedAt : updates.completedAt
                }
              : linked
          )
        }))
      }))
    );
  };

  const withPendingBlockTaskToggle = async (blockTaskItemId: string, work: () => Promise<void>): Promise<void> => {
    if (!blockTaskItemId || pendingBlockTaskToggleIds[blockTaskItemId]) return;
    setPendingBlockTaskToggleIds((prev) => ({ ...prev, [blockTaskItemId]: true }));
    try {
      await work();
    } finally {
      setPendingBlockTaskToggleIds((prev) => {
        const next = { ...prev };
        delete next[blockTaskItemId];
        return next;
      });
    }
  };

  const syncNewFollowUpTasksLocally = (
    itemId: string,
    listId: string | undefined,
    createdTasks: Array<{ id: string; title: string; description?: string | null }>
  ): void => {
    if (!createdTasks.length) return;
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        items: block.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                subItems: [
                  ...(item.subItems || []),
                  ...createdTasks.map((task) => ({
                    id: task.id,
                    name: task.title,
                    description: task.description || '',
                    listId,
                    parentItemId: itemId,
                    subtask_status: null,
                    subtask_status_id: null
                  }))
                ]
              }
            : item
        ),
        blockTasks: (block.blockTasks || []).map((task) => ({
          ...task,
          linkedItems: (task.linkedItems || []).map((linked) =>
            linked.itemId === itemId
              ? {
                  ...linked,
                  subItems: [
                    ...(linked.subItems || []),
                    ...createdTasks.map((taskRow) => ({
                      id: taskRow.id,
                      name: taskRow.title,
                      description: taskRow.description || '',
                      listId,
                      parentItemId: itemId,
                      subtask_status: null,
                      subtask_status_id: null
                    }))
                  ]
                }
              : linked
          )
        }))
      }))
    );
    if (listId) {
      setItemsByList((prev) => ({
        ...prev,
        [listId]: (prev[listId] || []).map((item) =>
          item.id === itemId
            ? {
                ...item,
                actions: [
                  ...(item.actions || []),
                  ...createdTasks.map((task) => ({
                    id: task.id,
                    title: task.title,
                    description: task.description || '',
                    subtask_status: null,
                    subtask_status_id: null
                  }))
                ]
              }
            : item
        )
      }));
    }
  };

  const openBlockTaskCompletionFlow = async (
    blockId: string,
    blockTaskId: string,
    linked: MobileBlockTaskLinkedItem
  ): Promise<void> => {
    setBlockTaskCompletionSheet({
      open: true,
      blockId,
      blockTaskId,
      blockTaskItemId: linked.blockTaskItemId,
      itemId: linked.itemId,
      listId: linked.listId || null,
      title: linked.name,
      note: '',
      followUpTasks: '',
      statuses: [],
      selectedStatus: null,
      loading: Boolean(linked.listId),
      saving: false,
      error: ''
    });
    if (!linked.listId) {
      setBlockTaskCompletionSheet((prev) => ({ ...prev, loading: false }));
      return;
    }
    try {
      const { itemStatuses } = await loadStatusesForList(linked.listId);
      setBlockTaskCompletionSheet((prev) =>
        prev.blockTaskItemId === linked.blockTaskItemId
          ? { ...prev, statuses: itemStatuses, loading: false }
          : prev
      );
    } catch {
      setBlockTaskCompletionSheet((prev) =>
        prev.blockTaskItemId === linked.blockTaskItemId ? { ...prev, loading: false } : prev
      );
    }
  };

  const submitBlockTaskCompletion = async (): Promise<void> => {
    if (!user?.id || !blockTaskCompletionSheet.blockId || !blockTaskCompletionSheet.blockTaskId || !blockTaskCompletionSheet.blockTaskItemId || !blockTaskCompletionSheet.itemId) {
      return;
    }
    const targetBlock = blocks.find((entry) => entry.id === blockTaskCompletionSheet.blockId) || null;
    const targetTask = targetBlock?.blockTasks?.find((entry) => entry.id === blockTaskCompletionSheet.blockTaskId) || null;
    const linkedItem =
      targetTask?.linkedItems.find((entry) => entry.blockTaskItemId === blockTaskCompletionSheet.blockTaskItemId) || null;
    if (!targetBlock || !targetTask || !linkedItem) return;

    setBlockTaskCompletionSheet((prev) => ({ ...prev, saving: true, error: '' }));
    const note = blockTaskCompletionSheet.note.trim();
    const followUpTitles = blockTaskCompletionSheet.followUpTasks
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);

    try {
      setPendingBlockTaskToggleIds((prev) => ({
        ...prev,
        [blockTaskCompletionSheet.blockTaskItemId as string]: true
      }));
      await calendarService.setBlockTaskItemCompletion({
        userId: user.id,
        blockTaskItemId: blockTaskCompletionSheet.blockTaskItemId,
        timeBlockId: targetBlock.id,
        scheduledStartUtc: buildIsoFromViewedDate(minutesToClock(targetBlock.startMin)),
        scheduledEndUtc: buildIsoFromViewedDate(minutesToClock(targetBlock.endMin)),
        checked: true,
        completionNote: note || null
      });
      syncBlockTaskLinkedItemLocalState(blockTaskCompletionSheet.itemId, blockTaskCompletionSheet.blockTaskItemId, {
        completedInContext: true,
        completionNote: note || null,
        completedAt: new Date().toISOString()
      });

      const systemBody = `Completed during "${targetTask.title}" in "${targetBlock.name}".`;
      const createdSystem = await focalBoardService.createScopedComment(
        'item',
        blockTaskCompletionSheet.itemId,
        user.id,
        systemBody,
        'system'
      );
      const nextComments = [{ ...mapThreadComment(createdSystem), id: `thread-${createdSystem.id}` }];
      if (blockTaskCompletionSheet.selectedStatus) {
        const previousStatusLabel =
          getItemStatusEntry(linkedItem)?.name || linkedItem.status || 'No status';
        await focalBoardService.updateItem(blockTaskCompletionSheet.itemId, {
          status: blockTaskCompletionSheet.selectedStatus.key,
          status_id: blockTaskCompletionSheet.selectedStatus.id || null
        });
        applyStatusUpdateLocally(
          linkedItem.listId || '',
          'item',
          blockTaskCompletionSheet.itemId,
          blockTaskCompletionSheet.selectedStatus
        );
        const createdStatusSystem = await focalBoardService.createScopedComment(
          'item',
          blockTaskCompletionSheet.itemId,
          user.id,
          `Status changed: ${previousStatusLabel} -> ${blockTaskCompletionSheet.selectedStatus.name}`,
          'system'
        );
        nextComments.push({ ...mapThreadComment(createdStatusSystem), id: `thread-${createdStatusSystem.id}` });
      }
      if (note) {
        const createdUser = await focalBoardService.createScopedComment(
          'item',
          blockTaskCompletionSheet.itemId,
          user.id,
          note,
          'user'
        );
        nextComments.push({ ...mapThreadComment(createdUser), id: `thread-${createdUser.id}` });
      }
      if (drawer.mode === 'item' && resolvedDrawerItem?.id === blockTaskCompletionSheet.itemId) {
        setItemDrawerComments((prev) => [...prev, ...nextComments]);
      }

      const createdTasks = [];
      for (const title of followUpTitles) {
        const created = await focalBoardService.createAction(blockTaskCompletionSheet.itemId, user.id, title, null, null);
        createdTasks.push(created);
      }
      syncNewFollowUpTasksLocally(blockTaskCompletionSheet.itemId, linkedItem.listId, createdTasks);
      closeBlockTaskCompletionSheet();
      await loadCalendarBlocks();
    } catch (error: any) {
      console.error('Failed to complete block task item on mobile:', error);
      setBlockTaskCompletionSheet((prev) => ({
        ...prev,
        saving: false,
        error: error?.message || 'Failed to complete task in block'
      }));
    } finally {
      setPendingBlockTaskToggleIds((prev) => {
        const next = { ...prev };
        delete next[blockTaskCompletionSheet.blockTaskItemId as string];
        return next;
      });
    }
  };

  const completeAllBlockTaskItems = async (blockId: string, blockTaskId: string): Promise<void> => {
    const targetBlock = blocks.find((entry) => entry.id === blockId) || null;
    const targetTask = targetBlock?.blockTasks?.find((entry) => entry.id === blockTaskId) || null;
    if (!user?.id || !targetBlock || !targetTask) return;
    const pendingLinkedItems = targetTask.linkedItems.filter((linked) => !linked.completedInContext);
    for (const linked of pendingLinkedItems) {
      await withPendingBlockTaskToggle(linked.blockTaskItemId, async () => {
        await calendarService.setBlockTaskItemCompletion({
          userId: user.id,
          blockTaskItemId: linked.blockTaskItemId,
          timeBlockId: blockId,
          scheduledStartUtc: buildIsoFromViewedDate(minutesToClock(targetBlock.startMin)),
          scheduledEndUtc: buildIsoFromViewedDate(minutesToClock(targetBlock.endMin)),
          checked: true,
          completionNote: null
        });
        syncBlockTaskLinkedItemLocalState(linked.itemId, linked.blockTaskItemId, {
          completedInContext: true,
          completionNote: null,
          completedAt: new Date().toISOString()
        });
        await focalBoardService.createScopedComment(
          'item',
          linked.itemId,
          user.id,
          `Completed during "${targetTask.title}" in "${targetBlock.name}".`,
          'system'
        );
      });
    }
    await loadCalendarBlocks();
  };

  const submitItemDrawerComment = async (): Promise<void> => {
    if (!user?.id || !resolvedDrawerItem?.id) return;
    const body = itemDrawerCommentDraft.trim();
    if (!body) return;
    setItemDrawerCommentSubmitting(true);
    try {
      const created = await focalBoardService.createScopedComment('item', resolvedDrawerItem.id, user.id, body, 'user');
      setItemDrawerComments((prev) => [...prev, { ...mapThreadComment(created), id: `thread-${created.id}` }]);
      setItemDrawerCommentDraft('');
    } catch (error) {
      console.error('Failed to add item comment from mobile drawer:', error);
    } finally {
      setItemDrawerCommentSubmitting(false);
    }
  };

  const saveSubtaskEditor = async (): Promise<void> => {
    if (!subtaskEditor.subtask?.id) return;
    const title = subtaskEditor.title.trim();
    if (!title) {
      setSubtaskEditor((prev) => ({ ...prev, error: 'Title is required' }));
      return;
    }
    setSubtaskEditor((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const updated = await focalBoardService.updateAction(subtaskEditor.subtask.id, {
        title,
        description: subtaskEditor.description.trim() || null
      });
      setBlocks((prev) =>
        prev.map((block) => ({
          ...block,
          items: block.items.map((item) => ({
            ...item,
            subItems: (item.subItems || []).map((subItem) =>
              subItem.id === subtaskEditor.subtask?.id
                ? {
                    ...subItem,
                    name: updated.title || title,
                    description: updated.description || ''
                  }
                : subItem
            )
          }))
        }))
      );
      setItemsByList((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([listId, items]) => [
            listId,
            (items || []).map((item) => ({
              ...item,
              actions: (item.actions || []).map((action) =>
                action.id === subtaskEditor.subtask?.id
                  ? {
                      ...action,
                      title: updated.title || title,
                      description: updated.description || ''
                    }
                  : action
              )
            }))
          ])
        )
      );
      setSubtaskEditor({
        open: false,
        parentItemId: null,
        subtask: null,
        title: '',
        description: '',
        saving: false,
        error: ''
      });
    } catch (error: any) {
      setSubtaskEditor((prev) => ({
        ...prev,
        saving: false,
        error: error?.message || 'Could not save subtask.'
      }));
    }
  };

  const applyStatusUpdateLocally = (
    listId: string,
    entityType: 'item' | 'action',
    targetId: string,
    nextStatus: MobileStatusOption
  ): void => {
    setItemsByList((prev) => {
      const listItems = prev[listId] || [];
      return {
        ...prev,
        [listId]: listItems.map((row) => {
          if (entityType === 'item' && row.id === targetId) {
            return {
              ...row,
              status: nextStatus.key,
              status_id: nextStatus.id || null
            };
          }
          if (entityType === 'action' && (row.actions || []).some((entry) => entry.id === targetId)) {
            return {
              ...row,
              actions: (row.actions || []).map((entry) =>
                entry.id === targetId
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
        })
      };
    });
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        items: block.items.map((item) => {
          if (entityType === 'item' && item.id === targetId) {
            return {
              ...item,
              status: nextStatus.key,
              status_id: nextStatus.id || null
            };
          }
          if (entityType === 'action') {
            return {
              ...item,
              subItems: (item.subItems || []).map((subItem) =>
                subItem.id === targetId
                  ? {
                      ...subItem,
                      subtask_status: nextStatus.key,
                      subtask_status_id: nextStatus.id || null
                    }
                  : subItem
              )
            };
          }
          return item;
        })
      }))
    );
    setSubtaskEditor((prev) =>
      prev.subtask?.id === targetId
        ? {
            ...prev,
            subtask: {
              ...prev.subtask,
              subtask_status: nextStatus.key,
              subtask_status_id: nextStatus.id || null
            }
          }
        : prev
    );
  };

  const openStatusChangeFlow = async (params: {
    entityType: 'item' | 'action';
    listId?: string | null;
    targetId: string;
    parentItemId?: string | null;
    title: string;
    currentStatusKey?: string | null;
    currentStatusLabel?: string;
  }): Promise<void> => {
    const listId = params.listId || null;
    if (!listId) return;
    setStatusSheet((prev) => ({
      ...prev,
      open: true,
      step: 'select',
      entityType: params.entityType,
      listId,
      targetId: params.targetId,
      parentItemId: params.parentItemId || (params.entityType === 'item' ? params.targetId : null),
      title: params.title,
      currentStatusLabel: params.currentStatusLabel || '',
      currentStatusKey: params.currentStatusKey || null,
      selectedStatus: null,
      loading: true,
      saving: false,
      error: ''
    }));
    setStatusNoteDraft('');
    const needsLoad =
      params.entityType === 'item' ? !listStatusesByList[listId] : !subtaskStatusesByList[listId];
    const loaded = needsLoad ? await loadStatusesForList(listId) : null;
    const options =
      params.entityType === 'item'
        ? (loaded?.itemStatuses || listStatusesByList[listId] || [])
        : (loaded?.actionStatuses || subtaskStatusesByList[listId] || []);
    if (!options.length) {
      setStatusSheet((prev) => ({
        ...prev,
        loading: false,
        error: 'No statuses are configured for this list yet.'
      }));
      return;
    }
    setStatusSheet((prev) => ({
      ...prev,
      loading: false,
      currentStatusLabel:
        prev.currentStatusLabel || options.find((entry) => entry.key === params.currentStatusKey)?.name || 'No status'
    }));
  };

  const submitStatusChange = async (): Promise<void> => {
    if (!user?.id || !statusSheet.listId || !statusSheet.targetId || !statusSheet.selectedStatus) return;
    const {
      listId,
      targetId,
      entityType,
      selectedStatus,
      parentItemId,
      currentStatusLabel,
      title
    } = statusSheet;
    const scopeItemId = parentItemId || (entityType === 'item' ? targetId : null);
    if (!scopeItemId) return;

    setStatusSheet((prev) => ({ ...prev, saving: true, error: '' }));
    applyStatusUpdateLocally(listId, entityType, targetId, selectedStatus);

    try {
      if (entityType === 'item') {
        await focalBoardService.updateItem(targetId, {
          status: selectedStatus.key,
          status_id: selectedStatus.id || null
        });
      } else {
        await focalBoardService.updateAction(targetId, {
          subtask_status: selectedStatus.key,
          subtask_status_id: selectedStatus.id || null
        });
      }
      const systemBody = `${title} status changed: ${currentStatusLabel || 'No status'} -> ${selectedStatus.name}`;
      const createdSystem = await focalBoardService.createScopedComment('item', scopeItemId, user.id, systemBody, 'system');
      const nextComments = [{ ...mapThreadComment(createdSystem), id: `thread-${createdSystem.id}` }];
      const note = statusNoteDraft.trim();
      if (note) {
        const createdUser = await focalBoardService.createScopedComment('item', scopeItemId, user.id, note, 'user');
        nextComments.push({ ...mapThreadComment(createdUser), id: `thread-${createdUser.id}` });
      }
      if (drawer.mode === 'item' && resolvedDrawerItem?.id === scopeItemId) {
        setItemDrawerComments((prev) => [...prev, ...nextComments]);
      }
      await loadCalendarBlocks();
      closeStatusSheet();
    } catch (error: any) {
      console.error('Failed to update mobile time-block status:', error);
      await Promise.all([loadListItems(listId, true), loadCalendarBlocks()]);
      setStatusSheet((prev) => ({
        ...prev,
        saving: false,
        error: error?.message || 'Failed to update status'
      }));
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

  const getItemDrawerFieldInputValue = (field: any): string => {
    const value = itemDrawerFieldValues[field.id];
    if (!value) return '';
    if (field.type === 'text' || field.type === 'contact') return value.value_text || '';
    if (field.type === 'number') return value.value_number != null ? String(value.value_number) : '';
    if (field.type === 'date') return value.value_date ? new Date(value.value_date).toISOString().slice(0, 10) : '';
    if (field.type === 'boolean') return value.value_boolean ? 'true' : 'false';
    return value.option_id || '';
  };

  const syncMobileItemLocally = (itemId: string, updates: { title?: string; description?: string | null }): void => {
    setItemsByList((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([listId, items]) => [
          listId,
          items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  title: updates.title ?? item.title,
                  description: updates.description ?? item.description
                }
              : item
          )
        ])
      )
    );
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        items: block.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                name: updates.title ?? item.name,
                description: updates.description ?? item.description
              }
              : item
        ),
        blockTasks: (block.blockTasks || []).map((task) => ({
          ...task,
          linkedItems: (task.linkedItems || []).map((item) =>
            item.itemId === itemId || item.id === itemId
              ? {
                  ...item,
                  name: updates.title ?? item.name,
                  description: updates.description ?? item.description
                }
              : item
          )
        }))
      }))
    );
  };

  const syncMobileSubtaskLocally = (
    parentItemId: string,
    subtaskId: string,
    updates: { name?: string; description?: string | null }
  ): void => {
    setItemsByList((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([listId, items]) => [
          listId,
          items.map((item) =>
            item.id === parentItemId
              ? {
                  ...item,
                  actions: (item.actions || []).map((action) =>
                    action.id === subtaskId
                      ? {
                          ...action,
                          title: updates.name ?? action.title,
                          description: updates.description ?? action.description
                        }
                      : action
                  )
                }
              : item
          )
        ])
      )
    );
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        items: block.items.map((item) =>
          item.id === parentItemId
            ? {
                ...item,
                subItems: (item.subItems || []).map((subItem) =>
                  subItem.id === subtaskId
                    ? {
                        ...subItem,
                        name: updates.name ?? subItem.name,
                        description: updates.description ?? subItem.description
                      }
                    : subItem
                )
              }
              : item
        ),
        blockTasks: (block.blockTasks || []).map((task) => ({
          ...task,
          linkedItems: (task.linkedItems || []).map((item) =>
            item.itemId === parentItemId || item.id === parentItemId
              ? {
                  ...item,
                  subItems: (item.subItems || []).map((subItem) =>
                    subItem.id === subtaskId
                      ? {
                          ...subItem,
                          name: updates.name ?? subItem.name,
                          description: updates.description ?? subItem.description
                        }
                      : subItem
                  )
                }
              : item
          )
        }))
      }))
    );
  };

  const saveItemDrawerDetails = async (): Promise<void> => {
    if (!resolvedDrawerItem?.id) return;
    const nextTitle = itemDrawerTitleDraft.trim();
    const nextDescription = itemDrawerDescriptionDraft.trim();
    if (!nextTitle) {
      setItemDrawerTitleDraft(resolvedDrawerItem.name || '');
      return;
    }
    if (nextTitle === (resolvedDrawerItem.name || '') && nextDescription === (resolvedDrawerItem.description || '').trim()) return;
    try {
      const updated = await focalBoardService.updateItem(resolvedDrawerItem.id, {
        title: nextTitle,
        description: nextDescription || null
      });
      syncMobileItemLocally(resolvedDrawerItem.id, {
        title: updated.title || nextTitle,
        description: updated.description || ''
      });
    } catch (error) {
      console.error('Failed saving mobile item drawer details:', error);
      setItemDrawerTitleDraft(resolvedDrawerItem.name || '');
      setItemDrawerDescriptionDraft(resolvedDrawerItem.description || '');
    }
  };

  const upsertItemDrawerFieldValue = async (field: any, rawValue: string): Promise<void> => {
    if (!user?.id || !resolvedDrawerItem?.id) return;
    let payload: any = null;
    if ((field.type === 'status' || field.type === 'select')) {
      payload = { option_id: rawValue || '' };
    } else if (field.type === 'text' || field.type === 'contact') {
      payload = { value_text: rawValue.trim() || '' };
    } else if (field.type === 'number') {
      const trimmed = rawValue.trim();
      if (!trimmed) return;
      const parsed = Number(trimmed.replace(/^\+/, ''));
      if (!Number.isFinite(parsed)) return;
      payload = { value_number: parsed };
    } else if (field.type === 'date') {
      if (!rawValue) return;
      payload = { value_date: new Date(rawValue).toISOString() };
    } else if (field.type === 'boolean') {
      payload = { value_boolean: rawValue === 'true' };
    }
    if (!payload) return;
    try {
      const saved = await itemFieldValueService.upsertValue(user.id, resolvedDrawerItem.id, field.id, payload);
      setItemDrawerFieldValues((prev) => ({
        ...prev,
        [field.id]: saved
      }));
    } catch (error) {
      console.error('Failed saving item drawer field value:', error);
    }
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
      setItemDrawerPanel('details');
    } else if (dx < 0) {
      setItemDrawerPanel('activity');
    }
  };

  const onBlockDrawerPanelTouchStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    blockDrawerGestureRef.current = { startX: touch.clientX, startY: touch.clientY };
  };

  const onBlockDrawerPanelTouchEnd = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - blockDrawerGestureRef.current.startX;
    const dy = touch.clientY - blockDrawerGestureRef.current.startY;
    if (Math.abs(dy) > 56 || Math.abs(dx) < 52) return;
    if (dx > 0) {
      setBlockDrawerPanel('details');
    } else if (dx < 0) {
      setBlockDrawerPanel('activity');
    }
  };

  const inferListForBlock = (blockId: string): string | null => {
    const block = blocks.find((entry) => entry.id === blockId);
    const listIds = [...new Set((block?.items || []).map((item) => item.listId).filter(Boolean))] as string[];
    const focalIds = [...new Set(
      listIds
        .map((listId) => indexedLists.find((entry) => entry.id === listId)?.focalId)
        .filter(Boolean)
    )] as string[];
    const pickListInFocal = (focalId: string): string | null => {
      const focalLists = indexedLists.filter((entry) => entry.focalId === focalId);
      if (mobileScope.listId && focalLists.some((entry) => entry.id === mobileScope.listId)) return mobileScope.listId;
      if (taskDrawerListId && focalLists.some((entry) => entry.id === taskDrawerListId)) return taskDrawerListId;
      return focalLists[0]?.id || null;
    };
    if (listIds.length === 1) return listIds[0];
    if (focalIds.length === 1) {
      const focalScopedList = pickListInFocal(focalIds[0]);
      if (focalScopedList) return focalScopedList;
    }
    if (taskDrawerListId && listIds.includes(taskDrawerListId)) return taskDrawerListId;
    if (mobileScope.listId && listIds.includes(mobileScope.listId)) return mobileScope.listId;
    return taskDrawerListId || mobileScope.listId || indexedLists[0]?.id || null;
  };

  const resolveListForBlock = async (blockId: string): Promise<string | null> => {
    const inferred = inferListForBlock(blockId);
    const block = blocks.find((entry) => entry.id === blockId);
    const listIds = [...new Set((block?.items || []).map((item) => item.listId).filter(Boolean))] as string[];
    if (listIds.length === 1) return listIds[0];
    if (inferred && listIds.length > 1 && listIds.includes(inferred)) return inferred;
    try {
      const rules = await calendarService.getTimeBlockContentRules(blockId);
      const viewedDateWeekdayKey =
        calendarService.getWeekdayKeyForOccurrence(
          new Date(viewedDate.getFullYear(), viewedDate.getMonth(), viewedDate.getDate(), 12, 0, 0, 0).toISOString(),
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver'
        ) || 'mon';
      const matchingWeekdayRule = (rules || []).find(
        (rule: any) => rule.selector_type === 'weekday' && rule.selector_value === viewedDateWeekdayKey && rule.list_id
      );
      if (matchingWeekdayRule?.list_id) return matchingWeekdayRule.list_id;
      const matchingAllRule = (rules || []).find((rule: any) => rule.selector_type === 'all' && rule.list_id);
      if (matchingAllRule?.list_id) return matchingAllRule.list_id;
    } catch (error) {
      console.error('Failed resolving inferred block list:', error);
    }
    return inferred;
  };

  const upsertBlockContentItems = async (blockId: string, listId: string, itemIds: string[]): Promise<void> => {
    if (!blockId || !listId || itemIds.length === 0 || !user?.id) return;
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
      user_id: user.id,
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
      const [focalRows, lists] = await Promise.all([
        focalBoardService.getFocals(user.id),
        focalBoardService.getListsForUser(user.id)
      ]);
      if ((focalRows || []).length > 0) {
        setFocals((focalRows || []).map((entry: any) => ({
          id: entry.id,
          name: entry.name,
          order_num: entry.order_num ?? 0
        })));
      }
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

  const openAddTaskDrawer = (blockId: string, blockTaskId: string | null = null): void => {
    drawerOpenedAtRef.current = Date.now();
    setDrawerClosing(false);
    setTaskDrawerSearch('');
    setTaskDrawerPendingKey(null);
    setTaskDrawerListPickerOpen(false);
    setTaskDrawerError('');
    setTaskDrawerEntryType(blockTaskId ? 'linked_item' : 'block_task');
    setTaskDrawerTargetBlockTaskId(blockTaskId);
    setTaskDrawerListId(inferListForBlock(blockId));
    setTaskDrawerExpandedFocals({});
    setTaskDrawerExpandedLists({});
    setDrawer({ open: true, mode: 'addTask', blockId });
    void ensureTaskDrawerIndexData();
    void (async () => {
      const resolvedListId = await resolveListForBlock(blockId);
      if (resolvedListId) {
        setTaskDrawerListId(resolvedListId);
      }
    })();
  };

  const addBlockTaskIntoBlockState = (blockId: string, task: MobileBlockTask): void => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? {
              ...block,
              blockTasks: [...(block.blockTasks || []), task].sort(
                (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
              )
            }
          : block
      )
    );
  };

  const addItemIntoBlockTaskState = (blockId: string, blockTaskId: string, linked: MobileBlockTaskLinkedItem): void => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? {
              ...block,
              blockTasks: (block.blockTasks || []).map((task) =>
                task.id === blockTaskId
                  ? {
                      ...task,
                      linkedItems: [...(task.linkedItems || []), linked]
                    }
                  : task
              )
            }
          : block
      )
    );
  };

  const attachExistingItemToBlock = async (blockId: string, item: { id: string; title: string; listId: string }): Promise<void> => {
    setTaskDrawerPendingKey(`item:${item.id}`);
    setTaskDrawerError('');
    const normalizedItemId = normalizeLinkedEntityId(item.id);
    try {
      if (taskDrawerTargetBlockTaskId && user?.id) {
        const targetTask =
          blocks.find((block) => block.id === blockId)?.blockTasks?.find((task) => task.id === taskDrawerTargetBlockTaskId) || null;
        const attached = await calendarService.attachItemToBlockTask({
          userId: user.id,
          blockTaskId: taskDrawerTargetBlockTaskId,
          itemId: normalizedItemId,
          sortOrder: targetTask?.linkedItems.length || 0
        });
        addItemIntoBlockTaskState(blockId, taskDrawerTargetBlockTaskId, {
          id: attached.id,
          blockTaskItemId: attached.blockTaskItemId,
          itemId: attached.itemId,
          name: attached.title,
          description: '',
          listId: item.listId,
          subItems: [],
          completedInContext: false,
          completionNote: null,
          completedAt: null
        });
        setTaskDrawerSearch('');
        void loadCalendarBlocks();
        return;
      }

      setOptimisticAttachedByBlock((prev) => ({
        ...prev,
        [blockId]: [...new Set([...(prev[blockId] || []), normalizedItemId])]
      }));
      await upsertBlockContentItems(blockId, item.listId, [normalizedItemId]);
      addItemsIntoBlockState(blockId, [{ id: normalizedItemId, title: item.title, listId: item.listId }]);
      setItemsByList((prev) => {
        if ((prev[item.listId] || []).some((entry) => normalizeLinkedEntityId(entry.id) === normalizedItemId)) return prev;
        return {
          ...prev,
          [item.listId]: [...(prev[item.listId] || []), { id: normalizedItemId, title: item.title, actions: [] }]
        };
      });
      void loadCalendarBlocks();
    } catch (error) {
      console.error('Failed to attach existing item to mobile time block:', error);
      const nextMessage =
        typeof error === 'object' && error && 'message' in error && typeof (error as any).message === 'string'
          ? (error as any).message
          : taskDrawerTargetBlockTaskId ? 'Could not attach item to block task.' : 'Could not attach item to time block.';
      setTaskDrawerError(nextMessage);
      if (!taskDrawerTargetBlockTaskId) {
        setOptimisticAttachedByBlock((prev) => ({
          ...prev,
          [blockId]: (prev[blockId] || []).filter((entry) => entry !== normalizedItemId)
        }));
      }
    } finally {
      setTaskDrawerPendingKey(null);
    }
  };

  const createNewTaskFromDrawer = async (blockId: string): Promise<void> => {
    const title = taskDrawerSearch.trim();
    if (!title || !user?.id) return;
    setTaskDrawerPendingKey('create');
    setTaskDrawerError('');
    try {
      if (taskDrawerEntryType === 'block_task') {
        const targetBlock = blocks.find((block) => block.id === blockId) || null;
        const createdTask = await calendarService.createBlockTask({
          userId: user.id,
          timeBlockId: blockId,
          title,
          sortOrder: targetBlock?.blockTasks?.length || 0
        });
        addBlockTaskIntoBlockState(blockId, {
          id: createdTask.id,
          title: createdTask.title,
          description: createdTask.description || '',
          sortOrder: createdTask.sortOrder ?? (targetBlock?.blockTasks?.length || 0),
          isCompleted: Boolean(createdTask.isCompleted),
          linkedItems: []
        });
        setTaskDrawerSearch('');
        setTaskDrawerEntryType('linked_item');
        setTaskDrawerTargetBlockTaskId(createdTask.id);
        setTaskDrawerError('');
        setDrawer({ open: true, mode: 'addTask', blockId });
        void ensureTaskDrawerIndexData();
        void loadCalendarBlocks();
        return;
      }

      let chosenListId = taskDrawerListId;
      if (!chosenListId) {
        chosenListId = await resolveListForBlock(blockId);
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
      const normalizedCreatedId = normalizeLinkedEntityId(created.id);
      if (taskDrawerTargetBlockTaskId) {
        const targetTask =
          blocks.find((block) => block.id === blockId)?.blockTasks?.find((task) => task.id === taskDrawerTargetBlockTaskId) || null;
        const attached = await calendarService.attachItemToBlockTask({
          userId: user.id,
          blockTaskId: taskDrawerTargetBlockTaskId,
          itemId: normalizedCreatedId,
          sortOrder: targetTask?.linkedItems.length || 0
        });
        addItemIntoBlockTaskState(blockId, taskDrawerTargetBlockTaskId, {
          id: attached.id,
          blockTaskItemId: attached.blockTaskItemId,
          itemId: attached.itemId,
          name: created.title || title,
          description: '',
          listId: chosenListId || undefined,
          subItems: [],
          completedInContext: false,
          completionNote: null,
          completedAt: null
        });
        setItemsByList((prev) => ({
          ...prev,
          [chosenListId as string]: [
            ...(prev[chosenListId as string] || []),
            {
              id: normalizedCreatedId,
              title: created.title || title,
              actions: []
            }
          ]
        }));
        setTaskDrawerSearch('');
        void loadCalendarBlocks();
        return;
      }
      setOptimisticAttachedByBlock((prev) => ({
        ...prev,
        [blockId]: [...new Set([...(prev[blockId] || []), normalizedCreatedId])]
      }));
      if (chosenListId) {
        await upsertBlockContentItems(blockId, chosenListId, [normalizedCreatedId]);
      }
      addItemsIntoBlockState(blockId, [{ id: normalizedCreatedId, title: created.title || title, listId: chosenListId || null }]);
      setItemsByList((prev) => ({
        ...prev,
        [chosenListId as string]: [
          ...(prev[chosenListId as string] || []),
          {
            id: normalizedCreatedId,
            title: created.title || title,
            actions: []
          }
        ]
      }));
      setTaskDrawerSearch('');
      void loadCalendarBlocks();
    } catch (error) {
      console.error('Failed to create from mobile drawer:', error);
      const nextMessage =
        typeof error === 'object' && error && 'message' in error && typeof (error as any).message === 'string'
          ? (error as any).message
          : taskDrawerEntryType === 'block_task'
            ? 'Could not create block task.'
            : 'Could not create and attach item.';
      setTaskDrawerError(nextMessage);
    } finally {
      setTaskDrawerPendingKey(null);
    }
  };

  const quickAddToCurrent = (): void => {
    if (!currentBlockId) return;
    openAddTaskDrawer(currentBlockId);
    setActiveNav('calendar');
  };

  const quickAddCalendarEvent = (): void => {
    openAddSheet({ open: true, type: 'event' });
  };

  const renderBlockItemRows = (blockId: string, items: MobileBlockItem[], emptyLabel = 'No attached items yet.') => {
    const block = blocks.find((entry) => entry.id === blockId) || null;
    const orderedItems = dedupeMobileBlockItems(
      sortMobileBlockItems(filterDirectItemsAgainstBlockTasks(items, block?.blockTasks))
    );
    if (!orderedItems.length) {
      return <div className="mobile-drawer-empty">{emptyLabel}</div>;
    }

    return (
      <div className="mobile-drawer-linked-list actionable">
        {orderedItems.map((item) => (
          <div key={item.id} className="mobile-item-row">
            {(() => {
              const itemStatusEntry = getItemStatusEntry(item);
              const itemIsPending = isStatusIncomplete(itemStatusEntry?.key || item.status);
              return (
                <>
                  <button
                    type="button"
                    className={`mobile-item-check ${itemIsPending ? 'todo' : 'done'}`.trim()}
                    onClick={(event) => {
                      event.stopPropagation();
                      void openStatusChangeFlow({
                        entityType: 'item',
                        listId: item.listId,
                        targetId: item.id,
                        parentItemId: item.id,
                        title: item.name,
                        currentStatusKey: itemStatusEntry?.key || item.status || null,
                        currentStatusLabel: itemStatusEntry?.name || 'No status'
                      });
                    }}
                    aria-label="Change status"
                  >
                    {itemIsPending ? (
                      <span className="mobile-status-ring" style={{ color: itemStatusEntry?.color || undefined }} />
                    ) : (
                      <Circle size={18} fill={itemStatusEntry?.color || 'currentColor'} stroke={itemStatusEntry?.color || 'currentColor'} />
                    )}
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
                  {getVisibleSubItems(item.subItems, false).length > 0 && (
                    <div className="mobile-subitems">
                      {getVisibleSubItems(item.subItems, false).map((subItem) => {
                        const subStatusEntry = getSubtaskStatusEntry(subItem);
                        const subIsPending = isStatusIncomplete(subStatusEntry?.key || subItem.subtask_status);
                        return (
                          <div key={subItem.id} className="mobile-item-subrow">
                            <button
                              type="button"
                              className={`mobile-item-check sub ${subIsPending ? 'todo' : 'done'}`.trim()}
                              onClick={(event) => {
                                event.stopPropagation();
                                void openStatusChangeFlow({
                                  entityType: 'action',
                                  listId: subItem.listId || item.listId,
                                  targetId: subItem.id,
                                  parentItemId: subItem.parentItemId || item.id,
                                  title: subItem.name,
                                  currentStatusKey: subStatusEntry?.key || subItem.subtask_status || null,
                                  currentStatusLabel: subStatusEntry?.name || 'No status'
                                });
                              }}
                              aria-label="Change subtask status"
                            >
                              {subIsPending ? (
                                <span className="mobile-status-ring small" style={{ color: subStatusEntry?.color || undefined }} />
                              ) : (
                                <Circle size={15} fill={subStatusEntry?.color || 'currentColor'} stroke={subStatusEntry?.color || 'currentColor'} />
                              )}
                            </button>
                            <button
                              type="button"
                              className="mobile-item-subtext"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSubtaskEditor({
                                  open: true,
                                  parentItemId: item.id,
                                  subtask: subItem,
                                  title: subItem.name,
                                  description: subItem.description || '',
                                  saving: false,
                                  error: ''
                                });
                              }}
                            >
                              <div className="mobile-item-sub">↳ {subItem.name}</div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {subtaskComposerByItem[item.id] && (
                    <div className="mobile-item-subtask-composer">
                      <input
                        type="text"
                        value={subtaskDraftByItem[item.id] || ''}
                        autoFocus
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
                          void createSubtaskFromBlock(blockId, item.id, item.listId);
                        }}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ))}
      </div>
    );
  };

  const renderBlockTaskGroups = (blockId: string, blockTasks: MobileBlockTask[], emptyLabel = 'No block tasks yet.') => {
    if (!blockTasks.length) {
      return <div className="mobile-drawer-empty">{emptyLabel}</div>;
    }

    return (
      <div className="mobile-block-task-stack">
        {blockTasks.map((task) => (
          <div key={task.id} className="mobile-block-task-card">
            <div className="mobile-block-task-head">
              <div>
                <span className="mobile-block-task-kicker">Block task</span>
                <strong className="mobile-block-task-title">{task.title}</strong>
              </div>
              <div className="mobile-block-task-head-actions">
                {task.linkedItems.some((linked) => !linked.completedInContext) && (
                  <button
                    type="button"
                    className="mobile-block-task-complete-all"
                    onClick={(event) => {
                      event.stopPropagation();
                      void completeAllBlockTaskItems(blockId, task.id);
                    }}
                  >
                    Complete all
                  </button>
                )}
                <button
                  type="button"
                  className="mobile-block-task-inline-add"
                  onClick={(event) => {
                    event.stopPropagation();
                    openAddTaskDrawer(blockId, task.id);
                  }}
                  aria-label="Add item to block task"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            {task.description?.trim() ? <p className="mobile-block-task-description">{task.description.trim()}</p> : null}
            {task.linkedItems.length > 0 ? (
              <div className="mobile-block-task-items">
                {task.linkedItems.map((linked) => (
                  <div key={linked.blockTaskItemId} className="mobile-item-row block-task-child">
                    <button
                      type="button"
                      className={`mobile-block-task-context-toggle ${pendingBlockTaskToggleIds[linked.blockTaskItemId] ? 'pending' : ''}`.trim()}
                      disabled={Boolean(pendingBlockTaskToggleIds[linked.blockTaskItemId])}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (linked.completedInContext) {
                          void withPendingBlockTaskToggle(linked.blockTaskItemId, async () => {
                            const targetBlock = blocks.find((entry) => entry.id === blockId);
                            if (!user?.id || !targetBlock) return;
                            await calendarService.setBlockTaskItemCompletion({
                              userId: user.id,
                              blockTaskItemId: linked.blockTaskItemId,
                              timeBlockId: blockId,
                              scheduledStartUtc: buildIsoFromViewedDate(minutesToClock(targetBlock.startMin)),
                              scheduledEndUtc: buildIsoFromViewedDate(minutesToClock(targetBlock.endMin)),
                              checked: false,
                              completionNote: null
                            });
                            syncBlockTaskLinkedItemLocalState(linked.itemId, linked.blockTaskItemId, {
                              completedInContext: false,
                              completionNote: null,
                              completedAt: null
                            });
                            await loadCalendarBlocks();
                          }).catch((error) => console.error('Failed to reset mobile block task completion:', error));
                          return;
                        }
                        if (pendingBlockTaskToggleIds[linked.blockTaskItemId]) return;
                        void openBlockTaskCompletionFlow(blockId, task.id, linked);
                      }}
                      aria-label={linked.completedInContext ? 'Mark incomplete' : 'Mark complete in block task'}
                    >
                      <span
                        className={`mobile-block-task-context-dot ${linked.completedInContext ? 'done' : ''}`.trim()}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      className="mobile-item-text block-task-child"
                      onClick={(event) => {
                        event.stopPropagation();
                        openItemDrawer(blockId, linked.itemId);
                      }}
                    >
                      <div className="mobile-item-main">
                        <span className="mobile-item-label">{linked.name}</span>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mobile-drawer-empty compact">No linked items yet.</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const openUniversalQuickAdd = (): void => {
    openAddSheet({
      open: true,
      type: 'item',
      focalId: mobileScope.focalId,
      listId: mobileScope.listId
    });
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
    if (addSheet.type === 'voice') {
      closeAddSheet();
      openUnifiedCapture('voice');
      return;
    }
    const name = addSheetName.trim();
    if (addSheet.type === 'doc' ? !(name || addSheetDescription.trim()) : !name) return;

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
        const safeCreatedEnd = Number.isNaN(createdEnd.getTime())
          ? new Date(createdStart.getTime() + MIN_TIME_BLOCK_MINUTES * 60 * 1000)
          : createdEnd;

        if (!Number.isNaN(createdStart.getTime()) && createdStart < dayEnd && safeCreatedEnd > dayStart) {
          setBlocks((prev) =>
            [...prev.filter((block) => block.id !== createdEvent.id), {
              id: createdEvent.id,
              name: createdEvent.title || 'Untitled',
              startMin: minutesFromDate(createdEvent.start),
              endMin: Math.max(minutesFromDate(safeCreatedEnd.toISOString()), minutesFromDate(createdEvent.start) + MIN_TIME_BLOCK_MINUTES),
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

  const sendBlockDrawerActivityMessage = async (): Promise<void> => {
    const content = blockDrawerActivityDraft.trim();
    if (!content || blockDrawerActivitySending || !drawer.blockId) return;
    setBlockDrawerActivitySending(true);
    setBlockDrawerActivityDraft('');
    try {
      const userMessage: ChatMessage = {
        id: makeId(),
        role: 'user',
        content,
        created_at: Date.now()
      };
      const nextMessages = [...blockDrawerActivityMessages, userMessage];
      setBlockDrawerActivityMessages(nextMessages);

      const reply = await chatService.send({
        messages: nextMessages
          .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
          .slice(-20)
          .map((entry) => ({ role: entry.role, content: entry.content })),
        context: { time_block_id: drawer.blockId },
        mode: mobileMemoMode ? 'memo' : 'ai'
      });

      setBlockDrawerActivityMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          content: reply.text || 'No response generated.',
          created_at: Date.now(),
          proposals: reply.proposals || []
        }
      ]);
    } catch {
      setBlockDrawerActivityMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          content: 'I could not process that request for this block right now. Please try again.',
          created_at: Date.now()
        }
      ]);
    } finally {
      setBlockDrawerActivitySending(false);
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
        <div className="mobile-calendar-zoom-controls" role="group" aria-label="Calendar zoom">
          <button
            type="button"
            aria-label="Zoom out calendar"
            onClick={() => {
              const index = MOBILE_CALENDAR_ZOOM_LEVELS.indexOf(mobileCalendarZoom as (typeof MOBILE_CALENDAR_ZOOM_LEVELS)[number]);
              const nextIndex = Math.max(0, index - 1);
              setMobileCalendarZoom(MOBILE_CALENDAR_ZOOM_LEVELS[nextIndex]);
            }}
            disabled={mobileCalendarZoom === MOBILE_CALENDAR_ZOOM_LEVELS[0]}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Zoom in calendar"
            onClick={() => {
              const index = MOBILE_CALENDAR_ZOOM_LEVELS.indexOf(mobileCalendarZoom as (typeof MOBILE_CALENDAR_ZOOM_LEVELS)[number]);
              const nextIndex = Math.min(MOBILE_CALENDAR_ZOOM_LEVELS.length - 1, index + 1);
              setMobileCalendarZoom(MOBILE_CALENDAR_ZOOM_LEVELS[nextIndex]);
            }}
            disabled={mobileCalendarZoom === MOBILE_CALENDAR_ZOOM_LEVELS[MOBILE_CALENDAR_ZOOM_LEVELS.length - 1]}
          >
            +
          </button>
        </div>
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
                    onClick={() =>
                      void openStatusChangeFlow({
                        entityType: 'item',
                        listId: mobileScope.listId,
                        targetId: item.id,
                        parentItemId: item.id,
                        title: item.title,
                        currentStatusKey: itemStatusEntry?.key || item.status || null,
                        currentStatusLabel: itemStatusEntry?.name || 'No status'
                      })
                    }
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
                          onClick={() =>
                            void openStatusChangeFlow({
                              entityType: 'action',
                              listId: mobileScope.listId,
                              targetId: action.id,
                              parentItemId: item.id,
                              title: action.title,
                              currentStatusKey: actionStatusEntry?.key || action.subtask_status || null,
                              currentStatusLabel: actionStatusEntry?.name || 'No status'
                            })
                          }
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
                    <div key={tick.minute} className="mobile-tick-row" style={{ top: `${(tick.minute - DAY_START_MIN) * mobilePxPerMin}px` }}>
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
                      style={{ top: `${(line.minute - DAY_START_MIN) * mobilePxPerMin}px` }}
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
                    const rawTop = (block.startMin - DAY_START_MIN) * mobilePxPerMin;
                    const rawHeight = Math.max((block.endMin - block.startMin) * mobilePxPerMin, 24);
                    const top = rawTop + blockGap / 2;
                    const height = Math.max(rawHeight - blockGap, 24);
                    const isCurrent = block.id === currentBlockId;
                    const hasDescription = Boolean(block.description?.trim());
                    const orderedBlockItems = sortMobileBlockItems(
                      filterDirectItemsAgainstBlockTasks(block.items, block.blockTasks)
                    );
                    const visibleItems = orderedBlockItems;
                    const visibleBlockTasks = block.blockTasks || [];
                    const totalInlineRowCount =
                      visibleItems.length +
                      countMobileBlockTaskRows(visibleBlockTasks);
                    const hasInlineContent = totalInlineRowCount > 0;
                    const expandedInline = isCurrent || expandedTasksByBlock[block.id] || totalInlineRowCount <= 3;
                    const canToggleTasks = hasInlineContent && !isCurrent;
                    const reservedHeight = 42 + (hasDescription ? 18 : 0) + (canToggleTasks ? 22 : 0) + (hasInlineContent ? 10 : 0);
                    const maxInlineRows = Math.max(0, Math.min(8, Math.floor((height - reservedHeight) / 28)));
                    const previewInlineRows = expandedInline ? maxInlineRows : Math.min(maxInlineRows, 4);
                    let remainingRows = previewInlineRows;
                    const renderedBlockTasks = hasInlineContent
                      ? visibleBlockTasks.reduce<MobileBlockTask[]>((acc, task) => {
                          if (remainingRows <= 0) return acc;
                          remainingRows -= 1;
                          const shownLinkedItems = task.linkedItems.slice(0, Math.max(0, remainingRows));
                          remainingRows = Math.max(0, remainingRows - shownLinkedItems.length);
                          acc.push({ ...task, linkedItems: shownLinkedItems });
                          return acc;
                        }, [])
                      : [];
                    const renderedItems = hasInlineContent ? visibleItems.slice(0, Math.max(0, remainingRows)) : [];
                    const renderedRowCount =
                      renderedItems.length + countMobileBlockTaskRows(renderedBlockTasks);
                    const hiddenItemCount = Math.max(0, totalInlineRowCount - renderedRowCount);
                    return (
                      <article
                        key={block.id}
                        className={`mobile-time-block ${isCurrent ? 'current' : ''}`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={(event) => openFullDrawer(block.id, (event.currentTarget as HTMLElement).getBoundingClientRect())}
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

                        {hasDescription && (
                          <p className="mobile-time-block-description">{block.description?.trim()}</p>
                        )}

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
                            {expandedTasksByBlock[block.id] ? 'Hide items' : `View ${totalInlineRowCount} items`}
                          </button>
                        )}

                        {expandedInline && (
                          <div className="mobile-time-block-items">
                            {renderedBlockTasks.map((task) => (
                              <div key={task.id} className="mobile-time-block-task-group">
                                <div className="mobile-block-task-heading">
                                  <div>
                                    <span className="mobile-block-task-heading-kicker">Task</span>
                                    <span className="mobile-block-task-heading-title">{task.title}</span>
                                  </div>
                                  <button
                                    type="button"
                                    className="mobile-block-task-inline-add"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openAddTaskDrawer(block.id, task.id);
                                    }}
                                    aria-label="Add item to block task"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                                {task.linkedItems.map((linked) => (
                                  <div key={linked.blockTaskItemId} className="mobile-item-row block-task-child">
                                    <button
                                      type="button"
                                      className={`mobile-block-task-context-toggle ${pendingBlockTaskToggleIds[linked.blockTaskItemId] ? 'pending' : ''}`.trim()}
                                      disabled={Boolean(pendingBlockTaskToggleIds[linked.blockTaskItemId])}
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (linked.completedInContext) {
                                          if (!user?.id) return;
                                          void withPendingBlockTaskToggle(linked.blockTaskItemId, () =>
                                            calendarService.setBlockTaskItemCompletion({
                                              userId: user.id,
                                              blockTaskItemId: linked.blockTaskItemId,
                                              timeBlockId: block.id,
                                              scheduledStartUtc: buildIsoFromViewedDate(minutesToClock(block.startMin)),
                                              scheduledEndUtc: buildIsoFromViewedDate(minutesToClock(block.endMin)),
                                              checked: false,
                                              completionNote: null
                                            })
                                            .then(() =>
                                              syncBlockTaskLinkedItemLocalState(linked.itemId, linked.blockTaskItemId, {
                                                completedInContext: false,
                                                completionNote: null,
                                                completedAt: null
                                              })
                                            )
                                            .then(() => loadCalendarBlocks())
                                            .catch((error: any) =>
                                              console.error('Failed to reset block task item from mobile card:', error)
                                            )
                                          );
                                          return;
                                        }
                                        if (pendingBlockTaskToggleIds[linked.blockTaskItemId]) return;
                                        void openBlockTaskCompletionFlow(block.id, task.id, linked);
                                      }}
                                      aria-label={linked.completedInContext ? 'Mark incomplete' : 'Mark complete in block task'}
                                    >
                                      <span
                                        className={`mobile-block-task-context-dot ${linked.completedInContext ? 'done' : ''}`.trim()}
                                        aria-hidden="true"
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      className="mobile-item-text block-task-child"
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openItemDrawer(block.id, linked.itemId);
                                      }}
                                    >
                                      <div className="mobile-item-main">
                                        <span className="mobile-item-label">{linked.name}</span>
                                      </div>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {renderedItems.map((item) => (
                              <div key={item.id} className="mobile-item-row">
                                {(() => {
                                  const itemStatusEntry = getItemStatusEntry(item);
                                  const itemIsPending = isStatusIncomplete(itemStatusEntry?.key || item.status);
                                  return (
                                    <button
                                      type="button"
                                      className={`mobile-item-check ${itemIsPending ? 'todo' : 'done'}`.trim()}
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void openStatusChangeFlow({
                                          entityType: 'item',
                                          listId: item.listId,
                                          targetId: item.id,
                                          parentItemId: item.id,
                                          title: item.name,
                                          currentStatusKey: itemStatusEntry?.key || item.status || null,
                                          currentStatusLabel: itemStatusEntry?.name || 'No status'
                                        });
                                      }}
                                      aria-label="Change status"
                                    >
                                      {itemIsPending ? (
                                        <span className="mobile-status-ring" style={{ color: itemStatusEntry?.color || undefined }} />
                                      ) : (
                                        <Circle
                                          size={18}
                                          fill={itemStatusEntry?.color || 'currentColor'}
                                          stroke={itemStatusEntry?.color || 'currentColor'}
                                        />
                                      )}
                                    </button>
                                  );
                                })()}
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
                                {getVisibleSubItems(item.subItems, false).length > 0 && (
                                  <div className="mobile-subitems">
                                    {getVisibleSubItems(item.subItems, false).map((subItem) => (
                                      <div key={subItem.id} className="mobile-item-subrow">
                                        {(() => {
                                          const subStatusEntry = getSubtaskStatusEntry(subItem);
                                          const subIsPending = isStatusIncomplete(subStatusEntry?.key || subItem.subtask_status);
                                          return (
                                            <button
                                              type="button"
                                              className={`mobile-item-check sub ${subIsPending ? 'todo' : 'done'}`.trim()}
                                              onPointerDown={(event) => event.stopPropagation()}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                void openStatusChangeFlow({
                                                  entityType: 'action',
                                                  listId: subItem.listId || item.listId,
                                                  targetId: subItem.id,
                                                  parentItemId: subItem.parentItemId || item.id,
                                                  title: subItem.name,
                                                  currentStatusKey: subStatusEntry?.key || subItem.subtask_status || null,
                                                  currentStatusLabel: subStatusEntry?.name || 'No status'
                                                });
                                              }}
                                              aria-label="Change subtask status"
                                            >
                                              {subIsPending ? (
                                                <span
                                                  className="mobile-status-ring small"
                                                  style={{ color: subStatusEntry?.color || undefined }}
                                                />
                                              ) : (
                                                <Circle
                                                  size={15}
                                                  fill={subStatusEntry?.color || 'currentColor'}
                                                  stroke={subStatusEntry?.color || 'currentColor'}
                                                />
                                              )}
                                            </button>
                                          );
                                        })()}
                                        <button
                                          type="button"
                                          className="mobile-item-subtext"
                                          onPointerDown={(event) => event.stopPropagation()}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setSubtaskEditor({
                                              open: true,
                                              parentItemId: item.id,
                                              subtask: subItem,
                                              title: subItem.name,
                                              description: subItem.description || '',
                                              saving: false,
                                              error: ''
                                            });
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
                                      autoFocus
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
                                        void createSubtaskFromBlock(block.id, item.id, item.listId);
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
                                {hiddenItemCount} more ↗
                              </button>
                            )}
                          </div>
                        )}
                        {totalInlineRowCount > 0 && (
                          <button
                            type="button"
                            className="mobile-block-view-all"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              openFullDrawer(block.id);
                            }}
                          >
                            View all ↗
                          </button>
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
              <button type="button" className={activeNav === 'focals' ? 'active' : ''} onClick={() => setActiveNav('focals')}>
                <DatabaseIcon size={15} />
                <span>Spaces</span>
              </button>
              <button type="button" className={activeNav === 'calendar' ? 'active' : ''} onClick={() => setActiveNav('calendar')}>
                <CalendarIcon size={15} />
                <span>Calendar</span>
              </button>
            </div>
            <button
              type="button"
              className="mobile-quick-add-btn"
              onClick={() => {
                if (captureMode !== 'none') {
                  stopVoiceAnimation();
                  setCaptureMode('none');
                  return;
                }
                openUniversalQuickAdd();
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
        <div
          className={`mobile-add-sheet-overlay ${addSheetClosing ? 'closing' : ''}`.trim()}
          onClick={() => {
            if (Date.now() - addSheetOpenedAtRef.current < 180) return;
            closeAddSheet();
          }}
        >
          <div
            className={`mobile-add-sheet ${addSheetClosing ? 'closing' : ''} ${isAddSheetDragging ? 'dragging' : ''}`.trim()}
            style={isAddSheetDragging ? { transform: `translateY(${addSheetDragY}px)` } : undefined}
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
              {addSheet.type === 'item' || addSheet.type === 'event' || addSheet.type === 'subitem' || addSheet.type === 'voice' ? (
                <input
                  ref={addSheetNameRef}
                  className="mobile-add-sheet-title-input"
                  value={addSheetName}
                  onChange={(event) => setAddSheetName(event.target.value)}
                  placeholder={
                    addSheet.type === 'item'
                      ? 'New item'
                      : addSheet.type === 'subitem'
                        ? 'New task'
                        : addSheet.type === 'event'
                          ? 'New time block'
                          : 'Voice capture'
                  }
                  readOnly={addSheet.type === 'voice'}
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
              {(addSheet.type === 'item' || addSheet.type === 'subitem' || addSheet.type === 'event' || addSheet.type === 'doc' || addSheet.type === 'voice') && (
                <div className="mobile-add-type-switch" role="tablist" aria-label="Create type">
                  {MOBILE_UNIVERSAL_ADD_TYPES.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={addSheet.type === option.key ? 'active' : ''}
                      onClick={() => switchUniversalAddType(option.key)}
                    >
                      {option.shortLabel}
                    </button>
                  ))}
                </div>
              )}

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
                  <label className="mobile-add-field">
                    <span>List</span>
                    <select
                      value={addSheet.listId || ''}
                      onChange={(event) => {
                        const nextListId = event.target.value || null;
                        const owningFocal =
                          Object.entries(listsByFocal).find(([, lists]) => lists.some((list) => list.id === nextListId))?.[0] || null;
                        setAddSheet((prev) => ({
                          ...prev,
                          listId: nextListId,
                          focalId: owningFocal
                        }));
                      }}
                    >
                      <option value="">Select list</option>
                      {indexedLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.focalName} / {list.name}
                        </option>
                      ))}
                    </select>
                  </label>

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

              {addSheet.type === 'voice' && (
                <div className="mobile-universal-voice-card">
                  <strong>Voice capture</strong>
                  <span>Jump straight into voice capture and save the note from the same quick-create path.</span>
                  <button type="button" onClick={() => switchUniversalAddType('voice')}>
                    Start voice capture
                  </button>
                </div>
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
        <div
          className={`mobile-drawer-overlay ${drawer.mode === 'full' ? 'full-open' : ''}`.trim()}
          onClick={() => {
            if (Date.now() - drawerOpenedAtRef.current < 180) return;
            closeDrawer();
          }}
        >
          <div
            className={`mobile-drawer ${drawer.mode} ${fullDrawerOrigin && drawer.mode === 'full' ? 'from-block' : ''} ${isDrawerDragging ? 'dragging' : ''} ${drawerClosing ? 'closing' : ''}`.trim()}
            style={
              isDrawerDragging
                ? { transform: `translateY(${drawerDragY}px)` }
                : drawer.mode === 'full' && fullDrawerOrigin
                  ? ({
                      ['--drawer-origin-x' as any]: `${fullDrawerOrigin.x}px`,
                      ['--drawer-origin-y' as any]: `${fullDrawerOrigin.y}px`,
                      ['--drawer-origin-scale-x' as any]: `${fullDrawerOrigin.scaleX}`,
                      ['--drawer-origin-scale-y' as any]: `${fullDrawerOrigin.scaleY}`
                    } as React.CSSProperties)
                  : undefined
            }
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
              <div
                className="mobile-drawer-head-drag"
                onTouchStart={onDrawerTouchStart}
                onTouchMove={onDrawerTouchMove}
                onTouchEnd={onDrawerTouchEnd}
                onPointerDown={onDrawerPointerDown}
                onPointerMove={onDrawerPointerMove}
                onPointerUp={onDrawerPointerEnd}
                onPointerCancel={onDrawerPointerEnd}
              >
                {drawer.mode === 'item' && drawer.blockId ? (
                  <button
                    type="button"
                    aria-label="Back to time block"
                    className="mobile-drawer-back"
                    onTouchStart={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      returnToParentBlockDrawer();
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                ) : (
                  <Clock3 size={15} />
                )}
                <strong>
                  {drawer.mode === 'addTask'
                    ? taskDrawerTargetBlockTaskId
                      ? 'Add To Task'
                      : 'Add To Block'
                    : drawer.mode === 'item'
                      ? resolvedDrawerItem?.name || 'Item Details'
                      : activeDrawerBlock?.name || 'Time Block'}
                </strong>
              </div>
              <div className="mobile-drawer-head-actions">
                {drawer.mode !== 'addTask' && drawer.mode !== 'item' && drawer.blockId && (
                  <>
                    {drawer.mode === 'full' && (
                      <button
                        type="button"
                        aria-label="Edit event"
                        onTouchStart={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditDrawer(drawer.blockId as string);
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {drawer.mode === 'edit' && (
                      <button
                        type="button"
                        aria-label="Delete event"
                        onTouchStart={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          void deleteDrawerBlock();
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  aria-label={drawer.mode === 'edit' && drawer.blockId ? 'Back to time block' : 'Close drawer'}
                  className="mobile-drawer-close"
                  onTouchStart={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (drawer.mode === 'edit' && drawer.blockId) {
                      returnFromEditDrawer();
                      return;
                    }
                    closeDrawer();
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="mobile-drawer-body">
            {drawer.mode === 'addTask' && drawer.blockId && (
              <div className="mobile-task-drawer">
                <div className="mobile-add-type-switch mobile-task-drawer-type-switch" role="tablist" aria-label="Add to block type">
                  <button
                    type="button"
                    className={taskDrawerEntryType === 'block_task' ? 'active' : ''}
                    onClick={() => {
                      setTaskDrawerEntryType('block_task');
                      setTaskDrawerListPickerOpen(false);
                      setTaskDrawerError('');
                    }}
                  >
                    Task
                  </button>
                  <button
                    type="button"
                    className={taskDrawerEntryType === 'linked_item' ? 'active' : ''}
                    onClick={() => {
                      setTaskDrawerEntryType('linked_item');
                      setTaskDrawerError('');
                    }}
                  >
                    Item
                  </button>
                </div>
                {taskDrawerEntryType === 'linked_item' && (
                  <div className="mobile-task-drawer-target">
                    <button
                      type="button"
                      className={`mobile-task-drawer-target-trigger ${taskDrawerListPickerOpen ? 'open' : ''}`.trim()}
                      onClick={() => setTaskDrawerListPickerOpen((prev) => !prev)}
                    >
                    <span className="mobile-task-drawer-target-label">Target list</span>
                    <span className="mobile-task-drawer-target-value">
                      {taskDrawerSelectedList ? `${taskDrawerSelectedList.focalName} / ${taskDrawerSelectedList.name}` : 'Select list'}
                    </span>
                    <ChevronDown size={14} />
                  </button>
                    {taskDrawerListPickerOpen && (
                      <div className="mobile-task-drawer-target-menu">
                        {indexedLists.map((list) => (
                          <button
                            key={list.id}
                            type="button"
                            className={taskDrawerListId === list.id ? 'active' : ''}
                            onClick={() => {
                              setTaskDrawerListId(list.id);
                              setTaskDrawerListPickerOpen(false);
                            }}
                          >
                            <strong>{list.name}</strong>
                            <span>{list.focalName}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <label className="mobile-task-drawer-search">
                  <input
                    type="text"
                    placeholder={
                      taskDrawerEntryType === 'block_task'
                        ? 'Task name'
                        : taskDrawerTargetBlockTaskId
                          ? 'Search or create item for this task'
                          : 'Search or create item'
                    }
                    value={taskDrawerSearch}
                    onChange={(event) => setTaskDrawerSearch(event.target.value)}
                  />
                </label>
                {taskDrawerEntryType === 'linked_item' && taskDrawerTargetBlockTaskId && (
                  <div className="mobile-task-drawer-empty compact">
                    Add or create items for this task.
                  </div>
                )}
                <div className="mobile-task-drawer-results">
                  {!!taskDrawerError && <div className="mobile-task-drawer-empty error">{taskDrawerError}</div>}
                  {taskDrawerEntryType === 'block_task' ? (
                    <>
                      {!taskDrawerSearch.trim() && (
                        <div className="mobile-task-drawer-empty">Create a task that lives only inside this time block.</div>
                      )}
                      {!!taskDrawerSearch.trim() && (
                        <div className="mobile-task-drawer-create-row">
                          <div className="mobile-task-drawer-result-copy">
                            <strong>{taskDrawerSearch.trim()}</strong>
                            <span>Create block task</span>
                          </div>
                          <button
                            type="button"
                            className="mobile-task-drawer-create"
                            disabled={taskDrawerPendingKey === 'create'}
                            onClick={() => void createNewTaskFromDrawer(drawer.blockId as string)}
                          >
                            Add Task
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
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
                                        const normalizedItemId = normalizeLinkedEntityId(item.id);
                                        const isAdded =
                                          !!activeDrawerBlock?.items.some(
                                            (entry) => normalizeLinkedEntityId(entry.id) === normalizedItemId
                                          ) ||
                                          !!optimisticAttachedByBlock[drawer.blockId as string]?.includes(normalizedItemId);
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
                    </>
                  )}
                </div>
              </div>
            )}
            {drawer.mode !== 'item' && drawer.mode !== 'addTask' && drawer.mode !== 'edit' && (
              <div
                className={`mobile-block-drawer-panel ${blockDrawerPanel}`.trim()}
                onTouchStart={onBlockDrawerPanelTouchStart}
                onTouchEnd={onBlockDrawerPanelTouchEnd}
              >
                <div className="mobile-item-drawer-tabs block-workspace">
                  <button type="button" className={blockDrawerPanel === 'details' ? 'active' : ''} onClick={() => setBlockDrawerPanel('details')}>
                    Details
                  </button>
                  <button type="button" className={blockDrawerPanel === 'activity' ? 'active' : ''} onClick={() => setBlockDrawerPanel('activity')}>
                    Activity
                  </button>
                </div>
                {blockDrawerPanel === 'details' ? (
                  <>
                    <div className="mobile-block-section">
                      <div className="mobile-block-section-head">
                        <h4>Description</h4>
                      </div>
                    </div>
                    {activeDrawerBlock?.description?.trim() ? (
                      <MarkdownText className="mobile-drawer-description" text={activeDrawerBlock.description.trim()} />
                    ) : (
                      <p className="mobile-drawer-description">No description yet.</p>
                    )}
                    <div className="mobile-drawer-linked">
                      <div className="mobile-block-section-divider" />
                      <div className="mobile-block-section">
                        <div className="mobile-drawer-linked-head">
                          <h4>Tasks</h4>
                          <button
                            type="button"
                            className="mobile-task-drawer-create"
                            onClick={() => {
                              if (!drawer.blockId) return;
                              setTaskDrawerEntryType('block_task');
                              openAddTaskDrawer(drawer.blockId);
                            }}
                          >
                            Add
                          </button>
                        </div>
                        {activeDrawerBlock?.blockTasks?.length ? (
                          <div className="mobile-drawer-linked-block-tasks">
                            {renderBlockTaskGroups(drawer.blockId as string, activeDrawerBlock.blockTasks)}
                          </div>
                        ) : (
                          <div className="mobile-drawer-empty compact">No tasks in this block yet.</div>
                        )}
                      </div>
                      <div className="mobile-block-section-divider" />
                      <div className="mobile-block-section">
                        <div className="mobile-drawer-linked-head">
                          <h4>Attached items</h4>
                          <button
                            type="button"
                            className="mobile-task-drawer-create secondary"
                            onClick={() => {
                              if (!drawer.blockId) return;
                              setTaskDrawerEntryType('linked_item');
                              openAddTaskDrawer(drawer.blockId);
                            }}
                          >
                            Attach item
                          </button>
                        </div>
                        {activeDrawerBlock?.items?.length ? (
                          <div className="mobile-drawer-linked-direct">
                            {renderBlockItemRows(drawer.blockId as string, activeDrawerBlock.items || [])}
                          </div>
                        ) : (
                          renderBlockItemRows(drawer.blockId as string, activeDrawerBlock?.items || [])
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mobile-block-activity-pane">
                    <div className="mobile-ai-messages inline" ref={blockDrawerActivityRef}>
                      {blockDrawerActivityMessages.map((message) =>
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
                    <div className="mobile-ai-composer-wrap inline">
                      <div className="mobile-ai-composer inline">
                        <textarea
                          rows={2}
                          placeholder="Ask Delta about this block…"
                          value={blockDrawerActivityDraft}
                          onChange={(event) => setBlockDrawerActivityDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              void sendBlockDrawerActivityMessage();
                            }
                          }}
                        />
                        <button
                          type="button"
                          aria-label="Send"
                          onClick={() => void sendBlockDrawerActivityMessage()}
                          disabled={blockDrawerActivitySending || !blockDrawerActivityDraft.trim()}
                        >
                          <Send size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
                  <button type="button" className={itemDrawerPanel === 'activity' ? 'active' : ''} onClick={() => setItemDrawerPanel('activity')}>
                    Activity
                  </button>
                </div>

                {itemDrawerPanel === 'details' ? (
                  <div className="mobile-item-drawer-details">
                    <div className="mobile-item-drawer-editable">
                      <input
                        className="mobile-item-drawer-title-input"
                        type="text"
                        value={itemDrawerTitleDraft}
                        onChange={(event) => setItemDrawerTitleDraft(event.target.value)}
                        onBlur={() => void saveItemDrawerDetails()}
                        placeholder="Item title"
                      />
                      <button
                        type="button"
                        className="mobile-item-drawer-status-trigger"
                        onClick={() =>
                          void openStatusChangeFlow({
                            entityType: 'item',
                            listId: resolvedDrawerItem.listId,
                            targetId: resolvedDrawerItem.id,
                            parentItemId: resolvedDrawerItem.id,
                            title: resolvedDrawerItem.name,
                            currentStatusKey: getItemStatusEntry(resolvedDrawerItem)?.key || resolvedDrawerItem.status || null,
                            currentStatusLabel: getItemStatusEntry(resolvedDrawerItem)?.name || 'No status'
                          })
                        }
                      >
                        {getItemStatusEntry(resolvedDrawerItem)?.name || 'Set status'}
                      </button>
                      <textarea
                        className="mobile-item-drawer-description-input"
                        value={itemDrawerDescriptionDraft}
                        onChange={(event) => setItemDrawerDescriptionDraft(event.target.value)}
                        onBlur={() => void saveItemDrawerDetails()}
                        placeholder="No description yet."
                        rows={3}
                      />
                    </div>
                    <div className="mobile-item-drawer-fields">
                      <h5>Column values</h5>
                      {itemDrawerFields.length === 0 && <div className="mobile-item-drawer-empty">No column values on this task yet.</div>}
                      {itemDrawerFields.map((field) => (
                        <div key={field.id} className="mobile-item-drawer-field-row">
                          <span>{field.name}</span>
                          {field.type === 'status' || field.type === 'select' ? (
                            <select
                              className="mobile-item-drawer-field-input"
                              value={getItemDrawerFieldInputValue(field)}
                              onChange={(event) => void upsertItemDrawerFieldValue(field, event.target.value)}
                            >
                              <option value="">Select</option>
                              {(field.options || []).map((option: any) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : field.type === 'boolean' ? (
                            <button
                              type="button"
                              className="mobile-item-drawer-boolean"
                              onClick={() =>
                                void upsertItemDrawerFieldValue(
                                  field,
                                  getItemDrawerFieldInputValue(field) === 'true' ? 'false' : 'true'
                                )
                              }
                            >
                              {getFieldDisplayValue(field)}
                            </button>
                          ) : (
                            <input
                              className="mobile-item-drawer-field-input"
                              type={field.type === 'date' ? 'date' : 'text'}
                              inputMode={field.type === 'number' ? 'decimal' : undefined}
                              value={getItemDrawerFieldInputValue(field)}
                              placeholder={field.type === 'contact' ? 'Name • phone • email' : field.name}
                              onChange={(event) =>
                                setItemDrawerFieldValues((prev) => ({
                                  ...prev,
                                  [field.id]:
                                    field.type === 'number'
                                      ? { ...(prev[field.id] || {}), value_number: event.target.value }
                                      : field.type === 'date'
                                        ? { ...(prev[field.id] || {}), value_date: event.target.value }
                                        : { ...(prev[field.id] || {}), value_text: event.target.value }
                                }))
                              }
                              onBlur={(event) => void upsertItemDrawerFieldValue(field, event.target.value)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mobile-item-drawer-subtasks">
                      <div className="mobile-item-drawer-subtasks-head">
                        <h5>Tasks</h5>
                        <button
                          type="button"
                          className="mobile-item-subtask-toggle plain-text"
                          onClick={() => toggleSubtaskComposer(resolvedDrawerItem.id)}
                        >
                          + Add task
                        </button>
                      </div>
                      {getSortedSubItems(resolvedDrawerItem.subItems, true).length === 0 && (
                        <div className="mobile-item-drawer-empty">No subtasks on this item yet.</div>
                      )}
                      {getSortedSubItems(resolvedDrawerItem.subItems, true).length > 0 && (
                        <div className="mobile-drawer-linked-list actionable">
                          {getSortedSubItems(resolvedDrawerItem.subItems, true).map((subItem) => {
                            const subStatusEntry = getSubtaskStatusEntry(subItem);
                            const subIsPending = isStatusIncomplete(subStatusEntry?.key || subItem.subtask_status);
                            return (
                              <div key={subItem.id} className="mobile-item-subrow drawer-detail">
                                <button
                                  type="button"
                                  className={`mobile-item-check sub ${subIsPending ? 'todo' : 'done'}`.trim()}
                                  onClick={() => {
                                    void openStatusChangeFlow({
                                      entityType: 'action',
                                      listId: subItem.listId || resolvedDrawerItem.listId,
                                      targetId: subItem.id,
                                      parentItemId: subItem.parentItemId || resolvedDrawerItem.id,
                                      title: subItem.name,
                                      currentStatusKey: subStatusEntry?.key || subItem.subtask_status || null,
                                      currentStatusLabel: subStatusEntry?.name || 'No status'
                                    });
                                  }}
                                  aria-label="Change subtask status"
                                >
                                  {subIsPending ? (
                                    <span className="mobile-status-ring small" style={{ color: subStatusEntry?.color || undefined }} />
                                  ) : (
                                    <Circle size={15} fill={subStatusEntry?.color || 'currentColor'} stroke={subStatusEntry?.color || 'currentColor'} />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className="mobile-item-subtext"
                                  onClick={() =>
                                    setSubtaskEditor({
                                      open: true,
                                      parentItemId: subItem.parentItemId || resolvedDrawerItem.id,
                                      subtask: subItem,
                                      title: subItem.name,
                                      description: subItem.description || '',
                                      saving: false,
                                      error: ''
                                    })
                                  }
                                >
                                  <div className="mobile-item-sub">↳ {subItem.name}</div>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {subtaskComposerByItem[resolvedDrawerItem.id] && (
                        <div className="mobile-item-subtask-composer drawer">
                          <input
                            type="text"
                            value={subtaskDraftByItem[resolvedDrawerItem.id] || ''}
                            autoFocus
                            onChange={(event) =>
                              setSubtaskDraftByItem((prev) => ({
                                ...prev,
                                [resolvedDrawerItem.id]: event.target.value
                              }))
                            }
                            placeholder="Add subtask"
                          />
                          <button
                            type="button"
                            onClick={() => void createSubtaskFromBlock(drawer.blockId || null, resolvedDrawerItem.id, resolvedDrawerItem.listId)}
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mobile-item-drawer-comments mobile-activity-thread">
                    {itemDrawerCommentsLoading && <div className="mobile-item-drawer-empty">Loading comments…</div>}
                    {!itemDrawerCommentsLoading && itemDrawerComments.length === 0 && (
                      <div className="mobile-ai-assistant">No activity yet.</div>
                    )}
                    {!itemDrawerCommentsLoading && itemDrawerComments.length > 0 && (
                      <div className="mobile-item-drawer-comment-list mobile-ai-messages inline">
                        {itemDrawerComments.map((comment) => {
                          const variant =
                            comment.author_type === 'system'
                              ? 'system'
                              : comment.author_type === 'ai'
                                ? 'ai'
                                : comment.user_id && comment.user_id === user?.id
                                  ? 'user'
                                  : 'other';
                          return (
                            <div
                              key={comment.id}
                              className={
                                variant === 'user'
                                  ? 'mobile-ai-user'
                                  : 'mobile-ai-assistant mobile-item-activity-entry'
                              }
                            >
                              {comment.body}
                              {variant !== 'user' && (
                                <div className="mobile-ai-warning-line">
                                  {new Date(comment.created_at).toLocaleString()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <form
                      className="mobile-ai-composer-wrap inline"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitItemDrawerComment();
                      }}
                    >
                      <div className="mobile-ai-composer inline">
                        <textarea
                          rows={2}
                          value={itemDrawerCommentDraft}
                          onChange={(event) => setItemDrawerCommentDraft(event.target.value)}
                          placeholder="Write an activity note"
                        />
                        <button type="submit" disabled={itemDrawerCommentSubmitting || !itemDrawerCommentDraft.trim()}>
                          <Send size={17} />
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
          {editOverlayBlockId && (
            <div className="mobile-drawer-edit-overlay" onClick={() => setEditOverlayBlockId(null)}>
              <div className="mobile-drawer edit overlay-sheet" onClick={(event) => event.stopPropagation()}>
                <div className="mobile-drawer-grab" />
                <div className="mobile-drawer-head">
                  <div className="mobile-drawer-head-drag">
                    <Clock3 size={15} />
                    <strong>{activeDrawerBlock?.name || 'Time Block'}</strong>
                  </div>
                  <div className="mobile-drawer-head-actions">
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
                    <button
                      type="button"
                      aria-label="Back to time block"
                      className="mobile-drawer-close"
                      onClick={(event) => {
                        event.stopPropagation();
                        returnFromEditDrawer();
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
                <div className="mobile-drawer-body">
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
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {statusSheet.open && (
        <div className="mobile-status-sheet-overlay" onClick={statusSheet.saving ? undefined : closeStatusSheet}>
          <div className="mobile-status-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-status-sheet-grab" />
            <div className="mobile-status-sheet-head">
              <strong>{statusSheet.step === 'select' ? 'Change status' : 'Add a note'}</strong>
              <button type="button" onClick={closeStatusSheet} disabled={statusSheet.saving}>
                <X size={16} />
              </button>
            </div>
            <div className="mobile-status-sheet-body">
              <h4>{statusSheet.title}</h4>
              {statusSheet.error && <div className="mobile-task-drawer-empty error">{statusSheet.error}</div>}
              {statusSheet.loading ? (
                <div className="mobile-drawer-empty">Loading statuses…</div>
              ) : statusSheet.step === 'select' ? (
                <div className="mobile-status-sheet-options">
                  {(
                    statusSheet.entityType === 'item'
                      ? listStatusesByList[statusSheet.listId || ''] || []
                      : subtaskStatusesByList[statusSheet.listId || ''] || []
                  ).map((status) => (
                    <button
                      key={status.id || status.key}
                      type="button"
                      className={`mobile-status-sheet-option ${
                        (statusSheet.currentStatusKey || '') === status.key ? 'current' : ''
                      }`.trim()}
                      onClick={() =>
                        setStatusSheet((prev) => ({
                          ...prev,
                          step: 'note',
                          selectedStatus: status,
                          error: ''
                        }))
                      }
                    >
                      <span className="mobile-status-sheet-option-label">
                        <Circle size={12} fill={status.color || 'currentColor'} stroke={status.color || 'currentColor'} />
                        {status.name}
                      </span>
                      {(statusSheet.currentStatusKey || '') === status.key && <span>Current</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mobile-status-sheet-note">
                  <div className="mobile-status-sheet-summary">
                    <span>{statusSheet.currentStatusLabel || 'No status'}</span>
                    <ChevronRight size={14} />
                    <strong>{statusSheet.selectedStatus?.name}</strong>
                  </div>
                  <label className="mobile-status-sheet-note-field">
                    <span>Completion note</span>
                    <textarea
                      value={statusNoteDraft}
                      onChange={(event) => setStatusNoteDraft(event.target.value)}
                      placeholder="Add context for the update"
                      rows={4}
                    />
                  </label>
                  <div className="mobile-status-sheet-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setStatusSheet((prev) => ({ ...prev, step: 'select', error: '' }))}
                      disabled={statusSheet.saving}
                    >
                      Back
                    </button>
                    <button type="button" className="primary" onClick={() => void submitStatusChange()} disabled={statusSheet.saving}>
                      {statusSheet.saving ? 'Saving…' : 'Save update'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {blockTaskCompletionSheet.open && (
        <div className="mobile-status-sheet-overlay" onClick={blockTaskCompletionSheet.saving ? undefined : closeBlockTaskCompletionSheet}>
          <div className="mobile-status-sheet block-task-completion" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-status-sheet-head">
              <strong>Complete in block</strong>
              <button type="button" onClick={closeBlockTaskCompletionSheet} disabled={blockTaskCompletionSheet.saving}>
                <X size={16} />
              </button>
            </div>
            <div className="mobile-status-sheet-body">
              <h4>{blockTaskCompletionSheet.title}</h4>
              {blockTaskCompletionSheet.error && <div className="mobile-task-drawer-empty error">{blockTaskCompletionSheet.error}</div>}
              <textarea
                value={blockTaskCompletionSheet.note}
                onChange={(event) =>
                  setBlockTaskCompletionSheet((prev) => ({ ...prev, note: event.target.value }))
                }
                placeholder="Add completion note / outcome"
                rows={3}
                disabled={blockTaskCompletionSheet.saving}
              />
              <textarea
                value={blockTaskCompletionSheet.followUpTasks}
                onChange={(event) =>
                  setBlockTaskCompletionSheet((prev) => ({ ...prev, followUpTasks: event.target.value }))
                }
                placeholder="Add next tasks, one per line"
                rows={4}
                disabled={blockTaskCompletionSheet.saving}
              />
              <label className="mobile-block-task-status-field">
                <span>Optional status update</span>
                <select
                  value={blockTaskCompletionSheet.selectedStatus?.id || blockTaskCompletionSheet.selectedStatus?.key || ''}
                  onChange={(event) =>
                    setBlockTaskCompletionSheet((prev) => ({
                      ...prev,
                      selectedStatus:
                        prev.statuses.find((status) => (status.id || status.key) === event.target.value) || null
                    }))
                  }
                  disabled={blockTaskCompletionSheet.loading || blockTaskCompletionSheet.saving || blockTaskCompletionSheet.statuses.length === 0}
                >
                  <option value="">
                    {blockTaskCompletionSheet.loading ? 'Loading statuses…' : 'Keep current status'}
                  </option>
                  {blockTaskCompletionSheet.statuses.map((status) => (
                    <option key={status.id || status.key} value={status.id || status.key}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mobile-status-sheet-actions">
                <button type="button" onClick={closeBlockTaskCompletionSheet} disabled={blockTaskCompletionSheet.saving}>
                  Cancel
                </button>
                <button type="button" className="primary" onClick={() => void submitBlockTaskCompletion()} disabled={blockTaskCompletionSheet.saving}>
                  {blockTaskCompletionSheet.saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {mobileEditScopeConfirm.open && (
        <div
          className="mobile-status-sheet-overlay"
          onClick={editDrawerSaving ? undefined : () => setMobileEditScopeConfirm({ open: false, kind: 'save' })}
        >
          <div className="mobile-status-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-status-sheet-grab" />
            <div className="mobile-status-sheet-head">
              <strong>{mobileEditScopeConfirm.kind === 'delete' ? 'Delete recurring block' : 'Apply recurring change'}</strong>
              <button type="button" onClick={() => setMobileEditScopeConfirm({ open: false, kind: 'save' })} disabled={editDrawerSaving}>
                <X size={16} />
              </button>
            </div>
            <div className="mobile-status-sheet-body">
              <div className="mobile-status-sheet-options">
                {[
                  { key: 'this_event', label: 'Just this occurrence' },
                  { key: 'all_future', label: 'This and all future' },
                  { key: 'next_window', label: 'Recurring override window' }
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`mobile-status-sheet-option ${mobileEditScopeMode === option.key ? 'current' : ''}`.trim()}
                    onClick={() => setMobileEditScopeMode(option.key as MobileEditScopeMode)}
                  >
                    <span className="mobile-status-sheet-option-label">{option.label}</span>
                  </button>
                ))}
              </div>
              {mobileEditScopeMode === 'next_window' && (
                <div className="mobile-status-sheet-note">
                  <label className="mobile-status-sheet-note-field">
                    <span>Count</span>
                    <input
                      type="number"
                      min={1}
                      value={mobileEditScopeCount}
                      onChange={(event) => setMobileEditScopeCount(event.target.value)}
                    />
                  </label>
                  <label className="mobile-status-sheet-note-field">
                    <span>Cadence</span>
                    <select
                      value={mobileEditScopeCadence}
                      onChange={(event) => setMobileEditScopeCadence(event.target.value as 'days' | 'weeks' | 'months')}
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="mobile-status-sheet-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setMobileEditScopeConfirm({ open: false, kind: 'save' })}
                  disabled={editDrawerSaving}
                >
                  Cancel
                </button>
                <button type="button" className="primary" onClick={() => void applyMobileEditScope(mobileEditScopeConfirm)} disabled={editDrawerSaving}>
                  {editDrawerSaving ? 'Applying…' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {subtaskEditor.open && subtaskEditor.subtask && (
        <div className="mobile-status-sheet-overlay" onClick={subtaskEditor.saving ? undefined : () => setSubtaskEditor({
          open: false,
          parentItemId: null,
          subtask: null,
          title: '',
          description: '',
          saving: false,
          error: ''
        })}>
          <div className="mobile-status-sheet" onClick={(event) => event.stopPropagation()}>
            {(() => {
              const editorSubtask = subtaskEditor.subtask;
              const editorStatusEntry = editorSubtask ? getSubtaskStatusEntry(editorSubtask) : null;
              return (
                <>
            <div className="mobile-status-sheet-grab" />
            <div className="mobile-status-sheet-head">
              <strong>Edit subtask</strong>
              <button
                type="button"
                onClick={() => setSubtaskEditor({
                  open: false,
                  parentItemId: null,
                  subtask: null,
                  title: '',
                  description: '',
                  saving: false,
                  error: ''
                })}
                disabled={subtaskEditor.saving}
              >
                <X size={16} />
              </button>
            </div>
            <div className="mobile-status-sheet-body">
              <label className="mobile-status-sheet-note-field">
                <span>Title</span>
                <input value={subtaskEditor.title} onChange={(event) => setSubtaskEditor((prev) => ({ ...prev, title: event.target.value }))} />
              </label>
              <label className="mobile-status-sheet-note-field">
                <span>Description</span>
                <textarea
                  rows={4}
                  value={subtaskEditor.description}
                  onChange={(event) => setSubtaskEditor((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Optional description"
                />
              </label>
              <button
                type="button"
                className="mobile-status-sheet-option"
                disabled={!editorSubtask}
                onClick={() =>
                  editorSubtask
                    ? void openStatusChangeFlow({
                        entityType: 'action',
                        listId: editorSubtask.listId || resolvedDrawerItem?.listId || null,
                        targetId: editorSubtask.id,
                        parentItemId: subtaskEditor.parentItemId,
                        title: editorSubtask.name || subtaskEditor.title,
                        currentStatusKey: editorSubtask.subtask_status || null,
                        currentStatusLabel: editorStatusEntry?.name || 'No status'
                      })
                    : undefined
                }
              >
                <span className="mobile-status-sheet-option-label">
                  Status
                  <strong>{editorStatusEntry?.name || 'No status'}</strong>
                </span>
              </button>
              {subtaskEditor.error && <div className="mobile-task-drawer-empty error">{subtaskEditor.error}</div>}
              <div className="mobile-status-sheet-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setSubtaskEditor({
                    open: false,
                    parentItemId: null,
                    subtask: null,
                    title: '',
                    description: '',
                    saving: false,
                    error: ''
                  })}
                  disabled={subtaskEditor.saving}
                >
                  Cancel
                </button>
                <button type="button" className="primary" onClick={() => void saveSubtaskEditor()} disabled={subtaskEditor.saving}>
                  {subtaskEditor.saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}
