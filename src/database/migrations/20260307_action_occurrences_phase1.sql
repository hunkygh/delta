-- Phase 1: task-native occurrence completion persistence (backward compatible)

CREATE TABLE IF NOT EXISTS action_occurrences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  time_block_id UUID NOT NULL,
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
  completion_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (completion_state IN ('pending', 'completed', 'skipped', 'missed')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (action_id, time_block_id, scheduled_start)
);

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
        AND table_name = 'action_occurrences'
        AND constraint_name = 'action_occurrences_time_block_id_fkey'
    ) THEN
      ALTER TABLE action_occurrences
        ADD CONSTRAINT action_occurrences_time_block_id_fkey
        FOREIGN KEY (time_block_id) REFERENCES time_blocks(id) ON DELETE CASCADE;
    END IF;
  END IF;
END
$$;

ALTER TABLE action_occurrences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'action_occurrences'
      AND policyname = 'Users can view own action_occurrences'
  ) THEN
    CREATE POLICY "Users can view own action_occurrences"
      ON action_occurrences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'action_occurrences'
      AND policyname = 'Users can insert own action_occurrences'
  ) THEN
    CREATE POLICY "Users can insert own action_occurrences"
      ON action_occurrences FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'action_occurrences'
      AND policyname = 'Users can update own action_occurrences'
  ) THEN
    CREATE POLICY "Users can update own action_occurrences"
      ON action_occurrences FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'action_occurrences'
      AND policyname = 'Users can delete own action_occurrences'
  ) THEN
    CREATE POLICY "Users can delete own action_occurrences"
      ON action_occurrences FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_action_occ_user_start_desc
  ON action_occurrences(user_id, scheduled_start DESC);

CREATE INDEX IF NOT EXISTS idx_action_occ_action_start_desc
  ON action_occurrences(action_id, scheduled_start DESC);

