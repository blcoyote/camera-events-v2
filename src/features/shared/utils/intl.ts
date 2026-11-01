const TIME_ZONE = 'Europe/Copenhagen'

export type AppLocale = 'en' | 'da'

export function intlLocale(locale: AppLocale): 'en-GB' | 'da-DK' {
  return locale === 'da' ? 'da-DK' : 'en-GB'
}

const DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
const TIME: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}

function fmt(
  unixSeconds: number,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...options,
    timeZone: TIME_ZONE,
  }).format(new Date(unixSeconds * 1000))
}

export const formatDate = (
  unixSeconds: number,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = DATE,
) => fmt(unixSeconds, locale, options)

export const formatTime = (unixSeconds: number, locale: AppLocale) =>
  fmt(unixSeconds, locale, TIME)

export const formatDateTime = (
  unixSeconds: number,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    ...DATE,
    ...TIME,
  },
) => fmt(unixSeconds, locale, options)

export function formatPercent(ratio: number, locale: AppLocale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(ratio)
}

export const dayKey = (unixSeconds: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(
    new Date(unixSeconds * 1000),
  )
