import { GoogleGenerativeAI, TaskType } from '@google/generative-ai'

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Using gemini-embedding-001 model with 768 dimensions (matching our database schema)
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768

/**
 * Generate an embedding vector for a single text input
 * @param text - The text to embed
 * @returns The embedding vector as an array of numbers
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })

  const result = await model.embedContent({
    content: { parts: [{ text }], role: 'user' },
    taskType: TaskType.RETRIEVAL_DOCUMENT,
  })

  const embedding = result.embedding.values

  // Truncate to 768 dimensions if needed (Gemini defaults to 3072)
  // The model supports output_dimensionality but we'll truncate for safety
  if (embedding.length > EMBEDDING_DIMENSIONS) {
    return embedding.slice(0, EMBEDDING_DIMENSIONS)
  }

  return embedding
}

/**
 * Generate an embedding vector optimized for queries (semantic search)
 * @param query - The search query to embed
 * @returns The embedding vector as an array of numbers
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })

  const result = await model.embedContent({
    content: { parts: [{ text: query }], role: 'user' },
    taskType: TaskType.RETRIEVAL_QUERY,
  })

  const embedding = result.embedding.values

  // Truncate to 768 dimensions if needed
  if (embedding.length > EMBEDDING_DIMENSIONS) {
    return embedding.slice(0, EMBEDDING_DIMENSIONS)
  }

  return embedding
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  // Process in parallel with rate limiting
  const embeddings: number[][] = []

  for (const text of texts) {
    const embedding = await generateEmbedding(text)
    embeddings.push(embedding)
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return embeddings
}

/**
 * Format task content for embedding
 * Creates a rich text representation of a task for better semantic search
 */
export function formatTaskForEmbedding(task: {
  title: string
  description?: string | null
  department?: string | null
  priority?: string
  status?: string
}): string {
  const parts: string[] = []

  parts.push(`Task: ${task.title}`)

  if (task.description) {
    parts.push(`Description: ${task.description}`)
  }

  if (task.department) {
    parts.push(`Department: ${task.department}`)
  }

  if (task.priority) {
    parts.push(`Priority: ${task.priority}`)
  }

  if (task.status) {
    parts.push(`Status: ${task.status}`)
  }

  return parts.join('. ')
}

/**
 * Convert embedding array to pgvector format string
 */
export function embeddingToPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}
