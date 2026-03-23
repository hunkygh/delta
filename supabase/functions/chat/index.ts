/**
 * Local dev:
 * 1) supabase functions serve chat --env-file supabase/.env.local
 * 2) supabase functions deploy chat --no-verify-jwt
 *    NOTE: --no-verify-jwt is temporary; function still enforces bearer auth internally.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { aiGateway, getAiProviderStatus, hasConfiguredAiProviders } from '../_shared/aiGateway.ts';
import { resolveRuntimeNodePrompts } from '../_shared/nodeRuntime.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type ChatRole = 'user' | 'assistant' | 'system_marker';

interface ChatContext {
  time_block_id?: string;
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
  node_structure_config?: Record<string, unknown>;
  node_setup_logic?: string;
  node_operate_logic?: string;
  time_block_occurrence?: {
    scheduled_start_utc: string;
    scheduled_end_utc: string;
  };
}

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface AccountContextSnapshot {
  focals: Array<{ id: string; name: string }>;
  lists: Array<{ id: string; focal_id: string | null; name: string; mode?: string | null }>;
  items: Array<{ id: string; lane_id: string | null; title: string; status?: string | null; signal_label?: string | null; signal_score?: number | null }>;
  actions: Array<{ id: string; item_id: string | null; title: string }>;
  timeBlocks: Array<{ id: string; title: string; start_time: string; end_time: string }>;
  fields: Array<{ id: string; list_id: string; name: string; type: string; is_primary?: boolean }>;
  fieldOptions: Array<{ id: string; field_id: string; label: string }>;
  itemFieldValues: Array<{
    item_id: string;
    field_id: string;
    option_id?: string | null;
    value_text?: string | null;
    value_number?: number | null;
    value_date?: string | null;
    value_boolean?: boolean | null;
  }>;
  itemComments: Array<{ item_id: string; body: string; created_at: string }>;
}

interface DebugMeta {
  source: 'db' | 'llm' | 'heuristic';
  request_id?: string;
  route?: string;
  scope: {
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
    fields?: number;
    comments?: number;
  };
  warnings?: string[];
  tools?: Array<{
    name: string;
    status: 'applied' | 'skipped' | 'blocked' | 'error';
    summary?: string;
  }>;
}

interface SnapshotBuildResult {
  snapshot: AccountContextSnapshot;
  warnings: string[];
}

interface FieldSchemaValue {
  id: string;
  list_id: string;
  name: string;
  type: string;
  is_primary?: boolean;
}

type ChatProposal =
  | { id: string; type: 'create_follow_up_action'; title: string; item_id: string; notes?: string | null }
  | { id: string; type: 'create_focal'; title: string }
  | { id: string; type: 'create_list'; title: string; focal_id: string }
  | { id: string; type: 'create_item'; title: string; list_id: string }
  | { id: string; type: 'create_action'; title: string; item_id: string; notes?: string | null; scheduled_at?: string | null; time_block_id?: string | null; lane_id?: string | null }
  | {
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
  | { id: string; type: 'resolve_time_conflict'; conflict_time_block_id: string; conflict_title?: string; conflict_new_start_utc: string; conflict_new_end_utc: string; event_title: string; event_start_utc: string; event_end_utc: string; lane_id?: string | null; notes?: string | null }
  | {
      id: string;
      type: 'node_setup_apply';
      node_id: string;
      focal_id: string;
      summary: string;
      lists: Array<{
        name: string;
        item_label?: string | null;
        action_label?: string | null;
        statuses?: Array<{
          name: string;
          key?: string | null;
          color?: string | null;
          group_key?: string | null;
          is_default?: boolean;
        }>;
        subtask_statuses?: Array<{
          name: string;
          key?: string | null;
          color?: string | null;
          group_key?: string | null;
          is_default?: boolean;
        }>;
        fields?: Array<{
          name: string;
          type: 'status' | 'select' | 'text' | 'number' | 'date' | 'boolean' | 'contact';
          is_primary?: boolean;
          is_pinned?: boolean;
          options?: Array<{
            label: string;
            color_fill?: string | null;
            color_border?: string | null;
            color_text?: string | null;
          }>;
        }>;
      }>;
    };

type DeterministicIntent =
  | 'list_items'
  | 'list_inventory'
  | 'field_inventory'
  | 'item_next_step'
  | 'focal_inventory'
  | 'item_inventory'
  | 'action_inventory'
  | 'timeblock_inventory'
  | 'unknown';

interface EntityMatch {
  id: string | null;
  confidence: number;
  ambiguous: boolean;
  fromPrior?: boolean;
}

interface ResolvedEntities {
  focal: EntityMatch;
  list: EntityMatch;
}

interface DeterministicResponse {
  text: string;
  route: DeterministicIntent;
  scopeLabels: {
    focal?: string;
    list?: string;
  };
  confidence: {
    focal?: number;
    list?: number;
  };
  proposals?: ChatProposal[];
}

interface MutationPlanStep {
  kind: 'update_core_item' | 'upsert_item_field_value';
  summary: string;
  payload: Record<string, unknown>;
}

interface MutationPlanContract {
  idempotencyKey: string;
  steps: MutationPlanStep[];
}

interface PlanningActionContract {
  planningDate: { year: number; month: number; day: number; weekday: number } | null;
  planningTimezone: string;
  excludedStatusLabel: string | null;
  targetBlockNeedle: string | null;
  resolvedFocalId: string | null;
  resolvedListId: string | null;
  scopedLists: AccountContextSnapshot['lists'];
  candidateItems: Array<{
    item: AccountContextSnapshot['items'][number];
    list: AccountContextSnapshot['lists'][number] | null;
    statusLabel: string | null;
    latestComment: AccountContextSnapshot['itemComments'][number] | null;
    score: number;
    missingCriticalFields: string[];
  }>;
  dayBlocks: AccountContextSnapshot['timeBlocks'];
  targetBlock: AccountContextSnapshot['timeBlocks'][number] | null;
  focalEntities: ResolvedEntities;
}

type MessageIntentMode = 'act' | 'ask' | 'mixed' | 'inform';
interface MessagePlan {
  mode: MessageIntentMode;
  confidence: number;
  explicitInventoryAsk: boolean;
  mutationRequested: boolean;
  ambiguousAction: boolean;
}

const safeJson = async (response: Response): Promise<any> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(base64 + pad);
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const extractUserIdFromGatewayHeaders = (req: Request): string | null => {
  const candidates = [
    req.headers.get('x-supabase-auth-user'),
    req.headers.get('x-supabase-auth-user-id'),
    req.headers.get('x-sb-auth-user'),
    req.headers.get('x-sb-auth-user-id'),
    req.headers.get('x-supabase-user'),
    req.headers.get('x-sb-user-id'),
    req.headers.get('x-auth-user'),
    req.headers.get('x-user-id')
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const direct = raw.trim();
    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(direct)) {
      return direct;
    }
    try {
      const parsed = JSON.parse(direct);
      const id = typeof parsed?.id === 'string' ? parsed.id : typeof parsed?.sub === 'string' ? parsed.sub : null;
      if (id) return id;
    } catch {
      // noop
    }
  }
  return null;
};

const extractBearerTokenFromHeaders = (req: Request): string | null => {
  const explicit = req.headers.get('Authorization');
  const explicitMatch = explicit?.match(/^Bearer\s+(.+)$/i) || null;
  if (explicitMatch?.[1]?.trim()) {
    return explicitMatch[1].trim();
  }

  for (const [key, value] of req.headers.entries()) {
    if (!/authorization/i.test(key)) continue;
    const match = value?.match(/^Bearer\s+(.+)$/i) || null;
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return null;
};


const clip = (value: string, max = 160): string => (value.length > max ? `${value.slice(0, max)}…` : value);

const buildAccountContextSnapshot = async (
  client: ReturnType<typeof createClient>,
  userId: string,
  context: ChatContext
): Promise<SnapshotBuildResult> => {
  const warnings: string[] = [];
  const hasScopedIds =
    Boolean(context.focal_id) ||
    Boolean(context.list_id) ||
    Boolean(context.item_id) ||
    Boolean(context.action_id) ||
    Boolean(context.time_block_id);

  const focalsPromise = client
    .from('focals')
    .select('id,name')
    .eq('user_id', userId)
    .order('order_num', { ascending: true })
    .limit(hasScopedIds ? 20 : 50);

  const listsPromise = client
    .from('lanes')
    .select('id,focal_id,name,mode')
    .eq('user_id', userId)
    .order('order_num', { ascending: true })
    .limit(hasScopedIds ? 30 : 80);

  const itemsPromise = client
    .from('items')
    .select('id,lane_id,title,status,signal_label,signal_score')
    .eq('user_id', userId)
    .order('order_num', { ascending: true })
    .limit(hasScopedIds ? 60 : 120);

  const actionsPromise = client
    .from('actions')
    .select('id,item_id,title')
    .eq('user_id', userId)
    .order('order_num', { ascending: true })
    .limit(hasScopedIds ? 100 : 160);

  const timeBlocksPromise = client
    .from('time_blocks')
    .select('id,title,start_time,end_time')
    .eq('user_id', userId)
    .order('start_time', { ascending: false })
    .limit(hasScopedIds ? 24 : 40);

  const fieldsPromise = client
    .from('list_fields')
    .select('id,list_id,name,type,is_primary')
    .eq('user_id', userId)
    .order('order_index', { ascending: true })
    .limit(hasScopedIds ? 60 : 200);

  const fieldOptionsPromise = client
    .from('field_options')
    .select('id,field_id,label')
    .eq('user_id', userId)
    .order('order_index', { ascending: true })
    .limit(hasScopedIds ? 180 : 600);

  const itemFieldValuesPromise = client
    .from('item_field_values')
    .select('item_id,field_id,option_id,value_text,value_number,value_date,value_boolean')
    .eq('user_id', userId)
    .limit(hasScopedIds ? 300 : 1500);

  const itemCommentsPromise = client
    .from('item_comments')
    .select('item_id,body,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(hasScopedIds ? 120 : 500);

  const [
    focalsResult,
    listsResultRaw,
    itemsResultRaw,
    actionsResult,
    timeBlocksResult,
    fieldsResult,
    fieldOptionsResult,
    itemFieldValuesResult,
    itemCommentsResult
  ] = await Promise.all([
    focalsPromise,
    listsPromise,
    itemsPromise,
    actionsPromise,
    timeBlocksPromise,
    fieldsPromise,
    fieldOptionsPromise,
    itemFieldValuesPromise,
    itemCommentsPromise
  ]);

  let listsResult = listsResultRaw;
  if (
    listsResult.error &&
    /column .*mode.* does not exist|schema cache/i.test(listsResult.error.message || '')
  ) {
    listsResult = await client
      .from('lanes')
      .select('id,focal_id,name')
      .eq('user_id', userId)
      .order('order_num', { ascending: true })
      .limit(hasScopedIds ? 30 : 80);
  }

  let itemsResult = itemsResultRaw;
  if (
    itemsResult.error &&
    /column .*status.* does not exist|schema cache/i.test(itemsResult.error.message || '')
  ) {
    itemsResult = await client
      .from('items')
      .select('id,lane_id,title,signal_label,signal_score')
      .eq('user_id', userId)
      .order('order_num', { ascending: true })
      .limit(hasScopedIds ? 60 : 120);
  }

  if (focalsResult.error) throw focalsResult.error;
  if (listsResult.error) throw listsResult.error;
  if (itemsResult.error) {
    warnings.push(`items query failed: ${itemsResult.error.message}`);
    console.warn('[chat] snapshot: items query failed, continuing with empty items', itemsResult.error.message);
  }
  if (actionsResult.error) {
    warnings.push(`actions query failed: ${actionsResult.error.message}`);
    console.warn('[chat] snapshot: actions query failed, continuing with empty actions', actionsResult.error.message);
  }
  if (timeBlocksResult.error) {
    warnings.push(`time_blocks query failed: ${timeBlocksResult.error.message}`);
    console.warn('[chat] snapshot: time_blocks query failed, continuing with empty timeBlocks', timeBlocksResult.error.message);
  }
  if (fieldsResult.error) {
    warnings.push(`list_fields query failed: ${fieldsResult.error.message}`);
    console.warn('[chat] snapshot: list_fields query failed, continuing with empty fields', fieldsResult.error.message);
  }
  if (fieldOptionsResult.error) {
    warnings.push(`field_options query failed: ${fieldOptionsResult.error.message}`);
    console.warn('[chat] snapshot: field_options query failed, continuing with empty fieldOptions', fieldOptionsResult.error.message);
  }
  if (itemFieldValuesResult.error) {
    warnings.push(`item_field_values query failed: ${itemFieldValuesResult.error.message}`);
    console.warn('[chat] snapshot: item_field_values query failed, continuing with empty values', itemFieldValuesResult.error.message);
  }
  if (itemCommentsResult.error) {
    warnings.push(`item_comments query failed: ${itemCommentsResult.error.message}`);
    console.warn('[chat] snapshot: item_comments query failed, continuing with empty comments', itemCommentsResult.error.message);
  }

  const focals = (focalsResult.data || []) as AccountContextSnapshot['focals'];
  const lists = (listsResult.data || []) as AccountContextSnapshot['lists'];
  const items = ((itemsResult.error ? [] : itemsResult.data) || []) as AccountContextSnapshot['items'];
  const actions = ((actionsResult.error ? [] : actionsResult.data) || []) as AccountContextSnapshot['actions'];
  const timeBlocks = ((timeBlocksResult.error ? [] : timeBlocksResult.data) || []) as AccountContextSnapshot['timeBlocks'];
  const fields = ((fieldsResult.error ? [] : fieldsResult.data) || []) as AccountContextSnapshot['fields'];
  const fieldOptions = ((fieldOptionsResult.error ? [] : fieldOptionsResult.data) || []) as AccountContextSnapshot['fieldOptions'];
  const itemFieldValues = ((itemFieldValuesResult.error ? [] : itemFieldValuesResult.data) || []) as AccountContextSnapshot['itemFieldValues'];
  const itemComments = ((itemCommentsResult.error ? [] : itemCommentsResult.data) || []) as AccountContextSnapshot['itemComments'];

  return {
    snapshot: {
      focals: focals.map((row) => ({ id: row.id, name: clip(row.name || '') })),
      lists: lists.map((row) => ({
      id: row.id,
      focal_id: row.focal_id,
      name: clip(row.name || ''),
      mode: row.mode ?? null
      })),
      items: items.map((row) => ({
      id: row.id,
      lane_id: row.lane_id,
      title: clip(row.title || ''),
      status: row.status ?? null,
      signal_label: row.signal_label ?? null,
      signal_score: typeof row.signal_score === 'number' ? row.signal_score : null
      })),
      actions: actions.map((row) => ({
      id: row.id,
      item_id: row.item_id,
      title: clip(row.title || '')
      })),
      timeBlocks: timeBlocks.map((row) => ({
      id: row.id,
      title: clip(row.title || ''),
      start_time: row.start_time,
      end_time: row.end_time
      })),
      fields: fields.map((row) => ({
      id: row.id,
      list_id: row.list_id,
      name: clip(row.name || ''),
      type: row.type,
      is_primary: Boolean(row.is_primary)
      })),
      fieldOptions: fieldOptions.map((row) => ({
      id: row.id,
      field_id: row.field_id,
      label: clip(row.label || '')
      })),
      itemFieldValues: itemFieldValues.map((row) => ({
      item_id: row.item_id,
      field_id: row.field_id,
      option_id: row.option_id ?? null,
      value_text: row.value_text ?? null,
      value_number: row.value_number ?? null,
      value_date: row.value_date ?? null,
      value_boolean: row.value_boolean ?? null
      })),
      itemComments: itemComments.map((row) => ({
      item_id: row.item_id,
      body: clip(row.body || '', 220),
      created_at: row.created_at
      }))
    },
    warnings
  };
};

const snapshotToPromptText = (snapshot: AccountContextSnapshot): string =>
  JSON.stringify(
    {
      counts: {
        focals: snapshot.focals.length,
        lists: snapshot.lists.length,
        items: snapshot.items.length,
        actions: snapshot.actions.length,
        timeBlocks: snapshot.timeBlocks.length,
        fields: snapshot.fields.length,
        comments: snapshot.itemComments.length
      },
      focals: snapshot.focals.slice(0, 25),
      lists: snapshot.lists.slice(0, 60),
      items: snapshot.items.slice(0, 100),
      actions: snapshot.actions.slice(0, 120),
      timeBlocks: snapshot.timeBlocks.slice(0, 32),
      fields: snapshot.fields.slice(0, 120),
      fieldOptions: snapshot.fieldOptions.slice(0, 220),
      itemFieldValues: snapshot.itemFieldValues.slice(0, 400),
      itemComments: snapshot.itemComments.slice(0, 220)
    },
    null,
    0
  );

const getLastUserMessage = (messages: ChatMessage[]): string =>
  [...messages].reverse().find((entry) => entry.role === 'user')?.content?.trim() || '';

const isExplicitInventoryAsk = (text: string): boolean => {
  const q = text.toLowerCase();
  return (
    /\b(show|list|what are|what's in|which|display|inventory)\b/.test(q) &&
    /\b(focal|focals|space|spaces|list|lists|item|items|task|tasks|action|actions|field|fields|column|columns|time block|timeblock|calendar)\b/.test(q)
  );
};

const shouldAnswerDeterministically = (text: string): boolean => {
  const q = text.toLowerCase();
  return (
    isExplicitInventoryAsk(text) ||
    /\b(next step|what should i do next|follow[- ]?up)\b/.test(q) ||
    /\b(in|inside|from)\s+my\s+[a-z0-9].*(focal|space|list)\b/.test(q)
  );
};

const formatNameList = (values: string[]): string => values.map((value) => `- ${value}`).join('\n');

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalize = (value: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'my',
  'in',
  'on',
  'for',
  'of',
  'to',
  'and',
  'or',
  'is',
  'are',
  'what',
  'which',
  'show',
  'tell',
  'me',
  'please',
  'focal',
  'focals',
  'space',
  'spaces',
  'list',
  'lists'
]);

const tokenize = (value: string): string[] =>
  normalize(value)
    .split(' ')
    .filter((token) => token && !STOP_WORDS.has(token));

const levenshtein = (a: string, b: string): number => {
  const aa = normalize(a);
  const bb = normalize(b);
  if (!aa) return bb.length;
  if (!bb) return aa.length;
  const dp: number[] = Array.from({ length: bb.length + 1 }, (_, i) => i);
  for (let i = 1; i <= aa.length; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= bb.length; j += 1) {
      const temp = dp[j];
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[bb.length];
};

const fuzzyScore = (needle: string, haystack: string): number => {
  const n = normalize(needle);
  const h = normalize(haystack);
  if (!n || !h) return 0;
  if (h.includes(n)) return 1;
  const distance = levenshtein(n, h);
  const maxLen = Math.max(n.length, h.length) || 1;
  return Math.max(0, 1 - distance / maxLen);
};

const inferEntityByName = (
  text: string,
  names: Array<{ id: string; name: string }>
): { id: string | null; confidence: number; ambiguous: boolean } => {
  const nText = normalize(text);
  if (!nText || names.length === 0) return { id: null, confidence: 0, ambiguous: false };

  const textTokens = tokenize(text);
  const scored = names
    .map((entry) => {
      const entryTokens = tokenize(entry.name);
      const overlap = entryTokens.length
        ? entryTokens.filter((token) => textTokens.includes(token)).length / entryTokens.length
        : 0;
      const fuzzy = fuzzyScore(entry.name, nText);
      const contains = normalize(entry.name) && nText.includes(normalize(entry.name)) ? 1 : 0;
      const score = contains * 1.0 + overlap * 0.75 + fuzzy * 0.65;
      return { id: entry.id, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 || scored[0].score < 0.78) {
    return { id: null, confidence: scored[0]?.score || 0, ambiguous: false };
  }
  const top = scored[0];
  const runnerUp = scored[1];
  const ambiguous = Boolean(runnerUp && Math.abs(top.score - runnerUp.score) < 0.12);
  return { id: top.id, confidence: top.score, ambiguous };
};

const resolveFocalIdFromQuestion = (
  userText: string,
  snapshot: AccountContextSnapshot,
  fallbackFocalId?: string,
  messages: ChatMessage[] = []
): { focalId: string | null; confidence: number; ambiguous: boolean; fromPrior?: boolean } => {
  if (fallbackFocalId) {
    return { focalId: fallbackFocalId, confidence: 1, ambiguous: false };
  }

  const current = inferEntityByName(userText, snapshot.focals);
  if (current.id) {
    return { focalId: current.id, confidence: current.confidence, ambiguous: current.ambiguous };
  }

  const pointsToPrior = /\b(that|this|same|it)\b/i.test(userText);
  if (pointsToPrior) {
    const priorUsers = [...messages].reverse().filter((m) => m.role === 'user').slice(1, 6);
    for (const prior of priorUsers) {
      const priorMatch = inferEntityByName(prior.content, snapshot.focals);
      if (priorMatch.id) {
        return { focalId: priorMatch.id, confidence: Math.max(0.62, priorMatch.confidence * 0.75), ambiguous: false, fromPrior: true };
      }
    }
  }

  return { focalId: null, confidence: 0, ambiguous: false };
};

const resolveListIdFromQuestion = (
  userText: string,
  snapshot: AccountContextSnapshot,
  fallbackListId?: string,
  messages: ChatMessage[] = [],
  focalScopeId?: string | null
): { listId: string | null; confidence: number; ambiguous: boolean; fromPrior?: boolean } => {
  if (fallbackListId) return { listId: fallbackListId, confidence: 1, ambiguous: false };
  const candidates = snapshot.lists
    .filter((list) => !focalScopeId || list.focal_id === focalScopeId)
    .map((list) => ({ id: list.id, name: list.name }));
  const fallbackCandidates = snapshot.lists.map((list) => ({ id: list.id, name: list.name }));
  const current = inferEntityByName(userText, candidates);
  if (current.id) return { listId: current.id, confidence: current.confidence, ambiguous: current.ambiguous };
  if (candidates.length !== fallbackCandidates.length) {
    const fallbackCurrent = inferEntityByName(userText, fallbackCandidates);
    if (fallbackCurrent.id) {
      return { listId: fallbackCurrent.id, confidence: fallbackCurrent.confidence, ambiguous: fallbackCurrent.ambiguous };
    }
  }

  const pointsToPrior = /\b(that|this|same|it)\b/i.test(userText);
  if (pointsToPrior) {
    const priorUsers = [...messages].reverse().filter((m) => m.role === 'user').slice(1, 6);
    for (const prior of priorUsers) {
      const priorMatch = inferEntityByName(prior.content, fallbackCandidates);
      if (priorMatch.id) {
        return { listId: priorMatch.id, confidence: Math.max(0.62, priorMatch.confidence * 0.75), ambiguous: false, fromPrior: true };
      }
    }
  }
  return { listId: null, confidence: 0, ambiguous: false };
};

const resolveItemIdFromQuestion = (
  userText: string,
  snapshot: AccountContextSnapshot,
  fallbackItemId?: string,
  listScopeId?: string | null
): { itemId: string | null; confidence: number; ambiguous: boolean } => {
  if (fallbackItemId) return { itemId: fallbackItemId, confidence: 1, ambiguous: false };
  const candidates = snapshot.items
    .filter((item) => !listScopeId || item.lane_id === listScopeId)
    .map((item) => ({ id: item.id, name: item.title }));
  const full = snapshot.items.map((item) => ({ id: item.id, name: item.title }));
  const scoped = inferEntityByName(userText, candidates);
  if (scoped.id) return { itemId: scoped.id, confidence: scoped.confidence, ambiguous: scoped.ambiguous };
  if (candidates.length !== full.length) {
    const fallback = inferEntityByName(userText, full);
    if (fallback.id) return { itemId: fallback.id, confidence: fallback.confidence, ambiguous: fallback.ambiguous };
  }
  return { itemId: null, confidence: 0, ambiguous: false };
};

const hasMutationVerb = (userText: string): boolean =>
  /\b(set|update|put|mark|change|assign|rename|add|schedule|log|note|visit|remind|follow[- ]?up)\b/i.test(userText);

const hasContactPayload = (userText: string): boolean => {
  const lower = userText.toLowerCase();
  const hasEmail = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(userText);
  const hasPhone = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?){1}\d{3}[\s.-]?\d{4}\b/.test(userText);
  const hasContactWords = /\b(contact|owner|person to talk to|met with|email|phone|cell|address)\b/.test(lower);
  return hasContactWords && (hasEmail || hasPhone || /\bmet with\b/.test(lower) || /\bperson to talk to\b/.test(lower));
};

const isInquiryStyle = (text: string): boolean => {
  const q = text.toLowerCase().trim();
  return /\?$/.test(q) || /^(what|why|how|can|could|should|would|is|are|do|does|did)\b/.test(q);
};

const buildMessagePlan = (text: string): MessagePlan => {
  const lower = text.toLowerCase();
  const explicitInventoryAsk = isExplicitInventoryAsk(text);
  const mutationRequested = hasMutationVerb(text) ||
    hasContactPayload(text) ||
    /\b(put it on my calendar|put on my calendar|add .* to calendar)\b/i.test(text);
  const hasAskVerb = /\b(what|why|how|can you|could you|should i|would you)\b/.test(lower);
  const inquiry = isInquiryStyle(text);
  const mixed = mutationRequested && hasAskVerb;
  const ambiguousAction = mutationRequested && inquiry &&
    !/\b(set|update|change|assign|rename|mark|schedule)\b/i.test(text);
  if (mixed) return { mode: 'mixed', confidence: 0.72, explicitInventoryAsk, mutationRequested, ambiguousAction };
  if (mutationRequested && !ambiguousAction) return { mode: 'act', confidence: 0.85, explicitInventoryAsk, mutationRequested, ambiguousAction };
  if (explicitInventoryAsk || hasAskVerb || inquiry) return { mode: 'ask', confidence: 0.8, explicitInventoryAsk, mutationRequested, ambiguousAction };
  return { mode: 'inform', confidence: 0.64, explicitInventoryAsk, mutationRequested, ambiguousAction };
};

const parseOwnerCandidateFromText = (userText: string): string | null => {
  const metWith = userText.match(/\bmet with\s+([a-z][a-z' -]{1,48})\b/i);
  if (metWith?.[1]) return metWith[1].trim().replace(/[.?!,;:]+$/g, '');

  const ownerIs = userText.match(/\bowner\s+(?:is|=|:)\s*([a-z][a-z' -]{1,48})\b/i);
  if (ownerIs?.[1]) return ownerIs[1].trim().replace(/[.?!,;:]+$/g, '');

  return null;
};

const parseContactDetailsFromText = (userText: string): {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
} | null => {
  const emailMatch = userText.match(/\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i);
  const phoneMatch = userText.match(/((?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?){1}\d{3}[\s.-]?\d{4})\b/);
  const metWith = userText.match(/\bmet with\s+([a-z][a-z' -]{1,64})\b/i);
  const personToTalk = userText.match(/\bperson to talk to\s+(?:is|=|:)?\s*([a-z][a-z' -]{1,64})\b/i);
  const contactIs = userText.match(/\bcontact\s+(?:is|=|:)\s*([a-z][a-z' -]{1,64})\b/i);
  const ownerIs = userText.match(/\bowner\s+(?:is|=|:)\s*([a-z][a-z' -]{1,64})\b/i);
  const addressMatch = userText.match(/\baddress\s+(?:is|=|:)\s*([^.;\n]{4,120})/i);

  const name = (metWith?.[1] || personToTalk?.[1] || contactIs?.[1] || ownerIs?.[1] || '').trim().replace(/[.?!,;:]+$/g, '');
  const email = (emailMatch?.[1] || '').trim();
  const phone = (phoneMatch?.[1] || '').trim();
  const address = (addressMatch?.[1] || '').trim();

  const result = {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {})
  };

  return Object.keys(result).length > 0 ? result : null;
};

const simpleStableHash = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
};

const buildMutationIdempotencyKey = (userId: string, itemId: string, text: string, route: string): string =>
  `mut:${route}:${itemId}:${simpleStableHash(`${userId}:${normalize(text)}`)}`;

const buildProposalId = (type: ChatProposal['type'], payload: Record<string, unknown>): string =>
  `p:${type}:${simpleStableHash(JSON.stringify(payload))}`;

const isExplicitItemReference = (message: string, itemTitle: string): boolean => {
  const nMessage = normalize(message);
  const nTitle = normalize(itemTitle || '');
  if (!nTitle) return false;
  return nMessage.includes(nTitle);
};

const extractCurrentCustomFieldValue = (
  snapshot: AccountContextSnapshot,
  itemId: string,
  fieldId: string
): {
  option_id?: string | null;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
} | null => {
  const row = snapshot.itemFieldValues.find((entry) => entry.item_id === itemId && entry.field_id === fieldId);
  if (!row) return null;
  return {
    option_id: row.option_id ?? null,
    value_text: row.value_text ?? null,
    value_number: row.value_number ?? null,
    value_date: row.value_date ?? null,
    value_boolean: row.value_boolean ?? null
  };
};

const extractPrimaryUserContent = (userText: string): string => {
  const marker = userText.match(/\bComment:\s*([\s\S]+)$/i);
  const value = marker?.[1]?.trim() || userText.trim();
  return value;
};

const detectTargetFieldAlias = (userText: string): string | null => {
  const q = normalize(userText);
  const aliases = [
    'owner name',
    'owner',
    'contact',
    'email',
    'phone',
    'location',
    'status',
    'title',
    'description',
    'notes',
    'note'
  ];
  for (const alias of aliases) {
    if (q.includes(alias)) return alias;
  }
  return null;
};

const extractValueForField = (userText: string, fieldAlias: string | null): string | null => {
  if (!fieldAlias) return null;
  const quoted = userText.match(/["“](.+?)["”]/);
  if (quoted?.[1]) return quoted[1].trim();

  const aliasRegex = escapeRegExp(fieldAlias);
  const direct = userText.match(new RegExp(`\\b${aliasRegex}\\b\\s*(?:to|as)\\s+(.+)$`, 'i'));
  if (direct?.[1]) return direct[1].trim().replace(/[.?!]+$/g, '');

  const verbFirst = userText.match(new RegExp(`\\b(?:set|update|put|mark|change|assign)\\s+(.+?)\\s+(?:to|as)\\s+\\b${aliasRegex}\\b`, 'i'));
  if (verbFirst?.[1]) return verbFirst[1].trim().replace(/[.?!]+$/g, '');

  if (/\bput\s+him\s+down\s+as\s+owner\b/i.test(userText) || /\bset\s+him\s+as\s+owner\b/i.test(userText)) {
    const lead = userText.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\b/);
    if (lead?.[1]) return lead[1].trim();
  }

  const general = userText.match(/\b(?:to|as)\s+(.+)$/i);
  if (general?.[1]) return general[1].trim().replace(/[.?!]+$/g, '');
  return null;
};

const resolveFieldFromAlias = (
  fieldsForList: FieldSchemaValue[],
  alias: string
): FieldSchemaValue | null => {
  const nAlias = normalize(alias);
  const aliasTokenSets: Record<string, string[]> = {
    owner: ['owner', 'owner name', 'contact owner'],
    contact: ['contact', 'owner', 'owner name'],
    email: ['email', 'contact email'],
    phone: ['phone', 'contact phone', 'mobile'],
    location: ['location', 'address'],
    status: ['status', 'stage'],
    title: ['title', 'name'],
    description: ['description', 'desc', 'notes', 'note'],
    notes: ['notes', 'note', 'description']
  };
  const needles = aliasTokenSets[nAlias] || [nAlias];
  for (const field of fieldsForList) {
    const name = normalize(field.name || '');
    for (const needle of needles) {
      if (name.includes(normalize(needle))) {
        return field;
      }
    }
  }
  return null;
};

const formatStatusLabel = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string): number => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const parts = dtf.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return Math.round((asUtc - date.getTime()) / 60000);
};

const zonedLocalToUtcIso = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): string => {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMinutes(new Date(guess), timeZone);
    const candidate = Date.UTC(year, month - 1, day, hour, minute, 0) - offset * 60000;
    if (candidate === guess) break;
    guess = candidate;
  }
  return new Date(guess).toISOString();
};

const getNowInTimeZoneParts = (timeZone: string): { year: number; month: number; day: number; weekday: number } => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long'
  });
  const parts = dtf.formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const weekdayByName: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: weekdayByName[(map.weekday || '').toLowerCase()] ?? new Date().getDay()
  };
};

const parseScheduledAtFromText = (userText: string, timeZone = 'America/Denver'): string | null => {
  const lower = userText.toLowerCase();
  const nowTz = getNowInTimeZoneParts(timeZone);
  const baseLocal = new Date(Date.UTC(nowTz.year, nowTz.month - 1, nowTz.day, 9, 0, 0));

  if (/\btomorrow\b/.test(lower)) {
    baseLocal.setUTCDate(baseLocal.getUTCDate() + 1);
  } else {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const idx = weekdays.findIndex((weekday) => new RegExp(`\\b${weekday}\\b`).test(lower));
    if (idx >= 0) {
      const current = nowTz.weekday;
      let delta = (idx - current + 7) % 7;
      if (delta === 0) delta = 7;
      baseLocal.setUTCDate(baseLocal.getUTCDate() + delta);
    }
  }

  const timeMatch = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!timeMatch) {
    return null;
  }
  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2] || '0');
  const meridian = timeMatch[3] || null;
  if (meridian === 'pm' && hours !== 12) hours += 12;
  if (meridian === 'am' && hours === 12) hours = 0;
  if (!meridian) {
    // Default ambiguous "at 12" to 12:00, and early-hour meeting language to PM.
    if (hours === 12) {
      hours = 12;
    } else if (/\b(meeting|calendar|appointment|fta)\b/.test(lower) && hours >= 1 && hours <= 7) {
      hours += 12;
    }
  }
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const year = baseLocal.getUTCFullYear();
  const month = baseLocal.getUTCMonth() + 1;
  const day = baseLocal.getUTCDate();
  return zonedLocalToUtcIso(year, month, day, hours, minutes, timeZone);
};

const parsePlanningDateFromText = (
  userText: string,
  timeZone = 'America/Denver'
): { year: number; month: number; day: number; weekday: number } | null => {
  const lower = userText.toLowerCase();
  const nowTz = getNowInTimeZoneParts(timeZone);
  const base = { ...nowTz };

  if (/\btoday\b/.test(lower)) {
    return base;
  }

  if (/\btomorrow\b/.test(lower)) {
    const tomorrow = new Date(Date.UTC(nowTz.year, nowTz.month - 1, nowTz.day, 12, 0, 0));
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return {
      year: tomorrow.getUTCFullYear(),
      month: tomorrow.getUTCMonth() + 1,
      day: tomorrow.getUTCDate(),
      weekday: tomorrow.getUTCDay()
    };
  }

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const idx = weekdays.findIndex((weekday) => new RegExp(`\\b${weekday}\\b`).test(lower));
  if (idx >= 0) {
    const current = nowTz.weekday;
    let delta = (idx - current + 7) % 7;
    if (delta === 0) delta = 7;
    const target = new Date(Date.UTC(nowTz.year, nowTz.month - 1, nowTz.day, 12, 0, 0));
    target.setUTCDate(target.getUTCDate() + delta);
    return {
      year: target.getUTCFullYear(),
      month: target.getUTCMonth() + 1,
      day: target.getUTCDate(),
      weekday: target.getUTCDay()
    };
  }

  return null;
};

const isSameLocalDate = (
  iso: string,
  target: { year: number; month: number; day: number },
  timeZone = 'America/Denver'
): boolean => {
  const date = new Date(iso);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = dtf.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return (
    Number(map.year) === target.year &&
    Number(map.month) === target.month &&
    Number(map.day) === target.day
  );
};

const inferTargetBlockNeedle = (userText: string): string | null => {
  const explicit = userText.match(/\b(?:first|next|during|in)\s+([a-z0-9 '&/-]+?)\s+block\b/i);
  if (explicit?.[1]?.trim()) {
    return normalize(explicit[1]);
  }
  const generic = userText.match(/\b([a-z0-9 '&/-]+?)\s+block\b/i);
  if (generic?.[1]?.trim()) {
    return normalize(generic[1]);
  }
  return null;
};

const inferTargetBlockOrdinal = (userText: string): number | null => {
  const lower = userText.toLowerCase();
  if (/\b(first|1st)\b/.test(lower)) return 1;
  if (/\b(second|2nd)\b/.test(lower)) return 2;
  if (/\b(third|3rd)\b/.test(lower)) return 3;
  if (/\b(fourth|4th)\b/.test(lower)) return 4;
  if (/\b(fifth|5th)\b/.test(lower)) return 5;
  return null;
};

const buildNamedTimeBlockTitle = (
  blockNeedle: string | null,
  userText: string,
  existingBlocks: AccountContextSnapshot['timeBlocks'],
  context: ChatContext
): string => {
  const planningConfig =
    typeof context.node_structure_config?.planning === 'object' && context.node_structure_config?.planning
      ? (context.node_structure_config.planning as Record<string, unknown>)
      : null;
  const namingRules = Array.isArray(planningConfig?.timeBlockNaming)
    ? (planningConfig?.timeBlockNaming as Array<Record<string, unknown>>)
    : [];
  const normalizedNeedle = normalize(blockNeedle || '');
  const matchedRule =
    namingRules.find((rule) => {
      const aliases = Array.isArray(rule.aliases) ? rule.aliases : [];
      return aliases.some((alias) => normalizedNeedle.includes(normalize(String(alias))));
    }) || null;

  if (!matchedRule) {
    return blockNeedle
      ? blockNeedle
          .split(' ')
          .filter(Boolean)
          .map((token) => token[0].toUpperCase() + token.slice(1))
          .join(' ')
      : 'Focus';
  }

  const template = typeof matchedRule.template === 'string' && matchedRule.template.trim()
    ? matchedRule.template.trim()
    : '{label} Block {n}';
  const label = typeof matchedRule.label === 'string' && matchedRule.label.trim()
    ? matchedRule.label.trim()
    : 'Focus';
  const ordinal = inferTargetBlockOrdinal(userText);
  const normalizedLabel = normalize(label);
  const existingCount = existingBlocks.filter((block) => normalize(block.title).includes(normalizedLabel)).length;
  const sequenceNumber = ordinal || existingCount + 1;
  return template.replace(/\{label\}/gi, label).replace(/\{n\}/gi, String(sequenceNumber));
};

const extractExcludedStatusLabel = (userText: string): string | null => {
  const quoted = userText.match(/\b(?:apart from|except|excluding|exclude|not in)\s+(?:the\s+)?["“]([^"”]+)["”]\s+status\b/i);
  if (quoted?.[1]?.trim()) return quoted[1].trim();
  const plain = userText.match(/\b(?:apart from|except|excluding|exclude|not in)\s+(?:the\s+)?(.+?)\s+status\b/i);
  if (plain?.[1]?.trim()) return plain[1].trim().replace(/[.?!,;:]+$/g, '');
  return null;
};

const getPrimaryStatusLabelForItem = (
  item: AccountContextSnapshot['items'][number],
  snapshot: AccountContextSnapshot
): string | null => {
  const fields = snapshot.fields.filter((field) => field.list_id === item.lane_id);
  const statusField = fields.find((field) => field.type === 'status' && field.is_primary) || fields.find((field) => field.type === 'status');
  if (statusField) {
    const row = snapshot.itemFieldValues.find((value) => value.item_id === item.id && value.field_id === statusField.id) || null;
    if (row?.option_id) {
      const option = snapshot.fieldOptions.find((entry) => entry.id === row.option_id) || null;
      if (option?.label) return option.label;
    }
    if (row?.value_text?.trim()) {
      return row.value_text.trim();
    }
  }
  return item.status || null;
};

const detectTaskSuggestionsForBlockIntent = (userText: string): boolean => {
  const lower = userText.toLowerCase();
  return (
    /\bwhat\b/.test(lower) &&
    /\b(tasks?|actions?)\b/.test(lower) &&
    /\b(block|time block)\b/.test(lower) &&
    /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower)
  );
};

const selectEligiblePlanningLists = (
  scopedLists: AccountContextSnapshot['lists'],
  context: ChatContext
): AccountContextSnapshot['lists'] => {
  const configuredLists = Array.isArray(context.node_structure_config?.lists)
    ? (context.node_structure_config?.lists as Array<Record<string, unknown>>)
    : [];
  if (configuredLists.length === 0) return scopedLists;
  const configuredNames = new Set(
    configuredLists
      .map((entry) => (typeof entry?.name === 'string' ? normalize(entry.name) : ''))
      .filter(Boolean)
  );
  const matched = scopedLists.filter((list) => configuredNames.has(normalize(list.name)));
  return matched.length > 0 ? matched : scopedLists;
};

const getNodeListConfig = (context: ChatContext, listName: string | null | undefined): Record<string, unknown> | null => {
  if (!listName) return null;
  const configuredLists = Array.isArray(context.node_structure_config?.lists)
    ? (context.node_structure_config?.lists as Array<Record<string, unknown>>)
    : [];
  return (
    configuredLists.find((entry) => typeof entry?.name === 'string' && normalize(entry.name) === normalize(listName)) ||
    null
  );
};

const getItemFieldValue = (
  snapshot: AccountContextSnapshot,
  itemId: string,
  listId: string | null,
  fieldName: string
): string | number | boolean | null => {
  if (!listId) return null;
  const schema = snapshot.fields.find(
    (field) => field.list_id === listId && normalize(field.name) === normalize(fieldName)
  );
  if (!schema) return null;
  const value = snapshot.itemFieldValues.find((entry) => entry.item_id === itemId && entry.field_id === schema.id) || null;
  if (!value) return null;
  if (typeof value.value_text === 'string' && value.value_text.trim()) return value.value_text.trim();
  if (typeof value.value_number === 'number') return value.value_number;
  if (typeof value.value_date === 'string' && value.value_date.trim()) return value.value_date.trim();
  if (typeof value.value_boolean === 'boolean') return value.value_boolean;
  if (value.option_id) {
    const option = snapshot.fieldOptions.find((entry) => entry.id === value.option_id) || null;
    if (option?.label) return option.label;
  }
  return null;
};

const scorePlanningCandidate = (
  item: AccountContextSnapshot['items'][number],
  list: AccountContextSnapshot['lists'][number] | null,
  latestComment: AccountContextSnapshot['itemComments'][number] | null,
  snapshot: AccountContextSnapshot,
  context: ChatContext
): { score: number; missingCriticalFields: string[] } => {
  let score = 0.5;
  const missingCriticalFields: string[] = [];
  const listConfig = getNodeListConfig(context, list?.name);
  const configuredFields = Array.isArray(listConfig?.fields)
    ? (listConfig?.fields as Array<Record<string, unknown>>)
    : [];

  for (const field of configuredFields) {
    const fieldName = typeof field.name === 'string' ? field.name : '';
    if (!fieldName) continue;
    const semanticRole = typeof field.semanticRole === 'string' ? field.semanticRole : null;
    const importance = typeof field.confidenceImportance === 'string' ? field.confidenceImportance : null;
    const value = getItemFieldValue(snapshot, item.id, list?.id || null, fieldName);
    const hasValue = value !== null && value !== undefined && !(typeof value === 'string' && value.trim().length === 0);

    if (hasValue) {
      if (importance === 'critical') score += 0.22;
      else if (importance === 'preferred') score += 0.12;
      else score += 0.04;
      if (semanticRole === 'routing' || semanticRole === 'scheduling' || semanticRole === 'follow_up') {
        score += 0.08;
      }
    } else if (importance === 'critical') {
      missingCriticalFields.push(fieldName);
      score -= 0.18;
    } else if (importance === 'preferred') {
      score -= 0.06;
    }
  }

  if (latestComment?.body?.trim()) score += 0.1;
  if (item.signal_label?.trim()) score += 0.06;
  if (typeof item.signal_score === 'number') score += Math.max(0, Math.min(0.18, item.signal_score * 0.18));
  if (item.status && !/done|closed|complete/i.test(item.status)) score += 0.08;
  return {
    score: Math.max(0, Math.min(1, Number(score.toFixed(2)))),
    missingCriticalFields
  };
};

const buildPlanningActionContract = (
  userText: string,
  snapshot: AccountContextSnapshot,
  context: ChatContext,
  messages: ChatMessage[]
): PlanningActionContract => {
  const planningTimezone = context.planning_timezone || 'America/Denver';
  const planningDate = parsePlanningDateFromText(userText, planningTimezone);
  const focalEntities = resolveEntities(userText, snapshot, context, messages);
  const resolvedFocalId = focalEntities.focal.id || context.focal_id || null;
  const resolvedListId = focalEntities.list.id || context.list_id || null;
  const baseScopedLists = resolvedListId
    ? snapshot.lists.filter((list) => list.id === resolvedListId)
    : resolvedFocalId
      ? snapshot.lists.filter((list) => list.focal_id === resolvedFocalId)
      : snapshot.lists;
  const scopedLists = selectEligiblePlanningLists(baseScopedLists, context);
  const excludedStatusLabel = extractExcludedStatusLabel(userText);
  const scopedItems = snapshot.items.filter((item) => scopedLists.some((list) => list.id === item.lane_id));
  const candidateItems = scopedItems
    .map((item) => ({
      item,
      list: scopedLists.find((list) => list.id === item.lane_id) || null,
      statusLabel: getPrimaryStatusLabelForItem(item, snapshot),
      latestComment:
        snapshot.itemComments
          .filter((comment) => comment.item_id === item.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null
    }))
    .map((entry) => {
      const scoring = scorePlanningCandidate(entry.item, entry.list, entry.latestComment, snapshot, context);
      return {
        ...entry,
        score: scoring.score,
        missingCriticalFields: scoring.missingCriticalFields
      };
    })
    .filter((entry) =>
      excludedStatusLabel ? normalize(entry.statusLabel || '') !== normalize(excludedStatusLabel) : true
    )
    .sort((a, b) => b.score - a.score);

  const targetBlockNeedle = inferTargetBlockNeedle(userText);
  const dayBlocks = planningDate
    ? snapshot.timeBlocks
        .filter((block) => isSameLocalDate(block.start_time, planningDate, planningTimezone))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    : [];
  const targetBlock = targetBlockNeedle
    ? dayBlocks.find((block) => normalize(block.title).includes(targetBlockNeedle)) || null
    : dayBlocks[0] || null;

  return {
    planningDate,
    planningTimezone,
    excludedStatusLabel,
    targetBlockNeedle,
    resolvedFocalId,
    resolvedListId,
    scopedLists,
    candidateItems,
    dayBlocks,
    targetBlock,
    focalEntities
  };
};

const inferCalendarTitleFromText = (userText: string): string => {
  const trimmed = userText.trim();
  const quoted = trimmed.match(/["“](.+?)["”]/);
  if (quoted?.[1]?.trim()) return clip(quoted[1].trim(), 80);

  const meeting = trimmed.match(/\b([a-z0-9 '&/-]{2,60})\s+meeting\b/i);
  if (meeting?.[1]) {
    return clip(`${meeting[1].trim()} meeting`, 80);
  }

  const beforeIs = trimmed.match(/^(.+?)\s+is\s+(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (beforeIs?.[1]) {
    return clip(beforeIs[1].trim(), 80);
  }
  return 'Calendar follow-up';
};

const inferActionTitleFromText = (userText: string): string => {
  const quoted = userText.match(/["“](.+?)["”]/);
  if (quoted?.[1]?.trim()) return clip(quoted[1].trim(), 80);

  const noteTo = userText.match(/\bnote\s+to\s+(.+?)(?:\s+in\s+my\s+.+\s+block|\s+(?:tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|$)/i);
  if (noteTo?.[1]?.trim()) {
    return clip(noteTo[1].trim().replace(/[.?!]+$/g, ''), 80);
  }

  const visit = userText.match(/\bvisit\s+(.+?)(?:\s+in\s+my\s+.+\s+block|\s+(?:tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|$)/i);
  if (visit?.[0]?.trim()) {
    return clip(visit[0].trim().replace(/[.?!]+$/g, ''), 80);
  }
  return 'Follow up';
};

const inferTimeBlockNameFromText = (userText: string): string | null => {
  const match = userText.match(/\bin\s+(?:my\s+)?(.+?)\s+block\b/i);
  if (!match?.[1]) return null;
  return normalize(match[1]);
};

const detectIntent = (userText: string): DeterministicIntent => {
  const q = userText.toLowerCase();
  const explicitInventory = isExplicitInventoryAsk(userText);
  const asksNextStep = /\b(next step|what should i do next|follow[- ]?up|follow up)\b/.test(q);
  const asksFields = /\b(field|fields|columns|column|status field|custom field)\b/.test(q);
  const asksFocals = /\b(focals?|spaces?)\b/.test(q);
  const asksActions = /\bactions?\b/.test(q);
  const asksTimeBlocks = /\btime block|timeblock|calendar\b/.test(q);
  if (asksNextStep) return 'item_next_step';
  if (asksFields && explicitInventory) return 'field_inventory';
  if (asksFocals && explicitInventory) return 'focal_inventory';
  if (asksActions && explicitInventory) return 'action_inventory';
  if (asksTimeBlocks && explicitInventory) return 'timeblock_inventory';
  return 'unknown';
};

const extractTitleCandidate = (userText: string): string | null => {
  const quoted = userText.match(/["“](.+?)["”]/);
  if (quoted?.[1]) {
    const value = quoted[1].trim();
    return value.length ? value : null;
  }
  const addToList = userText.match(
    /\b(?:create|add|make)\s+(.+?)\s+to\s+(?:the\s+)?[a-z0-9][a-z0-9\s&'/-]{1,80}\s+list\b/i
  );
  if (addToList?.[1]) {
    const value = addToList[1].trim().replace(/[.?!,;:]+$/g, '');
    if (value.length) return value;
  }
  const patterns = [
    /\b(?:called|named|title(?:d)?|for)\s+([a-z0-9][a-z0-9\s&'/-]{2,80})$/i,
    /\b(?:create|add|make)\s+(?:a|an)?\s*(?:new\s+)?(?:focal|space|list|item|task|action)\s+([a-z0-9][a-z0-9\s&'/-]{2,80})$/i
  ];
  for (const pattern of patterns) {
    const match = userText.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim().replace(/[.?!,;:]+$/g, '');
      if (value.length) return value;
    }
  }
  return null;
};

const detectCreateTarget = (userText: string): 'focal' | 'list' | 'item' | 'action' | null => {
  const q = userText.toLowerCase();
  if (!/\b(create|add|make|start|setup|set up)\b/.test(q)) return null;
  if (/\b(?:create|add|make)\s+.+\s+to\s+.+\blist\b/.test(q)) return 'item';
  if (/\b(?:create|add|make)\s+(?:a|an|new)?\s*list\b/.test(q)) return 'list';
  if (/\b(focal|space)(s)?\b/.test(q)) return 'focal';
  if (/\b(action|sub-?item|subitem|step)\b/.test(q)) return 'action';
  if (/\b(item|task)\b/.test(q)) return 'item';
  return null;
};

const resolveEntities = (
  userText: string,
  snapshot: AccountContextSnapshot,
  context: ChatContext,
  messages: ChatMessage[]
): ResolvedEntities => {
  const focalMatchRaw = resolveFocalIdFromQuestion(userText, snapshot, undefined, messages);
  const focalId = focalMatchRaw.focalId || context.focal_id || null;
  const focalConfidence = focalMatchRaw.focalId ? focalMatchRaw.confidence : context.focal_id ? 1 : 0;
  const focalFromPrior = Boolean(focalMatchRaw.fromPrior);

  const listMatchRaw = resolveListIdFromQuestion(
    userText,
    snapshot,
    undefined,
    messages,
    focalId
  );
  let listId = listMatchRaw.listId || context.list_id || null;
  let listConfidence = listMatchRaw.listId ? listMatchRaw.confidence : context.list_id ? 1 : 0;
  let listAmbiguous = listMatchRaw.ambiguous;
  let listFromPrior = Boolean(listMatchRaw.fromPrior);

  // If list resolves, infer focal from the owning list.
  if (listId) {
    const list = snapshot.lists.find((entry) => entry.id === listId);
    if (list?.focal_id) {
      return {
        focal: {
          id: list.focal_id,
          confidence: focalId === list.focal_id ? Math.max(focalConfidence, 0.9) : 0.9,
          ambiguous: focalMatchRaw.ambiguous && !focalMatchRaw.focalId,
          fromPrior: focalFromPrior
        },
        list: {
          id: listId,
          confidence: listConfidence,
          ambiguous: listAmbiguous,
          fromPrior: listFromPrior
        }
      };
    }
  }

  if (!listId && focalId) {
    const focalScopedLists = snapshot.lists.filter((entry) => entry.focal_id === focalId);
    if (focalScopedLists.length === 1) {
      listId = focalScopedLists[0].id;
      listConfidence = 0.55;
      listAmbiguous = false;
      listFromPrior = false;
    }
  }

  return {
    focal: { id: focalId, confidence: focalConfidence, ambiguous: focalMatchRaw.ambiguous, fromPrior: focalFromPrior },
    list: { id: listId, confidence: listConfidence, ambiguous: listAmbiguous, fromPrior: listFromPrior }
  };
};

const runMutationTools = async (
  client: ReturnType<typeof createClient>,
  userId: string,
  userText: string,
  snapshot: AccountContextSnapshot,
  context: ChatContext,
  messages: ChatMessage[],
  plan: MessagePlan
): Promise<{
  handled: boolean;
  suppressInventory?: boolean;
  text?: string;
  proposals?: ChatProposal[];
  route?: string;
  scopeLabels?: { focal?: string; list?: string };
  confidence?: { focal?: number; list?: number };
  tools: DebugMeta['tools'];
}> => {
  const tools: DebugMeta['tools'] = [];
  const missingDataHandling = extractMissingDataHandling(context);
  if (!plan.mutationRequested) {
    tools.push({ name: 'find_entity', status: 'skipped', summary: 'No mutation verb detected' });
    return { handled: false, suppressInventory: false, tools };
  }
  if (plan.ambiguousAction) {
    tools.push({ name: 'find_entity', status: 'blocked', summary: 'Action intent ambiguous' });
    return {
      handled: true,
      suppressInventory: true,
      text: 'I can apply that. Confirm with a direct action like "set owner to Rusty" or "schedule Tuesday 12:00 PM".',
      tools,
      route: 'mutation_needs_confirmation'
    };
  }

  const focalNameById = new Map(snapshot.focals.map((f) => [f.id, f.name]));
  const lists = snapshot.lists.map((list) => ({
    ...list,
    focalName: list.focal_id ? focalNameById.get(list.focal_id) || null : null
  }));
  const createTarget = detectCreateTarget(userText);
  if (createTarget) {
    tools.push({
      name: 'update_record',
      status: 'skipped',
      summary: `Delegated create-intent (${createTarget}) to deterministic proposal flow`
    });
    return { handled: false, suppressInventory: false, tools };
  }
  const entities = resolveEntities(userText, snapshot, context, messages);
  const listId = entities.list.id || context.list_id || null;
  const itemMatch = resolveItemIdFromQuestion(userText, snapshot, context.item_id, listId);
  const itemId = itemMatch.itemId || context.item_id || null;
  const item = itemId ? snapshot.items.find((entry) => entry.id === itemId) || null : null;
  const content = extractPrimaryUserContent(userText);
  const wantsSchedulingAction =
    /\b(visit|follow[- ]?up|schedule|remind|add task|add action|task|meeting|appointment|calendar|put it on my calendar|put on my calendar)\b/i.test(
      content
    ) &&
    /\b(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|calendar|block|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i.test(
      content
    );

  if (!item && wantsSchedulingAction) {
    const scheduledAt = parseScheduledAtFromText(content, 'America/Denver');
    const wantsCalendarEvent = /\b(calendar|put it on my calendar|put on my calendar)\b/i.test(content);
    if (wantsCalendarEvent && scheduledAt) {
      const startDate = new Date(scheduledAt);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const calendarTitle = inferCalendarTitleFromText(content);
      const overlappingBlock = snapshot.timeBlocks.find((block) => {
        const blockStart = new Date(block.start_time).getTime();
        const blockEnd = new Date(block.end_time).getTime();
        return startDate.getTime() < blockEnd && endDate.getTime() > blockStart;
      });

      if (overlappingBlock) {
        tools.push({
          name: 'create_time_block',
          status: 'blocked',
          summary: `Conflict with existing block ${overlappingBlock.title}`
        });
        return {
          handled: true,
          suppressInventory: true,
          text: `I found "${calendarTitle}" for ${new Date(startDate).toLocaleString(undefined, {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit'
          })}, but that overlaps with "${overlappingBlock.title}". Open the relevant item or clarify whether this should replace that block.`,
          tools,
          route: 'mutation_calendar_conflict_no_item',
          scopeLabels: {
            focal: entities.focal.id ? focalNameById.get(entities.focal.id) || undefined : undefined
          },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      }

      try {
        const createdBlock = await insertTimeBlock(client, userId, {
          title: calendarTitle,
          description: null,
          startUtc: startDate.toISOString(),
          endUtc: endDate.toISOString(),
          tags: []
        });
        tools.push({ name: 'create_time_block', status: 'applied', summary: `Created calendar event ${createdBlock.title}` });
        return {
          handled: true,
          suppressInventory: true,
          text: `Added "${calendarTitle}" to your calendar for ${new Date(startDate).toLocaleString(undefined, {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit'
          })}.`,
          tools,
          route: 'create_calendar_event_direct_no_item',
          scopeLabels: {
            focal: entities.focal.id ? focalNameById.get(entities.focal.id) || undefined : undefined
          },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      } catch (error) {
        tools.push({
          name: 'create_time_block',
          status: 'error',
          summary: error instanceof Error ? error.message : String(error)
        });
        return {
          handled: true,
          suppressInventory: true,
          text: `I could read the schedule, but couldn't create the calendar event automatically (${error instanceof Error ? error.message : String(error)}).`,
          tools,
          route: 'create_calendar_event_error_no_item',
          scopeLabels: {
            focal: entities.focal.id ? focalNameById.get(entities.focal.id) || undefined : undefined
          },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      }
    }
  }

  if (!item) {
    tools.push({ name: 'find_entity', status: 'blocked', summary: 'No active item resolved' });
    return {
      handled: true,
      suppressInventory: true,
      text: 'I need the specific item to apply that update. Open the item (or name it) and I will apply it directly.',
      tools,
      route: 'mutation_no_item',
      scopeLabels: {
        focal: entities.focal.id ? focalNameById.get(entities.focal.id) || undefined : undefined
      },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }
  const scopedMutationAllowed =
    Boolean(context.item_id) ||
    isExplicitItemReference(content, item.title) ||
    itemMatch.confidence >= 0.92;
  if (!scopedMutationAllowed) {
    tools.push({ name: 'policy_engine', status: 'blocked', summary: 'Active scope not explicit enough for safe mutation' });
    return {
      handled: true,
      suppressInventory: true,
      text: `I found "${item.title}", but I won't mutate until scope is explicit. Reply with: "update ${item.title} …" or open that item and retry.`,
      route: 'mutation_scope_guard',
      tools,
      scopeLabels: {
        focal: entities.focal.id ? focalNameById.get(entities.focal.id) || undefined : undefined
      },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }
  tools.push({ name: 'find_entity', status: 'applied', summary: `Resolved item ${item.title}` });

  const itemList = lists.find((entry) => entry.id === item.lane_id) || null;
  const fieldsForList = snapshot.fields.filter((field) => field.list_id === item.lane_id);
  const preserveFallbackIntent = async (summary: string): Promise<void> => {
    if (!missingDataHandling.doNotBlockOnPartialData) return;
    try {
      await client.from('item_comments').insert([
        {
          item_id: item.id,
          user_id: userId,
          body: `Context: ${summary}`
        }
      ]);
      tools.push({ name: 'preserve_intent', status: 'applied', summary });
    } catch (error) {
      tools.push({
        name: 'preserve_intent',
        status: 'error',
        summary: error instanceof Error ? error.message : String(error)
      });
    }
  };
  tools.push({
    name: 'get_schema_and_state',
    status: 'applied',
    summary: `Loaded ${fieldsForList.length} field(s) for list`
  });

  const contactPayload = parseContactDetailsFromText(content);
  const hasSchedulingLanguage = /\b(calendar|schedule|visit|meeting|appointment|follow[- ]?up|add task|add action|block)\b/i.test(content);
  if (contactPayload && !hasSchedulingLanguage) {
    const explicitContactField =
      fieldsForList.find((field) => normalize(field.type || '') === 'contact') || null;
    const contactField = explicitContactField || resolveFieldFromAlias(fieldsForList, 'contact');
    if (contactField) {
      const currentField = extractCurrentCustomFieldValue(snapshot, item.id, contactField.id);
      const rawCurrent = String(currentField?.value_text || '').trim();
      let existingContacts: Array<Record<string, string>> = [];
      if (rawCurrent) {
        try {
          const parsed = JSON.parse(rawCurrent);
          if (Array.isArray(parsed)) {
            existingContacts = parsed.filter((entry) => entry && typeof entry === 'object');
          } else if (parsed && typeof parsed === 'object') {
            existingContacts = [parsed as Record<string, string>];
          }
        } catch {
          existingContacts = [];
        }
      }

      const contact = Object.fromEntries(
        Object.entries(contactPayload).filter(([, value]) => Boolean(String(value || '').trim()))
      ) as Record<string, string>;

      const findMatchIndex = existingContacts.findIndex((entry) =>
        (contact.email && normalize(entry.email || '') === normalize(contact.email)) ||
        (contact.phone && normalize(entry.phone || '') === normalize(contact.phone)) ||
        (contact.name && normalize(entry.name || '') === normalize(contact.name))
      );

      if (findMatchIndex >= 0) {
        existingContacts[findMatchIndex] = { ...existingContacts[findMatchIndex], ...contact };
      } else {
        existingContacts.push(contact);
      }

      const payloadValue = existingContacts.length <= 1
        ? JSON.stringify(existingContacts[0] || contact)
        : JSON.stringify(existingContacts);

      const upsertRow = {
        user_id: userId,
        item_id: item.id,
        field_id: contactField.id,
        option_id: null,
        value_text: payloadValue,
        value_number: null,
        value_date: null,
        value_boolean: null
      };

      const { error } = await client
        .from('item_field_values')
        .upsert(upsertRow, { onConflict: 'item_id,field_id' });
      if (error) {
        tools.push({ name: 'update_record', status: 'error', summary: error.message });
        return {
          handled: true,
          text: `I found ${item.title}, but couldn't save contact details (${error.message}).`,
          route: 'update_contact_error',
          tools,
          scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      }

      tools.push({ name: 'update_record', status: 'applied', summary: `Updated contact field: ${contactField.name}` });
      return {
        handled: true,
        text: `Saved. Added contact details on ${item.title} in ${contactField.name}.`,
        route: 'update_contact_field',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
  }

  if (wantsSchedulingAction) {
    const actionTitle = inferActionTitleFromText(content);
    const scheduledAt = parseScheduledAtFromText(content, 'America/Denver');
    const wantsCalendarEvent = /\b(calendar|put it on my calendar|put on my calendar)\b/i.test(content);
    const isHardEvent = /\b(meeting|appointment|call|event)\b/i.test(content);
    const ownerCandidate = parseOwnerCandidateFromText(content);
    let ownerFieldUpdateSummary: string | null = null;
    if (ownerCandidate) {
      const ownerField = resolveFieldFromAlias(fieldsForList, 'owner');
      if (ownerField) {
        ownerFieldUpdateSummary = `Detected owner "${ownerCandidate}" (not auto-applied in this step).`;
        tools.push({ name: 'update_record', status: 'skipped', summary: 'Owner update staged (proposal-only mode)' });
      } else {
        tools.push({ name: 'update_record', status: 'blocked', summary: 'Owner phrase detected but no owner field exists on list' });
      }
    }

    if (wantsCalendarEvent) {
      const startIso = scheduledAt || new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const startDate = new Date(startIso);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const inferred = inferCalendarTitleFromText(content);
      const calendarTitle = inferred.toLowerCase().includes(item.title.toLowerCase())
        ? inferred
        : `${inferred} - ${item.title}`;
      const overlappingBlock = snapshot.timeBlocks.find((block) => {
        const blockStart = new Date(block.start_time).getTime();
        const blockEnd = new Date(block.end_time).getTime();
        return startDate.getTime() < blockEnd && endDate.getTime() > blockStart;
      });

      if (overlappingBlock && !isHardEvent) {
        tools.push({ name: 'link_and_schedule', status: 'applied', summary: `Prepared action proposal for existing block ${overlappingBlock.title}` });
        return {
          handled: true,
          text: `Ready to add "${actionTitle}" into your existing "${overlappingBlock.title}" block at ${new Date(startDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Approve to apply.${ownerFieldUpdateSummary ? ` ${ownerFieldUpdateSummary}` : ''}`,
          proposals: [
            {
              id: buildProposalId('create_action', {
                item_id: item.id,
                title: actionTitle,
                scheduled_at: startDate.toISOString(),
                time_block_id: overlappingBlock.id
              }),
              type: 'create_action',
              item_id: item.id,
              title: actionTitle,
              notes: null,
              scheduled_at: startDate.toISOString(),
              time_block_id: overlappingBlock.id,
              lane_id: item.lane_id || null
            }
          ],
          route: 'create_work_item_in_existing_block_proposal',
          tools,
          scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      }

      if (overlappingBlock && isHardEvent) {
        tools.push({ name: 'link_and_schedule', status: 'blocked', summary: `Calendar conflict with ${overlappingBlock.title}` });
        return {
          handled: true,
          text: `I found a conflict with "${overlappingBlock.title}" at that time. I prepared a shift proposal and event creation. Approve to apply.`,
          proposals: [
            {
              id: buildProposalId('resolve_time_conflict', {
                conflict_time_block_id: overlappingBlock.id,
                event_title: calendarTitle,
                event_start_utc: startDate.toISOString(),
                event_end_utc: endDate.toISOString()
              }),
              type: 'resolve_time_conflict',
              conflict_time_block_id: overlappingBlock.id,
              conflict_title: overlappingBlock.title,
              conflict_new_start_utc: new Date(new Date(overlappingBlock.end_time).getTime() + 15 * 60 * 1000).toISOString(),
              conflict_new_end_utc: new Date(
                new Date(overlappingBlock.end_time).getTime() +
                  15 * 60 * 1000 +
                  (new Date(overlappingBlock.end_time).getTime() - new Date(overlappingBlock.start_time).getTime())
              ).toISOString(),
              event_title: calendarTitle,
              event_start_utc: startDate.toISOString(),
              event_end_utc: endDate.toISOString(),
              lane_id: item.lane_id || null,
              notes: null
            }
          ],
          route: 'calendar_conflict_proposal',
          tools,
          scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      }
      try {
        const createdBlock = await insertTimeBlock(client, userId, {
          title: calendarTitle,
          description: null,
          startUtc: startDate.toISOString(),
          endUtc: endDate.toISOString(),
          tags: item.lane_id ? [`lane:${item.lane_id}`, `item:${item.id}`] : [`item:${item.id}`]
        });
        tools.push({ name: 'create_time_block', status: 'applied', summary: `Created calendar event ${createdBlock.title}` });
        return {
          handled: true,
          text: `Added "${calendarTitle}" to your calendar for ${new Date(startDate).toLocaleString(undefined, {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit'
          })}.${ownerFieldUpdateSummary ? ` ${ownerFieldUpdateSummary}` : ''}`,
          route: 'create_calendar_event_direct',
          tools,
          scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      } catch (error) {
        tools.push({
          name: 'create_time_block',
          status: 'error',
          summary: error instanceof Error ? error.message : String(error)
        });
        return {
          handled: true,
          text: `I found the schedule and time, but couldn't create the calendar event automatically (${error instanceof Error ? error.message : String(error)}).`,
          route: 'create_calendar_event_error',
          tools,
          scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      }
    }

    const blockNeedle = inferTimeBlockNameFromText(content);
    const targetBlock = blockNeedle
      ? snapshot.timeBlocks.find((block) => normalize(block.title).includes(blockNeedle)) || null
      : null;
    if (targetBlock?.id) {
      tools.push({ name: 'link_and_schedule', status: 'applied', summary: `Prepared link to ${targetBlock.title}` });
    } else {
      tools.push({ name: 'link_and_schedule', status: 'skipped', summary: 'No time block target resolved' });
    }
    const timeLine = scheduledAt
      ? ` at ${new Date(scheduledAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`
      : '';
    return {
      handled: true,
      text: `Ready to add "${actionTitle}"${timeLine} on ${item.title}${targetBlock ? ` and link it to ${targetBlock.title}` : ''}. Approve to apply.${ownerFieldUpdateSummary ? ` ${ownerFieldUpdateSummary}` : ''}`,
      proposals: [
        {
          id: buildProposalId('create_action', {
            item_id: item.id,
            title: actionTitle,
            scheduled_at: scheduledAt || null,
            time_block_id: targetBlock?.id || null
          }),
          type: 'create_action',
          item_id: item.id,
          title: actionTitle,
          notes: 'Created by Delta AI from item thread.',
          scheduled_at: scheduledAt || null,
          time_block_id: targetBlock?.id || null,
          lane_id: item.lane_id || null
        }
      ],
      route: 'create_work_item_action_proposal',
      tools,
      scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  const fieldAlias = detectTargetFieldAlias(userText);
  const rawValue = extractValueForField(userText, fieldAlias);
  if (!fieldAlias || !rawValue) {
    tools.push({ name: 'update_record', status: 'blocked', summary: 'Could not infer field/value from request' });
    return {
      handled: true,
      suppressInventory: true,
      text: `I found ${item.title}. Tell me what field/value to set (for example: set owner to "Rusty" or set status to "In Progress").`,
      route: 'mutation_needs_value',
      tools,
      scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  // Core item fields
  if (fieldAlias === 'title') {
    const titleUpdatePlan: MutationPlanContract = {
      idempotencyKey: buildMutationIdempotencyKey(userId, item.id, userText, 'update_title'),
      steps: [{ kind: 'update_core_item', summary: 'set title', payload: { title: rawValue } }]
    };
    if (normalize(item.title || '') === normalize(rawValue)) {
      tools.push({ name: 'idempotency', status: 'applied', summary: `No-op (${titleUpdatePlan.idempotencyKey}) title already set` });
      return {
        handled: true,
        text: `Already up to date. Title on ${item.title} is already "${rawValue}".`,
        route: 'update_record_idempotent',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    const { error } = await client.from('items').update(titleUpdatePlan.steps[0].payload).eq('id', item.id).eq('user_id', userId);
    if (error) {
      tools.push({ name: 'update_record', status: 'error', summary: error.message });
      return {
        handled: true,
        text: `I found ${item.title}, but couldn't update title (${error.message}).`,
        route: 'update_record_error',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    tools.push({ name: 'idempotency', status: 'applied', summary: titleUpdatePlan.idempotencyKey });
    tools.push({ name: 'update_record', status: 'applied', summary: 'Updated core field: title' });
    return {
      handled: true,
      text: `Saved. Updated title on ${item.title}.`,
      route: 'update_record_core',
      tools,
      scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  if (fieldAlias === 'description' || fieldAlias === 'notes' || fieldAlias === 'note') {
    const descriptionUpdatePlan: MutationPlanContract = {
      idempotencyKey: buildMutationIdempotencyKey(userId, item.id, userText, 'update_description'),
      steps: [{ kind: 'update_core_item', summary: 'set description', payload: { description: rawValue } }]
    };
    if (normalize(item.description || '') === normalize(rawValue)) {
      tools.push({ name: 'idempotency', status: 'applied', summary: `No-op (${descriptionUpdatePlan.idempotencyKey}) description already set` });
      return {
        handled: true,
        text: `Already up to date. Notes on ${item.title} already include that value.`,
        route: 'update_record_idempotent',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    const { error } = await client.from('items').update(descriptionUpdatePlan.steps[0].payload).eq('id', item.id).eq('user_id', userId);
    if (error) {
      tools.push({ name: 'update_record', status: 'error', summary: error.message });
      return {
        handled: true,
        text: `I found ${item.title}, but couldn't update description (${error.message}).`,
        route: 'update_record_error',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    tools.push({ name: 'idempotency', status: 'applied', summary: descriptionUpdatePlan.idempotencyKey });
    tools.push({ name: 'update_record', status: 'applied', summary: 'Updated core field: description' });
    return {
      handled: true,
      text: `Saved. Updated notes on ${item.title}.`,
      route: 'update_record_core',
      tools,
      scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  if (fieldAlias === 'status') {
    const statusValue = formatStatusLabel(rawValue);
    const statusUpdatePlan: MutationPlanContract = {
      idempotencyKey: buildMutationIdempotencyKey(userId, item.id, userText, 'update_status'),
      steps: [{ kind: 'update_core_item', summary: 'set status', payload: { status: statusValue } }]
    };
    if (normalize(item.status || '') === normalize(statusValue)) {
      tools.push({ name: 'idempotency', status: 'applied', summary: `No-op (${statusUpdatePlan.idempotencyKey}) status already set` });
      return {
        handled: true,
        text: `Already up to date. Status on ${item.title} is already ${statusValue}.`,
        route: 'update_record_idempotent',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    const { error } = await client.from('items').update(statusUpdatePlan.steps[0].payload).eq('id', item.id).eq('user_id', userId);
    if (error) {
      tools.push({ name: 'update_record', status: 'error', summary: error.message });
      return {
        handled: true,
        text: `I found ${item.title}, but couldn't update status (${error.message}).`,
        route: 'update_record_error',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    tools.push({ name: 'idempotency', status: 'applied', summary: statusUpdatePlan.idempotencyKey });
    tools.push({ name: 'update_record', status: 'applied', summary: `Updated core field: status=${statusValue}` });
    return {
      handled: true,
      text: `Saved. Status on ${item.title} is now ${statusValue}.`,
      route: 'update_record_core',
      tools,
      scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  const targetField = resolveFieldFromAlias(fieldsForList, fieldAlias);
  if (!targetField) {
    if (missingDataHandling.doNotBlockOnPartialData) {
      await preserveFallbackIntent(`Requested ${fieldAlias} = ${rawValue} on ${item.title}, but no matching field exists yet.`);
      return {
        handled: true,
        text: `I found ${item.title}, but this list has no "${fieldAlias}" field yet. I preserved the intent in the item context so Delta can still use it while you decide whether to add that field.`,
        route: 'update_record_field_missing_preserved',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    tools.push({ name: 'update_record', status: 'blocked', summary: `Missing field for alias: ${fieldAlias}` });
    return {
      handled: true,
      text: `I found ${item.title}, but this list has no "${fieldAlias}" field. I can save this in notes or you can add that field.`,
      route: 'update_record_field_missing',
      tools,
      scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  let upsertRow: Record<string, unknown> = {
    user_id: userId,
    item_id: item.id,
    field_id: targetField.id,
    option_id: null,
    value_text: null,
    value_number: null,
    value_date: null,
    value_boolean: null
  };

  if (targetField.type === 'text') {
    upsertRow.value_text = rawValue;
  } else if (targetField.type === 'number') {
    const parsed = Number(rawValue.replace(/,/g, ''));
    if (!Number.isFinite(parsed)) {
      if (missingDataHandling.doNotBlockOnPartialData) {
        await preserveFallbackIntent(`Requested numeric update ${targetField.name} = ${rawValue} on ${item.title}, but the value could not be parsed.`);
        return {
          handled: true,
          text: `I found ${item.title}, but "${rawValue}" is not a clean number for ${targetField.name}. I saved the intent into the item context instead of dropping it.`,
          route: 'update_record_value_preserved',
          tools,
          scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      }
      tools.push({ name: 'update_record', status: 'blocked', summary: `Invalid numeric value: ${rawValue}` });
      return {
        handled: true,
        text: `I found ${item.title}, but "${rawValue}" is not a valid number for ${targetField.name}.`,
        route: 'update_record_value_invalid',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    upsertRow.value_number = parsed;
  } else if (targetField.type === 'boolean') {
    const truthy = /^(true|yes|y|1|done|completed)$/i.test(rawValue);
    const falsy = /^(false|no|n|0|not done|pending)$/i.test(rawValue);
    if (!truthy && !falsy) {
      if (missingDataHandling.doNotBlockOnPartialData) {
        await preserveFallbackIntent(`Requested boolean update ${targetField.name} = ${rawValue} on ${item.title}, but the value could not be normalized.`);
        return {
          handled: true,
          text: `I found ${item.title}, but "${rawValue}" is not a clean yes/no value for ${targetField.name}. I preserved it in the item context instead.`,
          route: 'update_record_value_preserved',
          tools,
          scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      }
      tools.push({ name: 'update_record', status: 'blocked', summary: `Invalid boolean value: ${rawValue}` });
      return {
        handled: true,
        text: `I found ${item.title}, but "${rawValue}" is not a valid yes/no value for ${targetField.name}.`,
        route: 'update_record_value_invalid',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    upsertRow.value_boolean = truthy;
  } else if (targetField.type === 'date') {
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) {
      if (missingDataHandling.doNotBlockOnPartialData) {
        await preserveFallbackIntent(`Requested date update ${targetField.name} = ${rawValue} on ${item.title}, but the date could not be parsed.`);
        return {
          handled: true,
          text: `I found ${item.title}, but "${rawValue}" is not a clean date for ${targetField.name}. I preserved the intent in the item context instead.`,
          route: 'update_record_value_preserved',
          tools,
          scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      }
      tools.push({ name: 'update_record', status: 'blocked', summary: `Invalid date value: ${rawValue}` });
      return {
        handled: true,
        text: `I found ${item.title}, but "${rawValue}" is not a valid date for ${targetField.name}.`,
        route: 'update_record_value_invalid',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    upsertRow.value_date = date.toISOString();
  } else if (targetField.type === 'status' || targetField.type === 'select') {
    const options = snapshot.fieldOptions.filter((option) => option.field_id === targetField.id);
    const match = options.find((option) => normalize(option.label) === normalize(rawValue))
      || options.find((option) => normalize(option.label).includes(normalize(rawValue)))
      || options.find((option) => normalize(rawValue).includes(normalize(option.label)));
    if (!match) {
      if (missingDataHandling.doNotBlockOnPartialData) {
        await preserveFallbackIntent(`Requested ${targetField.name} = ${rawValue} on ${item.title}, but that option does not exist on the field.`);
        return {
          handled: true,
          text: `I found ${item.title}, but "${rawValue}" is not a valid option for ${targetField.name}. I preserved that intent in the item context so it can still inform Delta AI.`,
          route: 'update_record_option_preserved',
          tools,
          scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      }
      tools.push({ name: 'update_record', status: 'blocked', summary: `No option "${rawValue}" in ${targetField.name}` });
      return {
        handled: true,
        text: `I found ${item.title}, but "${rawValue}" is not a valid option for ${targetField.name}.`,
        route: 'update_record_option_missing',
        tools,
        scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    upsertRow.option_id = match.id;
  } else {
    upsertRow.value_text = rawValue;
  }

  const customFieldUpdatePlan: MutationPlanContract = {
    idempotencyKey: buildMutationIdempotencyKey(userId, item.id, `${targetField.id}:${rawValue}`, 'update_custom_field'),
    steps: [{ kind: 'upsert_item_field_value', summary: `set ${targetField.name}`, payload: upsertRow }]
  };
  const currentField = extractCurrentCustomFieldValue(snapshot, item.id, targetField.id);
  const nextComparable = {
    option_id: (upsertRow.option_id as string | null | undefined) ?? null,
    value_text: (upsertRow.value_text as string | null | undefined) ?? null,
    value_number: (upsertRow.value_number as number | null | undefined) ?? null,
    value_date: (upsertRow.value_date as string | null | undefined) ?? null,
    value_boolean: (upsertRow.value_boolean as boolean | null | undefined) ?? null
  };
  if (currentField && JSON.stringify(currentField) === JSON.stringify(nextComparable)) {
    tools.push({ name: 'idempotency', status: 'applied', summary: `No-op (${customFieldUpdatePlan.idempotencyKey}) field already set` });
    return {
      handled: true,
      text: `Already up to date. ${item.title} already has ${targetField.name} set to "${rawValue}".`,
      route: 'update_record_idempotent',
      tools,
      scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  const { error } = await client
    .from('item_field_values')
    .upsert(customFieldUpdatePlan.steps[0].payload, { onConflict: 'item_id,field_id' });
  if (error) {
    tools.push({ name: 'update_record', status: 'error', summary: error.message });
    return {
      handled: true,
      text: `I found ${item.title}, but couldn't update ${targetField.name} (${error.message}).`,
      route: 'update_record_error',
      tools,
      scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  tools.push({ name: 'idempotency', status: 'applied', summary: customFieldUpdatePlan.idempotencyKey });
  tools.push({ name: 'update_record', status: 'applied', summary: `Updated custom field: ${targetField.name}` });
  return {
    handled: true,
    text: `Saved. ${item.title} now has ${targetField.name} set to "${rawValue}".`,
    route: 'update_record_field',
    tools,
    scopeLabels: { focal: itemList?.focalName || undefined, list: itemList?.name || undefined },
    confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
  };
};

const buildDeterministicAnswer = (
  userText: string,
  snapshot: AccountContextSnapshot,
  context: ChatContext,
  messages: ChatMessage[]
): DeterministicResponse | null => {
  const intent = detectIntent(userText);
  const focalNameById = new Map(snapshot.focals.map((f) => [f.id, f.name]));
  const listsWithResolvedFocal = snapshot.lists.map((list) => ({
    ...list,
    focalName: list.focal_id ? focalNameById.get(list.focal_id) || null : null
  }));
  const entities = resolveEntities(userText, snapshot, context, messages);
  const focalName = entities.focal.id ? focalNameById.get(entities.focal.id) || undefined : undefined;
  const resolvedList = entities.list.id
    ? listsWithResolvedFocal.find((list) => list.id === entities.list.id) || null
    : null;
  const itemMatch = resolveItemIdFromQuestion(userText, snapshot, context.item_id, resolvedList?.id || null);
  const resolvedItem = itemMatch.itemId ? snapshot.items.find((item) => item.id === itemMatch.itemId) || null : null;

  if (entities.focal.fromPrior && entities.focal.confidence < 0.8 && focalName) {
    return {
      text: `I think you mean the space "${focalName}". Confirm and I’ll continue with that scope.`,
      route: intent,
      scopeLabels: { focal: focalName },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }
  if (entities.list.fromPrior && entities.list.confidence < 0.8 && resolvedList) {
    return {
      text: `I think you mean the list "${resolvedList.name}"${resolvedList.focalName ? ` in ${resolvedList.focalName}` : ''}. Confirm and I’ll continue with that scope.`,
      route: intent,
      scopeLabels: { focal: resolvedList.focalName || focalName, list: resolvedList.name },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  if (entities.focal.ambiguous) {
    return {
      text: 'I found multiple spaces matching that name. Please specify which space you mean.',
      route: intent,
      scopeLabels: {},
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }
  if (entities.list.ambiguous) {
    return {
      text: 'I found multiple lists matching that name. Please specify which list you mean.',
      route: intent,
      scopeLabels: { focal: focalName },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  const createTarget = detectCreateTarget(userText);
  if (createTarget) {
    const title = extractTitleCandidate(userText);
    if (createTarget === 'focal') {
      if (!title) {
        return {
          text: 'I can create a space. Tell me the space name (for example: create space called "Health 2").',
          route: intent,
          scopeLabels: {},
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
          proposals: []
        };
      }
      return {
        text: `Ready to create space "${title}". Approve to apply.`,
        route: intent,
        scopeLabels: {},
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
        proposals: [{ id: crypto.randomUUID(), type: 'create_focal', title }]
      };
    }

    if (createTarget === 'list') {
      if (!entities.focal.id) {
        return {
          text: 'I can create a list, but I need the space scope. Example: create list "Meal Prep" in Health.',
          route: intent,
          scopeLabels: {},
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
          proposals: []
        };
      }
      if (!title) {
        return {
          text: 'I can create a list. Tell me the list name (for example: create list called "Meal Prep" in Health).',
          route: intent,
          scopeLabels: { focal: focalName },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
          proposals: []
        };
      }
      return {
        text: `Ready to create list "${title}" in ${focalName || 'selected space'}. Approve to apply.`,
        route: intent,
        scopeLabels: { focal: focalName },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
        proposals: [{ id: crypto.randomUUID(), type: 'create_list', title, focal_id: entities.focal.id }]
      };
    }

    if (createTarget === 'item') {
      if (!resolvedList?.id) {
        return {
          text: 'I can create an item, but I need the list scope. Example: add item "Tuesday Back & Biceps" in Workouts.',
          route: intent,
          scopeLabels: { focal: focalName },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
          proposals: []
        };
      }
      if (!title) {
        return {
          text: 'I can create an item. Tell me the item name (for example: add item called "Tuesday Back & Biceps").',
          route: intent,
          scopeLabels: { focal: resolvedList?.focalName || focalName, list: resolvedList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
          proposals: []
        };
      }
      return {
        text: `Ready to create item "${title}" in ${resolvedList.name}. Approve to apply.`,
        route: intent,
        scopeLabels: { focal: resolvedList?.focalName || focalName, list: resolvedList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
        proposals: [{ id: crypto.randomUUID(), type: 'create_item', title, list_id: resolvedList.id }]
      };
    }

    if (createTarget === 'action') {
      const item = context.item_id ? snapshot.items.find((entry) => entry.id === context.item_id) : null;
      if (!item?.id) {
        return {
          text: 'I can create a sub-item/action when an item is selected in context.',
          route: intent,
          scopeLabels: { focal: focalName, list: resolvedList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
          proposals: []
        };
      }
      if (!title) {
        return {
          text: 'I can create a sub-item/action. Tell me the action name.',
          route: intent,
          scopeLabels: { focal: focalName, list: resolvedList?.name || undefined },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
          proposals: []
        };
      }
      return {
        text: `Ready to create action "${title}" for ${item.title}. Approve to apply.`,
        route: intent,
        scopeLabels: { focal: focalName, list: resolvedList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
        proposals: [{ id: crypto.randomUUID(), type: 'create_action', title, item_id: item.id }]
      };
    }
  }

  if (intent === 'list_items') {
    if (!resolvedList) {
      return {
        text: 'I can read list items, but I need the list name (for example: "items in Workouts list").',
        route: intent,
        scopeLabels: { focal: focalName },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    const scopedItems = snapshot.items.filter((item) => item.lane_id === resolvedList.id);
    if (scopedItems.length === 0) {
      return {
        text: `The list "${resolvedList.name}" currently has no items.`,
        route: intent,
        scopeLabels: { focal: resolvedList.focalName || focalName, list: resolvedList.name },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    return {
      text: `Items in ${resolvedList.name}${resolvedList.focalName ? ` (${resolvedList.focalName})` : ''}:\n${formatNameList(scopedItems.slice(0, 50).map((item) => item.title))}`,
      route: intent,
      scopeLabels: { focal: resolvedList.focalName || focalName, list: resolvedList.name },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  if (intent === 'field_inventory') {
    const targetList = resolvedList || (context.list_id ? listsWithResolvedFocal.find((entry) => entry.id === context.list_id) || null : null);
    if (!targetList) {
      return {
        text: 'I can list fields, but I need the list scope. Example: "what fields are on Workouts?"',
        route: intent,
        scopeLabels: { focal: focalName },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    const fields = snapshot.fields.filter((field) => field.list_id === targetList.id);
    if (fields.length === 0) {
      return {
        text: `The list "${targetList.name}" has no custom fields yet.`,
        route: intent,
        scopeLabels: { focal: targetList.focalName || focalName, list: targetList.name },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    const rows = fields.map((field) => `${field.name} (${field.type})`);
    return {
      text: `Fields on ${targetList.name}${targetList.focalName ? ` (${targetList.focalName})` : ''}:\n${formatNameList(rows)}`,
      route: intent,
      scopeLabels: { focal: targetList.focalName || focalName, list: targetList.name },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  if (intent === 'item_next_step') {
    if (!resolvedItem) {
      return {
        text: 'I can recommend a next step, but I need the item name (for example: "next step for Lake Effect").',
        route: intent,
        scopeLabels: { focal: focalName, list: resolvedList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    const owningList = resolvedItem.lane_id ? listsWithResolvedFocal.find((entry) => entry.id === resolvedItem.lane_id) || null : null;
    const fields = snapshot.fields.filter((field) => field.list_id === resolvedItem.lane_id);
    const statusField = fields.find((field) => field.type === 'status' && field.is_primary) || fields.find((field) => field.type === 'status');
    const dateField = fields.find((field) => field.type === 'date' && /follow|next|due|touch/i.test(field.name));
    const values = snapshot.itemFieldValues.filter((value) => value.item_id === resolvedItem.id);
    const statusValue = statusField ? values.find((value) => value.field_id === statusField.id) : null;
    const statusOption = statusValue?.option_id
      ? snapshot.fieldOptions.find((option) => option.id === statusValue.option_id) || null
      : null;
    const dateValue = dateField ? values.find((value) => value.field_id === dateField.id)?.value_date || null : null;
    const latestComment = snapshot.itemComments
      .filter((comment) => comment.item_id === resolvedItem.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    const bullets = [
      `Current status: ${statusOption?.label || resolvedItem.status || 'Unknown'}`,
      `Next follow-up: ${dateValue ? new Date(dateValue).toLocaleDateString() : 'Not set'}`,
      `Last touch: ${latestComment?.body ? clip(latestComment.body, 120) : 'No comment history yet'}`
    ];
    const recommendation = dateValue
      ? 'Recommended next action: complete the scheduled follow-up and log outcome.'
      : 'Recommended next action: add a follow-up date field value and create a concrete next action.';
    const proposals: ChatProposal[] = dateValue
      ? []
      : [
          {
            id: crypto.randomUUID(),
            type: 'create_follow_up_action',
            title: `Follow up with ${resolvedItem.title}`,
            item_id: resolvedItem.id,
            notes: latestComment?.body ? `Context: ${clip(latestComment.body, 120)}` : null
          }
        ];
    return {
      text: `${resolvedItem.title}:\n${formatNameList(bullets)}\n\n${recommendation}`,
      route: intent,
      scopeLabels: { focal: owningList?.focalName || focalName, list: owningList?.name || resolvedList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
      proposals
    };
  }

  if (intent === 'list_inventory') {
    const allLists = listsWithResolvedFocal;
    const scopedLists = entities.focal.id
      ? allLists.filter((list) => list.focal_id === entities.focal.id)
      : allLists;
    if (scopedLists.length === 0) {
      if (entities.focal.id && allLists.length > 0) {
        return {
          text: 'I could not find matching lists for that space scope. Try clearing scope or specifying a different space.',
          route: intent,
          scopeLabels: { focal: focalName },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
        };
      }
      return {
        text: 'You currently have no lists.',
        route: intent,
        scopeLabels: {},
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    const names = scopedLists.map((list) =>
      list.focalName ? `${list.name} (${list.focalName})` : list.name
    );
    return {
      text: `You currently have ${scopedLists.length} list(s):\n${formatNameList(names)}`,
      route: intent,
      scopeLabels: { focal: focalName },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  if (intent === 'focal_inventory') {
    if (snapshot.focals.length === 0) {
      return {
        text: 'You currently have no spaces.',
        route: intent,
        scopeLabels: {},
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    return {
      text: `You currently have ${snapshot.focals.length} space(s):\n${formatNameList(snapshot.focals.map((f) => f.name))}`,
      route: intent,
      scopeLabels: {},
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  if (intent === 'action_inventory') {
    if (snapshot.actions.length === 0) {
      return {
        text: 'You currently have no actions in scope.',
        route: intent,
        scopeLabels: { focal: focalName, list: resolvedList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    return {
      text: `You currently have ${snapshot.actions.length} action(s) in scope:\n${formatNameList(snapshot.actions.slice(0, 50).map((action) => action.title))}`,
      route: intent,
      scopeLabels: { focal: focalName, list: resolvedList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  if (intent === 'timeblock_inventory') {
    if (snapshot.timeBlocks.length === 0) {
      return {
        text: 'You currently have no time blocks in scope.',
        route: intent,
        scopeLabels: { focal: focalName, list: resolvedList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    const rows = snapshot.timeBlocks.slice(0, 24).map((tb) => `${tb.title} (${tb.start_time} → ${tb.end_time})`);
    return {
      text: `You currently have ${snapshot.timeBlocks.length} time block(s) in scope:\n${formatNameList(rows)}`,
      route: intent,
      scopeLabels: { focal: focalName, list: resolvedList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  if (intent === 'item_inventory') {
    if (snapshot.items.length === 0) {
      return {
        text: 'You currently have no items in scope.',
        route: intent,
        scopeLabels: { focal: focalName, list: resolvedList?.name || undefined },
        confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
      };
    }
    return {
      text: `You currently have ${snapshot.items.length} item(s) in scope:\n${formatNameList(snapshot.items.slice(0, 50).map((item) => item.title))}`,
      route: intent,
      scopeLabels: { focal: focalName, list: resolvedList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
    };
  }

  return null;
};

const friendlyContextLine = (context: ChatContext, snapshot: AccountContextSnapshot | null): string => {
  if (!snapshot) return '';
  const focal = context.focal_id ? snapshot.focals.find((f) => f.id === context.focal_id) : null;
  const list = context.list_id ? snapshot.lists.find((l) => l.id === context.list_id) : null;
  const item = context.item_id ? snapshot.items.find((i) => i.id === context.item_id) : null;
  const action = context.action_id ? snapshot.actions.find((a) => a.id === context.action_id) : null;
  const parts = [
    context.node_name ? `Node=${context.node_name}${context.node_mode ? `(${context.node_mode})` : ''}` : null,
    focal ? `Space=${focal.name}` : null,
    list ? `List=${list.name}` : null,
    item ? `Item=${item.title}` : null,
    action ? `Action=${action.title}` : null,
    context.time_block_id ? 'TimeBlock=active' : null
  ].filter(Boolean);
  return parts.join(', ');
};

const buildNodeSystemPrompts = (context: ChatContext): string[] => {
  const definition = resolveRuntimeNodePrompts(
    context.node_id,
    context.node_setup_logic,
    context.node_operate_logic
  );
  if (!definition) return [];
  const prompts = context.node_mode === 'setup'
    ? [definition.setupPrompt]
    : [definition.operatePrompt];
  if (context.node_structure_blueprint?.trim()) {
    prompts.push(`Node structure blueprint: ${context.node_structure_blueprint.trim()}`);
  }
  if (context.node_structure_config && Object.keys(context.node_structure_config).length > 0) {
    prompts.push(`Node structured config: ${JSON.stringify(context.node_structure_config)}`);
  }
  return prompts;
};

const extractNodeBehaviorPolicy = (context: ChatContext): Record<string, unknown> | null => {
  if (!context.node_structure_config || typeof context.node_structure_config !== 'object') return null;
  const behavior =
    typeof context.node_structure_config.behavior === 'object' && context.node_structure_config.behavior
      ? (context.node_structure_config.behavior as Record<string, unknown>)
      : null;
  const dataPolicy =
    typeof context.node_structure_config.dataPolicy === 'object' && context.node_structure_config.dataPolicy
      ? (context.node_structure_config.dataPolicy as Record<string, unknown>)
      : null;
  if (!behavior && !dataPolicy) return null;
  return {
    action_priority_rules: Array.isArray(behavior?.actionPriorityRules) ? behavior?.actionPriorityRules : [],
    primary_operating_modes: Array.isArray(behavior?.primaryOperatingModes) ? behavior?.primaryOperatingModes : [],
    scheduling_behavior: Array.isArray(behavior?.schedulingBehavior) ? behavior?.schedulingBehavior : [],
    activity_logging_behavior: Array.isArray(behavior?.activityLoggingBehavior) ? behavior?.activityLoggingBehavior : [],
    missing_data_handling:
      typeof behavior?.missingDataHandling === 'object' && behavior?.missingDataHandling
        ? behavior.missingDataHandling
        : null,
    setup_wizard_rules:
      typeof behavior?.setupWizardRules === 'object' && behavior?.setupWizardRules
        ? behavior.setupWizardRules
        : null,
    automation_rules: Array.isArray(behavior?.automationRules) ? behavior?.automationRules : [],
    required_data_rules: Array.isArray(dataPolicy?.requiredFields) ? dataPolicy?.requiredFields : [],
    optional_data_rules: Array.isArray(dataPolicy?.optionalFields) ? dataPolicy?.optionalFields : []
  };
};

const extractMissingDataHandling = (
  context: ChatContext
): {
  doNotBlockOnPartialData: boolean;
  buildFromBestAvailableData: boolean;
  surfaceHighValueGapsInBatches: boolean;
  avoidItemByItemNagging: boolean;
} => {
  const behavior =
    typeof context.node_structure_config?.behavior === 'object' && context.node_structure_config?.behavior
      ? (context.node_structure_config.behavior as Record<string, unknown>)
      : null;
  const missing =
    typeof behavior?.missingDataHandling === 'object' && behavior?.missingDataHandling
      ? (behavior.missingDataHandling as Record<string, unknown>)
      : null;
  return {
    doNotBlockOnPartialData: missing?.doNotBlockOnPartialData !== false,
    buildFromBestAvailableData: missing?.buildFromBestAvailableData !== false,
    surfaceHighValueGapsInBatches: missing?.surfaceHighValueGapsInBatches !== false,
    avoidItemByItemNagging: missing?.avoidItemByItemNagging !== false
  };
};

const redactUuids = (text: string): string =>
  text.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    '[id-hidden]'
  );

const stabilizeAssistantText = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (/[.!?]$/.test(trimmed)) return trimmed;
  const matches = [...trimmed.matchAll(/[.!?](?=\s|$)/g)];
  const last = matches[matches.length - 1];
  if (last && typeof last.index === 'number' && last.index >= Math.floor(trimmed.length * 0.55)) {
    return trimmed.slice(0, last.index + 1).trim();
  }
  return `${trimmed}…`;
};

const insertTimeBlock = async (
  client: ReturnType<typeof createClient>,
  userId: string,
  payload: {
    title: string;
    description?: string | null;
    startUtc: string;
    endUtc: string;
    tags?: string[] | null;
  }
): Promise<{ id: string; title: string; start_time: string; end_time: string }> => {
  const { data, error } = await client
    .from('time_blocks')
    .insert({
      user_id: userId,
      title: payload.title,
      description: payload.description || '',
      start_time: payload.startUtc,
      end_time: payload.endUtc,
      recurrence_rule: 'none',
      recurrence_config: null,
      include_weekends: true,
      timezone: 'America/Denver',
      tags: Array.isArray(payload.tags) ? payload.tags : []
    })
    .select('id,title,start_time,end_time')
    .single();
  if (error) throw error;
  return data;
};

const buildDebugMeta = (
  requestId: string,
  context: ChatContext,
  snapshot: AccountContextSnapshot | null,
  source: DebugMeta['source'],
  route?: string,
  scopeLabels?: { focal?: string; list?: string },
  confidence?: { focal?: number; list?: number },
  warnings?: string[],
  tools?: DebugMeta['tools']
): DebugMeta => ({
  source,
  request_id: requestId,
  route,
  scope: {
    mode:
      context.focal_id || context.list_id || context.item_id || context.action_id || context.time_block_id
        ? 'scoped'
        : 'global',
    ...(context.node_name ? { node: context.node_name } : {}),
    ...(scopeLabels?.focal ? { focal: scopeLabels.focal } : {}),
    ...(scopeLabels?.list ? { list: scopeLabels.list } : {}),
    ...(context.item_id ? { item: 'active' } : {}),
    ...(context.action_id ? { action: 'active' } : {}),
    ...(context.time_block_id ? { time_block: 'active' } : {})
  },
  confidence,
  counts: snapshot
    ? {
        focals: snapshot.focals.length,
        lists: snapshot.lists.length,
        items: snapshot.items.length,
        actions: snapshot.actions.length,
        timeBlocks: snapshot.timeBlocks.length
      }
    : undefined,
  warnings,
  tools
});

const heuristic = (messages: ChatMessage[], context?: ChatContext) => {
  const lastUser = [...messages].reverse().find((entry) => entry.role === 'user');
  const content = (lastUser?.content || '').trim();
  const compact = content.length > 220 ? `${content.slice(0, 220)}…` : content;
  const wantsFollowUp = /\b(follow[- ]?up|next step|remind|action)\b/i.test(content);
  const proposals = context?.item_id && wantsFollowUp
    ? [
        {
          id: crypto.randomUUID(),
          type: 'create_follow_up_action',
          title: 'Follow up',
          item_id: context.item_id,
          notes: compact || null
        }
      ]
    : [];

  return {
    text: compact
      ? `I captured your note: "${compact}". I can draft next actions once account context is available.`
      : 'I captured your note. Ask for a next action, or specify a space/list/item.',
    source: 'heuristic',
    proposals,
    debug_reason: 'heuristic_fallback'
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestId = crypto.randomUUID();
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const hasAiProviders = hasConfiguredAiProviders();
    const aiProviderStatus = getAiProviderStatus();
    console.log(`[chat:${requestId}] inbound request`);
    console.log(`[chat:${requestId}] provider status`, aiProviderStatus);
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error(`[chat:${requestId}] missing Supabase env`);
      return new Response(JSON.stringify({ error: 'Supabase env missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get('Authorization');
    const bearerToken = extractBearerTokenFromHeaders(req);

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} }
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(
      bearerToken || undefined
    );
    let userId = userData?.user?.id ?? null;
    let authMode: 'getUser' | 'getClaims' | 'jwt_sub_fallback' | 'gateway_header_fallback' | 'none' = userId
      ? 'getUser'
      : 'none';

    if (!userId) {
      const { data: claimsData, error: claimsError } = bearerToken
        ? await authClient.auth.getClaims(bearerToken)
        : { data: null, error: null };
      const subject = claimsData?.claims?.sub;
      if (typeof subject === 'string' && subject.length > 0) {
        userId = subject;
        authMode = 'getClaims';
      } else {
        const jwtPayload = bearerToken ? decodeJwtPayload(bearerToken) : null;
        const jwtSub = typeof jwtPayload?.sub === 'string' ? jwtPayload.sub : null;
        const jwtRole = typeof jwtPayload?.role === 'string' ? jwtPayload.role : null;
        if (jwtSub && (jwtRole === 'authenticated' || jwtRole === 'anon')) {
          userId = jwtSub;
          authMode = 'jwt_sub_fallback';
        } else {
          const gatewayUserId = extractUserIdFromGatewayHeaders(req);
          if (gatewayUserId) {
            userId = gatewayUserId;
            authMode = 'gateway_header_fallback';
          } else {
            console.warn(`[chat:${requestId}] unauthorized`, {
              getUserMessage: userError?.message ?? null,
              getUserStatus: userError?.status ?? null,
              getClaimsMessage: claimsError?.message ?? null,
              hasClaimsSub: Boolean(subject),
              hasJwtSub: Boolean(jwtSub),
              jwtRole,
              hasAuthHeader: Boolean(authHeader),
              hasBearerToken: Boolean(bearerToken),
              gatewayAuthUser: req.headers.get('x-supabase-auth-user') || null,
              tokenPrefix: bearerToken ? bearerToken.slice(0, 12) : null
            });
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      }
    }
    console.log(`[chat:${requestId}] auth ok`, { mode: authMode, userIdPrefix: userId.slice(0, 8) });

    const payload = await req.json().catch(() => ({})) as {
      messages?: ChatMessage[];
      context?: ChatContext;
      mode?: 'ai' | 'memo';
    };
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const context = payload.context || {};
    const lastUserMessage = getLastUserMessage(messages);
    const fallbackPlan = buildMessagePlan(lastUserMessage);
    let messagePlan = fallbackPlan;
    let accountSnapshot: AccountContextSnapshot | null = null;
    let snapshotWarnings: string[] = [];
    let accountSnapshotError: string | null = null;
    try {
      const builtSnapshot = await buildAccountContextSnapshot(authClient, userId, context);
      accountSnapshot = builtSnapshot.snapshot;
      snapshotWarnings = builtSnapshot.warnings;
      console.log(`[chat:${requestId}] context snapshot`, {
        focals: accountSnapshot.focals.length,
        lists: accountSnapshot.lists.length,
        items: accountSnapshot.items.length,
        actions: accountSnapshot.actions.length,
        timeBlocks: accountSnapshot.timeBlocks.length
      });
    } catch (contextError) {
      console.warn(`[chat:${requestId}] context snapshot failed`, contextError);
      accountSnapshotError = contextError instanceof Error ? contextError.message : String(contextError);
    }

    if (hasAiProviders && lastUserMessage) {
      try {
        // Use AI gateway for provider-agnostic completion
        const completion = await aiGateway.createCompletion({
          messages: [{ role: 'user', content: lastUserMessage }],
          responseFormat: 'json_object',
          modelProfile: 'delta-classifier'
        }, requestId);
        
        if (completion.fallbackOccurred) {
          console.warn(`[chat:${requestId}] AI fallback occurred`, {
            provider: completion.providerUsed,
            model: completion.modelUsed
          });
        }
        
        if (completion.content) {
          try {
            const parsed = JSON.parse(completion.content);
            messagePlan = {
              mode: parsed.mode || 'inform',
              confidence: parsed.confidence || 0.5,
              explicitInventoryAsk: parsed.explicitInventoryAsk || false,
              mutationRequested: parsed.mutationRequested || false,
              ambiguousAction: parsed.ambiguousAction || false,
              proposals: []
            };
          } catch {
            // If JSON parsing fails, treat as inform mode
            messagePlan = {
              mode: 'inform',
              confidence: 0.3,
              explicitInventoryAsk: false,
              mutationRequested: false,
              ambiguousAction: false,
              proposals: []
            };
          }
        } else {
          messagePlan = fallbackPlan;
        }
      } catch {
        messagePlan = fallbackPlan;
      }
    }
    const asksAccountData =
      shouldAnswerDeterministically(lastUserMessage) ||
      messagePlan.explicitInventoryAsk ||
      messagePlan.mutationRequested;

    if (asksAccountData && !accountSnapshot) {
      return new Response(
        JSON.stringify({
          text: 'I could not read your account data right now, so I cannot answer that reliably yet.',
          source: 'heuristic',
          proposals: [],
          debug_reason: 'account_snapshot_unavailable',
          debug_error: accountSnapshotError,
          debug_meta: buildDebugMeta(requestId, context, accountSnapshot, 'heuristic', 'account_snapshot_unavailable', undefined, undefined, snapshotWarnings)
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (accountSnapshot) {
      const mutationResult = await runMutationTools(authClient, userId, lastUserMessage, accountSnapshot, context, messages, messagePlan);
      if (mutationResult.handled && mutationResult.text) {
        console.log(`[chat:${requestId}] mutation tool answer`, { route: mutationResult.route, tools: mutationResult.tools });
        return new Response(
          JSON.stringify({
            text: mutationResult.text,
            source: 'ai',
            proposals: mutationResult.proposals || [],
            debug_reason: mutationResult.route || 'mutation_tool_answer',
            debug_model: 'none',
            debug_meta: buildDebugMeta(
              requestId,
              context,
              accountSnapshot,
              'db',
              mutationResult.route || 'mutation_tool_answer',
              mutationResult.scopeLabels,
              mutationResult.confidence,
              snapshotWarnings,
              mutationResult.tools
            )
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (messagePlan.mutationRequested && mutationResult.suppressInventory !== false) {
        return new Response(
          JSON.stringify({
            text: 'I treated that as an update request, but I need one more detail to apply it safely.',
            source: 'ai',
            proposals: [],
            debug_reason: 'mutation_guard_no_inventory_fallback',
            debug_model: 'none',
            debug_meta: buildDebugMeta(
              requestId,
              context,
              accountSnapshot,
              'db',
              'mutation_guard_no_inventory_fallback',
              mutationResult.scopeLabels,
              mutationResult.confidence,
              snapshotWarnings,
              mutationResult.tools
            )
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (accountSnapshot && detectTaskSuggestionsForBlockIntent(lastUserMessage)) {
      const focalNameById = new Map(accountSnapshot.focals.map((entry) => [entry.id, entry.name]));
      const planningContract = buildPlanningActionContract(lastUserMessage, accountSnapshot, context, messages);
      const missingDataHandling = extractMissingDataHandling(context);
      const {
        planningDate,
        planningTimezone,
        excludedStatusLabel,
        resolvedFocalId,
        resolvedListId,
        scopedLists,
        candidateItems,
        dayBlocks,
        targetBlock,
        targetBlockNeedle,
        focalEntities
      } = planningContract;
      const fullyQualifiedCandidates = candidateItems.filter((entry) => entry.missingCriticalFields.length === 0);
      const planningCandidates =
        missingDataHandling.doNotBlockOnPartialData || missingDataHandling.buildFromBestAvailableData
          ? candidateItems
          : fullyQualifiedCandidates;
      const topMissingFieldCounts = new Map<string, number>();
      candidateItems.forEach((entry) => {
        entry.missingCriticalFields.forEach((fieldName) => {
          topMissingFieldCounts.set(fieldName, (topMissingFieldCounts.get(fieldName) || 0) + 1);
        });
      });
      const highValueGapSummary = [...topMissingFieldCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([fieldName, count]) => `${fieldName} (${count})`)
        .join(', ');

      if (planningCandidates.length === 0) {
        return new Response(
          JSON.stringify({
            text: excludedStatusLabel
              ? `I checked ${resolvedFocalId ? focalNameById.get(resolvedFocalId) || 'that space' : 'your workspace'}, and after excluding "${excludedStatusLabel}" there are no matching items to plan from.`
              : highValueGapSummary
                ? `I found matching items, but the node policy says not to plan from records missing critical data yet. Highest-value gaps: ${highValueGapSummary}.`
                : 'I could not find matching items to plan from in that scope.',
            source: 'ai',
            proposals: [],
            debug_reason: 'task_suggestions_no_candidates',
            debug_model: 'none',
            debug_meta: buildDebugMeta(
              requestId,
              context,
              accountSnapshot,
              'db',
              'task_suggestions_no_candidates',
              {
                focal: resolvedFocalId ? focalNameById.get(resolvedFocalId) || undefined : undefined,
                list: resolvedListId ? scopedLists.find((entry) => entry.id === resolvedListId)?.name || undefined : undefined
              },
              { focal: focalEntities.focal.confidence, list: focalEntities.list.confidence },
              snapshotWarnings
            )
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (!targetBlock && planningDate) {
        const blockTitle = buildNamedTimeBlockTitle(targetBlockNeedle, lastUserMessage, dayBlocks, context);
        const startUtc = zonedLocalToUtcIso(planningDate.year, planningDate.month, planningDate.day, 9, 0, planningTimezone);
        const endUtc = zonedLocalToUtcIso(planningDate.year, planningDate.month, planningDate.day, 10, 0, planningTimezone);
        const humanDate = new Date(startUtc).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        });
        const hadAnyBlocks = dayBlocks.length > 0;
        return new Response(
          JSON.stringify({
            text: hadAnyBlocks
              ? `You do not have a "${blockTitle}" block on ${humanDate}. I can create one first, then we can queue the prospecting tasks into it.`
              : `You do not have any time blocks on ${humanDate} yet. I can create a "${blockTitle}" block first, then we can queue the prospecting tasks into it.`,
            source: 'ai',
            proposals: [
              {
                id: crypto.randomUUID(),
                type: 'create_time_block',
                title: blockTitle,
                scheduled_start_utc: startUtc,
                scheduled_end_utc: endUtc,
                notes: `Created from planning request for ${humanDate}.`,
                follow_up_request: lastUserMessage,
                follow_up_context: {
                  ...context,
                  planning_date: `${planningDate.year}-${String(planningDate.month).padStart(2, '0')}-${String(planningDate.day).padStart(2, '0')}`,
                  planning_timezone: planningTimezone
                }
              }
            ],
            debug_reason: 'task_suggestions_missing_target_block',
            debug_model: 'none',
            debug_meta: buildDebugMeta(
              requestId,
              context,
              accountSnapshot,
              'db',
              'task_suggestions_missing_target_block',
              {
                focal: resolvedFocalId ? focalNameById.get(resolvedFocalId) || undefined : undefined,
                list: resolvedListId ? scopedLists.find((entry) => entry.id === resolvedListId)?.name || undefined : undefined
              },
              { focal: focalEntities.focal.confidence, list: focalEntities.list.confidence },
              snapshotWarnings
            )
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (hasAiProviders && targetBlock) {
        try {
          const nodePrompts = buildNodeSystemPrompts(context);
          const nodeBehaviorPolicy = extractNodeBehaviorPolicy(context);
          const suggestionCompletion = await aiGateway.createCompletion(
            {
              messages: [
                ...nodePrompts.map((prompt) => ({ role: 'system' as const, content: prompt })),
                {
                  role: 'system',
                  content:
                    'Return JSON only. Suggest concrete app-native tasks for a target time block. Shape: {"reply_text": string, "proposals": Array<{item_id: string, title: string, notes?: string}>}. Choose 1 to 5 tasks. Use only the provided candidate item ids. Prefer concise, executable task titles.'
                },
                {
                  role: 'user',
                  content: JSON.stringify({
                    request: lastUserMessage,
                    excluded_status: excludedStatusLabel || null,
                    target_block: {
                      id: targetBlock.id,
                      title: targetBlock.title,
                      start_time: targetBlock.start_time,
                      end_time: targetBlock.end_time
                    },
                    scope: {
                      focal_id: resolvedFocalId,
                      focal_name: resolvedFocalId ? focalNameById.get(resolvedFocalId) || null : null,
                      list_id: resolvedListId,
                      list_name: resolvedListId ? scopedLists.find((entry) => entry.id === resolvedListId)?.name || null : null
                    },
                    node_planning_policy: {
                      default_task_placement:
                        typeof context.node_structure_config?.planning === 'object' &&
                        context.node_structure_config?.planning &&
                        'defaultTaskPlacement' in (context.node_structure_config.planning as Record<string, unknown>)
                          ? (context.node_structure_config.planning as Record<string, unknown>).defaultTaskPlacement || null
                          : null,
                      use_location_for_day_planning:
                        typeof context.node_structure_config?.planning === 'object' &&
                        context.node_structure_config?.planning &&
                        'useLocationForDayPlanning' in (context.node_structure_config.planning as Record<string, unknown>)
                          ? Boolean((context.node_structure_config.planning as Record<string, unknown>).useLocationForDayPlanning)
                          : false,
                      location_field_name:
                        typeof context.node_structure_config?.planning === 'object' &&
                        context.node_structure_config?.planning &&
                        'locationFieldName' in (context.node_structure_config.planning as Record<string, unknown>)
                          ? ((context.node_structure_config.planning as Record<string, unknown>).locationFieldName as string) || null
                          : null,
                      behavior_policy: nodeBehaviorPolicy
                    },
                    candidate_items: planningCandidates.slice(0, 24).map((entry) => ({
                      item_id: entry.item.id,
                      title: entry.item.title,
                      list_name: entry.list?.name || null,
                      status: entry.statusLabel || null,
                      latest_comment: entry.latestComment?.body || null,
                      current_context_signal: entry.item.signal_label || null,
                      current_context_confidence: entry.item.signal_score ?? null,
                      planning_score: entry.score,
                      missing_critical_fields: entry.missingCriticalFields
                    }))
                  })
                }
              ],
              responseFormat: 'json_object',
              modelProfile: 'delta-general',
              maxTokens: 1200
            },
            requestId
          );

          if (suggestionCompletion.content) {
            const parsed = JSON.parse(suggestionCompletion.content) as {
              reply_text?: string;
              proposals?: Array<{
                item_id?: string;
                title?: string;
                notes?: string | null;
              }>;
            };

            const scopedItemIds = new Set(candidateItems.map((entry) => entry.item.id));
            const proposals: ChatProposal[] = Array.isArray(parsed.proposals)
              ? parsed.proposals
                  .filter(
                    (proposal) =>
                      typeof proposal?.item_id === 'string' &&
                      scopedItemIds.has(proposal.item_id) &&
                      typeof proposal?.title === 'string' &&
                      proposal.title.trim().length > 0
                  )
                  .slice(0, 5)
                  .map((proposal) => {
                    const item = candidateItems.find((entry) => entry.item.id === proposal.item_id)?.item || null;
                    return {
                      id: buildProposalId('create_action', {
                        item_id: proposal.item_id!,
                        title: proposal.title!.trim(),
                        scheduled_at: targetBlock.start_time,
                        time_block_id: targetBlock.id
                      }),
                      type: 'create_action' as const,
                      item_id: proposal.item_id!,
                      title: proposal.title!.trim(),
                      notes: typeof proposal.notes === 'string' ? proposal.notes : null,
                      scheduled_at: targetBlock.start_time,
                      time_block_id: targetBlock.id,
                      lane_id: item?.lane_id || null
                    };
                  })
              : [];

            if (proposals.length > 0) {
              return new Response(
                JSON.stringify({
                  text:
                    (typeof parsed.reply_text === 'string' && parsed.reply_text.trim()) ||
                    `I pulled together a focused set of tasks for "${targetBlock.title}". Review the drafts and push the ones you want.${highValueGapSummary && missingDataHandling.surfaceHighValueGapsInBatches ? ` Highest-value missing data to clean up soon: ${highValueGapSummary}.` : ''}`,
                  source: 'ai',
                  proposals,
                  debug_reason: 'task_suggestions_for_target_block',
                  debug_model: suggestionCompletion.modelUsed || null,
                  debug_meta: buildDebugMeta(
                    requestId,
                    context,
                    accountSnapshot,
                    'llm',
                    'task_suggestions_for_target_block',
                    {
                      focal: resolvedFocalId ? focalNameById.get(resolvedFocalId) || undefined : undefined,
                      list: resolvedListId ? scopedLists.find((entry) => entry.id === resolvedListId)?.name || undefined : undefined
                    },
                    { focal: focalEntities.focal.confidence, list: focalEntities.list.confidence },
                    snapshotWarnings
                  )
                }),
                {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }
          }
        } catch (taskPlanningError) {
          console.warn(`[chat:${requestId}] task suggestion planning failed`, taskPlanningError);
        }
      }
    }

    if (accountSnapshot && (asksAccountData || messagePlan.explicitInventoryAsk)) {
      const deterministic = buildDeterministicAnswer(lastUserMessage, accountSnapshot, context, messages);
      if (deterministic) {
        console.log(`[chat:${requestId}] deterministic account answer`);
        return new Response(
          JSON.stringify({
            text: deterministic.text,
            source: 'ai',
            proposals: deterministic.proposals || [],
            debug_reason: 'deterministic_account_answer',
            debug_model: 'none',
            debug_meta: buildDebugMeta(
              requestId,
              context,
              accountSnapshot,
              'db',
              deterministic.route,
              deterministic.scopeLabels,
              deterministic.confidence,
              snapshotWarnings
            )
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (
      hasAiProviders &&
      accountSnapshot &&
      context.node_id &&
      context.node_mode === 'setup' &&
      context.focal_id &&
      lastUserMessage
    ) {
      try {
        const nodeSetupCompletion = await aiGateway.createCompletion(
          {
            messages: [
              {
                role: 'system',
                content:
                  'Return JSON only. Build an executable workspace setup plan. Shape: {"reply_text": string, "proposal": {"summary": string, "lists": Array<{name: string, item_label?: string, action_label?: string, statuses?: Array<{name: string, key?: string, color?: string, group_key?: string, is_default?: boolean}>, subtask_statuses?: Array<{name: string, key?: string, color?: string, group_key?: string, is_default?: boolean}>, fields?: Array<{name: string, type: "status"|"select"|"text"|"number"|"date"|"boolean"|"contact", is_primary?: boolean, is_pinned?: boolean, options?: Array<{label: string, color_fill?: string, color_border?: string, color_text?: string}>}>}>}}. Keep it practical. Recommend only what should be created or configured now.'
              },
              {
                role: 'user',
                content: JSON.stringify({
                  node_id: context.node_id,
                  focal_id: context.focal_id,
                  focal_name: accountSnapshot.focals.find((entry) => entry.id === context.focal_id)?.name || null,
                  desired_node_structure: context.node_structure_config || null,
                  node_structure_blueprint: context.node_structure_blueprint || null,
                  node_behavior_policy: extractNodeBehaviorPolicy(context),
                  user_request: lastUserMessage,
                  existing_lists: accountSnapshot.lists
                    .filter((entry) => entry.focal_id === context.focal_id)
                    .map((entry) => ({ id: entry.id, name: entry.name, mode: entry.mode || null })),
                  existing_fields: accountSnapshot.fields
                    .filter((entry) => accountSnapshot.lists.some((list) => list.id === entry.list_id && list.focal_id === context.focal_id))
                    .map((entry) => ({ list_id: entry.list_id, name: entry.name, type: entry.type, is_primary: entry.is_primary || false })),
                  existing_field_options: accountSnapshot.fieldOptions,
                  existing_item_count: accountSnapshot.items.filter((entry) => {
                    const list = accountSnapshot.lists.find((listEntry) => listEntry.id === entry.lane_id);
                    return list?.focal_id === context.focal_id;
                  }).length
                })
              }
            ],
            responseFormat: 'json_object',
            modelProfile: 'delta-general',
            maxTokens: 1400
          },
          requestId
        );

        if (nodeSetupCompletion.content) {
          const parsed = JSON.parse(nodeSetupCompletion.content) as {
            reply_text?: string;
            proposal?: {
              summary?: string;
              lists?: Array<{
                name?: string;
                item_label?: string | null;
                action_label?: string | null;
                statuses?: Array<{
                  name?: string;
                  key?: string | null;
                  color?: string | null;
                  group_key?: string | null;
                  is_default?: boolean;
                }>;
                subtask_statuses?: Array<{
                  name?: string;
                  key?: string | null;
                  color?: string | null;
                  group_key?: string | null;
                  is_default?: boolean;
                }>;
                fields?: Array<{
                  name?: string;
                  type?: 'status' | 'select' | 'text' | 'number' | 'date' | 'boolean' | 'contact';
                  is_primary?: boolean;
                  is_pinned?: boolean;
                  options?: Array<{
                    label?: string;
                    color_fill?: string | null;
                    color_border?: string | null;
                    color_text?: string | null;
                  }>;
                }>;
              }>;
            };
          };

          const listPlans = Array.isArray(parsed.proposal?.lists)
            ? parsed.proposal!.lists!
                .filter((entry) => typeof entry?.name === 'string' && entry.name.trim().length > 0)
                .map((entry) => ({
                  name: entry.name!.trim(),
                  item_label: entry.item_label || null,
                  action_label: entry.action_label || null,
                  statuses: Array.isArray(entry.statuses)
                    ? entry.statuses
                        .filter((status) => typeof status?.name === 'string' && status.name.trim().length > 0)
                        .map((status) => ({
                          name: status.name!.trim(),
                          key: status.key || null,
                          color: status.color || null,
                          group_key: status.group_key || null,
                          is_default: Boolean(status.is_default)
                        }))
                    : [],
                  subtask_statuses: Array.isArray(entry.subtask_statuses)
                    ? entry.subtask_statuses
                        .filter((status) => typeof status?.name === 'string' && status.name.trim().length > 0)
                        .map((status) => ({
                          name: status.name!.trim(),
                          key: status.key || null,
                          color: status.color || null,
                          group_key: status.group_key || null,
                          is_default: Boolean(status.is_default)
                        }))
                    : [],
                  fields: Array.isArray(entry.fields)
                    ? entry.fields
                        .filter((field) => typeof field?.name === 'string' && typeof field?.type === 'string')
                        .map((field) => ({
                          name: field.name!.trim(),
                          type: field.type!,
                          is_primary: Boolean(field.is_primary),
                          is_pinned: Boolean(field.is_pinned),
                          options: Array.isArray(field.options)
                            ? field.options
                                .filter((option) => typeof option?.label === 'string' && option.label.trim().length > 0)
                                .map((option) => ({
                                  label: option.label!.trim(),
                                  color_fill: option.color_fill || null,
                                  color_border: option.color_border || null,
                                  color_text: option.color_text || null
                                }))
                            : []
                        }))
                    : []
                }))
            : [];

          if (listPlans.length > 0) {
            return new Response(
              JSON.stringify({
                text:
                  (typeof parsed.reply_text === 'string' && parsed.reply_text.trim()) ||
                  'I mapped the setup changes this space needs. Review the plan and apply it when you are ready.',
                source: 'ai',
                proposals: [
                  {
                    id: crypto.randomUUID(),
                    type: 'node_setup_apply' as const,
                    node_id: context.node_id,
                    focal_id: context.focal_id,
                    summary:
                      (typeof parsed.proposal?.summary === 'string' && parsed.proposal.summary.trim()) ||
                      `Configure ${listPlans.length} list${listPlans.length === 1 ? '' : 's'} for this node`,
                    lists: listPlans
                  }
                ],
                debug_reason: 'node_setup_plan',
                debug_model: nodeSetupCompletion.modelUsed || null,
                debug_meta: buildDebugMeta(
                  requestId,
                  context,
                  accountSnapshot,
                  'llm',
                  'node_setup_plan',
                  undefined,
                  undefined,
                  snapshotWarnings
                )
              }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        }
      } catch (nodeSetupError) {
        console.warn(`[chat:${requestId}] node setup planning failed`, nodeSetupError);
      }
    }

    if (hasAiProviders && context.planning_date && lastUserMessage) {
      try {
        const planningCompletion = await aiGateway.createCompletion(
          {
            messages: [
              {
                role: 'system',
                content:
                  'You are Delta AI. Convert a rough plan for one day into JSON only. Return {"reply_text": string, "proposals": Array<{title: string, notes?: string, scheduled_start_utc: string, scheduled_end_utc?: string}>}. Use the provided planning date and timezone. Generate 1 to 3 realistic time blocks. scheduled_start_utc and scheduled_end_utc must be ISO UTC timestamps. Keep reply_text concise and action-oriented.'
              },
              {
                role: 'user',
                content: JSON.stringify({
                  planning_date: context.planning_date,
                  planning_timezone: context.planning_timezone || 'America/Denver',
                  user_request: lastUserMessage
                })
              }
            ],
            responseFormat: 'json_object',
            modelProfile: 'delta-general'
          },
          requestId
        );

        if (planningCompletion.content) {
          const parsed = JSON.parse(planningCompletion.content) as {
            reply_text?: string;
            proposals?: Array<{
              title?: string;
              notes?: string | null;
              scheduled_start_utc?: string;
              scheduled_end_utc?: string | null;
            }>;
          };

          const proposals: ChatProposal[] = Array.isArray(parsed.proposals)
            ? parsed.proposals
                .filter(
                  (proposal) =>
                    typeof proposal?.title === 'string' &&
                    proposal.title.trim().length > 0 &&
                    typeof proposal?.scheduled_start_utc === 'string' &&
                    proposal.scheduled_start_utc.includes('T')
                )
                .slice(0, 3)
                .map((proposal) => ({
                  id: crypto.randomUUID(),
                  type: 'create_time_block' as const,
                  title: proposal.title!.trim(),
                  scheduled_start_utc: proposal.scheduled_start_utc!,
                  scheduled_end_utc: proposal.scheduled_end_utc || null,
                  notes: typeof proposal.notes === 'string' ? proposal.notes : null
                }))
            : [];

          if (proposals.length > 0) {
            return new Response(
              JSON.stringify({
                text:
                  (typeof parsed.reply_text === 'string' && parsed.reply_text.trim()) ||
                  'I drafted a plan for that day. Review it and push the block you want to create.',
                source: 'ai',
                proposals,
                debug_reason: 'day_planning_proposal',
                debug_model: planningCompletion.modelUsed || null,
                debug_meta: buildDebugMeta(
                  requestId,
                  context,
                  accountSnapshot,
                  'llm',
                  'day_planning_proposal',
                  undefined,
                  undefined,
                  snapshotWarnings
                )
              }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        }
      } catch (planningError) {
        console.warn(`[chat:${requestId}] day planning proposal failed`, planningError);
      }
    }

    if (!hasAiProviders) {
      console.error(`[chat:${requestId}] missing AI provider configuration`, aiProviderStatus);
      return new Response(JSON.stringify({
        ...heuristic(messages, context),
        text: 'Delta AI is temporarily unavailable. Please verify AI provider configuration.',
        debug_reason: 'missing_ai_config',
        debug_error: aiProviderStatus,
        debug_meta: buildDebugMeta(requestId, context, accountSnapshot, 'heuristic', 'missing_ai_config', undefined, undefined, snapshotWarnings)
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const contextLine = friendlyContextLine(context, accountSnapshot);
    const nodePrompts = buildNodeSystemPrompts(context);

    const promptMessages = [
      {
        role: 'system',
        content:
          'You are Delta AI. Keep responses concise and practical. Use the provided account data snapshot as source of truth for user-specific questions. Never invent names, counts, or entities not present in snapshot data. Never expose internal IDs/UUIDs in user-facing text. If data is absent, clearly say you could not find matching records in current scope.'
      },
      ...nodePrompts.map((content) => ({ role: 'system' as const, content })),
      ...(contextLine ? [{ role: 'system', content: `Active context: ${contextLine}` }] : []),
      ...(accountSnapshot
        ? [
            {
              role: 'system',
              content: `Account data snapshot: ${snapshotToPromptText(accountSnapshot)}`
            }
          ]
        : []),
      ...messages
        .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
        .slice(-20)
        .map((entry) => ({
          role: entry.role === 'assistant' ? 'assistant' : 'user',
          content: entry.content
        }))
    ];

    let text = '';
    let usedModel: string | null = null;
    let lastAiStatus: number | null = null;
    let lastAiError: unknown = null;
    let lastAiProvider: string | null = null;
    let lastAiModel: string | null = null;

    const llmAttempt = await (async () => {
      try {
        // Use AI gateway for provider-agnostic completion
        const completion = await aiGateway.createCompletion({
          messages: promptMessages,
          temperature: 0.2,
          maxTokens: 500,
          modelProfile: 'delta-general'
        }, requestId);
        
        if (completion.fallbackOccurred) {
          console.warn(`[chat:${requestId}] AI fallback occurred`, {
            provider: completion.providerUsed,
            model: completion.modelUsed
          });
        }
        
        return {
          ok: !!completion.content,
          content: completion.content || '',
          model: completion.modelUsed,
          provider: completion.providerUsed || null,
          status: completion.content ? 200 : (completion.lastStatus ?? 500),
          lastStatus: completion.lastStatus ?? null,
          lastError: completion.lastError ?? null
        };
      } catch (error) {
        console.warn(`[chat:${requestId}] AI gateway failed`, error);
        return {
          ok: false,
          content: '',
          model: null,
          provider: null,
          status: 500,
          lastStatus: null,
          lastError: error instanceof Error ? error.message : String(error)
        };
      }
    })();

    if (llmAttempt.ok) {
      text = llmAttempt.content;
      usedModel = llmAttempt.model;
      console.log(`[chat:${requestId}] model success`, { model: usedModel });
    } else {
      lastAiStatus = llmAttempt.lastStatus ?? llmAttempt.status ?? null;
      lastAiError = llmAttempt.lastError ?? null;
      lastAiProvider = llmAttempt.provider ?? null;
      lastAiModel = llmAttempt.model ?? null;
      const fallbackReason = lastAiStatus ? `ai_http_${lastAiStatus}` : 'ai_all_providers_failed';
      const fallbackText =
        llmAttempt.status === 429
          ? 'I hit a temporary AI rate limit, but I still captured this for you.'
          : llmAttempt.status === 401 || llmAttempt.status === 403
            ? 'AI provider auth is temporarily failing, but I still captured this for you.'
            : 'I\'m having trouble reaching AI right now. I still captured this for you.';
      console.warn(`[chat:${requestId}] ai_fallback`, {
        reason: fallbackReason,
        status: llmAttempt.status,
        provider: lastAiProvider,
        model: lastAiModel,
        error: lastAiError
      });
      return new Response(JSON.stringify({
        ...heuristic(messages, context),
        text: fallbackText,
        debug_reason: fallbackReason,
        debug_error:
          lastAiError && typeof lastAiError === 'object'
            ? JSON.stringify(lastAiError)
            : lastAiError,
        debug_model: lastAiModel ? `${lastAiProvider || 'unknown'}:${lastAiModel}` : null,
        debug_meta: buildDebugMeta(
          requestId,
          context,
          accountSnapshot,
          'heuristic',
          fallbackReason,
          usedModel,
          snapshotWarnings
        )
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const safeText = stabilizeAssistantText(redactUuids(text));
    return new Response(
      JSON.stringify({
        text: safeText,
        source: 'ai',
        proposals: heuristic(messages, context).proposals,
        debug_reason: null,
        debug_model: usedModel,
        debug_meta: buildDebugMeta(requestId, context, accountSnapshot, 'llm', 'llm_answer', undefined, undefined, snapshotWarnings)
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[chat] function_runtime_error', error);
    return new Response(
      JSON.stringify({
        text: 'Delta AI request failed before completion.',
        source: 'heuristic',
        proposals: [],
        debug_reason: 'function_runtime_error'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
