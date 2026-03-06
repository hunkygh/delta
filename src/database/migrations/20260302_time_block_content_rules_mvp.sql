-- MVP: per-occurrence content mapping for recurring time blocks

CREATE TABLE IF NOT EXISTS time_block_content_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_block_id UUID NOT NULL,
  selector_type TEXT NOT NULL CHECK (selector_type IN ('all', 'weekday')),
  selector_value TEXT NULL,
  list_id UUID NOT NULL REFERENCES lanes(id) ON DELETE CASCADE,
  item_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (time_block_id, selector_type, selector_value, list_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'time_block_content_rules'
      AND constraint_name = 'time_block_content_rules_selector_value_check'
  ) THEN
    ALTER TABLE time_block_content_rules
      DROP CONSTRAINT time_block_content_rules_selector_value_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'time_block_content_rules'
      AND constraint_name = 'time_block_content_rules_selector_consistency_check'
  ) THEN
    ALTER TABLE time_block_content_rules
      ADD CONSTRAINT time_block_content_rules_selector_consistency_check
      CHECK (
        (selector_type = 'all' AND selector_value IS NULL)
        OR
        (selector_type = 'weekday' AND selector_value IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'))
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'time_blocks'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND table_name = 'time_block_content_rules'
        AND constraint_name = 'time_block_content_rules_time_block_id_fkey'
    ) THEN
      ALTER TABLE time_block_content_rules
        ADD CONSTRAINT time_block_content_rules_time_block_id_fkey
        FOREIGN KEY (time_block_id) REFERENCES time_blocks(id) ON DELETE CASCADE;
    END IF;
  END IF;
END
$$;

ALTER TABLE time_block_content_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'time_block_content_rules'
      AND policyname = 'Users can view own time_block_content_rules'
  ) THEN
    CREATE POLICY "Users can view own time_block_content_rules"
      ON time_block_content_rules FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'time_block_content_rules'
      AND policyname = 'Users can insert own time_block_content_rules'
  ) THEN
    CREATE POLICY "Users can insert own time_block_content_rules"
      ON time_block_content_rules FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'time_block_content_rules'
      AND policyname = 'Users can update own time_block_content_rules'
  ) THEN
    DROP POLICY "Users can update own time_block_content_rules" ON time_block_content_rules;
  END IF;

  CREATE POLICY "Users can update own time_block_content_rules"
    ON time_block_content_rules FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'time_block_content_rules'
      AND policyname = 'Users can delete own time_block_content_rules'
  ) THEN
    CREATE POLICY "Users can delete own time_block_content_rules"
      ON time_block_content_rules FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tbcr_user_time_block
  ON time_block_content_rules(user_id, time_block_id);

CREATE INDEX IF NOT EXISTS idx_tbcr_selector
  ON time_block_content_rules(time_block_id, selector_type, selector_value);
