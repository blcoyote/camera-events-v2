import { m } from '#/paraglide/messages.js'

export function CamerasLoading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      className="page-wrap px-4 pb-8 pt-3 sm:pt-14"
    >
      <section className="hidden sm:block glass rise-in relative overflow-hidden rounded-card px-5 py-6 sm:px-8 sm:py-8">
        <p className="eyebrow mb-1">{m.cameras_eyebrow()}</p>
        <h1 className="mb-0 max-w-3xl text-3xl leading-display font-semibold tracking-tight sm:text-4xl">
          {m.cameras_loading_title()}
        </h1>
      </section>
      <p className="sr-only" role="status">
        {m.cameras_loading()}
      </p>
    </main>
  )
}
