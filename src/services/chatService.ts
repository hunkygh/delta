import { supabase } from './supabaseClient';
import type { ChatContext, ChatMessage, ChatReply, ChatProposal, ChatDebugMeta } from '../types/chat';

interface ChatInvokePayload {
  messages: Array<Pick<ChatMessage, 'role' | 'content'>>;
  context?: ChatContext | null;
  mode?: 'ai' | 'memo';
}

interface ChatFunctionResponse {
  text?: string;
  source?: 'ai' | 'heuristic';
  proposals?: ChatProposal[];
  debug_reason?: string | null;
  debug_error?: unknown;
  debug_model?: string | null;
  debug_meta?: ChatDebugMeta;
}

const viteEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;
const chatDebugFlag = String(viteEnv.VITE_CHAT_DEBUG || '').toLowerCase();
const showChatDebug = chatDebugFlag === '1' || chatDebugFlag === 'true';
const supabaseUrl = viteEnv.VITE_SUPABASE_URL || 'https://eewzlwfmbhtoyeltxtaj.supabase.co';
const supabaseAnonKey =
  viteEnv.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVld3psd2ZtYmh0b3llbHR4dGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMzU5ODgsImV4cCI6MjA4NzkxMTk4OH0.F_Naj8cofo1g7YpKKvo_zYGzdEhW4c61h5sw51wOtKI';

const invokeChatFunction = async (
  payload: ChatInvokePayload,
  accessToken: string
): Promise<{ ok: boolean; status: number; data: ChatFunctionResponse | null; errorText: string | null }> => {
  const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  let data: ChatFunctionResponse | null = null;
  let errorText: string | null = null;
  try {
    data = (await response.json()) as ChatFunctionResponse;
  } catch {
    try {
      errorText = await response.text();
    } catch {
      errorText = null;
    }
  }

  return { ok: response.ok, status: response.status, data, errorText };
};

const heuristicReply = (payload: ChatInvokePayload): ChatReply => {
  const compact = 'Delta AI is unavailable right now. Please verify the chat edge function and Groq secret.';
  const itemId = payload.context?.item_id;
  const wantsFollowUp = false;
  const proposals: ChatProposal[] = itemId && wantsFollowUp
    ? [
        {
          id: crypto.randomUUID(),
          type: 'create_follow_up_action',
          title: 'Follow up',
          item_id: itemId,
          notes: compact
        }
      ]
    : [];

  return {
    text: compact,
    source: 'heuristic',
    proposals
  };
};

export const chatService = {
  async send(payload: ChatInvokePayload): Promise<ChatReply> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let accessToken = sessionData?.session?.access_token || null;
      if (!accessToken) {
        console.warn('[DeltaAI] no auth session token available for chat invoke');
        return heuristicReply(payload);
      }

      let result = await invokeChatFunction(payload, accessToken);
      if (result.status === 401) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('[DeltaAI] refresh session failed before retry:', refreshError.message);
        } else {
          accessToken = refreshed?.session?.access_token || accessToken;
          result = await invokeChatFunction(payload, accessToken);
        }
      }

      if (!result.ok) {
        console.warn('[DeltaAI] chat function fallback:', {
          status: result.status,
          body: result.data || result.errorText
        });
        return heuristicReply(payload);
      }

      const parsed = (result.data || {}) as ChatFunctionResponse;
      const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
      if (parsed.source !== 'ai') {
        console.warn('[DeltaAI] heuristic fallback:', parsed.debug_reason || 'unknown_reason', parsed.debug_error || null);
      } else if (parsed.debug_model) {
        console.info('[DeltaAI] model:', parsed.debug_model);
      }
      if (showChatDebug && parsed.debug_meta) {
        console.info('[DeltaAI] debug meta:', parsed.debug_meta);
      }
      return {
        text: text || 'No response generated.',
        source: parsed.source === 'ai' ? 'ai' : 'heuristic',
        proposals: Array.isArray(parsed.proposals) ? parsed.proposals : [],
        debug_meta: parsed.debug_meta
      };
    } catch {
      console.warn('[DeltaAI] chat invoke failed, using heuristic');
      return heuristicReply(payload);
    }
  }
};

export default chatService;
