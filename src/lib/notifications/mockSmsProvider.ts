import { stableHash } from './privacy'
import type {
  NotificationProviderAdapter,
  NotificationProviderCapabilities,
  NotificationSendRequest,
  NotificationSendResult,
} from './notificationProviderAdapter'

export class MockSmsProvider implements NotificationProviderAdapter {
  readonly providerId = 'mock_sms'
  readonly displayName = 'Mock SMS Provider'
  readonly channel = 'sms' as const

  getCapabilities(): NotificationProviderCapabilities {
    return {
      providerId: this.providerId,
      displayName: this.displayName,
      channel: 'sms',
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
        channel: 'sms',
        providerMessageId: null,
        delivered: false,
        message: 'Missing recipient phone',
      }
    }
    if (request.forceFail) {
      return {
        success: false,
        channel: 'sms',
        providerMessageId: null,
        delivered: false,
        message: 'Mock SMS send failed (forced)',
      }
    }
    const hash = stableHash(`${request.seed}:${request.attemptId}:sms`)
    return {
      success: true,
      channel: 'sms',
      providerMessageId: `SM-${hash.toString(36).toUpperCase()}`,
      delivered: true,
      message: 'SMS delivered (mock)',
    }
  }
}
