/**
 * Maximum accepted length for an HLS segment `ref` value. go2rtc refs are
 * short filenames with a small query string; anything longer is treated as
 * suspicious rather than a legitimate media reference.
 */
export const MAX_HLS_SEGMENT_REF_LENGTH = 512

/**
 * Conservative allow-list for a go2rtc HLS segment reference: a single
 * relative filename-like path segment (letters, digits, `. _ ~ ( ) -`),
 * optionally followed by a `?`-prefixed query string (same charset plus
 * `% = &`).
 *
 * Percent-encoding (`%`) is deliberately only permitted in the query
 * portion, not the filename portion, so a value like `%2e%2e` can't be
 * smuggled in as part of the path segment and later double-decoded into a
 * traversal sequence by a downstream consumer.
 */
const HLS_SEGMENT_REF_PATTERN = /^[A-Za-z0-9._~()-]+(\?[A-Za-z0-9._~%=&()-]*)?$/

/**
 * Validates the `ref` query parameter accepted by the HLS segment proxy.
 * `ref` is attacker-controllable (it round-trips through the rewritten
 * playlist back to the client and then back to the server), so it must be
 * proven to be a benign relative filename+query before it is used to build
 * a request to the go2rtc/Frigate backend. Never use `ref` in a URL path or
 * fetch without this check passing first.
 *
 * Approach: defense-in-depth. An explicit, documented deny-list is checked
 * first (each check maps to a specific attack: absolute URLs, UNC/absolute
 * paths, traversal, control characters, whitespace, userinfo). The value
 * must then also satisfy a conservative allow-list regex. Both layers must
 * accept for the ref to be considered valid; either layer rejecting is
 * sufficient to reject.
 */
export function isValidHlsSegmentRef(ref: string): boolean {
  if (ref.length === 0 || ref.length > MAX_HLS_SEGMENT_REF_LENGTH) {
    return false
  }

  // Whitespace anywhere (including whitespace-only strings).
  if (/\s/.test(ref)) return false

  // ASCII control characters, including null bytes.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(ref)) return false

  // Path traversal, anywhere in the value.
  if (ref.includes('..')) return false

  // Backslashes (UNC paths, Windows-style traversal).
  if (ref.includes('\\')) return false

  // Absolute path or protocol-relative URL (e.g. "/etc/passwd", "//evil.com/x").
  if (ref.startsWith('/')) return false

  // Absolute URL with a scheme (e.g. "https://evil.com"), case-insensitive.
  if (ref.toLowerCase().includes('://')) return false

  // URL userinfo component (e.g. "user@evil.com").
  if (ref.includes('@')) return false

  return HLS_SEGMENT_REF_PATTERN.test(ref)
}
