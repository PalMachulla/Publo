// src/app/api/orchestrator/orchestrate/route.ts

import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000'

// ============================================================
// CASE TRANSFORMATION UTILITIES
// ============================================================

/**
 * Convert camelCase to snake_case
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Recursively transform object keys to snake_case
 */
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

/**
 * Recursively transform object keys to camelCase
 */
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
// POST /api/orchestrator/orchestrate
// ============================================================

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Transform frontend camelCase → backend snake_case
    const snakeCaseBody = keysToSnakeCase(body)
    
    console.log('🔄 [Proxy] Orchestrate request:', {
      message: snakeCaseBody.message?.slice(0, 50),
      userId: snakeCaseBody.user_id,
      hasActiveSegment: !!snakeCaseBody.active_segment
    })
    
    const response = await fetch(`${BACKEND_URL}/api/orchestrator/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snakeCaseBody),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [Proxy] Backend error:', errorText)
      return NextResponse.json(
        { success: false, error: `Backend error: ${response.status}` },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    // Transform backend snake_case → frontend camelCase
    const camelCaseData = keysToCamelCase(data)
    
    console.log('✅ [Proxy] Orchestrate response:', {
      success: camelCaseData.success,
      intent: camelCaseData.intent,
      actionsCount: camelCaseData.actions?.length
    })
    
    return NextResponse.json(camelCaseData)
    
  } catch (error) {
    console.error('❌ [Proxy] Orchestrate error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to reach orchestrator backend' 
      },
      { status: 500 }
    )
  }
}