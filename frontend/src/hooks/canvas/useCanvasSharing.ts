/**
 * useCanvasSharing - Canvas sharing state management hook
 * 
 * Manages canvas sharing functionality including:
 * - Canvas visibility (private/shared/public)
 * - Shared email management
 * - Sharing dropdown state
 * - Share operations (add/remove emails, change visibility)
 * 
 * Architecture Notes:
 * - Sharing state is separate from canvas data
 * - Uses Supabase for sharing persistence
 * - Supports private, shared, and public visibility modes
 * 
 * @see canvas-sharing.ts for sharing API functions
 * @see canvas/page.tsx for original implementation
 */

import { useState, useRef, useCallback } from 'react'
import { shareCanvas, removeCanvasShare } from '@/lib/canvas-sharing'
import { updateStory } from '@/lib/stories'

export interface UseCanvasSharingOptions {
  /**
   * Story ID for sharing operations
   */
  storyId: string | null
}

export interface UseCanvasSharingReturn {
  // Sharing dropdown state
  sharingDropdownOpen: boolean
  setSharingDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>
  sharingDropdownRef: React.MutableRefObject<HTMLDivElement | null>
  
  // Canvas visibility
  canvasVisibility: 'private' | 'shared' | 'public'
  setCanvasVisibility: React.Dispatch<React.SetStateAction<'private' | 'shared' | 'public'>>
  
  // Shared emails
  sharedEmails: string[]
  setSharedEmails: React.Dispatch<React.SetStateAction<string[]>>
  
  // Email input state
  emailInput: string
  setEmailInput: React.Dispatch<React.SetStateAction<string>>
  
  // Sending invite state
  sendingInvite: boolean
  setSendingInvite: React.Dispatch<React.SetStateAction<boolean>>
  
  // Operations
  handleVisibilityChange: (newVisibility: 'private' | 'shared' | 'public') => Promise<void>
  handleAddSharedEmail: () => Promise<void>
  handleRemoveSharedEmail: (email: string) => Promise<void>
}

/**
 * Hook for managing canvas sharing state and operations
 */
export function useCanvasSharing(
  options: UseCanvasSharingOptions
): UseCanvasSharingReturn {
  const { storyId } = options
  
  // Sharing dropdown state
  const [sharingDropdownOpen, setSharingDropdownOpen] = useState(false)
  const sharingDropdownRef = useRef<HTMLDivElement | null>(null)
  
  // Canvas visibility
  const [canvasVisibility, setCanvasVisibility] = useState<'private' | 'shared' | 'public'>('private')
  
  // Shared emails
  const [sharedEmails, setSharedEmails] = useState<string[]>([])
  
  // Email input state
  const [emailInput, setEmailInput] = useState('')
  
  // Sending invite state
  const [sendingInvite, setSendingInvite] = useState(false)
  
  /**
   * Handle canvas visibility change
   * 
   * Updates canvas visibility in database and removes all shares if switching to private
   */
  const handleVisibilityChange = useCallback(async (newVisibility: 'private' | 'shared' | 'public') => {
    if (!storyId) return
    
    try {
      setCanvasVisibility(newVisibility)
      
      // Update the story in the database
      await updateStory(storyId, {
        is_public: newVisibility === 'public',
        shared: newVisibility === 'shared' || newVisibility === 'public',
      })
      
      // If changing to private, clear shared emails
      if (newVisibility === 'private' && sharedEmails.length > 0) {
        // Remove all shares from database
        const removePromises = sharedEmails.map(email => removeCanvasShare(storyId, email))
        await Promise.all(removePromises)
        setSharedEmails([])
      }
    } catch (error) {
      console.error('Failed to update visibility:', error)
      alert('Failed to update canvas visibility')
    }
  }, [storyId, sharedEmails])
  
  /**
   * Handle adding shared email
   * 
   * Shares canvas with the email in emailInput
   * Includes email validation and duplicate checking
   */
  const handleAddSharedEmail = useCallback(async () => {
    if (!emailInput.trim() || !storyId) return
    
    const email = emailInput.trim().toLowerCase()
    
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address')
      return
    }
    
    // Check if already shared
    if (sharedEmails.includes(email)) {
      alert('This email is already added')
      setEmailInput('')
      return
    }
    
    try {
      setSendingInvite(true)
      
      const result = await shareCanvas(storyId, email, 'view')
      
      if (result.success) {
        setSharedEmails([...sharedEmails, email])
        alert(result.message)
        setEmailInput('')
      } else {
        alert(result.message)
      }
    } catch (error) {
      console.error('Failed to share canvas:', error)
      alert('Failed to share canvas. Please try again.')
    } finally {
      setSendingInvite(false)
    }
  }, [storyId, emailInput, sharedEmails])
  
  /**
   * Handle removing shared email
   * 
   * Removes access for the specified email
   */
  const handleRemoveSharedEmail = useCallback(async (email: string) => {
    if (!storyId) return
    
    try {
      const success = await removeCanvasShare(storyId, email)
      if (success) {
        setSharedEmails(sharedEmails.filter(e => e !== email))
        console.log('Removed access for:', email)
      } else {
        alert('Failed to remove access')
      }
    } catch (error) {
      console.error('Failed to remove shared access:', error)
      alert('Failed to remove access')
    }
  }, [storyId, sharedEmails])
  
  return {
    // Sharing dropdown state
    sharingDropdownOpen,
    setSharingDropdownOpen,
    sharingDropdownRef,
    
    // Canvas visibility
    canvasVisibility,
    setCanvasVisibility,
    
    // Shared emails
    sharedEmails,
    setSharedEmails,
    
    // Email input state
    emailInput,
    setEmailInput,
    
    // Sending invite state
    sendingInvite,
    setSendingInvite,
    
    // Operations
    handleVisibilityChange,
    handleAddSharedEmail,
    handleRemoveSharedEmail,
  }
}

