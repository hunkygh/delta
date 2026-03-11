export const DEFAULT_RECURRENCE_CONFIG = {
  unit: 'week',
  interval: 1,
  limitType: 'indefinite'
};

export const normalizeRecurrenceConfigForRule = (recurrence, recurrenceConfig = DEFAULT_RECURRENCE_CONFIG) => {
  const safeConfig = recurrenceConfig || DEFAULT_RECURRENCE_CONFIG;
  if (recurrence === 'daily') {
    return { ...safeConfig, unit: 'day', interval: Math.max(1, safeConfig.interval || 1) };
  }
  if (recurrence === 'weekly') {
    return { ...safeConfig, unit: 'week', interval: Math.max(1, safeConfig.interval || 1) };
  }
  if (recurrence === 'monthly') {
    return { ...safeConfig, unit: 'month', interval: Math.max(1, safeConfig.interval || 1) };
  }
  return {
    ...safeConfig,
    interval: Math.max(1, safeConfig.interval || 1)
  };
};

export const shiftByRecurrence = (date, recurrence, recurrenceConfig = DEFAULT_RECURRENCE_CONFIG) => {
  const safeConfig = recurrenceConfig || DEFAULT_RECURRENCE_CONFIG;
  const next = new Date(date);
  if (recurrence === 'daily') {
    const interval = Math.max(1, safeConfig.interval ?? 1);
    next.setDate(next.getDate() + interval);
    return next;
  }
  if (recurrence === 'weekly') {
    const interval = Math.max(1, safeConfig.interval ?? 1);
    next.setDate(next.getDate() + interval * 7);
    return next;
  }
  if (recurrence === 'monthly') {
    const interval = Math.max(1, safeConfig.interval ?? 1);
    next.setMonth(next.getMonth() + interval);
    return next;
  }
  if (recurrence === 'custom') {
    const unit = safeConfig?.unit ?? 'week';
    const interval = Math.max(1, safeConfig?.interval ?? 1);
    if (unit === 'day') {
      next.setDate(next.getDate() + interval);
      return next;
    }
    if (unit === 'week') {
      next.setDate(next.getDate() + interval * 7);
      return next;
    }
    if (unit === 'year') {
      next.setFullYear(next.getFullYear() + interval);
      return next;
    }
    next.setMonth(next.getMonth() + interval);
    return next;
  }
  return next;
};

export const computeOccurrenceCount = (baseStart, occurrenceStart, recurrence, recurrenceConfig = DEFAULT_RECURRENCE_CONFIG) => {
  const safeConfig = recurrenceConfig || DEFAULT_RECURRENCE_CONFIG;
  const interval = Math.max(1, safeConfig.interval || 1);
  const diffMs = occurrenceStart.getTime() - baseStart.getTime();
  if (diffMs <= 0) return 1;

  if (recurrence === 'daily') {
    return Math.floor(diffMs / (24 * 60 * 60 * 1000 * interval)) + 1;
  }
  if (recurrence === 'weekly') {
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000 * interval)) + 1;
  }
  if (recurrence === 'monthly') {
    const monthDiff =
      (occurrenceStart.getFullYear() - baseStart.getFullYear()) * 12 +
      (occurrenceStart.getMonth() - baseStart.getMonth());
    return Math.floor(monthDiff / interval) + 1;
  }

  if (safeConfig.unit === 'day') {
    return Math.floor(diffMs / (24 * 60 * 60 * 1000 * interval)) + 1;
  }
  if (safeConfig.unit === 'week') {
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000 * interval)) + 1;
  }
  if (safeConfig.unit === 'year') {
    const yearDiff = occurrenceStart.getFullYear() - baseStart.getFullYear();
    return Math.floor(yearDiff / interval) + 1;
  }

  const monthDiff =
    (occurrenceStart.getFullYear() - baseStart.getFullYear()) * 12 +
    (occurrenceStart.getMonth() - baseStart.getMonth());
  return Math.floor(monthDiff / interval) + 1;
};

export const hasRecurrenceExceededLimit = (baseStart, occurrenceStart, recurrence, recurrenceConfig = DEFAULT_RECURRENCE_CONFIG) => {
  const safeConfig = recurrenceConfig || DEFAULT_RECURRENCE_CONFIG;
  if (recurrence === 'none' || !safeConfig) {
    return false;
  }

  if (safeConfig.limitType === 'until' && safeConfig.until) {
    const untilDate = new Date(`${safeConfig.until}T23:59:59.999`);
    if (occurrenceStart.getTime() > untilDate.getTime()) {
      return true;
    }
  }

  if (safeConfig.limitType === 'count' && safeConfig.count) {
    const occurrenceCount = computeOccurrenceCount(baseStart, occurrenceStart, recurrence, safeConfig);
    return occurrenceCount > safeConfig.count;
  }

  return false;
};

export const getNextOccurrenceStart = (occurrenceStart, recurrence, recurrenceConfig = DEFAULT_RECURRENCE_CONFIG) => {
  if (!recurrence || recurrence === 'none') return null;
  return shiftByRecurrence(occurrenceStart, recurrence, recurrenceConfig);
};

export const getFirstOccurrenceAfter = (baseStart, afterDate, recurrence, recurrenceConfig = DEFAULT_RECURRENCE_CONFIG) => {
  if (!recurrence || recurrence === 'none') {
    return baseStart.getTime() > afterDate.getTime() ? new Date(baseStart) : null;
  }
  let cursor = new Date(baseStart);
  let guard = 0;
  while (guard < 2400) {
    if (!hasRecurrenceExceededLimit(baseStart, cursor, recurrence, recurrenceConfig || DEFAULT_RECURRENCE_CONFIG) && cursor.getTime() > afterDate.getTime()) {
      return new Date(cursor);
    }
    cursor = shiftByRecurrence(cursor, recurrence, recurrenceConfig || DEFAULT_RECURRENCE_CONFIG);
    guard += 1;
  }
  return null;
};

export const buildCountLimitedRecurrenceConfig = (recurrence, recurrenceConfig, count) => {
  const normalized = normalizeRecurrenceConfigForRule(recurrence, recurrenceConfig || DEFAULT_RECURRENCE_CONFIG);
  return {
    ...normalized,
    limitType: 'count',
    count: Math.max(1, count),
    until: undefined
  };
};

export const buildTailRecurrenceConfig = (baseStart, tailStart, recurrence, recurrenceConfig = DEFAULT_RECURRENCE_CONFIG) => {
  const normalized = normalizeRecurrenceConfigForRule(recurrence, recurrenceConfig);
  if (normalized.limitType === 'indefinite') {
    return { ...normalized };
  }
  if (normalized.limitType === 'until') {
    const untilDate = normalized.until ? new Date(`${normalized.until}T23:59:59.999`) : null;
    if (!untilDate || tailStart.getTime() > untilDate.getTime()) {
      return null;
    }
    return { ...normalized };
  }
  if (normalized.limitType === 'count' && normalized.count) {
    const tailOccurrenceIndex = computeOccurrenceCount(baseStart, tailStart, recurrence, normalized);
    const remaining = normalized.count - (tailOccurrenceIndex - 1);
    if (remaining <= 0) {
      return null;
    }
    return {
      ...normalized,
      count: remaining
    };
  }
  return { ...normalized };
};
