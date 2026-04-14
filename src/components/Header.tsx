import { Link, useRouteContext } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'
import type { SessionData } from '../server/session'

interface NavLink {
  label: string
  to: string
}

/**
 * Pure function that returns the auth section state for testing
 * without React rendering context.
 */
export function getHeaderAuthState(user: SessionData | null): {
  showSignIn: boolean
  userName: string | null
  signInHref: string
  signOutAction: string
  navLinks: NavLink[]
} {
  const navLinks: NavLink[] = [{ label: 'Home', to: '/' }]
  if (user) {
    navLinks.push(
      { label: 'Camera Events', to: '/camera-events' },
      { label: 'Settings', to: '/settings' },
    )
  }
  return {
    showSignIn: !user,
    userName: user ? user.firstName : null,
    signInHref: '/api/auth/google',
    signOutAction: '/api/auth/logout',
    navLinks,
  }
}

export default function Header() {
  const { user } = useRouteContext({ from: '__root__' })
  const state = getHeaderAuthState(user)

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav aria-label="Site navigation" className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
        <div className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            search={{ error: undefined, status: undefined }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
          >
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
            TanStack Start
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:ml-0 sm:gap-2">
          {user ? (
            <>
              <span className="text-sm font-medium text-[var(--sea-ink)]">
                {user.firstName}
              </span>
              <form method="post" action="/api/auth/logout">
                <button
                  type="submit"
                  className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <a
              href="/api/auth/google"
              className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-4 py-2 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
            >
              Sign in with Google
            </a>
          )}

          <ThemeToggle />
        </div>

        <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-2 sm:w-auto sm:flex-nowrap sm:pb-0">
          {state.navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              search={link.to === '/' ? { error: undefined, status: undefined } : undefined}
              className="nav-link"
              activeProps={{ className: 'nav-link is-active', 'aria-current': 'page' as const }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}
