import { getFeatureRegistry } from '../../ai'
import { createAzureRealtimeProvider } from './azureRealtimeProvider'
import { createElevenLabsProvider } from './elevenLabsProvider'
import { createMockVoiceProvider } from './mockVoiceProvider'
import { createOpenAIRealtimeProvider } from './openaiRealtimeProvider'
import type { VoiceProvider, VoiceProviderId } from './types'

export type {
  VoiceAudio,
  VoiceProvider,
  VoiceProviderHandlers,
  VoiceProviderId,
  VoiceProviderStartOptions,
  VoiceTransport,
  VoiceTransportConnectOptions,
} from './types'

export { createMockVoiceProvider } from './mockVoiceProvider'
export { createOpenAIRealtimeProvider } from './openaiRealtimeProvider'
export { createAzureRealtimeProvider } from './azureRealtimeProvider'
export { createElevenLabsProvider } from './elevenLabsProvider'

/**
 * Resolve the active voice provider.
 * Sprint 18: only MockVoiceProvider may run. Live stubs never activate.
 */
export function resolveVoiceProviderId(
  explicit?: VoiceProviderId,
): VoiceProviderId {
  if (explicit) return explicit
  const registry = getFeatureRegistry()
  // Flags are off by default; factory still returns mock for architecture tests.
  if (registry.isEnabled('voice.realtime')) return 'mock'
  if (registry.isEnabled('voice.provider')) return 'mock'
  if (registry.isEnabled('voice.mock')) return 'mock'
  return 'mock'
}

export function createVoiceProvider(explicit?: VoiceProviderId): VoiceProvider {
  const id = resolveVoiceProviderId(explicit)
  switch (id) {
    case 'openai-realtime':
      return createOpenAIRealtimeProvider()
    case 'azure-realtime':
      return createAzureRealtimeProvider()
    case 'elevenlabs':
      return createElevenLabsProvider()
    case 'mock':
    default:
      return createMockVoiceProvider()
  }
}
