-- AI mutation safety layer: idempotency ledger + atomic proposal apply RPC

CREATE TABLE IF NOT EXISTS ai_mutation_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  proposal_type TEXT NOT NULL,
  proposal_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'duplicate')),
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

ALTER TABLE ai_mutation_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_mutation_ledger'
      AND policyname = 'Users can view own ai_mutation_ledger'
  ) THEN
    CREATE POLICY "Users can view own ai_mutation_ledger"
      ON ai_mutation_ledger FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_mutation_ledger'
      AND policyname = 'Users can insert own ai_mutation_ledger'
  ) THEN
    CREATE POLICY "Users can insert own ai_mutation_ledger"
      ON ai_mutation_ledger FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_mutation_ledger'
      AND policyname = 'Users can update own ai_mutation_ledger'
  ) THEN
    CREATE POLICY "Users can update own ai_mutation_ledger"
      ON ai_mutation_ledger FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_ai_mutation_ledger_user_created
  ON ai_mutation_ledger(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_chat_proposal(
  p_idempotency_key TEXT,
  p_proposal JSONB,
  p_note_override TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_proposal_type TEXT := COALESCE(p_proposal->>'type', '');
  v_existing_result JSONB;
  v_claimed BOOLEAN := FALSE;
  v_result JSONB := '{}'::JSONB;

  v_title TEXT;
  v_notes TEXT;
  v_now TIMESTAMP WITH TIME ZONE := NOW();

  v_focal_id UUID;
  v_list_id UUID;
  v_item_id UUID;
  v_action_id UUID;
  v_time_block_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;
  IF v_proposal_type = '' THEN
    RAISE EXCEPTION 'proposal type is required';
  END IF;

  INSERT INTO ai_mutation_ledger (
    user_id,
    idempotency_key,
    proposal_type,
    proposal_payload,
    status
  )
  VALUES (
    v_user_id,
    p_idempotency_key,
    v_proposal_type,
    p_proposal,
    'pending'
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF NOT v_claimed THEN
    SELECT result
      INTO v_existing_result
      FROM ai_mutation_ledger
     WHERE user_id = v_user_id
       AND idempotency_key = p_idempotency_key;

    IF v_existing_result IS NULL THEN
      RETURN jsonb_build_object(
        'duplicate', TRUE,
        'status', 'duplicate',
        'type', v_proposal_type
      );
    END IF;

    UPDATE ai_mutation_ledger
      SET status = 'duplicate',
          updated_at = NOW()
      WHERE user_id = v_user_id
        AND idempotency_key = p_idempotency_key
        AND status <> 'applied';

    RETURN v_existing_result || jsonb_build_object('duplicate', TRUE, 'status', 'duplicate');
  END IF;

  v_title := COALESCE(NULLIF(btrim(p_proposal->>'title'), ''), 'Untitled');
  v_notes := COALESCE(NULLIF(btrim(p_note_override), ''), NULLIF(btrim(p_proposal->>'notes'), ''));

  IF v_proposal_type = 'create_focal' THEN
    INSERT INTO focals (user_id, name, order_num)
    VALUES (
      v_user_id,
      v_title,
      COALESCE((SELECT MAX(order_num) + 1 FROM focals WHERE user_id = v_user_id), 0)
    )
    RETURNING id INTO v_focal_id;

    v_result := jsonb_build_object(
      'status', 'applied',
      'type', v_proposal_type,
      'focal_id', v_focal_id::TEXT,
      'title', v_title
    );

  ELSIF v_proposal_type = 'create_list' THEN
    v_focal_id := NULLIF(p_proposal->>'focal_id', '')::UUID;
    IF v_focal_id IS NULL THEN
      RAISE EXCEPTION 'focal_id is required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM focals WHERE id = v_focal_id AND user_id = v_user_id) THEN
      RAISE EXCEPTION 'target focal not found';
    END IF;

    INSERT INTO lanes (user_id, focal_id, name, item_label, action_label, order_num)
    VALUES (
      v_user_id,
      v_focal_id,
      v_title,
      'Items',
      'Tasks',
      COALESCE((SELECT MAX(order_num) + 1 FROM lanes WHERE focal_id = v_focal_id AND user_id = v_user_id), 0)
    )
    RETURNING id INTO v_list_id;

    v_result := jsonb_build_object(
      'status', 'applied',
      'type', v_proposal_type,
      'list_id', v_list_id::TEXT,
      'title', v_title
    );

  ELSIF v_proposal_type = 'create_item' THEN
    v_list_id := NULLIF(p_proposal->>'list_id', '')::UUID;
    IF v_list_id IS NULL THEN
      RAISE EXCEPTION 'list_id is required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lanes WHERE id = v_list_id AND user_id = v_user_id) THEN
      RAISE EXCEPTION 'target list not found';
    END IF;

    INSERT INTO items (user_id, lane_id, title, description, status, order_num)
    VALUES (
      v_user_id,
      v_list_id,
      v_title,
      '',
      'pending',
      COALESCE((SELECT MAX(order_num) + 1 FROM items WHERE lane_id = v_list_id AND user_id = v_user_id), 0)
    )
    RETURNING id INTO v_item_id;

    v_result := jsonb_build_object(
      'status', 'applied',
      'type', v_proposal_type,
      'item_id', v_item_id::TEXT,
      'title', v_title
    );

  ELSIF v_proposal_type = 'create_action' OR v_proposal_type = 'create_follow_up_action' THEN
    v_item_id := NULLIF(p_proposal->>'item_id', '')::UUID;
    IF v_item_id IS NULL THEN
      RAISE EXCEPTION 'item_id is required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM items WHERE id = v_item_id AND user_id = v_user_id) THEN
      RAISE EXCEPTION 'target item not found';
    END IF;

    INSERT INTO actions (
      user_id,
      item_id,
      title,
      description,
      status,
      scheduled_at,
      order_num
    )
    VALUES (
      v_user_id,
      v_item_id,
      v_title,
      COALESCE(v_notes, ''),
      'pending',
      NULLIF(p_proposal->>'scheduled_at', '')::TIMESTAMP WITH TIME ZONE,
      COALESCE((SELECT MAX(order_num) + 1 FROM actions WHERE item_id = v_item_id AND user_id = v_user_id), 0)
    )
    RETURNING id INTO v_action_id;

    v_time_block_id := NULLIF(p_proposal->>'time_block_id', '')::UUID;
    IF v_time_block_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM time_blocks WHERE id = v_time_block_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'target time block not found';
      END IF;
      INSERT INTO time_block_links (
        user_id,
        time_block_id,
        lane_id,
        action_id,
        link_type,
        recurrence_mode
      )
      VALUES (
        v_user_id,
        v_time_block_id,
        NULLIF(p_proposal->>'lane_id', '')::UUID,
        v_action_id,
        'action',
        'match_event'
      )
      ON CONFLICT (time_block_id, item_id, action_id, link_type) DO NOTHING;
    END IF;

    v_result := jsonb_build_object(
      'status', 'applied',
      'type', v_proposal_type,
      'action_id', v_action_id::TEXT,
      'title', v_title,
      'time_block_id', COALESCE(v_time_block_id::TEXT, NULL)
    );

  ELSIF v_proposal_type = 'create_time_block' THEN
    INSERT INTO time_blocks (
      user_id,
      lane_id,
      title,
      description,
      start_time,
      end_time,
      recurrence_rule,
      include_weekends,
      timezone
    )
    VALUES (
      v_user_id,
      NULLIF(p_proposal->>'lane_id', '')::UUID,
      v_title,
      COALESCE(v_notes, ''),
      NULLIF(p_proposal->>'scheduled_start_utc', '')::TIMESTAMP WITH TIME ZONE,
      COALESCE(NULLIF(p_proposal->>'scheduled_end_utc', '')::TIMESTAMP WITH TIME ZONE, NULLIF(p_proposal->>'scheduled_start_utc', '')::TIMESTAMP WITH TIME ZONE + INTERVAL '1 hour'),
      'none',
      TRUE,
      'America/Denver'
    )
    RETURNING id INTO v_time_block_id;

    v_result := jsonb_build_object(
      'status', 'applied',
      'type', v_proposal_type,
      'time_block_id', v_time_block_id::TEXT,
      'title', v_title
    );

  ELSIF v_proposal_type = 'resolve_time_conflict' THEN
    v_time_block_id := NULLIF(p_proposal->>'conflict_time_block_id', '')::UUID;
    IF v_time_block_id IS NULL THEN
      RAISE EXCEPTION 'conflict_time_block_id is required';
    END IF;
    UPDATE time_blocks
       SET start_time = NULLIF(p_proposal->>'conflict_new_start_utc', '')::TIMESTAMP WITH TIME ZONE,
           end_time = NULLIF(p_proposal->>'conflict_new_end_utc', '')::TIMESTAMP WITH TIME ZONE,
           updated_at = v_now
     WHERE id = v_time_block_id
       AND user_id = v_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'conflict block not found';
    END IF;

    INSERT INTO time_blocks (
      user_id,
      lane_id,
      title,
      description,
      start_time,
      end_time,
      recurrence_rule,
      include_weekends,
      timezone
    )
    VALUES (
      v_user_id,
      NULLIF(p_proposal->>'lane_id', '')::UUID,
      COALESCE(NULLIF(p_proposal->>'event_title', ''), 'Untitled'),
      COALESCE(v_notes, ''),
      NULLIF(p_proposal->>'event_start_utc', '')::TIMESTAMP WITH TIME ZONE,
      NULLIF(p_proposal->>'event_end_utc', '')::TIMESTAMP WITH TIME ZONE,
      'none',
      TRUE,
      'America/Denver'
    )
    RETURNING id INTO v_action_id;

    v_result := jsonb_build_object(
      'status', 'applied',
      'type', v_proposal_type,
      'conflict_time_block_id', v_time_block_id::TEXT,
      'new_event_time_block_id', v_action_id::TEXT
    );

  ELSE
    RAISE EXCEPTION 'Unsupported proposal type: %', v_proposal_type;
  END IF;

  UPDATE ai_mutation_ledger
     SET status = 'applied',
         result = v_result,
         updated_at = NOW()
   WHERE user_id = v_user_id
     AND idempotency_key = p_idempotency_key;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_chat_proposal(TEXT, JSONB, TEXT) TO authenticated;
