import { supabase } from './supabaseClient.js';
import { withTimeout, isTimeoutError } from './requestUtils.js';
import { validateOptimizationProposalOrFallback } from '../contracts/executionContracts';
import threadService from './threadService.js';

const FOCALS_TIMEOUT_MS = 5000;
const FULL_FOCAL_TIMEOUT_MS = 7000;

const isMissingColumnError = (error, columnName, tableName) => {
  const message = (error?.message || '').toLowerCase();
  if (!message) return false;
  return (
    (message.includes(`'${columnName.toLowerCase()}'`) && message.includes(`'${tableName.toLowerCase()}'`) && message.includes('schema cache')) ||
    (message.includes(`column ${tableName.toLowerCase()}.${columnName.toLowerCase()} does not exist`)) ||
    (message.includes(`column "${tableName.toLowerCase()}"."${columnName.toLowerCase()}" does not exist`))
  );
};

const isMissingActionLabelColumnError = (error) => isMissingColumnError(error, 'action_label', 'lanes');

const isMissingItemLabelColumnError = (error) => isMissingColumnError(error, 'item_label', 'lanes');

const isMissingOrderNumColumnError = (error) => isMissingColumnError(error, 'order_num', 'lanes');

const isMissingLaneStatusesTableError = (error) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes('lane_statuses') &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingLaneSubtaskStatusesTableError = (error) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes('lane_subtask_statuses') &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingItemsStatusIdColumnError = (error) =>
  Boolean(
    error?.message &&
      error.message.includes("'status_id'") &&
      error.message.includes("'items'") &&
      error.message.toLowerCase().includes('schema cache')
  );

const isMissingActionsSubtaskStatusIdColumnError = (error) =>
  Boolean(
    error?.message &&
      error.message.includes("'subtask_status_id'") &&
      error.message.includes("'actions'") &&
      error.message.toLowerCase().includes('schema cache')
  );

const isMissingItemCommentsTableError = (error) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes('item_comments') &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingThreadsTableError = (error) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes('threads') &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingCommentsTableError = (error) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes('comments') &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingLanesModeColumnError = (error) => isMissingColumnError(error, 'mode', 'lanes');

const isMissingItemOccurrencesTableError = (error) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes('item_occurrences') &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingActionOccurrencesTableError = (error) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes('action_occurrences') &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingTimeBlocksTableError = (error) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes('time_blocks') &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingTimeBlockLinksTableError = (error) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes('time_block_links') &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isNoRowsSingleResultError = (error) => {
  const message = (error?.message || '').toLowerCase();
  const details = (error?.details || '').toLowerCase();
  return (
    error?.code === 'PGRST116' ||
    message.includes('cannot coerce the result to a single json object') ||
    details.includes('contains 0 rows')
  );
};

const utcIso = (value) => new Date(value).toISOString();

const utcMs = (value) => new Date(value).getTime();

const DEFAULT_RECURRENCE_CONFIG = {
  unit: 'week',
  interval: 1,
  limitType: 'indefinite'
};

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
};

const getUtcWeekStart = (value = new Date()) => {
  const date = new Date(value);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = addDays(date, diff);
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

const getUtcWeekEnd = (weekStart) => {
  const end = addDays(weekStart, 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
};

const shiftByRecurrence = (source, rule, config = DEFAULT_RECURRENCE_CONFIG) => {
  const date = new Date(source);
  const interval = Math.max(1, Number(config?.interval) || 1);

  if (rule === 'daily') {
    date.setUTCDate(date.getUTCDate() + interval);
    return date;
  }
  if (rule === 'weekly') {
    date.setUTCDate(date.getUTCDate() + (7 * interval));
    return date;
  }
  if (rule === 'monthly') {
    date.setUTCMonth(date.getUTCMonth() + interval);
    return date;
  }
  if (rule === 'custom') {
    const unit = config?.unit || 'week';
    if (unit === 'day') date.setUTCDate(date.getUTCDate() + interval);
    else if (unit === 'week') date.setUTCDate(date.getUTCDate() + (7 * interval));
    else if (unit === 'month') date.setUTCMonth(date.getUTCMonth() + interval);
    else if (unit === 'year') date.setUTCFullYear(date.getUTCFullYear() + interval);
    else date.setUTCDate(date.getUTCDate() + (7 * interval));
    return date;
  }
  return date;
};

const hasExceededLimit = (baseStart, candidateStart, rule, config) => {
  if (!config || !rule || rule === 'none') {
    return false;
  }
  if (config.limitType === 'until' && config.until) {
    const until = new Date(`${config.until}T23:59:59.999Z`);
    return candidateStart.getTime() > until.getTime();
  }
  if (config.limitType === 'count' && config.count) {
    let probe = new Date(baseStart);
    let count = 1;
    while (probe.getTime() < candidateStart.getTime() && count <= config.count) {
      probe = shiftByRecurrence(probe, rule, config);
      count += 1;
    }
    return count > config.count;
  }
  return false;
};

const generateOccurrencesForTimeBlock = ({
  block,
  rangeStart,
  rangeEnd,
  includeNextAfter = null,
  maxIterations = 520
}) => {
  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  const durationMs = Math.max(1, end.getTime() - start.getTime());
  const rule = block.recurrence_rule || 'none';
  const config = block.recurrence_config || DEFAULT_RECURRENCE_CONFIG;
  const includeWeekends = block.include_weekends !== false;
  const windowStartMs = new Date(rangeStart).getTime();
  const windowEndMs = new Date(rangeEnd).getTime();
  const occurrences = [];
  let nextAfter = null;

  if (rule === 'none') {
    const blockStartMs = start.getTime();
    const isWeekend = [0, 6].includes(start.getUTCDay());
    const allowed = includeWeekends || !isWeekend;
    if (allowed && blockStartMs >= windowStartMs && blockStartMs <= windowEndMs) {
      occurrences.push({
        time_block_id: block.id,
        scheduled_start: utcIso(start),
        scheduled_end: utcIso(new Date(start.getTime() + durationMs))
      });
    }
    if (includeNextAfter && allowed && blockStartMs >= new Date(includeNextAfter).getTime()) {
      nextAfter = {
        time_block_id: block.id,
        scheduled_start: utcIso(start),
        scheduled_end: utcIso(new Date(start.getTime() + durationMs))
      };
    }
    return { occurrences, nextAfter };
  }

  let cursor = new Date(start);
  for (let i = 0; i < maxIterations; i += 1) {
    if (hasExceededLimit(start, cursor, rule, config)) break;
    const cursorMs = cursor.getTime();
    const isWeekend = [0, 6].includes(cursor.getUTCDay());
    const allowed = includeWeekends || !isWeekend;
    if (allowed && cursorMs >= windowStartMs && cursorMs <= windowEndMs) {
      occurrences.push({
        time_block_id: block.id,
        scheduled_start: utcIso(cursor),
        scheduled_end: utcIso(new Date(cursorMs + durationMs))
      });
    }
    if (!nextAfter && includeNextAfter && allowed && cursorMs >= new Date(includeNextAfter).getTime()) {
      nextAfter = {
        time_block_id: block.id,
        scheduled_start: utcIso(cursor),
        scheduled_end: utcIso(new Date(cursorMs + durationMs))
      };
    }
    if (cursorMs > windowEndMs && nextAfter) break;
    cursor = shiftByRecurrence(cursor, rule, config);
  }

  return { occurrences, nextAfter };
};

const defaultLaneStatuses = (userId, laneId) => [
  {
    user_id: userId,
    lane_id: laneId,
    key: 'pending',
    name: 'To do',
    color: '#94a3b8',
    group_key: 'todo',
    order_num: 0,
    is_default: true
  },
  {
    user_id: userId,
    lane_id: laneId,
    key: 'in_progress',
    name: 'In progress',
    color: '#f59e0b',
    group_key: 'active',
    order_num: 1,
    is_default: false
  },
  {
    user_id: userId,
    lane_id: laneId,
    key: 'completed',
    name: 'Done',
    color: '#22c55e',
    group_key: 'done',
    order_num: 2,
    is_default: false
  }
];

const defaultLaneSubtaskStatuses = (userId, laneId) => [
  {
    user_id: userId,
    lane_id: laneId,
    key: 'not_started',
    name: 'Not started',
    color: '#94a3b8',
    group_key: 'todo',
    order_num: 0,
    is_default: true
  },
  {
    user_id: userId,
    lane_id: laneId,
    key: 'done',
    name: 'Done',
    color: '#22c55e',
    group_key: 'done',
    order_num: 1,
    is_default: false
  }
];

const stableHash = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash * 31) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
};

// Focal Board Service - uses shared Supabase client
export const focalBoardService = {
  // FOCALS
  async getFocals(userId) {
    try {
      const { data, error } = await withTimeout(
        supabase
        .from('focals')
        .select('*')
        .eq('user_id', userId)
        .order('order_num', { ascending: true }),
        FOCALS_TIMEOUT_MS,
        'Focals request timed out'
      );

      if (error) {
        if (error.message?.includes('does not exist')) {
          throw new Error('Focals table does not exist. Please run the database schema setup.');
        }
        throw error;
      }

      const { error: statusesError } = await supabase
        .from('lane_statuses')
        .insert(defaultLaneStatuses(userId, data.id));
      if (statusesError && !isMissingLaneStatusesTableError(statusesError)) {
        console.warn('Failed to seed lane statuses:', statusesError.message);
      }

      return data;
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error('Loading focals timed out. Please try again.');
      }
      throw error;
    }
  },

  async createFocal(userId, name) {
    try {
      const { data: existingFocals } = await supabase
        .from('focals')
        .select('order_num')
        .eq('user_id', userId)
        .order('order_num', { ascending: false })
        .limit(1);

      const nextOrder = existingFocals?.[0]?.order_num + 1 || 0;

      const focalData = {
        name, 
        user_id: userId, 
        order_num: nextOrder
      };

      const { data, error } = await supabase
        .from('focals')
        .insert([focalData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  async updateFocal(id, updates) {
    const { data, error } = await supabase
      .from('focals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteFocal(id) {
    const { error } = await supabase
      .from('focals')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // LANES
  async getLanes(focalId) {
    const { data, error } = await supabase
      .from('lanes')
      .select('*')
      .eq('focal_id', focalId)
      .order('order_num', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async getListsForFocal(focalId) {
    let { data, error } = await supabase
      .from('lanes')
      .select('id,focal_id,user_id,name,item_label,action_label,order_num,mode')
      .eq('focal_id', focalId)
      .order('order_num', { ascending: true });

    if (error && (isMissingItemLabelColumnError(error) || isMissingActionLabelColumnError(error) || isMissingOrderNumColumnError(error) || isMissingLanesModeColumnError(error))) {
      const fallback = await this.getLanes(focalId);
      data = fallback;
      error = null;
    }

    if (error) throw error;
    return (data || []).map((lane, index) => ({
      ...lane,
      item_label: lane.item_label || 'Items',
      action_label: lane.action_label || 'Tasks',
      order_num: lane.order_num ?? index,
      mode: lane.mode || 'one_off'
    }));
  },

  async getListsForUser(userId) {
    let { data, error } = await supabase
      .from('lanes')
      .select('id,focal_id,user_id,name,item_label,action_label,order_num,mode')
      .eq('user_id', userId)
      .order('order_num', { ascending: true });

    if (error && (isMissingItemLabelColumnError(error) || isMissingActionLabelColumnError(error) || isMissingOrderNumColumnError(error) || isMissingLanesModeColumnError(error))) {
      const fallback = await supabase
        .from('lanes')
        .select('id,focal_id,user_id,name')
        .eq('user_id', userId);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return (data || []).map((lane, index) => ({
      ...lane,
      item_label: lane.item_label || 'Items',
      action_label: lane.action_label || 'Tasks',
      order_num: lane.order_num ?? index,
      mode: lane.mode || 'one_off'
    }));
  },

  async getListDetail(listId) {
    let { data, error } = await supabase
      .from('lanes')
      .select(`
        *,
        focals (id, name),
        lane_statuses (*),
        items (
          *,
          actions (*)
        )
      `)
      .eq('id', listId)
      .maybeSingle();

    if (error && isMissingLaneStatusesTableError(error)) {
      const fallback = await supabase
        .from('lanes')
        .select(`
          *,
          focals (id, name),
          items (
            *,
            actions (*)
          )
        `)
        .eq('id', listId)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error && isNoRowsSingleResultError(error)) {
      return null;
    }
    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      mode: data.mode || 'one_off'
    };
  },

  async getListById(listId) {
    if (!listId) {
      throw new Error('listId is required');
    }
    return this.getListDetail(listId);
  },

  async getItemsByListId(listId) {
    if (!listId) {
      throw new Error('listId is required');
    }
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        actions (*)
      `)
      .eq('lane_id', listId)
      .order('order_num', { ascending: true });
    if (error) {
      throw error;
    }
    return data || [];
  },

  async createLane(focalId, userId, name, itemLabel = null, actionLabel = null) {
    try {
      const nextOrder = 0;

      const laneData = {
        focal_id: focalId,
        user_id: userId,
        name,
        item_label: itemLabel,
        action_label: actionLabel,
        order_num: nextOrder
      };

      let { data, error } = await supabase
        .from('lanes')
        .insert([laneData])
        .select()
        .single();

      if (error && isMissingActionLabelColumnError(error)) {
        const { action_label, ...fallbackLaneData } = laneData;
        const fallbackResult = await supabase
          .from('lanes')
          .insert([fallbackLaneData])
          .select()
          .single();
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        if (error.message?.includes('does not exist')) {
          throw new Error('Lanes table does not exist. Please run the database schema setup.');
        }
        throw error;
      }

      const { error: subtaskStatusesError } = await supabase
        .from('lane_subtask_statuses')
        .insert(defaultLaneSubtaskStatuses(userId, data.id));
      if (subtaskStatusesError && !isMissingLaneSubtaskStatusesTableError(subtaskStatusesError)) {
        console.warn('Failed to seed lane subtask statuses:', subtaskStatusesError.message);
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  async updateLane(id, updates) {
    let { data, error } = await supabase
      .from('lanes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error && (isMissingActionLabelColumnError(error) || isMissingLanesModeColumnError(error))) {
      const { action_label, mode, ...fallbackUpdates } = updates;
      const fallbackResult = await supabase
        .from('lanes')
        .update(fallbackUpdates)
        .eq('id', id)
        .select()
        .single();
      data = fallbackResult.data;
      error = fallbackResult.error;
    }
    
    if (error) throw error;
    return data;
  },

  async deleteLane(id) {
    const { error } = await supabase
      .from('lanes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async updateListMode(listId, mode) {
    if (mode !== 'one_off' && mode !== 'recurring') {
      throw new Error('Invalid list mode');
    }
    const updated = await this.updateLane(listId, { mode });
    return { ...updated, mode: updated?.mode || mode };
  },

  // LANE STATUSES
  async getLaneStatuses(laneId) {
    const { data, error } = await supabase
      .from('lane_statuses')
      .select('*')
      .eq('lane_id', laneId)
      .order('order_num', { ascending: true });

    if (error) {
      if (isMissingLaneStatusesTableError(error)) {
        return [];
      }
      throw error;
    }
    return data;
  },

  async getLaneSubtaskStatuses(laneId) {
    const { data, error } = await supabase
      .from('lane_subtask_statuses')
      .select('*')
      .eq('lane_id', laneId)
      .order('order_num', { ascending: true });

    if (error) {
      if (isMissingLaneSubtaskStatusesTableError(error)) {
        return [];
      }
      throw error;
    }
    return data;
  },

  async createLaneStatus(laneId, userId, payload) {
    const { data, error } = await supabase
      .from('lane_statuses')
      .insert([{
        lane_id: laneId,
        user_id: userId,
        key: payload.key,
        name: payload.name,
        color: payload.color,
        group_key: payload.group_key ?? 'todo',
        order_num: payload.order_num ?? 0,
        is_default: Boolean(payload.is_default)
      }])
      .select()
      .single();

    if (error) {
      if (isMissingLaneStatusesTableError(error)) {
        throw new Error('Lane statuses table does not exist. Run the latest migration.');
      }
      throw error;
    }
    return data;
  },

  async createLaneSubtaskStatus(laneId, userId, payload) {
    const { data, error } = await supabase
      .from('lane_subtask_statuses')
      .insert([{
        lane_id: laneId,
        user_id: userId,
        key: payload.key,
        name: payload.name,
        color: payload.color,
        group_key: payload.group_key ?? 'todo',
        order_num: payload.order_num ?? 0,
        is_default: Boolean(payload.is_default)
      }])
      .select()
      .single();

    if (error) {
      if (isMissingLaneSubtaskStatusesTableError(error)) {
        throw new Error('Lane subtask statuses table does not exist. Run the latest migration.');
      }
      throw error;
    }
    return data;
  },

  async updateLaneStatus(id, updates) {
    const { data, error } = await supabase
      .from('lane_statuses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (isMissingLaneStatusesTableError(error)) {
        throw new Error('Lane statuses table does not exist. Run the latest migration.');
      }
      throw error;
    }
    return data;
  },

  async updateLaneSubtaskStatus(id, updates) {
    const { data, error } = await supabase
      .from('lane_subtask_statuses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (isMissingLaneSubtaskStatusesTableError(error)) {
        throw new Error('Lane subtask statuses table does not exist. Run the latest migration.');
      }
      throw error;
    }
    return data;
  },

  async deleteLaneStatus(id) {
    const { error } = await supabase
      .from('lane_statuses')
      .delete()
      .eq('id', id);

    if (error) {
      if (isMissingLaneStatusesTableError(error)) {
        throw new Error('Lane statuses table does not exist. Run the latest migration.');
      }
      throw error;
    }
  },

  async deleteLaneSubtaskStatus(id) {
    const { error } = await supabase
      .from('lane_subtask_statuses')
      .delete()
      .eq('id', id);

    if (error) {
      if (isMissingLaneSubtaskStatusesTableError(error)) {
        throw new Error('Lane subtask statuses table does not exist. Run the latest migration.');
      }
      throw error;
    }
  },

  // ITEMS
  async getItems(laneId) {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('lane_id', laneId)
      .order('order_num', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async createItem(laneId, userId, title, description = null) {
    try {
      const nextOrder = 0;

      const itemData = {
        lane_id: laneId ?? null,
        user_id: userId,
        title,
        description,
        status: 'pending',
        order_num: nextOrder
      };

      const { data, error } = await supabase
        .from('items')
        .insert([itemData])
        .select()
        .single();

      if (error) {
        if (error.message?.includes('does not exist')) {
          throw new Error('Items table does not exist. Please run the database schema setup.');
        }
        throw error;
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  async updateItem(id, updates) {
    let { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error && isMissingItemsStatusIdColumnError(error)) {
      const { status_id, ...fallbackUpdates } = updates;
      const fallbackResult = await supabase
        .from('items')
        .update(fallbackUpdates)
        .eq('id', id)
        .select()
        .single();
      data = fallbackResult.data;
      error = fallbackResult.error;
    }
    
    if (error) throw error;
    return data;
  },

  async deleteItem(id) {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // ACTIONS
  async getActions(itemId) {
    const { data, error } = await supabase
      .from('actions')
      .select('*')
      .eq('item_id', itemId)
      .order('order_num', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async createAction(itemId, userId, title, description = null, scheduledAt = null, subtaskStatus = null) {
    // Get the highest order_num for this item
    const { data: existingActions } = await supabase
      .from('actions')
      .select('order_num')
      .eq('item_id', itemId)
      .order('order_num', { ascending: false })
      .limit(1);
    
    const nextOrder = existingActions?.[0]?.order_num + 1 || 0;
    
    const { data, error } = await supabase
      .from('actions')
      .insert([{
        item_id: itemId,
        user_id: userId,
        title,
        description,
        status: subtaskStatus?.key || 'not_started',
        subtask_status_id: subtaskStatus?.id || null,
        scheduled_at: scheduledAt,
        order_num: nextOrder
      }])
      .select()
      .single();

    if (error && isMissingActionsSubtaskStatusIdColumnError(error)) {
      const fallback = await supabase
        .from('actions')
        .insert([{
          item_id: itemId,
          user_id: userId,
          title,
          description,
          status: subtaskStatus?.key || 'not_started',
          scheduled_at: scheduledAt,
          order_num: nextOrder
        }])
        .select()
        .single();
      if (fallback.error) throw fallback.error;
      return fallback.data;
    }
    if (error) throw error;
    return data;
  },

  async linkActionToTimeBlock({ actionId, timeBlockId, userId, laneId = null }) {
    if (!actionId || !timeBlockId || !userId) {
      throw new Error('actionId, timeBlockId, and userId are required');
    }
    const row = {
      user_id: userId,
      time_block_id: timeBlockId,
      lane_id: laneId,
      item_id: null,
      action_id: actionId,
      link_type: 'action'
    };
    const { data, error } = await supabase
      .from('time_block_links')
      .insert([row])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // SIGNALS
  async updateItemSignal(itemId, signalLabel, signalScore) {
    const updates = {
      signal_label: signalLabel,
      signal_score: signalScore
    };
    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateAction(id, updates) {
    let { data, error } = await supabase
      .from('actions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error && isMissingActionsSubtaskStatusIdColumnError(error)) {
      const { subtask_status_id, ...fallbackUpdates } = updates;
      const fallback = await supabase
        .from('actions')
        .update(fallbackUpdates)
        .eq('id', id)
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data;
  },

  async deleteAction(id) {
    const { error } = await supabase
      .from('actions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // ITEM COMMENTS
  async getItemComments(itemId) {
    const { data, error } = await supabase
      .from('item_comments')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingItemCommentsTableError(error)) {
        return [];
      }
      throw error;
    }
    return data || [];
  },

  async createItemComment(itemId, userId, body) {
    const { data, error } = await supabase
      .from('item_comments')
      .insert([{ item_id: itemId, user_id: userId, body }])
      .select()
      .single();

    if (error) {
      if (isMissingItemCommentsTableError(error)) {
        throw new Error('Item comments table does not exist. Run the latest migration.');
      }
      throw error;
    }
    return data;
  },

  // SCOPED THREADS/COMMENTS (item | action | timeblock)
  async getThread(scopeType, scopeId) {
    return threadService.getThreadByScope({ scope: scopeType, scope_id: scopeId });
  },

  async getOrCreateThread(scopeType, scopeId, userId) {
    return threadService.getOrCreateThread({ scope: scopeType, scope_id: scopeId, user_id: userId });
  },

  async getScopedComments(scopeType, scopeId, userId) {
    void userId;
    const thread = await this.getThread(scopeType, scopeId);
    if (!thread) {
      return [];
    }
    try {
      return await threadService.listComments(thread.id, { limit: 200 });
    } catch (error) {
      if (isMissingCommentsTableError(error) || isMissingThreadsTableError(error)) {
        return [];
      }
      throw error;
    }
  },

  async createScopedComment(scopeType, scopeId, userId, content, authorType = 'user') {
    const thread = await this.getOrCreateThread(scopeType, scopeId, userId);
    return threadService.addComment({
      thread_id: thread.id,
      body: content,
      source: authorType
    });
  },

  async setOccurrenceCompletion({ itemId, actionId, timeBlockId, scheduledStartUtc, scheduledEndUtc, checked, userId }) {
    if (actionId && !itemId) {
      return this.setTaskOccurrenceCompletion({
        actionId,
        timeBlockId,
        scheduledStartUtc,
        scheduledEndUtc,
        checked,
        userId
      });
    }
    if (!itemId) {
      throw new Error('itemId is required');
    }

    const { data: actions, error: actionsError } = await supabase
      .from('actions')
      .select('id')
      .eq('item_id', itemId);
    if (actionsError && !isMissingTableOrSchemaCacheError(actionsError, 'actions')) {
      throw actionsError;
    }
    if ((actions || []).length > 0) {
      const nowIso = new Date().toISOString();
      const scheduledStart = utcIso(scheduledStartUtc);
      const scheduledEnd = utcIso(scheduledEndUtc);
      const rows = (actions || []).map((row) => ({
        user_id: userId,
        action_id: row.id,
        time_block_id: timeBlockId,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        completion_state: checked ? 'completed' : 'pending',
        completed_at: checked ? nowIso : null,
        updated_at: nowIso
      }));

      const { data, error } = await supabase
        .from('action_occurrences')
        .upsert(rows, { onConflict: 'action_id,time_block_id,scheduled_start' })
        .select();

      if (!error) {
        return (data || [])[0] || null;
      }
      if (!isMissingActionOccurrencesTableError(error)) {
        throw error;
      }
    }

    const scheduledStart = utcIso(scheduledStartUtc);
    const scheduledEnd = utcIso(scheduledEndUtc);
    const row = {
      user_id: userId,
      item_id: itemId,
      time_block_id: timeBlockId,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      completion_state: checked ? 'completed' : 'pending',
      completed_at: checked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('item_occurrences')
      .upsert(row, { onConflict: 'item_id,time_block_id,scheduled_start' })
      .select()
      .single();

    if (error) {
      if (isMissingItemOccurrencesTableError(error)) {
        throw new Error('Item occurrences table does not exist. Run the latest migration.');
      }
      throw error;
    }
    return data;
  },

  async setTaskOccurrenceCompletion({ actionId, timeBlockId, scheduledStartUtc, scheduledEndUtc, checked, userId }) {
    if (!actionId || !timeBlockId || !scheduledStartUtc || !scheduledEndUtc || !userId) {
      throw new Error('actionId, timeBlockId, scheduledStartUtc, scheduledEndUtc, and userId are required');
    }

    const scheduledStart = utcIso(scheduledStartUtc);
    const scheduledEnd = utcIso(scheduledEndUtc);
    const row = {
      user_id: userId,
      action_id: actionId,
      time_block_id: timeBlockId,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      completion_state: checked ? 'completed' : 'pending',
      completed_at: checked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('action_occurrences')
      .upsert(row, { onConflict: 'action_id,time_block_id,scheduled_start' })
      .select()
      .single();

    if (error) {
      if (isMissingActionOccurrencesTableError(error)) {
        throw new Error('Action occurrences table does not exist. Run the latest migration.');
      }
      throw error;
    }
    return data;
  },

  async getRecurringListMvpView(listId, weekStartUtc, weekEndUtc) {
    const list = await this.getListDetail(listId);
    const weekStart = weekStartUtc ? new Date(weekStartUtc) : getUtcWeekStart(new Date());
    const weekEnd = weekEndUtc ? new Date(weekEndUtc) : getUtcWeekEnd(weekStart);
    const now = new Date();
    const lookbackStart = addDays(weekStart, -84);

    const itemIds = (list.items || []).map((item) => item.id);
    if (itemIds.length === 0) {
      return {
        list,
        week_start: utcIso(weekStart),
        week_end: utcIso(weekEnd),
        summary: { scheduled_count: 0, completed_count: 0, task_scheduled_count: 0, task_completed_count: 0 },
        items: []
      };
    }

    const linksQuery = await supabase
      .from('time_block_links')
      .select('time_block_id,item_id,link_type,user_id')
      .eq('lane_id', listId)
      .eq('link_type', 'item')
      .in('item_id', itemIds);

    if (linksQuery.error) {
      if (isMissingTimeBlockLinksTableError(linksQuery.error)) {
        return {
          list,
          week_start: utcIso(weekStart),
          week_end: utcIso(weekEnd),
          summary: { scheduled_count: 0, completed_count: 0, task_scheduled_count: 0, task_completed_count: 0 },
          items: (list.items || []).map((item) => ({
            ...item,
            recurring: {
              scheduled_count: 0,
              completed_count: 0,
              task_scheduled_count: 0,
              task_completed_count: 0,
              active_task_total_count: 0,
              active_task_completed_count: 0,
              active_completion_state: 'pending',
              streak: 0,
              next_occurrence: null,
              last_completed: null,
              current_or_next_occurrence: null
            }
          }))
        };
      }
      throw linksQuery.error;
    }

    const links = linksQuery.data || [];
    if (links.length === 0) {
      return {
        list,
        week_start: utcIso(weekStart),
        week_end: utcIso(weekEnd),
        summary: { scheduled_count: 0, completed_count: 0, task_scheduled_count: 0, task_completed_count: 0 },
        items: (list.items || []).map((item) => ({
          ...item,
          recurring: {
            scheduled_count: 0,
            completed_count: 0,
            task_scheduled_count: 0,
            task_completed_count: 0,
            active_completion_state: 'pending',
            streak: 0,
            next_occurrence: null,
            last_completed: null,
            current_or_next_occurrence: null
          }
        }))
      };
    }

    const timeBlockIds = [...new Set(links.map((entry) => entry.time_block_id).filter(Boolean))];
    const timeBlocksResult = await supabase
      .from('time_blocks')
      .select('id,start_time,end_time,recurrence_rule,recurrence_config,include_weekends')
      .in('id', timeBlockIds);
    if (timeBlocksResult.error) {
      if (isMissingTimeBlocksTableError(timeBlocksResult.error)) {
        return {
          list,
          week_start: utcIso(weekStart),
          week_end: utcIso(weekEnd),
          summary: { scheduled_count: 0, completed_count: 0, task_scheduled_count: 0, task_completed_count: 0 },
          items: (list.items || []).map((item) => ({
            ...item,
            recurring: {
              scheduled_count: 0,
              completed_count: 0,
              task_scheduled_count: 0,
              task_completed_count: 0,
              active_completion_state: 'pending',
              streak: 0,
              next_occurrence: null,
              last_completed: null,
              current_or_next_occurrence: null
            }
          }))
        };
      }
      throw timeBlocksResult.error;
    }

    const blocksById = new Map((timeBlocksResult.data || []).map((entry) => [entry.id, entry]));
    const linkByItem = new Map();
    for (const link of links) {
      const existing = linkByItem.get(link.item_id) || [];
      existing.push(link);
      linkByItem.set(link.item_id, existing);
    }

    const actionsResult = await supabase
      .from('actions')
      .select('id,item_id')
      .in('item_id', itemIds);

    if (actionsResult.error && !isMissingTableOrSchemaCacheError(actionsResult.error, 'actions')) {
      throw actionsResult.error;
    }

    const actionsByItemId = new Map();
    const actionIdToItemId = new Map();
    for (const row of actionsResult.data || []) {
      const existing = actionsByItemId.get(row.item_id) || [];
      existing.push(row.id);
      actionsByItemId.set(row.item_id, existing);
      actionIdToItemId.set(row.id, row.item_id);
    }
    const actionIds = [...new Set((actionsResult.data || []).map((row) => row.id).filter(Boolean))];
    const itemIdsWithActions = new Set(actionsByItemId.keys());

    const occurrencesResult = await supabase
      .from('item_occurrences')
      .select('item_id,time_block_id,scheduled_start,scheduled_end,completion_state,completed_at')
      .in('item_id', itemIds)
      .gte('scheduled_start', utcIso(lookbackStart))
      .lte('scheduled_start', utcIso(addDays(weekEnd, 35)));

    if (occurrencesResult.error && !isMissingItemOccurrencesTableError(occurrencesResult.error)) {
      throw occurrencesResult.error;
    }
    const occurrenceRows = occurrencesResult.error ? [] : (occurrencesResult.data || []);
    const occurrenceMap = new Map();
    for (const row of occurrenceRows) {
      occurrenceMap.set(`${row.item_id}:${row.time_block_id}:${utcIso(row.scheduled_start)}`, row);
    }

    let actionOccurrenceRows = [];
    if (actionIds.length > 0) {
      const actionOccurrencesResult = await supabase
        .from('action_occurrences')
        .select('action_id,time_block_id,scheduled_start,scheduled_end,completion_state,completed_at')
        .in('action_id', actionIds)
        .gte('scheduled_start', utcIso(lookbackStart))
        .lte('scheduled_start', utcIso(addDays(weekEnd, 35)));

      if (actionOccurrencesResult.error && !isMissingActionOccurrencesTableError(actionOccurrencesResult.error)) {
        throw actionOccurrencesResult.error;
      }
      actionOccurrenceRows = actionOccurrencesResult.error ? [] : (actionOccurrencesResult.data || []);
    }

    const actionCompletionMap = new Map();
    const actionCompletedRowsByItem = new Map();
    for (const row of actionOccurrenceRows) {
      const itemId = actionIdToItemId.get(row.action_id);
      if (!itemId) continue;
      const key = `${itemId}:${row.time_block_id}:${utcIso(row.scheduled_start)}`;
      const existingState = actionCompletionMap.get(key) || 'pending';
      if (row.completion_state === 'completed') {
        actionCompletionMap.set(key, 'completed');
      } else if (!actionCompletionMap.has(key)) {
        actionCompletionMap.set(key, existingState);
      }
      if (row.completion_state === 'completed') {
        const list = actionCompletedRowsByItem.get(itemId) || [];
        list.push({
          item_id: itemId,
          time_block_id: row.time_block_id,
          scheduled_start: row.scheduled_start,
          scheduled_end: row.scheduled_end,
          completion_state: row.completion_state,
          completed_at: row.completed_at
        });
        actionCompletedRowsByItem.set(itemId, list);
      }
    }

    let totalScheduled = 0;
    let totalCompleted = 0;
    let totalTaskScheduled = 0;
    let totalTaskCompleted = 0;

    const recurringItems = (list.items || []).map((item) => {
      const itemLinks = linkByItem.get(item.id) || [];
      const thisWeekExpected = [];
      const lookbackExpected = [];
      const nextCandidates = [];

      for (const link of itemLinks) {
        const block = blocksById.get(link.time_block_id);
        if (!block) continue;

        const weekSet = generateOccurrencesForTimeBlock({
          block,
          rangeStart: weekStart,
          rangeEnd: weekEnd,
          includeNextAfter: now
        });
        const pastSet = generateOccurrencesForTimeBlock({
          block,
          rangeStart: lookbackStart,
          rangeEnd: now,
          includeNextAfter: null
        });

        weekSet.occurrences.forEach((occ) => thisWeekExpected.push(occ));
        pastSet.occurrences.forEach((occ) => lookbackExpected.push(occ));
        if (weekSet.nextAfter) {
          nextCandidates.push(weekSet.nextAfter);
        }
      }

      const uniqueThisWeek = [...new Map(thisWeekExpected.map((occ) => [`${occ.time_block_id}:${occ.scheduled_start}`, occ])).values()]
        .sort((a, b) => utcMs(a.scheduled_start) - utcMs(b.scheduled_start));

      const uniquePast = [...new Map(lookbackExpected.map((occ) => [`${occ.time_block_id}:${occ.scheduled_start}`, occ])).values()]
        .sort((a, b) => utcMs(b.scheduled_start) - utcMs(a.scheduled_start));

      const getCompletionStateForOccurrence = (occurrence) => {
        const key = `${item.id}:${occurrence.time_block_id}:${occurrence.scheduled_start}`;
        if (itemIdsWithActions.has(item.id)) {
          return actionCompletionMap.get(key) || 'pending';
        }
        const row = occurrenceMap.get(key);
        return row?.completion_state || 'pending';
      };

      const completedThisWeek = uniqueThisWeek.filter((occ) => {
        return getCompletionStateForOccurrence(occ) === 'completed';
      }).length;

      let streak = 0;
      for (const occ of uniquePast) {
        if (getCompletionStateForOccurrence(occ) === 'completed') {
          streak += 1;
        } else {
          break;
        }
      }

      const completedRows = (
        itemIdsWithActions.has(item.id)
          ? (actionCompletedRowsByItem.get(item.id) || [])
          : occurrenceRows.filter((row) => row.item_id === item.id && row.completion_state === 'completed')
      ).sort((a, b) => utcMs(b.completed_at || b.scheduled_start) - utcMs(a.completed_at || a.scheduled_start));

      const actionIdsForItem = actionsByItemId.get(item.id) || [];
      const hasTasks = actionIdsForItem.length > 0;
      const actionIdSetForItem = new Set(actionIdsForItem);
      const taskScheduledCount = hasTasks
        ? uniqueThisWeek.length * actionIdsForItem.length
        : uniqueThisWeek.length;
      const taskCompletedCount = hasTasks
        ? actionOccurrenceRows.filter((row) => {
            if (row.completion_state !== 'completed') return false;
            if (!actionIdSetForItem.has(row.action_id)) return false;
            const startMs = utcMs(row.scheduled_start);
            return startMs >= weekStart.getTime() && startMs <= weekEnd.getTime();
          }).length
        : completedThisWeek;
      const activeTaskTotalCount = hasTasks ? actionIdsForItem.length : 0;
      const activeTaskCompletedCount =
        hasTasks && activeOccurrence
          ? actionOccurrenceRows.filter((row) => {
              if (!actionIdSetForItem.has(row.action_id)) return false;
              if (row.completion_state !== 'completed') return false;
              return (
                row.time_block_id === activeOccurrence.time_block_id &&
                utcIso(row.scheduled_start) === activeOccurrence.scheduled_start
              );
            }).length
          : 0;

      const nextOccurrence = nextCandidates.sort((a, b) => utcMs(a.scheduled_start) - utcMs(b.scheduled_start))[0] || null;
      const activeOccurrence =
        uniqueThisWeek.find((occ) => {
          const startMs = utcMs(occ.scheduled_start);
          const endMs = utcMs(occ.scheduled_end);
          const nowMs = now.getTime();
          return nowMs >= startMs && nowMs <= endMs;
        }) || nextOccurrence;
      const activeCompletionState = activeOccurrence ? getCompletionStateForOccurrence(activeOccurrence) : 'pending';

      const recurringTasks = (item.actions || []).map((action) => {
        const thisWeekForTask = uniqueThisWeek;
        const pastForTask = uniquePast;
        const completedTaskThisWeek = actionOccurrenceRows.filter((row) => {
          if (row.action_id !== action.id) return false;
          if (row.completion_state !== 'completed') return false;
          const startMs = utcMs(row.scheduled_start);
          return startMs >= weekStart.getTime() && startMs <= weekEnd.getTime();
        }).length;

        let taskStreak = 0;
        for (const occ of pastForTask) {
          const row = actionOccurrenceRows.find(
            (entry) =>
              entry.action_id === action.id &&
              entry.time_block_id === occ.time_block_id &&
              utcIso(entry.scheduled_start) === occ.scheduled_start
          );
          if (row?.completion_state === 'completed') {
            taskStreak += 1;
          } else {
            break;
          }
        }

        const nextTaskOccurrence = nextOccurrence;
        const activeTaskOccurrence = activeOccurrence || nextTaskOccurrence;
        const activeTaskCompletionState = activeTaskOccurrence
          ? (
              actionOccurrenceRows.find(
                (entry) =>
                  entry.action_id === action.id &&
                  entry.time_block_id === activeTaskOccurrence.time_block_id &&
                  utcIso(entry.scheduled_start) === activeTaskOccurrence.scheduled_start
              )?.completion_state || 'pending'
            )
          : 'pending';

        const taskLastCompleted =
          actionOccurrenceRows
            .filter((row) => row.action_id === action.id && row.completion_state === 'completed')
            .sort((a, b) => utcMs(b.completed_at || b.scheduled_start) - utcMs(a.completed_at || a.scheduled_start))[0] || null;

        return {
          ...action,
          recurring: {
            scheduled_count: thisWeekForTask.length,
            completed_count: completedTaskThisWeek,
            streak: taskStreak,
            next_occurrence: nextTaskOccurrence,
            current_or_next_occurrence: activeTaskOccurrence,
            last_completed: taskLastCompleted,
            active_completion_state: activeTaskCompletionState
          }
        };
      });

      totalScheduled += uniqueThisWeek.length;
      totalCompleted += completedThisWeek;
      totalTaskScheduled += taskScheduledCount;
      totalTaskCompleted += taskCompletedCount;

      return {
        ...item,
        actions: recurringTasks,
        recurring: {
          scheduled_count: uniqueThisWeek.length,
          completed_count: completedThisWeek,
          task_scheduled_count: taskScheduledCount,
          task_completed_count: taskCompletedCount,
          active_task_total_count: activeTaskTotalCount,
          active_task_completed_count: activeTaskCompletedCount,
          active_completion_state: activeCompletionState,
          streak,
          next_occurrence: nextOccurrence,
          current_or_next_occurrence: activeOccurrence,
          last_completed: completedRows[0] || null
        }
      };
    });

    return {
      list,
      week_start: utcIso(weekStart),
      week_end: utcIso(weekEnd),
      summary: {
        scheduled_count: totalScheduled,
        completed_count: totalCompleted,
        task_scheduled_count: totalTaskScheduled,
        task_completed_count: totalTaskCompleted
      },
      items: recurringItems
    };
  },

  // OPTIMIZATION (read-only proposals from edge function)
  async getOptimizationProposal(payload) {
    const { data, error } = await supabase.functions.invoke('optimization-pull', {
      body: payload
    });
    if (error) {
      throw error;
    }

    const strictCandidate = data?.proposal || data;
    const validation = validateOptimizationProposalOrFallback(strictCandidate);

    if (!validation.valid) {
      return {
        source: 'heuristic',
        proposal: validation.value,
        proposals: [],
        contract_valid: false,
        contract_errors: validation.errors
      };
    }

    return {
      source: data?.source || (validation.value.source === 'ai' ? 'groq' : 'heuristic'),
      proposal: validation.value,
      proposals: Array.isArray(data?.proposals) ? data.proposals : [],
      contract_valid: true,
      contract_errors: []
    };
  },

  async applyChatProposalAtomic({ userId, proposal, noteOverride = null, idempotencyKey = null }) {
    if (!userId) throw new Error('Sign in is required to apply action proposals');
    if (!proposal?.type) throw new Error('Invalid proposal payload');

    const key =
      idempotencyKey ||
      proposal.id ||
      `chat:${proposal.type}:${stableHash(JSON.stringify({ userId, proposal, noteOverride: noteOverride || null }))}`;

    const { data, error } = await supabase.rpc('apply_chat_proposal', {
      p_idempotency_key: key,
      p_proposal: proposal,
      p_note_override: noteOverride
    });
    if (error) throw error;
    return data || { status: 'applied', type: proposal.type };
  },

  // BATCH OPERATIONS
  async getFullFocalData(focalId) {
    try {
      let { data, error } = await withTimeout(
        supabase
        .from('lanes')
        .select(`
          *,
          lane_statuses (*),
          items (
            *,
            actions (*)
          )
        `)
        .eq('focal_id', focalId)
        .order('order_num', { ascending: true }),
        FULL_FOCAL_TIMEOUT_MS,
        'Focal data request timed out'
      );

      if (error && isMissingLaneStatusesTableError(error)) {
        const fallback = await withTimeout(
          supabase
            .from('lanes')
            .select(`
              *,
              items (
                *,
                actions (*)
              )
            `)
            .eq('focal_id', focalId)
            .order('order_num', { ascending: true }),
          FULL_FOCAL_TIMEOUT_MS,
          'Focal data request timed out'
        );
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        if (error.message?.includes('does not exist')) {
          return [];
        }
        throw error;
      }

      return data;
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error('Loading focal data timed out. Please try again.');
      }
      if (error.message?.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }
};

export default focalBoardService;
