import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { TaskDetailClient } from './task-detail-client'
import type { Task, Organization, User } from '@/types/database'

interface TaskPageProps {
  params: Promise<{ id: string }>
}

export default async function TaskPage({ params }: TaskPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Get auth user
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    redirect('/login')
  }

  // Get profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authUser.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Get organization
  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.org_id)
    .single()

  // Get task (RLS ensures it's from the user's org)
  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !task) {
    notFound()
  }

  // Get photos for the task
  const { data: photos } = await supabase
    .from('task_photos')
    .select('*')
    .eq('task_id', id)
    .order('uploaded_at', { ascending: false })

  // Get all users for assignment dropdown
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email, department')
    .order('name')

  return (
    <TaskDetailClient
      task={task as Task}
      photos={photos || []}
      organization={organization as Organization}
      profile={profile as User}
      users={users || []}
    />
  )
}
