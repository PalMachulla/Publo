/**
 * Next.js API Route: POST /api/groq/chat
 * Generates story structure using Groq chat completions
 */

import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_PUBLO_KEY || '',
})

export async function POST(request: Request) {
  try {
    const { model, systemPrompt, userPrompt, maxTokens } = await request.json()

    // Validate required parameters
    if (!model || !systemPrompt || !userPrompt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: model, systemPrompt, userPrompt',
        },
        { status: 400 }
      )
    }

    // Validate maxTokens
    const tokens = Math.min(Math.max(parseInt(maxTokens, 10) || 2000, 100), 16000)

    console.log('🤖 Generating story structure with Groq:', {
      model,
      userPromptLength: userPrompt.length,
      systemPromptLength: systemPrompt.length,
      maxTokens: tokens,
    })

    // Call Groq chat completions API
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      model: model,
      max_tokens: tokens,
      temperature: 0.7, // Balance creativity and structure
      top_p: 1,
      stream: false,
    })

    // Extract the generated markdown
    const generatedMarkdown = chatCompletion.choices[0]?.message?.content || ''

    if (!generatedMarkdown) {
      return NextResponse.json(
        {
          success: false,
          error: 'No content generated from Groq API',
        },
        { status: 500 }
      )
    }

    console.log('✅ Story structure generated successfully:', {
      markdownLength: generatedMarkdown.length,
      usage: chatCompletion.usage,
    })

    return NextResponse.json({
      success: true,
      markdown: generatedMarkdown,
      usage: chatCompletion.usage,
      model: chatCompletion.model,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('❌ Error in /api/groq/chat:', error)

    // Handle Groq API specific errors
    if (error?.status === 401) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key. Please check your GROQ_PUBLO_KEY environment variable.',
        },
        { status: 401 }
      )
    }

    if (error?.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to generate story structure',
        details: error?.error?.message || undefined,
      },
      { status: 500 }
    )
  }
}

