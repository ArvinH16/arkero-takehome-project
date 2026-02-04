'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { TaskStatus } from '@/types/database'

interface TaskStatusSelectProps {
  value: TaskStatus
  onValueChange: (status: TaskStatus) => Promise<void> | void
  disabled?: boolean
  /** If true, shows a confirmation dialog before changing to 'completed' */
  confirmCompletion?: boolean
}

const statusConfig: Record<TaskStatus, { label: string; className: string; description: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-slate-100 text-slate-700',
    description: 'Task has not been started'
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-700',
    description: 'Task is being worked on'
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-700',
    description: 'Task has been finished'
  },
  blocked: {
    label: 'Blocked',
    className: 'bg-red-100 text-red-700',
    description: 'Task cannot proceed'
  }
}

const statuses: TaskStatus[] = ['pending', 'in_progress', 'completed', 'blocked']

export function TaskStatusSelect({
  value,
  onValueChange,
  disabled = false,
}: TaskStatusSelectProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleChange = async (newStatus: TaskStatus) => {
    if (newStatus === value) return

    setIsUpdating(true)
    try {
      await onValueChange(newStatus)
    } finally {
      setIsUpdating(false)
    }
  }

  const currentStatus = statusConfig[value] || statusConfig.pending

  return (
    <Select
      value={value}
      onValueChange={(v) => handleChange(v as TaskStatus)}
      disabled={disabled || isUpdating}
    >
      <SelectTrigger className="w-[180px]">
        {isUpdating ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Updating...</span>
          </div>
        ) : (
          <SelectValue>
            <Badge className={cn('text-xs', currentStatus.className)}>
              {currentStatus.label}
            </Badge>
          </SelectValue>
        )}
      </SelectTrigger>
      <SelectContent>
        {statuses.map((status) => {
          const config = statusConfig[status]
          return (
            <SelectItem key={status} value={status}>
              <div className="flex items-center gap-2">
                <Badge className={cn('text-xs', config.className)}>
                  {config.label}
                </Badge>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

/**
 * Static status badge (non-interactive)
 */
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const config = statusConfig[status] || statusConfig.pending
  return (
    <Badge className={cn('text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}

/**
 * Priority select component
 */
import type { TaskPriority } from '@/types/database'

interface TaskPrioritySelectProps {
  value: TaskPriority
  onValueChange: (priority: TaskPriority) => void
  disabled?: boolean
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

const priorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

export function TaskPrioritySelect({ value, onValueChange, disabled = false }: TaskPrioritySelectProps) {
  const currentPriority = priorityConfig[value] || priorityConfig.medium

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as TaskPriority)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[140px]">
        <SelectValue>
          <Badge className={cn('text-xs', currentPriority.className)}>
            {currentPriority.label}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {priorities.map((priority) => {
          const config = priorityConfig[priority]
          return (
            <SelectItem key={priority} value={priority}>
              <div className="flex items-center gap-2">
                <Badge className={cn('text-xs', config.className)}>
                  {config.label}
                </Badge>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

/**
 * Static priority badge (non-interactive)
 */
export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = priorityConfig[priority] || priorityConfig.medium
  return (
    <Badge className={cn('text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}
