import { MediaCard } from '#/features/shared/components/MediaCard'
import { useLiveSnapshot } from '#/features/live-view/hooks/useLiveSnapshot'

export function LiveSnapshot({ cameraName }: { cameraName: string }) {
  const src = useLiveSnapshot(cameraName)

  return (
    <MediaCard
      scanLines={false}
      aria-label={`Live snapshot from ${cameraName}`}
      image={
        <img
          src={src}
          alt={`Live snapshot from ${cameraName}`}
          className="h-full w-full object-cover"
        />
      }
    >
      <div className="flex items-center gap-2">
        <span
          className="live-pulse h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
          aria-hidden="true"
        />
        <span className="text-sm font-semibold text-(--sea-ink)">Live</span>
      </div>
    </MediaCard>
  )
}
