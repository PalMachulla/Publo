# Intent System Architecture

## Overview
The orchestrator uses a **hybrid intent detection system** with three layers:

```
User Message
    ↓
1. Pattern Matching (intentRouter.ts)
    ↓ (if ambiguous)
2. LLM Analysis (llmIntentAnalyzer.ts)
    ↓
3. Action Generation (orchestratorEngine.ts)
    ↓
4. Action Execution (OrchestratorPanel.tsx)
```

---

## 1. Intent Types (Defined in `intentRouter.ts`)

```typescript
export type UserIntent = 
  | 'write_content'              // Write/expand content for selected section
  | 'answer_question'            // Ask about story/content
  | 'create_structure'           // Create new story structure
  | 'improve_content'            // Refine/edit existing content
  | 'modify_structure'           // Change story structure
  | 'rewrite_with_coherence'     // Rewrite + update related sections
  | 'open_and_write'             // Open existing canvas node for editing
  | 'delete_node'                // Delete/remove canvas node
  | 'clarify_intent'             // Need clarification
  | 'general_chat'               // General conversation
```

---

## 2. Pattern Matching (`intentRouter.ts`)

### Priority Order:

1. **Content Writing** (when segment selected)
   - Patterns: `write`, `expand`, `continue`, `add more`, etc.
   - Returns: `write_content`

2. **Delete Node** (canvas operations)
   - Patterns: `remove`, `delete`, `get rid of`, `trash`
   - Returns: `delete_node`

3. **Questions** (interrogatives)
   - Patterns: `what`, `why`, `how`, `?`, `explain`, `describe`
   - Returns: `answer_question`

4. **Open & Write** (open existing node)
   - Patterns: 
     - `open the novel`
     - `let's open the screenplay`
     - `work on the report`
     - `craft in that node`
     - `get content to my podcast`
   - Returns: `open_and_write`

5. **Create Structure** (new document)
   - Patterns: `create`, `make a`, `start a`, `new`
   - Returns: `create_structure`

6. **General Chat** (fallback)
   - Returns: `general_chat`

---

## 3. LLM Analysis (`llmIntentAnalyzer.ts`)

Used when:
- Pattern matching is ambiguous
- Message contains pronouns ("that", "it", "the one")
- Conversation context is needed
- User forces LLM mode

### System Prompt Guidelines:

```
Available Intents:
- write_content: User wants to write in SELECTED section
- answer_question: User asks a question
- create_structure: User wants NEW story structure
- improve_content: User wants to refine existing content
- modify_structure: User wants to change structure
- rewrite_with_coherence: Multi-section rewrite
- open_and_write: User wants to write in EXISTING canvas node
  * Use even if multiple nodes match (system handles clarification)
  * Do NOT use clarify_intent for opening
- delete_node: User wants to DELETE canvas node
  * Use even if multiple nodes match (system handles clarification)
  * Do NOT use clarify_intent for deletion
- clarify_intent: Unclear intent (NOT for opening/deletion)
- general_chat: General conversation
```

**CRITICAL:** LLM should NEVER return `clarify_intent` for `open_and_write` or `delete_node` - the orchestrator engine handles ambiguity.

---

## 4. Action Generation (`orchestratorEngine.ts`)

Maps intents to actions:

### `open_and_write` → Actions:

```typescript
case 'open_and_write': {
  // 1. Extract node type from message ("novel", "screenplay", etc.)
  // 2. Filter candidate nodes by type
  // 3. If 0 matches → error message
  // 4. If 1 match → open_document action
  // 5. If 2+ matches → request_clarification action
}
```

### `delete_node` → Actions:

```typescript
case 'delete_node': {
  // 1. Extract node type from message
  // 2. Filter candidate nodes by type
  // 3. If 0 matches → error message
  // 4. If 1 match → delete_node action
  // 5. If 2+ matches → request_clarification action
}
```

### Action Types:

```typescript
type OrchestratorAction =
  | { type: 'message', payload: { content, type } }
  | { type: 'open_document', payload: { nodeId, sectionId } }
  | { type: 'select_section', payload: { sectionId } }
  | { type: 'generate_content', payload: { sectionId, prompt } }
  | { type: 'modify_structure', payload: { action, format, prompt } }
  | { type: 'delete_node', payload: { nodeId, nodeName } }
  | { type: 'request_clarification', payload: { message, originalAction, options } }
```

---

## 5. Action Execution (`OrchestratorPanel.tsx`)

### Clarification Flow:

When `request_clarification` action is generated:

```typescript
case 'request_clarification':
  // 1. Create confirmation request with options
  const confirmation = {
    actionType: action.payload.originalAction, // 'open_and_write' or 'delete_node'
    confirmationType: 'clarification',
    message: action.payload.message,
    options: action.payload.options, // [{ id, label, description }]
    timestamp: Date.now()
  }
  
  // 2. Store in state
  setPendingConfirmation(confirmation)
  
  // 3. Display UI with buttons or text input
```

### User Response Handling:

```typescript
handleConfirmationResponse(response) {
  // 1. Match response to option (button click or natural language)
  // 2. Build appropriate action:
  
  if (originalAction === 'open_and_write') {
    action = {
      type: 'open_document',
      payload: { nodeId: selectedOption.id, sectionId: null }
    }
  }
  
  if (originalAction === 'delete_node') {
    action = {
      type: 'delete_node',
      payload: { nodeId: selectedOption.id, nodeName: selectedOption.label }
    }
  }
  
  // 3. Execute action
  executeAction(action)
}
```

---

## Example Flow: "Let's open the novel"

```
1. Pattern Matching (intentRouter.ts)
   ✓ Matches: /^let's (open|work on).*(the|my) (novel|screenplay)/i
   → Intent: open_and_write (confidence: 0.95)

2. Action Generation (orchestratorEngine.ts)
   - Extracts type: "novel"
   - Finds 2 Novel nodes on canvas
   → Action: request_clarification
     {
       message: "🤔 I found 2 novel node(s). Which one?",
       originalAction: "open_and_write",
       options: [
         { id: "node-1", label: "Novel", description: "79,200 words" },
         { id: "node-2", label: "Novel", description: "105,100 words" }
       ]
     }

3. UI Display (OrchestratorPanel.tsx)
   - Shows clarification UI with 2 buttons
   - User clicks "Novel (79,200 words)"

4. Response Handling (OrchestratorPanel.tsx)
   - Matches selectedOption.id = "node-1"
   → Action: open_document { nodeId: "node-1", sectionId: null }

5. Execution (OrchestratorPanel.tsx)
   - Calls onSelectNode("node-1", null)
   - Opens document view
   ✅ Done!
```

---

## Testing Checklist

- [ ] "Open the novel" → Shows clarification if 2+ novels
- [ ] "Delete the screenplay" → Shows clarification if 2+ screenplays
- [ ] "Let's work on the report" → Opens report (if 1 match)
- [ ] "Remove one of the novels" → Shows clarification
- [ ] Click button in clarification → Executes action
- [ ] Type "the one with 79,200 words" → Matches and executes
- [ ] Timeout (120s) → Clears confirmation, shows error

---

## Common Issues

### Issue: LLM returns `clarify_intent` instead of `open_and_write`
**Fix:** Update `llmIntentAnalyzer.ts` system prompt to explicitly instruct:
```
- Do NOT use clarify_intent for opening - always use open_and_write
```

### Issue: Pattern matching doesn't catch "open" commands
**Fix:** Add patterns to `intentRouter.ts`:
```typescript
/^(open|show|display).*(the|my) (novel|screenplay)/i
```

### Issue: Clarification shows all nodes, not just relevant type
**Fix:** In `orchestratorEngine.ts`, filter by extracted node type:
```typescript
if (targetType) {
  candidateNodes = candidateNodes.filter(n => n.nodeType.toLowerCase() === targetType)
}
```

### Issue: TypeScript error on `actionType === 'open_and_write'`
**Fix:** Cast to string:
```typescript
const originalAction = pendingConfirmation.actionType as string
```




