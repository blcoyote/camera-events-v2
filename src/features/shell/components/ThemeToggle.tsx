import { MoonIcon, SunIcon, SunMoonIcon } from 'lucide-react'
import { Button } from '#/features/shared/components/ui/button'
import { useTheme } from '#/features/shared/hooks/useTheme'
import type { ThemeMode } from '#/features/shared/hooks/themeMode'

const LABELS: Record<ThemeMode, { current: string; next: string }> = {
  light: { current: 'Light', next: 'Dark' },
  dark: { current: 'Dark', next: 'System' },
  auto: { current: 'System', next: 'Light' },
}

const ICONS = {
  light: SunIcon,
  dark: MoonIcon,
  auto: SunMoonIcon,
} as const

export function ThemeToggle() {
  const { mode, cycleTheme } = useTheme()
  const { current, next } = LABELS[mode]
  const Icon = ICONS[mode]
  const label = `Theme: ${current}. Switch to ${next}.`

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
