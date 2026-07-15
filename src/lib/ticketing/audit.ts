import { sanitizeAuditMetadata } from './privacy'
import type { TicketAuditEvent, TicketLineStatus, TicketSessionStatus } from './types'

function id(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `aud_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function appendAudit(
  events: TicketAuditEvent[],
  input: {
    type: string
    message: string
    fromStatus?: TicketSessionStatus | TicketLineStatus | null
    toStatus?: TicketSessionStatus | TicketLineStatus | null
    lineId?: string | null
    metadata?: Record<string, unknown>
  },
): TicketAuditEvent[] {
  const event: TicketAuditEvent = {
    id: id(),
    at: new Date().toISOString(),
    type: input.type,
    message: input.message,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    lineId: input.lineId ?? null,
    metadata: sanitizeAuditMetadata(input.metadata),
  }
  return [...events, event]
}
