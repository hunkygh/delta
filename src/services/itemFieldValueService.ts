import { supabase } from './supabaseClient.js';
import type { ItemFieldValue, ItemFieldValueMap } from '../types/customFields';

const isMissingTableError = (error: any, table: string): boolean =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes(table) &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

type UpsertPayload =
  | { value_text: string; option_id?: never; value_number?: never; value_date?: never; value_boolean?: never }
  | { value_number: number; option_id?: never; value_text?: never; value_date?: never; value_boolean?: never }
  | { value_date: string; option_id?: never; value_text?: never; value_number?: never; value_boolean?: never }
  | { value_boolean: boolean; option_id?: never; value_text?: never; value_number?: never; value_date?: never }
  | { option_id: string; value_text?: never; value_number?: never; value_date?: never; value_boolean?: never };

export const itemFieldValueService = {
  async upsertValue(userId: string, itemId: string, fieldId: string, payload: UpsertPayload): Promise<ItemFieldValue> {
    const row = {
      user_id: userId,
      item_id: itemId,
      field_id: fieldId,
      option_id: 'option_id' in payload ? payload.option_id : null,
      value_text: 'value_text' in payload ? payload.value_text : null,
      value_number: 'value_number' in payload ? payload.value_number : null,
      value_date: 'value_date' in payload ? payload.value_date : null,
      value_boolean: 'value_boolean' in payload ? payload.value_boolean : null
    };
    const { data, error } = await supabase
      .from('item_field_values')
      .upsert(row, { onConflict: 'item_id,field_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as ItemFieldValue;
  },

  async bulkFetchForList(listId: string): Promise<ItemFieldValueMap> {
    const itemRows = await supabase.from('items').select('id').eq('lane_id', listId);
    if (itemRows.error) {
      if (isMissingTableError(itemRows.error, 'item_field_values')) return {};
      throw itemRows.error;
    }
    const itemIds = (itemRows.data || []).map((entry: any) => entry.id);
    if (itemIds.length === 0) return {};

    const { data, error } = await supabase
      .from('item_field_values')
      .select('*')
      .in('item_id', itemIds);
    if (error) {
      if (isMissingTableError(error, 'item_field_values')) return {};
      throw error;
    }
    const map: ItemFieldValueMap = {};
    for (const row of data || []) {
      if (!map[row.item_id]) {
        map[row.item_id] = {};
      }
      map[row.item_id][row.field_id] = row as ItemFieldValue;
    }
    return map;
  }
};

export default itemFieldValueService;
