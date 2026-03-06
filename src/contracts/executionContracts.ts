export type ProposalSource = 'ai' | 'heuristic';
export type ProposalEntity = 'item' | 'action' | 'list' | 'time_block';
export type CaptureScope = 'timeblock' | 'item' | 'action';
export type CaptureCommentSource = 'user' | 'ai' | 'system';

type PrimitiveChange = string | number | boolean | null;

export interface FieldUpdateProposal {
  entity: ProposalEntity;
  id: string;
  changes: Record<string, PrimitiveChange>;
}

export interface NewActionProposal {
  item_id: string;
  title: string;
  due_at_utc?: string | null;
  notes?: string | null;
}

export interface CalendarProposal {
  action_id?: string;
  item_id?: string;
  time_block_id?: string;
  scheduled_start_utc: string;
  scheduled_end_utc?: string | null;
  title: string;
  notes?: string | null;
}

export interface OptimizationProposalContract {
  source: ProposalSource;
  confidence: number;
  reasoning: string;
  field_updates: FieldUpdateProposal[];
  new_actions: NewActionProposal[];
  calendar_proposals: CalendarProposal[];
}

export interface CaptureEventContract {
  scope: CaptureScope;
  scope_id: string;
  comment_body: string;
  comment_source: CaptureCommentSource;
  context_ids?: {
    focal_id?: string;
    list_id?: string;
    item_id?: string;
    action_id?: string;
    time_block_id?: string;
  };
}

interface ValidationResult<T> {
  valid: boolean;
  value: T;
  errors: string[];
}

const VALID_WEEKDAY_IDS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const isIsoUtc = (value: unknown): value is string => {
  if (!isNonEmptyString(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && value.includes('T') && (value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value));
};

const isPrimitiveChange = (value: unknown): value is PrimitiveChange =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value);

export const createEmptyHeuristicProposal = (
  reasoning = 'No actionable proposal generated.'
): OptimizationProposalContract => ({
  source: 'heuristic',
  confidence: 0,
  reasoning,
  field_updates: [],
  new_actions: [],
  calendar_proposals: []
});

export const validateOptimizationProposal = (input: unknown): ValidationResult<OptimizationProposalContract> => {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return {
      valid: false,
      value: createEmptyHeuristicProposal('Malformed proposal payload.'),
      errors: ['Proposal payload is not an object.']
    };
  }

  const source = input.source;
  if (source !== 'ai' && source !== 'heuristic') {
    errors.push('source must be "ai" or "heuristic".');
  }

  const confidence = input.confidence;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    errors.push('confidence must be a finite number between 0 and 1.');
  }

  const reasoning = input.reasoning;
  if (!isNonEmptyString(reasoning)) {
    errors.push('reasoning must be a non-empty string.');
  } else if (reasoning.length > 280) {
    errors.push('reasoning must be 280 chars or fewer.');
  }

  const fieldUpdatesRaw = input.field_updates;
  if (!Array.isArray(fieldUpdatesRaw)) {
    errors.push('field_updates must be an array.');
  }

  const newActionsRaw = input.new_actions;
  if (!Array.isArray(newActionsRaw)) {
    errors.push('new_actions must be an array.');
  }

  const calendarProposalsRaw = input.calendar_proposals;
  if (!Array.isArray(calendarProposalsRaw)) {
    errors.push('calendar_proposals must be an array.');
  }

  const field_updates: FieldUpdateProposal[] = [];
  if (Array.isArray(fieldUpdatesRaw)) {
    fieldUpdatesRaw.forEach((row, idx) => {
      if (!isPlainObject(row)) {
        errors.push(`field_updates[${idx}] must be an object.`);
        return;
      }
      const entity = row.entity;
      const id = row.id;
      const changes = row.changes;
      if (!['item', 'action', 'list', 'time_block'].includes(String(entity))) {
        errors.push(`field_updates[${idx}].entity is invalid.`);
      }
      if (!isNonEmptyString(id)) {
        errors.push(`field_updates[${idx}].id must be a non-empty string.`);
      }
      if (!isPlainObject(changes)) {
        errors.push(`field_updates[${idx}].changes must be an object.`);
      } else {
        const allPrimitive = Object.values(changes).every(isPrimitiveChange);
        if (!allPrimitive) {
          errors.push(`field_updates[${idx}].changes values must be primitive or null.`);
        }
      }
      if (isNonEmptyString(id) && isPlainObject(changes) && ['item', 'action', 'list', 'time_block'].includes(String(entity))) {
        field_updates.push({
          entity: entity as ProposalEntity,
          id: id.trim(),
          changes: changes as Record<string, PrimitiveChange>
        });
      }
    });
  }

  const new_actions: NewActionProposal[] = [];
  if (Array.isArray(newActionsRaw)) {
    newActionsRaw.forEach((row, idx) => {
      if (!isPlainObject(row)) {
        errors.push(`new_actions[${idx}] must be an object.`);
        return;
      }
      if (!isNonEmptyString(row.item_id)) {
        errors.push(`new_actions[${idx}].item_id must be a non-empty string.`);
      }
      if (!isNonEmptyString(row.title)) {
        errors.push(`new_actions[${idx}].title must be a non-empty string.`);
      }
      if (row.due_at_utc !== undefined && row.due_at_utc !== null && !isIsoUtc(row.due_at_utc)) {
        errors.push(`new_actions[${idx}].due_at_utc must be null or ISO timestamp.`);
      }
      if (row.notes !== undefined && !isNullableString(row.notes)) {
        errors.push(`new_actions[${idx}].notes must be null or string.`);
      }

      if (isNonEmptyString(row.item_id) && isNonEmptyString(row.title)) {
        new_actions.push({
          item_id: row.item_id.trim(),
          title: row.title.trim(),
          due_at_utc: (row.due_at_utc ?? null) as string | null,
          notes: (row.notes ?? null) as string | null
        });
      }
    });
  }

  const calendar_proposals: CalendarProposal[] = [];
  if (Array.isArray(calendarProposalsRaw)) {
    calendarProposalsRaw.forEach((row, idx) => {
      if (!isPlainObject(row)) {
        errors.push(`calendar_proposals[${idx}] must be an object.`);
        return;
      }
      const hasScopeRef = isNonEmptyString(row.action_id) || isNonEmptyString(row.item_id) || isNonEmptyString(row.time_block_id);
      if (!hasScopeRef) {
        errors.push(`calendar_proposals[${idx}] must include action_id, item_id, or time_block_id.`);
      }
      if (!isIsoUtc(row.scheduled_start_utc)) {
        errors.push(`calendar_proposals[${idx}].scheduled_start_utc must be ISO timestamp.`);
      }
      if (row.scheduled_end_utc !== undefined && row.scheduled_end_utc !== null && !isIsoUtc(row.scheduled_end_utc)) {
        errors.push(`calendar_proposals[${idx}].scheduled_end_utc must be null or ISO timestamp.`);
      }
      if (!isNonEmptyString(row.title)) {
        errors.push(`calendar_proposals[${idx}].title must be a non-empty string.`);
      }
      if (row.notes !== undefined && !isNullableString(row.notes)) {
        errors.push(`calendar_proposals[${idx}].notes must be null or string.`);
      }

      if (hasScopeRef && isIsoUtc(row.scheduled_start_utc) && isNonEmptyString(row.title)) {
        calendar_proposals.push({
          action_id: isNonEmptyString(row.action_id) ? row.action_id.trim() : undefined,
          item_id: isNonEmptyString(row.item_id) ? row.item_id.trim() : undefined,
          time_block_id: isNonEmptyString(row.time_block_id) ? row.time_block_id.trim() : undefined,
          scheduled_start_utc: row.scheduled_start_utc,
          scheduled_end_utc: (row.scheduled_end_utc ?? null) as string | null,
          title: row.title.trim(),
          notes: (row.notes ?? null) as string | null
        });
      }
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      value: createEmptyHeuristicProposal('Malformed proposal payload.'),
      errors
    };
  }

  return {
    valid: true,
    value: {
      source: source as ProposalSource,
      confidence: confidence as number,
      reasoning: (reasoning as string).trim(),
      field_updates,
      new_actions,
      calendar_proposals
    },
    errors: []
  };
};

export const validateOptimizationProposalOrFallback = (input: unknown): ValidationResult<OptimizationProposalContract> =>
  validateOptimizationProposal(input);

export const validateCaptureEvent = (input: unknown): ValidationResult<CaptureEventContract> => {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return {
      valid: false,
      value: {
        scope: 'item',
        scope_id: '',
        comment_body: '',
        comment_source: 'user'
      },
      errors: ['Capture event payload is not an object.']
    };
  }

  const scope = input.scope;
  if (!['timeblock', 'item', 'action'].includes(String(scope))) {
    errors.push('scope must be one of: timeblock, item, action.');
  }

  const scopeId = input.scope_id;
  if (!isNonEmptyString(scopeId)) {
    errors.push('scope_id must be a non-empty string.');
  }

  const commentBody = input.comment_body;
  if (!isNonEmptyString(commentBody)) {
    errors.push('comment_body must be a non-empty string.');
  }

  const commentSource = input.comment_source ?? 'user';
  if (!['user', 'ai', 'system'].includes(String(commentSource))) {
    errors.push('comment_source must be one of: user, ai, system.');
  }

  const context_ids = input.context_ids;
  if (context_ids !== undefined && !isPlainObject(context_ids)) {
    errors.push('context_ids must be an object when provided.');
  }

  const captureValue: CaptureEventContract = {
    scope: (scope as CaptureScope) || 'item',
    scope_id: isNonEmptyString(scopeId) ? scopeId.trim() : '',
    comment_body: isNonEmptyString(commentBody) ? commentBody.trim() : '',
    comment_source: (commentSource as CaptureCommentSource) || 'user',
    context_ids: isPlainObject(context_ids)
      ? {
          focal_id: isNonEmptyString(context_ids.focal_id) ? context_ids.focal_id.trim() : undefined,
          list_id: isNonEmptyString(context_ids.list_id) ? context_ids.list_id.trim() : undefined,
          item_id: isNonEmptyString(context_ids.item_id) ? context_ids.item_id.trim() : undefined,
          action_id: isNonEmptyString(context_ids.action_id) ? context_ids.action_id.trim() : undefined,
          time_block_id: isNonEmptyString(context_ids.time_block_id) ? context_ids.time_block_id.trim() : undefined
        }
      : undefined
  };

  return {
    valid: errors.length === 0,
    value: captureValue,
    errors
  };
};

export const normalizeWeekdayToken = (value: string): string | null => {
  const token = (value || '').trim().toLowerCase().slice(0, 3);
  return VALID_WEEKDAY_IDS.has(token) ? token : null;
};
