const INDICATOR_SIZE = 36

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  isComplete,
  threshold,
}: {
  pullDistance: number
  isRefreshing: boolean
  isComplete: boolean
  threshold: number
}) {
  const isIdle = pullDistance === 0 && !isRefreshing && !isComplete
  const pastThreshold = pullDistance >= threshold
  const progress = Math.min(pullDistance / threshold, 1)

  if (isIdle) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none flex justify-center"
      style={{
        height: isRefreshing || isComplete ? threshold * 0.6 : pullDistance,
        transition:
          isRefreshing || pullDistance === 0
            ? 'height 200ms ease-out'
            : undefined,
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center justify-center rounded-full border border-(--line) bg-(--surface-strong)"
        style={{
          width: INDICATOR_SIZE,
          height: INDICATOR_SIZE,
          marginTop: Math.max(
            0,
            (isRefreshing || isComplete ? threshold * 0.6 : pullDistance) -
              INDICATOR_SIZE -
              4,
          ),
          opacity: isRefreshing || isComplete ? 1 : progress,
        }}
      >
        {isRefreshing ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="animate-spin text-(--lagoon-deep)"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : isComplete ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-(--palm)"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-(--sea-ink-soft)"
            style={{
              transform: pastThreshold ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms ease',
            }}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        )}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {isRefreshing ? 'Refreshing…' : isComplete ? 'Refreshed' : ''}
      </span>
    </div>
  )
}
