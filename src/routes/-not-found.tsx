import { Link } from '@tanstack/react-router'

export function NotFound() {
  return (
    <main id="main-content" className="page-wrap px-4 py-6 sm:py-12">
      <section className="island-shell rise-in rounded-4xl px-6 py-10 text-center sm:px-10 sm:py-14">
        <p className="island-kicker mb-3">404</p>
        <h1 className="display-title mb-5 text-4xl font-bold text-(--sea-ink) sm:text-6xl">
          Page not found
        </h1>
        <p className="mx-auto mb-8 max-w-md text-base text-(--sea-ink-soft) sm:text-lg">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          search={{ error: undefined, status: undefined, returnTo: undefined }}
          className="inline-flex min-h-11 items-center rounded-full border border-(--accent-muted-border) bg-(--accent-muted-bg) px-5 py-2.5 text-sm font-semibold text-(--lagoon-deep) no-underline transition hover:-translate-y-0.5 hover:bg-(--accent-muted-hover-bg)"
        >
          Back to Home
        </Link>
      </section>
    </main>
  )
}
