# 🚀 Vercel Deployment Guide

## 📋 Pre-Deployment Checklist

- [ ] All TypeScript errors fixed
- [ ] All ESLint warnings resolved
- [ ] Environment variables configured in Vercel
- [ ] Database migrations applied
- [ ] API keys tested in production
- [ ] Build succeeds locally (`npm run build`)

---

## 🔐 Required Environment Variables

### **In Vercel Dashboard → Settings → Environment Variables**

#### **Production Environment**

```bash
# Supabase Configuration (Public)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role (Secret - Server Only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Encryption Key (Secret - for API key storage)
ENCRYPTION_KEY=your-32-character-encryption-key-here
NEXT_PUBLIC_ENCRYPTION_KEY=same-as-above  # Fallback for client-side

# Node Environment (Auto-set by Vercel)
NODE_ENV=production
```

#### **Preview/Development Environments**

Use the same variables as production, or separate Supabase projects for testing.

---

## 🏗️ Build Configuration

### **Vercel Settings**

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

### **Build Optimizations**

1. **Increase Function Timeout** (if using structure generation)
   - Free: 10s (may timeout)
   - Pro: 60s (recommended)
   - Enterprise: 900s

2. **Edge Runtime Compatibility**
   - All API routes use Node.js runtime ✅
   - No `fs` or `path` in edge functions ✅

3. **Bundle Size Monitoring**
   - Current orchestrator: ~3000 lines
   - Consider code splitting if bundle > 250KB

---

## 🔧 Deployment Strategy

### **Recommended Workflow**

```bash
# 1. Test build locally
npm run build

# 2. Check for TypeScript errors
npx tsc --noEmit

# 3. Run linter
npm run lint

# 4. Commit changes
git add -A
git commit -m "fix: prepare for production deployment"

# 5. Push to GitHub
git push origin refactor/phase3-multi-agent-coordination

# 6. Merge to main via PR
# Vercel will auto-deploy on merge
```

### **Rollback Plan**

If deployment fails:
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or redeploy previous version in Vercel dashboard
```

---

## ⚠️ Known Limitations

### **API Timeouts**

**Issue:** Structure generation can take 30-60 seconds

**Solutions:**
1. Upgrade to Vercel Pro (60s timeout)
2. Implement streaming responses
3. Use background jobs for long operations

### **Cold Starts**

**Issue:** First request after idle may be slow (3-5s)

**Solutions:**
1. Use Vercel's "Keep Warm" feature (Pro)
2. Implement health check endpoint
3. Pre-warm functions with cron jobs

---

## 📊 Monitoring

### **Key Metrics to Watch**

1. **Function Duration**
   - Orchestrator: < 5s (ideal)
   - Structure generation: < 30s
   - Content generation: < 15s per section

2. **Error Rates**
   - Target: < 1% error rate
   - Monitor: `/api/generate`, `/api/agent/save-content`

3. **Memory Usage**
   - Limit: 1024MB (Pro), 3008MB (Enterprise)
   - Current: ~200-400MB typical

### **Vercel Analytics**

Enable in dashboard:
- Web Analytics (page views, performance)
- Speed Insights (Core Web Vitals)
- Audience Insights (user behavior)

---

## 🐛 Common Deployment Issues

### **Issue 1: "Module not found"**

**Cause:** Case-sensitive imports on Vercel (Linux) vs. local (macOS)

**Fix:**
```bash
# Find case mismatches
find . -name "*.ts" -o -name "*.tsx" | xargs grep -i "import.*from.*orchestrator"
```

### **Issue 2: "Environment variable undefined"**

**Cause:** Missing `NEXT_PUBLIC_` prefix for client-side variables

**Fix:**
- Server-only: `process.env.SECRET_KEY`
- Client-accessible: `process.env.NEXT_PUBLIC_API_URL`

### **Issue 3: "Function timeout"**

**Cause:** Long-running API routes

**Fix:**
```typescript
// Add timeout handling
export const config = {
  maxDuration: 60 // seconds (Pro plan required)
}
```

---

## 📁 Orchestrator Architecture Refactoring

### **Current File Structure**

```
frontend/src/lib/orchestrator/
├── core/
│   ├── orchestratorEngine.ts      (3214 lines) ⚠️ TOO LARGE
│   ├── blackboard.ts               (530 lines)
│   └── worldState.ts               (530 lines)
├── agents/
│   ├── MultiAgentOrchestrator.ts  (910 lines)
│   ├── WriterAgent.ts             (354 lines)
│   ├── CriticAgent.ts             (330 lines)
│   └── types.ts                   (280 lines)
└── tools/
    ├── writeContentTool.ts        (150 lines)
    ├── createStructureTool.ts     (120 lines)
    └── ...
```

### **Issues with Current Structure**

1. **orchestratorEngine.ts is too large** (3214 lines)
   - Hard to maintain
   - Slow to load in IDE
   - Difficult to test individual parts

2. **Mixed responsibilities**
   - Intent analysis + action generation + structure creation all in one file
   - Violates Single Responsibility Principle

3. **Deep nesting**
   - 2000+ line `generateActions()` switch statement
   - Hard to follow logic flow

### **Recommended Refactoring**

#### **Phase 1: Split orchestratorEngine.ts**

```
frontend/src/lib/orchestrator/
├── core/
│   ├── OrchestratorEngine.ts          (300 lines) - Main orchestration loop
│   ├── IntentAnalyzer.ts              (200 lines) - Intent detection
│   ├── ActionGenerator.ts             (150 lines) - Base action generation
│   ├── ContextResolver.ts             (150 lines) - Canvas context building
│   ├── ModelSelector.ts               (200 lines) - Model selection logic
│   └── PatternLearner.ts              (150 lines) - Pattern learning
│
├── actions/                            ← NEW: One file per action type
│   ├── WriteContentAction.ts          (300 lines) - Write content logic
│   ├── CreateStructureAction.ts       (400 lines) - Structure generation
│   ├── OpenDocumentAction.ts          (150 lines) - Document opening
│   ├── NavigateSectionAction.ts       (150 lines) - Section navigation
│   ├── DeleteNodeAction.ts            (100 lines) - Node deletion
│   └── AnswerQuestionAction.ts        (150 lines) - Q&A logic
│
├── clarification/                      ← NEW: Clarification handling
│   ├── ClarificationHandler.ts        (200 lines) - Main handler
│   └── ClarificationResponseParser.ts (150 lines) - Response parsing
│
└── structure/                          ← NEW: Structure generation
    ├── StructurePlanGenerator.ts      (300 lines) - Plan generation
    ├── StructureValidator.ts          (150 lines) - Validation
    └── FormatInstructions.ts          (200 lines) - Format-specific logic
```

#### **Benefits**

✅ **Maintainability**
- Each file < 400 lines
- Clear separation of concerns
- Easier to find and fix bugs

✅ **Testability**
- Can test each action type independently
- Mock dependencies easily
- Faster test execution

✅ **Performance**
- Smaller files load faster in IDE
- Better tree-shaking in production
- Reduced bundle size

✅ **Collaboration**
- Multiple developers can work on different actions
- Fewer merge conflicts
- Clearer code review

#### **Migration Strategy**

**Step 1: Extract Actions** (No breaking changes)
```typescript
// actions/WriteContentAction.ts
export class WriteContentAction {
  async generate(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    context: CanvasContext
  ): Promise<OrchestratorAction[]> {
    // Move write_content case logic here
  }
}

// OrchestratorEngine.ts
import { WriteContentAction } from './actions/WriteContentAction'

private async generateActions(...) {
  switch (intent.intent) {
    case 'write_content':
      return new WriteContentAction().generate(intent, request, context)
    // ...
  }
}
```

**Step 2: Extract Structure Generation**
```typescript
// structure/StructurePlanGenerator.ts
export class StructurePlanGenerator {
  async generate(
    prompt: string,
    format: string,
    modelId: string
  ): Promise<StructurePlan> {
    // Move createStructurePlan logic here
  }
}
```

**Step 3: Extract Intent Analysis**
```typescript
// core/IntentAnalyzer.ts
export class IntentAnalyzer {
  async analyze(
    message: string,
    context: CanvasContext,
    history: ConversationMessage[]
  ): Promise<IntentAnalysis> {
    // Move intent analysis logic here
  }
}
```

**Step 4: Refactor OrchestratorEngine**
```typescript
// core/OrchestratorEngine.ts (now ~300 lines)
export class OrchestratorEngine {
  private intentAnalyzer: IntentAnalyzer
  private actionGenerators: Map<UserIntent, ActionGenerator>
  
  constructor(config: OrchestratorConfig) {
    this.intentAnalyzer = new IntentAnalyzer()
    this.actionGenerators = new Map([
      ['write_content', new WriteContentAction()],
      ['create_structure', new CreateStructureAction()],
      // ...
    ])
  }
  
  async orchestrate(request: OrchestratorRequest) {
    // 1. Analyze intent
    const intent = await this.intentAnalyzer.analyze(...)
    
    // 2. Generate actions
    const generator = this.actionGenerators.get(intent.intent)
    const actions = await generator.generate(...)
    
    // 3. Return response
    return { intent, actions, ... }
  }
}
```

### **File Taxonomy Assessment**

#### **✅ Good Current Patterns**

1. **Clear separation of concerns**
   - `core/` - Orchestration logic
   - `agents/` - Agent implementations
   - `tools/` - Executable tools
   - `schemas/` - Type definitions

2. **Consistent naming**
   - `*Agent.ts` - Agent classes
   - `*Tool.ts` - Tool classes
   - `*Engine.ts` - Core engines

3. **Logical grouping**
   - `clusters/` - Multi-agent patterns
   - `utils/` - Shared utilities

#### **⚠️ Areas for Improvement**

1. **Monolithic files**
   - `orchestratorEngine.ts` - Too large
   - `MultiAgentOrchestrator.ts` - Getting large

2. **Missing abstractions**
   - No `actions/` directory
   - No `clarification/` directory
   - No `structure/` directory

3. **Deep nesting**
   - Long switch statements
   - Nested if-else chains

### **Recommended Taxonomy**

```
frontend/src/lib/orchestrator/
├── core/                    # Core orchestration (< 500 lines each)
│   ├── OrchestratorEngine.ts
│   ├── IntentAnalyzer.ts
│   ├── ActionGenerator.ts
│   ├── ContextResolver.ts
│   └── ModelSelector.ts
│
├── actions/                 # Action handlers (< 400 lines each)
│   ├── base/
│   │   └── BaseAction.ts
│   ├── content/
│   │   ├── WriteContentAction.ts
│   │   └── AnswerQuestionAction.ts
│   ├── structure/
│   │   ├── CreateStructureAction.ts
│   │   └── ModifyStructureAction.ts
│   └── navigation/
│       ├── OpenDocumentAction.ts
│       └── NavigateSectionAction.ts
│
├── agents/                  # Agent implementations
│   ├── base/
│   │   └── BaseAgent.ts
│   ├── WriterAgent.ts
│   ├── CriticAgent.ts
│   ├── MultiAgentOrchestrator.ts
│   └── clusters/
│       └── WriterCriticCluster.ts
│
├── tools/                   # Executable tools
│   ├── base/
│   │   └── BaseTool.ts
│   ├── content/
│   │   └── writeContentTool.ts
│   └── structure/
│       └── createStructureTool.ts
│
├── state/                   # State management
│   ├── Blackboard.ts
│   ├── WorldState.ts
│   └── ExecutionTracer.ts
│
├── clarification/           # Clarification handling
│   ├── ClarificationHandler.ts
│   └── ResponseParser.ts
│
├── structure/               # Structure generation
│   ├── StructurePlanGenerator.ts
│   ├── StructureValidator.ts
│   └── FormatInstructions.ts
│
├── schemas/                 # Type definitions
│   └── structurePlan.ts
│
└── utils/                   # Shared utilities
    └── contentPersistence.ts
```

---

## 🎯 Next Steps After Deployment

1. **Monitor Performance**
   - Set up Vercel Analytics
   - Track function durations
   - Monitor error rates

2. **Optimize Bundle Size**
   - Implement code splitting
   - Lazy load large components
   - Tree-shake unused code

3. **Refactor Orchestrator**
   - Follow migration strategy above
   - Extract actions one by one
   - Add unit tests for each action

4. **Implement Caching**
   - Cache structure plans
   - Cache model selections
   - Use Redis for session data

5. **Add Observability**
   - Structured logging
   - Error tracking (Sentry)
   - Performance monitoring (New Relic)

---

## 📞 Support

If deployment fails:
1. Check Vercel build logs
2. Review TypeScript errors above
3. Verify environment variables
4. Test locally with `npm run build`
5. Check this guide for common issues

**Good luck with deployment! 🚀**

