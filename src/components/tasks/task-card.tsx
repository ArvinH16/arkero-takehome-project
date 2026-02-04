'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Camera, Clock, AlertCircle } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { FeatureGate } from '@/components/features/feature-gate'
import type { Task, TaskStatus, TaskPriority } from '@/types/database'

interface TaskCardProps {
  task: Task
  showDepartment?: boolean
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-slate-100 text-slate-700'
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-700'
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-700'
  },
  blocked: {
    label: 'Blocked',
    className: 'bg-red-100 text-red-700'
  }
}

const priorityConfig: Record<TaskPriority, { label: string; className: string }> = {
  low: {
    label: 'Low',
    className: 'bg-slate-100 text-slate-600'
  },
  medium: {
    label: 'Medium',
    className: 'bg-yellow-100 text-yellow-700'
  },
  high: {
    label: 'High',
    className: 'bg-orange-100 text-orange-700'
  },
  urgent: {
    label: 'Urgent',
    className: 'bg-red-100 text-red-700'
  }
}

export function TaskCard({ task, showDepartment = true }: TaskCardProps) {
  const status = statusConfig[task.status as TaskStatus] || statusConfig.pending
  const priority = priorityConfig[task.priority as TaskPriority] || priorityConfig.medium

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'

  return (
    <Link href={`/tasks/${task.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base font-medium line-clamp-2">
              {task.title}
            </CardTitle>
            <div className="flex items-center gap-1 shrink-0">
              {/* Photo Required Badge - only for Portland Thorns */}
              <FeatureGate feature="photoVerification">
                {task.requires_photo && (
                  <Badge className="bg-amber-100 text-amber-700 gap-1">
                    <Camera className="h-3 w-3" />
                    Photo
                  </Badge>
                )}
              </FeatureGate>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Description */}
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Badges Row */}
          <div className="flex flex-wrap gap-1.5">
            {/* Status Badge */}
            <Badge className={cn('text-xs', status.className)}>
              {status.label}
            </Badge>

            {/* Priority Badge */}
            <Badge className={cn('text-xs', priority.className)}>
              {priority.label}
            </Badge>

            {/* Department Badge - only for LA Galaxy */}
            <FeatureGate feature="departments">
              {showDepartment && task.department && (
                <Badge variant="outline" className="text-xs">
                  {task.department}
                </Badge>
              )}
            </FeatureGate>
          </div>

          {/* Due Date */}
          {task.due_date && (
            <div className={cn(
              'flex items-center gap-1 text-xs',
              isOverdue ? 'text-red-600' : 'text-muted-foreground'
            )}>
              {isOverdue ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              <span>
                {isOverdue ? 'Overdue: ' : 'Due '}
                {formatRelativeTime(task.due_date)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

/**
 * Compact version for lists
 */
export function TaskCardCompact({ task }: { task: Task }) {
  const status = statusConfig[task.status as TaskStatus] || statusConfig.pending
  const priority = priorityConfig[task.priority as TaskPriority] || priorityConfig.medium

  return (
    <Link href={`/tasks/${task.id}`}>
      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="font-medium truncate">{task.title}</p>
            {task.description && (
              <p className="text-sm text-muted-foreground truncate">
                {task.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <FeatureGate feature="photoVerification">
            {task.requires_photo && (
              <Camera className="h-4 w-4 text-amber-600" />
            )}
          </FeatureGate>
          <Badge className={cn('text-xs', status.className)}>
            {status.label}
          </Badge>
          <Badge className={cn('text-xs', priority.className)}>
            {priority.label}
          </Badge>
        </div>
      </div>
    </Link>
  )
}
