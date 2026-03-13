/**
 * Local dev (Supabase CLI):
 * 1) supabase link --project-ref <PROJECT_REF>
 * 2) supabase functions serve optimization-pull --env-file supabase/.env.local
 * 3) supabase functions deploy optimization-pull
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type ScopeType = 'list' | 'focal' | 'timeblock';
type ProposalEntity = 'item' | 'action' | 'list' | 'time_block';
type ProposalSource = 'ai' | 'heuristic';
type ThreadScopeType = 'item' | 'action' | 'timeblock';

interface FieldUpdateProposal {
  entity: ProposalEntity;
  id: string;
  changes: Record<string, string | number | boolean | null>;
}

interface NewActionProposal {
  item_id: string;
  title: string;
  due_at_utc?: string | null;
  notes?: string | null;
}

interface CalendarProposal {
  action_id?: string;
  item_id?: string;
  time_block_id?: string;
  scheduled_start_utc: string;
  scheduled_end_utc?: string | null;
  title: string;
  notes?: string | null;
}

interface ProposalContract {
  source: ProposalSource;
  confidence: number;
  reasoning: string;
  field_updates: FieldUpdateProposal[];
  new_actions: NewActionProposal[];
  calendar_proposals: CalendarProposal[];
}

interface ThreadRow {
  id: string;
  scope_type: ThreadScopeType;
  scope_id: string;
}

const safeJson = async (response: Response): Promise<any> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const GROQ_MODELS_PREFERRED = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
];
const GROQ_MODEL_CACHE_TTL_MS = 10 * 60 * 1000;
let groqModelCache: { expiresAt: number; ids: string[] } | null = null;

const extractGroqErrorMessage = (payload: any): string => {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  const nested = payload?.error?.message ?? payload?.message;
  return typeof nested === 'string' ? nested : '';
};

const isGroqModelUnavailableError = (status: number, payload: any): boolean => {
  if (status !== 400 && status !== 404) return false;
  const message = extractGroqErrorMessage(payload).toLowerCase();
  if (!message) return false;
  return (
    message.includes('model') &&
    (
      message.includes('decommission') ||
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('unavailable') ||
      message.includes('invalid')
    )
  );
};

const fetchGroqModelIds = async (apiKey: string, forceRefresh = false): Promise<string[] | null> => {
  if (!forceRefresh && groqModelCache && groqModelCache.expiresAt > Date.now()) {
    return groqModelCache.ids;
  }
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) return null;
    const parsed = await safeJson(response);
    const ids = Array.isArray(parsed?.data)
      ? parsed.data.map((entry: any) => String(entry?.id || '')).filter(Boolean)
      : [];
    groqModelCache = {
      expiresAt: Date.now() + GROQ_MODEL_CACHE_TTL_MS,
      ids
    };
    return ids;
  } catch {
    return null;
  }
};

const getGroqCandidateModels = async (apiKey: string, forceRefresh = false): Promise<string[]> => {
  const activeIds = await fetchGroqModelIds(apiKey, forceRefresh);
  if (!activeIds || activeIds.length === 0) return [...GROQ_MODELS_PREFERRED];
  const activeSet = new Set(activeIds);
  const selected = GROQ_MODELS_PREFERRED.filter((model) => activeSet.has(model));
  return selected.length ? selected : [...GROQ_MODELS_PREFERRED];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isIsoDateTime = (value: unknown): value is string => {
  if (!isNonEmptyString(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const hasExplicitDateTime = (value: string): boolean => {
  if (!value || !value.trim()) return false;
  const text = value.toLowerCase();
  const patterns = [
    /\b\d{4}-\d{2}-\d{2}\b/, // ISO date
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/, // 3/4, 3/4/2026
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}\b/, // March 4
    /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/, // 2:00 PM
    /\b(?:tomorrow|tonight|next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/
  ];
  return patterns.some((pattern) => pattern.test(text));
};

const emptyHeuristicProposal = (reasoning = 'No actionable proposal generated.'): ProposalContract => ({
  source: 'heuristic',
  confidence: 0,
  reasoning,
  field_updates: [],
  new_actions: [],
  calendar_proposals: []
});

const validateAndNormalizeProposal = (
  candidate: unknown,
  opts: { allowCalendarProposals: boolean; defaultSource?: ProposalSource }
): ProposalContract | null => {
  if (!isPlainObject(candidate)) return null;

  const source = candidate.source === 'ai' || candidate.source === 'heuristic'
    ? candidate.source
    : (opts.defaultSource || 'ai');
  const confidence = typeof candidate.confidence === 'number' && Number.isFinite(candidate.confidence)
    ? Math.max(0, Math.min(1, candidate.confidence))
    : 0;
  const reasoning = isNonEmptyString(candidate.reasoning)
    ? candidate.reasoning.trim().slice(0, 280)
    : '';
  if (!reasoning) return null;

  const fieldUpdatesRaw = Array.isArray(candidate.field_updates) ? candidate.field_updates : null;
  const newActionsRaw = Array.isArray(candidate.new_actions) ? candidate.new_actions : null;
  const calendarRaw = Array.isArray(candidate.calendar_proposals) ? candidate.calendar_proposals : null;
  if (!fieldUpdatesRaw || !newActionsRaw || !calendarRaw) return null;

  const field_updates: FieldUpdateProposal[] = [];
  for (const row of fieldUpdatesRaw) {
    if (!isPlainObject(row)) return null;
    if (!['item', 'action', 'list', 'time_block'].includes(String(row.entity))) return null;
    if (!isNonEmptyString(row.id)) return null;
    if (!isPlainObject(row.changes)) return null;
    for (const value of Object.values(row.changes)) {
      const valid = value === null || ['string', 'number', 'boolean'].includes(typeof value);
      if (!valid) return null;
    }
    field_updates.push({
      entity: row.entity as ProposalEntity,
      id: row.id.trim(),
      changes: row.changes as Record<string, string | number | boolean | null>
    });
  }

  const new_actions: NewActionProposal[] = [];
  for (const row of newActionsRaw) {
    if (!isPlainObject(row)) return null;
    if (!isNonEmptyString(row.item_id) || !isNonEmptyString(row.title)) return null;
    if (row.due_at_utc !== undefined && row.due_at_utc !== null && !isIsoDateTime(row.due_at_utc)) return null;
    if (row.notes !== undefined && row.notes !== null && typeof row.notes !== 'string') return null;
    new_actions.push({
      item_id: row.item_id.trim(),
      title: row.title.trim(),
      due_at_utc: (row.due_at_utc ?? null) as string | null,
      notes: (row.notes ?? null) as string | null
    });
  }

  const calendar_proposals: CalendarProposal[] = [];
  for (const row of calendarRaw) {
    if (!isPlainObject(row)) return null;
    const hasRef = isNonEmptyString(row.action_id) || isNonEmptyString(row.item_id) || isNonEmptyString(row.time_block_id);
    if (!hasRef) return null;
    if (!isIsoDateTime(row.scheduled_start_utc)) return null;
    if (row.scheduled_end_utc !== undefined && row.scheduled_end_utc !== null && !isIsoDateTime(row.scheduled_end_utc)) return null;
    if (!isNonEmptyString(row.title)) return null;
    if (row.notes !== undefined && row.notes !== null && typeof row.notes !== 'string') return null;
    if (!opts.allowCalendarProposals) continue;
    calendar_proposals.push({
      action_id: isNonEmptyString(row.action_id) ? row.action_id.trim() : undefined,
      item_id: isNonEmptyString(row.item_id) ? row.item_id.trim() : undefined,
      time_block_id: isNonEmptyString(row.time_block_id) ? row.time_block_id.trim() : undefined,
      scheduled_start_utc: new Date(row.scheduled_start_utc).toISOString(),
      scheduled_end_utc: row.scheduled_end_utc ? new Date(row.scheduled_end_utc).toISOString() : null,
      title: row.title.trim(),
      notes: (row.notes ?? null) as string | null
    });
  }

  return {
    source,
    confidence,
    reasoning,
    field_updates,
    new_actions,
    calendar_proposals
  };
};

const inferScopeAndId = (payload: Record<string, unknown>): { scope: ScopeType; scopeId: string | null } => {
  const scopeToken = String(payload.scope || 'list').toLowerCase();
  const scope = scopeToken === 'focal' || scopeToken === 'timeblock' ? scopeToken : 'list';
  const fromScopeId = isNonEmptyString(payload.scope_id) ? payload.scope_id.trim() : null;
  if (fromScopeId) {
    return { scope, scopeId: fromScopeId };
  }
  if (scope === 'list' && isNonEmptyString(payload.list_id)) {
    return { scope, scopeId: payload.list_id.trim() };
  }
  if (scope === 'focal' && isNonEmptyString(payload.focal_id)) {
    return { scope, scopeId: payload.focal_id.trim() };
  }
  if (scope === 'timeblock' && isNonEmptyString(payload.timeblock_id)) {
    return { scope, scopeId: payload.timeblock_id.trim() };
  }
  return { scope, scopeId: null };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const AI_PROVIDER_PRIMARY = Deno.env.get('AI_PROVIDER_PRIMARY');
    const AI_API_KEY_PRIMARY = Deno.env.get('AI_API_KEY_PRIMARY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Supabase env vars are missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = userData.user.id;
    const payload = await req.json().catch(() => ({})) as Record<string, unknown>;
    const { scope, scopeId } = inferScopeAndId(payload);
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (!text) {
      return new Response(JSON.stringify(emptyHeuristicProposal('No explicit optimization action requested.')), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const contextIds = isPlainObject(payload.context_ids) ? payload.context_ids : {};
    if (!scopeId) {
      return new Response(JSON.stringify({ error: 'scope_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let listIds: string[] = [];
    let activeTimeBlock: { id: string; start_time: string; end_time: string } | null = null;

    if (scope === 'list') {
      listIds = [scopeId];
    } else if (scope === 'focal') {
      const { data: lanes, error: lanesError } = await admin
        .from('lanes')
        .select('id')
        .eq('user_id', userId)
        .eq('focal_id', scopeId);
      if (lanesError) throw lanesError;
      listIds = (lanes || []).map((row: any) => row.id);
    } else {
      const { data: timeblock, error: timeblockError } = await admin
        .from('time_blocks')
        .select('id,start_time,end_time')
        .eq('user_id', userId)
        .eq('id', scopeId)
        .maybeSingle();
      if (timeblockError) throw timeblockError;
      activeTimeBlock = timeblock || null;

      const { data: links, error: linksError } = await admin
        .from('time_block_links')
        .select('lane_id')
        .eq('user_id', userId)
        .eq('time_block_id', scopeId)
        .not('lane_id', 'is', null);
      if (linksError) throw linksError;
      listIds = [...new Set((links || []).map((row: any) => row.lane_id).filter(Boolean))];
    }

    if (listIds.length === 0) {
      return new Response(JSON.stringify(emptyHeuristicProposal('No scoped items found.')), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: items, error: itemsError } = await admin
      .from('items')
      .select('id,lane_id,title,description,status,signal_label,signal_score')
      .eq('user_id', userId)
      .in('lane_id', listIds)
      .order('id', { ascending: true })
      .limit(200);
    if (itemsError) throw itemsError;

    const itemIds = (items || []).map((item: any) => item.id);
    const { data: actions, error: actionsError } = await admin
      .from('actions')
      .select('id,item_id,title,status')
      .eq('user_id', userId)
      .in('item_id', itemIds.length > 0 ? itemIds : ['00000000-0000-0000-0000-000000000000'])
      .order('id', { ascending: true })
      .limit(500);
    if (actionsError) throw actionsError;

    const actionIds = (actions || []).map((action: any) => action.id);
    const scopeFilters: Array<{ scope_type: ThreadScopeType; ids: string[] }> = [
      { scope_type: 'item', ids: itemIds },
      { scope_type: 'action', ids: actionIds }
    ];
    if (scope === 'timeblock') {
      scopeFilters.push({ scope_type: 'timeblock', ids: [scopeId] });
    }

    const threadRows: ThreadRow[] = [];
    for (const entry of scopeFilters) {
      if (entry.ids.length === 0) continue;
      const { data: threadsData, error: threadsError } = await admin
        .from('threads')
        .select('id,scope_type,scope_id')
        .eq('user_id', userId)
        .eq('scope_type', entry.scope_type)
        .in('scope_id', entry.ids)
        .order('id', { ascending: true })
        .limit(300);
      if (threadsError) throw threadsError;
      threadRows.push(...((threadsData || []) as ThreadRow[]));
    }

    const threadIds = threadRows.map((thread) => thread.id);
    const { data: comments, error: commentsError } = await admin
      .from('comments')
      .select('thread_id,author_type,content,created_at')
      .in('thread_id', threadIds.length > 0 ? threadIds : ['00000000-0000-0000-0000-000000000000'])
      .order('created_at', { ascending: false })
      .limit(400);
    if (commentsError) throw commentsError;

    const unresolvedActionCountByItem = new Map<string, number>();
    for (const action of actions || []) {
      if (action.status !== 'completed') {
        unresolvedActionCountByItem.set(
          action.item_id,
          (unresolvedActionCountByItem.get(action.item_id) || 0) + 1
        );
      }
    }

    const allowCalendarProposals = scope === 'timeblock' || hasExplicitDateTime(text);
    const contextPayload = {
      scope,
      scope_id: scopeId,
      text,
      context_ids: contextIds,
      time_block: activeTimeBlock,
      list_ids: listIds,
      items: (items || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        signal_label: item.signal_label || 'normal',
        signal_score: item.signal_score || 0,
        unresolved_actions: unresolvedActionCountByItem.get(item.id) || 0
      })),
      actions: (actions || []).map((action: any) => ({
        id: action.id,
        item_id: action.item_id,
        title: action.title,
        status: action.status
      })),
      comments: comments || []
    };

    let proposal: ProposalContract | null = null;

    if (AI_API_KEY_PRIMARY) {
      try {
        // Use AI gateway for provider-agnostic completion
        const aiGatewayModule = await import('https://deno.land/x/ai_gateway@0.1.0/mod.ts');
        const completion = await aiGatewayModule.aiGateway.createCompletion({
          messages: [
            {
              role: 'system',
              content:
                'Return JSON only. Output EXACTLY this object shape: ' +
                '{"source":"ai|heuristic","confidence":0..1,"reasoning":"short",' +
                '"field_updates":[{"entity":"item|action|list|time_block","id":"uuid","changes":{"k":"v"}}],' +
                '"new_actions":[{"item_id":"uuid","title":"text","due_at_utc":null,"notes":null}],' +
                '"calendar_proposals":[{"item_id":"uuid","action_id":"uuid","time_block_id":"uuid","scheduled_start_utc":"ISO","scheduled_end_utc":null,"title":"text","notes":null}]. ' +
                'Never mutate state. Operate only on provided context.'
            },
            { role: 'user', content: JSON.stringify(contextPayload) }
          ],
          temperature: 0,
          responseFormat: 'json_object',
          modelProfile: 'delta-reasoning'
        }, requestId);
        
        if (completion.fallbackOccurred) {
          console.warn(`[optimization:${requestId}] AI fallback occurred`, {
            provider: completion.providerUsed,
            model: completion.modelUsed
          });
        }
        
        if (completion.content) {
          try {
            const parsed = JSON.parse(completion.content);
            const maybeContract = isPlainObject(parsed?.proposal) ? parsed.proposal : parsed;
            const validated = validateAndNormalizeProposal(maybeContract, {
              allowCalendarProposals,
              defaultSource: 'ai'
            });
            proposal = validated;
          } catch {
            proposal = null;
          }
        }
      } catch {
        // noop, fall through to next model
      }
    }

    if (!proposal) {
      proposal = emptyHeuristicProposal(
        AI_API_KEY_PRIMARY ? 'AI proposal unavailable or invalid; using safe fallback.' : 'AI provider unavailable; using safe fallback.'
      );
    }

    return new Response(JSON.stringify(proposal), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
