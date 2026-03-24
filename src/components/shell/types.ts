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
  lane_id?: string | null;
  listId: string | null;
  listName: string;
  status?: string | null;
  status_id?: string | null;
  focal_id?: string | null;
  focalId: string | null;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
  signal_score?: number | null;
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
