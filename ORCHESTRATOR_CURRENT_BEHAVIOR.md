# Orchestrator Current Behavior Documentation

**File:** `frontend/src/lib/orchestrator/core/orchestratorEngine.ts`  
**Size:** 3214 lines  
**Purpose:** Main orchestration logic for analyzing user intent and generating actions  
**Date:** 2025-11-27

---

## Overview

The OrchestratorEngine is the central component that:
1. Receives user messages and canvas state
2. Analyzes intent using LLM
3. Generates appropriate actions
4. Manages conversation history via Blackboard
5. Coordinates with WorldState for document management

---

## Entry Points

### 1. Main orchestrate() Method

**Location:** Lines ~250-443  
**Signature:**
```typescript
async orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse>
```

**Input:** `OrchestratorRequest`
- `message`: string - User's message
- `canvasNodes`: Node[] - React Flow nodes on canvas
- `canvasEdges`: Edge[] - React Flow edges
- `activeContext`: object | null - Currently selected section
- `structureItems`: StoryStructureItem[] - Document structure
- `contentMap`: Map<string, string> - Section content
- `currentStoryStructureNodeId`: string | null - Active document ID
- `documentFormat`: StoryFormat - Document type (novel, screenplay, etc.)
- `modelMode`: 'auto' | 'fixed' - Model selection mode
- `fixedModeStrategy`: string - Strategy when in fixed mode

**Output:** `OrchestratorResponse`
- `intent`: UserIntent - Detected intent type
- `confidence`: number - Confidence score (0-1)
- `reasoning`: string - LLM's reasoning
- `modelUsed`: string - Model ID used
- `actions`: OrchestratorAction[] - Actions to execute
- `canvasChanged`: boolean - Whether canvas state changed
- `requiresUserInput`: boolean - Whether clarification needed
- `estimatedCost`: number - Estimated API cost
- `thinkingSteps`: object[] - Detailed thinking process

**Flow:**
1. Build canvas context from nodes/edges
2. Analyze intent using LLM
3. Select appropriate model for task
4. Generate actions based on intent
5. Execute tools if available (Phase 2)
6. Update blackboard with conversation
7. Learn patterns if enabled
8. Return response

---

### 2. Intent Analysis

**Location:** Uses external `analyzeIntent()` from `intentRouter`  
**Called at:** Line ~270

**Process:**
1. Builds conversation history from Blackboard
2. Formats canvas context for LLM
3. Calls LLM with structured output
4. Returns `IntentAnalysis` object

**Intent Types:**
- `answer_question` - User asking about canvas/stories
- `write_content` - User wants to write specific section
- `create_structure` - User wants to create new document
- `open_document` - User wants to open existing document
- `delete_node` - User wants to delete a node
- `navigate_section` - User wants to select different section
- `request_clarification` - Orchestrator needs more info
- `modify_structure` - User wants to change structure

---

### 3. Action Generation

**Location:** Lines 679-1800+  
**Method:** `generateActions()`

**Signature:**
```typescript
private async generateActions(
  intent: IntentAnalysis,
  request: OrchestratorRequest,
  canvasContext: CanvasContext,
  ragContext: any,
  modelSelection: any,
  validatedFixedModelId: string | null,
  availableModels?: TieredModel[]
): Promise<OrchestratorAction[]>
```

**Structure:** Massive switch statement handling each intent type

---

## Intent Cases Detailed

### Case 1: answer_question (Lines 691-738)

**Purpose:** Answer user questions about canvas content

**Logic:**
1. Build enhanced prompt with user question
2. Include ALL canvas nodes with their context:
   - Node label and type
   - Summary
   - Structure (if story node)
   - Content (first 5 sections, truncated to 500 chars each)
3. Add RAG content if available
4. Return `generate_content` action with enhanced prompt

**Dependencies:**
- `canvasContext.connectedNodes` - All nodes on canvas
- `ragContext` - RAG search results (optional)
- `modelSelection.modelId` - Selected model

**Action Generated:**
```typescript
{
  type: 'generate_content',
  payload: {
    prompt: enhancedPrompt,
    model: modelSelection.modelId,
    isAnswer: true
  },
  status: 'pending'
}
```

**Example Prompts:**
- "What is this app?"
- "Tell me about this story"
- "Compare these two stories"

---

### Case 2: write_content (Lines 741-1140)

**Purpose:** Generate content for a specific section

**Logic:**
1. Determine target section from:
   - Active context (currently selected section)
   - Message parsing (numeric: "Chapter 1", ordinal: "first chapter", name: "prologue")
2. Validate section exists in structure
3. Check if section already has content
4. Build action with section context

**Section Detection Strategies:**

**Numeric Detection** (e.g., "Write Chapter 1", "Act 2"):
- Regex: `/(?:write|fill|complete|do)\s+(?:the\s+)?(\w+)\s+(\d+)/i`
- Extracts type (chapter, act, scene) and number
- Finds matching section in structure

**Ordinal Detection** (e.g., "Write the first chapter"):
- Regex: `/(?:write|fill)\s+(?:the\s+)?(first|second|third|1st|2nd|3rd)/i`
- Converts ordinal to number
- Finds nth section of specified type

**Name-Based Detection** (e.g., "Write the prologue"):
- Fuzzy matching on section names
- Normalizes text (removes numbers, punctuation)
- Partial match support

**Override Behavior:**
- Message-based detection ALWAYS overrides active context
- Allows "Write Chapter 1" even if Prologue is selected

**Dependencies:**
- `request.structureItems` - Document structure
- `request.activeContext` - Currently selected section
- `request.message` - User message for parsing

**Action Generated:**
```typescript
{
  type: 'generate_content',
  payload: {
    sectionId: targetSectionId,
    sectionName: sectionName,
    prompt: request.message,
    model: modelSelection.modelId,
    autoStart: true
  },
  status: 'pending'
}
```

**Edge Cases:**
- No structure items → Error message
- Section not found → Lists available sections
- Section already has content → Warning but proceeds

---

### Case 3: create_structure (Lines 1142-1750)

**Purpose:** Create new document structure

**Logic:**
1. Validate document format
2. Check format conventions (e.g., short story uses scenes, not chapters)
3. Call `createStructurePlan()` for LLM structure generation
4. Validate structure plan
5. Generate tasks for content generation (if requested)

**Format Validation:**
- Uses `documentHierarchy.ts` for format conventions
- Educates user if wrong terminology used
- Example: "Short stories use scenes, not chapters. Did you mean Scene 1?"

**Structure Generation:**
- Calls `createStructurePlan()` method (lines 2100-2500)
- Uses format-specific system prompts from `formatPrompts.ts`
- Returns hierarchical structure with sections and summaries

**Dependencies:**
- `request.documentFormat` - Format type (novel, screenplay, etc.)
- `request.message` - User's creative prompt
- `modelSelection.modelId` - Model for structure generation
- `DOCUMENT_HIERARCHY` - Format conventions

**Actions Generated:**
```typescript
[
  {
    type: 'generate_structure',
    payload: {
      plan: structurePlan,
      format: request.documentFormat
    },
    status: 'completed'
  },
  // Optional: generate_content actions for requested sections
  {
    type: 'generate_content',
    payload: {
      sectionId: 'section-id',
      sectionName: 'Section Name',
      prompt: 'Write...',
      autoStart: true
    },
    status: 'pending'
  }
]
```

**Task Complexity Analysis:**
- Analyzes if user wants BOTH structure AND content
- Uses LLM to detect multi-step requests
- Example: "Write a novel about dragons, write chapter 1" → structure + content

---

### Case 4: open_document (Lines ~1750-1800)

**Purpose:** Open an existing document node

**Logic:**
1. Find node by name or ID
2. Fuzzy matching on node labels
3. Return action to open document panel

**Dependencies:**
- `canvasContext.connectedNodes` - Available nodes

**Action Generated:**
```typescript
{
  type: 'open_document',
  payload: {
    nodeId: foundNode.id,
    nodeName: foundNode.label
  },
  status: 'completed'
}
```

---

### Case 5: delete_node (Lines 1755+)

**Purpose:** Delete a node from canvas

**Logic:**
1. Detect node type from message
2. Find matching node
3. Return delete action

**Dependencies:**
- `canvasContext.connectedNodes` - Available nodes

**Action Generated:**
```typescript
{
  type: 'delete_node',
  payload: {
    nodeId: nodeId
  },
  status: 'pending'
}
```

---

## Dependencies Map

### Global Dependencies

**canvasContext** (CanvasContext)
- `connectedNodes`: Node[] - All nodes on canvas
- `edges`: Edge[] - Connections between nodes
- `selectedNode`: Node | null - Currently selected node

**ragContext** (any)
- `hasRAG`: boolean - Whether RAG search was performed
- `ragContent`: string - Relevant content from RAG

**modelSelection** (ModelSelection)
- `modelId`: string - Selected model ID
- `tier`: string - Model tier (frontier, advanced, fast)
- `estimatedCost`: number - Estimated API cost

**request** (OrchestratorRequest)
- `message`: string - User message
- `structureItems`: StoryStructureItem[] - Document structure
- `activeContext`: object | null - Selected section
- `currentStoryStructureNodeId`: string | null - Active document
- `documentFormat`: StoryFormat - Document type

**this.blackboard** (Blackboard)
- Conversation history
- Pattern learning
- Agent coordination (Phase 3)

**this.worldState** (WorldStateManager) - Phase 1
- Unified state management
- Document content
- Canvas state

**this.toolRegistry** (ToolRegistry) - Phase 2
- Tool execution
- Action delegation

---

## Key Methods

### createStructurePlan() (Lines 2100-2500)

**Purpose:** Generate hierarchical document structure using LLM

**Process:**
1. Select model based on complexity
2. Get format-specific system prompt
3. Call LLM with structured output
4. Parse and validate structure
5. Return StructurePlan object

**Structured Output:**
- Uses OpenAI/Groq JSON schema validation
- Ensures consistent structure format
- Validates required fields

---

### validateFormatConventions() (Lines ~1800-1900)

**Purpose:** Check if user's request aligns with document format conventions

**Process:**
1. Get primary structural level from documentHierarchy
2. Compare with user's requested section type
3. Return educational message if mismatch

**Example:**
- User: "Write a short story, chapter 1"
- Response: "Short stories typically use scenes rather than chapters. Did you mean Scene 1?"

---

### analyzeTaskComplexity() (Lines ~650-750)

**Purpose:** Determine if user wants multiple steps (structure + content)

**Process:**
1. Build LLM prompt with user message and context
2. Ask: "Does user want BOTH structure AND content?"
3. Parse structured response
4. Return analysis with target sections

**Used For:**
- Detecting multi-step requests
- Determining which sections to generate
- Coordinating structure + content creation

---

## Data Flow

```
User Message
    ↓
orchestrate(request)
    ↓
buildCanvasContext(nodes, edges)
    ↓
analyzeIntent(message, context, history)
    ↓
selectModel(intent, complexity)
    ↓
generateActions(intent, request, context)
    ↓
    ├─→ answer_question → generate_content action
    ├─→ write_content → generate_content action (with section)
    ├─→ create_structure → generate_structure + generate_content actions
    ├─→ open_document → open_document action
    └─→ delete_node → delete_node action
    ↓
executeToolsIfAvailable(actions) [Phase 2]
    ↓
updateBlackboard(message, response)
    ↓
Return OrchestratorResponse
```

---

## State Management

### Blackboard
- Stores conversation history
- Tracks agent state (Phase 3)
- Learns patterns
- Records actions and metrics

### WorldState (Phase 1)
- Unified state for canvas and documents
- Observable state changes
- Version tracking

### Tool Registry (Phase 2)
- Maps actions to executable tools
- Handles tool execution
- Updates WorldState

---

## Phase Integration

### Phase 1: WorldState
- Unified state management
- Observable state changes
- Document content management

### Phase 2: Tools
- Tool-based action execution
- Immediate execution vs deferred
- WorldState updates

### Phase 3: Multi-Agent
- Agent coordination via Blackboard
- DAG execution for parallel tasks
- Writer-Critic clusters

---

## Known Issues & Limitations

1. **Monolithic File:** 3214 lines in single file
2. **Large Switch Statement:** 1100+ lines in generateActions()
3. **Mixed Concerns:** Intent analysis, action generation, structure creation all together
4. **Hard to Test:** Cannot test individual actions in isolation
5. **Hard to Extend:** Adding new intent requires modifying large switch statement
6. **Deep Nesting:** Complex if-else chains for section detection

---

## Future Refactoring Goals

See `ORCHESTRATOR_ARCHITECTURE_CURRENT.md` for detailed refactoring plan.

**Target:**
- Extract actions into separate files (< 400 lines each)
- Extract intent analysis into separate module
- Extract structure generation into separate module
- Reduce orchestratorEngine.ts to ~300 lines (coordinator only)

