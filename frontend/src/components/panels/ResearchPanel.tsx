'use client'

import { useState, useEffect } from 'react'
import { Node } from 'reactflow'
import { sanitizeUrl } from '@/lib/validation/urlSanitizer'
import { ResearchNodeData } from '@/types/nodes'

interface ResearchPanelProps {
  node: Node<ResearchNodeData>
  onUpdate: (nodeId: string, newData: ResearchNodeData) => void
  onDelete: (nodeId: string) => void
}

export default function ResearchPanel({ node, onUpdate, onDelete }: ResearchPanelProps) {
  const [prompt, setPrompt] = useState(node.data.prompt || '')
  const [isResearching, setIsResearching] = useState(false)
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())

  useEffect(() => {
    setPrompt(node.data.prompt || '')
  }, [node.id, node.data.prompt])

  const handleStartResearch = async () => {
    if (!prompt.trim()) {
      alert('Please enter a research prompt')
      return
    }

    setIsResearching(true)

    try {
      // Update node to show researching status
      onUpdate(node.id, {
        ...node.data,
        prompt,
        status: 'researching',
        label: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
      })

      // Call backend API to start research
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          nodeId: node.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Research request failed')
      }

      const data = await response.json()

      // Update node with research results
      onUpdate(node.id, {
        ...node.data,
        prompt,
        status: 'completed',
        queries: data.queries,
        results: data.results,
        summary: data.summary,
        label: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
      })
    } catch (error) {
      console.error('Research error:', error)
      onUpdate(node.id, {
        ...node.data,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setIsResearching(false)
    }
  }

  const toggleResultExpansion = (resultId: string) => {
    const newExpanded = new Set(expandedResults)
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId)
    } else {
      newExpanded.add(resultId)
    }
    setExpandedResults(newExpanded)
  }

  const handleClearResearch = () => {
    if (confirm('Clear all research results?')) {
      setPrompt('')
      onUpdate(node.id, {
        ...node.data,
        prompt: '',
        status: 'idle',
        queries: [],
        results: [],
        summary: '',
        error: '',
        label: 'Research Node',
      })
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">AI Research</h2>
        <p className="text-sm text-gray-600">
          Enter a research topic and let AI find and analyze relevant information
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Research Prompt Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Research Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Latest developments in quantum computing for healthcare applications"
            maxLength={2000}
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            rows={4}
            disabled={isResearching}
            aria-label="Research prompt"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleStartResearch}
            disabled={isResearching || !prompt.trim()}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              isResearching || !prompt.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-cyan-500 text-white hover:bg-cyan-600'
            }`}
          >
            {isResearching ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Researching...
              </span>
            ) : (
              'Start Research'
            )}
          </button>
          
          {node.data.results && node.data.results.length > 0 && (
            <button
              onClick={handleClearResearch}
              className="px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Indicator */}
        {node.data.status && node.data.status !== 'idle' && (
          <div className={`p-3 rounded-lg ${
            node.data.status === 'researching' ? 'bg-blue-50 text-blue-800' :
            node.data.status === 'completed' ? 'bg-green-50 text-green-800' :
            'bg-red-50 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {node.data.status === 'researching' && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span className="text-sm font-medium">
                {node.data.status === 'researching' && 'Conducting research...'}
                {node.data.status === 'completed' && 'Research completed!'}
                {node.data.status === 'error' && `Error: ${node.data.error}`}
              </span>
            </div>
          </div>
        )}

        {/* Research Queries */}
        {node.data.queries && node.data.queries.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Search Queries Generated</h3>
            <div className="space-y-1">
              {node.data.queries.map((query, idx) => (
                <div key={idx} className="text-sm px-3 py-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-gray-600 font-mono">→</span> {query}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Research Results */}
        {node.data.results && node.data.results.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Research Results ({node.data.results.length})
            </h3>
            <div className="space-y-2">
              {node.data.results.map((result) => (
                <div key={result.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div 
                    className="p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleResultExpansion(result.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {result.title || result.url}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Query: {result.query}
                        </div>
                        {result.snippet && (
                          <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {result.snippet}
                          </div>
                        )}
                      </div>
                      <svg 
                        className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                          expandedResults.has(result.id) ? 'rotate-180' : ''
                        }`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {expandedResults.has(result.id) && (
                    <div className="p-3 bg-white border-t border-gray-200">
                      {(() => {
                        const safeUrl = sanitizeUrl(result.url)
                        return safeUrl ? (
                          <a 
                            href={safeUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-cyan-600 hover:text-cyan-700 break-all"
                          >
                            {result.url}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-500 break-all">
                            {result.url} (blocked: unsafe URL)
                          </span>
                        )
                      })()}
                      {result.scrapedContent && (
                        <div className="mt-3 text-sm text-gray-700 max-h-64 overflow-y-auto">
                          <div className="whitespace-pre-wrap break-words">
                            {result.scrapedContent.substring(0, 1000)}
                            {result.scrapedContent.length > 1000 && '...'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Research Summary */}
        {node.data.summary && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Research Summary</h3>
            <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
              <div className="text-sm text-gray-800 whitespace-pre-wrap">
                {node.data.summary}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Node Button */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => {
            if (confirm('Are you sure you want to delete this research node?')) {
              onDelete(node.id)
            }
          }}
          className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Node
        </button>
      </div>
    </div>
  )
}

