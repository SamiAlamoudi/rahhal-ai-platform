/**
 * NotificationProviderAdapter — vendor-agnostic delivery port.
 * Mock email / SMS / WhatsApp providers implement this interface.
 */

import type {
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
} from './types'

export interface NotificationSendRequest {
  notificationSessionId: string
  attemptId: string
  channel: NotificationChannel
  recipient: NotificationRecipient
  content: NotificationContent
  /** Deterministic seed for mock providers. */
  seed: string
  forceFail?: boolean
}

export interface NotificationSendResult {
  success: boolean
  channel: NotificationChannel
  providerMessageId: string | null
  delivered: boolean
  message: string
}

export interface NotificationProviderCapabilities {
  providerId: string
  displayName: string
  channel: NotificationChannel
  supportsDeliveryReceipts: boolean
  mocked: boolean
}

export interface NotificationProviderAdapter {
  readonly providerId: string
  readonly displayName: string
  readonly channel: NotificationChannel
  getCapabilities(): NotificationProviderCapabilities
  isAvailable(): boolean
  send(request: NotificationSendRequest): Promise<NotificationSendResult>
}
