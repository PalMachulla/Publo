# Story Structure Generation System - Complete Guide

## Overview

This document explains how the story structure generation system works in Publo, including all the interconnected components, data flow, and where structure templates are defined.

**Last Updated**: 2025-11-15  
**Status**: ✅ Proportional Word Count System Active

---

## 🎯 The Problem That Was Fixed

### Original Issue
The story structure generation had **TWO SEPARATE implementations**:
1. ✅ `StoryStructurePanel.tsx` - Had NEW proportional templates (CORRECT)
2. ❌ `NodeDetailsPanel.tsx` - Had OLD equal-division logic (INCORRECT - **THIS WAS THE BUG**)

When users clicked "Generate Structure" in the **right panel** (NodeDetailsPanel), it was using the old code that divided everything equally with 5000-word segments.

### The Fix
Updated `NodeDetailsPanel.tsx` to use the same proportional templates as `StoryStructurePanel.tsx`.

---

## 📁 File Architecture

### 1. **Type Definitions**
**File**: `/frontend/src/types/nodes.ts`

Defines the core data structure:
```typescript
export interface StoryStructureItem {
  id: string
  level: number          // 1, 2, 3, etc.
  parentId?: string      // For hierarchical nesting
  name: string           // "Act 1", "Chapter 1", etc.
  title: string
  description: string
  order: number          // Position among siblings
  completed: boolean
  content: string
  expanded?: boolean
  wordCount?: number     // 🔑 KEY: Proportional word counts
  backgroundColor?: string
  assignedAgentId?: string | null
  assignedAgentColor?: string | null
}
```

### 2. **Structure Templates** (CRITICAL)
**Files**: 
- `/frontend/src/components/panels/StoryStructurePanel.tsx` (lines 55-284)
- `/frontend/src/components/panels/NodeDetailsPanel.tsx` (lines 35-264)

**⚠️ IMPORTANT**: These templates MUST be kept in sync!

The templates define realistic, hierarchical structures with **proportional word counts**:

```typescript
const structureTemplates: Record<string, any> = {
  'screenplay': {
    level1: [
      { name: 'Act 1', wordCount: 3750, children: [...] },  // 25%
      { name: 'Act 2', wordCount: 7500, children: [...] },  // 50%
      { name: 'Act 3', wordCount: 3750, children: [...] }   // 25%
    ]
  },
  'novel': { ... },
  'short-story': { ... },
  'podcast': { ... },
  'article': { ... },
  'essay': { ... },
  'report': { ... }
}
```

**Key Principle**: Child word counts MUST sum to parent word count.

---

## 🔄 Data Flow

### When Creating a New Story Structure Node

```
User clicks "Create Format" in StoryFormatMenu
         ↓
canvas/page.tsx → handleCreateStoryFormat()
         ↓
Creates new StoryStructureNode with empty items: []
         ↓
Node appears on canvas with "No Structure Yet" message
         ↓
User clicks "Generate Structure" button
         ↓
NodeDetailsPanel.tsx → onClick handler (line ~459)
         ↓
Uses structureTemplates to recursively generate items
         ↓
Calls onUpdate(node.id, { items: newItems })
         ↓
canvas/page.tsx → handleNodeUpdate()
         ↓
Updates local state and saves to Supabase
         ↓
StructureTrackLane.tsx receives items prop
         ↓
Renders segments proportionally using getSegmentMetrics()
```

### Where Structure is Generated

| Location | Function | When Used |
|----------|----------|-----------|
| **NodeDetailsPanel.tsx** | Generate button onClick | When clicking "Generate Structure" in right panel ✅ |
| **StoryStructurePanel.tsx** | handleGenerateStructure() | When clicking "Generate" in old left panel (rarely used) |

**🚨 CRITICAL**: Both must use the same `structureTemplates`!

---

## 🎨 Rendering: Proportional Segments

### File: `/frontend/src/components/nodes/narrationline/StructureTrackLane.tsx`

The `getSegmentMetrics()` function calculates segment widths **proportionally** based on word count:

```typescript
const getSegmentMetrics = (item: StoryStructureItem) => {
  const wordCount = item.wordCount || 1000
  
  if (item.parentId) {
    // Child item - calculate proportional width within parent
    const parentMetrics = getParentMetrics(item.parentId)
    const siblings = items.filter(i => i.parentId === item.parentId)
    const totalSiblingsWordCount = siblings.reduce((sum, s) => sum + (s.wordCount || 1000), 0)
    
    // This child's proportional width
    const proportion = wordCount / totalSiblingsWordCount
    const itemWidth = parentMetrics.width * proportion
    
    // Calculate start position
    const siblingIndex = siblings.findIndex(s => s.id === item.id)
    let offset = 0
    for (let i = 0; i < siblingIndex; i++) {
      const siblingProportion = (siblings[i].wordCount || 1000) / totalSiblingsWordCount
      offset += parentMetrics.width * siblingProportion
    }
    const startPos = parentMetrics.start + offset
    
    return { 
      startPosition: startPos * pixelsPerUnit, 
      width: itemWidth * pixelsPerUnit 
    }
  }
  
  // Top-level item - sequential layout
  // ... similar logic ...
}
```

**Key Insight**: Higher-level segments are the **sum** of their children. Child segments are **proportional fractions** of their parent.

---

## 📝 Narration Arrangement View

### File: `/frontend/src/components/nodes/narrationline/NarrationContainer.tsx`

This is the main container for the timeline view (formerly "Narration Line").

**Key Features**:
- **Zoom**: Shift+Scroll (multiplicative zoom with zoom-to-cursor)
- **Pan**: Regular scroll wheel (horizontal)
- **Fit**: Auto-scales to fill viewport
- **Agent Assignment**: Inline dropdowns on segments
- **Edit**: Opens AIDocument Panel with segment structure

**Props**:
- `items`: Array of `StoryStructureItem[]`
- `onItemClick`: Callback when segment is clicked for editing
- `availableAgents`: List of agents for assignment
- `onAgentAssign`: Callback for agent assignment

---

## 🧪 Testing the Fix

### How to Verify Proportional Word Counts Are Working

1. **Clear All Old Data**:
   ```
   - Delete all existing stories from /stories page
   - Open browser DevTools → Application → Storage → Clear site data
   - Hard refresh (Cmd+Shift+R on Mac)
   ```

2. **Create New Structure**:
   ```
   - Create new canvas
   - Click "Create Format" → Choose "Screenplay"
   - New node appears with "No Structure Yet"
   - Click "Generate Structure" button
   ```

3. **Check Console Logs**:
   ```javascript
   📝 Generated structure (NodeDetailsPanel):
   {
     format: "screenplay",
     totalItems: 27,
     level1Items: [
       { name: "Act 1", wordCount: 3750 },  // ✅ NOT 5000!
       { name: "Act 2", wordCount: 7500 },  // ✅ NOT 5000!
       { name: "Act 3", wordCount: 3750 }   // ✅ NOT 5000!
     ],
     level2Items: [
       { name: "Sequence 1", wordCount: 1500, parentId: "..." },  // ✅ Varied!
       { name: "Sequence 2", wordCount: 1250, parentId: "..." },
       ...
     ],
     ...
   }
   ```

4. **Verify Visual Rendering**:
   - Acts should have different widths (Act 2 = 2× Act 1 width)
   - Sequences within each Act should vary in width
   - No equal-width segments at level 1!

---

## 🔗 Related Components

### Canvas Integration
**File**: `/frontend/src/app/canvas/page.tsx`
- Manages all nodes and edges
- Provides `handleNodeUpdate()` for structure updates
- Provides `handleStructureItemClick()` for opening AIDocument Panel
- Provides `handleAgentAssign()` for agent assignments

### Node Component
**File**: `/frontend/src/components/nodes/StoryStructureNode.tsx`
- Renders the actual node on the canvas
- Embeds `NarrationContainer` for timeline view
- Passes callbacks and data to child components

### Format Menu
**File**: `/frontend/src/components/menus/StoryFormatMenu.tsx`
- Shows format selection dialog
- Calls `onCreateStory(format, template)` from canvas

---

## 🐛 Common Issues & Solutions

### Issue: "Still seeing 5000-word segments!"

**Solution**:
1. ✅ Clear browser cache and site data
2. ✅ Delete ALL old stories (they have old data in Supabase)
3. ✅ Create a **NEW** story
4. ✅ Hard refresh (Cmd+Shift+R)
5. ✅ Check console for `📝 Generated structure` log

### Issue: "Word counts are correct but segments look equal"

**Solution**:
- Check `StructureTrackLane.tsx` → `getSegmentMetrics()`
- Ensure `pixelsPerUnit` is being applied correctly
- Check browser zoom level (affects rendering)
- Verify no CSS overriding `width` styles

### Issue: "Edit button doesn't open AIDocument Panel"

**Solution**:
- Check `onItemClick` callback is passed from canvas → node → container
- Verify `handleEditSegment` in `NarrationContainer.tsx` calls `onItemClick(item)`
- Check for `e.stopPropagation()` blocking the event

---

## 🔐 Key Principles

1. **Hierarchical Word Counts**: Parent = Sum of Children
2. **Proportional Division**: Children are fractions of parent based on their word counts
3. **Template-Based Generation**: All structures use predefined templates
4. **Recursive Rendering**: `getSegmentMetrics()` recursively calculates positions
5. **Single Source of Truth**: Templates define structure, rendering follows data
6. **Color Cascading**: Level 1 gets pastel colors, children get lightened versions

---

## 🛠️ Maintenance Checklist

When updating structure templates:

- [ ] Update `structureTemplates` in **BOTH** `NodeDetailsPanel.tsx` AND `StoryStructurePanel.tsx`
- [ ] Verify word counts sum correctly (children = parent)
- [ ] Test with new story (delete old data first)
- [ ] Check console logs for correct word counts
- [ ] Verify visual rendering is proportional
- [ ] Test all 7 formats (screenplay, novel, short-story, podcast, article, essay, report)

---

## 📊 Format Specifications

| Format | Levels | Level Names | Total Words |
|--------|--------|-------------|-------------|
| Screenplay | 3 | Act → Sequence → Scene | 15,000 |
| Novel | 3 | Part → Chapter → Scene | 80,000 |
| Short Story | 2 | Act → Scene | 5,000 |
| Podcast | 3 | Season → Episode → Segment | 15,000 |
| Article | 2 | Section → Subsection | 7,000 |
| Essay | 2 | Section → Paragraph | 5,000 |
| Report | 3 | Chapter → Section → Subsection | 17,500 |

---

## 🎓 For Future AI Agents

If you're debugging structure generation issues:

1. **Check NodeDetailsPanel.tsx first** - This is where the bug was!
2. **Verify console logs** - Look for `📝 Generated structure` with varied word counts
3. **Don't trust cached data** - Always delete old stories and create new ones
4. **Templates are king** - If templates are wrong, rendering will be wrong
5. **Two panels, one system** - NodeDetailsPanel and StoryStructurePanel must match

---

## 📞 Quick Reference

**Bug Location**: `/frontend/src/components/panels/NodeDetailsPanel.tsx` (line ~459)  
**Template Location**: Same file (lines 35-264)  
**Rendering Logic**: `/frontend/src/components/nodes/narrationline/StructureTrackLane.tsx`  
**Data Flow**: `canvas/page.tsx` → `StoryStructureNode.tsx` → `NarrationContainer.tsx` → `StructureTrackLane.tsx`  
**Console Log Pattern**: `📝 Generated structure (NodeDetailsPanel):` or `📝 Generated structure:`

---

## ✅ Success Criteria

You know it's working when:
- ✅ Console shows varied word counts at level 1
- ✅ Acts/Parts/Chapters have different widths
- ✅ Child segments are proportional to their word counts
- ✅ No equal-width level 1 segments
- ✅ Total word counts match format specifications

---

**Remember**: This system generates realistic, proportional story structures. The word counts and hierarchical relationships are carefully designed to match real-world writing patterns!

