import { sanitizeAuditMetadata } from './privacy'
import type { ManagedTripStatus, TripAuditEvent } from './types'

function id(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `taud_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function appendTripAudit(
  events: TripAuditEvent[],
  input: {
    type: string
    message: string
    fromStatus?: ManagedTripStatus | null
    toStatus?: ManagedTripStatus | null
    actorUserId?: string | null
    metadata?: Record<string, unknown>
  },
): TripAuditEvent[] {
  return [...events, {
    id: id(),
    at: new Date().toISOString(),
    type: input.type,
    message: input.message,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    actorUserId: input.actorUserId ?? null,
    metadata: sanitizeAuditMetadata(input.metadata),
  }]
}
