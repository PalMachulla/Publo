# Google OAuth Setup Guide

## Fixed Issues
✅ Kong API gateway no longer requires API key for auth endpoints
✅ Google OAuth environment variables added to configuration

## Steps to Enable Google OAuth

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen if prompted
6. For Application type, select **Web application**
7. Add Authorized redirect URIs:
   - `http://localhost:8000/auth/v1/callback`
   - `http://localhost:3002/auth/callback`
8. Click **Create**
9. Copy your **Client ID** and **Client Secret**

### 2. Update Your .env File

Add these lines to your `.env` file:

```bash
# Google OAuth Configuration
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=your-google-client-id-here
GOTRUE_EXTERNAL_GOOGLE_SECRET=your-google-client-secret-here
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=http://localhost:8000/auth/v1/callback
```

Replace `your-google-client-id-here` and `your-google-client-secret-here` with the values from Google Cloud Console.

### 3. Restart the Auth Service

```bash
docker-compose restart auth
```

### 4. Test Google Login

1. Go to http://localhost:3002
2. Click on "Sign in with Google"
3. You should now be redirected to Google's OAuth consent screen

## Troubleshooting

**Error: "Invalid redirect URI"**
- Make sure `http://localhost:8000/auth/v1/callback` is added to your Google OAuth credentials

**Error: "Access blocked: This app's request is invalid"**
- Check that your OAuth consent screen is properly configured
- Make sure the scopes include email and profile

**Still getting Kong errors?**
- Restart Kong: `docker-compose restart kong`
- Check Kong logs: `docker logs publo_kong`

## What Was Fixed

The original "Kong Error - No API key found in request" was caused by a global `key-auth` plugin in the Kong configuration that was blocking ALL requests, including OAuth endpoints. 

The fix:
- Removed the global `key-auth` plugin from `docker/kong.yml`
- Auth endpoints (`/auth/v1/authorize`, `/auth/v1/callback`) are now publicly accessible
- REST API endpoints still require API keys for security
