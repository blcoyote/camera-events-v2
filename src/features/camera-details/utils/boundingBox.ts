import type { BoundingBox } from '#/features/shared/server/frigate/types'

export function isNonZeroBox(box: BoundingBox | null): boolean {
  if (box === null) return false
  return box.some((coord) => coord !== 0)
}
