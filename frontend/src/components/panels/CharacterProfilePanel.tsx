'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Node } from 'reactflow'
import { CharacterNodeData, CharacterRole, Character, CharacterVisibility } from '@/types/nodes'
import { getAccessibleCharacters, searchCharacters, createCharacter, updateCharacter } from '@/lib/characters'

// ============================================================================
// TYPES
// ============================================================================

interface CharacterProfilePanelProps {
  node: Node<CharacterNodeData>
  onUpdate: (nodeId: string, newData: CharacterNodeData) => void
  onDelete: (nodeId: string) => void
  userId: string
  storyId: string
  embedded?: boolean
}

type ProfileTab = 'overview' | 'psychology' | 'history' | 'relationships' | 'physical' | 'documents'

const CHARACTER_ROLES: CharacterRole[] = ['Main', 'Active', 'Included', 'Involved', 'Passive']
const VISIBILITY_OPTIONS: CharacterVisibility[] = ['private', 'shared', 'public']

// Emotional traits for radar chart (placeholder data)
const EMOTIONAL_TRAITS = [
  { key: 'openness', label: 'Openness', color: '#8B5CF6' },
  { key: 'conscientiousness', label: 'Conscientiousness', color: '#3B82F6' },
  { key: 'extraversion', label: 'Extraversion', color: '#10B981' },
  { key: 'agreeableness', label: 'Agreeableness', color: '#F59E0B' },
  { key: 'neuroticism', label: 'Neuroticism', color: '#EF4444' },
]

// ============================================================================
// ICONS
// ============================================================================

const TabIcons = {
  overview: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  psychology: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  history: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  relationships: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  physical: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  documents: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Valid MBTI types for validation
const VALID_MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
]

// Check if a string is a valid MBTI type
function isValidMBTI(type: string | undefined): boolean {
  if (!type) return false
  return VALID_MBTI_TYPES.includes(type.toUpperCase())
}

// Derive MBTI-style type from Big Five traits
function deriveMBTIType(traits: Record<string, number>): string {
  const e = traits.extraversion ?? 50
  const a = traits.agreeableness ?? 50
  const c = traits.conscientiousness ?? 50
  const o = traits.openness ?? 50
  
  // E/I - Extraversion vs Introversion
  const ei = e >= 50 ? 'E' : 'I'
  // S/N - Sensing vs Intuition (mapped from Openness)
  const sn = o >= 50 ? 'N' : 'S'
  // T/F - Thinking vs Feeling (mapped from Agreeableness)
  const tf = a >= 50 ? 'F' : 'T'
  // J/P - Judging vs Perceiving (mapped from Conscientiousness)
  const jp = c >= 50 ? 'J' : 'P'
  
  return `${ei}${sn}${tf}${jp}`
}

// Get MBTI description
function getMBTIDescription(type: string): string {
  const descriptions: Record<string, string> = {
    'INTJ': 'The Architect',
    'INTP': 'The Thinker',
    'ENTJ': 'The Commander',
    'ENTP': 'The Debater',
    'INFJ': 'The Advocate',
    'INFP': 'The Mediator',
    'ENFJ': 'The Protagonist',
    'ENFP': 'The Campaigner',
    'ISTJ': 'The Logistician',
    'ISFJ': 'The Defender',
    'ESTJ': 'The Executive',
    'ESFJ': 'The Consul',
    'ISTP': 'The Virtuoso',
    'ISFP': 'The Adventurer',
    'ESTP': 'The Entrepreneur',
    'ESFP': 'The Entertainer',
  }
  return descriptions[type] || 'Unique Type'
}

function EmotionalRadarChart({ traits, personalityType }: { traits: Record<string, number>; personalityType?: string }) {
  const size = 280
  const center = size / 2
  const radius = 90
  const angleStep = (2 * Math.PI) / EMOTIONAL_TRAITS.length
  
  // Check if personalityType is a valid MBTI code or a custom description
  const hasValidMBTI = isValidMBTI(personalityType)
  const mbtiType = hasValidMBTI ? personalityType!.toUpperCase() : deriveMBTIType(traits)
  const mbtiDescription = hasValidMBTI ? getMBTIDescription(mbtiType) : getMBTIDescription(mbtiType)
  
  // If there's a custom personality description (not MBTI), show it separately
  const customDescription = personalityType && !hasValidMBTI ? personalityType : null
  
  // Calculate points for the radar
  const points = EMOTIONAL_TRAITS.map((trait, i) => {
    const value = traits[trait.key] ?? 50
    const normalizedValue = (value / 100) * radius
    const angle = i * angleStep - Math.PI / 2
    return {
      x: center + normalizedValue * Math.cos(angle),
      y: center + normalizedValue * Math.sin(angle),
      labelX: center + (radius + 35) * Math.cos(angle),
      labelY: center + (radius + 35) * Math.sin(angle),
      trait,
      value,
      angle,
    }
  })
  
  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
  
  // Generate unique gradient ID
  const gradientId = `radar-gradient-${Math.random().toString(36).substr(2, 9)}`
  
  return (
    <div className="flex flex-col items-center py-2">
      {/* MBTI Type Badge */}
      <div className="flex flex-col items-center gap-2 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex">
            {mbtiType.split('').map((letter, i) => (
              <div
                key={i}
                className="w-9 h-9 flex items-center justify-center text-lg font-bold rounded-lg shadow-sm border"
                style={{
                  backgroundColor: i === 0 ? '#8B5CF6' : i === 1 ? '#3B82F6' : i === 2 ? '#10B981' : '#F59E0B',
                  color: 'white',
                  marginLeft: i > 0 ? '-2px' : 0,
                }}
              >
                {letter}
              </div>
            ))}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-gray-800">{mbtiDescription}</div>
            <div className="text-xs text-gray-500">
              {customDescription ? 'Derived from traits' : 'Personality Type'}
            </div>
          </div>
        </div>
        
        {/* Custom personality description if different from MBTI */}
        {customDescription && (
          <div className="text-center px-4 py-2 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
            <div className="text-xs text-gray-500 mb-0.5">Character Profile</div>
            <div className="text-sm font-medium text-gray-700 italic">{customDescription}</div>
          </div>
        )}
      </div>
      
      {/* Radar Chart */}
      <svg width={size} height={size} className="overflow-visible">
        <defs>
          {/* Gradient for the polygon fill */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.3" />
          </linearGradient>
          
          {/* Glow filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background pentagon shapes */}
        {[0.25, 0.5, 0.75, 1].map((scale) => {
          const bgPoints = EMOTIONAL_TRAITS.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2
            return `${center + radius * scale * Math.cos(angle)},${center + radius * scale * Math.sin(angle)}`
          }).join(' ')
          return (
            <polygon
              key={scale}
              points={bgPoints}
              fill="none"
              stroke={scale === 1 ? '#D1D5DB' : '#E5E7EB'}
              strokeWidth={scale === 1 ? 1.5 : 1}
              strokeDasharray={scale < 1 ? '4,4' : undefined}
            />
          )
        })}
        
        {/* Axis lines with gradient */}
        {EMOTIONAL_TRAITS.map((trait, i) => {
          const angle = i * angleStep - Math.PI / 2
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + radius * Math.cos(angle)}
              y2={center + radius * Math.sin(angle)}
              stroke={trait.color}
              strokeWidth={1}
              strokeOpacity={0.3}
            />
          )
        })}
        
        {/* Data polygon with gradient */}
        <path
          d={pathData}
          fill={`url(#${gradientId})`}
          stroke="url(#radar-stroke)"
          strokeWidth={2.5}
          filter="url(#glow)"
        />
        
        {/* Animated stroke gradient */}
        <defs>
          <linearGradient id="radar-stroke" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="25%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="75%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
        </defs>
        
        {/* Data points with individual colors */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Outer glow */}
            <circle
              cx={p.x}
              cy={p.y}
              r={8}
              fill={p.trait.color}
              fillOpacity={0.2}
            />
            {/* Inner dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={5}
              fill={p.trait.color}
              stroke="white"
              strokeWidth={2}
            />
          </g>
        ))}
        
        {/* Labels - positioned outside with full text */}
        {points.map((p, i) => {
          // Adjust text anchor based on position
          const isLeft = p.labelX < center - 10
          const isRight = p.labelX > center + 10
          const textAnchor = isLeft ? 'end' : isRight ? 'start' : 'middle'
          
          return (
            <g key={i}>
              <text
                x={p.labelX}
                y={p.labelY - 6}
                textAnchor={textAnchor}
                className="text-xs font-medium"
                fill={p.trait.color}
              >
                {p.trait.label}
              </text>
              <text
                x={p.labelX}
                y={p.labelY + 8}
                textAnchor={textAnchor}
                className="text-[10px] font-semibold"
                fill="#374151"
              >
                {p.value}%
              </text>
            </g>
          )
        })}
      </svg>
      
      {/* Trait Legend Cards */}
      <div className="grid grid-cols-5 gap-1 mt-4 w-full max-w-md">
        {EMOTIONAL_TRAITS.map((trait) => {
          const value = traits[trait.key] ?? 50
          const level = value >= 75 ? 'High' : value >= 50 ? 'Moderate' : value >= 25 ? 'Low' : 'Very Low'
          return (
            <div
              key={trait.key}
              className="flex flex-col items-center p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div
                className="w-3 h-3 rounded-full mb-1"
                style={{ backgroundColor: trait.color }}
              />
              <div className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                {trait.label.slice(0, 1)}
              </div>
              <div className="text-[9px] text-gray-500">{level}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProfileSection({ title, children, icon, actions }: { 
  title: string
  children: React.ReactNode
  icon?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-500">{icon}</span>}
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {actions}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

function PlaceholderCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
        {icon}
      </div>
      <h4 className="text-sm font-medium text-gray-700 mb-1">{title}</h4>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  )
}

function StatBadge({ label, value, color = 'gray' }: { label: string; value: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    purple: 'bg-purple-100 text-purple-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
  }
  
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</span>
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClasses[color]}`}>
        {value}
      </span>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CharacterProfilePanel({ 
  node, 
  onUpdate, 
  onDelete, 
  userId, 
  storyId, 
  embedded = false 
}: CharacterProfilePanelProps) {
  // State
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')
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
  const [isRetryingPortrait, setIsRetryingPortrait] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Extended character data - loads from node.data.attributes
  const getDefaultCharacterData = () => ({
    // Psychology
    emotionalTraits: {
      openness: 50,
      conscientiousness: 50,
      extraversion: 50,
      agreeableness: 50,
      neuroticism: 50,
    },
    personalityType: '',
    coreMotivation: '',
    fears: [] as string[],
    desires: [] as string[],
    
    // Physical
    age: '',
    height: '',
    weight: '',
    eyeColor: '',
    hairColor: '',
    distinguishingFeatures: '',
    healthConditions: [] as string[],
    
    // History
    birthplace: '',
    occupation: '',
    education: '',
    keyEvents: [] as { year: string; event: string }[],
    
    // Relationships
    relationships: [] as { characterId: string; type: string; description: string }[],
    
    // Documents
    attachedFiles: [] as { name: string; type: string; url: string }[],
    notes: '',
  })
  
  const [characterData, setCharacterData] = useState(getDefaultCharacterData())

  // Serialize attributes for deep comparison in useEffect
  const attributesJson = useMemo(
    () => JSON.stringify(node.data.attributes || {}),
    [node.data.attributes]
  )
  
  // Sync state when node changes OR when attributes are updated
  useEffect(() => {
    console.log('🔄 [CharacterProfile] useEffect triggered, node.id:', node.id)
    console.log('📦 [CharacterProfile] Raw attributes:', node.data.attributes)
    
    setName(node.data.label || '')
    setBio(node.data.bio || '')
    setRole(node.data.role || '')
    setVisibility(node.data.visibility || 'private')
    setPhotoUrl((node.data.photoUrl || node.data.image || '') as string)
    setShowBrowse(false)
    setIsEditing(false)
    
    // Reset to defaults first, then load from attributes
    const defaults = getDefaultCharacterData()
    if (node.data.attributes) {
      const attrs = node.data.attributes as any
      console.log('📦 [CharacterProfile] Loading attributes:', attrs)
      console.log('📊 [CharacterProfile] emotionalTraits:', attrs.emotionalTraits)
      
      // Build emotionalTraits from either nested object OR top-level fields
      const emotionalTraits = {
        ...defaults.emotionalTraits,
        ...(attrs.emotionalTraits || {}),
        // Also check top-level (in case backend sends flat structure)
        ...(attrs.openness !== undefined ? { openness: attrs.openness } : {}),
        ...(attrs.conscientiousness !== undefined ? { conscientiousness: attrs.conscientiousness } : {}),
        ...(attrs.extraversion !== undefined ? { extraversion: attrs.extraversion } : {}),
        ...(attrs.agreeableness !== undefined ? { agreeableness: attrs.agreeableness } : {}),
        ...(attrs.neuroticism !== undefined ? { neuroticism: attrs.neuroticism } : {}),
      }
      console.log('📊 [CharacterProfile] Merged emotionalTraits:', emotionalTraits)
      
      setCharacterData({
        ...defaults,
        ...attrs,
        emotionalTraits,
      })
    } else {
      console.log('📦 [CharacterProfile] No attributes, using defaults')
      setCharacterData(defaults)
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [node.id, attributesJson]) // Use serialized JSON for deep comparison

  const isGeneratingImage = !!(node.data as any)?.isGeneratingImage
  const imageGenerationError = (node.data as any)?.imageGenerationError as string | undefined
  const canRetryPortrait = !!node.data.characterId && !!userId && !!storyId && !isGeneratingImage

  // Handlers
  const handleRetryPortrait = async () => {
    if (!canRetryPortrait) return
    try {
      setIsRetryingPortrait(true)
      const nextData: any = {
        ...node.data,
        isGeneratingImage: true,
        imageGenerationError: undefined,
        image: undefined,
        photoUrl: undefined,
      }
      onUpdate(node.id, nextData)

      await fetch('/api/node/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          storyId,
          userId,
          updates: { data: nextData },
        }),
      })

      const res = await fetch('/api/orchestrator/characters/portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId,
          userId,
          nodeId: node.id,
          characterId: node.data.characterId,
          force: true,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        console.error('Failed to queue portrait:', json?.error)
        alert(json?.error || 'Failed to queue portrait generation')
      }
    } catch (e) {
      console.error('Retry portrait failed:', e)
      alert('Failed to retry portrait')
    } finally {
      setIsRetryingPortrait(false)
    }
  }

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
    onUpdate(node.id, { ...node.data, label: newName, characterName: newName })
  }

  const handleBioChange = (newBio: string) => {
    setBio(newBio)
    onUpdate(node.id, { ...node.data, bio: newBio })
  }

  const handleRoleChange = (newRole: CharacterRole) => {
    setRole(newRole)
    onUpdate(node.id, { ...node.data, role: newRole })
  }

  const handleVisibilityChange = async (newVisibility: CharacterVisibility) => {
    setVisibility(newVisibility)
    onUpdate(node.id, { ...node.data, visibility: newVisibility })
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
      // Build the profile data from characterData state
      const profileData = {
        // Psychology
        emotionalTraits: characterData.emotionalTraits,
        personalityType: characterData.personalityType,
        coreMotivation: characterData.coreMotivation,
        fears: characterData.fears,
        desires: characterData.desires,
        // Physical
        age: characterData.age,
        height: characterData.height,
        weight: characterData.weight,
        eyeColor: characterData.eyeColor,
        hairColor: characterData.hairColor,
        distinguishingFeatures: characterData.distinguishingFeatures,
        healthConditions: characterData.healthConditions,
        // History
        birthplace: characterData.birthplace,
        occupation: characterData.occupation,
        education: characterData.education,
        keyEvents: characterData.keyEvents,
        // Relationships
        relationships: characterData.relationships,
        // Documents
        attachedFiles: characterData.attachedFiles,
        notes: characterData.notes,
      }
      
      // Update the canvas node with all data
      onUpdate(node.id, { 
        ...node.data, 
        label: name,
        characterName: name,
        bio,
        photoUrl,
        image: photoUrl,
        role: role || undefined,
        visibility,
        attributes: profileData,
      })
      
      if (node.data.characterId) {
        await updateCharacter(node.data.characterId, {
          name,
          bio,
          photo_url: photoUrl,
          visibility,
          role: role || undefined,
          attributes: profileData,
        })
        console.log('✅ Character updated with profile data')
      } else {
        const newCharacter = await createCharacter({
          name,
          bio,
          photo_url: photoUrl,
          visibility,
          role: role || undefined,
        })
        onUpdate(node.id, { ...node.data, characterId: newCharacter.id, attributes: profileData })
        console.log('✅ New character saved with profile data')
      }
    } catch (error) {
      console.error('Failed to save character:', error)
      alert('Failed to save character')
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB')
      return
    }

    setIsUploading(true)
    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setPhotoUrl(base64String)
        onUpdate(node.id, { ...node.data, photoUrl: base64String, image: base64String })
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
    onUpdate(node.id, { ...node.data, photoUrl: undefined, image: undefined })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this character?')) {
      onDelete(node.id)
    }
  }

  // Tab content renderers
  const renderOverviewTab = () => (
    <div className="space-y-4">
      {/* Bio Section */}
      <ProfileSection 
        title="Biography" 
        icon={TabIcons.overview}
        actions={
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
        }
      >
        {isEditing ? (
          <textarea
            value={bio}
            onChange={(e) => handleBioChange(e.target.value)}
            placeholder="Write the character's biography..."
            rows={8}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm resize-none"
          />
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {bio || <span className="text-gray-400 italic">No biography yet. Click Edit to add one.</span>}
          </p>
        )}
      </ProfileSection>
      
      {/* Core Traits */}
      <ProfileSection title="Core Traits" icon={TabIcons.psychology}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Motivation</label>
            <p className="text-sm text-gray-700 mt-1">
              {characterData.coreMotivation || <span className="text-gray-400">Not defined</span>}
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Personality</label>
            <p className="text-sm text-gray-700 mt-1">
              {characterData.personalityType || <span className="text-gray-400">Not assessed</span>}
            </p>
          </div>
        </div>
      </ProfileSection>
      
      {/* Role & Visibility */}
      <ProfileSection title="Story Settings" icon={TabIcons.documents}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Role</label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as CharacterRole)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm bg-white"
            >
              <option value="">Select role...</option>
              {CHARACTER_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => handleVisibilityChange(e.target.value as CharacterVisibility)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm bg-white"
            >
              {VISIBILITY_OPTIONS.map((v) => (
                <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </ProfileSection>
    </div>
  )

  const renderPsychologyTab = () => (
    <div className="space-y-4">
      {/* Emotional Radar */}
      <ProfileSection title="Emotional Profile" icon={TabIcons.psychology}>
        <EmotionalRadarChart 
          traits={characterData.emotionalTraits} 
          personalityType={characterData.personalityType}
        />
      </ProfileSection>
      
      {/* Fears & Desires */}
      <div className="grid grid-cols-2 gap-4">
        <ProfileSection title="Fears" icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }>
          {characterData.fears.length > 0 ? (
            <ul className="space-y-1">
              {characterData.fears.map((fear, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  {fear}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 italic">No fears defined</p>
          )}
        </ProfileSection>
        
        <ProfileSection title="Desires" icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        }>
          {characterData.desires.length > 0 ? (
            <ul className="space-y-1">
              {characterData.desires.map((desire, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  {desire}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 italic">No desires defined</p>
          )}
        </ProfileSection>
      </div>
      
      {/* Personality Profiler */}
      <PlaceholderCard
        title="AI Personality Profiler"
        description="Chat with the character to discover their personality traits through conversation"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        }
      />
    </div>
  )

  const renderHistoryTab = () => (
    <div className="space-y-4">
      {/* Background Info */}
      <ProfileSection title="Background" icon={TabIcons.history}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Birthplace</label>
            <p className="text-sm text-gray-700 mt-1">
              {characterData.birthplace || <span className="text-gray-400">Unknown</span>}
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Occupation</label>
            <p className="text-sm text-gray-700 mt-1">
              {characterData.occupation || <span className="text-gray-400">Unknown</span>}
            </p>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 uppercase tracking-wider">Education</label>
            <p className="text-sm text-gray-700 mt-1">
              {characterData.education || <span className="text-gray-400">Unknown</span>}
            </p>
          </div>
        </div>
      </ProfileSection>
      
      {/* Timeline */}
      <ProfileSection title="Life Timeline" icon={TabIcons.history}>
        {characterData.keyEvents.length > 0 ? (
          <div className="relative pl-4 border-l-2 border-purple-200 space-y-4">
            {characterData.keyEvents.map((event, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[21px] w-4 h-4 rounded-full bg-purple-500 border-2 border-white" />
                <div className="text-xs text-purple-600 font-medium">{event.year}</div>
                <div className="text-sm text-gray-700">{event.event}</div>
              </div>
            ))}
          </div>
        ) : (
          <PlaceholderCard
            title="No Timeline Events"
            description="Add key life events to build the character's history"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
          />
        )}
      </ProfileSection>
    </div>
  )

  const renderRelationshipsTab = () => (
    <div className="space-y-4">
      <PlaceholderCard
        title="Relationship Graph"
        description="Visualize connections between characters in your story"
        icon={TabIcons.relationships}
      />
      
      <ProfileSection title="Known Relationships" icon={TabIcons.relationships}>
        {characterData.relationships.length > 0 ? (
          <div className="space-y-3">
            {characterData.relationships.map((rel, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{rel.type}</div>
                  <div className="text-xs text-gray-500">{rel.description}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic text-center py-4">
            No relationships defined yet
          </p>
        )}
      </ProfileSection>
    </div>
  )

  const renderPhysicalTab = () => (
    <div className="space-y-4">
      {/* Basic Physical Stats */}
      <ProfileSection title="Physical Attributes" icon={TabIcons.physical}>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Age</label>
            <p className="text-sm text-gray-700 mt-1">{characterData.age || '—'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Height</label>
            <p className="text-sm text-gray-700 mt-1">{characterData.height || '—'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Weight</label>
            <p className="text-sm text-gray-700 mt-1">{characterData.weight || '—'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Eye Color</label>
            <p className="text-sm text-gray-700 mt-1">{characterData.eyeColor || '—'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Hair Color</label>
            <p className="text-sm text-gray-700 mt-1">{characterData.hairColor || '—'}</p>
          </div>
        </div>
      </ProfileSection>
      
      {/* Distinguishing Features */}
      <ProfileSection title="Distinguishing Features" icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      }>
        <p className="text-sm text-gray-700">
          {characterData.distinguishingFeatures || <span className="text-gray-400 italic">No features noted</span>}
        </p>
      </ProfileSection>
      
      {/* Medical Record */}
      <ProfileSection title="Medical Record" icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }>
        {characterData.healthConditions.length > 0 ? (
          <ul className="space-y-2">
            {characterData.healthConditions.map((condition, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {condition}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 italic">No medical conditions on record</p>
        )}
      </ProfileSection>
    </div>
  )

  const renderDocumentsTab = () => (
    <div className="space-y-4">
      {/* Attached Files */}
      <ProfileSection title="Attached Documents" icon={TabIcons.documents}>
        {characterData.attachedFiles.length > 0 ? (
          <div className="space-y-2">
            {characterData.attachedFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                  <div className="text-xs text-gray-500">{file.type}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <PlaceholderCard
            title="No Documents Attached"
            description="Add reference images, research notes, or other files"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
          />
        )}
      </ProfileSection>
      
      {/* Notes */}
      <ProfileSection title="Character Notes" icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      }>
        <textarea
          value={characterData.notes}
          onChange={(e) => setCharacterData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Add private notes about this character..."
          rows={6}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm resize-none"
        />
      </ProfileSection>
    </div>
  )

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverviewTab()
      case 'psychology': return renderPsychologyTab()
      case 'history': return renderHistoryTab()
      case 'relationships': return renderRelationshipsTab()
      case 'physical': return renderPhysicalTab()
      case 'documents': return renderDocumentsTab()
      default: return renderOverviewTab()
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {/* Hero Section with Portrait - Clean modern style, responsive */}
        <div className="p-4 sm:p-6 border-b border-gray-100 min-w-[320px]">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            {/* Large Portrait - responsive size */}
            <div className="flex-shrink-0 relative group mx-auto sm:mx-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={name}
                  className="w-28 h-28 sm:w-40 sm:h-40 rounded-xl object-cover border border-gray-200 shadow-sm"
                />
              ) : (
                <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              
              {/* Edit photo overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                title="Change photo"
              >
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            
            {/* Name and Info */}
            <div className="flex-1 min-w-0 py-1 text-center sm:text-left">
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="text-xl sm:text-2xl font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 w-full placeholder:text-gray-300 text-center sm:text-left"
                placeholder="Character Name"
              />
              
              {/* Badges */}
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 flex-wrap">
                {role && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                    {role}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-500 border border-gray-100">
                  {visibility}
                </span>
              </div>
              
              {/* Quick stats */}
              <div className="mt-3 sm:mt-4 flex flex-wrap justify-center sm:justify-start gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
                {characterData.age && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {characterData.age}
                  </span>
                )}
                {characterData.occupation && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {characterData.occupation}
                  </span>
                )}
                {characterData.personalityType && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    {characterData.personalityType}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Tab Navigation - horizontally scrollable */}
        <div className="px-3 sm:px-6 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide py-2 -mb-px">
            {(['overview', 'psychology', 'history', 'relationships', 'physical', 'documents'] as ProfileTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
              >
                {TabIcons[tab]}
                <span className="capitalize hidden xs:inline">{tab}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Tab Content - responsive padding */}
        <div className="p-3 sm:p-6 min-w-[320px]">
          {renderTabContent()}
        </div>
      </div>
      
      {/* Footer Actions - Fixed at bottom */}
      <div className="flex-shrink-0 p-4 bg-gray-50 border-t border-gray-100">
        <div className="flex gap-2">
          <button
            onClick={handleSaveCharacter}
            className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save Changes
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
            title="Delete character"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
