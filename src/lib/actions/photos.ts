'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TaskPhoto } from '@/types/database'

export interface UploadPhotoResult {
  photo: TaskPhoto | null
  error: string | null
}

export interface PhotosResult {
  photos: TaskPhoto[]
  error: string | null
}

/**
 * Upload a photo for a task
 * - Uploads to Supabase Storage: {org_id}/{task_id}/{timestamp}-{filename}
 * - Creates task_photos record
 * - Logs to audit_log
 */
export async function uploadTaskPhoto(
  taskId: string,
  formData: FormData
): Promise<UploadPhotoResult> {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { photo: null, error: 'Not authenticated' }
  }

  // Get user profile with org_id
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, org_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError || !profile) {
    return { photo: null, error: 'Failed to get user profile' }
  }

  // Get the file from form data
  const file = formData.get('file') as File
  if (!file) {
    return { photo: null, error: 'No file provided' }
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { photo: null, error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.' }
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    return { photo: null, error: 'File too large. Maximum size is 5MB.' }
  }

  // Verify task belongs to user's org
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, org_id')
    .eq('id', taskId)
    .single()

  if (taskError || !task) {
    return { photo: null, error: 'Task not found' }
  }

  if (task.org_id !== profile.org_id) {
    return { photo: null, error: 'Access denied' }
  }

  // Generate unique filename
  const timestamp = Date.now()
  const extension = file.name.split('.').pop() || 'jpg'
  const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`
  const storagePath = `${profile.org_id}/${taskId}/${filename}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('task-photos')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return { photo: null, error: 'Failed to upload file' }
  }

  // Get signed URL (valid for 1 year for display purposes)
  const { data: urlData } = await supabase.storage
    .from('task-photos')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

  if (!urlData?.signedUrl) {
    return { photo: null, error: 'Failed to generate URL' }
  }

  // Create task_photos record
  const { data: photo, error: photoError } = await supabase
    .from('task_photos')
    .insert({
      task_id: taskId,
      org_id: profile.org_id,
      photo_url: urlData.signedUrl,
      uploaded_by: profile.id,
      metadata: {
        original_name: file.name,
        size: file.size,
        type: file.type,
        storage_path: storagePath
      }
    })
    .select()
    .single()

  if (photoError) {
    console.error('Photo record error:', photoError)
    // Try to clean up the uploaded file
    await supabase.storage.from('task-photos').remove([storagePath])
    return { photo: null, error: 'Failed to save photo record' }
  }

  // Log to audit
  await supabase.from('audit_log').insert({
    org_id: profile.org_id,
    user_id: profile.id,
    action: 'photo_uploaded',
    entity_type: 'task_photo',
    entity_id: photo.id,
    metadata: {
      task_id: taskId,
      filename: file.name
    }
  })

  revalidatePath(`/tasks/${taskId}`)
  revalidatePath('/audit')

  return { photo, error: null }
}

/**
 * Get all photos for a task
 */
export async function getTaskPhotos(taskId: string): Promise<PhotosResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('task_photos')
    .select('*')
    .eq('task_id', taskId)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('Error fetching photos:', error)
    return { photos: [], error: error.message }
  }

  return { photos: data || [], error: null }
}

/**
 * Delete a photo
 */
export async function deleteTaskPhoto(photoId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, org_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'Failed to get user profile' }
  }

  // Get the photo record
  const { data: photo, error: photoError } = await supabase
    .from('task_photos')
    .select('*, metadata')
    .eq('id', photoId)
    .single()

  if (photoError || !photo) {
    return { error: 'Photo not found' }
  }

  // Verify photo belongs to user's org
  if (photo.org_id !== profile.org_id) {
    return { error: 'Access denied' }
  }

  // Delete from storage if path is stored in metadata
  const metadata = photo.metadata as { storage_path?: string } | null
  if (metadata?.storage_path) {
    await supabase.storage
      .from('task-photos')
      .remove([metadata.storage_path])
  }

  // Delete the record
  const { error: deleteError } = await supabase
    .from('task_photos')
    .delete()
    .eq('id', photoId)

  if (deleteError) {
    console.error('Delete error:', deleteError)
    return { error: 'Failed to delete photo' }
  }

  // Log to audit
  await supabase.from('audit_log').insert({
    org_id: profile.org_id,
    user_id: profile.id,
    action: 'photo_deleted',
    entity_type: 'task_photo',
    entity_id: photoId,
    metadata: {
      task_id: photo.task_id
    }
  })

  revalidatePath(`/tasks/${photo.task_id}`)
  revalidatePath('/audit')

  return { error: null }
}

/**
 * Get audit log entries
 */
export async function getAuditLog(limit = 50): Promise<{
  entries: Array<{
    id: string
    action: string
    entity_type: string
    entity_id: string
    metadata: Record<string, unknown> | null
    created_at: string | null
    user: { id: string; name: string; email: string } | null
  }>
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('audit_log')
    .select(`
      id,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at,
      user:users!audit_log_user_id_fkey(id, name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching audit log:', error)
    return { entries: [], error: error.message }
  }

  // Transform the data to flatten the user relation and cast metadata
  const entries = (data || []).map(entry => ({
    ...entry,
    metadata: entry.metadata as Record<string, unknown> | null,
    user: entry.user as { id: string; name: string; email: string } | null
  }))

  return { entries, error: null }
}
