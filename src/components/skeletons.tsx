import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function StatusSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  )
}

export function TimelineSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function MapSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[55svh] w-full rounded-md" />
      </CardContent>
    </Card>
  )
}
