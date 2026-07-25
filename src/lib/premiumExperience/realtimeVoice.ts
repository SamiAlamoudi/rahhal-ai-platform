/**
 * Realtime voice adapter seam — mock when OpenAI Realtime / Gemini Live keys absent.
 * Presentation + session state only; no network calls.
 */

export type RealtimeVoiceProviderId = 'mock' | 'openai_realtime' | 'gemini_live'

export type RealtimeVoiceUiState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'

export interface RealtimeVoiceAdapter {
  id: RealtimeVoiceProviderId
  label: string
  connect: () => Promise<{ connected: boolean; mock: boolean }>
  disconnect: () => Promise<void>
  interrupt: () => void
}

function hasOpenAiRealtimeKey(): boolean {
  try {
    return Boolean(import.meta.env.VITE_OPENAI_REALTIME_KEY)
  } catch {
    return false
  }
}

function hasGeminiLiveKey(): boolean {
  try {
    return Boolean(import.meta.env.VITE_GEMINI_LIVE_KEY)
  } catch {
    return false
  }
}

export function resolveRealtimeVoiceProviderId(): RealtimeVoiceProviderId {
  if (hasOpenAiRealtimeKey()) return 'openai_realtime'
  if (hasGeminiLiveKey()) return 'gemini_live'
  return 'mock'
}

export function createRealtimeVoiceAdapter(
  preferred?: RealtimeVoiceProviderId,
): RealtimeVoiceAdapter {
  const id = preferred ?? resolveRealtimeVoiceProviderId()
  if (id === 'openai_realtime' && !hasOpenAiRealtimeKey()) {
    return createMockRealtimeVoiceAdapter()
  }
  if (id === 'gemini_live' && !hasGeminiLiveKey()) {
    return createMockRealtimeVoiceAdapter()
  }
  if (id === 'mock') return createMockRealtimeVoiceAdapter()

  // Keys present but live wiring deferred — safe mock with labeled provider.
  return {
    id,
    label: id === 'openai_realtime' ? 'OpenAI Realtime (prepared)' : 'Gemini Live (prepared)',
    async connect() {
      return { connected: false, mock: true }
    },
    async disconnect() {},
    interrupt() {},
  }
}

export function createMockRealtimeVoiceAdapter(): RealtimeVoiceAdapter {
  return {
    id: 'mock',
    label: 'Mock realtime voice',
    async connect() {
      return { connected: true, mock: true }
    },
    async disconnect() {},
    interrupt() {},
  }
}
