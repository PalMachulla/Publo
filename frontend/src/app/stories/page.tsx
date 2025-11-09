'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getStories, createStory, deleteStory } from '@/lib/stories'
import { Story } from '@/types/nodes'
import { createClient } from '@/lib/supabase/client'

export default function StoriesPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [stories, setStories] = useState<Story[]>([])
  const [loadingStories, setLoadingStories] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  
  // TEMPORARY: Force admin for your email while debugging
  const isForceAdmin = user?.email === 'pal.machulla@gmail.com'
  console.log('🔧 Stories page - isForceAdmin check:', { email: user?.email, isForceAdmin })

  // Check user access and role
  useEffect(() => {
    async function checkUserAccess() {
      if (!user) {
        setCheckingAccess(false)
        return
      }

      try {
        const supabase = createClient()
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('role, access_status')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error checking user access:', error)
          setHasAccess(false)
          setCheckingAccess(false)
          return
        }

        // Check if user has proper role and access
        // Admins and users with granted access can proceed
        // Prospects must go to waitlist
        if (profile.role === 'admin' || profile.role === 'user') {
          setHasAccess(true)
        } else if (profile.role === 'prospect') {
          setHasAccess(false)
          router.push('/waitlist')
        } else {
          setHasAccess(false)
        }
        
        setCheckingAccess(false)
      } catch (error) {
        console.error('Access check failed:', error)
        setHasAccess(false)
        setCheckingAccess(false)
      }
    }

    if (!loading && user) {
      checkUserAccess()
    } else if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  // Load stories and avatar after access is granted
  useEffect(() => {
    if (!loading && user && hasAccess) {
      loadStories()
      // Get user avatar from metadata (social login)
      const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
      setUserAvatar(avatar)
    }
  }, [user, loading, hasAccess])

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        setIsMenuOpen(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as HTMLElement)) {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadStories = async () => {
    try {
      setLoadingStories(true)
      const data = await getStories()
      setStories(data)
    } catch (error) {
      console.error('Failed to load stories:', error)
    } finally {
      setLoadingStories(false)
    }
  }

  const handleCreateStory = async () => {
    try {
      const story = await createStory()
      router.push(`/canvas?id=${story.id}`)
    } catch (error) {
      console.error('Failed to create story:', error)
    }
  }

  const handleOpenStory = (id: string) => {
    router.push(`/canvas?id=${id}`)
  }

  const handleDeleteStory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm('Are you sure you want to delete this story?')) return

    try {
      setDeletingId(id)
      await deleteStory(id)
      setStories((prev) => prev.filter((s) => s.id !== id))
    } catch (error) {
      console.error('Failed to delete story:', error)
      alert('Failed to delete story')
    } finally {
      setDeletingId(null)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/auth')
  }

  if (loading || checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600 text-xl">Loading...</div>
      </div>
    )
  }

  if (!hasAccess) {
    return null // Will redirect to waitlist
  }

  if (loadingStories) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600 text-xl">Loading canvases...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/publo_logo.svg" alt="PUBLO" className="h-6" />
          </div>
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

              {/* Burger Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                  {/* My Characters */}
                  <button
                    onClick={() => {
                      router.push('/characters')
                      setIsMenuOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    My Characters
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

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                  {/* Profile */}
                  <button
                    onClick={() => {
                      alert('Profile page coming soon!')
                      setIsProfileMenuOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </button>

                  {/* Admin Panel - Only show for admins */}
                  {isForceAdmin && (
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

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12 pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Canvases</h1>
          <p className="text-gray-500">Create and manage your story canvases</p>
        </div>

        {stories.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No canvases yet</h3>
            <p className="text-gray-500 mb-6">Create your first canvas to get started</p>
            <button
              onClick={handleCreateStory}
              className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Canvas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {stories.map((story) => (
              <div
                key={story.id}
                onClick={() => handleOpenStory(story.id)}
                className={`group bg-white rounded-xl shadow-md hover:shadow-xl cursor-pointer transition-all border border-gray-200 overflow-hidden ${
                  deletingId === story.id ? 'opacity-50 pointer-events-none' : ''
                }`}
                style={{ aspectRatio: '3/4' }}
              >
                {/* Card Header - Preview Area */}
                <div className="h-3/5 bg-gradient-to-br from-gray-50 to-gray-100 p-4 relative">
                  <div className="absolute top-3 right-3 flex gap-2">
                    {/* Visibility Badge */}
                    {story.is_public ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Public
                      </span>
                    ) : story.shared ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        Shared
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Private
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteStory(story.id, e)}
                      className="p-1.5 bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      disabled={deletingId === story.id}
                      aria-label="Delete canvas"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  {/* Preview placeholder */}
                  <div className="h-full flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 17a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zM14 17a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1v-2z" />
                    </svg>
                  </div>
                </div>

                {/* Card Content - Info Area */}
                <div className="h-2/5 p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-2">
                      {story.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {Math.floor(Math.random() * 15) + 3} nodes
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    Updated {new Date(story.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
            
            {/* New Canvas Card */}
            <div
              onClick={handleCreateStory}
              className="group bg-white rounded-xl shadow-md hover:shadow-xl cursor-pointer transition-all border-2 border-dashed border-gray-300 hover:border-yellow-400 overflow-hidden flex items-center justify-center"
              style={{ aspectRatio: '3/4' }}
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 group-hover:bg-yellow-50 rounded-full flex items-center justify-center transition-colors">
                  <svg className="w-8 h-8 text-gray-400 group-hover:text-yellow-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">New Canvas</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Discrete AIAKAKI Branding */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-100 py-3">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <span>Intelligence Engineered by</span>
          <img src="/aiakaki_logo.svg" alt="AIAKAKI" className="h-3 opacity-60" />
        </div>
      </div>
    </div>
  )
}

