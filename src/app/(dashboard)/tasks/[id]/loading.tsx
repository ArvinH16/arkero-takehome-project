import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

export default function TaskDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back Button Skeleton */}
      <Skeleton className="h-10 w-32" />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Task Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Header Card Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-10 w-32" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-28" />
              </div>
            </CardContent>
          </Card>

          {/* Photo Section Skeleton (conditional) */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload Area Skeleton */}
              <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center">
                <Skeleton className="h-12 w-12 rounded-full mb-4" />
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>

              {/* Gallery Skeleton */}
              <Separator />
              <div>
                <Skeleton className="h-5 w-32 mb-3" />
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-28" />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Due Date Skeleton */}
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>

              <Separator />

              {/* Assigned To Skeleton */}
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>

              <Separator />

              {/* Created Skeleton */}
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
