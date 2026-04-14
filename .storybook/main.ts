import type { StorybookConfig } from '@storybook/react-vite'
import type { PluginOption } from 'vite'

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
  viteFinal(config) {
    config.plugins = filterPlugins((config.plugins ?? []))
    return config
  },
}
export default config
