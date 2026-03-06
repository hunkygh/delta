export type ExecutionMode = 'calendar_description' | 'clickup_task';

export interface PlanEvent {
  title: string;
  description: string;
  start: string;
  end: string;
  recurrence?: string;
  timezone: string;
}

export interface ClickUpPayload {
  spaceId?: string;
  listId?: string;
  title?: string;
  description?: string;
  start?: string;
  end?: string;
  recurrence?: string;
}

export interface PlanMetadata {
  confidence: number;
  requiresClarification: boolean;
  sourceIntent: string;
}

export interface PlanObject {
  mode: ExecutionMode;
  event: PlanEvent;
  clickup?: ClickUpPayload;
  metadata: PlanMetadata;
}
