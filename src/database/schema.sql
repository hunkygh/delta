-- Delta App - Focal Board Database Schema
-- Hierarchy: users → focals → lanes → items → actions

-- Focals (top-level focus areas)
CREATE TABLE IF NOT EXISTS focals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_num INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lanes (semantic containers inside Focal)
CREATE TABLE IF NOT EXISTS lanes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  focal_id UUID REFERENCES focals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  item_label TEXT, -- optional override (e.g. "Workout", "Lead")
  action_label TEXT, -- optional override (e.g. "Lift", "Step")
  order_num INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lane Statuses (custom per-lane status system)
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

-- Items (leads/workouts/meals - whatever the lane defines)
CREATE TABLE IF NOT EXISTS items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lane_id UUID REFERENCES lanes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status_id UUID REFERENCES lane_statuses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed
  signal_label TEXT NOT NULL DEFAULT 'normal',
  signal_score NUMERIC NOT NULL DEFAULT 0,
  order_num INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Actions (executable units)
CREATE TABLE IF NOT EXISTS actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed
  scheduled_at TIMESTAMP WITH TIME ZONE, -- when this action should happen
  order_num INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Item comments (persistent thread across all recurrences)
CREATE TABLE IF NOT EXISTS item_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unified scoped threads: item | action | timeblock
CREATE TABLE IF NOT EXISTS threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('item', 'action', 'timeblock')),
  scope_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(scope_type, scope_id)
);

-- Unified comments attached to threads
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Time Blocks for Calendar integration
CREATE TABLE IF NOT EXISTS time_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  focal_id UUID REFERENCES focals(id) ON DELETE SET NULL,
  lane_id UUID REFERENCES lanes(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  recurrence_rule TEXT NOT NULL DEFAULT 'none', -- none, daily, weekly, monthly, custom
  recurrence_config JSONB,
  include_weekends BOOLEAN NOT NULL DEFAULT TRUE,
  timezone TEXT DEFAULT 'America/Denver',
  tags JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Join table for time_blocks ↔ actions (if many-to-many)
CREATE TABLE IF NOT EXISTS time_block_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_block_id UUID REFERENCES time_blocks(id) ON DELETE CASCADE,
  action_id UUID REFERENCES actions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(time_block_id, action_id) -- prevent duplicates
);

-- Canonical links between calendar blocks and focal entities
CREATE TABLE IF NOT EXISTS time_block_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_block_id UUID REFERENCES time_blocks(id) ON DELETE CASCADE,
  lane_id UUID REFERENCES lanes(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  action_id UUID REFERENCES actions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('item', 'action')),
  recurrence_mode TEXT NOT NULL DEFAULT 'match_event' CHECK (recurrence_mode IN ('match_event', 'custom')),
  recurrence_rule TEXT,
  recurrence_config JSONB,
  recurrence_limit_count INTEGER,
  recurrence_limit_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(time_block_id, item_id, action_id, link_type)
);

-- Row Level Security Policies
ALTER TABLE focals ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lane_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_block_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_block_links ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own focals" ON focals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own focals" ON focals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own focals" ON focals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own focals" ON focals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own lanes" ON lanes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lanes" ON lanes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lanes" ON lanes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lanes" ON lanes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own lane_statuses" ON lane_statuses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lane_statuses" ON lane_statuses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lane_statuses" ON lane_statuses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lane_statuses" ON lane_statuses FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own items" ON items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own items" ON items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own items" ON items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own items" ON items FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own actions" ON actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own actions" ON actions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own actions" ON actions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own actions" ON actions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own item_comments" ON item_comments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own item_comments" ON item_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own item_comments" ON item_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own item_comments" ON item_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own threads" ON threads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own threads" ON threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own threads" ON threads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own threads" ON threads FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view comments in own threads" ON comments FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM threads t
    WHERE t.id = comments.thread_id
      AND t.user_id = auth.uid()
  )
);
CREATE POLICY "Users can insert comments in own threads" ON comments FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM threads t
    WHERE t.id = comments.thread_id
      AND t.user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete comments in own threads" ON comments FOR DELETE USING (
  EXISTS (
    SELECT 1
    FROM threads t
    WHERE t.id = comments.thread_id
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view own time_blocks" ON time_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own time_blocks" ON time_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own time_blocks" ON time_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own time_blocks" ON time_blocks FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own time_block_actions" ON time_block_actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own time_block_actions" ON time_block_actions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own time_block_actions" ON time_block_actions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own time_block_actions" ON time_block_actions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own time_block_links" ON time_block_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own time_block_links" ON time_block_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own time_block_links" ON time_block_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own time_block_links" ON time_block_links FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_focals_user_id ON focals(user_id);
CREATE INDEX IF NOT EXISTS idx_focals_order ON focals(user_id, order_num);

CREATE INDEX IF NOT EXISTS idx_lanes_focal_id ON lanes(focal_id);
CREATE INDEX IF NOT EXISTS idx_lanes_user_id ON lanes(user_id);
CREATE INDEX IF NOT EXISTS idx_lanes_order ON lanes(focal_id, order_num);

CREATE INDEX IF NOT EXISTS idx_lane_statuses_lane_id ON lane_statuses(lane_id);
CREATE INDEX IF NOT EXISTS idx_lane_statuses_user_id ON lane_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_lane_statuses_order ON lane_statuses(lane_id, order_num);

CREATE INDEX IF NOT EXISTS idx_items_lane_id ON items(lane_id);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON items(lane_id, order_num);
CREATE INDEX IF NOT EXISTS idx_items_status_id ON items(status_id);
CREATE INDEX IF NOT EXISTS idx_items_signal ON items(signal_score DESC, signal_label);

CREATE INDEX IF NOT EXISTS idx_actions_item_id ON actions(item_id);
CREATE INDEX IF NOT EXISTS idx_actions_user_id ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_order ON actions(item_id, order_num);
CREATE INDEX IF NOT EXISTS idx_actions_scheduled_at ON actions(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_item_comments_item_id ON item_comments(item_id);
CREATE INDEX IF NOT EXISTS idx_item_comments_user_id ON item_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_item_comments_created_at ON item_comments(item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_threads_scope ON threads(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_thread_time ON comments(thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON time_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_start_time ON time_blocks(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_time_blocks_lane_id ON time_blocks(lane_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_focal_id ON time_blocks(focal_id);

CREATE INDEX IF NOT EXISTS idx_time_block_actions_time_block ON time_block_actions(time_block_id);
CREATE INDEX IF NOT EXISTS idx_time_block_actions_action ON time_block_actions(action_id);
CREATE INDEX IF NOT EXISTS idx_time_block_actions_user ON time_block_actions(user_id);

CREATE INDEX IF NOT EXISTS idx_time_block_links_time_block ON time_block_links(time_block_id);
CREATE INDEX IF NOT EXISTS idx_time_block_links_item ON time_block_links(item_id);
CREATE INDEX IF NOT EXISTS idx_time_block_links_action ON time_block_links(action_id);
CREATE INDEX IF NOT EXISTS idx_time_block_links_user ON time_block_links(user_id);
