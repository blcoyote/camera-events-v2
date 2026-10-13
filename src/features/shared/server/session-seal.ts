import * as Iron from 'iron-webcrypto'

/**
 * Shape persisted inside the sealed session cookie. Mirrors h3's internal
 * session record so existing cookies (sealed by the previous h3-based
 * `useSession` implementation) keep unsealing identically after migrating
 * off it.
 */
export type StoredSession<T> = {
  id: string
  createdAt: number
  data: Partial<T>
}

/**
 * `lib.dom`'s `Crypto`/`SubtleCrypto` types are structurally incompatible
 * with iron-webcrypto's own `_Crypto` interface in newer TypeScript lib
 * versions (generic `Uint8Array<ArrayBufferLike>` vs. plain `BufferSource`).
 * The runtime object is the same `globalThis.crypto` either way — this cast
 * only works around the type mismatch, it changes no behavior.
 */
const ironCrypto = globalThis.crypto as unknown as Parameters<
  typeof Iron.seal
>[0]

function ironOptions(maxAgeSeconds: number) {
  return { ...Iron.defaults, ttl: maxAgeSeconds * 1000 }
}

/** Narrows an unsealed value to the `StoredSession` shape without `any`. */
function isStoredSessionShape(
  value: unknown,
): value is { id: string; createdAt: number; data: Record<string, unknown> } {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.createdAt === 'number' &&
    typeof record.data === 'object' &&
    record.data !== null
  )
}

/**
 * Seals a `StoredSession` into an iron `Fe26.2**...` string, matching the
 * format previously produced by h3's session implementation.
 */
export async function sealStoredSession<T>(
  session: StoredSession<T>,
  password: string,
  maxAgeSeconds: number,
): Promise<string> {
  return Iron.seal(ironCrypto, session, password, ironOptions(maxAgeSeconds))
}

/**
 * Unseals a sealed session cookie value. Never throws — any failure
 * (bad HMAC, garbage input, wrong password, iron-level expiry, malformed
 * shape, or our own app-level maxAge check) resolves to `null`.
 */
export async function unsealStoredSession<T>(
  sealed: string,
  password: string,
  maxAgeSeconds: number,
  nowMs: number = Date.now(),
): Promise<StoredSession<T> | null> {
  let result: unknown
  try {
    result = await Iron.unseal(
      ironCrypto,
      sealed,
      password,
      ironOptions(maxAgeSeconds),
    )
  } catch {
    return null
  }

  if (!isStoredSessionShape(result)) {
    return null
  }

  if (nowMs - result.createdAt > maxAgeSeconds * 1000) {
    return null
  }

  return result as StoredSession<T>
}

/** Creates a brand-new, empty stored session. */
export function createStoredSession<T>(
  nowMs: number = Date.now(),
): StoredSession<T> {
  return {
    id: crypto.randomUUID(),
    createdAt: nowMs,
    data: {},
  }
}
