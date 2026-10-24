import { useState, useRef } from 'react'
import { Link, useRouteContext } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { AvatarMenu } from './AvatarMenu'
import { ThemeToggle } from './ThemeToggle'
import { NavDrawer } from './NavDrawer'
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
  mobileTopLinks: NavLink[]
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
  const mobileTopLinks: NavLink[] = user
    ? [
        { label: 'Cameras', to: '/cameras' },
        { label: 'Events', to: '/camera-events' },
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
    mobileTopLinks,
    sessionExpiresAt: user?.expiresAt,
  }
}

export default function Header() {
  const { user } = useRouteContext({ from: '__root__' })
  const state = getHeaderAuthState(user)
  const { onClick: onSignIn } = useStandaloneAuth(state.signInHref)
  useSessionRefresh(!!user, state.sessionExpiresAt)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const openedByKeyboard = useRef(false)

  function openDrawer(e: React.MouseEvent) {
    openedByKeyboard.current = e.detail === 0
    setIsDrawerOpen(true)
  }

  function closeDrawer() {
    setIsDrawerOpen(false)
  }

  return (
    <header className="glass sticky top-0 z-50 border-b border-border pt-[env(safe-area-inset-top)]">
      <nav
        aria-label="Site navigation"
        className="page-wrap flex items-center gap-x-2 py-1.5 sm:gap-x-3 sm:py-2"
      >
        {/* Hamburger button — mobile only, left-anchored */}
        {state.navLinks.length > 0 && (
          <Button
            ref={hamburgerRef}
            variant="ghost"
            size="icon"
            className="-ml-2 sm:hidden"
            aria-label="Open navigation"
            aria-expanded={isDrawerOpen}
            aria-controls="nav-drawer"
            onPointerDown={(e) => e.preventDefault()}
            onClick={openDrawer}
          >
            <Menu size={22} aria-hidden="true" />
          </Button>
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

        {/* Mobile-only top-bar links — always visible in header on mobile */}
        {state.mobileTopLinks.length > 0 && (
          <div className="flex min-w-0 items-center gap-x-2 text-xs font-semibold whitespace-nowrap sm:hidden">
            {state.mobileTopLinks.map((link) => (
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
        )}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
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

      {state.navLinks.length > 0 && (
        <NavDrawer
          isOpen={isDrawerOpen}
          onClose={closeDrawer}
          id="nav-drawer"
          onCloseAutoFocus={(e) => {
            if (openedByKeyboard.current) {
              e.preventDefault()
              hamburgerRef.current?.focus()
            }
          }}
        />
      )}
    </header>
  )
}
