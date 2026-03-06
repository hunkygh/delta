-- Phase: signal fields + scoped threads/comments infrastructure

-- 1) Signal fields on items (non-generic, first-class)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS signal_label TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS signal_score NUMERIC NOT NULL DEFAULT 0;

-- 2) Unified thread table (item | action | timeblock)
CREATE TABLE IF NOT EXISTS threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('item', 'action', 'timeblock')),
  scope_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (scope_type, scope_id)
);

-- 3) Unified comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4) RLS
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'threads'
      AND policyname = 'Users can view own threads'
  ) THEN
    CREATE POLICY "Users can view own threads"
      ON threads FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'threads'
      AND policyname = 'Users can insert own threads'
  ) THEN
    CREATE POLICY "Users can insert own threads"
      ON threads FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'threads'
      AND policyname = 'Users can update own threads'
  ) THEN
    CREATE POLICY "Users can update own threads"
      ON threads FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'threads'
      AND policyname = 'Users can delete own threads'
  ) THEN
    CREATE POLICY "Users can delete own threads"
      ON threads FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comments'
      AND policyname = 'Users can view comments in own threads'
  ) THEN
    CREATE POLICY "Users can view comments in own threads"
      ON comments FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM threads t
          WHERE t.id = comments.thread_id
            AND t.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comments'
      AND policyname = 'Users can insert comments in own threads'
  ) THEN
    CREATE POLICY "Users can insert comments in own threads"
      ON comments FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM threads t
          WHERE t.id = comments.thread_id
            AND t.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comments'
      AND policyname = 'Users can delete comments in own threads'
  ) THEN
    CREATE POLICY "Users can delete comments in own threads"
      ON comments FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM threads t
          WHERE t.id = comments.thread_id
            AND t.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- 5) Indexes
CREATE INDEX IF NOT EXISTS idx_items_signal ON items(signal_score DESC, signal_label);
CREATE INDEX IF NOT EXISTS idx_threads_scope ON threads(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_thread_time ON comments(thread_id, created_at);

-- 6) Backfill: migrate legacy item_comments into threads/comments once
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'item_comments'
  ) THEN
    INSERT INTO threads (user_id, scope_type, scope_id)
    SELECT DISTINCT ic.user_id, 'item', ic.item_id
    FROM item_comments ic
    WHERE ic.user_id IS NOT NULL
    ON CONFLICT (scope_type, scope_id) DO NOTHING;

    INSERT INTO comments (thread_id, author_type, content, created_at)
    SELECT t.id, 'user', ic.body, ic.created_at
    FROM item_comments ic
    JOIN threads t
      ON t.scope_type = 'item'
     AND t.scope_id = ic.item_id
     AND t.user_id = ic.user_id
    WHERE ic.body IS NOT NULL
      AND length(trim(ic.body)) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM comments c
        WHERE c.thread_id = t.id
          AND c.content = ic.body
          AND c.created_at = ic.created_at
      );
  END IF;
END
$$;
