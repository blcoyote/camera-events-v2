export const STORAGE_KEY = 'camera-order:v1'

type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' }

export function loadOrder(): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null

    const parsed: unknown = JSON.parse(raw)
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => typeof item !== 'string')
    ) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed as string[]
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function saveOrder(order: string[]): SaveResult {
  if (typeof window === 'undefined') return { ok: false, reason: 'unavailable' }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
    return { ok: true }
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      return { ok: false, reason: 'quota' }
    }
    return { ok: false, reason: 'unavailable' }
  }
}
