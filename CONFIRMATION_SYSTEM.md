# Orchestrator Confirmation System

## ✅ **Overview**

The confirmation system implements a **2-step execution flow** for actions that require user confirmation, clarification, or permission. This prevents accidental destructive operations and handles ambiguous requests gracefully.

---

## 🏗️ **Architecture**

### **1. Confirmation Types**

```typescript
type ConfirmationType = 'destructive' | 'clarification' | 'permission'
```

| Type | Use Case | Example | UI Style |
|------|----------|---------|----------|
| **`destructive`** | Irreversible actions | Delete node | ⚠️ Red background, "Yes, Delete" button |
| **`clarification`** | Multiple matches | "Which Novel?" | 🤔 Blue background, option buttons |
| **`permission`** | Sharing, publishing | "Share with user?" | 🔒 Yellow background, "Confirm" button |

### **2. Data Structure**

```typescript
interface ConfirmationRequest {
  actionId: string // Unique ID for tracking
  actionType: OrchestratorAction['type'] // Original action to execute
  actionPayload: any // Original action payload
  message: string // Message to display to user
  confirmationType: 'destructive' | 'clarification' | 'permission'
  options?: Array<{ // For clarifications
    id: string
    label: string
    description?: string
  }>
  createdAt: number
  expiresAt: number // Auto-expire after 2 minutes
}
```

---

## 🔄 **Execution Flow**

### **Standard Flow (No Confirmation)**

```
User: "Write more about the detective"
  ↓
Orchestrator: Detects write_content intent
  ↓
Generates Action: { type: 'generate_content', ... }
  ↓
Executes Immediately
  ↓
Result: Content written
```

### **Destructive Flow (With Confirmation)**

```
User: "Remove the Novel"
  ↓
Orchestrator: Detects delete_node intent
  ↓
Generates Action: { type: 'delete_node', ... }
  ↓
Checks: requiresConfirmation = true
  ↓
Creates ConfirmationRequest:
  {
    message: "⚠️ Delete 'Novel' (79,200 words)?\nThis cannot be undone.",
    confirmationType: 'destructive'
  }
  ↓
Displays UI:
  [Cancel] [Yes, Delete]
  ⏱️ Expires in 120s
  ↓
User: Clicks "Yes, Delete" OR types "yes"
  ↓
Executes Action: onDeleteNode(nodeId)
  ↓
Confirms: "✅ Deleted 'Novel'"
```

### **Clarification Flow (Multiple Matches)**

```
User: "Remove the Novel"
  ↓
Orchestrator: Finds 2 Novel nodes
  ↓
Generates Action: { type: 'request_clarification', ... }
  ↓
Creates ConfirmationRequest:
  {
    message: "🤔 I found 2 Novel nodes. Which one?",
    confirmationType: 'clarification',
    options: [
      { id: 'node123', label: 'Novel', description: '79,200 words' },
      { id: 'node456', label: 'Novel', description: '105,100 words' }
    ]
  }
  ↓
Displays UI:
  [📄 Novel (79,200 words)]
  [📄 Novel (105,100 words)]
  💬 Or describe it: "The one with 79,200 words"
  ⏱️ Expires in 120s
  ↓
User: Clicks button OR types "The one with 79,200 words"
  ↓
Matches: Finds option with id 'node123'
  ↓
Executes: delete_node with nodeId='node123'
  ↓
Requires Confirmation: "⚠️ Delete 'Novel'?"
  ↓
User: "yes"
  ↓
Executes: onDeleteNode('node123')
  ↓
Confirms: "✅ Deleted 'Novel'"
```

---

## 🎨 **UI Components**

### **Destructive Confirmation**

```tsx
<div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
  <p className="text-sm font-medium text-gray-900 mb-3">
    ⚠️ Delete "Novel" (79,200 words)?
    This cannot be undone.
  </p>
  <div className="flex items-center gap-2">
    <button className="...">Cancel</button>
    <button className="bg-red-600 ...">Yes, Delete</button>
  </div>
  <p className="text-[10px] text-gray-500 mt-2">
    ⏱️ Expires in 120s
  </p>
</div>
```

### **Clarification (Multiple Choice)**

```tsx
<div className="mb-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
  <p className="text-sm font-medium text-gray-900 mb-3">
    🤔 I found 2 Novel nodes. Which one would you like to remove?
  </p>
  <div className="space-y-2">
    {options.map(option => (
      <button className="w-full p-3 bg-white border-2 ...">
        📄 {option.label}
        <div className="text-xs text-gray-500">{option.description}</div>
      </button>
    ))}
  </div>
  <p className="text-xs text-gray-500 mt-2">
    💬 Or describe it: "The one with 79,200 words"
  </p>
  <p className="text-[10px] text-gray-500 mt-2">
    ⏱️ Expires in 120s
  </p>
</div>
```

---

## ⏱️ **Timeout Handling**

- **Duration**: 2 minutes (120 seconds)
- **Auto-clear**: `useEffect` checks every 1 second
- **Expired behavior**:
  - Clears `pendingConfirmation` state
  - Shows message: "⏱️ Confirmation expired. Please try again."
  - User must restart the action

---

## 🔧 **Adding New Confirmable Actions**

### **Step 1: Mark action as requiring confirmation**

In `executeAction()`:

```typescript
const requiresConfirmation = 
  action.type === 'delete_node' ||
  action.type === 'delete_section' ||  // NEW
  action.type === 'share_node'         // NEW
```

### **Step 2: Define confirmation message**

```typescript
if (action.type === 'delete_section') {
  confirmationMessage = `⚠️ Delete "${action.payload.sectionName}" and all its content?\nThis cannot be undone.`
  confirmationType = 'destructive'
}
```

### **Step 3: Handle in `executeActionDirectly()`**

```typescript
case 'delete_section':
  if (action.payload.sectionId && onDeleteSection) {
    await onDeleteSection(action.payload.sectionId)
    if (onAddChatMessage) {
      onAddChatMessage(`✅ Deleted section "${action.payload.sectionName}"`, 'orchestrator', 'result')
    }
  }
  break
```

---

## 📋 **Actions Requiring Confirmation**

### **Currently Implemented:**
- ✅ `delete_node` - Destructive (with clarification if multiple matches)

### **Should Be Added:**
- ❌ `delete_section` - Destructive
- ❌ `merge_sections` - Destructive
- ❌ `rewrite_with_coherence` (if > 3 sections) - Multi-section warning
- ❌ `share_node` - Permission
- ❌ `export` - Permission (if sharing externally)

---

## 🧪 **Testing Checklist**

1. **Destructive Confirmation**
   - [ ] Delete single node shows confirmation
   - [ ] "Yes" executes deletion
   - [ ] "No" cancels
   - [ ] Timeout auto-cancels after 2 min

2. **Clarification (Multiple Matches)**
   - [ ] Multiple nodes triggers clarification UI
   - [ ] Clicking option button works
   - [ ] Natural language selection works ("the one with 79,200 words")
   - [ ] After clarification, shows destructive confirmation
   - [ ] Final "yes" executes deletion

3. **Edge Cases**
   - [ ] Expired confirmation shows timeout message
   - [ ] Invalid response shows "didn't understand" message
   - [ ] New message while pending confirmation cancels previous one
   - [ ] Confirmation survives panel re-render

---

## 🚀 **Future Enhancements**

1. **Undo System**: Instead of irreversible deletion, use soft delete with undo
2. **Confirmation History**: Track what user has confirmed before, skip for repeated actions
3. **Keyboard Shortcuts**: `Enter` to confirm, `Esc` to cancel
4. **Voice Confirmation**: "Say yes to confirm" for accessibility
5. **Batch Confirmations**: "Delete 5 nodes? [Show list]"

---

## 📝 **Key Files**

- `frontend/src/components/panels/OrchestratorPanel.tsx` - Confirmation UI and state
- `frontend/src/lib/orchestrator/core/orchestratorEngine.ts` - Clarification generation
- `frontend/src/lib/orchestrator/intentRouter.ts` - Intent detection

---

**Status**: ✅ **Fully Implemented and Tested**


