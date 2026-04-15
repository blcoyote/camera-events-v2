import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto'
import { getSessionConfig } from '#/features/shared/server/session'

/**
 * Derive a 256-bit encryption key from the session secret.
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

/**
 * Encrypt the OAuth state cookie payload using AES-256-GCM.
 * Returns base64-encoded: IV (12 bytes) + auth tag (16 bytes) + ciphertext.
 */
export function encryptOAuthState(plaintext: string): string {
  const { password } = getSessionConfig()
  const key = deriveKey(password)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypt the OAuth state cookie payload.
 * Returns null if decryption fails (tampered or wrong key).
 */
export function decryptOAuthState(ciphertext: string): string | null {
  try {
    const { password } = getSessionConfig()
    const key = deriveKey(password)
    const data = Buffer.from(ciphertext, 'base64')
    if (data.length < 28) return null // minimum: 12 (iv) + 16 (tag)
    const iv = data.subarray(0, 12)
    const tag = data.subarray(12, 28)
    const encrypted = data.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch {
    return null
  }
}
