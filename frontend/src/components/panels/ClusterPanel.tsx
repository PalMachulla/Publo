'use client'

import { useState, useEffect, useMemo } from 'react'
import { Node, Edge } from 'reactflow'
import { ClusterNodeData, AgentSpecialization, ConsultationDepth, ResponseStyle, ResponseLengthLimit } from '@/types/nodes'
import { 
  PersonIcon, 
  ChatBubbleIcon, 
  BookmarkIcon, 
  MixIcon, 
  GearIcon 
} from '@radix-ui/react-icons'
import { 
  Input, 
  Textarea, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  Checkbox, 
  Slider, 
  Label,
  Button,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
  CollapsibleSection 
} from '@/components/ui'

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
      <div className="flex-1 overflow-y-auto px-6 py-4">
        
        {/* === SECTION 1: Identity & Status === */}
        <CollapsibleSection 
          title="Identity & Status" 
          defaultOpen={true}
          icon={<PersonIcon className="w-4 h-4 text-gray-600" />}
        >
          {/* Agent Name */}
          <div>
            <Label>Agent Name</Label>
            <Input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleSave}
              maxLength={100}
              placeholder="Enter agent name..."
            />
          </div>

          {/* Specialization */}
          <div>
            <Label>Specialization</Label>
            <Select
              value={specialization}
              onValueChange={(value) => {
                setSpecialization(value as AgentSpecialization)
                handleSave()
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select specialization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="character_voice">Character Voice</SelectItem>
                <SelectItem value="historical_accuracy">Historical Accuracy</SelectItem>
                <SelectItem value="genre_conventions">Genre Conventions</SelectItem>
                <SelectItem value="world_rules">World Rules</SelectItem>
                <SelectItem value="tone_style">Tone & Style</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSave}
              maxLength={500}
              placeholder="Describe what this agent specializes in..."
              rows={3}
            />
          </div>

          {/* Color Picker */}
          <div>
            <Label>Agent Color</Label>
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
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                onBlur={handleSave}
                placeholder="#9ca3af"
                pattern="^#[0-9A-Fa-f]{6}$"
                className="flex-1 font-mono"
              />
            </div>
          </div>

          {/* Status Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Agent Status</Label>
              <p className="text-xs text-gray-500 mt-0.5">
                {isActive ? 'Available for consultation' : 'Currently unavailable'}
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => {
                setIsActive(checked)
                onUpdate(node.id, { ...node.data, isActive: checked })
              }}
            />
          </div>
        </CollapsibleSection>

        {/* === SECTION 2: Consultation Behavior === */}
        <CollapsibleSection 
          title="Consultation Behavior" 
          defaultOpen={false}
          icon={<ChatBubbleIcon className="w-4 h-4 text-gray-600" />}
        >
          {/* Consultation Triggers */}
          <div>
            <Label className="mb-3">When should this agent be consulted?</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={consultationTriggers.onSegmentStart}
                  onCheckedChange={(checked) => {
                    setConsultationTriggers({
                      ...consultationTriggers,
                      onSegmentStart: checked as boolean
                    })
                    handleSave()
                  }}
                />
                <span className="text-sm text-gray-700">At segment start</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={consultationTriggers.onDemand}
                  onCheckedChange={(checked) => {
                    setConsultationTriggers({
                      ...consultationTriggers,
                      onDemand: checked as boolean
                    })
                    handleSave()
                  }}
                />
                <span className="text-sm text-gray-700">On demand (orchestrator requests)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={consultationTriggers.onSegmentReview}
                  onCheckedChange={(checked) => {
                    setConsultationTriggers({
                      ...consultationTriggers,
                      onSegmentReview: checked as boolean
                    })
                    handleSave()
                  }}
                />
                <span className="text-sm text-gray-700">During segment review</span>
              </label>
            </div>
          </div>

          {/* Consultation Depth */}
          <div>
            <Label>Consultation Depth</Label>
            <ToggleGroup
              type="single"
              value={consultationDepth}
              onValueChange={(value) => {
                if (value) {
                  setConsultationDepth(value as ConsultationDepth)
                  handleSave()
                }
              }}
              className="grid grid-cols-3"
            >
              <ToggleGroupItem value="quick">
                Quick
              </ToggleGroupItem>
              <ToggleGroupItem value="detailed">
                Detailed
              </ToggleGroupItem>
              <ToggleGroupItem value="comprehensive">
                Comprehensive
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Response Style */}
          <div>
            <Label>Response Style</Label>
            <Select
              value={responseStyle}
              onValueChange={(value) => {
                setResponseStyle(value as ResponseStyle)
                handleSave()
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="directive">Directive (commands/instructions)</SelectItem>
                <SelectItem value="suggestive">Suggestive (recommendations)</SelectItem>
                <SelectItem value="analytical">Analytical (pros/cons)</SelectItem>
                <SelectItem value="reference_based">Reference-based (citations)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Proactivity Level */}
          <Slider
            label="Proactivity Level"
            value={[proactivityLevel]}
            onValueChange={(value) => setProactivityLevel(value[0])}
            min={0}
            max={100}
            step={1}
            minLabel="Wait for questions"
            maxLabel="Actively volunteers"
            valueFormatter={(v) => `${v}%`}
          />
        </CollapsibleSection>

        {/* === SECTION 3: Knowledge & Resources === */}
        <CollapsibleSection 
          title="Knowledge & Resources" 
          defaultOpen={false}
          icon={<BookmarkIcon className="w-4 h-4 text-gray-600" />}
        >
          {/* Context Awareness */}
          <Slider
            label="Context Awareness"
            value={[contextAwareness]}
            onValueChange={(value) => setContextAwareness(value[0])}
            min={0}
            max={100}
            step={1}
            minLabel="Minimal context"
            maxLabel="Full story context"
            valueFormatter={(v) => `${v}%`}
          />

          {/* Access Permissions */}
          <div>
            <Label className="mb-3">Access Permissions</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={canAccessDraft}
                  onCheckedChange={(checked) => {
                    setCanAccessDraft(checked as boolean)
                    handleSave()
                  }}
                />
                <span className="text-sm text-gray-700">Can access current draft</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={canAccessOtherAgents}
                  onCheckedChange={(checked) => {
                    setCanAccessOtherAgents(checked as boolean)
                    handleSave()
                  }}
                />
                <span className="text-sm text-gray-700">Can consult other agents</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={canAccessExternalTools}
                  onCheckedChange={(checked) => {
                    setCanAccessExternalTools(checked as boolean)
                    handleSave()
                  }}
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
          icon={<MixIcon className="w-4 h-4 text-gray-600" />}
        >
          {/* Example Queries */}
          <div>
            <Label>Example Queries (one per line)</Label>
            <Textarea
              value={exampleQueries}
              onChange={(e) => setExampleQueries(e.target.value)}
              onBlur={handleSave}
              maxLength={1000}
              placeholder="What's Sarah's typical speech pattern?&#10;How would she react to conflict?&#10;What are her core motivations?"
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          {/* Response Preferences */}
          <div>
            <Label className="mb-3">Response Preferences</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={responsePreferences.includeExamples}
                  onCheckedChange={(checked) => {
                    setResponsePreferences({
                      ...responsePreferences,
                      includeExamples: checked as boolean
                    })
                    handleSave()
                  }}
                />
                <span className="text-sm text-gray-700">Include examples in responses</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={responsePreferences.citeSources}
                  onCheckedChange={(checked) => {
                    setResponsePreferences({
                      ...responsePreferences,
                      citeSources: checked as boolean
                    })
                    handleSave()
                  }}
                />
                <span className="text-sm text-gray-700">Cite sources and references</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={responsePreferences.showConfidence}
                  onCheckedChange={(checked) => {
                    setResponsePreferences({
                      ...responsePreferences,
                      showConfidence: checked as boolean
                    })
                    handleSave()
                  }}
                />
                <span className="text-sm text-gray-700">Show confidence levels</span>
              </label>
            </div>
          </div>

          {/* Offer Alternatives */}
          <div>
            <Label>Offer Alternatives</Label>
            <Select
              value={responsePreferences.offerAlternatives}
              onValueChange={(value) => {
                setResponsePreferences({
                  ...responsePreferences,
                  offerAlternatives: value as 'always' | 'when_relevant' | 'no'
                })
                handleSave()
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Always offer alternatives</SelectItem>
                <SelectItem value="when_relevant">When relevant</SelectItem>
                <SelectItem value="no">Never offer alternatives</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CollapsibleSection>

        {/* === SECTION 5: Advanced Settings === */}
        <CollapsibleSection 
          title="Advanced Settings" 
          defaultOpen={false}
          icon={<GearIcon className="w-4 h-4 text-gray-600" />}
        >
          {/* Model Selection */}
          <div>
            <Label>AI Model</Label>
            <Select
              value={modelSelection}
              onValueChange={(value) => {
                setModelSelection(value)
                handleSave()
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet (Recommended)</SelectItem>
                <SelectItem value="claude-3-opus">Claude 3 Opus (Most Capable)</SelectItem>
                <SelectItem value="claude-3-haiku">Claude 3 Haiku (Fastest)</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Expert Personality */}
          <Slider
            label="Expert Personality"
            value={[expertPersonality]}
            onValueChange={(value) => setExpertPersonality(value[0])}
            min={0}
            max={100}
            step={1}
            minLabel="Formal & academic"
            maxLabel="Casual & conversational"
            valueFormatter={(v) => `${v}%`}
          />

          {/* Temperature */}
          <Slider
            label="Creativity (Temperature)"
            value={[temperature]}
            onValueChange={(value) => setTemperature(value[0])}
            min={0}
            max={1}
            step={0.1}
            minLabel="Precise & consistent"
            maxLabel="Creative & varied"
            valueFormatter={(v) => v.toFixed(1)}
          />

          {/* Response Length Limit */}
          <div>
            <Label>Response Length Limit</Label>
            <ToggleGroup
              type="single"
              value={responseLengthLimit}
              onValueChange={(value) => {
                if (value) {
                  setResponseLengthLimit(value as ResponseLengthLimit)
                  handleSave()
                }
              }}
              className="grid grid-cols-2"
            >
              <ToggleGroupItem value="brief">
                Brief
              </ToggleGroupItem>
              <ToggleGroupItem value="moderate">
                Moderate
              </ToggleGroupItem>
              <ToggleGroupItem value="detailed">
                Detailed
              </ToggleGroupItem>
              <ToggleGroupItem value="unlimited">
                Unlimited
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Token Budget */}
          <div>
            <Label>Token Budget per Consultation</Label>
            <Input
              type="number"
              value={tokenBudget}
              onChange={(e) => setTokenBudget(parseInt(e.target.value) || 4000)}
              onBlur={handleSave}
              min={500}
              max={100000}
              step={500}
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
            <Label>Max Consultations per Session (optional)</Label>
            <Input
              type="number"
              value={maxConsultations}
              onChange={(e) => setMaxConsultations(e.target.value)}
              onBlur={handleSave}
              min={1}
              placeholder="Unlimited"
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
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Agent
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 text-center">Delete this agent and all its settings?</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

