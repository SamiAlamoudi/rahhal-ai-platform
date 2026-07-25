/**
 * Phase 7 — Azure OpenAI Realtime provider (prepared; no production sockets by default).
 */

import { BaseVoiceProvider } from './baseProvider'
import { isVoiceLiveNetworkAllowed } from '../feature'
import type { VoiceConnectionInfo, VoiceProviderCapabilities, VoiceProviderConnectOptions } from '../types'

function readAzureKey(): string | null {
  try {
    const env = import.meta.env as Record<string, unknown>
    const key = (
      (env.VITE_AZURE_VOICE_KEY as string | undefined)
      ?? (env.VITE_AZURE_OPENAI_KEY as string | undefined)
    )?.trim()
    return key || null
  } catch {
    return null
  }
}

export class AzureRealtimeProvider extends BaseVoiceProvider {
  readonly providerId = 'azure_realtime' as const
  readonly displayName = 'Azure OpenAI Realtime'
  readonly isLive = true
  readonly capabilities: VoiceProviderCapabilities = {
    duplex: true,
    streamingStt: true,
    streamingTts: true,
    bargeIn: true,
  }

  isAvailable(): boolean {
    return Boolean(readAzureKey()) && isVoiceLiveNetworkAllowed()
  }

  override async connect(options: VoiceProviderConnectOptions): Promise<VoiceConnectionInfo> {
    this.conversationId = options.conversationId
    this.locale = options.locale ?? 'ar'
    this.setState('connecting')
    if (!this.isAvailable()) {
      this.setState('error')
      this.handlers.onError?.('azure_realtime_disabled_or_missing_key')
      return {
        providerId: this.providerId,
        connected: false,
        live: false,
        endpointLabel: 'Azure Realtime (disabled)',
      }
    }
    this.setState('error')
    this.handlers.onError?.('azure_realtime_not_wired_network')
    return {
      providerId: this.providerId,
      connected: false,
      live: false,
      endpointLabel: 'Azure Realtime (prepared)',
    }
  }
}

export function createAzureRealtimeProvider(): AzureRealtimeProvider {
  return new AzureRealtimeProvider()
}
