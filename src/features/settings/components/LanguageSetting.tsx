import { useEffect, useId, useState } from 'react'
import { m } from '#/paraglide/messages.js'
import { setLocale } from '#/paraglide/runtime.js'
import { NativeSelect } from '#/features/shared/components/ui/native-select'
import { syncPushLocale } from '#/features/shared/utils/pushLocaleSync'
import {
  clearStoredLanguage,
  readStoredLanguage,
  reloadPage,
} from '../utils/languagePreference'

// Push sync is best-effort; never let a slow network block the switch.
const PUSH_SYNC_TIMEOUT_MS = 3000

type Choice = 'auto' | 'en' | 'da'

export function LanguageSetting() {
  const id = useId()
  // 'auto' on first render keeps SSR and hydration identical; cookie read is deferred.
  const [value, setValue] = useState<Choice>('auto')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const stored = readStoredLanguage()
    if (stored) setValue(stored)
  }, [])

  async function onChange(next: Choice) {
    setValue(next)
    if (next === 'auto') {
      clearStoredLanguage()
      reloadPage()
      return
    }
    setPending(true)
    try {
      await Promise.race([
        syncPushLocale(next).catch(() => {}),
        new Promise((r) => setTimeout(r, PUSH_SYNC_TIMEOUT_MS)),
      ])
      setLocale(next)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {m.settings_language_label()}
      </label>
      <NativeSelect
        id={id}
        value={value}
        disabled={pending}
        onChange={(e) => void onChange(e.target.value as Choice)}
      >
        <option value="auto">{m.settings_language_auto()}</option>
        <option value="en">English</option>
        <option value="da">Dansk</option>
      </NativeSelect>
    </div>
  )
}
