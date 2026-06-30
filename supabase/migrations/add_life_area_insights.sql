-- Life Area Coach insights cache (AI-generated insights per Life Area)

CREATE TABLE IF NOT EXISTS life_area_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES life_bubbles(id) ON DELETE CASCADE,

  insights JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activity_watermark JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, category_id)
);

ALTER TABLE life_area_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own life area insights"
ON life_area_insights FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view insights in shared life areas"
ON life_area_insights FOR SELECT
USING (
  category_id IN (
    SELECT bubble_id FROM bubble_shares WHERE shared_with_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own life area insights"
ON life_area_insights FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own life area insights"
ON life_area_insights FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own life area insights"
ON life_area_insights FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_life_area_insights_user_id ON life_area_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_life_area_insights_category_id ON life_area_insights(category_id);

CREATE TRIGGER update_life_area_insights_updated_at
  BEFORE UPDATE ON life_area_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
