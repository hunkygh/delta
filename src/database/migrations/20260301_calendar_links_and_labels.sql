-- Phase 1 migration: calendar persistence + focal terminology extensions

ALTER TABLE lanes
  ADD COLUMN IF NOT EXISTS action_label TEXT;

ALTER TABLE time_blocks
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS focal_id UUID REFERENCES focals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lane_id UUID REFERENCES lanes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_config JSONB,
  ADD COLUMN IF NOT EXISTS include_weekends BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Denver',
  ADD COLUMN IF NOT EXISTS tags JSONB;

CREATE TABLE IF NOT EXISTS time_block_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_block_id UUID REFERENCES time_blocks(id) ON DELETE CASCADE,
  lane_id UUID REFERENCES lanes(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  action_id UUID REFERENCES actions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('item', 'action')),
  recurrence_mode TEXT NOT NULL DEFAULT 'match_event' CHECK (recurrence_mode IN ('match_event', 'custom')),
  recurrence_rule TEXT,
  recurrence_config JSONB,
  recurrence_limit_count INTEGER,
  recurrence_limit_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(time_block_id, item_id, action_id, link_type)
);

ALTER TABLE time_block_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'time_block_links'
      AND policyname = 'Users can view own time_block_links'
  ) THEN
    CREATE POLICY "Users can view own time_block_links"
      ON time_block_links FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'time_block_links'
      AND policyname = 'Users can insert own time_block_links'
  ) THEN
    CREATE POLICY "Users can insert own time_block_links"
      ON time_block_links FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'time_block_links'
      AND policyname = 'Users can update own time_block_links'
  ) THEN
    CREATE POLICY "Users can update own time_block_links"
      ON time_block_links FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'time_block_links'
      AND policyname = 'Users can delete own time_block_links'
  ) THEN
    CREATE POLICY "Users can delete own time_block_links"
      ON time_block_links FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_time_blocks_lane_id ON time_blocks(lane_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_focal_id ON time_blocks(focal_id);
CREATE INDEX IF NOT EXISTS idx_time_block_links_time_block ON time_block_links(time_block_id);
CREATE INDEX IF NOT EXISTS idx_time_block_links_item ON time_block_links(item_id);
CREATE INDEX IF NOT EXISTS idx_time_block_links_action ON time_block_links(action_id);
CREATE INDEX IF NOT EXISTS idx_time_block_links_user ON time_block_links(user_id);
