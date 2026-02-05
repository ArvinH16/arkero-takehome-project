'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function TaskDetailError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Task detail error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle>Failed to load task</CardTitle>
          <CardDescription>
            We couldn&apos;t fetch this task&apos;s details. It may have been deleted or you may not have access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="p-3 bg-muted rounded-md text-xs font-mono overflow-auto max-h-32">
              {error.message}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/tasks">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Tasks
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
