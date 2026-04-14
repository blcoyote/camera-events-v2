import { createFileRoute, Link } from '@tanstack/react-router'
import AlertBanner from '../components/AlertBanner'
import type { SessionData } from '../server/session'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
    status: typeof search.status === 'string' ? search.status : undefined,
  }),
  component: App,
})

/**
 * Pure function: determine front page CTA and welcome text based on auth state.
 */
export function getFrontPageContent(user: SessionData | null): {
  ctaText: string
  ctaHref: string
  welcomeText: string | null
} {
  if (!user) {
    return {
      ctaText: 'Sign in with Google',
      ctaHref: '/api/auth/google',
      welcomeText: null,
    }
  }
  return {
    ctaText: 'Go to Camera Events',
    ctaHref: '/camera-events',
    welcomeText: user.firstName
      ? `Welcome back, ${user.firstName}.`
      : 'Welcome back.',
  }
}

function App() {
  const { error, status } = Route.useSearch()
  const { user } = Route.useRouteContext()
  const content = getFrontPageContent(user)

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-14">
      <AlertBanner error={error} status={status} />
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-3">Camera Events</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          Monitor your cameras, anywhere.
        </h1>
        {content.welcomeText && (
          <p className="mb-4 text-base font-medium text-[var(--sea-ink)]">
            {content.welcomeText}
          </p>
        )}
        <p className="mb-8 max-w-2xl text-base text-[var(--sea-ink-soft)] sm:text-lg">
          View motion, person, and vehicle detection events from all your
          cameras in one place.
        </p>
        <div className="flex flex-wrap gap-3">
          {content.ctaHref.startsWith('/api/') ? (
            <a
              href={content.ctaHref}
              className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
            >
              {content.ctaText}
            </a>
          ) : (
            <Link
              to={content.ctaHref}
              className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
            >
              {content.ctaText}
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}
