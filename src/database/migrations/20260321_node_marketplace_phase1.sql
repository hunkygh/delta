-- Published node marketplace + per-user node installs/assignments

CREATE TABLE IF NOT EXISTS published_nodes (
  id TEXT PRIMARY KEY,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  version TEXT NOT NULL,
  category TEXT NOT NULL,
  setup_summary TEXT NOT NULL,
  setup_prompt TEXT NOT NULL,
  structure_blueprint TEXT,
  structure_config JSONB,
  setup_logic TEXT,
  operate_logic TEXT,
  icon_key TEXT NOT NULL DEFAULT 'app' CHECK (icon_key IN ('app', 'compass', 'computer_dollar')),
  version_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE published_nodes
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS structure_blueprint TEXT,
  ADD COLUMN IF NOT EXISTS structure_config JSONB,
  ADD COLUMN IF NOT EXISTS setup_logic TEXT,
  ADD COLUMN IF NOT EXISTS operate_logic TEXT,
  ADD COLUMN IF NOT EXISTS version_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE published_nodes
  DROP CONSTRAINT IF EXISTS published_nodes_icon_key_check;

ALTER TABLE published_nodes
  ADD CONSTRAINT published_nodes_icon_key_check
  CHECK (icon_key IN ('app', 'compass', 'computer_dollar'));

CREATE TABLE IF NOT EXISTS installed_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES published_nodes(id) ON DELETE CASCADE,
  setup_completed BOOLEAN NOT NULL DEFAULT FALSE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, node_id)
);

CREATE TABLE IF NOT EXISTS installed_node_focals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installed_node_id UUID NOT NULL REFERENCES installed_nodes(id) ON DELETE CASCADE,
  focal_id UUID NOT NULL REFERENCES focals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (installed_node_id, focal_id)
);

CREATE INDEX IF NOT EXISTS idx_published_nodes_active
  ON published_nodes(is_active, name);

CREATE INDEX IF NOT EXISTS idx_installed_nodes_user
  ON installed_nodes(user_id, installed_at DESC);

CREATE INDEX IF NOT EXISTS idx_installed_node_focals_installed_node
  ON installed_node_focals(installed_node_id);

CREATE OR REPLACE FUNCTION set_node_marketplace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_published_nodes_updated_at ON published_nodes;
CREATE TRIGGER trg_published_nodes_updated_at
BEFORE UPDATE ON published_nodes
FOR EACH ROW
EXECUTE FUNCTION set_node_marketplace_updated_at();

DROP TRIGGER IF EXISTS trg_installed_nodes_updated_at ON installed_nodes;
CREATE TRIGGER trg_installed_nodes_updated_at
BEFORE UPDATE ON installed_nodes
FOR EACH ROW
EXECUTE FUNCTION set_node_marketplace_updated_at();

ALTER TABLE published_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE installed_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE installed_node_focals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'published_nodes'
      AND policyname = 'Anyone can view active published nodes'
  ) THEN
    CREATE POLICY "Anyone can view active published nodes"
      ON published_nodes FOR SELECT
      USING (is_active = TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'published_nodes'
      AND policyname = 'Owners can update published nodes'
  ) THEN
    CREATE POLICY "Owners can update published nodes"
      ON published_nodes FOR UPDATE
      USING (owner_user_id = auth.uid() OR owner_user_id IS NULL)
      WITH CHECK (owner_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_nodes'
      AND policyname = 'Users can view own installed nodes'
  ) THEN
    CREATE POLICY "Users can view own installed nodes"
      ON installed_nodes FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_nodes'
      AND policyname = 'Users can insert own installed nodes'
  ) THEN
    CREATE POLICY "Users can insert own installed nodes"
      ON installed_nodes FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_nodes'
      AND policyname = 'Users can update own installed nodes'
  ) THEN
    CREATE POLICY "Users can update own installed nodes"
      ON installed_nodes FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_nodes'
      AND policyname = 'Users can delete own installed nodes'
  ) THEN
    CREATE POLICY "Users can delete own installed nodes"
      ON installed_nodes FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_node_focals'
      AND policyname = 'Users can view own installed node focal assignments'
  ) THEN
    CREATE POLICY "Users can view own installed node focal assignments"
      ON installed_node_focals FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM installed_nodes
          WHERE installed_nodes.id = installed_node_focals.installed_node_id
            AND installed_nodes.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_node_focals'
      AND policyname = 'Users can insert own installed node focal assignments'
  ) THEN
    CREATE POLICY "Users can insert own installed node focal assignments"
      ON installed_node_focals FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM installed_nodes
          WHERE installed_nodes.id = installed_node_focals.installed_node_id
            AND installed_nodes.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_node_focals'
      AND policyname = 'Users can delete own installed node focal assignments'
  ) THEN
    CREATE POLICY "Users can delete own installed node focal assignments"
      ON installed_node_focals FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM installed_nodes
          WHERE installed_nodes.id = installed_node_focals.installed_node_id
            AND installed_nodes.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

INSERT INTO published_nodes (
  id,
  owner_user_id,
  slug,
  name,
  summary,
  version,
  category,
  setup_summary,
  setup_prompt,
  structure_blueprint,
  structure_config,
  setup_logic,
  operate_logic,
  icon_key,
  version_notes,
  is_active
)
VALUES (
  'outside-sales-node',
  NULL,
  'outside-sales',
  'Outside Sales Node',
  'Turns a workspace into an account, outreach, visit, follow-up, and calendar execution system for field sales.',
  '0.1.0',
  'Sales',
  'Guides setup for account lists, statuses, fields, expected values, follow-up structure, and calendar/task behavior.',
  'Begin Outside Sales Node setup.',
  'Primary space structure: Accounts, Pipeline, Visits, Follow-Ups. Accounts/items should carry location context and ownership context. Tasks and time blocks should use that location context to shape routing and the day plan. Lists, statuses, and fields should support territory work, outreach cadence, visit planning, and follow-up execution.',
  '{"lists":[{"id":"accounts","name":"Accounts","itemLabel":"Account","taskLabel":"Follow-up","statuses":[{"id":"prospect","name":"Prospect","color":"#94a3b8","default":true},{"id":"contacted","name":"Contacted","color":"#f59e0b","default":false},{"id":"visit_scheduled","name":"Visit Scheduled","color":"#22c55e","default":false},{"id":"closed","name":"Closed","color":"#38bdf8","default":false}],"fields":[{"id":"location","name":"Location","type":"text","required":true,"pinned":true,"usedFor":["routing","day_planning"],"options":[]},{"id":"owner","name":"Owner","type":"contact","required":false,"pinned":true,"usedFor":["assignment"],"options":[]},{"id":"next_visit","name":"Next Visit","type":"date","required":false,"pinned":false,"usedFor":["scheduling"],"options":[]}]},{"id":"pipeline","name":"Pipeline","itemLabel":"Opportunity","taskLabel":"Action","statuses":[{"id":"new","name":"New","color":"#94a3b8","default":true},{"id":"active","name":"Active","color":"#22c55e","default":false},{"id":"stalled","name":"Stalled","color":"#f59e0b","default":false},{"id":"won","name":"Won","color":"#38bdf8","default":false}],"fields":[{"id":"account","name":"Account","type":"text","required":false,"pinned":true,"usedFor":["linking"],"options":[]},{"id":"value","name":"Deal Value","type":"number","required":false,"pinned":false,"usedFor":["prioritization"],"options":[]}]},{"id":"visits","name":"Visits","itemLabel":"Visit","taskLabel":"Visit task","statuses":[{"id":"planned","name":"Planned","color":"#94a3b8","default":true},{"id":"confirmed","name":"Confirmed","color":"#22c55e","default":false},{"id":"complete","name":"Complete","color":"#38bdf8","default":false}],"fields":[{"id":"account_ref","name":"Account","type":"text","required":false,"pinned":true,"usedFor":["routing"],"options":[]},{"id":"visit_location","name":"Visit Location","type":"text","required":true,"pinned":true,"usedFor":["routing","day_planning"],"options":[]}]},{"id":"follow_ups","name":"Follow-Ups","itemLabel":"Follow-Up","taskLabel":"Touch","statuses":[{"id":"queued","name":"Queued","color":"#94a3b8","default":true},{"id":"due_today","name":"Due Today","color":"#f59e0b","default":false},{"id":"done","name":"Done","color":"#22c55e","default":false}],"fields":[{"id":"account_link","name":"Account","type":"text","required":false,"pinned":true,"usedFor":["linking"],"options":[]},{"id":"channel","name":"Channel","type":"select","required":false,"pinned":false,"usedFor":[],"options":[{"id":"call","label":"Call"},{"id":"email","label":"Email"},{"id":"visit","label":"Visit"}]}]}],"planning":{"locationFieldName":"Location","useLocationForRouting":true,"useLocationForDayPlanning":true,"defaultTaskPlacement":"inside_time_block","noteIngestionMode":"assistive","timeBlockNaming":[{"id":"prospecting","label":"Prospecting","aliases":["prospecting","prospect"],"template":"Prospecting Block {n}"},{"id":"follow_up","label":"Follow-Up","aliases":["follow up","follow-up","followups"],"template":"Follow-Up Block {n}"},{"id":"visits","label":"Visits","aliases":["visit","visits","field visit"],"template":"Visit Block {n}"}]}}'::jsonb,
  'Active node: Outside Sales Node. Inspect the assigned space structure and compare it against a strong outside-sales operating model. Identify missing or mismatched lists, statuses, columns, expected values, and task/calendar workflows. Recommend concrete setup changes as executable steps the app can apply. Keep the setup collaborative, concise, and execution-first.',
  'Active node: Outside Sales Node. Operate like a delegated outside-sales assistant. Interpret notes and requests in terms of accounts, follow-ups, visits, outreach, scheduling, next steps, and carry-forward work. Prefer action-family routing over item-only routing when the request is clearly about scheduling, planning, or execution. Use the workspace as source of truth and keep actions app-native.',
  'computer_dollar',
  'Initial published node release with installable setup flow, sales-space assignment, and executable workspace scaffolding.',
  TRUE
)
ON CONFLICT (id) DO UPDATE
SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  summary = EXCLUDED.summary,
  version = EXCLUDED.version,
  category = EXCLUDED.category,
  setup_summary = EXCLUDED.setup_summary,
  setup_prompt = EXCLUDED.setup_prompt,
  structure_blueprint = EXCLUDED.structure_blueprint,
  structure_config = EXCLUDED.structure_config,
  setup_logic = EXCLUDED.setup_logic,
  operate_logic = EXCLUDED.operate_logic,
  icon_key = EXCLUDED.icon_key,
  version_notes = EXCLUDED.version_notes,
  is_active = EXCLUDED.is_active,
  updated_at = now();
