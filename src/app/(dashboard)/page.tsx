'use client'

import { useOrg } from '@/lib/context/org-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FeatureGate } from '@/components/features/feature-gate'
import { useDepartmentList } from '@/lib/features/hooks'

export default function DashboardPage() {
  const { organization, user, isLoading } = useOrg()
  const departments = useDepartmentList()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name || 'User'}
        </p>
      </div>

      {/* Organization Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Organization</CardTitle>
          <CardDescription>
            You are viewing data for {organization?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{organization?.slug}</Badge>

            {/* Feature badges */}
            <FeatureGate feature="departments">
              <Badge className="bg-blue-100 text-blue-800">
                Departments Enabled
              </Badge>
            </FeatureGate>

            <FeatureGate feature="photoVerification">
              <Badge className="bg-amber-100 text-amber-800">
                Photo Verification Enabled
              </Badge>
            </FeatureGate>
          </div>
        </CardContent>
      </Card>

      {/* Department List (only visible for LA Galaxy with departments feature) */}
      <FeatureGate feature="departments">
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>
              Available departments in your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {departments.map((dept) => (
                <Badge key={dept} variant="secondary">
                  {dept}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </FeatureGate>

      {/* Photo Verification Info (only visible for Portland Thorns) */}
      <FeatureGate feature="photoVerification">
        <Card>
          <CardHeader>
            <CardTitle>Photo Verification</CardTitle>
            <CardDescription>
              Tasks requiring photo documentation before completion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Certain tasks in your organization require photo verification
              before they can be marked as complete. Look for the camera icon
              on task cards.
            </p>
          </CardContent>
        </Card>
      </FeatureGate>

      {/* Placeholder for stats - will be implemented in Phase 4 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tasks</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Task counts coming in Phase 4
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Progress</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Being worked on</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Done today</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
