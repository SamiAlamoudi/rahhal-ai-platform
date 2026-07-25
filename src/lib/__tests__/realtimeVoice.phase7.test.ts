/**
 * Phase 7 — Real AI Voice Integration tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  PHASE7_REALTIME_VOICE_VERSION,
  connectWithFailover,
  createVoiceProvider,
  createVoiceSession,
  isRealtimeVoiceEnabled,
  isVoiceLiveNetworkAllowed,
  resolvePreferredProviderId,
  ReconnectManager,
  transitionVoiceState,
} from '../realtimeVoice'
import { createVoiceAdapter, resolveVoiceAdapterProviderId } from '../premiumExperience'
import { resetAgentRuntimeSessions } from '../agent/agentRuntime'

describe('Phase 7 — Realtime Voice', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetAgentRuntimeSessions()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetAgentRuntimeSessions()
  })

  it('keeps ai.realtime_voice OFF and live network disallowed by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.realtime_voice')).toBe(false)
    expect(isRealtimeVoiceEnabled()).toBe(false)
    expect(isVoiceLiveNetworkAllowed()).toBe(false)
    expect(PHASE7_REALTIME_VOICE_VERSION).toMatch(/realtime-voice/)
  })

  it('defaults preferred provider to mock', () => {
    expect(resolvePreferredProviderId()).toBe('mock')
    expect(createVoiceProvider('mock').isAvailable()).toBe(true)
  })

  it('failovers from unavailable openai to mock', async () => {
    const { provider, connection } = await connectWithFailover({
      conversationId: 'fo-1',
      preferred: 'openai_realtime',
      locale: 'en',
    })
    expect(connection.connected).toBe(true)
    expect(provider.providerId).toBe('mock')
    expect(connection.failoverFrom).toBe('openai_realtime')
  })

  it('runs streaming conversation with incremental memory (Arabic dialect)', async () => {
    const session = createVoiceSession({
      conversationId: 'vs-ar',
      locale: 'ar',
      preferredProvider: 'mock',
    })
    await session.start()
    expect(session.getState()).toBe('listening')

    await session.pushTranscript('أبي', false)
    await session.pushTranscript('أبي اليابان', false)
    await session.pushTranscript('أبي اليابان خلها أكتوبر', true)

    const memory = session.getRealtime().getMemory()
    expect(memory?.destination).toBe('Japan')
    expect(memory?.monthHint).toBe('October')

    const types = session.getEvents().map((e) => e.type)
    expect(types).toContain('partial_transcript')
    expect(types).toContain('final_transcript')
    expect(types).toContain('assistant_final')

    const metrics = session.getMetrics()
    expect(metrics.providerId).toBe('mock')
    expect(metrics.latency.samples).toBeGreaterThan(0)

    await session.stop()
  })

  it('supports mixed language interruption without waiting', async () => {
    const session = createVoiceSession({
      conversationId: 'vs-int',
      locale: 'ar',
      preferredProvider: 'mock',
    })
    await session.start()
    await session.pushTranscript('Hotel قريب من المترو في Tokyo', true)
    expect(['listening', 'speaking', 'interrupted', 'reasoning']).toContain(session.getState())
    await session.interrupt()
    expect(session.getState()).toBe('listening')
    expect(session.getEvents().some((e) => e.type === 'interrupted')).toBe(true)
    await session.stop()
  })

  it('reconnect manager backs off and succeeds', async () => {
    const rm = new ReconnectManager({ maxAttempts: 3, baseDelayMs: 10 })
    let tries = 0
    const ok = await rm.waitAndRetry(async () => {
      tries += 1
      return tries >= 2
    })
    expect(ok).toBe(true)
    expect(tries).toBe(2)
  })

  it('voice state transitions allow barge-in path', () => {
    expect(transitionVoiceState('speaking', 'interrupted')).toBe('interrupted')
    expect(transitionVoiceState('interrupted', 'listening')).toBe('listening')
  })

  it('long session keeps provider stable and updates memory', async () => {
    const session = createVoiceSession({
      conversationId: 'vs-long',
      locale: 'en',
      preferredProvider: 'mock',
    })
    await session.start()
    for (let i = 0; i < 5; i += 1) {
      await session.pushTranscript(`I want Tokyo turn ${i}`, true)
    }
    expect(session.getProviderId()).toBe('mock')
    expect(session.getRealtime().getMemory()?.destination).toBe('Tokyo')
    expect(session.getEvents().length).toBeGreaterThan(10)
    await session.stop()
  })

  it('VoiceAdapter stays Phase-3 mock when realtime flag OFF', () => {
    expect(resolveVoiceAdapterProviderId()).toBe('mock')
    const adapter = createVoiceAdapter()
    expect(adapter.id).toBe('mock')
    expect(adapter.mock).toBe(true)
  })

  it('VoiceAdapter uses realtime integration when flag enabled', async () => {
    getFeatureRegistry().setEnabled('ai.realtime_voice', true)
    expect(isRealtimeVoiceEnabled()).toBe(true)
    const adapter = createVoiceAdapter('openai_realtime')
    const connected = await adapter.connect()
    expect(connected.connected).toBe(true)
    // Failover to mock because live sockets disabled
    expect(connected.mock).toBe(true)
    adapter.interrupt()
    await adapter.disconnect()
  })
})
