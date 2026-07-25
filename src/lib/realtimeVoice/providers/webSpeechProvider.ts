/**
 * Phase 7 — WebSpeechProvider (browser fallback).
 * Uses Web Speech APIs when available; otherwise reports unavailable.
 * No cloud keys required.
 */

import { BaseVoiceProvider } from './baseProvider'
import type { VoiceConnectionInfo, VoiceProviderCapabilities, VoiceProviderConnectOptions } from '../types'

function hasWebSpeech(): boolean {
  if (typeof globalThis === 'undefined') return false
  const g = globalThis as Record<string, unknown>
  return Boolean(g.SpeechRecognition || g.webkitSpeechRecognition || g.speechSynthesis)
}

export class WebSpeechProvider extends BaseVoiceProvider {
  readonly providerId = 'web_speech' as const
  readonly displayName = 'Web Speech API'
  readonly isLive = false
  readonly capabilities: VoiceProviderCapabilities = {
    duplex: true,
    streamingStt: true,
    streamingTts: true,
    bargeIn: true,
  }

  isAvailable(): boolean {
    return hasWebSpeech()
  }

  override async connect(options: VoiceProviderConnectOptions): Promise<VoiceConnectionInfo> {
    if (!this.isAvailable()) {
      this.setState('error')
      this.handlers.onError?.('web_speech_unavailable')
      return {
        providerId: this.providerId,
        connected: false,
        live: false,
        endpointLabel: 'Web Speech (unavailable)',
      }
    }
    return super.connect(options)
  }
}

export function createWebSpeechProvider(): WebSpeechProvider {
  return new WebSpeechProvider()
}
