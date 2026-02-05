'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Task, TaskStatus, TaskPriority } from '@/types/database'
import { syncTaskEmbedding } from '@/lib/rag/sync'

export interface TasksResponse {
  tasks: Task[]
  error: string | null
}

export interface TaskResponse {
  task: Task | null
  error: string | null
}

export interface CreateTaskInput {
  title: string
  description?: string
  priority?: TaskPriority
  department?: string
  requires_photo?: boolean
  due_date?: string
  assigned_to?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  priority?: TaskPriority
  department?: string
  requires_photo?: boolean
  due_date?: string
  assigned_to?: string
  status?: TaskStatus
}

/**
 * Get all tasks for the current user's organization
 * RLS automatically filters to the current org
 */
export async function getTasks(filters?: {
  status?: TaskStatus
  priority?: TaskPriority
  department?: string
}): Promise<TasksResponse> {
  const supabase = await createClient()

  let query = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }

  if (filters?.department) {
    query = query.eq('department', filters.department)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching tasks:', error)
    return { tasks: [], error: error.message }
  }

  return { tasks: data || [], error: null }
}

/**
 * Get task stats for the dashboard
 */
export async function getTaskStats(): Promise<{
  total: number
  pending: number
  in_progress: number
  completed: number
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tasks')
    .select('status')

  if (error) {
    console.error('Error fetching task stats:', error)
    return { total: 0, pending: 0, in_progress: 0, completed: 0, error: error.message }
  }

  const tasks = data || []
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    error: null
  }

  return stats
}

/**
 * Get a single task by ID
 */
export async function getTask(id: string): Promise<TaskResponse> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching task:', error)
    return { task: null, error: error.message }
  }

  return { task: data, error: null }
}

/**
 * Get a task with related photos
 */
export async function getTaskWithPhotos(id: string): Promise<{
  task: Task | null
  photos: Array<{ id: string; photo_url: string; uploaded_at: string | null }>
  error: string | null
}> {
  const supabase = await createClient()

  // Get task
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (taskError) {
    console.error('Error fetching task:', taskError)
    return { task: null, photos: [], error: taskError.message }
  }

  // Get photos
  const { data: photos, error: photosError } = await supabase
    .from('task_photos')
    .select('id, photo_url, uploaded_at')
    .eq('task_id', id)
    .order('uploaded_at', { ascending: false })

  if (photosError) {
    console.error('Error fetching photos:', photosError)
    // Still return the task even if photos fail
    return { task, photos: [], error: null }
  }

  return { task, photos: photos || [], error: null }
}

/**
 * Create a new task
 */
export async function createTask(input: CreateTaskInput): Promise<TaskResponse> {
  const supabase = await createClient()

  // Get current user's profile to get org_id
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { task: null, error: 'Not authenticated' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, org_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError || !profile) {
    return { task: null, error: 'Failed to get user profile' }
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title,
      description: input.description || null,
      priority: input.priority || 'medium',
      department: input.department || null,
      requires_photo: input.requires_photo || false,
      due_date: input.due_date || null,
      assigned_to: input.assigned_to || null,
      org_id: profile.org_id,
      created_by: profile.id,
      status: 'pending'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating task:', error)
    return { task: null, error: error.message }
  }

  // Sync embedding for the new task (non-blocking)
  syncTaskEmbedding(data).catch(err => {
    console.error('Failed to sync task embedding:', err)
  })

  revalidatePath('/tasks')
  revalidatePath('/')

  return { task: data, error: null }
}

/**
 * Update an existing task
 */
export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskResponse> {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  }

  if (input.title !== undefined) updateData.title = input.title
  if (input.description !== undefined) updateData.description = input.description
  if (input.priority !== undefined) updateData.priority = input.priority
  if (input.department !== undefined) updateData.department = input.department
  if (input.requires_photo !== undefined) updateData.requires_photo = input.requires_photo
  if (input.due_date !== undefined) updateData.due_date = input.due_date
  if (input.assigned_to !== undefined) updateData.assigned_to = input.assigned_to
  if (input.status !== undefined) {
    updateData.status = input.status
    if (input.status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating task:', error)
    return { task: null, error: error.message }
  }

  // Sync embedding for the updated task (non-blocking)
  syncTaskEmbedding(data).catch(err => {
    console.error('Failed to sync task embedding:', err)
  })

  revalidatePath('/tasks')
  revalidatePath(`/tasks/${id}`)
  revalidatePath('/')

  return { task: data, error: null }
}

/**
 * Update task status (convenience method)
 */
export async function updateTaskStatus(id: string, status: TaskStatus): Promise<TaskResponse> {
  return updateTask(id, { status })
}

/**
 * Get tasks grouped by department
 */
export async function getTasksByDepartment(): Promise<{
  grouped: Record<string, Task[]>
  error: string | null
}> {
  const { tasks, error } = await getTasks()

  if (error) {
    return { grouped: {}, error }
  }

  const grouped: Record<string, Task[]> = {}

  tasks.forEach(task => {
    const dept = task.department || 'Unassigned'
    if (!grouped[dept]) {
      grouped[dept] = []
    }
    grouped[dept].push(task)
  })

  return { grouped, error: null }
}

/**
 * Get users in the current organization (for assignment dropdown)
 */
export async function getOrgUsers(): Promise<{
  users: Array<{ id: string; name: string; email: string; department: string | null }>
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, department')
    .order('name')

  if (error) {
    console.error('Error fetching users:', error)
    return { users: [], error: error.message }
  }

  return { users: data || [], error: null }
}
