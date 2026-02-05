import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateQueryEmbedding } from './embeddings'
import { searchSimilarTasks, type SearchResult } from './search'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Task } from '@/types/database'

// Initialize Gemini for generation
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const GENERATION_MODEL = 'gemini-2.5-flash'

export interface RAGResponse {
  answer: string
  sources: Array<{
    taskId: string
    title: string
    similarity: number
  }>
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Calculate confidence level based on search results
 */
function calculateConfidence(results: SearchResult[]): 'high' | 'medium' | 'low' {
  if (results.length === 0) return 'low'

  const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length

  if (avgSimilarity > 0.8 && results.length >= 2) return 'high'
  if (avgSimilarity > 0.6) return 'medium'
  return 'low'
}

/**
 * Build context from search results and task details
 */
async function buildContext(results: SearchResult[]): Promise<{
  contextText: string
  tasks: Task[]
}> {
  if (results.length === 0) {
    return { contextText: '', tasks: [] }
  }

  const supabase = createAdminClient()

  // Fetch full task details for the matched content
  const taskIds = results
    .filter(r => r.content_type === 'task')
    .map(r => r.content_id)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .in('id', taskIds)

  const taskList = tasks || []

  // Build context string with task details
  const contextParts = taskList.map((task, index) => {
    const result = results.find(r => r.content_id === task.id)
    const similarity = result ? Math.round(result.similarity * 100) : 0

    return `
Task ${index + 1} (Relevance: ${similarity}%):
- Title: ${task.title}
- Description: ${task.description || 'No description'}
- Status: ${task.status}
- Priority: ${task.priority}
- Department: ${task.department || 'Unassigned'}
- Due Date: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Not set'}
- Requires Photo: ${task.requires_photo ? 'Yes' : 'No'}
`.trim()
  })

  return {
    contextText: contextParts.join('\n\n'),
    tasks: taskList,
  }
}

/**
 * Generate a response using RAG
 * 1. Generate embedding for the query
 * 2. Search for similar content (tenant-isolated)
 * 3. Build context from results
 * 4. Generate response with Gemini
 *
 * @param query - The user's question
 * @param orgId - The organization ID for tenant isolation
 * @returns RAG response with answer, sources, and confidence
 */
export async function queryRAG(
  query: string,
  orgId: string
): Promise<RAGResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  // Step 1: Generate embedding for the query
  const queryEmbedding = await generateQueryEmbedding(query)

  // Step 2: Search for similar tasks (tenant-isolated)
  const searchResults = await searchSimilarTasks(queryEmbedding, orgId, {
    matchThreshold: 0.4,
    matchCount: 5,
  })

  // Step 3: Calculate confidence
  const confidence = calculateConfidence(searchResults)

  // Step 4: Build context from results
  const { contextText, tasks } = await buildContext(searchResults)

  // Step 5: Generate response with Gemini
  const model = genAI.getGenerativeModel({ model: GENERATION_MODEL })

  const systemPrompt = `You are a helpful AI assistant for a game day operations platform.
You help users understand and manage their tasks.

You have access to the following task information from the organization's database:

${contextText || 'No relevant tasks found.'}

Guidelines:
- Answer the question based ONLY on the provided task information
- If the information doesn't contain relevant data to answer the question, say so clearly
- Be concise and helpful
- Reference specific tasks by their titles when relevant
- If asked about task counts or summaries, use the actual data provided
- Do not make up information that isn't in the context`

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\nUser Question: ' + query }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 500,
    },
  })

  const answer = result.response.text()

  // Build sources from matched tasks
  const sources = tasks.map(task => {
    const result = searchResults.find(r => r.content_id === task.id)
    return {
      taskId: task.id,
      title: task.title,
      similarity: result?.similarity || 0,
    }
  }).sort((a, b) => b.similarity - a.similarity)

  return {
    answer,
    sources,
    confidence,
  }
}

/**
 * Get suggested questions based on the organization's tasks
 */
export function getSuggestedQuestions(): string[] {
  return [
    'What tasks are currently pending?',
    'Which tasks are marked as urgent?',
    'Summarize the tasks by priority',
    'What tasks are in progress?',
    'Are there any overdue tasks?',
    'What security-related tasks do we have?',
  ]
}
