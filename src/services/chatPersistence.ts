import type { ChatMessage, ChatThreadState } from '../types/chat';

const CHAT_STORAGE_PREFIX = 'delta-chat-v1';
const MAX_MESSAGES_DEFAULT = 60;
const TTL_MS = 3 * 24 * 60 * 60 * 1000;

const storageKeyForUser = (userId: string): string => `${CHAT_STORAGE_PREFIX}:${userId}`;

const safeParse = (raw: string | null): ChatThreadState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ChatThreadState;
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    const messages = parsed.messages.filter((entry: any) => (
      entry &&
      typeof entry === 'object' &&
      typeof entry.role === 'string' &&
      typeof entry.content === 'string' &&
      typeof entry.created_at === 'number'
    ));
    return {
      last_activity_at: typeof parsed.last_activity_at === 'number' ? parsed.last_activity_at : Date.now(),
      messages
    };
  } catch {
    return null;
  }
};

const trimMessages = (messages: ChatMessage[], maxMessages: number): ChatMessage[] => {
  if (!messages.length) return [];
  let nonMarkerCount = messages.filter((entry) => entry.role !== 'system_marker').length;
  if (nonMarkerCount <= maxMessages) return messages;

  const next = [...messages];
  while (next.length > 0 && nonMarkerCount > maxMessages) {
    const removed = next.shift();
    if (removed && removed.role !== 'system_marker') {
      nonMarkerCount -= 1;
    }
  }
  return next;
};

export const chatPersistence = {
  load(userId: string, maxMessages = MAX_MESSAGES_DEFAULT): ChatThreadState {
    const key = storageKeyForUser(userId);
    const parsed = safeParse(window.localStorage.getItem(key));
    if (!parsed) {
      return { last_activity_at: Date.now(), messages: [] };
    }

    const now = Date.now();
    if (!parsed.last_activity_at || now - parsed.last_activity_at > TTL_MS) {
      window.localStorage.removeItem(key);
      return { last_activity_at: now, messages: [] };
    }

    const messages = trimMessages(parsed.messages || [], maxMessages);
    const state: ChatThreadState = {
      last_activity_at: parsed.last_activity_at,
      messages
    };
    window.localStorage.setItem(key, JSON.stringify(state));
    return state;
  },

  save(userId: string, messages: ChatMessage[], maxMessages = MAX_MESSAGES_DEFAULT): ChatThreadState {
    const key = storageKeyForUser(userId);
    const state: ChatThreadState = {
      last_activity_at: Date.now(),
      messages: trimMessages(messages, maxMessages)
    };
    window.localStorage.setItem(key, JSON.stringify(state));
    return state;
  },

  clear(userId: string): void {
    window.localStorage.removeItem(storageKeyForUser(userId));
  }
};

export default chatPersistence;
