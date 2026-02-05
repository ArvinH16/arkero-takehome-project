# Executive Department Metrics Dashboard Implementation Plan

## Overview

Implement a dedicated metrics dashboard for LA Galaxy executives showing department-level rollup metrics including completion rates, task counts, and performance breakdown by department. This fulfills the requirement: *"Execs need rollup metrics by department"*.

## Current State Analysis

### What Exists:
- Dashboard groups tasks by department with inline counts (`dashboard-client.tsx:199-220`)
- `getTasksByDepartment()` server action returns grouped tasks but no metrics (`tasks.ts:327-349`)
- `getTaskStats()` returns org-wide stats only (`tasks.ts:79-108`)
- Feature gating pattern established for department feature
- Sidebar has feature-gated navigation (Audit Log example at `sidebar.tsx:56-69`)

### What's Missing:
- No per-department metrics calculation (completion rates, etc.)
- No dedicated metrics/rollup page for executives
- No navigation to metrics page

### Key Discoveries:
- Stats calculation pattern: fetch tasks, filter by status, count (`tasks.ts:97-105`)
- Feature gate redirect pattern: check config, redirect if disabled (`audit/page.tsx:33-40`)
- Loading skeleton pattern: match actual component structure (`loading.tsx`)

## Desired End State

A `/metrics` page accessible only to LA Galaxy users (departments feature enabled) showing:
1. **Summary section**: Organization-wide completion stats
2. **Department table**: Per-department breakdown with Total, Pending, In Progress, Completed, Completion Rate
3. **Visual indicators**: Color-coded completion rates for quick assessment

### Verification:
- LA Galaxy users see "Metrics" in sidebar and can access `/metrics`
- Portland Thorns users do NOT see "Metrics" link and are redirected if accessing `/metrics` directly
- Metrics accurately reflect task data per department

## What We're NOT Doing

- Adding charts/graphs (would require new dependencies like recharts)
- Adding time-based trend data (historical metrics)
- Adding drill-down to individual tasks from metrics
- Adding export functionality
- Adding real-time updates (standard page refresh is fine)

## Implementation Approach

Hybrid layout with summary cards + department table:
- Top: 4 summary cards showing org-wide stats (mirrors existing dashboard pattern)
- Below: Table showing per-department breakdown with completion percentages
- Feature-gated to `departments` feature only

---

## Phase 1: Server Action for Department Metrics

### Overview
Create a new server action that calculates per-department metrics including completion rates.

### Changes Required:

#### 1. Add Department Metrics Server Action
**File**: `src/lib/actions/tasks.ts`
**Changes**: Add new `getDepartmentMetrics()` function after `getTasksByDepartment()`

```typescript
export interface DepartmentMetrics {
  department: string
  total: number
  pending: number
  in_progress: number
  completed: number
  blocked: number
  completionRate: number // 0-100
}

export interface DepartmentMetricsResponse {
  departments: DepartmentMetrics[]
  summary: {
    total: number
    pending: number
    in_progress: number
    completed: number
    blocked: number
    completionRate: number
  }
  error: string | null
}

/**
 * Get metrics grouped by department for executive dashboard
 */
export async function getDepartmentMetrics(): Promise<DepartmentMetricsResponse> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tasks')
    .select('status, department')

  if (error) {
    console.error('Error fetching department metrics:', error)
    return {
      departments: [],
      summary: { total: 0, pending: 0, in_progress: 0, completed: 0, blocked: 0, completionRate: 0 },
      error: error.message
    }
  }

  const tasks = data || []

  // Group by department
  const deptMap: Record<string, { total: number; pending: number; in_progress: number; completed: number; blocked: number }> = {}

  tasks.forEach(task => {
    const dept = task.department || 'Unassigned'
    if (!deptMap[dept]) {
      deptMap[dept] = { total: 0, pending: 0, in_progress: 0, completed: 0, blocked: 0 }
    }
    deptMap[dept].total++
    if (task.status === 'pending') deptMap[dept].pending++
    else if (task.status === 'in_progress') deptMap[dept].in_progress++
    else if (task.status === 'completed') deptMap[dept].completed++
    else if (task.status === 'blocked') deptMap[dept].blocked++
  })

  // Calculate metrics per department
  const departments: DepartmentMetrics[] = Object.entries(deptMap)
    .map(([department, counts]) => ({
      department,
      ...counts,
      completionRate: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0
    }))
    .sort((a, b) => a.department.localeCompare(b.department))

  // Calculate org-wide summary
  const summary = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    completionRate: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0
  }

  return { departments, summary, error: null }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run build`
- [x] No linting errors: `npm run lint`

#### Manual Verification:
- [x] N/A for this phase (no UI yet)

**Implementation Note**: This phase is backend-only. Proceed to Phase 2 after automated verification passes.

---

## Phase 2: Metrics Page Implementation

### Overview
Create the `/metrics` route with server component for data fetching and client component for rendering.

### Changes Required:

#### 1. Create Metrics Server Page
**File**: `src/app/(dashboard)/metrics/page.tsx`
**Changes**: New file

```typescript
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
```

#### 2. Create Metrics Client Component
**File**: `src/app/(dashboard)/metrics/metrics-client.tsx`
**Changes**: New file

```typescript
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ListTodo, Clock, CheckCircle, AlertCircle, TrendingUp, BarChart3 } from 'lucide-react'
import type { DepartmentMetrics } from '@/lib/actions/tasks'

interface MetricsClientProps {
  departments: DepartmentMetrics[]
  summary: {
    total: number
    pending: number
    in_progress: number
    completed: number
    blocked: number
    completionRate: number
  }
  organizationName: string
}

function getCompletionRateColor(rate: number): string {
  if (rate >= 80) return 'text-green-600'
  if (rate >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

function getCompletionRateBadgeVariant(rate: number): 'default' | 'secondary' | 'destructive' {
  if (rate >= 80) return 'default'
  if (rate >= 50) return 'secondary'
  return 'destructive'
}

export function MetricsClient({ departments, summary, organizationName }: MetricsClientProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Department Metrics</h1>
        <p className="text-muted-foreground">
          Executive rollup view for {organizationName}
        </p>
      </div>

      {/* Organization Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">
              Across all departments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pending}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.in_progress}</div>
            <p className="text-xs text-muted-foreground">
              Being worked on
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.completed}</div>
            <p className="text-xs text-muted-foreground">
              Successfully finished
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className={`h-4 w-4 ${getCompletionRateColor(summary.completionRate)}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getCompletionRateColor(summary.completionRate)}`}>
              {summary.completionRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Organization-wide
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Department Breakdown</CardTitle>
          </div>
          <CardDescription>
            Task metrics by department for accountability tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Pending</TableHead>
                <TableHead className="text-center">In Progress</TableHead>
                <TableHead className="text-center">Completed</TableHead>
                <TableHead className="text-center">Blocked</TableHead>
                <TableHead className="text-center">Completion Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No department data available
                  </TableCell>
                </TableRow>
              ) : (
                departments.map((dept) => (
                  <TableRow key={dept.department}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{dept.department}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{dept.total}</TableCell>
                    <TableCell className="text-center">
                      {dept.pending > 0 ? (
                        <span className="text-slate-600">{dept.pending}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {dept.in_progress > 0 ? (
                        <span className="text-blue-600">{dept.in_progress}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {dept.completed > 0 ? (
                        <span className="text-green-600">{dept.completed}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {dept.blocked > 0 ? (
                        <span className="text-red-600">{dept.blocked}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getCompletionRateBadgeVariant(dept.completionRate)}>
                        {dept.completionRate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run build`
- [x] No linting errors: `npm run lint`
- [ ] Page loads without errors: navigate to `/metrics` as LA Galaxy user

#### Manual Verification:
- [ ] Summary cards display correct org-wide totals
- [ ] Department table shows all departments with correct counts
- [ ] Completion rate colors are correct (green >= 80%, yellow >= 50%, red < 50%)
- [ ] Accessing `/metrics` as Portland Thorns user redirects to `/`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Navigation Integration

### Overview
Add "Metrics" link to the sidebar, feature-gated to only show when departments feature is enabled.

### Changes Required:

#### 1. Update Sidebar with Metrics Link
**File**: `src/components/layout/sidebar.tsx`
**Changes**: Add metrics link after audit log section, feature-gated to departments

```typescript
// Add BarChart3 to imports at line 5
import { LayoutDashboard, CheckSquare, ClipboardList, Zap, BarChart3 } from 'lucide-react'

// Add after the FeatureGate for photoVerification (after line 69), before closing </nav>:
{/* Department Metrics - only visible when departments feature is enabled */}
<FeatureGate feature="departments">
  <Link
    href="/metrics"
    className={cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      pathname === '/metrics'
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    )}
  >
    <BarChart3 className="h-4 w-4" />
    Metrics
  </Link>
</FeatureGate>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run build`
- [x] No linting errors: `npm run lint`

#### Manual Verification:
- [ ] LA Galaxy users see "Metrics" link in sidebar
- [ ] Portland Thorns users do NOT see "Metrics" link
- [ ] Clicking "Metrics" link navigates to metrics page
- [ ] "Metrics" link shows active state when on `/metrics` page

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Loading & Error States

### Overview
Add loading skeleton and error boundary for the metrics page.

### Changes Required:

#### 1. Create Loading Skeleton
**File**: `src/app/(dashboard)/metrics/loading.tsx`
**Changes**: New file

```typescript
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function MetricsLoading() {
  return (
    <div className="space-y-6">
      {/* Page Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Summary Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Table header */}
            <div className="flex gap-4 pb-2 border-b">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} className="h-4 w-20" />
              ))}
            </div>
            {/* Table rows */}
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex gap-4 py-2">
                {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                  <Skeleton key={col} className="h-4 w-16" />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### 2. Create Error Boundary
**File**: `src/app/(dashboard)/metrics/error.tsx`
**Changes**: New file

```typescript
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function MetricsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Metrics error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
          <CardTitle>Failed to Load Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            There was a problem loading the department metrics. Please try again.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-xs font-mono text-red-600 break-all">
                {error.message}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={reset} className="w-full">
              Try Again
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/">Go to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run build`
- [x] No linting errors: `npm run lint`

#### Manual Verification:
- [ ] Loading skeleton appears briefly when navigating to `/metrics`
- [ ] Error boundary displays if metrics fetch fails (can test by temporarily breaking the server action)

**Implementation Note**: After completing this phase, the feature is complete. Run full verification.

---

## Testing Strategy

### Unit Tests:
- `getDepartmentMetrics()` returns correct structure
- Completion rate calculation is accurate (edge cases: 0 tasks, all completed, none completed)
- Department grouping handles null departments as "Unassigned"

### Integration Tests:
- LA Galaxy user can access `/metrics`
- Portland Thorns user is redirected from `/metrics`
- Metrics data matches actual task counts in database

### Manual Testing Steps:
1. Log in as LA Galaxy admin (admin@lagalaxy.com)
2. Verify "Metrics" link appears in sidebar
3. Click "Metrics" and verify page loads
4. Verify summary cards show correct totals (cross-check with Tasks page)
5. Verify department table has all 8 LA Galaxy departments
6. Verify completion rates are color-coded correctly
7. Log out and log in as Portland Thorns user
8. Verify "Metrics" link does NOT appear in sidebar
9. Try navigating directly to `/metrics` - should redirect to `/`

## Performance Considerations

- `getDepartmentMetrics()` fetches only `status` and `department` columns (not full task objects)
- Single database query for all metrics (no N+1 queries)
- No additional dependencies added (uses existing shadcn components)

## Migration Notes

No database migrations required - this feature uses existing task data.

## References

- Current dashboard implementation: `src/app/(dashboard)/dashboard-client.tsx`
- Feature gating pattern: `src/app/(dashboard)/audit/page.tsx:33-40`
- Stats card pattern: `src/app/(dashboard)/dashboard-client.tsx:100-153`
- Existing grouping logic: `src/lib/actions/tasks.ts:327-349`
- Sidebar navigation: `src/components/layout/sidebar.tsx`
