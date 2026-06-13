-- Add exclude_from_plan column to tasks (low-priority entries excluded from daily plan suggestions)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS exclude_from_plan BOOLEAN DEFAULT FALSE;
