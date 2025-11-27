# TypeScript Quality Checklist

**Created:** Saturday, November 22, 2025  
**Context:** After 3 TypeScript build errors caught by Vercel

---

## 🚨 The Problem

**What Happened:**
- Made changes that passed local linting
- Committed and pushed to GitHub
- Vercel build **failed** with TypeScript strict mode errors
- Required 3 hotfixes to resolve

**Why It Happened:**
- Local `read_lints` tool only checks ESLint (syntax/style)
- Does NOT run TypeScript compiler in strict mode
- Vercel runs full `tsc` build with `--strict` flag
- Type errors only caught in CI/CD

---

## ✅ How to Prevent This

### **Before Every Commit:**

#### 1. **Run TypeScript Check**
```bash
# Option A: Full build (catches all errors)
npm run build

# Option B: Type check only (faster)
npx tsc --noEmit

# Option C: Type check with strict mode
npx tsc --noEmit --strict
```

#### 2. **Check Linter**
```bash
npm run lint
```

#### 3. **Both Together**
```bash
npm run build && npm run lint
```

---

## 🎯 Specific TypeScript Rules to Follow

### **1. Interface Consistency**
❌ **Don't:**
```typescript
// Define interface
interface Adapter {
  method(): string
}

// Implement differently
class MyAdapter implements Adapter {
  method(): string | undefined {  // ← Error!
    return undefined
  }
}
```

✅ **Do:**
```typescript
// Match exactly or use optional
interface Adapter {
  method(): string | undefined  // ← Match implementation
}

class MyAdapter implements Adapter {
  method(): string | undefined {
    return undefined
  }
}
```

### **2. Optional vs Required Parameters**
❌ **Don't:**
```typescript
interface Config {
  userKeyId?: string  // Optional
}

function useConfig(config: Config) {
  callAPI(config.userKeyId)  // ← Error: might be undefined!
}
```

✅ **Do:**
```typescript
interface Config {
  userKeyId?: string
}

function useConfig(config: Config) {
  if (!config.userKeyId) {
    throw new Error('userKeyId required')
  }
  callAPI(config.userKeyId)  // ✅ TypeScript knows it's defined
}
```

### **3. AsyncGenerator Types**
❌ **Don't:**
```typescript
// Interface
AsyncGenerator<{ type: 'content' }>

// Implementation
AsyncGenerator<{ type: 'content' | 'error' }>  // ← Extra types!
```

✅ **Do:**
```typescript
// Interface includes all possible types
AsyncGenerator<{ type: 'content' | 'error' | 'done' }>

// Implementation matches
AsyncGenerator<{ type: 'content' | 'error' | 'done' }>
```

---

## 📋 Pre-Commit Checklist

- [ ] Run `npx tsc --noEmit` (or `npm run build`)
- [ ] Check output for **0 errors**
- [ ] Run `npm run lint`
- [ ] All linter errors fixed
- [ ] Test changes in browser (if UI)
- [ ] Commit with descriptive message

---

## 🔧 TypeScript Configuration

Current setup (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "strict": true,              // ← Vercel uses this
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**This is why Vercel catches errors local linter misses.**

---

## 🎓 Lessons Learned

### **Error #1: Missing Interface Method**
- Added `generateStream` to implementation
- Forgot to add to interface
- **Fix:** Always update interface when adding methods

### **Error #2: Optional Parameter Mismatch**
- Interface had `userKeyId?: string`
- Function expected `userKeyId: string`
- **Fix:** Add validation or make parameter optional

### **Error #3: AsyncGenerator Type Mismatch**
- Interface and implementation had different union types
- **Fix:** Align types exactly

---

## 🚀 Moving Forward

**Commitment:**
1. ✅ Run `npx tsc --noEmit` before EVERY commit
2. ✅ Check both linter AND TypeScript
3. ✅ Test locally before pushing
4. ✅ No more "fix TypeScript errors in CI/CD"

**Why This Matters:**
- Faster development (catch errors early)
- No broken Vercel builds
- Better code quality
- Professional development practice

---

## 📊 Build Error Tracker

| Date | Error | Caught By | Prevention |
|------|-------|-----------|------------|
| Nov 22 | Missing `generateStream` in interface | Vercel | Run `tsc --noEmit` |
| Nov 22 | `userKeyId` optional/required mismatch | Vercel | Run `tsc --noEmit` |
| Nov 22 | AsyncGenerator type mismatch | Vercel | Run `tsc --noEmit` |

**All preventable with local TypeScript check!**

---

**Branch:** `feature/ui-enhancements`  
**Status:** Process improvement documented  
**Action:** Follow checklist for all future commits
