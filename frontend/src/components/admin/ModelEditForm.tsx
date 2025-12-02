'use client'

import { useState, useEffect } from 'react'
import { ModelMetadata } from './ModelMetadataManager'

interface ModelEditFormProps {
  model: ModelMetadata | null
  onClose: () => void
  onSave: (model: ModelMetadata) => Promise<void>
}

export default function ModelEditForm({ model, onClose, onSave }: ModelEditFormProps) {
  const [formData, setFormData] = useState<Partial<ModelMetadata>>({
    model_id: '',
    provider: 'openai',
    is_active: true,
    supports_structured_output: 'none',
    supports_reasoning: false,
    supports_streaming: true,
    supports_function_calling: false,
    supports_vision: false,
    tier: null,
    speed: null,
    cost: null,
    context_window: null,
    max_output_tokens: null,
    best_for: [],
    notes: null,
    admin_verified: false
  })
  const [saving, setSaving] = useState(false)
  const [bestForInput, setBestForInput] = useState('')

  useEffect(() => {
    if (model) {
      setFormData(model)
      setBestForInput((model.best_for || []).join(', '))
    } else {
      // Reset to defaults for new model
      setFormData({
        model_id: '',
        provider: 'openai',
        is_active: true,
        supports_structured_output: 'none',
        supports_reasoning: false,
        supports_streaming: true,
        supports_function_calling: false,
        supports_vision: false,
        tier: null,
        speed: null,
        cost: null,
        context_window: null,
        max_output_tokens: null,
        best_for: [],
        notes: null,
        admin_verified: false
      })
      setBestForInput('')
    }
  }, [model])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Parse best_for from comma-separated string
      const bestFor = bestForInput
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      const modelToSave: ModelMetadata = {
        ...formData,
        best_for: bestFor,
        model_id: formData.model_id!,
        provider: formData.provider!
      } as ModelMetadata

      await onSave(modelToSave)
      onClose()
    } catch (error) {
      console.error('Failed to save model:', error)
      alert('Failed to save model: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  if (!model && !formData.model_id) {
    // New model form - require model_id
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Add New Model Metadata
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model ID *
              </label>
              <input
                type="text"
                value={formData.model_id || ''}
                onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
                required
                placeholder="e.g., gpt-4o, claude-3-opus-20240229"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider *
              </label>
              <select
                value={formData.provider || 'openai'}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="groq">Groq</option>
                <option value="google">Google</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || !formData.model_id}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {model ? 'Edit Model Metadata' : 'Add Model Metadata'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model ID *
              </label>
              <input
                type="text"
                value={formData.model_id || ''}
                onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
                required
                disabled={!!model}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider *
              </label>
              <select
                value={formData.provider || 'openai'}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                required
                disabled={!!model}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="groq">Groq</option>
                <option value="google">Google</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Status</h4>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active !== false}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Active (model will be available to users)</span>
            </label>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Capabilities</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Structured Output
                </label>
                <select
                  value={formData.supports_structured_output || 'none'}
                  onChange={(e) => setFormData({ ...formData, supports_structured_output: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  <option value="none">None</option>
                  <option value="json-mode">JSON Mode</option>
                  <option value="full">Full (Schema Validated)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tier
                </label>
                <select
                  value={formData.tier || ''}
                  onChange={(e) => setFormData({ ...formData, tier: e.target.value || null })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  <option value="">Not Set</option>
                  <option value="frontier">Frontier</option>
                  <option value="premium">Premium</option>
                  <option value="standard">Standard</option>
                  <option value="fast">Fast</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.supports_reasoning || false}
                  onChange={(e) => setFormData({ ...formData, supports_reasoning: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Supports Reasoning</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.supports_streaming !== false}
                  onChange={(e) => setFormData({ ...formData, supports_streaming: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Supports Streaming</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.supports_function_calling || false}
                  onChange={(e) => setFormData({ ...formData, supports_function_calling: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Supports Function Calling</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.supports_vision || false}
                  onChange={(e) => setFormData({ ...formData, supports_vision: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Supports Vision</span>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Performance</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Speed
                </label>
                <select
                  value={formData.speed || ''}
                  onChange={(e) => setFormData({ ...formData, speed: e.target.value || null })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  <option value="">Not Set</option>
                  <option value="instant">Instant</option>
                  <option value="fast">Fast</option>
                  <option value="medium">Medium</option>
                  <option value="slow">Slow</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost
                </label>
                <select
                  value={formData.cost || ''}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value || null })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  <option value="">Not Set</option>
                  <option value="cheap">Cheap</option>
                  <option value="moderate">Moderate</option>
                  <option value="expensive">Expensive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Context Window
                </label>
                <input
                  type="number"
                  value={formData.context_window || ''}
                  onChange={(e) => setFormData({ ...formData, context_window: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="e.g., 128000"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Output Tokens
              </label>
              <input
                type="number"
                value={formData.max_output_tokens || ''}
                onChange={(e) => setFormData({ ...formData, max_output_tokens: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="e.g., 4096"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Best For</h4>
            <input
              type="text"
              value={bestForInput}
              onChange={(e) => setBestForInput(e.target.value)}
              placeholder="Comma-separated: orchestration, complex-writing, general-writing"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <p className="text-xs text-gray-500 mt-1">
              Separate multiple values with commas
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
              rows={3}
              placeholder="Internal notes about this model..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

