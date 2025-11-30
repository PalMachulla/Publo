/**
 * Follow-Up Conversation Rules
 * 
 * Included when in conversation (has conversation history or follow-up detected).
 * Handles follow-up responses, frustrated repeats, and maintaining original context.
 */

export const followUpRules = `FOLLOW-UP RESPONSES (CRITICAL):
- If the orchestrator just asked "Which section would you like me to write in?" and user responds with "first", "second", "the first one", "1", "2", etc.:
  * Intent: write_content
  * Extract the section reference (first, second, 1, 2, etc.)
  * Set targetSegment to the ordinal/numeric reference
  * The system will resolve this to the actual section ID
- If orchestrator asked a clarification question about format (e.g., "Did you mean Scene 2?" or "Did you mean Section 2?"), and user responds with "Yes, scene 2 I mean" or "Yes, section 2 I meant":
  * THIS IS CRITICAL: The user is CONFIRMING they want to CREATE A NEW DOCUMENT
  * Look at the ORIGINAL request in conversation history (2-3 messages back) to find what they wanted to create
  * Intent: create_structure (NOT write_content, NOT open_and_write!)
  * Extract the document format from the ORIGINAL request (e.g., "report", "short story", "screenplay", "novel")
  * Extract the CORRECTED section type from their response (e.g., "section 2" not "chapter 2", "scene 2" not "chapter 2")
  * Set autoGenerateSections to the section they want to write (e.g., ["section2"], ["scene2"])
  * Set documentFormat to the format from the original request (e.g., "report", "short-story", "screenplay")
  * This is a multi-step request: create structure + generate content
  * DO NOT confuse this with opening an existing document on the canvas!
- If orchestrator asked a clarification question, the user's response is answering that question
- Short responses like "first", "yes", "no", "the second one", "yes scene 2", "yes section 2" are usually follow-ups to orchestrator questions
- ALWAYS look at conversation history (go back 2-4 messages) to understand what question was asked and what the user is responding to
- MAINTAIN ORIGINAL CONTEXT: If user originally said "Write a REPORT" and then clarifies "section 2", they still want a REPORT (not a short story from canvas!)
- DO NOT let canvas nodes distract you from the user's original intent - they want to create what they asked for!

FRUSTRATED FOLLOW-UPS (CRITICAL):
- If user says "as I said", "like I told you", "I already said", "chapter 2 as I said":
  * User is frustrated because their request wasn't understood
  * Re-analyze their PREVIOUS message (look at conversation history)
  * Keep the same intent type they originally wanted
  * Extract the section reference they mentioned ("chapter 2", "act 1", etc.)
  * Intent: write_content (they want to write, not navigate!)`

