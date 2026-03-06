import { supabase } from './supabaseClient.js';

const DEFAULT_TIMEZONE = 'America/Denver';

const isMissingActionLabelColumnError = (error) =>
  Boolean(
    error?.message &&
      error.message.includes("'action_label'") &&
      error.message.includes("'lanes'") &&
      error.message.toLowerCase().includes('schema cache')
  );

const isMissingTableOrSchemaCacheError = (error, tableName) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes(tableName.toLowerCase()) &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingColumnOrSchemaCacheError = (error, columnName) =>
  Boolean(
    error?.message &&
      error.message.toLowerCase().includes(columnName.toLowerCase()) &&
      (error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('schema cache'))
  );

const isMissingTimeBlockContentRulesTableError = (error) =>
  isMissingTableOrSchemaCacheError(error, 'time_block_content_rules');

const isMissingItemOccurrencesTableError = (error) =>
  isMissingTableOrSchemaCacheError(error, 'item_occurrences');

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const parseAttachTag = (tag) => {
  if (!tag?.startsWith('attach:')) return null;
  const [, nodeId, mode] = tag.split(':');
  if (!nodeId) return null;
  if (mode !== 'node_only' && mode !== 'with_children') return null;
  return { nodeId, mode };
};

const parseAttachConfigTag = (tag) => {
  if (!tag?.startsWith('attachcfg:')) return null;
  const [, nodeId, recurrenceMode, recurrenceRule, intervalRaw, unit, limitType, countRaw, untilRaw] = tag.split(':');
  if (!nodeId) return null;
  if (recurrenceMode !== 'match_event' && recurrenceMode !== 'custom') return null;
  const interval = Math.max(1, Number.parseInt(intervalRaw || '1', 10));
  const count = countRaw ? Math.max(1, Number.parseInt(countRaw, 10)) : null;
  const safeUnit = unit === 'day' || unit === 'week' || unit === 'month' || unit === 'year' ? unit : 'week';
  const safeLimitType =
    limitType === 'count' || limitType === 'until' || limitType === 'indefinite' ? limitType : 'indefinite';
  return {
    nodeId,
    recurrenceMode,
    recurrenceRule: recurrenceRule || 'daily',
    recurrenceConfig: {
      interval,
      unit: safeUnit,
      limitType: safeLimitType,
      count: count ?? undefined,
      until: untilRaw || undefined
    }
  };
};

const parseRRuleWindow = (tags = []) => {
  const tag = tags.find((entry) => entry.startsWith('rrule_window:'));
  if (!tag) return { limitCount: null, limitUntil: null };
  const [, rawValue] = tag.split(':');
  if (!rawValue || rawValue === 'indefinite') {
    return { limitCount: null, limitUntil: null };
  }
  const parsedCount = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsedCount) || parsedCount <= 0) {
    return { limitCount: null, limitUntil: null };
  }
  return { limitCount: parsedCount, limitUntil: null };
};

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => typeof tag === 'string');
};

const rowToEvent = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  start: row.start_time,
  end: row.end_time,
  recurrence: row.recurrence_rule || 'none',
  recurrenceConfig: row.recurrence_config || undefined,
  includeWeekends: row.include_weekends ?? true,
  timezone: row.timezone || DEFAULT_TIMEZONE,
  tasks: [],
  tags: Array.isArray(row.tags) ? row.tags : []
});

const eventToRow = (userId, event) => ({
  id: event.id,
  user_id: userId,
  title: event.title,
  description: event.description || '',
  start_time: event.start,
  end_time: event.end,
  recurrence_rule: event.recurrence || 'none',
  recurrence_config: event.recurrenceConfig || null,
  include_weekends: event.includeWeekends ?? true,
  timezone: event.timezone || DEFAULT_TIMEZONE,
  tags: normalizeTags(event.tags)
});

const buildLinkContext = async (userId) => {
  const fetchFocals = async () => {
    const base = supabase.from('focals').select('id,name').eq('user_id', userId);
    let result = await base.order('order_num', { ascending: true });
    if (result.error && isMissingColumnOrSchemaCacheError(result.error, 'order_num')) {
      result = await base;
    }
    return result;
  };

  const fetchLanes = async () => {
    let base = supabase.from('lanes').select('id,focal_id,name,item_label,action_label').eq('user_id', userId);
    let result = await base.order('order_num', { ascending: true });

    if (result.error && isMissingActionLabelColumnError(result.error)) {
      base = supabase.from('lanes').select('id,focal_id,name,item_label').eq('user_id', userId);
      result = await base.order('order_num', { ascending: true });
    }

    if (result.error && isMissingColumnOrSchemaCacheError(result.error, 'order_num')) {
      result = await base;
    }
    return result;
  };

  const fetchItems = async () => {
    const base = supabase.from('items').select('id,lane_id,title').eq('user_id', userId);
    let result = await base.order('order_num', { ascending: true });
    if (result.error && isMissingColumnOrSchemaCacheError(result.error, 'order_num')) {
      result = await base;
    }
    if (result.error && isMissingTableOrSchemaCacheError(result.error, 'items')) {
      return { data: [], error: null };
    }
    return result;
  };

  const fetchActions = async () => {
    const base = supabase.from('actions').select('id,item_id,title').eq('user_id', userId);
    let result = await base.order('order_num', { ascending: true });
    if (result.error && isMissingColumnOrSchemaCacheError(result.error, 'order_num')) {
      result = await base;
    }
    if (result.error && isMissingTableOrSchemaCacheError(result.error, 'actions')) {
      return { data: [], error: null };
    }
    return result;
  };

  const [{ data: focals, error: focalsError }, { data: lanes, error: lanesError }, { data: items, error: itemsError }, { data: actions, error: actionsError }] =
    await Promise.all([fetchFocals(), fetchLanes(), fetchItems(), fetchActions()]);

  if (focalsError) throw focalsError;
  if (lanesError) throw lanesError;
  if (itemsError) throw itemsError;
  if (actionsError) throw actionsError;

  const focalToLanes = new Map();
  const laneToItems = new Map();
  const itemToActions = new Map();
  const laneToActions = new Map();
  const itemToLane = new Map();
  const actionToItem = new Map();
  const actionToLane = new Map();

  for (const lane of lanes || []) {
    const list = focalToLanes.get(lane.focal_id) || [];
    list.push(lane.id);
    focalToLanes.set(lane.focal_id, list);
  }

  for (const item of items || []) {
    const list = laneToItems.get(item.lane_id) || [];
    list.push(item.id);
    laneToItems.set(item.lane_id, list);
    itemToLane.set(item.id, item.lane_id);
  }

  for (const action of actions || []) {
    const actionsForItem = itemToActions.get(action.item_id) || [];
    actionsForItem.push(action.id);
    itemToActions.set(action.item_id, actionsForItem);
    actionToItem.set(action.id, action.item_id);

    const laneId = itemToLane.get(action.item_id);
    if (laneId) {
      const actionsForLane = laneToActions.get(laneId) || [];
      actionsForLane.push(action.id);
      laneToActions.set(laneId, actionsForLane);
      actionToLane.set(action.id, laneId);
    }
  }

  return {
    focals: focals || [],
    lanes: lanes || [],
    items: items || [],
    actions: actions || [],
    focalToLanes,
    laneToItems,
    laneToActions,
    itemToActions,
    itemToLane,
    actionToItem,
    actionToLane
  };
};

const expandSelection = (selection, context) => {
  const itemIds = new Set();
  const actionIds = new Set();
  const addItem = (itemId, includeActions = false) => {
    itemIds.add(itemId);
    if (includeActions) {
      for (const actionId of context.itemToActions.get(itemId) || []) {
        actionIds.add(actionId);
      }
    }
  };

  for (const selected of selection) {
    const [kind, rawId] = selected.nodeId.split('|');
    if (!kind || !rawId) continue;
    const withChildren = selected.mode === 'with_children';

    if (kind === 'focal') {
      for (const laneId of context.focalToLanes.get(rawId) || []) {
        for (const itemId of context.laneToItems.get(laneId) || []) {
          addItem(itemId, withChildren);
        }
        if (withChildren) {
          for (const actionId of context.laneToActions.get(laneId) || []) {
            actionIds.add(actionId);
          }
        }
      }
      continue;
    }

    if (kind === 'lane') {
      for (const itemId of context.laneToItems.get(rawId) || []) {
        addItem(itemId, withChildren);
      }
      if (withChildren) {
        for (const actionId of context.laneToActions.get(rawId) || []) {
          actionIds.add(actionId);
        }
      }
      continue;
    }

    if (kind === 'item') {
      addItem(rawId, withChildren);
      continue;
    }

    if (kind === 'action') {
      actionIds.add(rawId);
    }
  }

  return { itemIds, actionIds };
};

const toLimitForConfig = (recurrenceConfig) => {
  if (!recurrenceConfig) {
    return { limitCount: null, limitUntil: null };
  }
  if (recurrenceConfig.limitType === 'count') {
    return { limitCount: recurrenceConfig.count ?? null, limitUntil: null };
  }
  if (recurrenceConfig.limitType === 'until') {
    return { limitCount: null, limitUntil: recurrenceConfig.until || null };
  }
  return { limitCount: null, limitUntil: null };
};

const resolveLinkRecurrence = (selectionConfig, event) => {
  if (selectionConfig?.recurrenceMode === 'custom') {
    const recurrenceRule = selectionConfig.recurrenceRule || 'daily';
    const recurrenceConfig = selectionConfig.recurrenceConfig || null;
    const { limitCount, limitUntil } = toLimitForConfig(recurrenceConfig);
    return {
      recurrenceMode: 'custom',
      recurrenceRule,
      recurrenceConfig,
      limitCount,
      limitUntil
    };
  }

  const { limitCount, limitUntil } = toLimitForConfig(event.recurrenceConfig);
  const fallback = parseRRuleWindow(event.tags);
  return {
    recurrenceMode: 'match_event',
    recurrenceRule: event.recurrence || 'none',
    recurrenceConfig: event.recurrenceConfig || null,
    limitCount: limitCount ?? fallback.limitCount,
    limitUntil: limitUntil ?? fallback.limitUntil
  };
};

const buildLinkRows = (userId, timeBlockId, itemConfigs, actionConfigs, context, event) => {
  const rows = [];

  for (const [itemId, selectionConfig] of itemConfigs.entries()) {
    const recurrence = resolveLinkRecurrence(selectionConfig, event);
    rows.push({
      user_id: userId,
      time_block_id: timeBlockId,
      lane_id: context.itemToLane.get(itemId) || null,
      item_id: itemId,
      action_id: null,
      link_type: 'item',
      recurrence_mode: recurrence.recurrenceMode,
      recurrence_rule: recurrence.recurrenceRule,
      recurrence_config: recurrence.recurrenceConfig,
      recurrence_limit_count: recurrence.limitCount,
      recurrence_limit_until: recurrence.limitUntil
    });
  }

  for (const [actionId, selectionConfig] of actionConfigs.entries()) {
    const recurrence = resolveLinkRecurrence(selectionConfig, event);
    rows.push({
      user_id: userId,
      time_block_id: timeBlockId,
      lane_id: context.actionToLane.get(actionId) || null,
      item_id: null,
      action_id: actionId,
      link_type: 'action',
      recurrence_mode: recurrence.recurrenceMode,
      recurrence_rule: recurrence.recurrenceRule,
      recurrence_config: recurrence.recurrenceConfig,
      recurrence_limit_count: recurrence.limitCount,
      recurrence_limit_until: recurrence.limitUntil
    });
  }

  return rows;
};

export const getWeekdayKeyForOccurrence = (occurrenceStart, timezone) => {
  const date = new Date(occurrenceStart);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    const weekdayShort = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
    }).format(date);
    const key = weekdayShort.toLowerCase().slice(0, 3);
    return WEEKDAY_KEYS.includes(key) ? key : null;
  } catch (_error) {
    return WEEKDAY_KEYS[date.getUTCDay()] || null;
  }
};

export const resolveItemsForOccurrence = ({ rules, occurrenceStart, weekday, timezone }) => {
  const safeRules = Array.isArray(rules) ? rules : [];
  const derivedWeekday = weekday || getWeekdayKeyForOccurrence(occurrenceStart, timezone);
  const result = new Set();

  for (const rule of safeRules) {
    if (rule.selector_type === 'all') {
      for (const itemId of rule.item_ids || []) {
        if (itemId) result.add(itemId);
      }
      continue;
    }
    if (rule.selector_type === 'weekday' && derivedWeekday && rule.selector_value === derivedWeekday) {
      for (const itemId of rule.item_ids || []) {
        if (itemId) result.add(itemId);
      }
    }
  }

  return [...result];
};

const getAuthedUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data?.user?.id;
  if (!userId) {
    throw new Error('Not authenticated');
  }
  return userId;
};

export const calendarService = {
  getWeekdayKeyForOccurrence,
  resolveItemsForOccurrence,
  resolveItemsForOccurrenceFromRules: resolveItemsForOccurrence,
  async getTimeBlocks(userId) {
    const { data, error } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });
    if (error) throw error;
    return (data || []).map(rowToEvent);
  },

  async upsertTimeBlock(userId, event) {
    if (!event?.id) {
      const insertPayload = eventToRow(userId, event);
      delete insertPayload.id;
      const { data, error } = await supabase.from('time_blocks').insert(insertPayload).select('*').single();
      if (error) throw error;
      return rowToEvent(data);
    }

    const { data, error } = await supabase
      .from('time_blocks')
      .upsert([eventToRow(userId, event)], { onConflict: 'id' })
      .select('*')
      .single();
    if (error) throw error;
    return rowToEvent(data);
  },

  async patchTimeBlock(timeBlockId, updates) {
    if (!timeBlockId || !updates || typeof updates !== 'object') {
      throw new Error('timeBlockId and updates are required');
    }
    const { data, error } = await supabase
      .from('time_blocks')
      .update(updates)
      .eq('id', timeBlockId)
      .select('*')
      .single();
    if (error) throw error;
    return rowToEvent(data);
  },

  async deleteTimeBlock(userId, eventId) {
    const { error } = await supabase.from('time_blocks').delete().eq('id', eventId).eq('user_id', userId);
    if (error) throw error;
  },

  async getTimeBlockContentRules(timeBlockId) {
    if (!timeBlockId) {
      throw new Error('timeBlockId is required');
    }
    const { data, error } = await supabase
      .from('time_block_content_rules')
      .select('*')
      .eq('time_block_id', timeBlockId)
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingTimeBlockContentRulesTableError(error)) {
        return [];
      }
      throw error;
    }
    return data || [];
  },

  async upsertTimeBlockContentRule(rule) {
    if (!rule?.time_block_id) {
      throw new Error('time_block_id is required');
    }
    if (!rule?.selector_type || (rule.selector_type !== 'all' && rule.selector_type !== 'weekday')) {
      throw new Error('selector_type must be "all" or "weekday"');
    }
    if (!rule?.list_id) {
      throw new Error('list_id is required');
    }

    const resolvedUserId = rule.user_id || (await getAuthedUserId());
    const row = {
      id: rule.id || undefined,
      user_id: resolvedUserId,
      time_block_id: rule.time_block_id,
      selector_type: rule.selector_type,
      selector_value: rule.selector_type === 'weekday' ? rule.selector_value : null,
      list_id: rule.list_id,
      item_ids: Array.isArray(rule.item_ids) ? rule.item_ids : [],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('time_block_content_rules')
      .upsert(row, { onConflict: 'time_block_id,selector_type,selector_value,list_id' })
      .select('*')
      .single();

    if (error) {
      if (isMissingTimeBlockContentRulesTableError(error)) {
        throw new Error('Time block content rules table does not exist. Run the latest migration.');
      }
      throw error;
    }
    return data;
  },

  async deleteTimeBlockContentRule(id) {
    if (!id) {
      throw new Error('id is required');
    }
    const { error } = await supabase.from('time_block_content_rules').delete().eq('id', id);
    if (error) {
      if (isMissingTimeBlockContentRulesTableError(error)) {
        throw new Error('Time block content rules table does not exist. Run the latest migration.');
      }
      throw error;
    }
  },

  async getOccurrenceCompletionRows({ timeBlockIds, rangeStartUtc, rangeEndUtc, itemIds }) {
    if (!Array.isArray(timeBlockIds) || timeBlockIds.length === 0 || !Array.isArray(itemIds) || itemIds.length === 0) {
      return [];
    }
    let query = supabase
      .from('item_occurrences')
      .select('item_id,time_block_id,scheduled_start,scheduled_end,completion_state,completed_at')
      .in('time_block_id', timeBlockIds)
      .in('item_id', itemIds);
    if (rangeStartUtc) {
      query = query.gte('scheduled_start', rangeStartUtc);
    }
    if (rangeEndUtc) {
      query = query.lte('scheduled_start', rangeEndUtc);
    }
    const { data, error } = await query;
    if (error) {
      if (isMissingItemOccurrencesTableError(error)) {
        return [];
      }
      throw error;
    }
    return data || [];
  },

  async resolveItemsForOccurrenceByTimeBlock({ timeBlockId, scheduledStartUtc, timezone }) {
    if (!timeBlockId) {
      throw new Error('timeBlockId is required');
    }
    if (!scheduledStartUtc) {
      throw new Error('scheduledStartUtc is required');
    }
    const rules = await this.getTimeBlockContentRules(timeBlockId);
    const normalizedStart = new Date(scheduledStartUtc).toISOString();
    const weekday = getWeekdayKeyForOccurrence(normalizedStart, timezone);
    return resolveItemsForOccurrence({
      rules,
      occurrenceStart: normalizedStart,
      weekday,
      timezone
    });
  },

  async setOccurrenceItemCompletion({
    userId,
    itemId,
    timeBlockId,
    scheduledStartUtc,
    scheduledEndUtc,
    checked
  }) {
    if (!itemId || !timeBlockId || !scheduledStartUtc || !scheduledEndUtc) {
      throw new Error('itemId, timeBlockId, scheduledStartUtc, and scheduledEndUtc are required');
    }
    const resolvedUserId = userId || (await getAuthedUserId());
    const normalizedStart = new Date(scheduledStartUtc).toISOString();
    const normalizedEnd = new Date(scheduledEndUtc).toISOString();

    const row = {
      user_id: resolvedUserId,
      item_id: itemId,
      time_block_id: timeBlockId,
      scheduled_start: normalizedStart,
      scheduled_end: normalizedEnd,
      completion_state: checked ? 'completed' : 'pending',
      completed_at: checked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('item_occurrences')
      .upsert(row, { onConflict: 'item_id,time_block_id,scheduled_start' })
      .select('*')
      .single();

    if (error) {
      if (isMissingItemOccurrencesTableError(error)) {
        throw new Error('Item occurrences table does not exist. Run the latest migration.');
      }
      throw error;
    }
    return data;
  },

  async getOccurrenceItemCompletionStates({ timeBlockId, scheduledStartUtc, itemIds }) {
    if (!timeBlockId || !scheduledStartUtc || !Array.isArray(itemIds)) {
      throw new Error('timeBlockId, scheduledStartUtc, and itemIds are required');
    }
    if (itemIds.length === 0) {
      return {};
    }
    const normalizedStart = new Date(scheduledStartUtc).toISOString();
    const { data, error } = await supabase
      .from('item_occurrences')
      .select('item_id,completion_state')
      .eq('time_block_id', timeBlockId)
      .eq('scheduled_start', normalizedStart)
      .in('item_id', itemIds);

    if (error) {
      if (isMissingItemOccurrencesTableError(error)) {
        return {};
      }
      throw error;
    }

    const stateMap = {};
    for (const itemId of itemIds) {
      stateMap[itemId] = 'pending';
    }
    for (const row of data || []) {
      stateMap[row.item_id] = row.completion_state || 'pending';
    }
    return stateMap;
  },

  async createTimeBlockFromProposal(userId, proposal) {
    if (!userId) throw new Error('userId is required');
    if (!proposal?.scheduled_start_utc || !proposal?.title) {
      throw new Error('scheduled_start_utc and title are required');
    }
    const startIso = new Date(proposal.scheduled_start_utc).toISOString();
    const endIso = proposal.scheduled_end_utc
      ? new Date(proposal.scheduled_end_utc).toISOString()
      : new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
    return this.upsertTimeBlock(userId, {
      id: crypto.randomUUID(),
      title: proposal.title,
      description: proposal.notes || '',
      start: startIso,
      end: endIso,
      recurrence: 'none',
      recurrenceConfig: null,
      includeWeekends: true,
      timezone: DEFAULT_TIMEZONE,
      tasks: [],
      tags: []
    });
  },

  async syncTimeBlockLinks(userId, timeBlockId, tags, event) {
    const normalizedTags = normalizeTags(tags);
    const selection = normalizedTags.map(parseAttachTag).filter(Boolean);
    const selectionConfigs = new Map(
      normalizedTags
        .map(parseAttachConfigTag)
        .filter(Boolean)
        .map((entry) => [entry.nodeId, entry])
    );
    const { error: deleteError } = await supabase
      .from('time_block_links')
      .delete()
      .eq('time_block_id', timeBlockId)
      .eq('user_id', userId);
    if (deleteError) throw deleteError;

    if (selection.length === 0) return;
    const context = await buildLinkContext(userId);
    const { itemIds, actionIds } = expandSelection(selection, context);
    const itemConfigs = new Map();
    const actionConfigs = new Map();

    for (const selected of selection) {
      const config = selectionConfigs.get(selected.nodeId) || null;
      const [kind, rawId] = selected.nodeId.split('|');
      const includeChildren = selected.mode === 'with_children';

      if (kind === 'item' && itemIds.has(rawId)) {
        itemConfigs.set(rawId, config);
      }
      if (kind === 'action' && actionIds.has(rawId)) {
        actionConfigs.set(rawId, config);
      }
      if (kind === 'lane') {
        for (const itemId of context.laneToItems.get(rawId) || []) {
          if (itemIds.has(itemId) && !itemConfigs.has(itemId)) {
            itemConfigs.set(itemId, config);
          }
        }
        if (includeChildren) {
          for (const actionId of context.laneToActions.get(rawId) || []) {
            if (actionIds.has(actionId) && !actionConfigs.has(actionId)) {
              actionConfigs.set(actionId, config);
            }
          }
        }
      }
      if (kind === 'focal') {
        for (const laneId of context.focalToLanes.get(rawId) || []) {
          for (const itemId of context.laneToItems.get(laneId) || []) {
            if (itemIds.has(itemId) && !itemConfigs.has(itemId)) {
              itemConfigs.set(itemId, config);
            }
          }
          if (includeChildren) {
            for (const actionId of context.laneToActions.get(laneId) || []) {
              if (actionIds.has(actionId) && !actionConfigs.has(actionId)) {
                actionConfigs.set(actionId, config);
              }
            }
          }
        }
      }
    }

    for (const itemId of itemIds) {
      if (!itemConfigs.has(itemId)) itemConfigs.set(itemId, null);
    }
    for (const actionId of actionIds) {
      if (!actionConfigs.has(actionId)) actionConfigs.set(actionId, null);
    }

    const rows = buildLinkRows(userId, timeBlockId, itemConfigs, actionConfigs, context, event);
    if (rows.length === 0) return;

    const { error: insertError } = await supabase.from('time_block_links').insert(rows);
    if (insertError) throw insertError;
  },

  async getLinkableFocalTree(userId) {
    const context = await buildLinkContext(userId);
    const lanesByFocal = new Map();
    const itemsByLane = new Map();
    const actionsByItem = new Map();

    for (const lane of context.lanes) {
      const list = lanesByFocal.get(lane.focal_id) || [];
      list.push(lane);
      lanesByFocal.set(lane.focal_id, list);
    }
    for (const item of context.items) {
      const list = itemsByLane.get(item.lane_id) || [];
      list.push(item);
      itemsByLane.set(item.lane_id, list);
    }
    for (const action of context.actions) {
      const list = actionsByItem.get(action.item_id) || [];
      list.push(action);
      actionsByItem.set(action.item_id, list);
    }

    return context.focals.map((focal) => ({
      id: `focal|${focal.id}`,
      label: focal.name,
      level: 'domain',
      children: (lanesByFocal.get(focal.id) || []).map((lane) => ({
        id: `lane|${lane.id}`,
        label: lane.name,
        level: 'project',
        children: (itemsByLane.get(lane.id) || []).map((item) => ({
          id: `item|${item.id}`,
          label: item.title,
          level: 'task',
          children: (actionsByItem.get(item.id) || []).map((action) => ({
            id: `action|${action.id}`,
            label: action.title,
            level: 'subtask'
          }))
        }))
      }))
    }));
  }
};

export default calendarService;
