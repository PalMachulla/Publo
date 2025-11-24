-- QUICK FIX: Temporarily disable RLS on user_profiles to diagnose
-- Run this first to see if it fixes the CORS errors

ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- After running this, refresh your browser and see if the errors go away
-- If they do, then we know it's an RLS issue and we can create proper policies
-- If they don't, then it's something else


