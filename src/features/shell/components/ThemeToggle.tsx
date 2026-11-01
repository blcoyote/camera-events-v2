import { MoonIcon, SunIcon, SunMoonIcon } from 'lucide-react'
import { m } from '#/paraglide/messages.js'
import { Button } from '#/features/shared/components/ui/button'
import { useTheme } from '#/features/shared/hooks/useTheme'
import type { ThemeMode } from '#/features/shared/hooks/themeMode'

const NAMES: Record<ThemeMode, () => string> = {
  light: () => m.shell_theme_light(),
  dark: () => m.shell_theme_dark(),
  auto: () => m.shell_theme_system(),
}

const NEXT: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'auto',
  auto: 'light',
}

const ICONS = {
  light: SunIcon,
  dark: MoonIcon,
  auto: SunMoonIcon,
} as const

export function ThemeToggle() {
  const { mode, cycleTheme } = useTheme()
  const Icon = ICONS[mode]
  const label = m.shell_theme_toggle({
    current: NAMES[mode](),
    next: NAMES[NEXT[mode]](),
  })

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={label}
      title={label}
    >
      <Icon size={20} aria-hidden="true" />
    </Button>
  )
}
