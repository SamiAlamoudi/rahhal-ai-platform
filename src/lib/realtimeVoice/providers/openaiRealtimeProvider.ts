/**
 * Phase 7 — OpenAI Realtime provider.
 * Live sockets only when VITE_VOICE_LIVE_ALLOW=true AND key present.
 * Default: prepared / unavailable → caller failovers to mock.
 */

import { BaseVoiceProvider } from './baseProvider'
import { isVoiceLiveNetworkAllowed } from '../feature'
import type { VoiceConnectionInfo, VoiceProviderCapabilities, VoiceProviderConnectOptions } from '../types'

function readOpenAiRealtimeKey(): string | null {
  try {
    const env = import.meta.env as Record<string, unknown>
    const key = (
      (env.VITE_OPENAI_REALTIME_KEY as string | undefined)
      ?? (env.VITE_OPENAI_API_KEY as string | undefined)
    )?.trim()
    return key || null
  } catch {
    return null
  }
}

export class OpenAIRealtimeProvider extends BaseVoiceProvider {
  readonly providerId = 'openai_realtime' as const
  readonly displayName = 'OpenAI Realtime API'
  readonly isLive = true
  readonly capabilities: VoiceProviderCapabilities = {
    duplex: true,
    streamingStt: true,
    streamingTts: true,
    bargeIn: true,
  }

  isAvailable(): boolean {
    return Boolean(readOpenAiRealtimeKey()) && isVoiceLiveNetworkAllowed()
  }

  override async connect(options: VoiceProviderConnectOptions): Promise<VoiceConnectionInfo> {
    this.conversationId = options.conversationId
    this.locale = options.locale ?? 'ar'
    this.setState('connecting')

    if (!this.isAvailable()) {
      this.setState('error')
      this.handlers.onError?.('openai_realtime_disabled_or_missing_key')
      return {
        providerId: this.providerId,
        connected: false,
        live: false,
        endpointLabel: 'wss://api.openai.com/v1/realtime (disabled)',
      }
    }

    // Live path intentionally not opening sockets in this additive sprint unless
    // explicitly allowed — still no network call here; mark prepared-connected
    // for local integration harnesses that set VITE_VOICE_LIVE_ALLOW.
    // Real websocket wiring stays behind the allow flag and is a no-op connect
    // that reports live=false until a future network-enabled commit.
    this.connected = false
    this.setState('error')
    this.handlers.onError?.('openai_realtime_not_wired_network')
    return {
      providerId: this.providerId,
      connected: false,
      live: false,
      endpointLabel: 'wss://api.openai.com/v1/realtime (prepared)',
    }
  }
}

export function createOpenAIRealtimeProvider(): OpenAIRealtimeProvider {
  return new OpenAIRealtimeProvider()
}
