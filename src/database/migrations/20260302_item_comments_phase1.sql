-- Phase: persistent item comments thread

CREATE TABLE IF NOT EXISTS item_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE item_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'item_comments'
      AND policyname = 'Users can view own item_comments'
  ) THEN
    CREATE POLICY "Users can view own item_comments"
      ON item_comments FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'item_comments'
      AND policyname = 'Users can insert own item_comments'
  ) THEN
    CREATE POLICY "Users can insert own item_comments"
      ON item_comments FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'item_comments'
      AND policyname = 'Users can update own item_comments'
  ) THEN
    CREATE POLICY "Users can update own item_comments"
      ON item_comments FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'item_comments'
      AND policyname = 'Users can delete own item_comments'
  ) THEN
    CREATE POLICY "Users can delete own item_comments"
      ON item_comments FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_item_comments_item_id ON item_comments(item_id);
CREATE INDEX IF NOT EXISTS idx_item_comments_user_id ON item_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_item_comments_created_at ON item_comments(item_id, created_at);
