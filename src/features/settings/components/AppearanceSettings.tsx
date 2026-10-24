import {
  Card,
  CardHeader,
  CardTitle,
} from '#/features/shared/components/ui/card'
import { Toggle } from '#/features/shared/components/ui/toggle'
import { useTheme } from '#/features/shared/hooks/useTheme'
import type { ThemeMode } from '#/features/shared/hooks/themeMode'
import { cn } from '#/features/shared/utils/cn'

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'System' },
]

export function AppearanceSettings({ className }: { className?: string }) {
  const { mode, setTheme } = useTheme()

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>

      <div role="group" aria-label="Theme" className="flex flex-wrap gap-2">
        {THEME_OPTIONS.map((option) => {
          const checked = mode === option.value
          return (
            <Toggle
              key={option.value}
              pressed={checked}
              onPressedChange={() => setTheme(option.value)}
            >
              {option.label}
            </Toggle>
          )
        })}
      </div>
    </Card>
  )
}
