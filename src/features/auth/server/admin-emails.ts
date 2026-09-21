/**
 * Parse the ADMIN_EMAILS env var into a normalized allowlist.
 *
 * Pure function — the caller reads `process.env.ADMIN_EMAILS` and passes it
 * in. Fails closed: an unset or blank value yields an empty allowlist, so
 * nobody is treated as an admin by default.
 */
export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return []

  const seen = new Set<string>()
  const result: string[] = []

  for (const segment of raw.split(',')) {
    const normalized = segment.trim().toLowerCase()
    if (!normalized) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

/**
 * True when `email` appears in `allowlist`.
 *
 * Comparison is case-insensitive and trims the input email, but is
 * otherwise an exact match — no substring, prefix, suffix, or
 * domain-wildcard matching. This is a security boundary: do not loosen it.
 */
export function isAdminEmail(email: string, allowlist: string[]): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return allowlist.includes(normalized)
}
