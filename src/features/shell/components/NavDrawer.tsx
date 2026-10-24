import { useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { X, Camera, Bell, Heart, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '#/features/shared/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '#/features/shared/components/ui/sheet'

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
  'flex min-h-11 items-center gap-3 rounded-input px-3 py-3 text-sm font-semibold text-fg-2 transition-colors duration-180 ease-standard hover:bg-surface-hover hover:text-foreground'

const linkActive = 'bg-surface-hover text-foreground'

export function NavDrawer({ isOpen, onClose, id }: NavDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="left"
        id={id}
        showCloseButton={false}
        aria-modal="true"
        aria-describedby={undefined}
        overlayProps={{ 'data-testid': 'nav-drawer-backdrop' }}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          closeButtonRef.current?.focus()
        }}
        className="gap-0"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        {/* Drawer header */}
        <div className="flex items-center justify-end border-b border-border-soft px-4 py-3">
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="size-5" aria-hidden />
          </Button>
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
                className: `${linkBase} ${linkActive}`,
                'aria-current': 'page' as const,
              }}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
