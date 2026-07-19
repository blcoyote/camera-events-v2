/**
 * Rewrites the media references in a go2rtc HLS **media** playlist so every
 * segment/init/key reference points back at this app's auth-guarded segment
 * proxy route (`/api/live/{camera}/segment?ref={originalRef}`), instead of
 * directly at go2rtc. The rewritten `ref` must be validated on the way back
 * in — see `isValidHlsSegmentRef` in `#/features/live/server/hls-validation`.
 *
 * Implementation note: the playlist is split on `\n` and rejoined with `\n`.
 * This is a deliberate simplification — HLS playlists are line-oriented text
 * and go2rtc emits `\n`-terminated lines, so this preserves line order and is
 * sufficient in practice. A CRLF (`\r\n`) playlist would retain a trailing
 * `\r` on each line, which is passed through untouched (it only ever affects
 * the `\r` accidentally becoming a part of the last preserved character(s) of
 * a pass-through tag line, never of a rewritten value).
 */
export function rewriteHlsPlaylist(
  playlist: string,
  cameraName: string,
): string {
  const proxyPrefix = `/api/live/${encodeURIComponent(cameraName)}/segment?ref=`

  return playlist
    .split('\n')
    .map((line) => rewriteLine(line, proxyPrefix))
    .join('\n')
}

function rewriteLine(line: string, proxyPrefix: string): string {
  if (line === '') return line

  if (line.startsWith('#')) {
    if (!line.includes('URI="')) return line
    return line.replace(/URI="([^"]*)"/, (_match, uriValue: string) => {
      return `URI="${rewriteRef(uriValue, proxyPrefix)}"`
    })
  }

  // Non-#-prefixed, non-empty line: a media segment URI.
  return rewriteRef(line, proxyPrefix)
}

function rewriteRef(ref: string, proxyPrefix: string): string {
  // Already-absolute URLs are left unchanged — we deliberately don't proxy
  // arbitrary hosts. go2rtc always emits relative refs; this only guards
  // against an unexpected absolute reference.
  if (/^https?:\/\//i.test(ref)) return ref

  return `${proxyPrefix}${encodeURIComponent(ref)}`
}
