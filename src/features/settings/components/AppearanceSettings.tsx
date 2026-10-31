import { m } from '#/paraglide/messages.js'
import {
  Card,
  CardHeader,
  CardTitle,
} from '#/features/shared/components/ui/card'
import { Toggle } from '#/features/shared/components/ui/toggle'
import { useTheme } from '#/features/shared/hooks/useTheme'
import type { ThemeMode } from '#/features/shared/hooks/themeMode'
import { cn } from '#/features/shared/utils/cn'

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: () => string }> =
  [
    { value: 'light', label: () => m.shell_theme_light() },
    { value: 'dark', label: () => m.shell_theme_dark() },
    { value: 'auto', label: () => m.shell_theme_system() },
  ]

export function AppearanceSettings({ className }: { className?: string }) {
  const { mode, setTheme } = useTheme()

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{m.settings_appearance()}</CardTitle>
      </CardHeader>

      <div
        role="group"
        aria-label={m.settings_theme_group()}
        className="flex flex-wrap gap-2"
      >
        {THEME_OPTIONS.map((option) => {
          const checked = mode === option.value
          return (
            <Toggle
              key={option.value}
              pressed={checked}
              onPressedChange={() => setTheme(option.value)}
            >
              {option.label()}
            </Toggle>
          )
        })}
      </div>
    </Card>
  )
}
