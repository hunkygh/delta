import { supabase } from './supabaseClient.js';
import type { ListField, ListFieldType } from '../types/customFields';

const slugify = (value: string): string =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

const isMissingTableError = (error: any, table: string): boolean =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes(table) &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingColumnError = (error: any, column: string): boolean =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes(column.toLowerCase()) &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isUniqueViolation = (error: any): boolean =>
  error?.code === '23505' || String(error?.message || '').toLowerCase().includes('duplicate key');

export const listFieldService = {
  async getFields(listId: string): Promise<ListField[]> {
    if (!listId) return [];
    const { data, error } = await supabase
      .from('list_fields')
      .select(`
        *,
        options:field_options (*)
      `)
      .eq('list_id', listId)
      .order('order_index', { ascending: true });
    if (error) {
      if (isMissingTableError(error, 'list_fields')) return [];
      throw error;
    }
    return (data || []).map((entry: any) => ({
      ...entry,
      options: (entry.options || []).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
    }));
  },

  async createField(listId: string, payload: Partial<ListField> & { user_id: string; name: string; type: ListFieldType }): Promise<ListField> {
    const baseKey = payload.field_key || slugify(payload.name) || `field_${Date.now()}`;
    const buildRow = (fieldKey: string, includeIsPrimary: boolean): Record<string, unknown> => ({
      user_id: payload.user_id,
      list_id: listId,
      name: payload.name.trim(),
      field_key: fieldKey,
      type: payload.type,
      order_index: payload.order_index ?? 0,
      is_pinned: payload.is_pinned ?? false,
      is_required: payload.is_required ?? false,
      ...(includeIsPrimary ? { is_primary: payload.is_primary ?? false } : {})
    });

    let includeIsPrimary = true;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const key = attempt === 0 ? baseKey : `${baseKey}_${attempt + 1}`;
      const { data, error } = await supabase
        .from('list_fields')
        .insert(buildRow(key, includeIsPrimary))
        .select('*')
        .single();
      if (!error) {
        return data as ListField;
      }
      if (isMissingColumnError(error, 'is_primary') && includeIsPrimary) {
        includeIsPrimary = false;
        continue;
      }
      if (isUniqueViolation(error) && String(error?.message || '').toLowerCase().includes('field_key')) {
        continue;
      }
      throw error;
    }
    throw new Error('Failed to create field: unable to generate unique key');
  },

  async updateField(fieldId: string, payload: Partial<ListField>): Promise<ListField> {
    const updates: Record<string, unknown> = { ...payload };
    // Keep field_key stable unless explicitly supplied.
    if (!payload.field_key) {
      delete updates.field_key;
    }

    const tryUpdate = async (includeIsPrimary: boolean): Promise<ListField> => {
      const nextUpdates = { ...updates };
      if (!includeIsPrimary) {
        delete nextUpdates.is_primary;
      }
      const { data, error } = await supabase
        .from('list_fields')
        .update(nextUpdates)
        .eq('id', fieldId)
        .select('*')
        .single();
      if (error) throw error;
      return data as ListField;
    };

    try {
      return await tryUpdate(true);
    } catch (error: any) {
      if (isMissingColumnError(error, 'is_primary')) {
        return tryUpdate(false);
      }
      throw error;
    }
  },

  async deleteField(fieldId: string): Promise<void> {
    const { error } = await supabase.from('list_fields').delete().eq('id', fieldId);
    if (error) throw error;
  },

  async reorderFields(listId: string, orderedFieldIds: string[]): Promise<void> {
    const updates = orderedFieldIds.map((id, index) =>
      supabase.from('list_fields').update({ order_index: index }).eq('id', id).eq('list_id', listId)
    );
    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
  }
};

export default listFieldService;
