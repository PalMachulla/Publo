/**
 * Phase 3: Writer-Critic Cluster - Iterative Quality Refinement
 * 
 * Collaborative pattern where Writer and Critic agents work together
 * to produce high-quality content through iterative refinement.
 * 
 * Flow: Write → Review → Revise → Review → ... → Approve
 */

import type { AgentTask, AgentContext } from '../types'
import type { WriterAgent } from '../WriterAgent'
import type { CriticAgent } from '../CriticAgent'

interface ClusterResult {
  content: string
  iterations: number
  finalScore: number
  approved: boolean
  history: Array<{
    iteration: number
    content: string
    critique: any
    action: 'initial_write' | 'revision' | 'approved'
  }>
  metadata: {
    totalTokens: number
    totalTime: number
    writerTime: number
    criticTime: number
  }
}

export class WriterCriticCluster {
  constructor(
    private writer: WriterAgent,
    private critic: CriticAgent,
    private maxIterations: number = 3,
    private qualityThreshold: number = 7.0
  ) {
    console.log(`🔄 [WriterCriticCluster] Initialized (writer: ${writer.id}, critic: ${critic.id}, max iterations: ${maxIterations})`)
  }
  
  // ============================================================
  // MAIN EXECUTION
  // ============================================================
  
  /**
   * Generate content with iterative refinement
   * Writer produces draft → Critic reviews → Writer revises → repeat until approved
   */
  async generate(task: AgentTask, context: AgentContext): Promise<ClusterResult> {
    const startTime = Date.now()
    const history: ClusterResult['history'] = []
    
    let content = ''
    let iteration = 0
    let totalTokens = 0
    let writerTime = 0
    let criticTime = 0
    let approved = false
    let finalScore = 0
    
    console.log(`🔄 [WriterCriticCluster] Starting generation for task ${task.id}`)
    
    // Iteration 0: Initial write
    try {
      console.log(`✍️ [WriterCriticCluster] Iteration 0: Initial write`)
      
      const writerStart = Date.now()
      const writeResult = await this.writer.execute(
        {
          ...task,
          payload: {
            ...task.payload,
            context: {
              ...task.payload.context,
              iteration: 0
            }
          }
        },
        context
      )
      writerTime += Date.now() - writerStart
      
      content = writeResult.data
      totalTokens += writeResult.tokensUsed
      
      console.log(`✅ [WriterCriticCluster] Initial draft: ${this.countWords(content)} words (${writeResult.tokensUsed} tokens)`)
      
      // Review initial draft
      const criticStart = Date.now()
      const critiqueResult = await this.critic.execute(
        {
          ...task,
          type: 'review_content',
          payload: {
            ...task.payload,
            context: {
              ...task.payload.context,
              content,
              iteration: 0
            }
          }
        },
        context
      )
      criticTime += Date.now() - criticStart
      
      const critique = critiqueResult.data
      totalTokens += critiqueResult.tokensUsed
      finalScore = critique.score
      
      history.push({
        iteration: 0,
        content,
        critique,
        action: 'initial_write'
      })
      
      console.log(`🎭 [WriterCriticCluster] Review: ${critique.approved ? '✅ APPROVED' : '⚠️ NEEDS WORK'} (score: ${critique.score}/10)`)
      
      if (critique.approved) {
        approved = true
        console.log(`✨ [WriterCriticCluster] Content approved on first draft!`)
      } else {
        console.log(`🔄 [WriterCriticCluster] Issues found: ${critique.issues.join(', ')}`)
      }
      
    } catch (error) {
      console.error(`❌ [WriterCriticCluster] Initial write failed:`, error)
      throw error
    }
    
    // Revision iterations
    while (!approved && iteration < this.maxIterations) {
      iteration++
      
      try {
        console.log(`🔄 [WriterCriticCluster] Iteration ${iteration}: Revision based on critique`)
        
        const previousCritique = history[history.length - 1].critique
        
        // Writer revises based on critique
        const writerStart = Date.now()
        const revisionResult = await this.writer.execute(
          {
            ...task,
            payload: {
              ...task.payload,
              context: {
                ...task.payload.context,
                iteration,
                previousCritique,
                previousContent: content // Include for reference
              }
            }
          },
          context
        )
        writerTime += Date.now() - writerStart
        
        content = revisionResult.data
        totalTokens += revisionResult.tokensUsed
        
        console.log(`✍️ [WriterCriticCluster] Revision ${iteration}: ${this.countWords(content)} words (${revisionResult.tokensUsed} tokens)`)
        
        // Review revision
        const criticStart = Date.now()
        const critiqueResult = await this.critic.execute(
          {
            ...task,
            type: 'review_content',
            payload: {
              ...task.payload,
              context: {
                ...task.payload.context,
                content,
                iteration,
                previousCritique // Critic can see previous feedback
              }
            }
          },
          context
        )
        criticTime += Date.now() - criticStart
        
        const critique = critiqueResult.data
        totalTokens += critiqueResult.tokensUsed
        finalScore = critique.score
        
        const action = critique.approved ? 'approved' : 'revision'
        history.push({
          iteration,
          content,
          critique,
          action
        })
        
        console.log(`🎭 [WriterCriticCluster] Review: ${critique.approved ? '✅ APPROVED' : '⚠️ STILL NEEDS WORK'} (score: ${critique.score}/10)`)
        
        if (critique.approved) {
          approved = true
          console.log(`✨ [WriterCriticCluster] Content approved after ${iteration} revision(s)!`)
        } else {
          console.log(`🔄 [WriterCriticCluster] Remaining issues: ${critique.issues.join(', ')}`)
        }
        
      } catch (error) {
        console.error(`❌ [WriterCriticCluster] Iteration ${iteration} failed:`, error)
        throw error
      }
    }
    
    // Final status
    const totalTime = Date.now() - startTime
    
    if (!approved) {
      console.log(`⚠️ [WriterCriticCluster] Max iterations reached (${this.maxIterations}). Accepting best effort (score: ${finalScore}/10)`)
    }
    
    console.log(`✅ [WriterCriticCluster] Completed in ${totalTime}ms (${iteration + 1} iteration(s), ${totalTokens} tokens)`)
    console.log(`   Writer time: ${writerTime}ms | Critic time: ${criticTime}ms`)
    console.log(`   Final score: ${finalScore}/10 | Approved: ${approved}`)
    
    return {
      content,
      iterations: iteration + 1,
      finalScore,
      approved,
      history,
      metadata: {
        totalTokens,
        totalTime,
        writerTime,
        criticTime
      }
    }
  }
  
  // ============================================================
  // COMPETITIVE GENERATION (BEST-OF-N)
  // ============================================================
  
  /**
   * Generate multiple drafts in parallel and select the best
   * Useful for critical sections like opening chapters
   */
  async generateCompetitive(
    task: AgentTask,
    context: AgentContext,
    numDrafts: number = 3
  ): Promise<ClusterResult> {
    console.log(`🏆 [WriterCriticCluster] Starting competitive generation (${numDrafts} drafts)`)
    
    // Generate multiple drafts in parallel
    const draftPromises = Array.from({ length: numDrafts }, (_, idx) => 
      this.writer.execute(
        {
          ...task,
          payload: {
            ...task.payload,
            context: {
              ...task.payload.context,
              competitiveRound: idx + 1
            }
          }
        },
        context
      )
    )
    
    const draftResults = await Promise.all(draftPromises)
    
    // Review all drafts
    const critiquePromises = draftResults.map((draft, idx) =>
      this.critic.execute(
        {
          ...task,
          type: 'review_content',
          payload: {
            ...task.payload,
            context: {
              ...task.payload.context,
              content: draft.data,
              competitiveRound: idx + 1
            }
          }
        },
        context
      )
    )
    
    const critiqueResults = await Promise.all(critiquePromises)
    
    // Select best draft
    const scored = critiqueResults.map((critique, idx) => ({
      index: idx,
      score: critique.data.score,
      draft: draftResults[idx],
      critique: critique.data
    }))
    
    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]
    
    console.log(`🏆 [WriterCriticCluster] Best draft: #${best.index + 1} (score: ${best.score}/10)`)
    console.log(`   Other scores: ${scored.slice(1).map(s => `#${s.index + 1}: ${s.score}`).join(', ')}`)
    
    // If best is good enough, return it
    if (best.score >= this.qualityThreshold) {
      return {
        content: best.draft.data,
        iterations: 1,
        finalScore: best.score,
        approved: true,
        history: [{
          iteration: 0,
          content: best.draft.data,
          critique: best.critique,
          action: 'approved'
        }],
        metadata: {
          totalTokens: draftResults.reduce((sum, d) => sum + d.tokensUsed, 0) +
                      critiqueResults.reduce((sum, c) => sum + c.tokensUsed, 0),
          totalTime: Math.max(...draftResults.map(d => d.executionTime)),
          writerTime: Math.max(...draftResults.map(d => d.executionTime)),
          criticTime: Math.max(...critiqueResults.map(c => c.executionTime))
        }
      }
    }
    
    // Otherwise, take best draft and refine it
    console.log(`🔄 [WriterCriticCluster] Best draft needs refinement, starting iteration loop`)
    
    // Use regular iterative refinement starting from best draft
    return this.generate(
      {
        ...task,
        payload: {
          ...task.payload,
          context: {
            ...task.payload.context,
            initialContent: best.draft.data,
            previousCritique: best.critique
          }
        }
      },
      context
    )
  }
  
  // ============================================================
  // UTILITIES
  // ============================================================
  
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length
  }
  
  /**
   * Get summary of cluster performance
   */
  getSummary(result: ClusterResult): string {
    return `Writer-Critic Cluster Summary:
- Iterations: ${result.iterations}
- Final Score: ${result.finalScore}/10
- Approved: ${result.approved ? 'Yes' : 'No (max iterations reached)'}
- Total Time: ${result.metadata.totalTime}ms
- Total Tokens: ${result.metadata.totalTokens}
- Word Count: ${this.countWords(result.content)}`
  }
}

