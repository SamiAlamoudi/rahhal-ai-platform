/**
 * Sprint 14 — secret redaction helpers.
 */

import { REDACTED_PLACEHOLDER } from './types'

export function redactSecret(value: string | null | undefined): string | null {
  if (value == null) return null
  const v = String(value)
  if (!v) return null
  return REDACTED_PLACEHOLDER
}

export function assertNoSecretLeak(payload: unknown, secrets: string[]): void {
  const text = JSON.stringify(payload)
  for (const secret of secrets) {
    if (secret && secret.length >= 8 && text.includes(secret)) {
      throw new Error('Secret material must never appear in outbound payloads')
    }
  }
}
