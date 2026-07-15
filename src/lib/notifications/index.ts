export type {
  NotificationChannel,
  NotificationEventType,
  NotificationDeliveryStatus,
  NotificationRecipient,
  NotificationContent,
  NotificationChannelAttempt,
  NotificationAuditEvent,
  NotificationSession,
} from './types'
export {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_CHANNELS,
} from './types'

export type {
  NotificationProviderAdapter,
  NotificationProviderCapabilities,
  NotificationSendRequest,
  NotificationSendResult,
} from './notificationProviderAdapter'

export {
  NOTIFICATION_SESSION_TRANSITIONS,
  NotificationSessionTransitionError,
  canTransitionNotificationSession,
  assertCanTransitionNotificationSession,
  resolveNotificationSessionEvent,
  isTerminalNotificationStatus,
  type NotificationSessionEvent,
} from './notificationSessionStateMachine'

export { MockEmailProvider } from './mockEmailProvider'
export { MockSmsProvider } from './mockSmsProvider'
export { MockWhatsAppProvider, MockWhatsApp } from './mockWhatsAppProvider'

export {
  renderNotificationContent,
  type TemplateContext,
} from './templates'

export {
  NotificationOrchestrator,
  getNotificationOrchestrator,
  resetNotificationOrchestrator,
  type NotificationOrchestratorOptions,
  type EnqueueNotificationInput,
  type DeliverResult,
} from './notificationOrchestrator'

export {
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyPaymentCaptured,
  notifyPaymentFailed,
  notifyTicketIssued,
  notifyTicketPartial,
  notifyTicketFailed,
  notifyTripReminder,
  notifyTripUpdated,
  type NotificationBridgeRecipient,
  type BookingNotificationInput,
  type PaymentNotificationInput,
  type TicketNotificationInput,
  type TripNotificationInput,
} from './deliveryBridge'

export {
  maskEmail,
  maskPhone,
  sanitizeAuditMetadata,
  stableHash,
} from './privacy'
