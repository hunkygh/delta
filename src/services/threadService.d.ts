declare interface ThreadServiceComment {
  id: string;
  thread_id: string;
  author_type: 'user' | 'ai';
  content: string;
  created_at: string;
}

declare interface ThreadServiceThread {
  id: string;
  user_id: string;
  scope_type: 'timeblock' | 'item' | 'action';
  scope_id: string;
  created_at: string;
}

declare const threadService: {
  getThreadByScope(args: { scope: 'timeblock' | 'item' | 'action'; scope_id: string }): Promise<ThreadServiceThread | null>;
  getOrCreateThread(args: {
    scope: 'timeblock' | 'item' | 'action';
    scope_id: string;
    user_id?: string;
  }): Promise<ThreadServiceThread>;
  listComments(thread_id: string, opts?: { limit?: number; before?: string }): Promise<ThreadServiceComment[]>;
  addComment(args: {
    thread_id: string;
    body: string;
    source?: 'user' | 'ai' | 'system';
    attachments?: unknown;
  }): Promise<ThreadServiceComment>;
};

export default threadService;
