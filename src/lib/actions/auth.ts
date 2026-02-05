'use server'

import { createAdminClient } from '@/lib/supabase/admin'

interface SignedUpUser {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  org_id: string
}

interface Organization {
  id: string
  name: string
  slug: string
}

/**
 * Fetches all organizations (for login/signup dropdowns).
 * Uses admin client to bypass RLS.
 */
export async function getOrganizations(): Promise<{ data: Organization[] | null; error?: string }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .order('name')

  if (error) {
    console.error('Failed to fetch organizations:', error)
    return { data: null, error: 'Failed to load organizations' }
  }

  return { data }
}

/**
 * Fetches users who have already signed up (have auth_id) for a given org.
 * Uses admin client to bypass RLS. For demo/login purposes.
 */
export async function getSignedUpUsers(orgId: string): Promise<{ data: SignedUpUser[] | null; error?: string }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, department, org_id')
    .eq('org_id', orgId)
    .not('auth_id', 'is', null) // Only users who have signed up
    .order('role')
    .order('name')

  if (error) {
    console.error('Failed to fetch signed-up users:', error)
    return { data: null, error: 'Failed to load users' }
  }

  return { data }
}

/**
 * Links an auth user to their public.users profile.
 * Uses admin client to bypass RLS since the auth_id isn't set yet.
 *
 * Security: Verifies that the auth user's email matches the profile's email.
 */
export async function linkAuthToProfile(
  userRowId: string,
  authUserId: string,
  authUserEmail: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  // First, verify the user row exists and has matching email
  const { data: userRow, error: fetchError } = await supabase
    .from('users')
    .select('id, email, auth_id')
    .eq('id', userRowId)
    .single()

  if (fetchError || !userRow) {
    return { success: false, error: 'User profile not found' }
  }

  // Security check: ensure emails match
  if (userRow.email.toLowerCase() !== authUserEmail.toLowerCase()) {
    return { success: false, error: 'Email mismatch' }
  }

  // Check if already claimed
  if (userRow.auth_id) {
    return { success: false, error: 'This profile has already been claimed' }
  }

  // Link the auth user to the profile
  const { error: updateError } = await supabase
    .from('users')
    .update({ auth_id: authUserId })
    .eq('id', userRowId)
    .is('auth_id', null) // Extra safety: only update if still unclaimed

  if (updateError) {
    console.error('Failed to link auth user:', updateError)
    return { success: false, error: 'Failed to link account' }
  }

  return { success: true }
}
