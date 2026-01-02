/**
 * Librarian Agent Types
 * 
 * These types match the Supabase tables created in migration 018.
 * Used for displaying section cards and coherency issues in the UI.
 * 
 * The Librarian maintains story coherency by tracking:
 * - Section Cards: Per-chapter intelligence (summary, characters, dependencies)
 * - Characters: Character registry with medium depth
 * - Places: Location registry
 * - Events: Plot event timeline
 * - Coherency Issues: Flagged issues with links to problematic text
 */

// ============================================================================
// SECTION CARD
// ============================================================================

/**
 * Per-section intelligence card.
 * 
 * This is the primary data structure displayed in the UI.
 * Each section (chapter, scene, etc.) has a card that shows:
 * - Summary of what happens
 * - Characters present
 * - Coherency issues (if any)
 */
export interface SectionCard {
  id: string
  documentSectionId?: string
  nodeId: string
  structureItemId: string
  sectionName: string
  
  // Content summary
  summary?: string
  keyMoments: string[]
  
  // Entity tracking (IDs referencing other tables)
  charactersPresent: string[]
  placesVisited: string[]
  eventsOccurring: string[]
  
  // New/minor characters introduced in this section (not yet full Character nodes)
  newCharactersIntroduced?: NewCharacterMention[]
  
  // Cross-chapter connections
  dependencies: Dependency[]
  hooks: NarrativeHook[]
  
  // Writer guidance
  constraints: Constraint[]
  mustInclude: string[]
  mustNotInclude: string[]
  
  // Metadata
  wordCount: number
  povCharacterId?: string
  timeframe?: string
  mood?: string
  analyzed: boolean
  analyzedAt?: string
  
  // For UI: loaded coherency issues
  issues?: CoherencyIssue[]
  
  createdAt: string
  updatedAt: string
}

export interface Dependency {
  type: 'requires' | 'references' | 'builds_on' | 'contradicts_if'
  sectionId: string
  description: string
}

export interface NarrativeHook {
  type: 'foreshadowing' | 'callback' | 'plant' | 'payoff'
  targetSectionId: string
  element: string
}

export interface Constraint {
  type: 'character_alive' | 'item_possession' | 'location' | 'knowledge' | 'custom'
  description: string
}

// ============================================================================
// CHARACTER
// ============================================================================

export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'minor'
export type CharacterStatus = 'active' | 'deceased' | 'unknown' | 'transformed'

/**
 * Character with medium depth.
 * 
 * Includes basic info, personality, relationships, and appearance tracking.
 */
export interface StoryCharacter {
  id: string
  nodeId: string
  name: string
  aliases: string[]
  description?: string
  role: CharacterRole
  traits: string[]
  arc?: string
  motivations: string[]
  relationships: CharacterRelationship[]
  firstAppearanceSectionId?: string
  appearances: string[]
  voiceNotes?: string
  secrets: string[]
  status: CharacterStatus
  statusChangedIn?: string
  /** Photo URL for character avatar */
  photoUrl?: string
  createdAt: string
  updatedAt: string
}

/**
 * New/minor character introduced in a section.
 * These are characters mentioned but not yet full Character nodes.
 * Can be promoted to full characters later.
 */
export interface NewCharacterMention {
  /** Name of the character (e.g., "The Landlord", "A Fan") */
  name: string
  /** Brief description/role in the scene */
  description?: string
  /** Whether this has been promoted to a full Character */
  promoted?: boolean
  /** ID of the Character node if promoted */
  promotedToId?: string
}

export interface CharacterRelationship {
  characterId: string
  type: 'friend' | 'enemy' | 'family' | 'romantic' | 'rival' | 'mentor' | 'other'
  description: string
}

// ============================================================================
// PLACE
// ============================================================================

export type PlaceType = 'interior' | 'exterior' | 'city' | 'country' | 'realm' | 'vehicle' | 'other'

/**
 * Location in the story world.
 */
export interface StoryPlace {
  id: string
  nodeId: string
  name: string
  type: PlaceType
  description?: string
  atmosphere?: string
  parentPlaceId?: string
  firstAppearanceSectionId?: string
  appearances: string[]
  significance?: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// EVENT
// ============================================================================

export type EventType = 
  | 'plot_point' 
  | 'revelation' 
  | 'conflict' 
  | 'resolution' 
  | 'death' 
  | 'transformation' 
  | 'meeting' 
  | 'other'

/**
 * Plot event in the story timeline.
 */
export interface StoryEvent {
  id: string
  nodeId: string
  name: string
  description: string
  type: EventType
  sectionId: string
  charactersInvolved: string[]
  placeId?: string
  timelinePosition?: number
  storyTime?: string
  consequences?: string
  dependsOn: string[]
  enables: string[]
  createdAt: string
  updatedAt: string
}

// ============================================================================
// COHERENCY ISSUE
// ============================================================================

export type CoherencyIssueType =
  | 'character_inconsistency'   // Character says/does something out of character
  | 'timeline_contradiction'    // Event order doesn't make sense
  | 'knowledge_violation'       // Character knows something they shouldn't
  | 'location_error'            // Character is in wrong place
  | 'item_possession_error'     // Character has/uses item they don't have
  | 'death_resurrection'        // Dead character appears alive
  | 'name_inconsistency'        // Character name spelled differently
  | 'relationship_error'        // Relationship described incorrectly
  | 'other'

export type CoherencyIssueSeverity = 'info' | 'warning' | 'error'
export type CoherencyIssueStatus = 'open' | 'resolved' | 'ignored'

/**
 * Flagged coherency issue on a section card.
 * 
 * Links to the problematic text in the content for easy navigation.
 */
export interface CoherencyIssue {
  id: string
  sectionCardId: string
  type: CoherencyIssueType
  severity: CoherencyIssueSeverity
  description: string
  startOffset?: number
  endOffset?: number
  problematicText?: string
  expectedValue?: string
  sourceSectionId?: string
  status: CoherencyIssueStatus
  resolvedAt?: string
  resolutionNote?: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// UI DISPLAY TYPES
// ============================================================================

/**
 * Section card with resolved entities for display.
 * 
 * Instead of just IDs, this includes the actual character/place objects
 * for easy display in the UI.
 */
export interface SectionCardDisplay extends SectionCard {
  characters: StoryCharacter[]
  places: StoryPlace[]
  events: StoryEvent[]
}

/**
 * Summary stats for the story.
 */
export interface StoryStats {
  totalSections: number
  analyzedSections: number
  totalCharacters: number
  totalPlaces: number
  totalEvents: number
  openIssues: number
  totalWordCount: number
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert snake_case database row to camelCase type.
 */
export function dbRowToSectionCard(row: Record<string, unknown>): SectionCard {
  return {
    id: row.id as string,
    documentSectionId: row.document_section_id as string | undefined,
    nodeId: row.node_id as string,
    structureItemId: row.structure_item_id as string,
    sectionName: row.section_name as string,
    summary: row.summary as string | undefined,
    keyMoments: parseJsonArray(row.key_moments),
    charactersPresent: parseJsonArray(row.characters_present),
    placesVisited: parseJsonArray(row.places_visited),
    eventsOccurring: parseJsonArray(row.events_occurring),
    newCharactersIntroduced: parseJsonArray(row.new_characters_introduced),
    dependencies: parseJsonArray(row.dependencies),
    hooks: parseJsonArray(row.hooks),
    constraints: parseJsonArray(row.constraints),
    mustInclude: parseJsonArray(row.must_include),
    mustNotInclude: parseJsonArray(row.must_not_include),
    wordCount: row.word_count as number || 0,
    povCharacterId: row.pov_character_id as string | undefined,
    timeframe: row.timeframe as string | undefined,
    mood: row.mood as string | undefined,
    analyzed: row.analyzed as boolean || false,
    analyzedAt: row.analyzed_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function dbRowToCharacter(row: Record<string, unknown>): StoryCharacter {
  return {
    id: row.id as string,
    nodeId: row.node_id as string,
    name: row.name as string,
    aliases: parseJsonArray(row.aliases),
    description: row.description as string | undefined,
    role: row.role as CharacterRole || 'supporting',
    traits: parseJsonArray(row.traits),
    arc: row.arc as string | undefined,
    motivations: parseJsonArray(row.motivations),
    relationships: parseJsonArray(row.relationships),
    firstAppearanceSectionId: row.first_appearance_section_id as string | undefined,
    appearances: parseJsonArray(row.appearances),
    voiceNotes: row.voice_notes as string | undefined,
    secrets: parseJsonArray(row.secrets),
    status: row.status as CharacterStatus || 'active',
    statusChangedIn: row.status_changed_in as string | undefined,
    photoUrl: row.photo_url as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function dbRowToCoherencyIssue(row: Record<string, unknown>): CoherencyIssue {
  return {
    id: row.id as string,
    sectionCardId: row.section_card_id as string,
    type: row.type as CoherencyIssueType,
    severity: row.severity as CoherencyIssueSeverity || 'warning',
    description: row.description as string,
    startOffset: row.start_offset as number | undefined,
    endOffset: row.end_offset as number | undefined,
    problematicText: row.problematic_text as string | undefined,
    expectedValue: row.expected_value as string | undefined,
    sourceSectionId: row.source_section_id as string | undefined,
    status: row.status as CoherencyIssueStatus || 'open',
    resolvedAt: row.resolved_at as string | undefined,
    resolutionNote: row.resolution_note as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function parseJsonArray<T>(value: unknown): T[] {
  if (!value) return []
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T[]
    } catch {
      return []
    }
  }
  return []
}

