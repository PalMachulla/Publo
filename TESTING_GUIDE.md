# Orchestrator Agentic System - Testing Guide

## 🎯 Overview

This guide covers testing the new orchestrator-based agentic system that replaces the legacy YAML-based generation.

**Branch:** `feature/agentic-orchestrator`  
**Status:** ✅ Implementation Complete, Ready for Testing  
**Do NOT merge to main until testing passes**

---

## 📋 Pre-Testing Setup

### 1. Run Database Migration

The system requires new database columns for orchestrator preferences.

```bash
cd /Users/palmac/Aiakaki/Code/publo
npx supabase db push
```

**Expected Output:**
```
✓ Applying migration 012_add_orchestrator_preferences.sql...
✓ Migration complete
```

**What it does:**
- Adds `orchestrator_model_id` column (TEXT, nullable)
- Adds `writer_model_ids` column (TEXT[], nullable)
- Adds index on `orchestrator_model_id`

### 2. Start Development Server

```bash
cd frontend
npm run dev
```

### 3. Prepare Test API Keys

You'll need at least ONE API key from:
- ✅ Groq (recommended for testing - fast & free tier)
- OpenAI (GPT-4o for orchestrator, GPT-4o-mini for writer)
- Anthropic (Claude Sonnet 3.5 for orchestrator)

---

## 🧪 Test Cases

### Test 1: Profile Page Model Selection

**Objective:** Verify orchestrator/writer configuration UI works

**Steps:**
1. Navigate to `/profile`
2. Find your API key section
3. Click "Model Configuration" accordion
4. Verify two sections appear:
   - 🧠 Orchestrator Model (radio buttons)
   - ✍️ Writer Models (checkboxes)

**Expected Behavior:**
- [ ] Auto-select option is checked by default
- [ ] High-capability models show in Orchestrator section
- [ ] Other models show in Writer section
- [ ] Info banner explains the three modes
- [ ] Save button is enabled

**Test Scenarios:**

**A. Auto Mode (Recommended):**
- Keep "Auto-select" checked
- Leave writers empty
- Click "Save Configuration"
- ✅ Should save successfully

**B. Single-Model Mode:**
- Select an orchestrator (e.g., GPT-4o, Llama 70B)
- Leave writers empty
- Click "Save Configuration"
- ✅ Orchestrator does BOTH planning and writing

**C. Multi-Agent Mode:**
- Select an orchestrator (e.g., GPT-4o)
- Check writer models (e.g., GPT-4o-mini, Llama 8B)
- Click "Save Configuration"
- ✅ Orchestrator plans, delegates to cheaper writers

**Validation:**
- Check browser console for API call: `PATCH /api/user/api-keys/[id]/preferences`
- Should see alert: "✅ Model preferences saved!"
- Refresh page - selections should persist

---

### Test 2: Canvas Story Generation

**Objective:** Verify orchestrator-based generation creates structure

**Steps:**
1. Navigate to `/canvas` (or create new canvas)
2. Click the "Create Story" node (context node)
3. In the panel:
   - Verify "Model Configuration" shows your Profile settings (read-only)
   - Select format (e.g., "Novel")
   - Select template (e.g., "Three-Act Structure")
4. Click "Create Novel"

**Note:** Model selection has been moved to Profile page. The canvas panel now shows a read-only display of your configured orchestrator. If you need to change models, click "Change in Profile →"

**Expected Behavior:**
- [ ] New structure node appears on canvas
- [ ] Structure node shows "Loading..." initially
- [ ] Orchestrator node shows pink spinner + "INFERENCE"
- [ ] **Reasoning panel auto-opens** in Create Story panel
- [ ] Reasoning messages appear in real-time:
  - 🧠 "Initializing orchestrator engine..."
  - 📝 "Analyzing prompt..."
  - ✅ "Plan created: X sections, Y tasks"
  - 📊 "Structure initialized with X sections"
  - ✅ "Orchestration complete!"
- [ ] Structure node populates with sections
- [ ] Alert shows: "✅ Novel structure generated with orchestrator!"

**Console Validation:**
Check browser console for:
```
🎬 Starting orchestrator-based agentic generation...
🔍 Fetching user preferences...
📋 User preferences: { orchestratorModelId, writerModelIds, ... }
🚀 Initializing orchestrator engine...
📝 Analyzing prompt...
✅ Plan created: X sections, Y tasks
📊 Structure initialized with X sections
✅ Orchestration complete!
```

---

### Test 3: Reasoning Chat UI

**Objective:** Verify reasoning visibility works correctly

**Steps:**
1. During generation (Test 2), watch the reasoning panel
2. Click the "Orchestrator Reasoning" header to toggle

**Expected Behavior:**
- [ ] Panel opens automatically when first message arrives
- [ ] Messages appear in chronological order
- [ ] Each message shows:
  - Timestamp (HH:MM:SS)
  - Icon (🧠/💭/⚡/✅)
  - Colored background (blue/purple/yellow/green)
  - Message text
- [ ] Collapsible section works (toggle open/closed)
- [ ] Messages persist across panel re-opens

**Message Types:**
- **Thinking** (blue): Analysis, initialization
- **Decision** (purple): Model selection, task assignment
- **Task** (yellow): Task execution
- **Result** (green): Completion, success

---

### Test 4: Temporal Memory Logging

**Objective:** Verify temporal memory tracks orchestration events

**How to Check:**
1. Open browser DevTools → Console
2. Look for temporal memory logs during generation:

```
📝 Event logged: orchestration/orchestration_started structure-...
📝 Event logged: orchestration/models_selected gpt-4o
📝 Event logged: orchestration/plan_created 15_sections
📝 Event logged: orchestration/task_assigned task-1
📝 Event logged: orchestration/orchestration_completed novel
📊 Snapshot created: 5 events in 900000ms window
```

**Expected Events:**
- [ ] `orchestration_started` (with context hash)
- [ ] `models_selected` (orchestrator + writers)
- [ ] `plan_created` (section + task counts)
- [ ] `task_assigned` (for each task)
- [ ] `orchestration_completed` (duration)

**Snapshot Behavior:**
- After 15 minutes of activity, should see: `📊 Snapshot created`
- After 1 hour, old events roll up into snapshots

---

### Test 5: Error Handling

**Objective:** Verify graceful error handling

**Test Scenarios:**

**A. No API Key:**
- Remove all API keys from profile
- Try to generate structure
- ✅ Should show: "❌ No API key available. Go to Profile → Add API key"

**B. Invalid API Key:**
- Add invalid API key
- Try to generate
- ✅ Should show error from provider

**C. Rate Limiting:**
- Generate 11 structures within 1 minute
- ✅ 11th should be blocked by constraint: "Rate limit exceeded: Max 10 orchestrations per minute"

**D. Network Failure:**
- Disconnect internet during generation
- ✅ Should show: "Failed to generate structure" with helpful error

---

### Test 6: Backward Compatibility

**Objective:** Ensure existing workflows still work

**Test:**
1. Use the old `triggerAIGeneration` directly (if exposed)
2. Or verify legacy YAML generation still exists
3. Check that existing stories open without errors

**Expected:**
- [ ] Legacy function still exists in code
- [ ] No breaking changes to existing data structures
- [ ] Old stories load correctly

---

## 🔍 Known Issues & Workarounds

### Issue 1: Orchestrator Not Finding Models

**Symptom:** "No orchestrator models found" error

**Fix:**
- Go to Profile → BYOAPI
- Expand API key
- Open "Model Configuration"
- Save configuration (even with Auto-select)

### Issue 2: Reasoning Panel Not Opening

**Symptom:** Messages logged but panel stays closed

**Workaround:**
- Manually click "Orchestrator Reasoning" header
- Check browser console for errors

### Issue 3: Structure Empty After Generation

**Symptom:** Structure node shows 0 sections

**Debug:**
1. Check console for `plan.structure` log
2. Verify plan has sections
3. Check if `structureItems` mapping failed

---

## 📊 Success Criteria

### Minimum Viable Test (MVP):
- [x] Database migration runs successfully
- [ ] Profile page model selection works
- [ ] Canvas generates structure with orchestrator
- [ ] Reasoning messages appear
- [ ] No console errors
- [ ] Structure node populates

### Full Test Suite:
- [ ] All 6 test cases pass
- [ ] Temporal memory logs events correctly
- [ ] Error scenarios handled gracefully
- [ ] UI is responsive and intuitive
- [ ] Performance is acceptable (<10s for generation)

---

## 🚀 Post-Testing Actions

### If Tests Pass ✅

1. **Update Documentation:**
   ```bash
   git add ORCHESTRATOR_AGENTIC_SYSTEM.md
   git commit -m "docs: Update with test results"
   ```

2. **Merge to Main:**
   ```bash
   git checkout main
   git merge feature/agentic-orchestrator
   git push origin main
   ```

3. **Deploy:**
   ```bash
   npm run build
   # Deploy to production
   ```

### If Tests Fail ❌

1. **Document Issues:**
   - Note which test failed
   - Copy error messages
   - Take screenshots

2. **File Issues:**
   - Create GitHub issues for each bug
   - Link to test case
   - Add reproduction steps

3. **Fix & Retest:**
   - Fix issues on feature branch
   - Re-run tests
   - Do NOT merge until all tests pass

---

## 🎯 Testing Checklist

**Setup:**
- [ ] Database migration complete
- [ ] Dev server running
- [ ] API keys ready

**Tests:**
- [ ] Test 1: Profile Page Model Selection
- [ ] Test 2: Canvas Story Generation
- [ ] Test 3: Reasoning Chat UI
- [ ] Test 4: Temporal Memory Logging
- [ ] Test 5: Error Handling
- [ ] Test 6: Backward Compatibility

**Validation:**
- [ ] No console errors
- [ ] Performance acceptable
- [ ] UI/UX smooth
- [ ] Documentation updated

**Ready for Merge:**
- [ ] All tests passed
- [ ] Issues documented/fixed
- [ ] Team review completed
- [ ] Changelog updated

---

## 📝 Test Log Template

Use this template to log your test results:

```markdown
## Test Session: [DATE] [TIME]

**Tester:** [NAME]
**Branch:** feature/agentic-orchestrator
**Commit:** [HASH]

### Environment:
- Node: [VERSION]
- Browser: [BROWSER + VERSION]
- API Keys: [PROVIDERS TESTED]

### Test Results:

**Test 1: Profile Page**
- Status: ✅ PASS / ❌ FAIL
- Notes: [OBSERVATIONS]

**Test 2: Canvas Generation**
- Status: ✅ PASS / ❌ FAIL
- Notes: [OBSERVATIONS]

[... continue for all tests ...]

### Issues Found:
1. [ISSUE DESCRIPTION]
2. [ISSUE DESCRIPTION]

### Recommendations:
- [ACTION ITEMS]

### Ready to Merge: ✅ YES / ❌ NO
```

---

## 🆘 Getting Help

**Console Errors:**
- Check browser DevTools → Console
- Look for red error messages
- Copy full stack trace

**API Errors:**
- Check Network tab in DevTools
- Find failed requests
- Check response body

**Supabase Errors:**
- Check Supabase Studio → Database → Logs
- Verify migration applied
- Check table schema

**Contact:**
- Create GitHub issue with "bug" label
- Include console logs, screenshots
- Describe expected vs actual behavior

---

**Last Updated:** [DATE]  
**Version:** 1.0  
**Status:** Ready for Testing

