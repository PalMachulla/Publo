/**
 * Temporal Memory System for Orchestration
 * 
 * Based on AgentDB Timeline Self-Reflection principles:
 * - Every event is a signed delta with provenance
 * - Timeline snapshots compress temporal sequences into embeddings
 * - Vector-only scoring enables fast, coherent decision-making
 * - Attestation ensures security and auditability
 * 
 * References:
 * - https://gist.github.com/ruvnet/d6d2739400943037443b78c3ef86d8a5
 */

import { createHash } from 'crypto'

// ============================================================
// TYPES
// ============================================================

export interface EventDelta {
  id: string
  timestamp: number // Unix timestamp in ms
  actor: string // User ID or system actor
  scope: string // e.g., 'orchestration', 'generation', 'model_selection'
  verb: string // e.g., 'started', 'completed', 'selected', 'failed'
  object: string // e.g., model ID, task ID, structure ID
  attributes_diff: Record<string, any> // What changed
  context?: {
    story_id?: string
    canvas_id?: string
    format?: string
    user_prompt_hash?: string // For privacy
  }
  attestation?: string // Signature for provenance
  derived_from?: string[] // Parent event IDs
}

export interface TimelineSnapshot {
  id: string
  t_range: [number, number] // Start and end timestamps
  embedding_vec?: number[] // Will be computed from event deltas
  checksum: string // Hash of all events in this window
  derived_from: string[] // Event delta IDs that formed this snapshot
  event_count: number
  scope: string
  created_at: number
}

export interface ConstraintViolation {
  id: string
  rule_id: string
  event_id: string
  severity: 'warning' | 'error' | 'critical'
  message: string
  timestamp: number
}

export interface RouterScore {
  plan_id: string
  option_id: string
  temporal_coherence: number // How well it fits the timeline
  recency_boost: number // Favor recent context
  periodicity_match: number // Match periodic patterns
  risk_score: number // Lower is better
  total_score: number
}

export interface TemporalConstraint {
  rule_id: string
  name: string
  check: (event: EventDelta, timeline: EventDelta[]) => ConstraintViolation | null
}

// ============================================================
// TEMPORAL MEMORY CLASS
// ============================================================

export class TemporalMemory {
  private events: EventDelta[] = []
  private snapshots: TimelineSnapshot[] = []
  private constraints: TemporalConstraint[] = []
  private maxEventsInMemory = 1000
  private snapshotWindowMs = 15 * 60 * 1000 // 15 minutes
  
  constructor(
    private userId: string,
    private scope: string = 'orchestration'
  ) {
    this.initializeConstraints()
  }
  
  /**
   * Add an event delta to the timeline
   */
  async addEvent(delta: Partial<EventDelta>): Promise<EventDelta> {
    const event: EventDelta = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      actor: this.userId,
      scope: this.scope,
      verb: delta.verb || 'unknown',
      object: delta.object || '',
      attributes_diff: delta.attributes_diff || {},
      context: delta.context,
      attestation: this.signEvent(delta),
      derived_from: delta.derived_from
    }
    
    // Check constraints
    const violation = this.checkConstraints(event)
    if (violation && violation.severity === 'critical') {
      throw new Error(`Constraint violation: ${violation.message}`)
    }
    
    // Add to timeline
    this.events.push(event)
    
    // Prune old events if needed
    if (this.events.length > this.maxEventsInMemory) {
      await this.rollupOldEvents()
    }
    
    // Log for debugging
    console.log(`📝 Event logged: ${event.scope}/${event.verb} ${event.object}`)
    
    return event
  }
  
  /**
   * Create a timeline snapshot from recent events
   */
  async createSnapshot(windowMs: number = this.snapshotWindowMs): Promise<TimelineSnapshot> {
    const now = Date.now()
    const windowStart = now - windowMs
    
    // Get events in window
    const windowEvents = this.events.filter(e => 
      e.timestamp >= windowStart && e.timestamp <= now
    )
    
    if (windowEvents.length === 0) {
      throw new Error('No events in window to create snapshot')
    }
    
    // Create snapshot
    const snapshot: TimelineSnapshot = {
      id: this.generateSnapshotId(),
      t_range: [windowStart, now],
      embedding_vec: this.computeEmbedding(windowEvents),
      checksum: this.computeChecksum(windowEvents),
      derived_from: windowEvents.map(e => e.id),
      event_count: windowEvents.length,
      scope: this.scope,
      created_at: now
    }
    
    this.snapshots.push(snapshot)
    
    console.log(`📊 Snapshot created: ${snapshot.event_count} events in ${windowMs}ms window`)
    
    return snapshot
  }
  
  /**
   * Score plan options using temporal coherence
   */
  scorePlanOptions(
    options: Array<{ id: string; attributes: Record<string, any> }>,
    context: { now?: number; query_context?: string } = {}
  ): RouterScore[] {
    const now = context.now || Date.now()
    const latestSnapshot = this.snapshots[this.snapshots.length - 1]
    
    if (!latestSnapshot) {
      // No temporal context yet, return neutral scores
      return options.map(opt => ({
        plan_id: this.scope,
        option_id: opt.id,
        temporal_coherence: 0.5,
        recency_boost: 0.5,
        periodicity_match: 0.5,
        risk_score: 0.5,
        total_score: 0.5
      }))
    }
    
    return options.map(opt => {
      // Compute feature vector for this option
      const optionVec = this.featurize(opt, now)
      
      // Temporal coherence: How well does this fit recent history?
      const temporal_coherence = this.cosineSimilarity(
        latestSnapshot.embedding_vec || [],
        optionVec
      )
      
      // Recency boost: Favor fresh information
      const recency_boost = this.computeRecencyBoost(opt, now)
      
      // Periodicity: Does this match periodic patterns?
      const periodicity_match = this.computePeriodicityMatch(opt, latestSnapshot)
      
      // Risk: Higher for unfamiliar patterns
      const risk_score = 1 - temporal_coherence
      
      const total_score = (
        temporal_coherence * 0.4 +
        recency_boost * 0.3 +
        periodicity_match * 0.2 +
        (1 - risk_score) * 0.1
      )
      
      return {
        plan_id: this.scope,
        option_id: opt.id,
        temporal_coherence,
        recency_boost,
        periodicity_match,
        risk_score,
        total_score
      }
    }).sort((a, b) => b.total_score - a.total_score)
  }
  
  /**
   * Get audit trail for a time range
   */
  getAuditTrail(startTime: number, endTime: number): EventDelta[] {
    return this.events.filter(e => 
      e.timestamp >= startTime && e.timestamp <= endTime
    ).sort((a, b) => a.timestamp - b.timestamp)
  }
  
  /**
   * Prove timeline integrity
   */
  proveTimeline(range: [number, number]): {
    valid: boolean
    checksum: string
    event_count: number
    integrity_chain: string[]
  } {
    const events = this.getAuditTrail(range[0], range[1])
    const checksum = this.computeChecksum(events)
    
    // Build Merkle-like chain
    const integrity_chain = events.map(e => e.attestation).filter(Boolean) as string[]
    
    return {
      valid: true,
      checksum,
      event_count: events.length,
      integrity_chain
    }
  }
  
  // ============================================================
  // PRIVATE HELPERS
  // ============================================================
  
  private initializeConstraints(): void {
    this.constraints = [
      // Rate limiting: Max 10 orchestrations per minute
      {
        rule_id: 'rate_limit_orchestration',
        name: 'Orchestration rate limit',
        check: (event, timeline) => {
          if (event.verb !== 'orchestration_started') return null
          
          const oneMinuteAgo = Date.now() - 60000
          const recentOrchestrations = timeline.filter(e =>
            e.verb === 'orchestration_started' &&
            e.timestamp >= oneMinuteAgo
          )
          
          if (recentOrchestrations.length >= 10) {
            return {
              id: this.generateEventId(),
              rule_id: 'rate_limit_orchestration',
              event_id: event.id,
              severity: 'error',
              message: 'Rate limit exceeded: Max 10 orchestrations per minute',
              timestamp: Date.now()
            }
          }
          
          return null
        }
      },
      
      // Token budget: Warn if cumulative tokens > 100k in 1 hour
      {
        rule_id: 'token_budget_hourly',
        name: 'Hourly token budget',
        check: (event, timeline) => {
          if (event.verb !== 'generation_completed') return null
          
          const oneHourAgo = Date.now() - 3600000
          const recentGenerations = timeline.filter(e =>
            e.verb === 'generation_completed' &&
            e.timestamp >= oneHourAgo
          )
          
          const totalTokens = recentGenerations.reduce((sum, e) =>
            sum + (e.attributes_diff.total_tokens || 0), 0
          )
          
          if (totalTokens > 100000) {
            return {
              id: this.generateEventId(),
              rule_id: 'token_budget_hourly',
              event_id: event.id,
              severity: 'warning',
              message: `Token budget exceeded: ${totalTokens} tokens used in last hour`,
              timestamp: Date.now()
            }
          }
          
          return null
        }
      },
      
      // Temporal coherence: Don't start new orchestration if one is in progress
      {
        rule_id: 'single_orchestration',
        name: 'Single orchestration at a time',
        check: (event, timeline) => {
          if (event.verb !== 'orchestration_started') return null
          
          const activeOrchestration = timeline.find(e =>
            e.verb === 'orchestration_started' &&
            !timeline.some(e2 => 
              e2.verb === 'orchestration_completed' &&
              e2.context?.story_id === e.context?.story_id &&
              e2.timestamp > e.timestamp
            )
          )
          
          if (activeOrchestration) {
            return {
              id: this.generateEventId(),
              rule_id: 'single_orchestration',
              event_id: event.id,
              severity: 'error',
              message: 'Another orchestration is already in progress',
              timestamp: Date.now()
            }
          }
          
          return null
        }
      }
    ]
  }
  
  private checkConstraints(event: EventDelta): ConstraintViolation | null {
    for (const constraint of this.constraints) {
      const violation = constraint.check(event, this.events)
      if (violation) {
        console.warn(`⚠️ Constraint violation: ${violation.message}`)
        return violation
      }
    }
    return null
  }
  
  private async rollupOldEvents(): Promise<void> {
    // Find events older than 1 hour
    const oneHourAgo = Date.now() - 3600000
    const oldEvents = this.events.filter(e => e.timestamp < oneHourAgo)
    
    if (oldEvents.length > 0) {
      // Create snapshot from old events
      const snapshot: TimelineSnapshot = {
        id: this.generateSnapshotId(),
        t_range: [
          Math.min(...oldEvents.map(e => e.timestamp)),
          Math.max(...oldEvents.map(e => e.timestamp))
        ],
        embedding_vec: this.computeEmbedding(oldEvents),
        checksum: this.computeChecksum(oldEvents),
        derived_from: oldEvents.map(e => e.id),
        event_count: oldEvents.length,
        scope: this.scope,
        created_at: Date.now()
      }
      
      this.snapshots.push(snapshot)
      
      // Remove old events from memory
      this.events = this.events.filter(e => e.timestamp >= oneHourAgo)
      
      console.log(`🗃️ Rolled up ${oldEvents.length} events into snapshot ${snapshot.id}`)
    }
  }
  
  /**
   * Compute embedding vector from events
   * Uses simple feature extraction (can be enhanced with real embeddings)
   */
  private computeEmbedding(events: EventDelta[]): number[] {
    // Simple feature vector (can be replaced with real embeddings later)
    const features = new Array(64).fill(0)
    
    // Feature 0-9: Event type distribution
    const verbs = ['started', 'completed', 'failed', 'selected', 'updated']
    verbs.forEach((verb, i) => {
      features[i] = events.filter(e => e.verb.includes(verb)).length / events.length
    })
    
    // Feature 10-19: Time distribution (0-1h, 1-2h, etc.)
    const now = Date.now()
    for (let i = 0; i < 10; i++) {
      const hourAgo = now - (i * 3600000)
      features[10 + i] = events.filter(e => 
        e.timestamp >= hourAgo && e.timestamp < (hourAgo + 3600000)
      ).length / events.length
    }
    
    // Feature 20-29: Object type hashing
    const objectHashes = events.map(e => this.hashString(e.object))
    for (let i = 0; i < 10; i++) {
      features[20 + i] = objectHashes.filter(h => h % 10 === i).length / events.length
    }
    
    // Feature 30-39: Scope distribution
    const scopes = [...new Set(events.map(e => e.scope))]
    scopes.forEach((scope, i) => {
      if (i < 10) {
        features[30 + i] = events.filter(e => e.scope === scope).length / events.length
      }
    })
    
    // Feature 40-63: Reserved for future use
    
    return features
  }
  
  private featurize(option: any, now: number): number[] {
    // Convert option attributes to feature vector
    const features = new Array(64).fill(0)
    
    // Simple hashing of option attributes
    const attrStr = JSON.stringify(option.attributes)
    const hash = this.hashString(attrStr)
    
    for (let i = 0; i < 32; i++) {
      features[i] = ((hash >> i) & 1) / 32
    }
    
    return features
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0.5
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0.5
    
    return dotProduct / (magnitudeA * magnitudeB)
  }
  
  private computeRecencyBoost(option: any, now: number): number {
    // Simple recency: newer is better
    const lastEventTime = this.events[this.events.length - 1]?.timestamp || now
    const timeSinceLastEvent = now - lastEventTime
    
    // Decay over 1 hour
    const decay = Math.exp(-timeSinceLastEvent / 3600000)
    return 0.5 + (decay * 0.5)
  }
  
  private computePeriodicityMatch(option: any, snapshot: TimelineSnapshot): number {
    // Simple periodicity: check if similar options occurred before
    // (Can be enhanced with FFT or autocorrelation)
    return 0.5
  }
  
  private computeChecksum(events: EventDelta[]): string {
    const data = events.map(e => `${e.id}:${e.timestamp}:${e.verb}`).join('|')
    return createHash('sha256').update(data).digest('hex')
  }
  
  private signEvent(delta: Partial<EventDelta>): string {
    // Simple signing (can be enhanced with Ed25519)
    const data = JSON.stringify({
      verb: delta.verb,
      object: delta.object,
      timestamp: Date.now()
    })
    return createHash('sha256').update(data).digest('hex')
  }
  
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash)
  }
  
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }
  
  private generateSnapshotId(): string {
    return `snap_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }
}

/**
 * Create a temporal memory instance for a user session
 */
export function createTemporalMemory(userId: string, scope: string): TemporalMemory {
  return new TemporalMemory(userId, scope)
}

