'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import type { UserAPIKey, Provider } from '@/types/api-keys'

export default function APIKeysSettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [keys, setKeys] = useState<UserAPIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  
  // Form state
  const [provider, setProvider] = useState<Provider>('groq')
  const [apiKey, setApiKey] = useState('')
  const [nickname, setNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }
    fetchKeys()
  }, [user, router])

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/user/api-keys')
      const data = await response.json()
      
      if (data.success) {
        setKeys(data.keys)
      } else {
        setError(data.error || 'Failed to load API keys')
      }
    } catch (err) {
      setError('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, nickname })
      })

      const data = await response.json()

      if (data.success) {
        await fetchKeys()
        setShowAddForm(false)
        setApiKey('')
        setNickname('')
        setProvider('groq')
      } else {
        setError(data.error || 'Failed to add API key')
      }
    } catch (err) {
      setError('Failed to add API key')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (keyId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/user/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      })

      if (response.ok) {
        await fetchKeys()
      }
    } catch (err) {
      console.error('Failed to toggle key status:', err)
    }
  }

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/user/api-keys/${keyId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchKeys()
      }
    } catch (err) {
      console.error('Failed to delete key:', err)
    }
  }

  const providerInfo: Record<Provider, { name: string; url: string; icon: string; color: string }> = {
    groq: {
      name: 'Groq',
      url: 'https://console.groq.com/keys',
      icon: '⚡',
      color: 'orange'
    },
    openai: {
      name: 'OpenAI',
      url: 'https://platform.openai.com/api-keys',
      icon: '🤖',
      color: 'green'
    },
    anthropic: {
      name: 'Anthropic',
      url: 'https://console.anthropic.com/settings/keys',
      icon: '🧠',
      color: 'purple'
    },
    google: {
      name: 'Google AI',
      url: 'https://makersuite.google.com/app/apikey',
      icon: '🔷',
      color: 'blue'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/stories')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">BYOAPI Settings</h1>
                <p className="text-sm text-gray-500 mt-1">Bring Your Own API Keys</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                {keys.length} {keys.length === 1 ? 'Key' : 'Keys'} Added
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info Banner */}
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-6 mb-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-900 mb-2">
                What is BYOAPI?
              </h3>
              <p className="text-amber-800 mb-4">
                <strong>Bring Your Own API</strong> allows you to use your personal API keys from AI providers like Groq, OpenAI, Anthropic, and Google AI.
                This means you pay only for what you use, and your keys are securely encrypted in our database.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-amber-900"><strong>Secure:</strong> Keys encrypted with AES-256-GCM</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-amber-900"><strong>Transparent:</strong> See your usage and costs</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-amber-900"><strong>Flexible:</strong> Switch between providers anytime</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-amber-900"><strong>Cost-effective:</strong> Pay only for what you use</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Get API Keys Section */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Where to Get Your API Keys
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(providerInfo) as Provider[]).map((prov) => {
              const info = providerInfo[prov]
              return (
                <a
                  key={prov}
                  href={info.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-yellow-400 hover:shadow-md transition-all group"
                >
                  <div className="text-3xl">{info.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 group-hover:text-yellow-600 transition-colors">
                      {info.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Click to get your API key →</div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )
            })}
          </div>
        </div>

        {/* Your API Keys Section */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Your API Keys
            </h2>
            
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add API Key
              </button>
            )}
          </div>

          {/* Add Key Form */}
          {showAddForm && (
            <form onSubmit={handleAddKey} className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Add New API Key</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setError(null)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as Provider)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    required
                  >
                    <option value="groq">⚡ Groq</option>
                    <option value="openai">🤖 OpenAI</option>
                    <option value="anthropic">🧠 Anthropic</option>
                    <option value="google">🔷 Google AI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`${providerInfo[provider].name} API key`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent font-mono text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nickname (Optional)</label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g., My Personal Key"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 text-gray-900 font-medium rounded-lg transition-colors"
                  >
                    {submitting ? 'Adding...' : 'Add Key'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setError(null)
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Keys List */}
          {keys.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No API Keys Yet</h3>
              <p className="text-gray-500 mb-4">Add your first API key to start using AI generation</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors shadow-sm"
              >
                Add Your First Key
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => {
                const info = providerInfo[key.provider]
                const statusColor = 
                  key.validation_status === 'valid' ? 'green' :
                  key.validation_status === 'invalid' ? 'red' :
                  key.validation_status === 'expired' ? 'orange' : 'gray'

                return (
                  <div
                    key={key.id}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      key.is_active
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-2xl">{info.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">
                              {key.nickname || `${info.name} Key`}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              statusColor === 'green' ? 'bg-green-100 text-green-800' :
                              statusColor === 'red' ? 'bg-red-100 text-red-800' :
                              statusColor === 'orange' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {key.validation_status}
                            </span>
                            {key.is_active && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>{info.name}</span>
                            {key.models_cache && (
                              <span>{key.models_cache.length} models</span>
                            )}
                            <span>Used {key.usage_count} times</span>
                            {key.last_used_at && (
                              <span>Last used: {new Date(key.last_used_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(key.id, key.is_active)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            key.is_active
                              ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        >
                          {key.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteKey(key.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

