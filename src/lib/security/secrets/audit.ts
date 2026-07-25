/**
 * Sprint 14 — in-memory secret access audit (redacted only).
 */

import type { SecretAccessEvent } from './types'
import { redactSecret } from './redact'

const events: SecretAccessEvent[] = []
const MAX = 200

export function recordSecretAccess(input: {
  key: string
  present: boolean
  caller: string
  value?: string | null
}): SecretAccessEvent {
  const event: SecretAccessEvent = {
    at: new Date().toISOString(),
    key: input.key,
    present: input.present,
    caller: input.caller,
    redactedPreview: input.present ? redactSecret(input.value) : null,
  }
  events.push(event)
  if (events.length > MAX) events.splice(0, events.length - MAX)
  return event
}

export function listSecretAccessEvents(): SecretAccessEvent[] {
  return [...events]
}

export function resetSecretAccessAuditForTests(): void {
  events.length = 0
}
