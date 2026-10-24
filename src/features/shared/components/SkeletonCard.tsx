import { Skeleton } from '#/features/shared/components/ui/skeleton'

export function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="event-card event-card-enter glass rounded-card overflow-hidden"
      style={{ '--i': Math.min(index, 5) } as React.CSSProperties}
      aria-hidden="true"
    >
      <Skeleton className="aspect-video" />
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-3 w-14 rounded" />
        </div>
        <Skeleton className="h-3 w-16 rounded" />
      </div>
    </div>
  )
}
