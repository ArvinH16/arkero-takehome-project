import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Admin client - bypasses RLS (use only for admin operations)
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// RLS-aware client with custom headers for multi-tenancy
// This uses the anon key but passes org/user context via headers
export function createRLSClient(orgId: string, userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createSupabaseClient<Database>(supabaseUrl, anonKey, {
    global: {
      headers: {
        'x-org-id': orgId,
        'x-user-id': userId,
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
