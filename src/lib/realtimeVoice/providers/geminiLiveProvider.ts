/**
 * Phase 7 — Gemini Live provider (prepared; no production sockets by default).
 */

import { BaseVoiceProvider } from './baseProvider'
import { isVoiceLiveNetworkAllowed } from '../feature'
import type { VoiceConnectionInfo, VoiceProviderCapabilities, VoiceProviderConnectOptions } from '../types'

function readGeminiKey(): string | null {
  try {
    const env = import.meta.env as Record<string, unknown>
    const key = (env.VITE_GEMINI_LIVE_KEY as string | undefined)?.trim()
    return key || null
  } catch {
    return null
  }
}

export class GeminiLiveProvider extends BaseVoiceProvider {
  readonly providerId = 'gemini_live' as const
  readonly displayName = 'Gemini Live'
  readonly isLive = true
  readonly capabilities: VoiceProviderCapabilities = {
    duplex: true,
    streamingStt: true,
    streamingTts: true,
    bargeIn: true,
  }

  isAvailable(): boolean {
    return Boolean(readGeminiKey()) && isVoiceLiveNetworkAllowed()
  }

  override async connect(options: VoiceProviderConnectOptions): Promise<VoiceConnectionInfo> {
    this.conversationId = options.conversationId
    this.locale = options.locale ?? 'ar'
    this.setState('connecting')
    if (!this.isAvailable()) {
      this.setState('error')
      this.handlers.onError?.('gemini_live_disabled_or_missing_key')
      return {
        providerId: this.providerId,
        connected: false,
        live: false,
        endpointLabel: 'Gemini Live (disabled)',
      }
    }
    this.setState('error')
    this.handlers.onError?.('gemini_live_not_wired_network')
    return {
      providerId: this.providerId,
      connected: false,
      live: false,
      endpointLabel: 'Gemini Live (prepared)',
    }
  }
}

export function createGeminiLiveProvider(): GeminiLiveProvider {
  return new GeminiLiveProvider()
}
