/**
 * Validate a camera name to prevent path traversal and injection.
 * Allows only alphanumeric characters, underscores, and hyphens.
 */
export function isValidCameraName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name)
}
