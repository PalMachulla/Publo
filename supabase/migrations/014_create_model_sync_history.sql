-- Model Sync History Table
-- Tracks when models were synced from vendor APIs and what was found

CREATE TABLE IF NOT EXISTS model_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_results JSONB NOT NULL,
  total_new_models INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_model_sync_history_user_id ON model_sync_history(user_id);
CREATE INDEX IF NOT EXISTS idx_model_sync_history_synced_at ON model_sync_history(synced_at DESC);

-- RLS Policies
ALTER TABLE model_sync_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sync history
DROP POLICY IF EXISTS "Users can view own sync history" ON model_sync_history;
CREATE POLICY "Users can view own sync history"
  ON model_sync_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sync records
DROP POLICY IF EXISTS "Users can insert own sync records" ON model_sync_history;
CREATE POLICY "Users can insert own sync records"
  ON model_sync_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE model_sync_history IS 'Tracks model synchronization from vendor APIs';

