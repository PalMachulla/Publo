-- Temporary fix: Allow anonymous read access to user_profiles
-- This will let the page load even if auth hasn't fully initialized

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all" ON user_profiles;
CREATE POLICY "Enable read for all"
  ON user_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Keep the other policies for insert/update
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON user_profiles;
CREATE POLICY "Enable insert for authenticated users"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON user_profiles;
CREATE POLICY "Enable update for authenticated users"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


