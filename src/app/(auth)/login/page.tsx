'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { getOrganizations, getSignedUpUsers } from '@/lib/actions/auth'

interface Organization {
  id: string
  name: string
  slug: string
}

interface SignedUpUser {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  org_id: string
}

function LoginPageContent() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [signedUpUsers, setSignedUpUsers] = useState<SignedUpUser[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Show error message if redirected due to missing profile
  useEffect(() => {
    const error = searchParams.get('error')
    if (error === 'no_profile') {
      toast.error('Your account is not properly set up. Please sign up again or contact support.')
    }
  }, [searchParams])

  // Load organizations on mount
  useEffect(() => {
    const loadOrganizations = async () => {
      const { data, error } = await getOrganizations()

      if (error || !data) {
        toast.error('Failed to load organizations')
        return
      }

      setOrganizations(data)
      setIsLoadingOrgs(false)
    }

    loadOrganizations()
  }, [])

  // Load signed-up users when org changes
  useEffect(() => {
    if (!selectedOrgId) {
      setSignedUpUsers([])
      setSelectedUserId('')
      return
    }

    const loadUsers = async () => {
      setIsLoadingUsers(true)
      const { data, error } = await getSignedUpUsers(selectedOrgId)

      if (error || !data) {
        toast.error('Failed to load users')
        setIsLoadingUsers(false)
        return
      }

      setSignedUpUsers(data)
      setSelectedUserId('')
      setIsLoadingUsers(false)
    }

    loadUsers()
  }, [selectedOrgId])

  const selectedUser = signedUpUsers.find(u => u.id === selectedUserId)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUser) {
      toast.error('Please select a user account')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: selectedUser.email,
        password,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Logged in successfully')
      router.push('/')
      router.refresh()
    } catch {
      toast.error('An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          Select your organization and user to sign in
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
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
              {isLoadingUsers ? (
                <p className="text-sm text-muted-foreground py-2">Loading users...</p>
              ) : signedUpUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No users have signed up for this organization yet.{' '}
                  <Link href="/signup" className="text-primary hover:underline">
                    Sign up first
                  </Link>
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
                    {signedUpUsers.map((user) => (
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
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
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Card>
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
