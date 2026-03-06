-- Phase 1: custom lane statuses + item status references

CREATE TABLE IF NOT EXISTS lane_statuses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lane_id UUID REFERENCES lanes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#94a3b8',
  group_key TEXT NOT NULL DEFAULT 'todo',
  order_num INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lane_id, key)
);

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES lane_statuses(id) ON DELETE SET NULL;

ALTER TABLE lane_statuses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lane_statuses'
      AND policyname = 'Users can view own lane_statuses'
  ) THEN
    CREATE POLICY "Users can view own lane_statuses"
      ON lane_statuses FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lane_statuses'
      AND policyname = 'Users can insert own lane_statuses'
  ) THEN
    CREATE POLICY "Users can insert own lane_statuses"
      ON lane_statuses FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lane_statuses'
      AND policyname = 'Users can update own lane_statuses'
  ) THEN
    CREATE POLICY "Users can update own lane_statuses"
      ON lane_statuses FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lane_statuses'
      AND policyname = 'Users can delete own lane_statuses'
  ) THEN
    CREATE POLICY "Users can delete own lane_statuses"
      ON lane_statuses FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lane_statuses_lane_id ON lane_statuses(lane_id);
CREATE INDEX IF NOT EXISTS idx_lane_statuses_user_id ON lane_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_lane_statuses_order ON lane_statuses(lane_id, order_num);
CREATE INDEX IF NOT EXISTS idx_items_status_id ON items(status_id);

-- Seed defaults for every lane that has none yet
INSERT INTO lane_statuses (lane_id, user_id, key, name, color, group_key, order_num, is_default)
SELECT l.id, l.user_id, 'pending', 'To do', '#94a3b8', 'todo', 0, true
FROM lanes l
WHERE NOT EXISTS (SELECT 1 FROM lane_statuses s WHERE s.lane_id = l.id);

INSERT INTO lane_statuses (lane_id, user_id, key, name, color, group_key, order_num, is_default)
SELECT l.id, l.user_id, 'in_progress', 'In progress', '#f59e0b', 'active', 1, false
FROM lanes l
WHERE EXISTS (SELECT 1 FROM lane_statuses s WHERE s.lane_id = l.id AND s.key = 'pending')
  AND NOT EXISTS (SELECT 1 FROM lane_statuses s WHERE s.lane_id = l.id AND s.key = 'in_progress');

INSERT INTO lane_statuses (lane_id, user_id, key, name, color, group_key, order_num, is_default)
SELECT l.id, l.user_id, 'completed', 'Done', '#22c55e', 'done', 2, false
FROM lanes l
WHERE EXISTS (SELECT 1 FROM lane_statuses s WHERE s.lane_id = l.id AND s.key = 'pending')
  AND NOT EXISTS (SELECT 1 FROM lane_statuses s WHERE s.lane_id = l.id AND s.key = 'completed');

-- Backfill items.status_id from existing status text
UPDATE items i
SET status_id = s.id
FROM lane_statuses s
WHERE i.lane_id = s.lane_id
  AND i.status_id IS NULL
  AND (
    i.status = s.key
    OR (i.status = 'pending' AND s.key = 'pending')
    OR (i.status = 'in_progress' AND s.key = 'in_progress')
    OR (i.status = 'completed' AND s.key = 'completed')
  );
