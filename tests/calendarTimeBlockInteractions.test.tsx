import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const navigateMock = vi.fn();
const useAuthMock = vi.fn();

const calendarServiceMock = {
  getWeekdayKeyForOccurrence: vi.fn(() => 'mon'),
  resolveItemsForOccurrence: vi.fn(() => ['item-1', 'item-2', 'item-3']),
  getTimeBlockContentRules: vi.fn(async () => [
    {
      id: 'rule-1',
      user_id: 'user-1',
      time_block_id: 'event-1',
      selector_type: 'all',
      selector_value: null,
      list_id: 'list-1',
      item_ids: ['item-1', 'item-2', 'item-3']
    }
  ]),
  getActionsForItems: vi.fn(async () => []),
  getOccurrenceTaskCompletionRows: vi.fn(async () => []),
  getOccurrenceCompletionRows: vi.fn(async () => []),
  setOccurrenceTaskCompletion: vi.fn(async () => null),
  setOccurrenceItemCompletion: vi.fn(async () => null),
  upsertTimeBlockContentRule: vi.fn(async (rule) => ({ id: 'rule-1', ...rule })),
  deleteTimeBlockContentRule: vi.fn(async () => undefined)
};

const focalBoardServiceMock = {
  createItem: vi.fn(async (_listId: string, _userId: string, title: string) => ({
    id: 'item-new',
    title
  })),
  getOptimizationProposal: vi.fn(async () => ({ source: 'heuristic', proposal: null })),
  getFocals: vi.fn(async () => []),
  getListsForUser: vi.fn(async () => []),
  getItemsByListId: vi.fn(async () => [])
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => useAuthMock()
}));

vi.mock('../src/services/calendarService', () => ({
  calendarService: calendarServiceMock
}));

vi.mock('../src/services/focalBoardService', () => ({
  default: focalBoardServiceMock
}));

vi.mock('../src/services/threadService', () => ({
  default: {
    getThreadByScope: vi.fn(async () => null),
    listComments: vi.fn(async () => []),
    getOrCreateThread: vi.fn(async () => ({ id: 'thread-1' })),
    addComment: vi.fn(async () => ({ id: 'comment-1' }))
  }
}));

import Calendar from '../src/components/Calendar';
import EventCard from '../src/components/calendar/EventCard';
import EventDrawer from '../src/components/calendar/EventDrawer';

describe('calendar time block interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      user: { id: 'user-1' },
      loading: false
    });
  });

  it('supports toggling, opening, overflow, and add from calendar block view', () => {
    const toggleMock = vi.fn();
    const openMock = vi.fn();
    const addMock = vi.fn();
    const clickMock = vi.fn();

    render(
      <EventCard
        event={{
          id: 'event-1',
          title: 'Focus block',
          start: new Date('2026-03-09T09:00:00.000Z'),
          end: new Date('2026-03-09T10:00:00.000Z'),
          occurrenceItems: [
            { id: 'item-1', title: 'First task', completed: false, kind: 'item' },
            { id: 'item-2', title: 'Second task', completed: false, kind: 'item' },
            { id: 'item-3', title: 'Third task', completed: true, kind: 'item' },
            { id: 'item-4', title: 'Fourth task', completed: true, kind: 'item' }
          ]
        }}
        top={12}
        height={70}
        leftPct={0}
        widthPct={100}
        onClick={clickMock}
        onAddItem={addMock}
        onOccurrenceToggle={toggleMock}
        onOccurrenceOpen={openMock}
      />
    );

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(toggleMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1', title: 'First task' }),
      true
    );

    fireEvent.click(screen.getByRole('button', { name: 'First task' }));
    expect(openMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));

    fireEvent.click(screen.getByRole('button', { name: '2 more ↗' }));
    expect(clickMock).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '+ Add item' }));
    expect(addMock).toHaveBeenCalled();

    const block = screen.getByRole('button', { name: /focus block/i });
    expect(block).toHaveStyle({ height: '68px' });
  });

  it('supports toggling and opening attached items from the drawer open view', () => {
    const toggleMock = vi.fn();
    const openMock = vi.fn();

    render(
      <EventDrawer
        isCreateFlow={false}
        title="Focus block"
        description=""
        start="2026-03-09T09:00"
        end="2026-03-09T10:00"
        recurrence="none"
        recurrenceConfig={{ unit: 'week', interval: 1, limitType: 'indefinite' }}
        includeWeekends
        onTitleChange={() => undefined}
        onDescriptionChange={() => undefined}
        onStartChange={() => undefined}
        onEndChange={() => undefined}
        onRecurrenceChange={() => undefined}
        onRecurrenceConfigChange={() => undefined}
        onToggleIncludeWeekends={() => undefined}
        onAskDelta={() => undefined}
        isTaskLinkRequested={false}
        onLinkTasks={() => undefined}
        onAskDeltaForTasks={() => undefined}
        draftItems={[]}
        onDraftItemAdd={() => undefined}
        onDraftItemRemove={() => undefined}
        onDraftItemAssign={() => undefined}
        contentMode="all"
        onContentModeChange={() => undefined}
        contentListOptions={[{ id: 'list-1', name: 'Today' }]}
        contentItemOptionsByList={{ 'list-1': [{ id: 'item-1', title: 'First task' }] }}
        contentFocalTree={[]}
        contentAll={{ listId: 'list-1', itemIds: ['item-1'] }}
        contentByWeekday={{
          mon: { listId: '', itemIds: [] },
          tue: { listId: '', itemIds: [] },
          wed: { listId: '', itemIds: [] },
          thu: { listId: '', itemIds: [] },
          fri: { listId: '', itemIds: [] },
          sat: { listId: '', itemIds: [] },
          sun: { listId: '', itemIds: [] }
        }}
        includeRecurringTasks
        onToggleIncludeRecurringTasks={() => undefined}
        repeatTasksByItemId={{}}
        onRepeatTasksForItemChange={() => undefined}
        onContentAllListChange={() => undefined}
        onContentAllItemsChange={() => undefined}
        onContentWeekdayListChange={() => undefined}
        onContentWeekdayItemsChange={() => undefined}
        occurrenceWeekday="mon"
        occurrenceItems={[
          { id: 'task-1', title: 'Nested task', completed: false, kind: 'task', parentItemId: 'item-1' }
        ]}
        onToggleOccurrenceItem={toggleMock}
        onOpenOccurrenceItem={openMock}
        parentItemTitleById={{ 'item-1': 'Parent item' }}
        onCancel={() => undefined}
        onSave={() => undefined}
        onDelete={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));
    expect(toggleMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1', title: 'Nested task' }),
      true
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nested task' }));
    expect(openMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1', parentItemId: 'item-1' })
    );
  });

  it('persists adding a new item from the calendar block to the attached list', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Created from block');

    render(
      <Calendar
        events={[
          {
            id: 'event-1',
            title: 'Focus block',
            description: '',
            start: '2026-03-09T09:00:00.000Z',
            end: '2026-03-09T10:00:00.000Z',
            recurrence: 'none',
            recurrenceConfig: { unit: 'week', interval: 1, limitType: 'indefinite' },
            includeWeekends: true,
            timezone: 'America/Denver',
            tasks: [],
            tags: []
          }
        ]}
        attachTree={[
          {
            id: 'focal|f1',
            label: 'Work',
            level: 'domain',
            children: [
              {
                id: 'lane|list-1',
                label: 'Today',
                level: 'project',
                children: [
                  { id: 'item|item-1', label: 'First task', level: 'task' },
                  { id: 'item|item-2', label: 'Second task', level: 'task' },
                  { id: 'item|item-3', label: 'Third task', level: 'task' }
                ]
              }
            ]
          }
        ]}
      />
    );

    await screen.findByRole('button', { name: '+ Add item' });
    fireEvent.click(screen.getByRole('button', { name: '+ Add item' }));

    await waitFor(() => {
      expect(focalBoardServiceMock.createItem).toHaveBeenCalledWith('list-1', 'user-1', 'Created from block', null);
    });
    await waitFor(() => {
      expect(calendarServiceMock.upsertTimeBlockContentRule).toHaveBeenCalledWith(
        expect.objectContaining({
          time_block_id: 'event-1',
          list_id: 'list-1',
          item_ids: expect.arrayContaining(['item-1', 'item-2', 'item-3', 'item-new'])
        })
      );
    });

    promptSpy.mockRestore();
  });
});
