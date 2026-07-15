import { sanitizeAuditMetadata } from './privacy'
import type {
  NotificationAuditEvent,
  NotificationChannel,
  NotificationDeliveryStatus,
} from './types'

function id(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `naud_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function appendNotificationAudit(
  events: NotificationAuditEvent[],
  input: {
    type: string
    message: string
    channel?: NotificationChannel | null
    fromStatus?: NotificationDeliveryStatus | null
    toStatus?: NotificationDeliveryStatus | null
    metadata?: Record<string, unknown>
  },
): NotificationAuditEvent[] {
  return [...events, {
    id: id(),
    at: new Date().toISOString(),
    type: input.type,
    message: input.message,
    channel: input.channel ?? null,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    metadata: sanitizeAuditMetadata(input.metadata),
  }]
}
