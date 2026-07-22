/**
 * Sprint 98 — Live Conversation Experience tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  buildConversationTimeline,
  buildLiveConversationSession,
  buildStreamingChunks,
  buildTypingMetadata,
  emptyLiveConversationSession,
  isLiveConversationEnabled,
  LIVE_CONVERSATION_FEATURE_ID,
  LIVE_CONVERSATION_STAGE_ORDER,
  runLiveConversationExperience,
  toLiveConversationUiPayload,
  SPRINT98_LIVE_CONVERSATION_VERSION,
} from '../agent/liveConversation'

describe('Sprint 98 — Live Conversation Experience', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('registers ai.live_conversation enabled by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.live_conversation')).toBe(true)
    expect(isLiveConversationEnabled()).toBe(true)
    expect(LIVE_CONVERSATION_FEATURE_ID).toBe('ai.live_conversation')
    expect(SPRINT98_LIVE_CONVERSATION_VERSION).toMatch(/live-conversation/)
  })

  describe('session state', () => {
    it('supports Thinking → Searching → Comparing → Optimizing → Final → Booking Ready', () => {
      expect(LIVE_CONVERSATION_STAGE_ORDER).toEqual([
        'thinking',
        'searching',
        'comparing',
        'optimizing',
        'final_recommendation',
        'booking_ready',
      ])
      const session = buildLiveConversationSession({
        conversationId: 'live_1',
        targetState: 'booking_ready',
      })
      expect(session.state).toBe('booking_ready')
      expect(session.timeline.completedStages).toContain('thinking')
      expect(session.timeline.completedStages).toContain('booking_ready')
      expect(session.timeline.remainingStages).toEqual([])
      expect(session.timeline.estimatedProgress).toBe(100)
    })
  })

  describe('timeline DTO', () => {
    it('exposes currentStage, completedStages, remainingStages, estimatedProgress', () => {
      const timeline = buildConversationTimeline('comparing')
      expect(timeline.currentStage).toBe('comparing')
      expect(timeline.completedStages).toEqual(['thinking', 'searching', 'comparing'])
      expect(timeline.remainingStages).toEqual([
        'optimizing',
        'final_recommendation',
        'booking_ready',
      ])
      expect(timeline.estimatedProgress).toBeGreaterThan(0)
      expect(timeline.estimatedProgress).toBeLessThan(100)
    })
  })

  describe('streaming chunks', () => {
    it('emits incremental Thinking… Searching… Comparing… chunks', () => {
      const chunks = buildStreamingChunks('optimizing')
      expect(chunks.map((c) => c.text)).toEqual([
        'Thinking…',
        'Searching flights…',
        'Comparing hotels…',
        'Checking prices…',
      ])
      expect(chunks[0]?.sequence).toBe(1)
      expect(chunks.at(-1)?.progressPercent).toBeGreaterThan(chunks[0]!.progressPercent)
    })
  })

  describe('typing metadata', () => {
    it('includes responseDelay, estimatedRemaining, streamSequence', () => {
      const typing = buildTypingMetadata({
        streamSequence: 4,
        remainingStages: 2,
        mode: 'concierge',
        baseDelayMs: 100,
      })
      expect(typing.responseDelay).toBe(100)
      expect(typing.estimatedRemaining).toBe(200)
      expect(typing.streamSequence).toBe(4)
    })
  })

  describe('progress events', () => {
    it('emits ConversationProgressEvent with status and phase', () => {
      const session = buildLiveConversationSession({
        conversationId: 'live_evt',
        targetState: 'final_recommendation',
      })
      expect(session.events.length).toBeGreaterThan(0)
      expect(session.events[0]?.name).toBe('conversation.progress')
      expect(session.events[0]?.conversationId).toBe('live_evt')
      expect(session.events[0]?.status).toMatch(/streaming|completed/)
      expect(session.events[0]?.phase).toBeTruthy()
    })
  })

  describe('legacy vs concierge mode', () => {
    it('uses shorter delays in concierge mode', () => {
      const legacy = buildLiveConversationSession({
        targetState: 'searching',
        mode: 'legacy',
      })
      const concierge = buildLiveConversationSession({
        targetState: 'searching',
        mode: 'concierge',
      })
      expect(concierge.typing.responseDelay).toBeLessThanOrEqual(legacy.typing.responseDelay)
    })
  })

  describe('feature flag off', () => {
    it('returns empty UI payload without session', () => {
      getFeatureRegistry().setEnabled('ai.live_conversation', false)
      const res = runLiveConversationExperience({
        conversationId: 'off',
        enabled: false,
      })
      expect(res.enabled).toBe(false)
      expect(res.session).toBeNull()
      expect(res.meta).toBeNull()
      expect(res.ui.chunks).toEqual([])
      expect(res.ui.timeline).toBeNull()
    })
  })

  describe('empty responses', () => {
    it('emptyLiveConversationSession is idle-safe', () => {
      const empty = emptyLiveConversationSession('x')
      expect(empty.status).toBe('idle')
      expect(empty.chunks).toEqual([])
      expect(empty.timeline.estimatedProgress).toBe(0)
      expect(empty.timeline.currentStage).toBeNull()
    })
  })

  describe('interruption recovery', () => {
    it('marks interrupted then recovers to target', () => {
      const interrupted = buildLiveConversationSession({
        conversationId: 'irq',
        targetState: 'booking_ready',
        interruptAt: 'comparing',
        recover: false,
      })
      expect(interrupted.interrupted).toBe(true)
      expect(interrupted.status).toBe('interrupted')
      expect(interrupted.state).toBe('comparing')

      const recovered = buildLiveConversationSession({
        conversationId: 'irq',
        targetState: 'final_recommendation',
        interruptAt: 'comparing',
        recover: true,
      })
      expect(recovered.recovered).toBe(true)
      expect(recovered.interrupted).toBe(false)
      expect(recovered.state).toBe('final_recommendation')
      expect(recovered.events.some((e) => e.status === 'recovered')).toBe(true)
    })
  })

  describe('serializers', () => {
    it('builds UI payload with timeline, chunks, typing', () => {
      const ui = toLiveConversationUiPayload({
        conversationId: 'ser',
        targetState: 'booking_ready',
        mode: 'concierge',
      })
      expect(ui.enabled).toBe(true)
      expect(ui.timeline?.currentStage).toBe('booking_ready')
      expect(ui.chunks.length).toBe(6)
      expect(ui.typing?.streamSequence).toBe(6)
      expect(ui.meta?.estimatedProgress).toBe(100)
    })
  })
})
