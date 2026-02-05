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
