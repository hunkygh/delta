import { supabase } from './supabaseClient.js';
import type { ChatContext, ChatMessage } from '../types/chat';

export interface AiChatThreadSummary {
  id: string;
  user_id: string;
  title: string;
  kicker: string | null;
  scope_key: string;
  context: ChatContext | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

const isMissingTableError = (error: unknown, tableName: string): boolean =>
  Boolean(
    (error as { message?: string } | null)?.message &&
      (error as { message?: string }).message!.toLowerCase().includes(tableName.toLowerCase()) &&
      ((error as { message?: string }).message!.toLowerCase().includes('does not exist') ||
        (error as { message?: string }).message!.toLowerCase().includes('schema cache'))
  );

const isMissingAiChatTablesError = (error: unknown): boolean =>
  isMissingTableError(error, 'ai_chat_threads') || isMissingTableError(error, 'ai_chat_messages');

const toSummary = (row: Record<string, any>): AiChatThreadSummary => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title,
  kicker: row.kicker || null,
  scope_key: row.scope_key,
  context: (row.context as ChatContext | null) || null,
  last_message_at: row.last_message_at,
  created_at: row.created_at,
  updated_at: row.updated_at
});

export const aiChatThreadService = {
  async listThreads(userId: string, limit = 24): Promise<AiChatThreadSummary[]> {
    const { data, error } = await supabase
      .from('ai_chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingAiChatTablesError(error)) return [];
      throw error;
    }

    return (data || []).map((row) => toSummary(row as Record<string, any>));
  },

  async getMostRecentThreadForScope(userId: string, scopeKey: string): Promise<AiChatThreadSummary | null> {
    const { data, error } = await supabase
      .from('ai_chat_threads')
      .select('*')
      .eq('user_id', userId)
      .eq('scope_key', scopeKey)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingAiChatTablesError(error)) return null;
      throw error;
    }

    return data ? toSummary(data as Record<string, any>) : null;
  },

  async getThreadMessages(threadId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingAiChatTablesError(error)) return [];
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      created_at: new Date(row.created_at).getTime(),
      queued: false,
      context: (row.context as ChatContext | null) || null,
      proposals: Array.isArray(row.proposals) ? row.proposals : null,
      debug_meta: row.debug_meta || null
    }));
  },

  async createThread(args: {
    userId: string;
    title: string;
    kicker?: string | null;
    scopeKey: string;
    context?: ChatContext | null;
  }): Promise<AiChatThreadSummary | null> {
    const { data, error } = await supabase
      .from('ai_chat_threads')
      .insert([
        {
          user_id: args.userId,
          title: args.title,
          kicker: args.kicker || null,
          scope_key: args.scopeKey,
          context: args.context || {}
        }
      ])
      .select('*')
      .single();

    if (error) {
      if (isMissingAiChatTablesError(error)) return null;
      throw error;
    }

    return toSummary(data as Record<string, any>);
  },

  async touchThread(threadId: string, patch: Partial<Pick<AiChatThreadSummary, 'title' | 'kicker' | 'context'>> = {}): Promise<void> {
    const { error } = await supabase
      .from('ai_chat_threads')
      .update({
        ...(patch.title ? { title: patch.title } : {}),
        ...(patch.kicker !== undefined ? { kicker: patch.kicker } : {}),
        ...(patch.context !== undefined ? { context: patch.context || {} } : {}),
        last_message_at: new Date().toISOString()
      })
      .eq('id', threadId);

    if (error) {
      if (isMissingAiChatTablesError(error)) return;
      throw error;
    }
  },

  async appendMessage(threadId: string, message: ChatMessage): Promise<void> {
    const { error } = await supabase.from('ai_chat_messages').insert([
      {
        thread_id: threadId,
        role: message.role,
        content: message.content,
        context: message.context || {},
        proposals: message.proposals || null,
        debug_meta: message.debug_meta || null,
        created_at: new Date(message.created_at).toISOString()
      }
    ]);

    if (error) {
      if (isMissingAiChatTablesError(error)) return;
      throw error;
    }

    await this.touchThread(threadId);
  }
};

export default aiChatThreadService;
