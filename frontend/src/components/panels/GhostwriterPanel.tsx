'use client'

import { useState, useEffect } from 'react'
import { Cross2Icon } from '@radix-ui/react-icons'
import { GroqModelWithPricing } from '@/lib/groq/types'
import { Button } from '@/components/ui'

interface GhostwriterPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function GhostwriterPanel({ isOpen, onClose }: GhostwriterPanelProps) {
  const [models, setModels] = useState<GroqModelWithPricing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchModels()
    }
  }, [isOpen])

  const fetchModels = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/groq/models')
      const data = await response.json()
      
      if (data.success) {
        setModels(data.data)
        // Auto-select first production model
        const firstProduction = data.data.find((m: GroqModelWithPricing) => m.category === 'production')
        if (firstProduction) {
          setSelectedModel(firstProduction.id)
        }
      } else {
        setError(data.error || 'Failed to load models')
      }
    } catch (err) {
      setError('Failed to fetch models')
      console.error('Error fetching models:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return 'N/A'
    return `$${price.toFixed(3)}`
  }

  const formatSpeed = (speed?: number) => {
    if (!speed) return ''
    return `${speed} t/s`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center">
                <span className="text-2xl">✨</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Ghostwriter</h2>
                <p className="text-sm text-gray-500 mt-0.5">Choose a model to begin writing</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
            >
              <Cross2Icon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Models Section */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
              Available Models
            </h3>

            {loading && (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin" />
                <p className="text-sm text-gray-500 mt-4">Loading models...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={fetchModels}
                  className="text-sm text-red-700 font-medium mt-2 underline"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && models.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-sm">No models available</p>
              </div>
            )}

            {!loading && !error && models.length > 0 && (
              <div className="space-y-3">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedModel === model.id
                        ? 'border-yellow-400 bg-yellow-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Model Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {model.id}
                          </h4>
                          {model.category && (
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                model.category === 'production'
                                  ? 'bg-green-100 text-green-700'
                                  : model.category === 'preview'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {model.category}
                            </span>
                          )}
                        </div>
                        {model.description && (
                          <p className="text-xs text-gray-600 mb-2">{model.description}</p>
                        )}
                        
                        {/* Pricing & Speed */}
                        <div className="flex items-center gap-4 text-xs">
                          {model.price_per_1m_input !== undefined && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">In:</span>
                              <span className="font-mono font-medium text-gray-900">
                                {formatPrice(model.price_per_1m_input)}
                              </span>
                            </div>
                          )}
                          {model.price_per_1m_output !== undefined && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">Out:</span>
                              <span className="font-mono font-medium text-gray-900">
                                {formatPrice(model.price_per_1m_output)}
                              </span>
                            </div>
                          )}
                          {model.speed_tokens_per_sec && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">Speed:</span>
                              <span className="font-mono font-medium text-gray-900">
                                {formatSpeed(model.speed_tokens_per_sec)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Selection Indicator */}
                      {selectedModel === model.id && (
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pricing Note */}
          {!loading && models.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-600">
                <span className="font-semibold">Pricing:</span> Displayed per 1M tokens. 
                <span className="text-gray-500 ml-1">In = Input, Out = Output</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedModel && (
                <span>
                  Selected: <span className="font-medium text-gray-900">{selectedModel}</span>
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                disabled={!selectedModel}
                onClick={() => {
                  // TODO: Handle model selection and proceed to writing
                  console.log('Selected model:', selectedModel)
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

