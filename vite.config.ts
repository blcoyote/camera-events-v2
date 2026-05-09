import { defineConfig, type Plugin } from 'vitest/config'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { swPlugin } from './vite-plugin-sw'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { nitro } from 'nitro/vite'

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url))

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
      {
        extends: true,
        plugins: [
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
  },
})
