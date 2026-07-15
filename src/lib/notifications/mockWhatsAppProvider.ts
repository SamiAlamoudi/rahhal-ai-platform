import { stableHash } from './privacy'
import type {
  NotificationProviderAdapter,
  NotificationProviderCapabilities,
  NotificationSendRequest,
  NotificationSendResult,
} from './notificationProviderAdapter'

/** MockWhatsApp provider — deterministic WhatsApp Business-style delivery for tests. */
export class MockWhatsAppProvider implements NotificationProviderAdapter {
  readonly providerId = 'mock_whatsapp'
  readonly displayName = 'Mock WhatsApp Provider'
  readonly channel = 'whatsapp' as const

  getCapabilities(): NotificationProviderCapabilities {
    return {
      providerId: this.providerId,
      displayName: this.displayName,
      channel: 'whatsapp',
      supportsDeliveryReceipts: true,
      mocked: true,
    }
  }

  isAvailable(): boolean {
    return true
  }

  async send(request: NotificationSendRequest): Promise<NotificationSendResult> {
    if (!request.recipient.phoneE164) {
      return {
        success: false,
        channel: 'whatsapp',
        providerMessageId: null,
        delivered: false,
        message: 'Missing recipient phone for WhatsApp',
      }
    }
    if (request.forceFail) {
      return {
        success: false,
        channel: 'whatsapp',
        providerMessageId: null,
        delivered: false,
        message: 'Mock WhatsApp send failed (forced)',
      }
    }
    const hash = stableHash(`${request.seed}:${request.attemptId}:whatsapp`)
    return {
      success: true,
      channel: 'whatsapp',
      providerMessageId: `WA-${hash.toString(36).toUpperCase()}`,
      delivered: true,
      message: 'WhatsApp message delivered (mock)',
    }
  }
}

/** Alias matching Phase U naming (MockWhatsApp). */
export { MockWhatsAppProvider as MockWhatsApp }
