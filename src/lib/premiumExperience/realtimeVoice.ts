/**
 * Phase 2 realtime seam — now backed by Phase 3 VoiceAdapter (mock-first).
 * Kept for backward compatibility with existing imports/tests.
 */

import {
  createMockVoiceAdapter,
  createVoiceAdapter,
  resolveVoiceAdapterProviderId,
  type VoiceAdapterProviderId,
  type VoiceUiPanelState,
} from './voiceAdapter'

/** @deprecated Prefer VoiceAdapterProviderId — kept for Phase 2 tests. */
export type RealtimeVoiceProviderId = Extract<
  VoiceAdapterProviderId,
  'mock' | 'openai_realtime' | 'gemini_live'
>

export type RealtimeVoiceUiState = Extract<
  VoiceUiPanelState,
  'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted'
>

export interface RealtimeVoiceAdapter {
  id: RealtimeVoiceProviderId
  label: string
  connect: () => Promise<{ connected: boolean; mock: boolean }>
  disconnect: () => Promise<void>
  interrupt: () => void
}

export function resolveRealtimeVoiceProviderId(): RealtimeVoiceProviderId {
  const id = resolveVoiceAdapterProviderId()
  if (id === 'openai_realtime' || id === 'gemini_live' || id === 'mock') return id
  return 'mock'
}

export function createMockRealtimeVoiceAdapter(): RealtimeVoiceAdapter {
  const adapter = createMockVoiceAdapter()
  return {
    id: 'mock',
    label: adapter.label,
    connect: async () => {
      const r = await adapter.connect()
      return { connected: r.connected, mock: r.mock }
    },
    disconnect: () => adapter.disconnect(),
    interrupt: () => adapter.interrupt(),
  }
}

export function createRealtimeVoiceAdapter(
  preferred?: RealtimeVoiceProviderId,
): RealtimeVoiceAdapter {
  const adapter = createVoiceAdapter(preferred ?? resolveRealtimeVoiceProviderId())
  const id = (adapter.id === 'openai_realtime' || adapter.id === 'gemini_live'
    ? adapter.id
    : 'mock') as RealtimeVoiceProviderId
  return {
    id,
    label: adapter.label,
    connect: async () => {
      const r = await adapter.connect()
      return { connected: r.connected, mock: true }
    },
    disconnect: () => adapter.disconnect(),
    interrupt: () => adapter.interrupt(),
  }
}
