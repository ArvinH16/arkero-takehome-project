'use client'

import Link from 'next/link'
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
import { ClipboardList, Camera, CheckCircle, Trash2, FileEdit, Plus, ExternalLink } from 'lucide-react'
import { formatDate, formatRelativeTime } from '@/lib/utils'

interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown> | null
  created_at: string | null
  user: { id: string; name: string; email: string } | null
}

interface AuditLogClientProps {
  entries: AuditEntry[]
}

// Action badge styling
function getActionBadge(action: string) {
  const actionMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
    photo_uploaded: { label: 'Photo Uploaded', variant: 'default', icon: Camera },
    photo_deleted: { label: 'Photo Deleted', variant: 'destructive', icon: Trash2 },
    task_completed: { label: 'Task Completed', variant: 'default', icon: CheckCircle },
    task_created: { label: 'Task Created', variant: 'secondary', icon: Plus },
    task_updated: { label: 'Task Updated', variant: 'outline', icon: FileEdit },
  }

  const config = actionMap[action] || { label: action.replace(/_/g, ' '), variant: 'outline' as const, icon: FileEdit }
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

// Entity type display
function getEntityDisplay(type: string, id: string, metadata: Record<string, unknown> | null) {
  switch (type) {
    case 'task_photo':
      const taskId = metadata?.task_id as string
      return taskId ? (
        <Link
          href={`/tasks/${taskId}`}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Photo
          <ExternalLink className="h-3 w-3" />
        </Link>
      ) : 'Photo'
    case 'task':
      return (
        <Link
          href={`/tasks/${id}`}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Task
          <ExternalLink className="h-3 w-3" />
        </Link>
      )
    default:
      return type.replace(/_/g, ' ')
  }
}

export function AuditLogClient({ entries }: AuditLogClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Track all activities related to photo verification and task completion.
        </p>
      </div>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Activity History
          </CardTitle>
          <CardDescription>
            Showing the most recent {entries.length} activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No activities recorded yet.</p>
              <p className="text-sm text-muted-foreground">
                Activities will appear here when photos are uploaded or tasks are completed.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Time</TableHead>
                    <TableHead className="w-[200px]">User</TableHead>
                    <TableHead className="w-[180px]">Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm">{entry.created_at ? formatDate(entry.created_at) : '-'}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.created_at ? formatRelativeTime(entry.created_at) : ''}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.user ? (
                          <div>
                            <p className="font-medium text-sm">{entry.user.name}</p>
                            <p className="text-xs text-muted-foreground">{entry.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">System</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getActionBadge(entry.action)}
                      </TableCell>
                      <TableCell>
                        {getEntityDisplay(entry.entity_type, entry.entity_id, entry.metadata)}
                      </TableCell>
                      <TableCell>
                        {entry.metadata && (
                          <div className="text-sm text-muted-foreground">
                            {typeof entry.metadata.filename === 'string' && (
                              <span>File: {entry.metadata.filename}</span>
                            )}
                            {typeof entry.metadata.status === 'string' && (
                              <span>Status: {entry.metadata.status}</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
