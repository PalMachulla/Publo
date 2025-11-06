'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getStories, createStory, deleteStory } from '@/lib/stories'
import { Story } from '@/types/nodes'

export default function StoriesPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [stories, setStories] = useState<Story[]>([])
  const [loadingStories, setLoadingStories] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
      return
    }

    if (user) {
      loadStories()
      // Get user avatar from metadata (social login)
      const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
      setUserAvatar(avatar)
    }
  }, [user, loading, router])

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

  if (loading || loadingStories) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600 text-xl">Loading...</div>
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
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Stories</h1>
          <p className="text-gray-500">Create and manage your story canvases</p>
        </div>

        {stories.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No stories yet</h3>
            <p className="text-gray-500 mb-6">Create your first story to get started</p>
            <button
              onClick={handleCreateStory}
              className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Story
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map((story) => (
              <div
                key={story.id}
                onClick={() => handleOpenStory(story.id)}
                className={`bg-white p-6 rounded-xl shadow-md hover:shadow-lg cursor-pointer transition-all border border-gray-100 ${
                  deletingId === story.id ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1">
                    {story.title}
                  </h3>
                  <button
                    onClick={(e) => handleDeleteStory(story.id, e)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    disabled={deletingId === story.id}
                    aria-label="Delete story"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                {story.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {story.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Updated {new Date(story.updated_at).toLocaleDateString()}</span>
                  <span>Created {new Date(story.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white py-6 mt-16">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <p className="text-gray-500 text-sm">Intelligence Engineered by</p>
            <img src="/aiakaki_logo.svg" alt="AIAKAKI" className="h-3.5" />
          </div>
        </div>
      </div>
    </div>
  )
}

