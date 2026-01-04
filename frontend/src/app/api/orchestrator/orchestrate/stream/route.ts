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
      storyId: snakeCaseBody.story_id,
      orchestratorNodeId: snakeCaseBody.orchestrator_node_id || '❌ MISSING',
      canvasEdges: snakeCaseBody.canvas_edges?.length ?? '❌ MISSING',
      canvasNodes: snakeCaseBody.canvas_nodes?.length ?? '❌ MISSING',
    })
    
    // Call Python streaming endpoint
    // Note: Don't set Accept-Encoding to prevent compression buffering
    const response = await fetch(`${BACKEND_URL}/api/orchestrator/orchestrate/stream`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(snakeCaseBody),
      // @ts-ignore - duplex is needed for streaming in Node.js
      duplex: 'half',
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
    
    // Stream the response through using TransformStream for immediate passthrough
    const { readable, writable } = new TransformStream()
    
    // Pipe in the background
    response.body?.pipeTo(writable).catch((error) => {
      console.error('❌ [StreamProxy] Pipe error:', error)
    })
    
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Transfer-Encoding': 'chunked',
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