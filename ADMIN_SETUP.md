# Admin Panel Setup Guide

This guide will help you set up the admin panel and grant yourself admin access.

## 🎯 Overview

The admin panel allows you to:
- View all registered users
- Search users by email, name, role, or status
- Manage user roles: **Admin**, **User**, **Prospect**
- Assign access tiers: **Free**, **Tier 1**, **Tier 2**, **Tier 3**
- Control access status: **Waitlist**, **Granted**, **Revoked**
- Add notes to user profiles

## 📋 Setup Steps

### 1. Run the Database Migration

Go to your **Supabase Dashboard**:
- URL: https://supabase.com/dashboard/project/hodwmtwshorbgmrtvdez
- Navigate to: **SQL Editor**

Run this migration (from `supabase/migrations/005_add_user_access_control.sql`):

```sql
-- Add user profiles table with access control
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'prospect' CHECK (role IN ('prospect', 'admin', 'user')),
  access_tier TEXT NOT NULL DEFAULT 'free' CHECK (access_tier IN ('free', 'tier1', 'tier2', 'tier3')),
  access_status TEXT NOT NULL DEFAULT 'waitlist' CHECK (access_status IN ('waitlist', 'granted', 'revoked')),
  access_granted_at TIMESTAMP WITH TIME ZONE,
  access_granted_by UUID REFERENCES auth.users(id),
  waitlist_joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add waitlist table for users not yet signed up
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invited', 'joined')),
  invited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- User profiles policies
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (but not access_status)
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    access_status = (SELECT access_status FROM public.user_profiles WHERE id = auth.uid())
  );

-- Automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, access_status, access_tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    'prospect', -- Default to prospect
    'waitlist', -- Default to waitlist
    'free' -- Default to free tier
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Waitlist policies
-- Anyone can insert into waitlist (for public form)
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist
  FOR INSERT
  WITH CHECK (true);

-- Function to grant access to a user
CREATE OR REPLACE FUNCTION public.grant_user_access(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_profiles
  SET 
    access_status = 'granted',
    access_granted_at = NOW(),
    access_granted_by = auth.uid(),
    updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access
CREATE OR REPLACE FUNCTION public.user_has_access(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_id AND access_status = 'granted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Admin policies - Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON public.user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user access (admin only)
CREATE OR REPLACE FUNCTION public.update_user_access(
  target_user_id UUID,
  new_role TEXT,
  new_access_tier TEXT,
  new_access_status TEXT,
  admin_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can update user access';
  END IF;

  UPDATE public.user_profiles
  SET 
    role = new_role,
    access_tier = new_access_tier,
    access_status = new_access_status,
    access_granted_at = CASE WHEN new_access_status = 'granted' THEN NOW() ELSE access_granted_at END,
    access_granted_by = auth.uid(),
    notes = COALESCE(admin_notes, notes),
    updated_at = NOW()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Grant Yourself Admin Access

After running the migration, grant yourself admin access with this SQL:

```sql
-- Replace with your actual user ID from auth.users
UPDATE public.user_profiles 
SET 
  role = 'admin',
  access_status = 'granted',
  access_tier = 'tier3',
  access_granted_at = NOW()
WHERE email = 'pal.machulla@gmail.com';
```

To find your user ID:

```sql
-- Check your user ID
SELECT id, email FROM auth.users WHERE email = 'pal.machulla@gmail.com';
```

### 3. Create Your Profile (If Needed)

If you don't have a profile yet (logged in before the migration), create it manually:

```sql
-- First, get your user ID
SELECT id FROM auth.users WHERE email = 'pal.machulla@gmail.com';

-- Then create profile with that ID (replace YOUR_USER_ID)
INSERT INTO public.user_profiles (id, email, full_name, role, access_status, access_tier)
VALUES (
  'YOUR_USER_ID',
  'pal.machulla@gmail.com',
  'Your Name',
  'admin',
  'granted',
  'tier3'
);
```

## 🎨 Using the Admin Panel

1. **Access**: Click your profile icon (top right) → **Admin Panel**
2. **Search**: Use the search bar to find users by email, name, role, or status
3. **Update Roles**: Click on any dropdown to change:
   - **Role**: Prospect (waitlist) / User (can create) / Admin (full access)
   - **Tier**: Free / Tier 1 / Tier 2 / Tier 3 (for future pricing)
   - **Status**: Waitlist / Granted / Revoked
4. **Add Notes**: Click "Edit Notes" to add admin notes to any user

## 👥 User Roles Explained

### 🟣 Admin
- Full access to admin panel
- Can manage all users
- Can create canvases and nodes
- Access to all features

### 🟢 User
- Can create canvases and build nodes
- Cannot access admin panel
- Access tier determines feature limits (future)

### ⚪ Prospect
- Default for new signups
- Redirected to waitlist page
- Cannot create canvases until upgraded

## 💎 Access Tiers (Future Use)

These tiers are prepared for future pricing implementation:

- **Free**: Basic features
- **Tier 1**: Standard features
- **Tier 2**: Advanced features  
- **Tier 3**: Premium features (unlimited)

## 🔐 Security

- Only admins can access the admin panel
- RLS policies prevent unauthorized access
- All changes are logged (access_granted_by, updated_at)
- Users cannot change their own access_status

## 📊 Dashboard Stats

The admin panel shows:
- Total users count
- Number of admins
- Active users (granted access)
- Waitlist size

---

**🎉 You're all set!** After completing these steps, you'll have full admin access and can manage all users from the admin panel.

