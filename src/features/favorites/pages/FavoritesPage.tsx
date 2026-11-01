import { m } from '#/paraglide/messages.js'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { FavoriteEntry } from '#/features/shared/server/favorites/types'
import { EventCard } from '#/features/shared/components/EventCard'
import { FilterPill } from '#/features/shared/components/FilterPill'
import { Button } from '#/features/shared/components/ui/button'
import { PageHeader } from '#/features/shared/components/PageHeader'

export function FavoritesPage({ entries }: { entries: FavoriteEntry[] }) {
  const [filter, setFilter] = useState<'all' | 'favorites' | 'shared'>('all')
  if (entries.length === 0) {
    return (
      <main id="main-content" className="page-wrap px-4 pb-8 pt-3 sm:pt-14">
        <PageHeader
          eyebrow={m.shell_tab_favorites()}
          title={m.favorites_page_title()}
        />
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-foreground">
            {m.favorites_empty_title()}
          </p>
          <p className="mt-1 text-sm text-fg-2">{m.favorites_empty_hint()}</p>
          <Button asChild className="mt-4">
            <Link to="/camera-events">{m.favorites_browse()}</Link>
          </Button>
        </div>
      </main>
    )
  }

  const favs = entries.filter((e) => e.favorited)
  const shared = entries.filter((e) => e.sharedBy.length > 0)
  const pills = [
    ['all', m.favorites_filter_all(), entries],
    ['favorites', m.favorites_filter_favorites(), favs],
    ['shared', m.favorites_filter_shared(), shared],
  ] as const
  const visible = pills.find(([key]) => key === filter)![2]

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-3 sm:pt-14">
      <PageHeader
        eyebrow={m.shell_tab_favorites()}
        title={m.favorites_page_title()}
      />
      <div
        role="group"
        aria-label={m.favorites_filter_label()}
        className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {pills.map(([key, label, list]) => (
          <FilterPill
            key={key}
            label={label}
            active={filter === key}
            onClick={() => setFilter(key)}
            count={list.length}
          />
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-fg-2">
          {filter === 'shared'
            ? m.favorites_filter_empty_shared()
            : m.favorites_filter_empty_favorites()}
        </p>
      ) : (
        <section
          aria-label={m.favorites_grid_label()}
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visible.map((entry, i) => (
            <EventCard
              key={entry.event.id}
              event={entry.event}
              index={i}
              initialFavorited={entry.favorited}
              sharedBy={entry.sharedBy}
            />
          ))}
        </section>
      )}
    </main>
  )
}
