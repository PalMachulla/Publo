-- Final fix for user_profiles RLS
-- This creates policies that allow authenticated users to access their own data

-- Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;

-- Create simple, permissive policies for authenticated users
CREATE POLICY "Enable read for authenticated users"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);  -- Allow all authenticated users to read all profiles

CREATE POLICY "Enable insert for authenticated users"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);  -- Can only insert their own profile

CREATE POLICY "Enable update for authenticated users"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)  -- Can only update their own profile
  WITH CHECK (auth.uid() = id);

-- Verify
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'user_profiles';


