// src/app/api/orchestrator/characters/portrait/route.ts
//
// Proxy to Python backend (deterministic portrait retry).

import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000'

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

function keysToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(keysToSnakeCase)
  if (typeof obj !== 'object') return obj
  return Object.keys(obj).reduce((acc, key) => {
    acc[toSnakeCase(key)] = keysToSnakeCase(obj[key])
    return acc
  }, {} as Record<string, any>)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const snakeBody = keysToSnakeCase(body)

    const response = await fetch(`${BACKEND_URL}/api/orchestrator/characters/portrait`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snakeBody),
    })

    const text = await response.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { success: false, error: text || 'Invalid backend response' }
    }

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('❌ [Proxy] Portrait retry error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to reach orchestrator backend' },
      { status: 500 }
    )
  }
}

