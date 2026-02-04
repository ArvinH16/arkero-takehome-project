'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Organization, User, FeatureConfig } from '@/types/database'

interface OrgContextType {
  // Current state
  organization: Organization | null
  user: User | null
  isLoading: boolean
  error: string | null

  // Available data
  organizations: Organization[]
  users: User[]

  // Actions
  switchOrg: (orgId: string) => Promise<void>
  switchUser: (userId: string) => void
  refreshData: () => Promise<void>

  // Feature helpers
  getFeatureConfig: () => FeatureConfig | null
  isFeatureEnabled: (feature: 'departments' | 'photoVerification') => boolean
}

const OrgContext = createContext<OrgContextType | null>(null)

const STORAGE_KEY_ORG = 'touchline-org-id'
const STORAGE_KEY_USER = 'touchline-user-id'

export function OrgProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Load organizations on mount
  const loadOrganizations = useCallback(async (): Promise<Organization[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('organizations')
        .select('*')
        .order('name')

      if (fetchError) throw fetchError
      const orgs = (data || []) as Organization[]
      setOrganizations(orgs)
      return orgs
    } catch (err) {
      console.error('Failed to load organizations:', err)
      setError('Failed to load organizations')
      return []
    }
  }, [supabase])

  // Load users for an organization
  const loadUsers = useCallback(async (orgId: string): Promise<User[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('org_id', orgId)
        .order('role')
        .order('name')

      if (fetchError) throw fetchError
      const orgUsers = (data || []) as User[]
      setUsers(orgUsers)
      return orgUsers
    } catch (err) {
      console.error('Failed to load users:', err)
      setError('Failed to load users')
      return []
    }
  }, [supabase])

  // Switch organization
  const switchOrg = useCallback(async (orgId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Find org in loaded list
      let org: Organization | undefined = organizations.find(o => o.id === orgId)

      if (!org) {
        // Load from DB if not in list
        const { data, error: fetchError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single()

        if (fetchError) throw fetchError
        org = data as Organization
      }

      if (!org) throw new Error('Organization not found')

      setOrganization(org)
      localStorage.setItem(STORAGE_KEY_ORG, orgId)

      // Load users for new org
      const orgUsers = await loadUsers(orgId)

      // Auto-select first admin user, or first user
      const adminUser = orgUsers.find(u => u.role === 'admin')
      const selectedUser = adminUser || orgUsers[0]

      if (selectedUser) {
        setUser(selectedUser)
        localStorage.setItem(STORAGE_KEY_USER, selectedUser.id)
      } else {
        setUser(null)
        localStorage.removeItem(STORAGE_KEY_USER)
      }
    } catch (err) {
      console.error('Failed to switch organization:', err)
      setError('Failed to switch organization')
    } finally {
      setIsLoading(false)
    }
  }, [organizations, supabase, loadUsers])

  // Switch user within current org
  const switchUser = useCallback((userId: string) => {
    const newUser = users.find(u => u.id === userId)
    if (newUser) {
      setUser(newUser)
      localStorage.setItem(STORAGE_KEY_USER, userId)
    }
  }, [users])

  // Refresh all data
  const refreshData = useCallback(async () => {
    setIsLoading(true)
    const orgs = await loadOrganizations()
    if (organization) {
      await loadUsers(organization.id)
    } else if (orgs.length > 0) {
      await switchOrg(orgs[0].id)
    }
    setIsLoading(false)
  }, [loadOrganizations, loadUsers, organization, switchOrg])

  // Feature helpers
  const getFeatureConfig = useCallback((): FeatureConfig | null => {
    return organization?.feature_config || null
  }, [organization])

  const isFeatureEnabled = useCallback((feature: 'departments' | 'photoVerification'): boolean => {
    const config = getFeatureConfig()
    if (!config) return false
    return config.features[feature]?.enabled || false
  }, [getFeatureConfig])

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)

      const orgs = await loadOrganizations()
      if (orgs.length === 0) {
        setIsLoading(false)
        return
      }

      // Try to restore from localStorage
      const storedOrgId = localStorage.getItem(STORAGE_KEY_ORG)
      const storedUserId = localStorage.getItem(STORAGE_KEY_USER)

      const targetOrgId = storedOrgId && orgs.find(o => o.id === storedOrgId)
        ? storedOrgId
        : orgs[0].id

      const org = orgs.find(o => o.id === targetOrgId)
      if (org) {
        setOrganization(org)
        localStorage.setItem(STORAGE_KEY_ORG, org.id)

        const orgUsers = await loadUsers(org.id)

        // Try to restore user or select first admin
        let selectedUser = storedUserId
          ? orgUsers.find(u => u.id === storedUserId)
          : null

        if (!selectedUser) {
          selectedUser = orgUsers.find(u => u.role === 'admin') || orgUsers[0]
        }

        if (selectedUser) {
          setUser(selectedUser)
          localStorage.setItem(STORAGE_KEY_USER, selectedUser.id)
        }
      }

      setIsLoading(false)
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <OrgContext.Provider
      value={{
        organization,
        user,
        isLoading,
        error,
        organizations,
        users,
        switchOrg,
        switchUser,
        refreshData,
        getFeatureConfig,
        isFeatureEnabled,
      }}
    >
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const context = useContext(OrgContext)
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider')
  }
  return context
}
