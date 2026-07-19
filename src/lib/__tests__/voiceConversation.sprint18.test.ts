/**
 * Sprint 18 — Production Voice Conversation Foundation.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  assertTransition,
  canTransition,
  createMockVoiceProvider,
  createOpenAIRealtimeProvider,
  createVoiceProvider,
  createVoiceQueue,
  createVoiceSession,
  createVoiceTimeline,
  nextVoiceState,
  resolveVoiceProviderId,
} from '../voiceConversation'

describe('Sprint 18 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('registers voice conversation flags disabled by default', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ui.voice_conversation')).toBe(false)
    expect(registry.isEnabled('voice.realtime')).toBe(false)
    expect(registry.isEnabled('voice.provider')).toBe(false)
    expect(registry.isEnabled('voice.mock')).toBe(false)
  })

  it('cascades children off when ui.voice_conversation is off', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('voice.realtime', true)
    registry.setEnabled('voice.provider', true)
    registry.setEnabled('voice.mock', true)
    // Parent still off → dependents remain disabled.
    expect(registry.isEnabled('voice.realtime')).toBe(false)
    expect(registry.isEnabled('voice.provider')).toBe(false)
    expect(registry.isEnabled('voice.mock')).toBe(false)
  })

  it('enables dependents only when parent chain is on', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('ui.voice_conversation', true)
    registry.setEnabled('voice.mock', true)
    expect(registry.isEnabled('ui.voice_conversation')).toBe(true)
    expect(registry.isEnabled('voice.mock')).toBe(true)
    expect(registry.isEnabled('voice.realtime')).toBe(false)
  })
})

describe('Sprint 18 state machine', () => {
  it('supports the full conversational loop', () => {
    expect(nextVoiceState('idle', 'start')).toBe('listening')
    expect(nextVoiceState('listening', 'user_speech_end')).toBe('thinking')
    expect(nextVoiceState('thinking', 'assistant_ready')).toBe('speaking')
    expect(nextVoiceState('speaking', 'assistant_done')).toBe('listening')
  })

  it('supports barge-in: speaking → interrupted → listening', () => {
    expect(canTransition('speaking', 'interrupt')).toBe(true)
    expect(assertTransition('speaking', 'interrupt')).toBe('interrupted')
    expect(assertTransition('interrupted', 'start')).toBe('listening')
  })

  it('rejects illegal transitions', () => {
    expect(canTransition('idle', 'assistant_ready')).toBe(false)
    expect(() => assertTransition('idle', 'assistant_ready')).toThrow(/Invalid voice transition/)
  })
})

describe('Sprint 18 voice queue', () => {
  it('orders by priority and cancels outgoing on interruption', () => {
    const q = createVoiceQueue()
    const base = {
      conversationId: 'c1',
      createdAt: new Date().toISOString(),
    }
    q.enqueue({
      kind: 'outgoing',
      priority: 'normal',
      event: { id: '1', type: 'assistant_response_queued', priority: 'normal', ...base },
    })
    q.enqueue({
      kind: 'outgoing',
      priority: 'high',
      event: { id: '2', type: 'assistant_response_queued', priority: 'high', ...base },
    })
    q.enqueue({
      kind: 'incoming',
      priority: 'critical',
      event: { id: '3', type: 'interrupted', priority: 'critical', ...base },
    })

    expect(q.peek()?.event.type).toBe('interrupted')
    const cancelled = q.cancelOutgoingBelow(100)
    expect(cancelled).toBe(2)
    expect(q.size('outgoing')).toBe(0)
    expect(q.size('incoming')).toBe(1)
  })

  it('supports cancel by id', () => {
    const q = createVoiceQueue()
    const item = q.enqueue({
      kind: 'outgoing',
      event: {
        id: 'e1',
        type: 'assistant_speech_started',
        conversationId: 'c1',
        createdAt: new Date().toISOString(),
        priority: 'normal',
      },
    })
    expect(q.cancel(item.id)).toBe(true)
    expect(q.peek()).toBeNull()
  })
})

describe('Sprint 18 timeline', () => {
  it('tracks speech, thinking, latency, errors, reconnects, conversation ids', () => {
    const tl = createVoiceTimeline('conv-18')
    tl.mark('conversation', 'session_started', { conversationId: 'conv-18' })
    tl.begin('u1', 'user_speech', 'listening')
    tl.end('u1')
    tl.begin('t1', 'thinking', 'thinking')
    tl.end('t1')
    tl.sampleLatency('commit_to_think', 42)
    tl.mark('error', 'example', { code: 'test' })
    tl.mark('reconnect', 'reconnect_attempt', { attempt: 1 })

    const kinds = tl.list().map((e) => e.kind)
    expect(kinds).toEqual(
      expect.arrayContaining([
        'conversation',
        'user_speech',
        'thinking',
        'latency',
        'error',
        'reconnect',
      ]),
    )
    expect(tl.list().every((e) => e.conversationId === 'conv-18')).toBe(true)
  })
})

describe('Sprint 18 providers', () => {
  it('resolves only mock as the active provider', () => {
    expect(resolveVoiceProviderId()).toBe('mock')
    expect(createVoiceProvider().providerId).toBe('mock')
    expect(createMockVoiceProvider().isLive).toBe(false)
  })

  it('keeps realtime stubs non-live and non-connectable', async () => {
    const openai = createOpenAIRealtimeProvider()
    expect(openai.isLive).toBe(false)
    await expect(openai.startSession({ conversationId: 'x' })).rejects.toThrow(/not_enabled/)
    await expect(openai.getTransport().connect({ conversationId: 'x' })).rejects.toThrow(
      /not_enabled/,
    )
  })

  it('mock provider connects without API keys or audio output', async () => {
    const mock = createMockVoiceProvider()
    await mock.startSession({ conversationId: 'm1' })
    expect(mock.getTransport().isConnected()).toBe(true)
    await mock.getAudio().enqueuePlayback?.(new ArrayBuffer(0))
    await mock.interrupt()
    await mock.stopSession()
    expect(mock.getTransport().isConnected()).toBe(false)
  })
})

describe('Sprint 18 VoiceSession', () => {
  it('runs listening → thinking → speaking → listening without inventing dialogue', async () => {
    const session = createVoiceSession({ provider: createMockVoiceProvider() })
    await session.start()
    expect(session.getSnapshot().state).toBe('listening')
    expect(session.getSnapshot().providerId).toBe('mock')

    session.commitUserUtterance('I want to visit Istanbul')
    expect(session.getSnapshot().state).toBe('thinking')
    expect(session.getSnapshot().messages).toHaveLength(1)
    expect(session.getSnapshot().messages[0]?.role).toBe('user')

    // Architecture only: caller supplies text — session does not fabricate replies.
    session.queueAssistantResponse('Here is a plan for Istanbul')
    session.beginAssistantSpeech('Here is a plan for Istanbul')
    expect(session.getSnapshot().state).toBe('speaking')
    expect(session.getSnapshot().messages).toHaveLength(2)

    session.endAssistantSpeech()
    expect(session.getSnapshot().state).toBe('listening')

    await session.stop()
    expect(session.getSnapshot().state).toBe('idle')
    session.dispose()
  })

  it('interrupts assistant speech, cancels outgoing queue, resumes listening', async () => {
    const session = createVoiceSession({ provider: createMockVoiceProvider() })
    await session.start()
    session.commitUserUtterance('hello')
    session.queueAssistantResponse('long reply that should be cancelled')
    session.beginAssistantSpeech('long reply that should be cancelled')
    expect(session.getSnapshot().state).toBe('speaking')

    await session.interrupt()
    expect(session.getSnapshot().state).toBe('listening')
    expect(session.getSnapshot().interruptedCount).toBe(1)
    expect(session.getQueue().size('outgoing')).toBe(0)
    expect(session.listEvents().some((e) => e.type === 'interrupted')).toBe(true)
    session.dispose()
  })

  it('returns a stable snapshot reference when unchanged (React #185)', async () => {
    const session = createVoiceSession({ provider: createMockVoiceProvider() })
    const a = session.getSnapshot()
    const b = session.getSnapshot()
    expect(Object.is(a, b)).toBe(true)
    await session.start()
    const c = session.getSnapshot()
    expect(Object.is(a, c)).toBe(false)
    expect(Object.is(c, session.getSnapshot())).toBe(true)
    session.dispose()
  })

  it('records latency and reconnect on the timeline', async () => {
    const session = createVoiceSession({ provider: createMockVoiceProvider() })
    await session.start()
    session.recordLatency('round_trip', 120)
    await session.disconnect()
    expect(session.getSnapshot().state).toBe('disconnected')
    await session.reconnect()
    expect(session.getSnapshot().reconnectCount).toBe(1)
    const kinds = session.getTimeline().list().map((e) => e.kind)
    expect(kinds).toEqual(expect.arrayContaining(['latency', 'reconnect']))
    session.dispose()
  })

  it('ignores commit races outside listening', async () => {
    const session = createVoiceSession({ provider: createMockVoiceProvider() })
    expect(session.commitUserUtterance('too early')).toBeNull()
    await session.start()
    session.commitUserUtterance('ok')
    expect(session.commitUserUtterance('while thinking')).toBeNull()
    session.dispose()
  })
})
