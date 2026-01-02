/**
 * useSectionCards Hook
 * 
 * Loads and manages section cards from the Librarian Agent.
 * Section cards contain per-chapter intelligence:
 * - Summary of what happens
 * - Characters present
 * - Coherency issues
 * 
 * Usage:
 *   const { cards, issues, isLoading, refreshCards } = useSectionCards(nodeId)
 * 
 * The hook automatically refreshes when content is written.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  SectionCard,
  StoryCharacter,
  CoherencyIssue,
  SectionCardDisplay,
  StoryStats,
  dbRowToSectionCard,
  dbRowToCharacter,
  dbRowToCoherencyIssue,
} from '@/types/librarian'

interface UseSectionCardsOptions {
  /** Story structure node ID */
  nodeId: string | null
  /** Auto-refresh when content changes */
  autoRefresh?: boolean
  /** Refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number
}

interface UseSectionCardsResult {
  /** All section cards for the node */
  cards: SectionCard[]
  /** Cards with resolved entities (for display) */
  cardsWithDetails: SectionCardDisplay[]
  /** All characters in the story */
  characters: StoryCharacter[]
  /** Open coherency issues */
  openIssues: CoherencyIssue[]
  /** Story statistics */
  stats: StoryStats | null
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Refresh cards from database */
  refreshCards: () => Promise<void>
  /** Get card for a specific section */
  getCardForSection: (sectionId: string) => SectionCard | undefined
  /** Get issues for a specific section */
  getIssuesForSection: (sectionId: string) => CoherencyIssue[]
}

export function useSectionCards(options: UseSectionCardsOptions): UseSectionCardsResult {
  const { nodeId, autoRefresh = false, refreshInterval = 30000 } = options
  
  const [cards, setCards] = useState<SectionCard[]>([])
  const [characters, setCharacters] = useState<StoryCharacter[]>([])
  const [openIssues, setOpenIssues] = useState<CoherencyIssue[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const supabaseRef = useRef(createClient())
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // ========================================================================
  // FETCH SECTION CARDS
  // ========================================================================
  
  const fetchCards = useCallback(async () => {
    if (!nodeId) {
      setCards([])
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const supabase = supabaseRef.current
      
      // Fetch section cards
      const { data: cardRows, error: cardError } = await supabase
        .from('section_cards')
        .select('*')
        .eq('node_id', nodeId)
        .order('structure_item_id')
      
      if (cardError) throw cardError
      
      const loadedCards = (cardRows || []).map(dbRowToSectionCard)
      setCards(loadedCards)
      
      // Fetch characters from story_characters table (Librarian's registry)
      const { data: charRows, error: charError } = await supabase
        .from('story_characters')
        .select('*')
        .eq('node_id', nodeId)
        .order('name')
      
      if (charError) throw charError
      
      const loadedChars = (charRows || []).map(dbRowToCharacter)
      
      // Get the story_id from the structure node to find all characters in this story
      const { data: structureNode } = await supabase
        .from('nodes')
        .select('story_id')
        .eq('id', nodeId)
        .single()
      
      const storyId = structureNode?.story_id
      console.log(`📚 [useSectionCards] Story ID for node ${nodeId}: ${storyId}`)
      
      if (storyId) {
        // Fetch ALL character nodes for this story (not just connected ones)
        const { data: charNodes } = await supabase
          .from('nodes')
          .select('id, data, type')
          .eq('story_id', storyId)
          .eq('type', 'character')
        
        console.log(`📚 [useSectionCards] Found ${charNodes?.length || 0} character nodes in story:`, 
          charNodes?.map(n => (n.data as any)?.name))
        
        // Add character node data to loadedChars
        for (const charNode of charNodes || []) {
          const nodeData = charNode.data as { name?: string; photo_url?: string; role?: string }
          if (nodeData?.name) {
            // Check if already exists (from story_characters table)
            const existing = loadedChars.find(c => 
              c.name.toLowerCase() === nodeData.name!.toLowerCase()
            )
            if (existing) {
              existing.photoUrl = nodeData.photo_url || existing.photoUrl
            } else {
              // Add as new character from canvas node
              loadedChars.push({
                id: charNode.id,
                nodeId: charNode.id,
                name: nodeData.name,
                aliases: [],
                role: (nodeData.role as any) || 'supporting',
                traits: [],
                motivations: [],
                relationships: [],
                appearances: [],
                secrets: [],
                status: 'active',
                photoUrl: nodeData.photo_url,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
            }
          }
        }
      }
      
      console.log(`📚 [useSectionCards] Final characters list:`, loadedChars.map(c => ({ name: c.name, photoUrl: c.photoUrl })))
      
      setCharacters(loadedChars)
      
      // Fetch open issues
      if (loadedCards.length > 0) {
        const cardIds = loadedCards.map(c => c.id)
        
        const { data: issueRows, error: issueError } = await supabase
          .from('coherency_issues')
          .select('*')
          .in('section_card_id', cardIds)
          .eq('status', 'open')
          .order('severity', { ascending: false })
        
        if (issueError) throw issueError
        
        const loadedIssues = (issueRows || []).map(dbRowToCoherencyIssue)
        setOpenIssues(loadedIssues)
      } else {
        setOpenIssues([])
      }
      
      console.log(`📚 [useSectionCards] Loaded ${loadedCards.length} cards, ${loadedChars.length} characters, ${openIssues.length} issues`)
      
    } catch (err) {
      console.error('❌ [useSectionCards] Failed to load:', err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [nodeId])
  
  // ========================================================================
  // REALTIME SUBSCRIPTION
  // ========================================================================
  
  // Use ref to avoid infinite loops with fetchCards in subscription callback
  const fetchCardsRef = useRef(fetchCards)
  fetchCardsRef.current = fetchCards
  
  // Track if we're currently fetching to prevent duplicate calls
  const isFetchingRef = useRef(false)
  
  const debouncedFetch = useCallback(() => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    
    // Debounce multiple rapid updates
    setTimeout(() => {
      fetchCardsRef.current().finally(() => {
        isFetchingRef.current = false
      })
    }, 200)
  }, [])
  
  // Initial fetch - only when nodeId changes
  useEffect(() => {
    fetchCards()
  }, [nodeId]) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Auto-refresh interval
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshTimeoutRef.current = setInterval(debouncedFetch, refreshInterval)
      return () => {
        if (refreshTimeoutRef.current) {
          clearInterval(refreshTimeoutRef.current)
        }
      }
    }
  }, [autoRefresh, refreshInterval, debouncedFetch])
  
  // Real-time subscription - separate from fetch to avoid loops
  useEffect(() => {
    if (!nodeId) return
    
    const supabase = supabaseRef.current
    
    const cardsChannel = supabase
      .channel(`section_cards:${nodeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'section_cards',
          filter: `node_id=eq.${nodeId}`,
        },
        (payload) => {
          console.log('📚 [useSectionCards] Real-time card update:', payload.eventType)
          debouncedFetch()
        }
      )
      .subscribe()
    
    const charsChannel = supabase
      .channel(`story_characters:${nodeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'story_characters',
          filter: `node_id=eq.${nodeId}`,
        },
        (payload) => {
          console.log('📚 [useSectionCards] Real-time character update:', payload.eventType)
          debouncedFetch()
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(cardsChannel)
      supabase.removeChannel(charsChannel)
    }
  }, [nodeId, debouncedFetch])
  
  // ========================================================================
  // DERIVED DATA
  // ========================================================================
  
  // Helper to normalize names for comparison (handles quote variations, extra spaces)
  const normalizeName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/['"'"]/g, '') // Remove all quote variations
      .replace(/\s+/g, ' ')   // Normalize whitespace
      .trim()
  }
  
  // Cards with resolved entities
  const cardsWithDetails: SectionCardDisplay[] = cards.map(card => {
    // Resolve character names/IDs to character objects
    // The charactersPresent can contain either IDs (UUIDs) or names (strings)
    const resolvedCharacters = card.charactersPresent
      .map(charIdOrName => {
        // Try matching by ID first
        const byId = characters.find(c => c.id === charIdOrName)
        if (byId) return byId
        // Then try matching by normalized name (handles quote style differences)
        const normalizedSearch = normalizeName(charIdOrName)
        const byName = characters.find(c => 
          normalizeName(c.name) === normalizedSearch
        )
        return byName
      })
      .filter((c): c is StoryCharacter => c !== undefined)
    
    // Debug: log resolution for first card
    if (cards.indexOf(card) === 0 && card.charactersPresent.length > 0) {
      console.log(`📚 [useSectionCards] Card "${card.sectionName}" has charactersPresent:`, card.charactersPresent)
      console.log(`📚 [useSectionCards] Available characters:`, characters.map(c => c.name))
      console.log(`📚 [useSectionCards] Resolved to:`, resolvedCharacters.map(c => ({ name: c.name, photoUrl: c.photoUrl })))
    }
    
    // Get issues for this card
    const cardIssues = openIssues.filter(issue => issue.sectionCardId === card.id)
    
    return {
      ...card,
      characters: resolvedCharacters,
      places: [], // TODO: Load places
      events: [], // TODO: Load events
      issues: cardIssues,
    }
  })
  
  // Story statistics
  const stats: StoryStats | null = cards.length > 0 ? {
    totalSections: cards.length,
    analyzedSections: cards.filter(c => c.analyzed).length,
    totalCharacters: characters.length,
    totalPlaces: 0, // TODO
    totalEvents: 0, // TODO
    openIssues: openIssues.length,
    totalWordCount: cards.reduce((sum, c) => sum + c.wordCount, 0),
  } : null
  
  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================
  
  const getCardForSection = useCallback((sectionId: string): SectionCard | undefined => {
    return cards.find(c => c.structureItemId === sectionId)
  }, [cards])
  
  const getIssuesForSection = useCallback((sectionId: string): CoherencyIssue[] => {
    const card = cards.find(c => c.structureItemId === sectionId)
    if (!card) return []
    return openIssues.filter(issue => issue.sectionCardId === card.id)
  }, [cards, openIssues])
  
  return {
    cards,
    cardsWithDetails,
    characters,
    openIssues,
    stats,
    isLoading,
    error,
    refreshCards: fetchCards,
    getCardForSection,
    getIssuesForSection,
  }
}

