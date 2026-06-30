-- Life Area Coach profiles (assessment Q&A + structured summary per Life Area)

CREATE TABLE IF NOT EXISTS life_area_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES life_bubbles(id) ON DELETE CASCADE,

  primary_goal TEXT,
  current_focus TEXT[] NOT NULL DEFAULT '{}',
  known_obstacles TEXT[] NOT NULL DEFAULT '{}',
  current_state TEXT,
  motivations TEXT,
  success_criteria TEXT,

  raw_answers JSONB NOT NULL DEFAULT '[]',
  pending_question TEXT,

  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  assessed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, category_id)
);

ALTER TABLE life_area_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own life area profiles"
ON life_area_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view profiles in shared life areas"
ON life_area_profiles FOR SELECT
USING (
  category_id IN (
    SELECT bubble_id FROM bubble_shares WHERE shared_with_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own life area profiles"
ON life_area_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own life area profiles"
ON life_area_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own life area profiles"
ON life_area_profiles FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_life_area_profiles_user_id ON life_area_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_life_area_profiles_category_id ON life_area_profiles(category_id);

CREATE TRIGGER update_life_area_profiles_updated_at
  BEFORE UPDATE ON life_area_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
