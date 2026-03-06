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

export interface Event {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  recurrence?: RecurrenceRule;
  recurrenceConfig?: CustomRecurrenceConfig;
  includeWeekends?: boolean;
  tasks?: EventTask[];
  projectIds?: string[];
  timezone: string;
  tags?: string[];
}
