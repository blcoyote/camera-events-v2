import type { StorybookConfig } from '@storybook/react-vite'
import type { Plugin, PluginOption } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const appOnlyPrefixes = [
  'tanstack-start',
  'tanstack-react-start',
  '@tanstack/devtools',
  'tanstack-sw-plugin',
]

function isAppOnlyPlugin(name: string): boolean {
  return appOnlyPrefixes.some(
    (prefix) => name === prefix || name.startsWith(prefix + ':'),
  )
}

/** Recursively filter out app-only plugins from nested arrays. */
function filterPlugins(plugins: PluginOption[]): PluginOption[] {
  return plugins
    .map((plugin) => {
      if (Array.isArray(plugin)) return filterPlugins(plugin)
      if (
        plugin &&
        typeof plugin === 'object' &&
        'name' in plugin &&
        isAppOnlyPlugin((plugin as { name: string }).name)
      ) {
        return null
      }
      return plugin
    })
    .filter(Boolean)
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  framework: '@storybook/react-vite',
  viteFinal(viteConfig) {
    viteConfig.plugins = filterPlugins(viteConfig.plugins ?? [])

    // Exclude @tanstack/react-start and its server packages from dep optimization.
    // These packages require virtual modules (tanstack-start-manifest:v etc.) provided
    // by the tanstackStart() Vite plugin, which is filtered out above. Excluding them
    // prevents the optimizer from pre-bundling files that contain unresolvable imports.
    viteConfig.optimizeDeps = {
      ...viteConfig.optimizeDeps,
      exclude: [
        ...(viteConfig.optimizeDeps?.exclude ?? []),
        '@tanstack/react-start',
        '@tanstack/react-start/server',
        '@tanstack/start-server-core',
      ],
    }

    // Stub out virtual modules that tanstackStart() would provide. These may be
    // encountered when @tanstack/react-start files are served directly (not pre-bundled).
    // enforce: 'pre' ensures these run before Vite's internal resolver.
    const TANSTACK_VIRTUAL_MODULES = new Set([
      'tanstack-start-manifest:v',
      'tanstack-start-injected-head-scripts:v',
      '#tanstack-router-entry',
      '#tanstack-start-entry',
      '#tanstack-start-plugin-adapters',
    ])

    const virtualModuleStubs: Plugin = {
      name: 'storybook-tanstack-start-stubs',
      enforce: 'pre',
      resolveId(id) {
        return TANSTACK_VIRTUAL_MODULES.has(id) ? `\0${id}` : null
      },
      load(id) {
        return TANSTACK_VIRTUAL_MODULES.has(id.slice(1))
          ? 'export default {}'
          : null
      },
    }

    // Redirect the camera-events server/favorites module to a lightweight stub so
    // @tanstack/react-start is never imported at story load time.
    // enforce: 'pre' is required — without it, Vite's core resolver handles relative
    // imports first and our resolveId hook never fires.
    const favoritesStub: Plugin = {
      name: 'storybook-favorites-stub',
      enforce: 'pre',
      resolveId(id, importer) {
        if (id.endsWith('/server/favorites') && importer) {
          return path.resolve(__dirname, './stubs/favorites.ts')
        }
        return null
      },
    }

    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
      virtualModuleStubs,
      favoritesStub,
    ]

    return viteConfig
  },
}
export default config
