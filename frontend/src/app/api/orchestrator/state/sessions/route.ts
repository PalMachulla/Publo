// src/app/api/orchestrator/state/sessions/route.ts

import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const response = await fetch(`${BACKEND_URL}/api/state/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json({ error: 'Failed to reach backend' }, { status: 500 })
  }
}