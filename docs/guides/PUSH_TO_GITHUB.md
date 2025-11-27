# Push to GitHub - Quick Guide

Your code is ready to push! Follow these steps:

## Option 1: Create Repository on GitHub.com (Easiest)

### Step 1: Create Repository
1. Go to https://github.com/new
2. Fill in:
   - **Repository name**: `Publo`
   - **Description**: `Engineering Intelligence - Modern full-stack app with Next.js and Supabase`
   - **Visibility**: Choose Public or Private
   - ⚠️ **DO NOT** initialize with README, .gitignore, or license (we already have these)
3. Click **"Create repository"**

### Step 2: Push Your Code
Copy and run these commands in your terminal:

```bash
cd /Users/palmac/Aiakaki/Code/publo

# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/Publo.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

Done! Your code is on GitHub! 🎉

## Option 2: Using GitHub CLI (If Installed)

```bash
cd /Users/palmac/Aiakaki/Code/publo

# Install GitHub CLI if not installed
# brew install gh

# Login (one time)
gh auth login

# Create repo and push
gh repo create Publo --public --source=. --remote=origin --push
```

## What Gets Pushed

✅ All source code
✅ Documentation (README, guides)
✅ Configuration files
❌ `.env.local` (protected by .gitignore)
❌ `node_modules` (protected by .gitignore)
❌ Sensitive data (all protected)

## After Pushing

### Update Supabase OAuth Callbacks
You'll need to update your OAuth apps with the GitHub repo URL:

**GitHub OAuth App:**
- Go to your GitHub OAuth app settings
- Keep the existing Supabase callback URL
- Optionally add: `https://your-username.github.io/Publo/auth/callback` (if using GitHub Pages)

### Deploy to Vercel
Once on GitHub, you can deploy:
1. Go to https://vercel.com
2. Click "Import Project"
3. Select your `Publo` repository
4. Follow `DEPLOYMENT.md` guide

## Troubleshooting

**"Authentication failed"**
```bash
# Use personal access token
# Create one at: https://github.com/settings/tokens
# Use it as password when prompted
```

**"Remote already exists"**
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/Publo.git
```

**"Branch main doesn't exist"**
```bash
git branch -M main
git push -u origin main
```

