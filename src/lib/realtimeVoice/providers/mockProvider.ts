/**
 * Phase 7 — MockProvider (development default).
 * Simulates duplex STT/TTS without network.
 */

import { BaseVoiceProvider } from './baseProvider'
import type { VoiceProviderCapabilities } from '../types'

export class MockProvider extends BaseVoiceProvider {
  readonly providerId = 'mock' as const
  readonly displayName = 'Mock Voice Provider'
  readonly isLive = false
  readonly capabilities: VoiceProviderCapabilities = {
    duplex: true,
    streamingStt: true,
    streamingTts: true,
    bargeIn: true,
  }

  isAvailable(): boolean {
    return true
  }
}

export function createMockProvider(): MockProvider {
  return new MockProvider()
}
