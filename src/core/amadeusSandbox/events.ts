/**
 * Sprint 92 — Amadeus sandbox observability events (no secrets).
 */

import type { AmadeusProviderEvent, AmadeusProviderEventName } from './types'
import { AMADEUS_SANDBOX_PROVIDER_ID } from './types'

const listeners = new Set<(event: AmadeusProviderEvent) => void>()

export function onAmadeusProviderEvent(
  listener: (event: AmadeusProviderEvent) => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetAmadeusProviderEventListeners(): void {
  listeners.clear()
}

export function emitAmadeusProviderEvent(
  name: AmadeusProviderEventName,
  detail: Record<string, unknown> = {},
  events?: AmadeusProviderEvent[],
): void {
  const event: AmadeusProviderEvent = {
    name,
    at: new Date().toISOString(),
    providerId: AMADEUS_SANDBOX_PROVIDER_ID,
    detail: sanitizeDetail(detail),
  }
  events?.push(event)
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      /* ignore listener errors */
    }
  }
}

function sanitizeDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(detail)) {
    const lower = key.toLowerCase()
    if (
      lower.includes('secret')
      || lower.includes('password')
      || lower.includes('token')
      || lower.includes('authorization')
      || lower.includes('client_secret')
      || lower.includes('api_key')
    ) {
      out[key] = '[redacted]'
      continue
    }
    out[key] = value
  }
  return out
}
