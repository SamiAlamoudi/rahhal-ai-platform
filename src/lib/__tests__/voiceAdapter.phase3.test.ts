/**
 * Phase 3 — VoiceAdapter + progressive streaming cards (UX only).
 */
import { describe, expect, it } from 'vitest'
import {
  createMockVoiceAdapter,
  createVoiceAdapter,
  listVoiceAdapterProviders,
  mapSessionStatusToPanelState,
  progressiveCardLimit,
  resolveVoiceAdapterProviderId,
  voicePanelStateLabel,
} from '../premiumExperience'

describe('Phase 3 — VoiceAdapter', () => {
  it('lists supported providers and defaults to mock', () => {
    expect(listVoiceAdapterProviders()).toEqual(
      expect.arrayContaining([
        'mock',
        'openai_realtime',
        'gemini_live',
        'azure_voice',
        'deepgram',
        'web_speech',
      ]),
    )
    expect(resolveVoiceAdapterProviderId()).toBe('mock')
    const adapter = createVoiceAdapter()
    expect(adapter.id).toBe('mock')
    expect(adapter.mock).toBe(true)
  })

  it('mock adapter connects without network side effects', async () => {
    const adapter = createMockVoiceAdapter()
    const result = await adapter.connect()
    expect(result).toEqual({ connected: true, mock: true, providerId: 'mock' })
    adapter.mute()
    expect(adapter.isMuted()).toBe(true)
    adapter.unmute()
    expect(adapter.isMuted()).toBe(false)
    adapter.interrupt()
    await adapter.disconnect()
  })

  it('maps session status to panel states', () => {
    expect(mapSessionStatusToPanelState('listening')).toBe('listening')
    expect(mapSessionStatusToPanelState('thinking')).toBe('thinking')
    expect(mapSessionStatusToPanelState('speaking')).toBe('speaking')
    expect(mapSessionStatusToPanelState('idle')).toBe('idle')
    expect(mapSessionStatusToPanelState('idle', { muted: true })).toBe('muted')
    expect(mapSessionStatusToPanelState('idle', { disconnected: true })).toBe(
      'disconnected',
    )
    expect(voicePanelStateLabel('listening', 'ar')).toContain('أستمع')
  })

  it('progressively reveals cards while streaming (conversation first)', () => {
    expect(progressiveCardLimit(0)).toBe(0)
    expect(progressiveCardLimit(40)).toBe(0)
    expect(progressiveCardLimit(90)).toBe(1)
    expect(progressiveCardLimit(160)).toBe(2)
    expect(progressiveCardLimit(250)).toBe(3)
    expect(progressiveCardLimit(360)).toBe(4)
    expect(progressiveCardLimit(500)).toBe(5)
  })
})
