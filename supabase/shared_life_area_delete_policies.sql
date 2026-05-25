-- Shared Life Area permissions: allow edit/co-owner users to UPDATE/DELETE tasks/events
-- created by other users in shared bubbles.
-- Run in Supabase Dashboard > SQL Editor (safe to re-run).

-- TASKS DELETE
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
DROP POLICY IF EXISTS "Users with edit permission can delete tasks in shared bubbles" ON tasks;

CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users with edit permission can delete tasks in shared bubbles" ON tasks
  FOR DELETE USING (
    bubble_id IN (
      SELECT bubble_id FROM bubble_shares
      WHERE shared_with_id = auth.uid()
        AND permission IN ('edit', 'co-owner')
    )
  );

-- TASKS UPDATE (re-run if production drifted)
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users with edit permission can update tasks in shared bubbles" ON tasks;

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

-- EVENTS DELETE
DROP POLICY IF EXISTS "Users can delete own events" ON events;
DROP POLICY IF EXISTS "Users with edit permission can delete events in shared bubbles" ON events;

CREATE POLICY "Users can delete own events" ON events
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users with edit permission can delete events in shared bubbles" ON events
  FOR DELETE USING (
    bubble_id IN (
      SELECT bubble_id FROM bubble_shares
      WHERE shared_with_id = auth.uid()
        AND permission IN ('edit', 'co-owner')
    )
  );

-- EVENTS UPDATE (re-run if production drifted)
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users with edit permission can update events in shared bubbles" ON events;

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
