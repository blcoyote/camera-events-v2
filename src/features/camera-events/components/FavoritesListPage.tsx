import { useMemo } from 'react'
import { EventCard } from './EventCard'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

export function FavoritesListPage({
  events,
  favoriteEventIds,
}: {
  events: FrigateEvent[]
  favoriteEventIds: string[]
}) {
  const favoriteIdSet = useMemo(
    () => new Set(favoriteEventIds),
    [favoriteEventIds],
  )

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-1">Camera Events</p>
        <h1 className="display-title mb-0 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
          Favorites
        </h1>
      </section>

      {events.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-(--sea-ink)">
            No favorited events yet.
          </p>
          <p className="mt-1 text-sm text-(--sea-ink-soft)">
            Tap the heart on any event to save it here.
          </p>
        </div>
      ) : (
        <section
          aria-label="Favorited events"
          className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {events.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              index={i}
              isFavorited={favoriteIdSet.has(event.id)}
            />
          ))}
        </section>
      )}
    </main>
  )
}
