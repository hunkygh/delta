-- Phase: persistent AI chat threads and messages

CREATE TABLE IF NOT EXISTS ai_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kicker TEXT,
  scope_key TEXT NOT NULL DEFAULT 'general',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES ai_chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system_marker')),
  content TEXT NOT NULL,
  context JSONB,
  proposals JSONB,
  debug_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_threads_user_last_message
  ON ai_chat_threads(user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_threads_scope_key
  ON ai_chat_threads(user_id, scope_key);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_thread_created
  ON ai_chat_messages(thread_id, created_at);

CREATE OR REPLACE FUNCTION set_ai_chat_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_chat_threads_updated_at ON ai_chat_threads;
CREATE TRIGGER trg_ai_chat_threads_updated_at
BEFORE UPDATE ON ai_chat_threads
FOR EACH ROW
EXECUTE FUNCTION set_ai_chat_threads_updated_at();

ALTER TABLE ai_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_chat_threads'
      AND policyname = 'Users can view own ai chat threads'
  ) THEN
    CREATE POLICY "Users can view own ai chat threads"
      ON ai_chat_threads FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_chat_threads'
      AND policyname = 'Users can insert own ai chat threads'
  ) THEN
    CREATE POLICY "Users can insert own ai chat threads"
      ON ai_chat_threads FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_chat_threads'
      AND policyname = 'Users can update own ai chat threads'
  ) THEN
    CREATE POLICY "Users can update own ai chat threads"
      ON ai_chat_threads FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_chat_threads'
      AND policyname = 'Users can delete own ai chat threads'
  ) THEN
    CREATE POLICY "Users can delete own ai chat threads"
      ON ai_chat_threads FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_chat_messages'
      AND policyname = 'Users can view messages in own ai chat threads'
  ) THEN
    CREATE POLICY "Users can view messages in own ai chat threads"
      ON ai_chat_messages FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM ai_chat_threads t
          WHERE t.id = ai_chat_messages.thread_id
            AND t.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_chat_messages'
      AND policyname = 'Users can insert messages in own ai chat threads'
  ) THEN
    CREATE POLICY "Users can insert messages in own ai chat threads"
      ON ai_chat_messages FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM ai_chat_threads t
          WHERE t.id = ai_chat_messages.thread_id
            AND t.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_chat_messages'
      AND policyname = 'Users can delete messages in own ai chat threads'
  ) THEN
    CREATE POLICY "Users can delete messages in own ai chat threads"
      ON ai_chat_messages FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM ai_chat_threads t
          WHERE t.id = ai_chat_messages.thread_id
            AND t.user_id = auth.uid()
        )
      );
  END IF;
END
$$;
