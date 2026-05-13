import { useState, useRef } from 'react'
import { Link, useRouteContext } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { AvatarMenu } from './AvatarMenu'
import { NavDrawer } from './NavDrawer'
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
  }
}

export default function Header() {
  const { user } = useRouteContext({ from: '__root__' })
  const state = getHeaderAuthState(user)
  const { onClick: onSignIn } = useStandaloneAuth(state.signInHref)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const openedByKeyboard = useRef(false)

  function openDrawer(e: React.MouseEvent) {
    openedByKeyboard.current = e.detail === 0
    setIsDrawerOpen(true)
  }

  function closeDrawer() {
    setIsDrawerOpen(false)
    if (openedByKeyboard.current) {
      hamburgerRef.current?.focus()
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) pt-[env(safe-area-inset-top)] backdrop-blur-lg">
      <nav
        aria-label="Site navigation"
        className="page-wrap flex items-center gap-x-2 py-1.5 sm:gap-x-3 sm:py-2"
      >
        {/* Hamburger button — mobile only, left-anchored */}
        {state.navLinks.length > 0 && (
          <button
            ref={hamburgerRef}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-(--sea-ink-soft) transition-colors hover:bg-(--surface-strong) hover:text-(--sea-ink) sm:hidden"
            aria-label="Open navigation"
            aria-expanded={isDrawerOpen}
            aria-controls="nav-drawer"
            onPointerDown={(e) => e.preventDefault()}
            onClick={openDrawer}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
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

        {/* Mobile-only Events link — always visible in header on mobile */}
        {state.navLinks.length > 0 && (
          <div className="flex min-w-0 items-center text-xs font-semibold whitespace-nowrap sm:hidden">
            <Link
              to="/camera-events"
              className="nav-link"
              activeProps={{
                className: 'nav-link is-active',
                'aria-current': 'page' as const,
              }}
            >
              Events
            </Link>
          </div>
        )}

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

      {state.navLinks.length > 0 && (
        <NavDrawer
          isOpen={isDrawerOpen}
          onClose={closeDrawer}
          id="nav-drawer"
        />
      )}
    </header>
  )
}
