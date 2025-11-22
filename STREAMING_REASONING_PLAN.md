# Streaming Model Reasoning - Implementation Plan

## 🎯 Goal

Enable real-time streaming of the model's internal reasoning process, showing users what the AI is thinking as it generates the plan.

---

## 📊 Current State

**What you see now:**
```
💡 THINKING  10:32:59 AM
   🚀 Initializing orchestrator engine...

🎯 DECISION  10:32:59 AM
   ✓ Using configured orchestrator: llama-3.3-70b-versatile

💡 THINKING  10:32:59 AM
   📝 Analyzing prompt: "A Dolphin in Rome..."
```

**What's missing:** The model's actual thinking tokens as it generates.

---

## 🚀 Target State

**What you'll see:**
```
💡 ORCHESTRATOR  10:32:59 AM
   🚀 Initializing orchestrator engine...

🎯 ORCHESTRATOR  10:32:59 AM
   ✓ Using: llama-3.3-70b-versatile

💭 MODEL REASONING (streaming...)
   Let me analyze this prompt about a dolphin in Rome.
   This is an unusual premise that combines marine life with 
   historical setting. I need to consider:
   
   1. How did the dolphin get to Rome?
   2. What time period - ancient Rome or modern?
   3. Is this fantasy, sci-fi, or alternate history?
   
   Given the context, I'll structure this as a three-act
   story with the following sections:
   
   Act I: Discovery
   - Chapter 1: The Tiber's Secret
   - Chapter 2: Ancient Whispers...

✅ RESULT  10:33:12 AM
   Plan created: 15 sections, 3 tasks
```

---

## 🏗️ Architecture

### 1. **Server-Side Streaming (SSE)**

**Current:** Batch responses (wait for full completion)
```typescript
const response = await fetch('/api/generate', {
  method: 'POST',
  body: JSON.stringify({ prompt, model })
})
const data = await response.json() // Wait for everything
```

**Target:** Server-Sent Events streaming
```typescript
const response = await fetch('/api/generate', {
  method: 'POST',
  body: JSON.stringify({ prompt, model, stream: true })
})

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  const chunk = decoder.decode(value)
  // Parse and display chunk in real-time
}
```

---

### 2. **Reasoning Token Parsing**

Different models use different formats:

**OpenAI o1/o3:**
```json
{
  "choices": [{
    "message": {
      "reasoning_content": "Step-by-step thinking...",
      "content": "Final answer"
    }
  }]
}
```

**Anthropic Claude (thinking tags):**
```xml
<thinking>
Let me analyze this...
First, I need to consider...
</thinking>

<answer>
Here's the final plan...
</answer>
```

**Groq Llama/Qwen (CoT tokens):**
```
<think>
Analyzing the prompt...
Breaking down the structure...
</think>

Final JSON response...
```

---

### 3. **Frontend Real-Time Updates**

**Components to update:**

1. **CreateStoryPanel.tsx:**
   - Add streaming message state
   - Append chunks to current message
   - Auto-scroll to bottom
   - Show "typing indicator" during stream

2. **canvas/page.tsx:**
   - Handle SSE response
   - Parse reasoning tokens
   - Update orchestrator node data

3. **orchestratorEngine.ts:**
   - Accept streaming callback
   - Pass to API calls
   - Emit reasoning tokens

---

## 📋 Implementation Tasks

### Phase 1: Basic Streaming (Week 1)

- [ ] Update `/api/generate` to support streaming
  - [ ] Add `stream: boolean` parameter
  - [ ] Return SSE response headers
  - [ ] Stream tokens from LLM providers

- [ ] Update provider adapters (groq.ts, openai.ts)
  - [ ] Enable streaming in API calls
  - [ ] Parse streaming responses
  - [ ] Extract reasoning tokens

- [ ] Update OrchestratorEngine
  - [ ] Add streaming callback parameter
  - [ ] Emit reasoning chunks
  - [ ] Handle stream completion

- [ ] Update canvas/page.tsx
  - [ ] Handle SSE response
  - [ ] Parse incoming chunks
  - [ ] Update reasoning panel in real-time

- [ ] Update CreateStoryPanel
  - [ ] Add streaming message state
  - [ ] Show "typing indicator"
  - [ ] Auto-scroll during stream
  - [ ] Distinguish orchestrator vs model messages

### Phase 2: Enhanced UX (Week 2)

- [ ] Add progress indicators
  - [ ] Token counter
  - [ ] Time elapsed
  - [ ] Estimated completion

- [ ] Add stream controls
  - [ ] Pause/resume streaming
  - [ ] Cancel generation
  - [ ] Adjust speed

- [ ] Add message filtering
  - [ ] Toggle orchestrator messages
  - [ ] Toggle model reasoning
  - [ ] Search within reasoning

- [ ] Add export functionality
  - [ ] Download reasoning as JSON
  - [ ] Copy to clipboard
  - [ ] Share reasoning link

### Phase 3: Advanced Features (Week 3)

- [ ] Multi-model streaming
  - [ ] Show parallel writer streams
  - [ ] Highlight active writer
  - [ ] Merge streams chronologically

- [ ] Reasoning analysis
  - [ ] Highlight key decisions
  - [ ] Show decision tree
  - [ ] Track confidence levels

- [ ] Performance optimization
  - [ ] Debounce UI updates
  - [ ] Virtual scrolling for long streams
  - [ ] Memory management

---

## 🔧 Technical Details

### API Route Changes

**Before:**
```typescript
// /api/generate
export async function POST(request: Request) {
  const data = await callLLM(prompt, model)
  return NextResponse.json({ success: true, data })
}
```

**After:**
```typescript
// /api/generate
export async function POST(request: Request) {
  const { stream } = await request.json()
  
  if (stream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of streamFromLLM(prompt, model)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        }
        controller.close()
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  }
  
  // Fallback to batch
  const data = await callLLM(prompt, model)
  return NextResponse.json({ success: true, data })
}
```

---

### Provider Adapter Changes

**Groq Adapter (streaming):**
```typescript
export async function* streamCompletion(
  model: string,
  messages: Message[],
  apiKey: string
) {
  const response = await fetch('https://api.groq.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true // Enable streaming
    })
  })
  
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  
  let buffer = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue
        
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices[0]?.delta?.content
          if (delta) yield delta
        } catch (e) {
          console.error('Parse error:', e)
        }
      }
    }
  }
}
```

---

### Frontend Streaming Handler

**canvas/page.tsx:**
```typescript
const triggerStreamingGeneration = async (prompt: string, model: string) => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, stream: true })
  })
  
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  
  let currentMessage = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    const chunk = decoder.decode(value)
    const lines = chunk.split('\n')
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6))
        
        if (data.type === 'reasoning') {
          currentMessage += data.content
          
          // Update reasoning panel
          setNodes((nds) =>
            nds.map((n) =>
              n.id === orchestratorNodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      streamingReasoning: currentMessage
                    }
                  }
                : n
            )
          )
        }
        
        if (data.type === 'complete') {
          // Finalize
          currentMessage = ''
        }
      }
    }
  }
}
```

---

## 🎨 UI Enhancements

### Streaming Message Display

**Before:**
```
💡 THINKING
   Analyzing prompt: "..."
```

**After:**
```
💭 MODEL REASONING (streaming...)  ⚡ 1.2s  📝 142 tokens
   ┃ Let me analyze this prompt...
   ┃ 
   ┃ First, I need to consider the...▊
   
[Pause] [Cancel] [Copy]
```

### Visual Indicators

- **Typing cursor:** Animated `▊` at end of stream
- **Progress bar:** Shows generation progress
- **Token counter:** Real-time token count
- **Time elapsed:** Duration since start
- **Speed indicator:** Tokens per second

---

## 🧪 Testing Strategy

1. **Unit Tests:**
   - SSE parsing
   - Reasoning token extraction
   - Stream handling

2. **Integration Tests:**
   - Full streaming flow
   - Multiple concurrent streams
   - Stream cancellation

3. **Performance Tests:**
   - Memory usage during long streams
   - UI responsiveness
   - Token processing speed

4. **User Tests:**
   - Readability of reasoning
   - Scroll behavior
   - Controls usability

---

## 📊 Success Metrics

- ✅ Real-time token streaming (< 100ms latency)
- ✅ Smooth UI updates (60fps)
- ✅ Memory efficient (< 50MB for 10k tokens)
- ✅ Clear reasoning visibility
- ✅ Easy to pause/cancel
- ✅ Works with all providers (Groq, OpenAI, Anthropic)

---

## 🚀 Rollout Plan

1. **Feature flag:** `ENABLE_STREAMING=false` by default
2. **A/B testing:** 10% of users get streaming
3. **Monitor:** Performance, errors, user feedback
4. **Iterate:** Fix issues, improve UX
5. **Roll out:** 100% of users

---

## 📝 Notes

- Streaming adds complexity but massive UX improvement
- Must handle connection drops gracefully
- Need fallback to batch mode if streaming fails
- Consider cost implications (streaming = longer API calls)
- Test with different network conditions

---

**Status:** 🟡 Planning Complete, Ready to Implement

**Branch:** `feature/streaming-reasoning`

**Estimated Time:** 2-3 weeks

**Priority:** High (major UX improvement)

