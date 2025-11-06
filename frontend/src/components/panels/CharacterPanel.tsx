'use client'

import { useState, useEffect, useRef } from 'react'
import { Node } from 'reactflow'
import { CharacterNodeData, CharacterRole, Character, CharacterVisibility } from '@/types/nodes'
import { getAccessibleCharacters, searchCharacters, createCharacter, updateCharacter } from '@/lib/characters'

interface CharacterPanelProps {
  node: Node<CharacterNodeData>
  onUpdate: (nodeId: string, newData: CharacterNodeData) => void
  onDelete: (nodeId: string) => void
}

const CHARACTER_ROLES: CharacterRole[] = ['Main', 'Active', 'Included', 'Involved', 'Passive']
const VISIBILITY_OPTIONS: CharacterVisibility[] = ['private', 'shared', 'public']

export default function CharacterPanel({ node, onUpdate, onDelete }: CharacterPanelProps) {
  const [name, setName] = useState(node.data.label || '')
  const [bio, setBio] = useState(node.data.bio || '')
  const [role, setRole] = useState<CharacterRole | ''>(node.data.role || '')
  const [visibility, setVisibility] = useState<CharacterVisibility>(node.data.visibility || 'private')
  const [photoUrl, setPhotoUrl] = useState(node.data.photoUrl || '')
  const [isUploading, setIsUploading] = useState(false)
  const [showBrowse, setShowBrowse] = useState(false)
  const [characters, setCharacters] = useState<Character[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load characters for browsing
  useEffect(() => {
    if (showBrowse) {
      loadCharacters()
    }
  }, [showBrowse])

  // Reset all state when node changes
  useEffect(() => {
    setName(node.data.label || '')
    setBio(node.data.bio || '')
    setRole(node.data.role || '')
    setVisibility(node.data.visibility || 'private')
    setPhotoUrl(node.data.photoUrl || '')
    setShowBrowse(false)
    
    // Clear file input when switching nodes
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [node.id, node.data.label, node.data.bio, node.data.role, node.data.visibility, node.data.photoUrl])

  const loadCharacters = async () => {
    try {
      setLoading(true)
      const data = await getAccessibleCharacters()
      setCharacters(data)
    } catch (error) {
      console.error('Failed to load characters:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchCharacters = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      loadCharacters()
      return
    }

    try {
      setLoading(true)
      const results = await searchCharacters(query)
      setCharacters(results)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadCharacter = (character: Character) => {
    setName(character.name)
    setBio(character.bio || '')
    setRole(character.role || '')
    setVisibility(character.visibility)
    setPhotoUrl(character.photo_url || '')
    setShowBrowse(false)

    // Update node data
    onUpdate(node.id, {
      ...node.data,
      characterId: character.id,
      label: character.name,
      characterName: character.name,
      bio: character.bio,
      role: character.role,
      visibility: character.visibility,
      photoUrl: character.photo_url,
      image: character.photo_url,
    })
  }

  const handleNameChange = (newName: string) => {
    setName(newName)
    onUpdate(node.id, {
      ...node.data,
      label: newName,
      characterName: newName,
    })
  }

  const handleBioChange = (newBio: string) => {
    setBio(newBio)
    onUpdate(node.id, {
      ...node.data,
      bio: newBio,
    })
  }

  const handleRoleChange = (newRole: CharacterRole) => {
    setRole(newRole)
    onUpdate(node.id, {
      ...node.data,
      role: newRole,
    })
  }

  const handleVisibilityChange = async (newVisibility: CharacterVisibility) => {
    setVisibility(newVisibility)
    onUpdate(node.id, {
      ...node.data,
      visibility: newVisibility,
    })

    // If character is already saved, update it in the database
    if (node.data.characterId) {
      try {
        await updateCharacter(node.data.characterId, { visibility: newVisibility })
      } catch (error) {
        console.error('Failed to update character visibility:', error)
      }
    }
  }

  const handleSaveCharacter = async () => {
    try {
      if (node.data.characterId) {
        // Update existing character
        await updateCharacter(node.data.characterId, {
          name,
          bio,
          photo_url: photoUrl,
          visibility,
          role: role || undefined,
        })
        alert('Character updated successfully!')
      } else {
        // Create new character
        const newCharacter = await createCharacter({
          name,
          bio,
          photo_url: photoUrl,
          visibility,
          role: role || undefined,
        })
        
        // Update node with character reference
        onUpdate(node.id, {
          ...node.data,
          characterId: newCharacter.id,
        })
        
        alert('Character saved successfully!')
      }
    } catch (error) {
      console.error('Failed to save character:', error)
      alert('Failed to save character')
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB')
      return
    }

    setIsUploading(true)

    try {
      // Convert to base64 for now (later can be replaced with actual upload to storage)
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setPhotoUrl(base64String)
        onUpdate(node.id, {
          ...node.data,
          photoUrl: base64String,
          image: base64String, // Also set as node image for display on canvas
        })
        setIsUploading(false)
      }
      reader.onerror = () => {
        alert('Failed to read image')
        setIsUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image')
      setIsUploading(false)
    }
  }

  const handleRemovePhoto = () => {
    setPhotoUrl('')
    onUpdate(node.id, {
      ...node.data,
      photoUrl: undefined,
      image: undefined,
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this character?')) {
      onDelete(node.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editable Name */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white rounded-t-3xl">
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="text-xl font-semibold text-gray-900 w-full bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-2 py-1"
          placeholder="Character Name"
        />
        <div className="text-xs text-gray-500 uppercase tracking-wide mt-1 px-2">Character Node</div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Browse Existing Characters */}
        <div>
          <button
            onClick={() => setShowBrowse(!showBrowse)}
            className="w-full px-4 py-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {showBrowse ? 'Create New Character' : 'Load Existing Character'}
          </button>
          
          {showBrowse && (
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchCharacters(e.target.value)}
                placeholder="Search characters..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              />
              
              <div className="max-h-64 overflow-y-auto space-y-2 bg-gray-50 rounded-lg p-2">
                {loading ? (
                  <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
                ) : characters.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">No characters found</div>
                ) : (
                  characters.map((char) => (
                    <button
                      key={char.id}
                      onClick={() => handleLoadCharacter(char)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {char.photo_url ? (
                          <img src={char.photo_url} alt={char.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900">{char.name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span className="capitalize">{char.visibility}</span>
                            {char.role && <span>• {char.role}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {!showBrowse && (
          <>
            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Photo</label>
          <div className="relative">
            {photoUrl ? (
              <div className="relative">
                <img
                  src={photoUrl}
                  alt={name}
                  className="w-full h-48 object-cover rounded-lg shadow-md"
                />
                <button
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                  title="Remove photo"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-blue-600"
              >
                {isUploading ? (
                  <div className="text-sm">Uploading...</div>
                ) : (
                  <>
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">Click to upload image</span>
                    <span className="text-xs text-gray-400">or drag and drop</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Quick Bio */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Quick Bio</label>
          <textarea
            value={bio}
            onChange={(e) => handleBioChange(e.target.value)}
            placeholder="Brief description of the character..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none"
          />
        </div>

        {/* Role in Story */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Role in Story</label>
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as CharacterRole)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm bg-white"
          >
            <option value="">Select role...</option>
            {CHARACTER_ROLES.map((roleOption) => (
              <option key={roleOption} value={roleOption}>
                {roleOption}
              </option>
            ))}
          </select>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Visibility</label>
          <select
            value={visibility}
            onChange={(e) => handleVisibilityChange(e.target.value as CharacterVisibility)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm bg-white"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {visibility === 'private' && 'Only you can use this character'}
            {visibility === 'shared' && 'Share with selected collaborators'}
            {visibility === 'public' && 'Anyone can use this character'}
          </p>
        </div>

        {/* Save Character Button */}
        <div>
          <button
            onClick={handleSaveCharacter}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {node.data.characterId ? 'Update Character' : 'Save Character'}
          </button>
          {node.data.characterId && (
            <p className="text-xs text-gray-500 mt-1 text-center">
              Saved to your character library
            </p>
          )}
        </div>

        {/* Profiler Chat Area */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Personality Profiler</label>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-center h-32 text-center">
              <div>
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm text-gray-500">Chatbot profiler coming soon</p>
                <p className="text-xs text-gray-400 mt-1">Detect personality traits through conversation</p>
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Delete Button */}
      <div className="px-6 py-4 border-t border-gray-200 mt-auto bg-white rounded-b-3xl">
        <button
          onClick={handleDelete}
          className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Character
        </button>
      </div>
    </div>
  )
}

