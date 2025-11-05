# Deployment Guide: Vercel + Supabase

This guide walks you through deploying Publo to Vercel with Supabase for authentication and database.

## 🎯 Overview

**Frontend**: Next.js on Vercel  
**Backend**: Optional - can run as Vercel Serverless Functions or separate service  
**Database**: Supabase (PostgreSQL)  
**Auth**: Supabase Auth (Email, GitHub, Google OAuth)

## 📝 Prerequisites

- ✅ Supabase project set up (see `SUPABASE_SETUP.md`)
- ✅ GitHub account
- ✅ Vercel account (free tier works!)
- ✅ Your code pushed to GitHub

## 🚀 Step 1: Prepare Your Repository

### A. Update .gitignore (already done!)

Make sure these are in your `.gitignore`:
```
.env
.env*.local
node_modules/
```

### B. Verify Environment Variables

Your frontend needs these environment variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 🌐 Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

5. Add Environment Variables:
   - Click "Environment Variables"
   - Add:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
     ```

6. Click **"Deploy"**

### Option B: Via Vercel CLI

```bash
cd frontend
npm install -g vercel
vercel login
vercel

# Follow prompts, then add environment variables:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## 🔒 Step 3: Configure Supabase for Production

### A. Update Site URL

1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Set **Site URL** to: `https://your-app.vercel.app`

### B. Add Redirect URLs

In the same section, add **Redirect URLs**:
```
https://your-app.vercel.app/**
https://your-app.vercel.app/auth/callback
```

### C. Update OAuth Apps

#### GitHub OAuth
1. Go to your GitHub OAuth App settings
2. Add to **Authorization callback URL**:
   ```
   https://xxxxx.supabase.co/auth/v1/callback
   ```
   (Get this exact URL from Supabase → Authentication → Providers → GitHub)

#### Google OAuth (if enabled)
1. Go to Google Cloud Console → Credentials
2. Update your OAuth 2.0 Client
3. Add to **Authorized JavaScript origins**:
   ```
   https://your-app.vercel.app
   ```
4. Add to **Authorized redirect URIs**:
   ```
   https://xxxxx.supabase.co/auth/v1/callback
   ```

## ⚙️ Step 4: Backend Deployment (Optional)

### Option A: No Backend Needed (Recommended)

With Supabase, you often don't need a separate backend! Supabase provides:
- ✅ Authentication
- ✅ Database (with REST API)
- ✅ Storage
- ✅ Realtime subscriptions

### Option B: Deploy Backend to Vercel

If you need custom backend logic:

1. Create `/api` folder in your Next.js frontend
2. Add serverless functions there
3. They'll automatically deploy with your frontend

Example: `/frontend/src/app/api/custom/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createClient()
  
  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Your custom logic here
  return NextResponse.json({ message: 'Hello from API!' })
}
```

### Option C: Separate Backend Service

Deploy to:
- **Vercel**: As standalone API
- **Railway**: Full backend deployment
- **Fly.io**: Docker deployment

## 🗄️ Step 5: Database Migrations

### A. Via Supabase Dashboard

Run SQL migrations in **SQL Editor**:
1. Go to Supabase → **SQL Editor**
2. Paste your migration SQL
3. Click **Run**

### B. Via Supabase CLI (Advanced)

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Create migration
supabase migration new create_profiles

# Edit migration file
# Then push to prod
supabase db push
```

## ✅ Step 6: Verify Deployment

### Test Checklist

1. **Visit your production URL**: `https://your-app.vercel.app`
2. **Test Email Login**:
   - Sign up with email
   - Check inbox for confirmation
   - Confirm and log in
3. **Test GitHub OAuth**:
   - Click "Continue with GitHub"
   - Authorize app
   - Should redirect to canvas
4. **Test Google OAuth** (if enabled)
5. **Test Logout**
6. **Test Protected Routes**: Try accessing `/canvas` while logged out

## 🔧 Common Issues & Fixes

### "Invalid login credentials"
**Problem**: Environment variables not set  
**Fix**: 
- Go to Vercel Dashboard → Settings → Environment Variables
- Verify `NEXT_PUBLIC_SUPABASE_URL` and key are correct
- Redeploy: Settings → Deployments → Click ⋯ → Redeploy

### GitHub OAuth "Application Suspended"
**Problem**: Callback URL mismatch  
**Fix**:
- Use the **Supabase callback URL** in GitHub, NOT your Vercel URL
- Example: `https://abcdefgh.supabase.co/auth/v1/callback`

### "Site URL is not configured"
**Problem**: Supabase Site URL not set  
**Fix**:
- Supabase → Authentication → URL Configuration
- Set to: `https://your-app.vercel.app`

### Changes not showing up
**Problem**: Cached deployment  
**Fix**:
```bash
# Force redeploy
vercel --force
```

Or via dashboard: Deployments → ⋯ → Redeploy (with cache cleared)

## 🚀 Performance Optimization

### Enable Edge Functions
In your middleware, Supabase auth runs on the edge for maximum speed.

### Enable Caching
```typescript
// In your page
export const revalidate = 60 // Revalidate every 60 seconds
```

### Use ISR (Incremental Static Regeneration)
For public pages:
```typescript
export const dynamic = 'force-static'
export const revalidate = 3600 // 1 hour
```

## 📊 Monitoring

### Vercel Analytics
Enable in Vercel Dashboard → Analytics (free!)

### Supabase Monitoring
- Dashboard → Database → Overview
- View query performance, active connections
- Set up database pooling if needed

### Error Tracking
Consider adding:
- [Sentry](https://sentry.io) for error tracking
- [LogRocket](https://logrocket.com) for session replay

## 🔐 Security Best Practices

### ✅ Do's
- ✅ Enable Row Level Security (RLS) on all database tables
- ✅ Use environment variables for all secrets
- ✅ Enable email confirmation in production
- ✅ Use HTTPS everywhere
- ✅ Set proper CORS origins
- ✅ Regularly rotate secrets

### ❌ Don'ts
- ❌ Never commit `.env` files
- ❌ Never use service key in frontend
- ❌ Don't expose API endpoints without auth
- ❌ Don't skip RLS policies
- ❌ Don't use weak passwords in production

## 📈 Scaling Considerations

### Frontend (Vercel)
- Automatically scales
- CDN distributed globally
- Serverless functions scale automatically

### Database (Supabase)
- Free tier: Up to 500MB, 2GB file storage
- Pro tier: Unlimited, better performance
- Enable connection pooling for high traffic
- Consider read replicas for heavy read workloads

### Authentication
- Supabase Auth scales automatically
- Rate limiting built-in
- Add Captcha for signup if needed

## 🎉 You're Done!

Your Publo app is now:
- ✅ Deployed on Vercel
- ✅ Using Supabase for auth & database
- ✅ Supporting GitHub & Google OAuth
- ✅ Ready for users!

### Next Steps
1. Add custom domain in Vercel
2. Set up monitoring and alerts
3. Enable Vercel Analytics
4. Add more features!

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)

---

**Questions?** Check the [Vercel Discord](https://vercel.com/discord) or [Supabase Discord](https://discord.supabase.com)

