import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { queryRAG, getSuggestedQuestions } from '@/lib/rag/query'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's org_id for tenant isolation
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('org_id')
      .eq('auth_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { query } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Check if GEMINI_API_KEY is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: 'AI Assistant is not configured. Please set GEMINI_API_KEY.',
          suggestedQuestions: getSuggestedQuestions()
        },
        { status: 503 }
      )
    }

    // Execute RAG query with tenant isolation
    const result = await queryRAG(query, profile.org_id)

    return NextResponse.json({
      answer: result.answer,
      sources: result.sources,
      confidence: result.confidence,
      suggestedQuestions: getSuggestedQuestions(),
    })
  } catch (error) {
    console.error('RAG query error:', error)

    const message = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

// Also support GET for suggested questions
export async function GET() {
  return NextResponse.json({
    suggestedQuestions: getSuggestedQuestions(),
  })
}
