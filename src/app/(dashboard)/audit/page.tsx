import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuditLogClient } from './audit-log-client'
import type { FeatureConfig } from '@/types/database'

export default async function AuditPage() {
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

  // Check if photo verification is enabled
  const featureConfig = organization?.feature_config as unknown as FeatureConfig | null
  const photoVerificationEnabled = featureConfig?.features?.photoVerification?.enabled

  // Redirect if feature not enabled
  if (!photoVerificationEnabled) {
    redirect('/')
  }

  // Get audit log entries
  const { data: entries } = await supabase
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
    .limit(100)

  // Transform entries
  const transformedEntries = (entries || []).map(entry => ({
    id: entry.id,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    metadata: entry.metadata as Record<string, unknown> | null,
    created_at: entry.created_at,
    user: entry.user as { id: string; name: string; email: string } | null
  }))

  return <AuditLogClient entries={transformedEntries} />
}
