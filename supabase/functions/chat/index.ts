/**
 * Local dev:
 * 1) supabase functions serve chat --env-file supabase/.env.local
 * 2) supabase functions deploy chat --no-verify-jwt
 *    NOTE: --no-verify-jwt is temporary; function still enforces bearer auth internally.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type ChatRole = 'user' | 'assistant' | 'system_marker';

interface ChatContext {
  time_block_id?: string;
  focal_id?: string;
  list_id?: string;
  item_id?: string;
  action_id?: string;
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
  items: Array<{ id: string; lane_id: string | null; title: string; status?: string | null }>;
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
  route?: string;
  scope: {
    mode?: 'global' | 'scoped';
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
}

type ChatProposal =
  | { id: string; type: 'create_follow_up_action'; title: string; item_id: string; notes?: string | null }
  | { id: string; type: 'create_focal'; title: string }
  | { id: string; type: 'create_list'; title: string; focal_id: string }
  | { id: string; type: 'create_item'; title: string; list_id: string }
  | { id: string; type: 'create_action'; title: string; item_id: string };

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

const safeJson = async (response: Response): Promise<any> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const GROQ_MODELS_FALLBACK = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
];

const clip = (value: string, max = 160): string => (value.length > max ? `${value.slice(0, max)}…` : value);

const buildAccountContextSnapshot = async (
  client: ReturnType<typeof createClient>,
  userId: string,
  context: ChatContext
): Promise<AccountContextSnapshot> => {
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
    .select('id,lane_id,title,status')
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
      .select('id,lane_id,title')
      .eq('user_id', userId)
      .order('order_num', { ascending: true })
      .limit(hasScopedIds ? 60 : 120);
  }

  if (focalsResult.error) throw focalsResult.error;
  if (listsResult.error) throw listsResult.error;
  if (itemsResult.error) {
    console.warn('[chat] snapshot: items query failed, continuing with empty items', itemsResult.error.message);
  }
  if (actionsResult.error) {
    console.warn('[chat] snapshot: actions query failed, continuing with empty actions', actionsResult.error.message);
  }
  if (timeBlocksResult.error) {
    console.warn('[chat] snapshot: time_blocks query failed, continuing with empty timeBlocks', timeBlocksResult.error.message);
  }
  if (fieldsResult.error) {
    console.warn('[chat] snapshot: list_fields query failed, continuing with empty fields', fieldsResult.error.message);
  }
  if (fieldOptionsResult.error) {
    console.warn('[chat] snapshot: field_options query failed, continuing with empty fieldOptions', fieldOptionsResult.error.message);
  }
  if (itemFieldValuesResult.error) {
    console.warn('[chat] snapshot: item_field_values query failed, continuing with empty values', itemFieldValuesResult.error.message);
  }
  if (itemCommentsResult.error) {
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
      status: row.status ?? null
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

const shouldAnswerDeterministically = (text: string): boolean => {
  const q = text.toLowerCase();
  return (
    /\b(focal|focals|space|spaces|list|lists|item|items|task|tasks|action|actions|field|fields|column|columns|time block|timeblock|calendar)\b/.test(q) ||
    /\b(next step|follow[- ]?up|what should i do next)\b/.test(q) ||
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

const detectIntent = (userText: string): DeterministicIntent => {
  const q = userText.toLowerCase();
  const asksNextStep = /\b(next step|what should i do next|follow[- ]?up|follow up)\b/.test(q);
  const asksFields = /\b(field|fields|columns|column|status field|custom field)\b/.test(q);
  const asksItems = /\b(items?|tasks?)\b/.test(q);
  const asksLists = /\blists?\b/.test(q);
  const asksFocals = /\b(focals?|spaces?)\b/.test(q);
  const asksActions = /\bactions?\b/.test(q);
  const asksTimeBlocks = /\btime block|timeblock|calendar\b/.test(q);
  if (asksNextStep) return 'item_next_step';
  if (asksFields) return 'field_inventory';
  if (asksItems) return 'list_items';
  if (asksLists) return 'list_inventory';
  if (asksFocals) return 'focal_inventory';
  if (asksActions) return 'action_inventory';
  if (asksTimeBlocks) return 'timeblock_inventory';
  return 'unknown';
};

const extractTitleCandidate = (userText: string): string | null => {
  const quoted = userText.match(/["“](.+?)["”]/);
  if (quoted?.[1]) {
    const value = quoted[1].trim();
    return value.length ? value : null;
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
  if (/\b(focal|space)(s)?\b/.test(q)) return 'focal';
  if (/\blist(s)?\b/.test(q)) return 'list';
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
          scopeLabels: { focal: resolvedList.focalName || focalName, list: resolvedList.name },
          confidence: { focal: entities.focal.confidence, list: entities.list.confidence },
          proposals: []
        };
      }
      return {
        text: `Ready to create item "${title}" in ${resolvedList.name}. Approve to apply.`,
        route: intent,
        scopeLabels: { focal: resolvedList.focalName || focalName, list: resolvedList.name },
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
    return {
      text: `${resolvedItem.title}:\n${formatNameList(bullets)}\n\n${recommendation}`,
      route: intent,
      scopeLabels: { focal: owningList?.focalName || focalName, list: owningList?.name || resolvedList?.name || undefined },
      confidence: { focal: entities.focal.confidence, list: entities.list.confidence }
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
    focal ? `Space=${focal.name}` : null,
    list ? `List=${list.name}` : null,
    item ? `Item=${item.title}` : null,
    action ? `Action=${action.title}` : null,
    context.time_block_id ? 'TimeBlock=active' : null
  ].filter(Boolean);
  return parts.join(', ');
};

const redactUuids = (text: string): string =>
  text.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    '[id-hidden]'
  );

const buildDebugMeta = (
  context: ChatContext,
  snapshot: AccountContextSnapshot | null,
  source: DebugMeta['source'],
  route?: string,
  scopeLabels?: { focal?: string; list?: string },
  confidence?: { focal?: number; list?: number }
): DebugMeta => ({
  source,
  route,
  scope: {
    mode:
      context.focal_id || context.list_id || context.item_id || context.action_id || context.time_block_id
        ? 'scoped'
        : 'global',
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
    : undefined
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
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    console.log(`[chat:${requestId}] inbound request`);
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error(`[chat:${requestId}] missing Supabase env`);
      return new Response(JSON.stringify({ error: 'Supabase env missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!authHeader || !bearerToken) {
      console.warn(`[chat:${requestId}] missing auth header`);
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(bearerToken);
    let userId = userData?.user?.id ?? null;
    let authMode: 'getUser' | 'getClaims' | 'none' = userId ? 'getUser' : 'none';

    if (!userId) {
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(bearerToken);
      const subject = claimsData?.claims?.sub;
      if (typeof subject === 'string' && subject.length > 0) {
        userId = subject;
        authMode = 'getClaims';
      } else {
        console.warn(`[chat:${requestId}] unauthorized`, {
          getUserMessage: userError?.message ?? null,
          getUserStatus: userError?.status ?? null,
          getClaimsMessage: claimsError?.message ?? null,
          hasClaimsSub: Boolean(subject),
          tokenPrefix: bearerToken.slice(0, 12)
        });
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
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
    const asksAccountData = shouldAnswerDeterministically(lastUserMessage);
    let accountSnapshot: AccountContextSnapshot | null = null;
    let accountSnapshotError: string | null = null;
    try {
      accountSnapshot = await buildAccountContextSnapshot(authClient, userId, context);
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

    if (asksAccountData && !accountSnapshot) {
      return new Response(
        JSON.stringify({
          text: 'I could not read your account data right now, so I cannot answer that reliably yet.',
          source: 'heuristic',
          proposals: [],
          debug_reason: 'account_snapshot_unavailable',
          debug_error: accountSnapshotError,
          debug_meta: buildDebugMeta(context, accountSnapshot, 'heuristic')
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (accountSnapshot && asksAccountData) {
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
              context,
              accountSnapshot,
              'db',
              deterministic.route,
              deterministic.scopeLabels,
              deterministic.confidence
            )
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (!GROQ_API_KEY) {
      console.error(`[chat:${requestId}] missing GROQ_API_KEY`);
      return new Response(JSON.stringify({
        ...heuristic(messages, context),
        text: 'Delta AI is temporarily unavailable. Please try again in a moment.',
        debug_reason: 'missing_groq_api_key',
        debug_meta: buildDebugMeta(context, accountSnapshot, 'heuristic')
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const contextLine = friendlyContextLine(context, accountSnapshot);

    const promptMessages = [
      {
        role: 'system',
        content:
          'You are Delta AI. Keep responses concise and practical. Use the provided account data snapshot as source of truth for user-specific questions. Never invent names, counts, or entities not present in snapshot data. Never expose internal IDs/UUIDs in user-facing text. If data is absent, clearly say you could not find matching records in current scope.'
      },
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
    let lastGroqStatus: number | null = null;
    let lastGroqError: unknown = null;

    for (const model of GROQ_MODELS_FALLBACK) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 500,
            messages: promptMessages
          })
        });

        if (!response.ok) {
          lastGroqStatus = response.status;
          lastGroqError = await safeJson(response);
          console.warn(`[chat:${requestId}] model failed`, {
            model,
            status: response.status,
            error: lastGroqError
          });
          continue;
        }

        const json = await safeJson(response);
        const candidate = json?.choices?.[0]?.message?.content?.trim() || '';
        if (candidate) {
          text = candidate;
          usedModel = model;
          console.log(`[chat:${requestId}] model success`, { model });
          break;
        }

        console.warn(`[chat:${requestId}] empty completion`, { model });
      } catch (modelError) {
        lastGroqError = modelError instanceof Error ? modelError.message : modelError;
        console.warn(`[chat:${requestId}] model exception`, { model, error: lastGroqError });
      }
    }

    if (!text) {
      return new Response(JSON.stringify({
        ...heuristic(messages, context),
        text: 'I’m having trouble reaching AI right now. I still captured this for you.',
        debug_reason: lastGroqStatus ? `groq_http_${lastGroqStatus}` : 'groq_all_models_failed',
        debug_error: lastGroqError,
        debug_meta: buildDebugMeta(context, accountSnapshot, 'heuristic')
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const safeText = redactUuids(text);
    return new Response(
      JSON.stringify({
        text: safeText,
        source: 'ai',
        proposals: heuristic(messages, context).proposals,
        debug_reason: null,
        debug_model: usedModel,
        debug_meta: buildDebugMeta(context, accountSnapshot, 'llm')
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
