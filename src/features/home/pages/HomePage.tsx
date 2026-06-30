import AlertBanner from '#/features/shared/components/AlertBanner'
import { useStandaloneAuth } from '#/features/auth/hooks/useStandaloneAuth'

export function HomePage({
  error,
  status,
  returnTo,
}: {
  error?: string
  status?: string
  returnTo?: string
}) {
  const signInHref = returnTo
    ? `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`
    : '/api/auth/google'
  const { onClick: onSignIn } = useStandaloneAuth(signInHref)

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <AlertBanner error={error} status={status} />
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--hero-a),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--hero-b),transparent_66%)]" />
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
            href={signInHref}
            onClick={onSignIn}
            className="inline-flex min-h-11 items-center rounded-full border border-(--accent-muted-border) bg-(--accent-muted-bg) px-5 py-2.5 text-sm font-semibold text-(--lagoon-deep) no-underline transition hover:-translate-y-0.5 hover:bg-(--accent-muted-hover-bg)"
          >
            Sign in with Google
          </a>
        </div>
      </section>
    </main>
  )
}
