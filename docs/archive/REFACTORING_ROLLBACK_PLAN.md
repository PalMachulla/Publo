# Refactoring Rollback Plan

**Purpose:** Emergency procedures for rolling back refactoring changes  
**Branch:** refactor/orchestrator-modular  
**Date:** 2025-11-27

---

## Quick Reference

### 🚨 Emergency Rollback Commands

```bash
# Undo uncommitted changes
git restore [file]

# Undo all uncommitted changes
git reset --hard HEAD

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Revert specific commit
git revert [commit-hash]
```

---

## Rollback Scenarios

### Scenario 1: Current Change Breaks Something (Not Committed)

**Symptoms:**
- Build fails
- Tests fail
- Console errors
- UI broken

**Steps:**

1. **Check what changed:**
   ```bash
   git status
   git diff
   ```

2. **Restore specific file:**
   ```bash
   git restore frontend/src/lib/orchestrator/actions/AnswerQuestionAction.ts
   ```

3. **Or restore all changes:**
   ```bash
   git reset --hard HEAD
   ```

4. **Verify fix:**
   ```bash
   npm run build
   npm run lint
   ```

5. **Test key scenarios:**
   - Answer question
   - Create structure
   - Write content

---

### Scenario 2: Committed Change Breaks Something

**Symptoms:**
- Build worked before commit
- Now broken after commit
- Need to undo commit

**Steps:**

1. **Find the problematic commit:**
   ```bash
   git log --oneline -10
   ```
   
   Output:
   ```
   abc1234 refactor: Extract AnswerQuestionAction
   def5678 docs: Add test scenarios
   ghi9012 chore: Create safety branch
   ```

2. **Option A: Revert commit (safe, creates new commit):**
   ```bash
   git revert abc1234
   git push origin refactor/orchestrator-modular
   ```
   
   **Pros:** Preserves history, safe for shared branches  
   **Cons:** Creates revert commit

3. **Option B: Reset to previous commit (destructive):**
   ```bash
   # Keep changes as uncommitted
   git reset --soft HEAD~1
   
   # Or discard changes entirely
   git reset --hard HEAD~1
   
   # Force push (only if branch not shared!)
   git push --force origin refactor/orchestrator-modular
   ```
   
   **Pros:** Clean history  
   **Cons:** Destructive, dangerous if others pulled the branch

4. **Verify fix:**
   ```bash
   npm run build
   # Run test scenarios
   ```

---

### Scenario 3: Multiple Commits Need Rollback

**Symptoms:**
- Last 3 commits all have issues
- Need to go back to known good state

**Steps:**

1. **Find last known good commit:**
   ```bash
   git log --oneline -20
   ```
   
   Identify commit hash before problems started (e.g., `ghi9012`)

2. **Option A: Interactive rebase (advanced):**
   ```bash
   git rebase -i ghi9012
   # Mark commits to drop or edit
   ```

3. **Option B: Reset to good commit:**
   ```bash
   # Keep changes as uncommitted
   git reset --soft ghi9012
   
   # Or discard all changes
   git reset --hard ghi9012
   
   # Force push
   git push --force origin refactor/orchestrator-modular
   ```

4. **Verify fix:**
   ```bash
   npm run build
   npm run lint
   # Test all scenarios
   ```

---

### Scenario 4: Nuclear Option (Start Over)

**Symptoms:**
- Refactoring branch is completely broken
- Easier to start fresh than fix
- Need to abandon all changes

**Steps:**

1. **Save any work you want to keep:**
   ```bash
   # Create patch file
   git diff > my-changes.patch
   
   # Or stash changes
   git stash save "Work in progress"
   ```

2. **Delete broken branch:**
   ```bash
   git checkout refactor/phase3-multi-agent-coordination
   git branch -D refactor/orchestrator-modular
   ```

3. **Create fresh branch:**
   ```bash
   git checkout -b refactor/orchestrator-modular
   git push -u origin refactor/orchestrator-modular
   ```

4. **Optionally apply saved work:**
   ```bash
   # Apply patch
   git apply my-changes.patch
   
   # Or pop stash
   git stash pop
   ```

---

## Verification Checklist

After any rollback, verify the system is working:

### Build Verification
```bash
cd /Users/palmac/Aiakaki/Code/publo/frontend
npm run build
```

**Expected:** ✅ Build completes successfully

---

### Linter Verification
```bash
npm run lint
```

**Expected:** ✅ No errors (warnings OK)

---

### Type Check Verification
```bash
npx tsc --noEmit
```

**Expected:** ✅ No type errors

---

### Manual Testing

Run these key scenarios from ORCHESTRATOR_TEST_SCENARIOS.md:

1. **Answer Question (Empty Canvas)**
   - Open canvas
   - Type "What is this app?"
   - ✅ Response appears
   - ✅ No console errors

2. **Create Structure**
   - Type "Write a novel about dragons"
   - ✅ Structure generated
   - ✅ Node created on canvas
   - ✅ Document panel opens

3. **Write Content**
   - Create novel structure
   - Type "Write Chapter 1"
   - ✅ Content generated
   - ✅ Appears in document panel
   - ✅ No errors

**Pass Criteria:**
- [ ] All 3 scenarios work
- [ ] No console errors
- [ ] UI responsive
- [ ] No memory leaks

---

## Prevention Strategies

### Before Making Changes

1. **Create checkpoint commit:**
   ```bash
   git add -A
   git commit -m "checkpoint: Before extracting AnswerQuestionAction"
   ```

2. **Run tests:**
   ```bash
   npm run build
   npm run lint
   ```

3. **Document what you're changing:**
   - Which file(s)
   - What logic
   - Expected behavior

---

### During Changes

1. **Commit frequently:**
   ```bash
   # After each logical step
   git add -A
   git commit -m "refactor: Extract BaseAction class"
   ```

2. **Test after each commit:**
   ```bash
   npm run build
   # Test affected scenarios
   ```

3. **Keep commits small:**
   - One action extraction per commit
   - Easy to revert individual changes

---

### After Changes

1. **Verify build:**
   ```bash
   npm run build
   ```

2. **Run test scenarios:**
   - Use ORCHESTRATOR_TEST_SCENARIOS.md
   - Test affected intents
   - Check console for errors

3. **Push to remote:**
   ```bash
   git push origin refactor/orchestrator-modular
   ```

---

## Common Issues & Solutions

### Issue: "Cannot find module" after refactoring

**Cause:** Import paths broken after moving files

**Solution:**
```bash
# Check what files changed
git status

# Restore imports
git restore [affected-file]

# Or fix imports manually
# Update import paths to new locations
```

---

### Issue: TypeScript errors after extraction

**Cause:** Type definitions not exported/imported correctly

**Solution:**
```bash
# Check TypeScript errors
npx tsc --noEmit

# Fix exports in extracted file
export type { IntentAnalysis, OrchestratorRequest }

# Fix imports in orchestratorEngine.ts
import type { IntentAnalysis } from './actions/types'
```

---

### Issue: Tests pass but UI broken

**Cause:** Runtime behavior different from test mocks

**Solution:**
1. Open browser console
2. Check for errors
3. Verify action payloads match expected format
4. Check WorldState/Blackboard updates

---

### Issue: Build works locally but fails in CI

**Cause:** Environment differences, missing dependencies

**Solution:**
```bash
# Clean install
rm -rf node_modules
npm install

# Rebuild
npm run build

# Check for platform-specific issues
```

---

## Rollback Decision Tree

```
Is the issue blocking?
├─ YES → Rollback immediately
│   ├─ Uncommitted? → git restore
│   ├─ Last commit? → git revert
│   └─ Multiple commits? → git reset
│
└─ NO → Try to fix forward
    ├─ Simple fix? → Fix and commit
    ├─ Complex fix? → Create checkpoint, then fix
    └─ Unsure? → Rollback, then fix properly
```

---

## Rollback Testing Procedure

After any rollback:

### 1. Verify Git State
```bash
git status
# Should show clean working tree

git log --oneline -5
# Should show expected commits
```

### 2. Verify Build
```bash
npm run build
# Should complete successfully
```

### 3. Verify Functionality
- Run 3 key test scenarios
- Check console for errors
- Verify UI works

### 4. Document What Happened
Create issue or note:
- What broke
- What was rolled back
- What needs to be fixed
- How to prevent in future

---

## Emergency Contacts

If you're stuck and need help:

1. **Check documentation:**
   - ORCHESTRATOR_CURRENT_BEHAVIOR.md
   - ORCHESTRATOR_TEST_SCENARIOS.md
   - ORCHESTRATOR_ARCHITECTURE_CURRENT.md

2. **Check git history:**
   ```bash
   git log --oneline --graph -20
   ```

3. **Check recent changes:**
   ```bash
   git diff HEAD~5
   ```

4. **Ask for help:**
   - Describe what broke
   - Share error messages
   - Share git log
   - Share what you tried

---

## Post-Rollback Actions

After successful rollback:

### 1. Update Documentation
- Note what went wrong
- Update rollback plan if needed
- Document lessons learned

### 2. Plan Fix
- Understand root cause
- Plan proper fix
- Consider smaller steps

### 3. Prevent Recurrence
- Add test for the issue
- Update checklist
- Improve verification steps

---

## Success Criteria

Rollback is successful when:

- [ ] Build completes without errors
- [ ] Linter passes
- [ ] TypeScript compiles
- [ ] Key test scenarios pass
- [ ] No console errors
- [ ] UI works correctly
- [ ] Git history is clean
- [ ] Team can continue working

---

## Remember

**It's OK to rollback!**

- Rollbacks are normal in refactoring
- Better to rollback than ship broken code
- Learn from what went wrong
- Try again with smaller steps

**When in doubt, rollback.**

