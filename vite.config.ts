import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { swPlugin } from './vite-plugin-sw'
import { nitro } from 'nitro/vite'

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
    ...(isTest ? [] : [devtools(), tanstackStart(), nitro({ preset: 'bun' })]),
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
