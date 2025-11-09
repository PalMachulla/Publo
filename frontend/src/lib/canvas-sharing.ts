import { createClient } from '@/lib/supabase/client'

export interface CanvasShare {
  id: string
  canvas_id: string
  shared_with_email: string
  shared_with_user_id: string | null
  shared_by_user_id: string
  permission: 'view' | 'edit'
  invited_at: string
  accepted_at: string | null
}

export interface CanvasInvite {
  id: string
  canvas_id: string
  email: string
  invited_by_user_id: string
  invite_token: string
  expires_at: string
  accepted: boolean
  created_at: string
}

/**
 * Get all users a canvas has been shared with
 */
export async function getCanvasShares(canvasId: string): Promise<CanvasShare[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('canvas_shares')
    .select('*')
    .eq('canvas_id', canvasId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching canvas shares:', error)
    throw error
  }
  
  return data || []
}

/**
 * Share a canvas with a user by email
 * Returns true if user exists and was shared immediately, false if invite was sent
 */
export async function shareCanvas(
  canvasId: string,
  email: string,
  permission: 'view' | 'edit' = 'view'
): Promise<{ success: boolean; userExists: boolean; message: string }> {
  const supabase = createClient()
  
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return {
        success: false,
        userExists: false,
        message: 'You must be logged in to share canvases',
      }
    }
    
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('email', email)
      .single()
    
    if (existingUser) {
      // User exists - grant immediate access
      const { error: shareError } = await supabase
        .from('canvas_shares')
        .insert({
          canvas_id: canvasId,
          shared_with_email: email,
          shared_with_user_id: existingUser.id,
          shared_by_user_id: user.id,
          permission,
        })
      
      if (shareError) {
        // Check if already shared
        if (shareError.code === '23505') {
          return {
            success: false,
            userExists: true,
            message: 'Canvas is already shared with this user',
          }
        }
        throw shareError
      }
      
      return {
        success: true,
        userExists: true,
        message: `Canvas shared with ${email}`,
      }
    } else {
      // User doesn't exist - create invite
      const inviteToken = generateInviteToken()
      
      const { error: inviteError } = await supabase
        .from('canvas_invites')
        .insert({
          canvas_id: canvasId,
          email,
          invite_token: inviteToken,
          invited_by_user_id: user.id,
        })
      
      if (inviteError) {
        // Check if already invited
        if (inviteError.code === '23505') {
          return {
            success: false,
            userExists: false,
            message: 'An invitation has already been sent to this email',
          }
        }
        throw inviteError
      }
      
      // TODO: Send invitation email via API route
      // await sendInvitationEmail(email, inviteToken, canvasId)
      
      return {
        success: true,
        userExists: false,
        message: `Invitation sent to ${email}`,
      }
    }
  } catch (error) {
    console.error('Error sharing canvas:', error)
    return {
      success: false,
      userExists: false,
      message: 'Failed to share canvas. Please try again.',
    }
  }
}

/**
 * Remove a user's access to a canvas
 */
export async function removeCanvasShare(canvasId: string, email: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    // Remove from canvas_shares
    const { error: shareError } = await supabase
      .from('canvas_shares')
      .delete()
      .eq('canvas_id', canvasId)
      .eq('shared_with_email', email)
    
    if (shareError) throw shareError
    
    // Also remove any pending invites
    const { error: inviteError } = await supabase
      .from('canvas_invites')
      .delete()
      .eq('canvas_id', canvasId)
      .eq('email', email)
    
    // Don't throw on invite error - it might not exist
    if (inviteError) {
      console.warn('Error removing invite:', inviteError)
    }
    
    return true
  } catch (error) {
    console.error('Error removing canvas share:', error)
    return false
  }
}

/**
 * Check if current user has access to a canvas
 */
export async function checkCanvasAccess(canvasId: string): Promise<boolean> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  
  try {
    const { data, error } = await supabase.rpc('user_has_canvas_access', {
      p_canvas_id: canvasId,
      p_user_id: user.id,
    })
    
    if (error) throw error
    return data === true
  } catch (error) {
    console.error('Error checking canvas access:', error)
    return false
  }
}

/**
 * Accept a canvas invitation
 */
export async function acceptCanvasInvite(inviteToken: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    // Get invite details
    const { data: invite, error: inviteError } = await supabase
      .from('canvas_invites')
      .select('*')
      .eq('invite_token', inviteToken)
      .eq('accepted', false)
      .single()
    
    if (inviteError || !invite) {
      console.error('Invite not found or already accepted')
      return false
    }
    
    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      console.error('Invite has expired')
      return false
    }
    
    // Create canvas share
    const { error: shareError } = await supabase
      .from('canvas_shares')
      .insert({
        canvas_id: invite.canvas_id,
        shared_with_email: invite.email,
        shared_with_user_id: user.id,
        shared_by_user_id: invite.invited_by_user_id,
        permission: 'view',
        accepted_at: new Date().toISOString(),
      })
    
    if (shareError) throw shareError
    
    // Mark invite as accepted
    const { error: updateError } = await supabase
      .from('canvas_invites')
      .update({ accepted: true })
      .eq('id', invite.id)
    
    if (updateError) throw updateError
    
    return true
  } catch (error) {
    console.error('Error accepting invite:', error)
    return false
  }
}

/**
 * Generate a secure random invite token
 */
function generateInviteToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

