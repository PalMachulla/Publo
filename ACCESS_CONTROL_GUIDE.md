# Access Control & Waitlist System

## Overview

Publo now has a comprehensive access control system. Users who don't have access will be redirected to a waitlist page, and you can grant access through Supabase.

## System Components

### Database Tables

1. **`user_profiles`**: Stores user access status
   - `access_status`: `'waitlist'` | `'granted'` | `'revoked'`
   - Created automatically when users sign up (defaults to `waitlist`)

2. **`waitlist`**: Stores email signups from non-authenticated users
   - Public form submissions before signing in

### Flow

```
New User Signs Up
    ↓
Profile Created (access_status = 'waitlist')
    ↓
User redirected to /waitlist
    ↓
Admin grants access
    ↓
User can access /canvas and all features
```

## Setup Instructions

### 1. Run the Migration

```bash
# Navigate to your project
cd /Users/palmac/Aiakaki/Code/publo

# Connect to your Supabase database
docker exec -i publo_db psql -U postgres -d postgres < supabase/migrations/005_add_user_access_control.sql
```

### 2. Grant Yourself Access

Option A: Through Supabase Studio (http://localhost:3001)

1. Go to Table Editor
2. Select `user_profiles` table
3. Find your user (by email)
4. Edit the row:
   - Set `access_status` to `'granted'`
   - Set `access_granted_at` to current timestamp

Option B: Through SQL

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE public.user_profiles 
SET 
  access_status = 'granted',
  access_granted_at = NOW()
WHERE email = 'your-email@example.com';
```

Option C: Using psql command

```bash
docker exec -i publo_db psql -U postgres -d postgres -c \
  "UPDATE public.user_profiles SET access_status = 'granted', access_granted_at = NOW() WHERE email = 'your-email@example.com';"
```

### 3. Test the Waitlist

1. Sign out of your account
2. Create a new test account or use incognito mode
3. Sign in with Google/GitHub
4. You should be redirected to `/waitlist`
5. Fill out the waitlist form
6. Check `user_profiles` table in Supabase Studio

## Granting Access to Users

### Method 1: Supabase Studio (Recommended)

1. Open Supabase Studio: http://localhost:3001
2. Navigate to **Table Editor** → `user_profiles`
3. Find the user you want to grant access to
4. Click the row to edit
5. Change `access_status` from `'waitlist'` to `'granted'`
6. Set `access_granted_at` to current timestamp
7. Save

### Method 2: SQL Query

```sql
-- Grant access to a specific user by email
UPDATE public.user_profiles 
SET 
  access_status = 'granted',
  access_granted_at = NOW()
WHERE email = 'user@example.com';

-- Grant access to multiple users at once
UPDATE public.user_profiles 
SET 
  access_status = 'granted',
  access_granted_at = NOW()
WHERE email IN ('user1@example.com', 'user2@example.com', 'user3@example.com');
```

### Method 3: Command Line

```bash
# Grant access to a user
docker exec -i publo_db psql -U postgres -d postgres -c \
  "UPDATE public.user_profiles SET access_status = 'granted', access_granted_at = NOW() WHERE email = 'user@example.com';"
```

## Viewing the Waitlist

### See all users waiting for access

```sql
SELECT 
  email,
  full_name,
  waitlist_joined_at,
  notes
FROM public.user_profiles
WHERE access_status = 'waitlist'
ORDER BY waitlist_joined_at ASC;
```

### See all users with access

```sql
SELECT 
  email,
  full_name,
  access_granted_at,
  access_granted_by
FROM public.user_profiles
WHERE access_status = 'granted'
ORDER BY access_granted_at DESC;
```

## Revoking Access

If you need to revoke access from a user:

```sql
UPDATE public.user_profiles 
SET 
  access_status = 'revoked'
WHERE email = 'user@example.com';
```

## Features

### Waitlist Page (`/waitlist`)
- Beautiful landing page explaining the platform
- Form to join waitlist
- Works for both authenticated and non-authenticated users
- Shows confirmation after submission

### Access Protection
- Canvas route (`/canvas`) is protected
- Users without access are automatically redirected to `/waitlist`
- Seamless experience after access is granted

### User Experience
1. User signs up → Added to waitlist
2. User sees waitlist page with features
3. Admin grants access → User can immediately access canvas
4. No additional action required from user

## Production Considerations

### Email Notifications (Future Enhancement)

You may want to add email notifications when:
- User joins waitlist → Send confirmation email
- Access is granted → Send welcome email with instructions

### Admin Dashboard (Future Enhancement)

Consider building an admin page at `/admin` where you can:
- View all waitlist requests
- Grant/revoke access with one click
- See user statistics
- Send bulk invitations

### Example Admin Query

```sql
-- Get waitlist statistics
SELECT 
  access_status,
  COUNT(*) as count
FROM public.user_profiles
GROUP BY access_status;
```

## Testing

### Test Flow
1. Create test account
2. Verify redirection to `/waitlist`
3. Fill out waitlist form
4. Grant access via SQL
5. Refresh page or revisit `/canvas`
6. Verify access granted

### Quick Test Commands

```bash
# Check if user has access
docker exec -i publo_db psql -U postgres -d postgres -c \
  "SELECT email, access_status FROM public.user_profiles WHERE email = 'test@example.com';"

# Grant test user access
docker exec -i publo_db psql -U postgres -d postgres -c \
  "UPDATE public.user_profiles SET access_status = 'granted', access_granted_at = NOW() WHERE email = 'test@example.com';"
```

## Troubleshooting

### User still sees waitlist after granting access
- Clear browser cache
- Log out and log back in
- Check that `access_status` is exactly `'granted'` (not `'GRANTED'` or other variations)

### User profile not found
- Profile should be created automatically on signup
- If missing, manually create:
```sql
INSERT INTO public.user_profiles (id, email, full_name, access_status)
VALUES (
  'user-uuid-here',
  'user@example.com',
  'User Name',
  'granted'
);
```

### Migration errors
- Make sure Supabase is running: `docker-compose ps`
- Check database connection: `docker exec publo_db psql -U postgres -d postgres -c "SELECT 1;"`
- View migration logs: `docker logs publo_db`

## Security Notes

- Row Level Security (RLS) is enabled on all tables
- Users can only read their own profile
- Users cannot modify their own `access_status`
- Access checks happen server-side for security
- Waitlist submissions are rate-limited by Supabase

## Next Steps

After granting yourself access:
1. Test the full user flow with a test account
2. Customize the waitlist page copy for your use case
3. Consider building an admin dashboard
4. Set up email notifications for new waitlist signups
5. Add analytics to track conversion from waitlist to active users

