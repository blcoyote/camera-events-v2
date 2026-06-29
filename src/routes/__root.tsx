import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Header from '#/features/shell/components/Header'
import { ServiceWorkerRegistration } from '#/features/shell/components/ServiceWorkerRegistration'
import { getCurrentUserFn } from '#/features/auth/server/auth'
import type { SessionData } from '#/features/shared/server/session'
import { NotFound } from './-not-found'

import appCss from '../styles.css?url'

// Blocking inline script: applies theme (mode) + palette before first paint to
// prevent FOUC. The palette->theme-color map is kept in sync with THEME_COLOR_MAP
// in src/features/shared/hooks/themeColor.ts.
const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var sp=window.localStorage.getItem('palette');var palette=(sp==='ocean'||sp==='sunset'||sp==='slate')?sp:'ocean';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}if(palette==='ocean'){root.removeAttribute('data-palette')}else{root.setAttribute('data-palette',palette)}root.style.colorScheme=resolved;var colors={ocean:{light:'#173a40',dark:'#0d1f23'},sunset:{light:'#43281a',dark:'#0f0c0a'},slate:{light:'#1f2933',dark:'#0d0f12'}};var tc=document.querySelector('meta[name="theme-color"]');if(tc){tc.setAttribute('content',(colors[palette]||colors.ocean)[resolved])}}catch(e){}})();`

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
        title: 'Camera Events v2',
      },
      {
        name: 'theme-color',
        content: '#173a40',
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
        content: 'black-translucent',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Camera Events v2',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased wrap-anywhere selection:bg-(--selection-bg)">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-gray-900 focus:shadow-lg"
        >
          Skip to main content
        </a>
        <Header />
        {children}
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
