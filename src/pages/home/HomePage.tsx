import AlertBanner from '../../components/AlertBanner'

export function HomePage({
  error,
  status,
}: {
  error?: string
  status?: string
}) {
  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-14">
      <AlertBanner error={error} status={status} />
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-3">Camera Events</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-(--sea-ink) sm:text-6xl">
          Monitor your cameras, anywhere.
        </h1>
        <p className="mb-8 max-w-2xl text-base text-(--sea-ink-soft) sm:text-lg">
          View motion, person, and vehicle detection events from all your
          cameras in one place.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/auth/google"
            className="inline-flex min-h-11 items-center rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-(--lagoon-deep) no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
          >
            Sign in with Google
          </a>
        </div>
      </section>
    </main>
  )
}
