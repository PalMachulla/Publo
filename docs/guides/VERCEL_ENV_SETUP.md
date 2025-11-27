# Vercel Environment Variables Setup

## Required Environment Variables

### 1. Encryption Key (CRITICAL!)

```bash
ENCRYPTION_KEY=<64-character-hex-string>
```

**How to generate:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Why needed:** Encrypts user API keys in the database using AES-256-GCM.

**⚠️ IMPORTANT:** 
- Keep this secret safe!
- Never commit to git
- Use different keys for staging/production
- If lost, users will need to re-add their API keys

---

### 2. Supabase Variables (Already Set)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Why needed:** Database connection for API key storage and user authentication.

---

## Optional Environment Variables

### 3. Default Groq Key (Optional)

```bash
GROQ_PUBLO_KEY=gsk_your_groq_key_here
```

**Why needed:** Provides a fallback Groq API key for users who haven't added their own.

**Note:** Without this, users MUST add their own API keys to use AI generation.

**Get your Groq key:** https://console.groq.com/keys

---

## Vercel Setup Steps

### 1. Go to Your Vercel Project Settings

https://vercel.com/your-username/publo/settings/environment-variables

### 2. Add Environment Variables

For each variable above:

1. **Name**: `ENCRYPTION_KEY`
2. **Value**: (paste the generated hex string)
3. **Environment**: 
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **"Save"**

### 3. Redeploy

After adding variables, trigger a redeploy:

```bash
git push origin main
```

Or click **"Redeploy"** in Vercel dashboard.

---

## Testing Locally

### Create `.env.local` file:

```bash
# In /frontend/.env.local
ENCRYPTION_KEY=<your-hex-string>
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GROQ_PUBLO_KEY=gsk_your_groq_key  # Optional
```

### Restart dev server:

```bash
cd frontend
npm run dev
```

---

## Security Best Practices

### ✅ DO:
- Use different `ENCRYPTION_KEY` for each environment
- Rotate keys periodically (every 6-12 months)
- Store keys in Vercel environment variables
- Use strong, random keys (32 bytes = 64 hex characters)

### ❌ DON'T:
- Never commit `.env.local` to git (already in `.gitignore`)
- Never share encryption keys
- Never use simple/predictable keys
- Never reuse keys across projects

---

## Troubleshooting

### "Invalid API key" error

**Cause:** User's API key is invalid or expired.

**Solution:** User needs to get a fresh key from the provider and update it in BYOAPI settings.

---

### "No API key available"

**Cause:** User hasn't added any API keys and no default `GROQ_PUBLO_KEY` is set.

**Solution:** Either:
1. User adds their own key at `/settings/api-keys`
2. Add `GROQ_PUBLO_KEY` to Vercel for fallback

---

### "Failed to decrypt API key"

**Cause:** `ENCRYPTION_KEY` mismatch or changed.

**Solution:** 
1. Check `ENCRYPTION_KEY` is set correctly in Vercel
2. If key was changed, users must re-add their API keys
3. Run database migration: `009_create_user_api_keys.sql`

---

## Database Migrations

Make sure these are run on Supabase:

```sql
-- In Supabase SQL Editor:
-- 1. Create user_api_keys table
supabase/migrations/009_create_user_api_keys.sql

-- 2. Create usage tracking
supabase/migrations/010_create_usage_tracking.sql
```

---

## Monitoring

### Check API Key Usage

```sql
-- In Supabase SQL Editor
SELECT 
  provider,
  COUNT(*) as key_count,
  SUM(usage_count) as total_usage
FROM user_api_keys
GROUP BY provider;
```

### Check Cost Tracking

```sql
SELECT 
  user_id,
  provider,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd
FROM ai_usage_history
GROUP BY user_id, provider
ORDER BY total_cost_usd DESC
LIMIT 10;
```

---

## Support Links

- **Groq Console:** https://console.groq.com
- **OpenAI Platform:** https://platform.openai.com
- **Anthropic Console:** https://console.anthropic.com
- **Google AI Studio:** https://makersuite.google.com

---

**Need help?** Check the BYOAPI_PROGRESS.md for implementation details.

