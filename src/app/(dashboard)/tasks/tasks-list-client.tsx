'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, ListTodo, X } from 'lucide-react'
import { TaskCard, TaskCardCompact } from '@/components/tasks/task-card'
import { DepartmentFilter } from '@/components/tasks/department-filter'
import { FeatureGate } from '@/components/features/feature-gate'
import type { Task, Organization, FeatureConfig, TaskStatus, TaskPriority } from '@/types/database'

interface TasksListClientProps {
  tasks: Task[]
  organization: Organization
}

export function TasksListClient({ tasks, organization }: TasksListClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Get feature config
  const featureConfig = organization.feature_config as unknown as FeatureConfig
  const departmentsEnabled = featureConfig?.features?.departments?.enabled

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = task.title.toLowerCase().includes(query)
        const matchesDescription = task.description?.toLowerCase().includes(query)
        if (!matchesTitle && !matchesDescription) return false
      }

      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) return false

      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false

      // Department filter
      if (selectedDepartment && task.department !== selectedDepartment) return false

      return true
    })
  }, [tasks, searchQuery, statusFilter, priorityFilter, selectedDepartment])

  // Group by department if enabled
  const groupedTasks = useMemo(() => {
    if (!departmentsEnabled) return null

    return filteredTasks.reduce((acc, task) => {
      const dept = task.department || 'Unassigned'
      if (!acc[dept]) acc[dept] = []
      acc[dept].push(task)
      return acc
    }, {} as Record<string, Task[]>)
  }, [filteredTasks, departmentsEnabled])

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || selectedDepartment

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setPriorityFilter('all')
    setSelectedDepartment(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            Manage all tasks for {organization.name}
          </p>
        </div>
        <Button asChild>
          <Link href="/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search and Basic Filters */}
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as TaskStatus | 'all')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select
              value={priorityFilter}
              onValueChange={(v) => setPriorityFilter(v as TaskPriority | 'all')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                List
              </Button>
            </div>
          </div>

          {/* Department Filter - only for LA Galaxy */}
          <FeatureGate feature="departments">
            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-2">Department</p>
              <DepartmentFilter
                selectedDepartment={selectedDepartment}
                onSelectDepartment={setSelectedDepartment}
              />
            </div>
          </FeatureGate>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary">
                  Search: {searchQuery}
                </Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant="secondary">
                  Status: {statusFilter}
                </Badge>
              )}
              {priorityFilter !== 'all' && (
                <Badge variant="secondary">
                  Priority: {priorityFilter}
                </Badge>
              )}
              {selectedDepartment && (
                <Badge variant="secondary">
                  Dept: {selectedDepartment}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </p>
      </div>

      {/* Tasks */}
      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tasks found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Get started by creating your first task'}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            ) : (
              <Button asChild>
                <Link href="/tasks/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : groupedTasks ? (
        // Grouped view for LA Galaxy
        <div className="space-y-8">
          {Object.entries(groupedTasks).map(([department, deptTasks]) => (
            <div key={department}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  {department}
                </Badge>
                <span className="text-sm text-muted-foreground font-normal">
                  ({deptTasks.length} tasks)
                </span>
              </h2>
              {viewMode === 'grid' ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {deptTasks.map(task => (
                    <TaskCard key={task.id} task={task} showDepartment={false} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {deptTasks.map(task => (
                    <TaskCardCompact key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Flat view for Portland Thorns
        viewMode === 'grid' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <TaskCardCompact key={task.id} task={task} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
