export function mergeCameraOrder(
  savedOrder: string[] | null,
  frigateCameras: string[],
): string[] {
  if (frigateCameras.length === 0) return []
  if (!savedOrder || savedOrder.length === 0) return frigateCameras

  const frigateSet = new Set(frigateCameras)
  const inOrder = savedOrder.filter((name) => frigateSet.has(name))
  const inOrderSet = new Set(inOrder)
  const newCameras = frigateCameras.filter((name) => !inOrderSet.has(name))

  return [...inOrder, ...newCameras]
}
