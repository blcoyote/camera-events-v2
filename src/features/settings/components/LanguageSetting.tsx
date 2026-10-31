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

type Choice = 'auto' | 'en' | 'da'

export function LanguageSetting() {
  const id = useId()
  // 'auto' on first render keeps SSR and hydration identical; cookie read is deferred.
  const [value, setValue] = useState<Choice>('auto')

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
    await syncPushLocale(next)
    setLocale(next)
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {m.settings_language_label()}
      </label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => void onChange(e.target.value as Choice)}
      >
        <option value="auto">{m.settings_language_auto()}</option>
        <option value="en">English</option>
        <option value="da">Dansk</option>
      </NativeSelect>
    </div>
  )
}
