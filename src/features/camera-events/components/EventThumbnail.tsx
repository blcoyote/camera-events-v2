import { useState } from 'react'

export function EventThumbnail({ eventId }: { eventId: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex aspect-video items-center justify-center bg-(--surface) text-(--sea-ink-soft)">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="opacity-40"
        >
          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14" />
          <rect x="1" y="6" width="14" height="12" rx="2" ry="2" />
        </svg>
      </div>
    )
  }

  return (
    <img
      src={`/api/events/${eventId}/thumbnail`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  )
}
