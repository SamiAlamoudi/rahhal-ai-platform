import { createStubProvider } from './openaiRealtimeProvider'
import type { VoiceProvider } from './types'

/**
 * Stub — Azure Realtime is NOT connected in Sprint 18.
 */
export function createAzureRealtimeProvider(): VoiceProvider {
  return createStubProvider({
    providerId: 'azure-realtime',
    displayName: 'Azure Realtime (stub)',
    transportId: 'azure-realtime-transport',
    audioId: 'azure-realtime-audio',
  })
}
