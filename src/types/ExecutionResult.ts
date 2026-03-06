import type { ExecutionMode } from './PlanObject';

export interface ExecutionResult {
  calendarEventId: string | null;
  clickupTaskId: string | null;
  executionMode: ExecutionMode;
  partialSuccess: boolean;
  timestamp: string;
}
