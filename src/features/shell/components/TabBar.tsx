import { Link, useRouteContext, useRouterState } from '@tanstack/react-router'
import { TABS, getActiveTab } from './navigation'

export function TabBar() {
  const { user } = useRouteContext({ from: '__root__' })
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  if (!user) return null
  const active = getActiveTab(pathname)

  return (
    <>
      <div aria-hidden="true" className="h-14 sm:hidden" />
      <nav
        aria-label="Primary"
        className="glass-header fixed inset-x-0 bottom-0 z-40 rounded-none border-t border-border pb-[env(safe-area-inset-bottom)] shadow-none sm:hidden"
      >
        <div className="grid grid-cols-4">
          {TABS.map(({ label, to, icon: Icon }) => {
            const isActive = active === to
            return (
              <Link
                key={to}
                to={to}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-brand-strong' : 'text-fg-2'}`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-brand"
                  />
                )}
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
