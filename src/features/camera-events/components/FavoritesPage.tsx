import { Link } from '@tanstack/react-router'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { EventCard } from './EventCard'

export function FavoritesPage({ events }: { events: FrigateEvent[] }) {
  if (events.length === 0) {
    return (
      <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
        <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
          <p className="island-kicker mb-1">Favorites</p>
          <h1 className="display-title mb-0 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
            Your Favorites
          </h1>
        </section>
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-(--sea-ink)">
            No favorites yet
          </p>
          <p className="mt-1 text-sm text-(--sea-ink-soft)">
            Tap the heart on any event to save it here
          </p>
          <Link
            to="/camera-events"
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-(--lagoon) px-5 py-2 text-sm font-medium text-white hover:bg-(--lagoon-deep)"
          >
            Browse events
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <p className="island-kicker mb-1">Favorites</p>
        <h1 className="display-title mb-0 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
          Your Favorites
        </h1>
      </section>
      <section
        aria-label="Favorited events"
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {events.map((event, i) => (
          <EventCard
            key={event.id}
            event={event}
            index={i}
            initialFavorited={true}
          />
        ))}
      </section>
    </main>
  )
}
