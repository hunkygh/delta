export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface CustomRecurrenceConfig {
  unit: 'day' | 'week' | 'month' | 'year';
  interval: number;
  limitType: 'indefinite' | 'count' | 'until';
  count?: number;
  until?: string;
}

export interface EventTask {
  id: string;
  title: string;
  completed: boolean;
  recurrenceMode: 'match_event' | 'custom';
  customRecurrence?: RecurrenceRule;
  customRecurrenceConfig?: CustomRecurrenceConfig;
}

export interface BlockTaskLinkedItem {
  id: string;
  blockTaskItemId: string;
  itemId: string;
  title: string;
  completedInContext: boolean;
  completionNote?: string | null;
  completedAt?: string | null;
  sortOrder: number;
}

export interface BlockTask {
  id: string;
  timeBlockId: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  isCompleted: boolean;
  linkedItems: BlockTaskLinkedItem[];
}

export interface Event {
  id: string;
  sourceEventId?: string;
  occurrenceStartUtc?: string;
  occurrenceEndUtc?: string;
  isOccurrenceInstance?: boolean;
  title: string;
  description: string;
  start: string;
  end: string;
  recurrence?: RecurrenceRule;
  recurrenceConfig?: CustomRecurrenceConfig;
  includeWeekends?: boolean;
  tasks?: EventTask[];
  blockTasks?: BlockTask[];
  projectIds?: string[];
  timezone: string;
  tags?: string[];
}
