# Initial Content Fix - Empty Sections Enhancement

## Problem
Empty sections in the document view were displaying editable HTML elements and had no helpful guidance for users or writer agents.

## Solution
We've implemented **smart initial content** that:

1. **Uses summaries as context** - When a structure item has a summary, it's displayed as italicized guidance
2. **Provides format-specific templates** - Screenplay scenes get proper formatting hints
3. **Guides both users and agents** - The placeholder content helps writer agents understand what to write
4. **Prevents editable HTML** - Uses pure markdown instead of HTML tags

## Changes Made

### 1. AIDocumentPanel.tsx (Line 456-466)
**Before:**
```typescript
const headingWithId = `<h${headerLevel} id="section-${itemId}" style="scroll-margin-top: 20px;">${headerText}</h${headerLevel}>`
```

**After:**
```typescript
// ✅ Use markdown headers with HTML comment for ID (prevents editable HTML)
const headingWithId = `<!-- section-id: ${itemId} -->\n${headerTag} ${headerText}`
```

### 2. useDocumentSections.ts (Lines 81-104)
**Added helper function:**
```typescript
const generateInitialContent = (item: StoryStructureItem): string => {
  const headerLevel = Math.min(item.level, 3)
  const headerTag = '#'.repeat(headerLevel)
  
  let placeholder = ''
  
  // Use summary if available (provides context for writers)
  if (item.summary && item.summary.trim().length > 0) {
    placeholder = `*${item.summary}*\n\n---\n\n[Click above to start writing this section]`
  } else {
    // Fallback based on section type
    const nameLower = item.name.toLowerCase()
    
    if (nameLower.includes('scene')) {
      placeholder = `**INT./EXT. [LOCATION] - [TIME]**\n\n[Scene description]\n\n**CHARACTER**\n(action)\nDialogue here.`
    } else if (nameLower.includes('act') || nameLower.includes('chapter')) {
      placeholder = `*This ${nameLower.includes('act') ? 'act' : 'chapter'} will...*\n\n[Start writing here]`
    } else {
      placeholder = `[Click to start writing]`
    }
  }
  
  return `${headerTag} ${item.name}\n\n${placeholder}`
}
```

**Updated section initialization (Line 117):**
```typescript
content: generateInitialContent(item), // ✅ Use helper function with summary
```

## Benefits

### For Users:
- **Clear guidance** - Empty sections show helpful templates
- **Professional appearance** - Looks like a real document from the start
- **No confusing HTML** - Everything is clean markdown

### For Writer Agents:
- **Context from summaries** - Agents see the intended content via summaries
- **Format awareness** - Screenplay scenes get proper formatting hints
- **Better content generation** - Agents understand what to write based on placeholders

### Example Output

**For a scene with summary:**
```markdown
<!-- section-id: scene-1 -->
## Scene 1 - EXT. COASTAL TOWN HARBOR - DAWN

*Introduce the coastal setting, the fishing community, and early hints that something is wrong with the seagull population.*

---

[Click above to start writing this section]
```

**For a scene without summary:**
```markdown
<!-- section-id: scene-2 -->
## Scene 2 - EXT. FISHING DOCK - MORNING

**INT./EXT. [LOCATION] - [TIME]**

[Scene description]

**CHARACTER**
(action)
Dialogue here.
```

**For an act with summary:**
```markdown
<!-- section-id: act-1 -->
# Act 1 - Setup

*Establish the world, introduce the protagonist, and set up the central conflict.*

---

[Click above to start writing this section]
```

## How It Works in the Flow

1. **Structure Generation** - Orchestrator creates structure with summaries
2. **Section Initialization** - `useDocumentSections` creates sections with smart placeholders
3. **Writer Agent Context** - When writing, agents see:
   - The section name
   - The summary (as placeholder content)
   - The overall story context
4. **Content Generation** - Agents write content that replaces the placeholder
5. **User Experience** - Users see professional templates and can start writing immediately

## Testing

To test this:
1. Create a new screenplay: "Screenplay about a halibut eating seagulls, write act 1"
2. Open the document view
3. Check that empty scenes show helpful placeholders
4. Verify that summaries appear as italicized guidance
5. Confirm that clicking a section doesn't open an editable HTML element

## Related Files
- `frontend/src/components/panels/AIDocumentPanel.tsx` - Document rendering
- `frontend/src/hooks/useDocumentSections.ts` - Section initialization
- `frontend/src/lib/orchestrator/agents/WriterAgent.ts` - Uses this content as context

