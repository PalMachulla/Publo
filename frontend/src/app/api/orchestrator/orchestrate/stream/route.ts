// src/app/api/orchestrator/orchestrate/stream/route.ts
/**
 * Streaming Orchestrator Proxy
 * 
 * Proxies Server-Sent Events (SSE) from the Python backend to the frontend.
 * This enables real-time progress updates for structure generation.
 */

import { NextRequest } from 'next/server'

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000'

// ============================================================
// CASE TRANSFORMATION (same as non-streaming route)
// ============================================================

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

function keysToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(keysToSnakeCase)
  if (typeof obj !== 'object') return obj
  
  return Object.keys(obj).reduce((acc, key) => {
    const snakeKey = toSnakeCase(key)
    acc[snakeKey] = keysToSnakeCase(obj[key])
    return acc
  }, {} as Record<string, any>)
}

// ============================================================
// SSE STREAM PROXY
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Transform frontend camelCase → backend snake_case
    const snakeCaseBody = keysToSnakeCase(body)
    
    console.log('🔄 [StreamProxy] Request:', {
      message: snakeCaseBody.message?.slice(0, 50),
      userId: snakeCaseBody.user_id,
      storyId: snakeCaseBody.story_id
    })
    
    // Call Python streaming endpoint
    const response = await fetch(`${BACKEND_URL}/api/orchestrator/orchestrate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snakeCaseBody),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [StreamProxy] Backend error:', errorText)
      
      // Return error as SSE event
      const errorStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errorText })}\n\n`))
          controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ success: false })}\n\n`))
          controller.close()
        }
      })
      
      return new Response(errorStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    }
    
    // Stream the response through
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }
        
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
        } catch (error) {
          console.error('❌ [StreamProxy] Stream error:', error)
        } finally {
          controller.close()
        }
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      }
    })
    
  } catch (error) {
    console.error('❌ [StreamProxy] Error:', error)
    
    // Return error as SSE event
    const errorStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`))
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ success: false })}\n\n`))
        controller.close()
      }
    })
    
    return new Response(errorStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
  }
}