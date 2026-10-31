import { Link, useRouteContext, useRouterState } from '@tanstack/react-router'
import { AvatarMenu } from './AvatarMenu'
import { ThemeToggle } from './ThemeToggle'
import { getPageTitle } from './navigation'
import { useStandaloneAuth } from '#/features/auth/hooks/useStandaloneAuth'
import { useSessionRefresh } from '#/features/auth/hooks/useSessionRefresh'
import { Button } from '#/features/shared/components/ui/button'
import type { SessionData } from '#/features/shared/server/session'

interface NavLink {
  label: string
  to: string
}

export function getHeaderAuthState(user: SessionData | null): {
  showSignIn: boolean
  userName: string | null
  avatarUrl: string | null
  initials: string | null
  signInHref: string
  signOutAction: string
  navLinks: NavLink[]
  sessionExpiresAt: number | undefined
} {
  const navLinks: NavLink[] = user
    ? [
        { label: 'Cameras', to: '/cameras' },
        { label: 'Events', to: '/camera-events' },
        { label: 'Favorites', to: '/favorites' },
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
    sessionExpiresAt: user?.expiresAt,
  }
}

export default function Header() {
  const { user } = useRouteContext({ from: '__root__' })
  const state = getHeaderAuthState(user)
  const { onClick: onSignIn } = useStandaloneAuth(state.signInHref)
  useSessionRefresh(!!user, state.sessionExpiresAt)
  const pathname = useRouterState({ select: (st) => st.location.pathname })

  return (
    <header className="glass-header sticky top-0 z-50 border-b border-border pt-[env(safe-area-inset-top)]">
      <nav
        aria-label="Site navigation"
        className="page-wrap flex items-center gap-x-2 py-1.5 sm:gap-x-3 sm:py-2"
      >
        {user && (
          <span
            aria-hidden="true"
            className="text-base font-semibold text-foreground sm:hidden"
          >
            {getPageTitle(pathname)}
          </span>
        )}

        {/* Desktop nav links — hidden on mobile */}
        <div className="hidden min-w-0 items-center gap-x-2 overflow-x-auto text-xs font-semibold whitespace-nowrap sm:flex sm:gap-x-4 sm:text-sm">
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
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          {state.showSignIn ? (
            <Button asChild variant="secondary" size="sm">
              <a href={state.signInHref} onClick={onSignIn}>
                Sign in with Google
              </a>
            </Button>
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
