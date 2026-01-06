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
  completion_type TEXT, -- 'as_of', 'until', or null for standard completion
  completion_date TEXT, -- YYYY-MM-DD for time-bound completions
  is_recurring BOOLEAN DEFAULT FALSE,
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
  notification_id_advance TEXT,
  notification_id_at_start TEXT,
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
  linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_consent_status TEXT DEFAULT NULL, -- 'pending', 'approved', 'declined', or null
  linked_user_display_name TEXT,
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

-- 7. PENDING SHARES TABLE (invites for non-app-users)
CREATE TABLE IF NOT EXISTS pending_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bubble_id UUID NOT NULL REFERENCES life_bubbles(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  contact_type TEXT NOT NULL, -- 'email' or 'phone'
  contact_value TEXT NOT NULL, -- email address or phone number
  permission TEXT NOT NULL DEFAULT 'view', -- 'view', 'edit', 'co-owner'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'expired'
  sender_name TEXT, -- Name of person who sent invite
  bubble_name TEXT, -- Name of bubble being shared
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- 8. BUBBLE SHARES TABLE (active shares between app users)
CREATE TABLE IF NOT EXISTS bubble_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bubble_id UUID NOT NULL REFERENCES life_bubbles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view', -- 'view', 'edit', 'co-owner'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bubble_id, shared_with_id)
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

CREATE POLICY "Users can view shared bubbles" ON life_bubbles
  FOR SELECT USING (
    id IN (
      SELECT bubble_id FROM bubble_shares WHERE shared_with_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own bubbles" ON life_bubbles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bubbles" ON life_bubbles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users with edit permission can update shared bubbles" ON life_bubbles
  FOR UPDATE USING (
    id IN (
      SELECT bubble_id FROM bubble_shares 
      WHERE shared_with_id = auth.uid() 
        AND permission IN ('edit', 'co-owner')
    )
  );

CREATE POLICY "Users can delete own bubbles" ON life_bubbles
  FOR DELETE USING (auth.uid() = user_id);

-- TASKS policies
CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view tasks in shared bubbles" ON tasks
  FOR SELECT USING (
    bubble_id IN (
      SELECT bubble_id FROM bubble_shares WHERE shared_with_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users with edit permission can update tasks in shared bubbles" ON tasks
  FOR UPDATE USING (
    bubble_id IN (
      SELECT bubble_id FROM bubble_shares 
      WHERE shared_with_id = auth.uid() 
        AND permission IN ('edit', 'co-owner')
    )
  );

CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- EVENTS policies
CREATE POLICY "Users can view own events" ON events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view events in shared bubbles" ON events
  FOR SELECT USING (
    bubble_id IN (
      SELECT bubble_id FROM bubble_shares WHERE shared_with_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own events" ON events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events" ON events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users with edit permission can update events in shared bubbles" ON events
  FOR UPDATE USING (
    bubble_id IN (
      SELECT bubble_id FROM bubble_shares 
      WHERE shared_with_id = auth.uid() 
        AND permission IN ('edit', 'co-owner')
    )
  );

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

-- Enable RLS on pending_shares and bubble_shares
ALTER TABLE pending_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE bubble_shares ENABLE ROW LEVEL SECURITY;

-- PENDING_SHARES policies (restrictive - only owners and email recipients can see/update)
CREATE POLICY "Users can view own pending shares" ON pending_shares
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view pending shares sent to them by email" ON pending_shares
  FOR SELECT USING (
    contact_type = 'email' AND LOWER(contact_value) IN (
      SELECT LOWER(email) FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own pending shares" ON pending_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending shares" ON pending_shares
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Email recipients can accept pending shares" ON pending_shares
  FOR UPDATE USING (
    contact_type = 'email' AND LOWER(contact_value) IN (
      SELECT LOWER(email) FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own pending shares" ON pending_shares
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- SECURE RPC FUNCTION FOR INVITE CODE ACTIVATION
-- ============================================
-- This function allows secure activation of pending shares by invite code
-- It bypasses RLS to validate the code and create the share atomically
-- SECURITY: Uses auth.uid() to ensure the caller can only activate for themselves
CREATE OR REPLACE FUNCTION activate_pending_invite(
  p_invite_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite pending_shares%ROWTYPE;
  v_caller_id UUID;
BEGIN
  -- Get the authenticated user's ID (security check)
  v_caller_id := auth.uid();
  
  -- Ensure user is authenticated
  IF v_caller_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;

  -- Find the pending invite by code
  SELECT * INTO v_invite
  FROM pending_shares
  WHERE invite_code = p_invite_code
    AND status = 'pending'
    AND expires_at > NOW()
  LIMIT 1;

  -- Check if invite was found
  IF v_invite.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired invite code'
    );
  END IF;

  -- Create the bubble share for the authenticated caller (not a client-supplied ID)
  INSERT INTO bubble_shares (bubble_id, owner_id, shared_with_id, permission)
  VALUES (v_invite.bubble_id, v_invite.user_id, v_caller_id, v_invite.permission)
  ON CONFLICT (bubble_id, shared_with_id) 
  DO UPDATE SET permission = EXCLUDED.permission, updated_at = NOW();

  -- Mark the pending share as accepted
  UPDATE pending_shares
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = v_invite.id;

  -- Return success with bubble info
  RETURN json_build_object(
    'success', true,
    'bubble_name', v_invite.bubble_name,
    'sender_name', v_invite.sender_name
  );
END;
$$;

-- BUBBLE_SHARES policies
CREATE POLICY "Owners can view shared bubbles" ON bubble_shares
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Recipients can view bubbles shared with them" ON bubble_shares
  FOR SELECT USING (auth.uid() = shared_with_id);

CREATE POLICY "Owners can insert bubble shares" ON bubble_shares
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update bubble shares" ON bubble_shares
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete bubble shares" ON bubble_shares
  FOR DELETE USING (auth.uid() = owner_id);

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
CREATE INDEX IF NOT EXISTS idx_pending_shares_user_id ON pending_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_shares_invite_code ON pending_shares(invite_code);
CREATE INDEX IF NOT EXISTS idx_pending_shares_contact ON pending_shares(contact_value);
CREATE INDEX IF NOT EXISTS idx_bubble_shares_bubble_id ON bubble_shares(bubble_id);
CREATE INDEX IF NOT EXISTS idx_bubble_shares_owner_id ON bubble_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_bubble_shares_shared_with_id ON bubble_shares(shared_with_id);

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

-- ============================================
-- HABITS TABLE (for habit tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bubble_id UUID REFERENCES life_bubbles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  habit_type TEXT NOT NULL DEFAULT 'positive', -- 'positive' or 'negative'
  goal_frequency TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
  goal_count INTEGER DEFAULT 1, -- Number of times per frequency period
  linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- For task-to-habit promotion
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- OCCURRENCES TABLE (unified tracking for tasks and habits)
-- ============================================
CREATE TABLE IF NOT EXISTS occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL, -- References either task.id or habit.id
  item_type TEXT NOT NULL, -- 'task' or 'habit'
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurred_date TEXT NOT NULL, -- YYYY-MM-DD for easier querying
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE occurrences ENABLE ROW LEVEL SECURITY;

-- HABITS policies
CREATE POLICY "Users can view own habits" ON habits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view habits in shared bubbles" ON habits
  FOR SELECT USING (
    bubble_id IN (
      SELECT bubble_id FROM bubble_shares WHERE shared_with_id = auth.uid()
    )
  );

CREATE POLICY "Owners can view all habits in their bubbles" ON habits
  FOR SELECT USING (
    bubble_id IN (
      SELECT id FROM life_bubbles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own habits" ON habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habits" ON habits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users with edit permission can update habits in shared bubbles" ON habits
  FOR UPDATE USING (
    bubble_id IN (
      SELECT bubble_id FROM bubble_shares 
      WHERE shared_with_id = auth.uid() 
        AND permission IN ('edit', 'co-owner')
    )
  );

CREATE POLICY "Users can delete own habits" ON habits
  FOR DELETE USING (auth.uid() = user_id);

-- OCCURRENCES policies
CREATE POLICY "Users can view own occurrences" ON occurrences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view occurrences for items in shared bubbles" ON occurrences
  FOR SELECT USING (
    (item_type = 'task' AND item_id IN (
      SELECT id FROM tasks WHERE bubble_id IN (
        SELECT bubble_id FROM bubble_shares WHERE shared_with_id = auth.uid()
      )
    ))
    OR
    (item_type = 'habit' AND item_id IN (
      SELECT id FROM habits WHERE bubble_id IN (
        SELECT bubble_id FROM bubble_shares WHERE shared_with_id = auth.uid()
      )
    ))
  );

CREATE POLICY "Users can insert own occurrences" ON occurrences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own occurrences" ON occurrences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own occurrences" ON occurrences
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for habits and occurrences
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_bubble_id ON habits(bubble_id);
CREATE INDEX IF NOT EXISTS idx_habits_linked_task_id ON habits(linked_task_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_user_id ON occurrences(user_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_item_id ON occurrences(item_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_item_type ON occurrences(item_type);
CREATE INDEX IF NOT EXISTS idx_occurrences_occurred_date ON occurrences(occurred_date);

-- Triggers for habits
CREATE TRIGGER update_habits_updated_at
  BEFORE UPDATE ON habits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTIFICATIONS SYSTEM
-- ============================================

-- Add notification preferences column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"enabled": true, "bubbleShares": true, "taskAssignments": true, "eventReminders": true, "reminderMinutesBefore": 60}'::jsonb;

-- NOTIFICATIONS TABLE (in-app notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'bubble_shared', 'task_assigned', 'event_reminder', 'event_updated', 'bubble_updated'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- NOTIFICATIONS policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications for any user" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Index for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- PEOPLE-TO-USER LINKAGE
-- ============================================

-- Index for linked_user_id lookup
CREATE INDEX IF NOT EXISTS idx_people_linked_user_id ON people(linked_user_id);

-- Secure RPC function to lookup users by email for linking
-- Returns minimal info: id and display_name only (never exposes sensitive data)
CREATE OR REPLACE FUNCTION lookup_user_by_email(lookup_email TEXT)
RETURNS TABLE (user_id UUID, display_name TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    COALESCE(p.display_name, p.email) as display_name
  FROM profiles p
  WHERE LOWER(p.email) = LOWER(lookup_email)
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION lookup_user_by_email(TEXT) TO authenticated;

-- Function to send notification to linked user when assigned to task/event
CREATE OR REPLACE FUNCTION notify_linked_user(
  target_user_id UUID,
  notification_type TEXT,
  notification_title TEXT,
  notification_body TEXT,
  notification_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data, is_read)
  VALUES (target_user_id, notification_type, notification_title, notification_body, notification_data, false)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION notify_linked_user(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Function to update consent status on a person record (for connection responses)
-- This allows the linked user to approve/decline the connection request
CREATE OR REPLACE FUNCTION respond_to_connection(
  person_id UUID,
  responder_user_id UUID,
  new_consent_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE people 
  SET linked_consent_status = new_consent_status,
      updated_at = NOW()
  WHERE id = person_id 
    AND linked_user_id = responder_user_id;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION respond_to_connection(UUID, UUID, TEXT) TO authenticated;
