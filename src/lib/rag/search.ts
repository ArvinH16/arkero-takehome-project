import { createAdminClient } from '@/lib/supabase/admin'
import { embeddingToPgVector } from './embeddings'

export interface SearchResult {
  id: string
  content_type: string
  content_id: string
  content_text: string
  similarity: number
}

/**
 * Search for similar documents using pgvector
 * Uses the match_documents database function which enforces tenant isolation
 *
 * @param queryEmbedding - The embedding vector of the search query
 * @param orgId - The organization ID to search within (tenant isolation)
 * @param options - Search options
 * @returns Array of matching documents with similarity scores
 */
export async function searchSimilarDocuments(
  queryEmbedding: number[],
  orgId: string,
  options: {
    matchThreshold?: number
    matchCount?: number
  } = {}
): Promise<SearchResult[]> {
  const { matchThreshold = 0.5, matchCount = 5 } = options

  // Use admin client to bypass RLS since we're passing org_id explicitly
  // The match_documents function handles tenant isolation
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embeddingToPgVector(queryEmbedding),
    query_org_id: orgId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  })

  if (error) {
    console.error('Error searching documents:', error)
    throw new Error(`Failed to search documents: ${error.message}`)
  }

  return (data || []) as SearchResult[]
}

/**
 * Search for similar tasks specifically
 * Returns only task-type embeddings
 */
export async function searchSimilarTasks(
  queryEmbedding: number[],
  orgId: string,
  options: {
    matchThreshold?: number
    matchCount?: number
  } = {}
): Promise<SearchResult[]> {
  const results = await searchSimilarDocuments(queryEmbedding, orgId, options)

  // Filter to only task content types
  return results.filter(r => r.content_type === 'task')
}

/**
 * Get task IDs from search results
 */
export function getTaskIdsFromResults(results: SearchResult[]): string[] {
  return results
    .filter(r => r.content_type === 'task')
    .map(r => r.content_id)
}
