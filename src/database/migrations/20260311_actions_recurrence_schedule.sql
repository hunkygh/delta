ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT NOT NULL DEFAULT 'none'
    CHECK (recurrence_rule IN ('none', 'daily', 'weekly', 'monthly', 'custom'));

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS recurrence_config JSONB;
