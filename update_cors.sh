#!/bin/bash
# Update CORS configuration for Supabase

# This adds localhost:3002 to the allowed origins
# You'll need to run this with your Supabase project credentials

echo "To fix CORS, you need to:"
echo "1. Go to: https://supabase.com/dashboard/project/hodwmtwshorbgmrtvdez/settings/api"
echo "2. Scroll to 'Additional Allowed Origins' or 'CORS Configuration'"
echo "3. Add: http://localhost:3002"
echo "4. Click Save"
echo ""
echo "Alternatively, check your supabase/config.toml file and ensure:"
echo "  [api]"
echo "  additional_redirect_urls = [\"http://localhost:3002\"]"




