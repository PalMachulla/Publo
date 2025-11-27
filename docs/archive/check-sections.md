# Debug Plan: 409 Conflict Errors

## Root Cause
Sections cannot be created because:
1. RLS policy checks if node exists in database
2. If node not saved yet → RLS blocks insert → 409 Conflict

## Quick Fix: Save Canvas First

**STEPS TO TEST:**
1. After generating the screenplay structure
2. Click "Save Changes" button (top of canvas)
3. Wait for "Saved" confirmation
4. THEN open the document panel
5. Sections should initialize successfully

## If That Doesn't Work

The issue is likely:
- Node saved but user_id doesn't match
- RLS policy too strict
- Need to disable RLS temporarily OR
- Fix the section creation to bypass RLS

Let me know if saving first helps!
