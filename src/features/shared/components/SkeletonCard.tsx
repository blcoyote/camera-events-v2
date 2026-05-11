export function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="event-card event-card-enter overflow-hidden"
      style={{ '--i': Math.min(index, 5) } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="skeleton-shimmer aspect-video" />
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="skeleton-shimmer h-4 w-24 rounded" />
          <div className="skeleton-shimmer h-3 w-14 rounded" />
        </div>
        <div className="skeleton-shimmer h-3 w-16 rounded" />
      </div>
    </div>
  )
}
