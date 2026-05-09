import { Link, useRouteContext } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'
import { AvatarMenu } from './AvatarMenu'
import { useStandaloneAuth } from '#/features/auth/hooks/useStandaloneAuth'
import type { SessionData } from '#/features/shared/server/session'

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
  avatarUrl: string | null
  initials: string | null
  signInHref: string
  signOutAction: string
  navLinks: NavLink[]
} {
  const navLinks: NavLink[] = user
    ? [
        { label: 'Cameras', to: '/cameras' },
        { label: 'Events', to: '/camera-events' },
        { label: 'Settings', to: '/settings' },
      ]
    : []
  return {
    showSignIn: !user,
    userName: user ? user.firstName : null,
    avatarUrl: user ? user.avatarUrl : null,
    initials: user
      ? user.firstName
        ? user.firstName[0].toUpperCase()
        : '?'
      : null,
    signInHref: '/api/auth/google',
    signOutAction: '/api/auth/logout',
    navLinks,
  }
}

export default function Header() {
  const { user } = useRouteContext({ from: '__root__' })
  const state = getHeaderAuthState(user)
  const { onClick: onSignIn } = useStandaloneAuth(state.signInHref)

  return (
    <header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) px-4 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
      <nav
        aria-label="Site navigation"
        className="page-wrap flex items-center gap-x-2 py-1.5 sm:gap-x-3 sm:py-2"
      >
        <div className="flex min-w-0 items-center gap-x-2 overflow-x-auto text-xs font-semibold whitespace-nowrap sm:gap-x-4 sm:text-sm">
          {state.navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="nav-link"
              activeProps={{
                className: 'nav-link is-active',
                'aria-current': 'page' as const,
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="sm:flex">
            <ThemeToggle />
          </div>

          {state.showSignIn ? (
            <a
              href={state.signInHref}
              onClick={onSignIn}
              className="inline-flex min-h-11 items-center rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-4 py-2 text-sm font-semibold text-(--lagoon-deep) no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
            >
              Sign in with Google
            </a>
          ) : (
            <AvatarMenu
              avatarUrl={state.avatarUrl ?? ''}
              initials={state.initials ?? '?'}
              signOutAction={state.signOutAction}
            />
          )}
        </div>
      </nav>
    </header>
  )
}
