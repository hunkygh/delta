-- Phase 1: block-scoped execution tasks for time blocks
-- Adds block task definitions plus contextual item-occurrence completion under those tasks.

CREATE TABLE IF NOT EXISTS block_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_block_id UUID NOT NULL REFERENCES time_blocks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS block_task_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_task_id UUID NOT NULL REFERENCES block_tasks(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (block_task_id, item_id)
);

CREATE TABLE IF NOT EXISTS block_task_item_occurrences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_task_item_id UUID NOT NULL REFERENCES block_task_items(id) ON DELETE CASCADE,
  time_block_id UUID NOT NULL,
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
  completion_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (completion_state IN ('pending', 'completed', 'skipped', 'missed')),
  completion_note TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (block_task_item_id, time_block_id, scheduled_start)
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
        AND table_name = 'block_task_item_occurrences'
        AND constraint_name = 'block_task_item_occurrences_time_block_id_fkey'
    ) THEN
      ALTER TABLE block_task_item_occurrences
        ADD CONSTRAINT block_task_item_occurrences_time_block_id_fkey
        FOREIGN KEY (time_block_id) REFERENCES time_blocks(id) ON DELETE CASCADE;
    END IF;
  END IF;
END
$$;

ALTER TABLE block_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_task_item_occurrences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_tasks' AND policyname = 'Users can view own block_tasks'
  ) THEN
    CREATE POLICY "Users can view own block_tasks"
      ON block_tasks FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_tasks' AND policyname = 'Users can insert own block_tasks'
  ) THEN
    CREATE POLICY "Users can insert own block_tasks"
      ON block_tasks FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_tasks' AND policyname = 'Users can update own block_tasks'
  ) THEN
    CREATE POLICY "Users can update own block_tasks"
      ON block_tasks FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_tasks' AND policyname = 'Users can delete own block_tasks'
  ) THEN
    CREATE POLICY "Users can delete own block_tasks"
      ON block_tasks FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_task_items' AND policyname = 'Users can view own block_task_items'
  ) THEN
    CREATE POLICY "Users can view own block_task_items"
      ON block_task_items FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_task_items' AND policyname = 'Users can insert own block_task_items'
  ) THEN
    CREATE POLICY "Users can insert own block_task_items"
      ON block_task_items FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_task_items' AND policyname = 'Users can update own block_task_items'
  ) THEN
    CREATE POLICY "Users can update own block_task_items"
      ON block_task_items FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_task_items' AND policyname = 'Users can delete own block_task_items'
  ) THEN
    CREATE POLICY "Users can delete own block_task_items"
      ON block_task_items FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_task_item_occurrences' AND policyname = 'Users can view own block_task_item_occurrences'
  ) THEN
    CREATE POLICY "Users can view own block_task_item_occurrences"
      ON block_task_item_occurrences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_task_item_occurrences' AND policyname = 'Users can insert own block_task_item_occurrences'
  ) THEN
    CREATE POLICY "Users can insert own block_task_item_occurrences"
      ON block_task_item_occurrences FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_task_item_occurrences' AND policyname = 'Users can update own block_task_item_occurrences'
  ) THEN
    CREATE POLICY "Users can update own block_task_item_occurrences"
      ON block_task_item_occurrences FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'block_task_item_occurrences' AND policyname = 'Users can delete own block_task_item_occurrences'
  ) THEN
    CREATE POLICY "Users can delete own block_task_item_occurrences"
      ON block_task_item_occurrences FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_block_tasks_user_time_block
  ON block_tasks(user_id, time_block_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_block_task_items_task_order
  ON block_task_items(block_task_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_block_task_items_item_id
  ON block_task_items(item_id);

CREATE INDEX IF NOT EXISTS idx_block_task_item_occurrences_user_start_desc
  ON block_task_item_occurrences(user_id, scheduled_start DESC);

CREATE INDEX IF NOT EXISTS idx_block_task_item_occurrences_task_item_start
  ON block_task_item_occurrences(block_task_item_id, scheduled_start DESC);
