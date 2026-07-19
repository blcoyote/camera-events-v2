export function LiveLoading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      className="page-wrap px-4 pb-8 pt-6 sm:pt-14"
    >
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <p className="island-kicker mb-1">Live</p>
        <h1 className="display-title mb-0 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
          Loading live view…
        </h1>
      </section>
      <div className="mt-6 flex gap-2">
        <div className="h-11 w-24 shrink-0 animate-pulse rounded-full bg-(--surface-strong)" />
        <div className="h-11 w-24 shrink-0 animate-pulse rounded-full bg-(--surface-strong)" />
        <div className="h-11 w-24 shrink-0 animate-pulse rounded-full bg-(--surface-strong)" />
      </div>
      <div className="mt-4 aspect-video animate-pulse rounded-4xl bg-(--surface-strong)" />
      <p className="sr-only" role="status">
        Loading cameras
      </p>
    </main>
  )
}
