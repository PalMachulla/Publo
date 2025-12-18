"""
Chat API Endpoint

New /chat endpoint using the Deep Agent architecture.
Provides a "power chat" experience similar to Claude.ai or Cursor.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, AsyncIterator
from langsmith import traceable
import json
import os

# Use the new official deepagents-based agent
from deep_agent import create_publo_deep_agent, run_deep_agent_streaming
# Fallback to old agent if needed
from agent import create_publo_agent_with_mcp, run_agent_streaming
from streaming import format_sse, SSEEventType
from config import settings

# LangChain message utilities
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage


router = APIRouter()


# ============================================================
# HELPER: Token-aware conversation history trimming
# ============================================================

def get_token_counter():
    """Get a token counter function for Claude."""
    # Use Claude's tokenizer for accurate counting
    model = ChatAnthropic(model="claude-sonnet-4-20250514")
    return model.get_num_tokens_from_messages


def trim_conversation_history(
    history: List[Dict[str, str]],
    max_tokens: int = 80000,  # Leave room for system prompt + response
) -> List[Dict[str, str]]:
    """
    Trim conversation history using LangChain's token-aware trimming.
    
    Uses the 'last' strategy to keep recent messages that fit within token budget.
    
    Args:
        history: List of {"role": "user"|"assistant", "content": "..."} dicts
        max_tokens: Maximum tokens to allow for conversation history
    
    Returns:
        Trimmed history as list of dicts
    """
    if not history:
        return []
    
    # Convert to LangChain messages
    lc_messages = []
    for msg in history:
        if msg.get("role") == "user":
            lc_messages.append(HumanMessage(content=msg.get("content", "")))
        elif msg.get("role") == "system":
            lc_messages.append(SystemMessage(content=msg.get("content", "")))
        else:
            lc_messages.append(AIMessage(content=msg.get("content", "")))
    
    original_count = len(lc_messages)
    
    try:
        # Use LangChain's trim_messages with token counting
        trimmed = trim_messages(
            lc_messages,
            max_tokens=max_tokens,
            strategy="last",  # Keep most recent messages
            token_counter=get_token_counter(),
            include_system=True,  # Always keep system messages
            allow_partial=False,  # Don't split messages
        )
        
        if len(trimmed) < original_count:
            print(f"✂️ [Chat] Trimmed history: {original_count} → {len(trimmed)} messages (max {max_tokens} tokens)", flush=True)
        
        # Convert back to dict format
        result = []
        for msg in trimmed:
            if isinstance(msg, HumanMessage):
                result.append({"role": "user", "content": msg.content})
            elif isinstance(msg, SystemMessage):
                result.append({"role": "system", "content": msg.content})
            else:
                result.append({"role": "assistant", "content": msg.content})
        
        return result
        
    except Exception as e:
        # Fallback to simple message count limit if token counting fails
        print(f"⚠️ [Chat] Token trimming failed, using fallback: {e}", flush=True)
        max_messages = 30
        if len(history) > max_messages:
            return history[-max_messages:]
        return history


# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================

class ChatRequest(BaseModel):
    """
    Chat request from frontend.
    
    This is the main request format for the Deep Agent.
    """
    # Required
    message: str
    story_id: str
    
    # Context
    document_format: str = "novel"
    active_section_id: Optional[str] = None
    user_preferences: Optional[Dict[str, Any]] = None
    story_structure_node_id: Optional[str] = None  # Active structure node for Librarian context
    
    # Canvas context - what structures exist
    canvas_nodes: Optional[List[Dict[str, Any]]] = None  # All nodes on canvas
    canvas_edges: Optional[List[Dict[str, Any]]] = None  # All edges on canvas (ReactFlow)
    structure_items: Optional[List[Dict[str, Any]]] = None  # Current structure's sections
    orchestrator_node_id: Optional[str] = None  # Orchestrator node ID (for connection-based context)
    
    # Librarian context - active section card being viewed
    active_section_card: Optional[Dict[str, Any]] = None  # Section card currently in view
    
    # Conversation
    conversation_history: Optional[List[Dict[str, str]]] = None
    
    # Session
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    thread_id: Optional[str] = None  # For memory continuity
    
    # Extended thinking - stream Claude's chain-of-thought reasoning
    extended_thinking: bool = False


class ChatResponse(BaseModel):
    """Non-streaming chat response."""
    success: bool
    response: str
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    error: Optional[str] = None


# ============================================================
# STREAMING CHAT ENDPOINT
# ============================================================

@router.post("/chat")
@traceable(name="deep_agent_chat", metadata={"endpoint": "chat"})
async def chat(request: ChatRequest):
    """
    Main chat endpoint with SSE streaming.
    
    This provides a "power chat" experience where the agent:
    - Understands context naturally
    - Calls tools as needed without explicit routing
    - Streams responses in real-time
    
    Event types:
    - TOKEN: Streaming text content
    - TOOL_START: Tool execution beginning
    - TOOL_END: Tool execution complete
    - CONTENT_CHUNK: Content from write_section (streamed)
    - NAVIGATE: Navigation request
    - PRESENT_OPTIONS: Options for user selection
    - ERROR: Error occurred
    - DONE: Agent finished
    """
    
    async def generate() -> AsyncIterator[str]:
        """Generate SSE events from agent execution."""
        try:
            print(f"🧠 [Chat] Extended thinking: {request.extended_thinking}", flush=True)
            
            # Stream extended thinking if enabled
            if request.extended_thinking:
                try:
                    import anthropic
                    import os
                    
                    # Only stream thinking if we have Anthropic key
                    if os.getenv("ANTHROPIC_API_KEY"):
                        # Use async client for proper streaming in async context
                        client = anthropic.AsyncAnthropic()
                        
                        # Simple thinking prompt based on user message
                        thinking_prompt = f"Analyze this request and plan your response: {request.message}"
                        
                        print("🧠 [Chat] Starting extended thinking stream...", flush=True)
                        accumulated_thinking = ""
                        token_count = 0
                        
                        # Use async beta messages API with extended thinking
                        async with client.beta.messages.stream(
                            model="claude-sonnet-4-20250514",
                            max_tokens=4000,
                            thinking={
                                "type": "enabled",
                                "budget_tokens": 2000
                            },
                            messages=[{"role": "user", "content": thinking_prompt}],
                            betas=["interleaved-thinking-2025-05-14"]
                        ) as stream:
                            async for event in stream:
                                if hasattr(event, 'type') and event.type == 'content_block_delta':
                                    delta = getattr(event, 'delta', None)
                                    if delta and hasattr(delta, 'type') and delta.type == 'thinking_delta':
                                        token = getattr(delta, 'thinking', '')
                                        accumulated_thinking += token
                                        token_count += 1
                                        # Stream every token
                                        yield format_sse(SSEEventType.REASONING_TOKEN, {
                                            'token': accumulated_thinking,
                                            'is_complete': False
                                        })
                        
                        if accumulated_thinking:
                            yield format_sse(SSEEventType.REASONING_TOKEN, {
                                'token': accumulated_thinking,
                                'is_complete': True
                            })
                            print(f"✅ [Chat] Extended thinking complete ({len(accumulated_thinking)} chars, {token_count} tokens)", flush=True)
                
                except Exception as e:
                    print(f"⚠️ [Chat] Extended thinking error (non-fatal): {e}", flush=True)
                    import traceback
                    traceback.print_exc()
            
            # Create deep agent using official deepagents library
            # Note: deepagents includes context management middleware automatically
            agent = create_publo_deep_agent(
                story_id=request.story_id,
                document_format=request.document_format,
                active_section_id=request.active_section_id,
                user_preferences=request.user_preferences,
            )
            
            # Build messages list
            messages = []
            
            # ============================================================
            # Connection-based canvas context (preferred)
            # ============================================================
            connected_nodes: List[Dict[str, Any]] = []
            if request.canvas_nodes and request.canvas_edges and request.orchestrator_node_id:
                try:
                    node_by_id = {n.get("id"): n for n in request.canvas_nodes if isinstance(n, dict)}
                    connected_ids = set()
                    for e in request.canvas_edges:
                        if not isinstance(e, dict):
                            continue
                        src = e.get("source")
                        tgt = e.get("target")
                        if src == request.orchestrator_node_id and tgt:
                            connected_ids.add(tgt)
                        elif tgt == request.orchestrator_node_id and src:
                            connected_ids.add(src)
                    connected_nodes = [node_by_id[nid] for nid in connected_ids if nid in node_by_id]
                    print(
                        "🧩 [Chat] Canvas connection context:",
                        {
                            "orchestrator_node_id": request.orchestrator_node_id,
                            "canvas_nodes": len(request.canvas_nodes or []),
                            "canvas_edges": len(request.canvas_edges or []),
                            "connected_nodes": len(connected_nodes),
                        },
                        flush=True,
                    )
                    if len(connected_nodes) == 0:
                        sample_edges = []
                        for e in (request.canvas_edges or [])[:5]:
                            if isinstance(e, dict):
                                sample_edges.append({"source": e.get("source"), "target": e.get("target")})
                        print("🧩 [Chat] No connected nodes. Sample edges:", sample_edges, flush=True)
                except Exception as e:
                    print(f"⚠️ [Chat] Failed to compute connected nodes: {e}", flush=True)

            # ============================================================
            # Connected Sources Summary (FIRST system message)
            # ============================================================
            # Tells the AI upfront what's connected so thinking reflects it
            if connected_nodes:
                try:
                    char_names = []
                    story_names = []
                    for node in connected_nodes:
                        if not isinstance(node, dict):
                            continue
                        node_data = node.get("data") or {}
                        node_type = node_data.get("nodeType") or node_data.get("node_type") or ""
                        react_type = node.get("type", "")
                        
                        if react_type == "characterNode" or node_type == "character":
                            name = node_data.get("characterName") or node_data.get("character_name") or node_data.get("label") or "Unnamed"
                            char_names.append(name)
                        elif react_type == "storyStructureNode" or node_type == "story-structure":
                            name = node_data.get("label") or "Untitled Story"
                            story_names.append(name)
                    
                    if char_names or story_names:
                        summary = "## Connected Canvas Sources\n\n"
                        summary += "The user has connected these nodes to this conversation:\n"
                        if char_names:
                            summary += f"- **{len(char_names)} Character(s):** {', '.join(char_names[:8])}\n"
                        if story_names:
                            summary += f"- **{len(story_names)} Story Structure(s):** {', '.join(story_names[:4])}\n"
                        summary += "\nWhen the user asks about 'the characters' or 'the story', they mean these connected sources.\n"
                        messages.append({"role": "system", "content": summary})
                        print(f"🔗 [Chat] Sources summary: {len(char_names)} chars, {len(story_names)} stories", flush=True)
                except Exception as e:
                    print(f"⚠️ [Chat] Sources summary failed: {e}", flush=True)

            # Inject canvas context so agent knows what structures exist
            if request.canvas_nodes:
                # Extract story structure nodes for context
                story_nodes = []
                for node in request.canvas_nodes:
                    node_data = node.get("data", {})
                    node_type = node_data.get("nodeType") or node_data.get("node_type")
                    if node.get("type") == "storyStructureNode" or node_type == "story-structure":
                        story_nodes.append({
                            "id": node.get("id"),
                            "name": node_data.get("label", "Untitled"),
                            "format": node_data.get("format", "novel"),
                            "sections_count": len(node_data.get("items", []))
                        })
                
                if story_nodes:
                    context_msg = "## Current Canvas State\n\nYou have the following story structures on your canvas:\n"
                    for sn in story_nodes:
                        context_msg += f"- **{sn['name']}** ({sn['format']}, {sn['sections_count']} sections) - Node ID: {sn['id']}\n"
                    context_msg += "\nYou can work with any of these existing stories or create a new one."
                    messages.append({"role": "system", "content": context_msg})

            # Inject connected character personas (when wired to orchestrator)
            if connected_nodes:
                try:
                    character_nodes: List[Dict[str, Any]] = []
                    for node in connected_nodes:
                        if not isinstance(node, dict):
                            continue
                        node_data = node.get("data", {}) or {}
                        node_type = node_data.get("nodeType") or node_data.get("node_type")
                        if node.get("type") == "characterNode" or node_type == "character":
                            character_nodes.append(node)

                    if character_nodes:
                        try:
                            print(
                                "🧑‍🎭 [Chat] Connected character nodes (raw):",
                                [
                                    {
                                        "id": (n.get("id") if isinstance(n, dict) else None),
                                        "label": ((n.get("data", {}) or {}).get("label") if isinstance(n, dict) else None),
                                        "character_id": ((n.get("data", {}) or {}).get("characterId") if isinstance(n, dict) else None)
                                                      or ((n.get("data", {}) or {}).get("character_id") if isinstance(n, dict) else None),
                                        "node_type": ((n.get("data", {}) or {}).get("nodeType") if isinstance(n, dict) else None)
                                                     or ((n.get("data", {}) or {}).get("node_type") if isinstance(n, dict) else None),
                                    }
                                    for n in character_nodes[:8]
                                    if isinstance(n, dict)
                                ],
                                flush=True,
                            )
                        except Exception:
                            pass

                        # Fetch missing character details from Supabase if needed
                        # (some canvas nodes only store characterId)
                        supabase_rows_by_id: Dict[str, Dict[str, Any]] = {}
                        try:
                            from config import get_supabase_client
                            supabase = get_supabase_client()

                            ids_to_fetch = []
                            for n in character_nodes:
                                d = (n.get("data", {}) or {})
                                cid = d.get("characterId") or d.get("character_id")
                                if cid and (not d.get("bio")):
                                    ids_to_fetch.append(cid)

                            ids_to_fetch = list({cid for cid in ids_to_fetch if isinstance(cid, str) and cid})
                            if ids_to_fetch:
                                res = supabase.table("characters") \
                                    .select("id,user_id,name,bio,role,visibility,photo_url,updated_at") \
                                    .in_("id", ids_to_fetch) \
                                    .execute()

                                for row in (res.data or []):
                                    if isinstance(row, dict) and row.get("id"):
                                        supabase_rows_by_id[row["id"]] = row
                        except Exception as e:
                            # Non-fatal: we'll fall back to node data
                            print(f"⚠️ [Chat] Character enrichment skipped: {e}", flush=True)

                        # Build personas list for system prompt
                        personas: List[Dict[str, Any]] = []
                        for n in character_nodes[:12]:  # Hard cap
                            d = (n.get("data", {}) or {})
                            cid = d.get("characterId") or d.get("character_id") or ""
                            row = supabase_rows_by_id.get(cid) if cid else None

                            name = d.get("characterName") or d.get("character_name") or d.get("label")
                            if not name and row:
                                name = row.get("name")
                            name = name or "Unnamed Character"

                            role = d.get("role") or (row.get("role") if row else None)
                            bio = d.get("bio") or (row.get("bio") if row else None) or ""

                            # Enforce basic visibility when user_id is provided
                            if row and request.user_id:
                                visibility = row.get("visibility")
                                owner_id = row.get("user_id")
                                if visibility == "private" and owner_id != request.user_id:
                                    continue

                            attributes = d.get("attributes") if isinstance(d.get("attributes"), dict) else None
                            profiler_chat = d.get("profilerChat") or d.get("profiler_chat")
                            if not isinstance(profiler_chat, list):
                                profiler_chat = None

                            personas.append({
                                "name": name,
                                "role": role,
                                "bio": bio,
                                "attributes": attributes,
                                "profilerChat": profiler_chat,
                            })

                        if personas:
                            personas_msg = "## Connected Character Personas (HIGH PRIORITY)\n\n"
                            personas_msg += "These character profiles come from canvas Character nodes connected to the Orchestrator.\n"
                            personas_msg += "Treat them as canonical guidance for voice, behavior, relationships, and presence in generated story content.\n\n"
                            personas_msg += "### Role semantics (interpretation rules)\n"
                            personas_msg += "- **Main**: Core protagonist/antagonist. Should appear frequently and materially drive plot/choices.\n"
                            personas_msg += "- **Active**: Key supporting cast with agency. Should influence scenes/decisions and have distinct voice.\n"
                            personas_msg += "- **Included**: Supporting presence. MUST appear or be referenced in the story; adds texture.\n"
                            personas_msg += "- **Involved**: Contextual/cultural/semiotic influence. Use for worldview, norms, slang, social dynamics, stakes.\n"
                            personas_msg += "- **Passive**: Background influence. Use for ambience, constraints, setting realism.\n\n"
                            personas_msg += "**⚠️ CRITICAL: When calling create_structure, you MUST include ALL connected characters below in your prompt - not just the ones user explicitly named. Canvas connections = intent to use.**\n\n"
                            personas_msg += "### Identity & voice rules\n"
                            personas_msg += "- Use the **exact character name** as canonical. Do not rename.\n"
                            personas_msg += "- If bio/profile implies a way of speaking (slang, formality, cadence), reflect it consistently.\n"
                            personas_msg += "- If the user asks to change who a character is, suggest updating the Character node rather than silently changing the persona.\n\n"

                            for p in personas:
                                personas_msg += f"- **{p['name']}**"
                                if p.get("role"):
                                    personas_msg += f" (Role: {p['role']})"
                                personas_msg += "\n"
                                if p.get("bio"):
                                    trimmed = str(p["bio"]).strip()
                                    if len(trimmed) > 900:
                                        trimmed = trimmed[:900].rstrip() + "…"
                                    personas_msg += f"  - Bio: {trimmed}\n"
                                else:
                                    personas_msg += f"  - Bio: (none provided) — treat name as identity anchor.\n"
                                if p.get("attributes"):
                                    # Keep attributes compact
                                    try:
                                        attrs_json = json.dumps(p["attributes"], ensure_ascii=False)
                                        if len(attrs_json) > 600:
                                            attrs_json = attrs_json[:600].rstrip() + "…"
                                        personas_msg += f"  - Attributes: {attrs_json}\n"
                                    except Exception:
                                        pass
                                if p.get("profilerChat"):
                                    # Include a tiny sample of Q/A pairs (if present)
                                    try:
                                        qa_pairs = []
                                        for qa in (p.get("profilerChat") or [])[:3]:
                                            if not isinstance(qa, dict):
                                                continue
                                            q = str(qa.get("question", "")).strip()
                                            a = str(qa.get("answer", "")).strip()
                                            if q and a:
                                                qa_pairs.append({"q": q[:120], "a": a[:220]})
                                        if qa_pairs:
                                            personas_msg += f"  - Profile Q/A (signals for voice/reactions): {json.dumps(qa_pairs, ensure_ascii=False)}\n"
                                    except Exception:
                                        pass

                            messages.append({"role": "system", "content": personas_msg})
                except Exception as e:
                    print(f"⚠️ [Chat] Failed to inject character personas: {e}", flush=True)
            
            # Add current structure items if available
            if request.structure_items and len(request.structure_items) > 0:
                sections_msg = "## Current Document Sections\n\n"
                sections_msg += "⚠️ **CRITICAL:** When calling `write_section`, you MUST provide BOTH:\n"
                sections_msg += "1. The EXACT `section_id` from the table below\n"
                sections_msg += "2. The matching `section_name`\n\n"
                sections_msg += "| # | Section Name | section_id | section_name |\n|---|--------------|------------|---------------|\n"
                # Include more than 20 so "write act one" can reference later scenes.
                # Still cap to avoid blowing up the prompt.
                for idx, item in enumerate(request.structure_items[:60], 1):  # Limit to first 60
                    # FIX: Read from 'title' OR 'name' (frontend uses 'title')
                    name = item.get('title') or item.get('name') or 'Section'
                    sid = item.get('id', '')
                    sections_msg += f"| {idx} | {name} | `{sid}` | `{name}` |\n"
                if len(request.structure_items) > 60:
                    sections_msg += f"\n(Showing first 60 of {len(request.structure_items)} sections.)\n"
                sections_msg += "\n**Example:** To write 'Introduction', call:\n"
                sections_msg += "`write_section(section_id='sec-2', section_name='Introduction', guidance='...')`\n"
                messages.append({"role": "system", "content": sections_msg})
            
            # Add active section card context if user is viewing a specific card
            if request.active_section_card:
                card = request.active_section_card
                card_msg = "## 🃏 Active Section Card (User is viewing this)\n\n"
                card_msg += f"**Section:** {card.get('sectionName', card.get('section_name', 'Unknown'))}\n"
                
                if card.get('summary'):
                    card_msg += f"**Summary:** {card.get('summary')}\n"
                else:
                    card_msg += "**Summary:** Not yet written\n"
                
                if card.get('characters') and len(card.get('characters', [])) > 0:
                    char_names = [c.get('name', 'Unknown') for c in card.get('characters', [])]
                    card_msg += f"**Characters:** {', '.join(char_names)}\n"
                
                if card.get('keyMoments') or card.get('key_moments'):
                    moments = card.get('keyMoments') or card.get('key_moments', [])
                    if moments:
                        card_msg += f"**Key Moments:** {'; '.join(moments[:3])}\n"
                
                if card.get('mood'):
                    card_msg += f"**Mood:** {card.get('mood')}\n"
                
                if card.get('dependencies') and len(card.get('dependencies', [])) > 0:
                    deps = card.get('dependencies', [])
                    dep_strs = [d.get('description', str(d)) for d in deps[:3]]
                    card_msg += f"**Dependencies:** {'; '.join(dep_strs)}\n"
                
                if card.get('issues') and len(card.get('issues', [])) > 0:
                    issues = card.get('issues', [])
                    card_msg += f"**⚠️ Coherency Issues:** {len(issues)} issue(s) detected\n"
                    for issue in issues[:2]:
                        card_msg += f"  - {issue.get('type', 'Issue')}: {issue.get('description', '')}\n"
                
                card_msg += "\n**When the user talks about 'this section' or 'this card', they mean the section above.**\n"
                messages.append({"role": "system", "content": card_msg})
            
            if request.conversation_history:
                # Token-aware trimming using LangChain (Claude max ~200k tokens)
                # Leave ~50k for history (system prompts can be large!)
                trimmed_history = trim_conversation_history(
                    request.conversation_history,
                    max_tokens=50000,
                )
                messages.extend(trimmed_history)
            messages.append({"role": "user", "content": request.message})
            
            # ============================================================
            # FINAL SAFETY: Ensure total message size stays under limit
            # ============================================================
            # Claude max is 200k tokens. We estimate ~4 chars/token.
            # Target 150k tokens = ~600k chars to leave room for response.
            MAX_TOTAL_CHARS = 500000  # ~125k tokens, safe margin
            total_chars = sum(len(m.get("content", "")) for m in messages)
            
            if total_chars > MAX_TOTAL_CHARS:
                print(f"⚠️ [Chat] Messages too large: {total_chars} chars. Trimming...", flush=True)
                
                # Strategy: Keep system messages, aggressively trim conversation
                system_msgs = [m for m in messages if m.get("role") == "system"]
                conv_msgs = [m for m in messages if m.get("role") != "system"]
                
                system_chars = sum(len(m.get("content", "")) for m in system_msgs)
                remaining_budget = MAX_TOTAL_CHARS - system_chars
                
                # Trim conversation from the beginning (keep recent)
                trimmed_conv = []
                conv_chars = 0
                for msg in reversed(conv_msgs):
                    msg_len = len(msg.get("content", ""))
                    if conv_chars + msg_len <= remaining_budget:
                        trimmed_conv.insert(0, msg)
                        conv_chars += msg_len
                    else:
                        break
                
                messages = system_msgs + trimmed_conv
                new_total = sum(len(m.get("content", "")) for m in messages)
                print(f"✂️ [Chat] Trimmed to {new_total} chars ({len(messages)} messages)", flush=True)
            
            # Config for the agent
            #
            # IMPORTANT:
            # - `story_id` is the canvas/project id (used for thread_id and persistence context)
            # - `story_structure_node_id` is the *actual* structure node id used for Librarian + writing tools
            #
            # Never fall back to `story_id` for tool node_id.
            # If no structure is selected yet, keep node_id empty so `create_structure`
            # can generate a new node id.
            initial_node_id = request.story_structure_node_id or ""
            
            # Mutable container so we can update node_id mid-stream
            # (when create_structure generates a new node_id)
            node_id_ref = {"value": initial_node_id}
            
            # Log what's being sent (simple print)
            if request.structure_items and len(request.structure_items) > 0:
                print(f"📋 [Chat] Structure items: {len(request.structure_items)} items, sample IDs: {[item.get('id') for item in request.structure_items[:3]]}")
                print(f"📋 [Chat] story_structure_node_id: {request.story_structure_node_id}, node_id_used: {initial_node_id}")
            
            config = {
                "configurable": {
                    "thread_id": request.thread_id or request.session_id or request.story_id,
                    "node_id": initial_node_id,  # For backwards compatibility
                    "node_id_ref": node_id_ref,  # Mutable container for dynamic updates
                    "story_id": request.story_id,  # Canvas ID
                    "user_id": request.user_id,
                    "document_format": request.document_format,
                }
            }
            
            # Stream events using deepagents
            async for event in run_deep_agent_streaming(agent, messages, config):
                event_type = event["type"]
                data = event["data"]
                
                if event_type == "token":
                    yield format_sse(SSEEventType.TOKEN, data)
                
                elif event_type == "tool_start":
                    yield format_sse(SSEEventType.TOOL_START, data)
                    
                    # Special handling for specific tools
                    tool_name = data.get("tool", "")
                    tool_input = data.get("input", {})
                    
                    if tool_name == "navigate_to":
                        yield format_sse(SSEEventType.NAVIGATE, {
                            "section_id": tool_input.get("section_id", ""),
                            "section_name": tool_input.get("section_name", "")
                        })
                    
                    elif tool_name == "present_options":
                        yield format_sse(SSEEventType.PRESENT_OPTIONS, {
                            "prompt": tool_input.get("prompt", ""),
                            "options": tool_input.get("options", []),
                            "allow_multiple": tool_input.get("allow_multiple", False)
                        })
                    
                    elif tool_name == "write_section":
                        # Tell frontend to open document and scroll to section
                        section_id = tool_input.get("section_id", "")
                        llm_section_name = tool_input.get("section_name", "")
                        
                        # Find actual section name from structure_items and validate
                        # FIX: Read from 'title' OR 'name' (frontend uses 'title')
                        actual_section_name = "Section"
                        if request.structure_items:
                            for item in request.structure_items:
                                if item.get("id") == section_id:
                                    actual_section_name = item.get("title") or item.get("name") or "Section"
                                    break
                        
                        # Log for debugging ID/name mismatches
                        if llm_section_name and llm_section_name != actual_section_name:
                            print(f"⚠️ [write_section] MISMATCH: LLM said '{llm_section_name}' but ID '{section_id}' maps to '{actual_section_name}'")
                        
                        # Use actual name from structure (authoritative)
                        section_name = actual_section_name
                        
                        # 1. Open the document panel
                        yield format_sse(SSEEventType.OPEN_DOCUMENT, {
                            "node_id": node_id_ref["value"],
                            "node_name": section_name
                        })
                        
                        # 2. Select/scroll to the section
                        yield format_sse(SSEEventType.SELECT_SECTION, {
                            "section_id": section_id,
                            "section_name": section_name
                        })
                        
                        # 3. Show writing progress
                        yield format_sse(SSEEventType.SECTION_WRITING, {
                            "section_id": section_id,
                            "title": section_name
                        })
                    
                    elif tool_name == "task":
                        # Subagent spawning - emit start event
                        yield format_sse(SSEEventType.SUBAGENT_START, {
                            "name": tool_input.get("subagent", "unknown"),
                            "task": tool_input.get("instruction", "")[:100]
                        })
                
                elif event_type == "content_chunk":
                    # Streaming content chunk from write_section
                    yield format_sse(SSEEventType.CONTENT_CHUNK, {
                        "section_id": data.get("section_id", ""),
                        "chunk": data.get("chunk", "")
                    })
                
                elif event_type == "tool_end":
                    yield format_sse(SSEEventType.TOOL_END, data)
                    
                    # Special handling for write_section completion
                    tool_name = data.get("tool", "")
                    print(f"🔧 [Chat] Tool end: {tool_name}", flush=True)
                    output = data.get("output", {})
                    print(f"🔍 [Chat] Tool output type: {type(output).__name__}, keys: {list(output.keys()) if isinstance(output, dict) else 'N/A'}", flush=True)
                    
                    # Handle string outputs (convert to dict if possible)
                    if isinstance(output, str):
                        try:
                            output = json.loads(output)
                        except (json.JSONDecodeError, TypeError):
                            output = {}  # Fallback to empty dict
                    
                    if tool_name == "write_section" and isinstance(output, dict):
                        yield format_sse(SSEEventType.CONTENT_COMPLETE, {
                            "section_id": output.get("section_id", ""),
                            "word_count": output.get("word_count", 0)
                        })
                    
                    elif tool_name == "create_structure" and isinstance(output, dict):
                        # Use node_id from structure output (generated by create_structure tool)
                        # This ensures Librarian cards and frontend use the same node_id
                        new_structure_node_id = output.get("node_id", "")
                        
                        # Fallback: generate if not provided (shouldn't happen with updated tool)
                        if not new_structure_node_id:
                            import time
                            import random
                            import string
                            new_structure_node_id = f"story-structure-{int(time.time() * 1000)}-{''.join(random.choices(string.ascii_lowercase + string.digits, k=5))}"
                            print(f"⚠️ [Chat] No node_id from structure, generated: {new_structure_node_id}")
                        
                        # Update the mutable ref so subsequent tool calls use this node_id
                        node_id_ref["value"] = new_structure_node_id
                        print(f"📌 [Chat] Updated node_id_ref to: {new_structure_node_id}")
                        
                        yield format_sse(SSEEventType.STRUCTURE_CREATED, {
                            "title": output.get("title", "Untitled"),
                            "section_count": output.get("section_count", 0),
                            "sections": [
                                {"id": s.get("id"), "title": s.get("name", s.get("title"))}
                                for s in output.get("items", [])
                            ] if isinstance(output.get("items"), list) else [],
                            "format": output.get("format", "novel"),
                            "node_id": new_structure_node_id  # Tell frontend to use this ID
                        })
                    
                    elif tool_name == "update_structure" and isinstance(output, dict):
                        # Structure was updated (not created new)
                        # Emit STRUCTURE_UPDATED event to refresh frontend
                        print(f"📝 [Chat] Structure updated: {output.get('title')}")
                        print(f"📝 [Chat] Changes: {output.get('changes_made', {})}")
                        
                        yield format_sse(SSEEventType.STRUCTURE_UPDATED, {
                            "title": output.get("title", "Untitled"),
                            "section_count": output.get("section_count", 0),
                            "sections": [
                                {"id": s.get("id"), "title": s.get("name", s.get("title"))}
                                for s in output.get("items", [])
                            ] if isinstance(output.get("items"), list) else [],
                            "format": output.get("format", "novel"),
                            "node_id": output.get("node_id", ""),
                            "changes_made": output.get("changes_made", {}),
                            "sections_needing_revision": output.get("sections_needing_revision", []),
                            "storyline_impact": output.get("storyline_impact", "")
                        })
                    
                    elif tool_name == "write_todos" and isinstance(output, dict):
                        # Emit plan update for frontend todo tracking
                        yield format_sse(SSEEventType.PLAN_UPDATE, {
                            "todos": output.get("todos", []),
                            "stats": output.get("stats", {})
                        })
                    
                    elif tool_name == "task" and isinstance(output, dict):
                        # Subagent completed - emit end event
                        yield format_sse(SSEEventType.SUBAGENT_END, {
                            "name": output.get("subagent", "unknown"),
                            "result": output.get("result", {})
                        })
                    
                    elif tool_name in ("save_preference", "save_pattern") and isinstance(output, dict):
                        # Memory updated - emit update event
                        if output.get("success"):
                            yield format_sse(SSEEventType.MEMORY_UPDATE, {
                                "type": "preference" if tool_name == "save_preference" else "pattern",
                                "key": output.get("key") or output.get("pattern_type"),
                                "value": output.get("value") or output.get("description")
                            })
                    
                    elif tool_name in ("create_character", "load_character"):
                        # Character created or loaded - emit event for canvas node creation
                        print(f"🔍 [Chat] Character tool - output is dict: {isinstance(output, dict)}", flush=True)
                        if isinstance(output, dict):
                            print(f"🔍 [Chat] Character tool output: success={output.get('success')}, has_character={bool(output.get('character'))}", flush=True)
                        else:
                            print(f"⚠️ [Chat] Character tool output is NOT dict: {type(output).__name__} = {str(output)[:100]}", flush=True)
                        if isinstance(output, dict) and output.get("success"):
                            char_data = output.get("character", {})
                            print(f"🔍 [Chat] Character data: name={char_data.get('name')}, role={char_data.get('role')}", flush=True)
                            sse_payload = {
                                "character_id": output.get("character_id", ""),
                                "node_id": output.get("node_id", ""),
                                "name": char_data.get("name", ""),
                                "bio": char_data.get("bio", ""),
                                "role": char_data.get("role", "Active"),
                                "photo_url": char_data.get("photo_url"),
                                "visibility": char_data.get("visibility", "private"),
                                "attributes": char_data.get("attributes", {}),
                                "profilerChat": char_data.get("profilerChat", []),
                                "is_existing": output.get("is_existing", False),
                            }
                            sse_event = format_sse(SSEEventType.CHARACTER_CREATED, sse_payload)
                            print(f"🎭 [Chat] CHARACTER_CREATED SSE event (first 200 chars): {sse_event[:200]}", flush=True)
                            yield sse_event
                            print(f"✅ [Chat] Yielded CHARACTER_CREATED for: {char_data.get('name')}", flush=True)
                    
                    elif tool_name in ("write_context_file", "delete_context_file") and isinstance(output, dict):
                        # Context file updated - emit event
                        if output.get("success"):
                            yield format_sse(SSEEventType.CONTEXT_FILE_UPDATED, {
                                "action": "write" if tool_name == "write_context_file" else "delete",
                                "path": output.get("path", "")
                            })
                
                elif event_type == "done":
                    yield format_sse(SSEEventType.DONE, data)
        
        except Exception as e:
            print(f"❌ [Chat] Error: {e}")
            import traceback
            traceback.print_exc()
            yield format_sse(SSEEventType.ERROR, {"error": str(e)})
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# ============================================================
# NON-STREAMING CHAT ENDPOINT
# ============================================================

@router.post("/chat/sync", response_model=ChatResponse)
@traceable(name="deep_agent_chat_sync", metadata={"endpoint": "chat_sync"})
async def chat_sync(request: ChatRequest):
    """
    Non-streaming chat endpoint.
    
    Use this for simple requests where streaming isn't needed.
    """
    try:
        from langchain_core.messages import HumanMessage, AIMessage
        
        # Create deep agent (handles context management automatically)
        agent = create_publo_deep_agent(
            story_id=request.story_id,
            document_format=request.document_format,
            active_section_id=request.active_section_id,
            user_preferences=request.user_preferences,
        )
        
        # Build messages (deepagents handles context trimming automatically)
        lc_messages = []
        if request.conversation_history:
            for msg in request.conversation_history:
                if msg["role"] == "user":
                    lc_messages.append(HumanMessage(content=msg["content"]))
                else:
                    lc_messages.append(AIMessage(content=msg["content"]))
        lc_messages.append(HumanMessage(content=request.message))
        
        # Config
        config = {
            "configurable": {
                "thread_id": request.thread_id or request.session_id or request.story_id,
                "node_id": request.story_id,
            }
        }
        
        # Invoke
        result = await agent.ainvoke({"messages": lc_messages}, config=config)
        
        # Extract response
        messages = result.get("messages", [])
        final_message = messages[-1] if messages else None
        response_text = final_message.content if final_message and hasattr(final_message, 'content') else ""
        
        return ChatResponse(
            success=True,
            response=response_text,
            tool_calls=[],
        )
    
    except Exception as e:
        print(f"❌ [Chat Sync] Error: {e}")
        return ChatResponse(
            success=False,
            response="",
            error=str(e)
        )


# ============================================================
# LEGACY COMPATIBILITY ENDPOINT
# ============================================================

@router.post("/orchestrate/stream")
async def orchestrate_stream_legacy(request: ChatRequest):
    """
    Legacy endpoint for backwards compatibility.
    
    Maps to the new /chat endpoint.
    """
    return await chat(request)
