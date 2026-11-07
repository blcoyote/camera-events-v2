import { useEffect, useRef } from 'react'
import { Link, useRouteContext, useRouterState } from '@tanstack/react-router'
import { m } from '#/paraglide/messages.js'
import { TABS, getActiveTab } from './navigation'
import { useTabBarViewportRepair } from './useTabBarViewportRepair'

export function TabBar() {
  const { user } = useRouteContext({ from: '__root__' })
  const { pathname, search } = useRouterState({
    select: (s) => s.location,
  })
  const active = getActiveTab(pathname, search as Record<string, unknown>)
  const activeIndex = TABS.findIndex((t) => t.to === active)
  const lastIndex = useRef<number>(0)
  useEffect(() => {
    if (activeIndex >= 0) lastIndex.current = activeIndex
  }, [activeIndex])
  const shownIndex = activeIndex >= 0 ? activeIndex : lastIndex.current
  const navRef = useRef<HTMLElement>(null)
  useTabBarViewportRepair(navRef)
  if (!user) return null

  return (
    <>
      <div aria-hidden="true" className="h-14 sm:hidden" />
      <nav
        ref={navRef}
        aria-label={m.shell_nav_primary()}
        className="glass-header fixed inset-x-0 bottom-0 z-40 rounded-none border-t border-border pb-[env(safe-area-inset-bottom)] shadow-none sm:hidden"
      >
        <div className="relative grid grid-cols-4">
          <span
            aria-hidden="true"
            data-testid="tab-indicator"
            className="pointer-events-none absolute top-0 left-0 h-0.5 w-1/4 px-3 transition-[transform,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform: `translateX(${shownIndex * 100}%)`,
              opacity: activeIndex >= 0 ? 1 : 0,
            }}
          >
            <span className="block h-full rounded-full bg-brand" />
          </span>
          {TABS.map(({ label, to, icon: Icon }) => {
            const isActive = active === to
            return (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true, includeSearch: false }}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-brand-strong' : 'text-fg-2'}`}
              >
                <Icon size={22} aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
