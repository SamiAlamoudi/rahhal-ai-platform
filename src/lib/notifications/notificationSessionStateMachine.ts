/**
 * Notification delivery state machine.
 * Created → Queued → Sending → Sent → Delivered
 * Failures: Failed | Expired | Cancelled | Bounced
 */

import type { NotificationDeliveryStatus } from './types'

export type NotificationSessionEvent =
  | 'queue'
  | 'start_sending'
  | 'mark_sent'
  | 'mark_delivered'
  | 'fail'
  | 'expire'
  | 'cancel'
  | 'bounce'

export const NOTIFICATION_SESSION_TRANSITIONS: Readonly<
  Record<NotificationDeliveryStatus, readonly NotificationDeliveryStatus[]>
> = {
  created: ['queued', 'cancelled', 'expired'],
  queued: ['sending', 'cancelled', 'expired', 'failed'],
  sending: ['sent', 'failed', 'cancelled', 'bounced'],
  sent: ['delivered', 'failed', 'bounced'],
  delivered: [],
  failed: ['queued', 'cancelled'],
  expired: [],
  cancelled: [],
  bounced: ['queued', 'cancelled'],
}

export class NotificationSessionTransitionError extends Error {
  readonly code = 'invalid_notification_transition'
  readonly from: NotificationDeliveryStatus
  readonly to: NotificationDeliveryStatus

  constructor(from: NotificationDeliveryStatus, to: NotificationDeliveryStatus) {
    super(`Invalid notification session transition: ${from} → ${to}`)
    this.name = 'NotificationSessionTransitionError'
    this.from = from
    this.to = to
  }
}

export function canTransitionNotificationSession(
  from: NotificationDeliveryStatus,
  to: NotificationDeliveryStatus,
): boolean {
  if (from === to) return true
  return NOTIFICATION_SESSION_TRANSITIONS[from].includes(to)
}

export function assertCanTransitionNotificationSession(
  from: NotificationDeliveryStatus,
  to: NotificationDeliveryStatus,
): void {
  if (!canTransitionNotificationSession(from, to)) {
    throw new NotificationSessionTransitionError(from, to)
  }
}

export function resolveNotificationSessionEvent(
  current: NotificationDeliveryStatus,
  event: NotificationSessionEvent,
): NotificationDeliveryStatus {
  switch (event) {
    case 'queue':
      return current === 'created' || current === 'failed' || current === 'bounced'
        ? 'queued'
        : current
    case 'start_sending':
      return 'sending'
    case 'mark_sent':
      return 'sent'
    case 'mark_delivered':
      return 'delivered'
    case 'fail':
      return 'failed'
    case 'expire':
      return 'expired'
    case 'cancel':
      return 'cancelled'
    case 'bounce':
      return 'bounced'
    default:
      return current
  }
}

export function isTerminalNotificationStatus(status: NotificationDeliveryStatus): boolean {
  return status === 'delivered'
    || status === 'expired'
    || status === 'cancelled'
}
