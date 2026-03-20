export type ShellComposerType = 'time_block' | 'item' | 'task' | 'note' | 'space' | 'list';
export type ShellComposerRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ShellComposerDraft {
  type: ShellComposerType;
  name: string;
  description: string;
  subitems: string[];
  lockedType?: boolean;
  headerTitle?: string | null;
  sourceEventId?: string | null;
  focalId?: string | null;
  listId?: string | null;
  parentItemId?: string | null;
  parentItemQuery?: string;
  scheduledDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  scheduledStartUtc?: string | null;
  scheduledEndUtc?: string | null;
  recurrence?: ShellComposerRecurrence;
  recurrenceInterval?: number;
  includeWeekends?: boolean;
}

export const createEmptyShellComposerDraft = (
  overrides: Partial<ShellComposerDraft> = {}
): ShellComposerDraft => ({
  type: 'time_block',
  name: '',
  description: '',
  lockedType: false,
  headerTitle: null,
  sourceEventId: null,
  scheduledDate: null,
  focalId: null,
  listId: null,
  parentItemId: null,
  parentItemQuery: '',
  startTime: '',
  endTime: '',
  scheduledStartUtc: null,
  scheduledEndUtc: null,
  recurrence: 'none',
  recurrenceInterval: 1,
  includeWeekends: true,
  ...overrides,
  subitems:
    overrides.subitems && overrides.subitems.length > 0
      ? overrides.subitems
      : ['']
});
