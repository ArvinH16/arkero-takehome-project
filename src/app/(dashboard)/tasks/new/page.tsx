import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NewTaskForm } from './new-task-form'
import type { Organization, User } from '@/types/database'

export default async function NewTaskPage() {
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

  // Get all users for assignment dropdown
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email, department')
    .order('name')

  return (
    <NewTaskForm
      organization={organization as Organization}
      profile={profile as User}
      users={users || []}
    />
  )
}
