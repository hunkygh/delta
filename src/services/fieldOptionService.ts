import { supabase } from './supabaseClient.js';
import type { FieldOption } from '../types/customFields';

const slugify = (value: string): string =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

export const fieldOptionService = {
  async createOption(fieldId: string, payload: Partial<FieldOption> & { user_id: string; label: string }): Promise<FieldOption> {
    const row = {
      user_id: payload.user_id,
      field_id: fieldId,
      label: payload.label.trim(),
      option_key: payload.option_key || slugify(payload.label),
      color_fill: payload.color_fill ?? null,
      color_border: payload.color_border ?? null,
      color_text: payload.color_text ?? null,
      order_index: payload.order_index ?? 0
    };
    const { data, error } = await supabase.from('field_options').insert(row).select('*').single();
    if (error) throw error;
    return data as FieldOption;
  },

  async updateOption(optionId: string, payload: Partial<FieldOption>): Promise<FieldOption> {
    const updates: Record<string, unknown> = { ...payload };
    if (payload.label && !payload.option_key) {
      updates.option_key = slugify(payload.label);
    }
    const { data, error } = await supabase.from('field_options').update(updates).eq('id', optionId).select('*').single();
    if (error) throw error;
    return data as FieldOption;
  },

  async deleteOption(optionId: string): Promise<void> {
    const { error } = await supabase.from('field_options').delete().eq('id', optionId);
    if (error) throw error;
  }
};

export default fieldOptionService;
