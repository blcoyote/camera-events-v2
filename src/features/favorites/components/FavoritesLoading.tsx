import { SkeletonCard } from '#/features/shared/components/SkeletonCard'

export function FavoritesLoading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      className="page-wrap px-4 pb-8 pt-3 sm:pt-14"
    >
      <section className="hidden sm:block glass rise-in relative overflow-hidden rounded-card px-5 py-6 sm:px-8 sm:py-8">
        <p className="eyebrow mb-1">Favorites</p>
        <h1 className="mb-0 max-w-3xl text-3xl leading-display font-semibold tracking-tight sm:text-4xl">
          Loading favorites…
        </h1>
      </section>
      <p className="sr-only" role="status">
        Loading favorites
      </p>
      <section
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Loading favorites"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} index={i} />
        ))}
      </section>
    </main>
  )
}
