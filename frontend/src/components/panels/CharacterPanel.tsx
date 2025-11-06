'use client'

import { useState, useEffect, useRef } from 'react'
import { Node } from 'reactflow'
import { CharacterNodeData, CharacterRole } from '@/types/nodes'

interface CharacterPanelProps {
  node: Node<CharacterNodeData>
  onUpdate: (nodeId: string, newData: CharacterNodeData) => void
  onDelete: (nodeId: string) => void
}

const CHARACTER_ROLES: CharacterRole[] = ['Main', 'Active', 'Included', 'Involved', 'Passive']

export default function CharacterPanel({ node, onUpdate, onDelete }: CharacterPanelProps) {
  const [name, setName] = useState(node.data.label || '')
  const [bio, setBio] = useState(node.data.bio || '')
  const [role, setRole] = useState<CharacterRole | ''>(node.data.role || '')
  const [photoUrl, setPhotoUrl] = useState(node.data.photoUrl || '')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset all state when node changes
  useEffect(() => {
    setName(node.data.label || '')
    setBio(node.data.bio || '')
    setRole(node.data.role || '')
    setPhotoUrl(node.data.photoUrl || '')
    
    // Clear file input when switching nodes
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [node.id, node.data.label, node.data.bio, node.data.role, node.data.photoUrl])

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

