import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TasksListClient } from './tasks-list-client'
import type { Task, Organization } from '@/types/database'

export default async function TasksPage() {
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

  // Get all tasks (RLS filters to current org)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <TasksListClient
      tasks={(tasks || []) as Task[]}
      organization={organization as Organization}
    />
  )
}
