import { createClient } from '@/lib/supabase/server'

export type AccessStatus = 'waitlist' | 'granted' | 'revoked'

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  access_status: AccessStatus
  access_granted_at?: string
  waitlist_joined_at?: string
  created_at: string
  updated_at: string
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createClient()
  
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
}

export async function checkUserAccess(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId)
  return profile?.access_status === 'granted'
}

export async function joinWaitlist(email: string, fullName?: string, reason?: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('waitlist')
    .insert({
      email,
      full_name: fullName,
      reason
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createUserProfile(userId: string, email: string, fullName?: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('user_profiles')
    .insert({
      id: userId,
      email,
      full_name: fullName,
      access_status: 'waitlist'
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

