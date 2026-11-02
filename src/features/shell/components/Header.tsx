import { Link, useRouteContext } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { m } from '#/paraglide/messages.js'
import { AvatarMenu } from './AvatarMenu'
import { ThemeToggle } from './ThemeToggle'
import { getTitleBar } from './navigation'
import { useBreadcrumbs } from '#/features/shared/navigation/useBreadcrumbs'
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
        { label: m.shell_tab_cameras(), to: '/cameras' },
        { label: m.shell_tab_events(), to: '/camera-events' },
        { label: m.shell_tab_favorites(), to: '/favorites' },
        { label: m.shell_tab_settings(), to: '/settings' },
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
  const { title, back } = getTitleBar(useBreadcrumbs())

  return (
    <header className="glass-header sticky top-0 z-50 border-b border-border pt-[env(safe-area-inset-top)]">
      <nav
        aria-label={m.shell_nav_site()}
        className="page-wrap flex items-center gap-x-2 py-1.5 sm:gap-x-3 sm:py-2"
      >
        {user && (
          <div className="flex min-w-0 items-center gap-1 sm:hidden">
            {back && (
              <Link
                // `to` is a runtime string here, not a typed route literal
                to={back.to as string}
                search={back.search as never}
                aria-label={m.shell_back_to({ label: back.label })}
                className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-sm font-medium text-brand-strong no-underline"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                {back.label}
              </Link>
            )}
            <span
              aria-hidden="true"
              className="min-w-0 truncate text-base font-semibold text-foreground"
            >
              {title}
            </span>
          </div>
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
                {m.shell_sign_in_google()}
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
