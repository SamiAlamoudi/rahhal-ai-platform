/**
 * NotificationOrchestrator — Phase U notifications & delivery engine.
 *
 * Queues and delivers booking / payment / ticketing / trip updates via
 * mock email, SMS, and WhatsApp providers. Domain layers stay provider-blind.
 */

import { appendNotificationAudit } from './audit'
import { MockEmailProvider } from './mockEmailProvider'
import { MockSmsProvider } from './mockSmsProvider'
import { MockWhatsAppProvider } from './mockWhatsAppProvider'
import type {
  NotificationProviderAdapter,
  NotificationSendResult,
} from './notificationProviderAdapter'
import {
  assertCanTransitionNotificationSession,
  canTransitionNotificationSession,
  isTerminalNotificationStatus,
  resolveNotificationSessionEvent,
  type NotificationSessionEvent,
} from './notificationSessionStateMachine'
import { renderNotificationContent, type TemplateContext } from './templates'
import type {
  NotificationChannel,
  NotificationChannelAttempt,
  NotificationDeliveryStatus,
  NotificationEventType,
  NotificationRecipient,
  NotificationSession,
} from './types'

export interface NotificationOrchestratorOptions {
  emailProvider?: NotificationProviderAdapter
  smsProvider?: NotificationProviderAdapter
  whatsappProvider?: NotificationProviderAdapter
  /** Default TTL for sessions awaiting delivery. */
  ttlMs?: number
  maxAttemptsPerChannel?: number
}

export interface EnqueueNotificationInput {
  eventType: NotificationEventType
  recipient: NotificationRecipient
  /** Defaults to email when recipient has email; otherwise sms/whatsapp when phone present. */
  channels?: NotificationChannel[]
  templateContext?: Omit<TemplateContext, 'locale'>
  related?: Partial<NotificationSession['related']>
  /** Prevents duplicate sends for the same logical event. Auto-derived when omitted. */
  dedupeKey?: string
  /** Force channel failures (tests / ops). */
  forceFailChannels?: NotificationChannel[]
  expiresAt?: string
}

export interface DeliverResult {
  success: boolean
  delivered: boolean
  session: NotificationSession | null
  message: string
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function cloneSession(session: NotificationSession): NotificationSession {
  return structuredClone(session)
}

function defaultChannels(recipient: NotificationRecipient): NotificationChannel[] {
  const channels: NotificationChannel[] = []
  if (recipient.email) channels.push('email')
  if (recipient.phoneE164) {
    channels.push('sms')
    channels.push('whatsapp')
  }
  if (!channels.length && recipient.email) channels.push('email')
  if (!channels.length) channels.push('email')
  return channels
}

function buildDedupeKey(input: EnqueueNotificationInput, channels: NotificationChannel[]): string {
  if (input.dedupeKey) return input.dedupeKey
  const related = input.related ?? {}
  return [
    input.eventType,
    input.recipient.userId,
    related.bookingSessionId ?? '',
    related.orderId ?? '',
    related.paymentSessionId ?? '',
    related.ticketSessionId ?? '',
    related.tripPlanId ?? '',
    channels.slice().sort().join(','),
  ].join(':')
}

export class NotificationOrchestrator {
  private readonly providers: Record<NotificationChannel, NotificationProviderAdapter>
  private readonly ttlMs: number
  private readonly maxAttemptsPerChannel: number
  private readonly sessions = new Map<string, NotificationSession>()
  private readonly dedupeIndex = new Map<string, string>()
  private readonly forceFailBySession = new Map<string, Set<NotificationChannel>>()

  constructor(options: NotificationOrchestratorOptions = {}) {
    this.providers = {
      email: options.emailProvider ?? new MockEmailProvider(),
      sms: options.smsProvider ?? new MockSmsProvider(),
      whatsapp: options.whatsappProvider ?? new MockWhatsAppProvider(),
    }
    this.ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000
    this.maxAttemptsPerChannel = options.maxAttemptsPerChannel ?? 3
  }

  getSession(sessionId: string): NotificationSession | null {
    const session = this.sessions.get(sessionId)
    return session ? cloneSession(session) : null
  }

  getSessionByDedupeKey(dedupeKey: string): NotificationSession | null {
    const id = this.dedupeIndex.get(dedupeKey)
    return id ? this.getSession(id) : null
  }

  listSessions(): NotificationSession[] {
    return [...this.sessions.values()].map(cloneSession)
  }

  /**
   * Create + queue a notification. Duplicate dedupeKey returns the existing session.
   */
  enqueue(input: EnqueueNotificationInput): DeliverResult {
    const channels = [...new Set(input.channels?.length ? input.channels : defaultChannels(input.recipient))]
    if (!channels.length) {
      return {
        success: false,
        delivered: false,
        session: null,
        message: 'At least one delivery channel is required',
      }
    }

    const dedupeKey = buildDedupeKey(input, channels)
    const existingId = this.dedupeIndex.get(dedupeKey)
    if (existingId) {
      const existing = this.sessions.get(existingId)
      if (existing && existing.status !== 'cancelled' && existing.status !== 'expired') {
        return {
          success: true,
          delivered: existing.status === 'delivered',
          session: cloneSession(existing),
          message: 'Duplicate notification prevented (dedupe)',
        }
      }
    }

    const now = nowIso()
    const content = renderNotificationContent(input.eventType, {
      locale: input.recipient.locale,
      ...input.templateContext,
      userName: input.templateContext?.userName ?? input.recipient.displayName,
    })

    const attempts: NotificationChannelAttempt[] = channels.map((channel) => ({
      id: generateId('natt'),
      channel,
      providerId: this.providers[channel].providerId,
      status: 'created',
      attemptCount: 0,
      providerMessageId: null,
      error: null,
      sentAt: null,
      deliveredAt: null,
      updatedAt: now,
    }))

    let session: NotificationSession = {
      id: generateId('notif'),
      eventType: input.eventType,
      status: 'created',
      recipient: { ...input.recipient },
      content,
      channels,
      attempts,
      related: {
        bookingSessionId: input.related?.bookingSessionId ?? null,
        orderId: input.related?.orderId ?? null,
        paymentSessionId: input.related?.paymentSessionId ?? null,
        ticketSessionId: input.related?.ticketSessionId ?? null,
        tripPlanId: input.related?.tripPlanId ?? null,
      },
      dedupeKey,
      audit: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt ?? new Date(Date.now() + this.ttlMs).toISOString(),
      queuedAt: null,
      sentAt: null,
      deliveredAt: null,
    }

    session = this.applyEvent(session, 'queue', 'notification.created_queued', 'Notification session created and queued')
    if (input.forceFailChannels?.length) {
      session = {
        ...session,
        audit: appendNotificationAudit(session.audit, {
          type: 'notification.force_fail_channels',
          message: 'Force-fail channels configured',
          metadata: { channels: input.forceFailChannels },
        }),
      }
    }
    this.forceFailBySession.set(session.id, new Set(input.forceFailChannels ?? []))

    this.sessions.set(session.id, session)
    this.dedupeIndex.set(dedupeKey, session.id)
    return {
      success: true,
      delivered: false,
      session: cloneSession(session),
      message: 'Notification queued',
    }
  }

  /** Queue then immediately attempt delivery on all channels. */
  async notify(input: EnqueueNotificationInput): Promise<DeliverResult> {
    const enqueued = this.enqueue(input)
    if (!enqueued.session) return enqueued
    if (enqueued.message.includes('Duplicate')) return enqueued
    return this.deliver(enqueued.session.id)
  }

  async deliver(sessionId: string): Promise<DeliverResult> {
    const current = this.sessions.get(sessionId)
    if (!current) {
      return { success: false, delivered: false, session: null, message: 'Unknown notification session' }
    }

    if (current.status === 'delivered') {
      return { success: true, delivered: true, session: cloneSession(current), message: 'Already delivered' }
    }

    if (current.status === 'cancelled' || current.status === 'expired') {
      return {
        success: false,
        delivered: false,
        session: cloneSession(current),
        message: `Cannot deliver session in status ${current.status}`,
      }
    }

    if (new Date(current.expiresAt).getTime() < Date.now()
      && (current.status === 'created' || current.status === 'queued' || current.status === 'failed' || current.status === 'bounced')) {
      const expired = this.applyEvent(current, 'expire', 'notification.expired', 'Notification expired before delivery')
      this.sessions.set(sessionId, expired)
      return {
        success: false,
        delivered: false,
        session: cloneSession(expired),
        message: 'Notification expired',
      }
    }

    // failed/bounced → re-queue for retry
    let session = current
    if (session.status === 'failed' || session.status === 'bounced') {
      session = this.applyEvent(session, 'queue', 'notification.retry_queued', 'Re-queued for retry')
    }

    if (session.status !== 'queued' && session.status !== 'sending') {
      if (session.status === 'created') {
        session = this.applyEvent(session, 'queue', 'notification.queued', 'Queued for delivery')
      }
    }

    if (session.status !== 'queued') {
      this.sessions.set(sessionId, session)
      return {
        success: false,
        delivered: false,
        session: cloneSession(session),
        message: `Cannot start sending from status ${session.status}`,
      }
    }

    session = this.applyEvent(session, 'start_sending', 'notification.sending', 'Delivery started')
    this.sessions.set(sessionId, session)

    const forceFail = this.forceFailBySession.get(sessionId) ?? new Set()
    const channelResults: NotificationSendResult[] = []

    for (let i = 0; i < session.attempts.length; i += 1) {
      const attempt = session.attempts[i]
      const provider = this.providers[attempt.channel]
      const force = forceFail.has(attempt.channel)
      const seed = `${session.dedupeKey}:${session.id}`

      let result: NotificationSendResult
      try {
        result = await provider.send({
          notificationSessionId: session.id,
          attemptId: attempt.id,
          channel: attempt.channel,
          recipient: session.recipient,
          content: session.content,
          seed,
          forceFail: force,
        })
      } catch (err) {
        result = {
          success: false,
          channel: attempt.channel,
          providerMessageId: null,
          delivered: false,
          message: err instanceof Error ? err.message : String(err),
        }
      }
      channelResults.push(result)

      const updatedAttempt: NotificationChannelAttempt = {
        ...attempt,
        attemptCount: attempt.attemptCount + 1,
        providerId: provider.providerId,
        status: result.success
          ? (result.delivered ? 'delivered' : 'sent')
          : (result.message.toLowerCase().includes('bounce') ? 'bounced' : 'failed'),
        providerMessageId: result.providerMessageId,
        error: result.success ? null : result.message,
        sentAt: result.success ? nowIso() : attempt.sentAt,
        deliveredAt: result.delivered ? nowIso() : null,
        updatedAt: nowIso(),
      }
      session.attempts[i] = updatedAttempt
      session.audit = appendNotificationAudit(session.audit, {
        type: result.success ? 'notification.channel_ok' : 'notification.channel_fail',
        message: result.message,
        channel: attempt.channel,
        fromStatus: session.status,
        toStatus: session.status,
        metadata: {
          providerId: provider.providerId,
          providerMessageId: result.providerMessageId,
          attemptCount: updatedAttempt.attemptCount,
        },
      })
      session.updatedAt = nowIso()
    }

    const allOk = channelResults.every((r) => r.success)
    const anyBounce = session.attempts.some((a) => a.status === 'bounced')
    const canRetry = session.attempts.some(
      (a) => (a.status === 'failed' || a.status === 'bounced')
        && a.attemptCount < this.maxAttemptsPerChannel,
    )

    if (allOk) {
      session = this.applyEvent(session, 'mark_sent', 'notification.sent', 'All channels sent')
      session = {
        ...session,
        sentAt: session.sentAt ?? nowIso(),
      }
      session = this.applyEvent(session, 'mark_delivered', 'notification.delivered', 'All channels delivered')
      session = {
        ...session,
        deliveredAt: nowIso(),
      }
      // clear forced failures after success path setup
      this.forceFailBySession.delete(sessionId)
      this.sessions.set(sessionId, session)
      return {
        success: true,
        delivered: true,
        session: cloneSession(session),
        message: 'Notification delivered',
      }
    }

    if (anyBounce && !canRetry) {
      session = this.applyEvent(session, 'bounce', 'notification.bounced', 'Delivery bounced')
      this.sessions.set(sessionId, session)
      return {
        success: false,
        delivered: false,
        session: cloneSession(session),
        message: 'Notification bounced',
      }
    }

    session = this.applyEvent(session, 'fail', 'notification.failed', 'One or more channels failed')
    this.sessions.set(sessionId, session)
    return {
      success: false,
      delivered: false,
      session: cloneSession(session),
      message: canRetry
        ? 'Delivery failed; session can be retried'
        : 'Delivery failed; max attempts reached',
    }
  }

  async retry(sessionId: string): Promise<DeliverResult> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return { success: false, delivered: false, session: null, message: 'Unknown notification session' }
    }
    if (session.status !== 'failed' && session.status !== 'bounced') {
      return {
        success: false,
        delivered: false,
        session: cloneSession(session),
        message: `Cannot retry from status ${session.status}`,
      }
    }
    const exhausted = session.attempts.every((a) => a.attemptCount >= this.maxAttemptsPerChannel)
    if (exhausted) {
      return {
        success: false,
        delivered: false,
        session: cloneSession(session),
        message: 'Max attempts reached for all channels',
      }
    }
    // Clear force-fail so retries can succeed unless caller re-sets them
    this.forceFailBySession.set(sessionId, new Set())
    return this.deliver(sessionId)
  }

  /** Retry while keeping forced channel failures (for tests). */
  async retryWithForceFail(
    sessionId: string,
    forceFailChannels: NotificationChannel[],
  ): Promise<DeliverResult> {
    this.forceFailBySession.set(sessionId, new Set(forceFailChannels))
    return this.retry(sessionId)
  }

  cancel(sessionId: string, reason?: string): DeliverResult {
    const current = this.sessions.get(sessionId)
    if (!current) {
      return { success: false, delivered: false, session: null, message: 'Unknown notification session' }
    }
    if (current.status === 'cancelled') {
      return { success: true, delivered: false, session: cloneSession(current), message: 'Already cancelled' }
    }
    if (current.status === 'delivered' || current.status === 'expired') {
      return {
        success: false,
        delivered: current.status === 'delivered',
        session: cloneSession(current),
        message: `Cannot cancel terminal session in status ${current.status}`,
      }
    }
    if (!canTransitionNotificationSession(current.status, 'cancelled')) {
      return {
        success: false,
        delivered: false,
        session: cloneSession(current),
        message: `Invalid cancel transition from ${current.status}`,
      }
    }
    const session = this.applyEvent(
      current,
      'cancel',
      'notification.cancelled',
      reason ? `Cancelled: ${reason}` : 'Notification cancelled',
    )
    this.sessions.set(sessionId, session)
    return { success: true, delivered: false, session: cloneSession(session), message: 'Notification cancelled' }
  }

  expire(sessionId: string): DeliverResult {
    const current = this.sessions.get(sessionId)
    if (!current) {
      return { success: false, delivered: false, session: null, message: 'Unknown notification session' }
    }
    if (isTerminalNotificationStatus(current.status)) {
      return {
        success: false,
        delivered: current.status === 'delivered',
        session: cloneSession(current),
        message: `Cannot expire terminal session in status ${current.status}`,
      }
    }
    if (!canTransitionNotificationSession(current.status, 'expired')) {
      return {
        success: false,
        delivered: false,
        session: cloneSession(current),
        message: `Invalid expire transition from ${current.status}`,
      }
    }
    const session = this.applyEvent(current, 'expire', 'notification.expired', 'Notification expired')
    this.sessions.set(sessionId, session)
    return { success: true, delivered: false, session: cloneSession(session), message: 'Notification expired' }
  }

  private applyEvent(
    session: NotificationSession,
    event: NotificationSessionEvent,
    auditType: string,
    message: string,
  ): NotificationSession {
    const nextStatus = resolveNotificationSessionEvent(session.status, event)
    if (nextStatus !== session.status) {
      assertCanTransitionNotificationSession(session.status, nextStatus)
    }
    const fromStatus: NotificationDeliveryStatus = session.status
    const queuedAt = event === 'queue' ? (session.queuedAt ?? nowIso()) : session.queuedAt
    return {
      ...session,
      status: nextStatus,
      updatedAt: nowIso(),
      queuedAt,
      audit: appendNotificationAudit(session.audit, {
        type: auditType,
        message,
        fromStatus,
        toStatus: nextStatus,
      }),
    }
  }
}

let defaultOrchestrator: NotificationOrchestrator | null = null

export function getNotificationOrchestrator(): NotificationOrchestrator {
  if (!defaultOrchestrator) {
    defaultOrchestrator = new NotificationOrchestrator()
  }
  return defaultOrchestrator
}

export function resetNotificationOrchestrator(): void {
  defaultOrchestrator = null
}
