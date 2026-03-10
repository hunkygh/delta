export type ListFieldType = 'status' | 'select' | 'text' | 'number' | 'date' | 'boolean' | 'contact';

export interface FieldOption {
  id: string;
  user_id: string;
  field_id: string;
  label: string;
  option_key: string;
  color_fill?: string | null;
  color_border?: string | null;
  color_text?: string | null;
  order_index: number;
  created_at?: string;
  updated_at?: string;
}

export interface ListField {
  id: string;
  user_id: string;
  list_id: string;
  name: string;
  field_key: string;
  type: ListFieldType;
  order_index: number;
  is_pinned: boolean;
  is_required: boolean;
  is_primary?: boolean;
  created_at?: string;
  updated_at?: string;
  options?: FieldOption[];
}

export interface ItemFieldValue {
  id: string;
  user_id: string;
  item_id: string;
  field_id: string;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  option_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ItemComment {
  id: string;
  item_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export type ItemFieldValueMap = Record<string, Record<string, ItemFieldValue>>;
