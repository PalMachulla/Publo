import { createClient } from '@/lib/supabase/client'

/**
 * Check if the current user is an admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error checking admin status:', error)
      return false
    }

    return data?.role === 'admin'
  } catch (error) {
    console.error('Failed to check admin status:', error)
    return false
  }
}

/**
 * Get user's role and access information
 */
export async function getUserProfile(userId: string) {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user profile:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Failed to fetch user profile:', error)
    return null
  }
}

/**
 * Update user access (admin only)
 */
export async function updateUserAccess(
  targetUserId: string,
  updates: {
    role?: 'prospect' | 'admin' | 'user'
    access_tier?: 'free' | 'tier1' | 'tier2' | 'tier3'
    access_status?: 'waitlist' | 'granted' | 'revoked'
    notes?: string
  }
) {
  const supabase = createClient()
  
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', targetUserId)

    if (error) {
      console.error('Error updating user access:', error)
      throw error
    }

    return true
  } catch (error) {
    console.error('Failed to update user access:', error)
    throw error
  }
}

