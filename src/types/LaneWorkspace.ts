export type LaneItemStatus = 'backlog' | 'in_progress' | 'blocked' | 'done';

export interface LaneAction {
  id: string;
  title: string;
  completed: boolean;
}

export interface LaneItem {
  id: string;
  title: string;
  status: LaneItemStatus;
  owner: string;
  dueDate: string;
  commentsCount: number;
  actions: LaneAction[];
}

export interface Lane {
  id: string;
  domainName: string;
  name: string;
  itemTermSingular: string;
  itemTermPlural: string;
  items: LaneItem[];
}

