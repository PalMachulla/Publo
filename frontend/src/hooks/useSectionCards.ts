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
      
      // Fetch characters
      const { data: charRows, error: charError } = await supabase
        .from('story_characters')
        .select('*')
        .eq('node_id', nodeId)
        .order('name')
      
      if (charError) throw charError
      
      const loadedChars = (charRows || []).map(dbRowToCharacter)
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
  
  // Cards with resolved entities
  const cardsWithDetails: SectionCardDisplay[] = cards.map(card => {
    // Resolve character IDs to character objects
    const resolvedCharacters = card.charactersPresent
      .map(charId => characters.find(c => c.id === charId))
      .filter((c): c is StoryCharacter => c !== undefined)
    
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

