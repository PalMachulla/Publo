import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // Runtime validation for environment variables
  if (!url || url.trim() === '') {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
      'Please check your .env.local file.'
    )
  }
  
  if (!key || key.trim() === '') {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. ' +
      'Please check your .env.local file.'
    )
  }
  
  // Validate URL format
  try {
    new URL(url)
  } catch {
    throw new Error(
      'Invalid NEXT_PUBLIC_SUPABASE_URL format. ' +
      'Must be a valid URL.'
    )
  }
  
  return createBrowserClient(url, key)
}

