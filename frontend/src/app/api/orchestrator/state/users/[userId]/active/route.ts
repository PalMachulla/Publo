// src/app/api/orchestrator/state/sessions/[userId]/active/route.ts

import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000'

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/state/sessions/${params.userId}/active`
    )
    
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json({ error: 'Failed to reach backend' }, { status: 500 })
  }
}