import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { X, Camera, Bell, Heart, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavDrawerProps {
  isOpen: boolean
  onClose: () => void
  id?: string
}

interface DrawerNavLink {
  label: string
  to: string
  Icon: LucideIcon
}

const DRAWER_NAV_LINKS: DrawerNavLink[] = [
  { label: 'Cameras', to: '/cameras', Icon: Camera },
  { label: 'Events', to: '/camera-events', Icon: Bell },
  { label: 'Favorites', to: '/favorites', Icon: Heart },
  { label: 'Settings', to: '/settings', Icon: Settings },
]

const linkBase =
  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-(--sea-ink-soft) transition-colors hover:bg-(--surface-strong) hover:text-(--sea-ink)'

const linkActive =
  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold bg-(--surface-strong) text-(--sea-ink) transition-colors'

export function NavDrawer({ isOpen, onClose, id }: NavDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return
    document.body.classList.add('overflow-hidden')
    return () => document.body.classList.remove('overflow-hidden')
  }, [isOpen])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus close button when drawer opens
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        data-testid="nav-drawer-backdrop"
        className="fixed inset-0 z-[60] bg-black/40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="nav-drawer-panel fixed inset-y-0 left-0 z-[70] flex w-72 flex-col bg-(--surface) pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl backdrop-blur-lg"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-end border-b border-(--line) px-4 py-3">
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-9 w-9 items-center justify-center rounded-full text-(--sea-ink-soft) transition-colors hover:bg-(--surface-strong) hover:text-(--sea-ink)"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Drawer nav links */}
        <nav aria-label="Drawer navigation" className="flex flex-col gap-1 p-4">
          {DRAWER_NAV_LINKS.map(({ label, to, Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className={linkBase}
              activeProps={{
                className: linkActive,
                'aria-current': 'page' as const,
              }}
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </>,
    document.body,
  )
}
