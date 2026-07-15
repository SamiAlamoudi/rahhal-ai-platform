/**
 * Domain → Notification delivery bridge (library-level).
 *
 * Accepts ids + display summaries only. Booking / Payment / Ticketing /
 * TravelAgent remain provider-blind — this module never imports vendor SDKs.
 */

import type { NotificationOrchestrator } from './notificationOrchestrator'
import type { DeliverResult } from './notificationOrchestrator'
import type {
  NotificationChannel,
  NotificationEventType,
  NotificationRecipient,
} from './types'

export interface NotificationBridgeRecipient {
  userId: string
  displayName?: string | null
  email?: string | null
  phoneE164?: string | null
  locale?: 'ar' | 'en'
}

export interface BookingNotificationInput {
  recipient: NotificationBridgeRecipient
  bookingSessionId: string
  orderId?: string | null
  bookingReference?: string | null
  orderNumber?: string | null
  channels?: NotificationChannel[]
}

export interface PaymentNotificationInput {
  recipient: NotificationBridgeRecipient
  paymentSessionId: string
  orderId?: string | null
  orderNumber?: string | null
  amount?: string | null
  currency?: string | null
  channels?: NotificationChannel[]
}

export interface TicketNotificationInput {
  recipient: NotificationBridgeRecipient
  ticketSessionId: string
  orderId?: string | null
  orderNumber?: string | null
  confirmationNumber?: string | null
  bookingSessionId?: string | null
  channels?: NotificationChannel[]
  extraNote?: string | null
}

export interface TripNotificationInput {
  recipient: NotificationBridgeRecipient
  tripPlanId: string
  tripTitle?: string | null
  destination?: string | null
  extraNote?: string | null
  channels?: NotificationChannel[]
}

function toRecipient(input: NotificationBridgeRecipient): NotificationRecipient {
  return {
    userId: input.userId,
    displayName: input.displayName ?? null,
    email: input.email ?? null,
    phoneE164: input.phoneE164 ?? null,
    locale: input.locale ?? 'en',
  }
}

async function dispatch(
  orchestrator: NotificationOrchestrator,
  eventType: NotificationEventType,
  recipient: NotificationBridgeRecipient,
  related: {
    bookingSessionId?: string | null
    orderId?: string | null
    paymentSessionId?: string | null
    ticketSessionId?: string | null
    tripPlanId?: string | null
  },
  templateContext: {
    bookingReference?: string | null
    orderNumber?: string | null
    confirmationNumber?: string | null
    amount?: string | null
    currency?: string | null
    destination?: string | null
    tripTitle?: string | null
    extraNote?: string | null
    userName?: string | null
  },
  channels?: NotificationChannel[],
): Promise<DeliverResult> {
  return orchestrator.notify({
    eventType,
    recipient: toRecipient(recipient),
    channels,
    related,
    templateContext: {
      ...templateContext,
      userName: templateContext.userName ?? recipient.displayName,
    },
  })
}

export function notifyBookingConfirmed(
  orchestrator: NotificationOrchestrator,
  input: BookingNotificationInput,
): Promise<DeliverResult> {
  return dispatch(
    orchestrator,
    'booking_confirmed',
    input.recipient,
    {
      bookingSessionId: input.bookingSessionId,
      orderId: input.orderId ?? null,
    },
    {
      bookingReference: input.bookingReference ?? null,
      orderNumber: input.orderNumber ?? null,
    },
    input.channels,
  )
}

export function notifyBookingCancelled(
  orchestrator: NotificationOrchestrator,
  input: BookingNotificationInput & { extraNote?: string | null },
): Promise<DeliverResult> {
  return dispatch(
    orchestrator,
    'booking_cancelled',
    input.recipient,
    {
      bookingSessionId: input.bookingSessionId,
      orderId: input.orderId ?? null,
    },
    {
      bookingReference: input.bookingReference ?? null,
      orderNumber: input.orderNumber ?? null,
      extraNote: input.extraNote ?? null,
    },
    input.channels,
  )
}

export function notifyPaymentCaptured(
  orchestrator: NotificationOrchestrator,
  input: PaymentNotificationInput,
): Promise<DeliverResult> {
  return dispatch(
    orchestrator,
    'payment_captured',
    input.recipient,
    {
      paymentSessionId: input.paymentSessionId,
      orderId: input.orderId ?? null,
    },
    {
      orderNumber: input.orderNumber ?? null,
      amount: input.amount ?? null,
      currency: input.currency ?? null,
    },
    input.channels,
  )
}

export function notifyPaymentFailed(
  orchestrator: NotificationOrchestrator,
  input: PaymentNotificationInput,
): Promise<DeliverResult> {
  return dispatch(
    orchestrator,
    'payment_failed',
    input.recipient,
    {
      paymentSessionId: input.paymentSessionId,
      orderId: input.orderId ?? null,
    },
    {
      orderNumber: input.orderNumber ?? null,
      amount: input.amount ?? null,
      currency: input.currency ?? null,
    },
    input.channels,
  )
}

export function notifyTicketIssued(
  orchestrator: NotificationOrchestrator,
  input: TicketNotificationInput,
): Promise<DeliverResult> {
  return dispatch(
    orchestrator,
    'ticket_issued',
    input.recipient,
    {
      ticketSessionId: input.ticketSessionId,
      orderId: input.orderId ?? null,
      bookingSessionId: input.bookingSessionId ?? null,
    },
    {
      confirmationNumber: input.confirmationNumber ?? null,
      orderNumber: input.orderNumber ?? null,
    },
    input.channels,
  )
}

export function notifyTicketPartial(
  orchestrator: NotificationOrchestrator,
  input: TicketNotificationInput,
): Promise<DeliverResult> {
  return dispatch(
    orchestrator,
    'ticket_partial',
    input.recipient,
    {
      ticketSessionId: input.ticketSessionId,
      orderId: input.orderId ?? null,
      bookingSessionId: input.bookingSessionId ?? null,
    },
    {
      orderNumber: input.orderNumber ?? null,
      confirmationNumber: input.confirmationNumber ?? null,
      extraNote: input.extraNote ?? null,
    },
    input.channels,
  )
}

export function notifyTicketFailed(
  orchestrator: NotificationOrchestrator,
  input: TicketNotificationInput,
): Promise<DeliverResult> {
  return dispatch(
    orchestrator,
    'ticket_failed',
    input.recipient,
    {
      ticketSessionId: input.ticketSessionId,
      orderId: input.orderId ?? null,
      bookingSessionId: input.bookingSessionId ?? null,
    },
    {
      orderNumber: input.orderNumber ?? null,
      extraNote: input.extraNote ?? null,
    },
    input.channels,
  )
}

export function notifyTripReminder(
  orchestrator: NotificationOrchestrator,
  input: TripNotificationInput,
): Promise<DeliverResult> {
  return dispatch(
    orchestrator,
    'trip_reminder',
    input.recipient,
    { tripPlanId: input.tripPlanId },
    {
      tripTitle: input.tripTitle ?? null,
      destination: input.destination ?? null,
      extraNote: input.extraNote ?? null,
    },
    input.channels,
  )
}

export function notifyTripUpdated(
  orchestrator: NotificationOrchestrator,
  input: TripNotificationInput,
): Promise<DeliverResult> {
  return dispatch(
    orchestrator,
    'trip_updated',
    input.recipient,
    { tripPlanId: input.tripPlanId },
    {
      tripTitle: input.tripTitle ?? null,
      destination: input.destination ?? null,
      extraNote: input.extraNote ?? null,
    },
    input.channels,
  )
}
