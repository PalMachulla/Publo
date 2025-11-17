/**
 * Next.js API Route: GET /api/groq/models
 * Fetches available models from Groq API
 */

import { NextResponse } from 'next/server'
import { groqClient } from '@/lib/groq/client'

export async function GET() {
  try {
    const models = await groqClient.getModels()
    
    return NextResponse.json({
      success: true,
      data: models,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in /api/groq/models:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch models',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

