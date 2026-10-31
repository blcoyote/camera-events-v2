import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import Header from '#/features/shell/components/Header'
import { TabBar } from '#/features/shell/components/TabBar'
import { ServiceWorkerRegistration } from '#/features/shell/components/ServiceWorkerRegistration'
import { getCurrentUserFn } from '#/features/auth/server/auth'
import type { SessionData } from '#/features/shared/server/session'
import { NotFound } from './-not-found'
import {
  THEME_COLORS,
  buildThemeInitScript,
} from '#/features/shared/hooks/themeMode'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = buildThemeInitScript()

interface RouterContext {
  user: SessionData | null
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    return { user }
  },
  notFoundComponent: NotFound,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: m.shell_title_app(),
      },
      // One meta only: TanStack dedupes by name. The init script syncs it to
      // the resolved theme before first paint.
      {
        name: 'theme-color',
        content: THEME_COLORS.light,
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'default',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: m.shell_title_app(),
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
        sizes: '48x48',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-background font-sans text-foreground antialiased wrap-anywhere selection:bg-brand/15">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-card focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-raised"
        >
          {m.route_skip_to_content()}
        </a>
        <Header />
        {children}
        <TabBar />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <ServiceWorkerRegistration />
        <Scripts />
      </body>
    </html>
  )
}
