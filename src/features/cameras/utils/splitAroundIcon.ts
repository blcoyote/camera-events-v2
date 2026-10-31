export const ICON_SENTINEL = '\u0000'

/** Splits a message rendered with `{icon: ICON_SENTINEL}` around the icon slot. */
export function splitAroundIcon(text: string): string[] {
  return text.split(ICON_SENTINEL)
}
