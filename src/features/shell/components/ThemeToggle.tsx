import { useTheme } from '#/features/shared/hooks/useTheme'
import { SunIcon } from './icons/SunIcon'
import { MoonIcon } from './icons/MoonIcon'
import { AutoIcon } from './icons/AutoIcon'

export default function ThemeToggle() {
  const { mode, cycleTheme } = useTheme()

  const label =
    mode === 'auto'
      ? 'Theme: auto (system). Click for light.'
      : mode === 'light'
        ? 'Theme: light. Click for dark.'
        : 'Theme: dark. Click for auto.'

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-(--chip-line) bg-(--chip-bg) text-(--sea-ink) shadow-[0_8px_22px_rgba(30,90,72,0.08)] transition hover:-translate-y-0.5"
    >
      {mode === 'light' && <SunIcon />}
      {mode === 'dark' && <MoonIcon />}
      {mode === 'auto' && <AutoIcon />}
    </button>
  )
}
