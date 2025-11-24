-- Diagnose user_profiles RLS issues

-- 1. Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_profiles';

-- 2. Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_profiles';

-- 3. Check if the table has any data
SELECT id, email, role, access_status, created_at
FROM user_profiles
LIMIT 5;

-- 4. Test if current user can access
SELECT 
  auth.uid() as current_user_id,
  (SELECT COUNT(*) FROM user_profiles WHERE id = auth.uid()) as can_see_own_profile,
  (SELECT COUNT(*) FROM user_profiles) as total_profiles;


