# Publo Feature Backlog

**Last Updated**: 2025-11-15  
**Status**: Active Development

This document tracks upcoming features, improvements, and technical debt for the Publo project.

---

## 🚨 High Priority - Critical Improvements

### 1. **Nested Structure Rendering Architecture** 
**Category**: Technical Debt / UX Enhancement  
**Effort**: Large (8-12 hours)  
**Priority**: High  
**Status**: Planned

**Problem**: Current flat structure with absolute positioning causes alignment issues due to accumulated rounding errors across 4+ levels.

**Solution**: Implement true nested flex-based rendering:
- Convert flat array to tree structure
- Use nested flex containers with percentage widths
- `flexShrink: 0` to prevent rounding gaps
- Perfect mathematical alignment guaranteed

**Files Affected**:
- `/frontend/src/components/nodes/narrationline/StructureTrackLane.tsx` (major rewrite)
- `/frontend/src/components/nodes/narrationline/NarrationSegment.tsx` (positioning changes)
- `/frontend/src/components/nodes/narrationline/NarrationContainer.tsx` (zoom/pan calculations)

**Benefits**:
- ✅ Perfect alignment at all zoom levels
- ✅ Simpler mental model (visual hierarchy matches code hierarchy)
- ✅ Easier to add new interaction features
- ✅ Better performance (fewer calculations)

**Implementation Guide**: See `/STRUCTURE_GENERATION_GUIDE.md` and friend's "Nested Book Structure Layout" spec

**Related Issues**: Alignment gaps visible at Beat/Topic/Sub-subsection levels

---

### 2. **Supabase Data Migration for Proportional Word Counts**
**Category**: Data Migration  
**Effort**: Medium (4-6 hours)  
**Priority**: High  
**Status**: Not Started

**Problem**: Old stories in Supabase database still have equal-division word counts (5000 per segment).

**Solution**:
1. Create migration script to:
   - Fetch all existing story structures
   - Recalculate word counts using proportional templates
   - Update database with correct values
2. Add database version tracking
3. Document migration process

**Files to Create**:
- `/scripts/migrate-word-counts.ts`
- `/docs/MIGRATION_GUIDE.md`

**Related Issues**: Users see correct word counts only after creating NEW stories

---

### 3. **Structure Template Validation System**
**Category**: Data Integrity  
**Effort**: Small (2-3 hours)  
**Priority**: Medium  
**Status**: Not Started

**Problem**: No validation that child word counts sum to parent word counts. Easy to introduce bugs when editing templates.

**Solution**:
```typescript
// Add to structureTemplates.ts or similar
const validateTemplate = (template: any, parentWordCount?: number) => {
  if (!template.children || template.children.length === 0) return true
  
  const childSum = template.children.reduce((sum, child) => sum + child.wordCount, 0)
  if (Math.abs(childSum - template.wordCount) > 0.01) {
    console.error(`Word count mismatch: ${template.name}`, {
      expected: template.wordCount,
      actual: childSum,
      diff: template.wordCount - childSum
    })
    return false
  }
  
  return template.children.every(child => validateTemplate(child, template.wordCount))
}

// Run validation in development mode
if (process.env.NODE_ENV === 'development') {
  Object.entries(structureTemplates).forEach(([format, template]) => {
    validateTemplate(template.level1[0])
  })
}
```

**Benefits**:
- ✅ Catch template errors during development
- ✅ Prevent proportional calculation bugs
- ✅ Self-documenting constraints

---

## 📈 Medium Priority - UX Enhancements

### 4. **Segment Hover Preview with Word Count Progress**
**Category**: UX Enhancement  
**Effort**: Small (2-3 hours)  
**Priority**: Medium  
**Status**: Not Started

**Feature**: When hovering over a segment, show:
- Full hierarchy path (e.g., "Act 2 → Sequence 1 → Scene 2")
- Current word count vs. target word count
- Percentage complete
- Assigned agent (if any)
- Last edited timestamp

**Implementation**:
```tsx
<Tooltip>
  <div className="space-y-1">
    <div className="text-xs text-gray-500">
      Act 2 → Sequence 1 → Scene 2
    </div>
    <div className="text-sm font-semibold">
      {item.name}
    </div>
    <div className="flex items-center gap-2">
      <Progress value={(currentWords / targetWords) * 100} />
      <span className="text-xs">{currentWords}/{targetWords} words</span>
    </div>
    {item.assignedAgentId && (
      <div className="text-xs flex items-center gap-1">
        <PersonIcon /> Assigned to {agentName}
      </div>
    )}
  </div>
</Tooltip>
```

---

### 5. **Keyboard Shortcuts for Narration Arrangement View**
**Category**: UX Enhancement  
**Effort**: Small (2-3 hours)  
**Priority**: Medium  
**Status**: Not Started

**Feature**: Add keyboard shortcuts:
- `Arrow Keys`: Navigate between segments
- `Enter`: Edit selected segment
- `Space`: Toggle segment expansion
- `Cmd/Ctrl + Click`: Multi-select segments
- `Cmd/Ctrl + A`: Select all segments at current level
- `Delete`: Delete selected segment(s)
- `Cmd/Ctrl + C/V`: Copy/paste segments
- `Cmd/Ctrl + Z/Y`: Undo/redo
- `F`: Fit to view
- `+/-`: Zoom in/out
- `0`: Reset zoom to 100%

**Implementation**: Create `useKeyboardShortcuts` hook in `NarrationContainer.tsx`

---

### 6. **Segment Drag-and-Drop Reordering**
**Category**: UX Enhancement  
**Effort**: Medium (4-6 hours)  
**Priority**: Medium  
**Status**: Not Started

**Feature**: Allow users to drag segments to reorder them within the same parent or move to different parents.

**Implementation**:
- Use `@dnd-kit` library for accessible drag-and-drop
- Visual feedback showing valid drop zones
- Update `order` property and recalculate positions
- Maintain proportional word counts

**Constraints**:
- Can only reorder siblings at same level
- Moving to different parent recalculates proportions
- Undo/redo support required

---

### 7. **Mini-map Navigation**
**Category**: UX Enhancement  
**Effort**: Medium (4-5 hours)  
**Priority**: Low  
**Status**: Not Started

**Feature**: Small overview showing entire structure with current viewport highlighted.

**Implementation**:
```tsx
<MiniMap>
  {/* Render simplified version of all segments */}
  <div className="absolute border-2 border-yellow-400" 
       style={{
         left: `${viewportPercent.left}%`,
         width: `${viewportPercent.width}%`
       }}
  />
</MiniMap>
```

---

## 🎨 Visual & Styling Improvements

### 8. **Custom Color Schemes per Story**
**Category**: Theming  
**Effort**: Small (2-3 hours)  
**Priority**: Low  
**Status**: Not Started

**Feature**: Allow users to customize:
- Primary accent color (currently yellow-400)
- Level-specific colors
- Save as story-level preference

**Implementation**:
```typescript
interface StoryTheme {
  id: string
  accentColor: string
  levelColors: {
    [level: number]: string
  }
}
```

---

### 9. **Dark Mode for Arrangement View**
**Category**: Theming  
**Effort**: Small (2-3 hours)  
**Priority**: Low  
**Status**: Not Started

**Feature**: Dark theme for narration arrangement view matching overall app theme.

**Implementation**: Use Tailwind dark mode classes with CSS variables for brand colors.

---

### 10. **Segment Visual States**
**Category**: UX Enhancement  
**Effort**: Small (1-2 hours)  
**Priority**: Low  
**Status**: Not Started

**Feature**: Visual indicators for:
- 🟢 Complete (reached word count target)
- 🟡 In Progress (some content written)
- ⚪ Not Started (no content)
- 🔴 Overdue (deadline passed)
- 🔵 Reviewed (marked as reviewed)

**Implementation**: Add `status` field to `StoryStructureItem` and render status badges.

---

## 🔧 Technical Debt & Optimizations

### 11. **Performance: Virtualize Segment Rendering**
**Category**: Performance  
**Effort**: Medium (4-6 hours)  
**Priority**: Low  
**Status**: Not Started

**Problem**: With 100+ segments across 4-7 levels, rendering slows down.

**Solution**: Implement viewport-based virtualization:
- Only render segments visible in scrollable area
- Use `react-window` or `react-virtuoso`
- Maintain smooth zoom/pan experience

**Target**: Support 1000+ segments without performance degradation

---

### 12. **Debounce Supabase Updates**
**Category**: Performance  
**Effort**: Small (1-2 hours)  
**Priority**: Medium  
**Status**: Not Started

**Problem**: Every segment interaction triggers immediate database save.

**Solution**:
```typescript
const debouncedSave = useDebouncedCallback(
  (nodeId, updates) => {
    handleNodeUpdate(nodeId, updates)
  },
  1000 // Wait 1s after last change
)
```

**Benefits**:
- ✅ Reduce database writes by 90%+
- ✅ Lower Supabase costs
- ✅ Smoother UX (no save lag)

---

### 13. **Extract Structure Templates to Separate File**
**Category**: Code Organization  
**Effort**: Small (1 hour)  
**Priority**: Low  
**Status**: Not Started

**Problem**: `structureTemplates` are duplicated in `NodeDetailsPanel.tsx` and `StoryStructurePanel.tsx`.

**Solution**: Extract to `/lib/structureTemplates.ts` with:
- Template definitions
- Validation functions
- Helper functions for word count calculations
- TypeScript types

**Benefits**:
- ✅ Single source of truth
- ✅ Easier to maintain
- ✅ Enable template marketplace (future feature)

---

### 14. **Unit Tests for Proportional Calculations**
**Category**: Testing  
**Effort**: Medium (3-4 hours)  
**Priority**: Medium  
**Status**: Not Started

**Coverage Needed**:
```typescript
describe('getSegmentMetrics', () => {
  it('should calculate top-level segment positions correctly', () => { })
  it('should position children proportionally within parent', () => { })
  it('should handle 4+ levels of nesting without rounding errors', () => { })
  it('should align child boundaries with parent boundaries', () => { })
  it('should sum child widths to parent width within 1px tolerance', () => { })
})
```

**Tools**: Jest + React Testing Library

---

## 🌟 New Features - Future Vision

### 15. **AI-Powered Structure Generation**
**Category**: AI Feature  
**Effort**: Large (16-20 hours)  
**Priority**: Future  
**Status**: Idea

**Feature**: Use AI to generate structure based on:
- Story synopsis/logline
- Target word count
- Genre conventions
- User's writing style (analyzed from past work)

**Implementation**: API integration with OpenAI/Claude to generate custom templates.

---

### 16. **Collaborative Editing**
**Category**: Multiplayer  
**Effort**: Large (20-30 hours)  
**Priority**: Future  
**Status**: Idea

**Feature**: Multiple users editing same story structure:
- Real-time presence indicators
- Operational transforms for conflict resolution
- Chat/comments on segments
- Permission system (owner, editor, viewer)

**Tech Stack**: Supabase Realtime, Y.js for CRDT

---

### 17. **Export to Popular Formats**
**Category**: Integration  
**Effort**: Medium (6-8 hours)  
**Priority**: Future  
**Status**: Idea

**Feature**: Export structure to:
- Scrivener project
- Final Draft outline
- Notion database
- Google Docs with bookmark hierarchy
- Markdown with nested headers

---

### 18. **Template Marketplace**
**Category**: Community Feature  
**Effort**: Large (12-16 hours)  
**Priority**: Future  
**Status**: Idea

**Feature**: 
- Users create custom structure templates
- Share templates with community
- Rate/review templates
- Categories: Genres, Formats, Styles

**Monetization**: Premium template marketplace

---

### 19. **Writing Analytics Dashboard**
**Category**: Analytics  
**Effort**: Large (10-15 hours)  
**Priority**: Future  
**Status**: Idea

**Feature**: Track and visualize:
- Words written per day/week/month
- Segment completion progress over time
- Writing velocity by level/type
- Agent performance metrics
- Heatmap of editing activity
- Comparison to target deadlines

---

### 20. **Voice-to-Structure**
**Category**: Accessibility / Innovation  
**Effort**: Large (12-16 hours)  
**Priority**: Future  
**Status**: Idea

**Feature**: Record voice notes describing story structure, AI transcribes and generates structure automatically.

**Use Case**: "I want a three-act screenplay. Act one has five sequences, each with three scenes..."

---

## 🐛 Known Issues

### 21. **Side Panel Opens on Segment Click (Sometimes)**
**Category**: Bug  
**Effort**: Small (1 hour)  
**Priority**: Medium  
**Status**: Not Started

**Issue**: Despite `e.stopPropagation()`, side panel occasionally opens when clicking segments.

**Root Cause**: Event propagation timing in React Flow wrapper.

**Solution**: Investigate event capture phase in `StoryStructureNode.tsx`

---

### 22. **Zoom Bounce at High Zoom Levels**
**Category**: Bug  
**Effort**: Small (1-2 hours)  
**Priority**: Low  
**Status**: Partially Fixed

**Issue**: At zoom > 5x, slight "bounce" visible when zooming due to browser sub-pixel rounding.

**Current Fix**: Decimal tracking via `intendedScrollLeftRef` (reduced bounce by 80%)

**Future Fix**: Pre-calculate zoom levels as snapshots to eliminate all rounding

---

### 23. **Mobile: Arrangement View Not Touch-Optimized**
**Category**: Mobile / UX  
**Effort**: Medium (4-6 hours)  
**Priority**: Medium  
**Status**: Not Started

**Issue**: Pinch-to-zoom and touch panning not implemented for mobile users.

**Solution**: Add touch event handlers:
- Pinch gesture for zoom
- Two-finger pan for scrolling
- Long-press for context menu
- Larger tap targets for segments

---

## 📋 Documentation Needs

### 24. **Video Tutorial Series**
**Category**: Documentation  
**Effort**: Large (8-12 hours)  
**Priority**: Medium  
**Status**: Not Started

**Content**:
1. Getting Started with Publo (5 min)
2. Creating Your First Story Structure (10 min)
3. Advanced: Narration Arrangement View (15 min)
4. Sub-Agent Configuration (10 min)
5. Collaborative Workflows (12 min)

---

### 25. **API Documentation**
**Category**: Documentation  
**Effort**: Medium (4-6 hours)  
**Priority**: Low  
**Status**: Not Started

**Content**: Document all:
- Supabase table schemas
- TypeScript interfaces
- Component props
- Helper functions
- Event handlers

**Format**: Auto-generated from JSDoc/TSDoc using Typedoc

---

## 🎯 Quick Wins - Easy Improvements

### 26. **Show Word Count in Ruler**
**Effort**: 30 minutes  
**Priority**: Low

Add word count markers to narration ruler (every 1000 words).

---

### 27. **Double-Click to Rename Segment**
**Effort**: 1 hour  
**Priority**: Medium

Allow inline editing of segment names in arrangement view.

---

### 28. **Segment Search/Filter**
**Effort**: 2 hours  
**Priority**: Medium

Add search bar to filter visible segments by name or content.

---

### 29. **Undo/Redo for Structure Changes**
**Effort**: 3 hours  
**Priority**: High

Implement command pattern for undo/redo of:
- Segment reordering
- Agent assignment
- Color changes
- Structure modifications

---

### 30. **Export as Image**
**Effort**: 2 hours  
**Priority**: Low

Allow users to export arrangement view as PNG/SVG for sharing.

---

## 📊 Metrics & Success Criteria

**Track**:
- User engagement with arrangement view (time spent, interactions)
- Structure generation completion rate
- Agent assignment adoption
- Performance metrics (FPS, time to interactive)
- User feedback scores

**Goals for Q1 2026**:
- 90% of users generate structures (currently unknown)
- Average 4+ levels per structure
- < 100ms interaction latency
- Zero alignment complaints after nested rendering

---

## 🔄 Maintenance Schedule

**Monthly**:
- Review and update this backlog
- Archive completed features
- Re-prioritize based on user feedback

**Quarterly**:
- Major version bump
- Breaking changes if needed
- Performance audit

**Yearly**:
- Architecture review
- Technology stack update
- Security audit

---

## 📝 Notes

- Features marked "Future" are aspirational and not scheduled
- Effort estimates are for experienced developers familiar with codebase
- Priority can change based on user feedback and business needs
- All features should maintain accessibility (WCAG AA minimum)

---

**For questions or feature requests, contact the development team or create an issue in the project repository.**

