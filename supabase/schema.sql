-- My Life Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. PROFILES TABLE (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LIFE BUBBLES TABLE (categories)
CREATE TABLE IF NOT EXISTS life_bubbles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TASKS TABLE (hierarchical tasks with 10 entry types)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bubble_id UUID REFERENCES life_bubbles(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'task',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  order_index INTEGER DEFAULT 0,
  assignee_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. EVENTS TABLE (calendar events with recurrence)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bubble_id UUID REFERENCES life_bubbles(id) ON DELETE SET NULL,
  linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'reminder', -- 'reminder', 'appointment', 'meeting', 'due_date'
  title TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL, -- YYYY-MM-DD format
  start_time TEXT NOT NULL, -- HH:MM format
  end_date TEXT NOT NULL,
  end_time TEXT NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'none', -- 'none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'
  series_id TEXT,
  is_exception BOOLEAN DEFAULT FALSE,
  original_date TEXT,
  attendee_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PEOPLE TABLE (contacts and relationships)
CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'other', -- 'family', 'friend', 'colleague', 'pet', 'teammate', 'other'
  email TEXT,
  phone TEXT,
  photo_uri TEXT,
  notes TEXT,
  category_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RECYCLE BIN TABLE (soft-deleted items)
CREATE TABLE IF NOT EXISTS recycle_bin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'task', 'category', 'event', 'person'
  item_data JSONB NOT NULL, -- Serialized original item data
  related_items JSONB, -- Related tasks/children that were deleted together
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_bubbles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE USING (auth.uid() = id);

-- LIFE_BUBBLES policies
CREATE POLICY "Users can view own bubbles" ON life_bubbles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bubbles" ON life_bubbles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bubbles" ON life_bubbles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bubbles" ON life_bubbles
  FOR DELETE USING (auth.uid() = user_id);

-- TASKS policies
CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- EVENTS policies
CREATE POLICY "Users can view own events" ON events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events" ON events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events" ON events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events" ON events
  FOR DELETE USING (auth.uid() = user_id);

-- PEOPLE policies
CREATE POLICY "Users can view own people" ON people
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own people" ON people
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own people" ON people
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own people" ON people
  FOR DELETE USING (auth.uid() = user_id);

-- Enable RLS on recycle_bin
ALTER TABLE recycle_bin ENABLE ROW LEVEL SECURITY;

-- RECYCLE_BIN policies
CREATE POLICY "Users can view own recycle bin" ON recycle_bin
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recycle bin" ON recycle_bin
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recycle bin" ON recycle_bin
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recycle bin" ON recycle_bin
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INDEXES for better query performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_life_bubbles_user_id ON life_bubbles(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_bubble_id ON tasks(bubble_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_user_id ON recycle_bin(user_id);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_deleted_at ON recycle_bin(deleted_at);

-- ============================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_life_bubbles_updated_at
  BEFORE UPDATE ON life_bubbles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
