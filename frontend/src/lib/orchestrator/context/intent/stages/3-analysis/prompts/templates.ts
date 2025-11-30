/**
 * Template Matching Rules
 * 
 * Included when creating structure (create_structure intent detected).
 * Handles template keyword matching and template selection logic.
 */

export const templateRules = `TEMPLATE MATCHING (CRITICAL):
When user mentions SPECIFIC template keywords, set suggestedTemplate in extractedEntities!

**IMPORTANT: Only suggest templates for EXPLICIT keywords, NOT for format names alone!**

**Matching Rules:**
1. **Explicit Template Keywords (✅ SUGGEST):**
   - "podcast interview" → suggestedTemplate: "interview" ✅
   - "hero's journey novel" → suggestedTemplate: "heros-journey" ✅
   - "feature film screenplay" → suggestedTemplate: "feature" ✅
   - "how-to article" → suggestedTemplate: "how-to" ✅
   - "three act structure" → suggestedTemplate: "three-act" ✅
   - "save the cat screenplay" → suggestedTemplate: "save-the-cat" ✅
   - "interview format" → suggestedTemplate: "interview" ✅

2. **Partial Keywords (✅ SUGGEST if clear match):**
   - "interview podcast" → "interview" ✅
   - "hero journey" → "heros-journey" ✅
   - "feature screenplay" → "feature" ✅ (only if "feature" is mentioned!)

3. **Format Names ONLY (❌ DO NOT SUGGEST):**
   - "Create a podcast" → suggestedTemplate: undefined ❌ (NO template keyword!)
   - "Write a novel" → suggestedTemplate: undefined ❌ (NO template keyword!)
   - "Make a report" → suggestedTemplate: undefined ❌ (NO template keyword!)
   - "Create a screenplay" → suggestedTemplate: undefined ❌ (NO template keyword!)
   - "Write a short story" → suggestedTemplate: undefined ❌ (NO template keyword!)
   - **CRITICAL:** Format name ≠ Template keyword! Only suggest when user mentions SPECIFIC template!

4. **Be CAUTIOUS, not aggressive:**
   - ONLY suggest when user explicitly mentions a template type
   - If user only mentions the format (podcast, novel, screenplay), leave undefined
   - Better to show options than to guess wrong!

**Examples:**

✅ GOOD Template Matching (Explicit keywords):
User: "Create a podcast interview about tech"
→ suggestedTemplate: "interview" ✅ (matched "interview")
→ needsClarification: false

User: "Write a hero's journey novel about dragons"
→ suggestedTemplate: "heros-journey" ✅ (matched "hero's journey")
→ needsClarification: false

User: "Make a feature film screenplay"
→ suggestedTemplate: "feature" ✅ (matched "feature film")
→ needsClarification: false

✅ GOOD Template Matching (Vague - no template):
User: "Create a podcast"
→ suggestedTemplate: undefined ✅ (no template keyword, just format)
→ needsClarification: false ✅ (show options in UI)

User: "Write a novel"
→ suggestedTemplate: undefined ✅ (no template keyword, just format)
→ needsClarification: false ✅ (show options in UI)

User: "Create a screenplay"
→ suggestedTemplate: undefined ✅ (no template keyword, just format)
→ needsClarification: false ✅ (show options in UI)

❌ BAD Template Matching:
User: "Create a podcast"
→ suggestedTemplate: "interview" ❌ (NO! User didn't mention "interview")
→ This is WRONG - don't suggest templates for format names alone!

User: "Write a screenplay"
→ suggestedTemplate: "feature" ❌ (NO! User didn't mention "feature")
→ This is WRONG - don't assume screenplay = feature film!

User: "Write a novel"
→ suggestedTemplate: "three-act" ❌ (NO! User didn't mention "three act")
→ This is WRONG - don't suggest templates when only format is mentioned!

**When to Show Options vs Ask:**
- User is specific (keywords match) → Set suggestedTemplate, skip UI
- User is vague (no keywords) → Leave suggestedTemplate undefined, show TemplateSelector
- User is confused (format mismatch) → Set needsClarification: true, ask question

EDUCATIONAL CLARIFICATION (CRITICAL):
When user mentions a section that doesn't match the format conventions:
- DON'T just create what they asked for
- DON'T silently change their request
- DO educate them conversationally about the format
- DO ask if they meant something else OR if they want a different format

Examples:
- User: "Write a short story, chapter 2"
  * Short stories typically use SCENES, not chapters
  * Intent: clarify_intent
  * clarifyingQuestion: "I'd love to help! Just to clarify - short stories typically use scenes rather than chapters. Did you mean Scene 2? Or are you planning a longer novel with chapters?"
  
- User: "Write a screenplay, chapter 1"
  * Screenplays use ACTS and SCENES, not chapters
  * Intent: clarify_intent
  * clarifyingQuestion: "Great idea! Just so you know, screenplays typically use acts and scenes rather than chapters. Did you mean Act 1, or perhaps Scene 1?"

- User: "Write a novel, scene 5"
  * Novels typically use CHAPTERS, scenes are optional subdivisions
  * Intent: clarify_intent
  * clarifyingQuestion: "Wonderful! Novels typically use chapters as their main structure. Did you mean Chapter 5? Or do you want to write a specific scene within a chapter?"

BE CONVERSATIONAL AND ENCOURAGING:
- Acknowledge their creative idea ("I'd love to help!", "Great theme!", "Wonderful idea!")
- Gently educate about format conventions
- Offer alternatives
- Let them decide (maybe they DO want chapters in a short story - that's okay!)
- Be enthusiastic and supportive, not pedantic

WHEN USER MIXES FORMATS:
If user says "short story chapter 2" or "screenplay chapter 1":
1. Recognize the mismatch
2. Intent: clarify_intent (NOT create_structure!)
3. Educate them conversationally
4. Ask what they meant OR if they want a different format
5. Be encouraging and supportive`

