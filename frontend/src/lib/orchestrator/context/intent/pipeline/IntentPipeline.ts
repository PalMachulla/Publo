/**
 * Intent Pipeline
 * 
 * Multi-stage pipeline for intent analysis:
 * 1. Triage - Fast classification (50-100ms)
 * 2. Context Resolution - Resolve references (150ms, if needed)
 * 3. Deep Analysis - Full intent analysis (300ms, if needed)
 * 4. Validation - Consistency checks (50ms)
 * 
 * This replaces the monolithic LLM prompt with a modular, efficient system.
 */

import type { 
  PipelineContext, 
  PipelineIntentAnalysis, 
  PipelineConfig, 
  PipelineMetrics,
  TriageResult
} from './types'
import { DEFAULT_PIPELINE_CONFIG } from './config'
import { ModelRouterAdapter } from '../utils/modelRouterAdapter'
import type { IntentAnalysis } from '../../intentRouter'
import { TriageAgent } from '../stages/1-triage/TriageAgent'
import { ContextResolver } from '../stages/2-context/ContextResolver'
import { DeepAnalyzer } from '../stages/3-analysis/DeepAnalyzer'
import { Validator } from '../stages/4-validation/Validator'

export class IntentPipeline {
  private config: PipelineConfig
  private modelRouter: ModelRouterAdapter
  private triageAgent: TriageAgent
  private contextResolver: ContextResolver
  private deepAnalyzer: DeepAnalyzer
  private validator: Validator
  
  constructor(config?: Partial<PipelineConfig>) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config }
    this.modelRouter = new ModelRouterAdapter()
    this.triageAgent = new TriageAgent(this.modelRouter, {
      escalationConfidenceThreshold: this.config.escalationConfidenceThreshold,
      escalationReasoningThreshold: this.config.escalationReasoningThreshold
    })
    this.contextResolver = new ContextResolver(this.modelRouter)
    this.deepAnalyzer = new DeepAnalyzer(this.modelRouter, config?.promptModules)
    this.validator = new Validator(config?.validationRules)
  }
  
  /**
   * Update available models for the model router
   */
  updateAvailableModels(models: any[]) {
    this.modelRouter.updateAvailableModels(models)
  }
  
  /**
   * Main entry point - analyze user message through pipeline
   */
  async analyze(
    message: string,
    context: PipelineContext
  ): Promise<IntentAnalysis> {
    const startTime = Date.now()
    const metrics: PipelineMetrics = {
      stage1Time: 0,
      stage2Time: 0,
      stage3Time: 0,
      stage4Time: 0,
      totalCost: 0
    }
    
    try {
      // STAGE 1: Reasoning-First Triage
      console.log('🚦 [Pipeline] Stage 1: Reasoning-First Triage')
      const stage1Start = Date.now()
      const triageResult = await this.runTriage(message, context)
      metrics.stage1Time = Date.now() - stage1Start
      
      if (triageResult.wasEscalated) {
        console.log('🔄 [Pipeline] Triage escalated to smart model:', triageResult.escalationReason)
      }
      
      // If simple and high confidence, skip to execution
      if (
        triageResult.classification === 'simple' && 
        triageResult.confidence > this.config.highConfidenceThreshold &&
        triageResult.intent
      ) {
        console.log('✅ [Pipeline] Simple intent detected with high confidence, skipping deep analysis')
        return {
          ...triageResult.intent,
          pipelineMetrics: metrics,
          totalTime: Date.now() - startTime
        }
      }
      
      // STAGE 2: Context Resolution (if needed)
      let enrichedContext = context
      if (triageResult.needsContextResolution && this.config.enableContextResolution) {
        console.log('🔍 [Pipeline] Stage 2: Context Resolution')
        const stage2Start = Date.now()
        enrichedContext = await this.runContextResolution(message, context)
        metrics.stage2Time = Date.now() - stage2Start
      }
      
      // STAGE 3: Deep Analysis
      console.log('🧠 [Pipeline] Stage 3: Deep Analysis')
      const stage3Start = Date.now()
      const analysis = await this.runDeepAnalysis(message, enrichedContext)
      metrics.stage3Time = Date.now() - stage3Start
      
      // STAGE 4: Validation
      if (this.config.enableValidation) {
        console.log('✔️ [Pipeline] Stage 4: Validation')
        const stage4Start = Date.now()
        const validated = await this.runValidation(analysis, enrichedContext)
        metrics.stage4Time = Date.now() - stage4Start
        
        return {
          ...validated,
          pipelineMetrics: metrics,
          totalTime: Date.now() - startTime
        }
      }
      
      return {
        ...analysis,
        pipelineMetrics: metrics,
        totalTime: Date.now() - startTime
      }
      
    } catch (error) {
      console.error('❌ [Pipeline] Error in pipeline:', error)
      throw error
    }
  }
  
  /**
   * STAGE 1: Triage - Fast classification
   */
  private async runTriage(
    message: string,
    context: PipelineContext
  ): Promise<TriageResult> {
    if (!this.config.enableTriage) {
      // If triage is disabled, always go to deep analysis
      return {
        classification: 'complex',
        confidence: 0.5,
        intent: null,
        needsContextResolution: true
      }
    }
    
    return await this.triageAgent.classify(message, context)
  }
  
  /**
   * STAGE 2: Context Resolution - Resolve pronouns and references
   */
  private async runContextResolution(
    message: string,
    context: PipelineContext
  ): Promise<PipelineContext> {
    if (!this.config.enableContextResolution) {
      return context
    }
    
    return await this.contextResolver.resolve(message, context)
  }
  
  /**
   * STAGE 3: Deep Analysis - Full intent analysis
   */
  private async runDeepAnalysis(
    message: string,
    context: PipelineContext
  ): Promise<IntentAnalysis> {
    return await this.deepAnalyzer.analyze(message, context)
  }
  
  /**
   * STAGE 4: Validation - Consistency checks and auto-corrections
   */
  private async runValidation(
    analysis: IntentAnalysis,
    context: PipelineContext
  ): Promise<IntentAnalysis> {
    if (!this.config.enableValidation) {
      return analysis
    }
    
    return await this.validator.validate(analysis, context)
  }
}

