import type { VoiceEvent } from '../types'
import type {
  VoiceAudio,
  VoiceProvider,
  VoiceProviderStartOptions,
  VoiceTransport,
  VoiceTransportConnectOptions,
} from './types'

/**
 * Active Sprint 18 provider — local architecture harness only.
 * Does not invent conversation turns, generate audio, or call networks.
 */
export function createMockVoiceProvider(): VoiceProvider {
  let connected = false
  let sessionActive = false
  let conversationId: string | null = null
  let handlers: VoiceProviderStartOptions['handlers']

  const transport: VoiceTransport = {
    transportId: 'mock-transport',
    async connect(options: VoiceTransportConnectOptions) {
      conversationId = options.conversationId
      connected = true
    },
    async disconnect() {
      connected = false
    },
    isConnected: () => connected,
    async send(_event: VoiceEvent) {
      if (!connected) throw new Error('mock_transport_not_connected')
      // Architecture only — no remote fan-out.
    },
  }

  const audio: VoiceAudio = {
    audioId: 'mock-audio',
    async startCapture() {
      /* no media devices — architecture only */
    },
    async stopCapture() {
      /* no-op */
    },
    async enqueuePlayback() {
      // Explicitly forbidden in Sprint 18: do not generate or play audio.
    },
    async stopPlayback() {
      /* no-op */
    },
    async interruptPlayback() {
      /* no-op */
    },
  }

  return {
    providerId: 'mock',
    displayName: 'Mock Voice Provider',
    isLive: false,
    getTransport: () => transport,
    getAudio: () => audio,
    async startSession(options) {
      conversationId = options.conversationId
      handlers = options.handlers
      if (!transport.isConnected()) {
        await transport.connect({ conversationId: options.conversationId })
      }
      sessionActive = true
      handlers?.onStateHint?.('listening')
    },
    async stopSession() {
      sessionActive = false
      handlers?.onStateHint?.('idle')
      await transport.disconnect()
    },
    async interrupt() {
      if (!sessionActive) return
      await audio.interruptPlayback?.()
      handlers?.onStateHint?.('interrupted')
      // Resume listening path is owned by VoiceSession state machine.
      handlers?.onStateHint?.('listening')
    },
  }
}
