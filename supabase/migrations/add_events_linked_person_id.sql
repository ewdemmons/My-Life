-- Already applied manually in Supabase. Documentation only — do not execute.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS linked_person_id UUID REFERENCES people(id) ON DELETE SET NULL;
