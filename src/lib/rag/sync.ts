import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmbedding, formatTaskForEmbedding, embeddingToPgVector } from './embeddings'
import type { Task } from '@/types/database'

/**
 * Sync (create or update) embedding for a single task
 * Uses admin client to bypass RLS for embedding storage
 *
 * @param task - The task to create an embedding for
 * @returns Success status and any error message
 */
export async function syncTaskEmbedding(task: Task): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Format task content for embedding
    const contentText = formatTaskForEmbedding({
      title: task.title,
      description: task.description,
      department: task.department,
      priority: task.priority,
      status: task.status,
    })

    // Generate embedding
    const embedding = await generateEmbedding(contentText)
    const embeddingVector = embeddingToPgVector(embedding)

    // Use admin client to bypass RLS
    const supabase = createAdminClient()

    // Upsert the embedding (update if exists, insert if not)
    const { error } = await supabase
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

    if (error) {
      console.error('Error syncing task embedding:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in syncTaskEmbedding:', message)
    return { success: false, error: message }
  }
}

/**
 * Sync embeddings for multiple tasks
 * Useful for batch operations or initial seeding
 *
 * @param tasks - Array of tasks to sync embeddings for
 * @param onProgress - Optional callback for progress updates
 */
export async function syncBatchTaskEmbeddings(
  tasks: Task[],
  onProgress?: (completed: number, total: number) => void
): Promise<{
  successful: number
  failed: number
  errors: string[]
}> {
  let successful = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const result = await syncTaskEmbedding(task)

    if (result.success) {
      successful++
    } else {
      failed++
      errors.push(`Task ${task.id}: ${result.error}`)
    }

    // Report progress
    onProgress?.(i + 1, tasks.length)

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  return { successful, failed, errors }
}

/**
 * Delete embedding for a task
 * Should be called when a task is deleted
 */
export async function deleteTaskEmbedding(taskId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('embeddings')
      .delete()
      .eq('content_type', 'task')
      .eq('content_id', taskId)

    if (error) {
      console.error('Error deleting task embedding:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in deleteTaskEmbedding:', message)
    return { success: false, error: message }
  }
}

/**
 * Sync all tasks for an organization
 * Useful for initial setup or re-indexing
 */
export async function syncAllOrgTaskEmbeddings(
  orgId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{
  successful: number
  failed: number
  errors: string[]
}> {
  const supabase = createAdminClient()

  // Fetch all tasks for the organization
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('org_id', orgId)

  if (error) {
    return {
      successful: 0,
      failed: 0,
      errors: [`Failed to fetch tasks: ${error.message}`],
    }
  }

  if (!tasks || tasks.length === 0) {
    return { successful: 0, failed: 0, errors: [] }
  }

  return syncBatchTaskEmbeddings(tasks, onProgress)
}
