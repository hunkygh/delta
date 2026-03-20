export interface ShellFocalSummary {
  id: string;
  name: string;
  listCount: number;
}

export interface ShellListSummary {
  id: string;
  focalId: string | null;
  focalName: string;
  name: string;
}

export interface ShellItemSummary {
  id: string;
  listId: string | null;
  listName: string;
  focalId: string | null;
  title: string;
}

export interface ShellTaskSummary {
  id: string;
  itemId: string;
  itemTitle: string;
  listId: string | null;
  listName: string;
  focalId: string | null;
  title: string;
  scheduledAt: string | null;
  status: string | null;
  isComplete: boolean;
}
