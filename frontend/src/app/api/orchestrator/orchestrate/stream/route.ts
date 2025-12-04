// src/app/api/orchestrator/orchestrate/stream/route.ts

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000'

// ============================================================
// CASE TRANSFORMATION UTILITIES
// ============================================================

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
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

function keysToCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(keysToCamelCase)
  if (typeof obj !== 'object') return obj
  
  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = toCamelCase(key)
    acc[camelKey] = keysToCamelCase(obj[key])
    return acc
  }, {} as Record<string, any>)
}

// ============================================================
// POST /api/orchestrator/orchestrate/stream
// ============================================================

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Transform frontend camelCase → backend snake_case
    const snakeCaseBody = keysToSnakeCase(body)
    
    console.log('🔄 [Proxy] Stream request:', {
      message: snakeCaseBody.message?.slice(0, 50),
      userId: snakeCaseBody.user_id
    })
    
    const response = await fetch(`${BACKEND_URL}/api/orchestrator/orchestrate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snakeCaseBody),
    })
    
    if (!response.ok || !response.body) {
      return new Response(
        JSON.stringify({ success: false, error: `Backend error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Create a TransformStream to process and forward SSE events
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk)
        
        // Process each SSE line
        const lines = text.split('\n')
        const transformedLines: string[] = []
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6) // Remove 'data: '
              const data = JSON.parse(jsonStr)
              
              // Transform the data payload to camelCase
              const transformedData = keysToCamelCase(data)
              
              transformedLines.push(`data: ${JSON.stringify(transformedData)}`)
            } catch {
              // Not JSON, pass through as-is
              transformedLines.push(line)
            }
          } else {
            transformedLines.push(line)
          }
        }
        
        controller.enqueue(new TextEncoder().encode(transformedLines.join('\n')))
      }
    })
    
    // Pipe the backend response through our transformer
    const transformedStream = response.body.pipeThrough(transformStream)
    
    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
    
  } catch (error) {
    console.error('❌ [Proxy] Stream error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Stream failed' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}