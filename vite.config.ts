import { defineConfig } from 'vitest/config'
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
import type { Plugin } from 'vite'

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url))

const isTest = !!process.env.VITEST

// TanStack Start injects #tanstack-router-entry, #tanstack-start-entry, and
// #tanstack-start-plugin-adapters as Vite virtual modules via tanstackStart().
// In test mode the plugin is skipped, so resolution fails. This stub plugin
// satisfies Vite's static analysis without executing anything — the dynamic
// imports in createStartHandler never fire in unit tests.
function tanstackStartTestStubs(): Plugin {
  const STUBS = new Set([
    '#tanstack-router-entry',
    '#tanstack-start-entry',
    '#tanstack-start-plugin-adapters',
  ])
  return {
    name: 'tanstack-start-test-stubs',
    resolveId(id) {
      return STUBS.has(id) ? `\0${id}` : null
    },
    load(id) {
      return STUBS.has(id.slice(1)) ? 'export default {}' : null
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
  // Mark TanStack Start server packages as external during dependency
  // optimization so the optimizer never follows into createStartHandler.js
  // (which contains unresolvable #tanstack-* virtual module specifiers that
  // only exist when the tanstackStart() plugin is active).
  optimizeDeps: {
    exclude: isTest
      ? [
          '@tanstack/react-start',
          '@tanstack/react-start-server',
          '@tanstack/start-server-core',
        ]
      : [],
  },
  plugins: [
    tailwindcss(),
    ...(isTest
      ? [tanstackStartTestStubs()]
      : [devtools(), tanstackStart(), nitro({ preset: 'bun' })]),
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
