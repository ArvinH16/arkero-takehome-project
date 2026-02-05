'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FeatureGate } from '@/components/features/feature-gate'
import { DepartmentSelect } from '@/components/tasks/department-filter'
import { createTask } from '@/lib/actions/tasks'
import type { Organization, FeatureConfig, TaskPriority } from '@/types/database'

interface NewTaskFormProps {
  organization: Organization
  users: Array<{ id: string; name: string; email: string; department: string | null }>
}

export function NewTaskForm({ organization, users }: NewTaskFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [department, setDepartment] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [requiresPhoto, setRequiresPhoto] = useState(false)

  // Get feature config
  const featureConfig = organization.feature_config as unknown as FeatureConfig
  const departmentsEnabled = featureConfig?.features?.departments?.enabled
  const departmentsRequired = featureConfig?.features?.departments?.required

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate department if required
    if (departmentsEnabled && departmentsRequired && !department) {
      toast.error('Department Required', {
        description: 'Please select a department for this task.'
      })
      return
    }

    setIsSubmitting(true)

    try {
      const { task, error } = await createTask({
        title,
        description: description || undefined,
        priority,
        department: department || undefined,
        due_date: dueDate || undefined,
        assigned_to: assignedTo || undefined,
        requires_photo: requiresPhoto
      })

      if (error) {
        toast.error('Failed to create task', { description: error })
        return
      }

      toast.success('Task created', {
        description: 'Your new task has been created successfully.'
      })

      router.push(`/tasks/${task?.id}`)
    } catch {
      toast.error('An error occurred', {
        description: 'Please try again.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/tasks">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tasks
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create New Task</CardTitle>
          <CardDescription>
            Add a new task for {organization.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter task description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department - only for LA Galaxy */}
            <FeatureGate feature="departments">
              <div className="space-y-2">
                <Label>
                  Department {departmentsRequired && '*'}
                </Label>
                <DepartmentSelect
                  value={department}
                  onChange={setDepartment}
                  required={departmentsRequired}
                />
                {departmentsRequired && (
                  <p className="text-xs text-muted-foreground">
                    Department is required for all tasks in your organization.
                  </p>
                )}
              </div>
            </FeatureGate>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Assigned To */}
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={assignedTo || 'unassigned'} onValueChange={(v) => setAssignedTo(v === 'unassigned' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Photo Requirement - only for Portland Thorns */}
            <FeatureGate feature="photoVerification">
              <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/50">
                <Checkbox
                  id="requiresPhoto"
                  checked={requiresPhoto}
                  onCheckedChange={(checked) => setRequiresPhoto(checked === true)}
                />
                <div>
                  <Label htmlFor="requiresPhoto" className="cursor-pointer">
                    Require photo verification
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Task cannot be completed without uploading a photo
                  </p>
                </div>
              </div>
            </FeatureGate>

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Creating...' : 'Create Task'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/tasks">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
