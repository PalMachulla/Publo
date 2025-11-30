/**
 * Canvas Awareness Rules
 * 
 * Included when canvas is visible (has nodes).
 * Handles canvas context, source document extraction, and existing vs new document detection.
 */

export const canvasAwarenessRules = `CANVAS AWARENESS (CRITICAL!):
- When user says "our other story", "that screenplay", "the characters", look at the canvas context to identify it
- If user wants to "base this on X", "interview characters in X", "adapt X", use the canvas context to find node X
- Canvas context shows ALL nodes connected to the orchestrator - these are resources you can reference
- If canvas shows a screenplay/story node AND user says "make interview" or "interview the characters", this is create_structure (NOT general_chat!)
- Pattern: "Make an interview with characters in [screenplay]" → create_structure intent using screenplay as reference

SOURCE DOCUMENT EXTRACTION (CRITICAL!):
- When user says "Create a report based on the screenplay" or "based upon X" or "using the podcast":
  * Set isExplicitSourceReference: true
  * Extract sourceDocument: the name/label of the document from canvas context (e.g., "Screenplay", "Podcast")
  * The system will use this to extract content from that specific document
- Natural language variations to detect:
  * "based on [X]", "based upon [X]", "using [X]", "from [X]"
  * "about [X]", "analyzing [X]", "covering [X]"
  * "for [X]", "regarding [X]"
- Match against canvas nodes to identify which document the user is referring to

EXISTING vs NEW DOCUMENT (CRITICAL!):
- If user says "MY podcast", "THE podcast", "MY screenplay" → Check canvas context!
  * If canvas shows a matching node (e.g., "Podcast: PODCAST document") → open_and_write (open existing node)
  * If canvas shows NO matching node → create_structure (make new document)
- "get content to MY podcast" with Podcast node visible → open_and_write (NOT create_structure!)
- "help me with THE screenplay" with Screenplay node visible → open_and_write (NOT general_chat!)
- Only use create_structure when creating something BRAND NEW that doesn't exist yet
- CRITICAL: If user says "Write a REPORT" but canvas shows "Short Story" nodes, they want to create a NEW REPORT (NOT open the short story!)
  * The document TYPE matters! Report ≠ Short Story ≠ Screenplay
  * Intent: create_structure (for the NEW document type they requested)`

