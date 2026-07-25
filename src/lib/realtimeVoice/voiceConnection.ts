/**
 * Phase 7 — VoiceConnection
 * Tracks active provider connection + failover metadata.
 */

import type { RealtimeVoiceProviderId, VoiceConnectionInfo, VoiceProvider } from './types'

export class VoiceConnection {
  private provider: VoiceProvider | null = null
  private info: VoiceConnectionInfo | null = null

  attach(provider: VoiceProvider, info: VoiceConnectionInfo): void {
    this.provider = provider
    this.info = info
  }

  getProvider(): VoiceProvider | null {
    return this.provider
  }

  getInfo(): VoiceConnectionInfo | null {
    return this.info
  }

  getProviderId(): RealtimeVoiceProviderId | null {
    return this.info?.providerId ?? null
  }

  isConnected(): boolean {
    return Boolean(this.info?.connected)
  }

  async disconnect(): Promise<void> {
    if (this.provider) await this.provider.disconnect()
    this.provider = null
    this.info = null
  }
}
