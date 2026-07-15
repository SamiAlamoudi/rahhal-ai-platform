import { describe, it, expect, beforeEach } from 'vitest'
import {
  NotificationOrchestrator,
  resetNotificationOrchestrator,
  canTransitionNotificationSession,
  assertCanTransitionNotificationSession,
  NotificationSessionTransitionError,
  NOTIFICATION_SESSION_TRANSITIONS,
  MockEmailProvider,
  MockSmsProvider,
  MockWhatsApp,
  MockWhatsAppProvider,
  maskEmail,
  maskPhone,
  sanitizeAuditMetadata,
  renderNotificationContent,
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyPaymentCaptured,
  notifyPaymentFailed,
  notifyTicketIssued,
  notifyTicketPartial,
  notifyTicketFailed,
  notifyTripUpdated,
  notifyTripReminder,
} from '../notifications'
import type { NotificationRecipient } from '../notifications'

function recipient(overrides: Partial<NotificationRecipient> = {}): NotificationRecipient {
  return {
    userId: 'user-1',
    displayName: 'Ahmed Al-Saud',
    email: 'ahmed@example.com',
    phoneE164: '+966501234567',
    locale: 'en',
    ...overrides,
  }
}

describe('Phase U NotificationSession state machine', () => {
  it('allows Created → Queued → Sending → Sent → Delivered', () => {
    expect(canTransitionNotificationSession('created', 'queued')).toBe(true)
    expect(canTransitionNotificationSession('queued', 'sending')).toBe(true)
    expect(canTransitionNotificationSession('sending', 'sent')).toBe(true)
    expect(canTransitionNotificationSession('sent', 'delivered')).toBe(true)
    expect(NOTIFICATION_SESSION_TRANSITIONS.delivered).toEqual([])
  })

  it('allows retry path Failed → Queued and Bounced → Queued', () => {
    expect(canTransitionNotificationSession('failed', 'queued')).toBe(true)
    expect(canTransitionNotificationSession('bounced', 'queued')).toBe(true)
  })

  it('rejects invalid state transitions', () => {
    expect(canTransitionNotificationSession('delivered', 'queued')).toBe(false)
    expect(canTransitionNotificationSession('expired', 'sending')).toBe(false)
    expect(() => assertCanTransitionNotificationSession('delivered', 'sending')).toThrow(
      NotificationSessionTransitionError,
    )
  })
})

describe('Phase U privacy / audit masking', () => {
  it('masks email and phone; redacts sensitive audit keys', () => {
    expect(maskEmail('ahmed@example.com')).toBe('a***@example.com')
    expect(maskPhone('+966501234567')).toBe('***4567')
    expect(sanitizeAuditMetadata({
      secret: 'x',
      token: 'y',
      providerId: 'mock_email',
      email: 'sara@example.com',
      phone: '+966509998877',
    })).toMatchObject({
      secret: '[redacted]',
      token: '[redacted]',
      providerId: 'mock_email',
      email: 's***@example.com',
      phone: '***8877',
    })
  })
})

describe('Phase U templates', () => {
  it('renders booking and payment templates in en and ar', () => {
    const en = renderNotificationContent('booking_confirmed', {
      locale: 'en',
      userName: 'Ahmed',
      bookingReference: 'BK-1',
      orderNumber: 'ORD-1',
    })
    expect(en.subject).toContain('BK-1')
    expect(en.bodyText).toContain('Ahmed')

    const ar = renderNotificationContent('payment_captured', {
      locale: 'ar',
      userName: 'أحمد',
      orderNumber: 'ORD-2',
      amount: '100',
      currency: 'SAR',
    })
    expect(ar.subject).toContain('ORD-2')
    expect(ar.bodyText).toContain('أحمد')
  })
})

describe('Phase U mock providers', () => {
  it('exposes MockEmail, MockSms, and MockWhatsApp adapters', () => {
    const email = new MockEmailProvider()
    const sms = new MockSmsProvider()
    const wa = new MockWhatsApp()
    expect(wa).toBeInstanceOf(MockWhatsAppProvider)
    expect(email.channel).toBe('email')
    expect(sms.channel).toBe('sms')
    expect(wa.channel).toBe('whatsapp')
    expect(email.getCapabilities().mocked).toBe(true)
  })

  it('returns deterministic provider message ids', async () => {
    const email = new MockEmailProvider()
    const r = recipient()
    const a = await email.send({
      notificationSessionId: 'n1',
      attemptId: 'a1',
      channel: 'email',
      recipient: r,
      content: renderNotificationContent('generic', { locale: 'en', extraNote: 'hi' }),
      seed: 'seed-1',
    })
    const b = await email.send({
      notificationSessionId: 'n1',
      attemptId: 'a1',
      channel: 'email',
      recipient: r,
      content: renderNotificationContent('generic', { locale: 'en', extraNote: 'hi' }),
      seed: 'seed-1',
    })
    expect(a.success).toBe(true)
    expect(a.providerMessageId).toBe(b.providerMessageId)
    expect(a.providerMessageId).toMatch(/^EM-/)
  })
})

describe('Phase U NotificationOrchestrator', () => {
  let notifications: NotificationOrchestrator

  beforeEach(() => {
    resetNotificationOrchestrator()
    notifications = new NotificationOrchestrator()
  })

  it('delivers email successfully Created→Queued→Sending→Sent→Delivered', async () => {
    const result = await notifications.notify({
      eventType: 'booking_confirmed',
      recipient: recipient(),
      channels: ['email'],
      templateContext: { bookingReference: 'BK-100', orderNumber: 'ORD-100' },
      related: { bookingSessionId: 'bs-1', orderId: 'ord-1' },
    })
    expect(result.success).toBe(true)
    expect(result.delivered).toBe(true)
    expect(result.session?.status).toBe('delivered')
    expect(result.session?.attempts[0]?.providerMessageId).toMatch(/^EM-/)
    const statuses = result.session!.audit
      .map((e) => e.toStatus)
      .filter(Boolean)
    expect(statuses).toEqual(expect.arrayContaining(['queued', 'sending', 'sent', 'delivered']))
  })

  it('delivers across email, sms, and whatsapp', async () => {
    const result = await notifications.notify({
      eventType: 'trip_updated',
      recipient: recipient(),
      channels: ['email', 'sms', 'whatsapp'],
      templateContext: { tripTitle: 'Tokyo Spring', destination: 'Tokyo' },
      related: { tripPlanId: 'trip-1' },
    })
    expect(result.success).toBe(true)
    expect(result.session?.attempts).toHaveLength(3)
    expect(result.session?.attempts.map((a) => a.status)).toEqual([
      'delivered',
      'delivered',
      'delivered',
    ])
    expect(result.session?.attempts.map((a) => a.providerId).sort()).toEqual([
      'mock_email',
      'mock_sms',
      'mock_whatsapp',
    ])
  })

  it('fails, then retries to delivered', async () => {
    const enqueued = notifications.enqueue({
      eventType: 'payment_failed',
      recipient: recipient(),
      channels: ['email'],
      forceFailChannels: ['email'],
      related: { paymentSessionId: 'pay-1', orderId: 'ord-1' },
      templateContext: { orderNumber: 'ORD-9' },
    })
    expect(enqueued.session?.status).toBe('queued')

    const failed = await notifications.deliver(enqueued.session!.id)
    expect(failed.success).toBe(false)
    expect(failed.session?.status).toBe('failed')
    expect(failed.session?.attempts[0]?.attemptCount).toBe(1)

    const retried = await notifications.retry(enqueued.session!.id)
    expect(retried.success).toBe(true)
    expect(retried.session?.status).toBe('delivered')
    expect(retried.session?.attempts[0]?.attemptCount).toBe(2)
  })

  it('dedupes identical notification events', async () => {
    const first = await notifications.notify({
      eventType: 'ticket_issued',
      recipient: recipient(),
      channels: ['email'],
      dedupeKey: 'ticket:ts-1:user-1',
      related: { ticketSessionId: 'ts-1', orderId: 'ord-1' },
      templateContext: { confirmationNumber: 'CNF-1', orderNumber: 'ORD-1' },
    })
    const second = await notifications.notify({
      eventType: 'ticket_issued',
      recipient: recipient(),
      channels: ['email'],
      dedupeKey: 'ticket:ts-1:user-1',
      related: { ticketSessionId: 'ts-1', orderId: 'ord-1' },
      templateContext: { confirmationNumber: 'CNF-1', orderNumber: 'ORD-1' },
    })
    expect(first.session?.id).toBe(second.session?.id)
    expect(second.message).toMatch(/Duplicate/i)
    expect(notifications.listSessions()).toHaveLength(1)
  })

  it('cancels a queued notification', () => {
    const enqueued = notifications.enqueue({
      eventType: 'generic',
      recipient: recipient(),
      channels: ['sms'],
      templateContext: { extraNote: 'hold' },
    })
    const cancelled = notifications.cancel(enqueued.session!.id, 'user requested')
    expect(cancelled.success).toBe(true)
    expect(cancelled.session?.status).toBe('cancelled')
  })

  it('expires a queued notification', () => {
    const enqueued = notifications.enqueue({
      eventType: 'trip_reminder',
      recipient: recipient(),
      channels: ['whatsapp'],
      templateContext: { destination: 'Jeddah', tripTitle: 'Weekend' },
      related: { tripPlanId: 'trip-2' },
    })
    const expired = notifications.expire(enqueued.session!.id)
    expect(expired.success).toBe(true)
    expect(expired.session?.status).toBe('expired')
  })

  it('fails channel when recipient contact is missing', async () => {
    const result = await notifications.notify({
      eventType: 'generic',
      recipient: recipient({ email: null }),
      channels: ['email'],
      templateContext: { extraNote: 'test' },
    })
    expect(result.success).toBe(false)
    expect(result.session?.status).toBe('failed')
    expect(result.session?.attempts[0]?.error).toMatch(/Missing recipient email/i)
  })
})

describe('Phase U delivery bridge', () => {
  let notifications: NotificationOrchestrator

  beforeEach(() => {
    resetNotificationOrchestrator()
    notifications = new NotificationOrchestrator()
  })

  const bridgeRecipient = {
    userId: 'user-1',
    displayName: 'Ahmed',
    email: 'ahmed@example.com',
    phoneE164: '+966501234567',
    locale: 'en' as const,
  }

  it('notifies booking confirmed and cancelled', async () => {
    const confirmed = await notifyBookingConfirmed(notifications, {
      recipient: bridgeRecipient,
      bookingSessionId: 'bs-1',
      orderId: 'ord-1',
      bookingReference: 'BKREF-1',
      orderNumber: 'ORD-1',
      channels: ['email'],
    })
    expect(confirmed.delivered).toBe(true)
    expect(confirmed.session?.eventType).toBe('booking_confirmed')

    const cancelled = await notifyBookingCancelled(notifications, {
      recipient: { ...bridgeRecipient, userId: 'user-2' },
      bookingSessionId: 'bs-2',
      bookingReference: 'BKREF-2',
      channels: ['email'],
      extraNote: 'Refund pending',
    })
    expect(cancelled.delivered).toBe(true)
    expect(cancelled.session?.eventType).toBe('booking_cancelled')
    expect(cancelled.session?.content.bodyText).toContain('Refund pending')
  })

  it('notifies payment captured and failed', async () => {
    const captured = await notifyPaymentCaptured(notifications, {
      recipient: bridgeRecipient,
      paymentSessionId: 'pay-1',
      orderId: 'ord-1',
      orderNumber: 'ORD-1',
      amount: '4200',
      currency: 'SAR',
      channels: ['email', 'sms'],
    })
    expect(captured.delivered).toBe(true)
    expect(captured.session?.eventType).toBe('payment_captured')
    expect(captured.session?.related.paymentSessionId).toBe('pay-1')

    const failed = await notifyPaymentFailed(notifications, {
      recipient: { ...bridgeRecipient, userId: 'user-3' },
      paymentSessionId: 'pay-2',
      orderNumber: 'ORD-2',
      channels: ['email'],
    })
    expect(failed.delivered).toBe(true)
    expect(failed.session?.eventType).toBe('payment_failed')
  })

  it('notifies ticket issued / partial / failed', async () => {
    const issued = await notifyTicketIssued(notifications, {
      recipient: bridgeRecipient,
      ticketSessionId: 'tkt-1',
      orderId: 'ord-1',
      confirmationNumber: 'CNF-99',
      orderNumber: 'ORD-1',
      channels: ['email'],
    })
    expect(issued.session?.eventType).toBe('ticket_issued')
    expect(issued.delivered).toBe(true)

    const partial = await notifyTicketPartial(notifications, {
      recipient: { ...bridgeRecipient, userId: 'user-4' },
      ticketSessionId: 'tkt-2',
      orderNumber: 'ORD-2',
      channels: ['sms'],
      extraNote: 'Hotel voucher pending',
    })
    expect(partial.session?.eventType).toBe('ticket_partial')

    const failed = await notifyTicketFailed(notifications, {
      recipient: { ...bridgeRecipient, userId: 'user-5' },
      ticketSessionId: 'tkt-3',
      orderNumber: 'ORD-3',
      channels: ['whatsapp'],
    })
    expect(failed.session?.eventType).toBe('ticket_failed')
  })

  it('notifies trip reminder and trip updated', async () => {
    const reminder = await notifyTripReminder(notifications, {
      recipient: bridgeRecipient,
      tripPlanId: 'trip-1',
      tripTitle: 'Riyadh Escape',
      destination: 'Riyadh',
      channels: ['whatsapp'],
    })
    expect(reminder.session?.eventType).toBe('trip_reminder')
    expect(reminder.delivered).toBe(true)

    const updated = await notifyTripUpdated(notifications, {
      recipient: { ...bridgeRecipient, userId: 'user-6' },
      tripPlanId: 'trip-2',
      tripTitle: 'Jeddah Weekend',
      extraNote: 'Day 2 museum swapped',
      channels: ['email'],
    })
    expect(updated.session?.eventType).toBe('trip_updated')
    expect(updated.session?.content.bodyText).toContain('museum')
  })
})
