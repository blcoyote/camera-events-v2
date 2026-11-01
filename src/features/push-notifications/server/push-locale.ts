export type PushLocale = 'en' | 'da'

export function isPushLocale(x: unknown): x is PushLocale {
  return x === 'en' || x === 'da'
}
