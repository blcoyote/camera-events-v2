import AlertBanner from '#/features/shared/components/AlertBanner'
import { useStandaloneAuth } from '#/features/auth/hooks/useStandaloneAuth'
import { Button } from '#/features/shared/components/ui/button'

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
      <section className="glass rise-in relative overflow-hidden rounded-hero px-6 py-10 sm:px-10 sm:py-14">
        <p className="eyebrow mb-3">Camera Events</p>
        <h1 className="mb-5 max-w-3xl text-4xl leading-display font-semibold tracking-tight sm:text-6xl">
          Monitor your cameras, anywhere.
        </h1>
        <p className="mb-8 max-w-2xl text-base text-fg-2 sm:text-lg">
          View motion, person, and vehicle detection events from all your
          cameras in one place.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={signInHref} onClick={onSignIn}>
              Sign in with Google
            </a>
          </Button>
        </div>
      </section>
    </main>
  )
}
