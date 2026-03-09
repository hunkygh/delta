import { supabase } from './supabaseClient.js';

export interface DocCategory {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  order_num: number;
  created_at: string;
  updated_at: string;
}

export interface DocNote {
  id: string;
  user_id: string;
  title: string;
  body: string;
  source: 'quick_text' | 'quick_voice' | 'memo' | 'ai';
  origin_context: Record<string, unknown> | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  categories?: DocCategory[];
}

const isMissingTableOrSchemaError = (error: any, table: string): boolean =>
  Boolean(
    error?.message &&
      String(error.message).toLowerCase().includes(table.toLowerCase()) &&
      (String(error.message).toLowerCase().includes('does not exist') ||
        String(error.message).toLowerCase().includes('schema cache'))
  );

const toTitle = (rawBody: string): string => {
  const cleaned = (rawBody || '').trim();
  if (!cleaned) return 'Untitled note';
  const firstLine = cleaned.split('\n').find((line) => line.trim()) || cleaned;
  return firstLine.trim().slice(0, 120);
};

export const docsService = {
  async getCategories(userId: string): Promise<DocCategory[]> {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('doc_categories')
      .select('*')
      .eq('user_id', userId)
      .order('order_num', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      if (isMissingTableOrSchemaError(error, 'doc_categories')) return [];
      throw error;
    }
    return (data || []) as DocCategory[];
  },

  async createCategory(userId: string, name: string, parentId: string | null = null): Promise<DocCategory> {
    if (!userId) throw new Error('userId is required');
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('Category name is required');

    const { data, error } = await supabase
      .from('doc_categories')
      .insert({
        user_id: userId,
        name: trimmed,
        parent_id: parentId
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as DocCategory;
  },

  async getNotes(params: {
    userId: string;
    archived?: boolean;
    search?: string;
    categoryId?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<DocNote[]> {
    const { userId, archived = false, search = '', categoryId = null, limit = 200, offset = 0 } = params;
    if (!userId) return [];

    let query = supabase
      .from('doc_notes')
      .select(`
        *,
        categories:doc_note_categories (
          category:doc_categories (*)
        )
      `)
      .eq('user_id', userId)
      .eq('is_archived', archived)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, Math.max(offset, offset + limit - 1));

    const trimmedSearch = (search || '').trim();
    if (trimmedSearch) {
      const escaped = trimmedSearch.replace(/[%_]/g, '');
      query = query.or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%`);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableOrSchemaError(error, 'doc_notes')) return [];
      throw error;
    }

    const normalized = ((data || []) as any[]).map((row) => ({
      ...row,
      categories: (row.categories || [])
        .map((entry: any) => entry.category)
        .filter(Boolean) as DocCategory[]
    })) as DocNote[];

    if (!categoryId) return normalized;
    return normalized.filter((note) => (note.categories || []).some((cat) => cat.id === categoryId));
  },

  async createNote(params: {
    userId: string;
    body: string;
    title?: string;
    source?: 'quick_text' | 'quick_voice' | 'memo' | 'ai';
    originContext?: Record<string, unknown> | null;
    categoryIds?: string[];
  }): Promise<DocNote> {
    const { userId, body, title, source = 'quick_text', originContext = null, categoryIds = [] } = params;
    if (!userId) throw new Error('userId is required');
    const trimmedBody = (body || '').trim();
    if (!trimmedBody) throw new Error('body is required');

    const { data, error } = await supabase
      .from('doc_notes')
      .insert({
        user_id: userId,
        title: (title || '').trim() || toTitle(trimmedBody),
        body: trimmedBody,
        source,
        origin_context: originContext
      })
      .select('*')
      .single();
    if (error) throw error;

    const note = data as DocNote;
    if (categoryIds.length > 0) {
      await this.assignNoteCategories(note.id, categoryIds);
    }
    return note;
  },

  async archiveNote(noteId: string, archived: boolean): Promise<void> {
    if (!noteId) return;
    const { error } = await supabase
      .from('doc_notes')
      .update({ is_archived: archived, updated_at: new Date().toISOString() })
      .eq('id', noteId);
    if (error) throw error;
  },

  async updateNote(noteId: string, updates: { title?: string; body?: string }): Promise<DocNote> {
    if (!noteId) throw new Error('noteId is required');
    const next: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    if (typeof updates.title === 'string') next.title = updates.title.trim() || 'Untitled note';
    if (typeof updates.body === 'string') next.body = updates.body.trim();
    const { data, error } = await supabase
      .from('doc_notes')
      .update(next)
      .eq('id', noteId)
      .select('*')
      .single();
    if (error) throw error;
    return data as DocNote;
  },

  async assignNoteCategories(noteId: string, categoryIds: string[]): Promise<void> {
    if (!noteId) return;
    const deduped = [...new Set((categoryIds || []).filter(Boolean))];
    const { error: deleteError } = await supabase.from('doc_note_categories').delete().eq('note_id', noteId);
    if (deleteError && !isMissingTableOrSchemaError(deleteError, 'doc_note_categories')) {
      throw deleteError;
    }
    if (deduped.length === 0) return;

    const rows = deduped.map((categoryId) => ({ note_id: noteId, category_id: categoryId }));
    const { error: insertError } = await supabase.from('doc_note_categories').insert(rows);
    if (insertError) throw insertError;
  }
};

export default docsService;
