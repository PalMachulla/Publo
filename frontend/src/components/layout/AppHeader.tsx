'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useRef, useEffect } from 'react'

interface AppHeaderProps {
  // Page title (shows after logo)
  title: string
  // Optional: Make title editable (for canvas)
  editable?: {
    value: string
    onChange: (value: string) => void
    onBlur: () => void
    inputRef?: React.RefObject<HTMLInputElement>
  }
  // Optional: Center actions (like Save button, sharing dropdown)
  centerActions?: React.ReactNode
}

export default function AppHeader({ title, editable, centerActions }: AppHeaderProps) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // TEMPORARY: Force admin for specific email
  const isForceAdmin = user?.email === 'pal.machulla@gmail.com'

  // Fetch user avatar and check admin status
  useEffect(() => {
    async function fetchUserData() {
      if (!user) return
      
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        
        // Fetch profile data including avatar and role
        const { data, error } = await supabase
          .from('user_profiles')
          .select('avatar_url, role')
          .eq('id', user.id)
          .maybeSingle() // Use maybeSingle() instead of single() to avoid error if no row
        
        if (error) {
          console.error('[AppHeader] Error fetching profile:', error)
        }
        
        if (data) {
          // Set avatar from profile or fallback to metadata
          const avatar = data.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture
          setUserAvatar(avatar)
          
          // Check if user is admin
          setIsAdmin(data.role === 'admin' || isForceAdmin)
        } else {
          // No profile row yet - use metadata fallback
          console.log('[AppHeader] No profile found, using metadata')
          const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
          setUserAvatar(avatar)
          setIsAdmin(isForceAdmin)
        }
      } catch (err) {
        console.error('[AppHeader] Failed to fetch user data:', err)
        // Fallback to metadata
        const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
        setUserAvatar(avatar)
        setIsAdmin(isForceAdmin)
      }
    }
    
    fetchUserData()
  }, [user, isForceAdmin])

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="border-b border-gray-200 bg-white z-[60] shadow-sm relative">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-2">
          <img src="/publo_logo.svg" alt="PUBLO" className="h-6" />
          
          {editable ? (
            <input
              ref={editable.inputRef}
              type="text"
              value={editable.value}
              onChange={(e) => editable.onChange(e.target.value)}
              onBlur={editable.onBlur}
              className="text-sm text-gray-600 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-gray-50 rounded px-2 py-1 transition-all"
              placeholder="Untitled Story"
            />
          ) : (
            <span className="text-sm text-gray-600 font-medium">{title}</span>
          )}
        </div>

        {/* Center: Actions (Save button, sharing dropdown, etc.) */}
        {centerActions && (
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
            {centerActions}
          </div>
        )}

        {/* Right: Burger Menu + Profile */}
        <div className="flex items-center gap-4">

          {/* Burger Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Menu"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[100]">
                {/* New Canvas */}
                <button
                  onClick={() => {
                    router.push('/canvas')
                    setIsMenuOpen(false)
                  }}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                    !editable && title !== 'My Canvases' && title !== 'My Characters' && title !== 'Profile' ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Canvas
                </button>

                {/* My Canvases */}
                <button
                  onClick={() => {
                    router.push('/stories')
                    setIsMenuOpen(false)
                  }}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                    title === 'My Canvases' ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  My Canvases
                </button>

                {/* My Characters */}
                <button
                  onClick={() => {
                    router.push('/characters')
                    setIsMenuOpen(false)
                  }}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                    title === 'My Characters' ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  My Characters
                </button>

                <div className="border-t border-gray-200 my-2"></div>

                {/* Settings/API Keys */}
                <button
                  onClick={() => {
                    router.push('/settings/api-keys')
                    setIsMenuOpen(false)
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
              </div>
            )}
          </div>

          {/* Profile Picture Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold hover:shadow-lg transition-shadow overflow-hidden"
              title="Profile"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user?.email?.[0].toUpperCase() || 'U'
              )}
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[100]">
                {/* Profile */}
                <button
                  onClick={() => {
                    router.push('/profile')
                    setIsProfileMenuOpen(false)
                  }}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                    title === 'Profile' ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>

                {/* Admin Panel - Only show for admins */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      router.push('/admin')
                      setIsProfileMenuOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Admin Panel
                  </button>
                )}

                <div className="border-t border-gray-200 my-2"></div>

                {/* Sign Out */}
                <button
                  onClick={() => {
                    signOut()
                    router.push('/auth')
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

