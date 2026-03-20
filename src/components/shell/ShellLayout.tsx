import { useEffect, useMemo, useState } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import type { Event } from '../../types/Event';
import { buildShellDaySnapshot } from './daySnapshot';
import ShellLeftRail from './ShellLeftRail';
import ShellCenter from './ShellCenter';
import ShellRightRail from './ShellRightRail';
import ShellNavPill from './ShellNavPill';
import { createEmptyShellComposerDraft, type ShellComposerDraft } from './composerTypes';
import type { ShellFocalSummary, ShellItemSummary, ShellListSummary, ShellTaskSummary } from './types';
import SurfacePanel from './SurfacePanel';
import CalendarSurfacePanel from './CalendarSurfacePanel';
import ShellListSurface from './ShellListSurface';
import type { ChatContext, ChatProposal } from '../../types/chat';
import focalBoardService from '../../services/focalBoardService';

interface ShellLayoutProps {
  userId: string;
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

export default function ShellLayout({
  userId,
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
  const [activePanel, setActivePanel] = useState<'workspace' | 'spaces' | 'calendar' | null>(null);
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

  useEffect(() => {
    if (!focals.length) {
      setActiveFocalId(null);
      return;
    }

    if (!activeFocalId || !focals.some((focal) => focal.id === activeFocalId)) {
      setActiveFocalId(focals[0].id);
    }
  }, [activeFocalId, focals]);

  const selectedFocal =
    focals.find((focal) => focal.id === activeFocalId) || focals[0] || null;
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
      setNavComposerDraft({
        ...baseDraft,
        type: proposal.type === 'create_item' ? 'item' : proposal.type === 'create_action' ? 'task' : 'note',
        name: 'title' in proposal ? proposal.title : proposal.event_title,
        description: 'notes' in proposal && proposal.notes ? proposal.notes : assistantText || '',
        subitems: ['']
      });
    }
    setNavComposerOpen(true);
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

  const openComposerForEvent = (event: Event): void => {
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    setNavComposerDraft(
      createEmptyShellComposerDraft({
        type: 'time_block',
        lockedType: true,
        headerTitle: event.title,
        sourceEventId: event.id,
        name: event.title,
        description: event.description || '',
        subitems: event.blockTasks?.length ? event.blockTasks.map((task) => task.title || '') : [''],
        scheduledDate: startDate.toISOString().slice(0, 10),
        startTime: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        endTime: endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        scheduledStartUtc: event.start,
        scheduledEndUtc: event.end,
        recurrence: (event.recurrence as ShellComposerDraft['recurrence']) || 'none',
        recurrenceInterval: event.recurrenceConfig?.interval || 1,
        includeWeekends: event.includeWeekends ?? true
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
        onPushProposal={seedComposerFromProposal}
        onClearAiThread={() => setAiThreadEvent(null)}
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
      />
      {activePanel === 'workspace' ? (
        <div className="shell-surface-overlay">
          <div className="shell-surface-overlay-panel">
            <SurfacePanel
              kicker="Current block workspace"
              title={currentBlock?.title || 'Current workspace'}
              subtitle="This is the center surface in expanded mode. It keeps the shell context around it instead of navigating you away."
              onClose={() => setActivePanel(null)}
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
      {activePanel === 'spaces' ? (
        <div className="shell-surface-overlay">
          <div className="shell-surface-overlay-panel">
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
              onClose={() => setActivePanel(null)}
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
      {activePanel === 'calendar' ? (
        <div className="shell-surface-overlay">
          <div className="shell-surface-overlay-panel">
            <CalendarSurfacePanel
              userId={userId}
              events={events}
              selectedDate={selectedDate}
              selectedEventId={selectedEventId}
              onSelectDate={setSelectedDate}
              onSelectEvent={setSelectedEventId}
              onSaveEvent={onSaveEvent}
              onClose={() => setActivePanel(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
