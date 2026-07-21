/**
 * Sprint 67 — production notification layer for beta.
 * Wraps existing mock channel providers with retry + delivery tracking.
 */

import {
  MockEmailProvider,
  MockSmsProvider,
  MockWhatsAppProvider,
} from '../../notifications'
import type {
  NotificationProviderAdapter,
  NotificationSendRequest,
  NotificationSendResult,
} from '../../notifications/notificationProviderAdapter'
import type { BetaNotificationChannel, BetaNotificationSlot } from './types'

export interface DeliveryAttemptRecord {
  id: string
  channel: BetaNotificationChannel
  at: string
  success: boolean
  attempt: number
  providerMessageId: string | null
  message: string
}

export interface ProductionNotificationLayer {
  slots: BetaNotificationSlot[]
  send: (
    channel: BetaNotificationChannel,
    request: Omit<NotificationSendRequest, 'channel'>,
  ) => Promise<NotificationSendResult>
  getDeliveryHistory: (channel?: BetaNotificationChannel) => DeliveryAttemptRecord[]
  reset: () => void
}

function withRetry(
  adapter: NotificationProviderAdapter,
  maxAttempts: number,
  history: DeliveryAttemptRecord[],
  channel: BetaNotificationChannel,
): NotificationProviderAdapter {
  return {
    providerId: adapter.providerId,
    displayName: adapter.displayName,
    channel: adapter.channel,
    getCapabilities: () => adapter.getCapabilities(),
    isAvailable: () => adapter.isAvailable(),
    async send(request) {
      let last: NotificationSendResult = {
        success: false,
        channel: adapter.channel,
        providerMessageId: null,
        delivered: false,
        message: 'not_attempted',
      }
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        last = await adapter.send({ ...request, seed: `${request.seed}-r${attempt}` })
        history.push({
          id: `del_${Date.now().toString(36)}_${attempt}`,
          channel,
          at: new Date().toISOString(),
          success: last.success,
          attempt,
          providerMessageId: last.providerMessageId,
          message: last.message,
        })
        if (last.success) return last
      }
      return last
    },
  }
}

function createPushStubAdapter(): NotificationProviderAdapter {
  return {
    providerId: 'push_stub',
    displayName: 'Push (future-ready stub)',
    channel: 'email',
    getCapabilities: () => ({
      providerId: 'push_stub',
      displayName: 'Push stub',
      channel: 'email',
      supportsDeliveryReceipts: true,
      mocked: true,
    }),
    isAvailable: () => true,
    async send(request) {
      return {
        success: true,
        channel: request.channel,
        providerMessageId: `push_${request.attemptId}`,
        delivered: true,
        message: 'push_stub_accepted',
      }
    },
  }
}

/** Create production notification layer (mock channels + push stub, with retry). */
export function createProductionNotificationLayer(options?: {
  maxRetries?: number
}): ProductionNotificationLayer {
  const maxRetries = options?.maxRetries ?? 3
  const history: DeliveryAttemptRecord[] = []

  const email = withRetry(new MockEmailProvider(), maxRetries, history, 'email')
  const sms = withRetry(new MockSmsProvider(), maxRetries, history, 'sms')
  const whatsapp = withRetry(new MockWhatsAppProvider(), maxRetries, history, 'whatsapp')
  const push = withRetry(createPushStubAdapter(), maxRetries, history, 'push')

  const adapters: Record<BetaNotificationChannel, NotificationProviderAdapter> = {
    email,
    sms,
    whatsapp,
    push,
  }

  const slots: BetaNotificationSlot[] = [
    {
      channel: 'email',
      providerId: email.providerId,
      available: email.isAvailable(),
      mocked: true,
      supportsRetry: true,
      supportsDeliveryTracking: true,
      notes: 'Mock email with retry + delivery history',
    },
    {
      channel: 'whatsapp',
      providerId: whatsapp.providerId,
      available: whatsapp.isAvailable(),
      mocked: true,
      supportsRetry: true,
      supportsDeliveryTracking: true,
      notes: 'Mock WhatsApp with retry + delivery history',
    },
    {
      channel: 'push',
      providerId: 'push_stub',
      available: true,
      mocked: true,
      supportsRetry: true,
      supportsDeliveryTracking: true,
      notes: 'Future-ready push stub',
    },
    {
      channel: 'sms',
      providerId: sms.providerId,
      available: sms.isAvailable(),
      mocked: true,
      supportsRetry: true,
      supportsDeliveryTracking: true,
      notes: 'Mock SMS with retry + delivery history',
    },
  ]

  return {
    slots,
    async send(channel, request) {
      const adapter = adapters[channel]
      return adapter.send({ ...request, channel: adapter.channel })
    },
    getDeliveryHistory(channel) {
      return channel ? history.filter((h) => h.channel === channel) : [...history]
    },
    reset() {
      history.length = 0
    },
  }
}

export function buildBetaNotificationMatrix(): BetaNotificationSlot[] {
  return createProductionNotificationLayer().slots
}
