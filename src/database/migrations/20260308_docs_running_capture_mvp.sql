-- Docs running capture MVP: notes + categories + category mapping.

CREATE TABLE IF NOT EXISTS doc_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES doc_categories(id) ON DELETE SET NULL,
  order_num INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doc_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'quick_text'
    CHECK (source IN ('quick_text', 'quick_voice', 'memo', 'ai')),
  origin_context JSONB,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doc_note_categories (
  note_id UUID NOT NULL REFERENCES doc_notes(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES doc_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (note_id, category_id)
);

ALTER TABLE doc_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_note_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_categories' AND policyname = 'Users can view own doc_categories'
  ) THEN
    CREATE POLICY "Users can view own doc_categories"
      ON doc_categories FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_categories' AND policyname = 'Users can insert own doc_categories'
  ) THEN
    CREATE POLICY "Users can insert own doc_categories"
      ON doc_categories FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_categories' AND policyname = 'Users can update own doc_categories'
  ) THEN
    CREATE POLICY "Users can update own doc_categories"
      ON doc_categories FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_categories' AND policyname = 'Users can delete own doc_categories'
  ) THEN
    CREATE POLICY "Users can delete own doc_categories"
      ON doc_categories FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_notes' AND policyname = 'Users can view own doc_notes'
  ) THEN
    CREATE POLICY "Users can view own doc_notes"
      ON doc_notes FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_notes' AND policyname = 'Users can insert own doc_notes'
  ) THEN
    CREATE POLICY "Users can insert own doc_notes"
      ON doc_notes FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_notes' AND policyname = 'Users can update own doc_notes'
  ) THEN
    CREATE POLICY "Users can update own doc_notes"
      ON doc_notes FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_notes' AND policyname = 'Users can delete own doc_notes'
  ) THEN
    CREATE POLICY "Users can delete own doc_notes"
      ON doc_notes FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_note_categories' AND policyname = 'Users can view own doc_note_categories'
  ) THEN
    CREATE POLICY "Users can view own doc_note_categories"
      ON doc_note_categories FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM doc_notes n
          WHERE n.id = doc_note_categories.note_id
            AND n.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_note_categories' AND policyname = 'Users can insert own doc_note_categories'
  ) THEN
    CREATE POLICY "Users can insert own doc_note_categories"
      ON doc_note_categories FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM doc_notes n
          WHERE n.id = doc_note_categories.note_id
            AND n.user_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1
          FROM doc_categories c
          WHERE c.id = doc_note_categories.category_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_note_categories' AND policyname = 'Users can delete own doc_note_categories'
  ) THEN
    CREATE POLICY "Users can delete own doc_note_categories"
      ON doc_note_categories FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM doc_notes n
          WHERE n.id = doc_note_categories.note_id
            AND n.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_doc_notes_user_created
  ON doc_notes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_notes_user_archived_created
  ON doc_notes(user_id, is_archived, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_categories_user_order
  ON doc_categories(user_id, order_num);

CREATE INDEX IF NOT EXISTS idx_doc_note_categories_note
  ON doc_note_categories(note_id);

CREATE INDEX IF NOT EXISTS idx_doc_note_categories_category
  ON doc_note_categories(category_id);
