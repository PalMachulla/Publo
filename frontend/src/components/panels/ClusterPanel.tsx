'use client'

import { useState, useEffect, useMemo } from 'react'
import { Node, Edge } from 'reactflow'
import { ClusterNodeData, AgentSpecialization, ConsultationDepth, ResponseStyle, ResponseLengthLimit } from '@/types/nodes'
import CollapsibleSection from './cluster-panel/CollapsibleSection'
import Slider from './cluster-panel/Slider'

interface ClusterPanelProps {
  node: Node<ClusterNodeData>
  onUpdate: (nodeId: string, updates: Partial<ClusterNodeData>) => void
  onDelete: (nodeId: string) => void
  edges?: Edge[]
}

export default function ClusterPanel({ node, onUpdate, onDelete, edges = [] }: ClusterPanelProps) {
  // Basic fields
  const [label, setLabel] = useState(node.data.label || '')
  const [description, setDescription] = useState(node.data.description || '')
  const [color, setColor] = useState(node.data.color || '#9ca3af')
  const [isActive, setIsActive] = useState(node.data.isActive ?? true)
  const [specialization, setSpecialization] = useState<AgentSpecialization>(
    node.data.specialization || 'custom'
  )
  
  // Consultation Behavior
  const [consultationTriggers, setConsultationTriggers] = useState(
    node.data.consultationTriggers || {
      onSegmentStart: false,
      onDemand: true,
      automaticTriggers: [],
      onSegmentReview: false,
    }
  )
  const [consultationDepth, setConsultationDepth] = useState<ConsultationDepth>(
    node.data.consultationDepth || 'detailed'
  )
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>(
    node.data.responseStyle || 'suggestive'
  )
  const [proactivityLevel, setProactivityLevel] = useState(
    node.data.proactivityLevel ?? 30
  )
  
  // Knowledge & Resources
  const [contextAwareness, setContextAwareness] = useState(
    node.data.contextAwareness ?? 70
  )
  const [canAccessDraft, setCanAccessDraft] = useState(
    node.data.canAccessDraft ?? true
  )
  const [canAccessOtherAgents, setCanAccessOtherAgents] = useState(
    node.data.canAccessOtherAgents ?? false
  )
  const [canAccessExternalTools, setCanAccessExternalTools] = useState(
    node.data.canAccessExternalTools ?? false
  )
  
  // Interaction
  const [exampleQueries, setExampleQueries] = useState(
    node.data.exampleQueries?.join('\n') || ''
  )
  const [responsePreferences, setResponsePreferences] = useState(
    node.data.responsePreferences || {
      includeExamples: true,
      citeSources: true,
      offerAlternatives: 'when_relevant' as const,
      showConfidence: false,
    }
  )
  
  // Model & Voice
  const [modelSelection, setModelSelection] = useState(
    node.data.modelSelection || 'claude-3-5-sonnet'
  )
  const [expertPersonality, setExpertPersonality] = useState(
    node.data.expertPersonality ?? 50
  )
  const [temperature, setTemperature] = useState(
    node.data.temperature ?? 0.7
  )
  
  // Efficiency
  const [responseLengthLimit, setResponseLengthLimit] = useState<ResponseLengthLimit>(
    node.data.responseLengthLimit || 'moderate'
  )
  const [tokenBudget, setTokenBudget] = useState(
    node.data.tokenBudget ?? 4000
  )
  const [maxConsultations, setMaxConsultations] = useState(
    node.data.maxConsultations?.toString() || ''
  )
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Update local state when node changes
  useEffect(() => {
    setLabel(node.data.label || '')
    setDescription(node.data.description || '')
    setColor(node.data.color || '#9ca3af')
    setIsActive(node.data.isActive ?? true)
    setSpecialization(node.data.specialization || 'custom')
  }, [node.data.label, node.data.description, node.data.color, node.data.isActive, node.data.specialization])

  const handleSave = () => {
    onUpdate(node.id, {
      label,
      description,
      color,
      isActive,
      specialization,
      consultationTriggers,
      consultationDepth,
      responseStyle,
      proactivityLevel,
      contextAwareness,
      canAccessDraft,
      canAccessOtherAgents,
      canAccessExternalTools,
      exampleQueries: exampleQueries.split('\n').filter(q => q.trim()),
      responsePreferences,
      modelSelection,
      expertPersonality,
      temperature,
      responseLengthLimit,
      tokenBudget,
      maxConsultations: maxConsultations ? parseInt(maxConsultations) : null,
    })
  }

  const handleDelete = () => {
    onDelete(node.id)
    setShowDeleteConfirm(false)
  }

  // Count connected resources based on edges
  const nodeCount = useMemo(() => {
    // Count edges where this node is either source or target
    return edges.filter(edge => 
      edge.source === node.id || edge.target === node.id
    ).length
  }, [edges, node.id])
  
  // Calculate estimated token usage
  const estimatedTokenUsage = useMemo(() => {
    let base = 500 // base conversation overhead
    base += contextAwareness * 10 // more context = more tokens
    if (canAccessDraft) base += 2000
    if (canAccessOtherAgents) base += 1000
    return Math.min(base, tokenBudget)
  }, [contextAwareness, canAccessDraft, canAccessOtherAgents, tokenBudget])

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: color + '20' }}
          >
            <svg className="w-6 h-6" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="6" cy="5" r="1.5" strokeWidth={0} fill="currentColor" />
              <circle cx="12" cy="5" r="1.5" strokeWidth={0} fill="currentColor" />
              <circle cx="18" cy="5" r="1.5" strokeWidth={0} fill="currentColor" />
              <circle cx="12" cy="19" r="2" strokeWidth={0} fill="currentColor" />
              <line x1="12" y1="17" x2="12" y2="9" strokeWidth={2} strokeLinecap="round" />
              <line x1="6" y1="9" x2="18" y2="9" strokeWidth={2} strokeLinecap="round" />
              <line x1="6" y1="9" x2="6" y2="6.5" strokeWidth={2} strokeLinecap="round" />
              <line x1="12" y1="9" x2="12" y2="6.5" strokeWidth={2} strokeLinecap="round" />
              <line x1="18" y1="9" x2="18" y2="6.5" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Sub-Agent Settings</h2>
            <p className="text-sm text-gray-500">Configure your expert agent</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        
        {/* === SECTION 1: Identity & Status === */}
        <CollapsibleSection 
          title="Identity & Status" 
          defaultOpen={true}
          icon={<span className="text-lg">🎯</span>}
        >
          {/* Agent Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agent Name
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleSave}
              maxLength={100}
              placeholder="Enter agent name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
          </div>

          {/* Specialization */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specialization
            </label>
            <select
              value={specialization}
              onChange={(e) => {
                setSpecialization(e.target.value as AgentSpecialization)
                handleSave()
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            >
              <option value="character_voice">Character Voice</option>
              <option value="historical_accuracy">Historical Accuracy</option>
              <option value="genre_conventions">Genre Conventions</option>
              <option value="world_rules">World Rules</option>
              <option value="tone_style">Tone & Style</option>
              <option value="research">Research</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSave}
              maxLength={500}
              placeholder="Describe what this agent specializes in..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none"
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  const newColor = e.target.value
                  setColor(newColor)
                  onUpdate(node.id, { ...node.data, color: newColor })
                }}
                className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                onBlur={handleSave}
                placeholder="#9ca3af"
                pattern="^#[0-9A-Fa-f]{6}$"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent font-mono text-sm"
              />
            </div>
          </div>

          {/* Status Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agent Status
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsActive(true)
                  onUpdate(node.id, { ...node.data, isActive: true })
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  isActive
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Available
              </button>
              <button
                onClick={() => {
                  setIsActive(false)
                  onUpdate(node.id, { ...node.data, isActive: false })
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  !isActive
                    ? 'bg-gray-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Unavailable
              </button>
            </div>
          </div>
        </CollapsibleSection>

        {/* === SECTION 2: Consultation Behavior === */}
        <CollapsibleSection 
          title="Consultation Behavior" 
          defaultOpen={false}
          icon={<span className="text-lg">💬</span>}
        >
          {/* Consultation Triggers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              When should this agent be consulted?
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={consultationTriggers.onSegmentStart}
                  onChange={(e) => {
                    setConsultationTriggers({
                      ...consultationTriggers,
                      onSegmentStart: e.target.checked
                    })
                  }}
                  onBlur={handleSave}
                  className="rounded border-gray-300 text-yellow-400 focus:ring-yellow-400"
                />
                <span className="text-sm text-gray-700">At segment start</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={consultationTriggers.onDemand}
                  onChange={(e) => {
                    setConsultationTriggers({
                      ...consultationTriggers,
                      onDemand: e.target.checked
                    })
                  }}
                  onBlur={handleSave}
                  className="rounded border-gray-300 text-yellow-400 focus:ring-yellow-400"
                />
                <span className="text-sm text-gray-700">On demand (orchestrator requests)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={consultationTriggers.onSegmentReview}
                  onChange={(e) => {
                    setConsultationTriggers({
                      ...consultationTriggers,
                      onSegmentReview: e.target.checked
                    })
                  }}
                  onBlur={handleSave}
                  className="rounded border-gray-300 text-yellow-400 focus:ring-yellow-400"
                />
                <span className="text-sm text-gray-700">During segment review</span>
              </label>
            </div>
          </div>

          {/* Consultation Depth */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Consultation Depth
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['quick', 'detailed', 'comprehensive'] as ConsultationDepth[]).map((depth) => (
                <button
                  key={depth}
                  onClick={() => {
                    setConsultationDepth(depth)
                    handleSave()
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    consultationDepth === depth
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {depth.charAt(0).toUpperCase() + depth.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Response Style */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response Style
            </label>
            <select
              value={responseStyle}
              onChange={(e) => {
                setResponseStyle(e.target.value as ResponseStyle)
                handleSave()
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            >
              <option value="directive">Directive (commands/instructions)</option>
              <option value="suggestive">Suggestive (recommendations)</option>
              <option value="analytical">Analytical (pros/cons)</option>
              <option value="reference_based">Reference-based (citations)</option>
            </select>
          </div>

          {/* Proactivity Level */}
          <Slider
            label="Proactivity Level"
            value={proactivityLevel}
            onChange={setProactivityLevel}
            min={0}
            max={100}
            minLabel="Wait for questions"
            maxLabel="Actively volunteers"
            valueFormatter={(v) => `${v}%`}
          />
        </CollapsibleSection>

        {/* === SECTION 3: Knowledge & Resources === */}
        <CollapsibleSection 
          title="Knowledge & Resources" 
          defaultOpen={false}
          icon={<span className="text-lg">📚</span>}
        >
          {/* Context Awareness */}
          <Slider
            label="Context Awareness"
            value={contextAwareness}
            onChange={setContextAwareness}
            min={0}
            max={100}
            minLabel="Minimal context"
            maxLabel="Full story context"
            valueFormatter={(v) => `${v}%`}
          />

          {/* Access Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Access Permissions
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={canAccessDraft}
                  onChange={(e) => {
                    setCanAccessDraft(e.target.checked)
                    handleSave()
                  }}
                  className="rounded border-gray-300 text-yellow-400 focus:ring-yellow-400"
                />
                <span className="text-sm text-gray-700">Can access current draft</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={canAccessOtherAgents}
                  onChange={(e) => {
                    setCanAccessOtherAgents(e.target.checked)
                    handleSave()
                  }}
                  className="rounded border-gray-300 text-yellow-400 focus:ring-yellow-400"
                />
                <span className="text-sm text-gray-700">Can consult other agents</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={canAccessExternalTools}
                  onChange={(e) => {
                    setCanAccessExternalTools(e.target.checked)
                    handleSave()
                  }}
                  className="rounded border-gray-300 text-yellow-400 focus:ring-yellow-400"
                />
                <span className="text-sm text-gray-700">Can access external tools</span>
              </label>
            </div>
          </div>

          {/* Connected Resources Placeholder */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <strong>Connected Resources:</strong> {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Connect knowledge nodes to this agent to expand its expertise.
            </p>
          </div>
        </CollapsibleSection>

        {/* === SECTION 4: Interaction Model === */}
        <CollapsibleSection 
          title="Interaction Model" 
          defaultOpen={false}
          icon={<span className="text-lg">⚙️</span>}
        >
          {/* Example Queries */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Example Queries (one per line)
            </label>
            <textarea
              value={exampleQueries}
              onChange={(e) => setExampleQueries(e.target.value)}
              onBlur={handleSave}
              maxLength={1000}
              placeholder="What's Sarah's typical speech pattern?&#10;How would she react to conflict?&#10;What are her core motivations?"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none font-mono text-sm"
            />
          </div>

          {/* Response Preferences */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Response Preferences
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={responsePreferences.includeExamples}
                  onChange={(e) => {
                    setResponsePreferences({
                      ...responsePreferences,
                      includeExamples: e.target.checked
                    })
                    handleSave()
                  }}
                  className="rounded border-gray-300 text-yellow-400 focus:ring-yellow-400"
                />
                <span className="text-sm text-gray-700">Include examples in responses</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={responsePreferences.citeSources}
                  onChange={(e) => {
                    setResponsePreferences({
                      ...responsePreferences,
                      citeSources: e.target.checked
                    })
                    handleSave()
                  }}
                  className="rounded border-gray-300 text-yellow-400 focus:ring-yellow-400"
                />
                <span className="text-sm text-gray-700">Cite sources and references</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={responsePreferences.showConfidence}
                  onChange={(e) => {
                    setResponsePreferences({
                      ...responsePreferences,
                      showConfidence: e.target.checked
                    })
                    handleSave()
                  }}
                  className="rounded border-gray-300 text-yellow-400 focus:ring-yellow-400"
                />
                <span className="text-sm text-gray-700">Show confidence levels</span>
              </label>
            </div>
          </div>

          {/* Offer Alternatives */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Offer Alternatives
            </label>
            <select
              value={responsePreferences.offerAlternatives}
              onChange={(e) => {
                setResponsePreferences({
                  ...responsePreferences,
                  offerAlternatives: e.target.value as 'always' | 'when_relevant' | 'no'
                })
                handleSave()
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            >
              <option value="always">Always offer alternatives</option>
              <option value="when_relevant">When relevant</option>
              <option value="no">Never offer alternatives</option>
            </select>
          </div>
        </CollapsibleSection>

        {/* === SECTION 5: Advanced Settings === */}
        <CollapsibleSection 
          title="Advanced Settings" 
          defaultOpen={false}
          icon={<span className="text-lg">🔧</span>}
        >
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Model
            </label>
            <select
              value={modelSelection}
              onChange={(e) => {
                setModelSelection(e.target.value)
                handleSave()
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            >
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Recommended)</option>
              <option value="claude-3-opus">Claude 3 Opus (Most Capable)</option>
              <option value="claude-3-haiku">Claude 3 Haiku (Fastest)</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </div>

          {/* Expert Personality */}
          <Slider
            label="Expert Personality"
            value={expertPersonality}
            onChange={setExpertPersonality}
            min={0}
            max={100}
            minLabel="Formal & academic"
            maxLabel="Casual & conversational"
            valueFormatter={(v) => `${v}%`}
          />

          {/* Temperature */}
          <Slider
            label="Creativity (Temperature)"
            value={temperature}
            onChange={setTemperature}
            min={0}
            max={1}
            step={0.1}
            minLabel="Precise & consistent"
            maxLabel="Creative & varied"
            valueFormatter={(v) => v.toFixed(1)}
          />

          {/* Response Length Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response Length Limit
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['brief', 'moderate', 'detailed', 'unlimited'] as ResponseLengthLimit[]).map((limit) => (
                <button
                  key={limit}
                  onClick={() => {
                    setResponseLengthLimit(limit)
                    handleSave()
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    responseLengthLimit === limit
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {limit.charAt(0).toUpperCase() + limit.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Token Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Budget per Consultation
            </label>
            <input
              type="number"
              value={tokenBudget}
              onChange={(e) => setTokenBudget(parseInt(e.target.value) || 4000)}
              onBlur={handleSave}
              min={500}
              max={100000}
              step={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
            <div className="mt-2 text-xs text-gray-600">
              Estimated usage: <strong>{estimatedTokenUsage.toLocaleString()}</strong> / {tokenBudget.toLocaleString()} tokens
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div 
                  className="bg-yellow-400 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min((estimatedTokenUsage / tokenBudget) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Max Consultations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Consultations per Session (optional)
            </label>
            <input
              type="number"
              value={maxConsultations}
              onChange={(e) => setMaxConsultations(e.target.value)}
              onBlur={handleSave}
              min={1}
              placeholder="Unlimited"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave empty for unlimited consultations
            </p>
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer with Delete Button */}
      <div className="p-6 border-t border-gray-200">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Agent
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 text-center">Delete this agent and all its settings?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

