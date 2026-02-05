'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { Organization, User } from '@/types/database'
import { linkAuthToProfile } from '@/lib/actions/auth'

export default function SignupPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Load organizations on mount
  useEffect(() => {
    const loadOrganizations = async () => {
      // Use admin client pattern - fetch all orgs without RLS
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name')

      if (error) {
        console.error('Failed to load organizations:', error)
        toast.error('Failed to load organizations')
        return
      }

      setOrganizations(data || [])
      setIsLoadingOrgs(false)
    }

    loadOrganizations()
  }, [supabase])

  // Load available users when org changes
  useEffect(() => {
    if (!selectedOrgId) {
      setAvailableUsers([])
      setSelectedUserId('')
      return
    }

    const loadUsers = async () => {
      // Get users without auth_id (not yet signed up)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('org_id', selectedOrgId)
        .is('auth_id', null)
        .order('role')
        .order('name')

      if (error) {
        console.error('Failed to load users:', error)
        return
      }

      setAvailableUsers(data || [])
      setSelectedUserId('')
    }

    loadUsers()
  }, [selectedOrgId, supabase])

  const selectedUser = availableUsers.find(u => u.id === selectedUserId)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUser) {
      toast.error('Please select a user account')
      return
    }

    setIsLoading(true)

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: selectedUser.email,
        password,
        options: {
          data: {
            name: selectedUser.name,
          },
        },
      })

      if (authError) {
        toast.error(authError.message)
        return
      }

      if (!authData.user) {
        toast.error('Failed to create account')
        return
      }

      // 2. Link auth user to public.users record using server action (bypasses RLS)
      const linkResult = await linkAuthToProfile(
        selectedUser.id,
        authData.user.id,
        authData.user.email!
      )

      if (!linkResult.success) {
        console.error('Failed to link auth user:', linkResult.error)
        // Sign out the auth user since profile linking failed
        await supabase.auth.signOut()
        toast.error(linkResult.error || 'Failed to link account. Please try again.')
        return
      }

      toast.success('Account created successfully!')
      router.push('/')
      router.refresh()
    } catch (err) {
      console.error('Signup error:', err)
      toast.error('An error occurred during signup')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Select your organization and user to get started
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSignup}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organization">Organization</Label>
            <Select
              value={selectedOrgId}
              onValueChange={setSelectedOrgId}
              disabled={isLoadingOrgs || isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOrgId && (
            <div className="space-y-2">
              <Label htmlFor="user">User Account</Label>
              {availableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  All users in this organization have already signed up.
                </p>
              ) : (
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your user account" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex flex-col">
                          <span>{user.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {user.email} • {user.role.replace('_', ' ')}
                            {user.department && ` • ${user.department}`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {selectedUser && (
            <>
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-medium">{selectedUser.name}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                <p className="text-xs text-muted-foreground">
                  Role: {selectedUser.role.replace('_', ' ')}
                  {selectedUser.department && ` • Department: ${selectedUser.department}`}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Create Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 6 characters
                </p>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !selectedUser || !password}
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
