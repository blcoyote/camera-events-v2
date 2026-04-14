import { injectManifest } from '@serwist/build'
import path from 'node:path'
import { build, type Plugin } from 'vite'

/**
 * Custom Vite plugin that builds the service worker for TanStack Start.
 *
 * vite-plugin-pwa doesn't work with TanStack Start's production builds
 * because TanStack Start uses the Vite 6 Environment API which the PWA
 * plugin doesn't yet support. This plugin works around that by manually
 * building the service worker with Vite and injecting the precache manifest
 * with @serwist/build.
 */
export function swPlugin(): Plugin {
  let rootDir: string
  let isProduction: boolean
  let hasBuildRun = false

  async function buildServiceWorker() {
    const outDir = isProduction
      ? path.resolve(rootDir, 'dist', 'client')
      : path.resolve(rootDir, 'public')
    const swSrc = path.resolve(rootDir, 'src', 'sw.ts')

    // Step 1: Bundle the service worker source with Vite
    await build({
      configFile: false,
      publicDir: false,
      build: {
        lib: { entry: swSrc, formats: ['es'], fileName: () => 'sw.js' },
        outDir,
        emptyOutDir: false,
        minify: isProduction,
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify(
          isProduction ? 'production' : 'development',
        ),
      },
    })

    // Step 2: In production, inject the precache manifest into the built SW
    if (isProduction) {
      await injectManifest({
        swSrc: path.resolve(outDir, 'sw.js'),
        swDest: path.resolve(outDir, 'sw.js'),
        globDirectory: outDir,
        globPatterns: [
          '**/*.{js,css,html,png,svg,ico,webmanifest,json,woff,woff2}',
        ],
        // Don't precache the service worker itself or sourcemaps
        globIgnores: ['sw.js', '**/*.map'],
        injectionPoint: 'self.__SW_MANIFEST',
      })
    }
  }

  return {
    name: 'tanstack-sw-plugin',
    configResolved(config) {
      rootDir = config.root
      isProduction = config.isProduction
    },
    async buildStart() {
      // In dev, build the SW into public/ so it's served at /sw.js
      if (!isProduction) {
        await buildServiceWorker()
      }
    },
    async closeBundle() {
      // In production, build after the main bundle so we can precache assets.
      // Guard against running twice (client + SSR environments both trigger closeBundle).
      if (isProduction && !hasBuildRun) {
        hasBuildRun = true
        await buildServiceWorker()
      }
    },
  }
}
