ALTER TABLE published_nodes
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS structure_blueprint TEXT,
  ADD COLUMN IF NOT EXISTS structure_config JSONB,
  ADD COLUMN IF NOT EXISTS setup_logic TEXT,
  ADD COLUMN IF NOT EXISTS operate_logic TEXT;

ALTER TABLE published_nodes
  DROP CONSTRAINT IF EXISTS published_nodes_icon_key_check;

ALTER TABLE published_nodes
  ADD CONSTRAINT published_nodes_icon_key_check
  CHECK (icon_key IN ('app', 'compass', 'computer_dollar'));

DO $$
BEGIN
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
END
$$;

UPDATE published_nodes
SET
  setup_prompt = COALESCE(NULLIF(setup_prompt, ''), 'Begin Outside Sales Node setup.'),
  structure_blueprint = COALESCE(
    structure_blueprint,
    'Primary space structure: Accounts, Pipeline, Visits, Follow-Ups. Accounts/items should carry location context and ownership context. Tasks and time blocks should use that location context to shape routing and the day plan. Lists, statuses, and fields should support territory work, outreach cadence, visit planning, and follow-up execution.'
  ),
  structure_config = COALESCE(
    structure_config,
    '{"lists":[{"id":"accounts","name":"Accounts","itemLabel":"Account","taskLabel":"Follow-up","statuses":[{"id":"prospect","name":"Prospect","color":"#94a3b8","default":true},{"id":"contacted","name":"Contacted","color":"#f59e0b","default":false},{"id":"visit_scheduled","name":"Visit Scheduled","color":"#22c55e","default":false},{"id":"closed","name":"Closed","color":"#38bdf8","default":false}],"fields":[{"id":"location","name":"Location","type":"text","required":true,"pinned":true,"usedFor":["routing","day_planning"],"options":[]},{"id":"owner","name":"Owner","type":"contact","required":false,"pinned":true,"usedFor":["assignment"],"options":[]},{"id":"next_visit","name":"Next Visit","type":"date","required":false,"pinned":false,"usedFor":["scheduling"],"options":[]}]},{"id":"pipeline","name":"Pipeline","itemLabel":"Opportunity","taskLabel":"Action","statuses":[{"id":"new","name":"New","color":"#94a3b8","default":true},{"id":"active","name":"Active","color":"#22c55e","default":false},{"id":"stalled","name":"Stalled","color":"#f59e0b","default":false},{"id":"won","name":"Won","color":"#38bdf8","default":false}],"fields":[{"id":"account","name":"Account","type":"text","required":false,"pinned":true,"usedFor":["linking"],"options":[]},{"id":"value","name":"Deal Value","type":"number","required":false,"pinned":false,"usedFor":["prioritization"],"options":[]}]},{"id":"visits","name":"Visits","itemLabel":"Visit","taskLabel":"Visit task","statuses":[{"id":"planned","name":"Planned","color":"#94a3b8","default":true},{"id":"confirmed","name":"Confirmed","color":"#22c55e","default":false},{"id":"complete","name":"Complete","color":"#38bdf8","default":false}],"fields":[{"id":"account_ref","name":"Account","type":"text","required":false,"pinned":true,"usedFor":["routing"],"options":[]},{"id":"visit_location","name":"Visit Location","type":"text","required":true,"pinned":true,"usedFor":["routing","day_planning"],"options":[]}]},{"id":"follow_ups","name":"Follow-Ups","itemLabel":"Follow-Up","taskLabel":"Touch","statuses":[{"id":"queued","name":"Queued","color":"#94a3b8","default":true},{"id":"due_today","name":"Due Today","color":"#f59e0b","default":false},{"id":"done","name":"Done","color":"#22c55e","default":false}],"fields":[{"id":"account_link","name":"Account","type":"text","required":false,"pinned":true,"usedFor":["linking"],"options":[]},{"id":"channel","name":"Channel","type":"select","required":false,"pinned":false,"usedFor":[],"options":[{"id":"call","label":"Call"},{"id":"email","label":"Email"},{"id":"visit","label":"Visit"}]}]}],"planning":{"locationFieldName":"Location","useLocationForRouting":true,"useLocationForDayPlanning":true,"defaultTaskPlacement":"inside_time_block","noteIngestionMode":"assistive","timeBlockNaming":[{"id":"prospecting","label":"Prospecting","aliases":["prospecting","prospect"],"template":"Prospecting Block {n}"},{"id":"follow_up","label":"Follow-Up","aliases":["follow up","follow-up","followups"],"template":"Follow-Up Block {n}"},{"id":"visits","label":"Visits","aliases":["visit","visits","field visit"],"template":"Visit Block {n}"}]}}'::jsonb
  ),
  setup_logic = COALESCE(
    setup_logic,
    'Active node: Outside Sales Node. Inspect the assigned space structure and compare it against a strong outside-sales operating model. Identify missing or mismatched lists, statuses, columns, expected values, and task/calendar workflows. Recommend concrete setup changes as executable steps the app can apply. Keep the setup collaborative, concise, and execution-first.'
  ),
  operate_logic = COALESCE(
    operate_logic,
    'Active node: Outside Sales Node. Operate like a delegated outside-sales assistant. Interpret notes and requests in terms of accounts, follow-ups, visits, outreach, scheduling, next steps, and carry-forward work. Prefer action-family routing over item-only routing when the request is clearly about scheduling, planning, or execution. Use the workspace as source of truth and keep actions app-native.'
  )
WHERE id = 'outside-sales-node';

UPDATE published_nodes
SET icon_key = 'computer_dollar'
WHERE id = 'outside-sales-node';
