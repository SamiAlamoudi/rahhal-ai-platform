/**
 * Phase 7 — provider factory + failover chain.
 */

import type { RealtimeVoiceProviderId, VoiceProvider } from '../types'
import { createAzureRealtimeProvider } from './azureRealtimeProvider'
import { createGeminiLiveProvider } from './geminiLiveProvider'
import { createMockProvider } from './mockProvider'
import { createOpenAIRealtimeProvider } from './openaiRealtimeProvider'
import { createWebSpeechProvider } from './webSpeechProvider'

function envProviderHint(): RealtimeVoiceProviderId | null {
  try {
    const raw = (import.meta.env.VITE_REALTIME_VOICE_PROVIDER as string | undefined)?.trim().toLowerCase()
    if (
      raw === 'mock'
      || raw === 'openai_realtime'
      || raw === 'gemini_live'
      || raw === 'azure_realtime'
      || raw === 'web_speech'
    ) {
      return raw
    }
  } catch {
    /* ignore */
  }
  return null
}

export function createVoiceProvider(id: RealtimeVoiceProviderId): VoiceProvider {
  switch (id) {
    case 'openai_realtime':
      return createOpenAIRealtimeProvider()
    case 'gemini_live':
      return createGeminiLiveProvider()
    case 'azure_realtime':
      return createAzureRealtimeProvider()
    case 'web_speech':
      return createWebSpeechProvider()
    case 'mock':
    default:
      return createMockProvider()
  }
}

/** Preferred order for failover. */
export const FAILOVER_CHAIN: RealtimeVoiceProviderId[] = [
  'openai_realtime',
  'gemini_live',
  'azure_realtime',
  'web_speech',
  'mock',
]

export function resolvePreferredProviderId(
  preferred?: RealtimeVoiceProviderId,
): RealtimeVoiceProviderId {
  return preferred ?? envProviderHint() ?? 'mock'
}

/**
 * Connect with automatic failover. Never leaves the caller without a provider
 * when mock is in the chain (always available).
 */
export async function connectWithFailover(input: {
  conversationId: string
  locale?: 'ar' | 'en'
  preferred?: RealtimeVoiceProviderId
  allowLive?: boolean
}): Promise<{ provider: VoiceProvider; connection: Awaited<ReturnType<VoiceProvider['connect']>> }> {
  const start = resolvePreferredProviderId(input.preferred)
  const order = [start, ...FAILOVER_CHAIN.filter((id) => id !== start)]

  let lastError = 'no_provider'
  for (const id of order) {
    const provider = createVoiceProvider(id)
    if (id !== 'mock' && id !== 'web_speech' && !provider.isAvailable()) {
      lastError = `${id}_unavailable`
      continue
    }
    const connection = await provider.connect({
      conversationId: input.conversationId,
      locale: input.locale,
      allowLive: input.allowLive,
    })
    if (connection.connected) {
      if (id !== start) {
        connection.failoverFrom = start
      }
      return { provider, connection }
    }
    lastError = `${id}_connect_failed`
  }

  // Absolute fallback
  const mock = createMockProvider()
  const connection = await mock.connect({
    conversationId: input.conversationId,
    locale: input.locale,
  })
  connection.failoverFrom = start
  void lastError
  return { provider: mock, connection }
}
