'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Node } from 'reactflow'
import { CreateStoryNodeData, StoryFormat } from '@/types/nodes'
import { 
  CollapsibleSection,
  Card,
  Badge,
  RadioGroup,
  RadioItem,
  Button
} from '@/components/ui'
import { analyzeIntent, validateIntent, explainIntent, type IntentAnalysis } from '@/lib/orchestrator/intentRouter'
import { buildCanvasContext, formatCanvasContextForLLM, findReferencedNode } from '@/lib/orchestrator/canvasContextProvider'
import { Edge } from 'reactflow'

interface ActiveContext {
  type: 'section' | 'segment'
  id: string
  name: string
  title?: string
  level?: number
  description?: string
}

interface CreateStoryPanelProps {
  node: Node<CreateStoryNodeData>
  onCreateStory: (format: StoryFormat, template?: string, userPrompt?: string) => void
  onClose: () => void
  onUpdate?: (nodeId: string, data: Partial<CreateStoryNodeData>) => void
  onSendPrompt?: (prompt: string) => void // NEW: For chat-based prompting
  canvasChatHistory?: Array<{
    id: string
    timestamp: string
    content: string
    type: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user'
    role?: 'user' | 'orchestrator'
  }>
  onAddChatMessage?: (message: string) => void
  onClearChat?: () => void
  onToggleDocumentView?: () => void // NEW: Toggle document panel visibility
  isDocumentViewOpen?: boolean // NEW: Document panel visibility state
  activeContext?: ActiveContext | null // NEW: Currently selected segment/section
  onClearContext?: () => void // NEW: Clear the active context
  onWriteContent?: (segmentId: string, prompt: string) => Promise<void> // NEW: Write content to specific segment
  onAnswerQuestion?: (question: string) => Promise<string> // NEW: Answer questions about content
  structureItems?: any[] // GHOSTWRITER: Document structure for dependency analysis
  contentMap?: Record<string, string> // GHOSTWRITER: Existing content by section ID (currently open document)
  canvasNodes?: Node[] // CANVAS VISIBILITY: All nodes on canvas
  canvasEdges?: Edge[] // CANVAS VISIBILITY: All edges on canvas
  currentStoryStructureNodeId?: string | null // CANVAS CONTENT: ID of currently loaded story structure
}

interface Template {
  id: string
  name: string
  description: string
}

const templates: Record<StoryFormat, Template[]> = {
  'novel': [
    { id: 'three-act', name: 'Three-Act Structure', description: 'Classic beginning, middle, and end' },
    { id: 'heros-journey', name: "Hero's Journey", description: 'Archetypal adventure narrative' },
    { id: 'freytag', name: 'Freytag\'s Pyramid', description: 'Rising action, climax, falling action' },
    { id: 'save-the-cat', name: 'Save The Cat', description: 'Modern screenplay structure adapted for novels' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'short-story': [
    { id: 'classic', name: 'Classic Short Story', description: 'Single plot, few characters, brief timespan' },
    { id: 'flash-fiction', name: 'Flash Fiction', description: 'Ultra-short 500-1000 words' },
    { id: 'twist-ending', name: 'Twist Ending', description: 'Surprise revelation structure' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'report': [
    { id: 'business', name: 'Business Report', description: 'Executive summary, findings, recommendations' },
    { id: 'research', name: 'Research Report', description: 'Literature review, methodology, results' },
    { id: 'technical', name: 'Technical Report', description: 'Specifications, analysis, documentation' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'article': [
    { id: 'how-to', name: 'How-To Guide', description: 'Step-by-step instructional' },
    { id: 'listicle', name: 'Listicle', description: 'Numbered or bulleted list format' },
    { id: 'opinion', name: 'Opinion Piece', description: 'Editorial or commentary' },
    { id: 'feature', name: 'Feature Article', description: 'In-depth exploration of topic' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'screenplay': [
    { id: 'feature', name: 'Feature Film', description: '90-120 pages, three acts' },
    { id: 'tv-pilot', name: 'TV Pilot', description: '30 or 60-minute episode' },
    { id: 'short-film', name: 'Short Film', description: '5-30 pages' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'essay': [
    { id: 'argumentative', name: 'Argumentative', description: 'Claim, evidence, counterarguments' },
    { id: 'narrative', name: 'Narrative Essay', description: 'Personal story with reflection' },
    { id: 'compare-contrast', name: 'Compare & Contrast', description: 'Analyze similarities and differences' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'podcast': [
    { id: 'interview', name: 'Interview Format', description: 'Host interviews guests' },
    { id: 'co-hosted', name: 'Co-Hosted', description: 'Multiple hosts in conversation' },
    { id: 'storytelling', name: 'Storytelling', description: 'Narrative-driven episodes' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ]
}

const storyFormats: Array<{ type: StoryFormat; label: string; description: string; icon: JSX.Element }> = [
  {
    type: 'novel',
    label: 'Novel',
    description: 'Long-form narrative fiction',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  },
  {
    type: 'short-story',
    label: 'Short Story',
    description: 'Brief narrative fiction',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    )
  },
  {
    type: 'report',
    label: 'Report',
    description: 'Structured analysis document',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    type: 'article',
    label: 'Article',
    description: 'Editorial or blog post',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    )
  },
  {
    type: 'screenplay',
    label: 'Screenplay',
    description: 'Script for film or TV',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    )
  },
  {
    type: 'essay',
    label: 'Essay',
    description: 'Opinion or argumentative piece',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )
  },
  {
    type: 'podcast',
    label: 'Podcast',
    description: 'Audio show with host and guests',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    )
  }
]

interface ReasoningMessage {
  id: string
  timestamp: string
  content: string
  type: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user'
  role?: 'user' | 'orchestrator'
}

export default function CreateStoryPanel({ 
  node, 
  onCreateStory, 
  onClose, 
  onUpdate, 
  onSendPrompt,
  canvasChatHistory = [],
  onAddChatMessage,
  onClearChat,
  onToggleDocumentView,
  isDocumentViewOpen = false,
  activeContext = null,
  onClearContext,
  onWriteContent,
  onAnswerQuestion,
  structureItems = [],
  contentMap = {},
  canvasNodes = [],
  canvasEdges = [],
  currentStoryStructureNodeId = null
}: CreateStoryPanelProps) {
  const router = useRouter()
  
  // Debug: Log received props on mount and when they change
  useEffect(() => {
    console.log('🎯 [CreateStoryPanel] Props received:', {
      canvasNodesCount: canvasNodes.length,
      canvasEdgesCount: canvasEdges.length,
      canvasNodesList: canvasNodes.map(n => ({ id: n.id, type: n.type, label: n.data?.label })),
      canvasEdgesList: canvasEdges.map(e => ({ source: e.source, target: e.target }))
    })
  }, [canvasNodes, canvasEdges])
  const [configuredModel, setConfiguredModel] = useState<{
    orchestrator: string | null
    writerCount: number
  }>({ orchestrator: null, writerCount: 0 })
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [selectedFormat, setSelectedFormat] = useState<StoryFormat>('novel') // Default to 'novel'
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false) // Prevent double-clicks
  
  // Pill expansion state
  const [isModelPillExpanded, setIsModelPillExpanded] = useState(false)
  const [isFormatPillExpanded, setIsFormatPillExpanded] = useState(false)
  
  // Chat state (local input only, history is canvas-level)
  const [chatMessage, setChatMessage] = useState('')
  
  // Reasoning chat state
  const [isReasoningOpen, setIsReasoningOpen] = useState(true) // Open by default to see streaming
  const reasoningEndRef = useRef<HTMLDivElement>(null) // Auto-scroll target
  const chatInputRef = useRef<HTMLTextAreaElement>(null) // Chat input ref
  
  // Use CANVAS-LEVEL chat history (persistent across all generations)
  const reasoningMessages: ReasoningMessage[] = canvasChatHistory
  
  // Detect if streaming (last message is from model and being updated)
  const isStreaming = reasoningMessages.length > 0 && 
    reasoningMessages[reasoningMessages.length - 1].role === 'orchestrator' &&
    reasoningMessages[reasoningMessages.length - 1].content.startsWith('🤖 Model')
  
  // Build external content map for connected story structure nodes
  // This injects Supabase content that's not in the node's local state
  const externalContentMap: Record<string, { contentMap: Record<string, string> }> = {}
  
  // If we have a currently loaded story structure with content from Supabase, inject it
  if (currentStoryStructureNodeId && contentMap && Object.keys(contentMap).length > 0) {
    externalContentMap[currentStoryStructureNodeId] = {
      contentMap: contentMap
    }
    console.log('💉 [Content Injection] Injecting Supabase content for node:', {
      nodeId: currentStoryStructureNodeId,
      sectionsWithContent: Object.keys(contentMap).length,
      totalWords: Object.values(contentMap).reduce((sum, content) => sum + content.split(/\s+/).length, 0)
    })
  }
  
  // Also check node's own contentMap as fallback (might be from Test nodes or other sources)
  canvasNodes.forEach(node => {
    if ((node.type === 'storyStructureNode' || node.data?.nodeType === 'story-structure') && 
        !externalContentMap[node.id]) {
      if (node.data?.contentMap && Object.keys(node.data.contentMap).length > 0) {
        externalContentMap[node.id] = {
          contentMap: node.data.contentMap
        }
      }
    }
  })
  
  // Build canvas context - orchestrator's "eyes" on the canvas
  const canvasContext = buildCanvasContext('context', canvasNodes, canvasEdges, externalContentMap)
  
  // Debug logging
  console.log('🔍 [Canvas Context Debug]', {
    canvasNodesCount: canvasNodes.length,
    canvasEdgesCount: canvasEdges.length,
    connectedNodesFound: canvasContext.connectedNodes.length,
    externalContentMapKeys: Object.keys(externalContentMap),
    canvasNodes: canvasNodes.map(n => ({ id: n.id, type: n.type, label: n.data?.label, hasContentMap: !!n.data?.contentMap })),
    canvasEdges: canvasEdges.map(e => ({ source: e.source, target: e.target })),
    orchestratorId: 'context'
  })
  
  /**
   * Agentic message handler - analyzes intent and routes to appropriate action
   */
  const handleSendMessage = async (message: string) => {
    // Add user message to chat history
    if (onAddChatMessage) {
      onAddChatMessage(message)
    }
    
    // Show canvas context if available
    if (onAddChatMessage && canvasContext.connectedNodes.length > 0) {
      onAddChatMessage(`👁️ Canvas visibility: ${canvasContext.connectedNodes.length} node(s) connected`)
      canvasContext.connectedNodes.forEach(ctx => {
        onAddChatMessage(`   • ${ctx.label}: ${ctx.summary}`)
      })
    }
    
    // STEP 1: Analyze user intent using Hybrid IntentRouter
    if (onAddChatMessage) {
      onAddChatMessage(`🧠 Analyzing your request...`)
    }
    
    const intentAnalysis = await analyzeIntent({
      message,
      hasActiveSegment: !!activeContext,
      activeSegmentName: activeContext?.name,
      activeSegmentId: activeContext?.id,
      activeSegmentHasContent: false, // TODO: Track if segment has content
      conversationHistory: canvasChatHistory.slice(-5).map(msg => ({
        role: (msg.role === 'orchestrator' ? 'assistant' : msg.role) || 'user',
        content: msg.content,
        timestamp: msg.timestamp
      })),
      documentStructure: structureItems, // Pass current document structure
      isDocumentViewOpen: isDocumentViewOpen, // CRITICAL: Tell intent analyzer about document state
      documentFormat: selectedFormat, // Novel, Report, etc.
      canvasContext: formatCanvasContextForLLM(canvasContext) // NEW: Canvas visibility!
    })
    
    // Log intent analysis to reasoning chat
    if (onAddChatMessage) {
      const method = intentAnalysis.usedLLM ? '🧠 LLM Reasoning' : '⚡ Pattern Matching'
      onAddChatMessage(`${method}: ${explainIntent(intentAnalysis)} (Confidence: ${Math.round(intentAnalysis.confidence * 100)}%)`)
      onAddChatMessage(`💭 ${intentAnalysis.reasoning}`)
    }
    
    // STEP 1.5: Handle clarifying questions
    if (intentAnalysis.needsClarification && intentAnalysis.clarifyingQuestion) {
      if (onAddChatMessage) {
        onAddChatMessage(`❓ ${intentAnalysis.clarifyingQuestion}`)
      }
      setChatMessage('')
      return
    }
    
    // STEP 2: Validate intent can be executed
    const validation = validateIntent(intentAnalysis, !!activeContext)
    
    if (!validation.canExecute) {
      if (onAddChatMessage) {
        onAddChatMessage(`❌ Cannot execute: ${validation.errorMessage}`)
        if (validation.suggestion) {
          onAddChatMessage(`💡 ${validation.suggestion}`)
        }
      }
      setChatMessage('')
      return
    }
    
    // STEP 3: Route to appropriate action based on intent
    try {
      switch (intentAnalysis.intent) {
        case 'write_content':
          // Write content to selected segment
          if (onAddChatMessage) {
            onAddChatMessage(`📝 Delegating to writer model: ${intentAnalysis.suggestedModel}`)
          }
          
          if (activeContext && onWriteContent) {
            await onWriteContent(activeContext.id, message)
          } else {
            // Fallback to old behavior
            const finalPrompt = `[Writing mode: "${activeContext?.name}"${activeContext?.title ? ` - ${activeContext.title}` : ''}]
Intent: Write/modify content for THIS section only (not create new structure).
Request: ${message}`
            onCreateStory(selectedFormat, selectedTemplate || undefined, finalPrompt)
          }
          break
        
        case 'improve_content':
          // Improve existing content in selected segment
          if (onAddChatMessage) {
            onAddChatMessage(`✨ Delegating to editor model: ${intentAnalysis.suggestedModel}`)
          }
          
          if (activeContext && onWriteContent) {
            const improvePrompt = `Improve the following content:\n\n${message}`
            await onWriteContent(activeContext.id, improvePrompt)
          } else {
            // Fallback
            onCreateStory(selectedFormat, selectedTemplate || undefined, `Improve: ${message}`)
          }
          break
        
        case 'rewrite_with_coherence':
          // Ghostwriter-level coherent rewriting across multiple sections
          if (onAddChatMessage) {
            onAddChatMessage(`🎭 Activating ghostwriter mode - analyzing story dependencies...`)
          }
          
          if (!activeContext) {
            if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Please select a section to rewrite first.`)
            }
            break
          }
          
          // Import the coherence rewriter dynamically
          const { createCoherenceRewritePlan, executeRewriteStep } = await import('@/lib/orchestrator/coherenceRewriter')
          
          // Get all sections and their content for dependency analysis
          // TODO: Pass from props - for now, use placeholder
          const allSections = structureItems || []
          const existingContent: Record<string, string> = contentMap || {}
          
          // Create the rewrite plan
          if (onAddChatMessage) {
            onAddChatMessage(`🔍 Analyzing which sections will be affected...`)
          }
          
          try {
            const plan = await createCoherenceRewritePlan({
              targetSectionId: activeContext.id,
              userRequest: message,
              allSections: allSections.map(item => ({
                id: item.id,
                name: item.name,
                level: item.level,
                order: item.order,
                content: existingContent[item.id],
                parentId: item.parentId
              })),
              existingContent,
              storyFormat: selectedFormat
            })
            
            // Show the plan to the user
            if (onAddChatMessage) {
              onAddChatMessage(plan.reasoning)
              onAddChatMessage(`\n⏱️ This will take approximately ${plan.estimatedTime}`)
              onAddChatMessage(`\n🚀 Starting ${plan.totalSteps}-step rewrite process...`)
            }
            
            // Execute each step sequentially
            for (const step of plan.steps) {
              if (onAddChatMessage) {
                onAddChatMessage(`\n📝 Step ${step.stepNumber}/${plan.totalSteps}: ${step.action.toUpperCase()} "${step.sectionName}"`)
                onAddChatMessage(`   ${step.reason}`)
              }
              
              const result = await executeRewriteStep(step, {
                targetSectionId: activeContext.id,
                userRequest: message,
                allSections: allSections.map(item => ({
                  id: item.id,
                  name: item.name,
                  level: item.level,
                  order: item.order,
                  content: existingContent[item.id],
                  parentId: item.parentId
                })),
                existingContent,
                storyFormat: selectedFormat
              })
              
              if (result.success && result.content) {
                // Update the content map with new content
                existingContent[step.sectionId] = result.content
                
                // Save to database if onWriteContent is available
                if (onWriteContent) {
                  await onWriteContent(step.sectionId, result.content)
                }
                
                if (onAddChatMessage) {
                  onAddChatMessage(`   ✅ Completed - ${result.content.split(/\s+/).length} words`)
                }
              } else {
                if (onAddChatMessage) {
                  onAddChatMessage(`   ❌ Failed: ${result.error}`)
                }
                // Continue with remaining steps even if one fails
              }
            }
            
            // Final success message
            if (onAddChatMessage) {
              onAddChatMessage(`\n🎉 Ghostwriter rewrite complete! All ${plan.totalSteps} sections updated with narrative coherence maintained.`)
            }
            
          } catch (planError: any) {
            console.error('❌ Coherence rewrite failed:', planError)
            if (onAddChatMessage) {
              onAddChatMessage(`❌ Ghostwriter mode failed: ${planError.message}`)
            }
          }
          break
        
        case 'answer_question':
          // Answer question using orchestrator model
          if (onAddChatMessage) {
            onAddChatMessage(`💬 Answering with orchestrator model...`)
          }
          
          if (onAnswerQuestion) {
            const answer = await onAnswerQuestion(message)
            if (onAddChatMessage) {
              onAddChatMessage(`📖 ${answer}`)
            }
          } else {
            // Fallback: show message that Q&A is not implemented yet
            if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Q&A functionality not yet fully implemented. For now, I'll generate a response using the orchestrator.`)
            }
            onCreateStory(selectedFormat, selectedTemplate || undefined, message)
          }
          break
        
        case 'create_structure':
          // Create new story structure (ONLY when document panel is closed!)
          if (isDocumentViewOpen) {
            // Safety check: If document panel is open, don't create new structure
            if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Cannot create new structure while editing a document. Close the document panel first, or try "write more" to add content.`)
            }
            break
          }
          
          // CANVAS INTELLIGENCE: Check if user is referencing a connected node
          let enhancedPrompt = message
          const referencePhrases = [
            'our screenplay', 'the screenplay', 'that screenplay',
            'our story', 'our other story', 'that story',
            'the document', 'that document',
            'the characters', 'characters in',
            'based on', 'base this on', 'using the',
            'from the', 'adapt',
          ]
          const hasReference = referencePhrases.some(phrase => message.toLowerCase().includes(phrase)) || 
                              (canvasContext.connectedNodes.length > 0 && 
                               (message.toLowerCase().includes('interview') || 
                                message.toLowerCase().includes('characters')))
          
          if (hasReference && canvasContext.connectedNodes.length > 0) {
            // Find the referenced node
            const referencedNode = findReferencedNode(message, canvasContext)
            
            if (referencedNode && referencedNode.detailedContext) {
              if (onAddChatMessage) {
                onAddChatMessage(`📖 Reading content from "${referencedNode.label}"...`)
              }
              
              // Extract detailed content based on node type
              if (referencedNode.nodeType === 'story-structure') {
                const contentMap = referencedNode.detailedContext.contentMap as Record<string, string> || {}
                const allSections = referencedNode.detailedContext.allSections || []
                
                // Try to extract written content first
                const hasWrittenContent = Object.keys(contentMap).length > 0
                
                if (hasWrittenContent) {
                  // Extract full story content
                  const allContent = Object.entries(contentMap)
                    .map(([sectionId, content]) => {
                      const section = allSections.find((s: any) => s.id === sectionId)
                      return `## ${section?.name || 'Section'}\n${content}`
                    })
                    .join('\n\n')
                  
                  // Enhance prompt with actual content
                  enhancedPrompt = `${message}

REFERENCE CONTENT FROM "${referencedNode.label}" (${referencedNode.detailedContext.format}):

STRUCTURE:
${referencedNode.detailedContext.structure}

FULL CONTENT:
${allContent.substring(0, 8000)}

${allContent.length > 8000 ? '... (content truncated for length)' : ''}

INSTRUCTION: Use the above ${referencedNode.detailedContext.format} content as inspiration for creating the new ${selectedFormat} structure. 

${message.toLowerCase().includes('interview') || message.toLowerCase().includes('character') ? 
`FOCUS ON CHARACTERS: The user wants to feature the characters from this content. Carefully read through the content above and identify all named characters, their roles, personalities, and key characteristics. Build the ${selectedFormat} structure around interviewing or featuring these specific characters.` : 
`Extract characters, themes, plot points, and narrative elements to adapt them for the ${selectedFormat} format.`}`

                  if (onAddChatMessage) {
                    onAddChatMessage(`✅ Extracted ${Object.keys(contentMap).length} sections (${referencedNode.detailedContext.wordsWritten} words) from "${referencedNode.label}"`)
                    onAddChatMessage(`🎯 Creating new ${selectedFormat} inspired by this content...`)
                  }
                } else {
                  // Use structure summaries if no written content yet
                  const structureDetails = allSections
                    .map((s: any) => `${'  '.repeat(s.level - 1)}- ${s.name}${s.summary ? ': ' + s.summary : ''}`)
                    .join('\n')
                  
                  enhancedPrompt = `${message}

REFERENCE STRUCTURE FROM "${referencedNode.label}" (${referencedNode.detailedContext.format}):

${structureDetails}

INSTRUCTION: Use the above ${referencedNode.detailedContext.format} structure and summaries as inspiration for creating the new ${selectedFormat} structure.`

                  if (onAddChatMessage) {
                    onAddChatMessage(`✅ Using structure from "${referencedNode.label}" (${allSections.length} sections)`)
                    onAddChatMessage(`ℹ️ Note: No written content found, using structure summaries only`)
                  }
                }
              } else if (referencedNode.nodeType === 'test' && referencedNode.detailedContext.markdown) {
                // Use markdown content from test node
                const markdown = referencedNode.detailedContext.markdown as string
                enhancedPrompt = `${message}

REFERENCE CONTENT:
${markdown.substring(0, 8000)}

${markdown.length > 8000 ? '... (content truncated for length)' : ''}

Use the above content as inspiration for creating the new ${selectedFormat} structure.`

                if (onAddChatMessage) {
                  onAddChatMessage(`✅ Extracted ${referencedNode.detailedContext.wordCount} words from "${referencedNode.label}"`)
                }
              }
            } else if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Found node "${referencedNode?.label}" but couldn't extract content. Proceeding with user prompt only.`)
            }
          }
          
          if (onAddChatMessage) {
            onAddChatMessage(`🏗️ Planning structure with orchestrator model...`)
          }
          onCreateStory(selectedFormat, selectedTemplate || undefined, enhancedPrompt)
          break
        
        case 'modify_structure':
          // Modify existing structure (add/remove sections within current document)
          if (!isDocumentViewOpen) {
            if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Cannot modify structure without an open document. Open a document first.`)
            }
            break
          }
          
          if (onAddChatMessage) {
            onAddChatMessage(`🔧 Modifying document structure...`)
          }
          
          // For now, treat structure modification as content generation for the target section
          // TODO: Implement proper structure modification (add/remove/reorder sections)
          if (activeContext && onWriteContent) {
            // User wants to add content to a specific section (like "add to summary")
            await onWriteContent(activeContext.id, message)
          } else {
            if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Structure modification requires a selected segment. Please click on the section you want to modify.`)
            }
          }
          break
        
        case 'clarify_intent':
          // This should be handled above, but just in case
          if (onAddChatMessage) {
            onAddChatMessage(`❓ I need more information. Could you clarify what you'd like me to do?`)
          }
          break
        
        case 'general_chat':
        default:
          // General conversation
          if (onAddChatMessage) {
            onAddChatMessage(`💭 Responding conversationally...`)
          }
          
          if (onAnswerQuestion) {
            const response = await onAnswerQuestion(message)
            if (onAddChatMessage) {
              onAddChatMessage(`💬 ${response}`)
            }
          } else {
            onCreateStory(selectedFormat, selectedTemplate || undefined, message)
          }
          break
      }
    } catch (error) {
      console.error('❌ Error executing intent:', error)
      if (onAddChatMessage) {
        onAddChatMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Clear input
    setChatMessage('')
  }

  // Auto-open reasoning panel when messages appear or update
  useEffect(() => {
    if (reasoningMessages.length > 0) {
      setIsReasoningOpen(true)
      console.log('[CreateStoryPanel] Auto-opening reasoning panel, messages:', reasoningMessages.length)
    }
  }, [reasoningMessages])

  // Clear context when document view is closed
  useEffect(() => {
    if (!isDocumentViewOpen && activeContext && onClearContext) {
      onClearContext()
    }
  }, [isDocumentViewOpen, activeContext, onClearContext])

  // Fetch configured models from Profile settings - ALWAYS refresh on mount
  useEffect(() => {
    console.log('[CreateStoryPanel] Component mounted, fetching configuration...')
    fetchConfiguredModels()
  }, []) // This now refreshes every time panel opens

  // Auto-refresh when page becomes visible (user returns from Profile)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[CreateStoryPanel] Page became visible, refreshing configuration...')
        fetchConfiguredModels()
      }
    }
    
    // Listen for custom event from Profile page when config is saved
    const handleConfigUpdate = (e: CustomEvent) => {
      console.log('[CreateStoryPanel] Config update event received:', e.detail)
      fetchConfiguredModels()
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('popstate', fetchConfiguredModels) // Browser back button
    window.addEventListener('orchestratorConfigUpdated' as any, handleConfigUpdate as any)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('popstate', fetchConfiguredModels)
      window.removeEventListener('orchestratorConfigUpdated' as any, handleConfigUpdate as any)
    }
  }, [])

  // NEW: Auto-scroll to latest reasoning message
  useEffect(() => {
    if (reasoningMessages.length > 0 && reasoningEndRef.current) {
      reasoningEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [reasoningMessages])

  const fetchConfiguredModels = async () => {
    setLoadingConfig(true)
    
    try {
      console.log('[CreateStoryPanel] Fetching configured models from Profile')
      const response = await fetch('/api/user/api-keys')
      const data = await response.json()
      
      console.log('[CreateStoryPanel] 📦 API Response:', {
        success: data.success,
        keyCount: data.keys?.length,
        allKeys: data.keys?.map((k: any) => ({
          id: k.id,
          provider: k.provider,
          orchestrator_model_id: k.orchestrator_model_id,
          writer_model_ids: k.writer_model_ids,
          hasOrchestrator: !!k.orchestrator_model_id
        }))
      })
      
      if (data.success && data.keys?.length > 0) {
        // Find the first key with an orchestrator configured
        const configuredKey = data.keys.find((key: any) => key.orchestrator_model_id)
        
        console.log('[CreateStoryPanel] 🔍 Search result:', {
          foundKey: !!configuredKey,
          keyId: configuredKey?.id,
          orchestrator: configuredKey?.orchestrator_model_id,
          writers: configuredKey?.writer_model_ids
        })
        
        if (configuredKey) {
          console.log('[CreateStoryPanel] ✅ Setting configured model:', {
            orchestrator: configuredKey.orchestrator_model_id,
            writers: configuredKey.writer_model_ids?.length || 0
          })
          
          setConfiguredModel({
            orchestrator: configuredKey.orchestrator_model_id,
            writerCount: configuredKey.writer_model_ids?.length || 0
          })
        } else {
          console.log('[CreateStoryPanel] ⚠️ No orchestrator found, defaulting to Auto-select')
          // No explicit configuration - will auto-select
          setConfiguredModel({
            orchestrator: 'Auto-select',
            writerCount: 0
          })
        }
      } else {
        console.log('[CreateStoryPanel] ❌ No API keys found')
        // No API keys configured
        setConfiguredModel({
          orchestrator: null,
          writerCount: 0
        })
      }
    } catch (err) {
      console.error('[CreateStoryPanel] Error fetching configuration:', err)
      setConfiguredModel({
        orchestrator: 'Error loading config',
        writerCount: 0
      })
    } finally {
      setLoadingConfig(false)
    }
  }

  const handleFormatClick = (format: StoryFormat) => {
    // Always select the format (no deselection - format is required)
    setSelectedFormat(format)
    setSelectedTemplate(null)
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
  }

  const handleCreateStory = () => {
    if (selectedFormat && selectedTemplate && !isCreating) {
      setIsCreating(true) // Prevent double-clicks
      onCreateStory(selectedFormat, selectedTemplate)
      
      // Reset after 2 seconds (allows user to create again if needed)
      setTimeout(() => {
        setIsCreating(false)
      }, 2000)
      
      // Keep panel open to watch orchestrator reasoning
      // setSelectedFormat(null) // Keep selection visible
      // setSelectedTemplate(null)
      // onClose() // Don't close - user wants to see streaming
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Orchestrator Header with Document View Toggle & New Chat */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Orchestrator</h3>
        <div className="flex items-center gap-2">
          {onToggleDocumentView && (
            <button
              onClick={onToggleDocumentView}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              title={isDocumentViewOpen ? 'Switch to Canvas View' : 'Switch to Document View'}
            >
              {isDocumentViewOpen ? (
                // Node/Network icon for Canvas View
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 100 4 2 2 0 000-4zM4 16a2 2 0 100 4 2 2 0 000-4zM18 16a2 2 0 100 4 2 2 0 000-4zM11 14a2 2 0 100 4 2 2 0 000-4zM11 8v4M6.5 17.5l3.5-2M14 17.5l-3.5-2" />
                </svg>
              ) : (
                // Document icon
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={() => {
              if (onClearChat) {
                onClearChat()
              }
            }}
            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
            title="New chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Active Context Display - Compact (only show when document view is open) */}
      {activeContext && isDocumentViewOpen && (
        <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg className="w-4 h-4 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="text-xs text-yellow-900 truncate">
              <span className="font-medium">Writing:</span> {activeContext.name}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (onAddChatMessage && activeContext) {
                  onAddChatMessage(`Write content for "${activeContext.name}"`)
                  onCreateStory(selectedFormat, selectedTemplate || undefined, `Write detailed content for "${activeContext.name}"`)
                }
              }}
              className="px-2 py-1 bg-yellow-200 hover:bg-yellow-300 text-yellow-900 rounded text-xs font-medium transition-colors"
              title="Write this section"
            >
              Write
            </button>
            <button
              onClick={onClearContext}
              className="p-1 hover:bg-yellow-200 rounded transition-colors"
              title="Clear context"
            >
              <svg className="w-3.5 h-3.5 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Thin Stacked Accordion Tiles */}
      <div className="border-b border-gray-200 bg-gray-50">
        {/* Model Tile */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => setIsModelPillExpanded(!isModelPillExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              <span className="text-xs font-medium text-gray-700">
                {loadingConfig ? 'Loading...' : (configuredModel?.orchestrator || 'Auto-select model')}
              </span>
            </div>
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isModelPillExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {/* Model Accordion Content */}
          {isModelPillExpanded && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">
              <div className="text-xs text-gray-600 mb-2">
                <span className="font-semibold">Orchestrator:</span> {configuredModel?.orchestrator || 'Auto-select best model'}
              </div>
              <div className="text-xs text-gray-600 mb-3">
                <span className="font-semibold">Writers:</span> {configuredModel?.writerCount || 0} models
              </div>
              <button
                onClick={() => router.push('/profile')}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
              >
                Change in Profile →
              </button>
            </div>
          )}
        </div>

        {/* Format Tile */}
        <div>
          <button
            onClick={() => setIsFormatPillExpanded(!isFormatPillExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-xs font-medium text-gray-700">
                {selectedFormat && selectedTemplate 
                  ? `${storyFormats.find(f => f.type === selectedFormat)?.label} - ${templates[selectedFormat].find(t => t.id === selectedTemplate)?.name}`
                  : selectedFormat 
                  ? storyFormats.find(f => f.type === selectedFormat)?.label
                  : 'Select format'}
              </span>
            </div>
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isFormatPillExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Orchestrator Reasoning - Center Stage */}
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          {/* Format Selection Accordion (expands when tile clicked) */}
          {isFormatPillExpanded && (
            <div className="mb-4 bg-white rounded-md border border-gray-200 shadow-sm animate-in slide-in-from-top-2 duration-200">
              <div className="p-4 max-h-96 overflow-y-auto">
                <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Choose Format & Template</h3>
                <div className="space-y-3">
                  {storyFormats.map((format) => {
                    const formatTemplates = templates[format.type]
                    const isSelected = selectedFormat === format.type
                    
                    return (
                      <div key={format.type} className="border border-gray-200 rounded-md overflow-hidden hover:border-gray-300 transition-colors">
                        <button
                          onClick={() => {
                            setSelectedFormat(format.type)
                            setSelectedTemplate(null)
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            isSelected ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className={`text-xl ${isSelected ? 'text-gray-700' : 'text-gray-400'}`}>
                            {format.icon}
                          </div>
                          <div className="flex-1">
                            <div className={`text-xs font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                              {format.label}
                            </div>
                            <div className="text-xs text-gray-500">{format.description}</div>
                          </div>
                          <svg 
                            className={`w-4 h-4 text-gray-400 transition-transform ${isSelected ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {isSelected && (
                          <div className="bg-gray-50 border-t border-gray-200 p-3 space-y-1.5">
                            <p className="text-xs font-medium text-gray-600 mb-2">Templates:</p>
                            {formatTemplates.map((template) => (
                              <button
                                key={template.id}
                                onClick={() => {
                                  setSelectedTemplate(template.id)
                                  setIsFormatPillExpanded(false)
                                  // Auto-create when template selected
                                  if (!isCreating) {
                                    handleCreateStory()
                                  }
                                }}
                                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                                  selectedTemplate === template.id
                                    ? 'bg-gray-700 text-white font-medium'
                                    : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-200'
                                }`}
                              >
                                {template.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto space-y-3">
            {reasoningMessages.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm font-medium">AI reasoning will appear here</p>
                <p className="text-xs mt-1">Watch the orchestrator think through your story structure</p>
              </div>
            ) : (
              reasoningMessages.map((msg, i) => {
                // Distinguish model reasoning from orchestrator messages
                const isModelMessage = msg.content.startsWith('🤖 Model reasoning:')
                const isLastMessage = i === reasoningMessages.length - 1
                
                const bgColor = 
                  isModelMessage ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500' :
                  msg.type === 'thinking' ? 'bg-purple-50 border-l-4 border-purple-400' :
                  msg.type === 'decision' ? 'bg-blue-50 border-l-4 border-blue-400' :
                  msg.type === 'task' ? 'bg-yellow-50 border-l-4 border-yellow-400' :
                  msg.type === 'result' ? 'bg-green-50 border-l-4 border-green-400' :
                  'bg-red-50 border-l-4 border-red-400'
                
                const icon = 
                  isModelMessage ? (
                    <svg className="w-3.5 h-3.5 text-indigo-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  ) :
                  msg.type === 'thinking' ? (
                    <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  ) :
                  msg.type === 'decision' ? (
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  ) :
                  msg.type === 'task' ? (
                    <svg className="w-3.5 h-3.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ) :
                  msg.type === 'result' ? (
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) :
                  (
                    <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )
                
                const label = isModelMessage ? 'MODEL' : msg.type.toUpperCase()
                
                return (
                  <div key={i} className={`p-3 rounded ${bgColor} ${isLastMessage && isStreaming ? 'animate-pulse' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-medium uppercase tracking-wide ${isModelMessage ? 'text-indigo-600 font-bold' : 'text-gray-500'}`}>
                            {label}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit' 
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                          {msg.content}
                          {/* Typing indicator for last message when streaming */}
                          {isLastMessage && isStreaming && (
                            <span className="inline-block ml-1 w-1.5 h-4 bg-indigo-600 animate-pulse" />
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          {/* Scroll target */}
          <div ref={reasoningEndRef} />
          </div>
        </div>
      </div>

      {/* Chat Input - Bottom */}
      <div className="border-t border-gray-200 bg-white p-4">
        <textarea
          ref={chatInputRef}
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (chatMessage.trim()) {
                await handleSendMessage(chatMessage)
              }
            }
          }}
          placeholder={activeContext 
            ? `Write about "${activeContext.name}"...` 
            : `Chat with the orchestrator (${selectedFormat.charAt(0).toUpperCase() + selectedFormat.slice(1).replace('-', ' ')})...`}
          rows={2}
          className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder-gray-400"
        />
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send • Shift+Enter for new line • Format: <span className="font-semibold text-gray-700">{selectedFormat.charAt(0).toUpperCase() + selectedFormat.slice(1).replace('-', ' ')}</span>
        </p>
      </div>
    </div>
  )
}
