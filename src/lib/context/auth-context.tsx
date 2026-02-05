'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Organization, User, FeatureConfig } from '@/types/database'
import type { User as AuthUser } from '@supabase/supabase-js'

interface AuthContextType {
  // Auth state
  authUser: AuthUser | null
  profile: User | null
  organization: Organization | null
  isLoading: boolean
  error: string | null

  // Actions
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>

  // Feature helpers
  getFeatureConfig: () => FeatureConfig | null
  isFeatureEnabled: (feature: 'departments' | 'photoVerification') => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const supabase = createClient()

  // Fetch user profile and organization
  const fetchProfileAndOrg = useCallback(async (authUserId: string) => {
    try {
      // Get profile by auth_id
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUserId)
        .single()

      if (profileError) {
        // Profile might not be linked yet (new signup)
        console.log('Profile not found for auth user:', authUserId)
        setProfile(null)
        setOrganization(null)
        return
      }

      setProfile(profileData)

      // Get organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profileData.org_id)
        .single()

      if (orgError) {
        console.error('Failed to fetch organization:', orgError)
        setOrganization(null)
        return
      }

      setOrganization(orgData)
    } catch (err) {
      console.error('Error fetching profile and org:', err)
      setError('Failed to load user data')
    }
  }, [supabase])

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      setAuthUser(null)
      setProfile(null)
      setOrganization(null)
      router.push('/login')
      router.refresh()
    } catch (err) {
      console.error('Sign out error:', err)
      setError('Failed to sign out')
    }
  }, [supabase, router])

  // Refresh profile (useful after linking auth_id)
  const refreshProfile = useCallback(async () => {
    if (authUser) {
      await fetchProfileAndOrg(authUser.id)
    }
  }, [authUser, fetchProfileAndOrg])

  // Feature helpers
  const getFeatureConfig = useCallback((): FeatureConfig | null => {
    return (organization?.feature_config as unknown as FeatureConfig | null) || null
  }, [organization])

  const isFeatureEnabled = useCallback((feature: 'departments' | 'photoVerification'): boolean => {
    const config = getFeatureConfig()
    if (!config) return false
    return config.features[feature]?.enabled || false
  }, [getFeatureConfig])

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true)

      // Get initial session
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        setAuthUser(session.user)
        await fetchProfileAndOrg(session.user.id)
      }

      setIsLoading(false)
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event)

        if (session?.user) {
          setAuthUser(session.user)
          await fetchProfileAndOrg(session.user.id)
        } else {
          setAuthUser(null)
          setProfile(null)
          setOrganization(null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider
      value={{
        authUser,
        profile,
        organization,
        isLoading,
        error,
        signOut,
        refreshProfile,
        getFeatureConfig,
        isFeatureEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
