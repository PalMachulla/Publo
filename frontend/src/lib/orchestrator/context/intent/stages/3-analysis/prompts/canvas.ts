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
- If user says "MY podcast", "THE podcast", "MY screenplay", "OUR novel" → Check canvas context!
  * If canvas shows a matching node (e.g., "Podcast: PODCAST document") → open_and_write (open existing node)
  * If canvas shows NO matching node → create_structure (make new document)
- "get content to MY podcast" with Podcast node visible → open_and_write (NOT create_structure!)
- "help me with THE screenplay" with Screenplay node visible → open_and_write (NOT general_chat!)
- "write [sections] in [our/the/my] [document]" → open_and_write (CRITICAL PATTERN!)
  * Examples: "write the three first chapters in our novel" → open_and_write with targetSegment: "chapter 1, chapter 2, chapter 3"
  * "write chapter 2 in the screenplay" → open_and_write with targetSegment: "chapter 2"
  * "write the first act in my novel" → open_and_write with targetSegment: "act 1"
  * Extract targetSegment from the message (can be multiple sections)
  * Check canvas for matching document type
  * If document exists → open_and_write (NOT create_structure!)
- Only use create_structure when creating something BRAND NEW that doesn't exist yet
- CRITICAL: If user says "Write a REPORT" but canvas shows "Short Story" nodes, they want to create a NEW REPORT (NOT open the short story!)
  * The document TYPE matters! Report ≠ Short Story ≠ Screenplay
  * Intent: create_structure (for the NEW document type they requested)

MULTIPLE SECTIONS EXTRACTION (CRITICAL!):
- When user says "write the three first chapters", "write chapters 1, 2, and 3", "write the first three acts":
  * Extract ALL mentioned sections into targetSegment or autoGenerateSections
  * Examples:
    * "write the three first chapters" → targetSegment: "chapter 1, chapter 2, chapter 3" OR autoGenerateSections: ["chapter 1", "chapter 2", "chapter 3"]
    * "write chapters 1, 2, and 3" → targetSegment: "chapter 1, chapter 2, chapter 3"
    * "write the first two scenes" → targetSegment: "scene 1, scene 2"
  * For open_and_write intent: Extract sections into targetSegment (will be processed after document opens)
  * For create_structure intent: Extract sections into autoGenerateSections (will be generated after structure creation)`

