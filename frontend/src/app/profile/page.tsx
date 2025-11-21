'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import type { UserAPIKey, Provider } from '@/types/api-keys'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui'
import AppHeader from '@/components/layout/AppHeader'

type Section = 'general' | 'byoapi' | 'preferences' | 'account'

// Helper: Identify orchestrator models by pattern matching
const isOrchestratorModel = (modelId: string): boolean => {
  const id = modelId.toLowerCase()
  
  // High-capability orchestrator patterns
  const orchestratorPatterns = [
    'gpt-4',
    'o1',
    'o3',
    'claude-3-5-sonnet',
    'claude-3-opus',
    'gemini-1.5-pro',
    'gemini-2.0-flash-exp',
    'llama-3.3-70b',
    'llama-3.1-70b',
    'mixtral-8x7b',
    'qwen2.5-72b'
  ]
  
  return orchestratorPatterns.some(pattern => id.includes(pattern))
}

// Helper: Identify writer models (everything else that's chat-capable)
const isWriterModel = (modelId: string): boolean => {
  const id = modelId.toLowerCase()
  
  // Exclude non-chat models
  const excluded = [
    'realtime', 'transcribe', 'search', 'image', 
    'diarize', 'codex', 'embedding', 'moderation'
  ]
  
  if (excluded.some(pattern => id.includes(pattern))) return false
  
  // Exclude instruct models unless they're llama
  if (id.includes('instruct') && !id.includes('llama')) return false
  
  return true
}

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  
  const [activeSection, setActiveSection] = useState<Section>('byoapi')
  const [keys, setKeys] = useState<UserAPIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({
    groq: false,
    openai: false,
    anthropic: false,
    google: false,
    azure: false,
    bedrock: false
  })
  const [modelPreferences, setModelPreferences] = useState<Record<string, Record<string, boolean>>>({})
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({})
  const [updatingModel, setUpdatingModel] = useState<string | null>(null)
  const [orchestratorPreferences, setOrchestratorPreferences] = useState<Record<string, string | null>>({}) // keyId -> orchestratorModelId
  const [writerPreferences, setWriterPreferences] = useState<Record<string, string[]>>({}) // keyId -> writerModelIds[]
  const [updatingOrchestrator, setUpdatingOrchestrator] = useState<string | null>(null)
  
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
        
        // Initialize model preferences from fetched keys
        const prefs: Record<string, Record<string, boolean>> = {}
        const orchestratorPrefs: Record<string, string | null> = {}
        const writerPrefs: Record<string, string[]> = {}
        
        data.keys.forEach((key: UserAPIKey) => {
          prefs[key.id] = key.model_preferences || {}
          orchestratorPrefs[key.id] = key.orchestrator_model_id || null
          writerPrefs[key.id] = key.writer_model_ids || []
        })
        
        setModelPreferences(prefs)
        setOrchestratorPreferences(orchestratorPrefs)
        setWriterPreferences(writerPrefs)
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

  const providerInfo: Record<Provider, { name: string; url: string; logo: string; color: string }> = {
    groq: {
      name: 'Groq',
      url: 'https://console.groq.com/keys',
      logo: '/providers/groq.svg',
      color: 'orange'
    },
    openai: {
      name: 'OpenAI',
      url: 'https://platform.openai.com/api-keys',
      logo: '/providers/openai.svg',
      color: 'green'
    },
    anthropic: {
      name: 'Anthropic',
      url: 'https://console.anthropic.com/settings/keys',
      logo: '/providers/anthropic.svg',
      color: 'purple'
    },
    google: {
      name: 'Google AI',
      url: 'https://makersuite.google.com/app/apikey',
      logo: '/providers/google.svg',
      color: 'blue'
    }
  }

  // Placeholder providers (not yet implemented)
  const placeholderProviders = [
    {
      id: 'azure',
      name: 'Azure OpenAI',
      description: 'Configure Azure OpenAI to use OpenAI models through your Azure account.',
      logo: '/providers/azure.svg',
      fields: [
        { name: 'Base URL', placeholder: 'e.g. my-resource.openai.azure.com' },
        { name: 'Deployment Name', placeholder: 'e.g. gpt-35-turbo' },
        { name: 'API Key', placeholder: 'Enter your Azure OpenAI key', type: 'password' }
      ]
    },
    {
      id: 'bedrock',
      name: 'AWS Bedrock',
      description: 'Configure AWS Bedrock to use Anthropic Claude models through your AWS account. Cursor Enterprise teams can configure IAM roles to access Bedrock without any Access Keys.',
      logo: '/providers/aws.svg',
      fields: [
        { name: 'Access Key ID', placeholder: 'AWS Access Key ID' },
        { name: 'Secret Access Key', placeholder: 'AWS Secret Access Key', type: 'password' },
        { name: 'Region', placeholder: 'e.g. us-east-1' },
        { name: 'Test Model', placeholder: 'us.anthropic.claude-sonnet-4-20250514-v1:0' }
      ]
    }
  ]

  const sections = [
    {
      id: 'general' as Section,
      label: 'General',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      description: 'Manage your profile and preferences'
    },
    {
      id: 'byoapi' as Section,
      label: 'BYOAPI Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
      description: 'Bring your own API keys'
    },
    {
      id: 'preferences' as Section,
      label: 'Preferences',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
      description: 'Customize your experience'
    },
    {
      id: 'account' as Section,
      label: 'Account',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      description: 'Manage account settings'
    }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <AppHeader title="Profile" />

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
          <nav className="flex-1 p-4 space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900'
                }`}
              >
                <span className={activeSection === section.id ? 'text-yellow-500' : 'text-gray-400'}>
                  {section.icon}
                </span>
                <span className="font-medium text-sm">{section.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => {
                signOut()
                router.push('/auth')
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-8">
            {/* Section Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {sections.find(s => s.id === activeSection)?.label}
              </h2>
              <p className="text-sm text-gray-600">
                {sections.find(s => s.id === activeSection)?.description}
              </p>
            </div>

            {/* BYOAPI Section */}
            {activeSection === 'byoapi' && (
              <div className="space-y-6">
                {/* Info Banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-gray-700">
                        <strong>Bring Your Own API</strong> — Use your personal API keys from AI providers. You pay only for what you use, and your keys are securely encrypted with AES-256-GCM.
                      </p>
                    </div>
                  </div>
                </div>

                {/* API Keys Sections */}
                <div className="space-y-1">
                  {(Object.keys(providerInfo) as Provider[]).map((prov) => {
                    const info = providerInfo[prov]
                    const providerKeys = keys.filter(k => k.provider === prov)
                    const hasKey = providerKeys.length > 0
                    const activeKey = providerKeys.find(k => k.is_active)
                    const expanded = expandedProviders[prov]

                    return (
                      <div key={prov} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                        {/* Provider Header */}
                        <button
                          onClick={() => setExpandedProviders(prev => ({ ...prev, [prov]: !prev[prov] }))}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <img src={info.logo} alt={info.name} className="w-6 h-6" />
                            <div className="text-left">
                              <div className="font-medium text-gray-900">{info.name} API Key</div>
                              <div className="text-xs text-gray-500">
                                {hasKey ? (
                                  <>
                                    You can put in your {info.name} key to use {info.name} models at cost.
                                  </>
                                ) : (
                                  <>
                                    You can put in your{' '}
                                    <a
                                      href={info.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-yellow-600 hover:text-yellow-700 underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {info.name} key
                                    </a>
                                    {' '}to use {info.name} models at cost.
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {hasKey && (
                              <Badge variant="success" size="sm">
                                {providerKeys.length} key{providerKeys.length !== 1 ? 's' : ''}
                              </Badge>
                            )}
                            <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={!!activeKey}
                                onChange={(e) => {
                                  if (activeKey) {
                                    handleToggleActive(activeKey.id, true)
                                  } else {
                                    setExpandedProviders(prev => ({ ...prev, [prov]: true }))
                                  }
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                          </div>
                        </button>

                        {/* Expanded Content */}
                        {expanded && (
                          <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                            {/* Existing Keys */}
                            {providerKeys.map((key) => (
                              <div key={key.id} className="p-3 bg-white border border-gray-200 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <img src={info.logo} alt={info.name} className="w-5 h-5" />
                                    <span className="text-sm font-medium text-gray-900">
                                      {key.nickname || `${info.name} Key`}
                                    </span>
                                    <Badge 
                                      variant={
                                        key.validation_status === 'valid' ? 'success' : 
                                        key.validation_status === 'invalid' ? 'danger' : 
                                        key.validation_status === 'expired' ? 'warning' : 'default'
                                      }
                                      size="sm"
                                    >
                                      {key.validation_status}
                                    </Badge>
                                    {key.is_active && (
                                      <Badge variant="success" size="sm">Active</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant={key.is_active ? "outline" : "success"}
                                      size="sm"
                                      onClick={() => handleToggleActive(key.id, key.is_active)}
                                    >
                                      {key.is_active ? 'Deactivate' : 'Activate'}
                                    </Button>
                                    <button
                                      onClick={() => handleDeleteKey(key.id)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="Delete key"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  {key.models_cache && (
                                    <span>{key.models_cache.length} models</span>
                                  )}
                                  <span>Used {key.usage_count} times</span>
                                  {key.last_used_at && (
                                    <span>Last: {new Date(key.last_used_at).toLocaleDateString()}</span>
                                  )}
                                </div>
                                
                                {/* Enhanced Model Selection: Orchestrator + Writers */}
                                {key.models_cache && key.models_cache.length > 0 && (() => {
                                  // Filter and categorize models
                                  const chatModels = key.models_cache.filter((m: any) => {
                                    if (m.supports_chat === false) return false
                                    return isWriterModel(m.id)
                                  })
                                  
                                  const orchestrators = chatModels.filter((m: any) => isOrchestratorModel(m.id))
                                  const writers = chatModels.filter((m: any) => !isOrchestratorModel(m.id))
                                  
                                  const isExpanded = expandedModels[key.id] || false
                                  const selectedOrchestrator = orchestratorPreferences[key.id]
                                  const selectedWriters = writerPreferences[key.id] || []
                                  
                                  return (
                                    <div className="mt-3 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                                      <button
                                        onClick={() => setExpandedModels(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors group"
                                      >
                                        <div className="flex items-center gap-3">
                                          <svg 
                                            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                                            Model Configuration
                                          </span>
                                          <Badge variant="info" size="sm">
                                            {orchestrators.length} orchestrators
                                          </Badge>
                                          <Badge variant="default" size="sm">
                                            {writers.length} writers
                                          </Badge>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                          {selectedOrchestrator ? (selectedWriters.length > 0 ? 'Multi-agent' : 'Single-model') : 'Not configured'}
                                        </span>
                                      </button>
                                      
                                      {isExpanded && (
                                        <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
                                          {/* Info Banner */}
                                          <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex gap-3">
                                              <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              <div className="text-xs text-blue-900 space-y-1">
                                                <p className="font-semibold">Orchestration Modes:</p>
                                                <p>• <strong>Single-model:</strong> Select an orchestrator only. It handles planning AND writing.</p>
                                                <p>• <strong>Multi-agent:</strong> Select orchestrator + writer models. Orchestrator plans, delegates writing to cheaper/faster models.</p>
                                                <p>• <strong>Auto:</strong> Leave blank. System picks the best orchestrator automatically.</p>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {/* Orchestrator Selection */}
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <h4 className="text-sm font-semibold text-gray-900">🧠 Orchestrator Model</h4>
                                              <span className="text-xs text-gray-500">(Plans structure & delegates tasks)</span>
                                            </div>
                                            
                                            {orchestrators.length > 0 ? (
                                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                                {/* Auto option */}
                                                <label className="flex items-start gap-3 p-3 bg-white rounded-lg cursor-pointer hover:shadow-md transition-all border-2 border-green-200 hover:border-green-300">
                                                  <input
                                                    type="radio"
                                                    name={`orchestrator-${key.id}`}
                                                    checked={!selectedOrchestrator}
                                                    onChange={() => {
                                                      setOrchestratorPreferences(prev => ({
                                                        ...prev,
                                                        [key.id]: null
                                                      }))
                                                    }}
                                                    className="mt-1 w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                                                  />
                                                  <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                      <span className="text-sm font-semibold text-gray-900">🤖 Auto-select</span>
                                                      <Badge variant="success" size="sm">Recommended</Badge>
                                                    </div>
                                                    <p className="text-xs text-gray-600">System picks the best orchestrator for your provider</p>
                                                  </div>
                                                </label>
                                                
                                                {orchestrators.map((model: any) => (
                                                  <label
                                                    key={model.id}
                                                    className="flex items-start gap-3 p-3 bg-white rounded-lg cursor-pointer hover:shadow-md transition-all border border-gray-200 hover:border-purple-300"
                                                  >
                                                    <input
                                                      type="radio"
                                                      name={`orchestrator-${key.id}`}
                                                      checked={selectedOrchestrator === model.id}
                                                      onChange={() => {
                                                        setOrchestratorPreferences(prev => ({
                                                          ...prev,
                                                          [key.id]: model.id
                                                        }))
                                                      }}
                                                      className="mt-1 w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className="text-sm font-semibold text-gray-900">{model.name || model.id}</span>
                                                        <Badge variant={model.category === 'production' ? 'success' : 'warning'} size="sm">
                                                          {model.category}
                                                        </Badge>
                                                      </div>
                                                      {model.description && (
                                                        <p className="text-xs text-gray-600 mb-2 leading-relaxed">{model.description}</p>
                                                      )}
                                                      <div className="flex items-center gap-3 text-xs text-gray-500">
                                                        {model.context_window && (
                                                          <span>{(model.context_window / 1000).toFixed(0)}K ctx</span>
                                                        )}
                                                        {model.max_output_tokens && (
                                                          <span>{(model.max_output_tokens / 1000).toFixed(0)}K max</span>
                                                        )}
                                                        {model.input_price_per_1m !== null && (
                                                          <span className="font-medium text-gray-700">${model.input_price_per_1m.toFixed(2)}/1M</span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </label>
                                                ))}
                                              </div>
                                            ) : (
                                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                                                No high-capability orchestrator models found. System will auto-select.
                                              </div>
                                            )}
                                          </div>
                                          
                                          {/* Writer Models Selection */}
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <h4 className="text-sm font-semibold text-gray-900">✍️ Writer Models</h4>
                                              <span className="text-xs text-gray-500">(Optional: for multi-agent delegation)</span>
                                            </div>
                                            
                                            {writers.length > 0 ? (
                                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                                {writers.map((model: any) => {
                                                  const isChecked = selectedWriters.includes(model.id)
                                                  
                                                  return (
                                                    <label
                                                      key={model.id}
                                                      className="flex items-start gap-3 p-3 bg-white rounded-lg cursor-pointer hover:shadow-md transition-all border border-gray-200 hover:border-yellow-300"
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                          const newWriters = e.target.checked
                                                            ? [...selectedWriters, model.id]
                                                            : selectedWriters.filter(id => id !== model.id)
                                                          
                                                          setWriterPreferences(prev => ({
                                                            ...prev,
                                                            [key.id]: newWriters
                                                          }))
                                                        }}
                                                        className="mt-1 w-4 h-4 text-yellow-500 border-gray-300 rounded focus:ring-yellow-400 focus:ring-2"
                                                      />
                                                      <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                                          <span className="text-sm font-semibold text-gray-900">{model.name || model.id}</span>
                                                          <Badge variant={model.category === 'production' ? 'success' : 'warning'} size="sm">
                                                            {model.category}
                                                          </Badge>
                                                        </div>
                                                        {model.description && (
                                                          <p className="text-xs text-gray-600 mb-2 leading-relaxed">{model.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                                          {model.context_window && (
                                                            <span>{(model.context_window / 1000).toFixed(0)}K ctx</span>
                                                          )}
                                                          {model.max_output_tokens && (
                                                            <span>{(model.max_output_tokens / 1000).toFixed(0)}K max</span>
                                                          )}
                                                          {model.input_price_per_1m !== null && (
                                                            <span className="font-medium text-gray-700">${model.input_price_per_1m.toFixed(2)}/1M</span>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </label>
                                                  )
                                                })}
                                              </div>
                                            ) : (
                                              <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-600">
                                                No writer models available. Orchestrator will handle all writing.
                                              </div>
                                            )}
                                          </div>
                                          
                                          {/* Save Button */}
                                          <div className="pt-2 border-t border-gray-200">
                                            <Button
                                              variant="primary"
                                              size="sm"
                                              disabled={updatingOrchestrator === key.id}
                                              onClick={async () => {
                                                setUpdatingOrchestrator(key.id)
                                                
                                                try {
                                                  console.log('[Profile] Saving preferences:', {
                                                    keyId: key.id,
                                                    orchestratorModelId: selectedOrchestrator,
                                                    writerModelIds: selectedWriters
                                                  })
                                                  
                                                  const response = await fetch(`/api/user/api-keys/${key.id}/preferences`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                      orchestratorModelId: selectedOrchestrator,
                                                      writerModelIds: selectedWriters
                                                    })
                                                  })
                                                  
                                                  console.log('[Profile] Response status:', response.status)
                                                  
                                                  const data = await response.json()
                                                  console.log('[Profile] Response data:', data)
                                                  
                                                  if (!response.ok) {
                                                    throw new Error(data.error || 'Failed to save preferences')
                                                  }
                                                  
                                                  // Refresh keys to get updated data
                                                  await fetchKeys()
                                                  
                                                  alert('✅ Model preferences saved!')
                                                } catch (error: any) {
                                                  console.error('[Profile] Error saving preferences:', error)
                                                  alert(`❌ Failed to save: ${error.message}`)
                                                } finally {
                                                  setUpdatingOrchestrator(null)
                                                }
                                              }}
                                              className="w-full"
                                            >
                                              {updatingOrchestrator === key.id ? 'Saving...' : '💾 Save Configuration'}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            ))}

                            {/* Add New Key Form */}
                            {showAddForm && provider === prov ? (
                              <form onSubmit={handleAddKey} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-gray-900">Add New {info.name} Key</h4>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAddForm(false)
                                      setError(null)
                                    }}
                                    className="text-gray-500 hover:text-gray-700"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
                                  <Input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={`Enter your ${info.name} API key`}
                                    className="font-mono text-sm"
                                    required
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Nickname (Optional)</label>
                                  <Input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="e.g., My Personal Key"
                                    className="text-sm"
                                  />
                                </div>

                                {error && (
                                  <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                                    {error}
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <Button type="submit" variant="primary" size="sm" disabled={submitting} className="flex-1">
                                    {submitting ? 'Adding...' : 'Add Key'}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setShowAddForm(false)
                                      setError(null)
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </form>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setProvider(prov)
                                  setShowAddForm(true)
                                  setError(null)
                                }}
                                className="w-full"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add {info.name} Key
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Placeholder Providers */}
                  {placeholderProviders.map((placeholder) => {
                    const expanded = expandedProviders[placeholder.id]

                    return (
                      <div key={placeholder.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                        {/* Provider Header */}
                        <button
                          onClick={() => setExpandedProviders(prev => ({ ...prev, [placeholder.id]: !prev[placeholder.id] }))}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <img src={placeholder.logo} alt={placeholder.name} className="w-6 h-6" />
                            <div className="text-left">
                              <div className="font-medium text-gray-900">{placeholder.name}</div>
                              <div className="text-xs text-gray-500">
                                {placeholder.description}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="relative inline-flex items-center cursor-pointer opacity-50" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={false}
                                disabled
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                            </label>
                          </div>
                        </button>

                        {/* Expanded Content - Placeholder Fields */}
                        {expanded && (
                          <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-xs text-blue-800">
                                  {placeholder.name} support is coming soon. These fields are placeholders and not yet functional.
                                </p>
                              </div>
                            </div>

                            {/* Placeholder Fields */}
                            {placeholder.fields.map((field, idx) => (
                              <div key={idx}>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  {field.name}
                                </label>
                                <Input
                                  type={field.type || 'text'}
                                  placeholder={field.placeholder}
                                  disabled
                                  className="bg-gray-100 cursor-not-allowed text-sm"
                                />
                              </div>
                            ))}

                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="w-full opacity-50 cursor-not-allowed"
                            >
                              Coming Soon
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* General Section - Placeholder */}
            {activeSection === 'general' && (
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Coming soon...</CardDescription>
                </CardHeader>
              </Card>
            )}

            {/* Preferences Section - Placeholder */}
            {activeSection === 'preferences' && (
              <Card>
                <CardHeader>
                  <CardTitle>Preferences</CardTitle>
                  <CardDescription>Coming soon...</CardDescription>
                </CardHeader>
              </Card>
            )}

            {/* Account Section - Placeholder */}
            {activeSection === 'account' && (
              <Card>
                <CardHeader>
                  <CardTitle>Account Settings</CardTitle>
                  <CardDescription>Coming soon...</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <Input type="email" value={user?.email || ''} disabled />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

