'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Calendar, User, Clock, Camera, AlertCircle, Building } from 'lucide-react'
import { toast } from 'sonner'
import { TaskStatusSelect, TaskPriorityBadge } from '@/components/tasks/task-status-select'
import { FeatureGate } from '@/components/features/feature-gate'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import type { Task, TaskPhoto, Organization, User as UserType, FeatureConfig, TaskStatus } from '@/types/database'

interface TaskDetailClientProps {
  task: Task
  photos: TaskPhoto[]
  organization: Organization
  profile: UserType
  users: Array<{ id: string; name: string; email: string; department: string | null }>
}

export function TaskDetailClient({
  task,
  photos,
  organization,
  profile,
  users
}: TaskDetailClientProps) {
  const router = useRouter()
  const [currentStatus, setCurrentStatus] = useState<TaskStatus>(task.status as TaskStatus)

  // Get feature config
  const featureConfig = organization.feature_config as unknown as FeatureConfig
  const photoVerificationEnabled = featureConfig?.features?.photoVerification?.enabled

  // Check if task requires photo and doesn't have one
  const needsPhoto = photoVerificationEnabled && task.requires_photo && photos.length === 0

  // Get assigned user info
  const assignedUser = users.find(u => u.id === task.assigned_to)

  const handleStatusChange = async (newStatus: TaskStatus) => {
    // Block completion if photo is required but not uploaded
    if (newStatus === 'completed' && needsPhoto) {
      toast.error('Photo Required', {
        description: 'This task requires photo verification before it can be completed.'
      })
      return
    }

    const { error } = await updateTaskStatus(task.id, newStatus)

    if (error) {
      toast.error('Failed to update status', { description: error })
      return
    }

    setCurrentStatus(newStatus)
    toast.success('Status updated', {
      description: `Task marked as ${newStatus.replace('_', ' ')}`
    })
    router.refresh()
  }

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && currentStatus !== 'completed'

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/tasks">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tasks
        </Link>
      </Button>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Task Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Header Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-2xl">{task.title}</CardTitle>
                  {task.description && (
                    <CardDescription className="text-base">
                      {task.description}
                    </CardDescription>
                  )}
                </div>
                <TaskStatusSelect
                  value={currentStatus}
                  onValueChange={handleStatusChange}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <TaskPriorityBadge priority={task.priority as 'low' | 'medium' | 'high' | 'urgent'} />

                <FeatureGate feature="departments">
                  {task.department && (
                    <Badge variant="outline" className="gap-1">
                      <Building className="h-3 w-3" />
                      {task.department}
                    </Badge>
                  )}
                </FeatureGate>

                <FeatureGate feature="photoVerification">
                  {task.requires_photo && (
                    <Badge className={needsPhoto ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}>
                      <Camera className="h-3 w-3 mr-1" />
                      {needsPhoto ? 'Photo Required' : 'Photo Uploaded'}
                    </Badge>
                  )}
                </FeatureGate>
              </div>
            </CardContent>
          </Card>

          {/* Photo Verification Section - only for Portland Thorns */}
          <FeatureGate feature="photoVerification">
            {task.requires_photo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Photo Verification
                  </CardTitle>
                  <CardDescription>
                    {needsPhoto
                      ? 'This task requires photo documentation before completion'
                      : `${photos.length} photo(s) uploaded`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {needsPhoto ? (
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">
                        Photo upload will be available in Phase 5
                      </p>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
                        <AlertCircle className="h-4 w-4 inline mr-2" />
                        You cannot mark this task as completed until a photo is uploaded.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {photos.map(photo => (
                        <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.photo_url}
                            alt="Task verification photo"
                            className="object-cover w-full h-full"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2">
                            {formatRelativeTime(photo.uploaded_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </FeatureGate>
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          {/* Task Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Due Date */}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Due Date</p>
                  {task.due_date ? (
                    <p className={`text-sm ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {formatDate(task.due_date)}
                      {isOverdue && (
                        <span className="ml-2 text-red-600">
                          (Overdue)
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No due date set</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Assigned To */}
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Assigned To</p>
                  {assignedUser ? (
                    <div>
                      <p className="text-sm text-muted-foreground">{assignedUser.name}</p>
                      <p className="text-xs text-muted-foreground">{assignedUser.email}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Unassigned</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Created */}
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(task.created_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(task.created_at)}
                  </p>
                </div>
              </div>

              {task.completed_at && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Completed</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(task.completed_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(task.completed_at)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Completion Warning */}
          <FeatureGate feature="photoVerification">
            {needsPhoto && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Photo Required</p>
                      <p className="text-sm text-amber-700">
                        Upload a verification photo before marking this task as complete.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </FeatureGate>
        </div>
      </div>
    </div>
  )
}
