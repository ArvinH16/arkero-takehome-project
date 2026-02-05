'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, ListTodo, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { TaskCard } from '@/components/tasks/task-card'
import { DepartmentFilter } from '@/components/tasks/department-filter'
import { FeatureGate } from '@/components/features/feature-gate'
import type { Task, Organization, User, FeatureConfig } from '@/types/database'

interface DashboardClientProps {
  organization: Organization
  profile: User
  tasks: Task[]
  stats: {
    total: number
    pending: number
    in_progress: number
    completed: number
  }
}

export function DashboardClient({ organization, profile, tasks, stats }: DashboardClientProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)

  // Filter tasks by department if selected
  const filteredTasks = selectedDepartment
    ? tasks.filter(t => t.department === selectedDepartment)
    : tasks

  // Get feature config
  const featureConfig = organization.feature_config as unknown as FeatureConfig
  const departmentsEnabled = featureConfig?.features?.departments?.enabled
  const photoVerificationEnabled = featureConfig?.features?.photoVerification?.enabled

  // Group tasks by department if feature is enabled
  const groupedTasks = departmentsEnabled
    ? filteredTasks.reduce((acc, task) => {
        const dept = task.department || 'Unassigned'
        if (!acc[dept]) acc[dept] = []
        acc[dept].push(task)
        return acc
      }, {} as Record<string, Task[]>)
    : { 'All Tasks': filteredTasks }

  // Get recent tasks (not completed, limited to 6)
  const recentTasks = filteredTasks
    .filter(t => t.status !== 'completed')
    .slice(0, 6)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {profile?.name || 'User'}
          </p>
        </div>
        <Button asChild>
          <Link href="/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Link>
        </Button>
      </div>

      {/* Organization Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{organization?.name}</CardTitle>
          <CardDescription>
            Your current organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{organization?.slug}</Badge>

            {/* Feature badges */}
            {departmentsEnabled && (
              <Badge className="bg-blue-100 text-blue-800">
                Departments Enabled
              </Badge>
            )}

            {photoVerificationEnabled && (
              <Badge className="bg-amber-100 text-amber-800">
                Photo Verification Enabled
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              All tasks in your organization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
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
            <div className="text-2xl font-bold">{stats.in_progress}</div>
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
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              Successfully finished
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department Filter - only for LA Galaxy */}
      <FeatureGate feature="departments">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filter by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <DepartmentFilter
              selectedDepartment={selectedDepartment}
              onSelectDepartment={setSelectedDepartment}
            />
          </CardContent>
        </Card>
      </FeatureGate>

      {/* Tasks Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Active Tasks</h2>
          <Button variant="outline" asChild>
            <Link href="/tasks">View All</Link>
          </Button>
        </div>

        {recentTasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No active tasks</h3>
              <p className="text-muted-foreground text-center mb-4">
                {selectedDepartment
                  ? `No tasks in ${selectedDepartment} department`
                  : 'Get started by creating your first task'}
              </p>
              <Button asChild>
                <Link href="/tasks/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : departmentsEnabled ? (
          // Grouped view for LA Galaxy
          <div className="space-y-6">
            {Object.entries(groupedTasks)
              .filter(([, tasks]) => tasks.some(t => t.status !== 'completed'))
              .map(([department, deptTasks]) => (
                <div key={department}>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Badge variant="outline">{department}</Badge>
                    <span className="text-sm text-muted-foreground">
                      ({deptTasks.filter(t => t.status !== 'completed').length} active)
                    </span>
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {deptTasks
                      .filter(t => t.status !== 'completed')
                      .slice(0, 3)
                      .map(task => (
                        <TaskCard key={task.id} task={task} showDepartment={false} />
                      ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          // Flat view for Portland Thorns
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
