# Supabase Setup Guide

This guide will help you set up Supabase for your Publo project with authentication including GitHub OAuth.

## 📋 Prerequisites

- A GitHub account
- A Supabase account (free tier works great!)

## 🚀 Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name**: `publo` (or whatever you prefer)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to you
4. Click "Create new project" (takes ~2 minutes)

## 🔑 Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

3. Create `/frontend/.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

## 🐙 Step 3: Enable GitHub OAuth

### A. Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "OAuth Apps" → "New OAuth App"
3. Fill in:
   - **Application name**: `Publo` (or your preference)
   - **Homepage URL**: `http://localhost:3002` (for local dev)
   - **Authorization callback URL**: 
     - For local: `http://localhost:3002/auth/callback`
     - For production: `https://your-domain.com/auth/callback`
4. Click "Register application"
5. Click "Generate a new client secret"
6. **Save both**: Client ID and Client Secret

### B. Configure in Supabase

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **GitHub** and click to expand
3. Toggle "Enable Sign in with GitHub" to **ON**
4. Paste:
   - **Client ID** from GitHub
   - **Client Secret** from GitHub
5. Copy the **Callback URL** shown (e.g., `https://xxxxx.supabase.co/auth/v1/callback`)
6. Go back to your GitHub OAuth app and **update** the Authorization callback URL to this Supabase URL
7. Click **Save** in Supabase

## 🌐 Step 4: Enable Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Configure:
   - **Application type**: Web application
   - **Authorized JavaScript origins**: `http://localhost:3002`
   - **Authorized redirect URIs**: Use the Supabase callback URL from your dashboard
6. Copy Client ID and Client Secret
7. In Supabase, go to **Authentication** → **Providers** → **Google**
8. Toggle ON and paste credentials
9. Click **Save**

## 📧 Step 5: Configure Email Auth (Already Enabled)

Email/password authentication is enabled by default. You can customize:

1. Go to **Authentication** → **Email Templates**
2. Customize confirmation emails, magic links, etc.

For **local development**, email confirmation is **automatically disabled**.
For **production**, you'll want to:
- Enable email confirmation
- Set up a proper email service (Supabase provides one)

## 🗄️ Step 6: Database Setup (Optional)

Supabase automatically creates an `auth.users` table for authentication. 

If you want to extend user profiles:

1. Go to **SQL Editor** in Supabase
2. Run this migration:

```sql
-- Create public profiles table linked to auth.users
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view any profile
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Policy: Users can update own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 🚀 Step 7: Test Locally

1. Make sure your `.env.local` has the correct values
2. Restart your dev server:
```bash
cd frontend
npm run dev
```

3. Visit `http://localhost:3002`
4. Try:
   - Email/password signup
   - GitHub login
   - Google login (if configured)

## 📱 Step 8: Production Setup (Vercel)

### Deploy Frontend to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Environment Variables**: Add your Supabase keys

5. **Update GitHub OAuth callback URL**:
   - In GitHub OAuth app settings
   - Add production callback: `https://your-app.vercel.app/auth/callback`

6. **Update Supabase Site URL**:
   - In Supabase → **Authentication** → **URL Configuration**
   - Add Site URL: `https://your-app.vercel.app`
   - Add Redirect URLs: `https://your-app.vercel.app/**`

## 🔒 Security Checklist

- ✅ Never commit `.env.local` to git
- ✅ Use environment variables in Vercel
- ✅ Enable Row Level Security (RLS) on all tables
- ✅ Keep your service key secure (don't use in frontend!)
- ✅ Use HTTPS in production
- ✅ Enable email confirmation in production

## 🆘 Troubleshooting

### "Invalid login credentials"
- Check your Supabase URL and anon key in `.env.local`
- Restart your dev server after adding environment variables

### GitHub OAuth not working
- Verify callback URL matches exactly in both GitHub and Supabase
- Check that GitHub OAuth is enabled in Supabase dashboard
- Make sure you're using the Supabase callback URL in GitHub, not your app URL

### "Email not confirmed"
- In development, email confirmation is disabled
- Check **Authentication** → **Settings** → **Enable email confirmations**

### CORS errors
- Verify your Site URL in Supabase matches your deployment URL
- Add all redirect URLs in Supabase settings

## 📚 Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js with Supabase](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

**Need help?** Check the [Supabase Discord](https://discord.supabase.com) or [GitHub Discussions](https://github.com/supabase/supabase/discussions).

