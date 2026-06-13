-- Add is_recurring column to tasks (defined in schema.sql but may be missing on existing projects)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
