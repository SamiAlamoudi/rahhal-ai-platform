/**
 * Presentation VoiceAdapter seam for VoiceComposer / VoicePanel chrome.
 * Production duplex I/O lives in `src/lib/chat/voice/*` (STT → chatEngine → TTS).
 * Realtime duplex adapters were removed in the Conversation-First architecture reset.
 */

export type VoiceAdapterProviderId = 'mock' | 'web_speech'

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
  web_speech: 'Web Speech (presentation)',
}

export function listVoiceAdapterProviders(): readonly VoiceAdapterProviderId[] {
  return ['mock', 'web_speech'] as const
}

export function resolveVoiceAdapterProviderId(): VoiceAdapterProviderId {
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

/** @deprecated Alias — always mock; realtime integration removed. */
export function createPreparedVoiceAdapter(
  _id: VoiceAdapterProviderId = 'mock',
): VoiceAdapter {
  return createMockVoiceAdapter()
}

/** @deprecated Alias — realtime integration removed. */
export function createRealtimeIntegratedVoiceAdapter(): VoiceAdapter {
  return createMockVoiceAdapter()
}

export function createVoiceAdapter(): VoiceAdapter {
  return createMockVoiceAdapter()
}

export function mapSessionStatusToPanelState(
  status: string | null | undefined,
  opts?: { muted?: boolean; disconnected?: boolean },
): VoiceUiPanelState {
  if (opts?.disconnected) return 'disconnected'
  if (opts?.muted) return 'muted'
  switch (status) {
    case 'listening':
      return 'listening'
    case 'thinking':
    case 'processing':
    case 'responding':
      return 'thinking'
    case 'speaking':
      return 'speaking'
    case 'reconnecting':
      return 'disconnected'
    case 'error':
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
    listening: 'يستمع',
    thinking: 'يفكر',
    speaking: 'يتحدث',
    disconnected: 'غير متصل',
    muted: 'صامت',
    interrupted: 'مقاطع',
  }
  const en: Record<VoiceUiPanelState, string> = {
    idle: 'Ready',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
    disconnected: 'Disconnected',
    muted: 'Muted',
    interrupted: 'Interrupted',
  }
  return locale === 'en' ? en[state] : ar[state]
}
