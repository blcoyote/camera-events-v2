const str = (v: unknown) =>
  typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : undefined

// Filters only narrow already-loaded events client-side; never sent to Frigate.
export function validateEventListFilters(s: Record<string, unknown>): {
  type?: string
  camera?: string
} {
  return { type: str(s.type), camera: str(s.camera) }
}
