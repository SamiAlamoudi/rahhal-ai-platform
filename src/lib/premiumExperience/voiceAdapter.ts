/**
 * Phase 3 — reusable VoiceAdapter seam.
 * Phase 7 — when `ai.realtime_voice` is enabled, adapters wrap Realtime VoiceSession
 * (still mock-default; live sockets require VITE_VOICE_LIVE_ALLOW).
 *
 * RC-1: feature check is a light import; realtimeVoice package is dynamic-imported
 * only when the flag is ON (no eager Agent Runtime pull when OFF).
 */

import { isRealtimeVoiceEnabled } from '../realtimeVoice/feature'

export type VoiceAdapterProviderId =
  | 'mock'
  | 'openai_realtime'
  | 'gemini_live'
  | 'azure_voice'
  | 'deepgram'
  | 'web_speech'

export type VoiceUiPanelState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'disconnected'
  | 'muted'
  | 'interrupted'

export interface VoiceAdapterConnectResult {
  connected: boolean
  mock: boolean
  providerId: VoiceAdapterProviderId
}

export interface VoiceAdapter {
  id: VoiceAdapterProviderId
  label: string
  /** True when this adapter is presentation-only (no live duplex). */
  mock: boolean
  connect: () => Promise<VoiceAdapterConnectResult>
  disconnect: () => Promise<void>
  interrupt: () => void
  mute: () => void
  unmute: () => void
  isMuted: () => boolean
}

const PROVIDER_LABELS: Record<VoiceAdapterProviderId, string> = {
  mock: 'Mock Voice Adapter',
  openai_realtime: 'OpenAI Realtime (prepared)',
  gemini_live: 'Gemini Live (prepared)',
  azure_voice: 'Azure Voice (prepared)',
  deepgram: 'Deepgram (prepared)',
  web_speech: 'Web Speech API (prepared)',
}

function envFlag(name: string): boolean {
  try {
    const value = (import.meta.env as Record<string, unknown>)[name]
    return value === true || value === 'true'
  } catch {
    return false
  }
}

export function listVoiceAdapterProviders(): readonly VoiceAdapterProviderId[] {
  return [
    'mock',
    'openai_realtime',
    'gemini_live',
    'azure_voice',
    'deepgram',
    'web_speech',
  ] as const
}

/** Prefer mock unless a future key is present (still non-executing). */
export function resolveVoiceAdapterProviderId(): VoiceAdapterProviderId {
  if (envFlag('VITE_OPENAI_REALTIME_KEY')) return 'openai_realtime'
  if (envFlag('VITE_GEMINI_LIVE_KEY')) return 'gemini_live'
  if (envFlag('VITE_AZURE_VOICE_KEY')) return 'azure_voice'
  if (envFlag('VITE_DEEPGRAM_KEY')) return 'deepgram'
  if (envFlag('VITE_VOICE_WEB_SPEECH')) return 'web_speech'
  return 'mock'
}

export function createMockVoiceAdapter(): VoiceAdapter {
  let muted = false
  return {
    id: 'mock',
    label: PROVIDER_LABELS.mock,
    mock: true,
    async connect() {
      return { connected: true, mock: true, providerId: 'mock' }
    },
    async disconnect() {},
    interrupt() {},
    mute() {
      muted = true
    },
    unmute() {
      muted = false
    },
    isMuted() {
      return muted
    },
  }
}

/** Prepared adapter — never opens sockets; always mock-backed. */
export function createPreparedVoiceAdapter(id: VoiceAdapterProviderId): VoiceAdapter {
  if (id === 'mock') return createMockVoiceAdapter()
  const inner = createMockVoiceAdapter()
  return {
    id,
    label: PROVIDER_LABELS[id],
    mock: true,
    async connect() {
      const result = await inner.connect()
      return { ...result, providerId: id, mock: true, connected: false }
    },
    disconnect: () => inner.disconnect(),
    interrupt: () => inner.interrupt(),
    mute: () => inner.mute(),
    unmute: () => inner.unmute(),
    isMuted: () => inner.isMuted(),
  }
}

function mapToRealtimeProviderId(
  id: VoiceAdapterProviderId,
): 'mock' | 'openai_realtime' | 'gemini_live' | 'azure_realtime' | 'web_speech' {
  if (id === 'azure_voice') return 'azure_realtime'
  if (id === 'deepgram') return 'web_speech'
  if (id === 'openai_realtime' || id === 'gemini_live' || id === 'web_speech' || id === 'mock') {
    return id
  }
  return 'mock'
}

type RealtimeSessionHandle = {
  start: () => Promise<unknown>
  stop: () => Promise<void>
  interrupt: () => Promise<void>
  getProviderId: () => string | null
}

/**
 * Phase 7 bridge — VoiceAdapter over Realtime VoiceSession (failover to mock).
 * Session module is loaded lazily on first connect (flag-ON path only).
 */
export function createRealtimeIntegratedVoiceAdapter(
  preferred?: VoiceAdapterProviderId,
): VoiceAdapter {
  const id = preferred ?? resolveVoiceAdapterProviderId()
  let session: RealtimeSessionHandle | null = null
  let muted = false
  let connected = false

  return {
    id,
    label: PROVIDER_LABELS[id],
    mock: id === 'mock',
    async connect() {
      if (!session) {
        const mod = await import('../realtimeVoice')
        session = mod.createVoiceSession({
          conversationId: `voice-ui-${Date.now()}`,
          locale: 'ar',
          preferredProvider: mapToRealtimeProviderId(id),
        })
      }
      await session.start()
      connected = true
      const providerId = session.getProviderId() ?? 'mock'
      return {
        connected: true,
        mock: providerId === 'mock',
        providerId: providerId === 'azure_realtime' ? 'azure_voice' : (providerId as VoiceAdapterProviderId),
      }
    },
    async disconnect() {
      if (session) await session.stop()
      connected = false
    },
    interrupt() {
      if (!muted && connected && session) void session.interrupt()
    },
    mute() {
      muted = true
    },
    unmute() {
      muted = false
    },
    isMuted() {
      return muted
    },
  }
}

/**
 * Factory — Phase 3 safe non-network adapter by default.
 * Phase 7: when realtime voice flag is ON, uses integrated session + failover.
 */
export function createVoiceAdapter(preferred?: VoiceAdapterProviderId): VoiceAdapter {
  if (isRealtimeVoiceEnabled()) {
    return createRealtimeIntegratedVoiceAdapter(preferred)
  }
  const id = preferred ?? resolveVoiceAdapterProviderId()
  if (id === 'mock') return createMockVoiceAdapter()
  return createPreparedVoiceAdapter(id)
}

/** Map chat VoiceSessionStatus → panel UI state. */
export function mapSessionStatusToPanelState(
  status: string,
  opts?: { muted?: boolean; disconnected?: boolean },
): VoiceUiPanelState {
  if (opts?.disconnected) return 'disconnected'
  if (opts?.muted) return 'muted'
  switch (status) {
    case 'listening':
    case 'requesting_permission':
      return 'listening'
    case 'thinking':
    case 'processing':
    case 'responding':
      return 'thinking'
    case 'speaking':
      return 'speaking'
    case 'error':
      return 'disconnected'
    case 'reconnecting':
      return 'disconnected'
    default:
      return 'idle'
  }
}

export function voicePanelStateLabel(
  state: VoiceUiPanelState,
  locale: 'ar' | 'en' = 'ar',
): string {
  const ar: Record<VoiceUiPanelState, string> = {
    idle: 'جاهز',
    listening: 'أستمع إليك…',
    thinking: 'أفكّر…',
    speaking: 'أتحدث…',
    disconnected: 'غير متصل',
    muted: 'صامت',
    interrupted: 'تمت المقاطعة',
  }
  const en: Record<VoiceUiPanelState, string> = {
    idle: 'Ready',
    listening: 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
    disconnected: 'Disconnected',
    muted: 'Muted',
    interrupted: 'Interrupted',
  }
  return locale === 'ar' ? ar[state] : en[state]
}
