'use client'

/**
 * Test page for BYOAPI endpoints
 * Access at: http://localhost:3002/test-api
 */

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function TestAPIPage() {
  const { user } = useAuth()
  const [provider, setProvider] = useState<'groq' | 'openai'>('groq')
  const [apiKey, setApiKey] = useState('')
  const [nickname, setNickname] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [keys, setKeys] = useState<any[]>([])

  // Add a key
  const handleAddKey = async () => {
    setLoading(true)
    setResponse(null)
    try {
      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, nickname }),
      })
      const data = await res.json()
      setResponse(data)
      if (data.success) {
        fetchKeys() // Refresh the list
        setApiKey('') // Clear the input
      }
    } catch (error: any) {
      setResponse({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  // List keys
  const fetchKeys = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user/api-keys')
      const data = await res.json()
      setKeys(data.keys || [])
      setResponse(data)
    } catch (error: any) {
      setResponse({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  // Update a key
  const handleUpdateKey = async (id: string, newNickname: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/user/api-keys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: newNickname }),
      })
      const data = await res.json()
      setResponse(data)
      if (data.success) {
        fetchKeys()
      }
    } catch (error: any) {
      setResponse({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  // Delete a key
  const handleDeleteKey = async (id: string) => {
    if (!confirm('Delete this API key?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/user/api-keys/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      setResponse(data)
      if (data.success) {
        fetchKeys()
      }
    } catch (error: any) {
      setResponse({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  // Toggle active status
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/user/api-keys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      })
      const data = await res.json()
      setResponse(data)
      if (data.success) {
        fetchKeys()
      }
    } catch (error: any) {
      setResponse({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">🔒 Not Authenticated</h1>
          <p className="text-gray-600 mb-4">You need to be logged in to test the API.</p>
          <a href="/auth" className="text-purple-600 hover:underline">Go to Login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🧪 BYOAPI Test Page</h1>
          <p className="text-gray-600 mb-4">
            User: <span className="font-mono text-sm">{user.email}</span>
          </p>
          <a href="/canvas" className="text-purple-600 hover:underline text-sm">← Back to Canvas</a>
        </div>

        {/* Add Key Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">➕ Add API Key</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === 'groq' ? 'gsk_...' : 'sk-...'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nickname (optional)</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="My Groq Key"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              onClick={handleAddKey}
              disabled={loading || !apiKey}
              className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Adding...' : '➕ Add API Key'}
            </button>
          </div>
        </div>

        {/* List Keys */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">🔑 Your API Keys</h2>
            <button
              onClick={fetchKeys}
              disabled={loading}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              🔄 Refresh
            </button>
          </div>

          {keys.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No API keys yet. Add one above!</p>
          ) : (
            <div className="space-y-4">
              {keys.map((key) => (
                <div key={key.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">
                          {key.nickname || 'Unnamed Key'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          key.provider === 'groq' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {key.provider.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          key.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {key.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          key.validation_status === 'valid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {key.validation_status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        ID: <span className="font-mono text-xs">{key.id}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Usage: {key.usage_count} times
                      </p>
                      {key.models_cache && (
                        <p className="text-sm text-gray-600">
                          Models cached: {key.models_cache.length}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(key.id, key.is_active)}
                        className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                      >
                        {key.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => {
                          const newName = prompt('New nickname:', key.nickname || '')
                          if (newName !== null) handleUpdateKey(key.id, newName)
                        }}
                        className="text-xs px-3 py-1 bg-blue-200 hover:bg-blue-300 rounded"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="text-xs px-3 py-1 bg-red-200 hover:bg-red-300 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Response Display */}
        {response && (
          <div className="bg-gray-900 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">📋 Last Response</h2>
            <pre className="text-green-400 text-sm overflow-x-auto">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

