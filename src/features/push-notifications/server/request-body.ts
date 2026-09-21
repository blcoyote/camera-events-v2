import '@tanstack/react-start/server-only'

/**
 * Read one field from an untrusted, already-parsed JSON request body.
 *
 * `await request.json()` yields any JSON value, not just an object — `null`,
 * a string, an array and a bare number are all valid bodies — so indexing it
 * directly throws and turns a malformed request into a 500. Returns
 * `undefined` for anything that is not a non-null object, letting callers
 * keep their ordinary "missing/invalid field" validation branch.
 */
export function readBodyField(body: unknown, key: string): unknown {
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)[key]
    : undefined
}
