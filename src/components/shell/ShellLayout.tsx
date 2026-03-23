import { useEffect, useMemo, useState } from 'react';
import { CaretLeft, PencilSimple } from '@phosphor-icons/react';
import { ArrowRight, Compass, Plus, Search } from 'lucide-react';
import { ComputerDollar } from 'clicons-react';
import type { Event } from '../../types/Event';
import type { NodeSetupApplyProposal, ChatProposal } from '../../types/chat';
import { buildShellDaySnapshot } from './daySnapshot';
import ShellLeftRail from './ShellLeftRail';
import ShellCenter from './ShellCenter';
import ShellRightRail from './ShellRightRail';
import ShellNavPill from './ShellNavPill';
import { createEmptyShellComposerDraft, type ShellComposerDraft } from './composerTypes';
import type { ShellFocalSummary, ShellItemSummary, ShellListSummary, ShellTaskSummary } from './types';
import {
  cloneNodeStructureConfig,
  shellNodeCatalog,
  type ShellNodeAutomationRule,
  type ShellNodeDataRule,
  type ShellInstalledNode,
  type ShellNodeDefinition,
  type ShellNodeFieldConfidenceImportance,
  type ShellNodeFieldConfig,
  type ShellNodeFieldSemanticRole,
  type ShellNodeFieldType,
  type ShellNodeListConfig,
  type ShellNodeStatusConfig,
  type ShellNodeStructureConfig,
  type ShellNodeTimeBlockNamingRule
} from './nodeRuntime';
import SurfacePanel from './SurfacePanel';
import CalendarSurfacePanel from './CalendarSurfacePanel';
import ShellListSurface from './ShellListSurface';
import type { ChatContext } from '../../types/chat';
import focalBoardService from '../../services/focalBoardService';
import listFieldService from '../../services/listFieldService';
import fieldOptionService from '../../services/fieldOptionService';
import nodeMarketplaceService from '../../services/nodeMarketplaceService';
import { calendarService } from '../../services/calendarService';

interface ShellLayoutProps {
  userId: string;
  sourceEvents: Event[];
  events: Event[];
  currentBlock: Event | null;
  nextBlock: Event | null;
  upcomingBlocks: Event[];
  focals: ShellFocalSummary[];
  lists: ShellListSummary[];
  items: ShellItemSummary[];
  tasks: ShellTaskSummary[];
  loading: boolean;
  error: string | null;
  onSaveEvent: (event: Event) => Promise<Event>;
  onCreateSpace: (name: string) => Promise<void>;
  onCreateList: (focalId: string, name: string) => Promise<void>;
  onRefreshShellData: () => Promise<void>;
}

const SHELL_PANEL_ANIMATION_MS = 420;

const DEFAULT_BLOCK_DURATION_MINUTES = 60;

const toTitleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const buildCurrentBlockDraft = (partial: { title: string; description: string; end: Date }): Event => {
  const start = new Date();
  const end = partial.end.getTime() > start.getTime()
    ? partial.end
    : new Date(start.getTime() + DEFAULT_BLOCK_DURATION_MINUTES * 60 * 1000);

  return {
    id: crypto.randomUUID(),
    title: partial.title,
    description: partial.description,
    start: start.toISOString(),
    end: end.toISOString(),
    recurrence: 'none',
    recurrenceConfig: undefined,
    includeWeekends: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver',
    tasks: [],
    blockTasks: [],
    tags: []
  };
};

const parseCurrentBlockInput = (input: string): { title: string; description: string; end: Date } => {
  const raw = input.trim();
  const normalized = raw.replace(/\s+/g, ' ');
  const now = new Date();

  let end = new Date(now.getTime() + DEFAULT_BLOCK_DURATION_MINUTES * 60 * 1000);

  const untilMatch = normalized.match(/\buntil\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (untilMatch) {
    let hours = Number(untilMatch[1]);
    const minutes = Number(untilMatch[2] || '0');
    const meridiem = untilMatch[3]?.toLowerCase() || null;

    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 1);
    }
    end = candidate;
  } else {
    const durationMatch = normalized.match(/\bfor\s+(\d{1,3})\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i);
    if (durationMatch) {
      const amount = Number(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      const minutes = unit.startsWith('h') ? amount * 60 : amount;
      end = new Date(now.getTime() + minutes * 60 * 1000);
    }
  }

  const cleaned = normalized
    .replace(/\b(currently|right now)\b/gi, '')
    .replace(/\b(i am|i'm|im)\s+/gi, '')
    .replace(/\bworking on\s+/gi, '')
    .replace(/\buntil\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\bfor\s+\d{1,3}\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/gi, '')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '');

  const title = toTitleCase(cleaned || raw || 'Current block');

  return {
    title,
    description: raw,
    end
  };
};

const mergeDateAndTimeToIso = (
  dateValue: string | null | undefined,
  timeValue: string | null | undefined,
  fallbackIso?: string | null
): string => {
  if (dateValue && timeValue) {
    const [hours, minutes] = timeValue.split(':').map(Number);
    const merged = new Date(`${dateValue}T00:00:00`);
    merged.setHours(hours || 0, minutes || 0, 0, 0);
    return merged.toISOString();
  }

  if (fallbackIso) {
    return fallbackIso;
  }

  return new Date().toISOString();
};

const recurrenceUnitForDraft = (
  recurrence: ShellComposerDraft['recurrence']
): 'day' | 'week' | 'month' | 'year' => {
  switch (recurrence) {
    case 'daily':
      return 'day';
    case 'monthly':
      return 'month';
    case 'custom':
      return 'week';
    case 'weekly':
    default:
      return 'week';
  }
};

const normalizeKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const createNodeListDraft = (): ShellNodeListConfig => ({
  id: crypto.randomUUID(),
  name: '',
  itemLabel: '',
  taskLabel: '',
  statuses: [],
  fields: []
});

const createNodeStatusDraft = (): ShellNodeStatusConfig => ({
  id: crypto.randomUUID(),
  name: '',
  color: '#94a3b8',
  default: false
});

const createNodeFieldDraft = (): ShellNodeFieldConfig => ({
  id: crypto.randomUUID(),
  name: '',
  type: 'text',
  required: false,
  pinned: false,
  usedFor: [],
  semanticRole: 'other',
  confidenceImportance: 'optional',
  options: []
});

const createNodeTimeBlockNamingRuleDraft = (): ShellNodeTimeBlockNamingRule => ({
  id: crypto.randomUUID(),
  label: '',
  aliases: [],
  template: ''
});

const createNodeDataRuleDraft = (required: boolean): ShellNodeDataRule => ({
  id: crypto.randomUUID(),
  label: '',
  semanticRole: 'other',
  required,
  fallbackAssumption: ''
});

const createNodeAutomationRuleDraft = (): ShellNodeAutomationRule => ({
  id: crypto.randomUUID(),
  name: '',
  trigger: '',
  action: ''
});

const summarizeWorkspaceBlueprint = (config: ShellNodeStructureConfig): string =>
  [
    config.workspaceBlueprint.primarySpaces.length ? `Primary spaces: ${config.workspaceBlueprint.primarySpaces.join(', ')}.` : '',
    config.workspaceBlueprint.primaryLists.length ? `Primary lists: ${config.workspaceBlueprint.primaryLists.join(', ')}.` : '',
    config.workspaceBlueprint.planningModel ? `Planning model: ${config.workspaceBlueprint.planningModel}` : '',
    config.workspaceBlueprint.routeModel ? `Route model: ${config.workspaceBlueprint.routeModel}` : '',
    config.workspaceBlueprint.activityLogModel ? `Activity log model: ${config.workspaceBlueprint.activityLogModel}` : '',
    config.workspaceBlueprint.taskInTimeBlockModel ? `Task-in-time-block model: ${config.workspaceBlueprint.taskInTimeBlockModel}` : ''
  ]
    .filter(Boolean)
    .join(' ');

const renderNodeIcon = (iconKey: ShellNodeDefinition['iconKey'], size: number): JSX.Element => {
  if (iconKey === 'computer_dollar') {
    return <ComputerDollar size={size} strokeWidth={1.5} />;
  }

  return <Compass size={size} />;
};

export default function ShellLayout({
  userId,
  sourceEvents,
  events,
  currentBlock,
  nextBlock,
  upcomingBlocks,
  focals,
  lists,
  items,
  tasks,
  loading,
  error,
  onSaveEvent,
  onCreateSpace,
  onCreateList,
  onRefreshShellData
}: ShellLayoutProps): JSX.Element {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activePanel, setActivePanel] = useState<'workspace' | 'spaces' | 'calendar' | 'nodes' | null>(null);
  const [renderedPanel, setRenderedPanel] = useState<'workspace' | 'spaces' | 'calendar' | 'nodes' | null>(null);
  const [panelVisualState, setPanelVisualState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [activeFocalId, setActiveFocalId] = useState<string | null>(focals[0]?.id || null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [taskSnapshotDate, setTaskSnapshotDate] = useState(() => new Date());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [aiThreadEvent, setAiThreadEvent] = useState<Event | null>(null);
  const [aiRequest, setAiRequest] = useState<{
    id: string;
    prompt: string;
    context: ChatContext | null;
    label: {
      kicker: string;
      title: string;
    };
  } | null>(null);
  const [navComposerOpen, setNavComposerOpen] = useState(false);
  const [navComposerDraft, setNavComposerDraft] = useState<ShellComposerDraft>(createEmptyShellComposerDraft());
  const [spacePanelFocalId, setSpacePanelFocalId] = useState<string | null>(null);
  const [spacePanelListId, setSpacePanelListId] = useState<string | null>(null);
  const [spacePanelItemId, setSpacePanelItemId] = useState<string | null>(null);
  const [spacePanelMode, setSpacePanelMode] = useState<'space' | 'list' | 'item'>('space');
  const [availableNodes, setAvailableNodes] = useState<ShellNodeDefinition[]>(shellNodeCatalog);
  const [installedNodes, setInstalledNodes] = useState<ShellInstalledNode[]>([]);
  const [nodePanelNodeId, setNodePanelNodeId] = useState<string | null>(shellNodeCatalog[0]?.id || null);
  const [nodePanelView, setNodePanelView] = useState<'marketplace' | 'detail'>('marketplace');
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  const [aiPanelExpanded, setAiPanelExpanded] = useState(false);
  const [nodeEditorOpen, setNodeEditorOpen] = useState(false);
  const [nodeUninstallConfirmOpen, setNodeUninstallConfirmOpen] = useState(false);
  const [nodeEditorDraft, setNodeEditorDraft] = useState<{
    name: string;
    summary: string;
    setupSummary: string;
    setupPrompt: string;
    structureBlueprint: string;
    structureConfig: ShellNodeStructureConfig;
    setupLogic: string;
    operateLogic: string;
    versionNotes: string;
  }>({
    name: '',
    summary: '',
    setupSummary: '',
    setupPrompt: '',
    structureBlueprint: '',
    structureConfig: cloneNodeStructureConfig(),
    setupLogic: '',
    operateLogic: '',
    versionNotes: ''
  });

  useEffect(() => {
    if (!focals.length) {
      setActiveFocalId(null);
      return;
    }

    if (!activeFocalId || !focals.some((focal) => focal.id === activeFocalId)) {
      setActiveFocalId(focals[0].id);
    }
  }, [activeFocalId, focals]);

  useEffect(() => {
    let cancelled = false;

    const loadNodes = async (): Promise<void> => {
      const [published, installed] = await Promise.all([
        nodeMarketplaceService.listPublishedNodes(),
        nodeMarketplaceService.listInstalledNodes()
      ]);

      if (cancelled) return;

      setAvailableNodes(published);
      setInstalledNodes(installed);
      setNodePanelNodeId((current) => {
        if (current && published.some((node) => node.id === current)) return current;
        return published[0]?.id || null;
      });
    };

    void loadNodes();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const selectedFocal =
    focals.find((focal) => focal.id === activeFocalId) || focals[0] || null;
  const selectedNodeDefinition =
    availableNodes.find((node) => node.id === nodePanelNodeId) || availableNodes[0] || null;
  const selectedInstalledNode =
    installedNodes.find((node) => node.nodeId === selectedNodeDefinition?.id) || null;
  const canEditSelectedNode = Boolean(
    selectedNodeDefinition &&
      (selectedNodeDefinition.ownerUserId === userId ||
        (!selectedNodeDefinition.ownerUserId && selectedNodeDefinition.id === 'outside-sales-node'))
  );
  const filteredNodeCatalog = useMemo(() => {
    const query = nodeSearchQuery.trim().toLowerCase();
    if (!query) return availableNodes;
    return availableNodes.filter((node) => {
      const haystack = `${node.name} ${node.summary} ${node.category}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [availableNodes, nodeSearchQuery]);

  useEffect(() => {
    if (!selectedNodeDefinition) return;
    const nextStructureConfig = cloneNodeStructureConfig(selectedNodeDefinition.structureConfig);
    if (!nextStructureConfig.userFacingDescription) {
      nextStructureConfig.userFacingDescription = selectedNodeDefinition.setupSummary;
    }
    setNodeEditorDraft({
      name: selectedNodeDefinition.name,
      summary: selectedNodeDefinition.summary,
      setupSummary: selectedNodeDefinition.setupSummary,
      setupPrompt: selectedNodeDefinition.setupPrompt,
      structureBlueprint: selectedNodeDefinition.structureBlueprint,
      structureConfig: nextStructureConfig,
      setupLogic: selectedNodeDefinition.setupLogic,
      operateLogic: selectedNodeDefinition.operateLogic,
      versionNotes: selectedNodeDefinition.versionNotes || ''
    });
    setNodeEditorOpen(false);
    setNodeUninstallConfirmOpen(false);
  }, [selectedNodeDefinition?.id]);

  useEffect(() => {
    if (activePanel) {
      setRenderedPanel(activePanel);
      setPanelVisualState((prev) => (prev === 'open' && renderedPanel === activePanel ? prev : 'opening'));
      const frameId = window.requestAnimationFrame(() => {
        setPanelVisualState('open');
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (!renderedPanel || panelVisualState === 'closed') {
      return undefined;
    }

    setPanelVisualState('closing');
    const timeoutId = window.setTimeout(() => {
      setPanelVisualState('closed');
      setRenderedPanel(null);
    }, SHELL_PANEL_ANIMATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activePanel, panelVisualState, renderedPanel]);
  const selectedFocalLists = useMemo(() => {
    if (!selectedFocal?.id) return lists.slice(0, 8);
    return lists.filter((list) => list.focalId === selectedFocal.id).slice(0, 8);
  }, [lists, selectedFocal?.id]);
  const spacePanelFocal = focals.find((focal) => focal.id === spacePanelFocalId) || null;
  const spacePanelLists = spacePanelFocalId ? lists.filter((list) => list.focalId === spacePanelFocalId) : [];
  const spacePanelList = spacePanelLists.find((list) => list.id === spacePanelListId) || null;
  const spacePanelBreadcrumb = useMemo(() => {
    if (activePanel !== 'spaces' || spacePanelMode !== 'item' || !spacePanelFocal || !spacePanelList) {
      return undefined;
    }

    return (
      <nav className="shell-surface-breadcrumb" aria-label="Expanded item navigation">
        <button
          type="button"
          className="shell-surface-breadcrumb-link"
          onClick={() => {
            setSpacePanelFocalId(null);
            setSpacePanelListId(null);
            setSpacePanelItemId(null);
            setSpacePanelMode('space');
          }}
        >
          <CaretLeft size={12} weight="bold" />
          <span>Spaces</span>
        </button>
        <button
          type="button"
          className="shell-surface-breadcrumb-link"
          onClick={() => {
            setSpacePanelListId(null);
            setSpacePanelItemId(null);
            setSpacePanelMode('space');
          }}
        >
          <CaretLeft size={12} weight="bold" />
          <span>{spacePanelFocal.name}</span>
        </button>
        <button
          type="button"
          className="shell-surface-breadcrumb-link current"
          onClick={() => {
            setSpacePanelFocalId(spacePanelFocal.id);
            setSpacePanelListId(spacePanelList.id);
            setSpacePanelItemId(null);
            setSpacePanelMode('list');
          }}
        >
          <CaretLeft size={12} weight="bold" />
          <span>{spacePanelList.name}</span>
        </button>
      </nav>
    );
  }, [activePanel, spacePanelFocal, spacePanelList, spacePanelMode]);

  const dayKey = (value: Date): string =>
    `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  const selectedDateEvents = useMemo(() => {
    const selectedKey = dayKey(selectedDate);
    return [...events]
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .filter((event) => dayKey(new Date(event.start)) === selectedKey);
  }, [events, selectedDate]);

  useEffect(() => {
    if (!selectedEventId) return;
    if (!selectedDateEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [selectedDateEvents, selectedEventId]);

  const selectedIsToday = dayKey(selectedDate) === dayKey(new Date());
  const selectedIsFuture = selectedDate.getTime() > new Date(new Date().setHours(23, 59, 59, 999)).getTime();
  const activeSelectedDayBlock =
    selectedDateEvents.find((event) => {
      const start = new Date(event.start).getTime();
      const end = new Date(event.end).getTime();
      return start <= nowMs && end >= nowMs;
    }) || null;
  const primaryBlock = selectedIsToday ? activeSelectedDayBlock || currentBlock : selectedIsFuture ? null : selectedDateEvents[0] || null;
  const secondaryBlocks = useMemo(() => {
    if (selectedIsToday) {
      return selectedDateEvents.filter((event) => {
        if (primaryBlock && event.id === primaryBlock.id) return false;
        return new Date(event.end).getTime() >= nowMs;
      });
    }
    if (!primaryBlock) return selectedDateEvents;
    return selectedDateEvents.filter((event) => event.id !== primaryBlock.id);
  }, [nowMs, primaryBlock, selectedDateEvents, selectedIsToday]);
  const selectedNextBlock = selectedIsToday
      ? nextBlock && secondaryBlocks.some((event) => event.id === nextBlock.id)
      ? nextBlock
      : secondaryBlocks[0] || null
    : secondaryBlocks[0] || null;
  const selectedDaySnapshot = useMemo(
    () =>
      buildShellDaySnapshot({
        tasks,
        events,
        selectedDate: taskSnapshotDate
      }),
    [events, taskSnapshotDate, tasks]
  );

  const openNodeManager = (nodeId?: string): void => {
    setNodeSearchQuery('');
    setNodePanelNodeId(nodeId || availableNodes[0]?.id || null);
    setNodePanelView(nodeId ? 'detail' : 'marketplace');
    setActivePanel('nodes');
  };

  const closeActivePanel = (): void => {
    setActivePanel(null);
  };

  const installNodeIntoWorkspace = async (nodeId: string): Promise<void> => {
    const nextInstalledNodes = await nodeMarketplaceService.installNode(
      nodeId,
      selectedFocal?.id || focals[0]?.id || null
    );
    setInstalledNodes(nextInstalledNodes);
  };

  const uninstallNodeFromWorkspace = async (nodeId: string): Promise<void> => {
    const nextInstalledNodes = await nodeMarketplaceService.uninstallNode(nodeId);
    setInstalledNodes(nextInstalledNodes);
  };

  const toggleInstalledNodeAssignment = async (nodeId: string, focalId: string): Promise<void> => {
    const nextInstalledNodes = await nodeMarketplaceService.toggleNodeFocalAssignment(nodeId, focalId);
    setInstalledNodes(nextInstalledNodes);
  };

  const triggerNodeSetup = async (nodeId: string): Promise<void> => {
    const installedNode = installedNodes.find((entry) => entry.nodeId === nodeId) || null;
    const node = availableNodes.find((entry) => entry.id === nodeId) || null;
    if (!node) return;
    const setupFocalId =
      installedNode?.assignedFocalIds[0] || selectedFocal?.id || focals[0]?.id || null;
    const setupFocalName =
      focals.find((focal) => focal.id === setupFocalId)?.name || selectedFocal?.name || 'Selected space';

    setAiThreadEvent(null);
    setAiRequest({
      id: crypto.randomUUID(),
      prompt: `${node.setupPrompt} Target space: ${setupFocalName}.`,
      context: {
        ...(setupFocalId ? { focal_id: setupFocalId } : {}),
        node_id: node.id,
        node_slug: node.slug,
        node_name: node.name,
        node_mode: 'setup',
        node_structure_blueprint: node.structureBlueprint,
        node_structure_config: node.structureConfig,
        node_setup_logic: node.setupLogic,
        node_operate_logic: node.operateLogic
      },
      label: {
        kicker: 'Node setup',
        title: `${node.name} · ${setupFocalName}`
      }
    });
    const nextInstalledNodes = await nodeMarketplaceService.markSetupCompleted(nodeId);
    setInstalledNodes(nextInstalledNodes);
  };

  const saveNodeEdits = async (): Promise<void> => {
    if (!selectedNodeDefinition) return;
    const structureBlueprint = summarizeWorkspaceBlueprint(nodeEditorDraft.structureConfig).trim() || nodeEditorDraft.structureBlueprint.trim();
    const userFacingDescription = nodeEditorDraft.structureConfig.userFacingDescription.trim() || nodeEditorDraft.setupSummary.trim();
    const nextNodes = await nodeMarketplaceService.updatePublishedNode(selectedNodeDefinition.id, {
      name: nodeEditorDraft.name.trim(),
      summary: nodeEditorDraft.summary.trim(),
      setupSummary: userFacingDescription,
      setupPrompt: nodeEditorDraft.setupPrompt.trim(),
      structureBlueprint,
      structureConfig: nodeEditorDraft.structureConfig,
      setupLogic: nodeEditorDraft.setupLogic.trim(),
      operateLogic: nodeEditorDraft.operateLogic.trim(),
      versionNotes: nodeEditorDraft.versionNotes.trim(),
      iconKey: 'computer_dollar'
    });
    setAvailableNodes(nextNodes);
    setNodeEditorOpen(false);
  };

  const updateNodeStructureConfig = (
    updater: (current: ShellNodeStructureConfig) => ShellNodeStructureConfig
  ): void => {
    setNodeEditorDraft((prev) => ({
      ...prev,
      structureConfig: updater(cloneNodeStructureConfig(prev.structureConfig))
    }));
  };

  const updateNodeList = (listId: string, updater: (list: ShellNodeListConfig) => ShellNodeListConfig): void => {
    updateNodeStructureConfig((current) => ({
      ...current,
      lists: current.lists.map((list) => (list.id === listId ? updater({ ...list }) : list))
    }));
  };

  const updateNodeStatus = (
    listId: string,
    statusId: string,
    updater: (status: ShellNodeStatusConfig) => ShellNodeStatusConfig
  ): void => {
    updateNodeList(listId, (list) => ({
      ...list,
      statuses: list.statuses.map((status) => (status.id === statusId ? updater({ ...status }) : status))
    }));
  };

  const updateNodeField = (
    listId: string,
    fieldId: string,
    updater: (field: ShellNodeFieldConfig) => ShellNodeFieldConfig
  ): void => {
    updateNodeList(listId, (list) => ({
      ...list,
      fields: list.fields.map((field) => (field.id === fieldId ? updater({ ...field }) : field))
    }));
  };

  const applyNodeSetupProposal = async (proposal: NodeSetupApplyProposal): Promise<string> => {
    if (!proposal.focal_id) {
      throw new Error('Setup proposal is missing a target space');
    }

    const existingLists = await focalBoardService.getListsForFocal(proposal.focal_id);
    const createdListNames: string[] = [];
    const reusedListNames: string[] = [];

    for (const listDraft of proposal.lists) {
      const normalizedListName = listDraft.name.trim().toLowerCase();
      let targetList =
        existingLists.find((entry: any) => entry.name.trim().toLowerCase() === normalizedListName) || null;

      if (!targetList) {
        targetList = await focalBoardService.createLane(
          proposal.focal_id,
          userId,
          listDraft.name.trim(),
          listDraft.item_label || null,
          listDraft.action_label || null
        );
        existingLists.push(targetList);
        createdListNames.push(listDraft.name.trim());
      } else {
        reusedListNames.push(listDraft.name.trim());
      }

      const [existingStatuses, existingSubtaskStatuses, existingFields] = await Promise.all([
        focalBoardService.getLaneStatuses(targetList.id),
        focalBoardService.getLaneSubtaskStatuses(targetList.id),
        listFieldService.getFields(targetList.id)
      ]);

      for (const [index, statusDraft] of (listDraft.statuses || []).entries()) {
        const statusKey = normalizeKey(statusDraft.key || statusDraft.name);
        const exists = existingStatuses.find(
          (entry: any) =>
            normalizeKey(entry.key || '') === statusKey || entry.name.trim().toLowerCase() === statusDraft.name.trim().toLowerCase()
        );
        if (!exists) {
          const createdStatus = await focalBoardService.createLaneStatus(targetList.id, userId, {
            key: statusKey,
            name: statusDraft.name,
            color: statusDraft.color || '#94a3b8',
            group_key: statusDraft.group_key || 'todo',
            order_num: index,
            is_default: Boolean(statusDraft.is_default)
          });
          existingStatuses.push(createdStatus);
        }
      }

      for (const [index, statusDraft] of (listDraft.subtask_statuses || []).entries()) {
        const statusKey = normalizeKey(statusDraft.key || statusDraft.name);
        const exists = existingSubtaskStatuses.find(
          (entry: any) =>
            normalizeKey(entry.key || '') === statusKey || entry.name.trim().toLowerCase() === statusDraft.name.trim().toLowerCase()
        );
        if (!exists) {
          const createdStatus = await focalBoardService.createLaneSubtaskStatus(targetList.id, userId, {
            key: statusKey,
            name: statusDraft.name,
            color: statusDraft.color || '#94a3b8',
            group_key: statusDraft.group_key || 'todo',
            order_num: index,
            is_default: Boolean(statusDraft.is_default)
          });
          existingSubtaskStatuses.push(createdStatus);
        }
      }

      for (const [index, fieldDraft] of (listDraft.fields || []).entries()) {
        let targetField =
          existingFields.find(
            (entry) =>
              normalizeKey(entry.field_key || '') === normalizeKey(fieldDraft.name) ||
              entry.name.trim().toLowerCase() === fieldDraft.name.trim().toLowerCase()
          ) || null;

        if (!targetField) {
          targetField = await listFieldService.createField(targetList.id, {
            user_id: userId,
            name: fieldDraft.name,
            type: fieldDraft.type,
            order_index: index,
            is_pinned: Boolean(fieldDraft.is_pinned),
            is_primary: Boolean(fieldDraft.is_primary)
          });
          existingFields.push(targetField);
        }

        if ((fieldDraft.type === 'status' || fieldDraft.type === 'select') && Array.isArray(fieldDraft.options) && fieldDraft.options.length > 0) {
          const optionMap = new Map((targetField.options || []).map((option) => [option.label.trim().toLowerCase(), option]));
          for (const [optionIndex, optionDraft] of fieldDraft.options.entries()) {
            const key = optionDraft.label.trim().toLowerCase();
            if (optionMap.has(key)) continue;
            const createdOption = await fieldOptionService.createOption(targetField.id, {
              user_id: userId,
              label: optionDraft.label,
              order_index: optionIndex,
              color_fill: optionDraft.color_fill || null,
              color_border: optionDraft.color_border || null,
              color_text: optionDraft.color_text || null
            });
            targetField.options = [...(targetField.options || []), createdOption];
            optionMap.set(key, createdOption);
          }
        }
      }
    }

    await onRefreshShellData();

    const createdSummary = createdListNames.length > 0 ? `Created ${createdListNames.join(', ')}.` : null;
    const reusedSummary = reusedListNames.length > 0 ? `Reused ${reusedListNames.join(', ')}.` : null;
    return [proposal.summary, createdSummary, reusedSummary].filter(Boolean).join(' ');
  };

  const seedComposerFromProposal = (proposal: ChatProposal, assistantText: string): void => {
    const baseDraft = createEmptyShellComposerDraft();
    if (proposal.type === 'create_time_block') {
      const scheduledDate = new Date(proposal.scheduled_start_utc);
      const endDate = proposal.scheduled_end_utc ? new Date(proposal.scheduled_end_utc) : null;
      setNavComposerDraft({
        ...baseDraft,
        type: 'time_block',
        name: proposal.title,
        description: proposal.notes || assistantText || '',
        subitems: [''],
        scheduledDate: scheduledDate.toISOString().slice(0, 10),
        startTime: scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        endTime: endDate
          ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          : '',
        scheduledStartUtc: proposal.scheduled_start_utc,
        scheduledEndUtc: proposal.scheduled_end_utc || null
      });
      setSelectedDate(scheduledDate);
    } else {
      const targetItem =
        'item_id' in proposal ? items.find((entry) => entry.id === proposal.item_id) || null : null;
      const targetList = targetItem ? lists.find((entry) => entry.id === targetItem.listId) || null : null;
      const scheduledDate =
        'scheduled_at' in proposal && proposal.scheduled_at ? new Date(proposal.scheduled_at) : null;
      setNavComposerDraft({
        ...baseDraft,
        type: proposal.type === 'create_item' ? 'item' : proposal.type === 'create_action' ? 'task' : 'note',
        name: 'title' in proposal ? proposal.title : proposal.event_title,
        description: 'notes' in proposal && proposal.notes ? proposal.notes : assistantText || '',
        subitems: [''],
        focalId: targetList?.focalId || null,
        listId: targetItem?.listId || null,
        parentItemId: targetItem?.id || null,
        parentItemQuery: targetItem?.title || '',
        scheduledDate: scheduledDate ? scheduledDate.toISOString().slice(0, 10) : null,
        startTime:
          scheduledDate
            ? scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
            : '',
        scheduledStartUtc: 'scheduled_at' in proposal ? proposal.scheduled_at || null : null
      });
    }
    setNavComposerOpen(true);
  };

  const handleShellProposal = async (proposal: ChatProposal, assistantText: string): Promise<string | void> => {
    if (proposal.type === 'node_setup_apply') {
      return applyNodeSetupProposal(proposal);
    }

    if (proposal.type === 'create_time_block' && proposal.follow_up_request) {
      const saved = await onSaveEvent({
        id: crypto.randomUUID(),
        title: proposal.title,
        description: proposal.notes || '',
        start: proposal.scheduled_start_utc,
        end:
          proposal.scheduled_end_utc ||
          new Date(new Date(proposal.scheduled_start_utc).getTime() + DEFAULT_BLOCK_DURATION_MINUTES * 60 * 1000).toISOString(),
        recurrence: 'none',
        recurrenceConfig: undefined,
        includeWeekends: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver',
        tasks: [],
        blockTasks: [],
        projectIds: [],
        tags: []
      });
      const startDate = new Date(saved.start);
      setSelectedDate(startDate);
      setSelectedEventId(saved.id);
      setAiThreadEvent(null);
      setAiRequest({
        id: crypto.randomUUID(),
        prompt: proposal.follow_up_request,
        context: proposal.follow_up_context || null,
        label: {
          kicker: 'Continue planning',
          title: saved.title
        }
      });
      return `Created "${saved.title}". Continuing the planning pass for that block…`;
    }

    seedComposerFromProposal(proposal, assistantText);
    return undefined;
  };

  const openComposerForSelectedDate = (): void => {
    setNavComposerDraft(
      createEmptyShellComposerDraft({
        type: 'time_block',
        scheduledDate: selectedDate.toISOString().slice(0, 10)
      })
    );
    setNavComposerOpen(true);
  };

  const toggleComposerForSelectedDate = (): void => {
    if (navComposerOpen) {
      setNavComposerOpen(false);
      return;
    }
    openComposerForSelectedDate();
  };

  const openItemFromShell = (itemId: string): void => {
    const targetItem = items.find((entry) => entry.id === itemId) || null;
    if (!targetItem || !targetItem.listId) return;
    setNavComposerOpen(false);
    setActiveFocalId(targetItem.focalId || null);
    setSpacePanelFocalId(targetItem.focalId || null);
    setSpacePanelListId(targetItem.listId);
    setSpacePanelItemId(targetItem.id);
    setSpacePanelMode('item');
    setActivePanel('spaces');
  };

  const addBlockTaskToEvent = async (eventId: string, title: string): Promise<void> => {
    const targetEvent = events.find((entry) => entry.id === eventId) || null;
    if (!targetEvent) throw new Error('Could not find the selected time block');
    await calendarService.createBlockTask({
      userId,
      timeBlockId: targetEvent.sourceEventId || targetEvent.id,
      title: title.trim(),
      sortOrder: (targetEvent.blockTasks || []).length
    });
    await onRefreshShellData();
  };

  const toggleBlockTaskInEvent = async (eventId: string, taskId: string, checked: boolean): Promise<void> => {
    await calendarService.updateBlockTask(taskId, { isCompleted: checked });
    await onRefreshShellData();
  };

  const toggleBlockTaskItemInEvent = async (eventId: string, blockTaskItemId: string, checked: boolean): Promise<void> => {
    const targetEvent = events.find((entry) => entry.id === eventId) || null;
    if (!targetEvent) throw new Error('Could not find the selected time block');
    await calendarService.setBlockTaskItemCompletion({
      blockTaskItemId,
      timeBlockId: targetEvent.sourceEventId || targetEvent.id,
      scheduledStartUtc: targetEvent.occurrenceStartUtc || targetEvent.start,
      scheduledEndUtc: targetEvent.occurrenceEndUtc || targetEvent.end,
      checked,
    });
    await onRefreshShellData();
  };

  const addBlockTaskWithItemsToEvent = async (
    eventId: string,
    title: string,
    linkedItemIds: string[]
  ): Promise<void> => {
    const targetEvent = events.find((entry) => entry.id === eventId) || null;
    if (!targetEvent) throw new Error('Could not find the selected time block');
    const created = await calendarService.createBlockTask({
      userId,
      timeBlockId: targetEvent.sourceEventId || targetEvent.id,
      title: title.trim(),
      sortOrder: (targetEvent.blockTasks || []).length
    });
    for (const [index, itemId] of linkedItemIds.entries()) {
      await calendarService.attachItemToBlockTask({
        userId,
        blockTaskId: created.id,
        itemId,
        sortOrder: index
      });
    }
    await onRefreshShellData();
  };

  const openComposerForEvent = (event: Event): void => {
    const sourceEvent =
      sourceEvents.find((entry) => entry.id === (event.sourceEventId || event.id)) ||
      events.find((entry) => entry.id === (event.sourceEventId || event.id)) ||
      event;
    const startDate = new Date(event.occurrenceStartUtc || sourceEvent.start);
    const endDate = new Date(event.occurrenceEndUtc || sourceEvent.end);
    setNavComposerDraft(
      createEmptyShellComposerDraft({
        type: 'time_block',
        lockedType: true,
        headerTitle: sourceEvent.title,
        sourceEventId: sourceEvent.id,
        name: sourceEvent.title,
        description: sourceEvent.description || '',
        subitems: sourceEvent.blockTasks?.length ? sourceEvent.blockTasks.map((task) => task.title || '') : [''],
        scheduledDate: startDate.toISOString().slice(0, 10),
        startTime: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        endTime: endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        scheduledStartUtc: sourceEvent.start,
        scheduledEndUtc: sourceEvent.end,
        recurrence: (sourceEvent.recurrence as ShellComposerDraft['recurrence']) || 'none',
        recurrenceInterval: sourceEvent.recurrenceConfig?.interval || 1,
        includeWeekends: sourceEvent.includeWeekends ?? true
      })
    );
    setNavComposerOpen(true);
  };

  const handlePlanFutureDay = async (input: string): Promise<void> => {
    const dateIso = selectedDate.toISOString().slice(0, 10);
    setAiThreadEvent(null);
    setAiRequest({
      id: crypto.randomUUID(),
      prompt: input,
      context: {
        planning_date: dateIso,
        planning_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver'
      },
      label: {
        kicker: 'Plan day',
        title: selectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      }
    });
  };

  useEffect(() => {
    if (activePanel === 'spaces' && navComposerOpen) {
      setNavComposerOpen(false);
    }
  }, [activePanel, navComposerOpen]);

  return (
    <div className={`shell-layout ${activePanel ? 'has-surface-panel' : ''}`.trim()}>
      <ShellLeftRail
        userId={userId}
        focals={focals}
        lists={lists}
        items={items}
        selectedDate={taskSnapshotDate}
        onSelectDate={setTaskSnapshotDate}
        daySnapshot={selectedDaySnapshot}
        onRefreshShellData={onRefreshShellData}
        activeFocalId={selectedFocal?.id || null}
        onSelectFocal={setActiveFocalId}
        onOpenItem={(itemId, listId, focalId) => {
          setNavComposerOpen(false);
          setActiveFocalId(focalId || null);
          setSpacePanelFocalId(focalId || null);
          setSpacePanelListId(listId);
          setSpacePanelItemId(itemId);
          setSpacePanelMode('item');
          setActivePanel('spaces');
        }}
        onAddSpace={() => {
          setNavComposerDraft(
            createEmptyShellComposerDraft({
              type: 'space',
              name: '',
              description: '',
              subitems: ['']
            })
          );
          setNavComposerOpen(true);
        }}
        onAddList={(focalId) => {
          setNavComposerDraft(
            createEmptyShellComposerDraft({
              type: 'list',
              lockedType: true,
              headerTitle: selectedFocal?.name || 'New list',
              focalId,
              name: '',
              description: '',
              subitems: ['']
            })
          );
          setNavComposerOpen(true);
        }}
        onExpandSpaces={({ focalId, listId, mode }) => {
          setNavComposerOpen(false);
          setSpacePanelFocalId(focalId);
          setSpacePanelListId(mode === 'list' ? listId : null);
          setSpacePanelItemId(null);
          setSpacePanelMode(mode);
          setActivePanel('spaces');
        }}
      />
      <ShellCenter
        primaryBlock={primaryBlock}
        nextBlock={selectedNextBlock}
        visibleBlocks={secondaryBlocks}
        selectedDate={selectedDate}
        loading={loading}
        error={error}
        lists={lists}
        items={items}
        onStartCurrentBlock={async () => {
          const saved = await onSaveEvent(
            buildCurrentBlockDraft({
              title: 'Current block',
              description: 'Started from the shell quick-start surface.',
              end: new Date(Date.now() + DEFAULT_BLOCK_DURATION_MINUTES * 60 * 1000)
            })
          );
          setSelectedDate(new Date(saved.start));
          setSelectedEventId(saved.id);
        }}
        onDescribeCurrentBlock={async (input) => {
          const parsed = parseCurrentBlockInput(input);
          const saved = await onSaveEvent(buildCurrentBlockDraft(parsed));
          setSelectedDate(new Date(saved.start));
          setSelectedEventId(saved.id);
        }}
        onPlanFutureDay={handlePlanFutureDay}
        onOpenCreateComposer={openComposerForSelectedDate}
        onEditBlock={openComposerForEvent}
        onToggleCreateComposer={toggleComposerForSelectedDate}
        onAddBlockTask={addBlockTaskWithItemsToEvent}
        onToggleBlockTask={toggleBlockTaskInEvent}
        onToggleBlockTaskItem={toggleBlockTaskItemInEvent}
        onOpenItem={openItemFromShell}
        onSelectEvent={(event) => {
          setSelectedDate(new Date(event.start));
          setSelectedEventId(event.id);
          openComposerForEvent(event);
        }}
        onOpenAiThread={(event) => {
          setAiThreadEvent(event);
        }}
      />
      <ShellRightRail
        currentBlock={currentBlock}
        onOpenCalendar={() => setActivePanel('calendar')}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        aiThreadEvent={aiThreadEvent}
        aiRequest={aiRequest}
        onPushProposal={handleShellProposal}
        onClearAiThread={() => setAiThreadEvent(null)}
        onAiExpandedChange={setAiPanelExpanded}
      />
      <ShellNavPill
        composerOpen={navComposerOpen}
        onComposerOpenChange={setNavComposerOpen}
        onComposerFreshOpen={() => {
          setNavComposerDraft(createEmptyShellComposerDraft());
          setNavComposerOpen(true);
        }}
        composerDraft={navComposerDraft}
        onComposerDraftChange={setNavComposerDraft}
        onComposerSubmit={async (draft) => {
          if (draft.type === 'time_block') {
            const existingEvent =
              (draft.sourceEventId ? events.find((event) => event.id === draft.sourceEventId) : null) || null;
            const title = draft.name.trim() || existingEvent?.title || 'Untitled block';
            const description = draft.description.trim();
            const startIso = mergeDateAndTimeToIso(
              draft.scheduledDate,
              draft.startTime,
              draft.scheduledStartUtc || existingEvent?.start || null
            );
            const endIso = mergeDateAndTimeToIso(
              draft.scheduledDate,
              draft.endTime,
              draft.scheduledEndUtc || existingEvent?.end || null
            );
            const startMs = new Date(startIso).getTime();
            const endMs = new Date(endIso).getTime();
            const safeEndIso =
              Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
                ? endIso
                : new Date(startMs + DEFAULT_BLOCK_DURATION_MINUTES * 60 * 1000).toISOString();
            const cleanedSubitems = draft.subitems.map((entry) => entry.trim()).filter(Boolean);
            const blockTasks = cleanedSubitems.map((entry, index) => {
              const existingTask = existingEvent?.blockTasks?.[index];
              return {
                id: existingTask?.id || crypto.randomUUID(),
                timeBlockId: existingEvent?.id || draft.sourceEventId || '',
                title: entry,
                description: existingTask?.description || null,
                sortOrder: index,
                isCompleted: existingTask?.isCompleted || false,
                linkedItems: existingTask?.linkedItems || []
              };
            });
            const recurrence = draft.recurrence || 'none';
            const recurrenceConfig =
              recurrence !== 'none'
                ? {
                    unit: recurrenceUnitForDraft(recurrence),
                    interval: Math.max(1, draft.recurrenceInterval || 1),
                    limitType: 'indefinite' as const
                  }
                : undefined;

            const saved = await onSaveEvent({
              id: existingEvent?.id || draft.sourceEventId || crypto.randomUUID(),
              title,
              description,
              start: startIso,
              end: safeEndIso,
              recurrence,
              recurrenceConfig,
              includeWeekends: draft.includeWeekends ?? existingEvent?.includeWeekends ?? true,
              tasks: existingEvent?.tasks || [],
              blockTasks,
              projectIds: existingEvent?.projectIds || [],
              timezone:
                existingEvent?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver',
              tags: existingEvent?.tags || []
            });
            setSelectedDate(new Date(saved.start));
            setSelectedEventId(saved.id);
            return;
          }
          if (draft.type === 'space') {
            const name = draft.name.trim();
            if (!name) throw new Error('Space name is required');
            await onCreateSpace(name);
            await onRefreshShellData();
            return;
          }
          if (draft.type === 'list') {
            const name = draft.name.trim();
            if (!name) throw new Error('List name is required');
            if (!draft.focalId) throw new Error('Parent space is required');
            await onCreateList(draft.focalId, name);
            await onRefreshShellData();
            return;
          }
          if (draft.type === 'item') {
            const name = draft.name.trim();
            if (!name) throw new Error('Item name is required');
            if (!draft.listId) throw new Error('Parent list is required');
            await focalBoardService.createItem(draft.listId, userId, name, draft.description.trim() || null);
            await onRefreshShellData();
            return;
          }
          if (draft.type === 'task') {
            const name = draft.name.trim();
            if (!name) throw new Error('Task name is required');
            if (!draft.listId) throw new Error('Parent list is required');

            let parentItemId = draft.parentItemId || null;
            if (!parentItemId) {
              const parentTitle = draft.parentItemQuery?.trim();
              if (!parentTitle) throw new Error('Parent item is required');
              const createdParent = await focalBoardService.createItem(draft.listId, userId, parentTitle, null);
              parentItemId = createdParent.id;
            }

            const scheduledAt = draft.scheduledDate
              ? mergeDateAndTimeToIso(draft.scheduledDate, draft.startTime || '09:00', null)
              : null;

            await focalBoardService.createAction(parentItemId, userId, name, draft.description.trim() || null, scheduledAt, null);
            await onRefreshShellData();
            return;
          }
        }}
        focals={focals}
        lists={lists}
        items={items}
        nodeCatalog={availableNodes}
        installedNodes={installedNodes}
        onOpenNodeManager={openNodeManager}
      />
      {renderedPanel === 'workspace' ? (
        <div className="shell-surface-overlay" data-visual-state={panelVisualState}>
          <div className="shell-surface-overlay-panel" data-visual-state={panelVisualState}>
            <SurfacePanel
              kicker="Current block workspace"
              title={currentBlock?.title || 'Current workspace'}
              subtitle="This is the center surface in expanded mode. It keeps the shell context around it instead of navigating you away."
              onClose={closeActivePanel}
            >
              <div className="shell-workspace-panel">
                <section className="shell-workspace-panel-main">
                  <div className="shell-workspace-panel-band">
                    <strong>{currentBlock ? 'In progress now' : 'No active block'}</strong>
                    <span>
                      {currentBlock
                        ? `${new Date(currentBlock.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()} - ${new Date(currentBlock.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`
                        : 'The shell center will anchor here once a live block exists.'}
                    </span>
                  </div>
                  <div className="shell-surface-placeholder">
                    <strong>{currentBlock?.description?.trim() || 'Workspace details surface'}</strong>
                    <span>
                      The next pass will move real block editing and execution into this center panel so it becomes the core cockpit surface.
                    </span>
                  </div>
                </section>
                <aside className="shell-workspace-panel-side">
                  <div className="shell-surface-list-card">
                    <strong>Next up</strong>
                    <span>
                      {nextBlock
                        ? `${nextBlock.title} at ${new Date(nextBlock.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`
                        : 'No immediate handoff block scheduled.'}
                    </span>
                  </div>
                  <div className="shell-surface-list-card">
                    <strong>Upcoming stack</strong>
                    <span>{upcomingBlocks.length} future blocks already loaded into the shell preview.</span>
                  </div>
                </aside>
              </div>
            </SurfacePanel>
          </div>
        </div>
      ) : null}
      {renderedPanel === 'spaces' ? (
        <div className="shell-surface-overlay" data-visual-state={panelVisualState}>
          <div className="shell-surface-overlay-panel" data-visual-state={panelVisualState}>
            <SurfacePanel
              tone="dark"
              density="compact"
              kickerContent={spacePanelBreadcrumb}
              kicker={
                spacePanelMode === 'item' && spacePanelList
                  ? `Spaces / ${spacePanelFocal?.name || 'Space'} / ${spacePanelList.name}`
                  : spacePanelMode === 'list' && spacePanelList
                    ? `Spaces / ${spacePanelFocal?.name || 'Space'}`
                    : spacePanelFocal
                      ? 'Spaces'
                      : 'Spaces'
              }
              title={
                spacePanelMode === 'item'
                  ? ''
                  : spacePanelFocal
                    ? spacePanelList?.name || spacePanelFocal.name
                    : 'Spaces'
              }
              subtitle={undefined}
              onClose={closeActivePanel}
            >
              {!spacePanelFocal ? (
                <div className="shell-space-panel">
                  <div className="shell-space-panel-grid">
                    {focals.map((focal) => (
                      <button
                        key={focal.id}
                        type="button"
                        className="shell-space-panel-card"
                        onClick={() => {
                          setSpacePanelFocalId(focal.id);
                          setSpacePanelListId(null);
                          setSpacePanelItemId(null);
                          setSpacePanelMode('space');
                        }}
                      >
                        <strong>{focal.name}</strong>
                        <span>{focal.listCount} lists</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : !spacePanelList || spacePanelMode === 'space' ? (
                <div className="shell-space-panel shell-space-panel-detail">
                  <section className="shell-space-panel-main">
                    <button
                      type="button"
                      className="shell-space-panel-back"
                      onClick={() => {
                        setSpacePanelFocalId(null);
                        setSpacePanelListId(null);
                        setSpacePanelItemId(null);
                        setSpacePanelMode('space');
                      }}
                    >
                      Back to spaces
                    </button>
                    <div className="shell-space-panel-grid">
                      {spacePanelLists.map((list) => (
                      <button
                        key={list.id}
                        type="button"
                        className="shell-space-panel-card"
                        onClick={() => {
                          setSpacePanelListId(list.id);
                          setSpacePanelItemId(null);
                          setSpacePanelMode('list');
                        }}
                      >
                          <strong>{list.name}</strong>
                          <span>{spacePanelFocal.name}</span>
                        </button>
                      ))}
                      {spacePanelLists.length === 0 ? (
                        <article className="shell-space-panel-empty">
                          <strong>No lists yet</strong>
                          <span>This space is ready for its first list.</span>
                        </article>
                      ) : null}
                    </div>
                  </section>
                </div>
              ) : (
                <ShellListSurface
                  userId={userId}
                  listId={spacePanelList.id}
                  initialItemId={spacePanelItemId}
                  mode={spacePanelMode === 'item' ? 'item' : 'list'}
                  onOpenItem={(itemId) => {
                    setSpacePanelItemId(itemId);
                    setSpacePanelMode('item');
                  }}
                  onBackToList={() => {
                    setSpacePanelItemId(null);
                    setSpacePanelMode('list');
                  }}
                />
              )}
            </SurfacePanel>
          </div>
        </div>
      ) : null}
      {renderedPanel === 'calendar' ? (
        <div className="shell-surface-overlay" data-visual-state={panelVisualState}>
          <div className="shell-surface-overlay-panel" data-visual-state={panelVisualState}>
            <CalendarSurfacePanel
              userId={userId}
              events={events}
              selectedDate={selectedDate}
              selectedEventId={selectedEventId}
              onSelectDate={setSelectedDate}
              onSelectEvent={setSelectedEventId}
              onSaveEvent={onSaveEvent}
              onClose={closeActivePanel}
            />
          </div>
        </div>
      ) : null}
      {renderedPanel === 'nodes' && selectedNodeDefinition ? (
        <div className="shell-surface-overlay" data-visual-state={panelVisualState}>
          <div
            className={`shell-surface-overlay-panel ${aiPanelExpanded ? 'shell-surface-overlay-panel-ai-open' : ''}`.trim()}
            data-visual-state={panelVisualState}
          >
            <SurfacePanel
              className="shell-node-marketplace-panel"
              tone="dark"
              kicker={nodePanelView === 'marketplace' ? '' : 'Node details'}
              hideHeaderText={nodePanelView === 'detail'}
              kickerContent={
                nodePanelView === 'detail' ? (
                  <nav className="shell-surface-breadcrumb" aria-label="Node marketplace navigation">
                    <button
                      type="button"
                      className="shell-surface-breadcrumb-link"
                      onClick={() => setNodePanelView('marketplace')}
                    >
                      <CaretLeft size={12} weight="bold" />
                      <span>Marketplace</span>
                    </button>
                    <span className="shell-surface-breadcrumb-link current">
                      <span>{selectedNodeDefinition.name.replace(/\s+node$/i, '')}</span>
                    </span>
                  </nav>
                ) : undefined
              }
              title={nodePanelView === 'marketplace' ? 'Node Marketplace' : selectedNodeDefinition.name}
              subtitle={nodePanelView === 'marketplace' ? undefined : selectedNodeDefinition.summary}
              headerActions={
                nodePanelView === 'marketplace' ? (
                  <>
                    <button
                      type="button"
                      className="shell-node-marketplace-add"
                      aria-label="Create node"
                    >
                      <Plus size={14} />
                    </button>
                    <label className="shell-node-marketplace-search" aria-label="Search nodes">
                      <Search size={14} />
                      <input
                        value={nodeSearchQuery}
                        onChange={(event) => setNodeSearchQuery(event.target.value)}
                        placeholder="Search nodes"
                      />
                    </label>
                  </>
                ) : canEditSelectedNode ? (
                  <>
                    {nodeEditorOpen ? (
                      <button
                        type="button"
                        className="shell-node-marketplace-owner-edit"
                        onClick={() => void saveNodeEdits()}
                      >
                        Save
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="shell-node-marketplace-owner-edit"
                      onClick={() => setNodeEditorOpen((prev) => !prev)}
                    >
                      {nodeEditorOpen ? 'Done' : 'Edit'}
                    </button>
                  </>
                ) : null
              }
              onClose={closeActivePanel}
            >
              {nodePanelView === 'marketplace' ? (
                <div className="shell-node-marketplace-home">
                  <div className="shell-node-marketplace-grid-home">
                    {filteredNodeCatalog.map((node) => {
                      const isInstalled = installedNodes.some((entry) => entry.nodeId === node.id);
                      return (
                        <button
                          key={node.id}
                          type="button"
                          className="shell-node-marketplace-card-home"
                          onClick={() => {
                            setNodePanelNodeId(node.id);
                            setNodePanelView('detail');
                          }}
                        >
                          <div className="shell-node-marketplace-card-home-top">
                            <span className="shell-node-marketplace-listing-icon" aria-hidden="true">
                              {renderNodeIcon(node.iconKey, 24)}
                            </span>
                            <div className="shell-node-marketplace-card-home-heading">
                              <strong>{node.name.replace(/\s+node$/i, '')}</strong>
                              <span>{isInstalled ? 'Installed' : node.category}</span>
                            </div>
                          </div>
                          <div className="shell-node-marketplace-card-home-copy">
                            <p>{node.summary}</p>
                            <span>v{node.version}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {filteredNodeCatalog.length === 0 ? (
                    <div className="shell-node-marketplace-no-results">No matching nodes yet.</div>
                  ) : null}
                </div>
              ) : (
                <div className={`shell-node-marketplace-detail shell-node-app-page ${nodeEditorOpen ? 'editing' : ''}`.trim()}>
                  <section className="shell-node-figma-page">
                    <div className="shell-node-figma-hero">
                      <div className="shell-node-figma-brand">
                        <div className="shell-node-figma-icon-wrap shell-node-figma-icon-wrap-glyph" aria-hidden="true">
                          {renderNodeIcon(selectedNodeDefinition.iconKey, 38)}
                        </div>
                        <div className="shell-node-figma-title-block">
                          <div className="shell-node-inline-edit-head">
                            {nodeEditorOpen ? (
                              <button type="button" className="shell-node-inline-edit-pen" aria-label="Editing name">
                                <PencilSimple size={14} weight="bold" />
                              </button>
                            ) : null}
                          </div>
                          {nodeEditorOpen ? (
                            <input
                              className="shell-node-inline-title-input"
                              value={nodeEditorDraft.name}
                              onChange={(event) => setNodeEditorDraft((prev) => ({ ...prev, name: event.target.value }))}
                            />
                          ) : (
                            <h1>{selectedNodeDefinition.name.replace(/\s+node$/i, '')}</h1>
                          )}
                          <p>by: Grant Hillam</p>
                        </div>
                      </div>

                      <div className="shell-node-figma-actions">
                        {selectedInstalledNode ? (
                          <>
                            <div className="shell-node-figma-installed-wrap">
                              <button
                                type="button"
                                className="shell-node-action shell-node-action-installed"
                                onClick={() => setNodeUninstallConfirmOpen((prev) => !prev)}
                              >
                                Installed
                              </button>
                              {nodeUninstallConfirmOpen ? (
                                <div className="shell-node-uninstall-popout" role="dialog" aria-label="Confirm uninstall">
                                  <strong>Uninstall?</strong>
                                  <p>
                                    This will remove this node and its setup logic from your workspace and stop its view of affected spaces.
                                  </p>
                                  <button
                                    type="button"
                                    className="shell-node-uninstall-confirm"
                                    onClick={() => void uninstallNodeFromWorkspace(selectedNodeDefinition.id)}
                                  >
                                    Uninstall
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="shell-node-figma-setup-link"
                              onClick={() => void triggerNodeSetup(selectedNodeDefinition.id)}
                            >
                              <span>Set Up</span>
                              <ArrowRight size={15} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="shell-node-action shell-node-action-install"
                            onClick={() => void installNodeIntoWorkspace(selectedNodeDefinition.id)}
                          >
                            Install
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="shell-node-figma-copy">
                      {nodeEditorOpen ? (
                        <button type="button" className="shell-node-inline-edit-pen shell-node-inline-edit-pen-block" aria-label="Editing summary">
                          <PencilSimple size={14} weight="bold" />
                        </button>
                      ) : null}
                      {nodeEditorOpen ? (
                        <textarea
                          className="shell-node-inline-copy-input shell-node-inline-copy-input-summary"
                          rows={2}
                          value={nodeEditorDraft.summary}
                          onChange={(event) => setNodeEditorDraft((prev) => ({ ...prev, summary: event.target.value }))}
                        />
                      ) : (
                        <p>{selectedNodeDefinition.summary}</p>
                      )}

                      <div className="shell-node-figma-copy-block">
                        <strong>User-facing Description:</strong>
                        {nodeEditorOpen ? (
                          <button type="button" className="shell-node-inline-edit-pen shell-node-inline-edit-pen-section" aria-label="Editing user-facing description">
                            <PencilSimple size={14} weight="bold" />
                          </button>
                        ) : null}
                        {nodeEditorOpen ? (
                          <textarea
                            className="shell-node-inline-copy-input"
                            rows={3}
                            value={nodeEditorDraft.structureConfig.userFacingDescription}
                            onChange={(event) =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                userFacingDescription: event.target.value
                              }))
                            }
                          />
                        ) : (
                          <p>{nodeEditorDraft.structureConfig.userFacingDescription || selectedNodeDefinition.summary}</p>
                        )}
                      </div>

                      <div className="shell-node-figma-copy-block">
                        <strong>Install Prompt:</strong>
                        {nodeEditorOpen ? (
                          <button type="button" className="shell-node-inline-edit-pen shell-node-inline-edit-pen-section" aria-label="Editing install prompt">
                            <PencilSimple size={14} weight="bold" />
                          </button>
                        ) : null}
                        {nodeEditorOpen ? (
                          <textarea
                            className="shell-node-inline-copy-input"
                            rows={3}
                            value={nodeEditorDraft.setupPrompt}
                            onChange={(event) => setNodeEditorDraft((prev) => ({ ...prev, setupPrompt: event.target.value }))}
                          />
                        ) : (
                          <p>{nodeEditorDraft.setupPrompt}</p>
                        )}
                      </div>
                    </div>
                  </section>
                  {nodeEditorOpen ? (
                    <aside className="shell-node-config-panel">
                      <div className="shell-node-config-section">
                        <strong>Workspace Blueprint</strong>
                        <input
                          className="shell-node-config-input"
                          value={nodeEditorDraft.structureConfig.workspaceBlueprint.primarySpaces.join(', ')}
                          placeholder="Primary spaces"
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              workspaceBlueprint: {
                                ...current.workspaceBlueprint,
                                primarySpaces: event.target.value.split(',').map((value) => value.trim()).filter(Boolean)
                              }
                            }))
                          }
                        />
                        <input
                          className="shell-node-config-input"
                          value={nodeEditorDraft.structureConfig.workspaceBlueprint.primaryLists.join(', ')}
                          placeholder="Primary lists"
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              workspaceBlueprint: {
                                ...current.workspaceBlueprint,
                                primaryLists: event.target.value.split(',').map((value) => value.trim()).filter(Boolean)
                              }
                            }))
                          }
                        />
                        <textarea
                          className="shell-node-config-input"
                          rows={2}
                          value={nodeEditorDraft.structureConfig.workspaceBlueprint.planningModel}
                          placeholder="Planning model"
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              workspaceBlueprint: {
                                ...current.workspaceBlueprint,
                                planningModel: event.target.value
                              }
                            }))
                          }
                        />
                        <textarea
                          className="shell-node-config-input"
                          rows={2}
                          value={nodeEditorDraft.structureConfig.workspaceBlueprint.routeModel}
                          placeholder="Route model"
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              workspaceBlueprint: {
                                ...current.workspaceBlueprint,
                                routeModel: event.target.value
                              }
                            }))
                          }
                        />
                        <textarea
                          className="shell-node-config-input"
                          rows={2}
                          value={nodeEditorDraft.structureConfig.workspaceBlueprint.activityLogModel}
                          placeholder="Activity log model"
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              workspaceBlueprint: {
                                ...current.workspaceBlueprint,
                                activityLogModel: event.target.value
                              }
                            }))
                          }
                        />
                        <textarea
                          className="shell-node-config-input"
                          rows={2}
                          value={nodeEditorDraft.structureConfig.workspaceBlueprint.taskInTimeBlockModel}
                          placeholder="Task-in-time-block model"
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              workspaceBlueprint: {
                                ...current.workspaceBlueprint,
                                taskInTimeBlockModel: event.target.value
                              }
                            }))
                          }
                        />
                      </div>
                      <div className="shell-node-config-section">
                        <strong>Lists, Statuses & Fields</strong>
                        <div className="shell-node-structure-list">
                          {nodeEditorDraft.structureConfig.lists.map((list) => (
                            <section key={list.id} className="shell-node-structure-card">
                              <div className="shell-node-structure-row shell-node-structure-row-top">
                                <input
                                  className="shell-node-config-input"
                                  value={list.name}
                                  placeholder="List name"
                                  onChange={(event) => updateNodeList(list.id, (current) => ({ ...current, name: event.target.value }))}
                                />
                                <button
                                  type="button"
                                  className="shell-node-structure-remove"
                                  onClick={() =>
                                    updateNodeStructureConfig((current) => ({
                                      ...current,
                                      lists: current.lists.filter((entry) => entry.id !== list.id)
                                    }))
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="shell-node-structure-row shell-node-structure-row-two">
                                <input
                                  className="shell-node-config-input"
                                  value={list.itemLabel || ''}
                                  placeholder="Item label"
                                  onChange={(event) => updateNodeList(list.id, (current) => ({ ...current, itemLabel: event.target.value }))}
                                />
                                <input
                                  className="shell-node-config-input"
                                  value={list.taskLabel || ''}
                                  placeholder="Task label"
                                  onChange={(event) => updateNodeList(list.id, (current) => ({ ...current, taskLabel: event.target.value }))}
                                />
                              </div>
                              <div className="shell-node-structure-subsection">
                                <span>Statuses</span>
                                {(list.statuses || []).map((status) => (
                                  <div key={status.id} className="shell-node-structure-row shell-node-structure-row-status">
                                    <input
                                      className="shell-node-config-input"
                                      value={status.name}
                                      placeholder="Status"
                                      onChange={(event) => updateNodeStatus(list.id, status.id, (current) => ({ ...current, name: event.target.value }))}
                                    />
                                    <input
                                      className="shell-node-config-input shell-node-config-input-color"
                                      value={status.color || ''}
                                      placeholder="#94a3b8"
                                      onChange={(event) => updateNodeStatus(list.id, status.id, (current) => ({ ...current, color: event.target.value }))}
                                    />
                                    <label className="shell-node-config-toggle">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(status.default)}
                                        onChange={(event) =>
                                          updateNodeList(list.id, (current) => ({
                                            ...current,
                                            statuses: current.statuses.map((entry) =>
                                              entry.id === status.id
                                                ? { ...entry, default: event.target.checked }
                                                : { ...entry, default: false }
                                            )
                                          }))
                                        }
                                      />
                                      <span>Default</span>
                                    </label>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  className="shell-node-structure-add"
                                  onClick={() =>
                                    updateNodeList(list.id, (current) => ({
                                      ...current,
                                      statuses: [...current.statuses, createNodeStatusDraft()]
                                    }))
                                  }
                                >
                                  + Add status
                                </button>
                              </div>
                              <div className="shell-node-structure-subsection">
                                <span>Fields</span>
                                {(list.fields || []).map((field) => (
                                  <div key={field.id} className="shell-node-structure-field-card">
                                    <div className="shell-node-structure-row shell-node-structure-row-two">
                                      <input
                                        className="shell-node-config-input"
                                        value={field.name}
                                        placeholder="Field name"
                                        onChange={(event) => updateNodeField(list.id, field.id, (current) => ({ ...current, name: event.target.value }))}
                                      />
                                      <select
                                        className="shell-node-config-input"
                                        value={field.type}
                                        onChange={(event) =>
                                          updateNodeField(list.id, field.id, (current) => ({
                                            ...current,
                                            type: event.target.value as ShellNodeFieldType,
                                            options:
                                              event.target.value === 'select' || event.target.value === 'status'
                                                ? current.options || []
                                                : []
                                          }))
                                        }
                                      >
                                        {['text', 'number', 'date', 'boolean', 'contact', 'select', 'status'].map((type) => (
                                          <option key={type} value={type}>
                                            {type}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="shell-node-structure-row shell-node-structure-row-two">
                                      <label className="shell-node-config-toggle">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(field.required)}
                                          onChange={(event) => updateNodeField(list.id, field.id, (current) => ({ ...current, required: event.target.checked }))}
                                        />
                                        <span>Required</span>
                                      </label>
                                      <label className="shell-node-config-toggle">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(field.pinned)}
                                          onChange={(event) => updateNodeField(list.id, field.id, (current) => ({ ...current, pinned: event.target.checked }))}
                                        />
                                        <span>Pinned</span>
                                      </label>
                                    </div>
                                    <input
                                      className="shell-node-config-input"
                                      value={(field.usedFor || []).join(', ')}
                                      placeholder="Used for: routing, day_planning"
                                      onChange={(event) =>
                                        updateNodeField(list.id, field.id, (current) => ({
                                          ...current,
                                          usedFor: event.target.value
                                            .split(',')
                                            .map((value) => value.trim())
                                            .filter(Boolean)
                                        }))
                                      }
                                    />
                                    <div className="shell-node-structure-row shell-node-structure-row-two">
                                      <select
                                        className="shell-node-config-input"
                                        value={field.semanticRole || 'other'}
                                        onChange={(event) =>
                                          updateNodeField(list.id, field.id, (current) => ({
                                            ...current,
                                            semanticRole: event.target.value as ShellNodeFieldSemanticRole
                                          }))
                                        }
                                      >
                                        {['routing', 'scheduling', 'contact', 'qualification', 'follow_up', 'ownership', 'activity_log', 'other'].map((role) => (
                                          <option key={role} value={role}>
                                            {role}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        className="shell-node-config-input"
                                        value={field.confidenceImportance || 'optional'}
                                        onChange={(event) =>
                                          updateNodeField(list.id, field.id, (current) => ({
                                            ...current,
                                            confidenceImportance: event.target.value as ShellNodeFieldConfidenceImportance
                                          }))
                                        }
                                      >
                                        {['critical', 'preferred', 'optional'].map((importance) => (
                                          <option key={importance} value={importance}>
                                            {importance}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    {field.type === 'select' || field.type === 'status' ? (
                                      <input
                                        className="shell-node-config-input"
                                        value={(field.options || []).map((option) => option.label).join(', ')}
                                        placeholder="Allowed values"
                                        onChange={(event) =>
                                          updateNodeField(list.id, field.id, (current) => ({
                                            ...current,
                                            options: event.target.value
                                              .split(',')
                                              .map((value) => value.trim())
                                              .filter(Boolean)
                                              .map((label, index) => ({
                                                id: current.options?.[index]?.id || crypto.randomUUID(),
                                                label
                                              }))
                                          }))
                                        }
                                      />
                                    ) : null}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  className="shell-node-structure-add"
                                  onClick={() =>
                                    updateNodeList(list.id, (current) => ({
                                      ...current,
                                      fields: [...current.fields, createNodeFieldDraft()]
                                    }))
                                  }
                                >
                                  + Add field
                                </button>
                              </div>
                            </section>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="shell-node-structure-add shell-node-structure-add-list"
                          onClick={() =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              lists: [...current.lists, createNodeListDraft()]
                            }))
                          }
                        >
                          + Add list
                        </button>
                      </div>
                      <div className="shell-node-config-section">
                        <strong>Required vs Optional Data</strong>
                        <div className="shell-node-structure-subsection">
                          <span>Required data</span>
                          {nodeEditorDraft.structureConfig.dataPolicy.requiredFields.map((rule) => (
                            <div key={rule.id} className="shell-node-structure-field-card">
                              <input
                                className="shell-node-config-input"
                                value={rule.label}
                                placeholder="Required data rule"
                                onChange={(event) =>
                                  updateNodeStructureConfig((current) => ({
                                    ...current,
                                    dataPolicy: {
                                      ...current.dataPolicy,
                                      requiredFields: current.dataPolicy.requiredFields.map((entry) =>
                                        entry.id === rule.id ? { ...entry, label: event.target.value } : entry
                                      )
                                    }
                                  }))
                                }
                              />
                              <div className="shell-node-structure-row shell-node-structure-row-two">
                                <select
                                  className="shell-node-config-input"
                                  value={rule.semanticRole}
                                  onChange={(event) =>
                                    updateNodeStructureConfig((current) => ({
                                      ...current,
                                      dataPolicy: {
                                        ...current.dataPolicy,
                                        requiredFields: current.dataPolicy.requiredFields.map((entry) =>
                                          entry.id === rule.id
                                            ? { ...entry, semanticRole: event.target.value as ShellNodeFieldSemanticRole }
                                            : entry
                                        )
                                      }
                                    }))
                                  }
                                >
                                  {['routing', 'scheduling', 'contact', 'qualification', 'follow_up', 'ownership', 'activity_log', 'other'].map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="shell-node-structure-remove"
                                  onClick={() =>
                                    updateNodeStructureConfig((current) => ({
                                      ...current,
                                      dataPolicy: {
                                        ...current.dataPolicy,
                                        requiredFields: current.dataPolicy.requiredFields.filter((entry) => entry.id !== rule.id)
                                      }
                                    }))
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                              <textarea
                                className="shell-node-config-input"
                                rows={2}
                                value={rule.fallbackAssumption || ''}
                                placeholder="Fallback assumption"
                                onChange={(event) =>
                                  updateNodeStructureConfig((current) => ({
                                    ...current,
                                    dataPolicy: {
                                      ...current.dataPolicy,
                                      requiredFields: current.dataPolicy.requiredFields.map((entry) =>
                                        entry.id === rule.id ? { ...entry, fallbackAssumption: event.target.value } : entry
                                      )
                                    }
                                  }))
                                }
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            className="shell-node-structure-add"
                            onClick={() =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                dataPolicy: {
                                  ...current.dataPolicy,
                                  requiredFields: [...current.dataPolicy.requiredFields, createNodeDataRuleDraft(true)]
                                }
                              }))
                            }
                          >
                            + Add required data rule
                          </button>
                        </div>
                        <div className="shell-node-structure-subsection">
                          <span>Optional data</span>
                          {nodeEditorDraft.structureConfig.dataPolicy.optionalFields.map((rule) => (
                            <div key={rule.id} className="shell-node-structure-field-card">
                              <input
                                className="shell-node-config-input"
                                value={rule.label}
                                placeholder="Optional data rule"
                                onChange={(event) =>
                                  updateNodeStructureConfig((current) => ({
                                    ...current,
                                    dataPolicy: {
                                      ...current.dataPolicy,
                                      optionalFields: current.dataPolicy.optionalFields.map((entry) =>
                                        entry.id === rule.id ? { ...entry, label: event.target.value } : entry
                                      )
                                    }
                                  }))
                                }
                              />
                              <div className="shell-node-structure-row shell-node-structure-row-two">
                                <select
                                  className="shell-node-config-input"
                                  value={rule.semanticRole}
                                  onChange={(event) =>
                                    updateNodeStructureConfig((current) => ({
                                      ...current,
                                      dataPolicy: {
                                        ...current.dataPolicy,
                                        optionalFields: current.dataPolicy.optionalFields.map((entry) =>
                                          entry.id === rule.id
                                            ? { ...entry, semanticRole: event.target.value as ShellNodeFieldSemanticRole }
                                            : entry
                                        )
                                      }
                                    }))
                                  }
                                >
                                  {['routing', 'scheduling', 'contact', 'qualification', 'follow_up', 'ownership', 'activity_log', 'other'].map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="shell-node-structure-remove"
                                  onClick={() =>
                                    updateNodeStructureConfig((current) => ({
                                      ...current,
                                      dataPolicy: {
                                        ...current.dataPolicy,
                                        optionalFields: current.dataPolicy.optionalFields.filter((entry) => entry.id !== rule.id)
                                      }
                                    }))
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                              <textarea
                                className="shell-node-config-input"
                                rows={2}
                                value={rule.fallbackAssumption || ''}
                                placeholder="Fallback assumption"
                                onChange={(event) =>
                                  updateNodeStructureConfig((current) => ({
                                    ...current,
                                    dataPolicy: {
                                      ...current.dataPolicy,
                                      optionalFields: current.dataPolicy.optionalFields.map((entry) =>
                                        entry.id === rule.id ? { ...entry, fallbackAssumption: event.target.value } : entry
                                      )
                                    }
                                  }))
                                }
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            className="shell-node-structure-add"
                            onClick={() =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                dataPolicy: {
                                  ...current.dataPolicy,
                                  optionalFields: [...current.dataPolicy.optionalFields, createNodeDataRuleDraft(false)]
                                }
                              }))
                            }
                          >
                            + Add optional data rule
                          </button>
                        </div>
                      </div>
                      <div className="shell-node-config-section">
                        <strong>Planning rules</strong>
                        <input
                          className="shell-node-config-input"
                          value={nodeEditorDraft.structureConfig.planning.locationFieldName || ''}
                          placeholder="Location field name"
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              planning: {
                                ...current.planning,
                                locationFieldName: event.target.value
                              }
                            }))
                          }
                        />
                        <label className="shell-node-config-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(nodeEditorDraft.structureConfig.planning.useLocationForRouting)}
                            onChange={(event) =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                planning: {
                                  ...current.planning,
                                  useLocationForRouting: event.target.checked
                                }
                              }))
                            }
                          />
                          <span>Use location for routing</span>
                        </label>
                        <label className="shell-node-config-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(nodeEditorDraft.structureConfig.planning.useLocationForDayPlanning)}
                            onChange={(event) =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                planning: {
                                  ...current.planning,
                                  useLocationForDayPlanning: event.target.checked
                                }
                              }))
                            }
                          />
                          <span>Use location for day planning</span>
                        </label>
                        <select
                          className="shell-node-config-input"
                          value={nodeEditorDraft.structureConfig.planning.defaultTaskPlacement || 'standalone'}
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              planning: {
                                ...current.planning,
                                defaultTaskPlacement: event.target.value as 'standalone' | 'inside_time_block'
                              }
                            }))
                          }
                        >
                          <option value="standalone">Default task placement: standalone</option>
                          <option value="inside_time_block">Default task placement: inside time block</option>
                        </select>
                        <select
                          className="shell-node-config-input"
                          value={nodeEditorDraft.structureConfig.planning.noteIngestionMode || 'assistive'}
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              planning: {
                                ...current.planning,
                                noteIngestionMode: event.target.value as 'strict' | 'assistive' | 'autonomous'
                              }
                            }))
                          }
                        >
                          <option value="strict">Note ingestion: strict</option>
                          <option value="assistive">Note ingestion: assistive</option>
                          <option value="autonomous">Note ingestion: autonomous</option>
                        </select>
                        <div className="shell-node-structure-subsection">
                          <span>Time block naming</span>
                          {(nodeEditorDraft.structureConfig.planning.timeBlockNaming || []).map((rule) => (
                            <div key={rule.id} className="shell-node-structure-field-card">
                              <div className="shell-node-structure-row shell-node-structure-row-two">
                                <input
                                  className="shell-node-config-input"
                                  value={rule.label}
                                  placeholder="Block type label"
                                  onChange={(event) =>
                                    updateNodeStructureConfig((current) => ({
                                      ...current,
                                      planning: {
                                        ...current.planning,
                                        timeBlockNaming: (current.planning.timeBlockNaming || []).map((entry) =>
                                          entry.id === rule.id ? { ...entry, label: event.target.value } : entry
                                        )
                                      }
                                    }))
                                  }
                                />
                                <input
                                  className="shell-node-config-input"
                                  value={rule.template}
                                  placeholder="Template e.g. Prospecting Block {n}"
                                  onChange={(event) =>
                                    updateNodeStructureConfig((current) => ({
                                      ...current,
                                      planning: {
                                        ...current.planning,
                                        timeBlockNaming: (current.planning.timeBlockNaming || []).map((entry) =>
                                          entry.id === rule.id ? { ...entry, template: event.target.value } : entry
                                        )
                                      }
                                    }))
                                  }
                                />
                              </div>
                              <div className="shell-node-structure-row shell-node-structure-row-top">
                                <input
                                  className="shell-node-config-input"
                                  value={(rule.aliases || []).join(', ')}
                                  placeholder="Aliases e.g. prospecting, prospect"
                                  onChange={(event) =>
                                    updateNodeStructureConfig((current) => ({
                                      ...current,
                                      planning: {
                                        ...current.planning,
                                        timeBlockNaming: (current.planning.timeBlockNaming || []).map((entry) =>
                                          entry.id === rule.id
                                            ? {
                                                ...entry,
                                                aliases: event.target.value
                                                  .split(',')
                                                  .map((value) => value.trim())
                                                  .filter(Boolean)
                                              }
                                            : entry
                                        )
                                      }
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="shell-node-structure-remove"
                                  onClick={() =>
                                    updateNodeStructureConfig((current) => ({
                                      ...current,
                                      planning: {
                                        ...current.planning,
                                        timeBlockNaming: (current.planning.timeBlockNaming || []).filter((entry) => entry.id !== rule.id)
                                      }
                                    }))
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="shell-node-structure-add"
                            onClick={() =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                planning: {
                                  ...current.planning,
                                  timeBlockNaming: [...(current.planning.timeBlockNaming || []), createNodeTimeBlockNamingRuleDraft()]
                                }
                              }))
                            }
                          >
                            + Add naming rule
                          </button>
                        </div>
                      </div>
                      <div className="shell-node-config-section">
                        <strong>Behavior Rules</strong>
                        <textarea
                          className="shell-node-config-input"
                          rows={3}
                          value={nodeEditorDraft.structureConfig.behavior.primaryOperatingModes.join('\n')}
                          placeholder="Primary operating modes, one per line"
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              behavior: {
                                ...current.behavior,
                                primaryOperatingModes: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean)
                              }
                            }))
                          }
                        />
                        <textarea
                          className="shell-node-config-input"
                          rows={4}
                          value={nodeEditorDraft.structureConfig.behavior.actionPriorityRules.join('\n')}
                          placeholder="Action priority rules, one per line"
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              behavior: {
                                ...current.behavior,
                                actionPriorityRules: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean)
                              }
                            }))
                          }
                        />
                        <textarea
                          className="shell-node-config-input"
                          rows={3}
                          value={nodeEditorDraft.structureConfig.behavior.schedulingBehavior.join('\n')}
                          placeholder="Scheduling behavior, one per line"
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              behavior: {
                                ...current.behavior,
                                schedulingBehavior: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean)
                              }
                            }))
                          }
                        />
                        <textarea
                          className="shell-node-config-input"
                          rows={3}
                          value={nodeEditorDraft.structureConfig.behavior.activityLoggingBehavior.join('\n')}
                          placeholder="Activity logging behavior, one per line"
                          onChange={(event) =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              behavior: {
                                ...current.behavior,
                                activityLoggingBehavior: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean)
                              }
                            }))
                          }
                        />
                        <div className="shell-node-structure-subsection">
                          <span>Missing data handling</span>
                          <label className="shell-node-config-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(nodeEditorDraft.structureConfig.behavior.missingDataHandling.doNotBlockOnPartialData)}
                              onChange={(event) =>
                                updateNodeStructureConfig((current) => ({
                                  ...current,
                                  behavior: {
                                    ...current.behavior,
                                    missingDataHandling: {
                                      ...current.behavior.missingDataHandling,
                                      doNotBlockOnPartialData: event.target.checked
                                    }
                                  }
                                }))
                              }
                            />
                            <span>Do not block on partial data</span>
                          </label>
                          <label className="shell-node-config-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(nodeEditorDraft.structureConfig.behavior.missingDataHandling.buildFromBestAvailableData)}
                              onChange={(event) =>
                                updateNodeStructureConfig((current) => ({
                                  ...current,
                                  behavior: {
                                    ...current.behavior,
                                    missingDataHandling: {
                                      ...current.behavior.missingDataHandling,
                                      buildFromBestAvailableData: event.target.checked
                                    }
                                  }
                                }))
                              }
                            />
                            <span>Build from best available data</span>
                          </label>
                          <label className="shell-node-config-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(nodeEditorDraft.structureConfig.behavior.missingDataHandling.surfaceHighValueGapsInBatches)}
                              onChange={(event) =>
                                updateNodeStructureConfig((current) => ({
                                  ...current,
                                  behavior: {
                                    ...current.behavior,
                                    missingDataHandling: {
                                      ...current.behavior.missingDataHandling,
                                      surfaceHighValueGapsInBatches: event.target.checked
                                    }
                                  }
                                }))
                              }
                            />
                            <span>Surface high-value gaps in batches</span>
                          </label>
                          <label className="shell-node-config-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(nodeEditorDraft.structureConfig.behavior.missingDataHandling.avoidItemByItemNagging)}
                              onChange={(event) =>
                                updateNodeStructureConfig((current) => ({
                                  ...current,
                                  behavior: {
                                    ...current.behavior,
                                    missingDataHandling: {
                                      ...current.behavior.missingDataHandling,
                                      avoidItemByItemNagging: event.target.checked
                                    }
                                  }
                                }))
                              }
                            />
                            <span>Avoid item-by-item nagging</span>
                          </label>
                        </div>
                      </div>
                      <div className="shell-node-config-section">
                        <strong>Setup Wizard Rules</strong>
                        <label className="shell-node-config-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(nodeEditorDraft.structureConfig.behavior.setupWizardRules.detectMissingLists)}
                            onChange={(event) =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                behavior: {
                                  ...current.behavior,
                                  setupWizardRules: {
                                    ...current.behavior.setupWizardRules,
                                    detectMissingLists: event.target.checked
                                  }
                                }
                              }))
                            }
                          />
                          <span>Detect missing lists</span>
                        </label>
                        <label className="shell-node-config-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(nodeEditorDraft.structureConfig.behavior.setupWizardRules.detectMissingStatuses)}
                            onChange={(event) =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                behavior: {
                                  ...current.behavior,
                                  setupWizardRules: {
                                    ...current.behavior.setupWizardRules,
                                    detectMissingStatuses: event.target.checked
                                  }
                                }
                              }))
                            }
                          />
                          <span>Detect missing statuses</span>
                        </label>
                        <label className="shell-node-config-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(nodeEditorDraft.structureConfig.behavior.setupWizardRules.detectMissingFields)}
                            onChange={(event) =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                behavior: {
                                  ...current.behavior,
                                  setupWizardRules: {
                                    ...current.behavior.setupWizardRules,
                                    detectMissingFields: event.target.checked
                                  }
                                }
                              }))
                            }
                          />
                          <span>Detect missing fields</span>
                        </label>
                        <label className="shell-node-config-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(nodeEditorDraft.structureConfig.behavior.setupWizardRules.offerMappingBeforeCreate)}
                            onChange={(event) =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                behavior: {
                                  ...current.behavior,
                                  setupWizardRules: {
                                    ...current.behavior.setupWizardRules,
                                    offerMappingBeforeCreate: event.target.checked
                                  }
                                }
                              }))
                            }
                          />
                          <span>Offer mapping before creating duplicates</span>
                        </label>
                        <label className="shell-node-config-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(nodeEditorDraft.structureConfig.behavior.setupWizardRules.offerRepairActionsInBatches)}
                            onChange={(event) =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                behavior: {
                                  ...current.behavior,
                                  setupWizardRules: {
                                    ...current.behavior.setupWizardRules,
                                    offerRepairActionsInBatches: event.target.checked
                                  }
                                }
                              }))
                            }
                          />
                          <span>Offer repair actions in batches</span>
                        </label>
                        <label className="shell-node-config-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(nodeEditorDraft.structureConfig.behavior.setupWizardRules.allowPartialDataExecution)}
                            onChange={(event) =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                behavior: {
                                  ...current.behavior,
                                  setupWizardRules: {
                                    ...current.behavior.setupWizardRules,
                                    allowPartialDataExecution: event.target.checked
                                  }
                                }
                              }))
                            }
                          />
                          <span>Do not block execution if partial data exists</span>
                        </label>
                        <label className="shell-node-config-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(nodeEditorDraft.structureConfig.behavior.setupWizardRules.prioritizeHighValueRepairs)}
                            onChange={(event) =>
                              updateNodeStructureConfig((current) => ({
                                ...current,
                                behavior: {
                                  ...current.behavior,
                                  setupWizardRules: {
                                    ...current.behavior.setupWizardRules,
                                    prioritizeHighValueRepairs: event.target.checked
                                  }
                                }
                              }))
                            }
                          />
                          <span>Prioritize high-value repairs</span>
                        </label>
                      </div>
                      <div className="shell-node-config-section">
                        <strong>Automation Rules</strong>
                        {(nodeEditorDraft.structureConfig.behavior.automationRules || []).map((rule) => (
                          <div key={rule.id} className="shell-node-structure-field-card">
                            <input
                              className="shell-node-config-input"
                              value={rule.name}
                              placeholder="Rule name"
                              onChange={(event) =>
                                updateNodeStructureConfig((current) => ({
                                  ...current,
                                  behavior: {
                                    ...current.behavior,
                                    automationRules: current.behavior.automationRules.map((entry) =>
                                      entry.id === rule.id ? { ...entry, name: event.target.value } : entry
                                    )
                                  }
                                }))
                              }
                            />
                            <textarea
                              className="shell-node-config-input"
                              rows={2}
                              value={rule.trigger}
                              placeholder="Trigger"
                              onChange={(event) =>
                                updateNodeStructureConfig((current) => ({
                                  ...current,
                                  behavior: {
                                    ...current.behavior,
                                    automationRules: current.behavior.automationRules.map((entry) =>
                                      entry.id === rule.id ? { ...entry, trigger: event.target.value } : entry
                                    )
                                  }
                                }))
                              }
                            />
                            <textarea
                              className="shell-node-config-input"
                              rows={2}
                              value={rule.action}
                              placeholder="Action"
                              onChange={(event) =>
                                updateNodeStructureConfig((current) => ({
                                  ...current,
                                  behavior: {
                                    ...current.behavior,
                                    automationRules: current.behavior.automationRules.map((entry) =>
                                      entry.id === rule.id ? { ...entry, action: event.target.value } : entry
                                    )
                                  }
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="shell-node-structure-remove"
                              onClick={() =>
                                updateNodeStructureConfig((current) => ({
                                  ...current,
                                  behavior: {
                                    ...current.behavior,
                                    automationRules: current.behavior.automationRules.filter((entry) => entry.id !== rule.id)
                                  }
                                }))
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="shell-node-structure-add"
                          onClick={() =>
                            updateNodeStructureConfig((current) => ({
                              ...current,
                              behavior: {
                                ...current.behavior,
                                automationRules: [...current.behavior.automationRules, createNodeAutomationRuleDraft()]
                              }
                            }))
                          }
                        >
                          + Add automation rule
                        </button>
                      </div>
                      <div className="shell-node-config-section">
                        <strong>Setup Wizard Rules Notes</strong>
                        <textarea
                          className="shell-node-config-input shell-node-config-input-logic"
                          rows={8}
                          value={nodeEditorDraft.setupLogic}
                          onChange={(event) => setNodeEditorDraft((prev) => ({ ...prev, setupLogic: event.target.value }))}
                        />
                      </div>
                      <div className="shell-node-config-section">
                        <strong>Behavior Rules Notes</strong>
                        <textarea
                          className="shell-node-config-input shell-node-config-input-logic"
                          rows={8}
                          value={nodeEditorDraft.operateLogic}
                          onChange={(event) => setNodeEditorDraft((prev) => ({ ...prev, operateLogic: event.target.value }))}
                        />
                      </div>
                      <div className="shell-node-config-section">
                        <strong>Version notes</strong>
                        <textarea
                          className="shell-node-config-input"
                          rows={4}
                          value={nodeEditorDraft.versionNotes}
                          onChange={(event) => setNodeEditorDraft((prev) => ({ ...prev, versionNotes: event.target.value }))}
                        />
                      </div>
                    </aside>
                  ) : null}
                </div>
              )}
            </SurfacePanel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
