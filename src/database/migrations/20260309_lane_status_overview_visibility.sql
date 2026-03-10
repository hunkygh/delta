-- Allow hiding specific statuses from Spaces overview snapshot.

ALTER TABLE lane_statuses
  ADD COLUMN IF NOT EXISTS show_in_overview BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_lane_statuses_lane_overview
  ON lane_statuses(lane_id, show_in_overview, order_num);
