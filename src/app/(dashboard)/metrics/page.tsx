import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MetricsClient } from './metrics-client'
import { getDepartmentMetrics } from '@/lib/actions/tasks'
import type { FeatureConfig } from '@/types/database'

export default async function MetricsPage() {
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

  // Check if departments feature is enabled
  const featureConfig = organization?.feature_config as unknown as FeatureConfig | null
  const departmentsEnabled = featureConfig?.features?.departments?.enabled

  // Redirect if feature not enabled
  if (!departmentsEnabled) {
    redirect('/')
  }

  // Get department metrics
  const { departments, summary, error } = await getDepartmentMetrics()

  if (error) {
    throw new Error(error)
  }

  return (
    <MetricsClient
      departments={departments}
      summary={summary}
      organizationName={organization?.name || 'Organization'}
    />
  )
}
