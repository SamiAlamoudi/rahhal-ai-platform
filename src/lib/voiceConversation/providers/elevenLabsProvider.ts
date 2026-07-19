import { createStubProvider } from './openaiRealtimeProvider'
import type { VoiceProvider } from './types'

/**
 * Stub — ElevenLabs voice is NOT connected in Sprint 18.
 */
export function createElevenLabsProvider(): VoiceProvider {
  return createStubProvider({
    providerId: 'elevenlabs',
    displayName: 'ElevenLabs (stub)',
    transportId: 'elevenlabs-transport',
    audioId: 'elevenlabs-audio',
  })
}
