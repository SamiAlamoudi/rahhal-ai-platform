/**
 * Phase U — Notifications & Delivery Engine domain models.
 * Mock channel providers only; no live email/SMS/WhatsApp APIs.
 */

export type NotificationChannel = 'email' | 'sms' | 'whatsapp'

export type NotificationEventType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'payment_captured'
  | 'payment_failed'
  | 'ticket_issued'
  | 'ticket_partial'
  | 'ticket_failed'
  | 'trip_reminder'
  | 'trip_updated'
  | 'generic'

export type NotificationDeliveryStatus =
  | 'created'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'bounced'

export interface NotificationRecipient {
  userId: string
  /** Display name only — never required for delivery. */
  displayName: string | null
  email: string | null
  phoneE164: string | null
  locale: 'ar' | 'en'
}

export interface NotificationContent {
  subject: string
  bodyText: string
  bodyHtml: string | null
  templateId: string
  variables: Record<string, string>
}

export interface NotificationChannelAttempt {
  id: string
  channel: NotificationChannel
  providerId: string
  status: NotificationDeliveryStatus
  attemptCount: number
  providerMessageId: string | null
  error: string | null
  sentAt: string | null
  deliveredAt: string | null
  updatedAt: string
}

export interface NotificationAuditEvent {
  id: string
  at: string
  type: string
  message: string
  channel: NotificationChannel | null
  fromStatus: NotificationDeliveryStatus | null
  toStatus: NotificationDeliveryStatus | null
  /** Sanitized metadata only. */
  metadata: Record<string, unknown>
}

export interface NotificationSession {
  id: string
  eventType: NotificationEventType
  status: NotificationDeliveryStatus
  recipient: NotificationRecipient
  content: NotificationContent
  channels: NotificationChannel[]
  attempts: NotificationChannelAttempt[]
  /** Links to upstream domain objects (ids only). */
  related: {
    bookingSessionId: string | null
    orderId: string | null
    paymentSessionId: string | null
    ticketSessionId: string | null
    tripPlanId: string | null
  }
  /** Dedup key to prevent duplicate sends for the same event+recipient. */
  dedupeKey: string
  audit: NotificationAuditEvent[]
  createdAt: string
  updatedAt: string
  expiresAt: string
  queuedAt: string | null
  sentAt: string | null
  deliveredAt: string | null
}

export const NOTIFICATION_EVENT_TYPES: readonly NotificationEventType[] = [
  'booking_confirmed',
  'booking_cancelled',
  'payment_captured',
  'payment_failed',
  'ticket_issued',
  'ticket_partial',
  'ticket_failed',
  'trip_reminder',
  'trip_updated',
  'generic',
] as const

export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = [
  'email',
  'sms',
  'whatsapp',
] as const
