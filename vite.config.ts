import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { swPlugin } from './vite-plugin-sw'
import { nitro } from 'nitro/vite'

/**
 * Absolute path to the `/live` MSE WebSocket relay handler. Registered as a
 * Nitro-level WS route below because TanStack file routes cannot perform a
 * WebSocket upgrade. See the live-mse-websocket-transport ADR.
 */
const liveMseWsHandler = fileURLToPath(
  new URL('./src/features/live/server/live-mse-ws.ts', import.meta.url),
)

const isTest = !!process.env.VITEST

/**
 * Nitro's dev middleware pre-check skips requests where `Sec-Fetch-Dest` is
 * non-document-like (e.g. "image"). API routes that proxy images (thumbnails,
 * snapshots, camera stills) would receive 404 in dev because the request never
 * reaches the Nitro handler. Stripping the header for /api/* requests before
 * Nitro's middleware sees it restores correct behaviour without affecting prod.
 */
function apiDevMiddlewarePlugin(): Plugin {
  return {
    name: 'api-dev-middleware',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith('/api/')) {
          delete req.headers['sec-fetch-dest']
        }
        next()
      })
    },
  }
}

export default defineConfig({
  preview: {
    allowedHosts: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    apiDevMiddlewarePlugin(),
    tailwindcss(),
    ...(isTest
      ? []
      : [
          devtools(),
          tanstackStart(),
          nitro({
            preset: 'bun',
            // Enable crossws WebSocket support in the Bun runtime (off by
            // default) so the /live MSE relay route can upgrade connections.
            experimental: { websocket: true },
            // Nitro-level WS route: a more-specific match than TanStack's
            // catch-all, so the upgrade reaches the relay handler.
            handlers: [
              { route: '/api/live/:name/ws', handler: liveMseWsHandler },
            ],
          }),
        ]),
    viteReact(),
    ...(isTest ? [] : [swPlugin()]),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: ['src/**/*.stories.*'],
        },
      },
    ],
  },
})
