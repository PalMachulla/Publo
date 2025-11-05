'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function CanvasPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  const handleLogout = async () => {
    await signOut()
    router.push('/auth')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl font-mono">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold">Publo</h1>
            <p className="text-sm text-gray-400 font-mono">Engineering Intelligence</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user.user_metadata?.name || user.email?.split('@')[0] || 'User'}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm font-mono transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Canvas Area */}
      <main className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Welcome to your Canvas</h2>
            <p className="text-gray-400">
              This is your creative workspace. Start building something amazing!
            </p>
          </div>

          {/* Canvas Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 min-h-[600px]">
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <svg
                      className="mx-auto h-24 w-24 mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"
                      />
                    </svg>
                    <p className="text-lg font-mono">Your canvas awaits</p>
                    <p className="text-sm mt-2">Start creating by adding elements</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="font-semibold mb-4 font-mono">Tools</h3>
                <div className="space-y-2">
                  <button className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm text-left transition-colors">
                    ➕ Add Element
                  </button>
                  <button className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm text-left transition-colors">
                    🎨 Styles
                  </button>
                  <button className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm text-left transition-colors">
                    📐 Layout
                  </button>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="font-semibold mb-4 font-mono">Properties</h3>
                <div className="text-sm text-gray-400">
                  <p>Select an element to view its properties</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}




