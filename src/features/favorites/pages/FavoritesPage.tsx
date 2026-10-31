import { Link } from '@tanstack/react-router'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { EventCard } from '#/features/shared/components/EventCard'
import { Button } from '#/features/shared/components/ui/button'
import { PageHeader } from '#/features/shared/components/PageHeader'

export function FavoritesPage({ events }: { events: FrigateEvent[] }) {
  if (events.length === 0) {
    return (
      <main id="main-content" className="page-wrap px-4 pb-8 pt-3 sm:pt-14">
        <PageHeader eyebrow="Favorites" title="Your Favorites" />
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-foreground">
            No favorites yet
          </p>
          <p className="mt-1 text-sm text-fg-2">
            Tap the heart on any event to save it here
          </p>
          <Button asChild className="mt-4">
            <Link to="/camera-events">Browse events</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-3 sm:pt-14">
      <PageHeader eyebrow="Favorites" title="Your Favorites" />
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
