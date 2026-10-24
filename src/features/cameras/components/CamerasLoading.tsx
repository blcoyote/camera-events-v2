export function CamerasLoading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      className="page-wrap px-4 pb-8 pt-6 sm:pt-14"
    >
      <section className="glass rise-in relative overflow-hidden rounded-card px-5 py-6 sm:px-8 sm:py-8">
        <p className="eyebrow mb-1">Cameras</p>
        <h1 className="mb-0 max-w-3xl text-3xl leading-display font-semibold tracking-tight sm:text-4xl">
          Loading cameras…
        </h1>
      </section>
      <p className="sr-only" role="status">
        Loading cameras
      </p>
    </main>
  )
}
