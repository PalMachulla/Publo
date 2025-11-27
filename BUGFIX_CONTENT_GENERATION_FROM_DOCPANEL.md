# Bug Fix: Content Generation from Document Panel
**Date:** November 26, 2025  
**Issues:** 
1. UI not updating automatically when content is saved
2. Content generation failing when requested from document panel

---

## 🐛 **Issue 1: UI Not Updating Automatically**

### Symptoms:
- Content is generated and saved to database
- Document panel doesn't show new content until page refresh or tab switch
- User has to manually refresh to see generated content

### Root Cause:
The document panel doesn't have real-time subscription to database changes. When agents save content via `/api/agent/save-content`, the UI isn't notified.

### Current Flow:
```
WriterAgent generates content
         ↓
saveAgentContent() → /api/agent/save-content
         ↓
Content saved to database
         ↓
❌ Document panel doesn't know about the update
         ↓
User has to refresh manually
```

### Solution Options:

#### **Option A: Polling (Simple)**
Add a polling mechanism to refresh sections every N seconds when document panel is open:

```typescript
// In AIDocumentPanel.tsx
useEffect(() => {
  if (!isOpen) return
  
  const interval = setInterval(() => {
    console.log('🔄 Auto-refreshing sections...')
    refreshSections()
  }, 5000) // Refresh every 5 seconds
  
  return () => clearInterval(interval)
}, [isOpen, refreshSections])
```

**Pros:** Simple, works immediately  
**Cons:** Inefficient, wastes resources

#### **Option B: Supabase Realtime (Optimal)**
Subscribe to database changes using Supabase realtime:

```typescript
// In AIDocumentPanel.tsx or useDocumentSections hook
useEffect(() => {
  if (!storyStructureNodeId) return
  
  const supabase = createClient()
  
  // Subscribe to changes on this node
  const channel = supabase
    .channel(`node-${storyStructureNodeId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'nodes',
        filter: `id=eq.${storyStructureNodeId}`
      },
      (payload) => {
        console.log('🔔 Node updated, refreshing sections...')
        refreshSections()
      }
    )
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}, [storyStructureNodeId, refreshSections])
```

**Pros:** Real-time, efficient  
**Cons:** Requires Supabase realtime setup

#### **Option C: Event Emitter (Intermediate)**
Emit an event when content is saved, listen in document panel:

```typescript
// In saveAgentContent.ts
if (saveResult.success) {
  window.dispatchEvent(new CustomEvent('content-saved', {
    detail: { nodeId: storyStructureNodeId, sectionId }
  }))
}

// In AIDocumentPanel.tsx
useEffect(() => {
  const handleContentSaved = (event: CustomEvent) => {
    if (event.detail.nodeId === storyStructureNodeId) {
      console.log('🔔 Content saved, refreshing...')
      refreshSections()
    }
  }
  
  window.addEventListener('content-saved', handleContentSaved)
  return () => window.removeEventListener('content-saved', handleContentSaved)
}, [storyStructureNodeId, refreshSections])
```

**Pros:** Works across components, no polling  
**Cons:** Only works within same browser tab

---

## 🐛 **Issue 2: Content Generation Failing from Document Panel**

### Symptoms:
```
PUBLO: "Write act 1"
RESULT: ✨ Generated 0 words (quality: 0/10, 1 iteration)
MESSAGE: "💡 I understood your intent (write_content) but couldn't generate specific actions"
```

### Root Cause Analysis:

Looking at your logs, the orchestrator correctly detects `write_content` intent, but then fails to generate actions. This happens in `orchestratorEngine.ts` line 714-825:

```typescript
case 'write_content': {
  let targetSectionId = request.activeContext?.id // ❌ PROBLEM: activeContext might be null
  
  // If no active context, try to detect section from message
  if (!targetSectionId && request.structureItems && request.structureItems.length > 0) {
    // Try to parse "act 1" or "Scene 1" from message
    const findSectionByName = (items, searchTerm) => { ... }
    
    // Try various patterns
    const ordinalPattern = /(?:first|second|third|1st|2nd|3rd)\s+(scene|act|sequence)/i
    // ... more patterns ...
  }
  
  if (!targetSectionId) {
    // ❌ NO SECTION FOUND - Return empty actions array
    console.warn('⚠️ Could not determine target section')
    break
  }
  
  // Generate action
  actions.push({
    type: 'generate_content',
    payload: { sectionId: targetSectionId, ... }
  })
}
```

### Why It Fails:

1. **"Write act 1"** - The pattern matching looks for "first act", "second act", etc., but not "act 1"
2. **"write into Scene 1"** - Similar issue, pattern expects "first scene", not "Scene 1"
3. **No active context** - If you haven't clicked on a section, `activeContext` is null

### The Fix:

We need to improve the section detection logic to handle:
- "act 1", "act 2", "act 3" (numeric)
- "Scene 1", "Scene 2" (numeric with capital S)
- "chapter 1", "section 1" (numeric)

**File:** `frontend/src/lib/orchestrator/core/orchestratorEngine.ts`  
**Location:** Lines 767-825

**Add this pattern BEFORE the ordinal pattern:**

```typescript
// ✅ NEW: Handle numeric references (act 1, scene 2, chapter 3, etc.)
const numericPattern = /(act|scene|chapter|section|sequence|beat)\s+(\d+)/i
const numericMatch = request.message.match(numericPattern)

if (numericMatch) {
  const type = numericMatch[1].toLowerCase()
  const number = parseInt(numericMatch[2], 10)
  
  console.log(`🔍 [write_content] Detected numeric reference: ${type} ${number}`)
  
  // Find matching section by name pattern
  const matchingSections = request.structureItems.filter((item: any) => {
    const itemName = item.name?.toLowerCase() || ''
    
    // Match by type and number
    if (type === 'act') {
      // Match "Act I", "Act 1", "ACT I", etc.
      return /^act\s+(i+|[0-9]+)/i.test(item.name || '')
    } else if (type === 'scene') {
      // Match "Scene 1", "SCENE 1:", etc.
      return /scene\s+(\d+|[ivx]+)/i.test(item.name || '')
    } else if (type === 'chapter') {
      // Match "Chapter 1", "Ch. 1", etc.
      return /(chapter|ch\.?)\s+(\d+|[ivx]+)/i.test(item.name || '')
    }
    
    // Generic match for other types
    return itemName.includes(type) && itemName.includes(number.toString())
  })
  
  if (matchingSections.length > 0) {
    // Use the first matching section
    const targetSection = matchingSections[0]
    targetSectionId = targetSection.id
    console.log(`✅ [write_content] Found section: ${targetSection.name} (ID: ${targetSectionId})`)
  } else {
    console.warn(`⚠️ [write_content] No section found matching "${type} ${number}"`)
  }
}
```

### Alternative: Always Set Active Context

Another approach is to ensure `activeContext` is ALWAYS set when the document panel is open:

**File:** `frontend/src/components/panels/AIDocumentPanel.tsx`  
**Location:** After line 372

```typescript
// ✅ NEW: Auto-set context to first section if none selected
useEffect(() => {
  if (isOpen && !activeSectionId && structureItems.length > 0 && onSetContext) {
    const firstItem = structureItems[0]
    console.log('📍 [AIDocumentPanel] Auto-setting context to first section:', firstItem.name)
    setActiveSectionId(firstItem.id)
    onSetContext({
      type: 'section',
      id: firstItem.id,
      name: firstItem.name,
      level: firstItem.level
    })
  }
}, [isOpen, activeSectionId, structureItems, onSetContext])
```

This ensures that when you open the document panel, the first section is automatically selected, so "Write act 1" would write to the currently selected section.

---

## 🎯 **Recommended Implementation Order**

### Phase 1: Fix Content Generation (High Priority)
1. Add numeric pattern matching to `orchestratorEngine.ts`
2. Test: "Write act 1", "write into Scene 1" should work

### Phase 2: Fix UI Updates (Medium Priority)
1. Implement Option C (Event Emitter) for immediate fix
2. Later upgrade to Option B (Supabase Realtime) for production

### Phase 3: Improve UX (Low Priority)
1. Auto-select first section when document opens
2. Add visual indicator showing which section is active
3. Add "Generating..." spinner in document panel

---

## 🧪 **Testing Plan**

### Test 1: Numeric Section References
```
User: "Write act 1"
Expected: Content generated for "Act I - Setup"
```

### Test 2: Scene References
```
User: "write into Scene 1"
Expected: Content generated for first scene
```

### Test 3: UI Auto-Update
```
1. Open document panel
2. Request content generation from orchestrator panel
3. Expected: Document panel updates automatically when content is saved
```

---

## 📝 **Implementation Code**

I'll prepare the exact code changes in the next message. For now, this document outlines the issues and solutions.

---

**Status:** ⏳ Ready to implement

**Priority:** HIGH - Users can't generate content from document panel

**Estimated Time:** 30 minutes for both fixes

