import { stableHash } from './privacy'
import type {
  NotificationProviderAdapter,
  NotificationProviderCapabilities,
  NotificationSendRequest,
  NotificationSendResult,
} from './notificationProviderAdapter'

export class MockEmailProvider implements NotificationProviderAdapter {
  readonly providerId = 'mock_email'
  readonly displayName = 'Mock Email Provider'
  readonly channel = 'email' as const

  getCapabilities(): NotificationProviderCapabilities {
    return {
      providerId: this.providerId,
      displayName: this.displayName,
      channel: 'email',
      supportsDeliveryReceipts: true,
      mocked: true,
    }
  }

  isAvailable(): boolean {
    return true
  }

  async send(request: NotificationSendRequest): Promise<NotificationSendResult> {
    if (!request.recipient.email) {
      return {
        success: false,
        channel: 'email',
        providerMessageId: null,
        delivered: false,
        message: 'Missing recipient email',
      }
    }
    if (request.forceFail) {
      return {
        success: false,
        channel: 'email',
        providerMessageId: null,
        delivered: false,
        message: 'Mock email send failed (forced)',
      }
    }
    const hash = stableHash(`${request.seed}:${request.attemptId}:email`)
    return {
      success: true,
      channel: 'email',
      providerMessageId: `EM-${hash.toString(36).toUpperCase()}`,
      delivered: true,
      message: 'Email delivered (mock)',
    }
  }
}
