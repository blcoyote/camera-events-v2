import { useCallback, useEffect, useRef, useState } from 'react'
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
  avatarUrl: string | null
  initials: string | null
  signInHref: string
  signOutAction: string
  navLinks: NavLink[]
} {
  const navLinks: NavLink[] = user
    ? [
        { label: 'Cameras', to: '/cameras' },
        { label: 'Camera Events', to: '/camera-events' },
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

function AvatarMenu({
  avatarUrl,
  initials,
  signOutAction,
}: {
  avatarUrl: string
  initials: string
  signOutAction: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuItemRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    buttonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    menuItemRef.current?.focus()

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, close])

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End':
        e.preventDefault()
        menuItemRef.current?.focus()
        break
      case 'Tab':
        close()
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-(--line) bg-(--surface) text-sm font-semibold text-(--sea-ink) transition hover:border-(--lagoon-deep)"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 min-w-40 overflow-hidden rounded-xl border border-(--line) bg-(--surface-strong) shadow-[0_8px_24px_rgba(30,90,72,0.12)]"
        >
          <form method="post" action={signOutAction}>
            <button
              ref={menuItemRef}
              type="submit"
              role="menuitem"
              tabIndex={-1}
              className="w-full px-4 py-3 text-left text-sm font-medium text-(--sea-ink) transition hover:bg-(--link-bg-hover)"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default function Header() {
  const { user } = useRouteContext({ from: '__root__' })
  const state = getHeaderAuthState(user)

  return (
    <header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) px-4 backdrop-blur-lg">
      <nav
        aria-label="Site navigation"
        className="page-wrap flex items-center gap-x-3 py-3 sm:py-4"
      >
        <div className="flex items-center gap-x-4 text-sm font-semibold">
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
          <ThemeToggle />

          {state.showSignIn ? (
            <a
              href={state.signInHref}
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
