# Deep Agent Canvas Sources (Connected Nodes → Agent Context)

**Last Updated:** 2025-12-17  
**Status:** Active (Python Deep Agent + SSE streaming)

This document describes how **React Flow canvas nodes** influence the **Deep Agent** story generation system when they are **connected to the Orchestrator node**.

---

## Why “connected nodes” matter

Publo’s canvas is evolving into a **source graph**. Nodes represent different kinds of structured knowledge (characters, research, world bible, style samples, etc.).  

**Rule:** Only nodes that are **connected by an edge** to the Orchestrator node are treated as high-priority context for generation (to control relevance and prevent prompt bloat).

---

## Active request flow (today)

### Frontend → SSE request payload

The streaming UI sends the following fields to the Python backend:

- `canvas_nodes`: React Flow nodes snapshot
- `canvas_edges`: React Flow edges snapshot (**required for “connected” semantics**)
- `orchestrator_node_id`: the selected Orchestrator node ID (e.g. `context_<storyId>`)
- `structure_items`: currently active structure items (sections)
- `active_section_card`: Librarian card currently being viewed (if any)

**Code:**
- `frontend/src/components/panels/NodeDetailsPanel.tsx`
- `frontend/src/components/orchestrator/OrchestratorPanelStreaming.tsx`
- `frontend/src/hooks/useOrchestratorStream.ts`

### Backend → agent context injection

The Python chat endpoint builds a system prompt stack by injecting structured context as additional **system messages** before the user message is processed.

**Code:**
- `orchestrator/api/chat.py`

---

## Implemented source: Character Node

### What it is

Canvas **Character nodes** represent persisted personas from Supabase (`characters` table). They can have:
- `name`
- `bio`
- `role` (e.g. Main/Active/Passive…)
- optional `attributes`

### How it influences generation

When a Character node is **connected** to the Orchestrator node:

- The backend extracts connected character nodes.
- If a node only has `characterId` (and is missing details like `bio`), the backend **optionally enriches** it from Supabase (service role) and applies basic visibility filtering.
- The agent receives a “HIGH PRIORITY” system message with each persona’s role + bio, intended to influence:
  - voice
  - motivations/behavior
  - presence in scenes
  - relationship consistency

---

## Adding new canvas source types (pattern)

To add a new source type (e.g. Research, World Bible, Style Sample):

1. **Frontend**
   - Ensure `canvas_nodes`, `canvas_edges`, and `orchestrator_node_id` are included in the streaming request.
2. **Backend**
   - Identify connected nodes using edges + orchestrator ID.
   - Extract nodes of your type (by `node.type` and/or `node.data.nodeType`).
   - Create a compact system message:
     - Cap counts (e.g. 10–20 items)
     - Truncate long fields
     - Prefer structured bullet/JSON snippets over prose
3. **Safety & consistency**
   - Treat node data as untrusted input; validate/guard defensively.
   - Avoid “silent defaults” that might change meaning (log/skip instead).

---

## Common pitfalls

- **No edges provided** → backend cannot know what is “connected”, so everything becomes implicit and noisy.
- **Relying on label-only nodes** → persona influence becomes weak. Prefer enriching from Supabase when IDs exist.
- **Prompt bloat** → always cap and truncate; connected-node gating is essential.

