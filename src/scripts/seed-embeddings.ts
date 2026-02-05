/**
 * Seed embeddings script
 *
 * This script generates embeddings for all existing tasks in the database.
 * Run with: npx tsx src/scripts/seed-embeddings.ts
 *
 * Requires GEMINI_API_KEY and Supabase credentials in environment
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai'

// Load env from .env.local
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const geminiApiKey = process.env.GEMINI_API_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

if (!geminiApiKey) {
  console.error('Missing GEMINI_API_KEY')
  process.exit(1)
}

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseServiceKey)
const genAI = new GoogleGenerativeAI(geminiApiKey)

const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768

interface Task {
  id: string
  org_id: string
  title: string
  description: string | null
  department: string | null
  priority: string
  status: string
}

function formatTaskForEmbedding(task: Task): string {
  const parts: string[] = []
  parts.push(`Task: ${task.title}`)
  if (task.description) parts.push(`Description: ${task.description}`)
  if (task.department) parts.push(`Department: ${task.department}`)
  parts.push(`Priority: ${task.priority}`)
  parts.push(`Status: ${task.status}`)
  return parts.join('. ')
}

async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })

  const result = await model.embedContent({
    content: { parts: [{ text }], role: 'user' },
    taskType: TaskType.RETRIEVAL_DOCUMENT,
  })

  const embedding = result.embedding.values

  // Truncate to 768 dimensions if needed
  if (embedding.length > EMBEDDING_DIMENSIONS) {
    return embedding.slice(0, EMBEDDING_DIMENSIONS)
  }

  return embedding
}

function embeddingToPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

async function seedEmbeddings() {
  console.log('Starting embedding seed process...\n')

  // Fetch all tasks
  const { data: tasks, error: fetchError } = await supabase
    .from('tasks')
    .select('id, org_id, title, description, department, priority, status')

  if (fetchError) {
    console.error('Error fetching tasks:', fetchError)
    process.exit(1)
  }

  if (!tasks || tasks.length === 0) {
    console.log('No tasks found in the database.')
    return
  }

  console.log(`Found ${tasks.length} tasks to process\n`)

  let successful = 0
  let failed = 0

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const progress = `[${i + 1}/${tasks.length}]`

    try {
      // Format task content
      const contentText = formatTaskForEmbedding(task)

      // Generate embedding
      const embedding = await generateEmbedding(contentText)
      const embeddingVector = embeddingToPgVector(embedding)

      // Upsert embedding
      const { error: upsertError } = await supabase
        .from('embeddings')
        .upsert(
          {
            org_id: task.org_id,
            content_type: 'task',
            content_id: task.id,
            content_text: contentText,
            embedding: embeddingVector,
          },
          {
            onConflict: 'org_id,content_type,content_id',
          }
        )

      if (upsertError) {
        console.error(`${progress} Failed: ${task.title} - ${upsertError.message}`)
        failed++
      } else {
        console.log(`${progress} Success: ${task.title}`)
        successful++
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`${progress} Error: ${task.title} - ${message}`)
      failed++
    }
  }

  console.log('\n--- Seed Complete ---')
  console.log(`Successful: ${successful}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total: ${tasks.length}`)

  // Verify embeddings count
  const { count } = await supabase
    .from('embeddings')
    .select('*', { count: 'exact', head: true })

  console.log(`\nTotal embeddings in database: ${count}`)
}

// Run the seed
seedEmbeddings()
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
