/**
 * Validate a camera name to prevent path traversal and injection.
 * Allows only alphanumeric characters, underscores, and hyphens.
 */
export function isValidCameraName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name)
}

/**
 * Validate a Frigate event ID to prevent path traversal and injection.
 * Frigate event IDs contain digits, dots, hyphens, and lowercase letters
 * (e.g., "1713095000.123456-abcdef").
 */
export function isValidEventId(id: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(id) && id.length > 0 && id.length <= 200
}
