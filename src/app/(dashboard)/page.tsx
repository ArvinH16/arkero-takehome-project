import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import type { Task, Organization, User } from '@/types/database'

export default async function DashboardPage() {
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
    // User is authenticated but has no profile - sign them out to break the redirect loop
    // This can happen if signup partially failed (auth created but profile link failed)
    await supabase.auth.signOut()
    redirect('/login?error=no_profile')
  }

  // Get organization
  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.org_id)
    .single()

  // Get tasks (RLS automatically filters to current org)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  const taskList = tasks || []

  // Calculate stats
  const stats = {
    total: taskList.length,
    pending: taskList.filter(t => t.status === 'pending').length,
    in_progress: taskList.filter(t => t.status === 'in_progress').length,
    completed: taskList.filter(t => t.status === 'completed').length,
  }

  return (
    <DashboardClient
      organization={organization as Organization}
      profile={profile as User}
      tasks={taskList as Task[]}
      stats={stats}
    />
  )
}
