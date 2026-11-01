import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages.js'
import { Button } from '#/features/shared/components/ui/button'

export function NotFound() {
  return (
    <main id="main-content" className="page-wrap px-4 py-6 sm:py-12">
      <section className="glass rise-in rounded-card px-6 py-10 text-center sm:px-10 sm:py-14">
        <p className="eyebrow mb-3">404</p>
        <h1 className="mb-5 text-3xl font-semibold tracking-tight leading-display text-foreground sm:text-4xl">
          {m.route_not_found_title()}
        </h1>
        <p className="mx-auto mb-8 max-w-md text-base text-fg-2 sm:text-lg">
          {m.route_not_found_body()}
        </p>
        <Button asChild>
          <Link
            to="/"
            search={{
              error: undefined,
              status: undefined,
              returnTo: undefined,
            }}
          >
            {m.route_not_found_home()}
          </Link>
        </Button>
      </section>
    </main>
  )
}
