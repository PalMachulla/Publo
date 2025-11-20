'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getAccessibleCharacters, searchCharacters, deleteCharacter } from '@/lib/characters'
import { Character } from '@/types/nodes'
import AppHeader from '@/components/layout/AppHeader'

export default function CharactersPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [characters, setCharacters] = useState<Character[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      loadCharacters()
    }
  }, [user])

  const loadCharacters = async () => {
    try {
      setIsLoading(true)
      const data = await getAccessibleCharacters()
      setCharacters(data)
    } catch (error) {
      console.error('Failed to load characters:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      loadCharacters()
      return
    }

    try {
      setIsLoading(true)
      const results = await searchCharacters(query)
      setCharacters(results)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCharacter = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return
    }

    try {
      await deleteCharacter(id)
      setCharacters(characters.filter(c => c.id !== id))
    } catch (error) {
      console.error('Failed to delete character:', error)
      alert('Failed to delete character')
    }
  }

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 z-0" style={{
          backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} />
        
        <div className="text-gray-900 relative z-10">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="My Characters" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Characters</h1>
          <p className="text-gray-600">Manage your character library</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search characters..."
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Characters Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading characters...</div>
        ) : characters.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No characters yet</h3>
            <p className="text-gray-600">Create characters in your story canvases to see them here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {characters.map((character) => (
              <div
                key={character.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Character Photo */}
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  {character.photo_url ? (
                    <img
                      src={character.photo_url}
                      alt={character.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-24 h-24 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>

                {/* Character Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 truncate">{character.name}</h3>
                  
                  {/* Role & Visibility */}
                  <div className="flex items-center gap-2 mb-2">
                    {character.role && (
                      <span className="bg-yellow-400 text-black text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full">
                        {character.role}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 capitalize">{character.visibility}</span>
                  </div>

                  {/* Bio */}
                  {character.bio && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{character.bio}</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteCharacter(character.id, character.name)}
                      className="flex-1 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="fixed bottom-6 left-0 right-0 pointer-events-none">
        <div className="flex justify-center">
          <div className="text-xs text-gray-400 font-mono">Intelligence Engineered by AIAKAKI</div>
        </div>
      </footer>
    </div>
  )
}

