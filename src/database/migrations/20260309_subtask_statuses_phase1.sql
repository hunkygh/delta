-- Subtask status separation: independent status set for actions/subtasks per list.

CREATE TABLE IF NOT EXISTS lane_subtask_statuses (
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

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS subtask_status_id UUID REFERENCES lane_subtask_statuses(id) ON DELETE SET NULL;

ALTER TABLE lane_subtask_statuses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lane_subtask_statuses'
      AND policyname = 'Users can view own lane_subtask_statuses'
  ) THEN
    CREATE POLICY "Users can view own lane_subtask_statuses"
      ON lane_subtask_statuses FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lane_subtask_statuses'
      AND policyname = 'Users can insert own lane_subtask_statuses'
  ) THEN
    CREATE POLICY "Users can insert own lane_subtask_statuses"
      ON lane_subtask_statuses FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lane_subtask_statuses'
      AND policyname = 'Users can update own lane_subtask_statuses'
  ) THEN
    CREATE POLICY "Users can update own lane_subtask_statuses"
      ON lane_subtask_statuses FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lane_subtask_statuses'
      AND policyname = 'Users can delete own lane_subtask_statuses'
  ) THEN
    CREATE POLICY "Users can delete own lane_subtask_statuses"
      ON lane_subtask_statuses FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_lane_subtask_statuses_lane_id ON lane_subtask_statuses(lane_id);
CREATE INDEX IF NOT EXISTS idx_lane_subtask_statuses_user_id ON lane_subtask_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_lane_subtask_statuses_order ON lane_subtask_statuses(lane_id, order_num);
CREATE INDEX IF NOT EXISTS idx_actions_subtask_status_id ON actions(subtask_status_id);

-- Seed defaults for lanes that do not have subtask status rows.
INSERT INTO lane_subtask_statuses (lane_id, user_id, key, name, color, group_key, order_num, is_default)
SELECT l.id, l.user_id, 'not_started', 'Not started', '#94a3b8', 'todo', 0, true
FROM lanes l
WHERE NOT EXISTS (SELECT 1 FROM lane_subtask_statuses s WHERE s.lane_id = l.id);

INSERT INTO lane_subtask_statuses (lane_id, user_id, key, name, color, group_key, order_num, is_default)
SELECT l.id, l.user_id, 'done', 'Done', '#22c55e', 'done', 1, false
FROM lanes l
WHERE EXISTS (SELECT 1 FROM lane_subtask_statuses s WHERE s.lane_id = l.id AND s.key = 'not_started')
  AND NOT EXISTS (SELECT 1 FROM lane_subtask_statuses s WHERE s.lane_id = l.id AND s.key = 'done');

-- Backfill actions.subtask_status_id from legacy action status text, defaulting to "Not started".
UPDATE actions a
SET subtask_status_id = s.id
FROM items i
JOIN lane_subtask_statuses s ON s.lane_id = i.lane_id
WHERE a.item_id = i.id
  AND a.subtask_status_id IS NULL
  AND (
    (a.status = 'completed' AND s.group_key = 'done')
    OR (a.status = 'done' AND s.group_key = 'done')
    OR (a.status = 'not_started' AND s.key = 'not_started')
    OR (a.status = 'pending' AND s.key = 'not_started')
    OR (a.status = 'in_progress' AND s.key = 'not_started')
  );

UPDATE actions a
SET subtask_status_id = s.id
FROM items i
JOIN lane_subtask_statuses s ON s.lane_id = i.lane_id AND s.is_default = true
WHERE a.item_id = i.id
  AND a.subtask_status_id IS NULL;
