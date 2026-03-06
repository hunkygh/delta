-- Baseline calendar persistence tables for environments missing early calendar migrations.

CREATE TABLE IF NOT EXISTS time_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  focal_id UUID REFERENCES focals(id) ON DELETE SET NULL,
  lane_id UUID REFERENCES lanes(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  recurrence_rule TEXT NOT NULL DEFAULT 'none',
  recurrence_config JSONB,
  include_weekends BOOLEAN NOT NULL DEFAULT TRUE,
  timezone TEXT DEFAULT 'America/Denver',
  tags JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE time_blocks
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS time_block_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_block_id UUID REFERENCES time_blocks(id) ON DELETE CASCADE,
  lane_id UUID REFERENCES lanes(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  action_id UUID REFERENCES actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('item', 'action')),
  recurrence_mode TEXT NOT NULL DEFAULT 'match_event' CHECK (recurrence_mode IN ('match_event', 'custom')),
  recurrence_rule TEXT,
  recurrence_config JSONB,
  recurrence_limit_count INTEGER,
  recurrence_limit_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(time_block_id, item_id, action_id, link_type)
);

ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_block_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_blocks' AND policyname = 'Users can view own time_blocks'
  ) THEN
    CREATE POLICY "Users can view own time_blocks"
      ON time_blocks FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_blocks' AND policyname = 'Users can insert own time_blocks'
  ) THEN
    CREATE POLICY "Users can insert own time_blocks"
      ON time_blocks FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_blocks' AND policyname = 'Users can update own time_blocks'
  ) THEN
    DROP POLICY "Users can update own time_blocks" ON time_blocks;
  END IF;

  CREATE POLICY "Users can update own time_blocks"
    ON time_blocks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_blocks' AND policyname = 'Users can delete own time_blocks'
  ) THEN
    CREATE POLICY "Users can delete own time_blocks"
      ON time_blocks FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_block_links' AND policyname = 'Users can view own time_block_links'
  ) THEN
    CREATE POLICY "Users can view own time_block_links"
      ON time_block_links FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_block_links' AND policyname = 'Users can insert own time_block_links'
  ) THEN
    CREATE POLICY "Users can insert own time_block_links"
      ON time_block_links FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_block_links' AND policyname = 'Users can update own time_block_links'
  ) THEN
    DROP POLICY "Users can update own time_block_links" ON time_block_links;
  END IF;

  CREATE POLICY "Users can update own time_block_links"
    ON time_block_links FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_block_links' AND policyname = 'Users can delete own time_block_links'
  ) THEN
    CREATE POLICY "Users can delete own time_block_links"
      ON time_block_links FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON time_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_start_time ON time_blocks(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_time_blocks_lane_id ON time_blocks(lane_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_focal_id ON time_blocks(focal_id);

CREATE INDEX IF NOT EXISTS idx_time_block_links_time_block ON time_block_links(time_block_id);
CREATE INDEX IF NOT EXISTS idx_time_block_links_item ON time_block_links(item_id);
CREATE INDEX IF NOT EXISTS idx_time_block_links_action ON time_block_links(action_id);
CREATE INDEX IF NOT EXISTS idx_time_block_links_user ON time_block_links(user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'time_block_content_rules'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'time_blocks'
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
