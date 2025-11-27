# Template Registry Refactoring Plan

## 🎯 **Goal**
Move template definitions from UI component (`OrchestratorPanel.tsx`) to centralized schema (`templateRegistry.ts`) for better separation of concerns and LLM integration.

## 📊 **Current State (Problems)**

### **Problem 1: Templates Hardcoded in UI**
- **Location**: `frontend/src/components/panels/OrchestratorPanel.tsx` lines 147-207
- **Issue**: UI component owns business logic data
- **Impact**: 
  - Can't reuse templates in other components
  - LLM intent analyzer can't suggest templates
  - No single source of truth

### **Problem 2: Template Logic Scattered**
- **Locations**:
  - Lines 1199-1230: Conversational template parsing
  - Lines 1862-1880: Template display logic
  - Lines 2438-2455: UI rendering
- **Issue**: Template selection logic mixed with UI code
- **Impact**: Hard to test, maintain, or enhance

### **Problem 3: No LLM Integration**
- **Issue**: `llmIntentAnalyzer.ts` doesn't know about templates
- **Impact**: 
  - Can't suggest "interview format" for podcasts
  - Can't match "hero's journey" to correct template
  - User must manually select every time

### **Problem 4: No Schema Definition**
- **Issue**: No `TemplateRegistry` in schemas folder
- **Impact**: No type safety, no validation, no documentation

---

## 🏗️ **Target Architecture**

```
schemas/
├── documentHierarchy.ts     # Structure levels (Chapter, Scene, etc.)
├── templateRegistry.ts      # ✅ Template definitions + metadata
└── structurePlan.ts         # Structure generation schemas

orchestrator/
├── context/
│   └── llmIntentAnalyzer.ts # ✅ Uses templateRegistry for suggestions
├── actions/
│   └── structure/
│       └── CreateStructureAction.ts  # ✅ Uses templateRegistry
└── core/
    └── orchestratorEngine.ts  # Delegates to actions

UI (OrchestratorPanel.tsx)
└── ✅ Imports from templateRegistry (read-only display)
```

---

## 📋 **SAFE REFACTORING PLAN**

### **Phase 0: Create Schema** ✅ **COMPLETE**
**Risk Level:** ZERO (only adds new files)

- [x] Create `frontend/src/lib/orchestrator/schemas/templateRegistry.ts`
- [x] Define `Template` interface with metadata
- [x] Define `TEMPLATE_REGISTRY` constant
- [x] Add helper functions:
  - `getTemplatesForFormat(format: string): Template[]`
  - `getTemplateById(format: string, templateId: string): Template | null`
  - `findTemplateByKeywords(format: string, query: string): Template | null`
  - `buildTemplateDescriptionsForLLM(): string`

**Test:**
```typescript
import { getTemplatesForFormat, findTemplateByKeywords } from '@/lib/orchestrator/schemas/templateRegistry'

// Should return 4 templates
console.log(getTemplatesForFormat('podcast'))

// Should return 'interview' template
console.log(findTemplateByKeywords('podcast', 'interview with guests'))
```

---

### **Phase 1: Update LLM Intent Analyzer**
**Risk Level:** LOW (only enhances existing functionality)

**Changes:**
1. Import `buildTemplateDescriptionsForLLM()` in `llmIntentAnalyzer.ts`
2. Add to system prompt (after format descriptions)
3. Update `extractedEntities` interface to include:
   ```typescript
   suggestedTemplate?: string  // Template ID matched from keywords
   ```

**Example:**
```typescript
// In llmIntentAnalyzer.ts
import { buildTemplateDescriptionsForLLM } from '../schemas/templateRegistry'

const INTENT_ANALYSIS_SYSTEM_PROMPT = `...
${buildFormatDescriptionsForLLM()}
${buildTemplateDescriptionsForLLM()}
...`
```

**Test Cases:**
- User: "Create a podcast interview" → `suggestedTemplate: 'interview'`
- User: "Write a hero's journey novel" → `suggestedTemplate: 'heros-journey'`
- User: "Make a feature film" → `suggestedTemplate: 'feature'`
- User: "Create a podcast" (vague) → `suggestedTemplate: undefined` (ask user)

**Verification:**
```bash
# TypeScript compilation
cd frontend && npx tsc --noEmit

# Test intent analysis
# (manual test in UI: "Create a podcast interview")
```

---

### **Phase 2: Update CreateStructureAction**
**Risk Level:** LOW (action already isolated)

**Changes:**
1. Import `TEMPLATE_REGISTRY, getTemplateById` in `CreateStructureAction.ts`
2. Use registry instead of hardcoded logic
3. Pass template metadata to structure generation

**Example:**
```typescript
// In CreateStructureAction.ts
import { getTemplateById } from '../../schemas/templateRegistry'

// When generating structure
const template = getTemplateById(format, templateId)
if (template) {
  console.log(`Using template: ${template.name} - ${template.description}`)
}
```

**Test Cases:**
- Create novel with "three-act" template → Structure generated
- Create podcast with "interview" template → Structure generated
- Template selection flow still works

**Verification:**
```bash
# Build test
npm run build

# Manual test: Create a story with template selection
```

---

### **Phase 3: Refactor OrchestratorPanel (UI)**
**Risk Level:** MEDIUM (UI changes, but read-only)

**Changes:**
1. **Remove** hardcoded `templates` constant (lines 147-207)
2. **Remove** `interface Template` (line 141-145)
3. **Import** from schema:
   ```typescript
   import { getTemplatesForFormat, type Template } from '@/lib/orchestrator/schemas/templateRegistry'
   ```
4. **Replace** all `templates[format]` with `getTemplatesForFormat(format)`

**Affected Lines:**
- Line 1202: `const availableTemplates = templates[pendingCreation.format] || []`
  - Change to: `const availableTemplates = getTemplatesForFormat(pendingCreation.format)`
- Line 1865: `const availableTemplates = templates[formatToUse] || []`
  - Change to: `const availableTemplates = getTemplatesForFormat(formatToUse)`
- Line 2441: `{(templates[pendingCreation.format] || []).map(...)`
  - Change to: `{getTemplatesForFormat(pendingCreation.format).map(...)`

**Test Cases:**
- Template selection UI renders correctly
- Conversational template parsing works
- Template buttons clickable
- No visual regressions

**Verification:**
```bash
# TypeScript compilation
npx tsc --noEmit

# Visual test
npm run dev
# Navigate to orchestrator panel
# Try: "Create a podcast" → Should show template options
```

---

### **Phase 4: Add Template Intelligence (Optional Enhancement)**
**Risk Level:** LOW (optional feature)

**Changes:**
1. Pre-select template when user is specific:
   - "Create a podcast interview" → Auto-select `interview` template
   - "Write a hero's journey novel" → Auto-select `heros-journey` template

2. Skip template selection UI if LLM already matched:
   ```typescript
   if (intent.extractedEntities?.suggestedTemplate) {
     // Auto-select and proceed
     handleTemplateSelection(suggestedTemplate, templateName)
   } else {
     // Show template options
     setPendingCreation({ format, userPrompt })
   }
   ```

**Test Cases:**
- User: "Create a podcast interview" → Skips template selection, creates directly
- User: "Create a podcast" → Shows template options (no match)
- User: "Write a hero's journey novel" → Auto-selects template

**Verification:**
- Specific requests skip template selection
- Vague requests still show options
- User can override auto-selection

---

## 🧪 **Testing Strategy**

### **Unit Tests** (Future)
```typescript
// templateRegistry.test.ts
describe('Template Registry', () => {
  it('should return templates for valid format', () => {
    const templates = getTemplatesForFormat('podcast')
    expect(templates).toHaveLength(4)
  })
  
  it('should find template by keywords', () => {
    const template = findTemplateByKeywords('podcast', 'interview')
    expect(template?.id).toBe('interview')
  })
  
  it('should return null for invalid format', () => {
    const templates = getTemplatesForFormat('invalid')
    expect(templates).toEqual([])
  })
})
```

### **Integration Tests** (Manual)
1. **Template Selection Flow**
   - User: "Create a podcast"
   - System: Shows 4 template options
   - User: Clicks "Interview Format"
   - System: Creates podcast with interview structure

2. **LLM Template Matching**
   - User: "Create a podcast interview"
   - System: Auto-selects interview template
   - System: Creates structure without asking

3. **Conversational Parsing**
   - User: "Create a podcast"
   - System: "What style would you like?"
   - User: "interview format"
   - System: Matches "interview" template

---

## 🚀 **Rollout Plan**

### **Step 1: Phase 0 (Immediate)**
- Create `templateRegistry.ts`
- Commit: "feat: Add template registry schema"
- **No breaking changes**

### **Step 2: Phase 1 (Same Session)**
- Update `llmIntentAnalyzer.ts`
- Commit: "feat: Add template suggestions to intent analyzer"
- **No breaking changes**

### **Step 3: Phase 2 (Same Session)**
- Update `CreateStructureAction.ts`
- Commit: "refactor: Use template registry in CreateStructureAction"
- **No breaking changes**

### **Step 4: Phase 3 (Same Session)**
- Refactor `OrchestratorPanel.tsx`
- Commit: "refactor: Use template registry in OrchestratorPanel"
- **Test thoroughly before committing**

### **Step 5: Phase 4 (Optional, Later)**
- Add template intelligence
- Commit: "feat: Auto-select templates from user intent"
- **Enhancement, not critical**

---

## 🛡️ **Rollback Plan**

### **If Phase 3 Breaks UI:**
```bash
# Revert last commit
git revert HEAD

# Or restore specific file
git restore frontend/src/components/panels/OrchestratorPanel.tsx
```

### **If Template Registry Has Issues:**
```bash
# Remove template registry
git rm frontend/src/lib/orchestrator/schemas/templateRegistry.ts

# Revert dependent files
git restore frontend/src/lib/orchestrator/context/llmIntentAnalyzer.ts
git restore frontend/src/lib/orchestrator/actions/structure/CreateStructureAction.ts
```

---

## ✅ **Success Criteria**

- [ ] `templateRegistry.ts` created with all templates
- [ ] LLM intent analyzer suggests templates
- [ ] CreateStructureAction uses registry
- [ ] OrchestratorPanel imports from registry
- [ ] Template selection UI works identically
- [ ] Conversational parsing still works
- [ ] No TypeScript errors
- [ ] No visual regressions
- [ ] All manual tests pass

---

## 📝 **Notes**

### **Why This Matters**
1. **Single Source of Truth**: Templates defined once, used everywhere
2. **LLM Integration**: Intent analyzer can suggest templates intelligently
3. **Maintainability**: Easy to add new templates or formats
4. **Type Safety**: TypeScript interfaces ensure consistency
5. **Testability**: Can unit test template matching logic

### **Future Enhancements**
- Add template preview images
- Add template difficulty ratings
- Add template usage analytics
- Add custom user templates
- Add template recommendations based on user history

---

## 🎯 **Current Status**

- [x] Phase 0: Schema created ✅
- [ ] Phase 1: LLM integration (next)
- [ ] Phase 2: Action refactor (next)
- [ ] Phase 3: UI refactor (next)
- [ ] Phase 4: Intelligence (optional)

**Ready to proceed with Phase 1!** 🚀

