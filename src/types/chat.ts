import type { ShellNodeStructureConfig } from '../components/shell/nodeRuntime';

export interface ChatContext {
  time_block_id?: string;
  time_block_occurrence?: {
    scheduled_start_utc: string;
    scheduled_end_utc: string;
  };
  planning_date?: string;
  planning_timezone?: string;
  focal_id?: string;
  list_id?: string;
  item_id?: string;
  action_id?: string;
  node_id?: string;
  node_slug?: string;
  node_name?: string;
  node_mode?: 'setup' | 'operate';
  node_structure_blueprint?: string;
  node_structure_config?: ShellNodeStructureConfig;
  node_setup_logic?: string;
  node_operate_logic?: string;
}

export type ChatRole = 'user' | 'assistant' | 'system_marker';
export type ChatMode = 'ai' | 'memo';

export interface CreateFollowUpProposal {
  id: string;
  type: 'create_follow_up_action';
  title: string;
  item_id: string;
  notes?: string | null;
}

export interface CreateFocalProposal {
  id: string;
  type: 'create_focal';
  title: string;
}

export interface CreateListProposal {
  id: string;
  type: 'create_list';
  title: string;
  focal_id: string;
}

export interface CreateItemProposal {
  id: string;
  type: 'create_item';
  title: string;
  list_id: string;
}

export interface CreateActionProposal {
  id: string;
  type: 'create_action';
  title: string;
  item_id: string;
  notes?: string | null;
  scheduled_at?: string | null;
  time_block_id?: string | null;
  lane_id?: string | null;
}

export interface CreateTimeBlockProposal {
  id: string;
  type: 'create_time_block';
  title: string;
  scheduled_start_utc: string;
  scheduled_end_utc?: string | null;
  lane_id?: string | null;
  notes?: string | null;
  follow_up_request?: string | null;
  follow_up_context?: ChatContext | null;
}

export interface ResolveTimeConflictProposal {
  id: string;
  type: 'resolve_time_conflict';
  conflict_time_block_id: string;
  conflict_title?: string;
  conflict_new_start_utc: string;
  conflict_new_end_utc: string;
  event_title: string;
  event_start_utc: string;
  event_end_utc: string;
  lane_id?: string | null;
  notes?: string | null;
}

export interface NodeSetupStatusDraft {
  name: string;
  key?: string | null;
  color?: string | null;
  group_key?: string | null;
  is_default?: boolean;
}

export interface NodeSetupFieldOptionDraft {
  label: string;
  color_fill?: string | null;
  color_border?: string | null;
  color_text?: string | null;
}

export interface NodeSetupFieldDraft {
  name: string;
  type: 'status' | 'select' | 'text' | 'number' | 'date' | 'boolean' | 'contact';
  is_primary?: boolean;
  is_pinned?: boolean;
  options?: NodeSetupFieldOptionDraft[];
}

export interface NodeSetupListDraft {
  name: string;
  item_label?: string | null;
  action_label?: string | null;
  statuses?: NodeSetupStatusDraft[];
  subtask_statuses?: NodeSetupStatusDraft[];
  fields?: NodeSetupFieldDraft[];
}

export interface NodeSetupApplyProposal {
  id: string;
  type: 'node_setup_apply';
  node_id: string;
  focal_id: string;
  summary: string;
  lists: NodeSetupListDraft[];
}

export type ChatProposal =
  | CreateFollowUpProposal
  | CreateFocalProposal
  | CreateListProposal
  | CreateItemProposal
  | CreateActionProposal
  | CreateTimeBlockProposal
  | ResolveTimeConflictProposal
  | NodeSetupApplyProposal;

export const getChatProposalTitle = (proposal: ChatProposal): string => {
  if (proposal.type === 'resolve_time_conflict') {
    return proposal.event_title;
  }
  if (proposal.type === 'node_setup_apply') {
    return proposal.summary;
  }
  return proposal.title;
};

export interface ChatDebugMeta {
  source?: 'db' | 'llm' | 'heuristic';
  request_id?: string;
  route?: string;
  scope?: {
    mode?: 'global' | 'scoped';
    node?: string;
    focal?: string;
    list?: string;
    item?: string;
    action?: string;
    time_block?: string;
  };
  confidence?: {
    focal?: number;
    list?: number;
  };
  counts?: {
    focals: number;
    lists: number;
    items: number;
    actions: number;
    timeBlocks: number;
  };
  warnings?: string[];
  tools?: Array<{
    name: string;
    status: 'applied' | 'skipped' | 'blocked' | 'error';
    summary?: string;
  }>;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  created_at: number;
  queued?: boolean | null;
  mode?: ChatMode;
  context?: ChatContext | null;
  marker_label?: string | null;
  proposals?: ChatProposal[] | null;
  debug_meta?: ChatDebugMeta | null;
}

export interface ChatThreadState {
  last_activity_at: number;
  messages: ChatMessage[];
}

export interface ChatReply {
  text: string;
  source: 'ai' | 'heuristic';
  proposals?: ChatProposal[];
  debug_meta?: ChatDebugMeta;
  debug_reason?: string | null;
  debug_error?: string | null;
  debug_model?: string | null;
}
