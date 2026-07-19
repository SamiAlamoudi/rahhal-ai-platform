import type { VoiceProvider } from './types'

/**
 * Stub — OpenAI Realtime is NOT connected in Sprint 18.
 * No API keys, no WebSocket, no audio.
 */
export function createOpenAIRealtimeProvider(): VoiceProvider {
  return createStubProvider({
    providerId: 'openai-realtime',
    displayName: 'OpenAI Realtime (stub)',
    transportId: 'openai-realtime-transport',
    audioId: 'openai-realtime-audio',
  })
}

function createStubProvider(meta: {
  providerId: VoiceProvider['providerId']
  displayName: string
  transportId: string
  audioId: string
}): VoiceProvider {
  const notReady = () => {
    throw new Error(
      `${meta.providerId}_not_enabled: Sprint 18 ships architecture stubs only — no realtime API.`,
    )
  }

  return {
    providerId: meta.providerId,
    displayName: meta.displayName,
    isLive: false,
    getTransport: () => ({
      transportId: meta.transportId,
      connect: async () => notReady(),
      disconnect: async () => undefined,
      isConnected: () => false,
      send: async () => notReady(),
    }),
    getAudio: () => ({
      audioId: meta.audioId,
      startCapture: async () => notReady(),
      stopCapture: async () => undefined,
      enqueuePlayback: async () => notReady(),
      stopPlayback: async () => undefined,
      interruptPlayback: async () => undefined,
    }),
    startSession: async () => notReady(),
    stopSession: async () => undefined,
    interrupt: async () => notReady(),
  }
}

export { createStubProvider }
