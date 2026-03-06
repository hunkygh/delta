import { supabase } from './supabaseClient.js';

const isMissingTableOrSchemaCacheError = (error, tableName) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes(tableName.toLowerCase()) &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingThreadsTableError = (error) => isMissingTableOrSchemaCacheError(error, 'threads');
const isMissingCommentsTableError = (error) => isMissingTableOrSchemaCacheError(error, 'comments');

const VALID_SCOPES = new Set(['timeblock', 'item', 'action']);
const VALID_COMMENT_SOURCES = new Set(['user', 'ai', 'system']);

const scopeToDbScope = (scope) => {
  if (scope === 'timeblock') return 'timeblock';
  if (scope === 'item') return 'item';
  if (scope === 'action') return 'action';
  throw new Error('Invalid thread scope');
};

const normalizeCommentSource = (source) => {
  if (!source) return 'user';
  const token = String(source).toLowerCase();
  if (!VALID_COMMENT_SOURCES.has(token)) {
    throw new Error('Invalid comment source');
  }
  return token;
};

const getAuthedUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data?.user?.id;
  if (!userId) throw new Error('Not authenticated');
  return userId;
};

export const threadService = {
  async getThreadByScope({ scope, scope_id }) {
    if (!VALID_SCOPES.has(scope) || !scope_id) {
      throw new Error('Invalid thread scope request');
    }

    const { data, error } = await supabase
      .from('threads')
      .select('*')
      .eq('scope_type', scopeToDbScope(scope))
      .eq('scope_id', scope_id)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingThreadsTableError(error)) {
        throw new Error('Threads table does not exist. Run the latest migration.');
      }
      throw error;
    }

    return data || null;
  },

  async getOrCreateThread({ scope, scope_id, user_id }) {
    if (!VALID_SCOPES.has(scope) || !scope_id) {
      throw new Error('Invalid thread scope request');
    }

    const existing = await this.getThreadByScope({ scope, scope_id });
    if (existing) return existing;

    const ownerId = user_id || (await getAuthedUserId());
    const { data, error } = await supabase
      .from('threads')
      .insert([
        {
          user_id: ownerId,
          scope_type: scopeToDbScope(scope),
          scope_id
        }
      ])
      .select('*')
      .single();

    if (error) {
      if (isMissingThreadsTableError(error)) {
        throw new Error('Threads table does not exist. Run the latest migration.');
      }
      throw error;
    }

    return data;
  },

  async listComments(thread_id, { limit = 100, before } = {}) {
    if (!thread_id) throw new Error('thread_id is required');
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));

    let query = supabase
      .from('comments')
      .select('*')
      .eq('thread_id', thread_id)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (before) {
      query = query.lt('created_at', new Date(before).toISOString());
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingCommentsTableError(error)) {
        throw new Error('Comments table does not exist. Run the latest migration.');
      }
      throw error;
    }

    return [...(data || [])].reverse();
  },

  async addComment({ thread_id, body, source = 'user', attachments = null }) {
    if (!thread_id) throw new Error('thread_id is required');
    if (!body || !String(body).trim()) throw new Error('Comment body is required');
    const authorType = normalizeCommentSource(source) === 'system' ? 'ai' : normalizeCommentSource(source);
    void attachments;

    const { data, error } = await supabase
      .from('comments')
      .insert([
        {
          thread_id,
          author_type: authorType,
          content: String(body).trim()
        }
      ])
      .select('*')
      .single();

    if (error) {
      if (isMissingCommentsTableError(error) || isMissingThreadsTableError(error)) {
        throw new Error('Comments tables do not exist. Run the latest migration.');
      }
      throw error;
    }

    return data;
  }
};

export default threadService;
